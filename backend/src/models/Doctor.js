import mongoose from 'mongoose'
import { VERIFICATION_STATUSES } from './enums.js'

const availabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  slotMinutes: { type: Number, min: 10, max: 120, default: 30 },
}, { _id: false })

const doctorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  specialty: { type: String, required: true, trim: true, maxlength: 80 },
  hospital: { type: String, trim: true, maxlength: 120 },
  city: { type: String, trim: true, maxlength: 80 },
  experienceYears: { type: Number, min: 0, max: 70, default: 0 },
  consultationFee: { type: Number, min: 0, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, min: 0, default: 0 },
  about: { type: String, trim: true, maxlength: 1000 },
  expertise: { type: [String], default: [] },
  color: { type: String, enum: ['coral', 'blue', 'purple', 'gold', 'teal'], default: 'teal' },
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending' },
  availability: { type: [availabilitySchema], default: [], validate: [list => list.length <= 21, 'Weekly availability is limited to 21 blocks'] },
}, { collection: 'doctors', timestamps: true })

doctorSchema.index({ userId: 1 }, { unique: true })
doctorSchema.index({ specialty: 1, rating: -1 })

export default mongoose.model('Doctor', doctorSchema)
