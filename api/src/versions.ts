import { Router } from 'express'
import { currentUser } from './auth.ts'
import { prisma } from './db.ts'
import { parseLabel } from './draft.ts'
import { Prisma } from './generated/prisma/client.ts'

// Mounted under /api/recipes/:id/versions, behind requireAuth.
// Versions are immutable snapshots: there is deliberately no route that updates or deletes one.
export const versionsRouter = Router({ mergeParams: true })

type RecipeParams = { id: string }
type VersionParams = RecipeParams & { versionId: string }

const SUMMARY = { id: true, version: true, label: true, createdAt: true } as const
const SNAPSHOT = { ...SUMMARY, title: true, ingredients: true, instructions: true, notes: true } as const
const MAX_NUMBERING_ATTEMPTS = 3

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

// Copies the saved draft into the next version number. Two saves racing for the same
// number hit the (recipeId, version) unique index; the loser retries with a fresh number.
async function snapshotDraft(recipeId: string, userId: string, label: string | null) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.findFirst({ where: { id: recipeId, userId } })
        if (!recipe) return null
        const latest = await tx.recipeVersion.aggregate({
          where: { recipeId },
          _max: { version: true },
        })
        return tx.recipeVersion.create({
          data: {
            recipeId,
            version: (latest._max.version ?? 0) + 1,
            label,
            title: recipe.title,
            ingredients: recipe.ingredients ?? [],
            instructions: recipe.instructions ?? [],
            notes: recipe.notes,
          },
          select: SUMMARY,
        })
      })
    } catch (err) {
      if (isUniqueViolation(err) && attempt < MAX_NUMBERING_ATTEMPTS) continue
      throw err
    }
  }
}

async function ownsRecipe(recipeId: string, userId: string): Promise<boolean> {
  return (await prisma.recipe.count({ where: { id: recipeId, userId } })) > 0
}

versionsRouter.get<RecipeParams>('/', async (req, res) => {
  if (!(await ownsRecipe(req.params.id, currentUser(res).id))) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const versions = await prisma.recipeVersion.findMany({
    where: { recipeId: req.params.id },
    orderBy: { version: 'desc' },
    select: SUMMARY,
  })
  res.json({ versions })
})

// Snapshots the draft as last saved, so the client should flush pending autosaves first.
versionsRouter.post<RecipeParams>('/', async (req, res) => {
  const body: unknown = req.body
  const label = parseLabel(typeof body === 'object' && body !== null && 'label' in body ? body.label : undefined)
  if (!label.ok) {
    res.status(400).json({ error: label.error })
    return
  }
  const version = await snapshotDraft(req.params.id, currentUser(res).id, label.value)
  if (!version) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  res.status(201).json({ version })
})

function findOwnedVersion(params: VersionParams, userId: string) {
  return prisma.recipeVersion.findFirst({
    where: { id: params.versionId, recipeId: params.id, recipe: { userId } },
    select: SNAPSHOT,
  })
}

versionsRouter.get<VersionParams>('/:versionId', async (req, res) => {
  const version = await findOwnedVersion(req.params, currentUser(res).id)
  if (!version) {
    res.status(404).json({ error: 'Version not found' })
    return
  }
  res.json({ version })
})

// Copies a version back into the draft. Only the Recipe row changes; the version is read, never written.
versionsRouter.post<VersionParams>('/:versionId/restore', async (req, res) => {
  const version = await findOwnedVersion(req.params, currentUser(res).id)
  if (!version) {
    res.status(404).json({ error: 'Version not found' })
    return
  }
  const { _count, ...recipe } = await prisma.recipe.update({
    where: { id: req.params.id },
    data: {
      title: version.title,
      ingredients: version.ingredients ?? [],
      instructions: version.instructions ?? [],
      notes: version.notes,
    },
    include: { _count: { select: { versions: true } } },
  })
  res.json({ recipe: { ...recipe, versionCount: _count.versions } })
})
