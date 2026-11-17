import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RecipeVersion } from './api.ts'
import { CompareVersions } from './VersionCompare.tsx'

const v1: RecipeVersion = {
  id: 'v1',
  version: 1,
  label: 'base',
  createdAt: '2026-11-01T12:00:00Z',
  title: 'Pancakes',
  ingredients: [
    { id: 'flour', name: 'flour', quantity: { type: 'single', value: 1 }, unit: 'cup', note: '' },
    { id: 'salt', name: 'salt', quantity: null, unit: '', note: 'pinch' },
  ],
  instructions: [{ id: 's1', text: 'Fry for 2 minutes.' }],
  notes: 'Rest the batter.',
}

const v2: RecipeVersion = {
  ...v1,
  id: 'v2',
  version: 2,
  label: null,
  title: 'Fluffy pancakes',
  ingredients: [
    { id: 'flour', name: 'flour', quantity: { type: 'single', value: 1.5 }, unit: 'cup', note: '' },
    { id: 'sugar', name: 'sugar', quantity: { type: 'single', value: 2 }, unit: 'tbsp', note: '' },
  ],
}

describe('CompareVersions', () => {
  it('highlights removed words on the left and added words on the right', () => {
    const html = renderToString(<CompareVersions before={v1} after={v2} />)
    expect(html).toContain('v1 · base')
    expect(html).toMatch(/<del[^>]*>Pancakes<\/del>/)
    expect(html).toMatch(/<ins[^>]*>Fluffy pancakes<\/ins>/)
    // Changed amount on flour, removed salt, added sugar.
    expect(html).toMatch(/<span>1 <\/span><ins[^>]*>1\/2 <\/ins><span>cup flour<\/span>/)
    expect(html).toMatch(/<del[^>]*>salt, pinch<\/del>/)
    expect(html).toMatch(/<ins[^>]*>2 tbsp sugar<\/ins>/)
    expect(html).toContain('data-status="removed"')
    expect(html).toContain('data-status="added"')
    // Steps and notes are unchanged.
    expect(html).toContain('Fry for 2 minutes.')
    expect(html).not.toMatch(/<(del|ins)[^>]*>[^<]*(Fry|Rest)/)
    expect(html).not.toContain('These versions are identical')
  })

  it('says so when the versions are identical', () => {
    const html = renderToString(<CompareVersions before={v1} after={{ ...v1, id: 'v3', version: 3 }} />)
    expect(html).toContain('These versions are identical')
    expect(html).not.toContain('<del')
    expect(html).not.toContain('<ins')
  })
})
