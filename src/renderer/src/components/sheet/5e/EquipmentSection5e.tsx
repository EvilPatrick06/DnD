import { useEffect, useRef, useState } from 'react'
import { getMagicItemEffects } from '../../../data/effect-definitions'
import { LANGUAGE_DESCRIPTIONS } from '../../../data/language-descriptions'
import { isWearableItem } from '../../../data/wearable-items'
import { load5eMagicItems } from '../../../services/data-provider'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { ArmorEntry, MagicItemRarity5e } from '../../../types/character-common'
import { ALL_LANGUAGES_5E } from '../../../types/character-common'
import { addCurrency, computeSellPrice, deductWithConversion, parseCost } from '../../../utils/currency'
import { calculateTotalWeight, getCarryingCapacity, getEncumbranceStatus } from '../../../utils/weight-calculator'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

// --- Gear database hook ---

interface GearItem {
  name: string
  cost?: string
  price?: string
  weight?: number
  bulk?: string | number
  description?: string
  category?: string
  contents?: Array<{ name: string; quantity: number }>
}

function useGearDatabase(): GearItem[] {
  const [gearList, setGearList] = useState<GearItem[]>([])
  useEffect(() => {
    fetch('./data/5e/equipment.json')
      .then((r) => r.json())
      .then((data) => {
        const gear: GearItem[] = data.gear ?? []
        setGearList(gear)
      })
      .catch(() => {})
  }, [])
  return gearList
}

function getGearCost(item: GearItem): string {
  if (item.cost && typeof item.cost === 'string') return item.cost
  if (item.price && typeof item.price === 'string') return item.price
  return ''
}

function getPackContents(itemName: string, gearDb: GearItem[]): Array<{ name: string; quantity: number }> | null {
  const match = gearDb.find((g) => g.name.toLowerCase() === itemName.toLowerCase())
  if (match?.contents && match.contents.length > 0) {
    return match.contents
  }
  return null
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

// --- Coin component ---

const COIN_STYLES: Record<string, string> = {
  PP: 'border-gray-400 bg-gray-500 text-white',
  GP: 'border-yellow-500 bg-yellow-600 text-white',
  EP: 'border-blue-400 bg-blue-500 text-white',
  SP: 'border-gray-300 bg-gray-300 text-gray-800',
  CP: 'border-amber-700 bg-amber-700 text-white'
}

function CoinBadge({
  label,
  value,
  readonly,
  onSave
}: {
  label: string
  value: number
  readonly?: boolean
  onSave: (newValue: number) => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (!editing) setInputValue(String(value))
  }, [value, editing])

  const commitEdit = (): void => {
    setEditing(false)
    const parsed = parseInt(inputValue, 10)
    const clamped = Number.isNaN(parsed) ? value : Math.max(0, parsed)
    if (clamped !== value) onSave(clamped)
  }

  const style = COIN_STYLES[label] || 'border-gray-500 bg-gray-600 text-white'

  if (editing && !readonly) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-10 h-10 rounded-full bg-gray-800 border-2 border-amber-500 text-center text-sm text-gray-100 focus:outline-none"
        />
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${!readonly ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (!readonly) {
          setInputValue(String(value))
          setEditing(true)
        }
      }}
      title={!readonly ? 'Click to edit' : undefined}
    >
      <div
        className={`w-10 h-10 rounded-full border-2 ${style} flex items-center justify-center text-sm font-bold shadow-sm ${!readonly ? 'hover:opacity-80 transition-opacity' : ''}`}
      >
        {value}
      </div>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  )
}

// --- Main component ---

interface EquipmentSection5eProps {
  character: Character5e
  readonly?: boolean
}

