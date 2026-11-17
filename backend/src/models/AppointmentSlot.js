import mongoose from 'mongoose'

// One document per booked doctor slot. The unique key is what rejects double booking,
// even when two requests arrive at the same moment.
const appointmentSlotSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  startAt: { type: Date, required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
}, { collection: 'appointment_slots', timestamps: { createdAt: true, updatedAt: false } })

appointmentSlotSchema.index({ doctorId: 1, startAt: 1 }, { unique: true })
appointmentSlotSchema.index({ appointmentId: 1 })

export default mongoose.model('AppointmentSlot', appointmentSlotSchema)
