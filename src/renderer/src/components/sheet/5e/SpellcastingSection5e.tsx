import { useState } from 'react'
import {
  computeSpellcastingInfo,
  FULL_CASTERS_5E,
  getCantripsKnown,
  getPreparedSpellMax,
  HALF_CASTERS_5E,
  isMulticlassSpellcaster,
  isWarlockPactMagic
} from '../../../services/spell-data'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useGameStore } from '../../../stores/useGameStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { SpellEntry } from '../../../types/character-common'
import { abilityModifier } from '../../../types/character-common'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

interface SpellcastingSection5eProps {
  character: Character5e
  readonly?: boolean
}

interface SpellRowProps {
  spell: SpellEntry
  readonly?: boolean
  preparedSpellIds: string[]
  onTogglePrepared?: (spellId: string) => void
  onToggleInnateUse?: (spellId: string) => void
  onCastRitual?: (spell: SpellEntry) => void
  onConcentrationWarning?: (spell: SpellEntry) => void
  isCantrip: boolean
  proficiencyBonus?: number
  isConcentrating?: boolean
}

function SpellRow({
  spell,
  readonly,
  preparedSpellIds,
  onTogglePrepared,
  onToggleInnateUse,
  onCastRitual,
  onConcentrationWarning,
  isCantrip,
  proficiencyBonus,
  isConcentrating
}: SpellRowProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isPrepared = preparedSpellIds.includes(spell.id)
  const isSpecies = spell.source === 'species' || spell.id.startsWith('species-')
  const hasInnateUses = spell.innateUses && spell.innateUses.max !== 0
  // Resolve PB-based innate uses (max === -1 means proficiency bonus uses)
  const innateMax = hasInnateUses
    ? spell.innateUses?.max === -1
      ? (proficiencyBonus ?? 2)
      : (spell.innateUses?.max ?? 0)
    : 0
  const innateRemaining = hasInnateUses
    ? spell.innateUses?.remaining === -1
      ? (proficiencyBonus ?? 2)
      : (spell.innateUses?.remaining ?? 0)
    : 0

  return (
    <div className="border-b border-gray-800 last:border-0">
      <div className="flex items-center">
        {!isCantrip && !isSpecies && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!readonly && onTogglePrepared) {
                onTogglePrepared(spell.id)
              }
            }}
            disabled={readonly}
            className={`flex-shrink-0 w-4 h-4 ml-2 rounded border transition-colors ${
              isPrepared ? 'bg-amber-500 border-amber-400' : 'border-gray-600 bg-gray-800'
            } ${readonly ? 'opacity-50 cursor-default' : 'cursor-pointer hover:border-amber-500'}`}
            title={isPrepared ? 'Unprepare spell' : 'Prepare spell'}
          >
            {isPrepared && (
              <svg className="w-4 h-4 text-gray-900" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between px-2 py-1.5 hover:bg-gray-800/50 transition-colors text-left text-sm"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-200">{spell.name}</span>
            {isSpecies && (
              <span className="text-[10px] text-purple-400 border border-purple-700 rounded px-1">Species</span>
            )}
            {spell.concentration && (
              <span className="text-[10px] text-yellow-500 border border-yellow-700 rounded px-1">C</span>
            )}
            {spell.ritual && <span className="text-[10px] text-blue-400 border border-blue-700 rounded px-1">R</span>}
            {spell.components?.includes('M') && (
              <span
                className="text-[10px] text-emerald-400 border border-emerald-700 rounded px-1"
                title={(() => {
                  const m = spell.components.match(/M\s*\(([^)]+)\)/)
                  return m ? `Material: ${m[1]}` : 'Material component required'
                })()}
              >
                M
              </span>
            )}
            {/* Innate use pips */}
            {hasInnateUses && innateMax > 0 && (
              <div className="flex gap-0.5 ml-1">
                {Array.from({ length: innateMax }, (_, i) => {
                  const isFilled = i < innateRemaining
                  return (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!readonly && onToggleInnateUse) onToggleInnateUse(spell.id)
                      }}
                      disabled={readonly}
                      className={`w-3 h-3 rounded-full border transition-colors ${
                        isFilled ? 'bg-purple-500 border-purple-400' : 'border-gray-600 bg-gray-800'
                      } ${readonly ? 'cursor-default' : 'cursor-pointer hover:border-purple-400'}`}
                      title={isFilled ? 'Use innate casting' : 'Restore innate casting'}
                    />
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{spell.castingTime}</span>
            <span>{spell.range}</span>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-gray-400 space-y-1">
          <div className="flex gap-3 text-gray-500">
            <span>Duration: {spell.duration}</span>
            <span>Components: {spell.components}</span>
            {spell.school && <span>School: {spell.school}</span>}
          </div>
          <p className="leading-relaxed whitespace-pre-wrap">{spell.description}</p>
          {!readonly && !isCantrip && (
            <div className="flex gap-2 pt-1">
              {spell.ritual && onCastRitual && (
                <button
                  onClick={() => onCastRitual(spell)}
                  className="px-2 py-0.5 rounded bg-blue-700/50 text-blue-300 hover:bg-blue-600/50 cursor-pointer text-[10px] transition-colors"
                  title="Cast as ritual (no spell slot, +10 min casting time)"
                >
                  Cast as Ritual
                </button>
              )}
              {spell.concentration && isConcentrating && onConcentrationWarning && (
                <button
                  onClick={() => onConcentrationWarning(spell)}
                  className="px-2 py-0.5 rounded bg-yellow-700/50 text-yellow-300 hover:bg-yellow-600/50 cursor-pointer text-[10px] transition-colors"
                  title="You are already concentrating — casting this will end your current concentration"
                >
                  Cast (Drop Concentration)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SpellcastingSection5e({ character, readonly }: SpellcastingSection5eProps): JSX.Element {
  const knownSpells: SpellEntry[] = character.knownSpells ?? []
  const spellSlotLevels = character.spellSlotLevels ?? {}
  const pactMagicSlotLevels = character.pactMagicSlotLevels ?? {}
  const preparedSpellIds: string[] = character.preparedSpellIds ?? []
  const proficiencyBonus = Math.floor((character.level - 1) / 4) + 2
  const [ritualMessage, setRitualMessage] = useState<string | null>(null)
  const [concentrationConfirm, setConcentrationConfirm] = useState<SpellEntry | null>(null)

  // Check if character is currently concentrating (via game store turn states)
  const turnState = useGameStore((s) => s.getTurnState(character.id))
  const isConcentrating = !!turnState?.concentratingSpell

  const hasWarlock = character.classes.some((c) => isWarlockPactMagic(c.name.toLowerCase()))
  const hasNonWarlockCaster = character.classes.some((c) => {
    const id = c.name.toLowerCase()
    return id !== 'warlock' && (FULL_CASTERS_5E.includes(id) || HALF_CASTERS_5E.includes(id))
  })
  // Single-class warlock: pact magic slots are in spellSlotLevels
  // Multiclass warlock+caster: pact magic in pactMagicSlotLevels, regular in spellSlotLevels
  const isPureWarlock = hasWarlock && !hasNonWarlockCaster

  const hasCasting =
    !!character.spellcasting ||
    knownSpells.length > 0 ||
    !!computeSpellcastingInfo(
      character.classes.map((c) => ({
        classId: c.name.toLowerCase(),
        subclassId: c.subclass?.toLowerCase(),
        level: c.level
      })),
      character.abilityScores,
      character.level,
      character.buildChoices.classId,
      character.buildChoices.subclassId
    )

  if (!hasCasting && Object.keys(spellSlotLevels).length === 0 && Object.keys(pactMagicSlotLevels).length === 0) {
    return <></>
  }

  // Group spells by level
  const spellsByLevel = new Map<number, SpellEntry[]>()
  for (const spell of knownSpells) {
    const group = spellsByLevel.get(spell.level) ?? []
    group.push(spell)
    spellsByLevel.set(spell.level, group)
  }

  // Count prepared non-cantrip spells
  const preparedCount = knownSpells.filter((s) => s.level > 0 && preparedSpellIds.includes(s.id)).length

  function getLatestCharacter(): Character {
    return useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
  }

  function handleSlotClick(level: number, _circleIndex: number, isFilled: boolean): void {
    if (readonly) return
    const latest = getLatestCharacter()
    const currentSlots = latest.spellSlotLevels?.[level]
    if (!currentSlots) return

    let newCurrent: number
    if (isFilled) {
      newCurrent = Math.max(0, currentSlots.current - 1)
    } else {
      newCurrent = Math.min(currentSlots.max, currentSlots.current + 1)
    }

    const updatedSlots = {
      ...latest.spellSlotLevels,
      [level]: { ...currentSlots, current: newCurrent }
    }
    const updated = { ...latest, spellSlotLevels: updatedSlots, updatedAt: new Date().toISOString() } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  function handlePactSlotClick(level: number, _circleIndex: number, isFilled: boolean): void {
    if (readonly) return
    const latest = getLatestCharacter() as Character5e
    const currentSlots = latest.pactMagicSlotLevels?.[level]
    if (!currentSlots) return

    let newCurrent: number
    if (isFilled) {
      newCurrent = Math.max(0, currentSlots.current - 1)
    } else {
      newCurrent = Math.min(currentSlots.max, currentSlots.current + 1)
    }

    const updatedPactSlots = {
      ...latest.pactMagicSlotLevels,
      [level]: { ...currentSlots, current: newCurrent }
    }
    const updated = {
      ...latest,
      pactMagicSlotLevels: updatedPactSlots,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  function handleTogglePrepared(spellId: string): void {
    if (readonly) return
    const latest = getLatestCharacter()
    const currentPrepared = latest.preparedSpellIds ?? []
    let updatedPrepared: string[]
    if (currentPrepared.includes(spellId)) {
      updatedPrepared = currentPrepared.filter((id) => id !== spellId)
    } else {
      updatedPrepared = [...currentPrepared, spellId]
    }
    const updated = { ...latest, preparedSpellIds: updatedPrepared, updatedAt: new Date().toISOString() } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  function handleInnateUseClick(spellId: string): void {
    if (readonly) return
    const latest = getLatestCharacter() as Character5e
    const updatedSpells = (latest.knownSpells ?? []).map((s) => {
      if (s.id !== spellId || !s.innateUses) return s
      const remaining = s.innateUses.remaining
      const max = s.innateUses.max
      // Toggle: if remaining > 0, use one; if 0, restore one
      if (remaining > 0 || (remaining === -1 && max === -1)) {
        return {
          ...s,
          innateUses: {
            ...s.innateUses,
            remaining: Math.max(0, (remaining === -1 ? (proficiencyBonus ?? 2) : remaining) - 1)
          }
        }
      } else {
        const resolvedMax = max === -1 ? (proficiencyBonus ?? 2) : max
        return { ...s, innateUses: { ...s.innateUses, remaining: Math.min(resolvedMax, remaining + 1) } }
      }
    })
    const updated = { ...latest, knownSpells: updatedSpells, updatedAt: new Date().toISOString() } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  function handleLongRest(): void {
    if (readonly) return
    const latest = getLatestCharacter() as Character5e
    const currentSlots = latest.spellSlotLevels ?? {}

    const restoredSlots: Record<number, { current: number; max: number }> = {}
    for (const [level, slots] of Object.entries(currentSlots)) {
      restoredSlots[Number(level)] = { current: slots.max, max: slots.max }
    }

    // Also restore pact magic slots
    const currentPactSlots = latest.pactMagicSlotLevels ?? {}
    const restoredPactSlots: Record<number, { current: number; max: number }> = {}
    for (const [level, slots] of Object.entries(currentPactSlots)) {
      restoredPactSlots[Number(level)] = { current: slots.max, max: slots.max }
    }

    // Restore innate spell uses
    const restoredSpells = (latest.knownSpells ?? []).map((s) => {
      if (!s.innateUses) return s
      return { ...s, innateUses: { max: s.innateUses.max, remaining: s.innateUses.max } }
    })

    const updated = {
      ...latest,
      spellSlotLevels: restoredSlots,
      knownSpells: restoredSpells,
      ...(Object.keys(restoredPactSlots).length > 0 ? { pactMagicSlotLevels: restoredPactSlots } : {}),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  function handleCastRitual(spell: SpellEntry): void {
    setRitualMessage(`Casting ${spell.name} as a ritual (10 minutes, no slot used).`)
    setTimeout(() => setRitualMessage(null), 4000)
  }

  function handleConcentrationWarning(spell: SpellEntry): void {
    setConcentrationConfirm(spell)
  }

  function confirmConcentrationSwitch(): void {
    if (!concentrationConfirm) return
    // Drop current concentration and set new one
    useGameStore.getState().setConcentrating(character.id, concentrationConfirm.name)
    setConcentrationConfirm(null)
  }

  return (
    <SheetSectionWrapper title="Spellcasting">
      {/* Ritual casting message */}
      {ritualMessage && (
        <div className="mb-3 text-xs bg-blue-900/30 border border-blue-700/50 rounded px-3 py-2 text-blue-300">
          {ritualMessage}
        </div>
      )}

      {/* Concentration switch confirm dialog */}
      {concentrationConfirm && (
        <div className="mb-3 bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2">
          <p className="text-xs text-yellow-300 mb-2">
            You are concentrating on <strong>{turnState?.concentratingSpell}</strong>. Casting{' '}
            <strong>{concentrationConfirm.name}</strong> will end that concentration. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmConcentrationSwitch}
              className="px-2 py-0.5 text-[10px] rounded bg-yellow-600 text-white hover:bg-yellow-500 cursor-pointer"
            >
              Yes, Switch
            </button>
            <button
              onClick={() => setConcentrationConfirm(null)}
              className="px-2 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Restore Slots button */}
      {!readonly && Object.keys(spellSlotLevels).length > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={handleLongRest}
            className="text-xs px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-gray-900 font-semibold transition-colors"
          >
            Restore Slots
          </button>
        </div>
      )}

      {/* Spell slots */}
      {Object.keys(spellSlotLevels).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {isPureWarlock ? 'Pact Magic Slots' : 'Spell Slots'}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(spellSlotLevels)
              .filter(([level]) => Number(level) > 0)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, slots]) => (
                <div
                  key={level}
                  className={`rounded px-2 py-1.5 ${isPureWarlock ? 'bg-purple-900/30' : 'bg-gray-800/50'}`}
                >
                  <div className="text-[10px] text-gray-500 text-center mb-1">
                    {`${level}${ordinal(Number(level))}`}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: slots.max }, (_, i) => {
                      const isFilled = i < slots.current
                      return (
                        <button
                          key={i}
                          onClick={() => handleSlotClick(Number(level), i, isFilled)}
                          disabled={readonly}
                          className={`w-5 h-5 rounded-full border-2 transition-colors ${
                            isFilled
                              ? isPureWarlock
                                ? 'bg-purple-500 border-purple-400'
                                : 'bg-amber-500 border-amber-400'
                              : 'border-gray-600 bg-gray-800'
                          } ${readonly ? 'cursor-default' : 'cursor-pointer hover:border-amber-400'}`}
                          title={isFilled ? 'Use slot' : 'Recover slot'}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pact Magic Slots (multiclass warlock + other caster) */}
      {Object.keys(pactMagicSlotLevels).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-purple-400 uppercase tracking-wide mb-1">Pact Magic Slots</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pactMagicSlotLevels)
              .filter(([level]) => Number(level) > 0)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, slots]) => (
                <div key={level} className="bg-purple-900/30 rounded px-2 py-1.5">
                  <div className="text-[10px] text-gray-500 text-center mb-1">
                    {`${level}${ordinal(Number(level))}`}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: slots.max }, (_, i) => {
                      const isFilled = i < slots.current
                      return (
                        <button
                          key={i}
                          onClick={() => handlePactSlotClick(Number(level), i, isFilled)}
                          disabled={readonly}
                          className={`w-5 h-5 rounded-full border-2 transition-colors ${
                            isFilled ? 'bg-purple-500 border-purple-400' : 'border-gray-600 bg-gray-800'
                          } ${readonly ? 'cursor-default' : 'cursor-pointer hover:border-purple-400'}`}
                          title={isFilled ? 'Use pact slot' : 'Recover pact slot'}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Spellcasting info — dynamically computed from current ability scores */}
      {(() => {
        const classesForCalc = character.classes.map((c) => ({
          classId: c.name.toLowerCase(),
          subclassId: c.subclass?.toLowerCase(),
          level: c.level
        }))
        const scInfo = computeSpellcastingInfo(
          classesForCalc,
          character.abilityScores,
          character.level,
          character.buildChoices.classId,
          character.buildChoices.subclassId
        )
        if (!scInfo) return null
        return (
          <div className="mb-3 flex gap-4 text-sm text-gray-400">
            <span>
              Ability: <span className="text-amber-400 capitalize">{scInfo.ability}</span>
            </span>
            <span>
              DC: <span className="text-amber-400">{scInfo.spellSaveDC}</span>
            </span>
            <span>
              Attack:{' '}
              <span className="text-amber-400">
                {scInfo.spellAttackBonus >= 0 ? '+' : ''}
                {scInfo.spellAttackBonus}
              </span>
            </span>
            {isMulticlassSpellcaster(classesForCalc) ? (
              <span className="text-purple-400 text-xs">(Multiclass Slots)</span>
            ) : null}
          </div>
        )
      })()}

      {/* Species spellcasting info — for non-casters with species spells */}
      {(() => {
        const classesForCalc = character.classes.map((c) => ({
          classId: c.name.toLowerCase(),
          subclassId: c.subclass?.toLowerCase(),
          level: c.level
        }))
        const scInfo = computeSpellcastingInfo(
          classesForCalc,
          character.abilityScores,
          character.level,
          character.buildChoices.classId,
          character.buildChoices.subclassId
        )
        // Only show species spellcasting if no class spellcasting info and character has species spells
        if (scInfo) return null
        const speciesAbility = character.buildChoices.speciesSpellcastingAbility
        const hasSpeciesSpells = knownSpells.some((s) => s.source === 'species' || s.id.startsWith('species-'))
        if (!speciesAbility || !hasSpeciesSpells) return null
        const abilityMod = abilityModifier(character.abilityScores[speciesAbility])
        const dc = 8 + proficiencyBonus + abilityMod
        const attackBonus = proficiencyBonus + abilityMod
        return (
          <div className="mb-3 flex gap-4 text-sm text-gray-400">
            <span>
              Species Ability: <span className="text-purple-400 capitalize">{speciesAbility}</span>
            </span>
            <span>
              DC: <span className="text-purple-400">{dc}</span>
            </span>
            <span>
              Attack:{' '}
              <span className="text-purple-400">
                {attackBonus >= 0 ? '+' : ''}
                {attackBonus}
              </span>
            </span>
          </div>
        )
      })()}

      {/* Spell cap info + prepared count */}
      {knownSpells.length > 0 &&
        (() => {
          const cantrips = knownSpells.filter((s) => s.level === 0)
          const nonCantrips = knownSpells.filter((s) => s.level > 0)

          let cantripsMax = 0
          for (const cls of character.classes) {
            const cId = cls.name.toLowerCase()
            cantripsMax += getCantripsKnown(cId, cls.level)
          }

          return (
            <div className="mb-3 flex gap-4 text-xs text-gray-500">
              {cantripsMax > 0 && (
                <span>
                  Cantrips: <span className="text-amber-400">{cantrips.length}</span>/{cantripsMax}
                </span>
              )}
              {cantripsMax === 0 && cantrips.length > 0 && (
                <span>
                  Cantrips: <span className="text-amber-400">{cantrips.length}</span>
                </span>
              )}
              {nonCantrips.length > 0 &&
                (() => {
                  const primaryClassId = character.classes[0]?.name?.toLowerCase() ?? ''
                  const primaryClassLevel = character.classes[0]?.level ?? character.level
                  const maxPrepared = getPreparedSpellMax(primaryClassId, primaryClassLevel)
                  return (
                    <>
                      <span>
                        Prepared Spells: <span className="text-amber-400">{preparedCount}</span>
                        {maxPrepared != null && <span className="text-gray-500">/{maxPrepared}</span>}
                      </span>
                      <span>
                        Total Known: <span className="text-amber-400">{nonCantrips.length}</span>
                      </span>
                    </>
                  )
                })()}
            </div>
          )
        })()}

      {/* Known spells by level */}
      {spellsByLevel.size > 0 && (
        <div>
          {Array.from(spellsByLevel.entries())
            .sort(([a], [b]) => a - b)
            .map(([level, spells]) => (
              <div key={level} className="mb-2">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
                  {level === 0 ? 'Cantrips' : `${level}${ordinal(level)} Level`}
                </div>
                {spells.map((spell) => (
                  <SpellRow
                    key={spell.id}
                    spell={spell}
                    readonly={readonly}
                    preparedSpellIds={preparedSpellIds}
                    onTogglePrepared={handleTogglePrepared}
                    onToggleInnateUse={handleInnateUseClick}
                    onCastRitual={handleCastRitual}
                    onConcentrationWarning={handleConcentrationWarning}
                    isCantrip={level === 0}
                    proficiencyBonus={proficiencyBonus}
                    isConcentrating={isConcentrating}
                  />
                ))}
              </div>
            ))}
        </div>
      )}
    </SheetSectionWrapper>
  )
}

function ordinal(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}
