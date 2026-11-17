import type { Recipe } from './api.ts'
import { formatQuantity, parseQuantity, type Quantity } from './quantity.ts'

export interface Ingredient {
  id: string
  name: string
  quantity: Quantity | null
  unit: string
  note: string
}

export interface Instruction {
  id: string
  text: string
}

export interface DraftPayload {
  title: string
  ingredients: Ingredient[]
  instructions: Instruction[]
  notes: string
}

// Editor state keeps the amount as typed, so half-finished input like "1-" isn't lost.
export interface IngredientRow {
  id: string
  name: string
  amount: string
  unit: string
  note: string
}

export interface DraftState {
  title: string
  ingredients: IngredientRow[]
  instructions: Instruction[]
  notes: string
}

export interface DraftErrors {
  title?: string
  amounts: Record<string, string>
}

export type DraftValidation = { ok: true; payload: DraftPayload } | { ok: false; errors: DraftErrors }

export function newId(): string {
  return crypto.randomUUID()
}

export function newIngredient(): IngredientRow {
  return { id: newId(), name: '', amount: '', unit: '', note: '' }
}

export function newInstruction(): Instruction {
  return { id: newId(), text: '' }
}

export function draftFromRecipe(recipe: Recipe): DraftState {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients.map(({ quantity, ...rest }) => ({
      ...rest,
      amount: formatQuantity(quantity),
    })),
    instructions: recipe.instructions,
    notes: recipe.notes,
  }
}

export function validateDraft(state: DraftState): DraftValidation {
  const errors: DraftErrors = { amounts: {} }
  const title = state.title.trim()
  if (title === '') errors.title = 'Title is required'

  const ingredients: Ingredient[] = []
  for (const { amount, ...row } of state.ingredients) {
    const parsed = parseQuantity(amount)
    if (parsed.ok) {
      ingredients.push({ ...row, quantity: parsed.quantity })
    } else {
      errors.amounts[row.id] = parsed.error
    }
  }

  if (errors.title || Object.keys(errors.amounts).length > 0) return { ok: false, errors }
  return {
    ok: true,
    payload: { title, ingredients, instructions: state.instructions, notes: state.notes },
  }
}

export function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items]
  }
  const next = [...items]
  const [item] = next.splice(index, 1) as [T]
  next.splice(target, 0, item)
  return next
}
