// Shapes stored in Recipe.ingredients / Recipe.instructions (and RecipeVersion snapshots).
// Kept as type aliases (not interfaces) so they're assignable to Prisma's JSON input type.
export type Quantity =
  | { type: 'single'; value: number }
  | { type: 'range'; min: number; max: number }

export type Ingredient = {
  id: string
  name: string
  quantity: Quantity | null
  unit: string
  note: string
}

export type Instruction = {
  id: string
  text: string
}

export type DraftUpdate = {
  title?: string
  ingredients?: Ingredient[]
  instructions?: Instruction[]
  notes?: string
}

export const LIMITS = {
  title: 200,
  label: 100,
  id: 64,
  name: 200,
  unit: 50,
  note: 500,
  instruction: 5000,
  notes: 20_000,
  items: 200,
  amount: 1_000_000,
} as const

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const fail = <T>(error: string): Result<T> => ({ ok: false, error })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, max: number, label: string): Result<string> {
  if (typeof value !== 'string') return fail(`${label} must be a string`)
  if (value.length > max) return fail(`${label} must be at most ${max} characters`)
  return ok(value)
}

function amount(value: unknown, label: string): Result<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${label} must be a number`)
  if (value <= 0) return fail(`${label} must be greater than 0`)
  if (value > LIMITS.amount) return fail(`${label} is too large`)
  return ok(value)
}

export function parseQuantity(value: unknown, label: string): Result<Quantity | null> {
  if (value === null) return ok(null)
  if (!isRecord(value)) return fail(`${label} must be an object or null`)
  if (value.type === 'single') {
    const v = amount(value.value, `${label} amount`)
    return v.ok ? ok({ type: 'single', value: v.value }) : v
  }
  if (value.type === 'range') {
    const min = amount(value.min, `${label} min`)
    if (!min.ok) return min
    const max = amount(value.max, `${label} max`)
    if (!max.ok) return max
    if (max.value < min.value) return fail(`${label} max must be greater than or equal to min`)
    return ok({ type: 'range', min: min.value, max: max.value })
  }
  return fail(`${label} type must be "single" or "range"`)
}

function list<T>(
  value: unknown,
  label: string,
  parseItem: (item: unknown, label: string) => Result<T & { id: string }>,
): Result<T[]> {
  if (!Array.isArray(value)) return fail(`${label} must be an array`)
  if (value.length > LIMITS.items) return fail(`${label} can have at most ${LIMITS.items} items`)
  const items: T[] = []
  const ids = new Set<string>()
  for (const [index, raw] of value.entries()) {
    const item = parseItem(raw, `${label} ${index + 1}`)
    if (!item.ok) return item
    if (ids.has(item.value.id)) return fail(`${label} ${index + 1} has a duplicate id`)
    ids.add(item.value.id)
    items.push(item.value)
  }
  return ok(items)
}

function id(value: unknown, label: string): Result<string> {
  if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.id) {
    return fail(`${label} id must be a non-empty string of at most ${LIMITS.id} characters`)
  }
  return ok(value)
}

function parseIngredient(raw: unknown, label: string): Result<Ingredient> {
  if (!isRecord(raw)) return fail(`${label} must be an object`)
  const itemId = id(raw.id, label)
  if (!itemId.ok) return itemId
  const name = boundedString(raw.name, LIMITS.name, `${label} name`)
  if (!name.ok) return name
  const quantity = parseQuantity(raw.quantity, `${label} quantity`)
  if (!quantity.ok) return quantity
  const unit = boundedString(raw.unit, LIMITS.unit, `${label} unit`)
  if (!unit.ok) return unit
  const note = boundedString(raw.note, LIMITS.note, `${label} note`)
  if (!note.ok) return note
  return ok({
    id: itemId.value,
    name: name.value,
    quantity: quantity.value,
    unit: unit.value,
    note: note.value,
  })
}

function parseInstruction(raw: unknown, label: string): Result<Instruction> {
  if (!isRecord(raw)) return fail(`${label} must be an object`)
  const itemId = id(raw.id, label)
  if (!itemId.ok) return itemId
  const text = boundedString(raw.text, LIMITS.instruction, `${label} text`)
  if (!text.ok) return text
  return ok({ id: itemId.value, text: text.value })
}

export function parseTitle(value: unknown): Result<string> {
  if (typeof value !== 'string') return fail('Title must be a string')
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > LIMITS.title) {
    return fail(`Title must be 1-${LIMITS.title} characters`)
  }
  return ok(trimmed)
}

// Validates a partial draft update; fields that are absent are left unchanged.
export function parseDraftUpdate(body: unknown): Result<DraftUpdate> {
  if (!isRecord(body)) return fail('Body must be an object')
  const update: DraftUpdate = {}
  if ('title' in body) {
    const title = parseTitle(body.title)
    if (!title.ok) return title
    update.title = title.value
  }
  if ('ingredients' in body) {
    const ingredients = list(body.ingredients, 'Ingredient', parseIngredient)
    if (!ingredients.ok) return ingredients
    update.ingredients = ingredients.value
  }
  if ('instructions' in body) {
    const instructions = list(body.instructions, 'Step', parseInstruction)
    if (!instructions.ok) return instructions
    update.instructions = instructions.value
  }
  if ('notes' in body) {
    const notes = boundedString(body.notes, LIMITS.notes, 'Notes')
    if (!notes.ok) return notes
    update.notes = notes.value
  }
  return ok(update)
}

// Version labels are optional: absent, null or blank all mean "no label".
export function parseLabel(value: unknown): Result<string | null> {
  if (value === undefined || value === null) return ok(null)
  if (typeof value !== 'string') return fail('Label must be a string')
  const trimmed = value.trim()
  if (trimmed.length > LIMITS.label) return fail(`Label must be at most ${LIMITS.label} characters`)
  return ok(trimmed === '' ? null : trimmed)
}
