import type { AbilityAbbreviation, FeatCategory } from './shared-enums'

// === species.json ===

export interface SpeciesTrait {
  name: string
  description: string
  spellGranted?: string | { list: string; count: number }
}

export type SpeciesTraitsFile = Record<string, SpeciesTrait>

export interface SpeciesSubrace {
  id: string
  name: string
  description: string
  traitModifications: {
    add: SpeciesTrait[]
    remove: string[]
  }
  speedModifier?: number
  spellProgression?: Array<{ spellId: string; grantedAtLevel: number; innateUses: number }>
}

export interface SpeciesData {
  id: string
  name: string
  abilityBonuses: Record<string, number>
  speed: number
  size: string | string[]
  traits: SpeciesTrait[]
  languages: string[]
  proficiencies?: string[]
  subraces?: SpeciesSubrace[]
  source?: string
  creatureType?: string
}

export interface RawSpeciesSubrace {
  id: string
  name: string
  description: string
  traitModifications: {
    add: string[]
    remove: string[]
  }
  speedModifier?: number
  spellProgression?: Array<{ spellId: string; grantedAtLevel: number; innateUses: number }>
}

export interface RawSpeciesData {
  id: string
  name: string
  abilityBonuses: Record<string, number>
  speed: number
  size: string | string[]
  traits: string[]
  languages: string[]
  proficiencies?: string[]
  subraces?: RawSpeciesSubrace[]
  source?: string
  creatureType?: string
}

// === classes.json ===

export interface ClassProficiencies {
  armor: string[]
  weapons: string[]
  tools: string[]
  skills: { numToChoose: number; options: string[] }
}

export interface ClassArmorTraining {
  category?: string
}

export interface ClassWeaponProficiency {
  category?: string
}

export interface ClassCoreTraits {
  primaryAbility: string[]
  hitPointDie: string
  savingThrowProficiencies: string[]
  skillProficiencies: ClassProficiencies
  weaponProficiencies: ClassWeaponProficiency[]
  armorTraining: string[]
  startingEquipment: Array<{
    label: string
    items: string[]
    gp: number
  }>
}

export interface ClassMulticlassing {
  hitPointDie?: boolean
  weaponProficiencies?: ClassWeaponProficiency[]
  armorTraining?: string[]
}

export interface ClassLevelProgression {
  level: number
  proficiencyBonus: number
  features: string[]
  rages?: number
  rageDamage?: number
  weaponMastery?: number
  sneakAttack?: string
  martialArts?: string
  invocationsKnown?: number
  cantripsKnown?: number
  spellsPrepared?: number
  spellSlots?: Record<string, number>
}

export interface FeatureUsesPerRest {
  uses: number | string
  restType: 'Short' | 'Long'
  rechargeAlternative?: string
}

export interface FeatureSavingThrow {
  ability: string
  formula: string
}

export interface FeatureGrantedSpell {
  spell: string
  alwaysPrepared?: boolean
  ritualOnly?: boolean
  spellcastingAbility?: string
}

export interface ClassFeatureEntry {
  name: string
  level: number
  description: string
  activation: string
  replacesOrImproves?: string
  usesPerRest?: FeatureUsesPerRest
  options?: Array<{ name: string; description: string }>
  scalingValues?: Record<string, Array<{ level: number; value: number | string }>>
  grantsSpells?: FeatureGrantedSpell[]
  savingThrow?: FeatureSavingThrow
  conditionImmunities?: string[]
}

export interface SubclassFeatureEntry {
  name: string
  level: number
  description: string
  activation: string
  replacesOrImproves?: string
  usesPerRest?: FeatureUsesPerRest
  savingThrow?: FeatureSavingThrow
  options?: Array<{ name: string; description: string }>
  grantsSpells?: FeatureGrantedSpell[]
  conditionImmunities?: string[]
}

export interface SubclassData {
  name: string
  description: string
  featureLevels: number[]
  features: SubclassFeatureEntry[]
}

export interface ClassData {
  id?: string
  name: string
  description: string
  coreTraits: ClassCoreTraits
  multiclassing: ClassMulticlassing
  spellcasting?: {
    type: 'full' | 'half' | 'third' | 'pact'
    ability: string
    focus?: string[]
    ritualCasting?: 'none' | 'fromPrepared' | 'fromSpellbook'
    cantripsKnown?: boolean
    preparedSpellsMechanic?: string
    usesSpellbook?: boolean
    spellbookConfig?: {
      initialSpellCount: number
      spellsGainedPerLevel: number
      copyingCostPerLevelGP: number
      copyingTimePerLevel: string
    }
    pactMagic?: boolean
    initialCantrips: number
    initialPreparedSpells: number
  }
  levelProgression: ClassLevelProgression[]
  classFeatures: ClassFeatureEntry[]
  subclassLabel?: string
  subclassFeatureLevels?: number[]
  subclasses: SubclassData[]
}

// === backgrounds.json ===

export interface BackgroundData {
  id: string
  name: string
  description?: string
  proficiencies: { skills: string[]; tools: string[]; languages: number }
  equipment: Array<{ name: string; quantity: number }>
  startingGold: number
  originFeat?: string
  abilityScores?: AbilityAbbreviation[]
}

// === class-features.json ===

export interface ClassFeature {
  level: number
  name: string
  description: string
}

export interface ClassFeatureData {
  features: ClassFeature[]
  subclassLevel: number
  spellSlots: Record<string, Record<string, number>> | null
}

export type ClassFeaturesFile = Record<string, ClassFeatureData>

// === feats.json ===

export interface FeatChoiceConfig {
  type: 'ability' | 'skill' | 'element' | 'skill-and-expertise'
  label: string
  options?: string[]
}

export interface FeatData {
  id: string
  name: string
  category: FeatCategory
  level: number
  prerequisites: string[]
  description: string
  abilityScoreIncrease?: { options: string[]; amount: number } | null
  repeatable?: boolean
  source: string
  choiceConfig?: Record<string, FeatChoiceConfig>
}

// === Species Spells (species-spells.json) ===

export interface SpeciesSpellEntry {
  name: string
  level: number
  description: string
  castingTime: string
  range: string
  duration: string
  components: string
  school: string
  concentration?: boolean
  ritual?: boolean
}

export type SpeciesSpellsFile = Record<string, SpeciesSpellEntry>

// === Ability Score Config (ability-score-config.json) ===

export interface AbilityScoreConfigFile {
  pointBuyCosts: Record<string, number>
  pointBuyBudget: number
  standardArray: number[]
  defaultScores: Record<string, number>
  pointBuyStart: Record<string, number>
  methods: Array<{ id: string; label: string; desc: string }>
  standardArrayByClass: Record<string, Record<string, number>>
  classDisplayOrder: string[]
}

// === Preset Icons (preset-icons.json) ===

export interface PresetIcon {
  id: string
  label: string
  emoji: string
}

// === Resource Scaling (class-resources.json, species-resources.json) ===

export interface ResourceScaling {
  minLevel: number
  maxLevel?: number
  max?: number
  maxFormula?: 'profBonus' | 'classLevel' | 'classLevel*5' | 'wisdomMod'
}

export interface ResourceDefinition {
  id: string
  name: string
  shortRestRestore: number | 'all'
  scaling: ResourceScaling[]
}

export interface ClassResourcesFile {
  classes: Record<string, { resources: ResourceDefinition[] }>
  feats: Record<string, ResourceDefinition>
}

export interface SpeciesResourceEntry {
  resources: ResourceDefinition[]
  heritages?: Record<string, ResourceDefinition[]>
}

export interface SpeciesResourcesFile {
  species: Record<string, SpeciesResourceEntry>
}
