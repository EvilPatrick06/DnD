import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGameEffects } from '../../hooks/use-game-effects'
import { useGameHandlers } from '../../hooks/use-game-handlers'
import { useGameNetwork } from '../../hooks/use-game-network'
import { useTokenMovement } from '../../hooks/use-token-movement'
import { useAiDmStore } from '../../stores/use-ai-dm-store'
import { useCharacterStore } from '../../stores/use-character-store'
import { useGameStore } from '../../stores/use-game-store'
import { useLobbyStore } from '../../stores/use-lobby-store'
import { useNetworkStore } from '../../stores/use-network-store'
import type { Campaign } from '../../types/campaign'
import type { Character } from '../../types/character'
import { is5eCharacter } from '../../types/character'
import type { MapToken } from '../../types/map'
import { getBuilderCreatePath } from '../../utils/character-routes'
import DMBottomBar from './bottom/DMBottomBar'
import PlayerBottomBar from './bottom/PlayerBottomBar'
import { DiceOverlay } from './dice3d'
import DiceTray from './dice3d/DiceTray'
import type { ActiveModal } from './GameModalDispatcher'
import GameModalDispatcher from './GameModalDispatcher'
import type { AoEConfig } from './map/aoe-overlay'
import MapCanvas from './map/MapCanvas'
import ClockOverlay from './overlays/ClockOverlay'
import DmAlertTray from './overlays/DmAlertTray'
import {
  type ConcCheckPromptState,
  ConcentrationCheckPrompt,
  type OaPromptState,
  OpportunityAttackPrompt,
  StabilizeCheckPrompt,
  type StabilizePromptState
} from './overlays/GamePrompts'
import {
  AoEDismissButton,
  FogToolbar,
  LongRestWarning,
  PhaseChangeToast,
  RestRequestToast,
  WallToolbar
} from './overlays/GameToasts'
import InitiativeOverlay from './overlays/InitiativeOverlay'
import PlayerHUDOverlay from './overlays/PlayerHUDOverlay'
import SettingsDropdown from './overlays/SettingsDropdown'
import TimerOverlay from './overlays/TimerOverlay'
import TokenContextMenu from './overlays/TokenContextMenu'
import ViewModeToggle from './overlays/ViewModeToggle'
import ShopView from './player/ShopView'
import ResizeHandle from './ResizeHandle'
import LeftSidebar from './sidebar/LeftSidebar'

const DMMapEditor = lazy(() => import('./modals/dm-tools/DMMapEditor'))
const RulingApprovalModal = lazy(() => import('./modals/utility/RulingApprovalModal'))
const NarrationOverlay = lazy(() => import('./overlays/NarrationOverlay'))

interface GameLayoutProps {
  campaign: Campaign
  isDM: boolean
  character: Character | null
  playerName: string
}

