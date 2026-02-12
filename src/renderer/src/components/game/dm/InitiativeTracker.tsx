import { useState } from 'react'
import type { InitiativeState, InitiativeEntry } from '../../../types/game-state'

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
}

interface NewEntry {
  name: string
  modifier: string
  entityType: 'player' | 'npc' | 'enemy'
}

export default function InitiativeTracker({
  initiative,
  round,
  isHost,
  onStartInitiative,
  onNextTurn,
  onPrevTurn,
  onEndInitiative,
  onUpdateEntry,
  onRemoveEntry
}: InitiativeTrackerProps): JSX.Element {
  const [newEntries, setNewEntries] = useState<NewEntry[]>([
    { name: '', modifier: '0', entityType: 'player' }
  ])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTotal, setEditTotal] = useState('')

  const addNewEntryRow = (): void => {
    setNewEntries([...newEntries, { name: '', modifier: '0', entityType: 'enemy' }])
  }

  const updateNewEntry = (index: number, updates: Partial<NewEntry>): void => {
    setNewEntries(
      newEntries.map((e, i) => (i === index ? { ...e, ...updates } : e))
    )
  }

  const removeNewEntry = (index: number): void => {
    if (newEntries.length <= 1) return
    setNewEntries(newEntries.filter((_, i) => i !== index))
  }

  const handleRollInitiative = (): void => {
    const entries: InitiativeEntry[] = newEntries
      .filter((e) => e.name.trim())
      .map((e) => {
        const mod = parseInt(e.modifier, 10) || 0
        const roll = Math.floor(Math.random() * 20) + 1
        return {
          id: crypto.randomUUID(),
          entityId: crypto.randomUUID(),
          entityName: e.name.trim(),
          entityType: e.entityType,
          roll,
          modifier: mod,
          total: roll + mod,
          isActive: false
        }
      })

    if (entries.length > 0) {
      onStartInitiative(entries)
    }
  }

  const handleEditSave = (entryId: string): void => {
    const newTotal = parseInt(editTotal, 10)
    if (!isNaN(newTotal)) {
      onUpdateEntry(entryId, { total: newTotal })
    }
    setEditingId(null)
    setEditTotal('')
  }

  // Initiative not active -- show setup
  if (!initiative) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Initiative
        </h3>

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
                  <button
                    onClick={() => removeNewEntry(i)}
                    className="text-gray-500 hover:text-red-400 text-xs cursor-pointer px-1"
                  >
                    &#x2715;
                  </button>
                </div>
              ))}
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
          <p className="text-xs text-gray-500 text-center py-4">
            Waiting for DM to start initiative...
          </p>
        )}
      </div>
    )
  }

  // Initiative is active -- show tracker
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Initiative
        </h3>
        <span className="text-xs text-amber-400 font-semibold">
          Round {initiative.round}
        </span>
      </div>

      <div className="space-y-1">
        {initiative.entries.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors
              ${
                entry.isActive
                  ? 'bg-amber-600/20 border border-amber-500'
                  : 'bg-gray-800/50 border border-transparent'
              }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                entry.entityType === 'player'
                  ? 'bg-blue-500'
                  : entry.entityType === 'enemy'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
              }`}
            />

            <span className="flex-1 text-gray-200 truncate text-xs">
              {entry.entityName}
            </span>

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
                autoFocus
                className="w-10 p-0.5 rounded bg-gray-700 border border-amber-500 text-center text-xs text-gray-100"
              />
            ) : (
              <span
                className={`text-xs font-mono font-semibold w-7 text-center ${
                  isHost ? 'cursor-pointer hover:text-amber-400' : ''
                } text-gray-300`}
                onClick={() => {
                  if (isHost) {
                    setEditingId(entry.id)
                    setEditTotal(String(entry.total))
                  }
                }}
                title={isHost ? 'Click to edit' : `Roll: ${entry.roll} + ${entry.modifier}`}
              >
                {entry.total}
              </span>
            )}

            {isHost && (
              <button
                onClick={() => onRemoveEntry(entry.id)}
                className="text-gray-600 hover:text-red-400 text-xs cursor-pointer"
                title="Remove from initiative"
              >
                &#x2715;
              </button>
            )}
          </div>
        ))}
      </div>

      {isHost && (
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
      )}
    </div>
  )
}
