import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  createVersion,
  getRecipe,
  listVersions,
  restoreVersion,
  updateRecipe,
  type RecipeVersion,
  type VersionSummary,
} from '../recipes/api.ts'
import { createAutosaver, type Autosaver, type SaveStatus } from '../recipes/autosave.ts'
import { draftFromRecipe, validateDraft, type DraftPayload, type DraftState } from '../recipes/draft.ts'
import IngredientList from '../recipes/IngredientList.tsx'
import InstructionList from '../recipes/InstructionList.tsx'
import { formatVersionName } from '../recipes/format.ts'
import VersionCompare from '../recipes/VersionCompare.tsx'
import VersionHistory from '../recipes/VersionHistory.tsx'
import VersionView from '../recipes/VersionView.tsx'

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: "Couldn't save. Retrying…",
}

function RecipeEditor({ id }: { id: string }) {
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [edited, setEdited] = useState(false)
  const saverRef = useRef<Autosaver<DraftPayload> | null>(null)
  const [versions, setVersions] = useState<VersionSummary[] | null>(null)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  // ?version=<id> shows one version read-only; ?compare=<id>,<id> compares two. Neither: the editable draft.
  const [searchParams, setSearchParams] = useSearchParams()
  const viewingId = searchParams.get('version')
  const comparePair = searchParams.get('compare')?.split(',')

  useEffect(() => {
    let cancelled = false
    getRecipe(id).then(
      (recipe) => {
        if (!cancelled) setDraft(draftFromRecipe(recipe))
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load recipe')
      },
    )
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    listVersions(id).then(
      (list) => {
        if (!cancelled) setVersions(list)
      },
      (err: unknown) => {
        if (!cancelled) setVersionsError(err instanceof Error ? err.message : 'Could not load versions')
      },
    )
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const saver = createAutosaver<DraftPayload>({
      save: async (payload) => {
        await updateRecipe(id, payload)
      },
      onStatus: setSaveStatus,
    })
    saverRef.current = saver
    return () => {
      // Leaving the page saves whatever is queued instead of dropping it.
      void saver.flush()
      saver.dispose()
      saverRef.current = null
    }
  }, [id])

  const validation = useMemo(() => (draft ? validateDraft(draft) : null), [draft])

  useEffect(() => {
    if (edited && validation?.ok) saverRef.current?.schedule(validation.payload)
  }, [edited, validation])

  const invalid = edited && validation !== null && !validation.ok
  const unsaved = invalid || saveStatus === 'pending' || saveStatus === 'saving' || saveStatus === 'error'

  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  function update(patch: Partial<DraftState>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
    setEdited(true)
  }

  // The server snapshots the draft as last saved, so pending edits are saved first.
  async function saveVersion(label: string): Promise<VersionSummary> {
    const saver = saverRef.current
    if (saver && !(await saver.flush())) {
      throw new Error("Couldn't save your latest changes, so no version was created. Try again.")
    }
    const version = await createVersion(id, label)
    setVersions((prev) => [version, ...(prev ?? [])])
    return version
  }

  async function restore(version: RecipeVersion) {
    // The draft is being replaced, so queued edits must not land on top of the restored copy.
    await saverRef.current?.discard()
    const recipe = await restoreVersion(id, version.id)
    setDraft(draftFromRecipe(recipe))
    setEdited(false)
    setNotice(`Restored ${formatVersionName(version)} into the draft.`)
    setSearchParams({})
  }

  function toggleCompare(versionId: string) {
    setCompareIds((prev) => (prev.includes(versionId) ? prev.filter((v) => v !== versionId) : [...prev, versionId]))
  }

  function showVersion(versionId: string) {
    setNotice(null)
    setSearchParams({ version: versionId })
  }

  function showCompare() {
    setNotice(null)
    setSearchParams({ compare: compareIds.join(',') })
  }

  const closeVersionView = () => setSearchParams({})

  const errors = validation && !validation.ok ? validation.errors : { amounts: {} }
  const statusText = invalid ? 'Not saved: fix the highlighted fields' : STATUS_TEXT[saveStatus]

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between gap-4">
        <Link to="/recipes" className="text-sm underline">
          ← My recipes
        </Link>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${invalid || saveStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}
        >
          {statusText}
        </p>
      </div>

      {loadError && (
        <p role="alert" className="mt-6 text-red-600">
          {loadError}
        </p>
      )}
      {!draft && !loadError && <p className="mt-6 text-gray-500">Loading…</p>}

      {draft && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            {comparePair?.length === 2 && comparePair[0] && comparePair[1] ? (
              <VersionCompare
                key={comparePair.join(',')}
                recipeId={id}
                versionIds={[comparePair[0], comparePair[1]]}
                onClose={closeVersionView}
              />
            ) : viewingId ? (
              <VersionView
                key={viewingId}
                recipeId={id}
                versionId={viewingId}
                onClose={closeVersionView}
                onRestore={restore}
              />
            ) : (
              <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()}>
                {notice && (
                  <p aria-live="polite" className="rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
                    {notice}
                  </p>
                )}
                <div>
                  <label htmlFor="recipe-title" className="text-sm font-medium text-gray-600">
                    Title
                  </label>
                  <input
                    id="recipe-title"
                    className={`mt-1 w-full rounded border px-3 py-2 text-2xl font-bold ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                    value={draft.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  {errors.title && (
                    <p id="title-error" className="mt-1 text-sm text-red-600">
                      {errors.title}
                    </p>
                  )}
                </div>

                <IngredientList
                  ingredients={draft.ingredients}
                  amountErrors={errors.amounts}
                  onChange={(ingredients) => update({ ingredients })}
                />

                <InstructionList
                  instructions={draft.instructions}
                  onChange={(instructions) => update({ instructions })}
                />

                <div>
                  <label htmlFor="recipe-notes" className="text-lg font-semibold">
                    Notes
                  </label>
                  <textarea
                    id="recipe-notes"
                    className="mt-2 min-h-28 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Substitutions, timing, what to try next…"
                    value={draft.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </div>
              </form>
            )}
          </div>
          <VersionHistory
            versions={versions}
            loadError={versionsError}
            saveBlockedReason={invalid ? 'Fix the highlighted fields before saving a version.' : null}
            viewingId={viewingId}
            compareIds={compareIds}
            onSave={saveVersion}
            onView={showVersion}
            onToggleCompare={toggleCompare}
            onCompare={showCompare}
          />
        </div>
      )}
    </main>
  )
}

// Keyed by id so moving to another recipe starts with fresh editor state.
function RecipeEditorPage() {
  const { id = '' } = useParams()
  return <RecipeEditor key={id} id={id} />
}

export default RecipeEditorPage
