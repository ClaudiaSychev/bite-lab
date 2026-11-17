import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

interface AuthFormProps {
  title: string
  submitLabel: string
  onSubmit: (username: string, password: string) => Promise<void>
  footer: { text: string; linkLabel: string; to: string }
  minPasswordLength?: number
}

function redirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state as { from: unknown }
    if (typeof from === 'string' && from.startsWith('/')) return from
  }
  return '/recipes'
}

function AuthForm({ title, submitLabel, onSubmit, footer, minPasswordLength }: AuthFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(username, password)
      navigate(redirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Username
          <input
            className="rounded border border-gray-300 px-3 py-2 font-normal"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            className="rounded border border-gray-300 px-3 py-2 font-normal"
            type="password"
            autoComplete={minPasswordLength ? 'new-password' : 'current-password'}
            required
            minLength={minPasswordLength}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {footer.text}{' '}
        <Link to={footer.to} state={location.state} className="underline">
          {footer.linkLabel}
        </Link>
      </p>
    </main>
  )
}

export default AuthForm
