import { useCallback, useEffect, useState } from 'react'
import { ALIGNMENT_DESCRIPTIONS } from '../../../data/alignment-descriptions'
import { rollPersonalityTraits } from '../../../data/personality-tables'
import { VARIANT_ITEMS } from '../../../data/variant-items'
import { load5eBackgrounds, load5eClasses, load5eFeats, loadJson } from '../../../services/data-provider'
import { useBuilderStore } from '../../../stores/useBuilderStore'
import type { FeatData5e } from '../../../types/data'
import SectionBanner from '../shared/SectionBanner'

function TrinketRoller(): JSX.Element {
  const classEquipment = useBuilderStore((s) => s.classEquipment)
  const addEquipmentItem = useBuilderStore((s) => s.addEquipmentItem)

  // Check if a trinket was already rolled (persists across tab switches)
  const existingTrinket = classEquipment.find((e) => e.source === 'trinket')

  const [rollNumber, setRollNumber] = useState<number | null>(null)

  const handleRoll = useCallback(async () => {
    try {
      const trinkets = await loadJson<string[]>('./data/5e/trinkets.json')
      const idx = Math.floor(Math.random() * trinkets.length)
      setRollNumber(idx + 1)
      addEquipmentItem({ name: trinkets[idx], quantity: 1, source: 'trinket' })
    } catch {
      addEquipmentItem({ name: 'A mysterious trinket', quantity: 1, source: 'trinket' })
      setRollNumber(null)
    }
  }, [addEquipmentItem])

  if (existingTrinket) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Your trinket has been rolled.</p>
        <div className="bg-gray-800/60 border border-gray-700 rounded px-3 py-2">
          {rollNumber && <span className="text-xs text-amber-400 font-mono mr-2">d100: {rollNumber}</span>}
          <span className="text-sm text-gray-200">{existingTrinket.name}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Roll a random trinket from the d100 table.</p>
      <button
        onClick={handleRoll}
        className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-gray-900 font-semibold cursor-pointer"
      >
        Roll Trinket
      </button>
    </div>
  )
}

interface VariantItem {
  eqIndex: number
  itemName: string
  key: string
  config: { label: string; variants: string[] }
  chosenVariant: string | null
}

