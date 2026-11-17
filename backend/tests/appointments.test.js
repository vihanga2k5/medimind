import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { auth, createUsers, slotAt, startTestEnvironment } from './helpers.js'

let ctx
let users

before(async () => {
  ctx = await startTestEnvironment()
  users = await createUsers(ctx.request)
})
after(async () => { await ctx.stop() })

const book = (session, body) => ctx.request.post('/api/appointments').set(auth(session)).send(body)

describe('appointments', () => {
  test('books an available slot', async () => {
    const res = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(2, '10:00'), consultationType: 'online', reason: 'Routine checkup' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.status, 'confirmed')
    assert.equal(res.body.data.doctor.name, 'Dr. Aminda Kalpage')
    assert.equal(new Date(res.body.data.endAt) - new Date(res.body.data.startAt), 30 * 60 * 1000)

    const slots = await ctx.request.get(`/api/doctors/${users.doctorA.user.profileId}/slots?date=${slotAt(2, '10:00').slice(0, 10)}`).set(auth(users.patientB))
    const slot = slots.body.data.find(item => item.startAt === slotAt(2, '10:00'))
    assert.equal(slot.status, 'booked')
  })

  test('rejects a second booking for the same slot with 409', async () => {
    const res = await book(users.patientB, { doctorId: users.doctorA.user.profileId, startAt: slotAt(2, '10:00'), reason: 'Second opinion' })
    assert.equal(res.status, 409)
  })

  test('allows only one of many simultaneous requests for the same slot', async () => {
    const extraPatients = await Promise.all([1, 2, 3, 4, 5].map(async index => (await ctx.request.post('/api/auth/register').send({ name: `Race Patient ${index}`, email: `race${index}@test.local`, password: 'Patient123' })).body))
    const results = await Promise.all(extraPatients.map(session => book(session, { doctorId: users.doctorB.user.profileId, startAt: slotAt(3, '11:30'), reason: 'Concurrency test' })))
    const statuses = results.map(res => res.status).sort()
    assert.deepEqual(statuses, [201, 409, 409, 409, 409])
  })

  test('rejects invalid dates, off-schedule times and missing fields', async () => {
    const past = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(-1, '10:00'), reason: 'Past date' })
    assert.equal(past.status, 400)
    const offSchedule = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(2, '22:00'), reason: 'Late night' })
    assert.equal(offSchedule.status, 400)
    const unaligned = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(2, '10:07'), reason: 'Odd minute' })
    assert.equal(unaligned.status, 400)
    const notADate = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: 'tomorrow', reason: 'Bad date' })
    assert.equal(notADate.status, 400)
    const missing = await book(users.patientA, { startAt: slotAt(2, '11:00'), reason: 'No doctor' })
    assert.equal(missing.status, 400)
  })

  test('blocks a patient from double booking themselves', async () => {
    const res = await book(users.patientA, { doctorId: users.doctorB.user.profileId, startAt: slotAt(2, '10:00'), reason: 'Overlap' })
    assert.equal(res.status, 409)
  })

  test('lists appointments filtered by role', async () => {
    await book(users.patientB, { doctorId: users.doctorB.user.profileId, startAt: slotAt(4, '09:00'), reason: 'Headache review' })
    const doctorA = await ctx.request.get('/api/appointments').set(auth(users.doctorA))
    assert.equal(doctorA.status, 200)
    assert.ok(doctorA.body.data.length >= 1)
    assert.ok(doctorA.body.data.every(item => item.doctorId === users.doctorA.user.profileId))

    const patientB = await ctx.request.get('/api/appointments?scope=upcoming').set(auth(users.patientB))
    assert.ok(patientB.body.data.every(item => item.patientId === users.patientB.user.profileId))

    const admin = await ctx.request.get('/api/appointments?limit=2').set(auth(users.admin))
    assert.equal(admin.body.data.length, 2)
    assert.ok(admin.body.pagination.total >= 3)
  })

  test('reschedules and cancels with slot release', async () => {
    const created = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(5, '14:00'), reason: 'Reschedule test' })
    const id = created.body.data.id

    const otherDoctor = await ctx.request.patch(`/api/appointments/${id}`).set(auth(users.doctorB)).send({ status: 'cancelled' })
    assert.equal(otherDoctor.status, 403)

    const moved = await ctx.request.patch(`/api/appointments/${id}`).set(auth(users.patientA)).send({ startAt: slotAt(5, '15:00') })
    assert.equal(moved.status, 200)
    assert.equal(moved.body.data.startAt, slotAt(5, '15:00'))
    assert.equal(moved.body.data.rescheduleCount, 1)

    const reuseOld = await book(users.patientB, { doctorId: users.doctorA.user.profileId, startAt: slotAt(5, '14:00'), reason: 'Old slot is free' })
    assert.equal(reuseOld.status, 201)

    const cancelled = await ctx.request.patch(`/api/appointments/${id}`).set(auth(users.patientA)).send({ status: 'cancelled', cancellationReason: 'Feeling better' })
    assert.equal(cancelled.body.data.status, 'cancelled')

    const reuseCancelled = await book(users.patientB, { doctorId: users.doctorA.user.profileId, startAt: slotAt(5, '15:00'), reason: 'Cancelled slot is free' })
    assert.equal(reuseCancelled.status, 201)
  })

  test('enforces status transition rules', async () => {
    const created = await book(users.patientA, { doctorId: users.doctorA.user.profileId, startAt: slotAt(6, '09:30'), reason: 'Status test' })
    const patientConfirm = await ctx.request.patch(`/api/appointments/${created.body.data.id}`).set(auth(users.patientA)).send({ status: 'completed' })
    assert.equal(patientConfirm.status, 403)
    const earlyComplete = await ctx.request.patch(`/api/appointments/${created.body.data.id}`).set(auth(users.doctorA)).send({ status: 'completed' })
    assert.equal(earlyComplete.status, 400)
  })
})
