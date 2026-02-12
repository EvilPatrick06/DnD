import { useEffect, useRef, useState } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'

function parseCost(costStr: string): { amount: number; currency: 'pp' | 'gp' | 'sp' | 'cp' } | null {
  const match = costStr.match(/^([\d,]+(?:\.\d+)?)\s*(pp|gp|sp|cp)$/i)
  if (!match) return null
  const amount = parseFloat(match[1].replace(',', ''))
  if (isNaN(amount)) return null
  return { amount, currency: match[2].toLowerCase() as 'pp' | 'gp' | 'sp' | 'cp' }
}

function totalInCopper(c: {pp: number; gp: number; sp: number; cp: number}): number {
  return c.pp * 1000 + c.gp * 100 + c.sp * 10 + c.cp
}

function deductWithConversion(
  currency: {pp: number; gp: number; sp: number; cp: number},
  cost: {amount: number; currency: 'pp'|'gp'|'sp'|'cp'}
): {pp: number; gp: number; sp: number; cp: number} | null {
  const rates = {pp: 1000, gp: 100, sp: 10, cp: 1} as const
  const costInCopper = cost.amount * rates[cost.currency]
  const totalCopper = totalInCopper(currency)
  if (totalCopper < costInCopper) return null

  // Greedy deduction from exact denomination first, then largest to smallest
  let remaining = costInCopper
  const result = { ...currency }

  const exactDeduct = Math.min(result[cost.currency], cost.amount)
  result[cost.currency] -= exactDeduct
  remaining -= exactDeduct * rates[cost.currency]

  for (const [key, rate] of [['pp', 1000], ['gp', 100], ['sp', 10], ['cp', 1]] as const) {
    if (remaining <= 0) break
    const canDeduct = Math.min(result[key], Math.floor(remaining / rate))
    result[key] -= canDeduct
    remaining -= canDeduct * rate
  }

  // Handle change-making if we overdeducted from a larger denomination
  if (remaining > 0) {
    for (const [key, rate] of [['pp', 1000], ['gp', 100], ['sp', 10], ['cp', 1]] as const) {
      if (remaining <= 0) break
      if (result[key] > 0 && rate > remaining) {
        result[key] -= 1
        let change = rate - remaining
        remaining = 0
        // Give change in largest denominations possible
        for (const [changeKey, changeRate] of [['gp', 100], ['sp', 10], ['cp', 1]] as const) {
          if (change <= 0) break
          if (changeRate < rate) {
            const coins = Math.floor(change / changeRate)
            result[changeKey] += coins
            change -= coins * changeRate
          }
        }
      }
    }
    if (remaining > 0) return null
  }

  return result
}

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

const CURRENCY_CONFIG = [
  { key: 'pp' as const, label: 'PP', fullName: 'Platinum', ring: 'border-gray-400', bg: 'bg-gray-500', text: 'text-gray-100' },
  { key: 'gp' as const, label: 'GP', fullName: 'Gold', ring: 'border-yellow-500', bg: 'bg-yellow-600', text: 'text-yellow-100' },
  { key: 'sp' as const, label: 'SP', fullName: 'Silver', ring: 'border-gray-300', bg: 'bg-gray-300', text: 'text-gray-800' },
  { key: 'cp' as const, label: 'CP', fullName: 'Copper', ring: 'border-amber-700', bg: 'bg-amber-700', text: 'text-amber-100' }
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
    if (!isNaN(parsed) && parsed >= 0) {
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
      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
        {config.fullName}
      </span>
    </div>
  )
}

// Equipment data types from equipment.json
interface WeaponData {
  name: string
  category: string
  damage: string
  damageType: string
  weight: number
  properties: string[]
  cost: string
}

interface ArmorData {
  name: string
  category: string
  baseAC: number
  dexBonus: boolean
  dexBonusMax: number | null
  weight: number
  stealthDisadvantage: boolean
  cost: string
  strengthRequirement?: number
}

interface GearData {
  name: string
  category: string
  weight: number
  cost: string
  description: string
}

interface EquipmentDatabase {
  weapons: WeaponData[]
  armor: ArmorData[]
  gear: GearData[]
}

