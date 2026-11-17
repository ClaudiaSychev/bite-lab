import { describe, expect, it } from 'vitest'
import { formatIngredient, formatLastEdited, formatVersionCount, formatVersionName } from './format.ts'

const now = new Date('2026-11-06T12:00:00Z')

describe('formatLastEdited', () => {
  it.each([
    ['2026-11-06T11:59:30Z', 'just now'],
    ['2026-11-06T11:55:00Z', '5 minutes ago'],
    ['2026-11-06T09:00:00Z', '3 hours ago'],
    ['2026-11-05T12:00:00Z', 'yesterday'],
    ['2026-11-03T12:00:00Z', '3 days ago'],
    ['2026-10-01T12:00:00Z', 'Oct 1, 2026'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatLastEdited(iso, now)).toBe(expected)
  })
})

describe('formatVersionCount', () => {
  it('pluralizes', () => {
    expect(formatVersionCount(0)).toBe('No versions yet')
    expect(formatVersionCount(1)).toBe('1 version')
    expect(formatVersionCount(4)).toBe('4 versions')
  })
})

describe('formatIngredient', () => {
  const base = { id: 'i', name: 'flour', quantity: null, unit: '', note: '' }
  it('joins amount, unit, name and note', () => {
    expect(formatIngredient({ ...base, quantity: { type: 'single', value: 1.5 }, unit: 'cup', note: 'sifted' })).toBe(
      '1 1/2 cup flour, sifted',
    )
    expect(formatIngredient({ ...base, quantity: { type: 'range', min: 1, max: 2 } })).toBe('1–2 flour')
  })
  it('skips empty parts', () => {
    expect(formatIngredient(base)).toBe('flour')
    expect(formatIngredient({ ...base, name: '', note: 'to taste' })).toBe('to taste')
  })
})

describe('formatVersionName', () => {
  it('includes the label when there is one', () => {
    expect(formatVersionName({ version: 3, label: 'less sugar' })).toBe('v3 · less sugar')
    expect(formatVersionName({ version: 1, label: null })).toBe('v1')
  })
})
