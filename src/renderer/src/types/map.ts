export interface GameMap {
  id: string
  name: string
  campaignId: string

  imagePath: string
  width: number
  height: number

  grid: GridSettings
  tokens: MapToken[]
  fogOfWar: FogOfWarData

  createdAt: string
}

export interface GridSettings {
  enabled: boolean
  cellSize: number
  offsetX: number
  offsetY: number
  color: string
  opacity: number
  type: 'square' | 'hex'
}

export interface MapToken {
  id: string
  entityId: string
  entityType: 'player' | 'npc' | 'enemy'
  label: string
  imagePath?: string

  gridX: number
  gridY: number

  sizeX: number
  sizeY: number

  visibleToPlayers: boolean
  conditions: string[]
  currentHP?: number
  maxHP?: number
}

export interface FogOfWarData {
  enabled: boolean
  revealedCells: Array<{ x: number; y: number }>
}
