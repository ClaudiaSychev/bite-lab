// Same shape the API stores (api/src/draft.ts).
export type Quantity =
  | { type: 'single'; value: number }
  | { type: 'range'; min: number; max: number }

export type QuantityParseResult =
  | { ok: true; quantity: Quantity | null }
  | { ok: false; error: string }

export const QUANTITY_ERRORS = {
  invalid: 'Enter an amount like 2, 1/2, 1 1/2 or 1–2',
  notPositive: 'Amount must be greater than 0',
  tooLarge: 'Amount is too large',
  maxBelowMin: 'Max must be greater than or equal to min',
} as const

const MAX_AMOUNT = 1_000_000

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
}
const UNICODE_FRACTION_PATTERN = new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join('')}]`, 'g')

// "1 1/2 - 2", "1½–2", "1 to 2"; a leading "-" is left alone so "-1" reads as invalid, not a range.
const RANGE_PATTERN = /^(.+?)\s*(?:[-–—]|\bto\b)\s*(.+)$/i

type NumberResult = { ok: true; value: number } | { ok: false; error: string }

function normalize(text: string): string {
  return text
    .replace(UNICODE_FRACTION_PATTERN, (ch) => ` ${UNICODE_FRACTIONS[ch]}`)
    .replace(/⁄/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(text: string): NumberResult {
  let value: number
  let match: RegExpMatchArray | null
  if ((match = text.match(/^(\d+) (\d+)\/(\d+)$/))) {
    const [, whole, num, den] = match.map(Number) as [number, number, number, number]
    if (den === 0) return { ok: false, error: QUANTITY_ERRORS.invalid }
    value = whole + num / den
  } else if ((match = text.match(/^(\d+)\/(\d+)$/))) {
    const [, num, den] = match.map(Number) as [number, number, number]
    if (den === 0) return { ok: false, error: QUANTITY_ERRORS.invalid }
    value = num / den
  } else if (/^(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) {
    value = Number(text.replace(',', '.'))
  } else {
    return { ok: false, error: QUANTITY_ERRORS.invalid }
  }
  if (value <= 0) return { ok: false, error: QUANTITY_ERRORS.notPositive }
  if (value > MAX_AMOUNT) return { ok: false, error: QUANTITY_ERRORS.tooLarge }
  // Trim float noise (0.1 + 0.2) without losing thirds.
  return { ok: true, value: Math.round(value * 1e6) / 1e6 }
}

// Parses what a cook types into the amount field. Empty means "no amount" (e.g. salt to taste).
export function parseQuantity(text: string): QuantityParseResult {
  const normalized = normalize(text)
  if (normalized === '') return { ok: true, quantity: null }

  const range = normalized.match(RANGE_PATTERN)
  if (!range) {
    const single = parseNumber(normalized)
    return single.ok ? { ok: true, quantity: { type: 'single', value: single.value } } : single
  }

  const min = parseNumber(range[1] ?? '')
  if (!min.ok) return min
  const max = parseNumber(range[2] ?? '')
  if (!max.ok) return max
  if (max.value < min.value) return { ok: false, error: QUANTITY_ERRORS.maxBelowMin }
  if (max.value === min.value) return { ok: true, quantity: { type: 'single', value: min.value } }
  return { ok: true, quantity: { type: 'range', min: min.value, max: max.value } }
}

const DENOMINATORS = [2, 3, 4, 8] as const
const SNAP_TOLERANCE = 0.01

// 1.5 → "1 1/2", 0.333333 → "1/3", 2 → "2", 0.15 → "0.15".
export function formatAmount(value: number): string {
  const whole = Math.floor(value)
  const fraction = value - whole
  for (const den of DENOMINATORS) {
    const num = Math.round(fraction * den)
    if (Math.abs(fraction - num / den) >= SNAP_TOLERANCE) continue
    if (num === 0 && whole > 0) return String(whole)
    if (num === den) return String(whole + 1)
    if (num === 0) break
    return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`
  }
  return String(Number(value.toFixed(value < 0.1 ? 3 : 2)))
}

export function formatQuantity(quantity: Quantity | null): string {
  if (!quantity) return ''
  if (quantity.type === 'single') return formatAmount(quantity.value)
  return `${formatAmount(quantity.min)}–${formatAmount(quantity.max)}`
}
