import { useEffect, useState } from 'react'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { ArmorEntry, WeaponEntry } from '../../../types/character-common'
import { abilityModifier } from '../../../types/character-common'
import { deductWithConversion, totalInCopper } from '../../../utils/currency'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

// --- Types ---

interface CraftableItem {
  name: string
  rawMaterialCost: string
  craftingTimeDays: number
  category: 'weapon' | 'armor' | 'gear'
}

interface CraftingToolEntry {
  tool: string
  items: CraftableItem[]
}

// --- Weapon/Armor data from equipment.json for creating proper entries ---

interface WeaponData5e {
  name: string
  category: string
  damage: string
  damageType: string
  weight?: number
  properties: string[]
  cost: string
  mastery?: string
}

interface ArmorData5e {
  name: string
  category: string
  baseAC: number
  dexBonus: boolean
  dexBonusMax: number | null
  weight?: number
  stealthDisadvantage: boolean
  cost: string
  strengthRequirement?: number
}

interface EquipmentDatabase {
  weapons: WeaponData5e[]
  armor: ArmorData5e[]
}

// --- Multi-denomination cost parser ---

function parseCostToCopper(costStr: string): number {
  let total = 0
  const parts = costStr.match(/(\d+)\s*(PP|GP|EP|SP|CP)/gi)
  if (!parts) return 0
  const rates: Record<string, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 }
  for (const part of parts) {
    const m = part.match(/(\d+)\s*(PP|GP|EP|SP|CP)/i)
    if (m) {
      total += parseInt(m[1], 10) * (rates[m[2].toLowerCase()] ?? 0)
    }
  }
  return total
}

// --- Hooks ---

function useCraftingData(): CraftingToolEntry[] {
  const [data, setData] = useState<CraftingToolEntry[]>([])
  useEffect(() => {
    fetch('./data/5e/crafting.json')
      .then((r) => r.json())
      .then((d: CraftingToolEntry[]) => setData(d))
      .catch(() => {})
  }, [])
  return data
}

function useEquipmentDatabase(): EquipmentDatabase {
  const [db, setDb] = useState<EquipmentDatabase>({ weapons: [], armor: [] })
  useEffect(() => {
    fetch('./data/5e/equipment.json')
      .then((r) => r.json())
      .then((d) => setDb({ weapons: d.weapons ?? [], armor: d.armor ?? [] }))
      .catch(() => {})
  }, [])
  return db
}

// --- Helpers ---

function weaponDataToEntry(item: WeaponData5e, character: Character5e): WeaponEntry {
  const profBonus = Math.ceil(character.level / 4) + 1
  const isFinesse = item.properties.some((p) => p.toLowerCase() === 'finesse')
  const isRanged = item.category.toLowerCase().includes('ranged')
  const usesDex = isFinesse || isRanged
  const abilityScore = usesDex ? character.abilityScores.dexterity : character.abilityScores.strength
  const mod = abilityModifier(abilityScore)
  return {
    id: crypto.randomUUID(),
    name: item.name,
    damage: item.damage,
    damageType: item.damageType,
    attackBonus: mod + profBonus,
    properties: item.properties,
    proficient: true,
    range: isRanged
      ? item.properties.find((p) => p.toLowerCase().startsWith('range'))?.replace(/range\s*/i, '')
      : undefined,
    mastery: item.mastery
  }
}

function armorDataToEntry(a: ArmorData5e): ArmorEntry {
  const isShield = a.category.toLowerCase() === 'shield'
  return {
    id: crypto.randomUUID(),
    name: a.name,
    acBonus: a.baseAC,
    equipped: false,
    type: isShield ? 'shield' : 'armor',
    category: a.category.replace(' Armor', '').toLowerCase(),
    dexCap: a.dexBonus ? (a.dexBonusMax ?? null) : 0,
    stealthDisadvantage: a.stealthDisadvantage,
    strength: a.strengthRequirement
  }
}

// --- Main Component ---

interface CraftingSection5eProps {
  character: Character5e
  readonly?: boolean
}

