import mongoose from 'mongoose'

const diagnosisSchema = new mongoose.Schema({
  code: { type: String, trim: true, maxlength: 20 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
}, { _id: false })

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  dosage: { type: String, trim: true, maxlength: 80 },
  frequency: { type: String, trim: true, maxlength: 80 },
  durationDays: { type: Number, min: 0, max: 3650 },
}, { _id: false })

const medicalRecordSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  visitAt: { type: Date, required: true },
  diagnoses: { type: [diagnosisSchema], default: [] },
  vitals: {
    systolicBP: { type: Number, min: 40, max: 300 },
    diastolicBP: { type: Number, min: 20, max: 200 },
    heartRate: { type: Number, min: 20, max: 250 },
    temperatureC: { type: Number, min: 30, max: 45 },
    weightKg: { type: Number, min: 1, max: 400 },
  },
  medications: { type: [medicationSchema], default: [] },
  notes: { type: String, trim: true, maxlength: 5000 },
  followUpRequired: { type: Boolean, default: false },
  followUpInDays: { type: Number, min: 0, max: 365 },
}, { collection: 'medical_records', timestamps: true })

medicalRecordSchema.index({ patientId: 1, visitAt: -1 })
medicalRecordSchema.index({ doctorId: 1, visitAt: -1 })

export default mongoose.model('MedicalRecord', medicalRecordSchema)
