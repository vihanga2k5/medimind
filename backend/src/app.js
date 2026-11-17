import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import morgan from 'morgan'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { sanitizeInput } from './middleware/sanitize.js'
import aiRoutes from './routes/ai.js'
import analyticsRoutes from './routes/analytics.js'
import appointmentRoutes from './routes/appointments.js'
import authRoutes from './routes/auth.js'
import doctorRoutes from './routes/doctors.js'
import documentRoutes from './routes/documents.js'
import medicalRecordRoutes from './routes/medicalRecords.js'
import notificationRoutes from './routes/notifications.js'
import patientRoutes from './routes/patients.js'
import settingsRoutes from './routes/settings.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.clientUrls, credentials: true }))
  app.use(express.json({ limit: '100kb' }))
  app.use(sanitizeInput)
  // Logs method, path, status and timing only, never request bodies.
  if (!env.isTest) app.use(morgan(':method :url :status :response-time ms'))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/patients', patientRoutes)
  app.use('/api/doctors', doctorRoutes)
  app.use('/api/appointments', appointmentRoutes)
  app.use('/api/medical-records', medicalRecordRoutes)
  app.use('/api/documents', documentRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/analytics', analyticsRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/settings', settingsRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
