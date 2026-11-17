import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { auth, createUsers, slotAt, startTestEnvironment } from './helpers.js'

let ctx
let users
let appointmentId

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n')

before(async () => {
  ctx = await startTestEnvironment()
  users = await createUsers(ctx.request)
  const booked = await ctx.request.post('/api/appointments').set(auth(users.patientA)).send({ doctorId: users.doctorA.user.profileId, startAt: slotAt(1, '09:00'), reason: 'Chest discomfort' })
  appointmentId = booked.body.data.id
})
after(async () => { await ctx.stop() })

describe('medical records', () => {
  test('assigned doctor creates a clinical record', async () => {
    const res = await ctx.request.post('/api/medical-records').set(auth(users.doctorA)).send({
      patientId: users.patientA.user.profileId,
      diagnoses: [{ code: 'Z00.0', description: 'General examination' }],
      vitals: { systolicBP: 120, diastolicBP: 80, heartRate: 75 },
      notes: 'Synthetic consultation note.',
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.doctor.name, 'Dr. Aminda Kalpage')
    assert.equal(res.body.data.vitals.heartRate, 75)
  })

  test('cannot record a visit for a future appointment', async () => {
    const res = await ctx.request.post('/api/medical-records').set(auth(users.doctorA)).send({ patientId: users.patientA.user.profileId, appointmentId, notes: 'Too early' })
    assert.equal(res.status, 400)
  })

  test('unassigned doctor cannot create or read records', async () => {
    const create = await ctx.request.post('/api/medical-records').set(auth(users.doctorB)).send({ patientId: users.patientA.user.profileId, notes: 'Not my patient' })
    assert.equal(create.status, 403)
    const read = await ctx.request.get(`/api/medical-records/patient/${users.patientA.user.profileId}`).set(auth(users.doctorB))
    assert.equal(read.status, 403)
  })

  test('patient reads own history but not another patient\'s', async () => {
    const own = await ctx.request.get(`/api/medical-records/patient/${users.patientA.user.profileId}`).set(auth(users.patientA))
    assert.equal(own.status, 200)
    assert.equal(own.body.pagination.total, 1)
    const other = await ctx.request.get(`/api/medical-records/patient/${users.patientA.user.profileId}`).set(auth(users.patientB))
    assert.equal(other.status, 403)
  })

  test('administrator has no blanket access to clinical notes', async () => {
    const res = await ctx.request.get(`/api/medical-records/patient/${users.patientA.user.profileId}`).set(auth(users.admin))
    assert.equal(res.status, 403)
  })
})

describe('documents', () => {
  let documentId

  test('patient uploads a PDF and metadata is stored', async () => {
    const res = await ctx.request.post('/api/documents').set(auth(users.patientA)).field('category', 'Laboratory').attach('file', PDF, { filename: 'blood-test.pdf', contentType: 'application/pdf' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.name, 'blood-test.pdf')
    assert.equal(res.body.data.type, 'PDF')
    assert.equal(res.body.data.sizeBytes, PDF.length)
    assert.match(res.body.data.checksum, /^[a-f0-9]{64}$/)
    assert.equal(res.body.data.storageKey, undefined)
    documentId = res.body.data.id
  })

  test('rejects disallowed types and spoofed content', async () => {
    const exe = await ctx.request.post('/api/documents').set(auth(users.patientA)).attach('file', Buffer.from('MZ fake'), { filename: 'virus.exe', contentType: 'application/x-msdownload' })
    assert.equal(exe.status, 400)
    const spoofed = await ctx.request.post('/api/documents').set(auth(users.patientA)).attach('file', Buffer.from('not really a pdf'), { filename: 'fake.pdf', contentType: 'application/pdf' })
    assert.equal(spoofed.status, 400)
    const empty = await ctx.request.post('/api/documents').set(auth(users.patientA)).field('category', 'Laboratory')
    assert.equal(empty.status, 400)
  })

  test('controls retrieval by owner and assigned doctor only', async () => {
    const own = await ctx.request.get(`/api/documents/${documentId}/download`).set(auth(users.patientA)).buffer(true).parse((res, done) => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => done(null, Buffer.concat(chunks))) })
    assert.equal(own.status, 200)
    assert.equal(own.headers['content-type'], 'application/pdf')
    assert.ok(own.body.equals(PDF))

    const doctor = await ctx.request.get(`/api/documents/${documentId}`).set(auth(users.doctorA))
    assert.equal(doctor.status, 200)

    const other = await ctx.request.get(`/api/documents/${documentId}/download`).set(auth(users.patientB))
    assert.equal(other.status, 403)
    const otherDoctor = await ctx.request.get(`/api/documents?patientId=${users.patientA.user.profileId}`).set(auth(users.doctorB))
    assert.equal(otherDoctor.status, 403)
  })

  test('lists own documents with pagination', async () => {
    const res = await ctx.request.get('/api/documents?limit=5').set(auth(users.patientA))
    assert.equal(res.status, 200)
    assert.equal(res.body.pagination.total, 1)
  })
})
