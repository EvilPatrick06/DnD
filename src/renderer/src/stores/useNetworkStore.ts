import { create } from 'zustand'
import { LAST_SESSION_KEY } from '../constants/app-constants'
import * as clientManager from '../network/client-manager'
import * as hostManager from '../network/host-manager'
import { broadcastExcluding, setGameStateProvider, sendToPeer } from '../network/host-manager'
import { buildFullGameStatePayload } from '../services/game-sync'
import { getPeerId } from '../network/peer-manager'
import type {
  ConditionUpdatePayload,
  ConnectionState,
  FogRevealPayload,
  ForceDeafenPayload,
  ForceMutePayload,
  GameStateFullPayload,
  MapChangePayload,
  MessageType,
  NetworkGameState,
  NetworkMessage,
  PeerInfo,
  ShopItem,
  SlowModePayload,
  FileSharingPayload,
  TokenMovePayload
} from '../network/types'
import { setForceDeafened, setForceMuted } from '../network/voice-manager'
import { useGameStore } from './useGameStore'
import { useLobbyStore } from './useLobbyStore'

const listenerCleanups: Array<() => void> = []
function clearListenerCleanups(): void {
  for (const fn of listenerCleanups) fn()
  listenerCleanups.length = 0
}

interface NetworkState {
  role: 'none' | 'host' | 'client'
  connectionState: ConnectionState
  inviteCode: string | null
  campaignId: string | null
  localPeerId: string | null
  displayName: string
  peers: PeerInfo[]
  error: string | null
  disconnectReason: 'kicked' | 'banned' | null
  latencyMs: number | null

  // Host actions
  hostGame: (displayName: string, existingInviteCode?: string) => Promise<string>
  stopHosting: () => void
  kickPlayer: (peerId: string) => void
  forceMutePlayer: (peerId: string, isForceMuted: boolean) => void
  forceDeafenPlayer: (peerId: string, isForceDeafened: boolean) => void

  // Client actions
  joinGame: (inviteCode: string, displayName: string) => Promise<void>
  disconnect: () => void

  // Shared
  sendMessage: (type: MessageType, payload: unknown) => void
  setDisplayName: (name: string) => void
  updatePeer: (peerId: string, updates: Partial<PeerInfo>) => void
  removePeer: (peerId: string) => void
  addPeer: (peer: PeerInfo) => void
  setConnectionState: (state: ConnectionState) => void
  setError: (error: string | null) => void
  clearDisconnectReason: () => void
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  role: 'none',
  connectionState: 'disconnected',
  inviteCode: null,
  campaignId: null,
  localPeerId: null,
  displayName: '',
  peers: [],
  error: null,
  disconnectReason: null,
  latencyMs: null,

  // --- Host actions ---

  hostGame: async (displayName: string, existingInviteCode?: string) => {
    set({
      connectionState: 'connecting',
      error: null,
      displayName,
      role: 'host'
    })

    try {
      const inviteCode = await hostManager.startHosting(displayName, existingInviteCode)

      clearListenerCleanups()
      listenerCleanups.push(
        hostManager.onPeerJoined((peer: PeerInfo) => {
          get().addPeer(peer)
          // Async: send map images to newly joined peer after the initial handshake
          buildFullGameStatePayload().then((fullState) => {
            const maps = fullState.maps as Array<Record<string, unknown>>
            if (maps?.length) {
              const msg = {
                type: 'game:state-update' as const,
                payload: { mapsWithImages: maps },
                senderId: getPeerId() || '',
                senderName: get().displayName,
                timestamp: Date.now(),
                sequence: 0
              }
              sendToPeer(peer.peerId, msg)
            }
          })
        }),
        hostManager.onPeerLeft((peer: PeerInfo) => {
          get().removePeer(peer.peerId)
        }),
        hostManager.onMessage((message: NetworkMessage, fromPeerId: string) => {
          handleHostMessage(message, fromPeerId, get, set)
        })
      )

      // Provide game state for full syncs when new players connect
      setGameStateProvider(() => buildNetworkGameState())

      set({
        connectionState: 'connected',
        inviteCode,
        localPeerId: getPeerId()
      })

      return inviteCode
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to host game'
      set({
        connectionState: 'error',
        error: errorMsg,
        role: 'none'
      })
      throw err
    }
  },

