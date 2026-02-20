export type GameSystem = 'dnd5e'

export interface GameSystemConfig {
  id: GameSystem
  name: string
  shortName: string
  maxLevel: number
  dataPath: string
  referenceLabel: string
}

export const GAME_SYSTEMS: Record<GameSystem, GameSystemConfig> = {
  dnd5e: {
    id: 'dnd5e',
    name: 'D&D 5th Edition',
    shortName: '5e',
    maxLevel: 20,
    dataPath: './data/5e',
    referenceLabel: 'SRD'
  }
}
