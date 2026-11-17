import { describe, expect, it } from 'vitest'
import { alignById, diffWords, type Segment } from './versionDiff.ts'

const changed = (segments: Segment[]) => segments.filter((s) => s.changed).map((s) => s.text)
const text = (segments: Segment[]) => segments.map((s) => s.text).join('')

describe('diffWords', () => {
  it('reports no changes for identical text', () => {
    const diff = diffWords('Whisk the eggs.', 'Whisk the eggs.')
    expect(diff.before).toEqual([{ text: 'Whisk the eggs.', changed: false }])
    expect(diff.after).toEqual([{ text: 'Whisk the eggs.', changed: false }])
  })

  it('marks only the words that differ on each side', () => {
    const diff = diffWords('Fry for 2 minutes per side.', 'Fry for 3 minutes on each side.')
    expect(changed(diff.before)).toEqual(['2', 'per'])
    expect(changed(diff.after)).toEqual(['3', 'on each'])
    expect(text(diff.before)).toBe('Fry for 2 minutes per side.')
    expect(text(diff.after)).toBe('Fry for 3 minutes on each side.')
  })

  it('handles text added to or removed from empty', () => {
    expect(diffWords('', 'New note').after).toEqual([{ text: 'New note', changed: true }])
    expect(diffWords('Old note', '').before).toEqual([{ text: 'Old note', changed: true }])
  })

  it('keeps line breaks so multi-line notes still read correctly', () => {
    const diff = diffWords('Line one\nLine two', 'Line one\nLine 2')
    expect(text(diff.after)).toBe('Line one\nLine 2')
    expect(changed(diff.after)).toEqual(['2'])
  })

  it('marks the whole changed middle when the text is too large to diff word by word', () => {
    const before = Array.from({ length: 3000 }, (_, i) => `a${i}`).join(' ')
    const after = Array.from({ length: 3000 }, (_, i) => `b${i}`).join(' ')
    const diff = diffWords(`Start ${before} end`, `Start ${after} end`)
    expect(changed(diff.before)).toEqual([before])
    expect(changed(diff.after)).toEqual([after])
  })
})

describe('alignById', () => {
  type Item = { id: string; text: string }
  const item = (id: string, value = id): Item => ({ id, text: value })
  const same = (a: Item, b: Item) => a.text === b.text
  const summary = (rows: ReturnType<typeof alignById<Item>>) =>
    rows.map((r) => `${r.before?.item.id ?? '-'}/${r.after?.item.id ?? '-'}:${r.status}${r.moved ? ':moved' : ''}`)

  it('pairs items by id and flags edits, additions and removals', () => {
    const rows = alignById(
      [item('a'), item('b'), item('c')],
      [item('a'), item('c', 'C!'), item('d')],
      same,
    )
    expect(summary(rows)).toEqual(['a/a:unchanged', 'b/-:removed', 'c/c:changed', '-/d:added'])
  })

  it('keeps original indexes on both sides', () => {
    const rows = alignById([item('a'), item('b')], [item('x'), item('b')], same)
    expect(rows.map((r) => [r.before?.index, r.after?.index])).toEqual([
      [0, undefined],
      [undefined, 0],
      [1, 1],
    ])
  })

  it('puts items removed from the start first and keeps consecutive removals in order', () => {
    const rows = alignById([item('a'), item('b'), item('c')], [item('c')], same)
    expect(summary(rows)).toEqual(['a/-:removed', 'b/-:removed', 'c/c:unchanged'])
  })

  it('flags reordered items as moved', () => {
    const rows = alignById([item('a'), item('b'), item('c')], [item('c'), item('a'), item('b')], same)
    expect(summary(rows)).toEqual(['c/c:unchanged:moved', 'a/a:unchanged', 'b/b:unchanged'])
  })

  it('handles empty lists', () => {
    expect(alignById<Item>([], [], same)).toEqual([])
    expect(summary(alignById([], [item('a')], same))).toEqual(['-/a:added'])
  })
})
