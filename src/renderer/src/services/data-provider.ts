import { useDataStore } from '../stores/use-data-store'
import { getSystem } from '../systems/registry'
import type { BuildSlotCategory, DetailField, SelectableOption } from '../types/character-common'
import type {
  AbilityScoreConfigFile,
  AdventureSeedsFile,
  AmbientTracksFile,
  BackgroundData,
  BuiltInMapEntry,
  ChaseTablesFile,
  ClassData,
  ClassFeaturesFile,
  ClassResourcesFile,
  CraftingToolEntry,
  CreatureTypesFile,
  CurrencyConfigEntry,
  DiceColorsFile,
  DiceTypeDef,
  DiseaseData,
  DmTabDef,
  EncounterBudgetsFile,
  EncounterPreset,
  EquipmentFile,
  FeatData,
  InvocationData,
  KeyboardShortcutDef,
  LanguageD12Entry,
  LightingTravelFile,
  MagicItemData,
  MetamagicData,
  ModerationFile,
  NotificationTemplatesFile,
  NpcNamesFile,
  PresetIcon,
  RandomTablesFile,
  RarityOptionEntry,
  RawSpeciesData,
  SessionZeroConfigFile,
  SoundEventsFile,
  SpeciesData,
  SpeciesResourcesFile,
  SpeciesSpellsFile,
  SpeciesTrait,
  SpeciesTraitsFile,
  SpellData,
  SubclassData,
  TreasureTablesFile
} from '../types/data'
import type {
  Curse,
  EnvironmentalEffect,
  Hazard,
  Poison,
  SiegeEquipment,
  SupernaturalGift,
  Trap
} from '../types/dm-toolbox'
import type { GameSystem } from '../types/game-system'
import { GAME_SYSTEMS } from '../types/game-system'
import type { MonsterStatBlock } from '../types/monster'
import { logger } from '../utils/logger'

import { DATA_PATHS } from './data-paths'
export { DATA_PATHS }

const jsonCache = new Map<string, unknown>()

export async function loadJson<T>(path: string): Promise<T> {
  const cached = jsonCache.get(path)
  if (cached !== undefined) return cached as T
  const data = (await window.api.game.loadJson(path)) as T
  jsonCache.set(path, data)
  return data
}

/** Invalidate all cached data (force re-fetch on next access). */
export function clearDataCache(): void {
  jsonCache.clear()
  useDataStore.getState().clearAll()
}

/**
 * Resolve a data path key for a given game system.
 * For 'dnd5e', returns the built-in DATA_PATHS value.
 * For plugin-provided systems, checks the system plugin's getDataPaths() override first.
 */
export function resolveDataPath(system: GameSystem, pathKey: string): string | undefined {
  if (system !== 'dnd5e') {
    try {
      const plugin = getSystem(system)
      if (plugin.getDataPaths) {
        const overrides = plugin.getDataPaths()
        if (overrides[pathKey]) return overrides[pathKey]
      }
    } catch {
      // System not registered — fall through
    }
  }
  return (DATA_PATHS as Record<string, string>)[pathKey]
}

// === 5e Transformers ===

function speciesToOption(species: SpeciesData): SelectableOption {
  const hasFlexible = Object.keys(species.abilityBonuses).length === 0
  const bonusStr = hasFlexible
    ? 'Flexible (+2/+1 or +1/+1/+1)'
    : Object.entries(species.abilityBonuses)
        .map(([ab, val]) => `${ab.charAt(0).toUpperCase() + ab.slice(1)} +${val}`)
        .join(', ')

  const details: DetailField[] = [
    ...(!hasFlexible ? [{ label: 'Ability Score Increase', value: bonusStr }] : []),
    { label: 'Speed', value: `${species.speed} ft.` },
    { label: 'Size', value: Array.isArray(species.size) ? species.size.join(' or ') : species.size },
    { label: 'Languages', value: species.languages.join(', ') }
  ]

  for (const trait of species.traits) {
    details.push({ label: trait.name, value: trait.description })
  }

  return {
    id: species.id,
    name: species.name,
    rarity: 'common',
    description: `${species.name} - ${bonusStr}`,
    traits: species.traits.map((t) => t.name),
    source: 'SRD',
    detailFields: details
  }
}

