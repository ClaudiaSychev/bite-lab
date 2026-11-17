import type { Ingredient } from './draft.ts'
import { formatQuantity } from './quantity.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

export function formatLastEdited(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 7 * DAY) return relative.format(-Math.floor(elapsed / DAY), 'day')
  return absolute.format(date)
}

export function formatVersionCount(count: number): string {
  if (count === 0) return 'No versions yet'
  return count === 1 ? '1 version' : `${count} versions`
}

// One readable line, e.g. "1 1/2 cup flour, sifted".
export function formatIngredient({ quantity, unit, name, note }: Ingredient): string {
  const main = [formatQuantity(quantity), unit.trim(), name.trim()].filter(Boolean).join(' ')
  const extra = note.trim()
  if (!main) return extra
  return extra ? `${main}, ${extra}` : main
}

export function formatVersionName({ version, label }: { version: number; label: string | null }): string {
  return label ? `v${version} · ${label}` : `v${version}`
}
