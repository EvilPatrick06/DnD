import { create } from 'zustand'
import type { DiceColors } from '../components/game/dice3d'
import { DEFAULT_DICE_COLORS } from '../components/game/dice3d'
import { PLAYER_COLORS } from '../network/types'
import { setDeafened, setMuted, setRemotePeerMuted } from '../network/voice-manager'
import type { Character } from '../types/character'

export interface LobbyPlayer {
  peerId: string
  displayName: string
  characterId: string | null
  characterName: string | null
  isReady: boolean
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  isHost: boolean
  isForceMuted: boolean
  isForceDeafened: boolean
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
  localMuted: boolean
  localDeafened: boolean
  isHost: boolean
  locallyMutedPeers: Set<string>
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
  toggleMute: () => void
  toggleDeafen: () => void
  setIsHost: (isHost: boolean) => void
  allPlayersReady: () => boolean
  toggleLocalMutePlayer: (peerId: string) => void
  forceMutePlayer: (peerId: string, force: boolean) => void
  forceDeafenPlayer: (peerId: string, force: boolean) => void
  setRemoteCharacter: (characterId: string, character: Character) => void
  setSlowMode: (seconds: number) => void
  setFileSharingEnabled: (enabled: boolean) => void
  setChatMutedUntil: (timestamp: number | null) => void
  setDiceColors: (peerId: string, colors: DiceColors) => void
  getLocalDiceColors: () => DiceColors
  reset: () => void
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}

function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } | null {
  // Matches patterns like: 1d20, 2d6+3, 4d8-1, d12
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/)
  if (!match) return null
  return {
    count: match[1] ? parseInt(match[1], 10) : 1,
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0
  }
}

function rollDice(formula: string): { formula: string; total: number; rolls: number[] } | null {
  const parsed = parseDiceFormula(formula)
  if (!parsed) return null

  const rolls: number[] = []
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(Math.floor(Math.random() * parsed.sides) + 1)
  }
  const total = rolls.reduce((sum, r) => sum + r, 0) + parsed.modifier

  return { formula, total, rolls }
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  campaignId: null,
  players: [],
  chatMessages: [],
  localMuted: false,
  localDeafened: false,
  isHost: false,
  locallyMutedPeers: new Set<string>(),
  remoteCharacters: {},
  slowModeSeconds: 0,
  fileSharingEnabled: true,
  chatMutedUntil: null,

  setCampaignId: (id) => set({ campaignId: id }),

  addPlayer: (player) => {
    set((state) => {
      const exists = state.players.some((p) => p.peerId === player.peerId)
      if (exists) {
        return {
          players: state.players.map((p) => (p.peerId === player.peerId ? player : p))
        }
      }
      // Assign a color if none set
      if (!player.color) {
        const usedColors = new Set(state.players.map((p) => p.color))
        const available = PLAYER_COLORS.find((c) => !usedColors.has(c))
        player = { ...player, color: available || PLAYER_COLORS[state.players.length % PLAYER_COLORS.length] }
      }
      return { players: [...state.players, player] }
    })

    // Add system message
    const systemMsg: ChatMessage = {
      id: generateMessageId(),
      senderId: 'system',
      senderName: 'System',
      content: `${player.displayName} has joined the lobby.`,
      timestamp: Date.now(),
      isSystem: true
    }
    get().addChatMessage(systemMsg)
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
      chatMessages: [...state.chatMessages, msg]
    }))
  },

  sendChat: (content) => {
    const trimmed = content.trim().slice(0, 2000)
    if (!trimmed) return

    // Handle /roll command
    if (trimmed.startsWith('/roll ')) {
      const formula = trimmed.slice(6).trim()
      const result = rollDice(formula)

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
      } else {
        // Invalid dice formula
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
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx > 0) {
        const targetName = rest.slice(0, spaceIdx)
        const whisperContent = rest.slice(spaceIdx + 1)

        const msg: ChatMessage = {
          id: generateMessageId(),
          senderId: 'local',
          senderName: 'You',
          content: `[Whisper to ${targetName}]: ${whisperContent}`,
          timestamp: Date.now(),
          isSystem: false
        }
        get().addChatMessage(msg)
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
  },

  toggleMute: () => {
    const newMuted = !get().localMuted
    setMuted(newMuted)
    set({ localMuted: newMuted })
  },

  toggleDeafen: () => {
    const newDeafened = !get().localDeafened
    setDeafened(newDeafened)
    set({
      localDeafened: newDeafened,
      localMuted: newDeafened ? true : get().localMuted
    })
  },

  setIsHost: (isHost) => set({ isHost }),

  allPlayersReady: () => {
    const { players } = get()
    if (players.length === 0) return false
    return players.every((p) => p.isReady)
  },

  toggleLocalMutePlayer: (peerId: string) => {
    set((state) => {
      const newSet = new Set(state.locallyMutedPeers)
      const isMuted = newSet.has(peerId)
      if (isMuted) {
        newSet.delete(peerId)
      } else {
        newSet.add(peerId)
      }
      setRemotePeerMuted(peerId, !isMuted)
      return { locallyMutedPeers: newSet }
    })
  },

  forceMutePlayer: (peerId: string, force: boolean) => {
    set((state) => ({
      players: state.players.map((p) => (p.peerId === peerId ? { ...p, isForceMuted: force } : p))
    }))
  },

  forceDeafenPlayer: (peerId: string, force: boolean) => {
    set((state) => ({
      players: state.players.map((p) =>
        p.peerId === peerId ? { ...p, isForceDeafened: force, isForceMuted: force ? true : p.isForceMuted } : p
      )
    }))
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
      players: state.players.map((p) =>
        p.peerId === peerId ? { ...p, diceColors: colors } : p
      )
    }))
  },

  getLocalDiceColors: () => {
    const { players } = get()
    const localPlayer = players.find((p) => p.isHost) || players[0]
    return localPlayer?.diceColors || DEFAULT_DICE_COLORS
  },

  reset: () =>
    set({
      campaignId: null,
      players: [],
      chatMessages: [],
      localMuted: false,
      localDeafened: false,
      isHost: false,
      locallyMutedPeers: new Set<string>(),
      remoteCharacters: {},
      slowModeSeconds: 0,
      fileSharingEnabled: true,
      chatMutedUntil: null
    })
}))