function classToOption(cls: ClassData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Hit Point Die', value: `d${cls.hitDie}` },
    { label: 'Primary Ability', value: cls.primaryAbility },
    { label: 'Saving Throws', value: cls.savingThrows.join(', ') },
    { label: 'Armor Proficiencies', value: cls.proficiencies.armor.join(', ') || 'None' },
    { label: 'Weapon Proficiencies', value: cls.proficiencies.weapons.join(', ') || 'None' },
    {
      label: 'Skills',
      value: `Choose ${cls.proficiencies.skills.numToChoose} from: ${cls.proficiencies.skills.options.join(', ')}`
    }
  ]

  if (cls.startingEquipment.length > 0) {
    details.push({
      label: 'Starting Equipment',
      value: cls.startingEquipment.map((e) => `${e.name} x${e.quantity}`).join(', ')
    })
  }

  return {
    id: cls.id,
    name: cls.name,
    rarity: 'common',
    description: `Hit Point Die: d${cls.hitDie} | Primary: ${cls.primaryAbility}`,
    traits: [],
    source: 'SRD',
    detailFields: details
  }
}

function backgroundToOption(bg: BackgroundData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Skill Proficiencies', value: bg.proficiencies.skills.join(', ') },
    { label: 'Tool Proficiencies', value: bg.proficiencies.tools.join(', ') || 'None' },
    {
      label: 'Languages',
      value: bg.proficiencies.languages > 0 ? `${bg.proficiencies.languages} of your choice` : 'None'
    },
    { label: 'Starting Gold', value: `${bg.startingGold}` },
    ...(bg.originFeat ? [{ label: 'Origin Feat', value: bg.originFeat }] : []),
    ...(bg.abilityScores ? [{ label: 'Ability Scores', value: bg.abilityScores.join(', ') }] : [])
  ]

  if (bg.equipment.length > 0) {
    details.push({
      label: 'Equipment',
      value: bg.equipment.map((e) => `${e.name} x${e.quantity}`).join(', ')
    })
  }

  return {
    id: bg.id,
    name: bg.name,
    rarity: 'common',
    description: bg.description || `Skills: ${bg.proficiencies.skills.join(', ')}`,
    traits: [],
    source: 'SRD',
    detailFields: details
  }
}

// === Feat/Subclass Transformers ===

function feat5eToOption(feat: FeatData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Category', value: feat.category },
    { label: 'Level', value: `${feat.level}` }
  ]
  if (feat.prerequisites.length > 0) {
    details.push({ label: 'Prerequisites', value: feat.prerequisites.join(', ') })
  }
  if (feat.abilityScoreIncrease) {
    const asi = feat.abilityScoreIncrease
    const value = `+${asi.amount} ${asi.options.join(' or ')}`
    details.push({ label: 'Ability Score Increase', value })
  }
  if (feat.repeatable) {
    details.push({ label: 'Repeatable', value: 'Yes' })
  }
  return {
    id: feat.id,
    name: feat.name,
    rarity: 'common',
    description: feat.description,
    traits: [feat.category],
    source: feat.source || 'SRD',
    detailFields: details
  }
}

function subclassToOption(sc: SubclassData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Class', value: sc.class.charAt(0).toUpperCase() + sc.class.slice(1) },
    { label: 'Level', value: `${sc.level}` }
  ]
  for (const feat of sc.features) {
    details.push({ label: feat.name, value: feat.description })
  }
  return {
    id: sc.id,
    name: sc.name,
    rarity: 'common',
    description: sc.description,
    traits: [],
    source: 'SRD',
    detailFields: details
  }
}

// === Main Loader ===

