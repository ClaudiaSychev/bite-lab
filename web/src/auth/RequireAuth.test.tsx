import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context.ts'
import RequireAuth from './RequireAuth.tsx'

function renderAt(status: AuthStatus): string {
  const value: AuthContextValue = {
    user: status === 'authenticated' ? { id: '1', username: 'chef' } : null,
    status,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  }
  return renderToString(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/secret" element={<p>secret page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

// The anonymous redirect runs in an effect, so it is covered by e2e/auth.spec.ts instead.
describe('RequireAuth', () => {
  it('renders the protected route when authenticated', () => {
    expect(renderAt('authenticated')).toContain('secret page')
  })

  it('shows a loading state and hides the route while the session is checked', () => {
    const html = renderAt('loading')
    expect(html).toContain('Loading')
    expect(html).not.toContain('secret page')
  })
})
