import type { AbilityScoreSet, AbilityName, CampaignHistoryEntry, SpellEntry, ArmorEntry, WeaponEntry, ActiveCondition } from './character-common'

export type ProficiencyRank = 'untrained' | 'trained' | 'expert' | 'master' | 'legendary'

export interface CharacterPf2e {
  id: string
  gameSystem: 'pf2e'
  campaignId: string | null
  playerId: string

  name: string
  ancestryId: string
  ancestryName: string
  heritageId: string
  heritageName: string
  backgroundId: string
  backgroundName: string
  classId: string
  className: string
  level: number
  xp: number

  abilityScores: AbilityScoreSet
  abilityBoosts: AbilityBoostSource[]

  hitPoints: { current: number; maximum: number; temporary: number }
  armorClass: number
  speed: number
  size: string

  saves: {
    fortitude: ProficiencyRank
    reflex: ProficiencyRank
    will: ProficiencyRank
  }

  perception: ProficiencyRank
  classDC: ProficiencyRank

  skills: SkillProficiencyPf2e[]

  attacks: {
    simple: ProficiencyRank
    martial: ProficiencyRank
    unarmed: ProficiencyRank
    advanced?: ProficiencyRank
  }

  defenses: {
    unarmored: ProficiencyRank
    light: ProficiencyRank
    medium: ProficiencyRank
    heavy: ProficiencyRank
  }

  ancestryFeats: FeatChoice[]
  classFeats: FeatChoice[]
  skillFeats: FeatChoice[]
  generalFeats: FeatChoice[]
  classFeatures: ClassFeaturePf2e[]

  equipment: EquipmentItemPf2e[]
  treasure: { cp: number; sp: number; gp: number; pp: number }
  languages: string[]

  knownSpells: SpellEntry[]
  preparedSpellIds: string[]
  spellSlotLevels: Record<number, { current: number; max: number }>
  focusPoints: { current: number; max: number }
  spellTradition?: string
  weapons: WeaponEntry[]
  armor: ArmorEntry[]

  details: {
    gender?: string
    deity?: string
    age?: string
    height?: string
    weight?: string
    appearance?: string
    personality?: string
    backstory?: string
  }

  buildChoices: BuildChoicesPf2e

  status: 'active' | 'retired' | 'deceased'
  campaignHistory: CampaignHistoryEntry[]

  notes: string
  heroPoints: number
  pets: Array<{ name: string }>
  conditions: ActiveCondition[]
  iconPreset?: string
  portraitPath?: string
  createdAt: string
  updatedAt: string
}

export interface AbilityBoostSource {
  source: 'ancestry' | 'background' | 'class' | 'free' | 'level'
  level?: number
  ability: AbilityName
}

export interface FeatChoice {
  level: number
  featId: string
  featName: string
}

export interface ClassFeaturePf2e {
  level: number
  name: string
  description: string
}

export interface SkillProficiencyPf2e {
  name: string
  ability: AbilityName
  rank: ProficiencyRank
  source: string
}

export interface EquipmentItemPf2e {
  name: string
  quantity: number
  bulk?: number
  description?: string
  source?: string
}

export interface BuildChoicesPf2e {
  ancestryId: string
  heritageId: string
  backgroundId: string
  classId: string
  keyAbility: AbilityName
  abilityBoosts: AbilityBoostSource[]
  selectedAncestryFeats: FeatChoice[]
  selectedClassFeats: FeatChoice[]
  selectedSkillFeats: FeatChoice[]
  selectedGeneralFeats: FeatChoice[]
  selectedSkillIncreases: Array<{ level: number; skill: string }>
  chosenLanguages?: string[]
  pf2eAbilityBoosts?: Array<{ source: string; ability: string }>
}

export function proficiencyBonus(rank: ProficiencyRank, level: number): number {
  switch (rank) {
    case 'untrained': return 0
    case 'trained': return level + 2
    case 'expert': return level + 4
    case 'master': return level + 6
    case 'legendary': return level + 8
  }
}
