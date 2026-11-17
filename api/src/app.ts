import express from 'express'
import { authRouter, loadUser } from './auth.ts'
import { publicRouter } from './publishing.ts'
import { recipesRouter } from './recipes.ts'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use(loadUser)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/recipes', recipesRouter)
  app.use('/api/public', publicRouter)

  return app
}
