import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import type { ArmorEntry } from '../../types/character-common'
import { useCharacterStore } from '../../stores/useCharacterStore'
import ProficiencyIndicator, { profRankToNumber } from './ProficiencyIndicator'
import SheetSectionWrapper from './SheetSectionWrapper'

interface DefenseSectionProps {
  character: Character
  readonly?: boolean
}

export default function DefenseSection({ character, readonly }: DefenseSectionProps): JSX.Element {
  const toggleArmorEquipped = useCharacterStore((s) => s.toggleArmorEquipped)

  // Get armor from the new field
  const armor: ArmorEntry[] = character.armor ?? []
  const equippedArmor = armor.find((a) => a.equipped && a.type === 'armor')
  const equippedShield = armor.find((a) => a.equipped && a.type === 'shield')

  return (
    <SheetSectionWrapper title="Defense">
      {/* AC Breakdown */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Armor Class</div>
          <div className="text-xl font-bold text-amber-400">{character.armorClass}</div>
        </div>

        {equippedArmor ? (
          <div className="bg-gray-800/50 rounded p-2 text-sm mb-2">
            <div className="flex justify-between">
              <span className="text-gray-300 font-medium">{equippedArmor.name}</span>
              <span className="text-gray-400">+{equippedArmor.acBonus} AC</span>
            </div>
            {equippedArmor.category && (
              <span className="text-xs text-gray-500 capitalize">{equippedArmor.category} armor</span>
            )}
            {is5eCharacter(character) && equippedArmor.stealthDisadvantage && (
              <span className="text-xs text-yellow-500 ml-2">Stealth disadvantage</span>
            )}
            {isPf2eCharacter(character) && equippedArmor.checkPenalty && equippedArmor.checkPenalty < 0 && (
              <span className="text-xs text-yellow-500 ml-2">Check penalty: {equippedArmor.checkPenalty}</span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-2">Unarmored (10 + DEX)</div>
        )}

        {equippedShield && (
          <div className="bg-gray-800/50 rounded p-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300 font-medium">{equippedShield.name}</span>
              <span className="text-gray-400">+{equippedShield.acBonus} AC</span>
            </div>
            {isPf2eCharacter(character) && equippedShield.hardness != null && (
              <span className="text-xs text-gray-500">
                Hardness {equippedShield.hardness} | HP {equippedShield.shieldHP}/{equippedShield.shieldBT} BT
              </span>
            )}
          </div>
        )}
      </div>

      {/* All armor items with equip toggle */}
      {armor.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Armor Inventory</div>
          <div className="space-y-1">
            {armor.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-sm">
                <div className="flex items-center gap-2">
                  {!readonly && (
                    <button
                      onClick={() => toggleArmorEquipped(character.id, a.id)}
                      className={`w-4 h-4 rounded border cursor-pointer transition-colors ${
                        a.equipped
                          ? 'bg-amber-500 border-amber-400'
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                      title={a.equipped ? 'Unequip' : 'Equip'}
                    />
                  )}
                  <span className={a.equipped ? 'text-gray-200' : 'text-gray-500'}>{a.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>+{a.acBonus} AC</span>
                  <span className="capitalize">{a.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5e Armor/Weapon proficiencies */}
      {is5eCharacter(character) && (
        <div className="space-y-1 text-sm text-gray-400">
          {character.proficiencies.armor.length > 0 && (
            <p>
              <span className="text-gray-500">Armor: </span>
              {character.proficiencies.armor.join(', ')}
            </p>
          )}
          {character.proficiencies.weapons.length > 0 && (
            <p>
              <span className="text-gray-500">Weapons: </span>
              {character.proficiencies.weapons.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* PF2e defense proficiencies */}
      {isPf2eCharacter(character) && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Defense Proficiencies</div>
          <div className="space-y-1">
            {(['unarmored', 'light', 'medium', 'heavy'] as const).map((type) => {
              const rank = profRankToNumber(character.defenses[type])
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
    </SheetSectionWrapper>
  )
}
