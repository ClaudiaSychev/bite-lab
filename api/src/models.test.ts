import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db.ts'

let userId: string

beforeEach(async () => {
  await prisma.recipe.updateMany({ data: { publishedVersionId: null } })
  await prisma.recipeVersion.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
  const user = await prisma.user.create({ data: { username: 'owner', passwordHash: 'x' } })
  userId = user.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('Recipe and RecipeVersion', () => {
  it('snapshots a draft into numbered versions and publishes one', async () => {
    const ingredients = [
      { id: 'i1', name: 'flour', quantity: { type: 'single', value: 2 }, unit: 'cup', note: '' },
    ]
    const instructions = [{ id: 's1', text: 'Mix. Fry.' }]
    const recipe = await prisma.recipe.create({
      data: { userId, title: 'Pancakes', ingredients, instructions, notes: 'Rest the batter.' },
    })
    const v1 = await prisma.recipeVersion.create({
      data: {
        recipeId: recipe.id,
        version: 1,
        title: recipe.title,
        ingredients,
        instructions,
        notes: recipe.notes,
      },
    })
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { title: 'Fluffy pancakes', publishedVersionId: v1.id },
    })

    const loaded = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipe.id },
      include: { versions: true, publishedVersion: true },
    })
    expect(loaded.title).toBe('Fluffy pancakes')
    expect(loaded.versions).toHaveLength(1)
    expect(loaded.publishedVersion?.title).toBe('Pancakes')
    expect(loaded.publishedVersion?.ingredients).toEqual(ingredients)
    expect(loaded.publishedVersion?.notes).toBe('Rest the batter.')
  })

  it('rejects a duplicate version number for the same recipe', async () => {
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Soup' } })
    const snapshot = { recipeId: recipe.id, version: 1, title: 'Soup', ingredients: [], instructions: [] }
    await prisma.recipeVersion.create({ data: snapshot })
    await expect(prisma.recipeVersion.create({ data: snapshot })).rejects.toThrow()
  })

  it('deletes versions when the recipe is deleted', async () => {
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Toast' } })
    await prisma.recipeVersion.create({
      data: { recipeId: recipe.id, version: 1, title: 'Toast', ingredients: [], instructions: [] },
    })
    await prisma.recipe.delete({ where: { id: recipe.id } })
    expect(await prisma.recipeVersion.count()).toBe(0)
  })

  it('belongs to a user, who can list their recipes', async () => {
    const other = await prisma.user.create({ data: { username: 'other', passwordHash: 'x' } })
    await prisma.recipe.create({ data: { userId, title: 'Mine' } })
    await prisma.recipe.create({ data: { userId: other.id, title: 'Theirs' } })

    const mine = await prisma.recipe.findMany({ where: { userId } })
    expect(mine.map((r) => r.title)).toEqual(['Mine'])
  })

  it('rejects a recipe whose user does not exist', async () => {
    await expect(
      prisma.recipe.create({ data: { userId: 'no-such-user', title: 'Orphan' } }),
    ).rejects.toThrow()
  })

  it('deletes a user\'s recipes and their versions when the user is deleted', async () => {
    const recipe = await prisma.recipe.create({ data: { userId, title: 'Stew' } })
    const v1 = await prisma.recipeVersion.create({
      data: { recipeId: recipe.id, version: 1, title: 'Stew', ingredients: [], instructions: [] },
    })
    await prisma.recipe.update({ where: { id: recipe.id }, data: { publishedVersionId: v1.id } })

    await prisma.user.delete({ where: { id: userId } })
    expect(await prisma.recipe.count()).toBe(0)
    expect(await prisma.recipeVersion.count()).toBe(0)
  })
})
