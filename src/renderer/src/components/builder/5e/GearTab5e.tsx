import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getHigherLevelEquipment, rollStartingGold } from '../../../data/starting-equipment-table'
import { load5eMagicItems } from '../../../services/data-provider'
import { useBuilderStore } from '../../../stores/useBuilderStore'
import type { MagicItemRarity5e } from '../../../types/character-common'
import type { MagicItemData } from '../../../types/data'
import { deductWithConversion, parseCost, totalInCopper } from '../../../utils/currency'
import SectionBanner from '../shared/SectionBanner'

const CURRENCY_CONFIG = [
  {
    key: 'pp' as const,
    label: 'PP',
    fullName: 'Platinum',
    ring: 'border-gray-400',
    bg: 'bg-gray-500',
    text: 'text-gray-100'
  },
  {
    key: 'gp' as const,
    label: 'GP',
    fullName: 'Gold',
    ring: 'border-yellow-500',
    bg: 'bg-yellow-600',
    text: 'text-yellow-100'
  },
  {
    key: 'sp' as const,
    label: 'SP',
    fullName: 'Silver',
    ring: 'border-gray-300',
    bg: 'bg-gray-300',
    text: 'text-gray-800'
  },
  {
    key: 'cp' as const,
    label: 'CP',
    fullName: 'Copper',
    ring: 'border-amber-700',
    bg: 'bg-amber-700',
    text: 'text-amber-100'
  }
]

