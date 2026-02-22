import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ShopItem, ShopItemCategory, ShopItemRarity } from '../../../../network/types'
import { load5eEquipment, load5eMagicItems } from '../../../../services/data-provider'
import { useGameStore } from '../../../../stores/useGameStore'
import { useNetworkStore } from '../../../../stores/useNetworkStore'
import type { ArmorData, EquipmentFile, GearData, MagicItemData, WeaponData } from '../../../../types/data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCostString(cost: string): ShopItem['price'] {
  const price: ShopItem['price'] = {}
  const parts = cost.toLowerCase().split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    const match = trimmed.match(/^([\d,.]+)\s*(cp|sp|gp|pp)$/)
    if (match) {
      const value = Number(match[1].replace(/,/g, ''))
      const unit = match[2] as 'cp' | 'sp' | 'gp' | 'pp'
      price[unit] = (price[unit] ?? 0) + value
    }
  }
  return price
}

function applyMarkup(price: ShopItem['price'], markup: number): ShopItem['price'] {
  const result: ShopItem['price'] = {}
  if (price.pp) result.pp = Math.round(price.pp * markup * 100) / 100
  if (price.gp) result.gp = Math.round(price.gp * markup * 100) / 100
  if (price.sp) result.sp = Math.round(price.sp * markup * 100) / 100
  if (price.cp) result.cp = Math.round(price.cp * markup * 100) / 100
  return result
}

function formatPrice(price: ShopItem['price']): string {
  const parts: string[] = []
  if (price.pp) parts.push(`${price.pp} pp`)
  if (price.gp) parts.push(`${price.gp} gp`)
  if (price.sp) parts.push(`${price.sp} sp`)
  if (price.cp) parts.push(`${price.cp} cp`)
  return parts.join(', ') || 'Free'
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const SHOP_CATEGORIES: ShopItemCategory[] = [
  'weapon',
  'armor',
  'potion',
  'scroll',
  'wondrous',
  'tool',
  'adventuring',
  'trade',
  'other'
]

const RARITY_OPTIONS: ShopItemRarity[] = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']

const RARITY_COLORS: Record<ShopItemRarity, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  'very rare': 'text-purple-400',
  legendary: 'text-amber-400',
  artifact: 'text-red-400'
}

type SortKey = 'name' | 'price' | 'category'

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

interface PresetDef {
  label: string
  weaponNames: string[]
  armorNames: string[]
  gearNames: string[]
  magicItemNames: string[]
}

const PRESETS: Record<string, PresetDef> = {
  general: {
    label: 'General Store',
    weaponNames: [],
    armorNames: [],
    gearNames: [
      'Backpack',
      'Bedroll',
      'Rope, Hempen (50 ft)',
      'Rations (1 day)',
      'Torch',
      'Waterskin',
      'Tinderbox',
      'Oil (flask)',
      'Crowbar',
      'Hammer',
      'Pitons (10)',
      'Lantern, Hooded'
    ],
    magicItemNames: []
  },
  blacksmith: {
    label: 'Blacksmith',
    weaponNames: [
      'Longsword',
      'Shortsword',
      'Greatsword',
      'Battleaxe',
      'Warhammer',
      'Mace',
      'Dagger',
      'Handaxe',
      'Spear',
      'Javelin',
      'Light crossbow'
    ],
    armorNames: ['Chain Mail', 'Chain Shirt', 'Scale Mail', 'Studded Leather', 'Leather', 'Shield'],
    gearNames: [],
    magicItemNames: []
  },
  alchemist: {
    label: 'Alchemist',
    weaponNames: [],
    armorNames: [],
    gearNames: [
      'Antitoxin (vial)',
      'Oil (flask)',
      'Acid (vial)',
      "Alchemist's Fire (flask)",
      'Holy Water (flask)',
      "Healer's Kit",
      "Herbalism Kit",
      'Vial',
      'Component Pouch'
    ],
    magicItemNames: ['Potion of Healing', 'Potion of Greater Healing', 'Potion of Climbing', 'Potion of Resistance']
  },
  magic: {
    label: 'Magic Shop',
    weaponNames: [],
    armorNames: [],
    gearNames: ['Arcane Focus (Crystal)', 'Spellbook', 'Component Pouch', 'Ink (1-ounce bottle)', 'Parchment (one sheet)'],
    magicItemNames: [
      'Bag of Holding',
      'Cloak of Protection',
      'Boots of Elvenkind',
      'Cloak of Elvenkind',
      'Hat of Disguise',
      'Goggles of Night',
      'Driftglobe',
      'Immovable Rod',
      'Decanter of Endless Water',
      'Pearl of Power'
    ]
  },
  blackmarket: {
    label: 'Black Market',
    weaponNames: ['Dagger', 'Hand crossbow', 'Shortsword'],
    armorNames: [],
    gearNames: [
      "Thieves' Tools",
      'Caltrops (bag of 20)',
      "Burglar's Pack",
      "Disguise Kit",
      "Forgery Kit",
      "Poisoner's Kit"
    ],
    magicItemNames: [
      'Cloak of Elvenkind',
      'Boots of Elvenkind',
      'Dust of Disappearance',
      'Dust of Sneezing and Choking',
      'Hat of Disguise',
      'Ring of Mind Shielding'
    ]
  }
}

