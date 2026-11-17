import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue, type AuthStatus, type User } from './auth-context.ts'

async function readUser(res: Response): Promise<User> {
  const body = (await res.json().catch(() => ({}))) as { user?: User; error?: string }
  if (!res.ok || !body.user) throw new Error(body.error ?? 'Something went wrong')
  return body.user
}

function postCredentials(path: string, username: string, password: string): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(readUser)
      .then(
        (me) => {
          if (cancelled) return
          setUser(me)
          setStatus('authenticated')
        },
        () => {
          if (!cancelled) setStatus('anonymous')
        },
      )
    return () => {
      cancelled = true
    }
  }, [])

  const authenticate = useCallback(async (path: string, username: string, password: string) => {
    const me = await readUser(await postCredentials(path, username, password))
    setUser(me)
    setStatus('authenticated')
  }, [])

  const login = useCallback(
    (username: string, password: string) => authenticate('/api/auth/login', username, password),
    [authenticate],
  )
  const signup = useCallback(
    (username: string, password: string) => authenticate('/api/auth/signup', username, password),
    [authenticate],
  )
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, signup, logout }),
    [user, status, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
