import mongoose from 'mongoose'
import multer from 'multer'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.path} was not found.` })
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message, ...(error.details ? { details: error.details } : {}) })
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' })
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' })
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? `File is larger than the ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB limit.` : 'Invalid file upload.'
    return res.status(400).json({ message })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map(item => ({ field: item.path, message: item.message }))
    return res.status(400).json({ message: 'Validation failed.', details })
  }
  if (error instanceof mongoose.Error.CastError) return res.status(400).json({ message: `Invalid value for ${error.path}.` })
  if (error.code === 11000) return res.status(409).json({ message: 'A record with the same unique value already exists.' })
  if (error.code === 121) return res.status(400).json({ message: 'Document failed database validation.' })
  if (!env.isTest) console.error(`[error] ${error.name}: ${error.message}`)
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' })
}
