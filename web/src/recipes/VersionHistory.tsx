import { useState, type FormEvent } from 'react'
import type { VersionSummary } from './api.ts'
import { formatLastEdited, formatVersionName } from './format.ts'

interface VersionHistoryProps {
  versions: VersionSummary[] | null
  loadError: string | null
  // Why saving is blocked right now, e.g. the draft has invalid fields.
  saveBlockedReason: string | null
  viewingId: string | null
  compareIds: readonly string[]
  onSave: (label: string) => Promise<VersionSummary>
  onView: (versionId: string) => void
  onToggleCompare: (versionId: string) => void
  onCompare: () => void
}

const MAX_COMPARE = 2

function VersionHistory({
  versions,
  loadError,
  saveBlockedReason,
  viewingId,
  compareIds,
  onSave,
  onView,
  onToggleCompare,
  onCompare,
}: VersionHistoryProps) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const version = await onSave(label)
      setLabel('')
      setMessage({ text: `Saved ${formatVersionName(version)}`, error: false })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not save version', error: true })
    } finally {
      setSaving(false)
    }
  }

  const byId = new Map(versions?.map((v) => [v.id, v]))
  const [first, second] = compareIds.map((cid) => byId.get(cid)).sort((a, b) => (a?.version ?? 0) - (b?.version ?? 0))

  return (
    <aside aria-labelledby="history-heading" className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded border border-gray-200 p-3">
        <label htmlFor="version-label" className="text-sm font-medium text-gray-600">
          Version label (optional)
        </label>
        <input
          id="version-label"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="e.g. less sugar"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving || saveBlockedReason !== null}
          aria-describedby={saveBlockedReason ? 'save-version-blocked' : undefined}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving version…' : 'Save version'}
        </button>
        {saveBlockedReason && (
          <p id="save-version-blocked" className="text-xs text-gray-500">
            {saveBlockedReason}
          </p>
        )}
        <p aria-live="polite" className={`text-sm ${message?.error ? 'text-red-600' : 'text-gray-600'}`}>
          {message?.text}
        </p>
      </form>

      <section className="flex flex-col gap-2">
        <h2 id="history-heading" className="text-lg font-semibold">
          Version history
        </h2>
        {loadError && (
          <p role="alert" className="text-sm text-red-600">
            {loadError}
          </p>
        )}
        {!versions && !loadError && <p className="text-sm text-gray-500">Loading…</p>}
        {versions?.length === 0 && (
          <p className="text-sm text-gray-500">No versions yet. Save one to keep a snapshot of this draft.</p>
        )}
        {versions && versions.length > 0 && (
          <>
            <ul className="flex flex-col divide-y divide-gray-200 rounded border border-gray-200">
              {versions.map((v) => {
                const name = formatVersionName(v)
                const selected = compareIds.includes(v.id)
                return (
                  <li
                    key={v.id}
                    className={`flex items-center gap-2 px-3 py-2 ${viewingId === v.id ? 'bg-amber-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${name} to compare`}
                      checked={selected}
                      disabled={!selected && compareIds.length >= MAX_COMPARE}
                      onChange={() => onToggleCompare(v.id)}
                    />
                    <button
                      type="button"
                      onClick={() => onView(v.id)}
                      aria-label={`View ${name}`}
                      aria-current={viewingId === v.id ? 'true' : undefined}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium underline-offset-2 hover:underline">
                        {name}
                      </span>
                      <time dateTime={v.createdAt} className="block text-xs text-gray-500">
                        {formatLastEdited(v.createdAt)}
                      </time>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={onCompare}
              disabled={!first || !second}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {first && second ? `Compare v${first.version} and v${second.version}` : 'Select two versions to compare'}
            </button>
          </>
        )}
      </section>
    </aside>
  )
}

export default VersionHistory
