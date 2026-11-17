import mongoose from 'mongoose'
import { ROLES, USER_STATUSES } from './enums.js'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true },
  status: { type: String, enum: USER_STATUSES, default: 'active' },
  lastLoginAt: Date,
}, { collection: 'users', timestamps: true })

userSchema.index({ email: 1 }, { unique: true })

export default mongoose.model('User', userSchema)
