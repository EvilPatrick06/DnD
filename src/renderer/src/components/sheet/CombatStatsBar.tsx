import { useState, useEffect } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import { abilityModifier, formatMod } from '../../types/character-common'
import { useCharacterStore } from '../../stores/useCharacterStore'
import { profRankToNumber } from './ProficiencyIndicator'

interface CombatStatsBarProps {
  character: Character
  readonly?: boolean
}

export default function CombatStatsBar({ character, readonly }: CombatStatsBarProps): JSX.Element {
  const saveCharacter = useCharacterStore((s) => s.saveCharacter)
  const storeCharacter = useCharacterStore((s) => s.characters.find(c => c.id === character.id))
  const effectiveCharacter = storeCharacter ?? character
  const [editingHP, setEditingHP] = useState(false)
  const [hpCurrent, setHpCurrent] = useState(effectiveCharacter.hitPoints.current)
  const [hpMax, setHpMax] = useState(effectiveCharacter.hitPoints.maximum)
  const [hpTemp, setHpTemp] = useState(effectiveCharacter.hitPoints.temporary)

  useEffect(() => {
    setHpCurrent(effectiveCharacter.hitPoints.current)
    setHpMax(effectiveCharacter.hitPoints.maximum)
    setHpTemp(effectiveCharacter.hitPoints.temporary)
  }, [effectiveCharacter.hitPoints.current, effectiveCharacter.hitPoints.maximum, effectiveCharacter.hitPoints.temporary])

  const profBonus = is5eCharacter(character)
    ? Math.ceil(character.level / 4) + 1
    : character.level

  const saveHP = (): void => {
    const latest = useCharacterStore.getState().characters.find(c => c.id === character.id) || character
    const updated = {
      ...latest,
      hitPoints: { current: hpCurrent, maximum: hpMax, temporary: hpTemp },
      updatedAt: new Date().toISOString()
    }
    saveCharacter(updated)
    setEditingHP(false)
  }

  // Show perception for PF2e, initiative for 5e
  const thirdStat = is5eCharacter(character)
    ? { label: 'Initiative', value: formatMod(character.initiative) }
    : isPf2eCharacter(character)
      ? {
          label: 'Perception',
          value: (() => {
            const rank = profRankToNumber(character.perception)
            const wisMod = abilityModifier(character.abilityScores.wisdom)
            const bonus = rank > 0 ? character.level + rank * 2 : 0
            return formatMod(wisMod + bonus)
          })()
        }
      : { label: 'Initiative', value: '+0' }

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {/* HP */}
      <div
        className={`bg-gray-900/50 border rounded-lg p-3 text-center transition-colors ${
          readonly
            ? 'border-gray-700'
            : editingHP
              ? 'border-amber-500 cursor-pointer'
              : 'border-gray-700 hover:border-gray-500 cursor-pointer'
        }`}
        onClick={readonly ? undefined : () => !editingHP && setEditingHP(true)}
        title={readonly ? undefined : editingHP ? undefined : 'Click to edit HP'}
      >
        <div className="text-xs text-gray-400 uppercase">HP</div>
        {editingHP ? (
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                value={hpCurrent}
                onChange={(e) => setHpCurrent(parseInt(e.target.value, 10) || 0)}
                autoFocus
                className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-sm text-green-400 focus:outline-none focus:border-amber-500"
              />
              <span className="text-gray-500">/</span>
              <input
                type="number"
                value={hpMax}
                onChange={(e) => setHpMax(parseInt(e.target.value, 10) || 0)}
                className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-sm text-green-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-xs text-gray-500">Temp:</span>
              <input
                type="number"
                value={hpTemp}
                onChange={(e) => setHpTemp(parseInt(e.target.value, 10) || 0)}
                className="w-10 bg-gray-800 border border-gray-600 rounded text-center text-xs text-blue-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-1 justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); saveHP() }}
                className="px-2 py-0.5 text-xs bg-green-700 hover:bg-green-600 rounded text-white"
              >
                Save
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingHP(false) }}
                className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-xl font-bold text-green-400">
              {effectiveCharacter.hitPoints.current}/{effectiveCharacter.hitPoints.maximum}
            </div>
            {effectiveCharacter.hitPoints.temporary > 0 && (
              <div className="text-xs text-blue-400">+{effectiveCharacter.hitPoints.temporary} temp</div>
            )}
          </>
        )}
      </div>

      {/* AC */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-400 uppercase">AC</div>
        <div className="text-xl font-bold">{character.armorClass}</div>
      </div>

      {/* Initiative / Perception */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-400 uppercase">{thirdStat.label}</div>
        <div className="text-xl font-bold">{thirdStat.value}</div>
      </div>

      {/* Speed */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-400 uppercase">Speed</div>
        <div className="text-xl font-bold">{character.speed} ft</div>
      </div>

      {/* Prof Bonus - shown under the grid for 5e */}
      {is5eCharacter(character) && (
        <div className="col-span-4 text-sm text-gray-400">
          Proficiency Bonus: <span className="text-amber-400 font-semibold">+{profBonus}</span>
        </div>
      )}

      {/* Class DC for PF2e */}
      {isPf2eCharacter(character) && (
        <div className="col-span-4 text-sm text-gray-400">
          Class DC: <span className="text-amber-400 font-semibold">
            {(() => {
              const rank = profRankToNumber(character.classDC)
              const keyAb = character.abilityScores[
                (character.buildChoices.keyAbility || 'strength') as keyof typeof character.abilityScores
              ]
              const bonus = rank > 0 ? character.level + rank * 2 : 0
              return 10 + abilityModifier(keyAb) + bonus
            })()}
          </span>
        </div>
      )}
    </div>
  )
}