function EditableCurrencyCircle({
  config,
  value,
  onChange
}: {
  config: (typeof CURRENCY_CONFIG)[number]
  value: number
  onChange: (val: number) => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(): void {
    setDraft(String(value))
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit(): void {
    const parsed = parseInt(draft, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onChange(parsed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-14 h-14 rounded-full border-2 ${config.ring} ${config.bg} ${config.text} flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105`}
        onClick={() => !editing && startEdit()}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-10 h-6 text-center text-sm font-bold bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            style={{ color: 'inherit' }}
          />
        ) : (
          <span className="text-lg font-bold leading-tight">{value}</span>
        )}
      </div>
      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{config.fullName}</span>
    </div>
  )
}

// Equipment data types from equipment.json
interface WeaponData {
  name: string
  category: string
  damage: string
  damageType: string
  weight?: number
  properties?: string[]
  cost?: string
  description?: string
}

interface ArmorData {
  name: string
  category: string
  baseAC?: number
  dexBonus?: boolean
  dexBonusMax?: number | null
  weight?: number
  stealthDisadvantage?: boolean
  cost?: string
  description?: string
  strengthRequirement?: number
}

interface GearData {
  name: string
  category?: string
  weight?: number
  cost?: string
  description: string
}

interface EquipmentDatabase {
  weapons: WeaponData[]
  armor: ArmorData[]
  gear: GearData[]
}

function useEquipmentDatabase(): EquipmentDatabase | null {
  const [db, setDb] = useState<EquipmentDatabase | null>(null)
  useEffect(() => {
    fetch('./data/5e/equipment.json')
      .then((r) => r.json())
      .then((data) => setDb(data))
      .catch((err) => console.error('Failed to load equipment data:', err))
  }, [])
  return db
}

function lookupItem(
  db: EquipmentDatabase | null,
  name: string
): { type: 'weapon'; data: WeaponData } | { type: 'armor'; data: ArmorData } | { type: 'gear'; data: GearData } | null {
  if (!db) return null
  const lowerName = name.toLowerCase()

  const weapon = db.weapons.find((w) => w.name.toLowerCase() === lowerName)
  if (weapon) return { type: 'weapon', data: weapon }

  const armor = db.armor.find((a) => a.name.toLowerCase() === lowerName)
  if (armor) return { type: 'armor', data: armor }

  const gear = db.gear.find((g) => g.name.toLowerCase() === lowerName)
  if (gear) return { type: 'gear', data: gear }

  // Fuzzy match
  for (const w of db.weapons) {
    if (lowerName.includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(lowerName)) {
      return { type: 'weapon', data: w }
    }
  }
  for (const a of db.armor) {
    if (lowerName.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(lowerName)) {
      return { type: 'armor', data: a }
    }
  }
  for (const g of db.gear) {
    if (lowerName.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(lowerName)) {
      return { type: 'gear', data: g }
    }
  }

  return null
}

function ItemDetailView({ item }: { item: ReturnType<typeof lookupItem> }): JSX.Element | null {
  if (!item) return <p className="text-xs text-gray-500 italic px-2 py-1">No mechanical data available.</p>

  if (item.type === 'weapon') {
    const w = item.data
    const weaponProps = w.properties ?? []
    const costStr = w.cost ?? ''
    const weightStr = w.weight !== undefined ? `${w.weight} lb.` : ''
    return (
      <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
        <div className="flex gap-4">
          <span>
            <span className="text-gray-500">Damage:</span>{' '}
            <span className="text-red-400 font-medium">
              {w.damage} {w.damageType}
            </span>
          </span>
          <span>
            <span className="text-gray-500">Type:</span> {w.category}
          </span>
        </div>
        <div className="flex gap-4">
          {weightStr && (
            <span>
              <span className="text-gray-500">Weight:</span> {weightStr}
            </span>
          )}
          <span>
            <span className="text-gray-500">Cost:</span> {costStr}
          </span>
        </div>
        {weaponProps.length > 0 && (
          <div>
            <span className="text-gray-500">Properties:</span> {weaponProps.join(', ')}
          </div>
        )}
        {w.description && <div className="text-gray-500 mt-1">{w.description}</div>}
      </div>
    )
  }

  if (item.type === 'armor') {
    const a = item.data
    const acStr = a.dexBonus
      ? a.dexBonusMax !== null
        ? `${a.baseAC} + DEX (max ${a.dexBonusMax})`
        : `${a.baseAC} + DEX`
      : `${a.baseAC}`
    return (
      <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
        <div className="flex gap-4">
          <span>
            <span className="text-gray-500">AC:</span> <span className="text-blue-400 font-medium">{acStr}</span>
          </span>
          <span>
            <span className="text-gray-500">Type:</span> {a.category}
          </span>
        </div>
        <div className="flex gap-4">
          <span>
            <span className="text-gray-500">Weight:</span> {a.weight} lb.
          </span>
          <span>
            <span className="text-gray-500">Cost:</span> {a.cost}
          </span>
        </div>
        {!!a.stealthDisadvantage && <div className="text-yellow-500">Stealth Disadvantage</div>}
        {!!a.strengthRequirement && (
          <div>
            <span className="text-gray-500">Str Required:</span> {String(a.strengthRequirement)}
          </div>
        )}
        {typeof a.description === 'string' && a.description && (
          <div className="text-gray-500 mt-1">{a.description}</div>
        )}
      </div>
    )
  }

  // Gear / fallback
  const g = item.data
  return (
    <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
      <div>{g.description}</div>
      <div className="flex gap-4">
        {g.weight !== undefined && (
          <span>
            <span className="text-gray-500">Weight:</span> {g.weight} lb.
          </span>
        )}
        <span>
          <span className="text-gray-500">Cost:</span> {g.cost}
        </span>
      </div>
    </div>
  )
}

function InventoryItem({
  item,
  equipDb,
  onRemove
}: {
  item: { name: string; quantity: number }
  equipDb: EquipmentDatabase | null
  onRemove: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const looked = expanded ? lookupItem(equipDb, item.name) : null

  return (
    <div className="border-b border-gray-800/50 last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="flex items-center justify-between py-1.5 px-2 rounded text-sm text-gray-300 hover:bg-gray-800/60 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
          <span className="truncate">{item.name}</span>
          {item.quantity > 1 && <span className="text-xs text-gray-500 font-medium">x{item.quantity}</span>}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-gray-600 hover:text-red-400 transition-colors ml-2 shrink-0 text-xs px-1"
          title="Remove item"
          aria-label="Remove item"
        >
          ✕
        </button>
      </div>
      {expanded && (
        <div className="ml-5 mb-1 bg-gray-800/40 rounded">
          <ItemDetailView item={looked} />
        </div>
      )}
    </div>
  )
}

interface ShopItem {
  name: string
  type: 'weapon' | 'armor' | 'gear'
  category: string
  cost: string
  detail: string
}

function buildShopItems(db: EquipmentDatabase): ShopItem[] {
  const items: ShopItem[] = []
  for (const w of db.weapons) {
    const props = w.properties ?? []
    items.push({
      name: w.name,
      type: 'weapon',
      category: w.category,
      cost: w.cost ?? '',
      detail: `${w.damage} ${w.damageType}${props.length > 0 ? ` | ${props.join(', ')}` : ''}`
    })
  }
  for (const a of db.armor) {
    const acStr = a.dexBonus
      ? a.dexBonusMax !== null
        ? `AC ${a.baseAC} + DEX (max ${a.dexBonusMax})`
        : `AC ${a.baseAC} + DEX`
      : `AC ${a.baseAC}`
    items.push({ name: a.name, type: 'armor', category: a.category, cost: a.cost ?? '', detail: acStr })
  }
  for (const g of db.gear) {
    items.push({
      name: g.name,
      type: 'gear',
      category: g.category ?? '',
      cost: g.cost ?? '',
      detail: g.description
    })
  }
  return items
}

const SHOP_TYPE_FILTERS = ['all', 'weapon', 'armor', 'gear'] as const

function EquipmentShop({
  equipDb,
  onAdd,
  onClose
}: {
  equipDb: EquipmentDatabase
  onAdd: (name: string, cost: string) => void
  onClose: () => void
}): JSX.Element {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'weapon' | 'armor' | 'gear'>('all')

  const shopItems = useMemo(() => buildShopItems(equipDb), [equipDb])
  const filtered = useMemo(
    () =>
      shopItems.filter((item) => {
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (search) {
          const q = search.toLowerCase()
          return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
        }
        return true
      }),
    [shopItems, typeFilter, search]
  )
  const shopParentRef = useRef<HTMLDivElement>(null)
  const shopVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => shopParentRef.current,
    estimateSize: () => 40,
    overscan: 10
  })

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/80 border-b border-gray-700">
        <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Equipment Shop</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="px-3 py-2 border-b border-gray-800 space-y-2">
        <input
          type="text"
          placeholder="Search equipment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-gray-200 placeholder:text-gray-500 outline-none focus:border-amber-500/50"
        />
        <div className="flex gap-1">
          {SHOP_TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                typeFilter === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div ref={shopParentRef} className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 italic px-3 py-4 text-center">No items match your search.</p>
        ) : (
          <div style={{ height: `${shopVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {shopVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = filtered[virtualItem.index]
              return (
                <div
                  key={`${item.type}-${item.name}-${virtualItem.index}`}
                  data-index={virtualItem.index}
                  ref={shopVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/40">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200 truncate">{item.name}</span>
                        <span className="text-[10px] text-gray-500 shrink-0">{item.cost}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{item.detail}</div>
                    </div>
                    <button
                      onClick={() => onAdd(item.name, item.cost)}
                      className="text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded px-2 py-0.5 shrink-0 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Magic Item Picker for Higher Level Starting Equipment ---

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-300 border-gray-500',
  uncommon: 'text-green-400 border-green-600',
  rare: 'text-blue-400 border-blue-600',
  'very-rare': 'text-purple-400 border-purple-600',
  legendary: 'text-orange-400 border-orange-600'
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very-rare': 'Very Rare',
  legendary: 'Legendary'
}

function MagicItemSlot({
  rarity,
  slotIndex,
  selectedItem,
  onSelect,
  onClear
}: {
  rarity: MagicItemRarity5e
  slotIndex: number
  selectedItem: { itemId: string; itemName: string } | null
  onSelect: (item: MagicItemData) => void
  onClear: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<MagicItemData[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (expanded && items.length === 0) {
      load5eMagicItems(rarity)
        .then(setItems)
        .catch(() => setItems([]))
    }
  }, [expanded, rarity, items.length])

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q))
  }, [items, search])

  const colors = RARITY_COLORS[rarity] ?? 'text-gray-400 border-gray-600'

  if (selectedItem) {
    return (
      <div className={`flex items-center justify-between border rounded px-2 py-1.5 ${colors}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{selectedItem.itemName}</span>
          <span className="text-[10px] text-gray-500">{RARITY_LABELS[rarity]}</span>
        </div>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-400 px-1 cursor-pointer">
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`text-xs border rounded px-2 py-1 cursor-pointer transition-colors ${colors} hover:bg-gray-800`}
      >
        {expanded
          ? `Hide ${RARITY_LABELS[rarity]} Items`
          : `Select ${RARITY_LABELS[rarity]} Magic Item (Slot ${slotIndex + 1})`}
      </button>
      {expanded && (
        <div className="mt-1 border border-gray-700 rounded bg-gray-900/80 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-gray-800">
            <input
              type="text"
              placeholder={`Search ${RARITY_LABELS[rarity]} items...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 placeholder:text-gray-500 outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-500 italic px-2 py-2 text-center">
                {items.length === 0 ? 'Loading...' : 'No items match.'}
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item)
                    setExpanded(false)
                    setSearch('')
                  }}
                  className="w-full text-left flex items-center justify-between px-2 py-1 hover:bg-gray-800 border-b border-gray-800/50 last:border-0 cursor-pointer"
                >
                  <div>
                    <span className="text-sm text-gray-200">{item.name}</span>
                    {item.attunement && <span className="text-[10px] text-purple-400 ml-1">(A)</span>}
                    <div className="text-[10px] text-gray-500">
                      {item.type} - {item.cost}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function HigherLevelEquipmentSection(): JSX.Element | null {
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const higherLevelGoldBonus = useBuilderStore((s) => s.higherLevelGoldBonus)
  const setHigherLevelGoldBonus = useBuilderStore((s) => s.setHigherLevelGoldBonus)
  const selectedMagicItems = useBuilderStore((s) => s.selectedMagicItems)
  const setSelectedMagicItems = useBuilderStore((s) => s.setSelectedMagicItems)
  const currency = useBuilderStore((s) => s.currency)
  const setCurrency = useBuilderStore((s) => s.setCurrency)

  const hlEquip = getHigherLevelEquipment(targetLevel)
  if (!hlEquip) return null

  const handleRollGold = useCallback((): void => {
    const rolled = rollStartingGold(targetLevel)
    // Remove previous bonus and add new one
    const currentGp = currency.gp - higherLevelGoldBonus + rolled
    setCurrency({ ...currency, gp: Math.max(0, currentGp) })
    setHigherLevelGoldBonus(rolled)
  }, [targetLevel, currency, higherLevelGoldBonus, setCurrency, setHigherLevelGoldBonus])

  const handleTakeAverage = useCallback((): void => {
    const avg = hlEquip.baseGold + (hlEquip.diceCount > 0 ? Math.ceil(5.5 * hlEquip.diceMultiplier) : 0)
    const currentGp = currency.gp - higherLevelGoldBonus + avg
    setCurrency({ ...currency, gp: Math.max(0, currentGp) })
    setHigherLevelGoldBonus(avg)
  }, [hlEquip, currency, higherLevelGoldBonus, setCurrency, setHigherLevelGoldBonus])

  // Build magic item slots from the grants table
  const magicSlots: Array<{ rarity: MagicItemRarity5e; index: number }> = []
  for (const [rarity, count] of Object.entries(hlEquip.magicItems)) {
    for (let i = 0; i < (count ?? 0); i++) {
      magicSlots.push({ rarity: rarity as MagicItemRarity5e, index: magicSlots.length })
    }
  }

  const handleSelectMagicItem = (slotIdx: number, rarity: string, item: MagicItemData): void => {
    const updated = [...selectedMagicItems]
    // Replace or add at slotIdx
    const existingIdx = updated.findIndex((_, i) => i === slotIdx)
    if (existingIdx >= 0) {
      updated[existingIdx] = { slotRarity: rarity, itemId: item.id, itemName: item.name }
    } else {
      // Pad with empty entries if needed
      while (updated.length <= slotIdx) {
        updated.push({ slotRarity: '', itemId: '', itemName: '' })
      }
      updated[slotIdx] = { slotRarity: rarity, itemId: item.id, itemName: item.name }
    }
    setSelectedMagicItems(updated)
  }

  const handleClearMagicItem = (slotIdx: number): void => {
    const updated = [...selectedMagicItems]
    if (slotIdx < updated.length) {
      updated[slotIdx] = { slotRarity: '', itemId: '', itemName: '' }
    }
    setSelectedMagicItems(updated)
  }

  return (
    <>
      <SectionBanner label="HIGHER LEVEL STARTING EQUIPMENT" />
      <div className="px-4 py-3 border-b border-gray-800 space-y-3">
        <p className="text-xs text-gray-500">
          Characters starting at level {targetLevel} receive bonus gold and magic items per the 2024 PHB.
        </p>

        {/* Bonus Gold */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bonus Starting Gold</div>
          {hlEquip.diceCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">
                {hlEquip.baseGold} + {hlEquip.diceCount}d10 x {hlEquip.diceMultiplier} GP
              </span>
              <button
                onClick={handleRollGold}
                className="text-xs px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-gray-900 font-semibold cursor-pointer"
              >
                Roll
              </button>
              <button
                onClick={handleTakeAverage}
                className="text-xs px-2 py-0.5 rounded border border-gray-600 text-gray-400 hover:text-gray-200 cursor-pointer"
              >
                Average
              </button>
              {higherLevelGoldBonus > 0 && (
                <span className="text-sm text-amber-400 font-bold">+{higherLevelGoldBonus} GP</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">No bonus gold at this level</span>
              {hlEquip.baseGold > 0 && <span className="text-sm text-amber-400 font-bold">+{hlEquip.baseGold} GP</span>}
            </div>
          )}
        </div>

        {/* Magic Item Slots */}
        {magicSlots.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Magic Items</div>
            <div className="space-y-1.5">
              {magicSlots.map((slot, idx) => {
                const selected = selectedMagicItems[idx]
                const hasSelection = selected?.itemId ? { itemId: selected.itemId, itemName: selected.itemName } : null
                return (
                  <MagicItemSlot
                    key={`${slot.rarity}-${idx}`}
                    rarity={slot.rarity}
                    slotIndex={idx}
                    selectedItem={hasSelection}
                    onSelect={(item) => handleSelectMagicItem(idx, slot.rarity, item)}
                    onClear={() => handleClearMagicItem(idx)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function GearTab5e(): JSX.Element {
  const classEquipment = useBuilderStore((s) => s.classEquipment)
  const bgEquipment = useBuilderStore((s) => s.bgEquipment)
  const currency = useBuilderStore((s) => s.currency)
  const setCurrency = useBuilderStore((s) => s.setCurrency)
  const removeEquipmentItem = useBuilderStore((s) => s.removeEquipmentItem)
  const addEquipmentItem = useBuilderStore((s) => s.addEquipmentItem)

  const _deductCurrency = useBuilderStore((s) => s.deductCurrency)
  const equipDb = useEquipmentDatabase()
  const [showShop, setShowShop] = useState(false)
  const [shopWarning, setShopWarning] = useState<string | null>(null)

  // Flat combined inventory list
  const allItems = [
    ...classEquipment.map((item, idx) => ({ ...item, srcType: 'class' as const, srcIdx: idx })),
    ...bgEquipment.map((item, idx) => ({ ...item, srcType: 'bg' as const, srcIdx: idx }))
  ]

  const hasEquipment = allItems.length > 0

  function handleCurrencyChange(key: 'pp' | 'gp' | 'sp' | 'cp', val: number): void {
    setCurrency({ ...currency, [key]: val })
  }

  function handleAddFromShop(name: string, costStr: string): void {
    const cost = parseCost(costStr)
    if (cost && cost.amount > 0) {
      const newCurrency = deductWithConversion(currency, cost)
      if (!newCurrency) {
        const totalCp = totalInCopper(currency)
        const costCp = cost.amount * { pp: 1000, gp: 100, sp: 10, cp: 1 }[cost.currency]
        setShopWarning(
          `Not enough funds (need ${cost.amount} ${cost.currency.toUpperCase()} = ${costCp} cp, have ${totalCp} cp total)`
        )
        setTimeout(() => setShopWarning(null), 3000)
        return
      }
      setCurrency(newCurrency)
    }
    addEquipmentItem({ name, quantity: 1, source: 'shop' })
    setShopWarning(null)
  }

  return (
    <div>
      {/* Currency */}
      <SectionBanner label="CURRENCY" />
      <div className="flex justify-center gap-4 px-4 py-4 border-b border-gray-800">
        {CURRENCY_CONFIG.map((c) => (
          <EditableCurrencyCircle
            key={c.key}
            config={c}
            value={currency[c.key]}
            onChange={(val) => handleCurrencyChange(c.key, val)}
          />
        ))}
      </div>

      {/* Higher Level Starting Equipment */}
      <HigherLevelEquipmentSection />

      {/* Shop Button */}
      <div className="px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => setShowShop(!showShop)}
          className="w-full text-sm text-gray-300 bg-gray-700/50 border border-gray-600/50 rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
        >
          {showShop ? 'Hide Shop' : 'Shop'}
        </button>
      </div>

      {/* Equipment Shop Panel */}
      {showShop && equipDb && (
        <div className="px-4 py-3 border-b border-gray-800">
          {shopWarning && (
            <div className="mb-2 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded">
              {shopWarning}
            </div>
          )}
          <EquipmentShop equipDb={equipDb} onAdd={handleAddFromShop} onClose={() => setShowShop(false)} />
        </div>
      )}

      {/* Inventory */}
      <SectionBanner label="INVENTORY" />
      <div className="px-4 py-3">
        {hasEquipment ? (
          <div>
            {allItems.map((item) => (
              <InventoryItem
                key={`${item.srcType}-${item.srcIdx}-${item.name}`}
                item={item}
                equipDb={equipDb}
                onRemove={() => removeEquipmentItem(item.srcType, item.srcIdx)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Select a class and background to see starting equipment.</p>
        )}
      </div>
    </div>
  )
}