export async function getOptionsForSlot(
  system: GameSystem,
  category: BuildSlotCategory,
  context?: { slotId?: string; selectedClassId?: string }
): Promise<SelectableOption[]> {
  const systemConfig = GAME_SYSTEMS[system]
  if (!systemConfig) return []

  if (system === 'dnd5e') {
    switch (category) {
      case 'ancestry': {
        const speciesList = await load5eSpecies()
        return speciesList.map(speciesToOption)
      }
      case 'heritage': {
        if (context?.selectedClassId) {
          // selectedClassId is repurposed to pass speciesId for heritage options
          return getHeritageOptions5e(context.selectedClassId)
        }
        return []
      }
      case 'class': {
        const classes = await load5eClasses()
        return classes.map(classToOption)
      }
      case 'background': {
        const bgs = await load5eBackgrounds()
        return bgs.map(backgroundToOption)
      }
      case 'class-feat': {
        // Subclass selection for 5e
        try {
          const subclasses = await load5eSubclasses()
          const filtered = context?.selectedClassId
            ? subclasses.filter((sc) => sc.class === context.selectedClassId)
            : subclasses
          return filtered.map(subclassToOption)
        } catch (error) {
          logger.error('[DataProvider] Failed to load subclasses:', error)
          return []
        }
      }
      case 'epic-boon': {
        const feats = await load5eFeats('Epic Boon')
        return feats.map(feat5eToOption)
      }
      case 'fighting-style': {
        let feats = await load5eFeats('Fighting Style')
        // Filter class-restricted fighting styles (e.g., Blessed Warrior is Paladin-only)
        if (context?.selectedClassId) {
          feats = feats.filter(
            (f) => f.prerequisites.length === 0 || f.prerequisites.includes(context.selectedClassId!)
          )
        }
        const options = feats.map(feat5eToOption)
        // Add Druidic Warrior for Rangers (alternative to Fighting Style feat)
        if (context?.selectedClassId === 'ranger') {
          options.push({
            id: 'druidic-warrior',
            name: 'Druidic Warrior',
            rarity: 'common' as const,
            description:
              'You learn two Druid cantrips of your choice (Guidance and Starry Wisp are recommended). The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.',
            traits: [],
            source: 'PHB 2024',
            detailFields: []
          })
        }
        return options
      }
      case 'primal-order': {
        return [
          {
            id: 'magician',
            name: 'Magician',
            rarity: 'common',
            description:
              'You know one extra cantrip from the Primal spell list. In addition, your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks equal to your Wisdom modifier (minimum bonus of +1).',
            traits: [],
            source: 'SRD',
            detailFields: [
              { label: 'Bonus Cantrip', value: '+1 Primal cantrip' },
              { label: 'Skill Bonus', value: 'Arcana/Nature checks + WIS modifier (min +1)' }
            ]
          },
          {
            id: 'warden',
            name: 'Warden',
            rarity: 'common',
            description:
              'Trained for battle, you gain proficiency with Martial weapons and training with Medium armor.',
            traits: [],
            source: 'SRD',
            detailFields: [
              { label: 'Armor', value: 'Medium armor proficiency' },
              { label: 'Weapons', value: 'Martial weapons proficiency' }
            ]
          }
        ]
      }
      case 'divine-order': {
        return [
          {
            id: 'protector',
            name: 'Protector',
            rarity: 'common',
            description: 'Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.',
            traits: [],
            source: 'SRD',
            detailFields: [
              { label: 'Armor', value: 'Heavy armor proficiency' },
              { label: 'Weapons', value: 'Martial weapons proficiency' }
            ]
          },
          {
            id: 'thaumaturge',
            name: 'Thaumaturge',
            rarity: 'common',
            description:
              'You know one extra cantrip from the Divine spell list. In addition, your mystical connection to the divine gives you a bonus to Intelligence (Religion) checks equal to your Wisdom modifier (minimum bonus of +1).',
            traits: [],
            source: 'SRD',
            detailFields: [
              { label: 'Bonus Cantrip', value: '+1 Divine cantrip' },
              { label: 'Skill Bonus', value: 'Religion checks + WIS modifier (min +1)' }
            ]
          }
        ]
      }
      default:
        return []
    }
  }

  return []
}

// All named loaders go through the centralized DataStore for caching + homebrew merge
const ds = () => useDataStore.getState()

async function load5eSpeciesTraits(): Promise<SpeciesTraitsFile> {
  return ds().get('speciesTraits', async () => {
    const raw = await loadJson<
      Record<string, SpeciesTrait & { spellGranted?: string | { list: string; count: number } | null }>
    >(DATA_PATHS.speciesTraits)
    // Convert JSON null to undefined for spellGranted
    for (const trait of Object.values(raw)) {
      if (trait.spellGranted === null) trait.spellGranted = undefined
    }
    return raw as SpeciesTraitsFile
  })
}

