import { describe, expect, it } from 'vitest'
import { parseDraftUpdate, parseQuantity } from './draft.ts'

const ingredient = { id: 'a', name: 'flour', quantity: null, unit: 'g', note: '' }

describe('parseQuantity', () => {
  it('accepts null, a single amount and a range', () => {
    expect(parseQuantity(null, 'q')).toEqual({ ok: true, value: null })
    expect(parseQuantity({ type: 'single', value: 0.5 }, 'q')).toEqual({
      ok: true,
      value: { type: 'single', value: 0.5 },
    })
    expect(parseQuantity({ type: 'range', min: 1, max: 2 }, 'q').ok).toBe(true)
  })

  it('accepts a range where max equals min', () => {
    expect(parseQuantity({ type: 'range', min: 2, max: 2 }, 'q').ok).toBe(true)
  })

  it('rejects a range where max is less than min', () => {
    expect(parseQuantity({ type: 'range', min: 3, max: 2 }, 'Ingredient 1 quantity')).toEqual({
      ok: false,
      error: 'Ingredient 1 quantity max must be greater than or equal to min',
    })
  })

  it.each([
    [{ type: 'single', value: 0 }],
    [{ type: 'single', value: -1 }],
    [{ type: 'single', value: Number.NaN }],
    [{ type: 'single', value: '2' }],
    [{ type: 'range', min: 1 }],
    [{ type: 'other', value: 1 }],
    ['2'],
  ])('rejects %j', (value) => {
    expect(parseQuantity(value, 'q').ok).toBe(false)
  })
})

describe('parseDraftUpdate', () => {
  it('accepts a full draft and trims the title', () => {
    const result = parseDraftUpdate({
      title: '  Pancakes ',
      ingredients: [ingredient],
      instructions: [{ id: 's1', text: 'Mix' }],
      notes: 'Rest 10 minutes',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Pancakes',
        ingredients: [ingredient],
        instructions: [{ id: 's1', text: 'Mix' }],
        notes: 'Rest 10 minutes',
      },
    })
  })

  it('leaves absent fields out so they are not changed', () => {
    expect(parseDraftUpdate({ notes: 'x' })).toEqual({ ok: true, value: { notes: 'x' } })
  })

  it('drops unknown ingredient fields', () => {
    const result = parseDraftUpdate({ ingredients: [{ ...ingredient, extra: true }] })
    expect(result).toEqual({ ok: true, value: { ingredients: [ingredient] } })
  })

  it.each([
    [{ title: '   ' }, 'Title must be 1-200 characters'],
    [{ ingredients: 'flour' }, 'Ingredient must be an array'],
    [{ ingredients: [{ ...ingredient, id: '' }] }, 'Ingredient 1 id must be a non-empty string of at most 64 characters'],
    [{ ingredients: [ingredient, ingredient] }, 'Ingredient 2 has a duplicate id'],
    [
      { ingredients: [{ ...ingredient, quantity: { type: 'range', min: 2, max: 1 } }] },
      'Ingredient 1 quantity max must be greater than or equal to min',
    ],
    [{ ingredients: [{ ...ingredient, unit: 'x'.repeat(51) }] }, 'Ingredient 1 unit must be at most 50 characters'],
    [{ instructions: [{ id: 's1' }] }, 'Step 1 text must be a string'],
    [{ notes: 5 }, 'Notes must be a string'],
  ])('rejects %j', (body, error) => {
    expect(parseDraftUpdate(body)).toEqual({ ok: false, error })
  })
})
