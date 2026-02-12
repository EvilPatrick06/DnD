import { useState } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import type { SpellEntry } from '../../types/character-common'
import { getCantripsKnown, FULL_CASTERS_5E, HALF_CASTERS_5E } from '../../services/spell-data'
import SheetSectionWrapper from './SheetSectionWrapper'

interface SpellcastingSectionProps {
  character: Character
}

function SpellRow({ spell }: { spell: SpellEntry }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-800/50 transition-colors text-left text-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-200">{spell.name}</span>
          {spell.concentration && (
            <span className="text-[10px] text-yellow-500 border border-yellow-700 rounded px-1">C</span>
          )}
          {spell.ritual && (
            <span className="text-[10px] text-blue-400 border border-blue-700 rounded px-1">R</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{spell.castingTime}</span>
          <span>{spell.range}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-xs text-gray-400 space-y-1">
          <div className="flex gap-3 text-gray-500">
            <span>Duration: {spell.duration}</span>
            <span>Components: {spell.components}</span>
            {spell.school && <span>School: {spell.school}</span>}
          </div>
          <p className="leading-relaxed whitespace-pre-wrap">{spell.description}</p>
          {spell.heightened && Object.keys(spell.heightened).length > 0 && (
            <div className="border-t border-gray-800 pt-1 mt-1">
              <span className="text-gray-500 font-semibold">Heightened:</span>
              {Object.entries(spell.heightened).map(([key, val]) => (
                <p key={key} className="ml-2"><span className="text-amber-400">{key}:</span> {val}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SpellcastingSection({ character }: SpellcastingSectionProps): JSX.Element {
  const knownSpells: SpellEntry[] = character.knownSpells ?? []
  const spellSlotLevels = character.spellSlotLevels ?? {}

  // Check if character is a caster
  const hasCasting = is5eCharacter(character)
    ? !!character.spellcasting || knownSpells.length > 0
    : knownSpells.length > 0

  if (!hasCasting && Object.keys(spellSlotLevels).length === 0) {
    return <></>
  }

  // Group spells by level
  const spellsByLevel = new Map<number, SpellEntry[]>()
  for (const spell of knownSpells) {
    const group = spellsByLevel.get(spell.level) ?? []
    group.push(spell)
    spellsByLevel.set(spell.level, group)
  }

  // Focus points for PF2e
  const focusPoints = isPf2eCharacter(character) ? character.focusPoints : null

  return (
    <SheetSectionWrapper title="Spellcasting">
      {/* Spell slots */}
      {Object.keys(spellSlotLevels).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Spell Slots</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(spellSlotLevels)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, slots]) => (
                <div key={level} className="bg-gray-800/50 rounded px-2 py-1 text-center">
                  <div className="text-[10px] text-gray-500">
                    {Number(level) === 0 ? 'Cantrip' : `${level}${ordinal(Number(level))}`}
                  </div>
                  <div className="text-sm font-mono">
                    <span className="text-amber-400">{slots.current}</span>
                    <span className="text-gray-600">/{slots.max}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Focus points (PF2e) */}
      {focusPoints && focusPoints.max > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Focus Points</div>
          <div className="flex gap-1">
            {Array.from({ length: focusPoints.max }, (_, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full border ${
                  i < focusPoints.current
                    ? 'bg-purple-500 border-purple-400'
                    : 'border-gray-600 bg-gray-800'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Spellcasting info (5e) */}
      {is5eCharacter(character) && character.spellcasting && (
        <div className="mb-3 flex gap-4 text-sm text-gray-400">
          <span>Ability: <span className="text-amber-400 capitalize">{character.spellcasting.ability}</span></span>
          <span>DC: <span className="text-amber-400">{character.spellcasting.spellSaveDC}</span></span>
          <span>Attack: <span className="text-amber-400">{character.spellcasting.spellAttackBonus >= 0 ? '+' : ''}{character.spellcasting.spellAttackBonus}</span></span>
        </div>
      )}

      {/* Spell cap info */}
      {knownSpells.length > 0 && (() => {
        const cantrips = knownSpells.filter((s) => s.level === 0)
        const nonCantrips = knownSpells.filter((s) => s.level > 0)

        // Determine cantrip max for 5e casters
        let cantripsMax = 0
        if (is5eCharacter(character)) {
          const classId = character.classes[0]?.name?.toLowerCase() ?? ''
          if (FULL_CASTERS_5E.includes(classId) || HALF_CASTERS_5E.includes(classId)) {
            cantripsMax = getCantripsKnown(classId, character.level)
          }
        }

        return (
          <div className="mb-3 flex gap-4 text-xs text-gray-500">
            {cantripsMax > 0 && (
              <span>Cantrips: <span className="text-amber-400">{cantrips.length}</span>/{cantripsMax}</span>
            )}
            {cantripsMax === 0 && cantrips.length > 0 && (
              <span>Cantrips: <span className="text-amber-400">{cantrips.length}</span></span>
            )}
            {nonCantrips.length > 0 && (
              <span>Spells Known: <span className="text-amber-400">{nonCantrips.length}</span></span>
            )}
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
                  <SpellRow key={spell.id} spell={spell} />
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
