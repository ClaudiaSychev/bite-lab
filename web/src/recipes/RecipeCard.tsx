import { Link } from 'react-router'
import type { RecipeSummary } from './api.ts'
import { formatLastEdited, formatVersionCount } from './format.ts'

interface RecipeCardProps {
  recipe: RecipeSummary
  onDelete: (recipe: RecipeSummary) => void
  deleting?: boolean
}

// The title link stretches over the whole card; the delete button sits above it.
function RecipeCard({ recipe, onDelete, deleting = false }: RecipeCardProps) {
  return (
    <li className="relative flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 hover:border-gray-400">
      <div>
        <h2 className="font-semibold">
          <Link to={`/recipes/${recipe.id}`} className="after:absolute after:inset-0">
            {recipe.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Edited <time dateTime={recipe.updatedAt}>{formatLastEdited(recipe.updatedAt)}</time>
          {' · '}
          {formatVersionCount(recipe.versionCount)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(recipe)}
        disabled={deleting}
        aria-label={`Delete ${recipe.title}`}
        className="relative z-10 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </li>
  )
}

export default RecipeCard
