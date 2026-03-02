import { create } from 'zustand'
import type { DiceColors } from '../components/game/dice3d'
import { DEFAULT_DICE_COLORS } from '../components/game/dice3d'
import { MAX_CHAT_LENGTH } from '../constants'
import { PLAYER_COLORS } from '../network/types'
import { rollFormula } from '../services/dice/dice-engine'
import type { Character } from '../types/character'

function getNetworkStore(): typeof import('./use-network-store').useNetworkStore {
  return (require('./use-network-store') as typeof import('./use-network-store')).useNetworkStore
}

export interface LobbyPlayer {
  peerId: string
  displayName: string
  characterId: string | null
  characterName: string | null
  isReady: boolean
  isHost: boolean
  color?: string
  isCoDM?: boolean
  diceColors?: DiceColors
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
  isSystem: boolean
  isDiceRoll?: boolean
  diceResult?: { formula: string; total: number; rolls: number[] }
  senderColor?: string
  isFile?: boolean
  fileName?: string
  fileType?: string
  fileData?: string
  mimeType?: string
}

interface LobbyState {
  campaignId: string | null
  players: LobbyPlayer[]
  chatMessages: ChatMessage[]
  isHost: boolean
  locallyMutedPeers: string[]
  remoteCharacters: Record<string, Character>
  slowModeSeconds: number
  fileSharingEnabled: boolean
  chatMutedUntil: number | null // timestamp (ms) until which local player is chat-muted

  setCampaignId: (id: string | null) => void
  addPlayer: (player: LobbyPlayer) => void
  removePlayer: (peerId: string) => void
  updatePlayer: (peerId: string, updates: Partial<LobbyPlayer>) => void
  setPlayerReady: (peerId: string, ready: boolean) => void
  addChatMessage: (msg: ChatMessage) => void
  sendChat: (content: string) => void
  setIsHost: (isHost: boolean) => void
  allPlayersReady: () => boolean
  toggleLocalMutePlayer: (peerId: string) => void
  setRemoteCharacter: (characterId: string, character: Character) => void
  setSlowMode: (seconds: number) => void
  setFileSharingEnabled: (enabled: boolean) => void
  setChatMutedUntil: (timestamp: number | null) => void
  setDiceColors: (peerId: string, colors: DiceColors) => void
  getLocalDiceColors: (localPeerId?: string | null) => DiceColors
  reset: () => void
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}

// Dice rolling delegated to services/dice-engine.ts

