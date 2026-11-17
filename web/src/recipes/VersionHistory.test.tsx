import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { VersionSummary } from './api.ts'
import VersionHistory from './VersionHistory.tsx'

const versions: VersionSummary[] = [
  { id: 'b', version: 2, label: null, createdAt: '2026-11-02T12:00:00Z' },
  { id: 'a', version: 1, label: 'first try', createdAt: '2026-11-01T12:00:00Z' },
]

const noop = () => {}
const props = {
  versions,
  loadError: null,
  saveBlockedReason: null,
  viewingId: null,
  publishedVersionId: null,
  compareIds: [],
  onSave: () => Promise.reject(new Error('unused')),
  onView: noop,
  onToggleCompare: noop,
  onCompare: noop,
}

describe('VersionHistory', () => {
  it('lists versions with labels and offers a label field for the next save', () => {
    const html = renderToString(<VersionHistory {...props} />)
    expect(html).toContain('Version label (optional)')
    expect(html).toContain('aria-label="View v2"')
    expect(html).toContain('aria-label="View v1 · first try"')
    expect(html).toContain('Select two versions to compare')
  })

  it('names the comparison oldest-first once two versions are picked, and locks further picks', () => {
    const html = renderToString(
      <VersionHistory {...props} versions={[...versions, { id: 'c', version: 3, label: null, createdAt: '2026-11-03T12:00:00Z' }]} compareIds={['b', 'a']} />,
    )
    expect(html).toContain('Compare v1 and v2')
    expect(html).toMatch(/<input type="checkbox" aria-label="Select v3 to compare" disabled=""/)
  })

  it('disables saving and explains why when the draft is invalid', () => {
    const html = renderToString(<VersionHistory {...props} saveBlockedReason="Fix the highlighted fields." />)
    expect(html).toMatch(/<button type="submit" disabled=""/)
    expect(html).toContain('Fix the highlighted fields.')
  })

  it('marks the published version', () => {
    const html = renderToString(<VersionHistory {...props} publishedVersionId="a" />)
    expect(html.match(/>Published</g)).toHaveLength(1)
    expect(html.indexOf('>Published<')).toBeGreaterThan(html.indexOf('v1 · first try'))
  })

  it('invites saving the first version when there are none', () => {
    const html = renderToString(<VersionHistory {...props} versions={[]} />)
    expect(html).toContain('No versions yet')
  })
})
