import { useMemo } from 'react'
import { analyzePreparation } from '../../../services/character/spell-preparation-analyzer'
import Modal from '../../ui/Modal'

interface SpellPrepOptimizerProps {
  open: boolean
  onClose: () => void
  preparedSpells: Array<{
    name: string
    school?: string
    level: number
    concentration?: boolean
    ritual?: boolean
  }>
  knownSpells: Array<{ name: string; level: number; ritual?: boolean }>
}

export default function SpellPrepOptimizer({
  open,
  onClose,
  preparedSpells,
  knownSpells
}: SpellPrepOptimizerProps): JSX.Element {
  const analysis = useMemo(() => analyzePreparation(preparedSpells, knownSpells), [preparedSpells, knownSpells])

  return (
    <Modal open={open} onClose={onClose} title="Spell Preparation Helper">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Diversity */}
        <div>
          <h4 className="text-sm font-semibold text-amber-400 mb-2">School Diversity</h4>
          {analysis.diversity.length === 0 ? (
            <p className="text-sm text-gray-500">No spells prepared</p>
          ) : (
            <div className="space-y-1.5">
              {analysis.diversity.map((d) => (
                <div key={d.school} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-24 truncate">{d.school}</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: `${d.percentage}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {d.count} ({d.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          )}
          {analysis.missingSchools.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">Missing: {analysis.missingSchools.join(', ')}</p>
          )}
        </div>

        {/* Concentration */}
        <div>
          <h4 className="text-sm font-semibold text-amber-400 mb-2">
            Concentration ({analysis.concentrationSpells.length})
          </h4>
          {analysis.concentrationWarning && (
            <p className="text-xs text-red-400 mb-2">
              Over 40% of your prepared spells require concentration. Consider diversifying.
            </p>
          )}
          {analysis.concentrationSpells.length > 0 ? (
            <ul className="space-y-1">
              {analysis.concentrationSpells.map((s) => (
                <li key={s.spellName} className="text-sm text-gray-300">
                  {s.spellName} <span className="text-gray-500">(level {s.level})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No concentration spells prepared</p>
          )}
        </div>

        {/* Ritual Suggestions */}
        {analysis.ritualSuggestions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-amber-400 mb-2">Ritual Suggestions</h4>
            <ul className="space-y-1">
              {analysis.ritualSuggestions.map((s) => (
                <li key={s.spellName} className="text-sm text-gray-300">
                  {s.spellName} <span className="text-gray-500">- {s.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
