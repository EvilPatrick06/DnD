interface ViewModeToggleProps {
  viewMode: 'dm' | 'player'
  onToggle: () => void
  characterName?: string
}

export default function ViewModeToggle({ viewMode, onToggle, characterName }: ViewModeToggleProps): JSX.Element {
  return (
    <div>
      <button
        onClick={onToggle}
        title={viewMode === 'dm' ? 'Switch to Player View' : 'Switch to DM View'}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full cursor-pointer transition-colors ${
          viewMode === 'dm'
            ? 'bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 border border-gray-600'
            : 'bg-amber-600/90 hover:bg-amber-500/90 text-white border border-amber-500'
        }`}
      >
        {viewMode === 'dm' ? 'DM' : characterName || 'Player'}
      </button>
    </div>
  )
}
