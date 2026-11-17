import { Link } from 'react-router'
import { useAuth } from '../auth/auth-context.ts'

function Home() {
  const { status } = useAuth()
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Recipe Lab</h1>
      <p className="mt-2 text-gray-600">Draft recipes, save versions, publish.</p>
      <nav className="mt-6 flex gap-4 text-sm underline">
        {status === 'authenticated' ? (
          <Link to="/recipes">My recipes</Link>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </nav>
    </main>
  )
}

export default Home