function resolveTrait(traitEntry: string | SpeciesTrait, traitMap: SpeciesTraitsFile): SpeciesTrait {
  if (typeof traitEntry === 'object') return traitEntry
  const resolved = traitMap[traitEntry]
  if (!resolved) {
    logger.warn(`[DataProvider] Unknown species trait ID: "${traitEntry}"`)
    return { name: traitEntry, description: '' }
  }
  return resolved
}

function resolveSpeciesTraits(rawSpecies: RawSpeciesData[], traitMap: SpeciesTraitsFile): SpeciesData[] {
  return rawSpecies.map((raw) => ({
    ...raw,
    traits: raw.traits.map((t) => resolveTrait(t, traitMap)),
    subraces: raw.subraces?.map((sr) => ({
      ...sr,
      traitModifications: {
        ...sr.traitModifications,
        add: sr.traitModifications.add.map((t) => resolveTrait(t, traitMap))
      }
    }))
  }))
}

export async function load5eSpecies(): Promise<SpeciesData[]> {
  return ds().get('species', async () => {
    const [rawSpecies, traitMap] = await Promise.all([
      loadJson<RawSpeciesData[]>(DATA_PATHS.species),
      load5eSpeciesTraits()
    ])
    return resolveSpeciesTraits(rawSpecies, traitMap)
  })
}

export async function load5eClasses(): Promise<ClassData[]> {
  return ds().get('classes', () => loadJson<ClassData[]>(DATA_PATHS.classes))
}

export async function load5eBackgrounds(): Promise<BackgroundData[]> {
  return ds().get('backgrounds', () => loadJson<BackgroundData[]>(DATA_PATHS.backgrounds))
}

export async function load5eSubclasses(): Promise<SubclassData[]> {
  return ds().get('subclasses', () => loadJson<SubclassData[]>(DATA_PATHS.subclasses))
}

export async function load5eFeats(category?: string): Promise<FeatData[]> {
  const feats = await ds().get('feats', () => loadJson<FeatData[]>(DATA_PATHS.feats))
  if (category) return feats.filter((f) => f.category === category)
  return feats
}

export async function load5eSpells(): Promise<SpellData[]> {
  return ds().get('spells', () => loadJson<SpellData[]>(DATA_PATHS.spells))
}

export async function load5eClassFeatures(): Promise<ClassFeaturesFile> {
  return ds().get('classFeatures', () => loadJson<ClassFeaturesFile>(DATA_PATHS.classFeatures))
}

export async function load5eEquipment(): Promise<EquipmentFile> {
  return ds().get('equipment', () => loadJson<EquipmentFile>(DATA_PATHS.equipment))
}

export async function load5eCrafting(): Promise<CraftingToolEntry[]> {
  return ds().get('crafting', () => loadJson<CraftingToolEntry[]>(DATA_PATHS.crafting))
}

export async function load5eDiseases(): Promise<DiseaseData[]> {
  return ds().get('diseases', () => loadJson<DiseaseData[]>(DATA_PATHS.diseases))
}

export async function load5eEncounterBudgets(): Promise<EncounterBudgetsFile> {
  return ds().get('encounterBudgets', () => loadJson<EncounterBudgetsFile>(DATA_PATHS.encounterBudgets))
}

export async function load5eTreasureTables(): Promise<TreasureTablesFile> {
  return ds().get('treasureTables', () => loadJson<TreasureTablesFile>(DATA_PATHS.treasureTables))
}

export async function load5eRandomTables(): Promise<RandomTablesFile> {
  return ds().get('randomTables', () => loadJson<RandomTablesFile>(DATA_PATHS.randomTables))
}

export async function load5eChaseTables(): Promise<ChaseTablesFile> {
  return ds().get('chaseTables', () => loadJson<ChaseTablesFile>(DATA_PATHS.chaseTables))
}

