import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { AiConversation, MedicalDocument, MedicalRecord } from '../models/index.js'
import * as aggregations from '../database/aggregations.js'
import { presentAppointment } from '../services/presenters.js'

const router = Router()
router.use(authenticate)

const rangeQuery = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

router.get('/overview', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  const { months } = req.valid.query
  const [overview, monthly, bySpecialty, weekday, activity] = await Promise.all([
    aggregations.platformOverview(),
    aggregations.monthlyAppointments({ months }),
    aggregations.appointmentsBySpecialty(),
    aggregations.weekdayActivity(),
    aggregations.recentActivity(),
  ])
  res.json({ data: { ...overview, monthlyAppointments: monthly, appointmentsBySpecialty: bySpecialty, weekdayActivity: weekday, recentActivity: activity } })
})

router.get('/appointments-by-doctor', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  res.json({ data: await aggregations.appointmentsByDoctor(req.valid.query) })
})

router.get('/appointments-by-specialty', authorize('admin'), async (_req, res) => {
  res.json({ data: await aggregations.appointmentsBySpecialty() })
})

router.get('/monthly-appointments', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  res.json({ data: await aggregations.monthlyAppointments(req.valid.query) })
})

router.get('/weekday-activity', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  res.json({ data: await aggregations.weekdayActivity(req.valid.query) })
})

router.get('/patient-growth', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  res.json({ data: await aggregations.patientGrowth(req.valid.query) })
})

router.get('/allergies', authorize('admin'), validate({ query: rangeQuery }), async (req, res) => {
  res.json({ data: await aggregations.allergyPrevalence(req.valid.query) })
})

router.get('/ai-engagement', authorize('admin'), async (_req, res) => {
  res.json({ data: await aggregations.aiEngagement() })
})

// Role-specific dashboard figures for the signed-in patient or doctor.
router.get('/me', authorize('patient', 'doctor'), async (req, res) => {
  if (req.user.role === 'doctor') return res.json({ data: await aggregations.doctorWorkload(req.user.profileId) })
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const [summary, records, documents, documentsThisMonth, conversations] = await Promise.all([
    aggregations.patientSummary(req.user.profileId),
    MedicalRecord.countDocuments({ patientId: req.user.profileId }),
    MedicalDocument.countDocuments({ patientId: req.user.profileId }),
    MedicalDocument.countDocuments({ patientId: req.user.profileId, uploadedAt: { $gte: monthStart } }),
    AiConversation.countDocuments({ patientId: req.user.profileId }),
  ])
  res.json({
    data: {
      upcomingAppointments: summary.upcomingAppointments,
      completedAppointments: summary.completedAppointments,
      nextAppointment: summary.nextAppointment ? presentAppointment(summary.nextAppointment) : null,
      medicalRecords: records,
      documents,
      documentsThisMonth,
      aiConversations: conversations,
    },
  })
})

export default router
