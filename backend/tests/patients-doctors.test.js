import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { auth, createUsers, startTestEnvironment } from './helpers.js'

let ctx
let users

before(async () => {
  ctx = await startTestEnvironment()
  users = await createUsers(ctx.request)
})
after(async () => { await ctx.stop() })

describe('patient profiles', () => {
  test('patient updates own profile with embedded allergies and emergency contact', async () => {
    const res = await ctx.request.put(`/api/patients/${users.patientA.user.profileId}`).set(auth(users.patientA)).send({
      bloodGroup: 'O+',
      address: { city: 'Kandy', country: 'Sri Lanka' },
      allergies: [{ substance: 'Penicillin', severity: 'Moderate' }],
      emergencyContact: { name: 'Lakshitha Banda', relationship: 'Brother', phone: '+94 77 000 0000' },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.allergies[0].substance, 'Penicillin')
    assert.equal(res.body.data.address.city, 'Kandy')
    assert.equal(res.body.data.emergencyContact.relationship, 'Brother')
  })

  test('rejects fields that are not allowed to change', async () => {
    const res = await ctx.request.put(`/api/patients/${users.patientA.user.profileId}`).set(auth(users.patientA)).send({ userId: users.patientB.user.id })
    assert.equal(res.status, 400)
  })

  test('patient cannot read or update another patient', async () => {
    const read = await ctx.request.get(`/api/patients/${users.patientB.user.profileId}`).set(auth(users.patientA))
    assert.equal(read.status, 403)
    const write = await ctx.request.put(`/api/patients/${users.patientB.user.profileId}`).set(auth(users.patientA)).send({ bloodGroup: 'A+' })
    assert.equal(write.status, 403)
  })

  test('doctor cannot read an unassigned patient', async () => {
    const res = await ctx.request.get(`/api/patients/${users.patientA.user.profileId}`).set(auth(users.doctorA))
    assert.equal(res.status, 403)
  })

  test('admin can filter patients by allergy', async () => {
    const res = await ctx.request.get('/api/patients?allergy=penicillin').set(auth(users.admin))
    assert.equal(res.status, 200)
    assert.equal(res.body.pagination.total, 1)
    assert.equal(res.body.data[0].fullName, 'Vihanga A. Hettiarachchi')
  })
})

describe('doctor directory', () => {
  test('searches, filters and paginates doctors', async () => {
    const all = await ctx.request.get('/api/doctors?limit=1&sort=fullName').set(auth(users.patientA))
    assert.equal(all.status, 200)
    assert.equal(all.body.data.length, 1)
    assert.equal(all.body.pagination.total, 2)
    assert.equal(all.body.pagination.totalPages, 2)
    assert.equal(all.body.data[0].name, 'Dr. Aminda Kalpage')
    assert.ok(all.body.data[0].nextAvailableAt)
    assert.deepEqual(all.body.specialties, ['Cardiologist', 'Neurologist'])

    const filtered = await ctx.request.get('/api/doctors?specialty=Neurologist').set(auth(users.patientA))
    assert.equal(filtered.body.data.length, 1)
    assert.equal(filtered.body.data[0].name, 'Dr. Cheveen Ranasinghe')

    const search = await ctx.request.get('/api/doctors?q=aminda').set(auth(users.patientA))
    assert.equal(search.body.data.length, 1)
  })

  test('caps page size and rejects invalid pagination', async () => {
    const res = await ctx.request.get('/api/doctors?limit=500').set(auth(users.patientA))
    assert.equal(res.status, 400)
  })

  test('hides unverified doctors from patients', async () => {
    const created = await ctx.request.post('/api/doctors').set(auth(users.admin)).send({ email: 'pending@test.local', password: 'Doctor12345', fullName: 'Dr. Dihasa Dihasa', specialty: 'Dermatologist', verificationStatus: 'pending' })
    assert.equal(created.status, 201)
    const list = await ctx.request.get('/api/doctors').set(auth(users.patientA))
    assert.ok(!list.body.data.some(doctor => doctor.name === 'Dr. Dihasa Dihasa'))
    const detail = await ctx.request.get(`/api/doctors/${created.body.data.id}`).set(auth(users.patientA))
    assert.equal(detail.status, 404)
  })

  test('only administrators can add doctors', async () => {
    const res = await ctx.request.post('/api/doctors').set(auth(users.patientA)).send({ email: 'x@test.local', password: 'Doctor12345', fullName: 'Dr. Bob Odenkirk', specialty: 'Dermatologist' })
    assert.equal(res.status, 403)
  })
})