export async function load5eEncounterPresets(): Promise<EncounterPreset[]> {
  return ds().get('encounterPresets', () => loadJson<EncounterPreset[]>(DATA_PATHS.encounterPresets))
}

export async function load5eNpcNames(): Promise<NpcNamesFile> {
  return ds().get('npcNames', () => loadJson<NpcNamesFile>(DATA_PATHS.npcNames))
}

export async function load5eInvocations(): Promise<InvocationData[]> {
  return ds().get('invocations', () => loadJson<InvocationData[]>(DATA_PATHS.invocations))
}

export async function load5eMetamagic(): Promise<MetamagicData[]> {
  return ds().get('metamagic', () => loadJson<MetamagicData[]>(DATA_PATHS.metamagic))
}

export async function load5eBastionFacilities(): Promise<import('../types/bastion').BastionFacilitiesData> {
  return ds().get('bastionFacilities', () =>
    loadJson<import('../types/bastion').BastionFacilitiesData>(DATA_PATHS.bastionFacilities)
  )
}

export async function load5eMagicItems(rarity?: string): Promise<MagicItemData[]> {
  const items = await ds().get('magicItems', () => loadJson<MagicItemData[]>(DATA_PATHS.magicItems))
  if (rarity) return items.filter((item) => item.rarity === rarity)
  return items
}

export async function getHeritageOptions5e(speciesId: string): Promise<SelectableOption[]> {
  const speciesList = await load5eSpecies()
  const species = speciesList.find((s) => s.id === speciesId)
  if (!species?.subraces || species.subraces.length === 0) return []

  return species.subraces.map((sr) => {
    const details: DetailField[] = [{ label: 'Species', value: species.name }]
    // Show added traits
    for (const trait of sr.traitModifications.add) {
      details.push({ label: trait.name, value: trait.description })
    }
    if (sr.speedModifier) {
      details.push({ label: 'Speed Modifier', value: `+${sr.speedModifier} ft.` })
    }
    return {
      id: sr.id,
      name: sr.name,
      rarity: 'common' as const,
      description: sr.description,
      traits: sr.traitModifications.add.map((t) => t.name),
      source: 'SRD',
      detailFields: details
    }
  })
}

// === Monster Data ===

export async function load5eMonsters(): Promise<MonsterStatBlock[]> {
  return ds().get('monsters', () => loadJson<MonsterStatBlock[]>(DATA_PATHS.monsters))
}

export async function load5eMonsterById(id: string): Promise<MonsterStatBlock | undefined> {
  const all = await loadAllStatBlocks()
  return all.find((m) => m.id === id)
}

export function searchMonsters(monsters: MonsterStatBlock[], query: string): MonsterStatBlock[] {
  const q = query.toLowerCase().trim()
  if (!q) return monsters
  return monsters.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      m.group?.toLowerCase().includes(q) ||
      m.subtype?.toLowerCase().includes(q) ||
      m.tags?.some((t) => t.toLowerCase().includes(q))
  )
}

// === NPC & Creature Data ===

export async function load5eNpcs(): Promise<MonsterStatBlock[]> {
  return ds().get('npcs', () => loadJson<MonsterStatBlock[]>(DATA_PATHS.npcs))
}

export async function load5eCreatures(): Promise<MonsterStatBlock[]> {
  return ds().get('creatures', () => loadJson<MonsterStatBlock[]>(DATA_PATHS.creatures))
}

export async function loadAllStatBlocks(): Promise<MonsterStatBlock[]> {
  const [monsters, npcs, creatures] = await Promise.all([load5eMonsters(), load5eNpcs(), load5eCreatures()])
  return [...monsters, ...npcs, ...creatures]
}

export async function loadStatBlockById(id: string): Promise<MonsterStatBlock | undefined> {
  const all = await loadAllStatBlocks()
  return all.find((m) => m.id === id)
}

// === DM Toolbox Data ===

export async function load5eTraps(): Promise<Trap[]> {
  return ds().get('traps', () => loadJson<Trap[]>(DATA_PATHS.traps))
}

export async function load5eHazards(): Promise<Hazard[]> {
  return ds().get('hazards', () => loadJson<Hazard[]>(DATA_PATHS.hazards))
}

