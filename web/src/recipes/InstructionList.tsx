import { useState } from 'react'
import { moveItem, newInstruction, type Instruction } from './draft.ts'
import ListControls from './ListControls.tsx'

interface InstructionListProps {
  instructions: Instruction[]
  onChange: (instructions: Instruction[]) => void
}

function InstructionList({ instructions, onChange }: InstructionListProps) {
  const [focusId, setFocusId] = useState<string | null>(null)

  function add() {
    const step = newInstruction()
    setFocusId(step.id)
    onChange([...instructions, step])
  }

  return (
    <section aria-labelledby="instructions-heading">
      <h2 id="instructions-heading" className="text-lg font-semibold">
        Instructions
      </h2>
      {instructions.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No steps yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {instructions.map((step, index) => (
            <li key={step.id} className="flex items-start gap-2">
              <span aria-hidden="true" className="w-6 shrink-0 pt-1.5 text-right text-sm font-semibold text-gray-500">
                {index + 1}.
              </span>
              <textarea
                className="min-h-16 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label={`Step ${index + 1}`}
                autoFocus={step.id === focusId}
                value={step.text}
                onChange={(e) =>
                  onChange(instructions.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s)))
                }
              />
              <ListControls
                label={`step ${index + 1}`}
                index={index}
                count={instructions.length}
                onMove={(offset) => onChange(moveItem(instructions, index, offset))}
                onRemove={() => onChange(instructions.filter((s) => s.id !== step.id))}
              />
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={add} className="mt-3 text-sm font-medium underline">
        + Add step
      </button>
    </section>
  )
}

export default InstructionList