export const useLobbyStore = create<LobbyState>((set, get) => ({
  campaignId: null,
  players: [],
  chatMessages: [],
  isHost: false,
  locallyMutedPeers: [],
  remoteCharacters: {},
  slowModeSeconds: 0,
  fileSharingEnabled: true,
  chatMutedUntil: null,

  setCampaignId: (id) => set({ campaignId: id }),

  addPlayer: (player) => {
    let shouldNotify = false
    set((state) => {
      const exists = state.players.some((p) => p.peerId === player.peerId)
      if (exists) {
        return {
          players: state.players.map((p) => (p.peerId === player.peerId ? player : p))
        }
      }
      shouldNotify = true
      // Assign a color if none set
      if (!player.color) {
        const usedColors = new Set(state.players.map((p) => p.color))
        const available = PLAYER_COLORS.find((c) => !usedColors.has(c))
        player = { ...player, color: available || PLAYER_COLORS[state.players.length % PLAYER_COLORS.length] }
      }
      return { players: [...state.players, player] }
    })

    // Only show "joined" message for new players, not updates
    if (shouldNotify) {
      const systemMsg: ChatMessage = {
        id: generateMessageId(),
        senderId: 'system',
        senderName: 'System',
        content: `${player.displayName} has joined the lobby.`,
        timestamp: Date.now(),
        isSystem: true
      }
      get().addChatMessage(systemMsg)
    }
  },

  removePlayer: (peerId) => {
    const player = get().players.find((p) => p.peerId === peerId)
    set((state) => ({
      players: state.players.filter((p) => p.peerId !== peerId)
    }))

    if (player) {
      const systemMsg: ChatMessage = {
        id: generateMessageId(),
        senderId: 'system',
        senderName: 'System',
        content: `${player.displayName} has left the lobby.`,
        timestamp: Date.now(),
        isSystem: true
      }
      get().addChatMessage(systemMsg)
    }
  },

  updatePlayer: (peerId, updates) => {
    set((state) => ({
      players: state.players.map((p) => (p.peerId === peerId ? { ...p, ...updates } : p))
    }))
  },

  setPlayerReady: (peerId, ready) => {
    set((state) => ({
      players: state.players.map((p) => (p.peerId === peerId ? { ...p, isReady: ready } : p))
    }))
  },

  addChatMessage: (msg) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, msg].slice(-500)
    }))
  },

  sendChat: (content) => {
    const trimmed = content.trim().slice(0, MAX_CHAT_LENGTH)
    if (!trimmed) return

    const { role, sendMessage } = getNetworkStore().getState()
    const isNetworked = role === 'host' || role === 'client'

    // Handle /roll command
    if (trimmed.startsWith('/roll ')) {
      const formula = trimmed.slice(6).trim()
      const result = rollFormula(formula)

      if (result) {
        const msg: ChatMessage = {
          id: generateMessageId(),
          senderId: 'local',
          senderName: 'You',
          content: `rolled ${result.formula}`,
          timestamp: Date.now(),
          isSystem: false,
          isDiceRoll: true,
          diceResult: result
        }
        get().addChatMessage(msg)

        if (isNetworked) {
          sendMessage('chat:message', {
            message: `rolled ${result.formula}`,
            isSystem: false,
            isDiceRoll: true,
            diceResult: result
          })
        }
      } else {
        const msg: ChatMessage = {
          id: generateMessageId(),
          senderId: 'system',
          senderName: 'System',
          content: `Invalid dice formula: "${formula}". Use format like 1d20, 2d6+3, etc.`,
          timestamp: Date.now(),
          isSystem: true
        }
        get().addChatMessage(msg)
      }
      return
    }

    // Handle /w whisper command
    if (trimmed.startsWith('/w ')) {
      const rest = trimmed.slice(3).trim()
      // Support quoted names: /w "Name With Spaces" message
      let targetName: string
      let whisperContent: string
      if (rest.startsWith('"')) {
        const closeQuote = rest.indexOf('"', 1)
        if (closeQuote > 1) {
          targetName = rest.slice(1, closeQuote)
          whisperContent = rest.slice(closeQuote + 1).trim()
        } else {
          return
        }
      } else {
        const spaceIdx = rest.indexOf(' ')
        if (spaceIdx <= 0) return
        targetName = rest.slice(0, spaceIdx)
        whisperContent = rest.slice(spaceIdx + 1)
      }

      if (!whisperContent) return

      const msg: ChatMessage = {
        id: generateMessageId(),
        senderId: 'local',
        senderName: 'You',
        content: `[Whisper to ${targetName}]: ${whisperContent}`,
        timestamp: Date.now(),
        isSystem: false
      }
      get().addChatMessage(msg)

      if (isNetworked) {
        // Find the target peer by display name (case-insensitive)
        const peers = getNetworkStore().getState().peers
        const target = peers.find((p) => p.displayName.toLowerCase() === targetName.toLowerCase())
        if (target) {
          sendMessage('chat:whisper', {
            message: whisperContent,
            targetPeerId: target.peerId,
            targetName: target.displayName
          })
        }
      }
      return
    }

    // Normal chat message
    const msg: ChatMessage = {
      id: generateMessageId(),
      senderId: 'local',
      senderName: 'You',
      content: trimmed,
      timestamp: Date.now(),
      isSystem: false
    }
    get().addChatMessage(msg)

    if (isNetworked) {
      sendMessage('chat:message', { message: trimmed, isSystem: false })
    }
  },

  setIsHost: (isHost) => set({ isHost }),

  allPlayersReady: () => {
    const { players } = get()
    if (players.length === 0) return false
    return players.every((p) => p.isReady)
  },

  toggleLocalMutePlayer: (peerId: string) => {
    set((state) => {
      const isMuted = state.locallyMutedPeers.includes(peerId)
      return {
        locallyMutedPeers: isMuted
          ? state.locallyMutedPeers.filter((id) => id !== peerId)
          : [...state.locallyMutedPeers, peerId]
      }
    })
  },

  setRemoteCharacter: (characterId: string, character: Character) => {
    set((state) => ({
      remoteCharacters: { ...state.remoteCharacters, [characterId]: character }
    }))
  },

  setSlowMode: (seconds: number) => set({ slowModeSeconds: seconds }),

  setFileSharingEnabled: (enabled: boolean) => set({ fileSharingEnabled: enabled }),

  setChatMutedUntil: (timestamp: number | null) => set({ chatMutedUntil: timestamp }),

  setDiceColors: (peerId: string, colors: DiceColors) => {
    set((state) => ({
      players: state.players.map((p) => (p.peerId === peerId ? { ...p, diceColors: colors } : p))
    }))
  },

  getLocalDiceColors: (localPeerId?: string | null) => {
    const { players } = get()
    const localPlayer =
      (localPeerId ? players.find((p) => p.peerId === localPeerId) : undefined) ??
      players.find((p) => p.isHost) ??
      (players.length > 0 ? players[0] : undefined)
    return localPlayer?.diceColors || DEFAULT_DICE_COLORS
  },

  reset: () =>
    set({
      campaignId: null,
      players: [],
      chatMessages: [],
      isHost: false,
      locallyMutedPeers: [],
      remoteCharacters: {},
      slowModeSeconds: 0,
      fileSharingEnabled: true,
      chatMutedUntil: null
    })
}))
