import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth-context.ts'

// Use as a layout route (<Route element={<RequireAuth />}>) or wrap an element directly.
function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="p-8 text-gray-500">Loading…</p>
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children ?? <Outlet />
}

export default RequireAuth
