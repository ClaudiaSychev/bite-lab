import { useState } from 'react'
import type { RecipeVersion } from './api.ts'
import { formatVersionName } from './format.ts'
import RecipeContent from './RecipeContent.tsx'
import { useVersion } from './useVersion.ts'

interface VersionViewProps {
  recipeId: string
  versionId: string
  onClose: () => void
  onRestore: (version: RecipeVersion) => Promise<void>
  publishedVersionId: string | null
  onPublish: (version: RecipeVersion) => Promise<void>
}

function VersionView({ recipeId, versionId, onClose, onRestore, publishedVersionId, onPublish }: VersionViewProps) {
  const state = useVersion(recipeId, versionId)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
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

  async function publish(version: RecipeVersion) {
    setPublishing(true)
    setPublishError(null)
    try {
      await onPublish(version)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not publish version')
    } finally {
      setPublishing(false)
    }
  }

  const isPublished = publishedVersionId === versionId

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
        {state.status === 'loaded' &&
          (isPublished ? (
            <span className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-800">Published</span>
          ) : (
            <button
              type="button"
              disabled={publishing}
              onClick={() => void publish(state.version)}
              title={publishedVersionId ? 'Replaces the version currently on the public page' : undefined}
              className="rounded border border-gray-900 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish this version'}
            </button>
          ))}
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

      {publishError && (
        <p role="alert" className="text-sm text-red-600">
          {publishError}
        </p>
      )}

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
      {state.status === 'loaded' && (
        <RecipeContent recipe={state.version} label={`${formatVersionName(state.version)} (read-only)`} />
      )}
    </div>
  )
}

export default VersionView
