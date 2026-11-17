import mongoose from 'mongoose'

export const MAX_MESSAGES_PER_CONVERSATION = 100

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'ai'], required: true },
  text: { type: String, required: true, maxlength: 4000 },
  sources: { type: [String], default: undefined },
  fallback: Boolean,
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const aiConversationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, trim: true, maxlength: 120 },
  messages: { type: [messageSchema], default: [] },
  messageCount: { type: Number, default: 0 },
}, { collection: 'ai_conversations', timestamps: true })

aiConversationSchema.index({ patientId: 1, updatedAt: -1 })

export default mongoose.model('AiConversation', aiConversationSchema)
