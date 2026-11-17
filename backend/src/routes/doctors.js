import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { VERIFICATION_STATUSES } from '../models/enums.js'
import { AppointmentSlot, Doctor, User } from '../models/index.js'
import { notify } from '../services/notifications.js'
import { presentDoctor } from '../services/presenters.js'
import { addDays, localDateString, slotsForDate } from '../services/schedule.js'
import { getSettings } from '../services/settings.js'
import { conflict, forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery, sortFrom } from '../utils/pagination.js'
import { escapeRegex, idParams } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const NEXT_SLOT_SEARCH_DAYS = 14
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:MM format')

const availabilitySchema = z.array(z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
  slotMinutes: z.coerce.number().int().min(10).max(120).default(30),
}).refine(block => block.startTime < block.endTime, { message: 'endTime must be after startTime' })).max(21)

const profileFields = {
  fullName: z.string().trim().min(2).max(120),
  specialty: z.string().trim().min(2).max(80),
  hospital: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  experienceYears: z.coerce.number().int().min(0).max(70).optional(),
  consultationFee: z.coerce.number().min(0).max(1000000).optional(),
  about: z.string().trim().max(1000).optional(),
  expertise: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
  color: z.enum(['coral', 'blue', 'purple', 'gold', 'teal']).optional(),
  availability: availabilitySchema.optional(),
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/\d/),
  ...profileFields,
  verificationStatus: z.enum(VERIFICATION_STATUSES).default('verified'),
}).strict()

const updateSchema = z.object(Object.fromEntries(Object.entries(profileFields).map(([key, schema]) => [key, schema.optional()]))).strict()

const listQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  availableOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  status: z.enum(VERIFICATION_STATUSES).optional(),
  sort: z.string().max(30).optional(),
})

async function nextAvailableSlots(doctors) {
  if (!doctors.length) return new Map()
  const today = localDateString(new Date())
  const from = new Date()
  const to = new Date(Date.now() + (NEXT_SLOT_SEARCH_DAYS + 1) * 86400000)
  const booked = await AppointmentSlot.find({ doctorId: { $in: doctors.map(d => d._id) }, startAt: { $gte: from, $lt: to } }, { doctorId: 1, startAt: 1 }).lean()
  const taken = new Set(booked.map(slot => `${slot.doctorId}|${slot.startAt.getTime()}`))
  const result = new Map()
  for (const doctor of doctors) {
    for (let day = 0; day <= NEXT_SLOT_SEARCH_DAYS && !result.has(String(doctor._id)); day += 1) {
      const slot = slotsForDate(doctor, addDays(today, day)).find(item => item.startAt > from && !taken.has(`${doctor._id}|${item.startAt.getTime()}`))
      if (slot) result.set(String(doctor._id), slot.startAt)
    }
  }
  return result
}

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const query = req.valid.query
  const settings = await getSettings()
  const filter = {}
  if (req.user.role === 'admin') {
    if (query.status) filter.verificationStatus = query.status
  } else if (settings.requireDoctorVerification) {
    filter.verificationStatus = 'verified'
  }
  if (query.q) {
    const pattern = { $regex: escapeRegex(query.q), $options: 'i' }
    filter.$or = [{ fullName: pattern }, { specialty: pattern }, { hospital: pattern }]
  }
  if (query.specialty) filter.specialty = { $regex: `^${escapeRegex(query.specialty)}$`, $options: 'i' }
  if (query.city) filter.city = { $regex: `^${escapeRegex(query.city)}$`, $options: 'i' }
  if (query.minRating !== undefined) filter.rating = { $gte: query.minRating }
  if (query.availableOn) {
    const day = new Date(`${query.availableOn}T00:00:00Z`).getUTCDay()
    filter.availability = { $elemMatch: { dayOfWeek: day } }
  }
  const { skip, limit } = pageWindow(query)
  const [rows, total, specialties] = await Promise.all([
    Doctor.find(filter).sort(sortFrom(query.sort, ['rating', 'fullName', 'experienceYears', 'consultationFee', 'createdAt'], '-rating')).skip(skip).limit(limit).lean(),
    Doctor.countDocuments(filter),
    Doctor.distinct('specialty', req.user.role === 'admin' || !settings.requireDoctorVerification ? {} : { verificationStatus: 'verified' }),
  ])
  const next = await nextAvailableSlots(rows)
  res.json({ ...paginated(rows.map(doctor => presentDoctor(doctor, { nextAvailableAt: next.get(String(doctor._id)) || null })), total, query), specialties: specialties.sort() })
})

