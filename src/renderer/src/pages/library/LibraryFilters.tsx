import type { Tab } from './library-constants'
import { CR_OPTIONS, SIZE_OPTIONS, TABS, TYPE_OPTIONS } from './library-constants'

interface LibraryFiltersProps {
  tab: Tab
  setTab: (t: Tab) => void
  counts: { monsters: number; creatures: number; npcs: number; custom: number }
  search: string
  setSearch: (v: string) => void
  crFilter: string
  setCrFilter: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  sizeFilter: string
  setSizeFilter: (v: string) => void
  onTabChange: () => void
}

export default function LibraryFilters({
  tab,
  setTab,
  counts,
  search,
  setSearch,
  crFilter,
  setCrFilter,
  typeFilter,
  setTypeFilter,
  sizeFilter,
  setSizeFilter,
  onTabChange
}: LibraryFiltersProps): JSX.Element {
  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id)
              onTabChange()
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-amber-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">({counts[t.id]})</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, type, or tag..."
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        />
        <select
          value={crFilter}
          onChange={(e) => setCrFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {CR_OPTIONS.map((cr) => (
            <option key={cr} value={cr}>
              {cr === 'Any' ? 'CR: Any' : `CR ${cr}`}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'Any' ? 'Type: Any' : t}
            </option>
          ))}
        </select>
        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'Any' ? 'Size: Any' : s}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
