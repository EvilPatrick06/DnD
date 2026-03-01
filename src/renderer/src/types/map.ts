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
  wallSegments?: WallSegment[]
  terrain: TerrainCell[]
  floors?: Array<{ id: string; name: string }>
  audioEmitters?: Array<{
    id: string
    x: number
    y: number
    soundId: string
    displayName: string
    radius: number
    volume: number
    spatial: boolean
  }>

  createdAt: string
}

export interface TerrainCell {
  x: number
  y: number
  type: 'difficult' | 'hazard' | 'water' | 'climbing' | 'portal'
  movementCost: number // 2 for difficult terrain, water, or climbing (without swim/climb speed)
  /** Hazard subtype for damage on entry (C5) */
  hazardType?: 'fire' | 'acid' | 'pit' | 'spikes'
  /** Damage dealt by hazard on entry */
  hazardDamage?: number
  /** Portal destination: target map and grid position */
  portalTarget?: {
    mapId: string
    gridX: number
    gridY: number
  }
}

/** Darkvision: derived from species data — Elf, Dwarf, Gnome, Tiefling, Half-Elf */
export const DARKVISION_SPECIES = ['elf', 'dwarf', 'gnome', 'tiefling', 'half-elf']

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
  /** Elevation in feet (0 = ground level). Positive = flying/elevated, negative = below ground. */
  elevation?: number
  /** Floor index this token is on (for multi-floor maps) */
  floor?: number

  sizeX: number
  sizeY: number

  visibleToPlayers: boolean
  /** Whether the token's name label is visible to players (default true for PCs, false for monsters) */
  nameVisible?: boolean
  conditions: string[]
  currentHP?: number
  maxHP?: number
  ac?: number
  monsterStatBlockId?: string
  walkSpeed?: number
  initiativeModifier?: number

  /** Damage resistances (e.g., "fire", "bludgeoning") */
  resistances?: string[]
  /** Damage vulnerabilities */
  vulnerabilities?: string[]
  /** Damage immunities */
  immunities?: string[]
  /** Whether this creature has darkvision */
  darkvision?: boolean
  /** Darkvision range in feet (e.g. 60, 120). Overrides darkvision boolean when set. */
  darkvisionRange?: number
  /** Swim speed in feet (0 or undefined = no swim speed) */
  swimSpeed?: number
  /** Climb speed in feet (0 or undefined = no climb speed) */
  climbSpeed?: number
  /** Fly speed in feet (0 or undefined = no fly speed) */
  flySpeed?: number
  /** Special senses (informational, for DM adjudication) */
  specialSenses?: Array<{ type: 'blindsight' | 'tremorsense' | 'truesight'; range: number }>
  /** Entity ID of the rider on this mount (Phase 4 - mounted combat) */
  riderId?: string
  /** Character ID of the companion's owner */
  ownerEntityId?: string
  /** Companion type for visual/behavioral differentiation */
  companionType?: 'familiar' | 'wildShape' | 'steed' | 'summoned'
  /** Spell that created this token */
  sourceSpell?: string

  /** Save modifier for unarmed strike grapple/shove contests */
  saveMod?: number
  /** Custom token color (hex string) */
  color?: string
  /** Custom border color (hex string) */
  borderColor?: string
  /** Border style for rendering */
  borderStyle?: 'solid' | 'dashed' | 'double'
  /** Font size for the token label (8-24) */
  labelFontSize?: number
}

export interface WallSegment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'solid' | 'door' | 'window'
  isOpen?: boolean
}

export interface FogOfWarData {
  enabled: boolean
  revealedCells: Array<{ x: number; y: number }>
  /** Cells auto-revealed by player movement (shown dimmed when out of current vision) */
  exploredCells?: Array<{ x: number; y: number }>
  /** DM toggle for automatic vision-driven fog reveal */
  dynamicFogEnabled?: boolean
}
