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

describe('GET /api/recipes', () => {
  it("lists only the user's unpublished recipes, most recently edited first, with version counts", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')

    const older = await prisma.recipe.create({
      data: { userId, title: 'Older', updatedAt: new Date('2026-01-01T00:00:00Z') },
    })
    await prisma.recipeVersion.createMany({
      data: [1, 2].map((version) => ({
        recipeId: older.id, version, title: 'Older', ingredients: [], instructions: [],
      })),
    })
    await prisma.recipe.create({
      data: { userId, title: 'Newer', updatedAt: new Date('2026-02-01T00:00:00Z') },
    })
    const published = await prisma.recipe.create({ data: { userId, title: 'Published' } })
    const v1 = await prisma.recipeVersion.create({
      data: { recipeId: published.id, version: 1, title: 'Published', ingredients: [], instructions: [] },
    })
    await prisma.recipe.update({ where: { id: published.id }, data: { publishedVersionId: v1.id } })
    await prisma.recipe.create({ data: { userId: other.userId, title: 'Not mine' } })

    const res = await agent.get('/api/recipes')
    expect(res.status).toBe(200)
    expect(res.body.recipes).toEqual([
      { id: expect.any(String), title: 'Newer', updatedAt: '2026-02-01T00:00:00.000Z', versionCount: 0 },
      { id: older.id, title: 'Older', updatedAt: '2026-01-01T00:00:00.000Z', versionCount: 2 },
    ])
  })

  it('requires authentication', async () => {
    await request(app).get('/api/recipes').expect(401)
  })
})

describe('POST /api/recipes', () => {
  it('creates an untitled recipe owned by the user', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const res = await agent.post('/api/recipes').send({})
    expect(res.status).toBe(201)
    expect(res.body.recipe).toMatchObject({ title: 'Untitled recipe', userId })
  })

  it('uses a provided title and rejects a blank one', async () => {
    const { agent } = await signedInAgent('chef')
    const res = await agent.post('/api/recipes').send({ title: '  Pancakes  ' })
    expect(res.body.recipe.title).toBe('Pancakes')
    await agent.post('/api/recipes').send({ title: '   ' }).expect(400)
  })

  it('requires authentication', async () => {
    await request(app).post('/api/recipes').send({}).expect(401)
    expect(await prisma.recipe.count()).toBe(0)
  })
})

describe('GET /api/recipes/:id', () => {
  it("returns the user's recipe and 404s for anyone else's", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Soup' } })

    const mine = await agent.get(`/api/recipes/${recipe.id}`)
    expect(mine.status).toBe(200)
    expect(mine.body.recipe).toMatchObject({ id: recipe.id, title: 'Soup', versionCount: 0 })

    await other.agent.get(`/api/recipes/${recipe.id}`).expect(404)
    await agent.get('/api/recipes/does-not-exist').expect(404)
  })
})

describe('PATCH /api/recipes/:id', () => {
  const draft = {
    title: 'Pancakes',
    ingredients: [
      { id: 'i1', name: 'flour', quantity: { type: 'single', value: 1.5 }, unit: 'cup', note: 'sifted' },
      { id: 'i2', name: 'milk', quantity: { type: 'range', min: 1, max: 1.25 }, unit: 'cup', note: '' },
      { id: 'i3', name: 'salt', quantity: null, unit: '', note: 'to taste' },
    ],
    instructions: [
      { id: 's1', text: 'Whisk the dry ingredients.' },
      { id: 's2', text: 'Add milk and fry.' },
    ],
    notes: 'Rest the batter for 10 minutes.',
  }

  it('saves the full draft and bumps updatedAt', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({
      data: { userId, title: 'Untitled recipe', updatedAt: new Date('2026-01-01T00:00:00Z') },
    })

    const res = await agent.patch(`/api/recipes/${recipe.id}`).send(draft)
    expect(res.status).toBe(200)
    expect(new Date(res.body.recipe.updatedAt).getTime()).toBeGreaterThan(recipe.updatedAt.getTime())

    const loaded = await agent.get(`/api/recipes/${recipe.id}`)
    expect(loaded.body.recipe).toMatchObject(draft)
  })

  it('updates only the fields sent', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({ data: { userId, ...draft } })

    await agent.patch(`/api/recipes/${recipe.id}`).send({ notes: 'New notes' }).expect(200)
    const loaded = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
    expect(loaded.notes).toBe('New notes')
    expect(loaded.ingredients).toEqual(draft.ingredients)
  })

  it('rejects a range whose max is below its min and leaves the draft unchanged', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({ data: { userId, ...draft } })

    const res = await agent.patch(`/api/recipes/${recipe.id}`).send({
      ingredients: [{ ...draft.ingredients[0], quantity: { type: 'range', min: 3, max: 2 } }],
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Ingredient 1 quantity max must be greater than or equal to min')
    const loaded = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })
    expect(loaded.ingredients).toEqual(draft.ingredients)
  })

  it("never touches saved versions", async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({ data: { userId, ...draft } })
    const v1 = await prisma.recipeVersion.create({
      data: { recipeId: recipe.id, version: 1, ...draft },
    })

    await agent.patch(`/api/recipes/${recipe.id}`).send({ title: 'Changed', ingredients: [] }).expect(200)
    expect(await prisma.recipeVersion.findUniqueOrThrow({ where: { id: v1.id } })).toEqual(v1)
  })

  it("404s for another user's recipe and requires authentication", async () => {
    const { userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await prisma.recipe.create({ data: { userId, ...draft } })

    await other.agent.patch(`/api/recipes/${recipe.id}`).send({ title: 'Mine now' }).expect(404)
    await request(app).patch(`/api/recipes/${recipe.id}`).send({ title: 'Anon' }).expect(401)
    expect((await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })).title).toBe('Pancakes')
  })
})

describe('DELETE /api/recipes/:id', () => {
  it('deletes the recipe and its versions', async () => {
    const { agent, userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Toast' } })
    await prisma.recipeVersion.create({
      data: { recipeId: recipe.id, version: 1, title: 'Toast', ingredients: [], instructions: [] },
    })

    await agent.delete(`/api/recipes/${recipe.id}`).expect(204)
    expect(await prisma.recipe.count()).toBe(0)
    expect(await prisma.recipeVersion.count()).toBe(0)
  })

  it("won't delete another user's recipe", async () => {
    const { userId } = await signedInAgent('chef')
    const other = await signedInAgent('other')
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Mine' } })

    await other.agent.delete(`/api/recipes/${recipe.id}`).expect(404)
    expect(await prisma.recipe.count()).toBe(1)
  })

  it('requires authentication', async () => {
    const { userId } = await signedInAgent('chef')
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Mine' } })
    await request(app).delete(`/api/recipes/${recipe.id}`).expect(401)
    expect(await prisma.recipe.count()).toBe(1)
  })
})
