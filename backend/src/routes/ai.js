import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { AiConversation, Appointment } from '../models/index.js'
import { MAX_MESSAGES_PER_CONVERSATION } from '../models/AiConversation.js'
import { AI_DISCLAIMER, AiServiceError, EMERGENCY_MESSAGE, callAiService, fallbackAnswer, isEmergency } from '../services/aiClient.js'
import { HttpError, forbidden, notFound } from '../utils/httpError.js'
import { pageWindow, paginated, paginationQuery } from '../utils/pagination.js'
import { idParams, objectId } from '../utils/validators.js'

const router = Router()
router.use(authenticate)

const chatSchema = z.object({
  message: z.string().trim().min(1).max(1000).optional(),
  question: z.string().trim().min(1).max(1000).optional(),
  conversationId: objectId.optional(),
  sessionId: z.string().max(100).optional(),
}).strict().refine(body => body.message || body.question, { message: 'Type a question for the assistant', path: ['message'] })

const aiAnswerSchema = z.object({
  answer: z.string().min(1).max(4000),
  sources: z.array(z.string().max(200)).max(20).default([]),
  disclaimer: z.string().max(500).optional(),
})

const noShowResponseSchema = z.object({
  riskScore: z.number().min(0).max(1),
  modelVersion: z.string().max(50),
}).loose()

async function conversationFor(patientId, conversationId, firstQuestion) {
  if (conversationId) {
    const conversation = await AiConversation.findById(conversationId).lean()
    if (!conversation) throw notFound('Conversation not found.')
    if (String(conversation.patientId) !== String(patientId)) throw forbidden('You can only continue your own conversations.')
    return conversation
  }
  return (await AiConversation.create({ patientId, title: firstQuestion.slice(0, 80) })).toObject()
}

router.post('/chat', authorize('patient'), validate({ body: chatSchema }), async (req, res) => {
  const question = req.valid.body.message || req.valid.body.question
  const conversation = await conversationFor(req.user.profileId, req.valid.body.conversationId, question)
  const emergency = isEmergency(question)

  let reply
  if (emergency) {
    reply = { answer: `${EMERGENCY_MESSAGE} MediMind cannot help with emergencies online.`, sources: [], disclaimer: AI_DISCLAIMER, emergency: true, fallback: false }
  } else {
    try {
      const result = aiAnswerSchema.parse(await callAiService('/ai/chat', { question, sessionId: String(conversation._id) }))
      reply = { answer: result.answer, sources: result.sources, disclaimer: result.disclaimer || AI_DISCLAIMER, emergency: false, fallback: false }
    } catch (error) {
      if (!(error instanceof AiServiceError) && !(error instanceof z.ZodError)) throw error
      console.warn(`[ai] chat fallback used: ${error instanceof z.ZodError ? 'invalid response schema' : error.message}`)
      reply = fallbackAnswer(question)
    }
  }

  const now = new Date()
  await AiConversation.updateOne({ _id: conversation._id }, {
    $push: { messages: { $each: [{ sender: 'user', text: question, createdAt: now }, { sender: 'ai', text: reply.answer, sources: reply.sources, fallback: reply.fallback, createdAt: now }], $slice: -MAX_MESSAGES_PER_CONVERSATION } },
    $inc: { messageCount: 2 },
  })
  res.json({ data: { ...reply, conversationId: String(conversation._id) } })
})

router.get('/conversations', authorize('patient'), validate({ query: z.object(paginationQuery) }), async (req, res) => {
  const filter = { patientId: req.user.profileId }
  const { skip, limit } = pageWindow(req.valid.query)
  const [rows, total] = await Promise.all([
    AiConversation.find(filter, { messages: 0 }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    AiConversation.countDocuments(filter),
  ])
  res.json(paginated(rows.map(row => ({ id: String(row._id), title: row.title, messageCount: row.messageCount, createdAt: row.createdAt, updatedAt: row.updatedAt })), total, req.valid.query))
})

router.get('/conversations/:id', authorize('patient'), validate({ params: idParams }), async (req, res) => {
  const conversation = await AiConversation.findById(req.valid.params.id).lean()
  if (!conversation || String(conversation.patientId) !== String(req.user.profileId)) throw notFound('Conversation not found.')
  res.json({ data: { id: String(conversation._id), title: conversation.title, messages: conversation.messages, messageCount: conversation.messageCount, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt, disclaimer: AI_DISCLAIMER } })
})

router.delete('/conversations/:id', authorize('patient'), validate({ params: idParams }), async (req, res) => {
  const result = await AiConversation.deleteOne({ _id: req.valid.params.id, patientId: req.user.profileId })
  if (!result.deletedCount) throw notFound('Conversation not found.')
  res.status(204).end()
})

// Features are derived on the server so no identifying details are sent to the AI service.
router.post('/no-show-risk', authorize('doctor', 'admin'), validate({ body: z.object({ appointmentId: objectId }).strict() }), async (req, res) => {
  const appointment = await Appointment.findById(req.valid.body.appointmentId).lean()
  if (!appointment) throw notFound('Appointment not found.')
  if (req.user.role === 'doctor' && String(appointment.doctorId) !== String(req.user.profileId)) throw forbidden('This appointment is not assigned to you.')
  const [priorMissedVisits, priorVisits] = await Promise.all([
    Appointment.countDocuments({ patientId: appointment.patientId, status: 'no_show', startAt: { $lt: appointment.startAt } }),
    Appointment.countDocuments({ patientId: appointment.patientId, status: { $in: ['completed', 'no_show'] }, startAt: { $lt: appointment.startAt } }),
  ])
  const features = {
    leadTimeDays: Math.max(0, Math.round((appointment.startAt - (appointment.bookedAt || appointment.createdAt)) / 86400000)),
    priorMissedVisits,
    priorVisits,
    consultationType: appointment.consultationType,
    rescheduleCount: appointment.rescheduleCount || 0,
  }
  try {
    const prediction = noShowResponseSchema.parse(await callAiService('/predict/no-show', features))
    res.json({ data: { appointmentId: String(appointment._id), features, ...prediction } })
  } catch (error) {
    if (!(error instanceof AiServiceError) && !(error instanceof z.ZodError)) throw error
    throw new HttpError(503, 'The prediction service is temporarily unavailable. Please try again later.')
  }
})

export default router
