import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExpertiseGrants } from '../../../services/character/build-tree-5e'
import { load5eClassFeatures, load5eFeats, load5eSpells, load5eSubclasses } from '../../../services/data-provider'
import { getSlotProgression, isWarlockPactMagic } from '../../../services/character/spell-data'
import { useLevelUpStore } from '../../../stores/useLevelUpStore'
import type { Character5e } from '../../../types/character-5e'
import type { AbilityName, BuildSlot } from '../../../types/character-common'
import { ABILITY_NAMES } from '../../../types/character-common'
import type { FeatData5e } from '../../../types/data'
import { meetsFeatPrerequisites } from '../../../utils/feat-prerequisites'
import HpRollSection5e from './HpRollSection5e'

interface LevelSection5eProps {
  character: Character5e
  level: number
  slots: BuildSlot[]
  classIdForLevel?: string
  hitDieForLevel?: number
}

interface ClassFeature {
  level: number
  name: string
  description: string
}

export default function LevelSection5e({
  character,
  level,
  slots,
  classIdForLevel,
  hitDieForLevel
}: LevelSection5eProps): JSX.Element {
  const asiSelections = useLevelUpStore((s) => s.asiSelections)
  const setAsiSelection = useLevelUpStore((s) => s.setAsiSelection)
  const generalFeatSelections = useLevelUpStore((s) => s.generalFeatSelections)
  const setGeneralFeatSelection = useLevelUpStore((s) => s.setGeneralFeatSelection)
  const fightingStyleSelection = useLevelUpStore((s) => s.fightingStyleSelection)
  const setFightingStyleSelection = useLevelUpStore((s) => s.setFightingStyleSelection)
  const _setSlotSelection = useLevelUpStore((s) => s.setSlotSelection)
  const [features, setFeatures] = useState<ClassFeature[]>([])

  const epicBoonSelection = useLevelUpStore((s) => s.epicBoonSelection)
  const setEpicBoonSelection = useLevelUpStore((s) => s.setEpicBoonSelection)

  const primalOrderSelection = useLevelUpStore((s) => s.primalOrderSelection)
  const setPrimalOrderSelection = useLevelUpStore((s) => s.setPrimalOrderSelection)
  const divineOrderSelection = useLevelUpStore((s) => s.divineOrderSelection)
  const setDivineOrderSelection = useLevelUpStore((s) => s.setDivineOrderSelection)
  const elementalFurySelection = useLevelUpStore((s) => s.elementalFurySelection)
  const setElementalFurySelection = useLevelUpStore((s) => s.setElementalFurySelection)
  const expertiseSelections = useLevelUpStore((s) => s.expertiseSelections)
  const setExpertiseSelections = useLevelUpStore((s) => s.setExpertiseSelections)

  const asiSlots = slots.filter((s) => s.category === 'ability-boost')
  const epicBoonSlots = slots.filter((s) => s.category === 'epic-boon')
  const fightingStyleSlots = slots.filter((s) => s.category === 'fighting-style')
  const primalOrderSlots = slots.filter((s) => s.category === 'primal-order')
  const divineOrderSlots = slots.filter((s) => s.category === 'divine-order')
  const expertiseSlots = slots.filter((s) => s.category === 'expertise')
  const subclassSlots = slots.filter((s) => s.category === 'class-feat' && s.label === 'Subclass')
  const otherFeatSlots = slots.filter(
    (s) =>
      s.category !== 'ability-boost' &&
      s.category !== 'epic-boon' &&
      s.category !== 'fighting-style' &&
      s.category !== 'primal-order' &&
      s.category !== 'divine-order' &&
      s.category !== 'expertise' &&
      !(s.category === 'class-feat' && s.label === 'Subclass')
  )

  // Load class features for this level
  useEffect(() => {
    const effectiveClassId = classIdForLevel ?? character.buildChoices.classId

    let classLevel = level
    if (classIdForLevel && classIdForLevel !== character.buildChoices.classId) {
      const existingLevel = character.classes.find((c) => c.name.toLowerCase() === classIdForLevel)?.level ?? 0
      classLevel = existingLevel + 1
    }

    load5eClassFeatures()
      .then((data) => {
        const cf = data[effectiveClassId]
        if (cf) {
          setFeatures(cf.features.filter((f) => f.level === classLevel))
        }
      })
      .catch(() => setFeatures([]))
  }, [character, level, classIdForLevel])

  // Check if new spell slot levels are gained at this level
  const newSlotInfo = (() => {
    const className = classIdForLevel ?? character.classes[0]?.name?.toLowerCase() ?? ''
    const currentSlots = getSlotProgression(className, level - 1)
    const newSlots = getSlotProgression(className, level)

    const gained: Array<{ level: number; count: number }> = []
    for (const [lvl, count] of Object.entries(newSlots)) {
      const prev = currentSlots[Number(lvl)] ?? 0
      if (count > prev) {
        gained.push({ level: Number(lvl), count: count - prev })
      }
    }
    return gained.length > 0 ? gained : null
  })()

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold text-amber-400 mb-3">Level {level}</h3>

      <div className="space-y-3">
        {/* HP */}
        <HpRollSection5e character={character} level={level} hitDieOverride={hitDieForLevel} />

        {/* ASI slots with ASI/Feat toggle */}
        {asiSlots.map((slot) => (
          <AsiOrFeatSelector5e
            key={slot.id}
            slot={slot}
            character={character}
            asiSelection={asiSelections[slot.id] ?? []}
            featSelection={generalFeatSelections[slot.id] ?? null}
            onAsiSelect={(abilities) => setAsiSelection(slot.id, abilities)}
            onFeatSelect={(feat) => setGeneralFeatSelection(slot.id, feat)}
          />
        ))}

        {/* Epic Boon slots */}
        {epicBoonSlots.map((slot) => (
          <EpicBoonSelector5e
            key={slot.id}
            slot={slot}
            selection={epicBoonSelection}
            onSelect={setEpicBoonSelection}
            character={character}
          />
        ))}

        {/* Fighting Style slots */}
        {fightingStyleSlots.map((slot) => (
          <FightingStyleSelector5e
            key={slot.id}
            slot={slot}
            character={character}
            selection={fightingStyleSelection}
            onSelect={setFightingStyleSelection}
          />
        ))}

        {/* Primal Order slots (Druid level 1) */}
        {primalOrderSlots.map((slot) => (
          <PrimalOrderSelector5e
            key={slot.id}
            slot={slot}
            selection={primalOrderSelection}
            onSelect={setPrimalOrderSelection}
          />
        ))}

        {/* Divine Order slots (Cleric level 1) */}
        {divineOrderSlots.map((slot) => (
          <DivineOrderSelector5e
            key={slot.id}
            slot={slot}
            selection={divineOrderSelection}
            onSelect={setDivineOrderSelection}
          />
        ))}

        {/* Expertise slots (Rogue/Bard/Wizard) */}
        {expertiseSlots.map((slot) => {
          const effectiveClassId = classIdForLevel ?? character.buildChoices.classId
          const grants = getExpertiseGrants(effectiveClassId)
          // Find the matching grant for this slot's class level
          const existingDruidLevel =
            character.classes.find((c) => c.name.toLowerCase() === effectiveClassId)?.level ?? 0
          const classLevelForSlot =
            classIdForLevel && classIdForLevel !== character.buildChoices.classId ? existingDruidLevel + 1 : slot.level
          const grant = grants.find((g) => g.classLevel === classLevelForSlot) ?? grants[0]
          return (
            <ExpertiseSelector5e
              key={slot.id}
              slot={slot}
              character={character}
              grant={grant}
              selection={expertiseSelections[slot.id] ?? []}
              allExpertiseSelections={expertiseSelections}
              onSelect={(skills) => setExpertiseSelections(slot.id, skills)}
            />
          )
        })}

        {/* Elemental Fury choice (Druid level 7) */}
        {(() => {
          const effectiveClassId = classIdForLevel ?? character.buildChoices.classId
          if (effectiveClassId !== 'druid') return null
          // Check if this level gains Elemental Fury (class level 7)
          const existingDruidLevel = character.classes.find((c) => c.name.toLowerCase() === 'druid')?.level ?? 0
          const newDruidClassLevel =
            classIdForLevel && classIdForLevel !== character.buildChoices.classId
              ? existingDruidLevel + 1
              : existingDruidLevel + (level - character.level)
          if (newDruidClassLevel !== 7) return null
          return <ElementalFurySelector5e selection={elementalFurySelection} onSelect={setElementalFurySelection} />
        })()}

        {/* Subclass slots */}
        {subclassSlots.map((slot) => (
          <SubclassSelector5e key={slot.id} slot={slot} classId={classIdForLevel ?? character.buildChoices.classId} />
        ))}

        {/* Other feat slots */}
        {otherFeatSlots.map((slot) => (
          <div key={slot.id} className="text-sm">
            <span className="text-gray-400">{slot.label}: </span>
            {slot.selectedId ? (
              <span className="text-amber-400">{slot.selectedName}</span>
            ) : (
              <span className="text-gray-500 italic">Not selected</span>
            )}
          </div>
        ))}

        {/* New class features */}
        {features.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">New Features</div>
            {features.map((f, i) => (
              <div key={i} className="text-sm">
                <span className="text-amber-400 font-semibold">{f.name}</span>
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* New spell slots */}
        {newSlotInfo && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {isWarlockPactMagic(classIdForLevel ?? character.classes[0]?.name?.toLowerCase() ?? '')
                ? 'Pact Slot Changes'
                : 'Spell Slot Changes'}
            </div>
            {newSlotInfo.map((info) => (
              <div key={info.level} className="text-sm text-purple-400">
                +{info.count} {info.level}
                {ordinal(info.level)} level slot{info.count > 1 ? 's' : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** ASI/Feat toggle: choose either ASI or a General feat at ASI levels */
function AsiOrFeatSelector5e({
  slot,
  character,
  asiSelection,
  featSelection,
  onAsiSelect,
  onFeatSelect
}: {
  slot: BuildSlot
  character: Character5e
  asiSelection: AbilityName[]
  featSelection: { id: string; name: string; description: string; choices?: Record<string, string | string[]> } | null
  onAsiSelect: (abilities: AbilityName[]) => void
  onFeatSelect: (
    feat: { id: string; name: string; description: string; choices?: Record<string, string | string[]> } | null
  ) => void
}): JSX.Element {
  const [chooseFeat, setChooseFeat] = useState(!!featSelection)

  const handleToggle = (useFeat: boolean): void => {
    setChooseFeat(useFeat)
    if (useFeat) {
      // Clear ASI when switching to feat mode
      onAsiSelect([])
    } else {
      // Clear feat when switching to ASI mode
      onFeatSelect(null)
    }
  }

  const isIncomplete = !featSelection && asiSelection.length === 0

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-400">{slot.label}:</span>
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
        <button
          onClick={() => handleToggle(false)}
          className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
            !chooseFeat ? 'bg-amber-600 text-white' : 'border border-gray-600 text-gray-400'
          }`}
        >
          Ability Score Improvement
        </button>
        <button
          onClick={() => handleToggle(true)}
          className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
            chooseFeat ? 'bg-green-600 text-white' : 'border border-gray-600 text-gray-400'
          }`}
        >
          General Feat
        </button>
      </div>

      {chooseFeat ? (
        <GeneralFeatPicker character={character} selection={featSelection} onSelect={onFeatSelect} />
      ) : (
        <AsiSelector5e slot={slot} character={character} selection={asiSelection} onSelect={onAsiSelect} />
      )}
    </div>
  )
}

function GeneralFeatPicker({
  character,
  selection,
  onSelect
}: {
  character: Character5e
  selection: { id: string; name: string; description: string; choices?: Record<string, string | string[]> } | null
  onSelect: (
    feat: { id: string; name: string; description: string; choices?: Record<string, string | string[]> } | null
  ) => void
}): JSX.Element {
  const [feats, setFeats] = useState<FeatData5e[]>([])
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingChoices, setPendingChoices] = useState<Record<string, string>>({})

  useEffect(() => {
    load5eFeats('General')
      .then(setFeats)
      .catch(() => setFeats([]))
  }, [])

  // Filter out already-taken feats (unless repeatable)
  const takenIds = new Set((character.feats ?? []).map((f) => f.id))
  const filteredFeats = feats.filter((f) => {
    if (takenIds.has(f.id) && !f.repeatable) return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Find the feat data for the current selection (for choice config)
  const selectedFeatData = selection ? feats.find((f) => f.id === selection.id) : null
  const choiceConfig = selectedFeatData?.choiceConfig

  if (selection) {
    return (
      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-2">
        <div className="flex items-center justify-between">
          <span className="text-green-300 font-semibold text-sm">{selection.name}</span>
          <button
            onClick={() => {
              onSelect(null)
              setPendingChoices({})
            }}
            className="text-xs text-gray-500 hover:text-red-400 cursor-pointer"
          >
            Change
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selection.description}</p>
        {choiceConfig &&
          Object.entries(choiceConfig).map(([key, config]) => (
            <div key={key} className="mt-2">
              <label className="text-xs text-amber-300 block mb-1">{config.label}</label>
              <select
                value={pendingChoices[key] ?? (selection.choices?.[key] as string) ?? ''}
                onChange={(e) => {
                  const newChoices = { ...pendingChoices, [key]: e.target.value }
                  setPendingChoices(newChoices)
                  onSelect({ ...selection, choices: { ...selection.choices, [key]: e.target.value } })
                }}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200"
              >
                <option value="">-- Select --</option>
                {config.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-green-400 hover:text-green-300 cursor-pointer"
      >
        {expanded ? 'Hide General Feats' : 'Select a General Feat'}
      </button>
      {expanded && (
        <div className="mt-2">
          <input
            type="text"
            placeholder="Search feats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredFeats.map((feat) => {
              const meetsPrereqs =
                feat.prerequisites.length === 0 || meetsFeatPrerequisites(character, feat.prerequisites)
              return (
                <button
                  key={feat.id}
                  onClick={() => {
                    if (!meetsPrereqs) return
                    onSelect({ id: feat.id, name: feat.name, description: feat.description })
                    setExpanded(false)
                    setSearch('')
                    setPendingChoices({})
                  }}
                  disabled={!meetsPrereqs}
                  className={`w-full text-left border rounded p-2 transition-colors ${
                    meetsPrereqs
                      ? 'bg-gray-800/50 hover:bg-gray-800 border-gray-700 hover:border-green-600 cursor-pointer'
                      : 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="text-sm text-green-300 font-medium">
                    {feat.name}
                    {feat.repeatable && <span className="text-xs text-purple-400 ml-1">*</span>}
                  </div>
                  {feat.prerequisites.length > 0 && (
                    <p className={`text-xs ${meetsPrereqs ? 'text-yellow-500' : 'text-red-400'}`}>
                      Requires: {feat.prerequisites.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{feat.description}</p>
                </button>
              )
            })}
            {filteredFeats.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No matching feats found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AsiSelector5e({
  slot,
  character,
  selection,
  onSelect
}: {
  slot: BuildSlot
  character: Character5e
  selection: AbilityName[]
  onSelect: (abilities: AbilityName[]) => void
}): JSX.Element {
  const [mode, setMode] = useState<'+2' | '+1/+1'>(selection.length === 1 ? '+2' : '+1/+1')

  const handleModeChange = (newMode: '+2' | '+1/+1'): void => {
    setMode(newMode)
    onSelect([])
  }

  const handleAbilityClick = (ability: AbilityName): void => {
    if (mode === '+2') {
      onSelect([ability, ability])
    } else {
      if (selection.includes(ability)) {
        onSelect(selection.filter((a) => a !== ability))
      } else if (selection.length < 2) {
        onSelect([...selection, ability])
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => handleModeChange('+2')}
          className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
            mode === '+2' ? 'bg-amber-600 text-white' : 'border border-gray-600 text-gray-400'
          }`}
        >
          +2 to one
        </button>
        <button
          onClick={() => handleModeChange('+1/+1')}
          className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
            mode === '+1/+1' ? 'bg-amber-600 text-white' : 'border border-gray-600 text-gray-400'
          }`}
        >
          +1 to two
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {ABILITY_NAMES.map((ability) => {
          const score = character.abilityScores[ability]
          const isSelected =
            mode === '+2' ? selection.length >= 2 && selection[0] === ability : selection.includes(ability)
          const atMax = score >= 20

          return (
            <button
              key={ability}
              onClick={() => !atMax && handleAbilityClick(ability)}
              disabled={atMax}
              className={`px-2 py-1 text-xs rounded capitalize transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-amber-600 text-white'
                  : atMax
                    ? 'border border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'border border-gray-600 text-gray-300 hover:border-amber-500 hover:text-amber-400'
              }`}
            >
              {ability.slice(0, 3)} {score}
              {isSelected ? (mode === '+2' ? ' (+2)' : ' (+1)') : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EpicBoonSelector5e({
  slot,
  selection,
  onSelect,
  character
}: {
  slot: BuildSlot
  selection: { id: string; name: string; description: string } | null
  onSelect: (sel: { id: string; name: string; description: string } | null) => void
  character: Character5e
}): JSX.Element {
  const [feats, setFeats] = useState<FeatData5e[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    load5eFeats('Epic Boon')
      .then(setFeats)
      .catch(() => setFeats([]))
  }, [])

  const isIncomplete = !selection

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
        {slot.label}:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      {selection ? (
        <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-purple-300 font-semibold text-sm">{selection.name}</span>
            <button onClick={() => onSelect(null)} className="text-xs text-gray-500 hover:text-red-400 cursor-pointer">
              Change
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selection.description}</p>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
          >
            {expanded ? 'Hide Epic Boons' : 'Select an Epic Boon'}
          </button>
          {expanded && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {feats.map((feat) => {
                const meetsPrereqs = meetsFeatPrerequisites(character, feat.prerequisites)
                return (
                  <button
                    key={feat.id}
                    onClick={() => {
                      if (!meetsPrereqs) return
                      onSelect({ id: feat.id, name: feat.name, description: feat.description })
                      setExpanded(false)
                    }}
                    disabled={!meetsPrereqs}
                    className={`w-full text-left border rounded p-2 transition-colors ${meetsPrereqs ? 'bg-gray-800/50 hover:bg-gray-800 border-gray-700 hover:border-purple-600 cursor-pointer' : 'bg-gray-900/30 border-gray-800 opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="text-sm text-purple-300 font-medium">{feat.name}</div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{feat.description}</p>
                    {!meetsPrereqs && feat.prerequisites.length > 0 && (
                      <p className="text-[10px] text-red-400 mt-0.5">Requires: {feat.prerequisites.join(', ')}</p>
                    )}
                  </button>
                )
              })}
              {feats.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No Epic Boon feats found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SubclassSelector5e({ slot, classId }: { slot: BuildSlot; classId: string }): JSX.Element {
  const setSlotSelection = useLevelUpStore((s) => s.setSlotSelection)
  const [subclasses, setSubclasses] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    load5eSubclasses()
      .then((all) => {
        setSubclasses(all.filter((sc) => sc.class === classId))
      })
      .catch(() => setSubclasses([]))
  }, [classId])

  const isIncomplete = !slot.selectedId

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
        {slot.label}:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      {slot.selectedId ? (
        <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-indigo-300 font-semibold text-sm">{slot.selectedName}</span>
            <button
              onClick={() => setSlotSelection(slot.id, null, null)}
              className="text-xs text-gray-500 hover:text-red-400 cursor-pointer"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            {expanded ? 'Hide Subclasses' : 'Select a Subclass'}
          </button>
          {expanded && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {subclasses.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setSlotSelection(slot.id, sc.id, sc.name)
                    setExpanded(false)
                  }}
                  className="w-full text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-indigo-600 rounded p-2 cursor-pointer transition-colors"
                >
                  <div className="text-sm text-indigo-300 font-medium">{sc.name}</div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sc.description}</p>
                </button>
              ))}
              {subclasses.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No subclasses found for this class.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlessedWarriorCantripPicker(): JSX.Element {
  const blessedWarriorCantrips = useLevelUpStore((s) => s.blessedWarriorCantrips)
  const setBlessedWarriorCantrips = useLevelUpStore((s) => s.setBlessedWarriorCantrips)
  const [allSpells, setAllSpells] = useState<
    Array<{ id: string; name: string; level: number; school?: string; classes?: string[] }>
  >([])

  useEffect(() => {
    load5eSpells()
      .then(setAllSpells)
      .catch(() => setAllSpells([]))
  }, [])

  const clericCantrips = useMemo(
    () =>
      allSpells
        .filter((s) => s.level === 0 && s.classes?.includes('cleric'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allSpells]
  )

  const toggleCantrip = useCallback(
    (id: string) => {
      if (blessedWarriorCantrips.includes(id)) {
        setBlessedWarriorCantrips(blessedWarriorCantrips.filter((c) => c !== id))
      } else if (blessedWarriorCantrips.length < 2) {
        setBlessedWarriorCantrips([...blessedWarriorCantrips, id])
      }
    },
    [blessedWarriorCantrips, setBlessedWarriorCantrips]
  )

  return (
    <div className="mt-2 border border-blue-700/50 rounded-lg bg-blue-900/10 p-2">
      <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">
        Choose 2 Cleric Cantrips ({blessedWarriorCantrips.length}/2)
      </div>
      <div className="max-h-36 overflow-y-auto space-y-0.5">
        {clericCantrips.map((spell) => {
          const selected = blessedWarriorCantrips.includes(spell.id)
          return (
            <button
              key={spell.id}
              onClick={() => toggleCantrip(spell.id)}
              disabled={!selected && blessedWarriorCantrips.length >= 2}
              className={`w-full text-left flex items-center gap-2 px-2 py-0.5 rounded text-xs transition-colors ${
                selected
                  ? 'bg-blue-800/40 text-blue-300'
                  : blessedWarriorCantrips.length >= 2
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-gray-800/50 cursor-pointer'
              }`}
            >
              <span
                className={`w-3 h-3 rounded border flex items-center justify-center text-[9px] shrink-0 ${
                  selected ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600'
                }`}
              >
                {selected && '\u2713'}
              </span>
              {spell.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DruidicWarriorCantripPicker(): JSX.Element {
  const druidicWarriorCantrips = useLevelUpStore((s) => s.druidicWarriorCantrips)
  const setDruidicWarriorCantrips = useLevelUpStore((s) => s.setDruidicWarriorCantrips)
  const [allSpells, setAllSpells] = useState<
    Array<{ id: string; name: string; level: number; school?: string; classes?: string[] }>
  >([])

  useEffect(() => {
    load5eSpells()
      .then(setAllSpells)
      .catch(() => setAllSpells([]))
  }, [])

  const druidCantrips = useMemo(
    () =>
      allSpells
        .filter((s) => s.level === 0 && s.classes?.includes('druid'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allSpells]
  )

  const toggleCantrip = useCallback(
    (id: string) => {
      if (druidicWarriorCantrips.includes(id)) {
        setDruidicWarriorCantrips(druidicWarriorCantrips.filter((c) => c !== id))
      } else if (druidicWarriorCantrips.length < 2) {
        setDruidicWarriorCantrips([...druidicWarriorCantrips, id])
      }
    },
    [druidicWarriorCantrips, setDruidicWarriorCantrips]
  )

  return (
    <div className="mt-2 border border-green-700/50 rounded-lg bg-green-900/10 p-2">
      <div className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">
        Choose 2 Druid Cantrips ({druidicWarriorCantrips.length}/2)
      </div>
      <div className="max-h-36 overflow-y-auto space-y-0.5">
        {druidCantrips.map((spell) => {
          const selected = druidicWarriorCantrips.includes(spell.id)
          return (
            <button
              key={spell.id}
              onClick={() => toggleCantrip(spell.id)}
              disabled={!selected && druidicWarriorCantrips.length >= 2}
              className={`w-full text-left flex items-center gap-2 px-2 py-0.5 rounded text-xs transition-colors ${
                selected
                  ? 'bg-green-800/40 text-green-300'
                  : druidicWarriorCantrips.length >= 2
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-gray-800/50 cursor-pointer'
              }`}
            >
              <span
                className={`w-3 h-3 rounded border flex items-center justify-center text-[9px] shrink-0 ${
                  selected ? 'bg-green-600 border-green-500 text-white' : 'border-gray-600'
                }`}
              >
                {selected && '\u2713'}
              </span>
              {spell.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FightingStyleSelector5e({
  slot,
  character,
  selection,
  onSelect
}: {
  slot: BuildSlot
  character: Character5e
  selection: { id: string; name: string; description: string } | null
  onSelect: (sel: { id: string; name: string; description: string } | null) => void
}): JSX.Element {
  const [feats, setFeats] = useState<FeatData5e[]>([])
  const [expanded, setExpanded] = useState(false)

  const isRanger = character.buildChoices.classId === 'ranger' || character.classes[0]?.name.toLowerCase() === 'ranger'

  useEffect(() => {
    load5eFeats('Fighting Style')
      .then((all) => {
        // Filter class-restricted fighting styles
        const classId = character.buildChoices.classId
        setFeats(all.filter((f) => f.prerequisites.length === 0 || f.prerequisites.includes(classId)))
      })
      .catch(() => setFeats([]))
  }, [character.buildChoices.classId])

  // Filter out already-taken fighting styles
  const takenIds = new Set((character.feats ?? []).map((f) => f.id))
  const available: Array<{ id: string; name: string; description: string }> = [
    ...feats.filter((f) => !takenIds.has(f.id)),
    ...(isRanger
      ? [
          {
            id: 'druidic-warrior',
            name: 'Druidic Warrior',
            description:
              'You learn two Druid cantrips of your choice (Guidance and Starry Wisp are recommended). The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.'
          }
        ]
      : [])
  ]

  const isBlessedWarrior = selection?.id === 'fighting-style-blessed-warrior'
  const isDruidicWarrior = selection?.id === 'druidic-warrior'
  const isIncomplete = !selection

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
        {slot.label}:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      {selection ? (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="text-blue-300 font-semibold text-sm">{selection.name}</span>
            <button onClick={() => onSelect(null)} className="text-xs text-gray-500 hover:text-red-400 cursor-pointer">
              Change
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selection.description}</p>
          {isBlessedWarrior && <BlessedWarriorCantripPicker />}
          {isDruidicWarrior && <DruidicWarriorCantripPicker />}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            {expanded ? 'Hide Fighting Styles' : 'Select a Fighting Style'}
          </button>
          {expanded && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {available.map((feat) => (
                <button
                  key={feat.id}
                  onClick={() => {
                    onSelect({ id: feat.id, name: feat.name, description: feat.description })
                    setExpanded(false)
                  }}
                  className="w-full text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-600 rounded p-2 cursor-pointer transition-colors"
                >
                  <div className="text-sm text-blue-300 font-medium">{feat.name}</div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{feat.description}</p>
                </button>
              ))}
              {available.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No Fighting Style feats available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PrimalOrderSelector5e({
  slot,
  selection,
  onSelect
}: {
  slot: BuildSlot
  selection: 'magician' | 'warden' | null
  onSelect: (sel: 'magician' | 'warden' | null) => void
}): JSX.Element {
  const options: Array<{ id: 'magician' | 'warden'; name: string; description: string }> = [
    {
      id: 'magician',
      name: 'Magician',
      description:
        'You know one extra cantrip from the Primal spell list. Your mystical connection to nature gives you a bonus to Intelligence (Arcana or Nature) checks equal to your Wisdom modifier (min +1).'
    },
    {
      id: 'warden',
      name: 'Warden',
      description: 'Trained for battle, you gain proficiency with Martial weapons and training with Medium armor.'
    }
  ]

  const isIncomplete = !selection

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
        {slot.label}:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(selection === opt.id ? null : opt.id)}
            className={`w-full text-left p-2 rounded border transition-colors ${
              selection === opt.id
                ? 'bg-green-900/30 border-green-600 text-green-300'
                : 'border-gray-700 hover:border-green-600 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <div className="text-sm font-semibold">{opt.name}</div>
            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function DivineOrderSelector5e({
  slot,
  selection,
  onSelect
}: {
  slot: BuildSlot
  selection: 'protector' | 'thaumaturge' | null
  onSelect: (sel: 'protector' | 'thaumaturge' | null) => void
}): JSX.Element {
  const options: Array<{ id: 'protector' | 'thaumaturge'; name: string; description: string }> = [
    {
      id: 'protector',
      name: 'Protector',
      description: 'Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.'
    },
    {
      id: 'thaumaturge',
      name: 'Thaumaturge',
      description:
        'You know one extra cantrip from the Divine spell list. In addition, your mystical connection to the divine gives you a bonus to Intelligence (Religion) checks equal to your Wisdom modifier (minimum bonus of +1).'
    }
  ]

  const isIncomplete = !selection

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
        {slot.label}:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(selection === opt.id ? null : opt.id)}
            className={`w-full text-left p-2 rounded border transition-colors ${
              selection === opt.id
                ? 'bg-yellow-900/30 border-yellow-600 text-yellow-300'
                : 'border-gray-700 hover:border-yellow-600 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <div className="text-sm font-semibold">{opt.name}</div>
            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ElementalFurySelector5e({
  selection,
  onSelect
}: {
  selection: 'potent-spellcasting' | 'primal-strike' | null
  onSelect: (sel: 'potent-spellcasting' | 'primal-strike' | null) => void
}): JSX.Element {
  const options: Array<{ id: 'potent-spellcasting' | 'primal-strike'; name: string; description: string }> = [
    {
      id: 'potent-spellcasting',
      name: 'Potent Spellcasting',
      description: 'Add your Wisdom modifier to the damage you deal with Druid cantrips.'
    },
    {
      id: 'primal-strike',
      name: 'Primal Strike',
      description:
        'Once on each of your turns when you hit a creature with an attack roll using a weapon or an Unarmed Strike, you can cause the target to take an extra 1d8 Cold, Fire, Lightning, or Thunder damage (your choice).'
    }
  ]

  const isIncomplete = !selection

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
        Elemental Fury:
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(selection === opt.id ? null : opt.id)}
            className={`w-full text-left p-2 rounded border transition-colors ${
              selection === opt.id
                ? 'bg-orange-900/30 border-orange-600 text-orange-300'
                : 'border-gray-700 hover:border-orange-600 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <div className="text-sm font-semibold">{opt.name}</div>
            <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ExpertiseSelector5e({
  slot,
  character,
  grant,
  selection,
  allExpertiseSelections,
  onSelect
}: {
  slot: BuildSlot
  character: Character5e
  grant: { count: number; restrictedSkills?: string[]; includeThievesTools?: boolean } | undefined
  selection: string[]
  allExpertiseSelections: Record<string, string[]>
  onSelect: (skills: string[]) => void
}): JSX.Element {
  if (!grant) return <></>

  // Gather already-expertise skills (from character + other slots in this level-up)
  const alreadyExpertise = new Set<string>()
  for (const skill of character.skills) {
    if (skill.expertise) alreadyExpertise.add(skill.name)
  }
  for (const [slotId, skills] of Object.entries(allExpertiseSelections)) {
    if (slotId !== slot.id) {
      for (const s of skills) alreadyExpertise.add(s)
    }
  }

  // Available options: proficient skills not already expertise, optionally restricted
  let options = character.skills.filter((s) => s.proficient && !alreadyExpertise.has(s.name)).map((s) => s.name)

  if (grant.restrictedSkills) {
    options = options.filter((s) => grant.restrictedSkills?.includes(s))
  }

  // Rogue: include Thieves' Tools option
  const toolOptions: string[] = []
  if (grant.includeThievesTools && character.proficiencies.tools.some((t) => t.toLowerCase().includes('thieves'))) {
    if (!alreadyExpertise.has("Thieves' Tools")) {
      toolOptions.push("Thieves' Tools")
    }
  }

  const allOptions = [...options, ...toolOptions]

  const handleToggle = (skill: string): void => {
    if (selection.includes(skill)) {
      onSelect(selection.filter((s) => s !== skill))
    } else if (selection.length < grant.count) {
      onSelect([...selection, skill])
    }
  }

  const label = grant.restrictedSkills ? 'Scholar (Expertise)' : 'Expertise'
  const isIncomplete = selection.length < grant.count

  return (
    <div className={`rounded ${isIncomplete ? 'ring-1 ring-amber-600/50 p-1 -m-1' : ''}`}>
      <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
        <span>
          {label}: Choose {grant.count} skill{grant.count > 1 ? 's' : ''}
        </span>
        <span className={isIncomplete ? 'text-amber-400' : 'text-green-400'}>
          ({selection.length}/{grant.count})
        </span>
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {allOptions.map((skill) => {
          const isSelected = selection.includes(skill)
          return (
            <button
              key={skill}
              onClick={() => handleToggle(skill)}
              className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-cyan-600 text-white'
                  : selection.length >= grant.count
                    ? 'border border-gray-700 text-gray-600 cursor-not-allowed'
                    : 'border border-gray-600 text-gray-300 hover:border-cyan-500 hover:text-cyan-400'
              }`}
            >
              {skill}
            </button>
          )
        })}
        {allOptions.length === 0 && (
          <p className="text-xs text-gray-500 italic">No eligible skills available for expertise.</p>
        )}
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}
