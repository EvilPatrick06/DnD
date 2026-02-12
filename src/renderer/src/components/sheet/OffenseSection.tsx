import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import { abilityModifier, formatMod } from '../../types/character-common'
import type { WeaponEntry } from '../../types/character-common'
import ProficiencyIndicator, { profRankToNumber } from './ProficiencyIndicator'
import SheetSectionWrapper from './SheetSectionWrapper'

interface OffenseSectionProps {
  character: Character
}

function WeaponRow({ weapon, system }: { weapon: WeaponEntry; system: 'dnd5e' | 'pf2e' }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-200 font-medium">{weapon.name}</span>
        {weapon.properties.length > 0 && (
          <span className="text-xs text-gray-500">({weapon.properties.join(', ')})</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-amber-400 font-mono">{formatMod(weapon.attackBonus)}</span>
        <span className="text-red-400 font-medium">{weapon.damage} {weapon.damageType}</span>
        {weapon.range && <span className="text-gray-500">{weapon.range}</span>}
      </div>
    </div>
  )
}

export default function OffenseSection({ character }: OffenseSectionProps): JSX.Element {
  const profBonus = is5eCharacter(character) ? Math.ceil(character.level / 4) + 1 : character.level

  const newWeapons: WeaponEntry[] = isPf2eCharacter(character)
    ? character.weapons ?? []
    : []

  // Spellcasting info
  const spellAttack = is5eCharacter(character) && character.spellcasting
    ? {
        label: 'Spell Attack',
        bonus: character.spellcasting.spellAttackBonus,
        dc: character.spellcasting.spellSaveDC
      }
    : null

  return (
    <SheetSectionWrapper title="Offense">
      {/* Weapons */}
      {newWeapons.length > 0 ? (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weapons</div>
          {newWeapons.map((w, i) => (
            <WeaponRow key={w.id || i} weapon={w} system={is5eCharacter(character) ? 'dnd5e' : 'pf2e'} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-3">No weapons equipped.</p>
      )}

      {/* Attack proficiencies for PF2e */}
      {isPf2eCharacter(character) && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Attack Proficiencies</div>
          <div className="space-y-1">
            {(['simple', 'martial', 'unarmed'] as const).map((type) => {
              const rank = profRankToNumber(character.attacks[type])
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <ProficiencyIndicator proficient={rank > 0} rank={rank} system="pf2e" />
                  <span className="text-gray-300 capitalize">{type}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Spell attack for 5e */}
      {spellAttack && (
        <div className="border-t border-gray-800 pt-2 mt-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Spellcasting</div>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">
              Attack: <span className="text-amber-400 font-mono">{formatMod(spellAttack.bonus)}</span>
            </span>
            <span className="text-gray-400">
              Save DC: <span className="text-amber-400 font-mono">{spellAttack.dc}</span>
            </span>
          </div>
        </div>
      )}
    </SheetSectionWrapper>
  )
}
