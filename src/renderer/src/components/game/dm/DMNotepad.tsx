import { useState } from 'react'

interface DMNotepadProps {
  initialNotes?: string
  onNotesChange?: (notes: string) => void
}

export default function DMNotepad({
  initialNotes = '',
  onNotesChange
}: DMNotepadProps): JSX.Element {
  const [notes, setNotes] = useState(initialNotes)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleChange = (value: string): void => {
    setNotes(value)
    onNotesChange?.(value)
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
      >
        <span
          className={`text-xs text-gray-500 transition-transform ${
            isCollapsed ? '' : 'rotate-90'
          }`}
        >
          &#9654;
        </span>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Session Notes
        </h3>
      </button>

      {!isCollapsed && (
        <textarea
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Private DM session notes..."
          rows={6}
          className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200
            placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm resize-y"
        />
      )}
    </div>
  )
}