export default function GameLayout({ campaign, isDM, character, playerName }: GameLayoutProps): JSX.Element {
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editMapMode, setEditMapMode] = useState(false)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [bottomBarHeight, setBottomBarHeight] = useState(() => {
    try {
      return parseInt(localStorage.getItem('dnd-vtt-bottom-bar-height') || '320', 10)
    } catch {
      return 320
    }
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return parseInt(localStorage.getItem('dnd-vtt-sidebar-width') || '280', 10)
    } catch {
      return 280
    }
  })
  const prevBottomHeight = useRef(320)
  const prevSidebarWidth = useRef(280)
  const [teleportMove, setTeleportMove] = useState(false)
  const [activeAoE, setActiveAoE] = useState<AoEConfig | null>(null)
  const [viewMode, setViewModeRaw] = useState<'dm' | 'player'>(() => {
    try {
      const saved = sessionStorage.getItem(`game-viewMode-${campaign.id}`)
      return saved === 'player' ? 'player' : 'dm'
    } catch {
      return 'dm'
    }
  })
  const setViewMode = useCallback(
    (mode: 'dm' | 'player') => {
      setViewModeRaw(mode)
      try {
        sessionStorage.setItem(`game-viewMode-${campaign.id}`, mode)
      } catch {
        /* ignore */
      }
    },
    [campaign.id]
  )
  const [showCharacterPicker, setShowCharacterPicker] = useState(false)
  const [activeTool, setActiveTool] = useState<'select' | 'fog-reveal' | 'fog-hide' | 'wall'>('select')
  const [fogBrushSize, setFogBrushSize] = useState(1)
  const [wallType, setWallType] = useState<'solid' | 'door' | 'window'>('solid')
  const [_timeRequestToast, setTimeRequestToast] = useState<{ requesterId: string; requesterName: string } | null>(null)
  const [phaseChangeToast, setPhaseChangeToast] = useState<{
    phase: string
    suggestedLight: 'bright' | 'dim' | 'darkness'
  } | null>(null)
  const [longRestWarning, setLongRestWarning] = useState(false)
  const [restRequestToast, setRestRequestToast] = useState<{ playerName: string; restType: 'short' | 'long' } | null>(
    null
  )
  const [disputeContext, setDisputeContext] = useState<{ ruling: string; citation: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; token: MapToken; mapId: string } | null>(null)
  const [editingToken, setEditingToken] = useState<{ token: MapToken; mapId: string } | null>(null)
  const [viewingHandout, setViewingHandout] = useState<import('../../types/game-state').Handout | null>(null)
  const [narrationText, setNarrationText] = useState<string | null>(null)
  const [oaPrompt, setOaPrompt] = useState<OaPromptState | null>(null)
  const [stabilizePrompt, setStabilizePrompt] = useState<StabilizePromptState | null>(null)
  const [concCheckPrompt, setConcCheckPrompt] = useState<ConcCheckPromptState | null>(null)

  const gameStore = useGameStore()
  const networkRole = useNetworkStore((s) => s.role)
  const sendMessage = useNetworkStore((s) => s.sendMessage)
  const addChatMessage = useLobbyStore((s) => s.addChatMessage)
  const aiDmStore = useAiDmStore()
  const aiInitRef = useRef(false)
  const allCharacters = useCharacterStore((s) => s.characters)

  const handleBottomResize = useCallback((delta: number) => {
    setBottomBarHeight((h) => {
      const newH = Math.max(160, Math.min(window.innerHeight * 0.6, h - delta))
      localStorage.setItem('dnd-vtt-bottom-bar-height', String(newH))
      return newH
    })
  }, [])
  const handleBottomDoubleClick = useCallback(() => {
    if (bottomCollapsed) {
      setBottomCollapsed(false)
      setBottomBarHeight(prevBottomHeight.current)
    } else {
      prevBottomHeight.current = bottomBarHeight
      setBottomCollapsed(true)
    }
  }, [bottomCollapsed, bottomBarHeight])
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => {
      const newW = Math.max(200, Math.min(500, w + delta))
      localStorage.setItem('dnd-vtt-sidebar-width', String(newW))
      return newW
    })
  }, [])
  const handleSidebarDoubleClick = useCallback(() => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false)
      setSidebarWidth(prevSidebarWidth.current)
    } else {
      prevSidebarWidth.current = sidebarWidth
      setSidebarCollapsed(true)
    }
  }, [sidebarCollapsed, sidebarWidth])

  const effectiveIsDM = isDM && viewMode === 'dm'
  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId) ?? null
  const playerConditions = character ? gameStore.conditions.filter((c) => c.entityId === character.id) : []
  const isMyTurn = (() => {
    if (!gameStore.initiative || !character) return false
    return gameStore.initiative.entries[gameStore.initiative.currentIndex]?.entityId === character.id
  })()

  const handleViewModeToggle = (): void => {
    if (viewMode === 'player') {
      setViewMode('dm')
      return
    }
    setShowCharacterPicker(true)
  }
  const handleToggleFullscreen = (): void => {
    window.api.toggleFullscreen().then((fs) => setIsFullscreen(fs))
  }

  useGameEffects({ campaign, isDM, addChatMessage, sendMessage, aiInitRef, activeMap, setIsFullscreen })
  useGameNetwork({
    networkRole,
    campaignId: campaign.id,
    aiDmEnabled: campaign.aiDm?.enabled ?? false,
    addChatMessage,
    sendMessage,
    setTimeRequestToast,
    setNarrationText
  })

  const {
    handleReadAloud,
    handleLeaveGame,
    handleSaveCampaign,
    handleEndSession,
    getCampaignCharacterIds,
    handleShortRest,
    handleLongRest,
    executeLongRest,
    handleRestApply,
    handleCellClick,
    handleAction,
    handleCompanionSummon,
    handleWildShapeTransform,
    handleWildShapeRevert,
    handleWildShapeUseAdjust,
    handleOpenShop
  } = useGameHandlers({
    campaign,
    isDM,
    character,
    playerName,
    activeMap,
    addChatMessage,
    sendMessage,
    setActiveModal,
    setNarrationText,
    setLeaving,
    setLongRestWarning,
    activeTool,
    fogBrushSize
  })

  const { handleTokenMoveWithOA, handleConcentrationLost } = useTokenMovement({
    activeMap,
    teleportMove,
    addChatMessage,
    setOaPrompt,
    setConcCheckPrompt
  })

  if (leaving)
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-950 text-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Leaving game...</p>
        </div>
      </div>
    )

  const sidebarLeftPx = sidebarCollapsed ? 12 : sidebarWidth

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gray-950 text-gray-100">
      {/* Map layer */}
      <div className="absolute inset-0">
        <MapCanvas
          key={mapKey}
          map={activeMap}
          isHost={effectiveIsDM}
          selectedTokenId={null}
          activeTool={activeTool}
          fogBrushSize={fogBrushSize}
          onTokenMove={handleTokenMoveWithOA}
          onTokenSelect={() => {}}
          onCellClick={handleCellClick}
          onWallPlace={(x1, y1, x2, y2) => {
            if (!activeMap) return
            gameStore.addWallSegment(activeMap.id, {
              id: `wall-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
              x1,
              y1,
              x2,
              y2,
              type: wallType
            })
          }}
          onDoorToggle={(wallId) => {
            if (!activeMap) return
            const wall = activeMap.wallSegments?.find((w) => w.id === wallId)
            if (wall?.type === 'door') gameStore.updateWallSegment(activeMap.id, wallId, { isOpen: !wall.isOpen })
          }}
          activeAoE={activeAoE}
          activeEntityId={gameStore.initiative?.entries[gameStore.initiative.currentIndex]?.entityId ?? null}
          onTokenContextMenu={(x, y, token, mapId) => setContextMenu({ x, y, token, mapId })}
        />
        {gameStore.ambientLight === 'dim' && (
          <div className="absolute inset-0 bg-amber-900/20 pointer-events-none z-[1]" />
        )}
        {gameStore.ambientLight === 'darkness' && (
          <div className="absolute inset-0 bg-gray-950/60 pointer-events-none z-[1]" />
        )}
        {gameStore.underwaterCombat && <div className="absolute inset-0 bg-blue-900/15 pointer-events-none z-[1]" />}
        <DiceOverlay />
        <DiceTray />
      </div>

      {/* Left sidebar */}
      <div className="absolute top-0 left-0 bottom-0 z-10 flex">
        <div
          style={{ width: sidebarCollapsed ? 48 : sidebarWidth }}
          className="h-full shrink-0 transition-[width] duration-200"
        >
          <LeftSidebar
            campaign={campaign}
            campaignId={campaign.id}
            isDM={effectiveIsDM}
            character={character}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            onReadAloud={effectiveIsDM ? handleReadAloud : undefined}
          />
        </div>
        {!sidebarCollapsed && (
          <ResizeHandle
            direction="horizontal"
            onResize={handleSidebarResize}
            onDoubleClick={handleSidebarDoubleClick}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 right-0 z-10 flex flex-col"
        style={{ left: sidebarLeftPx, height: bottomCollapsed ? 40 : bottomBarHeight }}
      >
        {!bottomCollapsed && (
          <ResizeHandle direction="vertical" onResize={handleBottomResize} onDoubleClick={handleBottomDoubleClick} />
        )}
        {effectiveIsDM ? (
          <DMBottomBar
            onEditMap={() => setEditMapMode(true)}
            onHiddenDice={() => setActiveModal('dmRoller')}
            onInitiative={() => setActiveModal('initiative')}
            onWhisper={() => setActiveModal('whisper')}
            onTimer={() => setActiveModal('timer')}
            onQuickCondition={() => setActiveModal('quickCondition')}
            onShop={handleOpenShop}
            onNotes={() => setActiveModal('notes')}
            onJump={() => setActiveModal('jump')}
            onFallingDamage={() => setActiveModal('falling')}
            onAoETemplate={() => setActiveModal('aoe')}
            onTravelPace={() => setActiveModal('travelPace')}
            onCreatures={() => setActiveModal('creatures')}
            onSummonCreature={() => setActiveModal('summonCreature')}
            playerName={playerName}
            campaign={campaign}
            teleportMove={teleportMove}
            onToggleTeleportMove={() => setTeleportMove((t) => !t)}
            collapsed={bottomCollapsed}
            onToggleCollapse={() => setBottomCollapsed((c) => !c)}
            onOpenModal={(modal) => setActiveModal(modal as ActiveModal)}
            onDispute={(ruling) => {
              setDisputeContext({ ruling, citation: '' })
              setActiveModal('dispute')
            }}
          />
        ) : (
          <PlayerBottomBar
            character={character}
            campaignId={campaign.id}
            onAction={() => setActiveModal('action')}
            onItem={() => setActiveModal('item')}
            onFamiliar={() => setActiveModal('familiar')}
            onWildShape={() => setActiveModal('wildShape')}
            onSteed={() => setActiveModal('steed')}
            onJump={() => setActiveModal('jump')}
            onFallingDamage={() => setActiveModal('falling')}
            onTravelPace={() => setActiveModal('travelPace')}
            onQuickCondition={() => setActiveModal('quickCondition')}
            onCheckTime={
              campaign.calendar
                ? () => {
                    sendMessage('player:time-request', { requesterId: 'local', requesterName: playerName })
                  }
                : undefined
            }
            onLightSource={() => setActiveModal('lightSource')}
            onDowntime={() => setActiveModal('downtime')}
            onSpellRef={() => setActiveModal('spellRef')}
            onShortcutRef={() => setActiveModal('shortcutRef')}
            onWhisper={() => setActiveModal('whisper')}
            playerName={playerName}
            campaign={campaign}
            collapsed={bottomCollapsed}
            onToggleCollapse={() => setBottomCollapsed((c) => !c)}
            onOpenModal={(modal) => setActiveModal(modal as ActiveModal)}
          />
        )}
      </div>

      {/* Floating overlays */}
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
        {isDM && <ViewModeToggle viewMode={viewMode} onToggle={handleViewModeToggle} characterName={character?.name} />}
        {campaign.calendar && (
          <ClockOverlay
            calendar={campaign.calendar}
            isDM={effectiveIsDM}
            onEditTime={() => setActiveModal('timeEdit')}
            onShortRest={handleShortRest}
            onLongRest={handleLongRest}
            onLightSource={() => setActiveModal('lightSource')}
            onPhaseChange={(phase, suggestedLight) => {
              if (isDM) {
                setPhaseChangeToast({ phase, suggestedLight })
                if (phase === 'dawn') {
                  const charStore = useCharacterStore.getState()
                  const campaignChars = charStore.characters.filter(
                    (c) => c.campaignId === campaign.id && c.gameSystem === 'dnd5e'
                  )
                  for (const ch of campaignChars) {
                    const items5e = (ch as import('../../types/character-5e').Character5e).equipment ?? []
                    let changed = false
                    for (const item of items5e) {
                      if (item.magicItemId && item.maxCharges && item.rechargeType === 'dawn') {
                        const formula = item.rechargeFormula ?? `1d${item.maxCharges}`
                        const match = formula.match(/^(\d+)?d(\d+)([+-]\d+)?$/)
                        let rechargeAmount: number
                        if (match) {
                          const count = parseInt(match[1] || '1', 10)
                          const sides = parseInt(match[2], 10)
                          const mod = parseInt(match[3] || '0', 10)
                          rechargeAmount = 0
                          for (let i = 0; i < count; i++) rechargeAmount += Math.floor(Math.random() * sides) + 1
                          rechargeAmount += mod
                        } else {
                          rechargeAmount = parseInt(formula, 10) || 1
                        }
                        item.currentCharges = Math.min((item.currentCharges ?? 0) + rechargeAmount, item.maxCharges)
                        changed = true
                      }
                    }
                    if (changed)
                      charStore.saveCharacter({
                        ...ch,
                        equipment: items5e
                      } as import('../../types/character-5e').Character5e)
                  }
                }
              }
            }}
          />
        )}
        {isDM && <DmAlertTray />}
        <SettingsDropdown
          campaign={campaign}
          isDM={effectiveIsDM}
          isOpen={settingsOpen}
          onToggle={() => setSettingsOpen(!settingsOpen)}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          onLeaveGame={handleLeaveGame}
          onSaveCampaign={effectiveIsDM ? handleSaveCampaign : undefined}
          onEndSession={effectiveIsDM ? handleEndSession : undefined}
        />
      </div>
      {gameStore.initiative && <InitiativeOverlay isDM={effectiveIsDM} />}
      {contextMenu && (
        <TokenContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          token={contextMenu.token}
          mapId={contextMenu.mapId}
          isDM={effectiveIsDM}
          characterId={character?.id}
          onClose={() => setContextMenu(null)}
          onEditToken={(token) => {
            setEditingToken({ token, mapId: contextMenu.mapId })
            setActiveModal('tokenEditor')
            setContextMenu(null)
          }}
          onAddToInitiative={(token) => {
            const roll = Math.floor(Math.random() * 20) + 1
            const modifier = token.initiativeModifier ?? 0
            gameStore.addToInitiative({
              id: token.id,
              entityId: token.entityId,
              entityName: token.label,
              entityType: token.entityType,
              roll,
              modifier,
              total: roll + modifier,
              isActive: false
            })
            setContextMenu(null)
          }}
        />
      )}
      {!effectiveIsDM && <PlayerHUDOverlay character={character} conditions={playerConditions} />}
      {gameStore.timerRunning && <TimerOverlay />}
      {narrationText && (
        <Suspense fallback={null}>
          <NarrationOverlay text={narrationText} onDismiss={() => setNarrationText(null)} />
        </Suspense>
      )}

      {/* DM toolbars */}
      {effectiveIsDM && (activeTool === 'fog-reveal' || activeTool === 'fog-hide') && (
        <FogToolbar
          activeTool={activeTool}
          fogBrushSize={fogBrushSize}
          onSetTool={setActiveTool}
          onSetBrushSize={setFogBrushSize}
        />
      )}
      {effectiveIsDM && activeTool === 'wall' && (
        <WallToolbar wallType={wallType} onSetWallType={setWallType} onDone={() => setActiveTool('select')} />
      )}

      {!effectiveIsDM && <ShopView />}

      {/* Character picker for DM player-view toggle */}
      {showCharacterPicker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCharacterPicker(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-5 w-96 shadow-2xl max-h-[70vh] flex flex-col">
            <h3 className="text-sm font-semibold text-amber-400 mb-3">Select a Character</h3>
            <p className="text-xs text-gray-400 mb-3">Choose a character to view the game as a player.</p>
            <div className="flex-1 overflow-y-auto space-y-1 mb-3">
              {allCharacters.length === 0 && (
                <p className="text-xs text-gray-500 italic">No characters found. Create one first.</p>
              )}
              {allCharacters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    useCharacterStore
                      .getState()
                      .saveCharacter({ ...c, campaignId: campaign.id, updatedAt: new Date().toISOString() })
                    setShowCharacterPicker(false)
                    setViewMode('player')
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-gray-200">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      Level {c.level} {is5eCharacter(c) ? c.classes.map((cl) => cl.name).join(' / ') : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCharacterPicker(false)
                  navigate(getBuilderCreatePath(), { state: { returnTo: `/game/${campaign.id}` } })
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
              >
                Create New Character
              </button>
              <button
                onClick={() => setShowCharacterPicker(false)}
                className="px-3 py-2 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <GameModalDispatcher
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        effectiveIsDM={effectiveIsDM}
        isDM={isDM}
        character={character}
        playerName={playerName}
        campaign={campaign}
        isMyTurn={isMyTurn}
        handleAction={handleAction}
        handleRestApply={handleRestApply}
        getCampaignCharacterIds={getCampaignCharacterIds}
        setActiveAoE={setActiveAoE}
        disputeContext={disputeContext}
        setDisputeContext={setDisputeContext}
        editingToken={editingToken}
        setEditingToken={setEditingToken}
        viewingHandout={viewingHandout}
        setViewingHandout={setViewingHandout}
        setConcCheckPrompt={setConcCheckPrompt}
        handleCompanionSummon={handleCompanionSummon}
        handleWildShapeTransform={handleWildShapeTransform}
        handleWildShapeRevert={handleWildShapeRevert}
        handleWildShapeUseAdjust={handleWildShapeUseAdjust}
      />

      {/* Toast overlays */}
      {restRequestToast && isDM && (
        <RestRequestToast
          toast={restRequestToast}
          onDismiss={() => setRestRequestToast(null)}
          onShortRest={handleShortRest}
          onLongRest={handleLongRest}
        />
      )}
      {phaseChangeToast && isDM && (
        <PhaseChangeToast toast={phaseChangeToast} onDismiss={() => setPhaseChangeToast(null)} />
      )}
      {longRestWarning && <LongRestWarning onOverride={executeLongRest} onCancel={() => setLongRestWarning(false)} />}
      {activeAoE && <AoEDismissButton onClear={() => setActiveAoE(null)} />}

      {/* Game prompts */}
      {oaPrompt && (
        <OpportunityAttackPrompt
          prompt={oaPrompt}
          onDismiss={() => setOaPrompt(null)}
          addChatMessage={addChatMessage}
          sendMessage={sendMessage}
        />
      )}
      {concCheckPrompt && (
        <ConcentrationCheckPrompt
          prompt={concCheckPrompt}
          onDismiss={() => setConcCheckPrompt(null)}
          addChatMessage={addChatMessage}
          sendMessage={sendMessage}
          onConcentrationLost={handleConcentrationLost}
        />
      )}
      {stabilizePrompt && (
        <StabilizeCheckPrompt
          prompt={stabilizePrompt}
          character={character}
          onDismiss={() => setStabilizePrompt(null)}
          addChatMessage={addChatMessage}
          sendMessage={sendMessage}
        />
      )}

      {/* DM Map Editor fullscreen */}
      {editMapMode && effectiveIsDM && (
        <Suspense fallback={null}>
          <DMMapEditor
            campaign={campaign}
            onClose={() => {
              setEditMapMode(false)
              setMapKey((k) => k + 1)
            }}
          />
        </Suspense>
      )}
      {effectiveIsDM && aiDmStore.pendingActions && (
        <Suspense fallback={null}>
          <RulingApprovalModal />
        </Suspense>
      )}
    </div>
  )
}
