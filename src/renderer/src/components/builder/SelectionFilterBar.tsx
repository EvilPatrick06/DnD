import type { Rarity } from '../../types/character-common'

interface SelectionFilterBarProps {
  rarityFilter: Rarity | 'all'
  searchQuery: string
  onRarityChange: (filter: Rarity | 'all') => void
  onSearchChange: (query: string) => void
}

const RARITY_OPTIONS: Array<{ value: Rarity | 'all'; label: string; color: string }> = [
  { value: 'all', label: 'All', color: 'bg-gray-600 hover:bg-gray-500' },
  { value: 'common', label: 'Common', color: 'bg-gray-600 hover:bg-gray-500' },
  { value: 'uncommon', label: 'Uncommon', color: 'bg-orange-700 hover:bg-orange-600' },
  { value: 'rare', label: 'Rare', color: 'bg-blue-700 hover:bg-blue-600' },
  { value: 'unique', label: 'Unique', color: 'bg-purple-700 hover:bg-purple-600' }
]

export default function SelectionFilterBar({
  rarityFilter,
  searchQuery,
  onRarityChange,
  onSearchChange
}: SelectionFilterBarProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
      <div className="flex gap-1">
        {RARITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onRarityChange(opt.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              rarityFilter === opt.value
                ? `${opt.color} text-white ring-1 ring-white/20`
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
      </div>
    </div>
  )
}