// ---------------------------------------------------------------------------
// Equipment / magic item data helpers
// ---------------------------------------------------------------------------

interface ImportableItem {
  id: string
  name: string
  price: ShopItem['price']
  weight: number
  category: string
  shopCategory: ShopItemCategory
  description: string
  rarity?: ShopItemRarity
}

function weaponToImportable(w: WeaponData): ImportableItem {
  return {
    id: slugify(w.name),
    name: w.name,
    price: parseCostString(w.cost),
    weight: w.weight,
    category: w.category,
    shopCategory: 'weapon',
    description: `${w.damage} ${w.damageType}${w.properties.length > 0 ? ` (${w.properties.join(', ')})` : ''}`
  }
}

function armorToImportable(a: ArmorData): ImportableItem {
  return {
    id: slugify(a.name),
    name: a.name,
    price: parseCostString(a.cost),
    weight: a.weight,
    category: a.category,
    shopCategory: 'armor',
    description: `AC ${a.baseAC}${a.dexBonus ? ' + Dex' : ''}${a.dexBonusMax != null ? ` (max ${a.dexBonusMax})` : ''}${a.stealthDisadvantage ? ', Stealth Disadvantage' : ''}`
  }
}

function gearToImportable(g: GearData): ImportableItem {
  return {
    id: slugify(g.name),
    name: g.name,
    price: parseCostString(g.cost),
    weight: g.weight,
    category: g.category,
    shopCategory: 'adventuring',
    description: g.description
  }
}

function normalizeRarity(r: string): ShopItemRarity {
  const mapping: Record<string, ShopItemRarity> = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
    'very-rare': 'very rare',
    'very rare': 'very rare',
    legendary: 'legendary',
    artifact: 'artifact'
  }
  return mapping[r.toLowerCase()] ?? 'common'
}

function magicItemToImportable(m: MagicItemData): ImportableItem {
  const typeMap: Record<string, ShopItemCategory> = {
    weapon: 'weapon',
    armor: 'armor',
    wondrous: 'wondrous',
    potion: 'potion',
    scroll: 'scroll',
    ring: 'wondrous',
    rod: 'wondrous',
    staff: 'wondrous',
    wand: 'wondrous'
  }
  return {
    id: m.id,
    name: m.name,
    price: parseCostString(m.cost),
    weight: 0,
    category: m.type,
    shopCategory: typeMap[m.type.toLowerCase()] ?? 'other',
    description: m.description.slice(0, 200) + (m.description.length > 200 ? '...' : ''),
    rarity: normalizeRarity(m.rarity)
  }
}