export async function load5ePoisons(): Promise<Poison[]> {
  return ds().get('poisons', () => loadJson<Poison[]>(DATA_PATHS.poisons))
}

export async function load5eEnvironmentalEffects(): Promise<EnvironmentalEffect[]> {
  return ds().get('environmentalEffects', () => loadJson<EnvironmentalEffect[]>(DATA_PATHS.environmentalEffects))
}

export async function load5eCurses(): Promise<Curse[]> {
  return ds().get('curses', () => loadJson<Curse[]>(DATA_PATHS.curses))
}

export async function load5eSupernaturalGifts(): Promise<SupernaturalGift[]> {
  return ds().get('supernaturalGifts', () => loadJson<SupernaturalGift[]>(DATA_PATHS.supernaturalGifts))
}

export async function load5eSiegeEquipment(): Promise<SiegeEquipment[]> {
  return ds().get('siegeEquipment', () => loadJson<SiegeEquipment[]>(DATA_PATHS.siegeEquipment))
}

export async function load5eSettlements(): Promise<import('../types/dm-toolbox').Settlement[]> {
  return ds().get('settlements', async () => {
    const file = await loadJson<{ sizes: import('../types/dm-toolbox').Settlement[] }>(DATA_PATHS.settlements)
    return file.sizes
  })
}

export async function load5eMounts(): Promise<import('../types/mount').MountStatBlock[]> {
  return ds().get('mounts', async () => {
    const file = await loadJson<{ mounts: import('../types/mount').MountStatBlock[] }>(DATA_PATHS.mounts)
    return file.mounts
  })
}

export async function load5eVehicles(): Promise<import('../types/mount').VehicleStatBlock[]> {
  return ds().get('vehicles', async () => {
    const file = await loadJson<{ vehicles: import('../types/mount').VehicleStatBlock[] }>(DATA_PATHS.mounts)
    return file.vehicles
  })
}

// === Extracted Data Loaders ===

export interface ConditionEntry {
  id: string
  name: string
  type: 'condition' | 'buff'
  description: string
  source: string
  system: string
  hasValue: boolean
  maxValue: number | null
}

export async function load5eConditions(): Promise<ConditionEntry[]> {
  return ds().get('conditions', () => loadJson<ConditionEntry[]>(DATA_PATHS.conditions))
}

export interface LanguageEntry {
  id: string
  name: string
  type: string
  script: string | null
  typicalSpeakers: string
  description: string
  source: string
}

export async function load5eLanguages(): Promise<LanguageEntry[]> {
  return ds().get('languages', () => loadJson<LanguageEntry[]>(DATA_PATHS.languages))
}

export interface WeaponMasteryEntry {
  id: string
  name: string
  description: string
  source: string
}

export async function load5eWeaponMastery(): Promise<WeaponMasteryEntry[]> {
  return ds().get('weaponMastery', () => loadJson<WeaponMasteryEntry[]>(DATA_PATHS.weaponMastery))
}

export interface SkillEntry {
  id: string
  name: string
  ability: string
  description: string
  exampleDCs: { easy: number; moderate: number; hard: number }
  uses?: string
  source: string
}

export async function load5eSkills(): Promise<SkillEntry[]> {
  return ds().get('skills', () => loadJson<SkillEntry[]>(DATA_PATHS.skills))
}

export interface VariantItemEntry {
  label: string
  variants: string[]
}

export async function load5eVariantItems(): Promise<Record<string, VariantItemEntry>> {
  return ds().get('variantItems', () => loadJson<Record<string, VariantItemEntry>>(DATA_PATHS.variantItems))
}

export interface LightSourceEntry {
  label: string
  durationSeconds: number | null
  brightRadius: number
  dimRadius: number
}

export async function load5eLightSources(): Promise<Record<string, LightSourceEntry>> {
  return ds().get('lightSources', () => loadJson<Record<string, LightSourceEntry>>(DATA_PATHS.lightSources))
}

export async function load5eNpcAppearance(): Promise<Record<string, string[]>> {
  return ds().get('npcAppearance', () => loadJson<Record<string, string[]>>(DATA_PATHS.npcAppearance))
}

