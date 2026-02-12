import type { GameSystem } from './game-system'
import type { GameMap } from './map'

export interface GameState {
  campaignId: string
  system: GameSystem
  activeMapId: string | null
  maps: GameMap[]
  turnMode: 'initiative' | 'free'
  initiative: InitiativeState | null
  round: number
  conditions: EntityCondition[]
  isPaused: boolean
}

export interface InitiativeState {
  entries: InitiativeEntry[]
  currentIndex: number
  round: number
}

export interface InitiativeEntry {
  id: string
  entityId: string
  entityName: string
  entityType: 'player' | 'npc' | 'enemy'
  roll: number
  modifier: number
  total: number
  iconPreset?: string
  isActive: boolean
}

export interface EntityCondition {
  id: string
  entityId: string
  entityName: string
  condition: string
  value?: number // For PF2e valued conditions like Clumsy 1-4
  duration: number | 'permanent'
  source: string
  appliedRound: number
}
