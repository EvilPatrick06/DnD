import { useCallback } from 'react'
import type { Character } from '../../../types/character'
import { is5eCharacter } from '../../../types/character'
import type {
  Character5e,
  CharacterClass5e,
  EquipmentItem,
  Feature,
  SkillProficiency5e
} from '../../../types/character-5e'
import {
  ABILITY_NAMES,
  type AbilityName,
  abilityModifier,
  formatMod,
  type SpellEntry,
  type WeaponEntry
} from '../../../types/character-common'

interface PrintSheetProps {
  character: Character
  onClose: () => void
}

const ABILITY_LABELS: Record<AbilityName, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA'
}

function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

function PrintSheet5e({ character, onClose }: { character: Character5e; onClose: () => void }): JSX.Element {
  const pb = proficiencyBonus(character.level)

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Group spells by level
  const spellsByLevel: Record<number, typeof character.knownSpells> = {}
  for (const spell of character.knownSpells) {
    if (!spellsByLevel[spell.level]) spellsByLevel[spell.level] = []
    spellsByLevel[spell.level].push(spell)
  }
  const sortedSpellLevels = Object.keys(spellsByLevel)
    .map(Number)
    .sort((a, b) => a - b)

  // Class string
  const classStr = character.classes
    .map((c: CharacterClass5e) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`)
    .join(' / ')

  // Total hit dice string
  const hitDiceStr = character.classes.map((c: CharacterClass5e) => `${c.level}d${c.hitDie}`).join(' + ')

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-auto bg-white"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif', fontSize: '10pt', color: '#000' }}
    >
      {/* Toolbar - hidden when printing */}
      <div
        className="print:hidden sticky top-0 z-10 flex items-center gap-3 bg-gray-100 px-6 py-3 border-b border-gray-300 shadow-sm"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <button
          onClick={handlePrint}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Print
        </button>
        <button
          onClick={onClose}
          className="rounded bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600"
        >
          Close
        </button>
        <span className="ml-2 text-sm text-gray-600">Print preview for {character.name}</span>
      </div>

      {/* Sheet content */}
      <div className="mx-auto max-w-[8in] px-8 py-6 print:px-0 print:py-0 print:max-w-none">
        {/* Header */}
        <div className="mb-4 border-b-2 border-black pb-2">
          <h1 className="text-2xl font-bold leading-tight" style={{ fontSize: '18pt' }}>
            {character.name}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5 text-sm" style={{ fontSize: '9pt' }}>
            <span>
              <strong>Class:</strong> {classStr}
            </span>
            <span>
              <strong>Level:</strong> {character.level}
            </span>
            <span>
              <strong>Species:</strong> {character.species}
              {character.subspecies ? ` (${character.subspecies})` : ''}
            </span>
            <span>
              <strong>Background:</strong> {character.background}
            </span>
            {character.alignment && (
              <span>
                <strong>Alignment:</strong> {character.alignment}
              </span>
            )}
            <span>
              <strong>Proficiency Bonus:</strong> {formatMod(pb)}
            </span>
          </div>
        </div>

        {/* Ability Scores */}
        <div className="mb-4">
          <h2
            className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
            style={{ fontSize: '8pt' }}
          >
            Ability Scores
          </h2>
          <div className="grid grid-cols-6 gap-2 text-center mt-1">
            {ABILITY_NAMES.map((ab) => {
              const score = character.abilityScores[ab]
              const mod = abilityModifier(score)
              return (
                <div key={ab} className="border border-gray-400 rounded px-1 py-1.5">
                  <div className="text-[7pt] font-bold uppercase tracking-wide text-gray-600">{ABILITY_LABELS[ab]}</div>
                  <div className="text-lg font-bold leading-tight" style={{ fontSize: '14pt' }}>
                    {formatMod(mod)}
                  </div>
                  <div className="text-[8pt] text-gray-500">{score}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Two-column layout for saving throws + skills and combat stats */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {/* Left column: Saving Throws + Skills */}
          <div>
            {/* Saving Throws */}
            <div className="mb-3">
              <h2
                className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
                style={{ fontSize: '8pt' }}
              >
                Saving Throws
              </h2>
              <div className="mt-0.5 space-y-px text-[8.5pt]">
                {ABILITY_NAMES.map((ab) => {
                  const prof = character.proficiencies.savingThrows.includes(ab)
                  const mod = abilityModifier(character.abilityScores[ab]) + (prof ? pb : 0)
                  return (
                    <div key={ab} className="flex items-center gap-1.5">
                      <span className="inline-block w-3 text-center font-bold">{prof ? '+' : '-'}</span>
                      <span className="w-8 font-mono text-right">{formatMod(mod)}</span>
                      <span>{ABILITY_LABELS[ab]}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Skills */}
            <div>
              <h2
                className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
                style={{ fontSize: '8pt' }}
              >
                Skills
              </h2>
              <div className="mt-0.5 space-y-px text-[8.5pt]">
                {character.skills
                  .slice()
                  .sort((a: SkillProficiency5e, b: SkillProficiency5e) => a.name.localeCompare(b.name))
                  .map((skill: SkillProficiency5e) => {
                    const abMod = abilityModifier(character.abilityScores[skill.ability])
                    let mod = abMod
                    if (skill.proficient) mod += pb
                    if (skill.expertise) mod += pb // expertise doubles proficiency
                    const marker = skill.expertise ? 'E' : skill.proficient ? '+' : '-'
                    return (
                      <div key={skill.name} className="flex items-center gap-1.5">
                        <span className="inline-block w-3 text-center font-bold">{marker}</span>
                        <span className="w-8 font-mono text-right">{formatMod(mod)}</span>
                        <span>{skill.name}</span>
                        <span className="text-[7pt] text-gray-400 ml-0.5">({ABILITY_LABELS[skill.ability]})</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Right column: Combat Stats + Attacks */}
          <div>
            {/* Combat Stats */}
            <div className="mb-3">
              <h2
                className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
                style={{ fontSize: '8pt' }}
              >
                Combat
              </h2>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div className="border border-gray-400 rounded py-1.5">
                  <div className="text-[7pt] font-bold uppercase text-gray-600">AC</div>
                  <div className="text-lg font-bold" style={{ fontSize: '14pt' }}>
                    {character.armorClass}
                  </div>
                </div>
                <div className="border border-gray-400 rounded py-1.5">
                  <div className="text-[7pt] font-bold uppercase text-gray-600">Initiative</div>
                  <div className="text-lg font-bold" style={{ fontSize: '14pt' }}>
                    {formatMod(character.initiative)}
                  </div>
                </div>
                <div className="border border-gray-400 rounded py-1.5">
                  <div className="text-[7pt] font-bold uppercase text-gray-600">Speed</div>
                  <div className="text-lg font-bold" style={{ fontSize: '14pt' }}>
                    {character.speed} ft
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="border border-gray-400 rounded py-1.5">
                  <div className="text-[7pt] font-bold uppercase text-gray-600">Hit Points</div>
                  <div className="text-base font-bold" style={{ fontSize: '12pt' }}>
                    {character.hitPoints.current} / {character.hitPoints.maximum}
                  </div>
                  {character.hitPoints.temporary > 0 && (
                    <div className="text-[7pt] text-gray-500">+{character.hitPoints.temporary} temp</div>
                  )}
                </div>
                <div className="border border-gray-400 rounded py-1.5">
                  <div className="text-[7pt] font-bold uppercase text-gray-600">Hit Dice</div>
                  <div className="text-base font-bold" style={{ fontSize: '12pt' }}>
                    {hitDiceStr}
                  </div>
                  <div className="text-[7pt] text-gray-500">{character.hitDiceRemaining} remaining</div>
                </div>
              </div>
              {character.spellcasting && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div className="border border-gray-400 rounded py-1.5">
                    <div className="text-[7pt] font-bold uppercase text-gray-600">Spell Save DC</div>
                    <div className="text-base font-bold" style={{ fontSize: '12pt' }}>
                      {character.spellcasting.spellSaveDC}
                    </div>
                  </div>
                  <div className="border border-gray-400 rounded py-1.5">
                    <div className="text-[7pt] font-bold uppercase text-gray-600">Spell Attack</div>
                    <div className="text-base font-bold" style={{ fontSize: '12pt' }}>
                      {formatMod(character.spellcasting.spellAttackBonus)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attacks */}
            {character.weapons.length > 0 && (
              <div className="mb-3">
                <h2
                  className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
                  style={{ fontSize: '8pt' }}
                >
                  Attacks
                </h2>
                <table className="mt-0.5 w-full text-[8.5pt]">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-0.5 font-semibold">Weapon</th>
                      <th className="text-center py-0.5 font-semibold w-14">Atk</th>
                      <th className="text-center py-0.5 font-semibold">Damage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {character.weapons.map((w: WeaponEntry) => (
                      <tr key={w.id} className="border-b border-gray-200">
                        <td className="py-0.5">{w.name}</td>
                        <td className="text-center py-0.5 font-mono">{formatMod(w.attackBonus)}</td>
                        <td className="text-center py-0.5">
                          {w.damage} {w.damageType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Proficiencies summary */}
            <div className="mb-3">
              <h2
                className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
                style={{ fontSize: '8pt' }}
              >
                Proficiencies
              </h2>
              <div className="mt-0.5 space-y-0.5 text-[8.5pt]">
                {character.proficiencies.armor.length > 0 && (
                  <div>
                    <strong>Armor:</strong> {character.proficiencies.armor.join(', ')}
                  </div>
                )}
                {character.proficiencies.weapons.length > 0 && (
                  <div>
                    <strong>Weapons:</strong> {character.proficiencies.weapons.join(', ')}
                  </div>
                )}
                {character.proficiencies.tools.length > 0 && (
                  <div>
                    <strong>Tools:</strong> {character.proficiencies.tools.join(', ')}
                  </div>
                )}
                {character.proficiencies.languages.length > 0 && (
                  <div>
                    <strong>Languages:</strong> {character.proficiencies.languages.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Spells */}
        {sortedSpellLevels.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Spells
            </h2>
            {sortedSpellLevels.map((lvl) => {
              const spells = spellsByLevel[lvl]
              const slotInfo = lvl === 0 ? null : character.spellSlotLevels[lvl]
              return (
                <div key={lvl} className="mt-1.5">
                  <div className="text-[8pt] font-bold">
                    {lvl === 0 ? 'Cantrips' : `Level ${lvl}`}
                    {slotInfo && (
                      <span className="font-normal text-gray-500 ml-1">
                        ({slotInfo.current}/{slotInfo.max} slots)
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5pt]">
                    {spells.map((sp: SpellEntry) => {
                      const isPrepared = lvl === 0 || character.preparedSpellIds.includes(sp.id)
                      return (
                        <span key={sp.id} className={isPrepared ? 'font-semibold' : 'text-gray-400'}>
                          {sp.name}
                          {sp.concentration && <span className="text-[7pt] align-super ml-px">C</span>}
                          {sp.ritual && <span className="text-[7pt] align-super ml-px">R</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Features */}
        {character.features.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Features &amp; Traits
            </h2>
            <div className="mt-0.5 space-y-1 text-[8.5pt]">
              {character.features.map((f: Feature, i: number) => (
                <div key={`${f.name}-${i}`}>
                  <strong>{f.name}</strong>
                  <span className="text-gray-400 text-[7pt] ml-1">({f.source})</span>
                  {f.description && <span className="ml-1">{f.description}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feats */}
        {character.feats.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Feats
            </h2>
            <div className="mt-0.5 space-y-1 text-[8.5pt]">
              {character.feats.map((f: { id: string; name: string; description: string }) => (
                <div key={f.id}>
                  <strong>{f.name}</strong>
                  {f.description && <span className="ml-1">{f.description}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipment */}
        {character.equipment.length > 0 && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Equipment
            </h2>
            <div className="mt-0.5 columns-2 gap-4 text-[8.5pt]">
              {character.equipment.map((item: EquipmentItem, i: number) => (
                <div key={`${item.name}-${i}`} className="break-inside-avoid">
                  {item.name}
                  {item.quantity > 1 && <span className="text-gray-500"> x{item.quantity}</span>}
                </div>
              ))}
            </div>
            {/* Currency */}
            <div className="mt-1.5 text-[8.5pt]">
              <strong>Currency:</strong> {character.treasure.pp > 0 && `${character.treasure.pp} pp `}
              {character.treasure.gp > 0 && `${character.treasure.gp} gp `}
              {(character.treasure.ep ?? 0) > 0 && `${character.treasure.ep} ep `}
              {character.treasure.sp > 0 && `${character.treasure.sp} sp `}
              {character.treasure.cp > 0 && `${character.treasure.cp} cp`}
            </div>
          </div>
        )}

        {/* Details (personality, ideals, etc.) */}
        {character.details && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Character Details
            </h2>
            <div className="mt-0.5 space-y-0.5 text-[8.5pt]">
              {character.details.personality && (
                <div>
                  <strong>Personality:</strong> {character.details.personality}
                </div>
              )}
              {character.details.ideals && (
                <div>
                  <strong>Ideals:</strong> {character.details.ideals}
                </div>
              )}
              {character.details.bonds && (
                <div>
                  <strong>Bonds:</strong> {character.details.bonds}
                </div>
              )}
              {character.details.flaws && (
                <div>
                  <strong>Flaws:</strong> {character.details.flaws}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backstory */}
        {character.backstory && (
          <div className="mb-4 break-inside-avoid">
            <h2
              className="mb-1 text-xs font-bold uppercase tracking-wider border-b border-gray-400 pb-0.5"
              style={{ fontSize: '8pt' }}
            >
              Backstory
            </h2>
            <div className="mt-0.5 text-[8.5pt] whitespace-pre-wrap">{character.backstory}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PrintSheet({ character, onClose }: PrintSheetProps): JSX.Element {
  if (is5eCharacter(character)) {
    return <PrintSheet5e character={character} onClose={onClose} />
  }

  // Fallback - should not happen since only 5e is active
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-lg font-semibold">Unsupported game system</p>
        <button onClick={onClose} className="mt-4 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
          Close
        </button>
      </div>
    </div>
  )
}
