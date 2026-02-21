import { useEffect, useState } from 'react'
import { load5eEquipment } from '../../../services/data-provider'
import { DAMAGE_TYPE_LABELS } from '../../../constants/damage-types'
import { CONDITIONS_5E } from '../../../data/conditions'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { ArmorEntry, Currency } from '../../../types/character-common'
import { addCurrency, computeSellPrice, deductWithConversion, parseCost, totalInCopper } from '../../../utils/currency'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

// --- Armor data types matching equipment.json ---

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

function useArmorDatabase(): ArmorData5e[] {
  const [armorList, setArmorList] = useState<ArmorData5e[]>([])
  useEffect(() => {
    load5eEquipment()
      .then((data) => setArmorList((data.armor as unknown as ArmorData5e[]) ?? []))
      .catch(() => {})
  }, [])
  return armorList
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
    strength: a.strengthRequirement,
    cost: a.cost
  }
}

function getArmorDetail(a: ArmorData5e): string {
  const isShield = a.category.toLowerCase() === 'shield'
  const acStr = isShield
    ? `+${a.baseAC} AC`
    : a.dexBonus
      ? a.dexBonusMax !== null
        ? `AC ${a.baseAC} + DEX (max ${a.dexBonusMax})`
        : `AC ${a.baseAC} + DEX`
      : `AC ${a.baseAC}`
  const parts = [acStr, a.category]
  if (a.stealthDisadvantage) parts.push('Stealth disadv.')
  if (a.strengthRequirement) parts.push(`Str ${a.strengthRequirement}`)
  return parts.join(' | ')
}

// --- Damage types and conditions for inline pickers ---

const DAMAGE_TYPES = DAMAGE_TYPE_LABELS

const CONDITION_IMMUNITIES = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
]

const DAMAGE_TYPE_DESCRIPTIONS: Record<string, string> = {
  acid: 'Corrosive substances dissolve flesh and materials. Dealt by spells like Acid Splash and black dragon breath.',
  cold: 'Frigid chill of ice and arctic environments. Dealt by spells like Cone of Cold and white dragon breath.',
  fire: 'Flames and intense heat. Dealt by spells like Fireball and red dragon breath.',
  force:
    'Pure magical energy. Dealt by spells like Eldritch Blast and Magic Missile. Few creatures resist force damage.',
  lightning: 'Electrical energy. Dealt by spells like Lightning Bolt and blue dragon breath.',
  necrotic: 'Life-draining energy. Dealt by spells like Blight and certain undead attacks.',
  poison:
    'Venomous and toxic substances. Dealt by spells like Poison Spray and green dragon breath. Many creatures are resistant or immune.',
  psychic:
    'Mental assault that disrupts the mind. Dealt by spells like Psychic Lance, often bypassing physical defenses.',
  radiant: 'Searing light and divine energy. Dealt by spells like Guiding Bolt and Sacred Flame.',
  thunder: 'Concussive bursts of sound. Dealt by spells like Thunderwave and Shatter.',
  bludgeoning:
    'Blunt-force impacts from hammers, falling, and constriction. Resistance often specifies nonmagical attacks only.',
  piercing: 'Puncturing attacks from arrows, fangs, and spears. Resistance often specifies nonmagical attacks only.',
  slashing: 'Cutting attacks from swords, axes, and claws. Resistance often specifies nonmagical attacks only.'
}

function getConditionDescriptions(): Record<string, string> {
  return Object.fromEntries(CONDITIONS_5E.map((c) => [c.name.toLowerCase(), c.description]))
}

// --- Tool description hook ---

interface ToolData {
  name: string
  description?: string
  ability?: string
}

function useToolDescriptions(): ToolData[] {
  const [tools, setTools] = useState<ToolData[]>([])
  useEffect(() => {
    load5eEquipment()
      .then((data) => {
        const gear = data.gear ?? []
        setTools((gear as unknown as Array<{ category?: string } & ToolData>).filter((g) => g.category === 'Tool'))
      })
      .catch(() => {})
  }, [])
  return tools
}

// --- Generic tool variant helpers ---

const GENERIC_TOOL_VARIANTS: Record<string, string[]> = {
  'gaming set': [
    'Gaming Set (Dice)',
    'Gaming Set (Dragonchess)',
    'Gaming Set (Playing Cards)',
    'Gaming Set (Three-Dragon Ante)'
  ],
  'musical instrument': ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Horn', 'Lute', 'Lyre', 'Pan Flute', 'Shawm', 'Viol']
}

