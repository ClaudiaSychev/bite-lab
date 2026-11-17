import { useState } from 'react'
import type { RecipeVersion } from './api.ts'
import { formatIngredient, formatVersionName } from './format.ts'
import { useVersion } from './useVersion.ts'

function VersionContent({ version }: { version: RecipeVersion }) {
  return (
    <article aria-label={`${formatVersionName(version)} (read-only)`} className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold">{version.title}</h2>
      <section>
        <h3 className="text-lg font-semibold">Ingredients</h3>
        {version.ingredients.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No ingredients.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6 text-sm">
            {version.ingredients.map((ingredient) => (
              <li key={ingredient.id}>{formatIngredient(ingredient)}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold">Instructions</h3>
        {version.instructions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No steps.</p>
        ) : (
          <ol className="mt-2 list-decimal pl-6 text-sm">
            {version.instructions.map((step) => (
              <li key={step.id} className="whitespace-pre-wrap">
                {step.text}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold">Notes</h3>
        {version.notes.trim() === '' ? (
          <p className="mt-2 text-sm text-gray-500">No notes.</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm">{version.notes}</p>
        )}
      </section>
    </article>
  )
}

interface VersionViewProps {
  recipeId: string
  versionId: string
  onClose: () => void
  onRestore: (version: RecipeVersion) => Promise<void>
}

function VersionView({ recipeId, versionId, onClose, onRestore }: VersionViewProps) {
  const state = useVersion(recipeId, versionId)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  async function restore(version: RecipeVersion) {
    setRestoring(true)
    setRestoreError(null)
    try {
      await onRestore(version)
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not restore version')
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="flex-1 text-sm">
          {state.status === 'loaded' ? (
            <>
              Viewing <strong>{formatVersionName(state.version)}</strong>, saved{' '}
              {new Date(state.version.createdAt).toLocaleString()}. Read-only.
            </>
          ) : (
            'Viewing a saved version. Read-only.'
          )}
        </p>
        {state.status === 'loaded' && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Restore into draft
          </button>
        )}
        <button type="button" onClick={onClose} className="text-sm underline">
          Back to draft
        </button>
      </div>

      {confirming && state.status === 'loaded' && (
        <div role="alertdialog" aria-labelledby="restore-confirm" className="rounded border border-gray-300 p-4">
          <p id="restore-confirm" className="text-sm">
            Replace the current draft with {formatVersionName(state.version)}? Anything in the draft that isn't saved
            as a version will be lost.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={restoring}
              onClick={() => void restore(state.version)}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {restoring ? 'Restoring…' : 'Replace draft'}
            </button>
            <button type="button" disabled={restoring} onClick={() => setConfirming(false)} className="text-sm underline">
              Cancel
            </button>
          </div>
          {restoreError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {restoreError}
            </p>
          )}
        </div>
      )}

      {state.status === 'loading' && <p className="text-gray-500">Loading…</p>}
      {state.status === 'error' && (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      )}
      {state.status === 'loaded' && <VersionContent version={state.version} />}
    </div>
  )
}

export default VersionView
