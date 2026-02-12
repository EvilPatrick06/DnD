import { useMemo } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { abilityModifier, formatMod } from '../../types/character-common'
import type { AbilityName } from '../../types/character-common'

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

function TEMLBubbles({ rank }: { rank: 0 | 1 | 2 | 3 | 4 }): JSX.Element {
  const labels = ['T', 'E', 'M', 'L']
  return (
    <div className="flex gap-0.5">
      {labels.map((l, i) => (
        <div key={l} className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${
          i < rank ? 'bg-gray-300 border-gray-300 text-gray-900' : 'border-gray-600 text-gray-600'
        }`}>
          {i < rank ? 'X' : l}
        </div>
      ))}
    </div>
  )
}

const SKILLS_5E: Array<{ name: string; ability: AbilityName }> = [
  { name: 'Acrobatics', ability: 'dexterity' },
  { name: 'Animal Handling', ability: 'wisdom' },
  { name: 'Arcana', ability: 'intelligence' },
  { name: 'Athletics', ability: 'strength' },
  { name: 'Deception', ability: 'charisma' },
  { name: 'History', ability: 'intelligence' },
  { name: 'Insight', ability: 'wisdom' },
  { name: 'Intimidation', ability: 'charisma' },
  { name: 'Investigation', ability: 'intelligence' },
  { name: 'Medicine', ability: 'wisdom' },
  { name: 'Nature', ability: 'intelligence' },
  { name: 'Perception', ability: 'wisdom' },
  { name: 'Performance', ability: 'charisma' },
  { name: 'Persuasion', ability: 'charisma' },
  { name: 'Religion', ability: 'intelligence' },
  { name: 'Sleight of Hand', ability: 'dexterity' },
  { name: 'Stealth', ability: 'dexterity' },
  { name: 'Survival', ability: 'wisdom' }
]

export default function SkillsTab(): JSX.Element {
  const abilityScores = useBuilderStore((s) => s.abilityScores)
  const selectedSkills = useBuilderStore((s) => s.selectedSkills)
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const maxSkills = useBuilderStore((s) => s.maxSkills)
  const openCustomModal = useBuilderStore((s) => s.openCustomModal)

  const profBonus = useMemo(() => Math.ceil(targetLevel / 4) + 1, [targetLevel])

  return (
    <div>
      <SectionBanner label="SKILLS" />
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500">
          {selectedSkills.length}/{maxSkills} proficient | Prof. bonus: {formatMod(profBonus)}
        </span>
        <button
          onClick={() => openCustomModal('skills')}
          className="text-xs text-amber-400 hover:text-amber-300 border border-amber-800/30 px-2.5 py-1 rounded transition-colors"
        >
          Edit Skills
        </button>
      </div>

      <div>
        {SKILLS_5E.map((skill) => {
          const isProficient = selectedSkills.includes(skill.name)
          const mod = abilityModifier(abilityScores[skill.ability])
          const total = mod + (isProficient ? profBonus : 0)
          const rank: 0 | 1 = isProficient ? 1 : 0
          const abbr = skill.ability.slice(0, 3).toUpperCase()

          return (
            <div
              key={skill.name}
              className={`flex items-center px-4 py-2 border-b border-gray-800/50 gap-3 ${
                isProficient ? 'bg-amber-900/10' : ''
              }`}
            >
              {/* Skill name + total */}
              <span className={`flex-1 text-sm font-medium ${isProficient ? 'text-amber-200' : 'text-gray-300'}`}>
                {skill.name} <span className={`font-bold ${isProficient ? 'text-amber-400' : 'text-gray-400'}`}>{formatMod(total)}</span>
              </span>

              {/* TEML bubbles */}
              <TEMLBubbles rank={rank} />

              {/* Breakdown */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400 w-12 text-right">{abbr} {formatMod(mod)}</span>
                <span className="text-gray-500 w-14 text-right">Prof {isProficient ? formatMod(profBonus) : '+0'}</span>
                <span className="text-gray-600 w-12 text-right">Item +0</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
