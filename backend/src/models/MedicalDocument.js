import mongoose from 'mongoose'
import { DOCUMENT_CATEGORIES, DOCUMENT_MIME_TYPES } from './enums.js'

const medicalDocumentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  category: { type: String, enum: DOCUMENT_CATEGORIES, default: 'Patient upload' },
  provider: { type: String, trim: true, maxlength: 120 },
  storageKey: { type: mongoose.Schema.Types.ObjectId, required: true },
  mimeType: { type: String, enum: DOCUMENT_MIME_TYPES, required: true },
  sizeBytes: { type: Number, min: 1, required: true },
  checksum: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { collection: 'medical_documents' })

medicalDocumentSchema.index({ patientId: 1, uploadedAt: -1 })
medicalDocumentSchema.index({ storageKey: 1 }, { unique: true })

medicalDocumentSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.storageKey; return ret },
})

export default mongoose.model('MedicalDocument', medicalDocumentSchema)
