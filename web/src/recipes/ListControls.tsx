interface ListControlsProps {
  label: string
  index: number
  count: number
  onMove: (offset: -1 | 1) => void
  onRemove: () => void
}

const buttonClass =
  'rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent'

// Up / down / remove buttons shared by ingredient rows and instruction steps.
function ListControls({ label, index, count, onMove, onRemove }: ListControlsProps) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        className={buttonClass}
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={`${buttonClass} text-red-600 hover:bg-red-50`}
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  )
}

export default ListControls
