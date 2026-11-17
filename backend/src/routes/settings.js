import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { getSettings, updateSettings } from '../services/settings.js'

const router = Router()
router.use(authenticate, authorize('admin'))

const updateSchema = z.object({
  requireDoctorVerification: z.boolean().optional(),
  maxBookingDaysAhead: z.number().int().min(1).max(365).optional(),
  patientCancellationHours: z.number().int().min(0).max(72).optional(),
}).strict()

router.get('/', async (_req, res) => {
  res.json({ data: await getSettings() })
})

router.put('/', validate({ body: updateSchema }), async (req, res) => {
  res.json({ data: await updateSettings(req.valid.body, req.user._id) })
})

export default router
