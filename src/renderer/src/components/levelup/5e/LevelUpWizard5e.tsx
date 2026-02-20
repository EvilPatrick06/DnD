import { useEffect, useState } from 'react'
import { load5eInvocations, load5eMetamagic, loadJson } from '../../../services/data-provider'
import { useLevelUpStore } from '../../../stores/useLevelUpStore'
import type { Character5e } from '../../../types/character-5e'
import { abilityModifier } from '../../../types/character-common'
import type { InvocationData, MetamagicData } from '../../../types/data'
import LevelSection5e from './LevelSection5e'
import SpellSelectionSection5e from './SpellSelectionSection5e'

interface ClassInfo {
  id: string
  name: string
  hitDie: number
  multiclassPrerequisites?: Record<string, number> | { or: Array<Record<string, number>> }
}

interface LevelUpWizard5eProps {
  character: Character5e
}

export default function LevelUpWizard5e({ character }: LevelUpWizard5eProps): JSX.Element {
  const currentLevel = useLevelUpStore((s) => s.currentLevel)
  const targetLevel = useLevelUpStore((s) => s.targetLevel)
  const setTargetLevel = useLevelUpStore((s) => s.setTargetLevel)
  const levelUpSlots = useLevelUpStore((s) => s.levelUpSlots)
  const hpChoices = useLevelUpStore((s) => s.hpChoices)
  const hpRolls = useLevelUpStore((s) => s.hpRolls)
  const asiSelections = useLevelUpStore((s) => s.asiSelections)
  const newSpellIds = useLevelUpStore((s) => s.newSpellIds)
  const classLevelChoices = useLevelUpStore((s) => s.classLevelChoices)
  const setClassLevelChoice = useLevelUpStore((s) => s.setClassLevelChoice)
  const [incompleteChoices, setIncompleteChoices] = useState<string[]>([])
  useEffect(() => {
    const update = (): void => setIncompleteChoices(useLevelUpStore.getState().getIncompleteChoices())
    update()
    return useLevelUpStore.subscribe(update)
  }, [])

  const [allClasses, setAllClasses] = useState<ClassInfo[]>([])

  useEffect(() => {
    loadJson<ClassInfo[]>('./data/5e/classes.json')
      .then(setAllClasses)
      .catch(() => setAllClasses([]))
  }, [])

  // Group slots by level
  const slotsByLevel = new Map<number, typeof levelUpSlots>()
  for (const slot of levelUpSlots) {
    const group = slotsByLevel.get(slot.level) ?? []
    group.push(slot)
    slotsByLevel.set(slot.level, group)
  }

  // Ensure every new level has an entry even without slots
  for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
    if (!slotsByLevel.has(lvl)) slotsByLevel.set(lvl, [])
  }

  // Calculate summary
  const summary = calculateSummary5e(
    character,
    currentLevel,
    targetLevel,
    hpChoices,
    hpRolls,
    asiSelections,
    classLevelChoices,
    allClasses
  )

  return (
    <div className="space-y-6">
      {/* Target level selector */}
      <div className="flex items-center gap-4 bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <label className="text-sm font-semibold text-gray-300">Target Level:</label>
        <select
          value={targetLevel}
          onChange={(e) => setTargetLevel(Number(e.target.value))}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
        >
          {Array.from({ length: 20 - currentLevel }, (_, i) => currentLevel + 1 + i).map((lvl) => (
            <option key={lvl} value={lvl}>
              Level {lvl} {lvl === currentLevel + 1 ? '(+1)' : `(+${lvl - currentLevel})`}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          Level {currentLevel} &rarr; {targetLevel}
        </span>
      </div>

      {/* Per-level sections */}
      {Array.from(slotsByLevel.entries())
        .sort(([a], [b]) => a - b)
        .map(([level, slots]) => {
          const selectedClassId = classLevelChoices[level] ?? character.buildChoices.classId
          const classInfo = allClasses.find((c) => c.id === selectedClassId)

          return (
            <div key={level}>
              {/* Class selector for multiclass */}
              {allClasses.length > 1 && (
                <ClassLevelSelector
                  character={character}
                  level={level}
                  allClasses={allClasses}
                  selectedClassId={selectedClassId}
                  onSelect={(classId) => setClassLevelChoice(level, classId)}
                />
              )}
              <LevelSection5e
                character={character}
                level={level}
                slots={slots}
                classIdForLevel={selectedClassId}
                hitDieForLevel={classInfo?.hitDie}
              />
            </div>
          )
        })}

      {/* Spell selection */}
      <SpellSelectionSection5e character={character} targetLevel={targetLevel} />

      {/* Invocation selection (Warlock) */}
      <InvocationSection5e character={character} targetLevel={targetLevel} classLevelChoices={classLevelChoices} />

      {/* Metamagic selection (Sorcerer) */}
      <MetamagicSection5e character={character} targetLevel={targetLevel} classLevelChoices={classLevelChoices} />

      {/* Summary bar */}
      <div
        className={`bg-gray-900 border rounded-lg p-4 sticky bottom-0 ${incompleteChoices.length > 0 ? 'border-amber-600/50' : 'border-gray-700'}`}
      >
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <span className="text-gray-400">
            Level <span className="text-amber-400 font-bold">{currentLevel}</span> &rarr;{' '}
            <span className="text-amber-400 font-bold">{targetLevel}</span>
          </span>
          <span className="text-gray-400">
            HP:{' '}
            <span className="text-green-400 font-bold">
              {character.hitPoints.maximum} &rarr; {summary.newMaxHP}
            </span>
          </span>
          {summary.asiChanges.length > 0 && (
            <span className="text-gray-400">
              {summary.asiChanges.map((c, i) => (
                <span key={i} className="text-purple-400">
                  {i > 0 ? ', ' : ''}
                  {c}
                </span>
              ))}
            </span>
          )}
          {newSpellIds.length > 0 && (
            <span className="text-gray-400">
              +<span className="text-blue-400 font-bold">{newSpellIds.length}</span> spell
              {newSpellIds.length !== 1 ? 's' : ''}
            </span>
          )}
          {incompleteChoices.length > 0 && (
            <span className="text-amber-400 font-semibold ml-auto">
              {incompleteChoices.length} choice{incompleteChoices.length !== 1 ? 's' : ''} remaining
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function meetsPrerequisites(
  character: Character5e,
  prereqs: Record<string, number> | { or: Array<Record<string, number>> } | undefined
): boolean {
  if (!prereqs) return true
  if ('or' in prereqs && Array.isArray(prereqs.or)) {
    return prereqs.or.some((req: Record<string, number>) => meetsPrerequisites(character, req))
  }
  for (const [ability, minScore] of Object.entries(prereqs)) {
    if (ability === 'or') continue
    const score = character.abilityScores[ability as keyof typeof character.abilityScores]
    if (score === undefined || score < (minScore as number)) return false
  }
  return true
}

function ClassLevelSelector({
  character,
  level,
  allClasses,
  selectedClassId,
  onSelect
}: {
  character: Character5e
  level: number
  allClasses: ClassInfo[]
  selectedClassId: string
  onSelect: (classId: string) => void
}): JSX.Element {
  // Current class is always available
  const currentClassIds = new Set(character.classes.map((c) => c.name.toLowerCase()))
  currentClassIds.add(character.buildChoices.classId)

  // Check prerequisites for new classes
  const eligibleClasses = allClasses.filter((cls) => {
    if (currentClassIds.has(cls.id)) return true
    return meetsPrerequisites(character, cls.multiclassPrerequisites)
  })

  const isMulticlass = selectedClassId !== character.buildChoices.classId

  return (
    <div
      className={`flex items-center gap-2 mb-1 px-1 py-1 rounded ${isMulticlass ? 'bg-purple-900/20 border border-purple-700/30' : ''}`}
    >
      <span className="text-xs text-gray-500">Class:</span>
      <select
        value={selectedClassId}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
      >
        {eligibleClasses.map((cls) => (
          <option key={cls.id} value={cls.id}>
            {cls.name} (d{cls.hitDie}){!currentClassIds.has(cls.id) ? ' [NEW]' : ''}
          </option>
        ))}
      </select>
      {isMulticlass && <span className="text-xs text-purple-400">Multiclass</span>}
    </div>
  )
}

function calculateSummary5e(
  character: Character5e,
  currentLevel: number,
  targetLevel: number,
  hpChoices: Record<number, string>,
  hpRolls: Record<number, number>,
  asiSelections: Record<string, string[]>,
  classLevelChoices: Record<number, string>,
  allClasses: ClassInfo[]
): {
  newMaxHP: number
  asiChanges: string[]
} {
  const conMod = abilityModifier(character.abilityScores.constitution)

  // Calculate new CON mod after ASIs
  let conIncrease = 0
  for (const abilities of Object.values(asiSelections)) {
    for (const ab of abilities) {
      if (ab === 'constitution') conIncrease++
    }
  }
  const newConScore = Math.min(20, character.abilityScores.constitution + conIncrease)
  const newConMod = abilityModifier(newConScore)

  let hpGain = 0
  for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
    const levelClassId = classLevelChoices[lvl] ?? character.buildChoices.classId
    const classInfo = allClasses.find((c) => c.id === levelClassId)
    const hitDie = classInfo?.hitDie ?? character.classes[0]?.hitDie ?? 8

    let dieResult: number
    if (hpChoices[lvl] === 'roll' && hpRolls[lvl] !== undefined) {
      dieResult = hpRolls[lvl]
    } else {
      dieResult = Math.floor(hitDie / 2) + 1
    }
    hpGain += Math.max(1, dieResult + newConMod)
  }

  const retroactive = (newConMod - conMod) * targetLevel
  const newMaxHP = character.hitPoints.maximum + hpGain + retroactive

  const asiChanges: string[] = []
  const abCounts: Record<string, number> = {}
  for (const abilities of Object.values(asiSelections)) {
    for (const ab of abilities) {
      abCounts[ab] = (abCounts[ab] ?? 0) + 1
    }
  }
  for (const [ab, count] of Object.entries(abCounts)) {
    asiChanges.push(`+${count} ${ab.slice(0, 3).toUpperCase()}`)
  }

  return { newMaxHP, asiChanges }
}

// Warlock invocation count by Warlock class level (2024 PHB)
const INVOCATION_COUNT: Record<number, number> = {
  1: 1,
  2: 3,
  3: 3,
  4: 3,
  5: 5,
  6: 5,
  7: 6,
  8: 6,
  9: 7,
  10: 7,
  11: 7,
  12: 8,
  13: 8,
  14: 8,
  15: 9,
  16: 9,
  17: 9,
  18: 10,
  19: 10,
  20: 10
}

function getWarlockClassLevel(
  character: Character5e,
  targetLevel: number,
  classLevelChoices: Record<number, string>
): number {
  const existingWarlockLevel = character.classes.find((c) => c.name.toLowerCase() === 'warlock')?.level ?? 0
  let newWarlockLevels = 0
  for (let lvl = character.level + 1; lvl <= targetLevel; lvl++) {
    if ((classLevelChoices[lvl] ?? character.buildChoices.classId) === 'warlock') {
      newWarlockLevels++
    }
  }
  return existingWarlockLevel + newWarlockLevels
}

function InvocationSection5e({
  character,
  targetLevel,
  classLevelChoices
}: {
  character: Character5e
  targetLevel: number
  classLevelChoices: Record<number, string>
}): JSX.Element | null {
  const invocationSelections = useLevelUpStore((s) => s.invocationSelections)
  const setInvocationSelections = useLevelUpStore((s) => s.setInvocationSelections)
  const [allInvocations, setAllInvocations] = useState<InvocationData[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    load5eInvocations()
      .then(setAllInvocations)
      .catch(() => setAllInvocations([]))
  }, [])

  const warlockLevel = getWarlockClassLevel(character, targetLevel, classLevelChoices)
  if (warlockLevel === 0) return null

  const maxInvocations = INVOCATION_COUNT[warlockLevel] ?? 0
  if (maxInvocations === 0) return null

  // Count how many times each invocation is selected (for repeatable)
  const selectionCounts = new Map<string, number>()
  for (const id of invocationSelections) {
    selectionCounts.set(id, (selectionCounts.get(id) ?? 0) + 1)
  }

  const atMax = invocationSelections.length >= maxInvocations

  // Filter by level requirement and prerequisites
  const eligible = allInvocations.filter((inv) => {
    if (inv.levelRequirement > warlockLevel) return false
    if (inv.prerequisites?.invocation && !invocationSelections.includes(inv.prerequisites.invocation)) return false
    if (search && !inv.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const addInvocation = (id: string): void => {
    if (!atMax) setInvocationSelections([...invocationSelections, id])
  }

  const removeOneInvocation = (id: string): void => {
    // Remove dependents that require this invocation (if removing last instance)
    const count = selectionCounts.get(id) ?? 0
    let result = [...invocationSelections]
    if (count <= 1) {
      const dependents = new Set(
        allInvocations.filter((inv) => inv.prerequisites?.invocation === id).map((inv) => inv.id)
      )
      result = result.filter((s) => !dependents.has(s))
    }
    // Remove one instance (last occurrence)
    const lastIdx = result.lastIndexOf(id)
    if (lastIdx !== -1) result.splice(lastIdx, 1)
    setInvocationSelections(result)
  }

  const handleClick = (inv: InvocationData): void => {
    const count = selectionCounts.get(inv.id) ?? 0
    if (count === 0) {
      addInvocation(inv.id)
    } else if (inv.repeatable) {
      // Repeatable and already selected: add another if room
      if (!atMax) addInvocation(inv.id)
    } else {
      // Non-repeatable: toggle off
      removeOneInvocation(inv.id)
    }
  }

  const getPrereqLabel = (inv: InvocationData): string | null => {
    if (!inv.prerequisites) return null
    if (inv.prerequisites.cantrip) return inv.prerequisites.cantrip
    if (inv.prerequisites.invocation) return inv.prerequisites.invocation
    if (inv.prerequisites.requiresDamageCantrip) return 'a damage cantrip'
    if (inv.prerequisites.requiresAttackRollCantrip) return 'an attack roll cantrip'
    return null
  }

  const isIncomplete = invocationSelections.length < maxInvocations

  return (
    <div className={`bg-gray-900/50 border rounded-lg p-4 ${isIncomplete ? 'border-amber-600/50' : 'border-gray-800'}`}>
      <h3 className="text-lg font-bold text-purple-400 mb-1 flex items-center gap-2">
        Eldritch Invocations
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </h3>
      <p className={`text-xs mb-3 ${isIncomplete ? 'text-amber-400' : 'text-gray-500'}`}>
        Warlock Level {warlockLevel}: {invocationSelections.length}/{maxInvocations} invocations known
      </p>
      <input
        type="text"
        placeholder="Search invocations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 mb-3"
      />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {eligible.map((inv) => {
          const count = selectionCounts.get(inv.id) ?? 0
          const selected = count > 0
          const _canAdd = !atMax || selected
          const disabled = !selected && atMax

          return (
            <button
              key={inv.id}
              onClick={() => !disabled && handleClick(inv)}
              disabled={disabled}
              className={`w-full text-left p-2 rounded border transition-colors ${
                selected
                  ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                  : disabled
                    ? 'border-gray-700/50 text-gray-600 cursor-not-allowed'
                    : 'border-gray-700 hover:border-purple-600 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">
                  {inv.name}
                  {inv.isPactBoon && <span className="text-xs text-amber-400 ml-1">(Pact Boon)</span>}
                  {inv.repeatable && <span className="text-xs text-cyan-400 ml-1">(Repeatable)</span>}
                  {count > 1 && <span className="text-xs text-purple-300 ml-1">x{count}</span>}
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  {selected && inv.repeatable && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeOneInvocation(inv.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          removeOneInvocation(inv.id)
                        }
                      }}
                      className="text-xs text-gray-400 hover:text-red-400 px-1 cursor-pointer"
                      title="Remove one"
                    >
                      &minus;
                    </span>
                  )}
                  {inv.levelRequirement > 0 && (
                    <span className="text-xs text-gray-500">Lv {inv.levelRequirement}+</span>
                  )}
                </div>
              </div>
              {inv.prerequisites && <p className="text-xs text-yellow-500 mt-0.5">Requires: {getPrereqLabel(inv)}</p>}
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{inv.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Sorcerer metamagic count by Sorcerer class level (2024 PHB): 2 at Lv2, 4 at Lv10, 6 at Lv17
function getMetamagicCount(sorcererLevel: number): number {
  if (sorcererLevel >= 17) return 6
  if (sorcererLevel >= 10) return 4
  if (sorcererLevel >= 2) return 2
  return 0
}

function getSorcererClassLevel(
  character: Character5e,
  targetLevel: number,
  classLevelChoices: Record<number, string>
): number {
  const existingSorcererLevel = character.classes.find((c) => c.name.toLowerCase() === 'sorcerer')?.level ?? 0
  let newSorcererLevels = 0
  for (let lvl = character.level + 1; lvl <= targetLevel; lvl++) {
    if ((classLevelChoices[lvl] ?? character.buildChoices.classId) === 'sorcerer') {
      newSorcererLevels++
    }
  }
  return existingSorcererLevel + newSorcererLevels
}

function MetamagicSection5e({
  character,
  targetLevel,
  classLevelChoices
}: {
  character: Character5e
  targetLevel: number
  classLevelChoices: Record<number, string>
}): JSX.Element | null {
  const metamagicSelections = useLevelUpStore((s) => s.metamagicSelections)
  const setMetamagicSelections = useLevelUpStore((s) => s.setMetamagicSelections)
  const [allMetamagic, setAllMetamagic] = useState<MetamagicData[]>([])

  useEffect(() => {
    load5eMetamagic()
      .then(setAllMetamagic)
      .catch(() => setAllMetamagic([]))
  }, [])

  const sorcererLevel = getSorcererClassLevel(character, targetLevel, classLevelChoices)
  if (sorcererLevel < 2) return null

  const maxOptions = getMetamagicCount(sorcererLevel)

  const toggleMetamagic = (id: string): void => {
    if (metamagicSelections.includes(id)) {
      setMetamagicSelections(metamagicSelections.filter((s) => s !== id))
    } else if (metamagicSelections.length < maxOptions) {
      setMetamagicSelections([...metamagicSelections, id])
    }
  }

  const isIncomplete = metamagicSelections.length < maxOptions

  return (
    <div className={`bg-gray-900/50 border rounded-lg p-4 ${isIncomplete ? 'border-amber-600/50' : 'border-gray-800'}`}>
      <h3 className="text-lg font-bold text-red-400 mb-1 flex items-center gap-2">
        Metamagic Options
        {isIncomplete && <span className="text-[10px] text-amber-500 font-semibold uppercase">Required</span>}
      </h3>
      <p className={`text-xs mb-3 ${isIncomplete ? 'text-amber-400' : 'text-gray-500'}`}>
        Sorcerer Level {sorcererLevel}: {metamagicSelections.length}/{maxOptions} options known
      </p>
      <div className="space-y-1">
        {allMetamagic.map((mm) => {
          const selected = metamagicSelections.includes(mm.id)
          const atMax = !selected && metamagicSelections.length >= maxOptions

          return (
            <button
              key={mm.id}
              onClick={() => !atMax && toggleMetamagic(mm.id)}
              disabled={atMax}
              className={`w-full text-left p-2 rounded border transition-colors ${
                selected
                  ? 'bg-red-900/30 border-red-600 text-red-300'
                  : atMax
                    ? 'border-gray-700/50 text-gray-600 cursor-not-allowed'
                    : 'border-gray-700 hover:border-red-600 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{mm.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{mm.sorceryPointCost} SP</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mm.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