function VariantChoicesSection({
  classEquipment,
  bgEquipment
}: {
  classEquipment: Array<{ name: string; quantity: number; source: string }>
  bgEquipment: Array<{ name: string; quantity: number; source: string }>
}): JSX.Element | null {
  const [rePickKey, setRePickKey] = useState<string | null>(null)

  const variantItems: VariantItem[] = []
  for (let i = 0; i < classEquipment.length; i++) {
    const name = classEquipment[i].name.toLowerCase()
    for (const [key, config] of Object.entries(VARIANT_ITEMS)) {
      const isGeneric = name.includes(key) && !config.variants.some((v) => v.toLowerCase() === name)
      const isChosen = config.variants.some((v) => v.toLowerCase() === name)
      if (isGeneric || isChosen) {
        variantItems.push({
          eqIndex: i,
          itemName: classEquipment[i].name,
          key,
          config,
          chosenVariant: isChosen ? classEquipment[i].name : null
        })
        break
      }
    }
  }
  // Also check background equipment
  for (let i = 0; i < bgEquipment.length; i++) {
    const name = bgEquipment[i].name.toLowerCase()
    for (const [key, config] of Object.entries(VARIANT_ITEMS)) {
      const isGeneric = name.includes(key) && !config.variants.some((v) => v.toLowerCase() === name)
      const isChosen = config.variants.some((v) => v.toLowerCase() === name)
      if (isGeneric || isChosen) {
        variantItems.push({
          eqIndex: -(i + 1), // negative = bg equipment
          itemName: bgEquipment[i].name,
          key,
          config,
          chosenVariant: isChosen ? bgEquipment[i].name : null
        })
        break
      }
    }
  }

  if (variantItems.length === 0) return null

  const handleSelectVariant = (item: VariantItem, variant: string): void => {
    if (item.eqIndex < 0) {
      // Background equipment: compute real index and update bgEquipment
      const realIdx = -(item.eqIndex + 1)
      const currentBg = useBuilderStore.getState().bgEquipment
      useBuilderStore.setState({
        bgEquipment: currentBg.map((e, idx) => (idx === realIdx ? { ...e, name: variant } : e))
      })
    } else {
      useBuilderStore.setState({
        classEquipment: classEquipment.map((e, idx) => (idx === item.eqIndex ? { ...e, name: variant } : e))
      })
    }
    setRePickKey(null)
  }

  return (
    <>
      <SectionBanner label="EQUIPMENT CHOICES" />
      <div className="px-4 py-3 border-b border-gray-800 space-y-3">
        {variantItems.map((item) => {
          const showPicker = !item.chosenVariant || rePickKey === `${item.key}-${item.eqIndex}`
          return (
            <div key={`${item.key}-${item.eqIndex}`}>
              {item.chosenVariant && !showPicker ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-700">
                    {item.config.label}
                  </span>
                  <span className="text-sm text-gray-200 font-medium">{item.chosenVariant}</span>
                  <button
                    onClick={() => setRePickKey(`${item.key}-${item.eqIndex}`)}
                    className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer underline decoration-dotted underline-offset-2 ml-2"
                  >
                    Choose a different one?
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Choose a specific {item.config.label}:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.config.variants.map((variant) => (
                      <button
                        key={variant}
                        onClick={() => handleSelectVariant(item, variant)}
                        className={`px-2.5 py-1 text-xs rounded border cursor-pointer transition-colors ${
                          item.chosenVariant === variant
                            ? 'bg-amber-900/40 border-amber-600 text-amber-300'
                            : 'border-amber-700/50 text-amber-300 hover:bg-amber-900/40'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                  {item.chosenVariant && (
                    <button
                      onClick={() => setRePickKey(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer mt-1"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function DetailsTab5e(): JSX.Element {
  const characterGender = useBuilderStore((s) => s.characterGender)
  const characterDeity = useBuilderStore((s) => s.characterDeity)
  const characterAge = useBuilderStore((s) => s.characterAge)
  const characterHeight = useBuilderStore((s) => s.characterHeight)
  const characterWeight = useBuilderStore((s) => s.characterWeight)
  const characterEyes = useBuilderStore((s) => s.characterEyes)
  const characterHair = useBuilderStore((s) => s.characterHair)
  const characterSkin = useBuilderStore((s) => s.characterSkin)
  const characterAppearance = useBuilderStore((s) => s.characterAppearance)
  const characterNotes = useBuilderStore((s) => s.characterNotes)
  const characterPersonality = useBuilderStore((s) => s.characterPersonality)
  const characterIdeals = useBuilderStore((s) => s.characterIdeals)
  const characterBonds = useBuilderStore((s) => s.characterBonds)
  const characterFlaws = useBuilderStore((s) => s.characterFlaws)
  const characterBackstory = useBuilderStore((s) => s.characterBackstory)
  const characterAlignment = useBuilderStore((s) => s.characterAlignment)
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const backgroundEquipmentChoice = useBuilderStore((s) => s.backgroundEquipmentChoice)
  const classEquipmentChoice = useBuilderStore((s) => s.classEquipmentChoice)
  const versatileFeatId = useBuilderStore((s) => s.versatileFeatId)
  const setVersatileFeat = useBuilderStore((s) => s.setVersatileFeat)
  const classEquipment = useBuilderStore((s) => s.classEquipment)
  const bgEquipment = useBuilderStore((s) => s.bgEquipment)
  const abilityScores = useBuilderStore((s) => s.abilityScores)
  const backgroundAbilityBonuses = useBuilderStore((s) => s.backgroundAbilityBonuses)

  // Load origin feat from selected background
  const backgroundSlot = buildSlots.find((s) => s.category === 'background')
  const backgroundId = backgroundSlot?.selectedId ?? null
  const [originFeat, setOriginFeat] = useState<string | null>(null)
  const [originFeatDescription, setOriginFeatDescription] = useState<string | null>(null)
  const [originFeatExpanded, setOriginFeatExpanded] = useState(false)

  useEffect(() => {
    if (!backgroundId) {
      setOriginFeat(null)
      setOriginFeatDescription(null)
      return
    }
    load5eBackgrounds().then(async (bgs) => {
      const bg = bgs.find((b) => b.id === backgroundId)
      const featName = bg?.originFeat ?? null
      setOriginFeat(featName)
      if (featName) {
        const feats = await load5eFeats('Origin')
        const baseName = featName.replace(/\s*\(.*\)$/, '')
        const match = feats.find((f) => f.name === baseName)
        setOriginFeatDescription(match?.description ?? null)
      } else {
        setOriginFeatDescription(null)
      }
    })
  }, [backgroundId])

  // Determine if species is Human (for Versatile feat)
  const speciesSlot = buildSlots.find((s) => s.category === 'ancestry')
  const isHuman = speciesSlot?.selectedId === 'human'

  // Load Origin feats for Versatile feat picker
  const [originFeats, setOriginFeats] = useState<FeatData5e[]>([])
  useEffect(() => {
    if (!isHuman) {
      setOriginFeats([])
      return
    }
    load5eFeats('Origin').then(setOriginFeats)
  }, [isHuman])

  const selectedVersatileFeat = originFeats.find((f) => f.id === versatileFeatId)

  // Load class equipment options for A/B/C selector
  const classSlot = buildSlots.find((s) => s.category === 'class')
  const classId = classSlot?.selectedId ?? null
  const [classEquipmentOptions, setClassEquipmentOptions] = useState<Record<
    string,
    { label: string; equipment: Array<{ name: string; quantity: number }>; gold: number }
  > | null>(null)

  useEffect(() => {
    if (!classId) {
      setClassEquipmentOptions(null)
      return
    }
    load5eClasses().then((classes) => {
      const cls = classes.find((c) => c.id === classId)
      const options = cls?.startingEquipmentOptions ?? null
      setClassEquipmentOptions(options)
      // Auto-satisfy validation for classes with no equipment options (e.g. Barbarian)
      if (!options) {
        useBuilderStore.getState().setClassEquipmentChoice('default')
      }
    })
  }, [classId])

  const asiSlots = buildSlots.filter((s) => s.category === 'ability-boost')

  return (
    <div>
      {/* CHARACTER DETAILS */}
      <SectionBanner label="CHARACTER DETAILS" />
      <div className="px-4 py-3 space-y-3 border-b border-gray-800">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Gender</label>
            <input
              type="text"
              value={characterGender}
              onChange={(e) => useBuilderStore.setState({ characterGender: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Deity</label>
            <input
              type="text"
              value={characterDeity}
              onChange={(e) => useBuilderStore.setState({ characterDeity: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Age</label>
            <input
              type="text"
              value={characterAge}
              onChange={(e) => useBuilderStore.setState({ characterAge: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Alignment</label>
            <select
              value={characterAlignment}
              onChange={(e) => useBuilderStore.setState({ characterAlignment: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">Not set</option>
              <option value="Lawful Good">Lawful Good</option>
              <option value="Neutral Good">Neutral Good</option>
              <option value="Chaotic Good">Chaotic Good</option>
              <option value="Lawful Neutral">Lawful Neutral</option>
              <option value="Neutral">Neutral</option>
              <option value="Chaotic Neutral">Chaotic Neutral</option>
              <option value="Lawful Evil">Lawful Evil</option>
              <option value="Neutral Evil">Neutral Evil</option>
              <option value="Chaotic Evil">Chaotic Evil</option>
            </select>
            {characterAlignment && ALIGNMENT_DESCRIPTIONS[characterAlignment] && (
              <p className="text-xs text-gray-500 mt-1">{ALIGNMENT_DESCRIPTIONS[characterAlignment]}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Height</label>
            <input
              type="text"
              value={characterHeight}
              onChange={(e) => useBuilderStore.setState({ characterHeight: e.target.value })}
              placeholder="e.g. 5'10&quot;"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Weight</label>
            <input
              type="text"
              value={characterWeight}
              onChange={(e) => useBuilderStore.setState({ characterWeight: e.target.value })}
              placeholder="e.g. 180 lbs"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Eyes</label>
            <input
              type="text"
              value={characterEyes}
              onChange={(e) => useBuilderStore.setState({ characterEyes: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Hair</label>
            <input
              type="text"
              value={characterHair}
              onChange={(e) => useBuilderStore.setState({ characterHair: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Skin</label>
            <input
              type="text"
              value={characterSkin}
              onChange={(e) => useBuilderStore.setState({ characterSkin: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Appearance</label>
          <textarea
            value={characterAppearance}
            onChange={(e) => useBuilderStore.setState({ characterAppearance: e.target.value })}
            placeholder="Describe your character's appearance..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
      </div>

      {/* ORIGIN FEAT */}
      {originFeat && (
        <>
          <SectionBanner label="ORIGIN FEAT" />
          <div className="px-4 py-3 border-b border-gray-800">
            <button
              onClick={() => setOriginFeatExpanded(!originFeatExpanded)}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1 py-0.5 transition-colors w-full text-left"
            >
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                Origin
              </span>
              <span className="text-sm text-gray-200 font-medium">{originFeat}</span>
              <span className="text-xs text-gray-500">(from {backgroundSlot?.selectedName ?? 'Background'})</span>
              <span className="text-gray-600 text-[10px] ml-auto">{originFeatExpanded ? '\u25BE' : '\u25B8'}</span>
            </button>
            {originFeatExpanded && originFeatDescription && (
              <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded px-3 py-2">
                <p className="text-xs text-gray-400">{originFeatDescription}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* HUMAN VERSATILE FEAT */}
      {isHuman && (
        <>
          <SectionBanner label="VERSATILE FEAT (HUMAN)" />
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">As a Human, you gain an additional Origin feat of your choice.</p>
            <select
              value={versatileFeatId ?? ''}
              onChange={(e) => setVersatileFeat(e.target.value || null)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">Select an Origin Feat...</option>
              {originFeats
                .filter((f) => {
                  // Exclude the background's origin feat (by name, ignoring parenthetical)
                  const bgFeatBase = originFeat?.replace(/\s*\(.*\)$/, '')
                  const featBase = f.name.replace(/\s*\(.*\)$/, '')
                  return f.repeatable || featBase !== bgFeatBase
                })
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            {selectedVersatileFeat && (
              <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700">
                    Versatile
                  </span>
                  <span className="text-sm text-gray-200 font-medium">{selectedVersatileFeat.name}</span>
                </div>
                <p className="text-xs text-gray-400">{selectedVersatileFeat.description}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* STARTING EQUIPMENT CHOICE */}
      {backgroundId && backgroundId !== 'custom' && (
        <>
          <SectionBanner label="STARTING EQUIPMENT" />
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Choose your starting equipment from your background:</p>
            <div className="flex gap-2">
              <button
                onClick={() => useBuilderStore.getState().setBackgroundEquipmentChoice('equipment')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium border transition-colors ${
                  backgroundEquipmentChoice === 'equipment'
                    ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                    : backgroundEquipmentChoice === null
                      ? 'bg-gray-800 text-gray-400 border-amber-700/50 hover:border-amber-600'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                Background Equipment
              </button>
              <button
                onClick={() => useBuilderStore.getState().setBackgroundEquipmentChoice('gold')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium border transition-colors ${
                  backgroundEquipmentChoice === 'gold'
                    ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                    : backgroundEquipmentChoice === null
                      ? 'bg-gray-800 text-gray-400 border-amber-700/50 hover:border-amber-600'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                50 GP Instead
              </button>
            </div>
            {backgroundEquipmentChoice === null && (
              <p className="text-xs text-amber-400 mt-2">Please select an option above.</p>
            )}
            {backgroundEquipmentChoice === 'gold' && (
              <p className="text-xs text-gray-500 mt-2">
                Replaces background equipment with 50 GP. Class starting equipment is separate (shown below).
              </p>
            )}
          </div>
        </>
      )}

      {/* CLASS STARTING EQUIPMENT */}
      {classEquipmentOptions && (
        <>
          <SectionBanner label="CLASS STARTING EQUIPMENT" />
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">
              Choose your class starting equipment option:
              {backgroundEquipmentChoice === 'gold' && (
                <span className="text-gray-600 ml-1">(Always included regardless of background choice)</span>
              )}
            </p>
            <div className="flex gap-2">
              {Object.entries(classEquipmentOptions).map(([key, option]) => (
                <button
                  key={key}
                  onClick={() => useBuilderStore.getState().setClassEquipmentChoice(key)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium border transition-colors ${
                    classEquipmentChoice === key
                      ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                      : classEquipmentChoice === null
                        ? 'bg-gray-800 text-gray-400 border-amber-700/50 hover:border-amber-600'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold">Option {key}</div>
                  <div className="text-xs mt-0.5 opacity-75">{option.label}</div>
                </button>
              ))}
            </div>
            {classEquipmentChoice === null && (
              <p className="text-xs text-amber-400 mt-2">Choose one of the options above to continue.</p>
            )}
            {classEquipmentChoice !== null && classEquipmentOptions[classEquipmentChoice] && (
              <div className="mt-2 bg-gray-800/60 border border-gray-700 rounded px-3 py-2">
                <div className="text-xs text-gray-400 space-y-0.5">
                  {classEquipmentOptions[classEquipmentChoice].equipment.length > 0 ? (
                    classEquipmentOptions[classEquipmentChoice].equipment.map((item, i) => (
                      <div key={i}>
                        {item.name}
                        {item.quantity > 1 ? ` (x${item.quantity})` : ''}
                      </div>
                    ))
                  ) : (
                    <div className="text-amber-400">{classEquipmentOptions[classEquipmentChoice].gold} GP</div>
                  )}
                  {classEquipmentOptions[classEquipmentChoice].equipment.length > 0 &&
                    classEquipmentOptions[classEquipmentChoice].gold > 0 && (
                      <div className="text-amber-400 mt-1">+ {classEquipmentOptions[classEquipmentChoice].gold} GP</div>
                    )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* VARIANT CHOICES (Gaming Set, Arcane Focus, etc.) */}
      <VariantChoicesSection classEquipment={classEquipment} bgEquipment={bgEquipment ?? []} />

      {/* ASI HISTORY */}
      {asiSlots.length > 0 && (
        <>
          <SectionBanner label="ASI HISTORY" />
          <div className="border-b border-gray-800">
            {asiSlots.map((slot) => {
              const isConfirmed = slot.selectedId === 'confirmed'
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-mono">
                      Lv {slot.level}
                    </span>
                    {isConfirmed ? (
                      <span className="text-sm text-green-400">{slot.selectedName}</span>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Not chosen</span>
                    )}
                  </div>
                  {isConfirmed ? (
                    <button
                      onClick={() => useBuilderStore.getState().resetAsi(slot.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        useBuilderStore.setState({
                          customModal: 'asi',
                          activeAsiSlotId: slot.id
                        })
                      }
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Choose
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* PERSONALITY & BACKSTORY */}
      <SectionBanner label="PERSONALITY & BACKSTORY" />
      <div className="px-4 py-3 space-y-3 border-b border-gray-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500">Personality</label>
            {buildSlots.find((s) => s.id === 'ability-scores')?.selectedId && (
              <button
                onClick={() => {
                  const traits = rollPersonalityTraits(abilityScores, backgroundAbilityBonuses, characterAlignment)
                  if (traits.length === 0) return
                  const result = traits.join(', ')
                  const current = characterPersonality.trim()
                  const updated = current ? `${current}, ${result}` : result
                  useBuilderStore.setState({ characterPersonality: updated })
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-gray-900 font-semibold cursor-pointer"
              >
                Roll Personality Ideas
              </button>
            )}
          </div>
          <textarea
            value={characterPersonality}
            onChange={(e) => useBuilderStore.setState({ characterPersonality: e.target.value })}
            placeholder="Describe personality traits..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Ideals</label>
          <textarea
            value={characterIdeals}
            onChange={(e) => useBuilderStore.setState({ characterIdeals: e.target.value })}
            placeholder="What drives this character?"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Bonds</label>
          <textarea
            value={characterBonds}
            onChange={(e) => useBuilderStore.setState({ characterBonds: e.target.value })}
            placeholder="Important connections and relationships..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Flaws</label>
          <textarea
            value={characterFlaws}
            onChange={(e) => useBuilderStore.setState({ characterFlaws: e.target.value })}
            placeholder="Weaknesses and vices..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Backstory</label>
          <textarea
            value={characterBackstory}
            onChange={(e) => useBuilderStore.setState({ characterBackstory: e.target.value })}
            placeholder="Write character backstory..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>
      </div>

      {/* TRINKET */}
      <SectionBanner label="TRINKET" />
      <div className="px-4 py-3 border-b border-gray-800">
        <TrinketRoller />
      </div>

      {/* NOTES */}
      <SectionBanner label="NOTES" />
      <div className="px-4 py-3 border-b border-gray-800">
        <textarea
          value={characterNotes}
          onChange={(e) => useBuilderStore.setState({ characterNotes: e.target.value })}
          placeholder="Write character notes here..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
        />
      </div>
    </div>
  )
}
