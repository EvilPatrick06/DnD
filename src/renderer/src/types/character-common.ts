export interface AbilityScoreSet {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

export type AbilityName = keyof AbilityScoreSet

export const ABILITY_NAMES: AbilityName[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'
]

export type Rarity = 'common' | 'uncommon' | 'rare' | 'unique'

export type BuildSlotCategory =
  | 'ancestry'
  | 'heritage'
  | 'background'
  | 'class'
  | 'ancestry-feat'
  | 'class-feat'
  | 'skill-feat'
  | 'general-feat'
  | 'ability-boost'
  | 'class-feature'
  | 'skill-choice'
  | 'ability-scores'

export interface BuildSlot {
  id: string
  label: string
  category: BuildSlotCategory
  level: number
  selectedId: string | null
  selectedName: string | null
  selectedDescription?: string | null
  selectedDetailFields?: DetailField[] | null
  required: boolean
  isAutoGranted?: boolean
}

export const STANDARD_LANGUAGES_5E = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'
]

export const EXOTIC_LANGUAGES_5E = [
  'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
]

export const ALL_LANGUAGES_5E = [...STANDARD_LANGUAGES_5E, ...EXOTIC_LANGUAGES_5E]

export interface SelectableOption {
  id: string
  name: string
  rarity: Rarity
  description: string
  traits: string[]
  level?: number
  prerequisites?: string[]
  source: string
  detailFields: DetailField[]
}

export interface DetailField {
  label: string
  value: string
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export interface CampaignHistoryEntry {
  campaignId: string
  campaignName: string
  joinedAt: string
  leftAt?: string
  role: 'player' | 'dm'
}

export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

// === Unified types for new character sheet ===

export interface SpellEntry {
  id: string
  name: string
  level: number
  description: string
  castingTime: string
  range: string
  duration: string
  components: string
  school?: string
  concentration?: boolean
  ritual?: boolean
  traditions?: string[]
  traits?: string[]
  heightened?: Record<string, string>
  classes?: string[]
  prepared?: boolean
}

export interface WeaponEntry {
  id: string
  name: string
  damage: string
  damageType: string
  attackBonus: number
  properties: string[]
  hands?: string
  group?: string
  bulk?: string
  range?: string
  proficient?: boolean
}

export interface ArmorEntry {
  id: string
  name: string
  acBonus: number
  equipped: boolean
  type: 'armor' | 'shield'
  category?: string
  dexCap?: number | null
  stealthDisadvantage?: boolean
  checkPenalty?: number
  speedPenalty?: number
  strength?: number
  bulk?: number
  hardness?: number
  shieldHP?: number
  shieldBT?: number
}

export interface Currency {
  cp: number
  sp: number
  gp: number
  pp: number
  ep?: number
}

export interface ClassFeatureEntry {
  level: number
  name: string
  source: string
  description: string
}

export interface ActiveCondition {
  name: string
  type: 'condition' | 'buff'
  isCustom: boolean
  value?: number
}
