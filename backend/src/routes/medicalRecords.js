import { Router } from 'express'
import { z } from 'zod'
import { runAtomic } from '../config/db.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { Appointment, MedicalRecord, Patient } from '../models/index.js'
import { assertClinicalAccess } from '../services/access.js'
import { notify } from '../services/notifications.js'
import { presentRecord } from '../services/presenters.js'
import { badRequest, forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery } from '../utils/pagination.js'
import { idParams, objectId } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const text = max => z.string().trim().max(max)

const createSchema = z.object({
  patientId: objectId,
  appointmentId: objectId.optional(),
  visitAt: z.coerce.date().optional(),
  diagnoses: z.array(z.object({ code: text(20).optional(), description: text(300).min(1) }).strict()).max(20).default([]),
  vitals: z.object({
    systolicBP: z.number().min(40).max(300).optional(),
    diastolicBP: z.number().min(20).max(200).optional(),
    heartRate: z.number().min(20).max(250).optional(),
    temperatureC: z.number().min(30).max(45).optional(),
    weightKg: z.number().min(1).max(400).optional(),
  }).strict().default({}),
  medications: z.array(z.object({ name: text(120).min(1), dosage: text(80).optional(), frequency: text(80).optional(), durationDays: z.number().int().min(0).max(3650).optional() }).strict()).max(30).default([]),
  notes: text(5000).optional(),
  followUpRequired: z.boolean().default(false),
  followUpInDays: z.number().int().min(0).max(365).optional(),
}).strict().refine(body => body.notes || body.diagnoses.length, { message: 'Add a consultation note or at least one diagnosis', path: ['notes'] })

const listQuery = z.object({ ...paginationQuery, patientId: objectId.optional() })

const HOUR = 60 * 60 * 1000

router.post('/', authorize('doctor'), validate({ body: createSchema }), async (req, res) => {
  const body = req.valid.body
  const patient = await Patient.findById(body.patientId, { userId: 1 }).lean()
  if (!patient) throw notFound('Patient not found.')
  await assertClinicalAccess(req.user, patient._id)

  let appointment = null
  if (body.appointmentId) {
    appointment = await Appointment.findById(body.appointmentId).lean()
    if (!appointment || String(appointment.doctorId) !== String(req.user.profileId) || String(appointment.patientId) !== body.patientId) throw forbidden('This appointment is not assigned to you for this patient.')
    if (appointment.status === 'cancelled') throw badRequest('Cannot record a visit for a cancelled appointment.')
    if (appointment.startAt.getTime() > Date.now() + HOUR) throw badRequest('Cannot record a visit before the appointment starts.')
  }
  const visitAt = body.visitAt || appointment?.startAt || new Date()
  if (visitAt.getTime() > Date.now() + HOUR) throw badRequest('visitAt cannot be in the future.')

  // The clinical record and the appointment completion are written together.
  const record = await runAtomic(async session => {
    const options = session ? { session } : {}
    const [created] = await MedicalRecord.create([{ ...body, doctorId: req.user.profileId, visitAt }], options)
    if (appointment && ['confirmed', 'checked_in'].includes(appointment.status)) {
      await Appointment.updateOne({ _id: appointment._id, status: appointment.status }, { $set: { status: 'completed' } }, options)
    }
    await notify([patient.userId], { type: 'record_created', title: `${req.user.profile.fullName} added a visit summary to your record`, relatedId: created._id }, session)
    return created
  })
  const populated = await MedicalRecord.findById(record._id).populate('doctorId').lean()
  res.status(201).json({ data: presentRecord(populated) })
})

router.get('/', authorize('patient', 'doctor'), validate({ query: listQuery }), async (req, res) => {
  const query = req.valid.query
  const filter = req.user.role === 'patient' ? { patientId: req.user.profileId } : { doctorId: req.user.profileId }
  if (req.user.role === 'doctor' && query.patientId) filter.patientId = query.patientId
  const { skip, limit } = pageWindow(query)
  const [rows, total] = await Promise.all([
    MedicalRecord.find(filter).sort({ visitAt: -1, _id: 1 }).skip(skip).limit(limit).populate('doctorId').lean(),
    MedicalRecord.countDocuments(filter),
  ])
  res.json(paginated(rows.map(presentRecord), total, query))
})

router.get('/patient/:id', authorize('patient', 'doctor', 'admin'), validate({ params: idParams, query: z.object(paginationQuery) }), async (req, res) => {
  await assertClinicalAccess(req.user, req.valid.params.id)
  const filter = { patientId: req.valid.params.id }
  const { skip, limit } = pageWindow(req.valid.query)
  const [rows, total] = await Promise.all([
    MedicalRecord.find(filter).sort({ visitAt: -1, _id: 1 }).skip(skip).limit(limit).populate('doctorId').lean(),
    MedicalRecord.countDocuments(filter),
  ])
  res.json(paginated(rows.map(presentRecord), total, req.valid.query))
})

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  const record = await MedicalRecord.findById(req.valid.params.id).populate('doctorId').lean()
  if (!record) throw notFound('Medical record not found.')
  await assertClinicalAccess(req.user, record.patientId)
  res.json({ data: presentRecord(record) })
})

export default router
