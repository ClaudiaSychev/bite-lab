import type { ReactNode } from 'react'
import type { RecipeVersion } from './api.ts'
import { formatIngredient, formatVersionName } from './format.ts'
import { useVersion } from './useVersion.ts'
import { alignById, diffWords, type DiffRow, type Segment } from './versionDiff.ts'

const DEL = 'rounded-sm bg-red-100 text-red-900 line-through decoration-red-400'
const INS = 'rounded-sm bg-green-100 text-green-900 no-underline'

function Segments({ segments, side }: { segments: Segment[]; side: 'before' | 'after' }) {
  return (
    <>
      {segments.map((segment, i) => {
        if (!segment.changed) return <span key={i}>{segment.text}</span>
        return side === 'before' ? (
          <del key={i} className={DEL}>
            {segment.text}
          </del>
        ) : (
          <ins key={i} className={INS}>
            {segment.text}
          </ins>
        )
      })}
    </>
  )
}

// A pair of cells for text present in one or both versions.
function TextPair({ before, after, prefix }: { before: string | null; after: string | null; prefix?: [string, string] }) {
  let left: ReactNode = null
  let right: ReactNode = null
  if (before !== null && after !== null) {
    const diff = diffWords(before, after)
    left = <Segments segments={diff.before} side="before" />
    right = <Segments segments={diff.after} side="after" />
  } else if (before !== null) {
    left = <del className={DEL}>{before}</del>
  } else if (after !== null) {
    right = <ins className={INS}>{after}</ins>
  }
  return (
    <>
      <Cell present={before !== null} prefix={prefix?.[0]}>
        {left}
      </Cell>
      <Cell present={after !== null} prefix={prefix?.[1]}>
        {right}
      </Cell>
    </>
  )
}

function Cell({ present, prefix, children }: { present: boolean; prefix?: string; children: ReactNode }) {
  if (!present) return <div aria-hidden="true" className="rounded border border-dashed border-gray-200" />
  return (
    <div className="flex gap-2 whitespace-pre-wrap break-words rounded px-2 py-1 text-sm">
      {prefix && <span className="shrink-0 font-semibold text-gray-500">{prefix}</span>}
      <span className="min-w-0">{children}</span>
    </div>
  )
}

const ROW_LABEL: Record<DiffRow<unknown>['status'], string> = {
  unchanged: 'Unchanged',
  changed: 'Changed',
  added: 'Added',
  removed: 'Removed',
}

const ROW_TINT: Record<DiffRow<unknown>['status'], string> = {
  unchanged: '',
  changed: 'bg-amber-50',
  added: 'bg-green-50',
  removed: 'bg-red-50',
}

function ListDiff<T extends { id: string }>({
  title,
  rows,
  toText,
  numbered,
}: {
  title: string
  rows: DiffRow<T>[]
  toText: (item: T) => string
  numbered: boolean
}) {
  const changes = rows.filter((r) => r.status !== 'unchanged' || r.moved).length
  return (
    <section aria-label={title}>
      <h3 className="flex items-baseline gap-2 text-lg font-semibold">
        {title}
        <span className="text-sm font-normal text-gray-500">
          {changes === 0 ? 'no changes' : changes === 1 ? '1 change' : `${changes} changes`}
        </span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">None in either version.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {rows.map((row) => {
            const current = row.after ?? row.before
            if (!current) return null
            const prefix = (side: DiffRow<T>['before']) =>
              side ? (numbered ? `${side.index + 1}.` : '•') : ''
            const tags = [row.status !== 'unchanged' ? ROW_LABEL[row.status] : null, row.moved ? 'Moved' : null]
              .filter(Boolean)
              .join(', ')
            return (
              <li
                key={current.item.id}
                data-status={row.status}
                className={`relative grid grid-cols-2 gap-4 rounded ${ROW_TINT[row.status]}`}
              >
                {tags && <span className="sr-only">{tags}:</span>}
                <TextPair
                  before={row.before ? toText(row.before.item) : null}
                  after={row.after ? toText(row.after.item) : null}
                  prefix={[prefix(row.before), prefix(row.after)]}
                />
                {row.moved && (
                  <span className="absolute right-1 top-1 rounded bg-blue-100 px-1.5 text-xs text-blue-800">moved</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function CompareVersions({ before, after }: { before: RecipeVersion; after: RecipeVersion }) {
  const ingredients = alignById(before.ingredients, after.ingredients, (a, b) => formatIngredient(a) === formatIngredient(b))
  const instructions = alignById(before.instructions, after.instructions, (a, b) => a.text === b.text)
  const identical =
    before.title === after.title &&
    before.notes === after.notes &&
    [...ingredients, ...instructions].every((r) => r.status === 'unchanged' && !r.moved)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-2 text-sm">
        {[before, after].map((v) => (
          <div key={v.id}>
            <p className="font-semibold">{formatVersionName(v)}</p>
            <time dateTime={v.createdAt} className="text-xs text-gray-500">
              {new Date(v.createdAt).toLocaleString()}
            </time>
          </div>
        ))}
      </div>
      {identical && <p className="text-sm text-gray-600">These versions are identical.</p>}

      <section aria-label="Title">
        <h3 className="text-lg font-semibold">Title</h3>
        <div className={`mt-2 grid grid-cols-2 gap-4 rounded ${before.title !== after.title ? 'bg-amber-50' : ''}`}>
          <TextPair before={before.title} after={after.title} />
        </div>
      </section>
      <ListDiff title="Ingredients" rows={ingredients} toText={formatIngredient} numbered={false} />
      <ListDiff title="Instructions" rows={instructions} toText={(s) => s.text} numbered />
      <section aria-label="Notes">
        <h3 className="text-lg font-semibold">Notes</h3>
        {before.notes.trim() === '' && after.notes.trim() === '' ? (
          <p className="mt-2 text-sm text-gray-500">None in either version.</p>
        ) : (
          <div className={`mt-2 grid grid-cols-2 gap-4 rounded ${before.notes !== after.notes ? 'bg-amber-50' : ''}`}>
            <TextPair before={before.notes} after={after.notes} />
          </div>
        )}
      </section>
    </div>
  )
}

interface VersionCompareProps {
  recipeId: string
  versionIds: readonly [string, string]
  onClose: () => void
}

function VersionCompare({ recipeId, versionIds, onClose }: VersionCompareProps) {
  const a = useVersion(recipeId, versionIds[0])
  const b = useVersion(recipeId, versionIds[1])
  const error = a.status === 'error' ? a.error : b.status === 'error' ? b.error : null

  let body: ReactNode = <p className="text-gray-500">Loading…</p>
  if (error) {
    body = (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    )
  } else if (a.status === 'loaded' && b.status === 'loaded') {
    // Older version on the left, regardless of the order they were picked in.
    const [before, after] = a.version.version <= b.version.version ? [a.version, b.version] : [b.version, a.version]
    body = <CompareVersions before={before} after={after} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded border border-gray-300 bg-gray-50 px-4 py-3">
        <h2 className="flex-1 text-sm font-semibold">Comparing versions</h2>
        <p className="flex gap-3 text-xs">
          <del className={`${DEL} px-1`}>removed</del>
          <ins className={`${INS} px-1`}>added</ins>
        </p>
        <button type="button" onClick={onClose} className="text-sm underline">
          Back to draft
        </button>
      </div>
      {body}
    </div>
  )
}

export default VersionCompare