function useEquipmentDatabase(gameSystem: string | null): EquipmentDatabase | null {
  const [db, setDb] = useState<EquipmentDatabase | null>(null)
  useEffect(() => {
    const path = gameSystem === 'pf2e' ? './data/pf2e/equipment.json' : './data/5e/equipment.json'
    fetch(path)
      .then((r) => r.json())
      .then((data) => setDb(data))
      .catch(() => {})
  }, [gameSystem])
  return db
}

function lookupItem(db: EquipmentDatabase | null, name: string): { type: 'weapon'; data: WeaponData } | { type: 'armor'; data: ArmorData } | { type: 'gear'; data: GearData } | null {
  if (!db) return null
  const lowerName = name.toLowerCase()

  const weapon = db.weapons.find((w) => w.name.toLowerCase() === lowerName)
  if (weapon) return { type: 'weapon', data: weapon }

  const armor = db.armor.find((a) => a.name.toLowerCase() === lowerName)
  if (armor) return { type: 'armor', data: armor }

  const gear = db.gear.find((g) => g.name.toLowerCase() === lowerName)
  if (gear) return { type: 'gear', data: gear }

  // Fuzzy match: check if item name contains or is contained by db entry name
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
    return (
      <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
        <div className="flex gap-4">
          <span><span className="text-gray-500">Damage:</span> <span className="text-red-400 font-medium">{w.damage} {w.damageType}</span></span>
          <span><span className="text-gray-500">Type:</span> {w.category}</span>
        </div>
        <div className="flex gap-4">
          <span><span className="text-gray-500">Weight:</span> {w.weight} lb.</span>
          <span><span className="text-gray-500">Cost:</span> {w.cost}</span>
        </div>
        {w.properties.length > 0 && (
          <div><span className="text-gray-500">Properties:</span> {w.properties.join(', ')}</div>
        )}
      </div>
    )
  }

  if (item.type === 'armor') {
    try {
      const a = item.data as unknown as Record<string, unknown>
      if ('dexBonus' in a || 'baseAC' in a) {
        // 5e armor
        const baseAC = a.baseAC as number
        const dexBonus = a.dexBonus as boolean
        const dexBonusMax = a.dexBonusMax as number | null
        const acStr = dexBonus
          ? dexBonusMax !== null ? `${baseAC} + DEX (max ${dexBonusMax})` : `${baseAC} + DEX`
          : `${baseAC}`
        return (
          <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
            <div className="flex gap-4">
              <span><span className="text-gray-500">AC:</span> <span className="text-blue-400 font-medium">{acStr}</span></span>
              <span><span className="text-gray-500">Type:</span> {a.category as string}</span>
            </div>
            <div className="flex gap-4">
              <span><span className="text-gray-500">Weight:</span> {a.weight as number} lb.</span>
              <span><span className="text-gray-500">Cost:</span> {a.cost as string}</span>
            </div>
            {!!a.stealthDisadvantage && <div className="text-yellow-500">Stealth Disadvantage</div>}
            {!!a.strengthRequirement && <div><span className="text-gray-500">Str Required:</span> {String(a.strengthRequirement)}</div>}
          </div>
        )
      } else {
        // PF2e armor
        const acBonus = a.acBonus as number ?? 0
        const dexCap = a.dexCap as number | undefined
        const traits = a.traits as string[] | undefined
        const strength = a.strength as number | undefined
        const group = a.group as string | undefined
        const price = (a.price ?? a.cost ?? '') as string
        const bulk = a.bulk as string | number | undefined
        return (
          <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
            <div className="flex gap-4">
              <span><span className="text-gray-500">AC:</span> <span className="text-blue-400 font-medium">+{acBonus}</span></span>
              {dexCap !== undefined && <span><span className="text-gray-500">Dex Cap:</span> +{dexCap}</span>}
              <span><span className="text-gray-500">Type:</span> {a.category as string}</span>
            </div>
            <div className="flex gap-4">
              {bulk !== undefined && <span><span className="text-gray-500">Bulk:</span> {bulk}</span>}
              <span><span className="text-gray-500">Price:</span> {price}</span>
            </div>
            {group && <div><span className="text-gray-500">Group:</span> {group}</div>}
            {strength !== undefined && strength > 0 && <div><span className="text-gray-500">Str Required:</span> {strength}</div>}
            {traits && traits.length > 0 && <div><span className="text-gray-500">Traits:</span> {traits.join(', ')}</div>}
          </div>
        )
      }
    } catch {
      return <div className="px-2 py-1.5 text-xs text-gray-400">Details unavailable</div>
    }
  }

  // Gear / fallback
  try {
    const g = item.data
    return (
      <div className="px-2 py-1.5 space-y-1 text-xs text-gray-400">
        <div>{g.description}</div>
        <div className="flex gap-4">
          <span><span className="text-gray-500">Weight:</span> {g.weight} lb.</span>
          <span><span className="text-gray-500">Cost:</span> {g.cost}</span>
        </div>
      </div>
    )
  } catch {
    return <div className="px-2 py-1.5 text-xs text-gray-400">Details unavailable</div>
  }
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
        className="flex items-center justify-between py-1.5 px-2 rounded text-sm text-gray-300 hover:bg-gray-800/60 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
          <span className="truncate">{item.name}</span>
          {item.quantity > 1 && (
            <span className="text-xs text-gray-500 font-medium">x{item.quantity}</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-gray-600 hover:text-red-400 transition-colors ml-2 shrink-0 text-xs px-1"
          title="Remove item"
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
    const props = (w as unknown as Record<string, unknown>).traits as string[] | undefined ?? w.properties ?? []
    const cost = w.cost ?? (w as unknown as Record<string, unknown>).price as string ?? ''
    items.push({
      name: w.name,
      type: 'weapon',
      category: w.category,
      cost,
      detail: `${w.damage} ${w.damageType}${props.length > 0 ? ' | ' + props.join(', ') : ''}`
    })
  }
  for (const a of db.armor) {
    const cost = a.cost ?? (a as unknown as Record<string, unknown>).price as string ?? ''
    if ('dexBonus' in a) {
      const acStr = a.dexBonus
        ? a.dexBonusMax !== null ? `AC ${a.baseAC} + DEX (max ${a.dexBonusMax})` : `AC ${a.baseAC} + DEX`
        : `AC ${a.baseAC}`
      items.push({ name: a.name, type: 'armor', category: a.category, cost, detail: acStr })
    } else {
      const armorAny = a as unknown as Record<string, unknown>
      const acBonus = armorAny.acBonus as number | undefined ?? 0
      items.push({ name: String(armorAny.name ?? ''), type: 'armor', category: String(armorAny.category ?? ''), cost, detail: `AC +${acBonus}` })
    }
  }
  for (const g of db.gear) {
    items.push({
      name: g.name,
      type: 'gear',
      category: g.category,
      cost: g.cost ?? (g as unknown as Record<string, unknown>).price as string ?? '',
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

  const shopItems = buildShopItems(equipDb)
  const filtered = shopItems.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    }
    return true
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

      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 italic px-3 py-4 text-center">No items match your search.</p>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={`${item.type}-${item.name}-${idx}`}
              className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 last:border-b-0 hover:bg-gray-800/40"
            >
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
          ))
        )}
      </div>
    </div>
  )
}

