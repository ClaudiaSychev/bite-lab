import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('renders the home route', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('Recipe Lab')
  })
  it('serves public recipe pages outside the login wall', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/r/pancakes-abc123']}>
        <App />
      </MemoryRouter>,
    )
    // Rendered directly (loading the recipe), not held behind the auth check.
    expect(html).toContain('Loading…')
    expect(html).toContain('href="/"')
  })
})
