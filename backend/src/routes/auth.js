import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../config/env.js'
import { authenticate, signToken } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { Doctor, Patient, User } from '../models/index.js'
import { initialsOf } from '../services/presenters.js'
import { conflict, unauthorized } from '../utils/httpError.js'

const router = Router()

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } })

const password = z.string().min(8, 'Password must be at least 8 characters').max(128).regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number')

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password,
  phone: z.string().trim().max(30).optional(),
  dateOfBirth: z.coerce.date().max(new Date(), 'Date of birth cannot be in the future').optional(),
}).refine(body => body.name || body.fullName, { message: 'Full name is required', path: ['name'] })

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
})

export async function sessionUser(user) {
  const profile = user.role === 'patient' ? await Patient.findOne({ userId: user._id }).lean()
    : user.role === 'doctor' ? await Doctor.findOne({ userId: user._id }).lean() : null
  const name = profile?.fullName || (user.role === 'admin' ? 'Vihanga B. Hettiarachchi' : user.email)
  return { id: String(user._id), email: user.email, role: user.role, name, initials: initialsOf(name), profileId: profile ? String(profile._id) : null }
}

// Self-registration always creates a patient; doctor and admin accounts are created by administrators.
router.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const { email, phone, dateOfBirth } = req.valid.body
  const fullName = req.valid.body.fullName || req.valid.body.name
  if (await User.exists({ email })) throw conflict('An account with this email already exists.')
  const passwordHash = await bcrypt.hash(req.valid.body.password, env.bcryptRounds)
  const user = await User.create({ email, passwordHash, role: 'patient' })
  try {
    await Patient.create({ userId: user._id, fullName, dateOfBirth, contact: { email, phone } })
  } catch (error) {
    await User.deleteOne({ _id: user._id })
    throw error
  }
  res.status(201).json({ token: signToken(user), user: await sessionUser(user) })
})

router.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { email, password: plain } = req.valid.body
  const user = await User.findOne({ email }).select('+passwordHash')
  const valid = user ? await bcrypt.compare(plain, user.passwordHash) : await bcrypt.compare(plain, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali')
  if (!user || !valid) throw unauthorized('Incorrect email or password.')
  if (user.status !== 'active') throw unauthorized('This account has been suspended. Please contact support.')
  user.lastLoginAt = new Date()
  await user.save()
  res.json({ token: signToken(user), user: await sessionUser(user) })
})

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user._id).lean()
  res.json({ user: await sessionUser(user) })
})

export default router
