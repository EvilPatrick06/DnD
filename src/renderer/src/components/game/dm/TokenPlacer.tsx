import { useState } from 'react'
import type { MapToken } from '../../../types/map'

interface TokenPlacerProps {
  tokens: MapToken[]
  onPlaceToken: (tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'>) => void
  onRemoveToken: (tokenId: string) => void
  placingActive: boolean
}

export default function TokenPlacer({
  tokens,
  onPlaceToken,
  onRemoveToken,
  placingActive
}: TokenPlacerProps): JSX.Element {
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<'player' | 'npc' | 'enemy'>('enemy')
  const [currentHP, setCurrentHP] = useState('')
  const [maxHP, setMaxHP] = useState('')
  const [sizeX, setSizeX] = useState(1)
  const [sizeY, setSizeY] = useState(1)

  const handlePlace = (): void => {
    if (!name.trim()) return
    onPlaceToken({
      entityId: crypto.randomUUID(),
      entityType,
      label: name.trim(),
      sizeX,
      sizeY,
      visibleToPlayers: true,
      conditions: [],
      currentHP: currentHP ? parseInt(currentHP, 10) : undefined,
      maxHP: maxHP ? parseInt(maxHP, 10) : undefined
    })
    setName('')
    setCurrentHP('')
    setMaxHP('')
  }

  const sizeOptions = [
    { label: '1x1', x: 1, y: 1 },
    { label: '2x2', x: 2, y: 2 },
    { label: '3x3', x: 3, y: 3 }
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Place Token
      </h3>

      <div>
        <input
          type="text"
          placeholder="Token name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
            placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
        <div className="flex gap-1">
          {(['player', 'npc', 'enemy'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setEntityType(type)}
              className={`flex-1 py-1.5 text-xs rounded-lg capitalize transition-colors cursor-pointer
                ${
                  entityType === type
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">HP</label>
          <input
            type="number"
            placeholder="Current"
            value={currentHP}
            onChange={(e) => setCurrentHP(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
              placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>
          <input
            type="number"
            placeholder="Max"
            value={maxHP}
            onChange={(e) => setMaxHP(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
              placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Size</label>
        <div className="flex gap-1">
          {sizeOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                setSizeX(opt.x)
                setSizeY(opt.y)
              }}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-colors cursor-pointer
                ${
                  sizeX === opt.x && sizeY === opt.y
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handlePlace}
        disabled={!name.trim()}
        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm
          font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {placingActive ? 'Click map to place' : 'Prepare Token'}
      </button>

      {placingActive && (
        <p className="text-xs text-amber-400 text-center">
          Click on the map to place the token
        </p>
      )}

      {tokens.length > 0 && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Existing Tokens ({tokens.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      token.entityType === 'player'
                        ? 'bg-blue-500'
                        : token.entityType === 'enemy'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-gray-200 truncate">{token.label}</span>
                  {token.maxHP !== undefined && token.currentHP !== undefined && (
                    <span className="text-xs text-gray-500">
                      {token.currentHP}/{token.maxHP}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveToken(token.id)}
                  className="text-gray-500 hover:text-red-400 text-xs cursor-pointer ml-2 flex-shrink-0"
                  title="Remove token"
                >
                  &#x2715;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
