import { useState } from 'react'
import type { SpellEntry } from '../../../types/character-common'

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

function ordinal(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}

interface SpellList5eProps {
  spellsByLevel: Map<number, SpellEntry[]>
  readonly?: boolean
  preparedSpellIds: string[]
  onTogglePrepared: (spellId: string) => void
  onToggleInnateUse: (spellId: string) => void
  onCastRitual: (spell: SpellEntry) => void
  onConcentrationWarning: (spell: SpellEntry) => void
  proficiencyBonus: number
  isConcentrating: boolean
}

export default function SpellList5e({
  spellsByLevel,
  readonly,
  preparedSpellIds,
  onTogglePrepared,
  onToggleInnateUse,
  onCastRitual,
  onConcentrationWarning,
  proficiencyBonus,
  isConcentrating
}: SpellList5eProps): JSX.Element | null {
  if (spellsByLevel.size === 0) return null

  return (
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
                onTogglePrepared={onTogglePrepared}
                onToggleInnateUse={onToggleInnateUse}
                onCastRitual={onCastRitual}
                onConcentrationWarning={onConcentrationWarning}
                isCantrip={level === 0}
                proficiencyBonus={proficiencyBonus}
                isConcentrating={isConcentrating}
              />
            ))}
          </div>
        ))}
    </div>
  )
}
