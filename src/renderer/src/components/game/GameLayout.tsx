import { useState, useCallback, useEffect } from 'react'
import type { Campaign, NPC } from '../../types/campaign'
import type { GameMap, MapToken } from '../../types/map'
import type { GameSystem } from '../../types/game-system'
import type { Character } from '../../types/character'
import type { InitiativeEntry, EntityCondition } from '../../types/game-state'
import type { GameChatMessage } from './ChatPanel'
import { useGameStore } from '../../stores/useGameStore'
import { useNetworkStore } from '../../stores/useNetworkStore'
import { onMessage as onClientMessage } from '../../network/client-manager'
import { onMessage as onHostMessage } from '../../network/host-manager'
import type { ShopUpdatePayload } from '../../network/types'
import MapCanvas from './MapCanvas'
import ChatPanel from './ChatPanel'
import DiceRoller from './DiceRoller'
import { DMToolbar, MapSelector, TokenPlacer, FogBrush, InitiativeTracker, NPCManager, DMNotepad } from './dm'
import ShopPanel from './dm/ShopPanel'
import { PlayerHUD, ActionBar, CharacterMiniSheet, ConditionTracker, SpellSlotTracker } from './player'
import ShopView from './player/ShopView'

interface GameLayoutProps {
  campaign: Campaign
  isDM: boolean
  character: Character | null
  playerName: string
}

type BottomTab = 'actions' | 'dice' | 'chat'
type RightTab = 'character' | 'conditions' | 'spells'
type DMRightTab = 'tokens' | 'fog' | 'npcs' | 'notes' | 'shop'

