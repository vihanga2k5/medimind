import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { ALLERGY_SEVERITIES, BLOOD_GROUPS, GENDERS } from '../models/enums.js'
import { Patient } from '../models/index.js'
import { assertProfileAccess } from '../services/access.js'
import { presentPatient } from '../services/presenters.js'
import { forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery, sortFrom } from '../utils/pagination.js'
import { escapeRegex, idParams } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const listQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(100).optional(),
  allergy: z.string().trim().max(100).optional(),
  city: z.string().trim().max(80).optional(),
  sort: z.string().max(30).optional(),
})

const text = max => z.string().trim().max(max)

const updateSchema = z.object({
  fullName: text(120).min(2).optional(),
  dateOfBirth: z.coerce.date().max(new Date(), 'Date of birth cannot be in the future').nullable().optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
  contact: z.object({ phone: text(30).optional() }).strict().optional(),
  address: z.object({ line1: text(200).optional(), city: text(80).optional(), country: text(80).optional() }).strict().optional(),
  allergies: z.array(z.object({ substance: text(100).min(1), severity: z.enum(ALLERGY_SEVERITIES).default('Moderate'), notes: text(300).optional() }).strict()).max(50).optional(),
  emergencyContact: z.object({ name: text(120).optional(), relationship: text(60).optional(), phone: text(30).optional() }).strict().optional(),
}).strict()

router.get('/', authorize('doctor', 'admin'), validate({ query: listQuery }), async (req, res) => {
  const query = req.valid.query
  const { skip, limit } = pageWindow(query)
  const nameFilter = query.q ? { fullName: { $regex: escapeRegex(query.q), $options: 'i' } } : {}
  const allergyFilter = query.allergy ? { allergies: { $elemMatch: { substance: { $regex: `^${escapeRegex(query.allergy)}$`, $options: 'i' } } } } : {}
  const cityFilter = query.city ? { 'address.city': { $regex: `^${escapeRegex(query.city)}$`, $options: 'i' } } : {}

  if (req.user.role === 'doctor') {
    const [result] = await Patient.db.collection('appointments').aggregate([
      { $match: { doctorId: req.user.profileId, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$patientId', lastVisitAt: { $max: { $cond: [{ $lte: ['$startAt', new Date()] }, '$startAt', null] } }, nextVisitAt: { $min: { $cond: [{ $gt: ['$startAt', new Date()] }, '$startAt', null] } }, appointmentCount: { $sum: 1 } } },
      { $lookup: { from: 'patients', localField: '_id', foreignField: '_id', as: 'patient' } },
      { $unwind: '$patient' },
      { $match: Object.fromEntries(Object.entries({ ...nameFilter, ...allergyFilter, ...cityFilter }).map(([key, value]) => [`patient.${key}`, value])) },
      { $sort: { lastVisitAt: -1, _id: 1 } },
      { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'count' }] } },
    ]).toArray()
    const data = result.data.map(row => presentPatient(row.patient, { lastVisitAt: row.lastVisitAt, nextVisitAt: row.nextVisitAt, appointmentCount: row.appointmentCount }))
    return res.json(paginated(data, result.total[0]?.count || 0, query))
  }

  const filter = { ...nameFilter, ...allergyFilter, ...cityFilter }
  const [rows, total] = await Promise.all([
    Patient.find(filter).sort(sortFrom(query.sort, ['createdAt', 'fullName', 'dateOfBirth'], '-createdAt')).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ])
  res.json(paginated(rows.map(row => presentPatient(row)), total, query))
})

router.get('/me', authorize('patient'), async (req, res) => {
  res.json({ data: presentPatient(req.user.profile) })
})

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  const patient = await Patient.findById(req.valid.params.id).lean()
  if (!patient) {
    if (req.user.role === 'admin') throw notFound('Patient not found.')
    throw forbidden('You are not authorised to view this patient.')
  }
  await assertProfileAccess(req.user, patient._id)
  res.json({ data: presentPatient(patient) })
})

router.put('/:id', authorize('patient'), validate({ params: idParams, body: updateSchema }), async (req, res) => {
  if (String(req.user.profileId) !== req.valid.params.id) throw forbidden('You can only update your own profile.')
  const body = req.valid.body
  const set = {}
  for (const [key, value] of Object.entries(body)) {
    if (['contact', 'address', 'emergencyContact'].includes(key)) {
      for (const [field, fieldValue] of Object.entries(value)) set[`${key}.${field}`] = fieldValue
    } else {
      set[key] = value
    }
  }
  const patient = await Patient.findByIdAndUpdate(req.user.profileId, { $set: set }, { returnDocument: 'after', runValidators: true }).lean()
  res.json({ data: presentPatient(patient) })
})

export default router
