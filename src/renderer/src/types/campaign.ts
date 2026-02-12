import type { GameSystem } from './game-system'
import type { GameMap } from './map'

export type CampaignType = 'preset' | 'custom'
export type TurnMode = 'initiative' | 'free'

export interface LoreEntry {
  id: string
  title: string
  content: string
  category: 'world' | 'faction' | 'location' | 'item' | 'other'
  isVisibleToPlayers: boolean
  createdAt: string
}

export interface Campaign {
  id: string
  name: string
  description: string
  system: GameSystem
  type: CampaignType
  presetId?: string
  dmId: string
  inviteCode: string
  turnMode: TurnMode
  maps: GameMap[]
  activeMapId?: string
  npcs: NPC[]
  lore?: LoreEntry[]
  players: CampaignPlayer[]
  customRules: CustomRule[]
  settings: CampaignSettings
  journal: SessionJournal
  createdAt: string
  updatedAt: string
}

export interface CampaignSettings {
  maxPlayers: number
  voiceEnabled: boolean
  lobbyMessage: string
  levelRange: { min: number; max: number }
  allowCharCreationInLobby: boolean
}

export interface CampaignPlayer {
  userId: string
  displayName: string
  characterId: string | null
  joinedAt: string
  isActive: boolean
  isReady: boolean
}

export interface CustomRule {
  id: string
  name: string
  description: string
  category: 'combat' | 'exploration' | 'social' | 'rest' | 'other'
}

export interface NPC {
  id: string
  name: string
  description: string
  portraitPath?: string
  location?: string
  isVisible: boolean
  stats?: Record<string, unknown>
  notes: string
}

export interface SessionJournal {
  entries: JournalEntry[]
}

export interface JournalEntry {
  id: string
  sessionNumber: number
  date: string
  title: string
  content: string
  isPrivate: boolean
  authorId: string
  createdAt: string
}

export type { GameMap } from './map'
