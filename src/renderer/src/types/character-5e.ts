import type { AbilityScoreSet, AbilityName, CampaignHistoryEntry, SpellEntry, ClassFeatureEntry, ArmorEntry, WeaponEntry, Currency, ActiveCondition } from './character-common'

export interface Character5e {
  id: string
  gameSystem: 'dnd5e'
  campaignId: string | null
  playerId: string

  name: string
  race: string
  subrace?: string
  classes: CharacterClass5e[]
  level: number
  background: string
  alignment: string
  xp: number

  abilityScores: AbilityScoreSet
  hitPoints: HitPoints
  armorClass: number
  initiative: number
  speed: number

  details: CharacterDetails
  proficiencies: Proficiencies5e
  skills: SkillProficiency5e[]

  spellcasting?: SpellcastingInfo5e

  equipment: EquipmentItem[]
  treasure: Currency
  features: Feature[]

  knownSpells: SpellEntry[]
  preparedSpellIds: string[]
  spellSlotLevels: Record<number, { current: number; max: number }>
  classFeatures: ClassFeatureEntry[]
  weapons: WeaponEntry[]
  armor: ArmorEntry[]
  feats: Array<{ id: string; name: string; description: string }>

  buildChoices: BuildChoices5e

  status: 'active' | 'retired' | 'deceased'
  campaignHistory: CampaignHistoryEntry[]

  backstory: string
  notes: string
  heroPoints: number
  pets: Array<{ name: string }>
  conditions: ActiveCondition[]
  iconPreset?: string
  portraitPath?: string
  createdAt: string
  updatedAt: string
}

export interface BuildChoices5e {
  raceId: string
  subraceId?: string
  classId: string
  subclassId?: string
  backgroundId: string
  selectedSkills: string[]
  abilityScoreMethod: 'standard' | 'pointBuy' | 'roll' | 'custom'
  abilityScoreAssignments: Record<string, number>
  asiChoices?: Record<string, string[]>
  chosenLanguages?: string[]
  speciesAbilityBonuses?: Record<string, number>
}

export interface CharacterClass5e {
  name: string
  level: number
  subclass?: string
  hitDie: number
}

export interface HitPoints {
  current: number
  maximum: number
  temporary: number
}

export interface CharacterDetails {
  gender?: string
  deity?: string
  age?: string
  height?: string
  weight?: string
  eyes?: string
  hair?: string
  skin?: string
  personality?: string
  ideals?: string
  bonds?: string
  flaws?: string
}

export interface Proficiencies5e {
  weapons: string[]
  armor: string[]
  tools: string[]
  languages: string[]
  savingThrows: AbilityName[]
}

export interface SkillProficiency5e {
  name: string
  ability: AbilityName
  proficient: boolean
  expertise: boolean
}

export interface SpellcastingInfo5e {
  ability: AbilityName
  spellSaveDC: number
  spellAttackBonus: number
}

export interface EquipmentItem {
  name: string
  quantity: number
  weight?: number
  description?: string
  source?: string
}

export interface Feature {
  name: string
  source: string
  description: string
}
