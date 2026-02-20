import { useCallback, useEffect, useRef, useState } from 'react'
import { play as playSound } from '../../../services/sound-manager'
import { useGameStore } from '../../../stores/useGameStore'
import type { CombatTimerConfig } from '../../../types/campaign'
import type { InitiativeEntry, InitiativeState } from '../../../types/game-state'
import type { MapToken } from '../../../types/map'

interface InitiativeTrackerProps {
  initiative: InitiativeState | null
  round: number
  isHost: boolean
  onStartInitiative: (entries: InitiativeEntry[]) => void
  onNextTurn: () => void
  onPrevTurn: () => void
  onEndInitiative: () => void
  onUpdateEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void
  onRemoveEntry: (entryId: string) => void
  onAddEntry?: (entry: InitiativeEntry) => void
  tokens?: MapToken[]
  /** Called when user clicks a portrait to center the map on that token */
  onCenterToken?: (entityId: string) => void
  /** Persisted combat timer config */
  combatTimer?: CombatTimerConfig
  /** Called when DM changes combat timer settings */
  onCombatTimerChange?: (config: CombatTimerConfig) => void
}

interface NewEntry {
  name: string
  modifier: string
  entityType: 'player' | 'npc' | 'enemy'
  surprised: boolean
  legendaryResistances: string
  inLair: boolean
}

const TIMER_PRESETS = [30, 60, 90, 120] as const

