import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { startTestEnvironment } from './helpers.js'

let ctx

before(async () => { ctx = await startTestEnvironment() })
after(async () => { await ctx.stop() })

describe('authentication', () => {
  test('registers a patient and returns a session token', async () => {
    const res = await ctx.request.post('/api/auth/register').send({ name: 'Vihanga A. Hettiarachchi', email: 'vihanga@example.test', password: 'Secure1234' })
    assert.equal(res.status, 201)
    assert.ok(res.body.token)
    assert.equal(res.body.user.role, 'patient')
    assert.equal(res.body.user.email, 'vihanga@example.test')
    assert.equal(res.body.user.initials, 'VA')
    assert.ok(res.body.user.profileId)
  })

  test('ignores a client-supplied role on registration', async () => {
    const res = await ctx.request.post('/api/auth/register').send({ name: 'Suchith the BugBear', email: 'sneaky@example.test', password: 'Secure1234', role: 'admin' })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.role, 'patient')
  })

  test('rejects duplicate email with 409', async () => {
    const res = await ctx.request.post('/api/auth/register').send({ name: 'Vihanga A. Hettiarachchi Again', email: 'vihanga@example.test', password: 'Secure1234' })
    assert.equal(res.status, 409)
    assert.match(res.body.message, /already exists/)
  })

  test('rejects missing fields and weak passwords with 400', async () => {
    const missing = await ctx.request.post('/api/auth/register').send({ email: 'x@example.test', password: 'Secure1234' })
    assert.equal(missing.status, 400)
    const weak = await ctx.request.post('/api/auth/register').send({ name: 'Bob Odenkirk', email: 'weak@example.test', password: 'short' })
    assert.equal(weak.status, 400)
    assert.ok(Array.isArray(weak.body.details))
  })

  test('logs in with valid credentials', async () => {
    const res = await ctx.request.post('/api/auth/login').send({ email: 'vihanga@example.test', password: 'Secure1234' })
    assert.equal(res.status, 200)
    const me = await ctx.request.get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)
    assert.equal(me.status, 200)
    assert.equal(me.body.user.name, 'Vihanga A. Hettiarachchi')
  })

  test('rejects invalid credentials with 401', async () => {
    const wrongPassword = await ctx.request.post('/api/auth/login').send({ email: 'vihanga@example.test', password: 'WrongPass1' })
    assert.equal(wrongPassword.status, 401)
    const unknown = await ctx.request.post('/api/auth/login').send({ email: 'nobody@example.test', password: 'Secure1234' })
    assert.equal(unknown.status, 401)
    assert.equal(wrongPassword.body.message, unknown.body.message)
  })

  test('rejects operator injection in login payload', async () => {
    const res = await ctx.request.post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } })
    assert.equal(res.status, 400)
  })

  test('requires a valid bearer token on protected routes', async () => {
    assert.equal((await ctx.request.get('/api/appointments')).status, 401)
    assert.equal((await ctx.request.get('/api/appointments').set('Authorization', 'Bearer not-a-token')).status, 401)
  })
})