export default function GearTab(): JSX.Element {
  const classEquipment = useBuilderStore((s) => s.classEquipment)
  const bgEquipment = useBuilderStore((s) => s.bgEquipment)
  const currency = useBuilderStore((s) => s.currency)
  const setCurrency = useBuilderStore((s) => s.setCurrency)
  const removeEquipmentItem = useBuilderStore((s) => s.removeEquipmentItem)
  const addEquipmentItem = useBuilderStore((s) => s.addEquipmentItem)
  const gameSystem = useBuilderStore((s) => s.gameSystem)

  const deductCurrency = useBuilderStore((s) => s.deductCurrency)
  const equipDb = useEquipmentDatabase(gameSystem)
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
        const costCp = cost.amount * ({pp: 1000, gp: 100, sp: 10, cp: 1}[cost.currency])
        setShopWarning(`Not enough funds (need ${cost.amount} ${cost.currency.toUpperCase()} = ${costCp} cp, have ${totalCp} cp total)`)
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
          <EquipmentShop
            equipDb={equipDb}
            onAdd={handleAddFromShop}
            onClose={() => setShowShop(false)}
          />
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
          <p className="text-sm text-gray-500 italic">
            Select a class and background to see starting equipment.
          </p>
        )}
      </div>
    </div>
  )
}
