import { create } from 'zustand'
import type {
  ConnectionState,
  ForceMutePayload,
  ForceDeafenPayload,
  MessageType,
  NetworkMessage,
  PeerInfo,
  ShopItem
} from '../network/types'
import * as hostManager from '../network/host-manager'
import * as clientManager from '../network/client-manager'
import { getPeerId } from '../network/peer-manager'
import { setForceMuted, setForceDeafened } from '../network/voice-manager'
import { useLobbyStore } from './useLobbyStore'
import type { GameStateFullPayload } from '../network/types'

interface NetworkState {
  role: 'none' | 'host' | 'client'
  connectionState: ConnectionState
  inviteCode: string | null
  campaignId: string | null
  localPeerId: string | null
  displayName: string
  peers: PeerInfo[]
  error: string | null

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

      // Register host-side event listeners
      hostManager.onPeerJoined((peer: PeerInfo) => {
        get().addPeer(peer)
      })

      hostManager.onPeerLeft((peer: PeerInfo) => {
        get().removePeer(peer.peerId)
      })

      hostManager.onMessage((message: NetworkMessage, fromPeerId: string) => {
        handleHostMessage(message, fromPeerId, get, set)
      })

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
    hostManager.stopHosting()
    set({
      role: 'none',
      connectionState: 'disconnected',
      inviteCode: null,
      campaignId: null,
      localPeerId: null,
      peers: [],
      error: null
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
    const { displayName } = get()
    // Force-deafen implies force-mute
    const isForceMuted = isForceDeafened ? true : false
    const message: NetworkMessage<ForceDeafenPayload> = {
      type: 'dm:force-deafen',
      payload: { peerId, isForceDeafened },
      senderId: getPeerId() || '',
      senderName: displayName,
      timestamp: Date.now(),
      sequence: 0
    }
    hostManager.broadcastMessage(message)
    get().updatePeer(peerId, { isForceDeafened, isForceMuted })
    useLobbyStore.getState().updatePlayer(peerId, { isForceDeafened, isForceMuted })
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
      // Register message handler before connecting
      clientManager.onMessage((message: NetworkMessage) => {
        handleClientMessage(message, get, set)
      })

      clientManager.onDisconnected((reason: string) => {
        set({
          connectionState: 'disconnected',
          role: 'none',
          inviteCode: null,
          campaignId: null,
          localPeerId: null,
          peers: [],
          error: reason
        })
      })

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
        error: null
      })
    }
  },

  // --- Shared actions ---

  sendMessage: (type: MessageType, payload: unknown) => {
    const { role, displayName } = get()
    if (role === 'host') {
      // Host broadcasts to all clients
      const message: NetworkMessage = {
        type,
        payload,
        senderId: getPeerId() || '',
        senderName: displayName,
        timestamp: Date.now(),
        sequence: 0
      }
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
      peers: state.peers.map((p) =>
        p.peerId === peerId ? { ...p, ...updates } : p
      )
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
          peers: state.peers.map((p) =>
            p.peerId === peer.peerId ? peer : p
          )
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
  }
}))

// --- Host-side message handlers ---

function handleHostMessage(
  message: NetworkMessage,
  fromPeerId: string,
  get: () => NetworkState,
  set: (partial: Partial<NetworkState> | ((state: NetworkState) => Partial<NetworkState>)) => void
): void {
  switch (message.type) {
    case 'player:ready': {
      const readyPayload = message.payload as { isReady?: boolean }
      get().updatePeer(fromPeerId, { isReady: readyPayload.isReady ?? true })
      // Rebroadcast to all clients so they see the updated peer list
      hostManager.broadcastMessage(message)
      break
    }

    case 'player:character-select': {
      const payload = message.payload as { characterId: string | null; characterName: string | null }
      get().updatePeer(fromPeerId, {
        characterId: payload.characterId,
        characterName: payload.characterName
      })
      // Rebroadcast
      hostManager.broadcastMessage(message)
      break
    }

    case 'voice:mute-toggle': {
      const payload = message.payload as { peerId: string; isMuted: boolean }
      get().updatePeer(fromPeerId, { isMuted: payload.isMuted })
      // Rebroadcast
      hostManager.broadcastMessage(message)
      break
    }

    case 'chat:message': {
      // Rebroadcast chat to all clients
      hostManager.broadcastMessage(message)
      break
    }

    case 'chat:file': {
      // Rebroadcast file messages to all clients
      hostManager.broadcastMessage(message)
      break
    }

    case 'player:color-change': {
      const colorPayload = message.payload as { color: string }
      get().updatePeer(fromPeerId, { color: colorPayload.color })
      useLobbyStore.getState().updatePlayer(fromPeerId, { color: colorPayload.color })
      // Rebroadcast
      hostManager.broadcastMessage(message)
      break
    }

    case 'chat:whisper': {
      // Forward whisper only to the target
      const payload = message.payload as { targetPeerId: string }
      hostManager.sendToPeer(payload.targetPeerId, message)
      break
    }

    case 'game:dice-roll': {
      // Rebroadcast dice rolls to all
      hostManager.broadcastMessage(message)
      break
    }

    case 'player:buy-item': {
      // Decrement shop inventory quantity and broadcast updated shop
      const buyPayload = message.payload as { itemId: string; itemName: string }
      // Lazy import to avoid circular dependency
      import('./useGameStore').then(({ useGameStore }) => {
        const gameStore = useGameStore.getState()
        const updatedInventory = gameStore.shopInventory.map((item: ShopItem) =>
          item.id === buyPayload.itemId && item.quantity > 0
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        gameStore.setShopInventory(updatedInventory)
        // Broadcast updated shop to all peers
        hostManager.broadcastMessage({
          type: 'dm:shop-update' as MessageType,
          payload: { shopInventory: updatedInventory, shopName: gameStore.shopName },
          senderId: getPeerId() || '',
          senderName: get().displayName,
          timestamp: Date.now(),
          sequence: 0
        })
      })
      // Rebroadcast the buy message so other clients see it
      hostManager.broadcastMessage(message)
      break
    }
    case 'player:sell-item': {
      // Forward shop transactions to host for processing
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
      // Full state sync from host — replace peer list and learn campaignId
      const payload = message.payload as GameStateFullPayload
      const updates: Partial<NetworkState> = { peers: payload.peers }
      if (payload.campaignId) {
        updates.campaignId = payload.campaignId
      }
      set(updates)
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
      const isForceMuted = payload.isForceDeafened ? true : false
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
        error: 'You were kicked from the game'
      })
      break
    }

    case 'dm:ban-player': {
      set({
        connectionState: 'disconnected',
        role: 'none',
        campaignId: null,
        peers: [],
        error: 'You were banned from the game'
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

    default: {
      // Other messages (chat, dice, game state) are handled by
      // consumers that subscribe to onMessage directly
      break
    }
  }
}
