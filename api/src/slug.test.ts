import { describe, expect, it } from 'vitest'
import { makeSlug, slugify } from './slug.ts'

describe('slugify', () => {
  it('lowercases, strips accents and joins words with dashes', () => {
    expect(slugify('Crème Brûlée!')).toBe('creme-brulee')
    expect(slugify('  Mom’s   Best -- Chili  ')).toBe('mom-s-best-chili')
  })

  it('caps the length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(49)} b c`)
    expect(slug.length).toBeLessThanOrEqual(50)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('falls back to "recipe" when nothing usable is left', () => {
    expect(slugify('🍰🍰')).toBe('recipe')
    expect(slugify('')).toBe('recipe')
  })
})

describe('makeSlug', () => {
  it('adds a random 6-character suffix', () => {
    const slug = makeSlug('Pancakes')
    expect(slug).toMatch(/^pancakes-[a-z0-9]{6}$/)
    expect(makeSlug('Pancakes')).not.toBe(slug)
  })
})