function importableToShopItem(item: ImportableItem, quantity: number): ShopItem {
  return {
    id: `${item.id}-${crypto.randomUUID().slice(0, 8)}`,
    name: item.name,
    category: item.category,
    price: item.price,
    quantity,
    description: item.description,
    weight: item.weight,
    shopCategory: item.shopCategory,
    rarity: item.rarity
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DMShopModalProps {
  onClose: () => void
}

export default function DMShopModal({ onClose }: DMShopModalProps): JSX.Element {
  const {
    shopOpen,
    shopName,
    shopInventory,
    shopMarkup,
    openShop,
    closeShop,
    addShopItem,
    removeShopItem,
    setShopInventory,
    setShopMarkup,
    updateShopItem
  } = useGameStore()
  const sendMessage = useNetworkStore((s) => s.sendMessage)

  // Local UI state
  const [shopNameInput, setShopNameInput] = useState(shopName || 'General Store')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [filterCategory, setFilterCategory] = useState<ShopItemCategory | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Custom item form
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customWeight, setCustomWeight] = useState('')
  const [customCategory, setCustomCategory] = useState<ShopItemCategory>('other')
  const [customRarity, setCustomRarity] = useState<ShopItemRarity>('common')
  const [customDescription, setCustomDescription] = useState('')

  // Import modals
  const [importMode, setImportMode] = useState<'none' | 'equipment' | 'magic'>('none')
  const [equipmentData, setEquipmentData] = useState<EquipmentFile | null>(null)
  const [magicItemsData, setMagicItemsData] = useState<MagicItemData[]>([])
  const [importSearch, setImportSearch] = useState('')
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set())

  // Load data on demand
  useEffect(() => {
    if (importMode === 'equipment' && !equipmentData) {
      load5eEquipment().then(setEquipmentData).catch(() => {})
    }
    if (importMode === 'magic' && magicItemsData.length === 0) {
      load5eMagicItems().then(setMagicItemsData).catch(() => {})
    }
  }, [importMode, equipmentData, magicItemsData.length])

  // Derive importable list
  const importableItems = useMemo((): ImportableItem[] => {
    if (importMode === 'equipment' && equipmentData) {
      return [
        ...equipmentData.weapons.map(weaponToImportable),
        ...equipmentData.armor.map(armorToImportable),
        ...equipmentData.gear.map(gearToImportable)
      ]
    }
    if (importMode === 'magic') {
      return magicItemsData.map(magicItemToImportable)
    }
    return []
  }, [importMode, equipmentData, magicItemsData])

  const filteredImports = useMemo(() => {
    if (!importSearch.trim()) return importableItems
    const q = importSearch.toLowerCase()
    return importableItems.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    )
  }, [importableItems, importSearch])

  // Sort & filter inventory
  const displayInventory = useMemo(() => {
    let items = [...shopInventory]
    if (filterCategory !== 'all') {
      items = items.filter((i) => i.shopCategory === filterCategory)
    }
    items.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'price': {
          const aTotal = (a.price.pp ?? 0) * 1000 + (a.price.gp ?? 0) * 100 + (a.price.sp ?? 0) * 10 + (a.price.cp ?? 0)
          const bTotal = (b.price.pp ?? 0) * 1000 + (b.price.gp ?? 0) * 100 + (b.price.sp ?? 0) * 10 + (b.price.cp ?? 0)
          return aTotal - bTotal
        }
        case 'category':
          return (a.shopCategory ?? 'other').localeCompare(b.shopCategory ?? 'other')
        default:
          return 0
      }
    })
    return items
  }, [shopInventory, filterCategory, sortKey])

  // Preset loading
  const loadPreset = useCallback(
    async (presetKey: string, replace: boolean) => {
      const preset = PRESETS[presetKey]
      if (!preset) return

      const equipment = equipmentData ?? (await load5eEquipment())
      if (!equipmentData) setEquipmentData(equipment)
      const magicItems = magicItemsData.length > 0 ? magicItemsData : await load5eMagicItems()
      if (magicItemsData.length === 0) setMagicItemsData(magicItems)

      const items: ShopItem[] = []

      const matchWeapon = (name: string): WeaponData | undefined =>
        equipment.weapons.find((w) => w.name.toLowerCase() === name.toLowerCase())
      const matchArmor = (name: string): ArmorData | undefined =>
        equipment.armor.find((a) => a.name.toLowerCase() === name.toLowerCase())
      const matchGear = (name: string): GearData | undefined =>
        equipment.gear.find((g) => g.name.toLowerCase() === name.toLowerCase())
      const matchMagic = (name: string): MagicItemData | undefined =>
        magicItems.find((m) => m.name.toLowerCase() === name.toLowerCase())

      for (const wName of preset.weaponNames) {
        const w = matchWeapon(wName)
        if (w) items.push(importableToShopItem(weaponToImportable(w), 5))
      }
      for (const aName of preset.armorNames) {
        const a = matchArmor(aName)
        if (a) items.push(importableToShopItem(armorToImportable(a), 3))
      }
      for (const gName of preset.gearNames) {
        const g = matchGear(gName)
        if (g) items.push(importableToShopItem(gearToImportable(g), 20))
      }
      for (const mName of preset.magicItemNames) {
        const m = matchMagic(mName)
        if (m) items.push(importableToShopItem(magicItemToImportable(m), 1))
      }

      if (replace) {
        setShopInventory(items)
      } else {
        for (const item of items) {
          addShopItem(item)
        }
      }
    },
    [equipmentData, magicItemsData, setShopInventory, addShopItem]
  )

  // Broadcast
  const handleBroadcast = (): void => {
    // Filter out hidden items & DM-only fields before sending to players
    const playerInventory = shopInventory
      .filter((i) => !i.isHidden)
      .map((i) => ({
        ...i,
        price: applyMarkup(i.price, shopMarkup),
        dmNotes: undefined,
        hiddenFromPlayerIds: undefined,
        isHidden: undefined
      }))
    sendMessage('dm:shop-update', { shopInventory: playerInventory, shopName })
  }

  const handleOpenShop = (): void => {
    openShop(shopNameInput || 'General Store')
    const playerInventory = shopInventory
      .filter((i) => !i.isHidden)
      .map((i) => ({
        ...i,
        price: applyMarkup(i.price, shopMarkup),
        dmNotes: undefined,
        hiddenFromPlayerIds: undefined,
        isHidden: undefined
      }))
    sendMessage('dm:shop-update', { shopInventory: playerInventory, shopName: shopNameInput || 'General Store' })
  }

  const handleCloseShop = (): void => {
    closeShop()
    sendMessage('dm:shop-update', { shopInventory: [], shopName: '' })
  }

  const handleAddCustomItem = (): void => {
    if (!customName.trim()) return
    const priceGp = Number.parseFloat(customPrice) || 0
    const item: ShopItem = {
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name: customName.trim(),
      category: customCategory,
      price: { gp: priceGp },
      quantity: 10,
      weight: Number.parseFloat(customWeight) || 0,
      shopCategory: customCategory,
      rarity: customRarity,
      description: customDescription.trim() || undefined
    }
    addShopItem(item)
    setCustomName('')
    setCustomPrice('')
    setCustomWeight('')
    setCustomCategory('other')
    setCustomRarity('common')
    setCustomDescription('')
  }

  const handleImportSelected = (): void => {
    for (const item of filteredImports) {
      if (selectedImports.has(item.id)) {
        addShopItem(importableToShopItem(item, importMode === 'magic' ? 1 : 10))
      }
    }
    setSelectedImports(new Set())
    setImportMode('none')
    setImportSearch('')
  }

  const toggleImportSelection = (id: string): void => {
    setSelectedImports((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // =========================================================================
  // Import sub-modal
  // =========================================================================
  if (importMode !== 'none') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setImportMode('none')} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-5 w-[44rem] max-h-[85vh] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-amber-400">
              {importMode === 'equipment' ? 'Import from Equipment' : 'Import from Magic Items'}
            </h2>
            <button
              onClick={() => setImportMode('none')}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <input
            type="text"
            value={importSearch}
            onChange={(e) => setImportSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 mb-3"
          />

          <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
            {filteredImports.length === 0 && (
              <p className="text-xs text-gray-500 italic py-4 text-center">
                {importableItems.length === 0 ? 'Loading data...' : 'No items match your search.'}
              </p>
            )}
            {filteredImports.slice(0, 200).map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 rounded px-3 py-1.5 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedImports.has(item.id)}
                  onChange={() => toggleImportSelection(item.id)}
                  className="accent-amber-500"
                />
                <span className="flex-1 min-w-0 truncate text-gray-200">{item.name}</span>
                <span className="text-gray-500 shrink-0">{formatPrice(item.price)}</span>
                {item.rarity && (
                  <span className={`shrink-0 ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</span>
                )}
                <span className="text-gray-600 shrink-0">{item.category}</span>
              </label>
            ))}
            {filteredImports.length > 200 && (
              <p className="text-xs text-gray-500 text-center py-2">
                Showing first 200 of {filteredImports.length} results. Narrow your search.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
            <span className="text-xs text-gray-400">{selectedImports.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => setImportMode('none')}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSelected}
                disabled={selectedImports.size === 0}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded cursor-pointer"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // Main modal
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-5 w-[56rem] max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-amber-400">Shop Management</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Top bar: name, markup, broadcast */}
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Shop Name</label>
            <input
              type="text"
              value={shopNameInput}
              onChange={(e) => {
                setShopNameInput(e.target.value)
                if (shopOpen) openShop(e.target.value)
              }}
              placeholder="General Store"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-gray-400 mb-1">
              Markup: {Math.round(shopMarkup * 100)}%
            </label>
            <input
              type="range"
              min={50}
              max={200}
              value={Math.round(shopMarkup * 100)}
              onChange={(e) => setShopMarkup(Number(e.target.value) / 100)}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="flex gap-2">
            {!shopOpen ? (
              <button
                onClick={handleOpenShop}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                Open for Players
              </button>
            ) : (
              <>
                <button
                  onClick={handleBroadcast}
                  className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
                >
                  Broadcast
                </button>
                <button
                  onClick={handleCloseShop}
                  className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-red-200 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
                >
                  Close Shop
                </button>
              </>
            )}
          </div>
        </div>

        {shopOpen && (
          <span className="text-xs text-green-400 mb-2 block">Shop is open for players</span>
        )}

        {/* Presets */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Load Preset Inventory
          </h3>
          <div className="flex flex-wrap gap-1">
            {Object.entries(PRESETS).map(([key, def]) => (
              <div key={key} className="flex">
                <button
                  onClick={() => loadPreset(key, true)}
                  title="Replace current inventory"
                  className="text-[11px] px-2 py-1 bg-gray-800 border border-gray-700 rounded-l text-gray-300 hover:text-amber-300 hover:border-amber-600 cursor-pointer"
                >
                  {def.label}
                </button>
                <button
                  onClick={() => loadPreset(key, false)}
                  title="Add to current inventory"
                  className="text-[11px] px-1.5 py-1 bg-gray-800 border border-l-0 border-gray-700 rounded-r text-gray-500 hover:text-green-400 hover:border-green-600 cursor-pointer"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom item creator (collapsible) */}
        <div className="mb-4 border border-gray-700 rounded">
          <button
            onClick={() => setCustomOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-300 cursor-pointer"
          >
            <span>Add Custom Item</span>
            <span>{customOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {customOpen && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Item name"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Price (GP)</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Weight (lb)</label>
                  <input
                    type="number"
                    value={customWeight}
                    onChange={(e) => setCustomWeight(e.target.value)}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as ShopItemCategory)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                  >
                    {SHOP_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Rarity</label>
                  <select
                    value={customRarity}
                    onChange={(e) => setCustomRarity(e.target.value as ShopItemRarity)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                  >
                    {RARITY_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddCustomItem}
                    disabled={!customName.trim()}
                    className="w-full py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                  >
                    Add Item
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Description</label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Item description..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Import buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setImportMode('equipment')
              setSelectedImports(new Set())
              setImportSearch('')
            }}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded cursor-pointer"
          >
            Import from Equipment
          </button>
          <button
            onClick={() => {
              setImportMode('magic')
              setSelectedImports(new Set())
              setImportSearch('')
            }}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded cursor-pointer"
          >
            Import from Magic Items
          </button>
        </div>

        {/* Inventory table header: sort + filter */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Inventory ({shopInventory.length} items)
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as ShopItemCategory | 'all')}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Categories</option>
              {SHOP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <div className="flex text-[10px] gap-0.5">
              {(['name', 'price', 'category'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                    sortKey === key
                      ? 'bg-amber-600/30 text-amber-400'
                      : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory table */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 mb-3">
          {displayInventory.length === 0 && (
            <p className="text-xs text-gray-500 italic py-4 text-center">
              No items in shop. Use presets, import, or add custom items above.
            </p>
          )}
          {displayInventory.map((item) => {
            const isEditing = editingId === item.id
            const markedUpPrice = applyMarkup(item.price, shopMarkup)
            const stock =
              item.stockLimit != null
                ? `${item.stockRemaining ?? item.stockLimit}/${item.stockLimit}`
                : `x${item.quantity}`

            return (
              <div
                key={item.id}
                className={`rounded text-xs ${item.isHidden ? 'bg-gray-800/30 border border-dashed border-gray-700' : 'bg-gray-800/50'}`}
              >
                <div className="flex items-center px-3 py-1.5 gap-2">
                  {/* Name */}
                  <span
                    className={`flex-1 min-w-0 truncate ${item.isHidden ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                    title={item.description}
                  >
                    {item.name}
                    {item.dmNotes && (
                      <span className="text-red-400 ml-1" title={`DM: ${item.dmNotes}`}>
                        *
                      </span>
                    )}
                  </span>
                  {/* Price (with markup) */}
                  <span className="text-amber-400 shrink-0 w-20 text-right">
                    {formatPrice(markedUpPrice)}
                  </span>
                  {/* Weight */}
                  <span className="text-gray-500 shrink-0 w-10 text-right">
                    {item.weight ? `${item.weight}lb` : '-'}
                  </span>
                  {/* Category */}
                  <span className="text-gray-500 shrink-0 w-20 truncate">
                    {item.shopCategory ?? item.category}
                  </span>
                  {/* Rarity */}
                  <span
                    className={`shrink-0 w-16 truncate ${item.rarity ? RARITY_COLORS[item.rarity] : 'text-gray-600'}`}
                  >
                    {item.rarity ?? '-'}
                  </span>
                  {/* Stock */}
                  <span className="text-gray-400 shrink-0 w-12 text-right">{stock}</span>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingId(isEditing ? null : item.id)}
                      className="text-gray-500 hover:text-amber-400 cursor-pointer"
                      title="Edit"
                    >
                      {isEditing ? '\u2713' : '\u270E'}
                    </button>
                    <button
                      onClick={() => updateShopItem(item.id, { isHidden: !item.isHidden })}
                      className={`cursor-pointer ${item.isHidden ? 'text-red-400 hover:text-green-400' : 'text-gray-500 hover:text-red-400'}`}
                      title={item.isHidden ? 'Show to players' : 'Hide from players'}
                    >
                      {item.isHidden ? '\u25CB' : '\u25CF'}
                    </button>
                    <button
                      onClick={() => removeShopItem(item.id)}
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {/* Inline edit row */}
                {isEditing && (
                  <div className="px-3 pb-2 space-y-1.5 border-t border-gray-700/50 pt-1.5">
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Price (GP)</label>
                        <input
                          type="number"
                          defaultValue={item.price.gp ?? 0}
                          onBlur={(e) => {
                            const gp = Number.parseFloat(e.target.value) || 0
                            updateShopItem(item.id, { price: { ...item.price, gp } })
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Stock Limit</label>
                        <input
                          type="number"
                          defaultValue={item.stockLimit ?? ''}
                          placeholder="Unlimited"
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val === '') {
                              updateShopItem(item.id, {
                                stockLimit: undefined,
                                stockRemaining: undefined
                              })
                            } else {
                              const limit = Math.max(0, Number.parseInt(val, 10) || 0)
                              updateShopItem(item.id, {
                                stockLimit: limit,
                                stockRemaining: Math.min(item.stockRemaining ?? limit, limit)
                              })
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Quantity</label>
                        <input
                          type="number"
                          defaultValue={item.quantity}
                          onBlur={(e) => {
                            const qty = Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                            updateShopItem(item.id, { quantity: qty })
                          }}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Rarity</label>
                        <select
                          defaultValue={item.rarity ?? 'common'}
                          onChange={(e) =>
                            updateShopItem(item.id, { rarity: e.target.value as ShopItemRarity })
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-amber-500"
                        >
                          {RARITY_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">DM Notes (hidden from players)</label>
                      <input
                        type="text"
                        defaultValue={item.dmNotes ?? ''}
                        placeholder='e.g. "cursed", "stolen goods"'
                        onBlur={(e) =>
                          updateShopItem(item.id, { dmNotes: e.target.value.trim() || undefined })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[11px] text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
