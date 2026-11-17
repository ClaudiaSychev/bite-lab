import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import RecipeCard from './RecipeCard.tsx'

describe('RecipeCard', () => {
  it('links to the recipe and shows its title, last edited time and version count', () => {
    const html = renderToString(
      <MemoryRouter>
        <ul>
          <RecipeCard
            recipe={{ id: 'abc', title: 'Pancakes', updatedAt: '2026-10-01T12:00:00Z', versionCount: 2 }}
            onDelete={() => {}}
          />
        </ul>
      </MemoryRouter>,
    )
    expect(html).toContain('href="/recipes/abc"')
    expect(html).toContain('Pancakes')
    expect(html).toContain('dateTime="2026-10-01T12:00:00Z"')
    expect(html).toContain('2 versions')
    expect(html).toContain('aria-label="Delete Pancakes"')
  })
})
