import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import mongoose from 'mongoose'
import { auth, createUsers, env, slotAt, startMockAiService, startTestEnvironment } from './helpers.js'

let ctx
let users
let ai

before(async () => {
  ctx = await startTestEnvironment()
  users = await createUsers(ctx.request)
  ai = await startMockAiService()
  env.aiServiceKey = 'internal-test-key'
  for (const [session, doctor, day, time] of [[users.patientA, users.doctorA, 1, '09:00'], [users.patientB, users.doctorA, 1, '09:30'], [users.patientB, users.doctorB, 2, '10:00']]) {
    await ctx.request.post('/api/appointments').set(auth(session)).send({ doctorId: doctor.user.profileId, startAt: slotAt(day, time), reason: 'Analytics seed' })
  }
})
after(async () => {
  await ai.close()
  await ctx.stop()
})

describe('AI assistant proxy', () => {
  test('returns the FastAPI answer with sources and disclaimer', async () => {
    env.aiServiceUrl = ai.url
    const res = await ctx.request.post('/api/ai/chat').set(auth(users.patientA)).send({ message: 'What is a routine checkup?' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.fallback, false)
    assert.deepEqual(res.body.data.sources, ['approved-health-reference'])
    assert.ok(res.body.data.disclaimer)
    assert.ok(res.body.data.conversationId)
    assert.equal(ai.calls.at(-1).body.question, 'What is a routine checkup?')
    assert.equal(ai.calls.at(-1).serviceKey, 'internal-test-key')

    const history = await ctx.request.get(`/api/ai/conversations/${res.body.data.conversationId}`).set(auth(users.patientA))
    assert.equal(history.body.data.messages.length, 2)
    const stolen = await ctx.request.get(`/api/ai/conversations/${res.body.data.conversationId}`).set(auth(users.patientB))
    assert.equal(stolen.status, 404)
  })

  test('returns a safe fallback when the AI service is unavailable', async () => {
    env.aiServiceUrl = 'http://127.0.0.1:9'
    const res = await ctx.request.post('/api/ai/chat').set(auth(users.patientA)).send({ question: 'How can I sleep better?' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.fallback, true)
    assert.match(res.body.data.answer, /temporarily unavailable/)
    assert.ok(res.body.data.disclaimer)
  })

  test('escalates emergencies without calling the model', async () => {
    env.aiServiceUrl = ai.url
    const before = ai.calls.length
    const res = await ctx.request.post('/api/ai/chat').set(auth(users.patientA)).send({ message: 'I have severe chest pain right now' })
    assert.equal(res.body.data.emergency, true)
    assert.match(res.body.data.answer, /emergency/i)
    assert.equal(ai.calls.length, before)
  })

  test('only patients can use the assistant', async () => {
    const res = await ctx.request.post('/api/ai/chat').set(auth(users.doctorA)).send({ message: 'Hello' })
    assert.equal(res.status, 403)
  })

  test('no-show prediction sends derived features only', async () => {
    env.aiServiceUrl = ai.url
    const list = await ctx.request.get('/api/appointments').set(auth(users.doctorA))
    const res = await ctx.request.post('/api/ai/no-show-risk').set(auth(users.doctorA)).send({ appointmentId: list.body.data[0].id })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.riskScore, 0.31)
    const sent = ai.calls.at(-1).body
    assert.deepEqual(Object.keys(sent).sort(), ['consultationType', 'leadTimeDays', 'priorMissedVisits', 'priorVisits', 'rescheduleCount'])
  })
})

describe('analytics', () => {
  test('overview totals match independent control counts', async () => {
    const res = await ctx.request.get('/api/analytics/overview').set(auth(users.admin))
    assert.equal(res.status, 200)
    const db = mongoose.connection.db
    assert.equal(res.body.data.totals.registeredPatients, await db.collection('patients').countDocuments())
    assert.equal(res.body.data.totals.totalAppointments, await db.collection('appointments').countDocuments())
    assert.equal(res.body.data.totals.activeDoctors, await db.collection('doctors').countDocuments({ verificationStatus: 'verified' }))
    assert.equal(res.body.data.monthlyAppointments.length, 6)
    assert.equal(res.body.data.weekdayActivity.reduce((sum, row) => sum + row.total, 0), 3)
    assert.equal(res.body.data.appointmentsBySpecialty.find(row => row.specialty === 'Cardiologist').totalAppointments, 2)
  })

  test('appointments by doctor matches control totals', async () => {
    const res = await ctx.request.get('/api/analytics/appointments-by-doctor').set(auth(users.admin))
    assert.equal(res.body.data[0].name, 'Dr. Aminda Kalpage')
    assert.equal(res.body.data[0].totalAppointments, 2)
    assert.equal(res.body.data.reduce((sum, row) => sum + row.totalAppointments, 0), 3)
  })

  test('analytics endpoints are restricted to administrators', async () => {
    assert.equal((await ctx.request.get('/api/analytics/overview').set(auth(users.patientA))).status, 403)
    assert.equal((await ctx.request.get('/api/analytics/overview').set(auth(users.doctorA))).status, 403)
  })

  test('role dashboards return personal figures', async () => {
    const doctor = await ctx.request.get('/api/analytics/me').set(auth(users.doctorA))
    assert.equal(doctor.body.data.activePatients, 2)
    const patient = await ctx.request.get('/api/analytics/me').set(auth(users.patientB))
    assert.equal(patient.body.data.upcomingAppointments, 2)
    assert.equal(patient.body.data.nextAppointment.doctor.name, 'Dr. Aminda Kalpage')
  })

  test('schedule lookup uses the compound index', async () => {
    const plan = await mongoose.connection.db.collection('appointments')
      .find({ doctorId: new mongoose.Types.ObjectId(users.doctorA.user.profileId), startAt: { $gte: new Date() } })
      .sort({ startAt: 1 }).explain('executionStats')
    const text = JSON.stringify(plan.queryPlanner.winningPlan)
    assert.match(text, /IXSCAN/)
    assert.match(text, /doctorId_1_startAt_1/)
    assert.equal(plan.executionStats.totalDocsExamined, plan.executionStats.nReturned)
  })
})
