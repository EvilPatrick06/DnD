import { useEffect, useState } from 'react'
import type { GameSystem } from '../../types/game-system'
import type { CampaignType } from '../../types/campaign'
import { loadAdventures, type Adventure } from '../../services/adventure-loader'
import { Card } from '../ui'

interface AdventureSelectorProps {
  system: GameSystem
  campaignType: CampaignType
  selectedAdventureId: string | null
  onSelectType: (type: CampaignType) => void
  onSelectAdventure: (adventureId: string | null) => void
}

const ADVENTURE_ICONS: Record<string, string> = {
  pick: '\u26CF',
  scroll: '\uD83D\uDCDC',
  sword: '\u2694',
  shield: '\uD83D\uDEE1',
  dragon: '\uD83D\uDC09',
  skull: '\uD83D\uDC80',
  fortress: '\uD83C\uDFF0',
  lighthouse: '\uD83C\uDF2C',
  potion: '\uD83E\uDDEA'
}

export default function AdventureSelector({
  system,
  campaignType,
  selectedAdventureId,
  onSelectType,
  onSelectAdventure
}: AdventureSelectorProps): JSX.Element {
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [loadingAdventures, setLoadingAdventures] = useState(false)

  useEffect(() => {
    setLoadingAdventures(true)
    loadAdventures()
      .then((data) => {
        setAdventures(data.filter((a) => a.system === system))
      })
      .finally(() => setLoadingAdventures(false))
  }, [system])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Campaign Type</h2>
      <p className="text-gray-400 text-sm mb-6">
        Start from a pre-made adventure or build your own world from scratch.
      </p>

      <div className="flex gap-4 max-w-2xl mb-6">
        <button
          onClick={() => {
            onSelectType('preset')
            onSelectAdventure(null)
          }}
          className={`flex-1 p-5 rounded-lg border text-left transition-all cursor-pointer
            ${
              campaignType === 'preset'
                ? 'border-amber-500 bg-amber-900/20'
                : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
            }`}
        >
          <div className="text-2xl mb-2">{'\uD83D\uDCD6'}</div>
          <div className="font-semibold">Start from Adventure</div>
          <div className="text-sm text-gray-400 mt-1">
            Choose a pre-built adventure module with maps and encounters
          </div>
        </button>

        <button
          onClick={() => {
            onSelectType('custom')
            onSelectAdventure(null)
          }}
          className={`flex-1 p-5 rounded-lg border text-left transition-all cursor-pointer
            ${
              campaignType === 'custom'
                ? 'border-amber-500 bg-amber-900/20'
                : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
            }`}
        >
          <div className="text-2xl mb-2">{'\u2728'}</div>
          <div className="font-semibold">Custom Campaign</div>
          <div className="text-sm text-gray-400 mt-1">
            Build your own world with custom maps, NPCs, and encounters
          </div>
        </button>
      </div>

      {campaignType === 'preset' && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Available Adventures</h3>
          {loadingAdventures ? (
            <div className="text-gray-500 py-4">Loading adventures...</div>
          ) : adventures.length === 0 ? (
            <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-500">
              <p>No adventures available for this system yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {adventures.map((adventure) => (
                <button
                  key={adventure.id}
                  onClick={() => onSelectAdventure(adventure.id)}
                  className="text-left cursor-pointer"
                >
                  <Card
                    className={`transition-all h-full
                      ${
                        selectedAdventureId === adventure.id
                          ? 'border-amber-500 bg-amber-900/20'
                          : 'hover:border-gray-600'
                      }`}
                  >
                    <div className="text-2xl mb-2">
                      {ADVENTURE_ICONS[adventure.icon] || '\uD83D\uDCDC'}
                    </div>
                    <div className="font-semibold mb-1">{adventure.name}</div>
                    <div className="text-sm text-gray-400 mb-3">{adventure.description}</div>
                    <div className="text-xs text-gray-500 flex gap-3">
                      <span>{adventure.chapters.length} chapter{adventure.chapters.length !== 1 ? 's' : ''}</span>
                      {adventure.npcs && adventure.npcs.length > 0 && (
                        <span>{adventure.npcs.length} NPC{adventure.npcs.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
