import { Notification } from '../models/index.js'

export async function notify(recipients, { type, title, relatedId }, session = null) {
  const docs = recipients.filter(Boolean).map(recipientId => ({ recipientId, type, title, relatedId }))
  if (docs.length) await Notification.insertMany(docs, session ? { session } : {})
}
