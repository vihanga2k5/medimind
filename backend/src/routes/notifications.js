import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { NOTIFICATION_STATUSES } from '../models/enums.js'
import { Notification } from '../models/index.js'
import { notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery } from '../utils/pagination.js'
import { idParams } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

router.get('/', validate({ query: z.object({ ...paginationQuery, status: z.enum(NOTIFICATION_STATUSES).optional() }) }), async (req, res) => {
  const filter = { recipientId: req.user._id, ...(req.valid.query.status ? { status: req.valid.query.status } : {}) }
  const { skip, limit } = pageWindow(req.valid.query)
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: req.user._id, status: 'unread' }),
  ])
  const data = rows.map(row => ({ id: String(row._id), type: row.type, title: row.title, status: row.status, relatedId: row.relatedId ? String(row.relatedId) : null, createdAt: row.createdAt, readAt: row.readAt }))
  res.json({ ...paginated(data, total, req.valid.query), unread })
})

router.patch('/read-all', async (req, res) => {
  const result = await Notification.updateMany({ recipientId: req.user._id, status: 'unread' }, { $set: { status: 'read', readAt: new Date() } })
  res.json({ data: { updated: result.modifiedCount } })
})

router.patch('/:id/read', validate({ params: idParams }), async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.valid.params.id, recipientId: req.user._id }, { $set: { status: 'read', readAt: new Date() } }, { returnDocument: 'after' }).lean()
  if (!notification) throw notFound('Notification not found.')
  res.json({ data: { id: String(notification._id), status: notification.status, readAt: notification.readAt } })
})

export default router
