import { describe, expect, it } from 'vitest'
import type { Recipe } from './api.ts'
import { draftFromRecipe, moveItem, validateDraft, type DraftState } from './draft.ts'
import { QUANTITY_ERRORS } from './quantity.ts'

const recipe: Recipe = {
  id: 'r1',
  title: 'Pancakes',
  updatedAt: '2026-11-06T12:00:00Z',
  createdAt: '2026-11-06T12:00:00Z',
  versionCount: 0,
  publishedVersionId: null,
  ingredients: [
    { id: 'a', name: 'flour', quantity: { type: 'single', value: 1.5 }, unit: 'cup', note: '' },
    { id: 'b', name: 'milk', quantity: { type: 'range', min: 1, max: 2 }, unit: 'cup', note: '' },
    { id: 'c', name: 'salt', quantity: null, unit: '', note: 'to taste' },
  ],
  instructions: [{ id: 's1', text: 'Mix' }],
  notes: 'Rest it',
}

function state(overrides: Partial<DraftState> = {}): DraftState {
  return { ...draftFromRecipe(recipe), ...overrides }
}

describe('draftFromRecipe', () => {
  it('formats quantities for editing', () => {
    expect(draftFromRecipe(recipe).ingredients.map((i) => i.amount)).toEqual(['1 1/2', '1–2', ''])
  })
})

describe('validateDraft', () => {
  it('round-trips a loaded recipe into the same payload', () => {
    expect(validateDraft(state())).toEqual({
      ok: true,
      payload: {
        title: 'Pancakes',
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        notes: 'Rest it',
      },
    })
  })

  it('parses typed amounts and trims the title', () => {
    const result = validateDraft(
      state({ title: '  Crepes ', ingredients: [{ id: 'a', name: 'egg', amount: '2-3', unit: '', note: '' }] }),
    )
    expect(result.ok && result.payload.title).toBe('Crepes')
    expect(result.ok && result.payload.ingredients[0]?.quantity).toEqual({ type: 'range', min: 2, max: 3 })
  })

  it('reports each invalid amount by ingredient id, including max below min', () => {
    const result = validateDraft(
      state({
        ingredients: [
          { id: 'a', name: 'flour', amount: '3-2', unit: '', note: '' },
          { id: 'b', name: 'milk', amount: '1', unit: '', note: '' },
          { id: 'c', name: 'eggs', amount: 'lots', unit: '', note: '' },
        ],
      }),
    )
    expect(result).toEqual({
      ok: false,
      errors: { amounts: { a: QUANTITY_ERRORS.maxBelowMin, c: QUANTITY_ERRORS.invalid } },
    })
  })

  it('requires a title', () => {
    expect(validateDraft(state({ title: '  ' }))).toEqual({
      ok: false,
      errors: { title: 'Title is required', amounts: {} },
    })
  })
})

describe('moveItem', () => {
  it('moves an item up or down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('leaves the list unchanged at the edges', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const items = ['a', 'b']
    moveItem(items, 0, 1)
    expect(items).toEqual(['a', 'b'])
  })
})
