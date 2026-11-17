import mongoose from 'mongoose'
import { NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from './enums.js'

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: NOTIFICATION_STATUSES, default: 'unread' },
  relatedId: mongoose.Schema.Types.ObjectId,
  readAt: Date,
}, { collection: 'notifications', timestamps: { createdAt: true, updatedAt: false } })

notificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
