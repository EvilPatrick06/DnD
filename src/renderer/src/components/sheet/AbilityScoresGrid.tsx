import type { Character } from '../../types/character'
import { ABILITY_NAMES, abilityModifier, formatMod } from '../../types/character-common'

interface AbilityScoresGridProps {
  character: Character
}

export default function AbilityScoresGrid({ character }: AbilityScoresGridProps): JSX.Element {
  return (
    <div className="grid grid-cols-6 gap-2 mb-6">
      {ABILITY_NAMES.map((ab) => {
        const score = character.abilityScores[ab]
        const mod = abilityModifier(score)
        return (
          <div
            key={ab}
            className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center"
          >
            <div className="text-xs text-gray-400 uppercase">{ab.slice(0, 3)}</div>
            <div className="text-2xl font-bold text-amber-400">{score}</div>
            <div className="text-sm text-gray-400">{formatMod(mod)}</div>
          </div>
        )
      })}
    </div>
  )
}
