import { useState } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import { abilityModifier, formatMod } from '../../types/character-common'
import { getSkillDescription } from '../../data/skills'
import ProficiencyIndicator, { profRankToNumber } from './ProficiencyIndicator'
import SheetSectionWrapper from './SheetSectionWrapper'

interface SkillsSectionProps {
  character: Character
}

export default function SkillsSection({ character }: SkillsSectionProps): JSX.Element {
  const profBonus = Math.ceil(character.level / 4) + 1
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const system = is5eCharacter(character) ? 'dnd5e' : 'pf2e'

  return (
    <SheetSectionWrapper title="Skills">
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {character.skills.map((skill) => {
          const abMod = abilityModifier(character.abilityScores[skill.ability])
          const desc = getSkillDescription(skill.name, system)
          const isExpanded = expandedSkill === skill.name

          if (is5eCharacter(character)) {
            const s = skill as { proficient?: boolean; expertise?: boolean; name: string }
            const prof = s.proficient ? profBonus : 0
            const exp = s.expertise ? profBonus : 0
            const total = abMod + prof + exp
            const abLabel = skill.ability.slice(0, 3).toUpperCase()
            return (
              <div key={skill.name}>
                <button
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
                  className="w-full flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1 transition-colors"
                >
                  <ProficiencyIndicator
                    proficient={!!s.proficient}
                    expertise={!!s.expertise}
                    system="dnd5e"
                  />
                  <span className={s.proficient ? 'text-gray-200' : 'text-gray-500'}>
                    {skill.name}
                  </span>
                  <span className="text-gray-600 text-[10px] ml-0.5">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span className="ml-auto font-mono text-xs">{formatMod(total)}</span>
                </button>
                {isExpanded && (
                  <div className="ml-6 mb-1 text-xs text-gray-500 bg-gray-800/30 rounded p-1.5">
                    <div className="text-amber-400/80 font-mono mb-0.5">
                      {formatMod(total)} = {abLabel}({formatMod(abMod)})
                      {s.proficient && <> + Prof({formatMod(profBonus)})</>}
                      {s.expertise && <> + Expertise({formatMod(profBonus)})</>}
                    </div>
                    {desc && (
                      <>
                        <div className="text-gray-400">{desc.description}</div>
                        <div className="text-gray-600 mt-0.5">{desc.uses}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          }

          if (isPf2eCharacter(character)) {
            const s = skill as { rank?: string; name: string }
            const rank = profRankToNumber(s.rank ?? 'untrained')
            const rankBonus = rank * 2
            const levelBonus = rank > 0 ? character.level : 0
            const bonus = rank > 0 ? levelBonus + rankBonus : 0
            const total = abMod + bonus
            const abLabel = skill.ability.slice(0, 3).toUpperCase()
            return (
              <div key={skill.name}>
                <button
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
                  className="w-full flex items-center gap-2 text-sm py-0.5 cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1 transition-colors"
                >
                  <ProficiencyIndicator
                    proficient={rank > 0}
                    rank={rank}
                    system="pf2e"
                  />
                  <span className={rank > 0 ? 'text-gray-200' : 'text-gray-500'}>
                    {skill.name}
                  </span>
                  <span className="text-gray-600 text-[10px] ml-0.5">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span className="ml-auto font-mono text-xs">{formatMod(total)}</span>
                </button>
                {isExpanded && (
                  <div className="ml-6 mb-1 text-xs text-gray-500 bg-gray-800/30 rounded p-1.5">
                    <div className="text-amber-400/80 font-mono mb-0.5">
                      {formatMod(total)} = {abLabel}({formatMod(abMod)})
                      {rank > 0 && <> + Level({levelBonus})</>}
                      {rank > 0 && <> + Rank({formatMod(rankBonus)})</>}
                    </div>
                    {desc && (
                      <>
                        <div className="text-gray-400">{desc.description}</div>
                        <div className="text-gray-600 mt-0.5">{desc.uses}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    </SheetSectionWrapper>
  )
}
