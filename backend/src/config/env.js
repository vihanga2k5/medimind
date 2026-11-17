try { process.loadEnvFile() } catch { }

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') throw new Error(`Missing required environment variable ${name}`)
  return value
}

const isTest = process.env.NODE_ENV === 'test'

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medimind_db',
  jwtSecret: required('JWT_SECRET', isTest ? 'test-only-secret' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(url => url.trim()),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  aiServiceKey: process.env.AI_SERVICE_KEY || '',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 8000),
  clinicUtcOffsetMinutes: Number(process.env.CLINIC_UTC_OFFSET_MINUTES || 330),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || (isTest ? 4 : 10)),
}
