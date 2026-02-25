import { useState } from 'react'
import { useBuilderStore } from '../../../stores/use-builder-store'
import type { AbilityName } from '../../../types/character-common'
import { ABILITY_NAMES, abilityModifier, formatMod } from '../../../types/character-common'

export default function AsiModal(): JSX.Element {
  const abilityScores = useBuilderStore((s) => s.abilityScores)
  const activeAsiSlotId = useBuilderStore((s) => s.activeAsiSlotId)
  const confirmAsi = useBuilderStore((s) => s.confirmAsi)
  const resetAsi = useBuilderStore((s) => s.resetAsi)
  const closeCustomModal = useBuilderStore((s) => s.closeCustomModal)
  const buildSlots = useBuilderStore((s) => s.buildSlots)

  const [mode, setMode] = useState<'+2' | '+1/+1'>('+2')
  const [selected, setSelected] = useState<AbilityName[]>([])

  const asiSlot = buildSlots.find((s) => s.id === activeAsiSlotId)
  const isAlreadyConfirmed = asiSlot?.selectedId === 'confirmed'

  const toggleAbility = (ab: AbilityName): void => {
    if (mode === '+2') {
      setSelected([ab])
    } else {
      if (selected.includes(ab)) {
        setSelected(selected.filter((a) => a !== ab))
      } else if (selected.length < 2) {
        setSelected([...selected, ab])
      }
    }
  }

  const canConfirm = mode === '+2' ? selected.length === 1 : selected.length === 2

  const handleConfirm = (): void => {
    if (!activeAsiSlotId || !canConfirm) return
    confirmAsi(activeAsiSlotId, selected)
    setSelected([])
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-gray-900/98 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-bold text-gray-100">
          Ability Score Improvement
          {asiSlot && <span className="text-sm font-normal text-gray-500 ml-2">(Level {asiSlot.level})</span>}
        </h2>
        <button onClick={closeCustomModal} className="text-gray-400 hover:text-gray-200 text-xl leading-none px-2">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-sm text-gray-400 mb-4">
          Choose to increase one ability score by 2, or two ability scores by 1 each. Scores cannot exceed 20.
        </p>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setMode('+2')
              setSelected([])
            }}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              mode === '+2'
                ? 'bg-amber-900/30 border-amber-500/50 text-amber-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            +2 to One
          </button>
          <button
            onClick={() => {
              setMode('+1/+1')
              setSelected([])
            }}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              mode === '+1/+1'
                ? 'bg-amber-900/30 border-amber-500/50 text-amber-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            +1 to Two
          </button>
        </div>

        {/* Ability grid */}
        <div className="grid grid-cols-3 gap-4 max-w-lg">
          {ABILITY_NAMES.map((ab) => {
            const score = abilityScores[ab]
            const mod = abilityModifier(score)
            const isSelected = selected.includes(ab)
            const boost = isSelected ? (mode === '+2' ? 2 : 1) : 0
            const atMax = score >= 20 || (mode === '+2' && score >= 19 && !isSelected)

            return (
              <button
                key={ab}
                onClick={() => !isAlreadyConfirmed && !atMax && toggleAbility(ab)}
                disabled={isAlreadyConfirmed || atMax}
                className={`rounded-lg p-3 text-center border transition-colors ${
                  isSelected
                    ? 'bg-amber-900/30 border-amber-500'
                    : atMax
                      ? 'bg-gray-800/50 border-gray-700/50 opacity-50 cursor-not-allowed'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-500 cursor-pointer'
                }`}
              >
                <div className="text-xs text-gray-400 uppercase font-semibold mb-1">{ab.slice(0, 3)}</div>
                <div className="text-lg font-bold text-gray-100">
                  {score}
                  {boost > 0 && <span className="text-green-400 text-sm ml-1">+{boost}</span>}
                </div>
                <div className="text-amber-400 font-bold text-sm">
                  {formatMod(mod)}
                  {boost > 0 && (
                    <span className="text-green-400 ml-1">({formatMod(abilityModifier(score + boost))})</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-900">
        <span className="text-xs text-gray-500">
          {mode === '+2' ? 'Increase one ability by 2' : 'Increase two abilities by 1 each'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={closeCustomModal}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Cancel
          </button>
          {isAlreadyConfirmed ? (
            <button
              onClick={() => {
                if (activeAsiSlotId) resetAsi(activeAsiSlotId)
              }}
              className="px-4 py-2 text-sm font-medium rounded transition-colors bg-red-700 hover:bg-red-600 text-white"
            >
              Reset & Re-choose
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-2 text-sm font-medium rounded transition-colors bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white"
            >
              Confirm ASI
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
