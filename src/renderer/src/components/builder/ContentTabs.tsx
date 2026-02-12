import type { ContentTab } from '../../types/builder'
import { useBuilderStore } from '../../stores/useBuilderStore'

const TABS: Array<{ id: ContentTab; label: string }> = [
  { id: 'details', label: 'About' },
  { id: 'defense', label: 'Defense' },
  { id: 'offense', label: 'Offense' },
  { id: 'gear', label: 'Gear' },
  { id: 'skills', label: 'Skills' },
  { id: 'spells', label: 'Spells' },
  { id: 'feats', label: 'Feats' }
]

export default function ContentTabs(): JSX.Element {
  const activeTab = useBuilderStore((s) => s.activeTab)
  const setActiveTab = useBuilderStore((s) => s.setActiveTab)

  return (
    <div className="flex border-b border-gray-700 bg-gray-900/50 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-amber-400 border-amber-400'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
