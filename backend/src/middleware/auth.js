import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Doctor, Patient, User } from '../models/index.js'
import { forbidden, unauthorized } from '../utils/httpError.js'

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn, algorithm: 'HS256' })
}

// Role and profile always come from the database, never from the request body.
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return next(unauthorized())
  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
  } catch (error) {
    return next(unauthorized(error.name === 'TokenExpiredError' ? 'Your session has expired. Please sign in again.' : 'Invalid session token.'))
  }
  const user = await User.findById(payload.sub).lean()
  if (!user || user.status !== 'active') return next(unauthorized('This account is not active.'))
  const profile = user.role === 'patient' ? await Patient.findOne({ userId: user._id }).lean()
    : user.role === 'doctor' ? await Doctor.findOne({ userId: user._id }).lean() : null
  req.user = { id: String(user._id), _id: user._id, email: user.email, role: user.role, profileId: profile ? profile._id : null, profile }
  next()
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}
