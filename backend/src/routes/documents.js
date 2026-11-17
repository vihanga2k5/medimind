import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { z } from 'zod'
import { env } from '../config/env.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { DOCUMENT_CATEGORIES, DOCUMENT_MIME_TYPES } from '../models/enums.js'
import { MedicalDocument, Patient } from '../models/index.js'
import { assertClinicalAccess } from '../services/access.js'
import { notify } from '../services/notifications.js'
import { presentDocument } from '../services/presenters.js'
import { badRequest, forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery } from '../utils/pagination.js'
import { idParams, objectId } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const BUCKET = 'document_files'
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 10 },
  fileFilter: (_req, file, done) => done(DOCUMENT_MIME_TYPES.includes(file.mimetype) ? null : badRequest('Only PDF, JPEG and PNG files can be uploaded.'), DOCUMENT_MIME_TYPES.includes(file.mimetype)),
})

// The declared type must match the file's actual signature bytes.
function signatureMatches(buffer, mimeType) {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('latin1') === '%PDF-'
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  return false
}

const uploadFields = z.object({
  patientId: objectId.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  provider: z.string().trim().max(120).optional(),
})

const listQuery = z.object({ ...paginationQuery, patientId: objectId.optional(), category: z.enum(DOCUMENT_CATEGORIES).optional() })

async function resolvePatientId(user, requested) {
  if (user.role === 'patient') {
    if (requested && requested !== String(user.profileId)) throw forbidden('Patients can only manage their own documents.')
    return user.profileId
  }
  if (!requested) throw badRequest('patientId is required.')
  await assertClinicalAccess(user, requested)
  return new mongoose.Types.ObjectId(requested)
}

async function loadDocument(id, user) {
  const document = await MedicalDocument.findById(id).lean()
  if (!document) throw notFound('Document not found.')
  await assertClinicalAccess(user, document.patientId)
  return document
}

router.post('/', authorize('patient', 'doctor'), upload.single('file'), validate({ body: uploadFields }), async (req, res) => {
  if (!req.file) throw badRequest('Attach a file in the "file" field.')
  if (!signatureMatches(req.file.buffer, req.file.mimetype)) throw badRequest('The file content does not match its declared type.')
  const body = req.valid.body
  const patientId = await resolvePatientId(req.user, body.patientId)
  const patient = await Patient.findById(patientId, { userId: 1 }).lean()
  if (!patient) throw notFound('Patient not found.')

  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
  const originalName = req.file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 200)
  const storageKey = new mongoose.Types.ObjectId()
  await new Promise((resolve, reject) => {
    Readable.from(req.file.buffer)
      .pipe(bucket().openUploadStreamWithId(storageKey, `${storageKey}`, { metadata: { patientId, contentType: req.file.mimetype, checksum } }))
      .on('finish', resolve)
      .on('error', reject)
  })

  try {
    const document = await MedicalDocument.create({
      patientId,
      uploadedBy: req.user._id,
      name: body.name || originalName,
      category: body.category || (req.user.role === 'patient' ? 'Patient upload' : 'Clinical note'),
      provider: body.provider || (req.user.role === 'doctor' ? req.user.profile.hospital || req.user.profile.fullName : 'You'),
      storageKey,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      checksum,
    })
    if (req.user.role === 'doctor') await notify([patient.userId], { type: 'document_uploaded', title: 'A new document was added to your health record', relatedId: document._id })
    res.status(201).json({ data: presentDocument(document.toObject()) })
  } catch (error) {
    await bucket().delete(storageKey).catch(() => {})
    throw error
  }
})

router.get('/', authorize('patient', 'doctor'), validate({ query: listQuery }), async (req, res) => {
  const query = req.valid.query
  const filter = { patientId: await resolvePatientId(req.user, query.patientId) }
  if (query.category) filter.category = query.category
  const { skip, limit } = pageWindow(query)
  const [rows, total] = await Promise.all([
    MedicalDocument.find(filter).sort({ uploadedAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    MedicalDocument.countDocuments(filter),
  ])
  res.json(paginated(rows.map(presentDocument), total, query))
})

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  res.json({ data: presentDocument(await loadDocument(req.valid.params.id, req.user)) })
})

router.get('/:id/download', validate({ params: idParams }), async (req, res) => {
  const document = await loadDocument(req.valid.params.id, req.user)
  res.set({
    'Content-Type': document.mimeType,
    'Content-Length': String(document.sizeBytes),
    'Content-Disposition': `attachment; filename="${encodeURIComponent(document.name)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  await new Promise((resolve, reject) => {
    bucket().openDownloadStream(document.storageKey).on('error', reject).pipe(res).on('finish', resolve).on('error', reject)
  })
})

router.delete('/:id', authorize('patient', 'doctor'), validate({ params: idParams }), async (req, res) => {
  const document = await loadDocument(req.valid.params.id, req.user)
  if (String(document.uploadedBy) !== req.user.id) throw forbidden('Only the person who uploaded this document can delete it.')
  await MedicalDocument.deleteOne({ _id: document._id })
  await bucket().delete(document.storageKey).catch(() => {})
  res.status(204).end()
})

export default router