  stopHosting: () => {
    setGameStateProvider(null)
    clearListenerCleanups()
    hostManager.stopHosting()
    set({
      role: 'none',
      connectionState: 'disconnected',
      inviteCode: null,
      campaignId: null,
      localPeerId: null,
      peers: [],
      error: null,
      disconnectReason: null,
      latencyMs: null
    })
  },

  kickPlayer: (peerId: string) => {
    hostManager.kickPeer(peerId)
    get().removePeer(peerId)
  },

  forceMutePlayer: (peerId: string, isForceMuted: boolean) => {
    const { displayName } = get()
    const message: NetworkMessage<ForceMutePayload> = {
      type: 'dm:force-mute',
      payload: { peerId, isForceMuted },
      senderId: getPeerId() || '',
      senderName: displayName,
      timestamp: Date.now(),
      sequence: 0
    }
    hostManager.broadcastMessage(message)
    get().updatePeer(peerId, { isForceMuted })
    useLobbyStore.getState().updatePlayer(peerId, { isForceMuted })
  },

  forceDeafenPlayer: (peerId: string, isForceDeafened: boolean) => {
    const { displayName, peers } = get()
    const peerUpdates: Partial<PeerInfo> = { isForceDeafened }
    if (isForceDeafened) {
      peerUpdates.isForceMuted = true
    }
    // When un-deafening, preserve existing isForceMuted state
    const message: NetworkMessage<ForceDeafenPayload> = {
      type: 'dm:force-deafen',
      payload: { peerId, isForceDeafened },
      senderId: getPeerId() || '',
      senderName: displayName,
      timestamp: Date.now(),
      sequence: 0
    }
    hostManager.broadcastMessage(message)
    get().updatePeer(peerId, peerUpdates)
    useLobbyStore.getState().updatePlayer(peerId, peerUpdates)
  },

  // --- Client actions ---