export default function InitiativeTracker({
  initiative,
  round,
  isHost,
  onStartInitiative,
  onNextTurn,
  onPrevTurn,
  onEndInitiative,
  onUpdateEntry,
  onRemoveEntry,
  onAddEntry,
  tokens = [],
  onCenterToken,
  combatTimer,
  onCombatTimerChange
}: InitiativeTrackerProps): JSX.Element {
  const [addName, setAddName] = useState('')
  const [addInit, setAddInit] = useState('')
  const [addType, setAddType] = useState<'player' | 'npc' | 'enemy'>('enemy')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEntries, setNewEntries] = useState<NewEntry[]>([
    { name: '', modifier: '0', entityType: 'player', surprised: false, legendaryResistances: '', inLair: false }
  ])
  const [checkedTokenIds, setCheckedTokenIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTotal, setEditTotal] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [delayedEntries, setDelayedEntries] = useState<InitiativeEntry[]>([])
  const reorderInitiative = useGameStore((s) => s.reorderInitiative)

  // Combat timer state
  const [timerEnabled, setTimerEnabled] = useState(combatTimer?.enabled ?? false)
  const [timerSeconds, setTimerSeconds] = useState(combatTimer?.seconds ?? 60)
  const [timerAction, setTimerAction] = useState<'warning' | 'auto-skip'>(combatTimer?.action ?? 'warning')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const [showTimerConfig, setShowTimerConfig] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(String(combatTimer?.seconds ?? 60))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPaused = useGameStore((s) => s.isPaused)
  const currentIndexRef = useRef<number>(-1)

  // Persist timer config changes
  const updateTimerConfig = useCallback(
    (updates: Partial<CombatTimerConfig>) => {
      const newConfig: CombatTimerConfig = {
        enabled: updates.enabled ?? timerEnabled,
        seconds: updates.seconds ?? timerSeconds,
        action: updates.action ?? timerAction
      }
      if (updates.enabled !== undefined) setTimerEnabled(newConfig.enabled)
      if (updates.seconds !== undefined) setTimerSeconds(newConfig.seconds)
      if (updates.action !== undefined) setTimerAction(newConfig.action)
      onCombatTimerChange?.(newConfig)
    },
    [timerEnabled, timerSeconds, timerAction, onCombatTimerChange]
  )

  // Start timer when turn changes
  useEffect(() => {
    if (!initiative || !timerEnabled || !isHost) return

    const newIndex = initiative.currentIndex
    if (newIndex === currentIndexRef.current) return
    currentIndexRef.current = newIndex

    // Reset and start timer for new turn
    setTimerExpired(false)
    setTimeRemaining(timerSeconds)
    setTimerRunning(true)
  }, [initiative?.currentIndex, timerEnabled, timerSeconds, isHost, initiative])

  // Tick the timer
  useEffect(() => {
    if (!timerRunning || isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer expired
          setTimerRunning(false)
          setTimerExpired(true)
          if (timerAction === 'auto-skip') {
            onNextTurn()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [timerRunning, isPaused, timerAction, onNextTurn])

  // Stop timer when initiative ends
  useEffect(() => {
    if (!initiative) {
      setTimerRunning(false)
      setTimeRemaining(0)
      setTimerExpired(false)
      currentIndexRef.current = -1
    }
  }, [initiative])

  const addNewEntryRow = (): void => {
    setNewEntries([
      ...newEntries,
      { name: '', modifier: '0', entityType: 'enemy', surprised: false, legendaryResistances: '', inLair: false }
    ])
  }

  const updateNewEntry = (index: number, updates: Partial<NewEntry>): void => {
    setNewEntries(newEntries.map((e, i) => (i === index ? { ...e, ...updates } : e)))
  }

  const removeNewEntry = (index: number): void => {
    if (newEntries.length <= 1) return
    setNewEntries(newEntries.filter((_, i) => i !== index))
  }

  const handleRollInitiative = (): void => {
    // Group initiative: monsters of the same name share one roll (DMG optional rule)
    const isGroupInit = useGameStore.getState().groupInitiativeEnabled ?? false
    const groupRolls = new Map<string, number>()

    const entries: InitiativeEntry[] = newEntries
      .filter((e) => e.name.trim())
      .map((e) => {
        const mod = parseInt(e.modifier, 10) || 0
        let roll: number

        // Group initiative: same-name enemies share a single roll
        const groupKey = `${e.entityType}:${e.name.trim().toLowerCase()}`
        if (isGroupInit && e.entityType === 'enemy' && groupRolls.has(groupKey)) {
          roll = groupRolls.get(groupKey)!
        } else if (e.surprised) {
          // Surprised creatures roll with disadvantage on initiative (2024 PHB)
          const r1 = Math.floor(Math.random() * 20) + 1
          const r2 = Math.floor(Math.random() * 20) + 1
          roll = Math.min(r1, r2)
        } else {
          roll = Math.floor(Math.random() * 20) + 1
        }

        // Store the roll for group initiative
        if (isGroupInit && e.entityType === 'enemy' && !groupRolls.has(groupKey)) {
          groupRolls.set(groupKey, roll)
        }

        const lr = parseInt(e.legendaryResistances, 10)
        return {
          id: crypto.randomUUID(),
          entityId: crypto.randomUUID(),
          entityName: e.surprised ? `${e.name.trim()} (Surprised)` : e.name.trim(),
          entityType: e.entityType,
          roll,
          modifier: mod,
          total: roll + mod,
          isActive: false,
          ...(lr > 0 ? { legendaryResistances: { max: lr, remaining: lr } } : {}),
          ...(e.inLair ? { inLair: true } : {})
        }
      })

    if (entries.length > 0) {
      onStartInitiative(entries)
      playSound('initiative-start')
    }
  }

  const handleEditSave = (entryId: string): void => {
    const newTotal = parseInt(editTotal, 10)
    if (!Number.isNaN(newTotal)) {
      onUpdateEntry(entryId, { total: newTotal })
    }
    setEditingId(null)
    setEditTotal('')
  }

  // Timer progress bar helper
  const timerProgressPercent = timerSeconds > 0 ? (timeRemaining / timerSeconds) * 100 : 0
  const timerColor =
    timeRemaining <= 10 ? 'bg-red-500' : timeRemaining <= timerSeconds * 0.33 ? 'bg-yellow-500' : 'bg-green-500'
  const timerFlash = timeRemaining <= 10 && timeRemaining > 0 && timerRunning

  // Initiative not active -- show setup
  if (!initiative) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Initiative</h3>

        {isHost ? (
          <>
            <div className="space-y-2">
              {newEntries.map((entry, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input
                    type="text"
                    placeholder="Name"
                    value={entry.name}
                    onChange={(e) => updateNewEntry(i, { name: e.target.value })}
                    className="flex-1 p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-100
                      placeholder-gray-600 focus:outline-none focus:border-amber-500 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Mod"
                    value={entry.modifier}
                    onChange={(e) => updateNewEntry(i, { modifier: e.target.value })}
                    className="w-12 p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-100
                      text-center focus:outline-none focus:border-amber-500 text-xs"
                  />
                  <select
                    value={entry.entityType}
                    onChange={(e) =>
                      updateNewEntry(i, {
                        entityType: e.target.value as 'player' | 'npc' | 'enemy'
                      })
                    }
                    className="w-16 p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-200 text-xs cursor-pointer"
                  >
                    <option value="player">PC</option>
                    <option value="npc">NPC</option>
                    <option value="enemy">Foe</option>
                  </select>
                  <label
                    className="flex items-center gap-0.5 cursor-pointer"
                    title="Surprised (Disadvantage on initiative)"
                  >
                    <input
                      type="checkbox"
                      checked={entry.surprised}
                      onChange={(e) => updateNewEntry(i, { surprised: e.target.checked })}
                      className="w-3 h-3 accent-amber-500"
                    />
                    <span className="text-[9px] text-gray-500">S</span>
                  </label>
                  {entry.entityType === 'enemy' && (
                    <>
                      <input
                        type="number"
                        placeholder="LR"
                        min={0}
                        value={entry.legendaryResistances}
                        onChange={(e) => updateNewEntry(i, { legendaryResistances: e.target.value })}
                        className="w-8 p-1 rounded bg-gray-800 border border-gray-700 text-gray-100
                          text-center focus:outline-none focus:border-orange-500 text-[10px]"
                        title="Legendary Resistances (e.g. 3)"
                      />
                      <label
                        className="flex items-center gap-0.5 cursor-pointer"
                        title="In Lair (adds Lair Action at Init 20)"
                      >
                        <input
                          type="checkbox"
                          checked={entry.inLair}
                          onChange={(e) => updateNewEntry(i, { inLair: e.target.checked })}
                          className="w-3 h-3 accent-purple-500"
                        />
                        <span className="text-[9px] text-gray-500">L</span>
                      </label>
                    </>
                  )}
                  <button
                    onClick={() => removeNewEntry(i)}
                    className="text-gray-500 hover:text-red-400 text-xs cursor-pointer px-1"
                  >
                    &#x2715;
                  </button>
                </div>
              ))}
            </div>

            {/* From Map tokens */}
            {tokens.length > 0 && (
              <div className="border-t border-gray-700/50 pt-2 mt-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">From Map</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {tokens.map((token) => (
                    <label
                      key={token.id}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-800/50 rounded px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={checkedTokenIds.has(token.id)}
                        onChange={(e) => {
                          setCheckedTokenIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(token.id)
                            else next.delete(token.id)
                            return next
                          })
                        }}
                        className="w-3 h-3 accent-amber-500"
                      />
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          token.entityType === 'player'
                            ? 'bg-blue-500'
                            : token.entityType === 'enemy'
                              ? 'bg-red-500'
                              : 'bg-yellow-500'
                        }`}
                      />
                      <span className="text-gray-300 truncate">{token.label}</span>
                      <span className="text-gray-600 ml-auto text-[10px]">
                        {token.initiativeModifier !== undefined ? `+${token.initiativeModifier}` : '+0'}
                      </span>
                    </label>
                  ))}
                </div>
                {checkedTokenIds.size > 0 && (
                  <button
                    onClick={() => {
                      const toAdd: NewEntry[] = tokens
                        .filter((t) => checkedTokenIds.has(t.id))
                        .map((t) => ({
                          name: t.label,
                          modifier: String(t.initiativeModifier ?? 0),
                          entityType: t.entityType,
                          surprised: false,
                          legendaryResistances: '',
                          inLair: false
                        }))
                      setNewEntries((prev) => [...prev.filter((e) => e.name.trim()), ...toAdd])
                      setCheckedTokenIds(new Set())
                    }}
                    className="w-full mt-1.5 py-1 text-[10px] rounded bg-gray-800 text-amber-400
                      hover:bg-gray-700 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    Add {checkedTokenIds.size} Checked
                  </button>
                )}
              </div>
            )}

            {/* Turn Timer Config */}
            <div className="border-t border-gray-700/50 pt-2 mt-1">
              <button
                onClick={() => setShowTimerConfig(!showTimerConfig)}
                className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer w-full"
              >
                <span className="uppercase tracking-wider font-semibold">Turn Timer</span>
                <span className="text-gray-600 text-[9px]">{showTimerConfig ? '\u25B2' : '\u25BC'}</span>
                {timerEnabled && (
                  <span className="ml-auto text-green-400 text-[9px]">
                    {timerSeconds}s / {timerAction === 'auto-skip' ? 'Auto-skip' : 'Warning'}
                  </span>
                )}
              </button>
              {showTimerConfig && (
                <div className="mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timerEnabled}
                      onChange={(e) => updateTimerConfig({ enabled: e.target.checked })}
                      className="w-3 h-3 accent-amber-500"
                    />
                    Enable turn timer
                  </label>
                  {timerEnabled && (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-gray-500 mr-1">Seconds:</span>
                        {TIMER_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => {
                              setCustomSeconds(String(preset))
                              updateTimerConfig({ seconds: preset })
                            }}
                            className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                              timerSeconds === preset
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {preset}s
                          </button>
                        ))}
                        <input
                          type="number"
                          min={10}
                          max={600}
                          value={customSeconds}
                          onChange={(e) => {
                            setCustomSeconds(e.target.value)
                            const val = parseInt(e.target.value, 10)
                            if (val >= 10 && val <= 600) {
                              updateTimerConfig({ seconds: val })
                            }
                          }}
                          className="w-14 p-0.5 rounded bg-gray-800 border border-gray-700 text-gray-100 text-center text-[10px] focus:outline-none focus:border-amber-500"
                          title="Custom seconds (10-600)"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">On expire:</span>
                        <button
                          onClick={() => updateTimerConfig({ action: 'warning' })}
                          className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                            timerAction === 'warning'
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          Warning
                        </button>
                        <button
                          onClick={() => updateTimerConfig({ action: 'auto-skip' })}
                          className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                            timerAction === 'auto-skip'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          Auto-skip
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={addNewEntryRow}
                className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-400
                  hover:bg-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
              >
                + Add
              </button>
              <button
                onClick={() => {
                  if (newEntries.length > 0) {
                    const last = newEntries[newEntries.length - 1]
                    setNewEntries([...newEntries, { ...last, name: `${last.name} (copy)` }])
                  }
                }}
                className="py-1.5 px-2 text-xs rounded-lg bg-gray-800 text-gray-400
                  hover:bg-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
                title="Duplicate last row"
              >
                Dup
              </button>
              <button
                onClick={handleRollInitiative}
                disabled={!newEntries.some((e) => e.name.trim())}
                className="flex-1 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white
                  font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Roll Initiative
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 text-center py-4">Waiting for DM to start initiative...</p>
        )}
      </div>
    )
  }

  // Check if any entry has In Lair — if so, inject synthetic lair action entry at init 20
  const hasLairCreature = initiative.entries.some((e) => e.inLair)

  // Build display entries: real entries + optional lair action at init 20
  const displayEntries: Array<InitiativeEntry & { isLairAction?: boolean }> = []
  let lairInserted = false
  const lairEntry: InitiativeEntry & { isLairAction?: boolean } = {
    id: '__lair-action__',
    entityId: '__lair-action__',
    entityName: 'Lair Action',
    entityType: 'enemy',
    roll: 20,
    modifier: 0,
    total: 20,
    isActive: false,
    isLairAction: true
  }

  for (const entry of initiative.entries) {
    if (hasLairCreature && !lairInserted && entry.total < 20) {
      displayEntries.push(lairEntry)
      lairInserted = true
    }
    displayEntries.push(entry)
  }
  if (hasLairCreature && !lairInserted) {
    displayEntries.push(lairEntry)
  }

  // Format time remaining
  const formatTime = (s: number): string => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Initiative is active -- show tracker
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Initiative</h3>
        <span className="text-xs text-amber-400 font-semibold">Round {initiative.round}</span>
      </div>

      {/* Combat Timer Bar */}
      {isHost && timerEnabled && (timerRunning || timerExpired) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-mono font-semibold ${
                timerExpired
                  ? 'text-red-400 animate-pulse'
                  : timeRemaining <= 10
                    ? 'text-red-400'
                    : timeRemaining <= timerSeconds * 0.33
                      ? 'text-yellow-400'
                      : 'text-gray-300'
              }`}
            >
              {timerExpired ? 'TIME!' : formatTime(timeRemaining)}
            </span>
            {timerExpired && timerAction === 'warning' && (
              <span className="text-[9px] text-red-400/70 animate-pulse">Turn expired</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${timerColor} ${
                timerFlash ? 'animate-pulse' : ''
              }`}
              style={{ width: `${timerProgressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {displayEntries.map((entry, _displayIdx) => {
          // Find real index in initiative.entries for drag-and-drop
          const realIndex = initiative.entries.findIndex((e) => e.id === entry.id)
          return (
            <div
              key={entry.id}
              draggable={isHost && !entry.isLairAction}
              onDragStart={() => {
                if (!entry.isLairAction) setDraggedIndex(realIndex)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (!entry.isLairAction && realIndex >= 0) setDragOverIndex(realIndex)
              }}
              onDragEnd={() => {
                setDraggedIndex(null)
                setDragOverIndex(null)
              }}
              onDrop={() => {
                if (draggedIndex !== null && realIndex >= 0 && draggedIndex !== realIndex) {
                  reorderInitiative(draggedIndex, realIndex)
                }
                setDraggedIndex(null)
                setDragOverIndex(null)
              }}
              className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors
              ${
                entry.isLairAction
                  ? 'bg-purple-900/30 border border-purple-700/50'
                  : entry.isActive
                    ? 'bg-amber-600/20 border border-amber-500'
                    : dragOverIndex === realIndex && draggedIndex !== null
                      ? 'bg-gray-700/50 border border-amber-500/50'
                      : 'bg-gray-800/50 border border-transparent'
              } ${isHost && !entry.isLairAction ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              {/* Portrait avatar */}
              {entry.portraitUrl && !entry.isLairAction ? (
                <button
                  onClick={() => {
                    if (onCenterToken) onCenterToken(entry.entityId)
                  }}
                  className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden
                    ${entry.isActive ? 'ring-2 ring-amber-400 animate-pulse' : ''}
                    cursor-pointer hover:brightness-125`}
                  title={`Click to center on ${entry.entityName}`}
                >
                  <img
                    src={entry.portraitUrl}
                    alt={entry.entityName}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!entry.isLairAction && onCenterToken) onCenterToken(entry.entityId)
                  }}
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white
                  ${
                    entry.isLairAction
                      ? 'bg-purple-600'
                      : entry.entityType === 'player'
                        ? 'bg-blue-600'
                        : entry.entityType === 'enemy'
                          ? 'bg-red-600'
                          : 'bg-yellow-600'
                  }
                  ${entry.isActive ? 'ring-2 ring-amber-400 animate-pulse' : ''}
                  ${!entry.isLairAction ? 'cursor-pointer hover:brightness-125' : ''}`}
                  title={entry.isLairAction ? 'Lair Action' : `Click to center on ${entry.entityName}`}
                >
                  {entry.entityName.charAt(0).toUpperCase()}
                </button>
              )}

              <span
                className={`flex-1 truncate text-xs ${entry.isLairAction ? 'text-purple-300 italic' : 'text-gray-200'}`}
              >
                {entry.entityName}
              </span>

              {/* Legendary Resistance counter */}
              {!entry.isLairAction && entry.legendaryResistances && isHost && (
                <button
                  onClick={() => {
                    const lr = entry.legendaryResistances!
                    if (lr.remaining > 0) {
                      onUpdateEntry(entry.id, {
                        legendaryResistances: { max: lr.max, remaining: lr.remaining - 1 }
                      })
                    }
                  }}
                  className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    entry.legendaryResistances.remaining > 0
                      ? 'bg-orange-700/50 text-orange-300 hover:bg-orange-600/50'
                      : 'bg-gray-800 text-gray-600'
                  }`}
                  title={`Legendary Resistance: ${entry.legendaryResistances.remaining}/${entry.legendaryResistances.max} — Click to use`}
                >
                  LR {entry.legendaryResistances.remaining}/{entry.legendaryResistances.max}
                </button>
              )}

              {/* In Lair toggle */}
              {!entry.isLairAction && entry.entityType === 'enemy' && isHost && (
                <button
                  onClick={() => onUpdateEntry(entry.id, { inLair: !entry.inLair })}
                  className={`text-[10px] px-1 py-0.5 rounded cursor-pointer transition-colors ${
                    entry.inLair
                      ? 'bg-purple-700/50 text-purple-300'
                      : 'bg-gray-800/50 text-gray-600 hover:text-gray-400'
                  }`}
                  title={entry.inLair ? 'In Lair (click to toggle off)' : 'Not in lair (click to toggle on)'}
                >
                  {entry.inLair ? 'Lair' : ''}
                </button>
              )}

              {/* Delay turn button (active entry only) */}
              {isHost && !entry.isLairAction && entry.isActive && (
                <button
                  onClick={() => {
                    setDelayedEntries((prev) => [...prev, entry])
                    onRemoveEntry(entry.id)
                  }}
                  className="text-[10px] px-1 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-yellow-300 hover:bg-gray-600 cursor-pointer"
                  title="Delay turn (hold and re-enter later)"
                >
                  Delay
                </button>
              )}

              {isHost && !entry.isLairAction && (
                <>
                  {editingId === entry.id ? (
                    <input
                      type="number"
                      value={editTotal}
                      onChange={(e) => setEditTotal(e.target.value)}
                      onBlur={() => handleEditSave(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(entry.id)
                        if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditTotal('')
                        }
                      }}
                      className="w-10 p-0.5 rounded bg-gray-700 border border-amber-500 text-center text-xs text-gray-100"
                    />
                  ) : (
                    <span
                      className="text-xs font-mono font-semibold w-7 text-center cursor-pointer hover:text-amber-400 text-gray-300"
                      onClick={() => {
                        setEditingId(entry.id)
                        setEditTotal(String(entry.total))
                      }}
                      title="Click to edit"
                    >
                      {entry.total}
                    </span>
                  )}
                  <button
                    onClick={() => onRemoveEntry(entry.id)}
                    className="text-gray-600 hover:text-red-400 text-xs cursor-pointer"
                    title="Remove from initiative"
                  >
                    &#x2715;
                  </button>
                </>
              )}

              {/* Lair action init count display */}
              {entry.isLairAction && <span className="text-xs font-mono text-purple-500 w-7 text-center">20</span>}
            </div>
          )
        })}
      </div>

      {/* Delayed entries */}
      {delayedEntries.length > 0 && isHost && (
        <div className="border-t border-gray-700/50 pt-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Delayed</div>
          {delayedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 p-1.5 rounded bg-gray-800/30 text-xs text-gray-400 mb-0.5"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  entry.entityType === 'player'
                    ? 'bg-blue-500'
                    : entry.entityType === 'enemy'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                }`}
              />
              <span className="flex-1 truncate">{entry.entityName}</span>
              <button
                onClick={() => {
                  // Re-enter at current position
                  onAddEntry?.({ ...entry, isActive: false })
                  setDelayedEntries((prev) => prev.filter((e) => e.id !== entry.id))
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-700/50 text-amber-300 hover:bg-amber-600/50 cursor-pointer"
              >
                Re-enter
              </button>
              <button
                onClick={() => setDelayedEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                className="text-gray-600 hover:text-red-400 cursor-pointer"
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
      )}

      {isHost && (
        <>
          {/* Add entry mid-combat */}
          {showAddForm ? (
            <div className="flex gap-1 items-center">
              <input
                type="text"
                placeholder="Name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="flex-1 p-1 rounded bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 text-xs focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                placeholder="Init"
                value={addInit}
                onChange={(e) => setAddInit(e.target.value)}
                className="w-12 p-1 rounded bg-gray-800 border border-gray-700 text-gray-100 text-center text-xs focus:outline-none focus:border-amber-500"
              />
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as 'player' | 'npc' | 'enemy')}
                className="w-14 p-1 rounded bg-gray-800 border border-gray-700 text-gray-200 text-xs cursor-pointer"
              >
                <option value="player">PC</option>
                <option value="npc">NPC</option>
                <option value="enemy">Foe</option>
              </select>
              <button
                onClick={() => {
                  if (!addName.trim()) return
                  const total = parseInt(addInit, 10) || 0
                  const entry: InitiativeEntry = {
                    id: crypto.randomUUID(),
                    entityId: crypto.randomUUID(),
                    entityName: addName.trim(),
                    entityType: addType,
                    roll: total,
                    modifier: 0,
                    total,
                    isActive: false
                  }
                  onAddEntry?.(entry)
                  setAddName('')
                  setAddInit('')
                  setShowAddForm(false)
                }}
                className="px-2 py-1 text-[10px] rounded bg-green-700 text-white hover:bg-green-600 cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
              >
                &#x2715;
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-1 text-[10px] rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
            >
              + Add Entry
            </button>
          )}
          <div className="flex gap-1">
            <button
              onClick={onPrevTurn}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-400
                hover:bg-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
            >
              Prev
            </button>
            <button
              onClick={onNextTurn}
              className="flex-2 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white
                font-semibold transition-colors cursor-pointer"
            >
              Next Turn
            </button>
            <button
              onClick={onEndInitiative}
              className="flex-1 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-400
                hover:bg-red-700 hover:text-white transition-colors cursor-pointer"
            >
              End
            </button>
          </div>
        </>
      )}
    </div>
  )
}