export async function load5eNpcMannerisms(): Promise<Record<string, string[]>> {
  return ds().get('npcMannerisms', () => loadJson<Record<string, string[]>>(DATA_PATHS.npcMannerisms))
}

export async function load5eAlignmentDescriptions(): Promise<Record<string, string>> {
  return ds().get('alignmentDescriptions', () => loadJson<Record<string, string>>(DATA_PATHS.alignmentDescriptions))
}

export async function load5eWearableItems(): Promise<string[]> {
  return ds().get('wearableItems', () => loadJson<string[]>(DATA_PATHS.wearableItems))
}

export async function load5ePersonalityTables(): Promise<{
  ability: Record<string, { high: string[]; low: string[] }>
  alignment: Record<string, string[]>
}> {
  return ds().get('personalityTables', () =>
    loadJson<{ ability: Record<string, { high: string[]; low: string[] }>; alignment: Record<string, string[]> }>(
      DATA_PATHS.personalityTables
    )
  )
}

export async function load5eXpThresholds(): Promise<number[]> {
  return ds().get('xpThresholds', () => loadJson<number[]>(DATA_PATHS.xpThresholds))
}

export async function load5eStartingEquipment(): Promise<
  Array<{
    minLevel: number
    maxLevel: number
    baseGold: number
    diceCount: number
    diceMultiplier: number
    magicItems: Record<string, number>
  }>
> {
  return ds().get('startingEquipment', () =>
    loadJson<
      Array<{
        minLevel: number
        maxLevel: number
        baseGold: number
        diceCount: number
        diceMultiplier: number
        magicItems: Record<string, number>
      }>
    >(DATA_PATHS.startingEquipment)
  )
}

export async function load5eBastionEvents(): Promise<Record<string, unknown>> {
  return ds().get('bastionEvents', () => loadJson<Record<string, unknown>>(DATA_PATHS.bastionEvents))
}

export async function load5eSentientItems(): Promise<Record<string, unknown>> {
  return ds().get('sentientItems', () => loadJson<Record<string, unknown>>(DATA_PATHS.sentientItems))
}

export async function load5eWeatherGeneration(): Promise<Record<string, unknown>> {
  return ds().get('weatherGeneration', () => loadJson<Record<string, unknown>>(DATA_PATHS.weatherGeneration))
}

export async function load5eCalendarPresets(): Promise<Record<string, unknown>> {
  return ds().get('calendarPresets', () => loadJson<Record<string, unknown>>(DATA_PATHS.calendarPresets))
}

export async function load5eEffectDefinitions(): Promise<Record<string, unknown>> {
  return ds().get('effectDefinitions', () => loadJson<Record<string, unknown>>(DATA_PATHS.effectDefinitions))
}

export async function load5eSpellSlots(): Promise<Record<string, unknown>> {
  return ds().get('spellSlots', () => loadJson<Record<string, unknown>>(DATA_PATHS.spellSlots))
}

export async function load5eFightingStyles(): Promise<Record<string, unknown>[]> {
  return ds().get('fightingStyles', () => loadJson<Record<string, unknown>[]>(DATA_PATHS.fightingStyles))
}

export async function load5eDowntime(): Promise<Record<string, unknown>[]> {
  return ds().get('downtime', () => loadJson<Record<string, unknown>[]>(DATA_PATHS.downtime))
}

export async function load5eTrinkets(): Promise<Record<string, unknown>[]> {
  return ds().get('trinkets', () => loadJson<Record<string, unknown>[]>(DATA_PATHS.trinkets))
}

export async function load5eSounds(): Promise<Record<string, unknown>[]> {
  const events = await load5eSoundEvents()
  return events.soundFileMappings as unknown as Record<string, unknown>[]
}

export async function load5eSoundEvents(): Promise<SoundEventsFile> {
  return ds().get('soundEvents', () => loadJson<SoundEventsFile>(DATA_PATHS.soundEvents))
}

export async function load5eSpeciesSpells(): Promise<SpeciesSpellsFile> {
  return ds().get('speciesSpells', () => loadJson<SpeciesSpellsFile>(DATA_PATHS.speciesSpells))
}

