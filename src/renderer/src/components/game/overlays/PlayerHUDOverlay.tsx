import { useCallback, useMemo, useRef, useState } from 'react'
import { CONDITIONS_5E } from '../../../data/conditions'
import { resolveEffects } from '../../../services/effect-resolver-5e'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import { is5eCharacter } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import { abilityModifier, formatMod } from '../../../types/character-common'
import type { EntityCondition } from '../../../types/game-state'

interface PlayerHUDOverlayProps {
  character: Character | null
  conditions: EntityCondition[]
}

const CONDITION_NAMES = CONDITIONS_5E.map((c) => c.name)

export default function PlayerHUDOverlay({ character, conditions }: PlayerHUDOverlayProps): JSX.Element {
  const underwaterCombat = useGameStore((s) => s.underwaterCombat)
  const ambientLight = useGameStore((s) => s.ambientLight)
  const travelPace = useGameStore((s) => s.travelPace)
  const turnStates = useGameStore((s) => s.turnStates)

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const hudRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [editingHP, setEditingHP] = useState(false)
  const [hpInput, setHpInput] = useState('')
  const [showConditionPicker, setShowConditionPicker] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't initiate drag on interactive elements
    const target = e.target as HTMLElement
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('input')
    )
      return
    if (!hudRef.current) return
    const rect = hudRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragging(true)

    const onMove = (ev: MouseEvent): void => {
      setPosition({
        x: ev.clientX - dragOffset.current.x,
        y: ev.clientY - dragOffset.current.y
      })
    }
    const onUp = (): void => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  if (!character) return <></>
  const char5e = is5eCharacter(character) ? character : null

  // Resolved effects for HUD indicators
  const customEffects = useGameStore((s) => s.customEffects)
  const myCustomEffects = customEffects.filter((e) => e.targetEntityId === character.id)
  const resolved = useMemo(() => (char5e ? resolveEffects(char5e, myCustomEffects) : null), [char5e, myCustomEffects])

  const hp = character.hitPoints
  const hpPercent = hp.maximum > 0 ? Math.max(0, (hp.current / hp.maximum) * 100) : 0
  const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
  const ac = character.armorClass
  const speed = character.speed
  const dexMod = abilityModifier(character.abilityScores.dexterity)
  const bloodied = hp.current > 0 && hp.current <= Math.floor(hp.maximum / 2)
  const turnState = turnStates[character.id]

  // Save & broadcast helper
  const saveAndBroadcast = useCallback((updated: Character5e) => {
    useCharacterStore.getState().saveCharacter(updated)
    const activeMap = useGameStore.getState().maps.find((m) => m.id === useGameStore.getState().activeMapId)
    if (activeMap) {
      const token = activeMap.tokens.find((t) => t.entityId === updated.id)
      if (token) {
        useGameStore.getState().updateToken(activeMap.id, token.id, {
          currentHP: updated.hitPoints.current
        })
      }
    }
    const { role, sendMessage } = useNetworkStore.getState()
    if (role !== 'host') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: 'host'
      })
    }
  }, [])

  // HP adjustment
  const adjustHP = useCallback(
    (delta: number) => {
      if (!char5e) return
      const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
      if (!latest || !is5eCharacter(latest)) return

      let newCurrent = latest.hitPoints.current
      let newTemp = latest.hitPoints.temporary

      if (delta < 0) {
        // Damage: consume temp HP first
        const dmg = Math.abs(delta)
        if (newTemp > 0) {
          const absorbed = Math.min(newTemp, dmg)
          newTemp -= absorbed
          newCurrent = Math.max(0, newCurrent - (dmg - absorbed))
        } else {
          newCurrent = Math.max(0, newCurrent - dmg)
        }
      } else {
        // Healing: can't exceed max
        newCurrent = Math.min(latest.hitPoints.maximum, newCurrent + delta)
      }

      const updated = {
        ...latest,
        hitPoints: { ...latest.hitPoints, current: newCurrent, temporary: newTemp },
        updatedAt: new Date().toISOString()
      }
      saveAndBroadcast(updated)
    },
    [char5e, saveAndBroadcast]
  )

  const handleHPEdit = useCallback(() => {
    if (!char5e) return
    const val = parseInt(hpInput, 10)
    if (Number.isNaN(val)) {
      setEditingHP(false)
      return
    }

    const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
    if (!latest || !is5eCharacter(latest)) return

    const newHP = Math.max(0, Math.min(latest.hitPoints.maximum, val))
    const updated = {
      ...latest,
      hitPoints: { ...latest.hitPoints, current: newHP },
      updatedAt: new Date().toISOString()
    }
    saveAndBroadcast(updated)
    setEditingHP(false)
  }, [char5e, hpInput, saveAndBroadcast])

  // Spell slot toggle
  const toggleSpellSlot = useCallback(
    (level: number) => {
      if (!char5e) return
      const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
      if (!latest || !is5eCharacter(latest)) return

      const slot = latest.spellSlotLevels[level]
      if (!slot) return
      const newCurrent = slot.current > 0 ? slot.current - 1 : slot.max
      const updated = {
        ...latest,
        spellSlotLevels: { ...latest.spellSlotLevels, [level]: { ...slot, current: newCurrent } },
        updatedAt: new Date().toISOString()
      }
      saveAndBroadcast(updated)
    },
    [char5e, saveAndBroadcast]
  )

  // Pact slot toggle
  const togglePactSlot = useCallback(
    (level: number) => {
      if (!char5e || !char5e.pactMagicSlotLevels) return
      const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
      if (!latest || !is5eCharacter(latest) || !latest.pactMagicSlotLevels) return

      const slot = latest.pactMagicSlotLevels[level]
      if (!slot) return
      const newCurrent = slot.current > 0 ? slot.current - 1 : slot.max
      const updated = {
        ...latest,
        pactMagicSlotLevels: { ...latest.pactMagicSlotLevels, [level]: { ...slot, current: newCurrent } },
        updatedAt: new Date().toISOString()
      }
      saveAndBroadcast(updated)
    },
    [char5e, saveAndBroadcast]
  )

  // Class resource adjust
  const adjustResource = useCallback(
    (resourceId: string, delta: number) => {
      if (!char5e) return
      const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
      if (!latest || !is5eCharacter(latest)) return

      const updated = {
        ...latest,
        classResources: (latest.classResources ?? []).map((r) =>
          r.id === resourceId ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) } : r
        ),
        updatedAt: new Date().toISOString()
      }
      saveAndBroadcast(updated)
    },
    [char5e, saveAndBroadcast]
  )

  // Death save toggle
  const toggleDeathSave = useCallback(
    (type: 'successes' | 'failures') => {
      if (!char5e) return
      const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
      if (!latest || !is5eCharacter(latest)) return

      const current = latest.deathSaves[type]
      const newVal = current >= 3 ? 0 : current + 1
      const updated = {
        ...latest,
        deathSaves: { ...latest.deathSaves, [type]: newVal },
        updatedAt: new Date().toISOString()
      }

      // Auto-resolution
      if (type === 'successes' && newVal >= 3) {
        // Stabilized
        useGameStore.getState().addCondition({
          id: `cond-${Date.now()}`,
          entityId: latest.id,
          entityName: latest.name,
          condition: 'Stable',
          duration: 'permanent',
          source: 'Death Saves',
          appliedRound: useGameStore.getState().round
        })
      }

      saveAndBroadcast(updated)
    },
    [char5e, saveAndBroadcast]
  )

  // Heroic Inspiration toggle
  const toggleInspiration = useCallback(() => {
    if (!char5e) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
    if (!latest || !is5eCharacter(latest)) return

    const updated = { ...latest, heroicInspiration: !latest.heroicInspiration, updatedAt: new Date().toISOString() }
    saveAndBroadcast(updated)
  }, [char5e, saveAndBroadcast])

  // Concentration drop
  const dropConcentration = useCallback(() => {
    if (!character) return
    useGameStore.getState().setConcentrating(character.id, undefined)
  }, [character])

  // Add condition
  const addConditionFromPicker = useCallback(
    (condName: string) => {
      if (!character) return
      useGameStore.getState().addCondition({
        id: `cond-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
        entityId: character.id,
        entityName: character.name,
        condition: condName,
        duration: 'permanent',
        source: 'Self',
        appliedRound: useGameStore.getState().round
      })
      setShowConditionPicker(false)
    },
    [character]
  )

  // Remove condition
  const removeCondition = useCallback((condId: string) => {
    useGameStore.getState().removeCondition(condId)
  }, [])

  // Temp HP setter
  const [editingTempHP, setEditingTempHP] = useState(false)
  const [tempHPInput, setTempHPInput] = useState('')

  const handleTempHPSet = useCallback(() => {
    if (!char5e) return
    const val = parseInt(tempHPInput, 10)
    if (Number.isNaN(val) || val < 0) {
      setEditingTempHP(false)
      return
    }

    const latest = useCharacterStore.getState().characters.find((c) => c.id === char5e.id) as Character5e | undefined
    if (!latest || !is5eCharacter(latest)) return

    const updated = {
      ...latest,
      hitPoints: { ...latest.hitPoints, temporary: val },
      updatedAt: new Date().toISOString()
    }
    saveAndBroadcast(updated)
    setEditingTempHP(false)
  }, [char5e, tempHPInput, saveAndBroadcast])

  const style: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, transform: 'none' }
    : {}

  // Spell slot pips renderer
  const renderSlotPips = (level: number, current: number, max: number, isPact: boolean = false): JSX.Element => (
    <div className="flex items-center gap-0.5">
      <span className="text-[9px] text-gray-500 w-5">{isPact ? 'P' : `L${level}`}</span>
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          onClick={() => (isPact ? togglePactSlot(level) : toggleSpellSlot(level))}
          className={`w-2.5 h-2.5 rounded-full border cursor-pointer transition-colors ${
            i < current
              ? isPact
                ? 'bg-purple-500 border-purple-400'
                : 'bg-blue-500 border-blue-400'
              : 'bg-gray-700 border-gray-600'
          }`}
          title={`${isPact ? 'Pact' : 'Spell'} slot L${level}: ${current}/${max} (click to toggle)`}
        />
      ))}
    </div>
  )

  return (
    <div
      ref={hudRef}
      className={`${position ? '' : 'absolute top-16 left-1/2 -translate-x-1/2'} z-10 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={style}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl select-none transition-all ${expanded ? 'w-[420px]' : ''}`}
      >
        {/* Collapsed view (always visible) */}
        <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
          {/* Name */}
          <span className="text-sm font-semibold text-gray-100 shrink-0">{character.name}</span>

          {/* HP bar (click to edit) */}
          <div className="flex items-center gap-1 min-w-[140px]">
            <span className="text-[10px] text-gray-500">HP</span>
            {editingHP ? (
              <input
                type="number"
                value={hpInput}
                onChange={(e) => setHpInput(e.target.value)}
                onBlur={handleHPEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleHPEdit()
                  if (e.key === 'Escape') setEditingHP(false)
                }}
                className="w-14 bg-gray-800 border border-amber-500 rounded px-1 py-0.5 text-center text-xs text-gray-100 focus:outline-none"
              />
            ) : (
              <div
                className="flex-1 relative cursor-pointer"
                onClick={() => {
                  setEditingHP(true)
                  setHpInput(String(hp.current))
                }}
                title="Click to edit HP"
              >
                <div className="h-3.5 bg-gray-800/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${hpColor} transition-all duration-300 rounded-full`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white drop-shadow">
                  {hp.current}/{hp.maximum}
                  {hp.temporary > 0 && <span className="text-blue-300 ml-0.5">(+{hp.temporary})</span>}
                </span>
              </div>
            )}
            {/* +/- buttons */}
            <button
              onClick={() => adjustHP(-1)}
              className="w-5 h-5 text-[10px] bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded cursor-pointer"
              title="Take 1 damage"
            >
              -
            </button>
            <button
              onClick={() => adjustHP(1)}
              className="w-5 h-5 text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-300 rounded cursor-pointer"
              title="Heal 1 HP"
            >
              +
            </button>
          </div>

          {/* AC */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">AC</span>
            <span className="font-semibold text-gray-100">{ac}</span>
          </div>

          {/* Spell slot pips (collapsed — just show counts) */}
          {char5e && Object.keys(char5e.spellSlotLevels ?? {}).length > 0 && !expanded && (
            <div className="flex gap-0.5 flex-wrap">
              {Object.entries(char5e.spellSlotLevels)
                .filter(([, s]) => s.max > 0)
                .slice(0, 4)
                .map(([level, slots]) => renderSlotPips(Number(level), slots.current, slots.max))}
            </div>
          )}

          {/* Conditions */}
          {conditions.length > 0 && (
            <div className="flex gap-0.5 flex-wrap">
              {conditions.map((cond) => (
                <span
                  key={cond.id}
                  className="text-[9px] bg-purple-600/30 text-purple-300 border border-purple-500/50 rounded px-1 py-0.5 flex items-center gap-0.5"
                >
                  {cond.condition}
                  {cond.value ? ` ${cond.value}` : ''}
                  <button
                    onClick={() => removeCondition(cond.id)}
                    className="text-purple-400 hover:text-red-400 cursor-pointer"
                    title="Remove condition"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add condition button */}
          <div className="relative">
            <button
              onClick={() => setShowConditionPicker(!showConditionPicker)}
              className="text-[9px] text-gray-500 hover:text-purple-400 cursor-pointer border border-gray-700 rounded px-1 py-0.5"
              title="Add condition"
            >
              +Cond
            </button>
            {showConditionPicker && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto w-36">
                {CONDITION_NAMES.map((name) => (
                  <button
                    key={name}
                    onClick={() => addConditionFromPicker(name)}
                    className="w-full text-left px-2 py-1 text-[10px] text-gray-300 hover:bg-gray-800 cursor-pointer"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Effects (magic items, custom effects) */}
          {resolved && resolved.sources.length > 0 && (
            <div className="flex gap-0.5 flex-wrap">
              {resolved.sources
                .filter((s) => s.sourceType === 'custom' || s.sourceType === 'magic-item')
                .map((s) => {
                  const bonuses: string[] = []
                  for (const e of s.effects) {
                    if (e.type === 'ac_bonus' && e.value) bonuses.push(`AC ${e.value > 0 ? '+' : ''}${e.value}`)
                    else if (e.type === 'attack_bonus' && e.value)
                      bonuses.push(`Atk ${e.value > 0 ? '+' : ''}${e.value}`)
                    else if (e.type === 'damage_bonus' && e.value)
                      bonuses.push(`Dmg ${e.value > 0 ? '+' : ''}${e.value}`)
                    else if (e.type === 'save_bonus' && e.value)
                      bonuses.push(`Save ${e.value > 0 ? '+' : ''}${e.value}`)
                    else if (e.type === 'resistance' && e.stringValue) bonuses.push(`Res: ${e.stringValue}`)
                    else if (e.type === 'temp_hp' && e.value) bonuses.push(`THP ${e.value}`)
                  }
                  const color =
                    s.sourceType === 'custom'
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                      : 'bg-cyan-600/30 text-cyan-300 border-cyan-500/50'
                  return (
                    <span
                      key={s.sourceId}
                      className={`text-[9px] ${color} border rounded px-1 py-0.5`}
                      title={bonuses.length > 0 ? bonuses.join(', ') : s.sourceName}
                    >
                      {s.sourceName}
                    </span>
                  )
                })}
            </div>
          )}

          {/* Bloodied */}
          {bloodied && (
            <span className="text-[9px] bg-red-600/30 text-red-300 border border-red-500/50 rounded px-1 py-0.5">
              Bloodied
            </span>
          )}

          {/* Environment indicators */}
          {underwaterCombat && (
            <span className="text-[9px] bg-blue-600/30 text-blue-300 border border-blue-500/50 rounded px-1 py-0.5">
              Underwater
            </span>
          )}
          {ambientLight !== 'bright' && (
            <span
              className={`text-[9px] rounded px-1 py-0.5 ${
                ambientLight === 'dim'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                  : 'bg-gray-600/30 text-gray-300 border border-gray-500/50'
              }`}
            >
              {ambientLight === 'dim' ? 'Dim Light' : 'Darkness'}
            </span>
          )}
          {travelPace && (
            <span
              className={`text-[9px] rounded px-1 py-0.5 ${
                travelPace === 'fast'
                  ? 'bg-red-600/20 text-red-300 border border-red-500/30'
                  : travelPace === 'slow'
                    ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                    : 'bg-gray-600/20 text-gray-300 border border-gray-500/30'
              }`}
            >
              {travelPace.charAt(0).toUpperCase() + travelPace.slice(1)} Pace
            </span>
          )}

          {/* Expand/collapse toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer ml-auto"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '\u25B2' : '\u25BC'}
          </button>
        </div>

        {/* Expanded view */}
        {expanded && char5e && (
          <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50 pt-2">
            {/* Temp HP */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">Temp HP:</span>
              {editingTempHP ? (
                <input
                  type="number"
                  value={tempHPInput}
                  onChange={(e) => setTempHPInput(e.target.value)}
                  onBlur={handleTempHPSet}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTempHPSet()
                    if (e.key === 'Escape') setEditingTempHP(false)
                  }}
                  className="w-12 bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-center text-xs text-gray-100 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingTempHP(true)
                    setTempHPInput(String(hp.temporary))
                  }}
                  className="text-xs text-blue-300 hover:text-blue-200 cursor-pointer"
                >
                  {hp.temporary}
                </button>
              )}
              <span className="text-[10px] text-gray-600 ml-2">|</span>
              <span className="text-[10px] text-gray-500">Spd: {speed}ft</span>
              <span className="text-[10px] text-gray-500">Init: {formatMod(dexMod)}</span>
            </div>

            {/* Spell Slots (full view) */}
            {Object.keys(char5e.spellSlotLevels ?? {}).length > 0 && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Spell Slots</span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {Object.entries(char5e.spellSlotLevels)
                    .filter(([, s]) => s.max > 0)
                    .map(([level, slots]) => renderSlotPips(Number(level), slots.current, slots.max))}
                </div>
              </div>
            )}

            {/* Pact Magic */}
            {char5e.pactMagicSlotLevels && Object.keys(char5e.pactMagicSlotLevels).length > 0 && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Pact Magic</span>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {Object.entries(char5e.pactMagicSlotLevels)
                    .filter(([, s]) => s.max > 0)
                    .map(([level, slots]) => renderSlotPips(Number(level), slots.current, slots.max, true))}
                </div>
              </div>
            )}

            {/* Class Resources */}
            {(char5e.classResources ?? []).length > 0 && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Class Resources</span>
                <div className="space-y-0.5 mt-0.5">
                  {(char5e.classResources ?? []).map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-400 text-[10px] min-w-[80px]">{r.name}:</span>
                      <span className="text-amber-300 font-semibold text-[10px]">
                        {r.current}/{r.max}
                      </span>
                      <button
                        onClick={() => adjustResource(r.id, -1)}
                        disabled={r.current <= 0}
                        className="w-4 h-4 text-[9px] bg-red-900/40 hover:bg-red-800/60 disabled:bg-gray-800 disabled:text-gray-600 text-red-300 rounded cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        onClick={() => adjustResource(r.id, 1)}
                        disabled={r.current >= r.max}
                        className="w-4 h-4 text-[9px] bg-green-900/40 hover:bg-green-800/60 disabled:bg-gray-800 disabled:text-gray-600 text-green-300 rounded cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Death Saves */}
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Death Saves:</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-green-400">S</span>
                {[0, 1, 2].map((i) => (
                  <button
                    key={`s-${i}`}
                    onClick={() => toggleDeathSave('successes')}
                    className={`w-3 h-3 rounded-full border cursor-pointer ${
                      i < char5e.deathSaves.successes ? 'bg-green-500 border-green-400' : 'bg-gray-700 border-gray-600'
                    }`}
                  />
                ))}
                <span className="text-gray-600 mx-1">|</span>
                <span className="text-[9px] text-red-400">F</span>
                {[0, 1, 2].map((i) => (
                  <button
                    key={`f-${i}`}
                    onClick={() => toggleDeathSave('failures')}
                    className={`w-3 h-3 rounded-full border cursor-pointer ${
                      i < char5e.deathSaves.failures ? 'bg-red-500 border-red-400' : 'bg-gray-700 border-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Hit Dice & Heroic Inspiration */}
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-gray-500">
                Hit Dice:{' '}
                <span className="text-amber-300">
                  {char5e.hitDiceRemaining}/{char5e.level}
                </span>
                {char5e.classes.length > 1
                  ? ` (${char5e.classes.map((c) => `d${c.hitDie}`).join('/')})`
                  : ` d${char5e.classes[0]?.hitDie ?? 8}`}
              </span>
              <button
                onClick={toggleInspiration}
                className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border ${
                  char5e.heroicInspiration
                    ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                    : 'bg-gray-800 text-gray-500 border-gray-700'
                }`}
                title="Toggle Heroic Inspiration"
              >
                {char5e.heroicInspiration ? '\u2605 Inspired' : '\u2606 Inspiration'}
              </button>
            </div>

            {/* Active Effects Summary */}
            {resolved &&
              (resolved.resistances.length > 0 ||
                resolved.immunities.length > 0 ||
                resolved.vulnerabilities.length > 0) && (
                <div className="space-y-0.5">
                  {resolved.resistances.length > 0 && (
                    <div className="text-[10px]">
                      <span className="text-gray-500">Resist:</span>{' '}
                      <span className="text-green-400">{resolved.resistances.join(', ')}</span>
                    </div>
                  )}
                  {resolved.immunities.length > 0 && (
                    <div className="text-[10px]">
                      <span className="text-gray-500">Immune:</span>{' '}
                      <span className="text-cyan-400">{resolved.immunities.join(', ')}</span>
                    </div>
                  )}
                  {resolved.vulnerabilities.length > 0 && (
                    <div className="text-[10px]">
                      <span className="text-gray-500">Vulnerable:</span>{' '}
                      <span className="text-red-400">{resolved.vulnerabilities.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

            {/* Custom Effects with Durations */}
            {myCustomEffects.length > 0 && (
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Active Effects</span>
                <div className="space-y-0.5 mt-0.5">
                  {myCustomEffects.map((ce) => (
                    <div key={ce.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-indigo-300 font-medium">{ce.name}</span>
                      {ce.duration && (
                        <span className="text-gray-600">
                          ({ce.duration.value} {ce.duration.type})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concentration */}
            {turnState?.concentratingSpell && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-purple-400">Concentrating:</span>
                <span className="text-[10px] text-purple-300 font-semibold">{turnState.concentratingSpell}</span>
                <button
                  onClick={dropConcentration}
                  className="text-[9px] text-red-400 hover:text-red-300 cursor-pointer"
                  title="Drop concentration"
                >
                  (drop)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
