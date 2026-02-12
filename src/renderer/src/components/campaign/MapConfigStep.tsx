import { useState, useCallback } from 'react'
import type { GameMap } from '../../types/map'
import { Button, Input } from '../ui'

interface MapConfigStepProps {
  maps: GameMap[]
  campaignId: string
  onChange: (maps: GameMap[]) => void
}

const BUILT_IN_MAPS = [
  { id: 'forest-road', name: 'Forest Road', preview: 'A winding path through dense forest' },
  { id: 'town-square', name: 'Town Square', preview: 'A bustling town center' },
  { id: 'dungeon-room', name: 'Dungeon Room', preview: 'A dark stone chamber' },
  { id: 'cave-entrance', name: 'Cave Entrance', preview: 'A rocky cavern opening' },
  { id: 'tavern-interior', name: 'Tavern Interior', preview: 'A cozy tavern with tables and a bar' }
]

export default function MapConfigStep({
  maps,
  campaignId,
  onChange
}: MapConfigStepProps): JSX.Element {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [newGridSize, setNewGridSize] = useState(40)
  const [dragOver, setDragOver] = useState(false)

  const createMapEntry = (name: string, gridSize: number): GameMap => ({
    id: crypto.randomUUID(),
    name,
    campaignId,
    imagePath: '',
    width: 1920,
    height: 1080,
    grid: {
      enabled: true,
      cellSize: gridSize,
      offsetX: 0,
      offsetY: 0,
      color: '#ffffff',
      opacity: 0.2,
      type: 'square'
    },
    tokens: [],
    fogOfWar: { enabled: false, revealedCells: [] },
    createdAt: new Date().toISOString()
  })

  const handleAddCustomMap = (): void => {
    if (!newMapName.trim()) return

    const newMap = createMapEntry(newMapName.trim(), newGridSize)
    onChange([...maps, newMap])
    setNewMapName('')
    setNewGridSize(40)
    setShowAddForm(false)
  }

  const handleAddBuiltIn = (builtIn: (typeof BUILT_IN_MAPS)[number]): void => {
    // Don't add duplicates
    if (maps.some((m) => m.name === builtIn.name)) return

    const newMap = createMapEntry(builtIn.name, 40)
    newMap.id = builtIn.id
    onChange([...maps, newMap])
  }

  const handleRemoveMap = (id: string): void => {
    onChange(maps.filter((m) => m.id !== id))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      )

      const newMaps = files.map((file) => {
        const map = createMapEntry(file.name.replace(/\.[^.]+$/, ''), 40)
        // In a future phase, the image would be copied to app data.
        // For now we just store the name as a placeholder.
        map.imagePath = file.name
        return map
      })

      if (newMaps.length > 0) {
        onChange([...maps, ...newMaps])
      }
    },
    [maps, onChange, campaignId]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (): void => {
    setDragOver(false)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Map Configuration</h2>
      <p className="text-gray-400 text-sm mb-6">
        Add maps for your campaign. You can use built-in maps or upload your own images. The full map editor will be available in-game.
      </p>

      <div className="max-w-2xl space-y-6">
        {/* Drop zone for custom maps */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${
              dragOver
                ? 'border-amber-500 bg-amber-900/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
        >
          <div className="text-3xl mb-2">{'\uD83D\uDDFA'}</div>
          <p className="text-gray-400 mb-1">Drag and drop map images here</p>
          <p className="text-gray-500 text-sm">PNG, JPG, or WebP</p>
        </div>

        {/* Built-in maps */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Built-in Maps
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BUILT_IN_MAPS.map((bm) => {
              const isAdded = maps.some((m) => m.id === bm.id || m.name === bm.name)
              return (
                <button
                  key={bm.id}
                  onClick={() => handleAddBuiltIn(bm)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border text-left transition-all cursor-pointer
                    ${
                      isAdded
                        ? 'border-amber-500/50 bg-amber-900/10 opacity-60 cursor-not-allowed'
                        : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
                    }`}
                >
                  <div className="font-semibold text-sm mb-1">{bm.name}</div>
                  <div className="text-xs text-gray-500">{bm.preview}</div>
                  {isAdded && (
                    <div className="text-xs text-amber-400 mt-2">Added</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Added maps list */}
        {maps.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Campaign Maps ({maps.length})
            </h3>
            <div className="space-y-2">
              {maps.map((map) => (
                <div
                  key={map.id}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-sm">{map.name}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      Grid: {map.grid.cellSize}px | {map.grid.type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveMap(map.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer text-lg"
                    title="Remove map"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add custom map form */}
        {showAddForm ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 space-y-4">
            <Input
              label="Map Name"
              placeholder="e.g. Dragon's Lair"
              value={newMapName}
              onChange={(e) => setNewMapName(e.target.value)}
            />
            <div>
              <label className="block text-gray-400 mb-2 text-sm">Grid Cell Size (px)</label>
              <input
                type="number"
                min={20}
                max={100}
                className="w-24 p-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
                  focus:outline-none focus:border-amber-500 transition-colors"
                value={newGridSize}
                onChange={(e) => setNewGridSize(Math.max(20, Math.min(100, parseInt(e.target.value) || 40)))}
              />
              <span className="text-gray-500 text-sm ml-3">20 - 100 px</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAddCustomMap} disabled={!newMapName.trim()}>
                Add Map
              </Button>
              <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setShowAddForm(true)}>
            + Add Custom Map
          </Button>
        )}

        {maps.length === 0 && (
          <p className="text-gray-500 text-sm">
            No maps added yet. You can add maps later from the campaign detail page.
          </p>
        )}
      </div>
    </div>
  )
}
