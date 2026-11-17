import mongoose from 'mongoose'

export const DEFAULT_SETTINGS = {
  requireDoctorVerification: true,
  maxBookingDaysAhead: 90,
  patientCancellationHours: 2,
}

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { collection: 'settings', timestamps: true })

settingSchema.index({ key: 1 }, { unique: true })

export default mongoose.model('Setting', settingSchema)
