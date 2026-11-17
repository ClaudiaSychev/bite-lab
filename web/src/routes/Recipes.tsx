import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/auth-context.ts'
import { createRecipe, deleteRecipe, listInProgressRecipes, type RecipeSummary } from '../recipes/api.ts'
import RecipeCard from '../recipes/RecipeCard.tsx'

function Recipes() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listInProgressRecipes().then(
      (list) => {
        if (!cancelled) setRecipes(list)
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load recipes')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  async function handleNew() {
    setCreating(true)
    setError(null)
    try {
      const recipe = await createRecipe()
      navigate(`/recipes/${recipe.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create recipe')
      setCreating(false)
    }
  }

  async function handleDelete(recipe: RecipeSummary) {
    if (!window.confirm(`Delete "${recipe.title}" and all its versions?`)) return
    setDeletingId(recipe.id)
    setError(null)
    try {
      await deleteRecipe(recipe.id)
      setRecipes((list) => list?.filter((r) => r.id !== recipe.id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete recipe')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">My recipes</h1>
        <div className="flex items-center gap-4">
          <button type="button" onClick={handleLogout} className="text-sm underline">
            Log out
          </button>
          <button
            type="button"
            onClick={handleNew}
            disabled={creating}
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            New recipe
          </button>
        </div>
      </div>
      <p className="mt-2 text-gray-600">Signed in as {user?.username}</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <section aria-label="In-progress recipes" className="mt-6">
        {recipes === null && !error && <p className="text-gray-500">Loading…</p>}
        {recipes?.length === 0 && (
          <p className="text-gray-500">No recipes in progress. Start one with New recipe.</p>
        )}
        {recipes && recipes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onDelete={handleDelete}
                deleting={deletingId === recipe.id}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default Recipes