export default function GameLayout({
  campaign,
  isDM,
  character,
  playerName
}: GameLayoutProps): JSX.Element {
  // Panels
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [bottomTab, setBottomTab] = useState<BottomTab>('actions')
  const [rightTab, setRightTab] = useState<RightTab>('character')
  const [dmRightTab, setDmRightTab] = useState<DMRightTab>('tokens')

  // DM tools
  const [activeTool, setActiveTool] = useState<
    'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure'
  >('select')
  const [fogBrushSize, setFogBrushSize] = useState(1)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [pendingToken, setPendingToken] = useState<Omit<
    MapToken,
    'id' | 'gridX' | 'gridY'
  > | null>(null)

  // Chat
  const [chatMessages, setChatMessages] = useState<GameChatMessage[]>([
    {
      id: 'system-start',
      senderId: 'system',
      senderName: 'System',
      content: `Game session started for "${campaign.name}"`,
      timestamp: Date.now(),
      isSystem: true,
      isDM: false,
      isWhisper: false
    }
  ])

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)

  // Store
  const gameStore = useGameStore()
  const networkRole = useNetworkStore((s) => s.role)

  // Listen for dm:shop-update messages (client receives shop state from DM)
  useEffect(() => {
    if (networkRole === 'none') return

    const handler = (msg: { type: string; payload?: unknown }): void => {
      if (msg.type === 'dm:shop-update') {
        const payload = msg.payload as ShopUpdatePayload
        if (payload.shopInventory.length > 0) {
          gameStore.openShop(payload.shopName || 'Shop')
          gameStore.setShopInventory(payload.shopInventory)
        } else {
          gameStore.closeShop()
        }
      }
    }

    if (networkRole === 'client') {
      return onClientMessage(handler)
    } else if (networkRole === 'host') {
      return onHostMessage(handler)
    }
  }, [networkRole, gameStore])
  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId) ?? null
  const system = campaign.system

  // Get player conditions
  const playerConditions = character
    ? gameStore.conditions.filter((c) => c.entityId === character.id)
    : []

  // Is it the current player's turn?
  const isMyTurn = (() => {
    if (!gameStore.initiative || !character) return false
    const current = gameStore.initiative.entries[gameStore.initiative.currentIndex]
    return current?.entityId === character.id
  })()

  // --- Handlers ---

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

      if (activeTool === 'token' && pendingToken) {
        const token: MapToken = {
          ...pendingToken,
          id: crypto.randomUUID(),
          gridX,
          gridY
        }
        gameStore.addToken(activeMap.id, token)
        setPendingToken(null)
        setActiveTool('select')
        return
      }

      if (activeTool === 'fog-reveal') {
        const halfBrush = Math.floor(fogBrushSize / 2)
        const cells: Array<{ x: number; y: number }> = []
        for (let dx = -halfBrush; dx <= halfBrush; dx++) {
          for (let dy = -halfBrush; dy <= halfBrush; dy++) {
            cells.push({ x: gridX + dx, y: gridY + dy })
          }
        }
        gameStore.revealFog(activeMap.id, cells)
        return
      }

      if (activeTool === 'fog-hide') {
        const halfBrush = Math.floor(fogBrushSize / 2)
        const cells: Array<{ x: number; y: number }> = []
        for (let dx = -halfBrush; dx <= halfBrush; dx++) {
          for (let dy = -halfBrush; dy <= halfBrush; dy++) {
            cells.push({ x: gridX + dx, y: gridY + dy })
          }
        }
        gameStore.hideFog(activeMap.id, cells)
        return
      }
    },
    [activeMap, activeTool, pendingToken, fogBrushSize, gameStore]
  )

  const handleSelectMap = useCallback(
    (mapId: string) => {
      gameStore.setActiveMap(mapId)
    },
    [gameStore]
  )

  const handleAddMap = useCallback(() => {
    // Create a default map for now
    const newMap: GameMap = {
      id: crypto.randomUUID(),
      name: `Map ${gameStore.maps.length + 1}`,
      campaignId: campaign.id,
      imagePath: '',
      width: 1600,
      height: 1200,
      grid: {
        enabled: true,
        cellSize: 40,
        offsetX: 0,
        offsetY: 0,
        color: '#4b5563',
        opacity: 0.4,
        type: 'square'
      },
      tokens: [],
      fogOfWar: { enabled: false, revealedCells: [] },
      createdAt: new Date().toISOString()
    }
    gameStore.addMap(newMap)
    gameStore.setActiveMap(newMap.id)
  }, [campaign.id, gameStore])

  const handlePlaceToken = useCallback(
    (tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'>) => {
      setPendingToken(tokenData)
      setActiveTool('token')
    },
    []
  )

  const handleRemoveToken = useCallback(
    (tokenId: string) => {
      if (!activeMap) return
      gameStore.removeToken(activeMap.id, tokenId)
      if (selectedTokenId === tokenId) setSelectedTokenId(null)
    },
    [activeMap, gameStore, selectedTokenId]
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

  const handleSendChat = useCallback(
    (content: string) => {
      // Try to parse as JSON (internal dice/whisper commands)
      try {
        const parsed = JSON.parse(content)
        if (parsed.type === 'dice') {
          const msg: GameChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderId: 'local',
            senderName: playerName,
            content: `rolled ${parsed.formula}`,
            timestamp: Date.now(),
            isSystem: false,
            isDM,
            isWhisper: false,
            isDiceRoll: true,
            diceResult: {
              formula: parsed.formula,
              total: parsed.total,
              rolls: parsed.rolls
            }
          }
          setChatMessages((prev) => [...prev, msg])
          return
        }
        if (parsed.type === 'whisper') {
          const msg: GameChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderId: 'local',
            senderName: playerName,
            content: parsed.message,
            timestamp: Date.now(),
            isSystem: false,
            isDM: false,
            isWhisper: true,
            whisperTarget: parsed.target
          }
          setChatMessages((prev) => [...prev, msg])
          return
        }
      } catch {
        // Not JSON, treat as normal message
      }

      const msg: GameChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: 'local',
        senderName: playerName,
        content,
        timestamp: Date.now(),
        isSystem: false,
        isDM,
        isWhisper: false
      }
      setChatMessages((prev) => [...prev, msg])
    },
    [isDM, playerName]
  )

  const handleNPCAddToInitiative = useCallback(
    (npc: NPC) => {
      const entry: InitiativeEntry = {
        id: crypto.randomUUID(),
        entityId: npc.id,
        entityName: npc.name,
        entityType: 'npc',
        roll: Math.floor(Math.random() * 20) + 1,
        modifier: 0,
        total: Math.floor(Math.random() * 20) + 1,
        isActive: false
      }
      if (gameStore.initiative) {
        gameStore.updateInitiativeEntry(entry.id, entry)
      } else {
        gameStore.startInitiative([entry])
      }
    },
    [gameStore]
  )

  const handleNPCPlaceOnMap = useCallback(
    (npc: NPC) => {
      handlePlaceToken({
        entityId: npc.id,
        entityType: 'npc',
        label: npc.name,
        sizeX: 1,
        sizeY: 1,
        visibleToPlayers: npc.isVisible,
        conditions: []
      })
    },
    [handlePlaceToken]
  )

  const playerCount = campaign.players.filter((p) => p.isActive).length

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top Bar */}
      <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-center px-3 gap-4 flex-shrink-0">
        {isDM && (
          <MapSelector
            maps={gameStore.maps}
            activeMapId={gameStore.activeMapId}
            onSelectMap={handleSelectMap}
            onAddMap={handleAddMap}
          />
        )}

        {!isDM && activeMap && (
          <span className="text-sm text-gray-300">{activeMap.name}</span>
        )}

        <div className="flex-1" />

        <span className="text-xs text-gray-500">
          {playerCount} player{playerCount !== 1 ? 's' : ''}
        </span>

        {gameStore.initiative && (
          <span className="text-xs text-amber-400 font-semibold">
            Round {gameStore.initiative.round}
          </span>
        )}

        <span className="text-xs text-gray-500">
          {gameStore.turnMode === 'initiative' ? 'Initiative' : 'Free'}
        </span>

        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
          className="text-gray-400 hover:text-gray-200 cursor-pointer text-lg"
        >
          &#9881;
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - Initiative Tracker */}
        {leftPanelOpen && (
          <div className="w-64 bg-gray-900/80 border-r border-gray-700 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between p-2 border-b border-gray-800">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Initiative
              </span>
              <button
                onClick={() => setLeftPanelOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
              >
                &#x2715;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <InitiativeTracker
                initiative={gameStore.initiative}
                round={gameStore.round}
                isHost={isDM}
                onStartInitiative={gameStore.startInitiative}
                onNextTurn={gameStore.nextTurn}
                onPrevTurn={gameStore.prevTurn}
                onEndInitiative={gameStore.endInitiative}
                onUpdateEntry={gameStore.updateInitiativeEntry}
                onRemoveEntry={gameStore.removeFromInitiative}
              />
            </div>
          </div>
        )}

        {/* Center - Map Canvas */}
        <div className="flex-1 relative min-w-0">
          <MapCanvas
            map={activeMap}
            isHost={isDM}
            selectedTokenId={selectedTokenId}
            activeTool={activeTool}
            fogBrushSize={fogBrushSize}
            onTokenMove={handleTokenMove}
            onTokenSelect={handleTokenSelect}
            onCellClick={handleCellClick}
          />

          {/* DM Toolbar overlay */}
          {isDM && (
            <div className="absolute top-3 left-3 z-10">
              <DMToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            </div>
          )}

          {/* Toggle buttons for collapsed panels */}
          {!leftPanelOpen && (
            <button
              onClick={() => setLeftPanelOpen(true)}
              className="absolute top-3 left-3 z-10 w-8 h-8 bg-gray-900 border border-gray-700
                rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-200
                cursor-pointer text-xs"
              title="Show Initiative Panel"
            >
              &#9654;
            </button>
          )}
          {!rightPanelOpen && (
            <button
              onClick={() => setRightPanelOpen(true)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-gray-900 border border-gray-700
                rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-200
                cursor-pointer text-xs"
              title="Show Side Panel"
            >
              &#9664;
            </button>
          )}
        </div>

        {/* Right panel */}
        {rightPanelOpen && (
          <div className="w-72 bg-gray-900/80 border-l border-gray-700 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between p-2 border-b border-gray-800">
              {isDM ? (
                <div className="flex gap-1">
                  {(['tokens', 'fog', 'npcs', 'notes', 'shop'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDmRightTab(tab)}
                      className={`px-2 py-0.5 text-[10px] rounded capitalize transition-colors cursor-pointer
                        ${
                          dmRightTab === tab
                            ? 'bg-amber-600 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1">
                  {(['character', 'conditions', 'spells'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      className={`px-2 py-0.5 text-[10px] rounded capitalize transition-colors cursor-pointer
                        ${
                          rightTab === tab
                            ? 'bg-amber-600 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setRightPanelOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer ml-2"
              >
                &#x2715;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isDM ? (
                <>
                  {dmRightTab === 'tokens' && (
                    <TokenPlacer
                      tokens={activeMap?.tokens ?? []}
                      onPlaceToken={handlePlaceToken}
                      onRemoveToken={handleRemoveToken}
                      placingActive={activeTool === 'token' && pendingToken !== null}
                    />
                  )}
                  {dmRightTab === 'fog' && (
                    <FogBrush
                      activeTool={activeTool}
                      brushSize={fogBrushSize}
                      onToolChange={setActiveTool}
                      onBrushSizeChange={setFogBrushSize}
                      onRevealAll={handleRevealAll}
                      onHideAll={handleHideAll}
                    />
                  )}
                  {dmRightTab === 'npcs' && (
                    <NPCManager
                      npcs={campaign.npcs}
                      onAddToInitiative={handleNPCAddToInitiative}
                      onPlaceOnMap={handleNPCPlaceOnMap}
                    />
                  )}
                  {dmRightTab === 'notes' && <DMNotepad />}
                  {dmRightTab === 'shop' && <ShopPanel />}
                </>
              ) : (
                <>
                  {rightTab === 'character' && (
                    <CharacterMiniSheet character={character} />
                  )}
                  {rightTab === 'conditions' && (
                    <ConditionTracker
                      conditions={playerConditions}
                      isHost={isDM}
                      onRemoveCondition={gameStore.removeCondition}
                    />
                  )}
                  {rightTab === 'spells' && (
                    <SpellSlotTracker system={system} />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shop view (only for players) */}
      {!isDM && <ShopView />}

      {/* Player HUD (only for players) */}
      {!isDM && (
        <PlayerHUD character={character} conditions={playerConditions} />
      )}

      {/* Bottom bar */}
      <div className="h-56 bg-gray-900 border-t border-gray-700 flex flex-col flex-shrink-0">
        {/* Bottom tabs */}
        <div className="flex border-b border-gray-800 px-2">
          {(['actions', 'dice', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setBottomTab(tab)}
              className={`px-4 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer
                ${
                  bottomTab === tab
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Bottom content */}
        <div className="flex-1 min-h-0 p-2 overflow-hidden">
          {bottomTab === 'actions' && (
            <ActionBar
              system={system}
              isMyTurn={isMyTurn}
              onAction={(action) => {
                const msg: GameChatMessage = {
                  id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  senderId: 'system',
                  senderName: 'System',
                  content: `${playerName} uses ${action.replace(/-/g, ' ')}`,
                  timestamp: Date.now(),
                  isSystem: true,
                  isDM: false,
                  isWhisper: false
                }
                setChatMessages((prev) => [...prev, msg])
              }}
            />
          )}
          {bottomTab === 'dice' && (
            <DiceRoller
              system={system}
              rollerName={playerName}
              onRoll={(result) => {
                const msg: GameChatMessage = {
                  id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  senderId: 'local',
                  senderName: playerName,
                  content: `rolled ${result.formula}`,
                  timestamp: Date.now(),
                  isSystem: false,
                  isDM,
                  isWhisper: false,
                  isDiceRoll: true,
                  diceResult: result
                }
                setChatMessages((prev) => [...prev, msg])
              }}
            />
          )}
          {bottomTab === 'chat' && (
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendChat}
              localPlayerName={playerName}
            />
          )}
        </div>
      </div>

      {/* Settings overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Game Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-300 text-2xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Turn Mode</span>
                <select
                  value={gameStore.turnMode}
                  onChange={(e) =>
                    gameStore.setTurnMode(e.target.value as 'initiative' | 'free')
                  }
                  disabled={!isDM}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
                >
                  <option value="free">Free</option>
                  <option value="initiative">Initiative</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Paused</span>
                <button
                  onClick={() => gameStore.setPaused(!gameStore.isPaused)}
                  disabled={!isDM}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer
                    ${
                      gameStore.isPaused
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-400'
                    } disabled:opacity-50`}
                >
                  {gameStore.isPaused ? 'Paused' : 'Running'}
                </button>
              </div>
              <div className="text-xs text-gray-500 border-t border-gray-800 pt-3 mt-3">
                <p>Campaign: {campaign.name}</p>
                <p>System: {system === 'dnd5e' ? "D&D 5e" : 'Pathfinder 2e'}</p>
                <p>Players: {playerCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
