import { lazy, Suspense, useCallback, useState } from 'react'
import { load5eMonsterById } from '../../../services/data-provider'
import * as UndoManager from '../../../services/undo-manager'
import { useGameStore } from '../../../stores/useGameStore'
import type { Campaign, NPC } from '../../../types/campaign'
import type { InitiativeEntry } from '../../../types/game-state'
import type { GameMap, MapToken, TerrainCell, WallSegment } from '../../../types/map'
import { getSizeTokenDimensions } from '../../../types/monster'
import { DMNotepad, DMToolbar, FogBrush, MapSelector, NPCManager, ShopPanel, TokenPlacer } from '../dm'
import GridControlPanel from '../../dm/GridControlPanel'
import type { DmToolId } from '../../dm/DMToolbar'
import MapCanvas from '../../map/MapCanvas'

const CreateMapDialog = lazy(() => import('./CreateMapDialog'))

interface DMMapEditorProps {
  campaign: Campaign
  onClose: () => void
}

type RightPanel = 'tokens' | 'fog' | 'terrain' | 'npcs' | 'notes' | 'shop' | 'grid'

export default function DMMapEditor({ campaign, onClose }: DMMapEditorProps): JSX.Element {
  const gameStore = useGameStore()
  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId) ?? null

  const [activeTool, setActiveTool] = useState<DmToolId>('select')
  const [fogBrushSize, setFogBrushSize] = useState(1)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanel>('tokens')
  const [terrainPaintType, setTerrainPaintType] = useState<TerrainCell['type']>('difficult')
  const [showCreateMap, setShowCreateMap] = useState(false)
  const [undoCount, setUndoCount] = useState(0) // trigger re-render on undo/redo

  const handleUndo = useCallback(() => {
    UndoManager.undo()
    setUndoCount((c) => c + 1)
  }, [])

  const handleRedo = useCallback(() => {
    UndoManager.redo()
    setUndoCount((c) => c + 1)
  }, [])

  const handleTokenMove = useCallback(
    (tokenId: string, gridX: number, gridY: number) => {
      if (!activeMap) return
      gameStore.moveToken(activeMap.id, tokenId, gridX, gridY)
    },
    [activeMap, gameStore]
  )

  const handleTokenSelect = useCallback((tokenId: string | null) => {
    setSelectedTokenId(tokenId)
  }, [])

  const handleCellClick = useCallback(
    (gridX: number, gridY: number) => {
      if (!activeMap) return

      if (activeTool === 'terrain') {
        // Toggle terrain on/off — floor grid coordinates for snapping
        const terrain = activeMap.terrain ?? []
        const fx = Math.floor(gridX)
        const fy = Math.floor(gridY)
        const existing = terrain.findIndex((t) => t.x === fx && t.y === fy)
        const oldTerrain = [...terrain]
        const newTerrain =
          existing >= 0
            ? terrain.filter((_, i) => i !== existing) // Remove
            : [
                ...terrain,
                { x: fx, y: fy, type: terrainPaintType, movementCost: terrainPaintType === 'hazard' ? 1 : 2 }
              ]

        const mapId = activeMap.id
        const maps = gameStore.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m))
        gameStore.loadGameState({ maps })

        // Push undo action
        UndoManager.push({
          type: 'terrain-paint',
          description: `Paint terrain at (${fx}, ${fy})`,
          undo: () => {
            const gs = useGameStore.getState()
            const undoMaps = gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: oldTerrain } : m))
            gs.loadGameState({ maps: undoMaps })
          },
          redo: () => {
            const gs = useGameStore.getState()
            const redoMaps = gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m))
            gs.loadGameState({ maps: redoMaps })
          }
        })
        setUndoCount((c) => c + 1)
        return
      }

      if (activeTool === 'fill') {
        // Flood-fill terrain across contiguous empty cells
        const terrain = activeMap.terrain ?? []
        const fx = Math.floor(gridX)
        const fy = Math.floor(gridY)
        const terrainSet = new Set(terrain.map((t) => `${t.x},${t.y}`))

        // If clicking on existing terrain, remove the flood-fill group
        if (terrainSet.has(`${fx},${fy}`)) {
          const targetType = terrain.find((t) => t.x === fx && t.y === fy)?.type
          // Flood-fill remove all connected cells of same type
          const toRemove = new Set<string>()
          const stack = [`${fx},${fy}`]
          while (stack.length > 0) {
            const key = stack.pop()!
            if (toRemove.has(key)) continue
            const cell = terrain.find((t) => `${t.x},${t.y}` === key)
            if (!cell || cell.type !== targetType) continue
            toRemove.add(key)
            const [cx, cy] = key.split(',').map(Number)
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              stack.push(`${cx + dx},${cy + dy}`)
            }
          }
          const oldTerrain = [...terrain]
          const newTerrain = terrain.filter((t) => !toRemove.has(`${t.x},${t.y}`))
          const mapId = activeMap.id
          const maps = gameStore.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m))
          gameStore.loadGameState({ maps })
          UndoManager.push({
            type: 'terrain-fill-remove',
            description: `Remove fill at (${fx}, ${fy})`,
            undo: () => {
              const gs = useGameStore.getState()
              gs.loadGameState({ maps: gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: oldTerrain } : m)) })
            },
            redo: () => {
              const gs = useGameStore.getState()
              gs.loadGameState({ maps: gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m)) })
            }
          })
          setUndoCount((c) => c + 1)
          return
        }

        // Flood-fill empty cells
        const cols = Math.ceil(activeMap.width / activeMap.grid.cellSize)
        const rows = Math.ceil(activeMap.height / activeMap.grid.cellSize)
        const filled: TerrainCell[] = []
        const visited = new Set<string>()
        const stack = [`${fx},${fy}`]
        const maxFill = 500 // Safety limit

        while (stack.length > 0 && filled.length < maxFill) {
          const key = stack.pop()!
          if (visited.has(key) || terrainSet.has(key)) continue
          visited.add(key)
          const [cx, cy] = key.split(',').map(Number)
          if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue
          filled.push({
            x: cx,
            y: cy,
            type: terrainPaintType,
            movementCost: terrainPaintType === 'hazard' ? 1 : 2
          })
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            stack.push(`${cx + dx},${cy + dy}`)
          }
        }

        const oldTerrain = [...terrain]
        const newTerrain = [...terrain, ...filled]
        const mapId = activeMap.id
        const maps = gameStore.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m))
        gameStore.loadGameState({ maps })
        UndoManager.push({
          type: 'terrain-fill',
          description: `Fill ${filled.length} cells at (${fx}, ${fy})`,
          undo: () => {
            const gs = useGameStore.getState()
            gs.loadGameState({ maps: gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: oldTerrain } : m)) })
          },
          redo: () => {
            const gs = useGameStore.getState()
            gs.loadGameState({ maps: gs.maps.map((m) => (m.id === mapId ? { ...m, terrain: newTerrain } : m)) })
          }
        })
        setUndoCount((c) => c + 1)
        return
      }

      if (activeTool === 'fog-reveal' || activeTool === 'fog-hide') {
        const halfBrush = Math.floor(fogBrushSize / 2)
        const cells: Array<{ x: number; y: number }> = []
        for (let dx = -halfBrush; dx <= halfBrush; dx++) {
          for (let dy = -halfBrush; dy <= halfBrush; dy++) {
            cells.push({ x: gridX + dx, y: gridY + dy })
          }
        }
        if (activeTool === 'fog-reveal') {
          gameStore.revealFog(activeMap.id, cells)
        } else {
          gameStore.hideFog(activeMap.id, cells)
        }
      }
    },
    [activeMap, activeTool, fogBrushSize, terrainPaintType, gameStore]
  )

  const handleSelectMap = useCallback(
    (mapId: string) => {
      gameStore.setActiveMap(mapId)
    },
    [gameStore]
  )

  const handleAddMap = useCallback(() => {
    setShowCreateMap(true)
  }, [])

  const handleCreateMap = useCallback(
    (mapConfig: {
      name: string
      width: number
      height: number
      cellSize: number
      gridType: 'square' | 'hex'
      backgroundColor: string
    }) => {
      const newMap: GameMap = {
        id: crypto.randomUUID(),
        name: mapConfig.name || `Map ${gameStore.maps.length + 1}`,
        campaignId: campaign.id,
        imagePath: '',
        width: mapConfig.width * mapConfig.cellSize,
        height: mapConfig.height * mapConfig.cellSize,
        grid: {
          enabled: true,
          cellSize: mapConfig.cellSize,
          offsetX: 0,
          offsetY: 0,
          color: '#4b5563',
          opacity: 0.4,
          type: mapConfig.gridType
        },
        tokens: [],
        fogOfWar: { enabled: false, revealedCells: [] },
        terrain: [],
        createdAt: new Date().toISOString()
      }
      gameStore.addMap(newMap)
      gameStore.setActiveMap(newMap.id)
      setShowCreateMap(false)
    },
    [campaign.id, gameStore]
  )

  const handleNpcToInitiative = useCallback(
    (npc: NPC) => {
      const roll = Math.floor(Math.random() * 20) + 1
      const dexScore = npc.customStats?.abilityScores?.dex
      const modifier = dexScore != null ? Math.floor((dexScore - 10) / 2) : 0
      const entry: InitiativeEntry = {
        id: crypto.randomUUID(),
        entityId: npc.id,
        entityName: npc.name,
        entityType: 'npc',
        roll,
        modifier,
        total: roll + modifier,
        isActive: false
      }
      gameStore.addToInitiative(entry)
    },
    [gameStore]
  )

  const handlePlaceToken = useCallback(
    (tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'>) => {
      gameStore.setPendingPlacement(tokenData)
      setActiveTool('select')
    },
    [gameStore]
  )

  const handleRemoveToken = useCallback(
    (tokenId: string) => {
      if (!activeMap) return
      gameStore.removeToken(activeMap.id, tokenId)
      if (selectedTokenId === tokenId) setSelectedTokenId(null)
    },
    [activeMap, gameStore, selectedTokenId]
  )

  const handleWallPlace = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      if (!activeMap) return

      // Wall auto-close: snap endpoint to start of first wall segment if within 0.5 grid cells
      const walls = activeMap.wallSegments ?? []
      const snapThreshold = 0.5
      let finalX2 = x2
      let finalY2 = y2

      if (walls.length > 0) {
        // Find the start point of the first wall in a connected chain
        const firstWall = walls[walls.length - 1]
        if (firstWall) {
          const distToStart = Math.sqrt(
            (x2 - firstWall.x1) ** 2 + (y2 - firstWall.y1) ** 2
          )
          if (distToStart < snapThreshold && distToStart > 0) {
            finalX2 = firstWall.x1
            finalY2 = firstWall.y1
          }
        }
      }

      const wall: WallSegment = {
        id: crypto.randomUUID(),
        x1,
        y1,
        x2: finalX2,
        y2: finalY2,
        type: 'solid',
        isOpen: false
      }
      gameStore.addWallSegment(activeMap.id, wall)

      // Push undo action for wall placement
      const mapId = activeMap.id
      const wallId = wall.id
      UndoManager.push({
        type: 'wall-place',
        description: `Place wall (${x1},${y1}) to (${finalX2},${finalY2})`,
        undo: () => {
          const gs = useGameStore.getState()
          gs.removeWallSegment(mapId, wallId)
        },
        redo: () => {
          const gs = useGameStore.getState()
          gs.addWallSegment(mapId, wall)
        }
      })
      setUndoCount((c) => c + 1)
    },
    [activeMap, gameStore]
  )

  const handleDoorToggle = useCallback(
    (wallId: string) => {
      if (!activeMap) return
      const wall = (activeMap.wallSegments ?? []).find((w) => w.id === wallId)
      if (wall && wall.type === 'door') {
        gameStore.updateWallSegment(activeMap.id, wallId, { isOpen: !wall.isOpen })
      }
    },
    [activeMap, gameStore]
  )

  const handleRevealAll = useCallback(() => {
    if (!activeMap) return
    const cols = Math.ceil(activeMap.width / activeMap.grid.cellSize)
    const rows = Math.ceil(activeMap.height / activeMap.grid.cellSize)
    const cells: Array<{ x: number; y: number }> = []
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        cells.push({ x, y })
      }
    }
    gameStore.revealFog(activeMap.id, cells)
  }, [activeMap, gameStore])

  const handleHideAll = useCallback(() => {
    if (!activeMap) return
    gameStore.hideFog(activeMap.id, activeMap.fogOfWar.revealedCells)
  }, [activeMap, gameStore])

  return (
    <div className="fixed inset-0 z-30 bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-center px-3 gap-3 shrink-0">
        <MapSelector
          maps={gameStore.maps}
          activeMapId={gameStore.activeMapId}
          onSelectMap={handleSelectMap}
          onAddMap={handleAddMap}
        />
        {gameStore.initiative && (
          <span className="text-xs text-amber-400 font-semibold">Round {gameStore.initiative.round}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors cursor-pointer"
        >
          Close Editor
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Tools strip */}
        <div className="w-12 bg-gray-900/80 border-r border-gray-700 flex flex-col items-center py-2 gap-1 shrink-0">
          <DMToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={UndoManager.canUndo()}
            canRedo={UndoManager.canRedo()}
          />
        </div>

        {/* Map canvas */}
        <div className="flex-1 relative min-w-0">
          <MapCanvas
            map={activeMap}
            isHost={true}
            selectedTokenId={selectedTokenId}
            activeTool={activeTool}
            fogBrushSize={fogBrushSize}
            onTokenMove={handleTokenMove}
            onTokenSelect={handleTokenSelect}
            onCellClick={handleCellClick}
            onWallPlace={handleWallPlace}
            onDoorToggle={handleDoorToggle}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 bg-gray-900/80 border-l border-gray-700 flex flex-col shrink-0">
          <div className="flex gap-0.5 p-1.5 border-b border-gray-800">
            {(['tokens', 'fog', 'terrain', 'grid', 'npcs', 'notes', 'shop'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightPanel(tab)}
                className={`px-2 py-0.5 text-[10px] rounded capitalize transition-colors cursor-pointer ${
                  rightPanel === tab ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rightPanel === 'tokens' && (
              <TokenPlacer
                tokens={activeMap?.tokens ?? []}
                onPlaceToken={handlePlaceToken}
                onRemoveToken={handleRemoveToken}
                placingActive={gameStore.pendingPlacement !== null}
              />
            )}
            {rightPanel === 'fog' && (
              <FogBrush
                activeTool={activeTool}
                brushSize={fogBrushSize}
                onToolChange={setActiveTool}
                onBrushSizeChange={setFogBrushSize}
                onRevealAll={handleRevealAll}
                onHideAll={handleHideAll}
              />
            )}
            {rightPanel === 'terrain' && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-200">Terrain Painter</h4>
                <p className="text-xs text-gray-500">
                  Select a terrain type, then click cells on the map to toggle terrain.
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      type: 'difficult' as const,
                      label: 'Difficult Terrain',
                      desc: '2x movement cost',
                      color: 'bg-amber-900/50'
                    },
                    { type: 'hazard' as const, label: 'Hazard', desc: 'Dangerous area', color: 'bg-red-900/50' },
                    {
                      type: 'water' as const,
                      label: 'Water',
                      desc: '2x cost (free with Swim Speed)',
                      color: 'bg-blue-900/50'
                    },
                    {
                      type: 'climbing' as const,
                      label: 'Climbing',
                      desc: '2x cost (free with Climb Speed)',
                      color: 'bg-purple-900/50'
                    }
                  ].map(({ type, label, desc, color }) => (
                    <button
                      key={type}
                      onClick={() => {
                        setTerrainPaintType(type)
                        setActiveTool('terrain')
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        activeTool === 'terrain' && terrainPaintType === type
                          ? `border-amber-500 ${color}`
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-semibold text-gray-200">{label}</div>
                      <div className="text-gray-500">{desc}</div>
                    </button>
                  ))}
                </div>
                {activeMap && (activeMap.terrain ?? []).length > 0 && (
                  <button
                    onClick={() => {
                      if (!activeMap) return
                      const maps = gameStore.maps.map((m) => (m.id === activeMap.id ? { ...m, terrain: [] } : m))
                      gameStore.loadGameState({ maps })
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-red-900/30 border border-red-800 rounded-lg text-red-300 hover:bg-red-900/50 cursor-pointer"
                  >
                    Clear All Terrain ({(activeMap.terrain ?? []).length} cells)
                  </button>
                )}
              </div>
            )}
            {rightPanel === 'npcs' && (
              <NPCManager
                npcs={campaign.npcs}
                onAddToInitiative={handleNpcToInitiative}
                onPlaceOnMap={async (npc: NPC) => {
                  if (!activeMap) return
                  let statBlock = null
                  if (npc.statBlockId) {
                    statBlock = await load5eMonsterById(npc.statBlockId)
                  }
                  const merged = npc.customStats
                    ? statBlock
                      ? { ...statBlock, ...npc.customStats }
                      : npc.customStats
                    : statBlock
                  const hp = merged?.hp ?? 10
                  const ac = merged?.ac ?? 10
                  const size = merged?.size ?? 'Medium'
                  const tokenDims = getSizeTokenDimensions(size)
                  const walkSpeed = merged?.speed?.walk ?? 30
                  const dexMod = merged?.abilityScores ? Math.floor((merged.abilityScores.dex - 10) / 2) : 0
                  // Use click-to-place for interactive placement
                  gameStore.setPendingPlacement({
                    entityId: npc.id,
                    entityType: npc.role === 'enemy' ? 'enemy' : 'npc',
                    label: npc.name,
                    sizeX: tokenDims.x,
                    sizeY: tokenDims.y,
                    visibleToPlayers: npc.isVisible,
                    conditions: [],
                    currentHP: hp,
                    maxHP: hp,
                    ac,
                    monsterStatBlockId: npc.statBlockId,
                    walkSpeed,
                    initiativeModifier: dexMod
                  })
                }}
              />
            )}
            {rightPanel === 'grid' && activeMap && (
              <GridControlPanel
                grid={activeMap.grid}
                onUpdate={(updates) => {
                  const newGrid = { ...activeMap.grid, ...updates }
                  const maps = gameStore.maps.map((m) =>
                    m.id === activeMap.id ? { ...m, grid: newGrid } : m
                  )
                  gameStore.loadGameState({ maps })
                }}
              />
            )}
            {rightPanel === 'notes' && <DMNotepad />}
            {rightPanel === 'shop' && <ShopPanel />}
          </div>
        </div>
      </div>

      {showCreateMap && (
        <Suspense fallback={null}>
          <CreateMapDialog onCreateMap={handleCreateMap} onClose={() => setShowCreateMap(false)} />
        </Suspense>
      )}
    </div>
  )
}
