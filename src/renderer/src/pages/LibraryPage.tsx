import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  HomebrewCreateModal,
  LibraryCategoryGrid,
  LibraryDetailModal,
  LibraryItemList,
  LibrarySidebar
} from '../components/library'
import { BackButton } from '../components/ui'
import { loadCategoryItems, searchAllCategories } from '../services/library-service'
import { useLibraryStore } from '../stores/useLibraryStore'
import type { HomebrewEntry, LibraryCategory, LibraryItem } from '../types/library'
import { getCategoryDef } from '../types/library'

export default function LibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const categoryParam = searchParams.get('category') as LibraryCategory | null

  const {
    searchQuery,
    setSearchQuery,
    homebrewEntries,
    loadHomebrew,
    saveHomebrewEntry,
    deleteHomebrewEntry
  } = useLibraryStore()

  const [selectedCategory, setSelectedCategory] = useState<LibraryCategory | null>(categoryParam)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null)
  const [createModal, setCreateModal] = useState<{ category: LibraryCategory; item?: LibraryItem } | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'homebrew'>('all')
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    loadHomebrew()
  }, [loadHomebrew])

  useEffect(() => {
    if (categoryParam !== selectedCategory) {
      setSelectedCategory(categoryParam)
    }
  }, [categoryParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCategory = useCallback(
    (cat: LibraryCategory | null) => {
      setSelectedCategory(cat)
      setSearchQuery('')
      if (cat) {
        setSearchParams({ category: cat })
      } else {
        setSearchParams({})
      }
    },
    [setSearchParams, setSearchQuery]
  )

  useEffect(() => {
    if (!selectedCategory) return
    let cancelled = false
    setLoading(true)

    loadCategoryItems(selectedCategory, homebrewEntries).then((loaded) => {
      if (!cancelled) {
        setItems(loaded)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [selectedCategory, homebrewEntries])

  useEffect(() => {
    if (!searchQuery || selectedCategory) return
    let cancelled = false
    setLoading(true)

    searchAllCategories(searchQuery, homebrewEntries).then((results) => {
      if (!cancelled) {
        setItems(results)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [searchQuery, selectedCategory, homebrewEntries])

  const filteredItems = useMemo(() => {
    let result = items
    if (searchQuery && selectedCategory) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)
      )
    }
    if (sourceFilter !== 'all') {
      result = result.filter((i) => i.source === sourceFilter)
    }
    return result
  }, [items, searchQuery, selectedCategory, sourceFilter])

  const homebrewCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of homebrewEntries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1
    }
    return counts
  }, [homebrewEntries])

  useEffect(() => {
    // Load a quick count for the category grid (only when on landing)
    if (selectedCategory) return
    const abortCtrl = new AbortController()

    const quickCategories: LibraryCategory[] = [
      'monsters', 'spells', 'classes', 'weapons', 'magic-items', 'feats',
      'species', 'backgrounds', 'traps', 'encounter-presets'
    ]

    Promise.allSettled(
      quickCategories.map(async (cat) => {
        const loaded = await loadCategoryItems(cat, homebrewEntries)
        return [cat, loaded.length] as const
      })
    ).then((results) => {
      if (abortCtrl.signal.aborted) return
      const counts: Record<string, number> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          counts[r.value[0]] = r.value[1]
        }
      }
      setItemCounts(counts)
    })

    return () => abortCtrl.abort()
  }, [selectedCategory, homebrewEntries])

  const handleClone = useCallback(
    (item: LibraryItem) => {
      setDetailItem(null)
      setCreateModal({ category: item.category, item })
    },
    []
  )

  const handleDeleteHomebrew = useCallback(
    async (item: LibraryItem) => {
      const hbId = item.data._homebrewId as string
      if (!hbId) return
      await deleteHomebrewEntry(item.category, hbId)
      setDetailItem(null)
    },
    [deleteHomebrewEntry]
  )

  const handleSaveHomebrew = useCallback(
    async (entry: HomebrewEntry) => {
      const ok = await saveHomebrewEntry(entry)
      if (ok) setCreateModal(null)
    },
    [saveHomebrewEntry]
  )

  const catDef = selectedCategory ? getCategoryDef(selectedCategory) : null

  const backTo = searchParams.get('from') ?? '/'

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 bg-gray-900/80">
        <BackButton to={backTo} />
        <h1 className="text-2xl font-bold text-amber-400 mr-4">Library</h1>

        {/* Universal search */}
        <div className="flex-1 max-w-xl relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedCategory ? `Search ${catDef?.label ?? selectedCategory}...` : 'Search all categories...'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-100
              placeholder:text-gray-500 focus:border-amber-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Source filter (when in a category) */}
        {selectedCategory && (
          <div className="flex items-center gap-1">
            {(['all', 'official', 'homebrew'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
                  ${sourceFilter === f
                    ? 'bg-amber-600/20 text-amber-400 border border-amber-600/40'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent hover:bg-gray-800'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Create button */}
        {selectedCategory && (
          <button
            onClick={() => setCreateModal({ category: selectedCategory })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <LibrarySidebar
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          homebrewCounts={homebrewCounts}
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {!selectedCategory && !searchQuery ? (
            <div className="flex-1 overflow-y-auto p-6">
              <LibraryCategoryGrid
                onSelectCategory={handleSelectCategory}
                itemCounts={itemCounts}
              />
            </div>
          ) : (
            <>
              {selectedCategory && (
                <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {catDef && <span className="text-lg">{catDef.icon}</span>}
                    <h2 className="text-lg font-semibold text-gray-200">{catDef?.label ?? selectedCategory}</h2>
                    <span className="text-sm text-gray-500">({filteredItems.length} items)</span>
                  </div>
                </div>
              )}
              {!selectedCategory && searchQuery && (
                <div className="px-4 py-3 border-b border-gray-800/50">
                  <p className="text-sm text-gray-400">
                    Searching across all categories for &ldquo;{searchQuery}&rdquo;
                    {!loading && ` - ${filteredItems.length} results`}
                  </p>
                </div>
              )}
              <LibraryItemList
                items={filteredItems}
                loading={loading}
                onSelectItem={setDetailItem}
                onCreateNew={() => selectedCategory && setCreateModal({ category: selectedCategory })}
                categoryLabel={catDef?.label ?? selectedCategory ?? 'Item'}
              />
            </>
          )}
        </main>
      </div>

      {/* Detail modal */}
      {detailItem && (
        <LibraryDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onCloneAsHomebrew={handleClone}
          onDelete={detailItem.source === 'homebrew' ? handleDeleteHomebrew : undefined}
        />
      )}

      {/* Create/Edit modal */}
      {createModal && (
        <HomebrewCreateModal
          category={createModal.category}
          existingItem={createModal.item}
          onSave={handleSaveHomebrew}
          onClose={() => setCreateModal(null)}
        />
      )}
    </div>
  )
}
