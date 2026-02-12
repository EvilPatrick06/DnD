import { useState } from 'react'
import type { NPC } from '../../../types/campaign'

interface NPCManagerProps {
  npcs: NPC[]
  onAddToInitiative: (npc: NPC) => void
  onPlaceOnMap: (npc: NPC) => void
}

export default function NPCManager({
  npcs,
  onAddToInitiative,
  onPlaceOnMap
}: NPCManagerProps): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (npcs.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          NPCs
        </h3>
        <p className="text-xs text-gray-500 text-center py-4">
          No NPCs in this campaign yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        NPCs ({npcs.length})
      </h3>

      <div className="space-y-1">
        {npcs.map((npc) => {
          const isExpanded = expandedId === npc.id

          return (
            <div key={npc.id} className="bg-gray-800/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : npc.id)}
                className="w-full flex items-center gap-2 p-2 text-sm text-left
                  hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <span
                  className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                >
                  &#9654;
                </span>
                <span className="flex-1 text-gray-200 truncate">{npc.name}</span>
                {npc.isVisible && (
                  <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                    Visible
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {npc.description && (
                    <p className="text-xs text-gray-400">{npc.description}</p>
                  )}
                  {npc.location && (
                    <p className="text-xs text-gray-500">
                      Location: <span className="text-gray-400">{npc.location}</span>
                    </p>
                  )}
                  {npc.notes && (
                    <p className="text-xs text-gray-500 italic">{npc.notes}</p>
                  )}

                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() => onAddToInitiative(npc)}
                      className="flex-1 py-1 text-[10px] rounded bg-gray-700 text-gray-300
                        hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                    >
                      + Initiative
                    </button>
                    <button
                      onClick={() => onPlaceOnMap(npc)}
                      className="flex-1 py-1 text-[10px] rounded bg-gray-700 text-gray-300
                        hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                    >
                      Place on Map
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
