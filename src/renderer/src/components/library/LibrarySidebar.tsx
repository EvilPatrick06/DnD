import { useState } from 'react'
import type { LibraryCategory, LibraryGroup } from '../../types/library'
import { LIBRARY_GROUPS } from '../../types/library'

interface LibrarySidebarProps {
  selectedCategory: LibraryCategory | null
  onSelectCategory: (category: LibraryCategory | null) => void
  homebrewCounts: Record<string, number>
}

export default function LibrarySidebar({
  selectedCategory,
  onSelectCategory,
  homebrewCounts
}: LibrarySidebarProps): JSX.Element {
  const [expandedGroups, setExpandedGroups] = useState<Set<LibraryGroup>>(new Set(LIBRARY_GROUPS.map((g) => g.id)))

  const toggleGroup = (groupId: LibraryGroup): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-800 overflow-y-auto h-full">
      <button
        onClick={() => onSelectCategory(null)}
        className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors cursor-pointer
          ${selectedCategory === null ? 'text-amber-400 bg-gray-800/60' : 'text-gray-300 hover:text-amber-400 hover:bg-gray-800/40'}`}
      >
        All Categories
      </button>

      {LIBRARY_GROUPS.map((group) => (
        <div key={group.id}>
          <button
            onClick={() => toggleGroup(group.id)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            <span>{group.label}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expandedGroups.has(group.id) ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {expandedGroups.has(group.id) && (
            <div className="pb-1">
              {group.categories.map((cat) => {
                const hbCount = homebrewCounts[cat.id] ?? 0
                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.id)}
                    className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 transition-colors cursor-pointer
                      ${
                        selectedCategory === cat.id
                          ? 'text-amber-400 bg-amber-900/20 border-r-2 border-amber-500'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                      }`}
                  >
                    <span className="text-base leading-none">{cat.icon}</span>
                    <span className="flex-1 truncate">{cat.label}</span>
                    {hbCount > 0 && (
                      <span className="text-[10px] bg-amber-600/30 text-amber-400 px-1.5 rounded-full">{hbCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}
