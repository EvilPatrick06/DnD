import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { onMessage as onClientMessage } from '../../network/client-manager'
import { onMessage as onHostMessage } from '../../network/host-manager'
import type {
  ChatPayload,
  NarrationPayload,
  PlayAmbientPayload,
  PlaySoundPayload,
  ShopUpdatePayload,
  TimeRequestPayload,
  TimerStartPayload,
  TimeSharePayload,
  TimeSyncPayload,
  WhisperPlayerPayload
} from '../../network/types'
import {
  isMoveBlockedByFear,
  type MovementType,
  proneStandUpCost,
  triggersOpportunityAttack
} from '../../services/combat-rules'
import { init as initSounds, play as playSound, playAmbient, stopAmbient, setAmbientVolume } from '../../services/sound-manager'
import type { SoundEvent, AmbientSound } from '../../services/sound-manager'
import { useAiDmStore } from '../../stores/useAiDmStore'
import { useGameStore } from '../../stores/useGameStore'
import { useLobbyStore } from '../../stores/useLobbyStore'
import { useNetworkStore } from '../../stores/useNetworkStore'
import type { Campaign } from '../../types/campaign'
import type { Character } from '../../types/character'
import type { MapToken } from '../../types/map'
import DMBottomBar from './bottom/DMBottomBar'
// Bottom bars
import PlayerBottomBar from './bottom/PlayerBottomBar'
import MapCanvas from './MapCanvas'
import ClockOverlay from './overlays/ClockOverlay'
import DmAlertTray from './overlays/DmAlertTray'
import InitiativeOverlay from './overlays/InitiativeOverlay'
import PlayerHUDOverlay from './overlays/PlayerHUDOverlay'
// Overlays (float inside map area)
import SettingsDropdown from './overlays/SettingsDropdown'
import TimerOverlay from './overlays/TimerOverlay'
import TokenContextMenu from './overlays/TokenContextMenu'
import ViewModeToggle from './overlays/ViewModeToggle'
import ShopView from './player/ShopView'
// Sidebar
import LeftSidebar from './sidebar/LeftSidebar'

// Modals — lazy-loaded (only fetched when opened)
const ActionModal = lazy(() => import('./modals/ActionModal'))
const ItemModal = lazy(() => import('./modals/ItemModal'))
const HiddenDiceModal = lazy(() => import('./modals/HiddenDiceModal'))
const WhisperModal = lazy(() => import('./modals/WhisperModal'))
const QuickConditionModal = lazy(() => import('./modals/QuickConditionModal'))
const TimerModal = lazy(() => import('./modals/TimerModal'))
const InitiativeModal = lazy(() => import('./modals/InitiativeModal'))
const DMNotesModal = lazy(() => import('./modals/DMNotesModal'))
const DMMapEditor = lazy(() => import('./modals/DMMapEditor'))
const AttackModal = lazy(() => import('./modals/AttackModal'))
const HelpModal = lazy(() => import('./modals/HelpModal'))
const JumpModal = lazy(() => import('./modals/JumpModal'))
const FallingDamageModal = lazy(() => import('./modals/FallingDamageModal'))
const InfluenceModal = lazy(() => import('./modals/InfluenceModal'))
const AoETemplateModal = lazy(() => import('./modals/AoETemplateModal'))
const TravelPaceModal = lazy(() => import('./modals/TravelPaceModal'))
const MountModal = lazy(() => import('./modals/MountModal'))
const CreatureModal = lazy(() => import('./modals/CreatureModal'))
const FamiliarSelectorModal = lazy(() => import('./modals/FamiliarSelectorModal'))
const WildShapeBrowserModal = lazy(() => import('./modals/WildShapeBrowserModal'))
const SteedSelectorModal = lazy(() => import('./modals/SteedSelectorModal'))
const TimeEditModal = lazy(() => import('./modals/TimeEditModal'))
const LightSourceModal = lazy(() => import('./modals/LightSourceModal'))
const RestModal = lazy(() => import('./modals/RestModal'))
const CommandReferenceModal = lazy(() => import('./modals/CommandReferenceModal'))
const DmRollerModal = lazy(() => import('./modals/DmRollerModal'))
const CustomEffectModal = lazy(() => import('./modals/CustomEffectModal'))
const EncounterBuilderModal = lazy(() => import('./modals/EncounterBuilderModal'))
const TreasureGeneratorModal = lazy(() => import('./modals/TreasureGeneratorModal'))
const ChaseTrackerModal = lazy(() => import('./modals/ChaseTrackerModal'))
const NPCGeneratorModal = lazy(() => import('./modals/NPCGeneratorModal'))
const MobCalculatorModal = lazy(() => import('./modals/MobCalculatorModal'))
const GroupRollModal = lazy(() => import('./modals/GroupRollModal'))
const StudyActionModal = lazy(() => import('./modals/StudyActionModal'))
const ShortcutReferenceModal = lazy(() => import('./modals/ShortcutReferenceModal'))
const DowntimeModal = lazy(() => import('./modals/DowntimeModal'))
const DisputeModal = lazy(() => import('./modals/DisputeModal'))
const RulingApprovalModal = lazy(() => import('./modals/RulingApprovalModal'))
const DMShopModal = lazy(() => import('./modals/DMShopModal'))
const SpellReferenceModal = lazy(() => import('./modals/SpellReferenceModal'))
const InGameCalendarModal = lazy(() => import('./modals/InGameCalendarModal'))
const TokenEditorModal = lazy(() => import('./modals/TokenEditorModal'))
const GridSettingsModal = lazy(() => import('./modals/GridSettingsModal'))
const HandoutModal = lazy(() => import('./modals/HandoutModal'))
const HandoutViewerModal = lazy(() => import('./modals/HandoutViewerModal'))
const NarrationOverlay = lazy(() => import('./overlays/NarrationOverlay'))

import { createCompanionToken } from '../../services/companion-service'
import { load5eMonsterById } from '../../services/data-provider'
import { flushAutoSave, loadPersistedGameState, startAutoSave, stopAutoSave } from '../../services/game-auto-save'
import { saveGameState } from '../../services/game-state-saver'
import { startGameSync, stopGameSync } from '../../services/game-sync'
import { useCharacterStore } from '../../stores/useCharacterStore'
import { is5eCharacter } from '../../types/character'
import type { Companion5e } from '../../types/companion'
import type { MonsterStatBlock } from '../../types/monster'
import { formatInGameTime } from '../../utils/calendar-utils'
import { getBuilderCreatePath } from '../../utils/character-routes'
import type { AoEConfig } from './AoEOverlay'
import { DiceOverlay, trigger3dDice } from './dice3d'
import DiceTray from './dice3d/DiceTray'
import ResizeHandle from './shared/ResizeHandle'

interface GameLayoutProps {
  campaign: Campaign
  isDM: boolean
  character: Character | null
  playerName: string
}

