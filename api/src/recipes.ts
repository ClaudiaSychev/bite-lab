import { Router } from 'express'
import { currentUser, requireAuth } from './auth.ts'
import { prisma } from './db.ts'
import { parseDraftUpdate, parseTitle } from './draft.ts'
import { versionsRouter } from './versions.ts'

const DEFAULT_TITLE = 'Untitled recipe'

function parseNewTitle(body: unknown) {
  if (typeof body !== 'object' || body === null || !('title' in body)) {
    return { ok: true, value: DEFAULT_TITLE } as const
  }
  return parseTitle(body.title)
}

export const recipesRouter = Router()
recipesRouter.use(requireAuth)
recipesRouter.use('/:id/versions', versionsRouter)

// In-progress recipes are the user's drafts that haven't been published yet.
recipesRouter.get('/', async (_req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { userId: currentUser(res).id, publishedVersionId: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true, _count: { select: { versions: true } } },
  })
  res.json({
    recipes: recipes.map(({ _count, ...recipe }) => ({ ...recipe, versionCount: _count.versions })),
  })
})

recipesRouter.post('/', async (req, res) => {
  const title = parseNewTitle(req.body as unknown)
  if (!title.ok) {
    res.status(400).json({ error: title.error })
    return
  }
  const recipe = await prisma.recipe.create({
    data: { userId: currentUser(res).id, title: title.value },
  })
  res.status(201).json({ recipe })
})

// Other users' recipes answer 404, not 403, so their existence isn't revealed.
recipesRouter.get('/:id', async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { id: req.params.id, userId: currentUser(res).id },
    include: { _count: { select: { versions: true } } },
  })
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const { _count, ...rest } = recipe
  res.json({ recipe: { ...rest, versionCount: _count.versions } })
})

// Autosave target: updates the draft only. Saved versions are never touched here.
recipesRouter.patch('/:id', async (req, res) => {
  const update = parseDraftUpdate(req.body as unknown)
  if (!update.ok) {
    res.status(400).json({ error: update.error })
    return
  }
  const { count } = await prisma.recipe.updateMany({
    where: { id: req.params.id, userId: currentUser(res).id },
    data: update.value,
  })
  if (count === 0) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { id: true, updatedAt: true },
  })
  res.json({ recipe })
})

recipesRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.recipe.deleteMany({
    where: { id: req.params.id, userId: currentUser(res).id },
  })
  if (count === 0) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  res.status(204).end()
})
