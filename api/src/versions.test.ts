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
  title: 'Pancakes',
  ingredients: [
    { id: 'i1', name: 'flour', quantity: { type: 'single', value: 1.5 }, unit: 'cup', note: '' },
    { id: 'i2', name: 'milk', quantity: { type: 'range', min: 1, max: 1.25 }, unit: 'cup', note: '' },
  ],
  instructions: [{ id: 's1', text: 'Whisk and fry.' }],
  notes: 'Rest the batter.',
}

async function recipeWithDraft(userId: string) {
  return prisma.recipe.create({ data: { userId, ...draft } })
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

describe('POST /api/recipes/:id/versions', () => {
  it('snapshots the saved draft with a trimmed label and sequential numbers', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)

    const first = await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: '  first try  ' })
    expect(first.status).toBe(201)
    expect(first.body.version).toEqual({
      id: expect.any(String),
      version: 1,
      label: 'first try',
      createdAt: expect.any(String),
    })

    const second = await agent.post(`/api/recipes/${recipe.id}/versions`).send({})
    expect(second.body.version).toMatchObject({ version: 2, label: null })

    const stored = await prisma.recipeVersion.findUniqueOrThrow({ where: { id: first.body.version.id } })
    expect(stored).toMatchObject(draft)
  })

  it('treats a blank label as no label and rejects one that is too long or not a string', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)
    const blank = await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: '   ' })
    expect(blank.body.version.label).toBeNull()
    await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 'x'.repeat(101) }).expect(400)
    await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 5 }).expect(400)
    expect(await prisma.recipeVersion.count()).toBe(1)
  })

  it('keeps the snapshot unchanged when the draft is edited afterwards', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)
    const { body } = await agent.post(`/api/recipes/${recipe.id}/versions`).send({})
    await agent.patch(`/api/recipes/${recipe.id}`).send({ title: 'Crêpes', ingredients: [] }).expect(200)

    const version = await agent.get(`/api/recipes/${recipe.id}/versions/${body.version.id}`)
    expect(version.body.version).toMatchObject(draft)
  })

  it('numbers concurrent saves without gaps or duplicates', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)
    const results = await Promise.all(
      Array.from({ length: 5 }, () => agent.post(`/api/recipes/${recipe.id}/versions`).send({})),
    )
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    const numbers = results.map((r) => r.body.version.version as number).sort((a, b) => a - b)
    expect(numbers).toEqual([1, 2, 3, 4, 5])
  })

  it("404s for another user's recipe and requires authentication", async () => {
    const { userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await recipeWithDraft(userId)
    await other.agent.post(`/api/recipes/${recipe.id}/versions`).send({}).expect(404)
    await request(app).post(`/api/recipes/${recipe.id}/versions`).send({}).expect(401)
    expect(await prisma.recipeVersion.count()).toBe(0)
  })
})

describe('GET /api/recipes/:id/versions', () => {
  it('lists version summaries newest first', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)
    await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 'base' })
    await agent.post(`/api/recipes/${recipe.id}/versions`).send({})

    const res = await agent.get(`/api/recipes/${recipe.id}/versions`)
    expect(res.status).toBe(200)
    expect(res.body.versions).toEqual([
      { id: expect.any(String), version: 2, label: null, createdAt: expect.any(String) },
      { id: expect.any(String), version: 1, label: 'base', createdAt: expect.any(String) },
    ])
  })

  it("404s for another user's recipe", async () => {
    const { userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await recipeWithDraft(userId)
    await other.agent.get(`/api/recipes/${recipe.id}/versions`).expect(404)
  })
})

describe('GET /api/recipes/:id/versions/:versionId', () => {
  it('returns the full snapshot, only through its own recipe and owner', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await recipeWithDraft(userId)
    const otherRecipe = await recipeWithDraft(userId)
    const { body } = await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 'v1' })

    const res = await agent.get(`/api/recipes/${recipe.id}/versions/${body.version.id}`)
    expect(res.status).toBe(200)
    expect(res.body.version).toMatchObject({ ...draft, version: 1, label: 'v1' })

    await agent.get(`/api/recipes/${otherRecipe.id}/versions/${body.version.id}`).expect(404)
    await other.agent.get(`/api/recipes/${recipe.id}/versions/${body.version.id}`).expect(404)
    await agent.get(`/api/recipes/${recipe.id}/versions/nope`).expect(404)
  })
})

describe('POST /api/recipes/:id/versions/:versionId/restore', () => {
  it('copies the version into the draft and leaves the version untouched', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await recipeWithDraft(userId)
    const { body } = await agent.post(`/api/recipes/${recipe.id}/versions`).send({ label: 'keep' })
    await agent
      .patch(`/api/recipes/${recipe.id}`)
      .send({ title: 'Waffles', ingredients: [], instructions: [], notes: '' })
      .expect(200)
    const before = await prisma.recipeVersion.findUniqueOrThrow({ where: { id: body.version.id } })

    const res = await agent.post(`/api/recipes/${recipe.id}/versions/${body.version.id}/restore`)
    expect(res.status).toBe(200)
    expect(res.body.recipe).toMatchObject({ id: recipe.id, ...draft, versionCount: 1 })

    const reloaded = await agent.get(`/api/recipes/${recipe.id}`)
    expect(reloaded.body.recipe).toMatchObject(draft)
    const after = await prisma.recipeVersion.findUniqueOrThrow({ where: { id: body.version.id } })
    expect(after).toEqual(before)
    expect(await prisma.recipeVersion.count()).toBe(1)
  })

  it("404s for a version of a different recipe or another user's recipe", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await recipeWithDraft(userId)
    const sibling = await prisma.recipe.create({ data: { userId, title: 'Sibling' } })
    const { body } = await agent.post(`/api/recipes/${recipe.id}/versions`).send({})

    await agent.post(`/api/recipes/${sibling.id}/versions/${body.version.id}/restore`).expect(404)
    await other.agent.post(`/api/recipes/${recipe.id}/versions/${body.version.id}/restore`).expect(404)
    const untouched = await prisma.recipe.findUniqueOrThrow({ where: { id: sibling.id } })
    expect(untouched.title).toBe('Sibling')
  })
})