type ActiveModal =
  | 'action'
  | 'item'
  | 'hiddenDice'
  | 'whisper'
  | 'quickCondition'
  | 'timer'
  | 'initiative'
  | 'notes'
  | 'attack'
  | 'help'
  | 'jump'
  | 'falling'
  | 'influence'
  | 'aoe'
  | 'travelPace'
  | 'mount'
  | 'creatures'
  | 'familiar'
  | 'wildShape'
  | 'steed'
  | 'summonCreature'
  | 'timeEdit'
  | 'lightSource'
  | 'shortRest'
  | 'longRest'
  | 'dmRoller'
  | 'commandRef'
  | 'customEffect'
  | 'encounterBuilder'
  | 'treasureGenerator'
  | 'chaseTracker'
  | 'mobCalculator'
  | 'groupRoll'
  | 'study'
  | 'shortcutRef'
  | 'dispute'
  | 'downtime'
  | 'shop'
  | 'spellRef'
  | 'calendar'
  | 'gridSettings'
  | 'tokenEditor'
  | 'handout'
  | 'handoutViewer'
  | 'npcGenerator'
  | null

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

  // Resizable panel dimensions (persisted to localStorage)
  const [bottomBarHeight, setBottomBarHeight] = useState(() => {
    try { return parseInt(localStorage.getItem('dnd-vtt-bottom-bar-height') || '320', 10) } catch { return 320 }
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('dnd-vtt-sidebar-width') || '280', 10) } catch { return 280 }
  })
  const prevBottomHeight = useRef(320)
  const prevSidebarWidth = useRef(280)
  const [teleportMove, setTeleportMove] = useState(false)
  const [activeAoE, setActiveAoE] = useState<AoEConfig | null>(null)
  const [viewMode, setViewMode] = useState<'dm' | 'player'>('dm')
  const [showCharacterPicker, setShowCharacterPicker] = useState(false)
  const [activeTool, setActiveTool] = useState<'select' | 'fog-reveal' | 'fog-hide' | 'wall'>('select')
  const [fogBrushSize, setFogBrushSize] = useState(1)
  const [wallType, setWallType] = useState<'solid' | 'door' | 'window'>('solid')
  const [timeRequestToast, setTimeRequestToast] = useState<{ requesterId: string; requesterName: string } | null>(null)
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

  const gameStore = useGameStore()
  const networkRole = useNetworkStore((s) => s.role)
  const sendMessage = useNetworkStore((s) => s.sendMessage)
  const addChatMessage = useLobbyStore((s) => s.addChatMessage)
  const aiDmStore = useAiDmStore()
  const aiInitRef = useRef(false)

  const allCharacters = useCharacterStore((s) => s.characters)
  // Resize handlers
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

  const handleViewModeToggle = (): void => {
    if (viewMode === 'player') {
      setViewMode('dm')
      return
    }
    // Always show character picker so DM can choose/switch characters
    setShowCharacterPicker(true)
  }

  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId) ?? null

  // Player conditions
  const playerConditions = character ? gameStore.conditions.filter((c) => c.entityId === character.id) : []

  // Is it the current player's turn?
  const isMyTurn = (() => {
    if (!gameStore.initiative || !character) return false
    const current = gameStore.initiative.entries[gameStore.initiative.currentIndex]
    return current?.entityId === character.id
  })()

  // Add "Game session started" message on mount (once)
  useEffect(() => {
    addChatMessage({
      id: 'system-game-start',
      senderId: 'system',
      senderName: 'System',
      content: `Game session started for "${campaign.name}"`,
      timestamp: Date.now(),
      isSystem: true
    })
    initSounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addChatMessage, campaign.name])

  // Host: broadcast game state changes to connected clients
  useEffect(() => {
    if (!isDM) return
    startGameSync(sendMessage)
    return () => stopGameSync()
  }, [isDM, sendMessage])

  // DM: auto-save game state with debouncing + load persisted state on mount
  useEffect(() => {
    if (!isDM) return
    loadPersistedGameState(campaign.id)
    startAutoSave(campaign.id)
    return () => stopAutoSave()
  }, [isDM, campaign.id])

  // AI DM initialization (host only)
  useEffect(() => {
    if (!isDM || !campaign.aiDm?.enabled || aiInitRef.current) return
    aiInitRef.current = true

    // Set up stream listeners
    const cleanup = aiDmStore.setupListeners()

    // Initialize AI DM (preserves sceneStatus if already set from lobby)
    aiDmStore.initFromCampaign(campaign)

    // Check if scene was already pre-generated in lobby
    const checkAndSetScene = async (): Promise<void> => {
      const status = await window.api.ai.getSceneStatus(campaign.id)

      if (status.status === 'ready') {
        // Scene already generated — conversation was loaded by initFromCampaign
        // If messages aren't loaded yet (race condition), wait and reload
        const currentMessages = useAiDmStore.getState().messages
        if (currentMessages.length === 0) {
          setTimeout(async () => {
            const msgs = useAiDmStore.getState().messages
            if (msgs.length === 0) {
              // Force reload from disk
              const result = await window.api.ai.loadConversation(campaign.id)
              if (result.success && result.data) {
                const data = result.data as { messages?: Array<{ role: string; content: string; timestamp?: string }> }
                if (data.messages?.length) {
                  useAiDmStore.setState({
                    messages: data.messages.map((m) => ({
                      role: m.role as 'user' | 'assistant',
                      content: m.content,
                      timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now()
                    })),
                    sceneStatus: 'ready'
                  })
                }
              }
            }
          }, 500)
        }
        return // Don't call setScene
      }

      if (status.status === 'preparing') {
        // Scene still streaming — poll until ready, then load conversation
        const poll = setInterval(async () => {
          const s = await window.api.ai.getSceneStatus(campaign.id)
          if (s.status === 'ready') {
            clearInterval(poll)
            const result = await window.api.ai.loadConversation(campaign.id)
            if (result.success && result.data) {
              const data = result.data as { messages?: Array<{ role: string; content: string; timestamp?: string }> }
              if (data.messages?.length) {
                useAiDmStore.setState({
                  messages: data.messages.map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now()
                  })),
                  sceneStatus: 'ready',
                  isTyping: false
                })
              }
            }
          }
        }, 1000)
        // Safety: stop polling after 60s
        setTimeout(() => clearInterval(poll), 60000)
        return
      }

      // Fallback: no scene prep happened — use original behavior
      const players = useLobbyStore.getState().players
      const characterIds = players.filter((p) => p.characterId).map((p) => p.characterId!)

      if (characterIds.length > 0) {
        setTimeout(() => {
          useAiDmStore.getState().setScene(campaign.id, characterIds)
        }, 1500)
      }
    }

    checkAndSetScene()

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDM,
    campaign.id, // Initialize AI DM (preserves sceneStatus if already set from lobby)
    aiDmStore.initFromCampaign,
    aiDmStore.setupListeners,
    campaign
  ])

  // When AI DM finishes streaming, add the message to chat and broadcast
  useEffect(() => {
    if (!isDM || !campaign.aiDm?.enabled) return

    const messages = aiDmStore.messages
    if (messages.length === 0) return

    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role !== 'assistant') return

    // Check if we already posted this (use timestamp as dedup key)
    const chatMessages = useLobbyStore.getState().chatMessages
    const alreadyPosted = chatMessages.some((cm) => cm.senderId === 'ai-dm' && cm.timestamp === lastMsg.timestamp)
    if (alreadyPosted) return

    // Add to chat
    addChatMessage({
      id: `ai-dm-${lastMsg.timestamp}`,
      senderId: 'ai-dm',
      senderName: 'Dungeon Master',
      content: lastMsg.content,
      timestamp: lastMsg.timestamp,
      isSystem: true
    })

    // Broadcast to clients
    sendMessage('chat:message', {
      message: lastMsg.content,
      isSystem: true
    })

    // Apply stat changes if any
    if (lastMsg.statChanges && lastMsg.statChanges.length > 0) {
      const creatureChanges = lastMsg.statChanges.filter((c: { type: string }) => c.type.startsWith('creature_'))
      const characterChanges = lastMsg.statChanges.filter((c: { type: string }) => !c.type.startsWith('creature_'))

      // Apply character changes via IPC
      if (characterChanges.length > 0) {
        const players = useLobbyStore.getState().players
        const charIds = players.filter((p) => p.characterId).map((p) => p.characterId!)
        if (charIds.length > 0) {
          window.api.ai.applyMutations(charIds[0], characterChanges)
        }
      }

      // Apply creature changes directly to map tokens
      if (creatureChanges.length > 0 && activeMap) {
        import('../../utils/creature-mutations').then(({ applyCreatureMutations }) => {
          applyCreatureMutations(
            creatureChanges,
            activeMap,
            (mapId: string, tokenId: string, updates: Partial<import('../../types/map').MapToken>) => {
              gameStore.updateToken(mapId, tokenId, updates)
            }
          )
        })
      }
    }

    // Execute DM actions if any
    if (lastMsg.dmActions && lastMsg.dmActions.length > 0) {
      import('../../services/dm-action-executor').then(({ executeDmActions }) => {
        const result = executeDmActions(lastMsg.dmActions!)
        for (const f of result.failed) {
          addChatMessage({
            id: `ai-err-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            senderId: 'system',
            senderName: 'System',
            content: `AI DM action failed: ${f.action.action} \u2014 ${f.reason}`,
            timestamp: Date.now(),
            isSystem: true
          })
        }
      })
    }

    // Save conversation (debounced)
    window.api.ai.saveConversation(campaign.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aiDmStore.messages.length, // Add to chat
    addChatMessage,
    aiDmStore.messages,
    activeMap,
    campaign.aiDm?.enabled,
    campaign.id,
    gameStore.updateToken,
    isDM, // Broadcast to clients
    sendMessage
  ])

  // Broadcast AI typing status
  useEffect(() => {
    if (!isDM || !campaign.aiDm?.enabled) return
    sendMessage('ai:typing', { isTyping: aiDmStore.isTyping })
  }, [aiDmStore.isTyping, isDM, campaign.aiDm?.enabled, sendMessage])

  // Network message listeners
  useEffect(() => {
    if (networkRole === 'none') return

    const handler = (msg: { type: string; payload?: unknown; senderId?: string; senderName?: string }): void => {
      const gs = useGameStore.getState()
      if (msg.type === 'dm:shop-update') {
        const payload = msg.payload as ShopUpdatePayload
        if (payload.shopInventory.length > 0) {
          gs.openShop(payload.shopName || 'Shop')
          gs.setShopInventory(payload.shopInventory)
        } else {
          gs.closeShop()
        }
      }
      if (msg.type === 'dm:timer-start') {
        const payload = msg.payload as TimerStartPayload
        gs.startTimer(payload.seconds, payload.targetName)
      }
      if (msg.type === 'dm:timer-stop') {
        gs.stopTimer()
      }
      if (msg.type === 'dm:play-sound') {
        const payload = msg.payload as PlaySoundPayload
        playSound(payload.event as SoundEvent)
      }
      if (msg.type === 'dm:play-ambient') {
        const payload = msg.payload as PlayAmbientPayload
        if (payload.volume !== undefined) setAmbientVolume(payload.volume)
        playAmbient(payload.ambient as AmbientSound)
      }
      if (msg.type === 'dm:stop-ambient') {
        stopAmbient()
      }
      if (msg.type === 'game:dice-result') {
        const payload = msg.payload as { formula: string; rolls: number[]; total: number; rollerName: string }
        // Trigger 3D dice animation for remote players' rolls
        trigger3dDice({
          formula: payload.formula,
          rolls: payload.rolls,
          total: payload.total,
          rollerName: payload.rollerName
        })
      }
      if (msg.type === 'chat:message') {
        const payload = msg.payload as ChatPayload
        addChatMessage({
          id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: msg.senderId || 'unknown',
          senderName: msg.senderName || 'Unknown',
          content: payload.message,
          timestamp: Date.now(),
          isSystem: payload.isSystem ?? false,
          isDiceRoll: payload.isDiceRoll ?? false,
          diceResult: payload.diceResult
        })

        // Route player messages to AI DM (host only, non-system, non-host messages)
        if (
          networkRole === 'host' &&
          campaign.aiDm?.enabled &&
          !aiDmStore.paused &&
          !payload.isSystem &&
          msg.senderId !== 'system' &&
          msg.senderId !== 'ai-dm' &&
          !payload.message.startsWith('/')
        ) {
          const players = useLobbyStore.getState().players
          const charIds = players.filter((p) => p.characterId).map((p) => p.characterId!)
          // Build game state snapshot + active creatures for AI context
          import('../../services/dm-action-executor').then(({ buildGameStateSnapshot }) => {
            const gameState = buildGameStateSnapshot()
            const currentMap = useGameStore.getState().maps.find((m) => m.id === useGameStore.getState().activeMapId)
            const activeCreatures =
              currentMap?.tokens
                .filter((t) => t.entityType === 'enemy' || t.entityType === 'npc')
                .filter((t) => t.currentHP != null)
                .map((t) => ({
                  label: t.label,
                  currentHP: t.currentHP!,
                  maxHP: t.maxHP!,
                  ac: t.ac ?? 10,
                  conditions: t.conditions,
                  monsterStatBlockId: t.monsterStatBlockId
                })) ?? []
            aiDmStore.sendMessage(
              campaign.id,
              payload.message,
              charIds,
              msg.senderName,
              activeCreatures.length > 0 ? activeCreatures : undefined,
              gameState
            )
          })
        }
      }
      if (msg.type === 'dm:whisper-player') {
        const payload = msg.payload as WhisperPlayerPayload
        addChatMessage({
          id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: msg.senderId || 'dm',
          senderName: 'DM (Whisper)',
          content: payload.message,
          timestamp: Date.now(),
          isSystem: false
        })
      }
      // Time system messages
      if (msg.type === 'player:time-request') {
        const payload = msg.payload as TimeRequestPayload
        // Only DM (host) handles time requests
        if (networkRole === 'host') {
          if (campaign.aiDm?.enabled && !useAiDmStore.getState().paused) {
            // Route to AI DM
            const players = useLobbyStore.getState().players
            const charIds = players.filter((p) => p.characterId).map((p) => p.characterId!)
            aiDmStore.sendMessage(
              campaign.id,
              `${payload.requesterName} asks: What time is it?`,
              charIds,
              payload.requesterName
            )
          } else {
            setTimeRequestToast({ requesterId: payload.requesterId, requesterName: payload.requesterName })
          }
        }
      }
      if (msg.type === 'dm:time-share') {
        const payload = msg.payload as TimeSharePayload
        addChatMessage({
          id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'system',
          senderName: 'System',
          content: `Current time: ${payload.formattedTime}`,
          timestamp: Date.now(),
          isSystem: true
        })
      }
      if (msg.type === 'dm:time-sync') {
        const payload = msg.payload as TimeSyncPayload
        useGameStore.getState().setInGameTime({ totalSeconds: payload.totalSeconds })
      }
      if (msg.type === 'dm:narration') {
        const payload = msg.payload as NarrationPayload
        if (payload.style === 'dramatic') {
          setNarrationText(payload.text)
        } else {
          // 'chat' style — add as a styled chat message
          addChatMessage({
            id: `narration-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            senderId: msg.senderId || 'dm',
            senderName: 'DM (Narration)',
            content: payload.text,
            timestamp: Date.now(),
            isSystem: false
          })
        }
      }
    }

    if (networkRole === 'client') {
      return onClientMessage(handler)
    } else if (networkRole === 'host') {
      return onHostMessage(handler)
    }
  }, [
    networkRole,
    addChatMessage,
    aiDmStore.paused,
    aiDmStore.sendMessage,
    campaign.aiDm?.enabled,
    campaign.id
  ])

  // Auto-populate sidebar allies from connected players
  useEffect(() => {
    const players = useLobbyStore.getState().players
    players.forEach((player) => {
      if (player.isHost) return
      const existing = gameStore.allies.find((a) => a.sourceId === player.peerId)
      if (!existing) {
        gameStore.addSidebarEntry('allies', {
          id: crypto.randomUUID(),
          name: player.characterName || player.displayName,
          description: player.characterName ? `Player: ${player.displayName}` : undefined,
          visibleToPlayers: true,
          isAutoPopulated: true,
          sourceId: player.peerId
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStore.addSidebarEntry, gameStore.allies.find])

  // Fullscreen toggle
  const handleToggleFullscreen = (): void => {
    window.api.toggleFullscreen().then((fs) => setIsFullscreen(fs))
  }

  // Check initial fullscreen state + listen for F11
  useEffect(() => {
    window.api.isFullscreen().then((fs) => setIsFullscreen(fs))

    const handleF11 = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        window.api.toggleFullscreen().then((fs) => setIsFullscreen(fs))
      }
    }
    window.addEventListener('keydown', handleF11)
    return () => window.removeEventListener('keydown', handleF11)
  }, [])

  // Leave game: save state (DM), clear state, then navigate
  const handleReadAloud = useCallback(
    (text: string, style: 'chat' | 'dramatic') => {
      if (style === 'dramatic') {
        // Send to all players via network, and show locally
        sendMessage('dm:narration', { text, style })
        setNarrationText(text)
      } else {
        // Send as chat narration message
        const chatMsg = {
          id: `narration-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'dm',
          senderName: 'DM (Narration)',
          content: text,
          timestamp: Date.now(),
          isSystem: false
        }
        addChatMessage(chatMsg)
        sendMessage('chat:message', { message: text, isSystem: false })
      }
    },
    [sendMessage, addChatMessage]
  )

  const handleLeaveGame = async (destination: string): Promise<void> => {
    setLeaving(true)
    if (isDM) {
      try {
        await saveGameState(campaign)
        await flushAutoSave(campaign.id)
      } catch (err) {
        console.error('[GameLayout] Save on leave failed:', err)
      }
    }
    useAiDmStore.getState().reset()
    useNetworkStore.getState().disconnect()
    useLobbyStore.getState().reset()
    gameStore.reset()
    // Let React render the leaving spinner before navigating
    setTimeout(() => {
      try {
        navigate(destination)
      } catch (err) {
        console.error('[GameLayout] Navigation failed:', err)
        window.location.reload()
      }
    }, 0)
  }

  const handleSaveCampaign = async (): Promise<void> => {
    await saveGameState(campaign)
  }

  const handleEndSession = (): void => {
    sendMessage('dm:game-end', {})
    handleLeaveGame('/')
  }

  // --- Rest handlers ---
  // Get campaign character IDs for the rest modal
  const getCampaignCharacterIds = (): string[] => {
    const ids: string[] = []
    const allChars = useCharacterStore.getState().characters
    for (const c of allChars) {
      if (c.campaignId === campaign.id) ids.push(c.id)
    }
    const remotes = useLobbyStore.getState().remoteCharacters
    for (const id of Object.keys(remotes)) {
      if (!ids.includes(id)) ids.push(id)
    }
    return ids
  }

  const handleShortRest = (): void => {
    setActiveModal('shortRest')
  }

  const handleLongRest = (): void => {
    // Check 24-hour rule
    const rt = gameStore.restTracking
    const currentTime = gameStore.inGameTime?.totalSeconds ?? 0
    if (rt?.lastLongRestSeconds != null && currentTime - rt.lastLongRestSeconds < 86400) {
      setLongRestWarning(true)
      return
    }
    setActiveModal('longRest')
  }

  const executeLongRest = (): void => {
    setLongRestWarning(false)
    setActiveModal('longRest')
  }

  const handleRestApply = (restType: 'shortRest' | 'longRest', restoredIds: string[]): void => {
    const duration = restType === 'shortRest' ? 3600 : 28800
    const label = restType === 'shortRest' ? 'Short Rest (1 hour)' : 'Long Rest (8 hours)'

    gameStore.advanceTimeSeconds(duration)
    if (restType === 'shortRest') {
      gameStore.setRestTracking({
        lastLongRestSeconds: gameStore.restTracking?.lastLongRestSeconds ?? null,
        lastShortRestSeconds: gameStore.inGameTime?.totalSeconds ?? null
      })
    } else {
      gameStore.setRestTracking({
        lastLongRestSeconds: gameStore.inGameTime?.totalSeconds ?? null,
        lastShortRestSeconds: gameStore.restTracking?.lastShortRestSeconds ?? null
      })
    }

    const msg = `The party takes a ${label}. ${restoredIds.length} character(s) restored.`
    gameStore.addLogEntry(msg)
    addChatMessage({
      id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      senderId: 'system',
      senderName: 'System',
      content: msg,
      timestamp: Date.now(),
      isSystem: true
    })
    sendMessage('chat:message', { message: msg, isSystem: true })
    sendMessage('dm:time-sync', { totalSeconds: gameStore.inGameTime?.totalSeconds ?? 0 })

    // Check expired light sources
    const expired = gameStore.checkExpiredSources()
    for (const ls of expired) {
      const lsMsg = `${ls.entityName}'s ${ls.sourceName} goes out.`
      addChatMessage({
        id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'system',
        senderName: 'System',
        content: lsMsg,
        timestamp: Date.now(),
        isSystem: true
      })
    }
  }

  // Handle fog cell click from map canvas
  const handleCellClick = (gridX: number, gridY: number): void => {
    if (!activeMap) return
    if (activeTool === 'fog-reveal' || activeTool === 'fog-hide') {
      const halfBrush = Math.floor(fogBrushSize / 2)
      const cells: Array<{ x: number; y: number }> = []
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
          const cx = gridX + dx
          const cy = gridY + dy
          if (cx >= 0 && cy >= 0) {
            cells.push({ x: cx, y: cy })
          }
        }
      }
      if (activeTool === 'fog-reveal') {
        gameStore.revealFog(activeMap.id, cells)
      } else {
        gameStore.hideFog(activeMap.id, cells)
      }
    }
  }

  // Handle action from ActionModal
  const handleAction = (action: string): void => {
    // Special handling for combat actions
    if (action === 'attack') {
      setActiveModal('attack')
      return
    }

    // Help action: open Help modal with 3 options (Stabilize, Assist Check, Assist Attack)
    if (action === 'help') {
      setActiveModal('help')
      return
    }

    // Influence action: open structured modal
    if (action === 'influence') {
      setActiveModal('influence')
      return
    }

    if (action === 'mount') {
      setActiveModal('mount')
      return
    }

    // Turn state effects
    if (character && gameStore.initiative) {
      const entityId = character.id
      switch (action) {
        case 'dash':
          gameStore.setDashing(entityId)
          break
        case 'disengage':
          gameStore.setDisengaging(entityId)
          break
        case 'dodge':
          gameStore.setDodging(entityId)
          break
        case 'hide':
          gameStore.useAction(entityId)
          gameStore.setHidden(entityId, true)
          break
        default:
          gameStore.useAction(entityId)
          break
      }
    }

    addChatMessage({
      id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      senderId: 'system',
      senderName: 'System',
      content: `${playerName} uses ${action.replace(/-/g, ' ')}`,
      timestamp: Date.now(),
      isSystem: true
    })
    sendMessage('chat:message', {
      message: `${playerName} uses ${action.replace(/-/g, ' ')}`,
      isSystem: true
    })
  }

  // Opportunity attack state
  const [oaPrompt, setOaPrompt] = useState<{
    movingTokenLabel: string
    enemyTokenId: string
    enemyTokenLabel: string
    entityId: string
  } | null>(null)

  // Stabilize check state (B3)
  const [stabilizePrompt, setStabilizePrompt] = useState<{
    entityId: string
    entityName: string
    healerName: string
    medicineMod: number
  } | null>(null)

  // Concentration check state
  const [concCheckPrompt, setConcCheckPrompt] = useState<{
    entityId: string
    entityName: string
    spellName: string
    dc: number
    damage: number
  } | null>(null)

  // Handle token move with OA detection
  const handleTokenMoveWithOA = (tokenId: string, gridX: number, gridY: number): void => {
    if (!activeMap) return

    const movingToken = activeMap.tokens.find((t) => t.id === tokenId)
    if (!movingToken) {
      gameStore.moveToken(activeMap.id, tokenId, gridX, gridY)
      return
    }

    // Check if in initiative mode and the moving token is NOT disengaging
    const ts = gameStore.turnStates[movingToken.entityId]
    const isDisengaging = ts?.isDisengaging ?? false
    const moveType: MovementType = teleportMove ? 'teleport' : 'walk'

    // Frightened: cannot move closer to fear source
    if (moveType === 'walk') {
      const entityConditions = gameStore.conditions.filter(
        (c) => c.entityId === movingToken.entityId && c.condition === 'Frightened'
      )
      for (const fc of entityConditions) {
        if (fc.sourceEntityId) {
          // Find the source entity's token
          const sourceToken = activeMap.tokens.find((t) => t.entityId === fc.sourceEntityId)
          if (
            sourceToken &&
            isMoveBlockedByFear(
              movingToken.gridX,
              movingToken.gridY,
              gridX,
              gridY,
              sourceToken.gridX,
              sourceToken.gridY
            )
          ) {
            addChatMessage({
              id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
              senderId: 'system',
              senderName: 'System',
              content: `${movingToken.label} is Frightened and cannot move closer to ${sourceToken.label}!`,
              timestamp: Date.now(),
              isSystem: true
            })
            return // Block the move
          }
        }
      }
    }

    if (gameStore.initiative && !isDisengaging) {
      // Check each enemy token for opportunity attack triggers
      const enemies = activeMap.tokens.filter(
        (t) => t.id !== tokenId && t.entityType !== movingToken.entityType // Different faction
      )

      for (const enemy of enemies) {
        if (triggersOpportunityAttack(movingToken, enemy, gridX, gridY, moveType)) {
          // Check if enemy has reaction available
          const enemyTs = gameStore.turnStates[enemy.entityId]
          if (!enemyTs || !enemyTs.reactionUsed) {
            // Show OA prompt (for DM to decide)
            setOaPrompt({
              movingTokenLabel: movingToken.label,
              enemyTokenId: enemy.id,
              enemyTokenLabel: enemy.label,
              entityId: enemy.entityId
            })
          }
          break // Only prompt for first OA
        }
      }
    }

    // Deduct movement from turn state (skip for teleportation)
    if (ts && moveType !== 'teleport') {
      // Prone stand-up cost: first move while prone costs half max speed
      const isProne = movingToken.conditions.some((c) => c.toLowerCase() === 'prone')
      if (isProne && ts.movementRemaining === ts.movementMax) {
        const standCost = proneStandUpCost(ts.movementMax)
        gameStore.useMovement(movingToken.entityId, standCost)
        // Remove prone condition from the token
        const updatedConditions = movingToken.conditions.filter((c) => c.toLowerCase() !== 'prone')
        gameStore.updateToken(activeMap.id, tokenId, { conditions: updatedConditions })
        addChatMessage({
          id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'system',
          senderName: 'System',
          content: `${movingToken.label} stands up from Prone (costs ${standCost} ft of movement)`,
          timestamp: Date.now(),
          isSystem: true
        })
      }

      const dx = Math.abs(gridX - movingToken.gridX)
      const dy = Math.abs(gridY - movingToken.gridY)
      const dist = Math.max(dx, dy) * 5

      // Check terrain for movement cost
      const terrain = activeMap.terrain ?? []
      const destTerrain = terrain.find((t) => t.x === gridX && t.y === gridY)
      const actualCost = destTerrain ? dist * destTerrain.movementCost : dist
      gameStore.useMovement(movingToken.entityId, actualCost)
    }

    gameStore.moveToken(activeMap.id, tokenId, gridX, gridY)

    // Mount/rider sync: if moving a mount, move the rider too (and vice versa)
    if (activeMap) {
      const movedToken = activeMap.tokens.find((t) => t.id === tokenId)
      if (movedToken?.riderId) {
        // Moving a mount - find and move the rider token
        const riderToken = activeMap.tokens.find((t) => t.entityId === movedToken.riderId)
        if (riderToken) {
          gameStore.moveToken(activeMap.id, riderToken.id, gridX, gridY)
        }
      }
      // Check if the moving entity IS a rider on a mount
      const entityTs = gameStore.turnStates[movedToken?.entityId ?? '']
      if (entityTs?.mountedOn) {
        const mountTk = activeMap.tokens.find((t) => t.id === entityTs.mountedOn)
        if (mountTk) {
          gameStore.moveToken(activeMap.id, mountTk.id, gridX, gridY)
        }
      }
    }
  }

  // --- Concentration cascade: remove summoned creature tokens when caster loses concentration ---
  const handleConcentrationLost = (casterId: string): void => {
    if (!activeMap) return
    const tokensToRemove = activeMap.tokens.filter(
      (t) => t.companionType === 'summoned' && t.ownerEntityId === casterId
    )
    for (const token of tokensToRemove) {
      gameStore.removeToken(activeMap.id, token.id)
      // Remove from initiative if present
      const initState = gameStore.initiative
      if (initState) {
        const entry = initState.entries.find((e) => e.entityId === token.id)
        if (entry) {
          gameStore.removeFromInitiative(entry.id)
        }
      }
    }
    if (tokensToRemove.length > 0) {
      addChatMessage({
        id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'system',
        senderName: 'System',
        content: `Concentration lost! ${tokensToRemove.map((t) => t.label).join(', ')} disappeared.`,
        timestamp: Date.now(),
        isSystem: true
      })
    }
  }

  // DM shop open
  // --- Companion handlers ---
  const handleCompanionSummon = async (companion: Omit<Companion5e, 'id' | 'tokenId' | 'createdAt'>): Promise<void> => {
    if (!character || !is5eCharacter(character) || !activeMap) return
    const newCompanion: Companion5e = {
      ...companion,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    // Save to character
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (latest && is5eCharacter(latest)) {
      const updated = {
        ...latest,
        companions: [...(latest.companions ?? []), newCompanion],
        updatedAt: new Date().toISOString()
      }
      useCharacterStore.getState().saveCharacter(updated)
    }
    // Place token on map
    const statBlock = await load5eMonsterById(companion.monsterStatBlockId)
    if (statBlock) {
      const charToken = activeMap.tokens.find((t) => t.entityId === character.id)
      const gx = charToken ? charToken.gridX + charToken.sizeX : 0
      const gy = charToken ? charToken.gridY : 0
      const tokenData = createCompanionToken(newCompanion, statBlock, gx, gy)
      const tokenId = crypto.randomUUID()
      gameStore.addToken(activeMap.id, { ...tokenData, id: tokenId })

      // Add to initiative if combat is active
      const initiative = gameStore.initiative
      if (initiative) {
        const dexMod = Math.floor((statBlock.abilityScores.dex - 10) / 2)
        if (companion.type === 'steed' || companion.type === 'summoned') {
          // Steeds/summoned act on owner's initiative
          const ownerEntry = initiative.entries.find((e) => e.entityId === character.id)
          const ownerTotal = ownerEntry ? ownerEntry.total : 10
          gameStore.addToInitiative({
            id: tokenId,
            entityId: tokenId,
            entityName: companion.name,
            entityType: 'npc',
            roll: ownerTotal - dexMod,
            modifier: dexMod,
            total: ownerTotal,
            isActive: false
          })
        } else {
          // Familiars roll their own initiative
          const roll = Math.floor(Math.random() * 20) + 1
          gameStore.addToInitiative({
            id: tokenId,
            entityId: tokenId,
            entityName: companion.name,
            entityType: 'npc',
            roll,
            modifier: dexMod,
            total: roll + dexMod,
            isActive: false
          })
        }
        gameStore.initTurnState(tokenId, statBlock.speed.walk ?? 0)
      }
    }
  }

  const handleWildShapeTransform = (monster: MonsterStatBlock): void => {
    if (!character || !is5eCharacter(character) || !activeMap) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || !is5eCharacter(latest)) return
    // Deduct wild shape use
    const uses = latest.wildShapeUses
    if (!uses || uses.current <= 0) return
    const updated = {
      ...latest,
      wildShapeUses: { ...uses, current: uses.current - 1 },
      activeWildShapeFormId: monster.id,
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    // Update character token with beast stats
    const charToken = activeMap.tokens.find((t) => t.entityId === character.id)
    if (charToken) {
      gameStore.updateToken(activeMap.id, charToken.id, {
        currentHP: monster.hp,
        maxHP: monster.hp,
        ac: monster.ac,
        walkSpeed: monster.speed.walk ?? 0,
        swimSpeed: monster.speed.swim,
        climbSpeed: monster.speed.climb,
        flySpeed: monster.speed.fly
      })
    }
  }

  const handleWildShapeRevert = (): void => {
    if (!character || !is5eCharacter(character) || !activeMap) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || !is5eCharacter(latest)) return
    const updated = {
      ...latest,
      activeWildShapeFormId: undefined,
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
    // Restore character token stats
    const charToken = activeMap.tokens.find((t) => t.entityId === character.id)
    if (charToken) {
      gameStore.updateToken(activeMap.id, charToken.id, {
        currentHP: latest.hitPoints.current,
        maxHP: latest.hitPoints.maximum,
        ac: undefined, // will be recomputed
        walkSpeed: undefined,
        swimSpeed: undefined,
        climbSpeed: undefined,
        flySpeed: undefined
      })
    }
  }

  const handleWildShapeUseAdjust = (delta: number): void => {
    if (!character || !is5eCharacter(character)) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest || !is5eCharacter(latest)) return
    const uses = latest.wildShapeUses
    if (!uses) return
    const newCurrent = Math.max(0, Math.min(uses.max, uses.current + delta))
    const updated = {
      ...latest,
      wildShapeUses: { ...uses, current: newCurrent },
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)
  }

  const handleOpenShop = (): void => {
    setActiveModal('shop')
  }

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
      {/* Map layer: fills entire viewport */}
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
            if (wall?.type === 'door') {
              gameStore.updateWallSegment(activeMap.id, wallId, { isOpen: !wall.isOpen })
            }
          }}
          activeAoE={activeAoE}
          activeEntityId={gameStore.initiative?.entries[gameStore.initiative.currentIndex]?.entityId ?? null}
          onTokenContextMenu={(x, y, token, mapId) => {
            setContextMenu({ x, y, token, mapId })
          }}
        />

        {/* Lighting overlay */}
        {gameStore.ambientLight === 'dim' && (
          <div className="absolute inset-0 bg-amber-900/20 pointer-events-none z-[1]" />
        )}
        {gameStore.ambientLight === 'darkness' && (
          <div className="absolute inset-0 bg-gray-950/60 pointer-events-none z-[1]" />
        )}
        {gameStore.underwaterCombat && <div className="absolute inset-0 bg-blue-900/15 pointer-events-none z-[1]" />}

        {/* 3D Dice overlay */}
        <DiceOverlay />

        {/* Floating dice tray */}
        <DiceTray />
      </div>

      {/* Left sidebar overlay */}
      <div className="absolute top-0 left-0 bottom-0 z-10 flex">
        <div style={{ width: sidebarCollapsed ? 48 : sidebarWidth }} className="h-full shrink-0 transition-[width] duration-200">
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

      {/* Bottom bar overlay */}
      <div
        className="absolute bottom-0 right-0 z-10 flex flex-col"
        style={{
          left: sidebarLeftPx,
          height: bottomCollapsed ? 40 : bottomBarHeight
        }}
      >
        {!bottomCollapsed && (
          <ResizeHandle
            direction="vertical"
            onResize={handleBottomResize}
            onDoubleClick={handleBottomDoubleClick}
          />
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

      {/* Floating overlays (inside map area, above sidebar/bottom) */}
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
              if (effectiveIsDM) {
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
                    if (changed) charStore.updateCharacter(ch.id, { equipment: items5e } as Partial<import('../../types/character-5e').Character5e>)
                  }
                }
              }
            }}
          />
        )}
        {effectiveIsDM && <DmAlertTray />}
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
      {/* Token right-click context menu */}
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
          <NarrationOverlay
            text={narrationText}
            onDismiss={() => setNarrationText(null)}
          />
        </Suspense>
      )}
      

      {/* Fog toolbar (DM only, shows when fog tool active) */}
      {effectiveIsDM && (activeTool === 'fog-reveal' || activeTool === 'fog-hide') && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl px-3 py-2">
          <button
            onClick={() => setActiveTool('fog-reveal')}
            className={`px-2 py-1 text-xs rounded-lg cursor-pointer ${activeTool === 'fog-reveal' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            Reveal
          </button>
          <button
            onClick={() => setActiveTool('fog-hide')}
            className={`px-2 py-1 text-xs rounded-lg cursor-pointer ${activeTool === 'fog-hide' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            Hide
          </button>
          <div className="border-l border-gray-700 h-5 mx-1" />
          <span className="text-[10px] text-gray-400">Brush:</span>
          {[1, 2, 3, 5].map((size) => (
            <button
              key={size}
              onClick={() => setFogBrushSize(size)}
              className={`w-6 h-6 text-[10px] rounded cursor-pointer ${fogBrushSize === size ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {size}
            </button>
          ))}
          <div className="border-l border-gray-700 h-5 mx-1" />
          <button
            onClick={() => setActiveTool('select')}
            className="px-2 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* Wall toolbar (DM only, shows when wall tool active) */}
      {effectiveIsDM && activeTool === 'wall' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl px-3 py-2">
          {(['solid', 'door', 'window'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setWallType(type)}
              className={`px-2 py-1 text-xs rounded-lg cursor-pointer capitalize ${
                wallType === type
                  ? type === 'solid'
                    ? 'bg-blue-600 text-white'
                    : type === 'door'
                      ? 'bg-amber-600 text-white'
                      : 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {type}
            </button>
          ))}
          <div className="border-l border-gray-700 h-5 mx-1" />
          <span className="text-[10px] text-gray-400">Click grid intersections to place walls</span>
          <div className="border-l border-gray-700 h-5 mx-1" />
          <button
            onClick={() => setActiveTool('select')}
            className="px-2 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* DM fog toggle button removed — use Edit Map instead */}

      {/* Shop view (players) — fixed overlay */}
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
                    // Assign character to this campaign so InGamePage picks it up
                    const updated = { ...c, campaignId: campaign.id, updatedAt: new Date().toISOString() }
                    useCharacterStore.getState().saveCharacter(updated)
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

      {/* Modals — lazy-loaded, fixed overlays */}
      <Suspense fallback={null}>
        {activeModal === 'action' && (
          <ActionModal
            isMyTurn={isMyTurn}
            playerName={playerName}
            onAction={handleAction}
            onClose={() => setActiveModal(null)}
          />
        )}
        {activeModal === 'item' && (
          <ItemModal
            character={character}
            onClose={() => setActiveModal(null)}
            onUseItem={(_itemName, message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}
        {activeModal === 'hiddenDice' && effectiveIsDM && <HiddenDiceModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'dmRoller' && effectiveIsDM && <DmRollerModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'shop' && effectiveIsDM && <DMShopModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'whisper' && <WhisperModal isDM={effectiveIsDM} senderName={playerName} onClose={() => setActiveModal(null)} />}
        {activeModal === 'quickCondition' && <QuickConditionModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'timer' && effectiveIsDM && <TimerModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'initiative' && effectiveIsDM && <InitiativeModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'notes' && effectiveIsDM && <DMNotesModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'attack' && (
          <AttackModal
            character={character}
            tokens={activeMap?.tokens ?? []}
            attackerToken={character ? (activeMap?.tokens.find((t) => t.entityId === character.id) ?? null) : null}
            onClose={() => setActiveModal(null)}
            onApplyDamage={(targetTokenId, damage, _damageType, damageAppResult) => {
              if (!activeMap) return
              const target = activeMap.tokens.find((t) => t.id === targetTokenId)
              if (target && target.currentHP != null) {
                const effectiveDmg = damageAppResult?.effectiveDamage ?? damage
                const newHP = Math.max(0, target.currentHP - effectiveDmg)
                gameStore.updateToken(activeMap.id, targetTokenId, { currentHP: newHP })

                // Check for concentration (auto-prompt CON save)
                const targetTs = gameStore.turnStates[target.entityId]
                if (targetTs?.concentratingSpell && effectiveDmg > 0) {
                  const dc = Math.min(30, Math.max(10, Math.floor(effectiveDmg / 2)))
                  setConcCheckPrompt({
                    entityId: target.entityId,
                    entityName: target.label,
                    spellName: targetTs.concentratingSpell,
                    dc,
                    damage: effectiveDmg
                  })
                }
              }
            }}
            onBroadcastResult={(message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}

        {activeModal === 'help' && character && (
          <HelpModal
            character={character}
            tokens={activeMap?.tokens ?? []}
            attackerToken={character ? (activeMap?.tokens.find((t) => t.entityId === character.id) ?? null) : null}
            onClose={() => {
              setActiveModal(null)
              if (character && gameStore.initiative) {
                gameStore.useAction(character.id)
              }
            }}
            onBroadcastResult={(message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}

        {activeModal === 'jump' && character && (
          <JumpModal
            character={character}
            movementRemaining={character ? (gameStore.turnStates[character.id]?.movementRemaining ?? 30) : 30}
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}

        {activeModal === 'falling' && (
          <FallingDamageModal
            tokens={activeMap?.tokens ?? []}
            onClose={() => setActiveModal(null)}
            onApplyDamage={(targetTokenId, damage) => {
              if (!activeMap) return
              const target = activeMap.tokens.find((t) => t.id === targetTokenId)
              if (target && target.currentHP != null) {
                const newHP = Math.max(0, target.currentHP - damage)
                gameStore.updateToken(activeMap.id, targetTokenId, { currentHP: newHP })
              }
            }}
            onBroadcastResult={(message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}

        {activeModal === 'influence' && character && (
          <InfluenceModal
            character={character}
            onClose={() => {
              setActiveModal(null)
              if (character && gameStore.initiative) {
                gameStore.useAction(character.id)
              }
            }}
            onBroadcastResult={(message) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: message,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message, isSystem: true })
            }}
          />
        )}

        {activeModal === 'aoe' && (
          <AoETemplateModal
            tokens={activeMap?.tokens ?? []}
            gridWidth={activeMap ? Math.ceil(activeMap.width / (activeMap.grid.cellSize || 40)) : 30}
            gridHeight={activeMap ? Math.ceil(activeMap.height / (activeMap.grid.cellSize || 40)) : 30}
            onPlace={(config) => {
              setActiveAoE(config)
              setActiveModal(null)
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'travelPace' && <TravelPaceModal onClose={() => setActiveModal(null)} />}

        {activeModal === 'mount' && (
          <MountModal
            character={character}
            tokens={activeMap?.tokens ?? []}
            attackerToken={activeMap?.tokens.find((t) => t.entityId === character?.id) ?? null}
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true })
            }}
          />
        )}

        {/* Creature & Companion Modals */}
        {activeModal === 'creatures' && (
          <CreatureModal
            onClose={() => setActiveModal(null)}
            isDM={effectiveIsDM}
            initialTab="browse"
            characterId={character?.id}
            onSummon={character ? handleCompanionSummon : undefined}
            onPlace={
              effectiveIsDM
                ? (monster) => {
                    if (!activeMap) return
                    gameStore.addToken(activeMap.id, {
                      id: crypto.randomUUID(),
                      entityId: `npc-${crypto.randomUUID()}`,
                      entityType: 'npc',
                      label: monster.name,
                      gridX: 0,
                      gridY: 0,
                      sizeX: monster.tokenSize?.x ?? 1,
                      sizeY: monster.tokenSize?.y ?? 1,
                      visibleToPlayers: false,
                      conditions: [],
                      currentHP: monster.hp,
                      maxHP: monster.hp,
                      ac: monster.ac,
                      monsterStatBlockId: monster.id,
                      walkSpeed: monster.speed.walk ?? 0,
                      swimSpeed: monster.speed.swim,
                      climbSpeed: monster.speed.climb,
                      flySpeed: monster.speed.fly,
                      initiativeModifier: monster.abilityScores ? Math.floor((monster.abilityScores.dex - 10) / 2) : 0,
                      resistances: monster.resistances,
                      vulnerabilities: monster.vulnerabilities,
                      immunities: monster.damageImmunities,
                      darkvision: !!(monster.senses.darkvision && monster.senses.darkvision > 0)
                    })
                    setActiveModal(null)
                  }
                : undefined
            }
          />
        )}
        {activeModal === 'familiar' && character && is5eCharacter(character) && (
          <FamiliarSelectorModal
            onClose={() => setActiveModal(null)}
            onSummon={handleCompanionSummon}
            characterId={character.id}
            hasChainPact={character.invocationsKnown?.some((i) => i === 'pact-of-the-chain') ?? false}
            existingFamiliar={(character.companions ?? []).find((c) => c.type === 'familiar') ?? null}
            onDismiss={() => {
              const fam = (character.companions ?? []).find((c) => c.type === 'familiar')
              if (fam) {
                const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                if (latest && is5eCharacter(latest)) {
                  const updated = {
                    ...latest,
                    companions: (latest.companions ?? []).map((c) => (c.id === fam.id ? { ...c, dismissed: true } : c)),
                    updatedAt: new Date().toISOString()
                  }
                  useCharacterStore.getState().saveCharacter(updated)
                }
              }
            }}
            onResummon={() => {
              const fam = (character.companions ?? []).find((c) => c.type === 'familiar')
              if (fam) {
                const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                if (latest && is5eCharacter(latest)) {
                  const updated = {
                    ...latest,
                    companions: (latest.companions ?? []).map((c) =>
                      c.id === fam.id ? { ...c, dismissed: false } : c
                    ),
                    updatedAt: new Date().toISOString()
                  }
                  useCharacterStore.getState().saveCharacter(updated)
                }
              }
            }}
          />
        )}
        {activeModal === 'wildShape' && character && is5eCharacter(character) && (
          <WildShapeBrowserModal
            onClose={() => setActiveModal(null)}
            druidLevel={character.classes.find((c) => c.name.toLowerCase() === 'druid')?.level ?? character.level}
            wildShapeUses={character.wildShapeUses ?? { current: 0, max: 0 }}
            activeFormId={character.activeWildShapeFormId}
            onTransform={handleWildShapeTransform}
            onRevert={handleWildShapeRevert}
            onUseAdjust={handleWildShapeUseAdjust}
          />
        )}
        {activeModal === 'steed' && character && is5eCharacter(character) && (
          <SteedSelectorModal
            onClose={() => setActiveModal(null)}
            onSummon={handleCompanionSummon}
            characterId={character.id}
            existingSteed={(character.companions ?? []).find((c) => c.type === 'steed') ?? null}
            onDismiss={() => {
              const steed = (character.companions ?? []).find((c) => c.type === 'steed')
              if (steed) {
                const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                if (latest && is5eCharacter(latest)) {
                  const updated = {
                    ...latest,
                    companions: (latest.companions ?? []).map((c) =>
                      c.id === steed.id ? { ...c, dismissed: true } : c
                    ),
                    updatedAt: new Date().toISOString()
                  }
                  useCharacterStore.getState().saveCharacter(updated)
                }
              }
            }}
            onResummon={() => {
              const steed = (character.companions ?? []).find((c) => c.type === 'steed')
              if (steed) {
                const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                if (latest && is5eCharacter(latest)) {
                  const updated = {
                    ...latest,
                    companions: (latest.companions ?? []).map((c) =>
                      c.id === steed.id ? { ...c, dismissed: false } : c
                    ),
                    updatedAt: new Date().toISOString()
                  }
                  useCharacterStore.getState().saveCharacter(updated)
                }
              }
            }}
          />
        )}
        {activeModal === 'summonCreature' && character && (
          <CreatureModal
            onClose={() => setActiveModal(null)}
            onSummon={handleCompanionSummon}
            characterId={character.id}
            initialTab="summon"
            isDM={effectiveIsDM}
            onPlace={
              effectiveIsDM
                ? (monster) => {
                    if (!activeMap) return
                    gameStore.addToken(activeMap.id, {
                      id: crypto.randomUUID(),
                      entityId: `npc-${crypto.randomUUID()}`,
                      entityType: 'npc',
                      label: monster.name,
                      gridX: 0,
                      gridY: 0,
                      sizeX: monster.tokenSize?.x ?? 1,
                      sizeY: monster.tokenSize?.y ?? 1,
                      visibleToPlayers: false,
                      conditions: [],
                      currentHP: monster.hp,
                      maxHP: monster.hp,
                      ac: monster.ac,
                      monsterStatBlockId: monster.id,
                      walkSpeed: monster.speed.walk ?? 0,
                      swimSpeed: monster.speed.swim,
                      climbSpeed: monster.speed.climb,
                      flySpeed: monster.speed.fly,
                      initiativeModifier: monster.abilityScores ? Math.floor((monster.abilityScores.dex - 10) / 2) : 0,
                      resistances: monster.resistances,
                      vulnerabilities: monster.vulnerabilities,
                      immunities: monster.damageImmunities,
                      darkvision: !!(monster.senses.darkvision && monster.senses.darkvision > 0)
                    })
                    setActiveModal(null)
                  }
                : undefined
            }
          />
        )}

        {/* Time Edit Modal (DM only) */}
        {activeModal === 'timeEdit' && effectiveIsDM && campaign.calendar && (
          <TimeEditModal
            calendar={campaign.calendar}
            campaignId={campaign.id}
            onClose={() => setActiveModal(null)}
            onBroadcastTimeSync={(totalSeconds) => {
              sendMessage('dm:time-sync', { totalSeconds })
              // Check for expired light sources
              const expired = gameStore.checkExpiredSources()
              for (const ls of expired) {
                const msg = `${ls.entityName}'s ${ls.sourceName} goes out.`
                addChatMessage({
                  id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                  senderId: 'system',
                  senderName: 'System',
                  content: msg,
                  timestamp: Date.now(),
                  isSystem: true
                })
                sendMessage('chat:message', { message: msg, isSystem: true })
              }
            }}
          />
        )}

        {/* Light Source Modal */}
        {activeModal === 'lightSource' && <LightSourceModal onClose={() => setActiveModal(null)} />}

        {/* Rest Modals (DM only — players request rests via network) */}
        {(activeModal === 'shortRest' || activeModal === 'longRest') && effectiveIsDM && (
          <RestModal
            mode={activeModal}
            campaignCharacterIds={getCampaignCharacterIds()}
            onClose={() => setActiveModal(null)}
            onApply={(restoredIds) => handleRestApply(activeModal, restoredIds)}
          />
        )}

        {/* Time Request Toast (DM only, human DM) */}
        {timeRequestToast && effectiveIsDM && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-gray-900 border border-amber-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
              <span className="text-xs text-gray-200">{timeRequestToast.requesterName} wants to know the time</span>
              <button
                onClick={() => {
                  if (campaign.calendar && gameStore.inGameTime) {
                    const formatted = formatInGameTime(gameStore.inGameTime.totalSeconds, campaign.calendar)
                    sendMessage('dm:time-share', {
                      formattedTime: formatted,
                      targetPeerId: timeRequestToast.requesterId,
                      targetName: timeRequestToast.requesterName
                    })
                  }
                  setTimeRequestToast(null)
                }}
                className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
              >
                Whisper
              </button>
              <button
                onClick={() => {
                  if (campaign.calendar && gameStore.inGameTime) {
                    const formatted = formatInGameTime(gameStore.inGameTime.totalSeconds, campaign.calendar)
                    sendMessage('dm:time-share', { formattedTime: formatted })
                    addChatMessage({
                      id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                      senderId: 'system',
                      senderName: 'System',
                      content: `Current time: ${formatted}`,
                      timestamp: Date.now(),
                      isSystem: true
                    })
                  }
                  setTimeRequestToast(null)
                }}
                className="px-2 py-1 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
              >
                Broadcast
              </button>
              <button
                onClick={() => setTimeRequestToast(null)}
                className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
              >
                x
              </button>
            </div>
          </div>
        )}

        {/* Custom Effect Modal (DM only) */}
        {activeModal === 'customEffect' && effectiveIsDM && activeMap && (
          <CustomEffectModal
            tokens={activeMap.tokens}
            onClose={() => setActiveModal(null)}
            onBroadcast={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}

        {/* Command Reference Modal */}
        {activeModal === 'commandRef' && (
          <CommandReferenceModal isDM={effectiveIsDM} onClose={() => setActiveModal(null)} />
        )}

        {/* New Phase 3 Modals (DM only) */}
        {activeModal === 'encounterBuilder' && effectiveIsDM && (
          <EncounterBuilderModal
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'treasureGenerator' && effectiveIsDM && (
          <TreasureGeneratorModal
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'npcGenerator' && effectiveIsDM && (
          <NPCGeneratorModal
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'chaseTracker' && effectiveIsDM && (
          <ChaseTrackerModal
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'mobCalculator' && effectiveIsDM && (
          <MobCalculatorModal
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'groupRoll' && (
          <GroupRollModal
            isDM={effectiveIsDM}
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'study' && character && (
          <StudyActionModal
            character={character}
            onClose={() => setActiveModal(null)}
            onBroadcastResult={(msg) => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
            }}
          />
        )}
        {activeModal === 'shortcutRef' && <ShortcutReferenceModal onClose={() => setActiveModal(null)} />}

        {activeModal === 'downtime' && (
          <DowntimeModal
            characterName={character?.name}
            onClose={() => setActiveModal(null)}
            onApply={(activity, days, gold, details) => {
              const msg = `**Downtime Activity:** ${activity}${details ? ` (${details})` : ''} — ${days} day${days !== 1 ? 's' : ''}, ${gold.toLocaleString()} GP`
              addChatMessage({
                id: `system-downtime-${Date.now()}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
            }}
          />
        )}

        {/* Dispute Modal (DM only) */}
        {activeModal === 'dispute' && disputeContext && (
          <DisputeModal
            ruling={disputeContext.ruling}
            citation={disputeContext.citation}
            onClose={() => {
              setActiveModal(null)
              setDisputeContext(null)
            }}
            onUphold={() => {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: 'DM upheld the AI ruling.',
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: 'DM upheld the AI ruling.', isSystem: true, senderName: 'System' })
              setActiveModal(null)
              setDisputeContext(null)
            }}
            onOverride={(dmNote) => {
              const msg = dmNote ? `DM overrode AI ruling: ${dmNote}` : 'DM overrode the AI ruling.'
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
              setActiveModal(null)
              setDisputeContext(null)
            }}
          />
        )}
        {activeModal === 'spellRef' && (
          <SpellReferenceModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'calendar' && campaign.calendar && (
          <InGameCalendarModal
            calendar={campaign.calendar}
            onClose={() => setActiveModal(null)}
            isDM={effectiveIsDM}
          />
        )}
        {activeModal === 'gridSettings' && effectiveIsDM && (
          <GridSettingsModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'tokenEditor' && effectiveIsDM && editingToken && (
          <TokenEditorModal
            token={editingToken.token}
            mapId={editingToken.mapId}
            onClose={() => {
              setActiveModal(null)
              setEditingToken(null)
            }}
          />
        )}
        {activeModal === 'handout' && effectiveIsDM && (
          <HandoutModal
            onClose={() => setActiveModal(null)}
            onShareHandout={(handout) => {
              sendMessage('dm:share-handout', { handout })
            }}
          />
        )}
        {activeModal === 'handoutViewer' && viewingHandout && (
          <HandoutViewerModal
            handout={viewingHandout}
            onClose={() => {
              setActiveModal(null)
              setViewingHandout(null)
            }}
          />
        )}
      </Suspense>

      {/* Rest Request Toast (DM only) */}
      {restRequestToast && effectiveIsDM && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-gray-900 border border-green-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
            <span className="text-xs text-gray-200">
              {restRequestToast.playerName} requests a {restRequestToast.restType === 'short' ? 'Short' : 'Long'} Rest
            </span>
            <button
              onClick={() => {
                setRestRequestToast(null)
                if (restRequestToast.restType === 'short') handleShortRest()
                else handleLongRest()
              }}
              className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-500 text-white rounded cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={() => setRestRequestToast(null)}
              className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Phase Change Toast (DM only) */}
      {phaseChangeToast && effectiveIsDM && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-gray-900 border border-purple-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
            <span className="text-xs text-gray-200">
              It's now <span className="text-purple-300 font-semibold">{phaseChangeToast.phase}</span>. Update ambient
              lighting to <span className="text-amber-300">{phaseChangeToast.suggestedLight}</span>?
            </span>
            <button
              onClick={() => {
                gameStore.setAmbientLight(phaseChangeToast.suggestedLight)
                setPhaseChangeToast(null)
              }}
              className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer"
            >
              Yes
            </button>
            <button
              onClick={() => setPhaseChangeToast(null)}
              className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Long Rest Warning (24-hour rule) */}
      {longRestWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
            <span className="text-xs text-gray-200">Less than 24 hours since last Long Rest. Override?</span>
            <button
              onClick={executeLongRest}
              className="px-2 py-1 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer"
            >
              Override
            </button>
            <button
              onClick={() => setLongRestWarning(false)}
              className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active AoE dismiss button */}
      {activeAoE && (
        <div className="fixed top-16 right-4 z-30">
          <button
            onClick={() => setActiveAoE(null)}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer shadow-lg"
          >
            Clear AoE Template
          </button>
        </div>
      )}

      {/* Opportunity Attack Prompt */}
      {oaPrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-gray-900 border border-amber-500 rounded-xl p-5 w-80 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-400 mb-2">Opportunity Attack!</h3>
            <p className="text-xs text-gray-300 mb-4">
              <span className="text-amber-300 font-semibold">{oaPrompt.movingTokenLabel}</span> is moving out of
              <span className="text-red-300 font-semibold"> {oaPrompt.enemyTokenLabel}</span>'s reach. Does{' '}
              {oaPrompt.enemyTokenLabel} use their Reaction to make an Opportunity Attack?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Use reaction
                  gameStore.useReaction(oaPrompt.entityId)
                  addChatMessage({
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    senderId: 'system',
                    senderName: 'System',
                    content: `${oaPrompt.enemyTokenLabel} makes an Opportunity Attack against ${oaPrompt.movingTokenLabel}! (Reaction used)`,
                    timestamp: Date.now(),
                    isSystem: true
                  })
                  sendMessage('chat:message', {
                    message: `${oaPrompt.enemyTokenLabel} makes an Opportunity Attack against ${oaPrompt.movingTokenLabel}! (Reaction used)`,
                    isSystem: true
                  })
                  setOaPrompt(null)
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer"
              >
                Yes - Attack!
              </button>
              <button
                onClick={() => setOaPrompt(null)}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer"
              >
                No - Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concentration Check Prompt */}
      {concCheckPrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-gray-900 border border-purple-500 rounded-xl p-5 w-96 shadow-2xl">
            <h3 className="text-sm font-semibold text-purple-400 mb-2">Concentration Check</h3>
            <p className="text-xs text-gray-300 mb-1">
              <span className="text-purple-300 font-semibold">{concCheckPrompt.entityName}</span> took{' '}
              <span className="text-red-300 font-semibold">{concCheckPrompt.damage} damage</span> while concentrating on{' '}
              <span className="text-blue-300 font-semibold">{concCheckPrompt.spellName}</span>.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Constitution saving throw required: <span className="text-white font-bold">DC {concCheckPrompt.dc}</span>{' '}
              (max of 10 or half the damage taken, up to DC 30)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Roll the CON save
                  const roll = Math.floor(Math.random() * 20) + 1
                  const passed = roll >= concCheckPrompt.dc
                  const isCrit = roll === 20
                  const isFumble = roll === 1
                  const resultText = isCrit
                    ? 'Natural 20! Concentration maintained!'
                    : isFumble
                      ? 'Natural 1! Concentration lost!'
                      : passed
                        ? `Rolled ${roll} vs DC ${concCheckPrompt.dc} - Concentration maintained!`
                        : `Rolled ${roll} vs DC ${concCheckPrompt.dc} - Concentration lost!`

                  if (!passed && !isCrit) {
                    gameStore.setConcentrating(concCheckPrompt.entityId, undefined)
                    handleConcentrationLost(concCheckPrompt.entityId)
                  }

                  addChatMessage({
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    senderId: 'system',
                    senderName: 'System',
                    content: `${concCheckPrompt.entityName} CON Save (${concCheckPrompt.spellName}): ${resultText}`,
                    timestamp: Date.now(),
                    isSystem: true
                  })
                  sendMessage('chat:message', {
                    message: `${concCheckPrompt.entityName} CON Save (${concCheckPrompt.spellName}): ${resultText}`,
                    isSystem: true
                  })
                  setConcCheckPrompt(null)
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg cursor-pointer"
              >
                Roll CON Save (d20)
              </button>
              <button
                onClick={() => {
                  // Manual pass
                  addChatMessage({
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    senderId: 'system',
                    senderName: 'System',
                    content: `${concCheckPrompt.entityName} maintains concentration on ${concCheckPrompt.spellName} (manual)`,
                    timestamp: Date.now(),
                    isSystem: true
                  })
                  setConcCheckPrompt(null)
                }}
                className="px-3 py-2 text-xs font-semibold bg-green-700 hover:bg-green-600 text-white rounded-lg cursor-pointer"
              >
                Pass
              </button>
              <button
                onClick={() => {
                  // Manual fail
                  gameStore.setConcentrating(concCheckPrompt.entityId, undefined)
                  handleConcentrationLost(concCheckPrompt.entityId)
                  addChatMessage({
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    senderId: 'system',
                    senderName: 'System',
                    content: `${concCheckPrompt.entityName} loses concentration on ${concCheckPrompt.spellName}!`,
                    timestamp: Date.now(),
                    isSystem: true
                  })
                  sendMessage('chat:message', {
                    message: `${concCheckPrompt.entityName} loses concentration on ${concCheckPrompt.spellName}!`,
                    isSystem: true
                  })
                  setConcCheckPrompt(null)
                }}
                className="px-3 py-2 text-xs font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg cursor-pointer"
              >
                Fail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stabilize Check Prompt (B3) */}
      {stabilizePrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-gray-900 border border-green-500 rounded-xl p-5 w-96 shadow-2xl">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Stabilize Creature</h3>
            <p className="text-xs text-gray-300 mb-1">
              <span className="text-green-300 font-semibold">{stabilizePrompt.healerName}</span> attempts to stabilize{' '}
              <span className="text-red-300 font-semibold">{stabilizePrompt.entityName}</span> (0 HP).
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Wisdom (Medicine) check: <span className="text-white font-bold">DC 10</span>
              <span className="text-gray-500 ml-1">
                (Modifier: {stabilizePrompt.medicineMod >= 0 ? '+' : ''}
                {stabilizePrompt.medicineMod})
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const roll = Math.floor(Math.random() * 20) + 1
                  const total = roll + stabilizePrompt.medicineMod
                  const passed = total >= 10
                  const resultText =
                    roll === 20
                      ? `Natural 20! ${stabilizePrompt.entityName} is stabilized!`
                      : roll === 1
                        ? `Natural 1! Failed to stabilize ${stabilizePrompt.entityName}.`
                        : passed
                          ? `Rolled ${total} (${roll}+${stabilizePrompt.medicineMod}) vs DC 10 — ${stabilizePrompt.entityName} is stabilized!`
                          : `Rolled ${total} (${roll}+${stabilizePrompt.medicineMod}) vs DC 10 — Failed to stabilize.`

                  if (character && gameStore.initiative) {
                    gameStore.useAction(character.id)
                  }

                  addChatMessage({
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                    senderId: 'system',
                    senderName: 'System',
                    content: `${stabilizePrompt.healerName} Medicine Check (Stabilize): ${resultText}`,
                    timestamp: Date.now(),
                    isSystem: true
                  })
                  sendMessage('chat:message', {
                    message: `${stabilizePrompt.healerName} Medicine Check (Stabilize): ${resultText}`,
                    isSystem: true
                  })

                  if (passed || roll === 20) {
                    // Stabilized: stays at 0 HP but stops death saves
                    const cId = `cond-${Date.now()}`
                    gameStore.addCondition({
                      id: cId,
                      entityId: stabilizePrompt.entityId,
                      entityName: stabilizePrompt.entityName,
                      condition: 'Stable',
                      duration: 'permanent',
                      source: stabilizePrompt.healerName,
                      appliedRound: gameStore.round
                    })
                  }

                  setStabilizePrompt(null)
                }}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-green-600 hover:bg-green-500 text-white rounded-lg cursor-pointer"
              >
                Roll Medicine (d20 {stabilizePrompt.medicineMod >= 0 ? '+' : ''}
                {stabilizePrompt.medicineMod})
              </button>
              <button
                onClick={() => setStabilizePrompt(null)}
                className="px-3 py-2 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DM Map Editor fullscreen (DM only) */}
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

      {/* AI DM Ruling Approval Modal (DM only, shown when pendingActions is set) */}
      {effectiveIsDM && aiDmStore.pendingActions && (
        <Suspense fallback={null}>
          <RulingApprovalModal />
        </Suspense>
      )}
    </div>
  )
}
