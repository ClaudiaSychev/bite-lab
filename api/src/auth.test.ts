import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { prisma } from './db.ts'

const app = createApp()
const credentials = { username: 'chef', password: 'correct-horse' }

function sessionCookie(res: request.Response): string | undefined {
  const header = res.headers['set-cookie'] as unknown
  const cookies = Array.isArray(header) ? (header as string[]) : []
  return cookies.find((c) => c.startsWith('sid='))
}

beforeEach(async () => {
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/signup', () => {
  it('creates a user, hashes the password and sets an httpOnly session cookie', async () => {
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/signup').send(credentials)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ user: { id: expect.any(String), username: 'chef' } })
    const cookie = sessionCookie(res)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)

    const stored = await prisma.user.findUniqueOrThrow({ where: { username: 'chef' } })
    expect(stored.passwordHash).not.toBe(credentials.password)
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/)

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user.username).toBe('chef')
  })

  it('rejects a duplicate username, case-insensitively', async () => {
    await request(app).post('/api/auth/signup').send(credentials).expect(201)

    const same = await request(app).post('/api/auth/signup').send(credentials)
    expect(same.status).toBe(409)
    expect(same.body.error).toBe('Username is already taken')

    const differentCase = await request(app)
      .post('/api/auth/signup')
      .send({ ...credentials, username: 'CHEF' })
    expect(differentCase.status).toBe(409)
    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects a password shorter than the minimum length', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'chef', password: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 8/)
    expect(sessionCookie(res)).toBeUndefined()
    expect(await prisma.user.count()).toBe(0)
  })

  it('rejects a missing or invalid username', async () => {
    await request(app).post('/api/auth/signup').send({ password: 'long-enough' }).expect(400)
    await request(app).post('/api/auth/signup').send({ username: 'a b', password: 'long-enough' }).expect(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(credentials).expect(201)
  })

  it('logs in with the right password', async () => {
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/login').send(credentials)
    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('chef')
    expect(sessionCookie(res)).toMatch(/HttpOnly/i)
    await agent.get('/api/auth/me').expect(200)
  })

  it('rejects a wrong password without setting a cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid username or password')
    expect(sessionCookie(res)).toBeUndefined()
  })

  it('gives an unknown username the same error as a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever-123' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid username or password')
  })
})

describe('unauthenticated access', () => {
  it('rejects a request with no session cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Not authenticated')
  })

  it('rejects a forged session cookie', async () => {
    await request(app).get('/api/auth/me').set('Cookie', 'sid=forged-token').expect(401)
  })

  it('rejects an expired session', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(credentials).expect(201)
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    await agent.get('/api/auth/me').expect(401)
  })

  it('rejects the old cookie after logout and deletes the session', async () => {
    const signup = await request(app).post('/api/auth/signup').send(credentials).expect(201)
    const cookie = sessionCookie(signup)?.split(';')[0] ?? ''

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logout.status).toBe(204)
    expect(sessionCookie(logout)).toMatch(/sid=;/)
    expect(await prisma.session.count()).toBe(0)

    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401)
  })
})
