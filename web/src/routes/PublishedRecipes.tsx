import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  listPublishedRecipes,
  publicRecipePath,
  unpublishRecipe,
  type PublishedRecipeSummary,
} from '../recipes/api.ts'
import { formatLastEdited, formatVersionName } from '../recipes/format.ts'

function PublishedRecipes() {
  const [recipes, setRecipes] = useState<PublishedRecipeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPublishedRecipes().then(
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

  async function handleUnpublish(recipe: PublishedRecipeSummary) {
    setBusyId(recipe.id)
    setError(null)
    try {
      await unpublishRecipe(recipe.id)
      setRecipes((list) => list?.filter((r) => r.id !== recipe.id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unpublish recipe')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link to="/recipes" className="text-sm underline">
        ← My recipes
      </Link>
      <h1 className="mt-4 text-3xl font-bold">My published recipes</h1>
      <p className="mt-2 text-gray-600">Anyone with the link can view these, no account needed.</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <section aria-label="Published recipes" className="mt-6">
        {recipes === null && !error && <p className="text-gray-500">Loading…</p>}
        {recipes?.length === 0 && (
          <p className="text-gray-500">
            Nothing published yet. Open a recipe, view a saved version, and choose Publish this version.
          </p>
        )}
        {recipes && recipes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    <Link to={publicRecipePath(recipe.slug)} className="underline-offset-2 hover:underline">
                      {recipe.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatVersionName(recipe.version)} · Published{' '}
                    <time dateTime={recipe.publishedAt}>{formatLastEdited(recipe.publishedAt)}</time>
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-gray-500">{publicRecipePath(recipe.slug)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to={`/recipes/${recipe.id}`} aria-label={`Edit ${recipe.title}`} className="text-sm underline">
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleUnpublish(recipe)}
                    disabled={busyId === recipe.id}
                    aria-label={`Unpublish ${recipe.title}`}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Unpublish
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default PublishedRecipes
