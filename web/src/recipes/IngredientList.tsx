import { useState } from 'react'
import { moveItem, newIngredient, type IngredientRow } from './draft.ts'
import ListControls from './ListControls.tsx'
import { formatQuantity, parseQuantity } from './quantity.ts'

interface IngredientListProps {
  ingredients: IngredientRow[]
  amountErrors: Record<string, string>
  onChange: (ingredients: IngredientRow[]) => void
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm'

function IngredientList({ ingredients, amountErrors, onChange }: IngredientListProps) {
  const [focusId, setFocusId] = useState<string | null>(null)
  // Amount errors appear once the field has been left, not while the cook is mid-typing "1-".
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())

  function updateRow(id: string, patch: Partial<IngredientRow>) {
    onChange(ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function handleAmountBlur(row: IngredientRow) {
    setTouched((prev) => new Set(prev).add(row.id))
    const parsed = parseQuantity(row.amount)
    if (parsed.ok) {
      const formatted = formatQuantity(parsed.quantity)
      if (formatted !== row.amount) updateRow(row.id, { amount: formatted })
    }
  }

  function add() {
    const row = newIngredient()
    setFocusId(row.id)
    onChange([...ingredients, row])
  }

  return (
    <section aria-labelledby="ingredients-heading">
      <h2 id="ingredients-heading" className="text-lg font-semibold">
        Ingredients
      </h2>
      {ingredients.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No ingredients yet.</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mt-3 hidden grid-cols-[6rem_6rem_1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-gray-500 sm:grid"
          >
            <span>Amount</span>
            <span>Unit</span>
            <span>Ingredient</span>
            <span>Note</span>
            <span className="w-[6.5rem]" />
          </div>
          <ul className="mt-1 flex flex-col gap-2">
            {ingredients.map((row, index) => {
              const label = row.name.trim() || `ingredient ${index + 1}`
              const error = touched.has(row.id) ? amountErrors[row.id] : undefined
              const errorId = `amount-error-${row.id}`
              return (
                <li key={row.id}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[6rem_6rem_1fr_1fr_auto] sm:items-start">
                    <input
                      className={`${inputClass} ${error ? 'border-red-500' : ''}`}
                      aria-label={`Amount for ${label}`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? errorId : undefined}
                      placeholder="1 1/2"
                      inputMode="decimal"
                      autoFocus={row.id === focusId}
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                      onBlur={() => handleAmountBlur(row)}
                    />
                    <input
                      className={inputClass}
                      aria-label={`Unit for ${label}`}
                      placeholder="cup"
                      value={row.unit}
                      onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                    />
                    <input
                      className={`${inputClass} col-span-2 sm:col-span-1`}
                      aria-label={`Name of ingredient ${index + 1}`}
                      placeholder="flour"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    />
                    <input
                      className={`${inputClass} col-span-2 sm:col-span-1`}
                      aria-label={`Note for ${label}`}
                      placeholder="sifted"
                      value={row.note}
                      onChange={(e) => updateRow(row.id, { note: e.target.value })}
                    />
                    <div className="col-span-2 flex justify-end sm:col-span-1">
                      <ListControls
                        label={label}
                        index={index}
                        count={ingredients.length}
                        onMove={(offset) => onChange(moveItem(ingredients, index, offset))}
                        onRemove={() => onChange(ingredients.filter((r) => r.id !== row.id))}
                      />
                    </div>
                  </div>
                  {error && (
                    <p id={errorId} className="mt-1 text-sm text-red-600">
                      {error}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <button type="button" onClick={add} className="mt-3 text-sm font-medium underline">
        + Add ingredient
      </button>
    </section>
  )
}

export default IngredientList
