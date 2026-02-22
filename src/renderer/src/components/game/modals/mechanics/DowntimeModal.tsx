import { useEffect, useState } from 'react'
import {
  calculateDowntimeCost,
  type DowntimeActivity,
  loadDowntimeActivities
} from '../../../../services/downtime-service'

interface DowntimeModalProps {
  characterName?: string
  onClose: () => void
  onApply?: (activity: string, days: number, goldCost: number, details: string) => void
}

export default function DowntimeModal({ characterName, onClose, onApply }: DowntimeModalProps): JSX.Element {
  const [activities, setActivities] = useState<DowntimeActivity[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [days, setDays] = useState(1)
  const [selectedRarity, setSelectedRarity] = useState<string>('')
  const [selectedSpellLevel, setSelectedSpellLevel] = useState<number>(0)
  const [selectedPotion, setSelectedPotion] = useState<string>('')

  useEffect(() => {
    loadDowntimeActivities().then(setActivities)
  }, [])

  const selected = activities.find((a) => a.id === selectedId)

  const cost = selected
    ? calculateDowntimeCost(selected, days, {
        rarity: selectedRarity || undefined,
        spellLevel: selectedSpellLevel,
        potionType: selectedPotion || undefined
      })
    : null

  const handleApply = (): void => {
    if (!selected || !cost) return
    const details =
      selectedRarity || selectedPotion || (selected.spellLevelTable ? `Level ${selectedSpellLevel} spell` : '')
    onApply?.(selected.name, cost.days, cost.goldCost, details)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-bold text-amber-400">
            Downtime Activities {characterName ? `— ${characterName}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 cursor-pointer">
            &#10005;
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Activity list */}
          <div className="space-y-1">
            {activities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => {
                  setSelectedId(activity.id)
                  if (activity.rarityTable) setSelectedRarity(activity.rarityTable[0].rarity)
                  if (activity.spellLevelTable) setSelectedSpellLevel(0)
                  if (activity.potionTable) setSelectedPotion(activity.potionTable[0].type)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  selectedId === activity.id
                    ? 'bg-amber-600/20 border border-amber-500/50 text-amber-300'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="font-semibold">{activity.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{activity.reference}</div>
              </button>
            ))}
          </div>

          {/* Selected activity details */}
          {selected && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-300 leading-relaxed">{selected.description}</p>

              {selected.requirements.length > 0 && (
                <div className="text-[10px] text-gray-500">
                  <span className="font-semibold text-gray-400">Requirements:</span> {selected.requirements.join(', ')}
                </div>
              )}

              <div className="text-[10px] text-amber-400">
                <span className="font-semibold">Outcome:</span> {selected.outcome}
              </div>

              {/* Rarity selector for magic item crafting */}
              {selected.rarityTable && (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold">Item Rarity:</label>
                  <div className="flex flex-wrap gap-1">
                    {selected.rarityTable.map((r) => (
                      <button
                        key={r.rarity}
                        onClick={() => setSelectedRarity(r.rarity)}
                        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                          selectedRarity === r.rarity
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {r.rarity} ({r.days}d, {r.goldCost.toLocaleString()} GP, Lv {r.minLevel}+)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Spell level selector */}
              {selected.spellLevelTable && (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold">Spell Level:</label>
                  <div className="flex flex-wrap gap-1">
                    {selected.spellLevelTable.map((r) => (
                      <button
                        key={r.level}
                        onClick={() => setSelectedSpellLevel(r.level)}
                        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                          selectedSpellLevel === r.level
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {r.level === 0 ? 'Cantrip' : `Lv ${r.level}`} ({r.days}d, {r.goldCost.toLocaleString()} GP)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Potion type selector */}
              {selected.potionTable && (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-semibold">Potion Type:</label>
                  <div className="flex flex-wrap gap-1">
                    {selected.potionTable.map((r) => (
                      <button
                        key={r.type}
                        onClick={() => setSelectedPotion(r.type)}
                        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                          selectedPotion === r.type
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {r.type} ({r.days}d, {r.goldCost} GP, {r.heals})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Days input for per-day activities */}
              {selected.daysRequired > 0 &&
                !selected.rarityTable &&
                !selected.spellLevelTable &&
                !selected.potionTable && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-400 font-semibold">Days:</label>
                    <input
                      type="number"
                      min={1}
                      value={days}
                      onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 bg-gray-800 border border-gray-600 rounded text-center text-xs text-gray-200 px-1 py-0.5"
                    />
                  </div>
                )}

              {/* Cost summary */}
              {cost && (
                <div className="flex items-center gap-4 pt-1 border-t border-gray-700">
                  <span className="text-xs text-gray-400">
                    Time:{' '}
                    <span className="text-white font-semibold">
                      {cost.days} day{cost.days !== 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">
                    Cost: <span className="text-amber-400 font-semibold">{cost.goldCost.toLocaleString()} GP</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selected}
            className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Activity
          </button>
        </div>
      </div>
    </div>
  )
}
