import { randomBytes } from 'node:crypto'

const MAX_BASE_LENGTH = 50
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SUFFIX_LENGTH = 6

// "Crème Brûlée!" -> "creme-brulee". Falls back to "recipe" when nothing usable is left.
export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/^-+|-+$/g, '')
  return base || 'recipe'
}

// The random suffix keeps slugs unique per title and hard to guess for recipes not yet shared.
export function makeSlug(title: string): string {
  const suffix = Array.from(randomBytes(SUFFIX_LENGTH), (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('')
  return `${slugify(title)}-${suffix}`
}