export default function EquipmentSection5e({ character, readonly }: EquipmentSection5eProps): JSX.Element {
  const equipment = character.equipment
  const hasEquipment = equipment.length > 0
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [expandedPack, setExpandedPack] = useState<number | null>(null)

  const [showAddEquipment, setShowAddEquipment] = useState(false)
  const [equipmentForm, setEquipmentForm] = useState({ name: '', quantity: '1' })

  const [showAddPet, setShowAddPet] = useState(false)
  const [petName, setPetName] = useState('')
  const [petType, setPetType] = useState('')

  const [showGearShop, setShowGearShop] = useState(false)
  const [gearSearch, setGearSearch] = useState('')
  const [buyWarning, setBuyWarning] = useState<string | null>(null)

  const [showAddLanguage, setShowAddLanguage] = useState<false | 'list' | 'custom'>(false)
  const [newLanguage, setNewLanguage] = useState('')
  const [newLangDesc, setNewLangDesc] = useState('')
  const [langSearch, setLangSearch] = useState('')
  const [expandedLanguage, setExpandedLanguage] = useState<string | null>(null)
  const [expandedSense, setExpandedSense] = useState<string | null>(null)

  // Attune inline form state
  const [showAttuneForm, setShowAttuneForm] = useState(false)
  const [attuneForm, setAttuneForm] = useState({ name: '', description: '' })

  // Magic item picker state
  const [showMagicItemPicker, setShowMagicItemPicker] = useState(false)
  const [magicItemSearch, setMagicItemSearch] = useState('')
  const [magicItemRarityFilter, setMagicItemRarityFilter] = useState<string>('all')
  const [magicItems, setMagicItems] = useState<
    Array<{
      id: string
      name: string
      rarity: MagicItemRarity5e
      type: string
      attunement: boolean
      cost: string
      description: string
    }>
  >([])
  const [showManualMagicItem, setShowManualMagicItem] = useState(false)
  const [manualMagicItem, setManualMagicItem] = useState<{
    name: string
    rarity: MagicItemRarity5e
    attunement: boolean
    description: string
  }>({ name: '', rarity: 'common', attunement: false, description: '' })

  // Sense picker state
  const [showSensePicker, setShowSensePicker] = useState(false)
  const [customSenseInput, setCustomSenseInput] = useState('')

  const gearDatabase = useGearDatabase()

  const filteredGear = gearSearch
    ? gearDatabase.filter((g) => g.name.toLowerCase().includes(gearSearch.toLowerCase()))
    : gearDatabase

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

  const saveCurrencyDenom = (denom: string, newValue: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    const updated = {
      ...latest,
      treasure: { ...latest.treasure, [denom]: newValue },
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleRemoveEquipment = (index: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const updated = {
      ...latest,
      equipment: latest.equipment.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleSellEquipment = (index: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const item = latest.equipment[index]
    if (!item) return

    let costStr = (item as { cost?: string }).cost
    if (!costStr) {
      const dbItem = gearDatabase.find((g) => g.name.toLowerCase() === item.name.toLowerCase())
      if (dbItem) costStr = getGearCost(dbItem)
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
      equipment: latest.equipment.filter((_, i) => i !== index),
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleOpenPack = (index: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const pack = latest.equipment[index]
    if (!pack) return

    const contents = getPackContents(pack.name, gearDatabase)
    if (!contents) return

    // Remove one pack (or decrement quantity)
    let currentEquipment: typeof latest.equipment
    if (pack.quantity > 1) {
      currentEquipment = latest.equipment.map((e, i) => (i === index ? { ...e, quantity: e.quantity - 1 } : e))
    } else {
      currentEquipment = latest.equipment.filter((_, i) => i !== index)
    }

    // Add each component, stacking with existing items
    for (const component of contents) {
      const existingIdx = currentEquipment.findIndex((e) => e.name.toLowerCase() === component.name.toLowerCase())
      if (existingIdx >= 0) {
        currentEquipment = currentEquipment.map((e, i) =>
          i === existingIdx ? { ...e, quantity: e.quantity + component.quantity } : e
        )
      } else {
        const dbItem = gearDatabase.find((g) => g.name.toLowerCase() === component.name.toLowerCase())
        currentEquipment = [
          ...currentEquipment,
          {
            name: component.name,
            quantity: component.quantity,
            description: dbItem?.description,
            cost: dbItem ? getGearCost(dbItem) : undefined
          }
        ]
      }
    }

    const updated = {
      ...latest,
      equipment: currentEquipment,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddEquipment = (): void => {
    const name = equipmentForm.name.trim()
    if (!name) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const qty = Math.max(1, parseInt(equipmentForm.quantity, 10) || 1)
    const newItem = { name, quantity: qty }
    const updated = {
      ...latest,
      equipment: [...latest.equipment, newItem],
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setEquipmentForm({ name: '', quantity: '1' })
    setShowAddEquipment(false)
  }

  const handleBuyGear = (item: GearItem): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return

    const costStr = getGearCost(item)
    const cost = parseCost(costStr)

    let updatedTreasure = latest.treasure
    if (cost && cost.amount > 0) {
      const currentCurrency = {
        pp: latest.treasure.pp,
        gp: latest.treasure.gp,
        sp: latest.treasure.sp,
        cp: latest.treasure.cp
      }
      const result = deductWithConversion(currentCurrency, cost)
      if (!result) {
        setBuyWarning(`Not enough funds for ${item.name}`)
        setTimeout(() => setBuyWarning(null), 3000)
        return
      }
      updatedTreasure = { ...latest.treasure, ...result }
    }

    if (isWearableItem(item.name)) {
      const newArmor: ArmorEntry = {
        id: crypto.randomUUID(),
        name: item.name,
        acBonus: 0,
        equipped: false,
        type: 'clothing',
        description: item.description,
        cost: costStr || undefined
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
      setBuyWarning(null)
      return
    }

    const newItem = { name: item.name, quantity: 1, description: item.description, cost: costStr || undefined }
    const updated = {
      ...latest,
      equipment: [...latest.equipment, newItem],
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setBuyWarning(null)
  }

  const handleRemovePet = (index: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentPets = latest.pets ?? []
    const updated = {
      ...latest,
      pets: currentPets.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddPet = (): void => {
    const name = petName.trim()
    if (!name) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentPets = latest.pets ?? []
    const updated = {
      ...latest,
      pets: [...currentPets, { name, type: petType.trim() || '' }],
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setPetName('')
    setPetType('')
    setShowAddPet(false)
  }

  const handleRemoveLanguage = (lang: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || latest.gameSystem !== 'dnd5e') return
    const l = latest as Character5e
    const updated = {
      ...l,
      proficiencies: {
        ...l.proficiencies,
        languages: l.proficiencies.languages.filter((x) => x !== lang)
      },
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddLanguageFromList = (lang: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || latest.gameSystem !== 'dnd5e') return
    const l = latest as Character5e
    if (l.proficiencies.languages.includes(lang)) return
    const updated = {
      ...l,
      proficiencies: {
        ...l.proficiencies,
        languages: [...l.proficiencies.languages, lang]
      },
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddCustomLanguage = (): void => {
    const lang = newLanguage.trim()
    if (!lang) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || latest.gameSystem !== 'dnd5e') return
    const l = latest as Character5e
    if (l.proficiencies.languages.includes(lang)) return
    const desc = newLangDesc.trim()
    const updated = {
      ...l,
      proficiencies: {
        ...l.proficiencies,
        languages: [...l.proficiencies.languages, lang]
      },
      languageDescriptions: desc ? { ...(l.languageDescriptions ?? {}), [lang]: desc } : (l.languageDescriptions ?? {}),
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setNewLanguage('')
    setNewLangDesc('')
    setShowAddLanguage(false)
  }

  const currency = character.treasure
  const pets = character.pets ?? []
  const languages: string[] = character.proficiencies.languages

  return (
    <SheetSectionWrapper title="Equipment & Currency">
      {/* Currency as coins */}
      <div className="flex flex-wrap gap-3 mb-3 justify-center">
        <CoinBadge label="PP" value={currency.pp} readonly={readonly} onSave={(v) => saveCurrencyDenom('pp', v)} />
        <CoinBadge label="GP" value={currency.gp} readonly={readonly} onSave={(v) => saveCurrencyDenom('gp', v)} />
        <CoinBadge
          label="EP"
          value={character.treasure.ep ?? 0}
          readonly={readonly}
          onSave={(v) => saveCurrencyDenom('ep', v)}
        />
        <CoinBadge label="SP" value={currency.sp} readonly={readonly} onSave={(v) => saveCurrencyDenom('sp', v)} />
        <CoinBadge label="CP" value={currency.cp} readonly={readonly} onSave={(v) => saveCurrencyDenom('cp', v)} />
      </div>

      {/* Carrying Capacity Weight Bar */}
      {(() => {
        const strScore = character.abilityScores.strength
        const size = character.size || 'Medium'
        const capacity = getCarryingCapacity(strScore, size)
        const currentWeight = calculateTotalWeight(character)
        const status = getEncumbranceStatus(currentWeight, capacity)
        const pct = capacity.carry > 0 ? Math.min(100, (currentWeight / capacity.carry) * 100) : 0
        const barColor =
          status === 'over-limit'
            ? 'bg-red-500'
            : status === 'encumbered'
              ? 'bg-amber-500'
              : pct >= 75
                ? 'bg-amber-500'
                : 'bg-green-500'
        return (
          <div className="mb-3">
            <div
              className="relative h-5 bg-gray-800 rounded-full overflow-hidden border border-gray-700"
              title={`Carrying Capacity: STR (${strScore}) × 15 = ${capacity.carry} lb. Drag/Lift/Push: ${capacity.dragLiftPush} lb.`}
            >
              <div
                className={`absolute inset-y-0 left-0 ${barColor} transition-all`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white drop-shadow">
                {currentWeight} / {capacity.carry} lb
              </div>
            </div>
            {status === 'encumbered' && (
              <p className="text-[10px] text-amber-400 mt-1">Encumbered! Speed reduced to 5 ft.</p>
            )}
            {status === 'over-limit' && <p className="text-[10px] text-red-400 mt-1">Over carry limit! Cannot move.</p>}
          </div>
        )
      })()}

      {/* Magic Item Attunement (5e, 3 slots) */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Attunement ({(character.attunement ?? []).length}/3)
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((slotIdx) => {
            const item = (character.attunement ?? [])[slotIdx]
            return (
              <div
                key={slotIdx}
                className={`flex-1 rounded-lg border p-2 text-center text-xs ${
                  item
                    ? 'border-purple-700/50 bg-purple-900/20 text-purple-300'
                    : 'border-gray-700 bg-gray-900/30 text-gray-600'
                }`}
              >
                {item ? (
                  <div>
                    <div className="font-medium truncate" title={item.description}>
                      {item.name}
                    </div>
                    {!readonly && (
                      <button
                        onClick={() => {
                          const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                          if (!latest || latest.gameSystem !== 'dnd5e') return
                          const l = latest as Character5e
                          const updated = {
                            ...l,
                            attunement: (l.attunement ?? []).filter((_, i) => i !== slotIdx),
                            updatedAt: new Date().toISOString()
                          }
                          useCharacterStore.getState().saveCharacter(updated)
                          broadcastIfDM(updated)
                        }}
                        className="text-purple-400 hover:text-red-400 cursor-pointer mt-0.5"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ) : !readonly && (character.attunement ?? []).length <= slotIdx ? (
                  showAttuneForm && (character.attunement ?? []).length === slotIdx ? (
                    <div className="space-y-1 w-full">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={attuneForm.name}
                        onChange={(e) => setAttuneForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={attuneForm.description}
                        onChange={(e) => setAttuneForm((f) => ({ ...f, description: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && attuneForm.name.trim()) {
                            const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                            if (!latest || latest.gameSystem !== 'dnd5e') return
                            const l = latest as Character5e
                            const updated = {
                              ...l,
                              attunement: [
                                ...(l.attunement ?? []),
                                { name: attuneForm.name.trim(), description: attuneForm.description.trim() }
                              ],
                              updatedAt: new Date().toISOString()
                            }
                            useCharacterStore.getState().saveCharacter(updated)
                            broadcastIfDM(updated)
                            setAttuneForm({ name: '', description: '' })
                            setShowAttuneForm(false)
                          }
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-100 focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => {
                            if (!attuneForm.name.trim()) return
                            const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                            if (!latest || latest.gameSystem !== 'dnd5e') return
                            const l = latest as Character5e
                            const updated = {
                              ...l,
                              attunement: [
                                ...(l.attunement ?? []),
                                { name: attuneForm.name.trim(), description: attuneForm.description.trim() }
                              ],
                              updatedAt: new Date().toISOString()
                            }
                            useCharacterStore.getState().saveCharacter(updated)
                            broadcastIfDM(updated)
                            setAttuneForm({ name: '', description: '' })
                            setShowAttuneForm(false)
                          }}
                          disabled={!attuneForm.name.trim()}
                          className="px-1.5 py-0.5 text-[10px] bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-white cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAttuneForm(false)
                            setAttuneForm({ name: '', description: '' })
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAttuneForm(true)}
                      className="text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                      + Attune
                    </button>
                  )
                ) : (
                  <span>Empty</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Magic Items */}
      {((character.magicItems && character.magicItems.length > 0) || !readonly) && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Magic Items
            {character.magicItems?.some((mi) => mi.attunement) && (
              <span className="ml-2 text-purple-400 normal-case">
                Attuned: {(character.magicItems ?? []).filter((mi) => mi.attuned).length}/3
              </span>
            )}
          </div>
          {character.magicItems && character.magicItems.length > 0 ? (
            <div className="space-y-1">
              {character.magicItems.map((item, i) => {
                const rarityColor: Record<string, string> = {
                  common: 'border-gray-500 text-gray-300',
                  uncommon: 'border-green-600 text-green-400',
                  rare: 'border-blue-600 text-blue-400',
                  'very-rare': 'border-purple-600 text-purple-400',
                  legendary: 'border-orange-500 text-orange-400',
                  artifact: 'border-red-500 text-red-400'
                }
                const rarityLabel: Record<string, string> = {
                  common: 'Common',
                  uncommon: 'Uncommon',
                  rare: 'Rare',
                  'very-rare': 'Very Rare',
                  legendary: 'Legendary',
                  artifact: 'Artifact'
                }
                const colors = rarityColor[item.rarity] ?? 'border-gray-600 text-gray-400'
                const hasEffects = !!getMagicItemEffects(item.name)
                const isWeaponType = item.type === 'weapon' || /weapon|\+\d.*weapon/i.test(item.name)
                const isArmorType = item.type === 'armor' || /armor|shield|\+\d.*armor/i.test(item.name)
                const weapons = character.weapons ?? []
                const armors = character.armor ?? []
                return (
                  <div key={item.id || i} className={`border rounded px-2 py-1.5 ${colors}`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          <span className="text-[10px] text-gray-500 shrink-0">
                            {rarityLabel[item.rarity] ?? item.rarity}
                          </span>
                          {item.attunement && (
                            <button
                              disabled={readonly}
                              onClick={() => {
                                if (readonly) return
                                const latest = useCharacterStore
                                  .getState()
                                  .characters.find((c) => c.id === character.id)
                                if (!latest || latest.gameSystem !== 'dnd5e') return
                                const l = latest as Character5e
                                // Enforce 3-item attunement limit
                                if (!item.attuned) {
                                  const attunedCount = (l.magicItems ?? []).filter((mi) => mi.attuned).length
                                  if (attunedCount >= 3) {
                                    setBuyWarning('Cannot attune — maximum 3 items already attuned.')
                                    setTimeout(() => setBuyWarning(null), 3000)
                                    return
                                  }
                                }
                                const updated = {
                                  ...l,
                                  magicItems: (l.magicItems ?? []).map((mi, idx) =>
                                    idx === i ? { ...mi, attuned: !mi.attuned } : mi
                                  ),
                                  updatedAt: new Date().toISOString()
                                }
                                useCharacterStore.getState().saveCharacter(updated)
                                broadcastIfDM(updated)
                              }}
                              className={`text-[10px] shrink-0 ${item.attuned ? 'text-purple-400' : 'text-gray-500'} ${!readonly ? 'cursor-pointer hover:text-purple-300' : ''}`}
                              title={!readonly ? 'Click to toggle attunement' : undefined}
                            >
                              {item.attuned ? '(Attuned)' : '(Requires Attunement)'}
                            </button>
                          )}
                          {hasEffects && <span className="text-[9px] text-cyan-500 shrink-0">FX</span>}
                        </div>
                        {item.description && (
                          <div className="text-[10px] text-gray-500 truncate mt-0.5">{item.description}</div>
                        )}
                      </div>
                      {/* Charges */}
                      {item.charges && (
                        <div className="flex items-center gap-1 mr-2 shrink-0">
                          <span className="text-[10px] text-gray-500">Charges:</span>
                          <button
                            disabled={readonly || item.charges.current <= 0}
                            onClick={() => {
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest || latest.gameSystem !== 'dnd5e') return
                              const l = latest as Character5e
                              const updated = {
                                ...l,
                                magicItems: (l.magicItems ?? []).map((mi, idx) =>
                                  idx === i && mi.charges
                                    ? {
                                        ...mi,
                                        charges: { ...mi.charges, current: Math.max(0, mi.charges.current - 1) }
                                      }
                                    : mi
                                ),
                                updatedAt: new Date().toISOString()
                              }
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="w-4 h-4 text-[10px] bg-gray-700 rounded text-gray-300 hover:bg-gray-600 disabled:opacity-40 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono text-amber-400">
                            {item.charges.current}/{item.charges.max}
                          </span>
                          <button
                            disabled={readonly || item.charges.current >= item.charges.max}
                            onClick={() => {
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest || latest.gameSystem !== 'dnd5e') return
                              const l = latest as Character5e
                              const updated = {
                                ...l,
                                magicItems: (l.magicItems ?? []).map((mi, idx) =>
                                  idx === i && mi.charges
                                    ? {
                                        ...mi,
                                        charges: {
                                          ...mi.charges,
                                          current: Math.min(mi.charges.max, mi.charges.current + 1)
                                        }
                                      }
                                    : mi
                                ),
                                updatedAt: new Date().toISOString()
                              }
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="w-4 h-4 text-[10px] bg-gray-700 rounded text-gray-300 hover:bg-gray-600 disabled:opacity-40 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      )}
                      {!readonly && (
                        <button
                          onClick={() => {
                            const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                            if (!latest || latest.gameSystem !== 'dnd5e') return
                            const l = latest as Character5e
                            const updated = {
                              ...l,
                              magicItems: (l.magicItems ?? []).filter((_, idx) => idx !== i),
                              updatedAt: new Date().toISOString()
                            }
                            useCharacterStore.getState().saveCharacter(updated)
                            broadcastIfDM(updated)
                          }}
                          className="text-gray-600 hover:text-red-400 cursor-pointer text-xs ml-2 shrink-0"
                          title="Remove magic item"
                        >
                          &#x2715;
                        </button>
                      )}
                    </div>
                    {/* Weapon/Armor link selector */}
                    {!readonly && (isWeaponType || isArmorType) && (
                      <div className="mt-1 flex items-center gap-2">
                        {isWeaponType && weapons.length > 0 && (
                          <select
                            value={item.linkedWeaponId ?? ''}
                            onChange={(e) => {
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest || latest.gameSystem !== 'dnd5e') return
                              const l = latest as Character5e
                              const updated = {
                                ...l,
                                magicItems: (l.magicItems ?? []).map((mi, idx) =>
                                  idx === i ? { ...mi, linkedWeaponId: e.target.value || undefined } : mi
                                ),
                                updatedAt: new Date().toISOString()
                              }
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Link to weapon...</option>
                            {weapons.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {isArmorType && armors.length > 0 && (
                          <select
                            value={item.linkedArmorId ?? ''}
                            onChange={(e) => {
                              const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                              if (!latest || latest.gameSystem !== 'dnd5e') return
                              const l = latest as Character5e
                              const updated = {
                                ...l,
                                magicItems: (l.magicItems ?? []).map((mi, idx) =>
                                  idx === i ? { ...mi, linkedArmorId: e.target.value || undefined } : mi
                                ),
                                updatedAt: new Date().toISOString()
                              }
                              useCharacterStore.getState().saveCharacter(updated)
                              broadcastIfDM(updated)
                            }}
                            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Link to armor...</option>
                            {armors.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {item.linkedWeaponId && (
                          <span className="text-[9px] text-cyan-400">
                            Linked: {weapons.find((w) => w.id === item.linkedWeaponId)?.name ?? 'Unknown'}
                          </span>
                        )}
                        {item.linkedArmorId && (
                          <span className="text-[9px] text-cyan-400">
                            Linked: {armors.find((a) => a.id === item.linkedArmorId)?.name ?? 'Unknown'}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Show linked info in readonly mode */}
                    {readonly && (item.linkedWeaponId || item.linkedArmorId) && (
                      <div className="mt-0.5">
                        {item.linkedWeaponId && (
                          <span className="text-[9px] text-cyan-400">
                            Linked: {weapons.find((w) => w.id === item.linkedWeaponId)?.name ?? 'Unknown weapon'}
                          </span>
                        )}
                        {item.linkedArmorId && (
                          <span className="text-[9px] text-cyan-400">
                            Linked: {armors.find((a) => a.id === item.linkedArmorId)?.name ?? 'Unknown armor'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No magic items.</p>
          )}
          {!readonly && (
            <div className="mt-2">
              {showMagicItemPicker ? (
                <div className="bg-gray-800/50 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-purple-400 font-medium">
                      {showManualMagicItem ? 'Manual Entry' : 'Magic Item Browser'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowManualMagicItem(!showManualMagicItem)}
                        className="text-[10px] text-gray-400 hover:text-gray-300 cursor-pointer underline"
                      >
                        {showManualMagicItem ? 'Browse SRD' : 'Manual Entry'}
                      </button>
                      <button
                        onClick={() => {
                          setShowMagicItemPicker(false)
                          setShowManualMagicItem(false)
                          setMagicItemSearch('')
                          setMagicItemRarityFilter('all')
                          setManualMagicItem({ name: '', rarity: 'common', attunement: false, description: '' })
                        }}
                        className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {showManualMagicItem ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={manualMagicItem.name}
                        onChange={(e) => setManualMagicItem((f) => ({ ...f, name: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={manualMagicItem.rarity}
                          onChange={(e) =>
                            setManualMagicItem((f) => ({ ...f, rarity: e.target.value as typeof f.rarity }))
                          }
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500"
                        >
                          <option value="common">Common</option>
                          <option value="uncommon">Uncommon</option>
                          <option value="rare">Rare</option>
                          <option value="very-rare">Very Rare</option>
                          <option value="legendary">Legendary</option>
                          <option value="artifact">Artifact</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={manualMagicItem.attunement}
                            onChange={(e) => setManualMagicItem((f) => ({ ...f, attunement: e.target.checked }))}
                            className="rounded"
                          />
                          Attunement
                        </label>
                      </div>
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={manualMagicItem.description}
                        onChange={(e) => setManualMagicItem((f) => ({ ...f, description: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            if (!manualMagicItem.name.trim()) return
                            const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                            if (!latest || latest.gameSystem !== 'dnd5e') return
                            const l = latest as Character5e
                            const newItem = {
                              id: crypto.randomUUID(),
                              name: manualMagicItem.name.trim(),
                              rarity: manualMagicItem.rarity,
                              type: 'wondrous',
                              attunement: manualMagicItem.attunement,
                              description: manualMagicItem.description.trim()
                            }
                            const updated = {
                              ...l,
                              magicItems: [...(l.magicItems ?? []), newItem],
                              updatedAt: new Date().toISOString()
                            }
                            useCharacterStore.getState().saveCharacter(updated)
                            broadcastIfDM(updated)
                            setManualMagicItem({ name: '', rarity: 'common', attunement: false, description: '' })
                          }}
                          disabled={!manualMagicItem.name.trim()}
                          className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-white cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Search magic items..."
                          value={magicItemSearch}
                          onChange={(e) => setMagicItemSearch(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500"
                        />
                        <select
                          value={magicItemRarityFilter}
                          onChange={(e) => setMagicItemRarityFilter(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500"
                        >
                          <option value="all">All Rarities</option>
                          <option value="common">Common</option>
                          <option value="uncommon">Uncommon</option>
                          <option value="rare">Rare</option>
                          <option value="very-rare">Very Rare</option>
                          <option value="legendary">Legendary</option>
                          <option value="artifact">Artifact</option>
                        </select>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {magicItems
                          .filter(
                            (item) =>
                              !magicItemSearch || item.name.toLowerCase().includes(magicItemSearch.toLowerCase())
                          )
                          .filter((item) => magicItemRarityFilter === 'all' || item.rarity === magicItemRarityFilter)
                          .slice(0, 50)
                          .map((item) => {
                            const rarityColor: Record<string, string> = {
                              common: 'text-gray-400',
                              uncommon: 'text-green-400',
                              rare: 'text-blue-400',
                              'very-rare': 'text-purple-400',
                              legendary: 'text-orange-400',
                              artifact: 'text-red-400'
                            }
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  const latest = useCharacterStore
                                    .getState()
                                    .characters.find((c) => c.id === character.id)
                                  if (!latest || latest.gameSystem !== 'dnd5e') return
                                  const l = latest as Character5e
                                  const newItem = {
                                    id: crypto.randomUUID(),
                                    name: item.name,
                                    rarity: item.rarity,
                                    type: item.type || 'wondrous',
                                    attunement: item.attunement,
                                    description: item.description || ''
                                  }
                                  const updated = {
                                    ...l,
                                    magicItems: [...(l.magicItems ?? []), newItem],
                                    updatedAt: new Date().toISOString()
                                  }
                                  useCharacterStore.getState().saveCharacter(updated)
                                  broadcastIfDM(updated)
                                }}
                                className="w-full flex items-center justify-between text-xs py-1 px-2 hover:bg-gray-800/50 rounded text-left cursor-pointer"
                              >
                                <span className={`font-medium ${rarityColor[item.rarity] ?? 'text-gray-300'}`}>
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {item.attunement && <span className="text-[9px] text-purple-500">Attune</span>}
                                  <span className="text-[10px] text-gray-600 capitalize">
                                    {item.rarity.replace('-', ' ')}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        {magicItems.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-2">Loading magic items...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowMagicItemPicker(true)
                    if (magicItems.length === 0) {
                      load5eMagicItems()
                        .then((items) => setMagicItems(items))
                        .catch(() => {})
                    }
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  + Add Magic Item
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* General Equipment */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Equipment</div>
        {hasEquipment ? (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
            {equipment.map((item, i) => (
              <div key={i}>
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedItem(expandedItem === i ? null : i)}
                    className="flex-1 flex justify-between py-1 border-b border-gray-800 last:border-0 text-sm cursor-pointer hover:bg-gray-800/30 transition-colors"
                  >
                    <span className="text-gray-300 flex items-center gap-1">
                      {item.name}
                      <span className="text-gray-600 text-[10px]">{expandedItem === i ? '\u25BE' : '\u25B8'}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {item.quantity > 1 && <span className="text-gray-500">x{item.quantity}</span>}
                      {'weight' in item && (item as { weight?: number }).weight != null && (
                        <span className="text-xs text-gray-600">{(item as { weight?: number }).weight} lb</span>
                      )}
                    </div>
                  </button>
                  {getPackContents(item.name, gearDatabase) &&
                    (readonly ? (
                      <button
                        onClick={() => setExpandedPack(expandedPack === i ? null : i)}
                        className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer flex-shrink-0"
                        title="View pack contents"
                      >
                        {expandedPack === i ? 'Hide' : 'Contents'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenPack(i)}
                        className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 rounded text-white cursor-pointer flex-shrink-0"
                        title="Open pack into individual items"
                      >
                        Open
                      </button>
                    ))}
                  {!readonly && (
                    <>
                      <button
                        onClick={() => handleSellEquipment(i)}
                        className="ml-1 text-gray-600 hover:text-green-400 cursor-pointer text-xs flex-shrink-0"
                        title="Sell (half price)"
                      >
                        &#x24;
                      </button>
                      <button
                        onClick={() => handleRemoveEquipment(i)}
                        className="ml-2 text-gray-600 hover:text-red-400 cursor-pointer text-xs flex-shrink-0"
                        title="Remove item"
                      >
                        &#x2715;
                      </button>
                    </>
                  )}
                </div>
                {expandedPack === i &&
                  readonly &&
                  (() => {
                    const contents = getPackContents(item.name, gearDatabase)
                    if (!contents) return null
                    return (
                      <div className="text-xs text-gray-500 py-1 pl-2 bg-gray-800/30 rounded mt-0.5 mb-0.5">
                        <div className="text-gray-400 mb-1 font-medium">Pack Contents:</div>
                        {contents.map((c, ci) => (
                          <div key={ci} className="flex items-center gap-1 py-0.5">
                            <span className="text-gray-300">{c.name}</span>
                            {c.quantity > 1 && <span className="text-gray-600">x{c.quantity}</span>}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                {expandedItem === i && (
                  <div className="text-xs text-gray-500 py-1 pl-2">
                    {item.description ||
                      gearDatabase.find((g) => g.name.toLowerCase() === item.name.toLowerCase())?.description ||
                      'No description available.'}
                    {!readonly &&
                      isGenericTool(item.name) &&
                      (() => {
                        const base = getGenericToolBase(item.name)
                        if (!base) return null
                        const variants = GENERIC_TOOL_VARIANTS[base]
                        if (!variants) return null
                        return (
                          <div className="mt-2">
                            <div className="text-gray-400 mb-1">Choose a specific {base}:</div>
                            <div className="flex flex-wrap gap-1">
                              {variants.map((variant) => (
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
                                      equipment: l.equipment.map((e, idx) => (idx === i ? { ...e, name: variant } : e)),
                                      proficiencies: {
                                        ...l.proficiencies,
                                        tools: l.proficiencies.tools.map((t) =>
                                          t.toLowerCase() === item.name.toLowerCase() ? variant : t
                                        )
                                      },
                                      updatedAt: new Date().toISOString()
                                    }
                                    useCharacterStore.getState().saveCharacter(updated)
                                    broadcastIfDM(updated)
                                    setExpandedItem(null)
                                  }}
                                  className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer transition-colors"
                                >
                                  {variant}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No equipment.</p>
        )}

        {!readonly && (
          <div className="mt-2">
            {showAddEquipment ? (
              <div className="bg-gray-800/50 rounded p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={equipmentForm.name}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={equipmentForm.quantity}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddEquipment}
                    disabled={!equipmentForm.name.trim()}
                    className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEquipment(false)
                      setEquipmentForm({ name: '', quantity: '1' })
                    }}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : showGearShop ? (
              <div className="bg-gray-800/50 rounded p-3 space-y-2">
                <div className="text-xs text-gray-400 font-medium mb-1">Gear Shop</div>
                <input
                  type="text"
                  placeholder="Search gear..."
                  value={gearSearch}
                  onChange={(e) => setGearSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                />
                {buyWarning && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                    {buyWarning}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredGear.slice(0, 50).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-1 hover:bg-gray-800/50 rounded"
                    >
                      <span className="text-gray-300">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{getGearCost(item) || 'free'}</span>
                        <button
                          onClick={() => handleBuyGear(item)}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white cursor-pointer"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredGear.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">No items found.</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowGearShop(false)
                      setGearSearch('')
                      setBuyWarning(null)
                    }}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddEquipment(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  + Add Item
                </button>
                <button
                  onClick={() => setShowGearShop(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  + Shop
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pets */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pets</div>
        {pets.length > 0 ? (
          <div className="space-y-1">
            {pets.map((pet, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-sm">
                <div>
                  <span className="text-gray-300 font-medium">{pet.name}</span>
                  {pet.type && <span className="text-gray-500 text-xs ml-1.5">({pet.type})</span>}
                </div>
                {!readonly && (
                  <button
                    onClick={() => handleRemovePet(i)}
                    className="text-gray-600 hover:text-red-400 cursor-pointer text-xs ml-2"
                    title="Remove pet"
                  >
                    &#x2715;
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No pets.</p>
        )}
        {!readonly && (
          <div className="mt-2">
            {showAddPet ? (
              <div className="bg-gray-800/50 rounded p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pet name"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPet()
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Type (e.g. Wolf)"
                    value={petType}
                    onChange={(e) => setPetType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPet()
                    }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddPet}
                    disabled={!petName.trim()}
                    className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPet(false)
                      setPetName('')
                      setPetType('')
                    }}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddPet(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Add Pet
              </button>
            )}
          </div>
        )}
      </div>

      {/* Languages as green pills */}
      {languages.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Languages</div>
          <div className="flex flex-wrap gap-1.5">
            {languages.map((lang) => {
              const desc = character.languageDescriptions?.[lang] || LANGUAGE_DESCRIPTIONS[lang]
              const isLangExpanded = expandedLanguage === lang
              return (
                <div key={lang} className="inline-flex flex-col">
                  <span
                    className={`inline-flex items-center gap-1 bg-green-900/50 text-green-300 border border-green-700/50 rounded-full px-2.5 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-green-900/70' : ''}`}
                    onClick={() => {
                      if (desc) setExpandedLanguage(isLangExpanded ? null : lang)
                    }}
                  >
                    {lang}
                    {desc && <span className="text-green-500/60 text-[10px]">{isLangExpanded ? '\u25BE' : '?'}</span>}
                    {!readonly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLanguage(lang)
                        }}
                        className="text-green-500 hover:text-red-400 cursor-pointer ml-0.5"
                        title="Remove language"
                      >
                        &#x2715;
                      </button>
                    )}
                  </span>
                  {isLangExpanded && desc && (
                    <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                      {desc}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Language */}
      {!readonly && (
        <div className="mb-3">
          {showAddLanguage === 'list' ? (
            <div className="bg-gray-800/50 rounded p-3 space-y-2">
              <div className="text-xs text-gray-400 font-medium mb-1">Standard Languages</div>
              <input
                type="text"
                placeholder="Search languages..."
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {ALL_LANGUAGES_5E.filter((l) => !languages.includes(l))
                  .filter((l) => !langSearch || l.toLowerCase().includes(langSearch.toLowerCase()))
                  .map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleAddLanguageFromList(lang)}
                      className="w-full flex items-center justify-between text-xs py-1 px-2 hover:bg-gray-800/50 rounded text-left cursor-pointer"
                    >
                      <span className="text-gray-300">{lang}</span>
                      {LANGUAGE_DESCRIPTIONS[lang] && (
                        <span className="text-gray-600 text-[10px] truncate ml-2 max-w-[60%]">
                          {LANGUAGE_DESCRIPTIONS[lang]}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowAddLanguage(false)
                    setLangSearch('')
                  }}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : showAddLanguage === 'custom' ? (
            <div className="bg-gray-800/50 rounded p-3 space-y-2">
              <div className="text-xs text-gray-400 font-medium mb-1">Custom Language</div>
              <input
                type="text"
                placeholder="Language name"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newLangDesc}
                onChange={(e) => setNewLangDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomLanguage()
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleAddCustomLanguage}
                  disabled={!newLanguage.trim()}
                  className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddLanguage(false)
                    setNewLanguage('')
                    setNewLangDesc('')
                  }}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddLanguage('list')}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Standard Language
              </button>
              <button
                onClick={() => setShowAddLanguage('custom')}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Custom Language
              </button>
            </div>
          )}
        </div>
      )}

      {/* Senses */}
      {(character.senses?.length > 0 || !readonly) && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Senses</div>
          {character.senses && character.senses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {character.senses.map((sense) => {
                const SENSE_DESCRIPTIONS: Record<string, string> = {
                  darkvision:
                    'You can see in dim light within range as if it were bright light, and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
                  blindsight:
                    'You can perceive your surroundings without relying on sight, within a specific radius. Creatures without this sense are effectively blinded with regard to creatures with it.',
                  tremorsense:
                    'You can detect and pinpoint the origin of vibrations within a specific radius, provided you and the source are in contact with the same ground or substance.',
                  truesight:
                    'You can see in normal and magical darkness, see invisible creatures and objects, automatically detect visual illusions and succeed on saving throws against them, and perceive the original form of a shapechanger or a creature transformed by magic.'
                }
                const senseKey = sense
                  .toLowerCase()
                  .replace(/\s*\d+\s*ft\.?/i, '')
                  .trim()
                const desc = SENSE_DESCRIPTIONS[senseKey]
                const isSenseExpanded = expandedSense === sense
                return (
                  <div key={sense} className="inline-flex flex-col">
                    <span
                      className={`inline-flex items-center gap-1 bg-amber-900/30 text-amber-300 border border-amber-700/50 rounded-full px-2.5 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-amber-900/50' : ''}`}
                      onClick={() => {
                        if (desc) setExpandedSense(isSenseExpanded ? null : sense)
                      }}
                    >
                      {sense}
                      {desc && (
                        <span className="text-amber-500/60 text-[10px]">{isSenseExpanded ? '\u25BE' : '?'}</span>
                      )}
                      {!readonly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                            if (!latest) return
                            const updated = {
                              ...latest,
                              senses: (latest.senses ?? []).filter((s) => s !== sense),
                              updatedAt: new Date().toISOString()
                            } as Character
                            useCharacterStore.getState().saveCharacter(updated)
                            broadcastIfDM(updated)
                          }}
                          className="ml-1 text-amber-400 hover:text-red-400 cursor-pointer"
                        >
                          &#x2715;
                        </button>
                      )}
                    </span>
                    {isSenseExpanded && desc && (
                      <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                        {desc}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!readonly && !showSensePicker && (
            <button
              onClick={() => setShowSensePicker(true)}
              className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              + Add Sense
            </button>
          )}
          {!readonly && showSensePicker && (
            <div className="bg-gray-800/50 rounded p-3 space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400 font-medium">Add Sense</span>
                <button
                  onClick={() => {
                    setShowSensePicker(false)
                    setCustomSenseInput('')
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  'Darkvision 60 ft.',
                  'Darkvision 120 ft.',
                  'Blindsight 10 ft.',
                  'Blindsight 30 ft.',
                  'Tremorsense 30 ft.',
                  'Truesight 30 ft.'
                ].map((sense) => (
                  <button
                    key={sense}
                    onClick={() => {
                      const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                      if (!latest) return
                      const updated = {
                        ...latest,
                        senses: [...(latest.senses ?? []), sense],
                        updatedAt: new Date().toISOString()
                      } as Character
                      useCharacterStore.getState().saveCharacter(updated)
                      broadcastIfDM(updated)
                      setShowSensePicker(false)
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer transition-colors"
                  >
                    {sense}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Custom sense..."
                  value={customSenseInput}
                  onChange={(e) => setCustomSenseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customSenseInput.trim()) {
                      const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                      if (!latest) return
                      const updated = {
                        ...latest,
                        senses: [...(latest.senses ?? []), customSenseInput.trim()],
                        updatedAt: new Date().toISOString()
                      } as Character
                      useCharacterStore.getState().saveCharacter(updated)
                      broadcastIfDM(updated)
                      setCustomSenseInput('')
                      setShowSensePicker(false)
                    }
                  }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => {
                    if (!customSenseInput.trim()) return
                    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                    if (!latest) return
                    const updated = {
                      ...latest,
                      senses: [...(latest.senses ?? []), customSenseInput.trim()],
                      updatedAt: new Date().toISOString()
                    } as Character
                    useCharacterStore.getState().saveCharacter(updated)
                    broadcastIfDM(updated)
                    setCustomSenseInput('')
                    setShowSensePicker(false)
                  }}
                  disabled={!customSenseInput.trim()}
                  className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SheetSectionWrapper>
  )
}
