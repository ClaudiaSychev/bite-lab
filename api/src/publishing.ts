import { Router } from 'express'
import { currentUser } from './auth.ts'
import { prisma } from './db.ts'
import { Prisma } from './generated/prisma/client.ts'
import { makeSlug } from './slug.ts'

const MAX_SLUG_ATTEMPTS = 3

type RecipeParams = { id: string }

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

// Owner-side routes, mounted on the recipes router (behind requireAuth).
// Publishing points the recipe at one immutable version; the version itself is never written.
export function addPublishingRoutes(router: Router) {
  // The user's published recipes, as the public sees them (the published version's content).
  router.get('/published', async (_req, res) => {
    const recipes = await prisma.recipe.findMany({
      where: { userId: currentUser(res).id, publishedVersionId: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        publishedVersion: { select: { id: true, version: true, label: true, title: true } },
      },
    })
    res.json({
      recipes: recipes.flatMap(({ publishedVersion, ...recipe }) =>
        publishedVersion ? [{ ...recipe, title: publishedVersion.title, version: publishedVersion }] : [],
      ),
    })
  })

  router.post<RecipeParams>('/:id/publish', async (req, res) => {
    const body: unknown = req.body
    const versionId =
      typeof body === 'object' && body !== null && 'versionId' in body ? body.versionId : undefined
    if (typeof versionId !== 'string' || versionId === '') {
      res.status(400).json({ error: 'versionId is required' })
      return
    }
    const recipe = await prisma.recipe.findFirst({
      where: { id: req.params.id, userId: currentUser(res).id },
      select: { id: true, slug: true, updatedAt: true },
    })
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' })
      return
    }
    const version = await prisma.recipeVersion.findFirst({
      where: { id: versionId, recipeId: recipe.id },
      select: { id: true, title: true },
    })
    if (!version) {
      res.status(404).json({ error: 'Version not found' })
      return
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const published = await prisma.recipe.update({
          where: { id: recipe.id },
          data: {
            publishedVersionId: version.id,
            publishedAt: new Date(),
            slug: recipe.slug ?? makeSlug(version.title),
            // Publishing isn't an edit to the draft, so "last edited" stays put.
            updatedAt: recipe.updatedAt,
          },
          select: { publishedVersionId: true, slug: true, publishedAt: true },
        })
        res.json({ publication: published })
        return
      } catch (err) {
        if (isUniqueViolation(err) && !recipe.slug && attempt < MAX_SLUG_ATTEMPTS) continue
        throw err
      }
    }
  })

  // Takes the public page down. The slug is kept so republishing restores the same link.
  router.delete<RecipeParams>('/:id/publish', async (req, res) => {
    const recipe = await prisma.recipe.findFirst({
      where: { id: req.params.id, userId: currentUser(res).id },
      select: { id: true, updatedAt: true },
    })
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' })
      return
    }
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { publishedVersionId: null, publishedAt: null, updatedAt: recipe.updatedAt },
    })
    res.status(204).end()
  })
}

// Public, unauthenticated: read-only view of a published recipe by slug.
export const publicRouter = Router()

publicRouter.get('/recipes/:slug', async (req, res) => {
  const recipe = await prisma.recipe.findFirst({
    where: { slug: req.params.slug, publishedVersionId: { not: null } },
    select: {
      slug: true,
      publishedAt: true,
      user: { select: { username: true } },
      publishedVersion: { select: { title: true, ingredients: true, instructions: true, notes: true } },
    },
  })
  if (!recipe?.publishedVersion) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  const { publishedVersion, user, ...rest } = recipe
  res.json({ recipe: { ...rest, ...publishedVersion, author: user.username } })
})
