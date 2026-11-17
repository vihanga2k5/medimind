import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { APPOINTMENT_STATUSES, CONSULTATION_TYPES } from '../models/enums.js'
import { Appointment } from '../models/index.js'
import { bookAppointment, changeAppointmentStatus, rescheduleAppointment } from '../services/appointments.js'
import { presentAppointment } from '../services/presenters.js'
import { badRequest, forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery, sortFrom } from '../utils/pagination.js'
import { idParams, objectId } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const isoDate = z.iso.datetime({ offset: true, message: 'Must be an ISO 8601 date-time' }).transform(value => new Date(value))

const createSchema = z.object({
  doctorId: objectId,
  patientId: objectId.optional(),
  startAt: isoDate,
  consultationType: z.enum(CONSULTATION_TYPES).default('in_person'),
  reason: z.string().trim().min(3, 'Please describe the reason for the visit').max(500),
}).strict()

const updateSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  startAt: isoDate.optional(),
  cancellationReason: z.string().trim().max(300).optional(),
}).strict().refine(body => body.status || body.startAt, { message: 'Provide a status or a new startAt' })
  .refine(body => !(body.status && body.startAt), { message: 'Change the status and the time in separate requests' })

const listQuery = z.object({
  ...paginationQuery,
  status: z.string().optional().transform(value => value?.split(',').map(item => item.trim()).filter(Boolean)).pipe(z.array(z.enum(APPOINTMENT_STATUSES)).optional()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  scope: z.enum(['upcoming', 'past']).optional(),
  sort: z.string().max(30).optional(),
})

// Every role sees a different slice: patients their own, doctors their assigned, admins all.
function scopeFilter(user) {
  if (user.role === 'patient') return { patientId: user.profileId }
  if (user.role === 'doctor') return { doctorId: user.profileId }
  return {}
}

async function loadForUser(id, user) {
  const appointment = await Appointment.findById(id)
  if (!appointment) throw notFound('Appointment not found.')
  const owner = user.role === 'admin'
    || (user.role === 'patient' && String(appointment.patientId) === String(user.profileId))
    || (user.role === 'doctor' && String(appointment.doctorId) === String(user.profileId))
  if (!owner) throw forbidden('You are not authorised to access this appointment.')
  return appointment
}

router.post('/', authorize('patient', 'admin'), validate({ body: createSchema }), async (req, res) => {
  const body = req.valid.body
  let patientId = req.user.profileId
  if (req.user.role === 'admin') {
    if (!body.patientId) throw badRequest('patientId is required when booking on behalf of a patient.')
    patientId = body.patientId
  } else if (body.patientId && body.patientId !== String(req.user.profileId)) {
    throw forbidden('Patients can only book appointments for themselves.')
  }
  const appointment = await bookAppointment({ patientId, doctorId: body.doctorId, startAt: body.startAt, consultationType: body.consultationType, reason: body.reason })
  const populated = await Appointment.findById(appointment._id).populate('doctorId').populate('patientId').lean()
  res.status(201).json({ data: presentAppointment(populated) })
})

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const query = req.valid.query
  const filter = { ...scopeFilter(req.user) }
  if (req.user.role === 'admin') {
    if (query.doctorId) filter.doctorId = query.doctorId
    if (query.patientId) filter.patientId = query.patientId
  } else if (req.user.role === 'doctor' && query.patientId) {
    filter.patientId = query.patientId
  }
  if (query.status?.length) filter.status = { $in: query.status }
  const now = new Date()
  if (query.from || query.to || query.scope) {
    filter.startAt = {}
    if (query.from) filter.startAt.$gte = query.from
    if (query.to) filter.startAt.$lt = query.to
    if (query.scope === 'upcoming') filter.startAt.$gte = query.from && query.from > now ? query.from : now
    if (query.scope === 'past') filter.startAt.$lt = query.to && query.to < now ? query.to : now
  }
  const { skip, limit } = pageWindow(query)
  const fallbackSort = query.scope === 'past' ? '-startAt' : 'startAt'
  const [rows, total] = await Promise.all([
    Appointment.find(filter).sort(sortFrom(query.sort, ['startAt', 'createdAt', 'status'], fallbackSort)).skip(skip).limit(limit).populate('doctorId').populate('patientId').lean(),
    Appointment.countDocuments(filter),
  ])
  res.json(paginated(rows.map(presentAppointment), total, query))
})

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  const appointment = await loadForUser(req.valid.params.id, req.user)
  const populated = await Appointment.findById(appointment._id).populate('doctorId').populate('patientId').lean()
  res.json({ data: presentAppointment(populated) })
})

router.patch('/:id', validate({ params: idParams, body: updateSchema }), async (req, res) => {
  const appointment = await loadForUser(req.valid.params.id, req.user)
  const { status, startAt, cancellationReason } = req.valid.body
  if (startAt) {
    if (req.user.role === 'doctor') throw forbidden('Doctors cannot reschedule appointments. Please ask the patient or an administrator.')
    await rescheduleAppointment(appointment, startAt)
  } else if (status !== appointment.status) {
    await changeAppointmentStatus(appointment, status, req.user, cancellationReason)
  }
  const populated = await Appointment.findById(appointment._id).populate('doctorId').populate('patientId').lean()
  res.json({ data: presentAppointment(populated) })
})

export default router
