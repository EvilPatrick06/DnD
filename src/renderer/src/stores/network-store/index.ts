import { create } from 'zustand'
import { LAST_SESSION_KEY } from '../../constants/app-constants'
import * as clientManager from '../../network/client-manager'
import * as hostManager from '../../network/host-manager'
import { sendToPeer, setGameStateProvider } from '../../network/host-manager'
import { getPeerId } from '../../network/peer-manager'
import type { ConnectionState, MessageType, NetworkGameState, NetworkMessage, PeerInfo } from '../../network/types'
import { handleClientMessage } from './client-handlers'
import { handleHostMessage } from './host-handlers'

// Lazy accessors to break circular dependency (network-store -> game/lobby-store -> network-store)
function getGameStore() {
  return (require('../use-game-store') as typeof import('../use-game-store')).useGameStore
}
function _getLobbyStore() {
  return (require('../use-lobby-store') as typeof import('../use-lobby-store')).useLobbyStore
}

const listenerCleanups: Array<() => void> = []
function clearListenerCleanups(): void {
  for (const fn of listenerCleanups) fn()
  listenerCleanups.length = 0
}

export interface NetworkState {
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
          // Lazy import to break circular dependency (network-store -> game-sync -> use-game-store -> network-store)
          import('../../network/game-sync')
            .then(({ buildFullGameStatePayload }) => buildFullGameStatePayload())
            .then((fullState) => {
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
            try {
              localStorage.removeItem(LAST_SESSION_KEY)
            } catch {
              /* ignore */
            }
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

// --- Game state helpers ---

function buildNetworkGameState(): NetworkGameState {
  const gs = getGameStore().getState()
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
