import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { prisma } from './db.ts'

const app = createApp()

async function signedInAgent(username: string) {
  const agent = request.agent(app)
  await agent.post('/api/auth/signup').send({ username, password: 'password-123' }).expect(201)
  const user = await prisma.user.findUniqueOrThrow({ where: { username } })
  return { agent, userId: user.id }
}

const draft = {
  title: 'Crème Brûlée',
  ingredients: [{ id: 'i1', name: 'cream', quantity: { type: 'single', value: 2 }, unit: 'cup', note: '' }],
  instructions: [{ id: 's1', text: 'Bake in a water bath.' }],
  notes: 'Torch right before serving.',
}

// A recipe with two saved versions; the draft is then edited past both.
async function recipeWithVersions(agent: ReturnType<typeof request.agent>, userId: string) {
  const recipe = await prisma.recipe.create({
    data: { userId, ...draft, updatedAt: new Date('2026-01-01T00:00:00Z') },
  })
  const v1 = (await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 'classic' })).body.version
  await agent.patch(`/api/recipes/${recipe.id}`).send({ notes: 'Less sugar.' }).expect(200)
  const v2 = (await agent.post(`/api/recipes/${recipe.id}/versions`).send({})).body.version
  await agent.patch(`/api/recipes/${recipe.id}`).send({ title: 'Unfinished idea' }).expect(200)
  await prisma.recipe.update({ where: { id: recipe.id }, data: { updatedAt: new Date('2026-01-01T00:00:00Z') } })
  return { recipe, v1: v1 as { id: string }, v2: v2 as { id: string } }
}

beforeEach(async () => {
  await prisma.recipe.updateMany({ data: { publishedVersionId: null } })
  await prisma.recipeVersion.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/recipes/:id/publish', () => {
  it('publishes the chosen version at a public slug without touching the draft or "last edited"', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const { recipe, v1 } = await recipeWithVersions(agent, userId)
    const versionBefore = await prisma.recipeVersion.findUniqueOrThrow({ where: { id: v1.id } })

    const res = await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id })
    expect(res.status).toBe(200)
    expect(res.body.publication).toEqual({
      publishedVersionId: v1.id,
      slug: expect.stringMatching(/^creme-brulee-[a-z0-9]{6}$/),
      publishedAt: expect.any(String),
    })

    const stored = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
    expect(stored.title).toBe('Unfinished idea')
    expect(stored.updatedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(await prisma.recipeVersion.findUniqueOrThrow({ where: { id: v1.id } })).toEqual(versionBefore)

    const editor = await agent.get(`/api/recipes/${recipe.id}`)
    expect(editor.body.recipe).toMatchObject({ publishedVersionId: v1.id, slug: res.body.publication.slug })
  })

  it('keeps the slug when switching to another version or republishing after unpublishing', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const { recipe, v1, v2 } = await recipeWithVersions(agent, userId)
    const first = await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id })
    const { slug } = first.body.publication

    const switched = await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v2.id })
    expect(switched.body.publication).toMatchObject({ publishedVersionId: v2.id, slug })

    await agent.delete(`/api/recipes/${recipe.id}/publish`).expect(204)
    const again = await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id })
    expect(again.body.publication.slug).toBe(slug)
  })

  it('rejects a missing version id, and versions from another recipe', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const { recipe } = await recipeWithVersions(agent, userId)
    const { v1: otherVersion } = await recipeWithVersions(agent, userId)
    await agent.post(`/api/recipes/${recipe.id}/publish`).send({}).expect(400)
    await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: otherVersion.id }).expect(404)
    const stored = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
    expect(stored.publishedVersionId).toBeNull()
  })

  it("404s for another user's recipe and requires authentication", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const { recipe, v1 } = await recipeWithVersions(agent, userId)
    await other.agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id }).expect(404)
    await request(app).post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id }).expect(401)
    await other.agent.delete(`/api/recipes/${recipe.id}/publish`).expect(404)
  })
})

describe('DELETE /api/recipes/:id/publish', () => {
  it('takes the public page down and returns the recipe to in-progress', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const { recipe, v1 } = await recipeWithVersions(agent, userId)
    const { slug } = (await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id })).body
      .publication
    expect((await agent.get('/api/recipes')).body.recipes).toHaveLength(0)

    await agent.delete(`/api/recipes/${recipe.id}/publish`).expect(204)
    await request(app).get(`/api/public/recipes/${slug}`).expect(404)
    expect((await agent.get('/api/recipes/published')).body.recipes).toEqual([])
    expect((await agent.get('/api/recipes')).body.recipes).toHaveLength(1)
    const stored = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
    expect(stored).toMatchObject({ publishedVersionId: null, publishedAt: null, slug })
    expect(await prisma.recipeVersion.count({ where: { recipeId: recipe.id } })).toBe(2)
  })
})

describe('GET /api/recipes/published', () => {
  it("lists only the user's published recipes, newest first, with the published version's title", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const a = await recipeWithVersions(agent, userId)
    const b = await recipeWithVersions(agent, userId)
    await recipeWithVersions(agent, userId) // never published
    const theirs = await recipeWithVersions(other.agent, other.userId)
    await other.agent.post(`/api/recipes/${theirs.recipe.id}/publish`).send({ versionId: theirs.v1.id })

    await agent.post(`/api/recipes/${a.recipe.id}/publish`).send({ versionId: a.v1.id }).expect(200)
    await agent.post(`/api/recipes/${b.recipe.id}/publish`).send({ versionId: b.v2.id }).expect(200)

    const res = await agent.get('/api/recipes/published')
    expect(res.status).toBe(200)
    expect(res.body.recipes).toEqual([
      {
        id: b.recipe.id,
        slug: expect.any(String),
        publishedAt: expect.any(String),
        title: 'Crème Brûlée',
        version: { id: b.v2.id, version: 2, label: null, title: 'Crème Brûlée' },
      },
      {
        id: a.recipe.id,
        slug: expect.any(String),
        publishedAt: expect.any(String),
        title: 'Crème Brûlée',
        version: { id: a.v1.id, version: 1, label: 'classic', title: 'Crème Brûlée' },
      },
    ])
  })

  it('requires authentication', async () => {
    await request(app).get('/api/recipes/published').expect(401)
  })
})

describe('GET /api/public/recipes/:slug', () => {
  it('serves the published version to anyone, logged out, ignoring later draft edits', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const { recipe, v1 } = await recipeWithVersions(agent, userId)
    const { slug } = (await agent.post(`/api/recipes/${recipe.id}/publish`).send({ versionId: v1.id })).body
      .publication

    const res = await request(app).get(`/api/public/recipes/${slug}`)
    expect(res.status).toBe(200)
    expect(res.body.recipe).toEqual({ ...draft, slug, author: 'chef', publishedAt: expect.any(String) })
  })

  it('404s for unknown slugs and never-published recipes', async () => {
    const { agent, userId } = await signedInAgent('chef')
    await recipeWithVersions(agent, userId)
    await request(app).get('/api/public/recipes/nope').expect(404)
  })
})
