import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  HomebrewCreateModal,
  LibraryCategoryGrid,
  LibraryDetailModal,
  LibraryItemList,
  LibrarySidebar
} from '../components/library'
import { BackButton, Button, EmptyState, Skeleton } from '../components/ui'
import { addToast } from '../hooks/use-toast'
import { exportEntities, importEntities, reIdItems } from '../services/io/entity-io'
import { loadCategoryItems } from '../services/library-service'
import { useLibraryStore } from '../stores/use-library-store'
import type {
  HomebrewEntry,
  LibraryCategory,
  LibraryCategoryDef,
  LibraryGroup,
  LibraryGroupDef,
  LibraryItem
} from '../types/library'
import { getAllCategories, getCategoryDef, LIBRARY_GROUPS } from '../types/library'
import type { SortField, Tab } from './library/LibraryFilters'
import { CR_OPTIONS, SIZE_OPTIONS, sizeOrder, TABS, TYPE_OPTIONS } from './library/LibraryFilters'

type _SortField = SortField
type _Tab = Tab

/** Library filter constants re-exported from LibraryFilters for downstream use. */
const _LIBRARY_FILTER_META = { CR_OPTIONS, SIZE_OPTIONS, TYPE_OPTIONS, TABS, sizeOrder } as const
void _LIBRARY_FILTER_META

type _LibraryCategoryDef = LibraryCategoryDef
type _LibraryGroup = LibraryGroup
type _LibraryGroupDef = LibraryGroupDef

import type { MonsterStatBlock } from '../types/monster'
import { logger } from '../utils/logger'

export default function LibraryPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('from') || '/'

  const {
    selectedCategory,
    setCategory,
    searchQuery: search,
    setSearchQuery: setSearch,
    items,
    setItems,
    loading,
    setLoading,
    homebrewEntries,
    loadHomebrew,
    saveHomebrewEntry,
    deleteHomebrewEntry
  } = useLibraryStore()

  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)
  const [homebrewModal, setHomebrewModal] = useState<{
    category: LibraryCategory
    existingItem?: LibraryItem
  } | null>(null)

  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Load homebrew on mount
  useEffect(() => {
    loadHomebrew().then(() => setInitialLoading(false))
  }, [loadHomebrew])

  // Compute homebrew counts per category
  const homebrewCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entry of homebrewEntries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1
    }
    return counts
  }, [homebrewEntries])

  // Total available categories and groups for reference
  const allCategories = getAllCategories()
  const totalCategoryCount = allCategories.length
  const totalGroupCount = LIBRARY_GROUPS.length

  // Item counts per category (homebrew only for now — static counts are too expensive to load all at once)
  const itemCounts = homebrewCounts

  // Load items when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setItems([])
      return
    }
    let cancelled = false
    setLoading(true)
    loadCategoryItems(selectedCategory, homebrewEntries)
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedCategory, homebrewEntries, setItems, setLoading])

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q))
  }, [items, search])

  const handleSelectCategory = useCallback(
    (cat: LibraryCategory | null) => {
      setCategory(cat)
      setSelectedItem(null)
      setSearch('')
    },
    [setCategory, setSearch]
  )

  const handleCloneAsHomebrew = useCallback((item: LibraryItem) => {
    setSelectedItem(null)
    setHomebrewModal({ category: item.category, existingItem: item })
  }, [])

  const handleDeleteItem = useCallback(
    async (item: LibraryItem) => {
      if (item.source !== 'homebrew') return
      const hbId = item.data._homebrewId as string | undefined
      if (!hbId) return
      const ok = await deleteHomebrewEntry(item.category, hbId)
      if (ok) {
        addToast(`Deleted "${item.name}"`, 'success')
        setSelectedItem(null)
      }
    },
    [deleteHomebrewEntry]
  )

  const handleSaveHomebrew = useCallback(
    async (entry: HomebrewEntry) => {
      const ok = await saveHomebrewEntry(entry)
      if (ok) {
        addToast(`Saved "${entry.name}"`, 'success')
        setHomebrewModal(null)
      } else {
        addToast('Failed to save', 'error')
      }
    },
    [saveHomebrewEntry]
  )

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const result = await importEntities<MonsterStatBlock>('monster')
      if (!result) {
        setImporting(false)
        return
      }
      const importedItems = reIdItems(result.items)
      for (const item of importedItems) {
        await window.api.saveCustomCreature(item as unknown as Record<string, unknown>)
      }
      addToast(`Imported ${importedItems.length} creature(s)`, 'success')
      handleSelectCategory('monsters')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      addToast(msg, 'error')
      logger.error(err)
    } finally {
      setImporting(false)
    }
  }, [handleSelectCategory])

  const handleExportAll = useCallback(async () => {
    if (filteredItems.length === 0) return
    setExporting(true)
    try {
      const ok = await exportEntities(
        'monster',
        filteredItems.map((i) => i.data)
      )
      if (ok) addToast(`Exported ${filteredItems.length} item(s)`, 'success')
    } catch (err) {
      addToast('Export failed', 'error')
      logger.error(err)
    } finally {
      setExporting(false)
    }
  }, [filteredItems])

  const catDef = selectedCategory ? getCategoryDef(selectedCategory) : null

  if (initialLoading) {
    return (
      <div className="p-8 h-screen">
        <BackButton to={returnTo} />
        <div className="py-8">
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <BackButton to={returnTo} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1
          className="text-3xl font-bold text-amber-400"
          title={`${totalGroupCount} groups, ${totalCategoryCount} categories available`}
        >
          Library
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
          {selectedCategory && filteredItems.length > 0 && (
            <Button variant="secondary" onClick={handleExportAll} disabled={exporting}>
              Export All ({filteredItems.length})
            </Button>
          )}
          {selectedCategory && (
            <Button variant="primary" onClick={() => setHomebrewModal({ category: selectedCategory })}>
              Create Custom
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {selectedCategory && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${catDef?.label ?? selectedCategory}...`}
            className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex gap-0 flex-1 min-h-0 border border-gray-800 rounded-lg overflow-hidden">
        {/* Sidebar */}
        <LibrarySidebar
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          homebrewCounts={homebrewCounts}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selectedCategory ? (
            <div className="flex-1 overflow-y-auto p-6">
              <LibraryCategoryGrid onSelectCategory={handleSelectCategory} itemCounts={itemCounts} />
            </div>
          ) : loading && filteredItems.length === 0 ? (
            <div className="flex-1 p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : !loading && filteredItems.length === 0 && search.trim() ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState title="No results found" description={`No items match "${search}" in this category.`} />
            </div>
          ) : (
            <LibraryItemList
              items={filteredItems}
              loading={loading}
              onSelectItem={setSelectedItem}
              onCreateNew={() => setHomebrewModal({ category: selectedCategory })}
              categoryLabel={catDef?.label ?? selectedCategory}
            />
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <LibraryDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onCloneAsHomebrew={handleCloneAsHomebrew}
          onDelete={selectedItem.source === 'homebrew' ? handleDeleteItem : undefined}
        />
      )}

      {/* Homebrew Create/Edit Modal */}
      {homebrewModal && (
        <HomebrewCreateModal
          category={homebrewModal.category}
          existingItem={homebrewModal.existingItem}
          onSave={handleSaveHomebrew}
          onClose={() => setHomebrewModal(null)}
        />
      )}
    </div>
  )
}
