import type { GameSystem } from '../../types/game-system'

interface ProficiencyIndicatorProps {
  proficient: boolean
  expertise?: boolean
  rank?: number // 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
  system: GameSystem
}

const TEML_LABELS = ['T', 'E', 'M', 'L'] as const

export default function ProficiencyIndicator({
  proficient,
  expertise,
  rank,
  system
}: ProficiencyIndicatorProps): JSX.Element {
  if (system === 'pf2e') {
    const r = rank ?? (proficient ? 1 : 0)
    return (
      <div className="flex items-center gap-0.5">
        {TEML_LABELS.map((label, i) => (
          <div
            key={label}
            className={`w-4 h-4 rounded-full border text-[9px] font-bold flex items-center justify-center ${
              i < r
                ? 'border-amber-500 bg-amber-900/40 text-amber-400'
                : 'border-gray-600 bg-gray-800 text-gray-600'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    )
  }

  // 5e: dots
  return (
    <div className="flex items-center gap-0.5">
      <span
        className={`w-2.5 h-2.5 rounded-full border ${
          proficient
            ? expertise
              ? 'bg-amber-400 border-amber-400'
              : 'bg-amber-500 border-amber-500'
            : 'border-gray-600'
        }`}
      />
      {expertise && (
        <span className="w-2.5 h-2.5 rounded-full border bg-amber-400 border-amber-400" />
      )}
    </div>
  )
}

export function profRankToNumber(rank: string): number {
  switch (rank) {
    case 'trained': return 1
    case 'expert': return 2
    case 'master': return 3
    case 'legendary': return 4
    default: return 0
  }
}
