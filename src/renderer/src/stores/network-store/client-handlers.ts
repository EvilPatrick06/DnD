import type {
  CoDMPayload,
  ColorChangePayload,
  ConditionUpdatePayload,
  FileSharingPayload,
  FogRevealPayload,
  GameStateFullPayload,
  InspectResponsePayload,
  JournalAddPayload,
  JournalDeletePayload,
  JournalSyncPayload,
  JournalUpdatePayload,
  MacroPushPayload,
  MapChangePayload,
  NetworkGameState,
  NetworkMessage,
  PeerInfo,
  ReactionPromptPayload,
  RollRequestPayload,
  SlowModePayload,
  TokenMovePayload,
  TradeCancelPayload,
  TradeRequestPayload,
  TradeResultPayload,
  WhisperPayload
} from '../../network'
import { useGameStore } from '../use-game-store'
import { useLobbyStore } from '../use-lobby-store'
import type { NetworkState } from './index'

/** Apply a partial game state update from the network */
function applyGameState(data: Record<string, unknown>): void {
  useGameStore.getState().loadGameState(data)
}

/** Handle granular game:state-update messages with add/remove/update operations */
function handleGameStateUpdate(payload: Record<string, unknown>): void {
  const gs = useGameStore.getState()

  if (payload.addToken) {
    const { mapId, token } = payload.addToken as { mapId: string; token: import('../../types/map').MapToken }
    gs.addToken(mapId, token)
    return
  }

  if (payload.removeToken) {
    const { mapId, tokenId } = payload.removeToken as { mapId: string; tokenId: string }
    gs.removeToken(mapId, tokenId)
    return
  }

  if (payload.updateToken) {
    const { mapId, tokenId, updates } = payload.updateToken as {
      mapId: string
      tokenId: string
      updates: Partial<import('../../types/map').MapToken>
    }
    gs.updateToken(mapId, tokenId, updates)
    return
  }

  if (payload.addMap) {
    gs.addMap(payload.addMap as import('../../types/map').GameMap)
    return
  }

  if (payload.wallSegments) {
    const { mapId, segments } = payload.wallSegments as {
      mapId: string
      segments: import('../../types/map').WallSegment[]
    }
    const maps = gs.maps.map((m) => (m.id === mapId ? { ...m, wallSegments: segments } : m))
    useGameStore.setState({ maps })
    return
  }

  // Generic partial state update
  applyGameState(payload)
}

/**
 * Handle messages received by a client from the host.
 * Applies game state updates, peer changes, and DM actions.
 */
