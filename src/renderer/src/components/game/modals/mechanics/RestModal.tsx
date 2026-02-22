import { useCallback, useState } from 'react'
import {
  applyLongRest,
  applyShortRest,
  getLongRestPreview,
  getShortRestPreview,
  rollShortRestDice,
  type ShortRestDiceRoll,
  type ShortRestPreview as SRPreview
} from '../../../services/character/rest-service-5e'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import { is5eCharacter } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import { abilityModifier } from '../../../types/character-common'

interface RestModalProps {
  mode: 'shortRest' | 'longRest'
  campaignCharacterIds: string[]
  onClose: () => void
  onApply: (restoredCharacterIds: string[]) => void
}

interface PCShortRestState {
  selected: boolean
  preview: SRPreview
  diceCount: number
  selectedDieSize: number
  rolls: ShortRestDiceRoll[]
  rolled: boolean
  arcaneRecoverySlots: number[]
}

interface PCLongRestState {
  selected: boolean
}

export default function RestModal({ mode, campaignCharacterIds, onClose, onApply }: RestModalProps): JSX.Element {
  const characters = useCharacterStore((s) => s.characters)
  const remoteCharacters = useLobbyStore((s) => s.remoteCharacters)

  // Get all PCs for this campaign
  const pcs: Character5e[] = campaignCharacterIds
    .map((id) => {
      const local = characters.find((c) => c.id === id)
      const remote = remoteCharacters[id]
      return local ?? remote
    })
    .filter((c): c is Character5e => !!c && is5eCharacter(c))

  // Short rest per-PC state
  const [shortRestStates, setShortRestStates] = useState<Record<string, PCShortRestState>>(() => {
    const states: Record<string, PCShortRestState> = {}
    for (const pc of pcs) {
      const preview = getShortRestPreview(pc)
      const dieSizes = [...new Set(pc.classes.map((c) => c.hitDie))].sort((a, b) => b - a)
      states[pc.id] = {
        selected: true,
        preview,
        diceCount: Math.min(1, pc.hitDice.reduce((s, h) => s + h.current, 0)),
        selectedDieSize: dieSizes[0] ?? 8,
        rolls: [],
        rolled: false,
        arcaneRecoverySlots: []
      }
    }
    return states
  })

  // Long rest per-PC state
  const [longRestStates, setLongRestStates] = useState<Record<string, PCLongRestState>>(() => {
    const states: Record<string, PCLongRestState> = {}
    for (const pc of pcs) {
      states[pc.id] = { selected: true }
    }
    return states
  })

  const [applied, setApplied] = useState(false)

  const updateShortRestState = useCallback((id: string, update: Partial<PCShortRestState>) => {
    setShortRestStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...update }
    }))
  }, [])

  const handleRollDice = useCallback(
    (pcId: string) => {
      const state = shortRestStates[pcId]
      if (!state) return
      const pc = pcs.find((c) => c.id === pcId)
      if (!pc) return
      const conMod = abilityModifier(pc.abilityScores.constitution)
      const rolls = rollShortRestDice(state.diceCount, state.selectedDieSize, conMod)
      updateShortRestState(pcId, { rolls, rolled: true })
    },
    [shortRestStates, pcs, updateShortRestState]
  )

  const handleToggleArcaneSlot = useCallback((pcId: string, level: number) => {
    setShortRestStates((prev) => {
      const state = prev[pcId]
      if (!state) return prev
      const existing = state.arcaneRecoverySlots
      const updated = existing.includes(level) ? existing.filter((l) => l !== level) : [...existing, level]
      return { ...prev, [pcId]: { ...state, arcaneRecoverySlots: updated } }
    })
  }, [])

  const handleApplyShortRest = useCallback(() => {
    const restoredIds: string[] = []
    const { saveCharacter } = useCharacterStore.getState()
    const { role, sendMessage } = useNetworkStore.getState()
    const { setRemoteCharacter } = useLobbyStore.getState()
    const activeMap = useGameStore.getState().maps.find((m) => m.id === useGameStore.getState().activeMapId)

    for (const pc of pcs) {
      const state = shortRestStates[pc.id]
      if (!state?.selected) continue

      // Get fresh character data
      const latest = useCharacterStore.getState().characters.find((c) => c.id === pc.id) ?? pc
      if (!is5eCharacter(latest)) continue

      const result = applyShortRest(latest, state.rolls, state.arcaneRecoverySlots)
      saveCharacter(result.character)
      restoredIds.push(pc.id)

      // Sync token HP on map
      if (activeMap) {
        const token = activeMap.tokens.find((t) => t.entityId === pc.id)
        if (token) {
          useGameStore.getState().updateToken(activeMap.id, token.id, {
            currentHP: result.character.hitPoints.current
          })
        }
      }

      // Broadcast if DM managing remote character
      if (role === 'host' && result.character.playerId !== 'local') {
        sendMessage('dm:character-update', {
          characterId: result.character.id,
          characterData: result.character,
          targetPeerId: result.character.playerId
        })
        setRemoteCharacter(result.character.id, result.character)
      }
    }

    setApplied(true)
    onApply(restoredIds)
  }, [pcs, shortRestStates, onApply])

  const handleApplyLongRest = useCallback(() => {
    const restoredIds: string[] = []
    const { saveCharacter } = useCharacterStore.getState()
    const { role, sendMessage } = useNetworkStore.getState()
    const { setRemoteCharacter } = useLobbyStore.getState()
    const activeMap = useGameStore.getState().maps.find((m) => m.id === useGameStore.getState().activeMapId)

    for (const pc of pcs) {
      if (!longRestStates[pc.id]?.selected) continue

      const latest = useCharacterStore.getState().characters.find((c) => c.id === pc.id) ?? pc
      if (!is5eCharacter(latest)) continue

      const result = applyLongRest(latest)
      saveCharacter(result.character)
      restoredIds.push(pc.id)

      // Sync token HP on map
      if (activeMap) {
        const token = activeMap.tokens.find((t) => t.entityId === pc.id)
        if (token) {
          useGameStore.getState().updateToken(activeMap.id, token.id, {
            currentHP: result.character.hitPoints.current,
            maxHP: result.character.hitPoints.maximum
          })
        }
      }

      // Broadcast if DM managing remote character
      if (role === 'host' && result.character.playerId !== 'local') {
        sendMessage('dm:character-update', {
          characterId: result.character.id,
          characterData: result.character,
          targetPeerId: result.character.playerId
        })
        setRemoteCharacter(result.character.id, result.character)
      }
    }

    setApplied(true)
    onApply(restoredIds)
  }, [pcs, longRestStates, onApply])

  const selectedCount =
    mode === 'shortRest'
      ? Object.values(shortRestStates).filter((s) => s.selected).length
      : Object.values(longRestStates).filter((s) => s.selected).length

  const allRolled =
    mode === 'shortRest'
      ? Object.entries(shortRestStates).every(([, s]) => !s.selected || s.rolled || s.diceCount === 0)
      : true

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-amber-400">
            {mode === 'shortRest' ? 'Short Rest (1 Hour)' : 'Long Rest (8 Hours)'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer" aria-label="Close">
            &times;
          </button>
        </div>

        {applied ? (
          <div className="text-center py-8">
            <div className="text-green-400 text-lg font-semibold mb-2">Rest Complete!</div>
            <p className="text-gray-400 text-sm">
              {mode === 'shortRest' ? 'Short rest applied successfully.' : 'Long rest applied successfully.'}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {pcs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No characters found in this campaign.</p>
              ) : mode === 'shortRest' ? (
                /* Short Rest PC rows */
                pcs.map((pc) => {
                  const state = shortRestStates[pc.id]
                  if (!state) return null
                  const conMod = abilityModifier(pc.abilityScores.constitution)
                  const dieSizes = [...new Set(pc.classes.map((c) => c.hitDie))].sort((a, b) => b - a)
                  const isMulticlass = pc.classes.length > 1
                  const totalHealing = state.rolls.reduce((sum, r) => sum + r.healing, 0)

                  return (
                    <div
                      key={pc.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        state.selected
                          ? 'border-amber-600/50 bg-gray-800/50'
                          : 'border-gray-700/30 bg-gray-800/20 opacity-50'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={() => updateShortRestState(pc.id, { selected: !state.selected })}
                          className="accent-amber-500"
                        />
                        <span className="text-sm font-semibold text-gray-200">{pc.name}</span>
                        <span className="text-xs text-gray-500">
                          Lv{pc.level} {pc.classes.map((c) => c.name).join('/')}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          HP: {pc.hitPoints.current}/{pc.hitPoints.maximum}
                        </span>
                      </div>

                      {state.selected && (
                        <div className="space-y-2 pl-6">
                          {/* HD info */}
                          <div className="text-xs text-gray-400">
                            Hit Dice:{' '}
                            <span className="text-amber-400 font-semibold">
                              {pc.hitDice.reduce((s, h) => s + h.current, 0)}/{pc.hitDice.reduce((s, h) => s + h.maximum, 0)}
                            </span>
                            {isMulticlass && (
                              <span className="text-gray-500 ml-1">
                                ({pc.hitDice.map((h) => `${h.current}/${h.maximum}d${h.dieType}`).join(' + ')})
                              </span>
                            )}
                          </div>

                          {pc.hitDice.reduce((s, h) => s + h.current, 0) === 0 ? (
                            <div className="text-xs text-red-400">No Hit Dice remaining.</div>
                          ) : !state.rolled ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Die size selector for multiclass */}
                              {isMulticlass && dieSizes.length > 1 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-500">Die:</span>
                                  {dieSizes.map((d) => (
                                    <button
                                      key={d}
                                      onClick={() => updateShortRestState(pc.id, { selectedDieSize: d })}
                                      className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                                        state.selectedDieSize === d
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                      }`}
                                    >
                                      d{d}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Dice count */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500">Spend:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={pc.hitDice.reduce((s, h) => s + h.current, 0)}
                                  value={state.diceCount}
                                  onChange={(e) =>
                                    updateShortRestState(pc.id, {
                                      diceCount: Math.max(
                                        0,
                                        Math.min(pc.hitDice.reduce((s, h) => s + h.current, 0), parseInt(e.target.value, 10) || 0)
                                      )
                                    })
                                  }
                                  className="w-12 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-center text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                                />
                                <span className="text-[10px] text-gray-500">
                                  d{isMulticlass ? state.selectedDieSize : (pc.classes[0]?.hitDie ?? 8)}
                                </span>
                                <span className="text-[10px] text-gray-500">+ {conMod} CON</span>
                              </div>
                              <button
                                onClick={() => handleRollDice(pc.id)}
                                disabled={state.diceCount === 0}
                                className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white cursor-pointer transition-colors"
                              >
                                Roll
                              </button>
                            </div>
                          ) : (
                            /* Roll results */
                            <div className="space-y-1">
                              {state.rolls.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
                                  <span className="text-gray-500">Die {i + 1}:</span>
                                  <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-900/50 border border-amber-600/50 rounded text-amber-300 font-bold text-xs">
                                    {r.rawRoll}
                                  </span>
                                  <span className="text-gray-500">+ {r.conMod}</span>
                                  <span className="text-gray-600">=</span>
                                  <span className="text-green-400 font-semibold">+{r.healing} HP</span>
                                </div>
                              ))}
                              {state.rolls.length > 0 && (
                                <div className="text-xs font-semibold text-green-400 pt-1 border-t border-gray-700/50">
                                  Total: +{totalHealing} HP
                                  <span className="text-gray-500 font-normal ml-2">
                                    ({pc.hitPoints.current} →{' '}
                                    {Math.min(pc.hitPoints.maximum, pc.hitPoints.current + totalHealing)})
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Arcane Recovery (Wizard) */}
                          {state.preview.arcaneRecoveryEligible && (
                            <div className="border-t border-gray-700/30 pt-2 mt-2">
                              <div className="text-xs text-purple-400 font-semibold mb-1">
                                Arcane Recovery (recover up to {state.preview.arcaneRecoverySlotsToRecover} slot levels)
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(pc.spellSlotLevels ?? {})
                                  .filter(
                                    ([level, slots]) =>
                                      Number(level) <= state.preview.arcaneRecoveryMaxSlotLevel &&
                                      slots.current < slots.max
                                  )
                                  .map(([level, slots]) => {
                                    const lvl = Number(level)
                                    const isSelected = state.arcaneRecoverySlots.includes(lvl)
                                    const currentTotal = state.arcaneRecoverySlots.reduce((s, l) => s + l, 0)
                                    const canAdd =
                                      !isSelected && currentTotal + lvl <= state.preview.arcaneRecoverySlotsToRecover
                                    return (
                                      <button
                                        key={level}
                                        onClick={() => handleToggleArcaneSlot(pc.id, lvl)}
                                        disabled={!isSelected && !canAdd}
                                        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'bg-purple-600 text-white'
                                            : canAdd
                                              ? 'bg-gray-700 text-gray-300 hover:bg-purple-600/30'
                                              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                        }`}
                                      >
                                        L{level} ({slots.current}/{slots.max})
                                      </button>
                                    )
                                  })}
                              </div>
                            </div>
                          )}

                          {/* Restored resources summary */}
                          {(state.preview.restorableClassResources.length > 0 ||
                            state.preview.restorableSpeciesResources.length > 0 ||
                            state.preview.warlockPactSlots ||
                            state.preview.wildShapeRegain) && (
                            <div className="text-[10px] text-gray-500 mt-1">
                              Will also restore:{' '}
                              {[
                                ...state.preview.restorableClassResources.map((r) => r.name),
                                ...state.preview.restorableSpeciesResources.map((r) => r.name),
                                state.preview.warlockPactSlots ? 'Pact Magic Slots' : '',
                                state.preview.wildShapeRegain ? 'Wild Shape (+1)' : '',
                                state.preview.rangerTireless ? 'Exhaustion -1' : ''
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                /* Long Rest PC rows */
                pcs.map((pc) => {
                  const state = longRestStates[pc.id]
                  if (!state) return null
                  const preview = getLongRestPreview(pc)

                  return (
                    <div
                      key={pc.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        state.selected
                          ? 'border-blue-600/50 bg-gray-800/50'
                          : 'border-gray-700/30 bg-gray-800/20 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={() =>
                            setLongRestStates((prev) => ({
                              ...prev,
                              [pc.id]: { selected: !state.selected }
                            }))
                          }
                          className="accent-blue-500"
                        />
                        <span className="text-sm font-semibold text-gray-200">{pc.name}</span>
                        <span className="text-xs text-gray-500">
                          Lv{pc.level} {pc.classes.map((c) => c.name).join('/')}
                        </span>
                      </div>

                      {state.selected && (
                        <div className="pl-6 space-y-1">
                          <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-0.5">
                            {preview.currentHP < preview.maxHP && (
                              <span>
                                HP: {preview.currentHP} → <span className="text-green-400">{preview.maxHP}</span>
                              </span>
                            )}
                            {preview.currentHD < preview.maxHD && (
                              <span>
                                HD: {preview.currentHD} → <span className="text-green-400">{preview.maxHD}</span>
                              </span>
                            )}
                            {preview.spellSlotsToRestore.length > 0 && (
                              <span className="text-blue-400">Spell slots restored</span>
                            )}
                            {preview.pactSlotsToRestore.length > 0 && (
                              <span className="text-purple-400">Pact magic restored</span>
                            )}
                            {preview.classResourcesToRestore.length > 0 && (
                              <span>Resources: {preview.classResourcesToRestore.map((r) => r.name).join(', ')}</span>
                            )}
                            {preview.exhaustionReduction && (
                              <span className="text-yellow-400">
                                Exhaustion {preview.currentExhaustionLevel} → {preview.currentExhaustionLevel - 1}
                              </span>
                            )}
                            {preview.heroicInspirationGain && (
                              <span className="text-amber-400">Heroic Inspiration</span>
                            )}
                            {preview.wildShapeRestore && <span>Wild Shape restored</span>}
                            {preview.deathSavesReset && <span>Death saves reset</span>}
                            {preview.innateSpellsToRestore.length > 0 && (
                              <span>Innate spells: {preview.innateSpellsToRestore.join(', ')}</span>
                            )}
                          </div>
                          {preview.currentHP === preview.maxHP &&
                            preview.currentHD === preview.maxHD &&
                            preview.spellSlotsToRestore.length === 0 &&
                            preview.classResourcesToRestore.length === 0 &&
                            !preview.exhaustionReduction &&
                            !preview.deathSavesReset && (
                              <div className="text-[10px] text-gray-600 italic">Already fully rested</div>
                            )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-700/50 pt-3">
              <span className="text-xs text-gray-500">
                {selectedCount} of {pcs.length} characters selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:bg-gray-800 text-gray-300 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={mode === 'shortRest' ? handleApplyShortRest : handleApplyLongRest}
                  disabled={selectedCount === 0 || (mode === 'shortRest' && !allRolled)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white cursor-pointer transition-colors"
                >
                  Apply {mode === 'shortRest' ? 'Short' : 'Long'} Rest
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
