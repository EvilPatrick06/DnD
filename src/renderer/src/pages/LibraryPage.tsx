import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import MonsterStatBlockView from '../components/game/dm/MonsterStatBlockView'
import { BackButton, Button, Spinner } from '../components/ui'
import { addToast } from '../hooks/useToast'
import {
  load5eCreatures,
  load5eMonsters,
  load5eNpcs,
  loadAllStatBlocks,
  searchMonsters
} from '../services/data-provider'
import { exportEntities, importEntities, reIdItems } from '../services/entity-io'
import type { MonsterStatBlock } from '../types/monster'
import { crToNumber } from '../types/monster'

type Tab = 'monsters' | 'creatures' | 'npcs' | 'custom'
type SortField = 'name' | 'cr' | 'type' | 'size'

const TABS: { id: Tab; label: string }[] = [
  { id: 'monsters', label: 'Monsters' },
  { id: 'creatures', label: 'Creatures' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'custom', label: 'Custom' }
]

const CR_OPTIONS = ['Any', '0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']

const TYPE_OPTIONS = ['Any', 'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead']

const SIZE_OPTIONS = ['Any', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

export default function LibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('from') || '/'

  const [tab, setTab] = useState<Tab>('monsters')
  const [loading, setLoading] = useState(true)
  const [monsters, setMonsters] = useState<MonsterStatBlock[]>([])
  const [creatures, setCreatures] = useState<MonsterStatBlock[]>([])
  const [npcs, setNpcs] = useState<MonsterStatBlock[]>([])
  const [custom, setCustom] = useState<MonsterStatBlock[]>([])

  const [search, setSearch] = useState('')
  const [crFilter, setCrFilter] = useState('Any')
  const [typeFilter, setTypeFilter] = useState('Any')
  const [sizeFilter, setSizeFilter] = useState('Any')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewId, setPreviewId] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [m, c, n] = await Promise.all([load5eMonsters(), load5eCreatures(), load5eNpcs()])
      setMonsters(m)
      setCreatures(c)
      setNpcs(n)

      try {
        const raw = await window.api.loadCustomCreatures()
        if (Array.isArray(raw)) {
          setCustom(raw as unknown as MonsterStatBlock[])
        }
      } catch {
        setCustom([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeList = useMemo(() => {
    switch (tab) {
      case 'monsters': return monsters
      case 'creatures': return creatures
      case 'npcs': return npcs
      case 'custom': return custom
    }
  }, [tab, monsters, creatures, npcs, custom])

  const filtered = useMemo(() => {
    let list = search ? searchMonsters(activeList, search) : [...activeList]

    if (crFilter !== 'Any') {
      list = list.filter((m) => m.cr === crFilter)
    }
    if (typeFilter !== 'Any') {
      list = list.filter((m) => m.type === typeFilter)
    }
    if (sizeFilter !== 'Any') {
      list = list.filter((m) => m.size === sizeFilter)
    }

    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'cr': cmp = crToNumber(a.cr) - crToNumber(b.cr); break
        case 'type': cmp = a.type.localeCompare(b.type); break
        case 'size': cmp = sizeOrder(a.size) - sizeOrder(b.size); break
      }
      return sortAsc ? cmp : -cmp
    })

    return list
  }, [activeList, search, crFilter, typeFilter, sizeFilter, sortField, sortAsc])

  const previewMonster = useMemo(() => {
    if (!previewId) return null
    return [...monsters, ...creatures, ...npcs, ...custom].find((m) => m.id === previewId) ?? null
  }, [previewId, monsters, creatures, npcs, custom])

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id))

  const toggleSelectAll = (): void => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((m) => m.id)))
    }
  }

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const handleExportSelected = async (): Promise<void> => {
    const items = filtered.filter((m) => selected.has(m.id))
    if (items.length === 0) return
    setExporting(true)
    try {
      const ok = await exportEntities('monster', items)
      if (ok) addToast(`Exported ${items.length} item(s)`, 'success')
    } catch (err) {
      addToast('Export failed', 'error')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportAll = async (): Promise<void> => {
    if (filtered.length === 0) return
    setExporting(true)
    try {
      const ok = await exportEntities('monster', filtered)
      if (ok) addToast(`Exported ${filtered.length} item(s)`, 'success')
    } catch (err) {
      addToast('Export failed', 'error')
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await importEntities<MonsterStatBlock>('monster')
      if (!result) { setImporting(false); return }

      const items = reIdItems(result.items)
      for (const item of items) {
        await window.api.saveCustomCreature(item as unknown as Record<string, unknown>)
      }
      addToast(`Imported ${items.length} creature(s) to Custom`, 'success')
      await loadData()
      setTab('custom')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      addToast(msg, 'error')
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteCustom = async (id: string): Promise<void> => {
    await window.api.deleteCustomCreature(id)
    setCustom((prev) => prev.filter((c) => c.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    addToast('Creature deleted', 'success')
  }

  const handleDeleteSelected = async (): Promise<void> => {
    if (tab !== 'custom') return
    const ids = [...selected].filter((id) => custom.some((c) => c.id === id))
    for (const id of ids) {
      await window.api.deleteCustomCreature(id)
    }
    setCustom((prev) => prev.filter((c) => !selected.has(c.id)))
    setSelected(new Set())
    addToast(`Deleted ${ids.length} creature(s)`, 'success')
  }

  const sortIcon = (field: SortField): string => {
    if (sortField !== field) return ''
    return sortAsc ? ' \u2191' : ' \u2193'
  }

  if (loading) {
    return (
      <div className="p-8 h-screen">
        <BackButton to={returnTo} />
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      </div>
    )
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <BackButton to={returnTo} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-amber-400">Library</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
          {selected.size > 0 && (
            <Button variant="secondary" onClick={handleExportSelected} disabled={exporting}>
              Export Selected ({selected.size})
            </Button>
          )}
          <Button variant="secondary" onClick={handleExportAll} disabled={exporting || filtered.length === 0}>
            Export All ({filtered.length})
          </Button>
          {tab === 'custom' && selected.size > 0 && (
            <Button variant="danger" onClick={handleDeleteSelected}>
              Delete ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelected(new Set()); setPreviewId(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-amber-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">
              ({t.id === 'monsters' ? monsters.length : t.id === 'creatures' ? creatures.length : t.id === 'npcs' ? npcs.length : custom.length})
            </span>
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
            <option key={cr} value={cr}>{cr === 'Any' ? 'CR: Any' : `CR ${cr}`}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === 'Any' ? 'Type: Any' : t}</option>
          ))}
        </select>
        <select
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'Any' ? 'Size: Any' : s}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* List */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-t-lg text-xs text-gray-500 font-semibold uppercase tracking-wider">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="rounded shrink-0"
            />
            <button onClick={() => handleSort('name')} className="flex-1 text-left cursor-pointer hover:text-gray-300">
              Name{sortIcon('name')}
            </button>
            <button onClick={() => handleSort('type')} className="w-24 text-left cursor-pointer hover:text-gray-300">
              Type{sortIcon('type')}
            </button>
            <button onClick={() => handleSort('size')} className="w-20 text-left cursor-pointer hover:text-gray-300">
              Size{sortIcon('size')}
            </button>
            <button onClick={() => handleSort('cr')} className="w-14 text-left cursor-pointer hover:text-gray-300">
              CR{sortIcon('cr')}
            </button>
            <span className="w-12 text-center">HP</span>
            <span className="w-12 text-center">AC</span>
            {tab === 'custom' && <span className="w-12" />}
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto border border-gray-800 rounded-b-lg">
            {filtered.length === 0 ? (
              <div className="text-center text-gray-500 py-12 text-sm">
                {search || crFilter !== 'Any' || typeFilter !== 'Any' || sizeFilter !== 'Any'
                  ? 'No results match your filters.'
                  : tab === 'custom'
                    ? 'No custom creatures yet. Import some or add from another tab.'
                    : 'No data loaded.'}
              </div>
            ) : (
              filtered.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setPreviewId(previewId === m.id ? null : m.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-800/50 cursor-pointer transition-colors ${
                    previewId === m.id ? 'bg-amber-900/20' : 'hover:bg-gray-800/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(m.id) }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded shrink-0"
                  />
                  <span className="flex-1 text-gray-200 truncate font-medium">{m.name}</span>
                  <span className="w-24 text-gray-400 text-xs truncate">{m.type}</span>
                  <span className="w-20 text-gray-400 text-xs">{m.size}</span>
                  <span className="w-14 text-amber-400 text-xs font-mono">{m.cr}</span>
                  <span className="w-12 text-center text-gray-400 text-xs">{m.hp}</span>
                  <span className="w-12 text-center text-gray-400 text-xs">{m.ac}</span>
                  {tab === 'custom' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCustom(m.id) }}
                      className="w-12 text-center text-gray-500 hover:text-red-400 text-xs cursor-pointer"
                      title="Delete"
                    >
                      Del
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        {previewMonster && (
          <div className="w-96 shrink-0 overflow-y-auto border border-gray-800 rounded-lg bg-gray-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-amber-400">{previewMonster.name}</h3>
              <button
                onClick={() => setPreviewId(null)}
                className="text-gray-500 hover:text-gray-300 cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
            <MonsterStatBlockView monster={previewMonster} />
          </div>
        )}
      </div>
    </div>
  )
}

function sizeOrder(size: string): number {
  const order: Record<string, number> = { Tiny: 0, Small: 1, Medium: 2, Large: 3, Huge: 4, Gargantuan: 5 }
  return order[size] ?? 3
}
