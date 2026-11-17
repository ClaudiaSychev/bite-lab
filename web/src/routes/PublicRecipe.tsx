import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getPublicRecipe, type PublicRecipe as PublicRecipeData } from '../recipes/api.ts'
import RecipeContent from '../recipes/RecipeContent.tsx'

type State = { status: 'loading' } | { status: 'loaded'; recipe: PublicRecipeData } | { status: 'error'; error: string }

const published = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' })

// Public and read-only: works whether or not anyone is logged in.
function PublicRecipeView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getPublicRecipe(slug).then(
      (recipe) => {
        if (!cancelled) setState({ status: 'loaded', recipe })
      },
      (err: unknown) => {
        if (!cancelled) setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not load recipe' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (state.status !== 'loaded') return
    const previous = document.title
    document.title = `${state.recipe.title} · Recipe Lab`
    return () => {
      document.title = previous
    }
  }, [state])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link to="/" className="text-sm font-semibold text-gray-500">
        Recipe Lab
      </Link>
      <div className="mt-6">
        {state.status === 'loading' && <p className="text-gray-500">Loading…</p>}
        {state.status === 'error' && (
          <div role="alert">
            <h1 className="text-2xl font-bold">Recipe not found</h1>
            <p className="mt-2 text-gray-600">This recipe doesn't exist or is no longer published.</p>
          </div>
        )}
        {state.status === 'loaded' && (
          <RecipeContent
            recipe={state.recipe}
            label={state.recipe.title}
            titleLevel={1}
            byline={
              <p className="mt-1 text-sm text-gray-600">
                By {state.recipe.author} · Published{' '}
                <time dateTime={state.recipe.publishedAt}>
                  {published.format(new Date(state.recipe.publishedAt))}
                </time>
              </p>
            }
          />
        )}
      </div>
    </main>
  )
}

// Keyed by slug so following a link to another recipe starts fresh.
function PublicRecipe() {
  const { slug = '' } = useParams()
  return <PublicRecipeView key={slug} slug={slug} />
}

export default PublicRecipe