export async function load5eClassResources(): Promise<ClassResourcesFile> {
  return ds().get('classResources', () => loadJson<ClassResourcesFile>(DATA_PATHS.classResources))
}

export async function load5eSpeciesResources(): Promise<SpeciesResourcesFile> {
  return ds().get('speciesResources', () => loadJson<SpeciesResourcesFile>(DATA_PATHS.speciesResources))
}

export async function load5eAbilityScoreConfig(): Promise<AbilityScoreConfigFile> {
  return ds().get('abilityScoreConfig', () => loadJson<AbilityScoreConfigFile>(DATA_PATHS.abilityScoreConfig))
}

export async function load5ePresetIcons(): Promise<PresetIcon[]> {
  return ds().get('presetIcons', () => loadJson<PresetIcon[]>(DATA_PATHS.presetIcons))
}

export async function load5eKeyboardShortcuts(): Promise<KeyboardShortcutDef[]> {
  return ds().get('keyboardShortcuts', () => loadJson<KeyboardShortcutDef[]>(DATA_PATHS.keyboardShortcuts))
}

export async function load5eThemes(): Promise<Record<string, Record<string, string>>> {
  return ds().get('themes', () => loadJson<Record<string, Record<string, string>>>(DATA_PATHS.themes))
}

export async function load5eDiceColors(): Promise<DiceColorsFile> {
  return ds().get('diceColors', () => loadJson<DiceColorsFile>(DATA_PATHS.diceColors))
}

export async function load5eDmTabs(): Promise<DmTabDef[]> {
  return ds().get('dmTabs', () => loadJson<DmTabDef[]>(DATA_PATHS.dmTabs))
}

export async function load5eNotificationTemplates(): Promise<NotificationTemplatesFile> {
  return ds().get('notificationTemplates', () => loadJson<NotificationTemplatesFile>(DATA_PATHS.notificationTemplates))
}

export async function load5eBuiltInMaps(): Promise<BuiltInMapEntry[]> {
  return ds().get('builtInMaps', () => loadJson<BuiltInMapEntry[]>(DATA_PATHS.builtInMaps))
}

export async function load5eSessionZeroConfig(): Promise<SessionZeroConfigFile> {
  return ds().get('sessionZeroConfig', () => loadJson<SessionZeroConfigFile>(DATA_PATHS.sessionZeroConfig))
}

export async function load5eDiceTypes(): Promise<DiceTypeDef[]> {
  return ds().get('diceTypes', () => loadJson<DiceTypeDef[]>(DATA_PATHS.diceTypes))
}

export async function load5eLightingTravel(): Promise<LightingTravelFile> {
  return ds().get('lightingTravel', () => loadJson<LightingTravelFile>(DATA_PATHS.lightingTravel))
}

export async function load5eCurrencyConfig(): Promise<CurrencyConfigEntry[]> {
  return ds().get('currencyConfig', () => loadJson<CurrencyConfigEntry[]>(DATA_PATHS.currencyConfig))
}

export async function load5eModeration(): Promise<ModerationFile> {
  return ds().get('moderation', () => loadJson<ModerationFile>(DATA_PATHS.moderation))
}

// --- Round 2 loaders ---

export async function load5eAdventureSeeds(): Promise<AdventureSeedsFile> {
  return ds().get('adventureSeeds', () => loadJson<AdventureSeedsFile>(DATA_PATHS.adventureSeeds))
}

export async function load5eCreatureTypes(): Promise<CreatureTypesFile> {
  return ds().get('creatureTypes', () => loadJson<CreatureTypesFile>(DATA_PATHS.creatureTypes))
}

export async function load5eAmbientTracks(): Promise<AmbientTracksFile> {
  return ds().get('ambientTracks', () => loadJson<AmbientTracksFile>(DATA_PATHS.ambientTracks))
}

export async function load5eLanguageD12Table(): Promise<LanguageD12Entry[]> {
  return ds().get('languageD12Table', () => loadJson<LanguageD12Entry[]>(DATA_PATHS.languageD12Table))
}

export async function load5eRarityOptions(): Promise<RarityOptionEntry[]> {
  return ds().get('rarityOptions', () => loadJson<RarityOptionEntry[]>(DATA_PATHS.rarityOptions))
}
