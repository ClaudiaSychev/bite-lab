import bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'node:crypto'
import { Router, type CookieOptions, type NextFunction, type Request, type Response } from 'express'
import { prisma } from './db.ts'
import { Prisma } from './generated/prisma/client.ts'

export const SESSION_COOKIE = 'sid'
export const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72 // bcrypt ignores anything past 72 bytes
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BCRYPT_ROUNDS = 12
// Compared against when the username doesn't exist, so response time doesn't reveal it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS)

export interface PublicUser {
  id: string
  username: string
}

declare global {
  namespace Express {
    interface Locals {
      user?: PublicUser
    }
  }
}

interface Credentials {
  username: string
  password: string
}

type ParseResult = { ok: true; value: Credentials } | { ok: false; error: string }

function parseCredentials(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Username and password are required' }
  }
  const { username, password } = body as Record<string, unknown>
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'Username and password are required' }
  }
  return { ok: true, value: { username: username.trim().toLowerCase(), password } }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}

function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt })
}

// Sets res.locals.user when the request carries a valid, unexpired session cookie.
export async function loadUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readSessionToken(req)
  if (token) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, username: true } } },
    })
    if (session && session.expiresAt > new Date()) {
      res.locals.user = session.user
    }
  }
  next()
}

export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  next()
}

// For handlers behind requireAuth.
export function currentUser(res: Response): PublicUser {
  const { user } = res.locals
  if (!user) throw new Error('requireAuth must run before this handler')
  return user
}

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const parsed = parseCredentials(req.body as unknown)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { username, password } = parsed.value
  if (!USERNAME_PATTERN.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-32 characters: letters, numbers or underscores',
    })
    return
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
    return
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes` })
    return
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  try {
    const user = await prisma.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true },
    })
    await startSession(res, user.id)
    res.status(201).json({ user })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Username is already taken' })
      return
    }
    throw err
  }
})

authRouter.post('/login', async (req, res) => {
  const parsed = parseCredentials(req.body as unknown)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { username, password } = parsed.value
  const user = await prisma.user.findUnique({ where: { username } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid username or password' })
    return
  }
  await startSession(res, user.id)
  res.json({ user: { id: user.id, username: user.username } })
})

authRouter.post('/logout', async (req, res) => {
  const token = readSessionToken(req)
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions())
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ user: res.locals.user })
})