  joinGame: async (inviteCode: string, displayName: string) => {
    set({
      connectionState: 'connecting',
      error: null,
      displayName,
      role: 'client'
    })

    try {
      clearListenerCleanups()
      listenerCleanups.push(
        clientManager.onMessage((message: NetworkMessage) => {
          handleClientMessage(message, get, set)
        }),
        clientManager.onDisconnected((reason: string) => {
        // Determine if this was a kick or ban based on the reason string
        let disconnectReason: 'kicked' | 'banned' | null = null
        if (reason.toLowerCase().includes('kicked')) {
          disconnectReason = 'kicked'
        } else if (reason.toLowerCase().includes('banned')) {
          disconnectReason = 'banned'
        }

        // Clear saved session so kicked/banned players don't see "Rejoin"
        if (disconnectReason) {
          try { localStorage.removeItem(LAST_SESSION_KEY) } catch { /* ignore */ }
        }

        set({
          connectionState: 'disconnected',
          role: 'none',
          inviteCode: null,
          campaignId: null,
          localPeerId: null,
          peers: [],
          error: reason,
          disconnectReason
        })
      })
      )

      await clientManager.connectToHost(inviteCode, displayName)

      set({
        connectionState: 'connected',
        inviteCode,
        localPeerId: getPeerId()
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join game'
      set({
        connectionState: 'error',
        error: errorMsg,
        role: 'none'
      })
      throw err
    }
  },

  disconnect: () => {
    clearListenerCleanups()
    const { role } = get()
    if (role === 'host') {
      get().stopHosting()
    } else if (role === 'client') {
      clientManager.disconnect()
      set({
        role: 'none',
        connectionState: 'disconnected',
        inviteCode: null,
        campaignId: null,
        localPeerId: null,
        peers: [],
        error: null,
        disconnectReason: null
      })
    }
  },

  // --- Shared actions ---

  sendMessage: (type: MessageType, payload: unknown) => {
    const { role, displayName } = get()
    if (role === 'host') {
      const message: NetworkMessage = {
        type,
        payload,
        senderId: getPeerId() || '',
        senderName: displayName,
        timestamp: Date.now(),
        sequence: 0
      }
      // dm:character-update: broadcast to all peers so everyone has the latest
      // character data in remoteCharacters, but include targetPeerId in payload
      // so only the target player persists the update to disk
      hostManager.broadcastMessage(message)
    } else if (role === 'client') {
      clientManager.sendMessage({ type, payload })
    }
  },

  setDisplayName: (name: string) => {
    set({ displayName: name })
  },

  updatePeer: (peerId: string, updates: Partial<PeerInfo>) => {
    set((state) => ({
      peers: state.peers.map((p) => (p.peerId === peerId ? { ...p, ...updates } : p))
    }))
  },

  removePeer: (peerId: string) => {
    set((state) => ({
      peers: state.peers.filter((p) => p.peerId !== peerId)
    }))
  },

  addPeer: (peer: PeerInfo) => {
    set((state) => {
      // Avoid duplicates
      const exists = state.peers.some((p) => p.peerId === peer.peerId)
      if (exists) {
        return {
          peers: state.peers.map((p) => (p.peerId === peer.peerId ? peer : p))
        }
      }
      return { peers: [...state.peers, peer] }
    })
  },

  setConnectionState: (connectionState: ConnectionState) => {
    set({ connectionState })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clearDisconnectReason: () => {
    set({ disconnectReason: null })
  }
}))

// --- Host-side message handlers ---

function handleHostMessage(
  message: NetworkMessage,
  fromPeerId: string,
  get: () => NetworkState,
  _set: (partial: Partial<NetworkState> | ((state: NetworkState) => Partial<NetworkState>)) => void
): void {
  switch (message.type) {
    case 'player:ready': {
      const readyPayload = message.payload as { isReady?: boolean }
      get().updatePeer(fromPeerId, { isReady: readyPayload.isReady ?? true })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:character-select': {
      const payload = message.payload as { characterId: string | null; characterName: string | null }
      get().updatePeer(fromPeerId, {
        characterId: payload.characterId,
        characterName: payload.characterName
      })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'voice:mute-toggle': {
      const payload = message.payload as { peerId: string; isMuted: boolean }
      get().updatePeer(fromPeerId, { isMuted: payload.isMuted })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'voice:deafen-toggle': {
      const payload = message.payload as { peerId: string; isDeafened: boolean }
      get().updatePeer(fromPeerId, { isDeafened: payload.isDeafened })
      useLobbyStore.getState().updatePlayer(fromPeerId, { isDeafened: payload.isDeafened })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:message': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:file': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:color-change': {
      const colorPayload = message.payload as { color: string }
      get().updatePeer(fromPeerId, { color: colorPayload.color })
      useLobbyStore.getState().updatePlayer(fromPeerId, { color: colorPayload.color })
      hostManager.updatePeerInfo(fromPeerId, { color: colorPayload.color })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:whisper': {
      const payload = message.payload as { message: string; targetPeerId: string; targetName?: string }
      const localId = getPeerId()

      // If targeted at the host, display it locally
      if (payload.targetPeerId === localId) {
        useLobbyStore.getState().addChatMessage({
          id: `whisper-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: message.senderId,
          senderName: `${message.senderName} (Whisper)`,
          content: payload.message,
          timestamp: Date.now(),
          isSystem: false
        })
      } else {
        // Forward whisper only to the target, after validating they exist
        const targetInfo = hostManager.getPeerInfo(payload.targetPeerId)
        if (targetInfo) {
          ;(message.payload as Record<string, unknown>).targetName = targetInfo.displayName
          hostManager.sendToPeer(payload.targetPeerId, message)
        }
      }
      break
    }

    case 'game:dice-roll': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:buy-item': {
      const buyPayload = message.payload as { itemId: string; itemName: string }
      {
        const gameStore = useGameStore.getState()
        const updatedInventory = gameStore.shopInventory.map((item: ShopItem) => {
          if (item.id !== buyPayload.itemId) return item
          const updates: Partial<ShopItem> = {}
          if (item.quantity > 0) updates.quantity = item.quantity - 1
          if (item.stockRemaining != null && item.stockRemaining > 0)
            updates.stockRemaining = item.stockRemaining - 1
          return { ...item, ...updates }
        })
        gameStore.setShopInventory(updatedInventory)
        hostManager.broadcastMessage({
          type: 'dm:shop-update' as MessageType,
          payload: { shopInventory: updatedInventory, shopName: gameStore.shopName },
          senderId: getPeerId() || '',
          senderName: get().displayName,
          timestamp: Date.now(),
          sequence: 0
        })
      }
      broadcastExcluding(message, fromPeerId)
      break
    }
    case 'player:sell-item': {
      const sellPayload = message.payload as {
        itemName: string
        price: { cp?: number; sp?: number; gp?: number; pp?: number }
      }
      {
        const gameStore = useGameStore.getState()
        const existing = gameStore.shopInventory.find(
          (item: ShopItem) => item.name.toLowerCase() === sellPayload.itemName.toLowerCase()
        )
        let updatedInventory: ShopItem[]
        if (existing) {
          updatedInventory = gameStore.shopInventory.map((item: ShopItem) =>
            item.id === existing.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  stockRemaining:
                    item.stockRemaining != null ? item.stockRemaining + 1 : undefined
                }
              : item
          )
        } else {
          const newItem: ShopItem = {
            id: crypto.randomUUID(),
            name: sellPayload.itemName,
            category: 'other',
            price: sellPayload.price,
            quantity: 1,
            shopCategory: 'other'
          }
          updatedInventory = [...gameStore.shopInventory, newItem]
        }
        gameStore.setShopInventory(updatedInventory)
        hostManager.broadcastMessage({
          type: 'dm:shop-update' as MessageType,
          payload: { shopInventory: updatedInventory, shopName: gameStore.shopName },
          senderId: getPeerId() || '',
          senderName: get().displayName,
          timestamp: Date.now(),
          sequence: 0
        })
      }
      broadcastExcluding(message, fromPeerId)
      break
    }

    default: {
      // Other messages from clients get rebroadcast by default
      // The host can decide which to relay
      break
    }
  }
}

// --- Client-side message handlers ---

function handleClientMessage(
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
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isHost: false,
        isForceMuted: false,
        isForceDeafened: false
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

    case 'voice:mute-toggle': {
      const payload = message.payload as { peerId: string; isMuted: boolean }
      get().updatePeer(payload.peerId, { isMuted: payload.isMuted })
      break
    }

    case 'voice:deafen-toggle': {
      const payload = message.payload as { peerId: string; isDeafened: boolean }
      get().updatePeer(payload.peerId, { isDeafened: payload.isDeafened })
      useLobbyStore.getState().updatePlayer(payload.peerId, { isDeafened: payload.isDeafened })
      break
    }

    case 'dm:force-mute': {
      const payload = message.payload as ForceMutePayload
      get().updatePeer(payload.peerId, { isForceMuted: payload.isForceMuted })
      // If targeting local player, apply force-mute to voice manager
      const localId = getPeerId()
      if (payload.peerId === localId) {
        setForceMuted(payload.isForceMuted)
      }
      break
    }

    case 'dm:force-deafen': {
      const payload = message.payload as ForceDeafenPayload
      const isForceMuted = !!payload.isForceDeafened
      get().updatePeer(payload.peerId, {
        isForceDeafened: payload.isForceDeafened,
        isForceMuted
      })
      // If targeting local player, apply force-deafen to voice manager
      const localPeerId = getPeerId()
      if (payload.peerId === localPeerId) {
        setForceDeafened(payload.isForceDeafened)
      }
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
      const payload = message.payload as { peerId: string; isCoDM: boolean }
      get().updatePeer(payload.peerId, { isCoDM: payload.isCoDM })
      useLobbyStore.getState().updatePlayer(payload.peerId, { isCoDM: payload.isCoDM })
      break
    }

    case 'dm:demote-codm': {
      const payload = message.payload as { peerId: string; isCoDM: boolean }
      get().updatePeer(payload.peerId, { isCoDM: false })
      useLobbyStore.getState().updatePlayer(payload.peerId, { isCoDM: false })
      break
    }

    case 'player:color-change': {
      const payload = message.payload as { color: string }
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

    // --- Game state sync messages (host → client) ---

    case 'dm:token-move': {
      const payload = message.payload as TokenMovePayload
      useGameStore.getState().moveToken(payload.mapId, payload.tokenId, payload.gridX, payload.gridY)
      break
    }

    case 'dm:fog-reveal': {
      const payload = message.payload as FogRevealPayload & { fogOfWar?: { revealedCells: Array<{ x: number; y: number }>; enabled?: boolean } }
      if (payload.fogOfWar) {
        const gs = useGameStore.getState()
        const maps = gs.maps.map((m) =>
          m.id === payload.mapId
            ? { ...m, fogOfWar: { enabled: m.fogOfWar.enabled, ...payload.fogOfWar! } }
            : m
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
              ? { ...m, ...(payload.mapData as unknown as Record<string, unknown>), imagePath: payload.mapData!.imageData || m.imagePath }
              : m
          ) as import('../types/map').GameMap[]
          useGameStore.setState({ maps })
        } else {
          const newMap = {
            ...payload.mapData,
            imagePath: payload.mapData.imageData || payload.mapData.imagePath
          } as unknown as import('../types/map').GameMap
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
      const payload = message.payload as { message: string; targetPeerId: string; targetName: string }
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

    case 'pong': {
      const payload = message.payload as { timestamp?: number }
      if (payload.timestamp) {
        const rtt = Date.now() - payload.timestamp
        set({ latencyMs: rtt })
      }
      break
    }

    default: {
      break
    }
  }
}

// --- Game state helpers ---

function buildNetworkGameState(): NetworkGameState {
  const gs = useGameStore.getState()
  return {
    activeMapId: gs.activeMapId,
    maps: gs.maps.map((m) => ({
      id: m.id,
      name: m.name,
      campaignId: m.campaignId,
      imagePath: m.imagePath,
      width: m.width,
      height: m.height,
      grid: m.grid,
      tokens: m.tokens,
      fogOfWar: m.fogOfWar,
      wallSegments: m.wallSegments,
      terrain: m.terrain,
      createdAt: m.createdAt
    })),
    turnMode: gs.turnMode,
    initiative: gs.initiative,
    round: gs.round,
    conditions: gs.conditions,
    isPaused: gs.isPaused,
    turnStates: gs.turnStates,
    underwaterCombat: gs.underwaterCombat,
    flankingEnabled: gs.flankingEnabled,
    groupInitiativeEnabled: gs.groupInitiativeEnabled,
    ambientLight: gs.ambientLight,
    diagonalRule: gs.diagonalRule,
    travelPace: gs.travelPace,
    marchingOrder: gs.marchingOrder,
    inGameTime: gs.inGameTime,
    allies: gs.allies,
    enemies: gs.enemies,
    places: gs.places,
    handouts: gs.handouts,
    shopOpen: gs.shopOpen,
    shopName: gs.shopName,
    shopInventory: gs.shopInventory
  }
}

function applyGameState(data: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useGameStore.getState().loadGameState(data as any)
}

function handleGameStateUpdate(payload: Record<string, unknown>): void {
  const gs = useGameStore.getState()

  if (payload.addToken) {
    const { mapId, token } = payload.addToken as { mapId: string; token: import('../types/map').MapToken }
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
      updates: Partial<import('../types/map').MapToken>
    }
    gs.updateToken(mapId, tokenId, updates)
    return
  }

  if (payload.addMap) {
    gs.addMap(payload.addMap as import('../types/map').GameMap)
    return
  }

  if (payload.wallSegments) {
    const { mapId, segments } = payload.wallSegments as {
      mapId: string
      segments: import('../types/map').WallSegment[]
    }
    const maps = gs.maps.map((m) => (m.id === mapId ? { ...m, wallSegments: segments } : m))
    useGameStore.setState({ maps })
    return
  }

  // Generic partial state update
  applyGameState(payload)
}