router.post('/', authorize('admin'), validate({ body: createSchema }), async (req, res) => {
  const { email, password, ...profile } = req.valid.body
  if (await User.exists({ email })) throw conflict('An account with this email already exists.')
  const user = await User.create({ email, passwordHash: await bcrypt.hash(password, env.bcryptRounds), role: 'doctor' })
  try {
    const doctor = await Doctor.create({ ...profile, userId: user._id })
    res.status(201).json({ data: presentDoctor(doctor.toObject()) })
  } catch (error) {
    await User.deleteOne({ _id: user._id })
    throw error
  }
})

router.get('/me', authorize('doctor'), async (req, res) => {
  res.json({ data: presentDoctor(req.user.profile) })
})

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  const doctor = await Doctor.findById(req.valid.params.id).lean()
  const settings = await getSettings()
  const hidden = settings.requireDoctorVerification && doctor?.verificationStatus !== 'verified' && req.user.role !== 'admin' && String(req.user.profileId) !== String(doctor?._id)
  if (!doctor || hidden) throw notFound('Doctor not found.')
  const next = await nextAvailableSlots([doctor])
  res.json({ data: presentDoctor(doctor, { nextAvailableAt: next.get(String(doctor._id)) || null }) })
})

router.get('/:id/slots', validate({ params: idParams, query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD format') }) }), async (req, res) => {
  const doctor = await Doctor.findById(req.valid.params.id).lean()
  if (!doctor) throw notFound('Doctor not found.')
  const slots = slotsForDate(doctor, req.valid.query.date)
  const booked = slots.length ? await AppointmentSlot.find({ doctorId: doctor._id, startAt: { $gte: slots[0].startAt, $lte: slots.at(-1).startAt } }, { startAt: 1 }).lean() : []
  const taken = new Set(booked.map(slot => slot.startAt.getTime()))
  const now = Date.now()
  res.json({
    data: slots.map(slot => ({
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: slot.startAt.getTime() <= now ? 'past' : taken.has(slot.startAt.getTime()) ? 'booked' : 'available',
      available: slot.startAt.getTime() > now && !taken.has(slot.startAt.getTime()),
    })),
  })
})

router.put('/:id', authorize('doctor', 'admin'), validate({ params: idParams, body: updateSchema }), async (req, res) => {
  if (req.user.role === 'doctor' && String(req.user.profileId) !== req.valid.params.id) throw forbidden('You can only update your own profile.')
  const doctor = await Doctor.findByIdAndUpdate(req.valid.params.id, { $set: req.valid.body }, { returnDocument: 'after', runValidators: true }).lean()
  if (!doctor) throw notFound('Doctor not found.')
  res.json({ data: presentDoctor(doctor) })
})

router.patch('/:id/verification', authorize('admin'), validate({ params: idParams, body: z.object({ verificationStatus: z.enum(VERIFICATION_STATUSES) }).strict() }), async (req, res) => {
  const doctor = await Doctor.findByIdAndUpdate(req.valid.params.id, { $set: { verificationStatus: req.valid.body.verificationStatus } }, { returnDocument: 'after' }).lean()
  if (!doctor) throw notFound('Doctor not found.')
  await notify([doctor.userId], { type: 'doctor_verified', title: `Your directory profile is now ${doctor.verificationStatus}`, relatedId: doctor._id })
  res.json({ data: presentDoctor(doctor) })
})

export default router
