import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import { ABILITY_NAMES, abilityModifier, formatMod } from '../../types/character-common'
import ProficiencyIndicator, { profRankToNumber } from './ProficiencyIndicator'
import SheetSectionWrapper from './SheetSectionWrapper'

interface SavingThrowsSectionProps {
  character: Character
}

export default function SavingThrowsSection({ character }: SavingThrowsSectionProps): JSX.Element {
  const profBonus = Math.ceil(character.level / 4) + 1

  return (
    <SheetSectionWrapper title="Saving Throws">
      {is5eCharacter(character) && (
        <div className="grid grid-cols-3 gap-2">
          {ABILITY_NAMES.map((ab) => {
            const isProficient = character.proficiencies.savingThrows.includes(ab)
            const mod = abilityModifier(character.abilityScores[ab]) + (isProficient ? profBonus : 0)
            return (
              <div key={ab} className="flex items-center gap-2 text-sm">
                <ProficiencyIndicator proficient={isProficient} system="dnd5e" />
                <span className="text-gray-400 capitalize">{ab}</span>
                <span className="ml-auto font-mono">{formatMod(mod)}</span>
              </div>
            )
          })}
        </div>
      )}

      {isPf2eCharacter(character) && (
        <div className="space-y-2">
          {(['fortitude', 'reflex', 'will'] as const).map((save) => {
            const rank = profRankToNumber(character.saves[save])
            const abilityMap = { fortitude: 'constitution', reflex: 'dexterity', will: 'wisdom' } as const
            const abMod = abilityModifier(character.abilityScores[abilityMap[save]])
            const bonus = rank > 0 ? character.level + rank * 2 : 0
            const total = abMod + bonus
            return (
              <div key={save} className="flex items-center gap-3 text-sm">
                <ProficiencyIndicator
                  proficient={rank > 0}
                  rank={rank}
                  system="pf2e"
                />
                <span className="text-gray-300 capitalize flex-1">{save}</span>
                <span className="font-mono font-bold text-amber-400">{formatMod(total)}</span>
              </div>
            )
          })}
        </div>
      )}
    </SheetSectionWrapper>
  )
}
