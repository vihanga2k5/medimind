import mongoose from 'mongoose'
import { APPOINTMENT_STATUSES, CONSULTATION_TYPES } from './enums.js'

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: 'confirmed' },
  consultationType: { type: String, enum: CONSULTATION_TYPES, default: 'in_person' },
  reason: { type: String, trim: true, maxlength: 500 },
  bookedAt: { type: Date, default: Date.now },
  cancelledAt: Date,
  cancellationReason: { type: String, trim: true, maxlength: 300 },
  rescheduleCount: { type: Number, default: 0 },
}, { collection: 'appointments', timestamps: true })

appointmentSchema.index({ doctorId: 1, startAt: 1 })
appointmentSchema.index({ patientId: 1, startAt: -1 })
appointmentSchema.index({ status: 1, startAt: -1 })

export default mongoose.model('Appointment', appointmentSchema)
