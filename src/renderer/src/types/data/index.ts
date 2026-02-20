// ============================================================================
// Auto-Generated TypeScript Interfaces for 5e JSON Data Files
// Each interface maps to a JSON file in src/renderer/public/data/5e/
// ============================================================================

// === Shared Enums / Literal Unions ===

export type AbilityAbbreviation = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

export type DamageType =
  | 'bludgeoning'
  | 'piercing'
  | 'slashing'
  | 'acid'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'thunder'

export type SpellSchool =
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Illusion'
  | 'Necromancy'
  | 'Transmutation'

export type SpellListName = 'arcane' | 'divine' | 'primal'

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact'

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'

export type WeaponCategory = 'Simple Melee' | 'Simple Ranged' | 'Martial Melee' | 'Martial Ranged'

export type EncounterDifficulty = 'low' | 'moderate' | 'high'

export type FeatCategory = 'Origin' | 'General' | 'Fighting Style' | 'Epic Boon'

// === species.json ===

export interface SpeciesTrait {
  name: string
  description: string
  spellGranted?: string | { list: string; count: number }
}

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

// === classes.json ===

export interface ClassProficiencies {
  armor: string[]
  weapons: string[]
  tools: string[]
  skills: { numToChoose: number; options: string[] }
}

export interface ClassData {
  id: string
  name: string
  hitDie: number
  primaryAbility: string
  savingThrows: string[]
  proficiencies: ClassProficiencies
  startingEquipment: Array<{ name: string; quantity: number }>
  startingEquipmentOptions?: Record<
    string,
    {
      label: string
      equipment: Array<{ name: string; quantity: number }>
      gold: number
    }
  >
  startingGold?: number
  startingGoldAlternative?: number
  subclassLevel: number
  weaponMastery?: { count: number; progression: Record<string, number> }
  multiclassPrerequisites?: string
  multiclassProficiencies?: Partial<ClassProficiencies>
  spellList?: string
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

// === subclasses.json ===

export interface SubclassFeature {
  name: string
  level: number
  description: string
}

export interface SubclassData {
  id: string
  name: string
  class: string
  level: number
  description: string
  features: SubclassFeature[]
  alwaysPreparedSpells?: Record<string, string[]>
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

/** Top-level is an object keyed by class ID */
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

// === spells.json ===

export interface SpellData {
  id: string
  name: string
  level: number
  school: SpellSchool
  castingTime: string
  range: string
  duration: string
  concentration: boolean
  ritual: boolean
  components: string
  description: string
  higherLevels?: string
  classes: string[]
  spellList: SpellListName[]
}

// === equipment.json ===

export interface WeaponData {
  name: string
  category: WeaponCategory
  damage: string
  damageType: DamageType
  weight: number
  properties: string[]
  cost: string
  mastery: string
  description: string
}

export interface ArmorData {
  name: string
  category: string
  baseAC: number
  dexBonus: boolean
  dexBonusMax: number | null
  weight: number
  stealthDisadvantage: boolean
  cost: string
  description: string
}

export interface GearData {
  name: string
  category: string
  weight: number
  cost: string
  description: string
}

export interface EquipmentFile {
  weapons: WeaponData[]
  armor: ArmorData[]
  gear: GearData[]
}

// === magic-items.json ===

export interface MagicItemData {
  id: string
  name: string
  rarity: ItemRarity
  type: string
  attunement: boolean
  cost: string
  description: string
}

// === invocations.json ===

export interface InvocationPrerequisites {
  cantrip?: string
  invocation?: string
  requiresDamageCantrip?: boolean
  requiresAttackRollCantrip?: boolean
}

export interface InvocationData {
  id: string
  name: string
  description: string
  levelRequirement: number
  prerequisites: InvocationPrerequisites | null
  isPactBoon?: boolean
  repeatable?: boolean
}

// === metamagic.json ===

export interface MetamagicData {
  id: string
  name: string
  description: string
  sorceryPointCost: number | string
}

// === monsters.json / npcs.json / creatures.json ===
// (Re-exported from types/monster.ts — kept here for barrel convenience)

export type { MonsterAction, MonsterSpeed, MonsterSpellcasting, MonsterStatBlock, MonsterTrait } from '../monster'

// === crafting.json ===

export interface CraftingItem {
  name: string
  rawMaterialCost: string
  craftingTimeDays: number
  category: string
}

export interface CraftingToolEntry {
  tool: string
  items: CraftingItem[]
}

// === bastion-facilities.json ===
// (Re-exported from types/bastion.ts)

export type { BastionFacilitiesData } from '../bastion'

// === traps.json ===

export interface TrapData {
  id: string
  name: string
  level: 'low' | 'mid' | 'high'
  trigger: string
  duration: string
  detection: string
  disarm: string
  effect: string
  damage: string
  saveDC: number
  saveAbility: AbilityAbbreviation
  description: string
}

// === hazards.json ===

export interface HazardData {
  id: string
  name: string
  level: 'low' | 'mid' | 'high'
  type: 'biological' | 'environmental' | 'magical'
  effect: string
  damage: string
  saveDC: number
  saveAbility: AbilityAbbreviation
  avoidance: string
  description: string
}

// === poisons.json ===

export interface PoisonData {
  id: string
  name: string
  type: 'ingested' | 'inhaled' | 'contact' | 'injury'
  rarity: string
  cost: string
  saveDC: number
  effect: string
  duration: string
  description: string
}

// === curses.json ===

export interface CurseData {
  id: string
  name: string
  type: 'personal' | 'item' | 'location'
  effect: string
  removal: string
  description: string
}

// === diseases.json ===

export interface DiseaseData {
  id: string
  name: string
  type: string
  vector: string
  saveDC: number
  saveAbility: AbilityAbbreviation
  incubation: string
  symptoms: string
  effect: string
  mechanicalEffect: string
  cure: string
  description: string
}

// === environmental-effects.json ===

export interface EnvironmentalEffectData {
  id: string
  name: string
  category: 'weather' | 'terrain' | 'magical'
  effect: string
  mechanicalEffect: string
  saveDC?: number
  saveAbility?: AbilityAbbreviation
  description: string
}

// === supernatural-gifts.json ===

export interface SupernaturalGiftData {
  id: string
  name: string
  type: 'blessing' | 'charm' | 'boon'
  effect: string
  description: string
  duration?: string
}

// === encounter-presets.json ===

export interface EncounterPreset {
  id: string
  name: string
  description: string
  environment: string
  difficulty: EncounterDifficulty
  partyLevelRange: string
  monsters: Array<{ id: string; count: number }>
  tactics: string
  treasureHint: string
}

// === encounter-budgets.json ===

export interface EncounterBudgetEntry {
  level: number
  low: number
  moderate: number
  high: number
}

export interface EncounterBudgetsFile {
  perCharacterBudget: EncounterBudgetEntry[]
  notes: string
}

// === treasure-tables.json (DMG 2024 format) ===

export interface TreasureIndividualEntry {
  crRange: string
  amount: string
  unit: string
  average: number
}

export interface TreasureHoardEntry {
  crRange: string
  coins: string
  coinsUnit: string
  coinsAverage: number
  magicItems: string
}

export interface TreasureMagicItemRarity {
  d100Min: number
  d100Max: number
  rarity: string
}

export interface TreasureTablesFile {
  individual: TreasureIndividualEntry[]
  hoard: TreasureHoardEntry[]
  magicItemRarities: TreasureMagicItemRarity[]
  gems: Record<string, string[]>
  art: Record<string, string[]>
}

// === chase-tables.json ===

export interface ChaseComplication {
  roll: number
  complication: string
}

export interface ChaseTablesFile {
  urban: ChaseComplication[]
  wilderness: ChaseComplication[]
}

// === npc-names.json ===

export interface NpcNameEntry {
  male: string[]
  female: string[]
  neutral: string[]
  family?: string[]
  clan?: string[]
}

export type NpcNamesFile = Record<string, NpcNameEntry>

// === random-tables.json ===

export interface WeatherEntry {
  d20Min: number
  d20Max: number
  condition: string
}

export interface RandomTablesFile {
  npcTraits: {
    personality: string[]
    ideals: string[]
    bonds: string[]
    flaws: string[]
    appearance: string[]
    mannerism: string[]
  }
  weather: WeatherEntry[]
  tavernNames: string[]
  shopNames: string[]
  plotHooks: string[]
}

// === sounds.json ===

export interface SoundEntry {
  id: string
  event: string
  path: string
  volume: number
  category: 'dice' | 'combat' | 'character' | 'ui' | 'ambient' | 'spell' | 'condition'
}

// === trinkets.json ===
// Simple string array — no interface needed, just export the type alias
export type TrinketsFile = string[]

// === Weapon Mastery ===

export type WeaponMasteryProperty = 'Cleave' | 'Graze' | 'Nick' | 'Push' | 'Sap' | 'Slow' | 'Topple' | 'Vex'

// === downtime.json ===

export interface DowntimeActivity {
  id: string
  name: string
  description: string
  daysRequired: number
  goldCostPerDay: number
  requirements: string[]
  outcome: string
  reference: string
}

// === mounts.json ===

export interface MountData {
  id: string
  name: string
  size: string
  sizeX: number
  sizeY: number
  ac: number
  hp: number
  speed: number
  str: number
  dex: number
  con: number
  canBeControlled: boolean
  category: 'land' | 'water' | 'air'
  description: string
  cost: number
}

export interface MountsFile {
  mounts: MountData[]
}

// === vehicles.json ===

export interface VehicleJsonData {
  id: string
  name: string
  type: 'water' | 'land' | 'air'
  size: string
  speed: string
  speedFeet: number
  hp: number
  ac: number
  crew: number
  passengers: number
  cargo: string
  cost: string
  reference: string
}

// === Compatibility Aliases ===
// These match the names used by the individual .types.ts files and data-provider.ts

export type SpellList = SpellListName
export type ClassFeatureEntry = ClassFeature
export type ClassFeaturesMap = ClassFeaturesFile
export type CraftingToolGroup = CraftingToolEntry
export type CraftingData = CraftingToolEntry[]
export type Disease = DiseaseData
export type EncounterBudgets = EncounterBudgetsFile
export type TreasureTables = TreasureTablesFile
export type IndividualTreasureEntry = TreasureIndividualEntry
export type HoardTreasureEntry = TreasureHoardEntry
export type RandomTables = RandomTablesFile
export type ChaseTables = ChaseTablesFile
export type NpcNames = NpcNamesFile
export type NpcNameSet = NpcNameEntry
export type SoundAsset = SoundEntry
export type SoundCategory = SoundEntry['category']
export type FeatData5e = FeatData
export type EncounterPresetMonster = EncounterPreset['monsters'][number]
export type NpcTraitTables = RandomTablesFile['npcTraits']
export type SpellSlotTable = Record<string, number>
