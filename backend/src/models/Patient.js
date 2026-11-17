import mongoose from 'mongoose'
import { ALLERGY_SEVERITIES, BLOOD_GROUPS, GENDERS } from './enums.js'

const allergySchema = new mongoose.Schema({
  substance: { type: String, required: true, trim: true, maxlength: 100 },
  severity: { type: String, enum: ALLERGY_SEVERITIES, default: 'Moderate' },
  notes: { type: String, trim: true, maxlength: 300 },
}, { _id: false })

const patientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  dateOfBirth: Date,
  gender: { type: String, enum: GENDERS, default: 'undisclosed' },
  bloodGroup: { type: String, enum: BLOOD_GROUPS },
  contact: {
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  address: {
    line1: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80 },
    country: { type: String, trim: true, maxlength: 80 },
  },
  allergies: { type: [allergySchema], default: [], validate: [list => list.length <= 50, 'A patient can have at most 50 allergies'] },
  emergencyContact: {
    name: { type: String, trim: true, maxlength: 120 },
    relationship: { type: String, trim: true, maxlength: 60 },
    phone: { type: String, trim: true, maxlength: 30 },
  },
}, { collection: 'patients', timestamps: true })

patientSchema.index({ userId: 1 }, { unique: true })
patientSchema.index({ 'allergies.substance': 1 })

export default mongoose.model('Patient', patientSchema)
