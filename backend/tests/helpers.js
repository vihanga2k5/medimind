import http from 'node:http'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-for-automated-tests-only'
process.env.AI_TIMEOUT_MS = '1500'

const { createApp } = await import('../src/app.js')
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js')
const { env } = await import('../src/config/env.js')
const { applySchemaValidators, syncAllIndexes } = await import('../src/database/setup.js')
const { addDays, localDateString, localTimeToDate } = await import('../src/services/schedule.js')
const supertest = (await import('supertest')).default

export { env }

export async function startTestEnvironment() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await connectDatabase(replSet.getUri('medimind_test'))
  await applySchemaValidators()
  await syncAllIndexes()
  const app = createApp()
  return {
    request: supertest(app),
    async stop() {
      await disconnectDatabase()
      await replSet.stop()
    },
  }
}

export function slotAt(daysAhead, time = '10:00') {
  return localTimeToDate(addDays(localDateString(new Date()), daysAhead), time).toISOString()
}

export function startMockAiService() {
  const calls = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      calls.push({ path: req.url, body: JSON.parse(body || '{}'), serviceKey: req.headers['x-service-key'] })
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/ai/chat') return res.end(JSON.stringify({ answer: 'A routine checkup is a general preventive visit. General educational information only.', sources: ['approved-health-reference'], disclaimer: 'Not medical advice' }))
      if (req.url === '/predict/no-show') return res.end(JSON.stringify({ riskScore: 0.31, modelVersion: 'demo-v1' }))
      res.statusCode = 404
      res.end('{}')
    })
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, calls, close: () => new Promise(done => server.close(done)) })))
}

export const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00', slotMinutes: 30 }))

export async function createUsers(request) {
  const { User } = await import('../src/models/index.js')
  const bcrypt = (await import('bcryptjs')).default
  await User.create({ email: 'admin@test.local', passwordHash: await bcrypt.hash('Admin12345', 4), role: 'admin' })
  const admin = (await request.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin12345' })).body

  const register = async (name, email) => (await request.post('/api/auth/register').send({ name, email, password: 'Patient123' })).body
  const patientA = await register('Vihanga A. Hettiarachchi', 'vihanga@test.local')
  const patientB = await register('Malitha Bandara', 'malitha@test.local')

  const createDoctor = async (fullName, email, specialty) => {
    await request.post('/api/doctors').set('Authorization', `Bearer ${admin.token}`)
      .send({ email, password: 'Doctor12345', fullName, specialty, hospital: 'Test Hospital', city: 'Kandy', consultationFee: 2500, availability: ALL_WEEK })
    return (await request.post('/api/auth/login').send({ email, password: 'Doctor12345' })).body
  }
  const doctorA = await createDoctor('Dr. Aminda Kalpage', 'aminda@test.local', 'Cardiologist')
  const doctorB = await createDoctor('Dr. Cheveen Ranasinghe', 'cheveen@test.local', 'Neurologist')
  return { admin, patientA, patientB, doctorA, doctorB }
}

export const auth = session => ({ Authorization: `Bearer ${session.token}` })