function isGenericTool(name: string): boolean {
  const lower = name.toLowerCase().replace(/\s*\(.*\)/, '')
  return Object.keys(GENERIC_TOOL_VARIANTS).some((k) => lower.includes(k))
}

function getGenericToolBase(name: string): string | null {
  const lower = name.toLowerCase().replace(/\s*\(.*\)/, '')
  for (const key of Object.keys(GENERIC_TOOL_VARIANTS)) {
    if (lower.includes(key)) return key
  }
  return null
}

interface DefenseSection5eProps {
  character: Character5e
  readonly?: boolean
}

export default function DefenseSection5e({ character, readonly }: DefenseSection5eProps): JSX.Element {
  const toggleArmorEquipped = useCharacterStore((s) => s.toggleArmorEquipped)
  const [showAddArmor, setShowAddArmor] = useState(false)
  const [showCustomArmor, setShowCustomArmor] = useState(false)
  const [selectedArmorIdx, setSelectedArmorIdx] = useState<number>(-1)
  const [buyWarning, setBuyWarning] = useState<string | null>(null)
  const [customForm, setCustomForm] = useState({
    name: '',
    acBonus: '',
    type: 'armor' as 'armor' | 'shield' | 'clothing',
    category: '',
    cost: ''
  })
  const [customCostError, setCustomCostError] = useState<string | null>(null)
  const [showDefenseAdder, setShowDefenseAdder] = useState<null | 'resistance' | 'immunity' | 'vulnerability'>(null)
  const [customDefenseInput, setCustomDefenseInput] = useState('')
  const [expandedDefense, setExpandedDefense] = useState<string | null>(null)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [showToolVariantPicker, setShowToolVariantPicker] = useState<string | null>(null)
  const [showAddArmorProf, setShowAddArmorProf] = useState(false)
  const [showAddToolProf, setShowAddToolProf] = useState(false)
  const [customProfInput, setCustomProfInput] = useState('')

  const armorDatabase = useArmorDatabase()
  const toolDescriptions = useToolDescriptions()
  const CONDITION_DESCRIPTIONS = getConditionDescriptions()

  const armor: ArmorEntry[] = character.armor ?? []
  const equippedArmor = armor.find((a) => a.equipped && a.type === 'armor')
  const equippedShield = armor.find((a) => a.equipped && a.type === 'shield')

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

  const addProficiency = (field: 'armor' | 'tools', value: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || latest.gameSystem !== 'dnd5e') return
    const l = latest as Character5e
    if (l.proficiencies[field].includes(value)) return
    const updated = {
      ...l,
      proficiencies: { ...l.proficiencies, [field]: [...l.proficiencies[field], value] },
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleBuyArmor = (): void => {
    if (selectedArmorIdx < 0 || selectedArmorIdx >= armorDatabase.length) return

    const armorItem = armorDatabase[selectedArmorIdx]
    const cost = parseCost(armorItem.cost)

    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return

    const treasure = latest.treasure as Currency
    const currentCurrency = { pp: treasure.pp, gp: treasure.gp, sp: treasure.sp, cp: treasure.cp }

    let newCurrency = currentCurrency
    if (cost && cost.amount > 0) {
      const result = deductWithConversion(currentCurrency, cost)
      if (!result) {
        const totalCp = totalInCopper(currentCurrency)
        const rates = { pp: 1000, gp: 100, sp: 10, cp: 1 } as const
        const costCp = cost.amount * rates[cost.currency]
        setBuyWarning(
          `Not enough funds (need ${cost.amount} ${cost.currency.toUpperCase()} = ${costCp} cp, have ${totalCp} cp total)`
        )
        setTimeout(() => setBuyWarning(null), 4000)
        return
      }
      newCurrency = result
    }

    const newArmor = armorDataToEntry(armorItem)
    const currentArmor: ArmorEntry[] = latest.armor ?? []
    const updatedTreasure = {
      ...treasure,
      pp: newCurrency.pp,
      gp: newCurrency.gp,
      sp: newCurrency.sp,
      cp: newCurrency.cp
    }

    const updated = {
      ...latest,
      armor: [...currentArmor, newArmor],
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character

    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setSelectedArmorIdx(-1)
    setShowAddArmor(false)
    setBuyWarning(null)
  }

  const handleRemoveArmor = (armorId: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentArmor: ArmorEntry[] = latest.armor ?? []
    const updated = {
      ...latest,
      armor: currentArmor.filter((a) => a.id !== armorId),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleSellArmor = (armorId: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentArmor: ArmorEntry[] = latest.armor ?? []
    const armorItem = currentArmor.find((a) => a.id === armorId)
    if (!armorItem) return

    let costStr = armorItem.cost
    if (!costStr) {
      const dbArmor = armorDatabase.find((a) => a.name.toLowerCase() === armorItem.name.toLowerCase())
      if (dbArmor) costStr = dbArmor.cost
    }

    let updatedTreasure = latest.treasure
    if (costStr) {
      const sellPrice = computeSellPrice(costStr)
      if (sellPrice) {
        const currentCurrency = {
          pp: latest.treasure.pp,
          gp: latest.treasure.gp,
          sp: latest.treasure.sp,
          cp: latest.treasure.cp
        }
        updatedTreasure = { ...latest.treasure, ...addCurrency(currentCurrency, sellPrice) }
      }
    }

    const updated = {
      ...latest,
      armor: currentArmor.filter((a) => a.id !== armorId),
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddCustomArmor = (): void => {
    if (!customForm.name.trim()) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return

    let updatedTreasure = latest.treasure
    const costStr = customForm.cost.trim()
    if (costStr) {
      const cost = parseCost(costStr)
      if (cost && cost.amount > 0) {
        const currentCurrency = {
          pp: latest.treasure.pp,
          gp: latest.treasure.gp,
          sp: latest.treasure.sp,
          cp: latest.treasure.cp
        }
        const newCurrency = deductWithConversion(currentCurrency, cost)
        if (!newCurrency) {
          setCustomCostError('Not enough funds')
          setTimeout(() => setCustomCostError(null), 3000)
          return
        }
        updatedTreasure = { ...latest.treasure, ...newCurrency }
      }
    }

    const newArmor: ArmorEntry = {
      id: crypto.randomUUID(),
      name: customForm.name.trim(),
      acBonus: parseInt(customForm.acBonus, 10) || 0,
      equipped: false,
      type: customForm.type,
      category: customForm.category.trim() || undefined,
      cost: customForm.cost.trim() || undefined
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
    setCustomForm({ name: '', acBonus: '', type: 'armor', category: '', cost: '' })
    setCustomCostError(null)
    setShowCustomArmor(false)
  }

  return (
    <SheetSectionWrapper title="Defense">
      {/* AC Breakdown */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Armor Class</div>
          <div className="text-xl font-bold text-amber-400">{character.armorClass}</div>
        </div>

        {equippedArmor ? (
          <div className="bg-gray-800/50 rounded p-2 text-sm mb-2">
            <div className="flex justify-between">
              <span className="text-gray-300 font-medium">{equippedArmor.name}</span>
              <span className="text-gray-400">+{equippedArmor.acBonus} AC</span>
            </div>
            {equippedArmor.category && (
              <span className="text-xs text-gray-500 capitalize">{equippedArmor.category} armor</span>
            )}
            {equippedArmor.stealthDisadvantage && (
              <span className="text-xs text-yellow-500 ml-2">Stealth disadvantage</span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-2">
            {(() => {
              const cNames = character.classes.map((c) => c.name.toLowerCase())
              if (cNames.includes('barbarian')) return 'Unarmored Defense (10 + DEX + CON)'
              if (cNames.includes('monk') && !equippedShield) return 'Unarmored Defense (10 + DEX + WIS)'
              const isDracSorc = character.classes.some(
                (c) =>
                  c.name.toLowerCase() === 'sorcerer' &&
                  c.subclass?.toLowerCase().replace(/\s+/g, '-') === 'draconic-sorcery'
              )
              if (isDracSorc) return 'Draconic Resilience (10 + DEX + CHA)'
              return 'Unarmored (10 + DEX)'
            })()}
          </div>
        )}

        {equippedShield && (
          <div className="bg-gray-800/50 rounded p-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300 font-medium">{equippedShield.name}</span>
              <span className="text-amber-400 font-semibold">Shield: +{equippedShield.acBonus} AC</span>
            </div>
          </div>
        )}
      </div>

      {/* All armor items with equip toggle */}
      {armor.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Armor Inventory</div>
          <div className="space-y-1">
            {armor.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-sm">
                <div className="flex items-center gap-2">
                  {!readonly && (
                    <button
                      onClick={() => toggleArmorEquipped(character.id, a.id)}
                      className={`w-4 h-4 rounded border cursor-pointer transition-colors ${
                        a.equipped ? 'bg-amber-500 border-amber-400' : 'border-gray-600 hover:border-gray-400'
                      }`}
                      title={a.equipped ? 'Unequip' : 'Equip'}
                    />
                  )}
                  <span className={a.equipped ? 'text-gray-200' : 'text-gray-500'}>{a.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>+{a.acBonus} AC</span>
                  <span className="capitalize">{a.type}</span>
                  {!readonly && (
                    <button
                      onClick={() => handleSellArmor(a.id)}
                      className="text-gray-600 hover:text-green-400 cursor-pointer"
                      title="Sell (half price)"
                    >
                      &#x24;
                    </button>
                  )}
                  {!readonly && (
                    <button
                      onClick={() => handleRemoveArmor(a.id)}
                      className="text-gray-600 hover:text-red-400 cursor-pointer ml-1"
                      title="Remove armor"
                    >
                      &#x2715;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Armor */}
      {!readonly && !showAddArmor && !showCustomArmor && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowCustomArmor(true)}
            className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Custom
          </button>
          <button
            onClick={() => setShowAddArmor(true)}
            className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Shop
          </button>
        </div>
      )}

      {/* SRD armor browser */}
      {!readonly && showAddArmor && (
        <div className="mb-3">
          <div className="bg-gray-800/50 rounded p-3 space-y-2">
            <div className="text-xs text-gray-400 font-medium mb-1">Armor Shop</div>
            <select
              value={selectedArmorIdx}
              onChange={(e) => {
                setSelectedArmorIdx(parseInt(e.target.value, 10))
                setBuyWarning(null)
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value={-1}>-- Select armor --</option>
              {armorDatabase.map((item, idx) => (
                <option key={idx} value={idx}>
                  {item.name} ({item.cost || 'free'})
                </option>
              ))}
            </select>
            {selectedArmorIdx >= 0 && selectedArmorIdx < armorDatabase.length && (
              <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-2">
                {getArmorDetail(armorDatabase[selectedArmorIdx])}
              </div>
            )}
            {buyWarning && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                {buyWarning}
              </div>
            )}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleBuyArmor}
                disabled={selectedArmorIdx < 0}
                className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white cursor-pointer"
              >
                Buy
              </button>
              <button
                onClick={() => {
                  setShowAddArmor(false)
                  setBuyWarning(null)
                  setSelectedArmorIdx(-1)
                }}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom armor form */}
      {!readonly && showCustomArmor && (
        <div className="mb-3">
          <div className="bg-gray-800/50 rounded p-3 space-y-2">
            <div className="text-xs text-gray-400 font-medium mb-1">Custom Armor</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name"
                value={customForm.name}
                onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="AC Bonus"
                value={customForm.acBonus}
                onChange={(e) => setCustomForm((f) => ({ ...f, acBonus: e.target.value }))}
                className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={customForm.type}
                onChange={(e) =>
                  setCustomForm((f) => ({ ...f, type: e.target.value as 'armor' | 'shield' | 'clothing' }))
                }
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              >
                <option value="armor">Armor</option>
                <option value="shield">Shield</option>
                <option value="clothing">Clothing/Wearable</option>
              </select>
              <input
                type="text"
                placeholder="Category (e.g. heavy)"
                value={customForm.category}
                onChange={(e) => setCustomForm((f) => ({ ...f, category: e.target.value }))}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Cost (e.g. 50 gp)"
                value={customForm.cost}
                onChange={(e) => {
                  setCustomForm((f) => ({ ...f, cost: e.target.value }))
                  setCustomCostError(null)
                }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            {customCostError && <div className="text-xs text-red-400">{customCostError}</div>}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleAddCustomArmor}
                disabled={!customForm.name.trim()}
                className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowCustomArmor(false)
                  setCustomCostError(null)
                }}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resistances, Immunities & Vulnerabilities */}
      {(character.resistances?.length > 0 ||
        character.immunities?.length > 0 ||
        character.vulnerabilities?.length > 0) && (
        <div className="mb-3 space-y-2">
          {(character.resistances ?? []).length > 0 && (
            <div>
              <div className="text-[10px] text-blue-400 uppercase tracking-wide mb-1">Resistances</div>
              <div className="flex flex-wrap gap-1.5">
                {(character.resistances ?? []).map((r) => {
                  const key = `res-${r}`
                  const desc = DAMAGE_TYPE_DESCRIPTIONS[r.toLowerCase()] || CONDITION_DESCRIPTIONS[r.toLowerCase()]
                  const isExpanded = expandedDefense === key
                  return (
                    <div key={key} className="inline-flex flex-col">
                      <button
                        onClick={() => desc && setExpandedDefense(isExpanded ? null : key)}
                        className={`inline-flex items-center bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded-full px-2 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-blue-900/60' : ''}`}
                      >
                        {r}
                        {desc && <span className="ml-1 text-blue-500 text-[10px]">{isExpanded ? '\u25B4' : '?'}</span>}
                        {!readonly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest) return
                              const updated = {
                                ...latest,
                                resistances: (latest.resistances ?? []).filter((x) => x !== r),
                                updatedAt: new Date().toISOString()
                              } as Character
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="ml-1 text-blue-400 hover:text-red-400 cursor-pointer"
                          >
                            &#x2715;
                          </button>
                        )}
                      </button>
                      {isExpanded && desc && (
                        <div className="text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                          {desc}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {(character.immunities ?? []).length > 0 && (
            <div>
              <div className="text-[10px] text-green-400 uppercase tracking-wide mb-1">Immunities</div>
              <div className="flex flex-wrap gap-1.5">
                {(character.immunities ?? []).map((im) => {
                  const key = `imm-${im}`
                  const desc = DAMAGE_TYPE_DESCRIPTIONS[im.toLowerCase()] || CONDITION_DESCRIPTIONS[im.toLowerCase()]
                  const isExpanded = expandedDefense === key
                  return (
                    <div key={key} className="inline-flex flex-col">
                      <button
                        onClick={() => desc && setExpandedDefense(isExpanded ? null : key)}
                        className={`inline-flex items-center bg-green-900/40 text-green-300 border border-green-700/50 rounded-full px-2 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-green-900/60' : ''}`}
                      >
                        {im}
                        {desc && <span className="ml-1 text-green-500 text-[10px]">{isExpanded ? '\u25B4' : '?'}</span>}
                        {!readonly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest) return
                              const updated = {
                                ...latest,
                                immunities: (latest.immunities ?? []).filter((x) => x !== im),
                                updatedAt: new Date().toISOString()
                              } as Character
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="ml-1 text-green-400 hover:text-red-400 cursor-pointer"
                          >
                            &#x2715;
                          </button>
                        )}
                      </button>
                      {isExpanded && desc && (
                        <div className="text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                          {desc}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {(character.vulnerabilities ?? []).length > 0 && (
            <div>
              <div className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Vulnerabilities</div>
              <div className="flex flex-wrap gap-1.5">
                {(character.vulnerabilities ?? []).map((v) => {
                  const key = `vuln-${v}`
                  const desc = DAMAGE_TYPE_DESCRIPTIONS[v.toLowerCase()] || CONDITION_DESCRIPTIONS[v.toLowerCase()]
                  const isExpanded = expandedDefense === key
                  return (
                    <div key={key} className="inline-flex flex-col">
                      <button
                        onClick={() => desc && setExpandedDefense(isExpanded ? null : key)}
                        className={`inline-flex items-center bg-red-900/40 text-red-300 border border-red-700/50 rounded-full px-2 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-red-900/60' : ''}`}
                      >
                        {v}
                        {desc && <span className="ml-1 text-red-500 text-[10px]">{isExpanded ? '\u25B4' : '?'}</span>}
                        {!readonly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest) return
                              const updated = {
                                ...latest,
                                vulnerabilities: ((latest as Character5e).vulnerabilities ?? []).filter((x) => x !== v),
                                updatedAt: new Date().toISOString()
                              } as Character
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="ml-1 text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            &#x2715;
                          </button>
                        )}
                      </button>
                      {isExpanded && desc && (
                        <div className="text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                          {desc}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Resistance/Immunity/Vulnerability buttons */}
      {!readonly && !showDefenseAdder && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowDefenseAdder('resistance')}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            + Resistance
          </button>
          <button
            onClick={() => setShowDefenseAdder('immunity')}
            className="text-xs text-green-400 hover:text-green-300 cursor-pointer"
          >
            + Immunity
          </button>
          <button
            onClick={() => setShowDefenseAdder('vulnerability')}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
          >
            + Vulnerability
          </button>
        </div>
      )}

      {/* Inline defense adder */}
      {!readonly && showDefenseAdder && (
        <div className="mb-3 bg-gray-800/50 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium uppercase tracking-wide ${
                showDefenseAdder === 'resistance'
                  ? 'text-blue-400'
                  : showDefenseAdder === 'immunity'
                    ? 'text-green-400'
                    : 'text-red-400'
              }`}
            >
              Add {showDefenseAdder}
            </span>
            <button
              onClick={() => {
                setShowDefenseAdder(null)
                setCustomDefenseInput('')
              }}
              className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="text-[10px] text-gray-500 mb-1">Damage Types</div>
          <div className="flex flex-wrap gap-1">
            {DAMAGE_TYPES.map((dt) => (
              <button
                key={dt}
                onClick={() => {
                  const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                  if (!latest) return
                  const field =
                    showDefenseAdder === 'resistance'
                      ? 'resistances'
                      : showDefenseAdder === 'immunity'
                        ? 'immunities'
                        : 'vulnerabilities'
                  const current =
                    showDefenseAdder === 'vulnerability'
                      ? ((latest as Character5e).vulnerabilities ?? [])
                      : (latest[field as 'resistances' | 'immunities'] ?? [])
                  if (current.includes(dt)) return
                  const updated = {
                    ...latest,
                    [field]: [...current, dt],
                    updatedAt: new Date().toISOString()
                  } as Character
                  useCharacterStore.getState().saveCharacter(updated)
                  broadcastIfDM(updated)
                  setShowDefenseAdder(null)
                  setCustomDefenseInput('')
                }}
                className={`px-2 py-0.5 text-[11px] rounded border cursor-pointer transition-colors ${
                  showDefenseAdder === 'resistance'
                    ? 'border-blue-700/50 text-blue-300 hover:bg-blue-900/40'
                    : showDefenseAdder === 'immunity'
                      ? 'border-green-700/50 text-green-300 hover:bg-green-900/40'
                      : 'border-red-700/50 text-red-300 hover:bg-red-900/40'
                }`}
              >
                {dt}
              </button>
            ))}
          </div>
          {showDefenseAdder === 'immunity' && (
            <>
              <div className="text-[10px] text-gray-500 mt-2 mb-1">Condition Immunities</div>
              <div className="flex flex-wrap gap-1">
                {CONDITION_IMMUNITIES.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => {
                      const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                      if (!latest) return
                      const current = latest.immunities ?? []
                      if (current.includes(cond)) return
                      const updated = {
                        ...latest,
                        immunities: [...current, cond],
                        updatedAt: new Date().toISOString()
                      } as Character
                      useCharacterStore.getState().saveCharacter(updated)
                      broadcastIfDM(updated)
                      setShowDefenseAdder(null)
                      setCustomDefenseInput('')
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-green-700/50 text-green-300 hover:bg-green-900/40 cursor-pointer transition-colors"
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              placeholder="Custom..."
              value={customDefenseInput}
              onChange={(e) => setCustomDefenseInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customDefenseInput.trim()) {
                  const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                  if (!latest) return
                  const field =
                    showDefenseAdder === 'resistance'
                      ? 'resistances'
                      : showDefenseAdder === 'immunity'
                        ? 'immunities'
                        : 'vulnerabilities'
                  const current =
                    showDefenseAdder === 'vulnerability'
                      ? ((latest as Character5e).vulnerabilities ?? [])
                      : (latest[field as 'resistances' | 'immunities'] ?? [])
                  const updated = {
                    ...latest,
                    [field]: [...current, customDefenseInput.trim()],
                    updatedAt: new Date().toISOString()
                  } as Character
                  useCharacterStore.getState().saveCharacter(updated)
                  broadcastIfDM(updated)
                  setShowDefenseAdder(null)
                  setCustomDefenseInput('')
                }
              }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => {
                if (!customDefenseInput.trim()) return
                const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                if (!latest) return
                const field =
                  showDefenseAdder === 'resistance'
                    ? 'resistances'
                    : showDefenseAdder === 'immunity'
                      ? 'immunities'
                      : 'vulnerabilities'
                const current =
                  showDefenseAdder === 'vulnerability'
                    ? ((latest as Character5e).vulnerabilities ?? [])
                    : (latest[field as 'resistances' | 'immunities'] ?? [])
                const updated = {
                  ...latest,
                  [field]: [...current, customDefenseInput.trim()],
                  updatedAt: new Date().toISOString()
                } as Character
                useCharacterStore.getState().saveCharacter(updated)
                broadcastIfDM(updated)
                setShowDefenseAdder(null)
                setCustomDefenseInput('')
              }}
              disabled={!customDefenseInput.trim()}
              className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* 5e Armor/Tool proficiencies */}
      <div className="space-y-1 text-sm text-gray-400">
        {character.proficiencies.armor.length > 0 && (
          <div>
            <span className="text-gray-500">Armor: </span>
            {character.proficiencies.armor.map((prof, idx) => {
              const armorDescriptions: Record<string, string> = {
                'light armor':
                  'Made from supple materials, light armor lets agile adventurers keep their full DEX modifier to AC. Examples: Padded (AC 11), Leather (AC 11), Studded Leather (AC 12).',
                'medium armor':
                  'Offers more protection but limits mobility. Add DEX modifier to AC (max +2). Examples: Hide (AC 12), Chain Shirt (AC 13), Breastplate (AC 14), Half Plate (AC 15).',
                'heavy armor':
                  'The best protection at the cost of mobility. No DEX modifier added to AC. Some impose stealth disadvantage. Examples: Ring Mail (AC 14), Chain Mail (AC 16), Splint (AC 17), Plate (AC 18).',
                shields:
                  'A shield is carried in one hand. Wielding a shield increases your AC by 2. You can benefit from only one shield at a time.'
              }
              const desc = armorDescriptions[prof.toLowerCase()]
              return (
                <span key={prof} className="inline">
                  {idx > 0 && ', '}
                  {desc ? (
                    <span className="group relative text-amber-400 cursor-help underline decoration-dotted underline-offset-2">
                      {prof}
                      <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-72 z-10 shadow-lg">
                        {desc}
                      </span>
                    </span>
                  ) : (
                    <span>{prof}</span>
                  )}
                </span>
              )
            })}
            {!readonly && !showAddArmorProf && (
              <button
                onClick={() => setShowAddArmorProf(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer ml-2"
              >
                + Add
              </button>
            )}
            {!readonly && showAddArmorProf && (
              <div className="flex flex-wrap gap-1 mt-1">
                {['Light armor', 'Medium armor', 'Heavy armor', 'Shields']
                  .filter((p) => !character.proficiencies.armor.some((a) => a.toLowerCase() === p.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        addProficiency('armor', p)
                        setShowAddArmorProf(false)
                      }}
                      className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                <input
                  type="text"
                  placeholder="Custom..."
                  value={customProfInput}
                  onChange={(e) => setCustomProfInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customProfInput.trim()) {
                      addProficiency('armor', customProfInput.trim())
                      setCustomProfInput('')
                      setShowAddArmorProf(false)
                    }
                  }}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100 w-28 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => setShowAddArmorProf(false)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
        {character.proficiencies.tools.length > 0 && (
          <div>
            <span className="text-gray-500">Tools: </span>
            <div className="inline">
              {character.proficiencies.tools.map((tool, idx) => {
                const normalizedTool = tool
                  .toLowerCase()
                  .replace(/\s*\(.*\)/, '')
                  .trim()
                const toolData =
                  toolDescriptions.find((t) => t.name.toLowerCase() === tool.toLowerCase()) ||
                  toolDescriptions.find((t) => t.name.toLowerCase() === normalizedTool) ||
                  toolDescriptions.find(
                    (t) =>
                      t.name
                        .toLowerCase()
                        .replace(/\s*\(.*\)/, '')
                        .trim() === normalizedTool
                  )
                const isExpanded = expandedTool === tool
                const generic = isGenericTool(tool)
                const genericBase = getGenericToolBase(tool)
                const showingVariants = showToolVariantPicker === tool
                return (
                  <span key={tool} className="inline">
                    {idx > 0 && ', '}
                    <button
                      onClick={() => {
                        if (isExpanded || showingVariants) {
                          setExpandedTool(null)
                          setShowToolVariantPicker(null)
                        } else {
                          setExpandedTool(tool)
                          if (generic && !readonly) setShowToolVariantPicker(tool)
                        }
                      }}
                      className={`${toolData || generic ? 'text-amber-400 hover:text-amber-300 cursor-pointer underline decoration-dotted underline-offset-2' : 'text-gray-400'}`}
                    >
                      {tool}
                    </button>
                    {(isExpanded || showingVariants) && toolData?.description && (
                      <div className="text-xs text-gray-500 bg-gray-800/50 rounded px-2 py-1 mt-1 mb-1">
                        {toolData.description}
                        {toolData.ability && <span className="text-gray-600 ml-1">({toolData.ability})</span>}
                      </div>
                    )}
                    {showingVariants && generic && genericBase && (
                      <div className="text-xs bg-gray-800/50 rounded px-2 py-1 mt-1 mb-1">
                        <div className="text-gray-500 mb-1">Choose a specific {genericBase}:</div>
                        <div className="flex flex-wrap gap-1">
                          {GENERIC_TOOL_VARIANTS[genericBase]?.map((variant) => (
                            <button
                              key={variant}
                              onClick={() => {
                                const latest = useCharacterStore
                                  .getState()
                                  .characters.find((c) => c.id === character.id)
                                if (!latest || latest.gameSystem !== 'dnd5e') return
                                const l = latest as Character5e
                                const updated = {
                                  ...l,
                                  proficiencies: {
                                    ...l.proficiencies,
                                    tools: l.proficiencies.tools.map((t) => (t === tool ? variant : t))
                                  },
                                  equipment: l.equipment.map((e) =>
                                    e.name.toLowerCase() === tool.toLowerCase() ? { ...e, name: variant } : e
                                  ),
                                  updatedAt: new Date().toISOString()
                                }
                                useCharacterStore.getState().saveCharacter(updated)
                                broadcastIfDM(updated)
                                setShowToolVariantPicker(null)
                              }}
                              className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer transition-colors"
                            >
                              {variant}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </span>
                )
              })}
            </div>
            {!readonly && !showAddToolProf && (
              <button
                onClick={() => setShowAddToolProf(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer ml-2"
              >
                + Add
              </button>
            )}
            {!readonly && showAddToolProf && (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    "Alchemist's Supplies",
                    "Brewer's Supplies",
                    "Calligrapher's Supplies",
                    "Carpenter's Tools",
                    "Cartographer's Tools",
                    "Cobbler's Tools",
                    "Cook's Utensils",
                    "Glassblower's Tools",
                    'Herbalism Kit',
                    "Jeweler's Tools",
                    "Leatherworker's Tools",
                    "Mason's Tools",
                    "Navigator's Tools",
                    "Painter's Supplies",
                    "Poisoner's Kit",
                    "Potter's Tools",
                    "Smith's Tools",
                    "Thieves' Tools",
                    "Tinker's Tools",
                    "Weaver's Tools",
                    "Woodcarver's Tools",
                    'Disguise Kit',
                    'Forgery Kit',
                    'Gaming Set (Dice)',
                    'Gaming Set (Dragonchess)',
                    'Gaming Set (Playing Cards)',
                    'Gaming Set (Three-Dragon Ante)',
                    'Bagpipes',
                    'Drum',
                    'Dulcimer',
                    'Flute',
                    'Horn',
                    'Lute',
                    'Lyre',
                    'Pan Flute',
                    'Shawm',
                    'Viol'
                  ]
                    .filter(
                      (t) =>
                        !character.proficiencies.tools.some((existing) => existing.toLowerCase() === t.toLowerCase())
                    )
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          addProficiency('tools', t)
                          setShowAddToolProf(false)
                        }}
                        className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Custom tool..."
                    value={customProfInput}
                    onChange={(e) => setCustomProfInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customProfInput.trim()) {
                        addProficiency('tools', customProfInput.trim())
                        setCustomProfInput('')
                        setShowAddToolProf(false)
                      }
                    }}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100 w-40 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => {
                      if (customProfInput.trim()) {
                        addProficiency('tools', customProfInput.trim())
                        setCustomProfInput('')
                        setShowAddToolProf(false)
                      }
                    }}
                    disabled={!customProfInput.trim()}
                    className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddToolProf(false)
                      setCustomProfInput('')
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SheetSectionWrapper>
  )
}