export function handleClientMessage(
  message: NetworkMessage,
  get: () => NetworkState,
  set: (partial: Partial<NetworkState> | ((state: NetworkState) => Partial<NetworkState>)) => void
): void {
  switch (message.type) {
    case 'game:state-full': {
      const payload = message.payload as GameStateFullPayload
      const updates: Partial<NetworkState> = { peers: payload.peers }
      if (payload.campaignId) {
        updates.campaignId = payload.campaignId
      }
      set(updates)
      if (payload.gameState) {
        // Convert maps with imageData: use imageData as imagePath for client rendering
        const gs = payload.gameState as NetworkGameState
        if (gs.maps) {
          gs.maps = gs.maps.map((m) => ({
            ...m,
            imagePath: m.imageData || m.imagePath
          }))
        }
        applyGameState(gs as unknown as Record<string, unknown>)
        // Apply shop state if present
        if (gs.shopOpen) {
          useGameStore.getState().openShop(gs.shopName)
          if (gs.shopInventory) useGameStore.getState().setShopInventory(gs.shopInventory)
        }
      }
      break
    }

    case 'player:join': {
      const payload = message.payload as PeerInfo & { displayName: string }
      const newPeer: PeerInfo = {
        peerId: payload.peerId || message.senderId,
        displayName: payload.displayName,
        characterId: payload.characterId || null,
        characterName: payload.characterName || null,
        isReady: false,
        isHost: false
      }
      get().addPeer(newPeer)
      break
    }

    case 'player:leave': {
      const payload = message.payload as { peerId?: string }
      const peerId = payload.peerId || message.senderId
      get().removePeer(peerId)
      break
    }

    case 'player:ready': {
      const readyPayload = message.payload as { isReady?: boolean }
      get().updatePeer(message.senderId, { isReady: readyPayload.isReady ?? true })
      break
    }

    case 'player:character-select': {
      const payload = message.payload as { characterId: string | null; characterName: string | null }
      get().updatePeer(message.senderId, {
        characterId: payload.characterId,
        characterName: payload.characterName
      })
      break
    }

    case 'dm:kick-player': {
      // Already handled in client-manager, but just in case
      set({
        connectionState: 'disconnected',
        role: 'none',
        campaignId: null,
        peers: [],
        error: 'You were kicked from the game',
        disconnectReason: 'kicked'
      })
      break
    }

    case 'dm:ban-player': {
      set({
        connectionState: 'disconnected',
        role: 'none',
        campaignId: null,
        peers: [],
        error: 'You were banned from the game',
        disconnectReason: 'banned'
      })
      break
    }

    case 'dm:promote-codm': {
      const payload = message.payload as CoDMPayload
      get().updatePeer(payload.peerId, { isCoDM: payload.isCoDM })
      useLobbyStore.getState().updatePlayer(payload.peerId, { isCoDM: payload.isCoDM })
      break
    }

    case 'dm:demote-codm': {
      const payload = message.payload as CoDMPayload
      get().updatePeer(payload.peerId, { isCoDM: false })
      useLobbyStore.getState().updatePlayer(payload.peerId, { isCoDM: false })
      break
    }

    case 'player:color-change': {
      const payload = message.payload as ColorChangePayload
      get().updatePeer(message.senderId, { color: payload.color })
      useLobbyStore.getState().updatePlayer(message.senderId, { color: payload.color })
      break
    }

    case 'dm:game-end': {
      set({
        connectionState: 'disconnected',
        role: 'none',
        campaignId: null,
        peers: [],
        error: 'The game session has ended'
      })
      break
    }

    // --- Game state sync messages (host -> client) ---

    case 'dm:token-move': {
      const payload = message.payload as TokenMovePayload
      useGameStore.getState().moveToken(payload.mapId, payload.tokenId, payload.gridX, payload.gridY)
      break
    }

    case 'dm:fog-reveal': {
      const payload = message.payload as FogRevealPayload & {
        fogOfWar?: { revealedCells: Array<{ x: number; y: number }>; enabled?: boolean }
      }
      if (payload.fogOfWar) {
        const gs = useGameStore.getState()
        const maps = gs.maps.map((m) =>
          m.id === payload.mapId ? { ...m, fogOfWar: { enabled: m.fogOfWar.enabled, ...payload.fogOfWar! } } : m
        )
        useGameStore.setState({ maps })
      } else if (payload.reveal) {
        useGameStore.getState().revealFog(payload.mapId, payload.cells)
      } else {
        useGameStore.getState().hideFog(payload.mapId, payload.cells)
      }
      break
    }

    case 'dm:map-change': {
      const payload = message.payload as MapChangePayload
      if (payload.mapData) {
        const gs = useGameStore.getState()
        const existing = gs.maps.find((m) => m.id === payload.mapId)
        if (existing) {
          const maps = gs.maps.map((m) =>
            m.id === payload.mapId
              ? {
                  ...m,
                  ...(payload.mapData as unknown as Record<string, unknown>),
                  imagePath: payload.mapData!.imageData || m.imagePath
                }
              : m
          ) as import('../../types/map').GameMap[]
          useGameStore.setState({ maps })
        } else {
          const newMap = {
            ...payload.mapData,
            imagePath: payload.mapData.imageData || payload.mapData.imagePath
          } as unknown as import('../../types/map').GameMap
          gs.addMap(newMap)
        }
      }
      useGameStore.getState().setActiveMap(payload.mapId)
      break
    }

    case 'dm:initiative-update': {
      const payload = message.payload as {
        initiative: unknown
        round: number
        turnMode?: 'initiative' | 'free'
      }
      applyGameState({
        initiative: payload.initiative,
        round: payload.round,
        ...(payload.turnMode ? { turnMode: payload.turnMode } : {})
      } as Record<string, unknown>)
      break
    }

    case 'dm:condition-update': {
      const payload = message.payload as ConditionUpdatePayload & { conditions?: unknown[] }
      if (payload.conditions) {
        applyGameState({ conditions: payload.conditions } as Record<string, unknown>)
      }
      break
    }

    case 'game:state-update': {
      const payload = message.payload as Record<string, unknown>
      handleGameStateUpdate(payload)
      break
    }

    case 'game:turn-advance': {
      useGameStore.getState().nextTurn()
      break
    }

    case 'dm:slow-mode': {
      const payload = message.payload as SlowModePayload
      useLobbyStore.getState().setSlowMode(payload.seconds)
      break
    }

    case 'dm:file-sharing': {
      const payload = message.payload as FileSharingPayload
      useLobbyStore.getState().setFileSharingEnabled(payload.enabled)
      break
    }

    case 'chat:whisper': {
      const payload = message.payload as WhisperPayload
      useLobbyStore.getState().addChatMessage({
        id: `whisper-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: message.senderId,
        senderName: `${message.senderName} (Whisper)`,
        content: payload.message,
        timestamp: Date.now(),
        isSystem: false
      })
      break
    }

    case 'dm:vision-update': {
      const payload = message.payload as { partyVisionCells: Array<{ x: number; y: number }> }
      useGameStore.getState().setPartyVisionCells(payload.partyVisionCells)
      break
    }

    case 'combat:reaction-prompt': {
      const payload = message.payload as ReactionPromptPayload
      useGameStore.getState().setPendingReactionPrompt({
        promptId: payload.promptId,
        targetEntityId: payload.targetEntityId,
        triggerType: payload.triggerType,
        triggerContext: payload.triggerContext
      })
      break
    }

    case 'pong': {
      const payload = message.payload as { timestamp?: number }
      if (payload.timestamp) {
        const rtt = Date.now() - payload.timestamp
        set({ latencyMs: rtt })
      }
      break
    }

    // --- Trade messages ---
    case 'player:trade-request': {
      const payload = message.payload as TradeRequestPayload
      useGameStore.getState().setPendingTradeOffer(payload)
      break
    }

    case 'player:trade-cancel': {
      const _payload = message.payload as TradeCancelPayload
      useGameStore.getState().clearPendingTradeOffer()
      break
    }

    case 'dm:trade-result': {
      const payload = message.payload as TradeResultPayload
      useGameStore.getState().setPendingTradeResult({
        tradeId: payload.tradeId,
        accepted: payload.accepted,
        summary: payload.summary
      })
      useGameStore.getState().clearPendingTradeOffer()
      break
    }

    // --- Journal messages ---
    case 'player:journal-add': {
      const payload = message.payload as JournalAddPayload
      useGameStore.getState().addJournalEntry(payload.entry)
      break
    }

    case 'player:journal-update': {
      const payload = message.payload as JournalUpdatePayload
      const updates: Record<string, unknown> = {}
      if (payload.title !== undefined) updates.title = payload.title
      if (payload.content !== undefined) updates.content = payload.content
      if (payload.visibility !== undefined) updates.visibility = payload.visibility
      useGameStore
        .getState()
        .updateJournalEntry(
          payload.entryId,
          updates as Partial<
            Pick<import('../../types/game-state').SharedJournalEntry, 'title' | 'content' | 'visibility'>
          >
        )
      break
    }

    case 'player:journal-delete': {
      const payload = message.payload as JournalDeletePayload
      useGameStore.getState().deleteJournalEntry(payload.entryId)
      break
    }

    case 'dm:journal-sync': {
      const payload = message.payload as JournalSyncPayload
      useGameStore.getState().setSharedJournal(payload.entries)
      break
    }

    // --- Inspect messages ---
    case 'dm:inspect-response': {
      const payload = message.payload as InspectResponsePayload
      const localId = get().localPeerId
      if (payload.targetPeerId === localId) {
        useGameStore.getState().setInspectedCharacter(payload.characterData)
      }
      break
    }

    // --- Group roll request from DM ---
    case 'dm:roll-request': {
      const payload = message.payload as RollRequestPayload
      useGameStore.getState().setPendingGroupRoll({
        id: payload.id ?? `roll-${Date.now()}`,
        type: payload.type,
        ability: payload.ability,
        skill: payload.skill,
        dc: payload.dc,
        isSecret: payload.isSecret,
        scope: 'all',
        targetEntityIds: []
      })
      break
    }

    // --- Macro sharing ---
    case 'dm:push-macros': {
      const payload = message.payload as MacroPushPayload
      const { useMacroStore } = require('../use-macro-store') as typeof import('../use-macro-store')
      useMacroStore.getState().importMacros(payload.macros)
      useLobbyStore.getState().addChatMessage({
        id: `sys-macros-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        content: `DM shared ${payload.macros.length} macro${payload.macros.length === 1 ? '' : 's'} with the party!`,
        timestamp: Date.now(),
        isSystem: true
      })
      break
    }

    default: {
      break
    }
  }
}