export default function CraftingSection5e({ character, readonly }: CraftingSection5eProps): JSX.Element {
  const craftingData = useCraftingData()
  const equipmentDb = useEquipmentDatabase()

  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
  const [craftWarning, setCraftWarning] = useState<string | null>(null)
  const [craftSuccess, setCraftSuccess] = useState<string | null>(null)

  const toolProficiencies = character.proficiencies.tools ?? []
  const skills = character.skills ?? []
  const hasArcanaProficiency = skills.some((s) => s.name === 'Arcana' && s.proficient)
  const hasCalligrapherProficiency = toolProficiencies.some((t) => t.toLowerCase().includes('calligrapher'))
  const canCraftScrolls = hasArcanaProficiency || hasCalligrapherProficiency

  const normalizeToolName = (name: string): string =>
    name
      .replace(/\s*\(one of your choice\)|\s*\(any\)|\s*\(your choice\)/gi, '')
      .trim()
      .toLowerCase()

  const matchingTools = craftingData.filter((entry) =>
    toolProficiencies.some(
      (prof) =>
        normalizeToolName(prof) === entry.tool.toLowerCase() ||
        entry.tool.toLowerCase().startsWith(normalizeToolName(prof))
    )
  )

  // Spell scroll cost/time table per PHB 2024
  const SCROLL_COSTS: Record<number, { cost: number; days: number }> = {
    0: { cost: 15, days: 1 },
    1: { cost: 25, days: 1 },
    2: { cost: 100, days: 3 },
    3: { cost: 150, days: 5 },
    4: { cost: 1000, days: 10 },
    5: { cost: 1500, days: 25 },
    6: { cost: 10000, days: 40 },
    7: { cost: 12500, days: 50 },
    8: { cost: 15000, days: 60 },
    9: { cost: 50000, days: 120 }
  }

  const [scrollLevelFilter, setScrollLevelFilter] = useState<number | 'all'>('all')
  const [scrollExpanded, setScrollExpanded] = useState(false)

  const preparedSpells = character.knownSpells ?? []
  const filteredScrollSpells =
    scrollLevelFilter === 'all' ? preparedSpells : preparedSpells.filter((s) => s.level === scrollLevelFilter)

  const handleCraftScroll = (spell: { id: string; name: string; level: number }): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character

    const scrollInfo = SCROLL_COSTS[spell.level]
    if (!scrollInfo) return

    const costInCopper = scrollInfo.cost * 100
    const currentCurrency = {
      pp: latest.treasure.pp,
      gp: latest.treasure.gp,
      sp: latest.treasure.sp,
      cp: latest.treasure.cp
    }
    const totalAvailable = totalInCopper(currentCurrency)

    if (totalAvailable < costInCopper) {
      setCraftWarning(`Not enough funds for Spell Scroll of ${spell.name} (${scrollInfo.cost} GP)`)
      setTimeout(() => setCraftWarning(null), 4000)
      return
    }

    const newCurrency = deductWithConversion(currentCurrency, { amount: scrollInfo.cost, currency: 'gp' })
    if (!newCurrency) {
      setCraftWarning(`Not enough funds for Spell Scroll of ${spell.name}`)
      setTimeout(() => setCraftWarning(null), 4000)
      return
    }

    const scrollName =
      spell.level === 0
        ? `Spell Scroll of ${spell.name} (Cantrip)`
        : `Spell Scroll of ${spell.name} (Level ${spell.level})`

    const updated = {
      ...latest,
      equipment: [...latest.equipment, { name: scrollName, quantity: 1 }],
      treasure: { ...latest.treasure, ...newCurrency },
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)

    setCraftWarning(null)
    setCraftSuccess(`Crafted ${scrollName} successfully`)
    setTimeout(() => setCraftSuccess(null), 3000)
  }

  const broadcastIfDM = (updated: Character): void => {
    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated)
    }
  }

  const toggleTool = (tool: string): void => {
    setExpandedTools((prev) => ({ ...prev, [tool]: !prev[tool] }))
  }

  const handleCraft = (item: CraftableItem): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character

    // Calculate cost in copper from multi-denomination string
    const costInCopper = parseCostToCopper(item.rawMaterialCost)

    // Check if character can afford raw materials
    const currentCurrency = {
      pp: latest.treasure.pp,
      gp: latest.treasure.gp,
      sp: latest.treasure.sp,
      cp: latest.treasure.cp
    }
    const totalAvailable = totalInCopper(currentCurrency)

    if (totalAvailable < costInCopper) {
      setCraftWarning(`Not enough funds for ${item.name} raw materials`)
      setTimeout(() => setCraftWarning(null), 4000)
      return
    }

    // Deduct cost using the largest denomination that fits
    // Convert copper cost to a single denomination for deductWithConversion
    let deductDenom: 'gp' | 'sp' | 'cp' = 'cp'
    let deductAmount = costInCopper
    if (costInCopper >= 100 && costInCopper % 100 === 0) {
      deductDenom = 'gp'
      deductAmount = costInCopper / 100
    } else if (costInCopper >= 10 && costInCopper % 10 === 0) {
      deductDenom = 'sp'
      deductAmount = costInCopper / 10
    }

    const newCurrency = deductWithConversion(currentCurrency, {
      amount: deductAmount,
      currency: deductDenom
    })
    if (!newCurrency) {
      setCraftWarning(`Not enough funds for ${item.name} raw materials`)
      setTimeout(() => setCraftWarning(null), 4000)
      return
    }

    const updatedTreasure = { ...latest.treasure, ...newCurrency }

    // Create the appropriate item based on category
    if (item.category === 'weapon') {
      const weaponData = equipmentDb.weapons.find((w) => w.name.toLowerCase() === item.name.toLowerCase())
      if (weaponData) {
        const newWeapon = weaponDataToEntry(weaponData, latest as Character5e)
        const currentWeapons: WeaponEntry[] = latest.weapons ?? []
        const updated = {
          ...latest,
          weapons: [...currentWeapons, newWeapon],
          treasure: updatedTreasure,
          updatedAt: new Date().toISOString()
        } as Character
        useCharacterStore.getState().saveCharacter(updated)
        broadcastIfDM(updated)
      } else {
        // Fallback for weapons not in equipment.json (e.g., Net)
        const newWeapon: WeaponEntry = {
          id: crypto.randomUUID(),
          name: item.name,
          damage: '0',
          damageType: 'none',
          attackBonus: 0,
          properties: [],
          proficient: true
        }
        const currentWeapons: WeaponEntry[] = latest.weapons ?? []
        const updated = {
          ...latest,
          weapons: [...currentWeapons, newWeapon],
          treasure: updatedTreasure,
          updatedAt: new Date().toISOString()
        } as Character
        useCharacterStore.getState().saveCharacter(updated)
        broadcastIfDM(updated)
      }
    } else if (item.category === 'armor') {
      const armorData = equipmentDb.armor.find((a) => a.name.toLowerCase() === item.name.toLowerCase())
      if (armorData) {
        const newArmor = armorDataToEntry(armorData)
        const currentArmor: ArmorEntry[] = latest.armor ?? []
        const updated = {
          ...latest,
          armor: [...currentArmor, newArmor],
          treasure: updatedTreasure,
          updatedAt: new Date().toISOString()
        } as Character
        useCharacterStore.getState().saveCharacter(updated)
        broadcastIfDM(updated)
      } else {
        // Fallback for armor not in equipment.json
        const newArmor: ArmorEntry = {
          id: crypto.randomUUID(),
          name: item.name,
          acBonus: 0,
          equipped: false,
          type: 'armor'
        }
        const currentArmor: ArmorEntry[] = latest.armor ?? []
        const updated = {
          ...latest,
          armor: [...currentArmor, newArmor],
          treasure: updatedTreasure,
          updatedAt: new Date().toISOString()
        } as Character
        useCharacterStore.getState().saveCharacter(updated)
        broadcastIfDM(updated)
      }
    } else {
      // Gear - add to equipment array
      const newItem = { name: item.name, quantity: 1 }
      const updated = {
        ...latest,
        equipment: [...latest.equipment, newItem],
        treasure: updatedTreasure,
        updatedAt: new Date().toISOString()
      } as Character
      useCharacterStore.getState().saveCharacter(updated)
      broadcastIfDM(updated)
    }

    setCraftWarning(null)
    setCraftSuccess(`Crafted ${item.name} successfully`)
    setTimeout(() => setCraftSuccess(null), 3000)
  }

  const categoryLabel = (cat: string): string => {
    switch (cat) {
      case 'weapon':
        return 'Weapon'
      case 'armor':
        return 'Armor'
      case 'gear':
        return 'Gear'
      default:
        return cat
    }
  }

  const categoryColor = (cat: string): string => {
    switch (cat) {
      case 'weapon':
        return 'text-red-400 bg-red-900/30 border-red-700/50'
      case 'armor':
        return 'text-blue-400 bg-blue-900/30 border-blue-700/50'
      case 'gear':
        return 'text-green-400 bg-green-900/30 border-green-700/50'
      default:
        return 'text-gray-400 bg-gray-900/30 border-gray-700/50'
    }
  }

  if (matchingTools.length === 0 && !canCraftScrolls) {
    return (
      <SheetSectionWrapper title="Crafting" defaultOpen={false}>
        <p className="text-sm text-gray-500">
          No tool proficiencies. Learn a tool proficiency to unlock crafting recipes.
        </p>
      </SheetSectionWrapper>
    )
  }

  return (
    <SheetSectionWrapper title="Crafting" defaultOpen={false}>
      {/* Notifications */}
      {craftWarning && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 mb-2">
          {craftWarning}
        </div>
      )}
      {craftSuccess && (
        <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded px-2 py-1 mb-2">
          {craftSuccess}
        </div>
      )}

      {/* Tool proficiency summary */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {matchingTools.map((entry) => (
          <span
            key={entry.tool}
            className="inline-flex items-center bg-amber-900/30 text-amber-300 border border-amber-700/50 rounded-full px-2.5 py-0.5 text-xs"
          >
            {entry.tool}
          </span>
        ))}
      </div>

      {/* Collapsible sections per tool */}
      <div className="space-y-2">
        {matchingTools.map((entry) => {
          const isExpanded = expandedTools[entry.tool] ?? false
          return (
            <div key={entry.tool} className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTool(entry.tool)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium text-gray-200">{entry.tool}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {entry.items.length} recipe{entry.items.length !== 1 ? 's' : ''}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-700">
                  {entry.items.map((item, idx) => (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between px-3 py-2 text-sm ${
                        idx < entry.items.length - 1 ? 'border-b border-gray-800' : ''
                      } hover:bg-gray-900/30 transition-colors`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-200 font-medium truncate">{item.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColor(item.category)}`}>
                            {categoryLabel(item.category)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-amber-400">{item.rawMaterialCost}</span>
                          <span className="text-xs text-gray-500">
                            {item.craftingTimeDays} day{item.craftingTimeDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {!readonly && (
                        <button
                          onClick={() => handleCraft(item)}
                          className="ml-2 px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded text-white cursor-pointer transition-colors flex-shrink-0"
                        >
                          Craft
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Spell Scroll Crafting */}
      {canCraftScrolls && (
        <div className="mt-3">
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setScrollExpanded(!scrollExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-purple-300">Spell Scrolls</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {preparedSpells.length} spell{preparedSpells.length !== 1 ? 's' : ''} available
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-500 transition-transform ${scrollExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {scrollExpanded && (
              <div className="border-t border-gray-700">
                {/* Level filter */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
                  <span className="text-xs text-gray-500">Level:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setScrollLevelFilter('all')}
                      className={`px-2 py-0.5 text-xs rounded ${scrollLevelFilter === 'all' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      All
                    </button>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setScrollLevelFilter(lvl)}
                        className={`px-2 py-0.5 text-xs rounded ${scrollLevelFilter === lvl ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                      >
                        {lvl === 0 ? 'C' : lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredScrollSpells.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-500">No spells available at this level.</div>
                ) : (
                  filteredScrollSpells.map((spell, idx) => {
                    const scrollInfo = SCROLL_COSTS[spell.level]
                    if (!scrollInfo) return null
                    return (
                      <div
                        key={spell.id}
                        className={`flex items-center justify-between px-3 py-2 text-sm ${
                          idx < filteredScrollSpells.length - 1 ? 'border-b border-gray-800' : ''
                        } hover:bg-gray-900/30 transition-colors`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-200 font-medium truncate">{spell.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border text-purple-400 bg-purple-900/30 border-purple-700/50">
                              {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-amber-400">{scrollInfo.cost.toLocaleString()} GP</span>
                            <span className="text-xs text-gray-500">
                              {scrollInfo.days} day{scrollInfo.days !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        {!readonly && (
                          <button
                            onClick={() => handleCraftScroll(spell)}
                            className="ml-2 px-2.5 py-1 text-xs bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer transition-colors flex-shrink-0"
                          >
                            Craft
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SheetSectionWrapper>
  )
}
