import type { BuildSlotCategory, DetailField, SelectableOption } from '../types/character-common'
import type {
  BackgroundData,
  ChaseTablesFile,
  ClassData,
  ClassFeaturesFile,
  CraftingToolEntry,
  DiseaseData,
  EncounterBudgetsFile,
  EncounterPreset,
  EquipmentFile,
  FeatData,
  InvocationData,
  MagicItemData,
  MetamagicData,
  NpcNamesFile,
  RandomTablesFile,
  SpeciesData,
  SpellData,
  SubclassData,
  TreasureTablesFile
} from '../types/data'
import type {
  Curse,
  Disease,
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
import { useDataStore } from '../stores/useDataStore'

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`)
  }
  let data: T
  try {
    data = (await res.json()) as T
  } catch (e) {
    throw new Error(`Failed to parse JSON from ${path}: ${e}`)
  }
  return data
}

/** Invalidate all cached data (force re-fetch on next access). */
export function clearDataCache(): void {
  useDataStore.getState().clearAll()
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
  const basePath = GAME_SYSTEMS[system].dataPath

  if (system === 'dnd5e') {
    switch (category) {
      case 'ancestry': {
        const speciesList = await loadJson<SpeciesData[]>(`${basePath}/species.json`)
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
        const classes = await loadJson<ClassData[]>(`${basePath}/classes.json`)
        return classes.map(classToOption)
      }
      case 'background': {
        const bgs = await loadJson<BackgroundData[]>(`${basePath}/backgrounds.json`)
        return bgs.map(backgroundToOption)
      }
      case 'class-feat': {
        // Subclass selection for 5e
        try {
          const subclasses = await loadJson<SubclassData[]>(`${basePath}/subclasses.json`)
          const filtered = context?.selectedClassId
            ? subclasses.filter((sc) => sc.class === context.selectedClassId)
            : subclasses
          return filtered.map(subclassToOption)
        } catch (error) {
          console.error('[DataProvider] Failed to load subclasses:', error)
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

export async function load5eSpecies(): Promise<SpeciesData[]> {
  return ds().get('species', () => loadJson<SpeciesData[]>('./data/5e/species.json'))
}

export async function load5eClasses(): Promise<ClassData[]> {
  return ds().get('classes', () => loadJson<ClassData[]>('./data/5e/classes.json'))
}

export async function load5eBackgrounds(): Promise<BackgroundData[]> {
  return ds().get('backgrounds', () => loadJson<BackgroundData[]>('./data/5e/backgrounds.json'))
}

export async function load5eSubclasses(): Promise<SubclassData[]> {
  return ds().get('subclasses', () => loadJson<SubclassData[]>('./data/5e/subclasses.json'))
}

export async function load5eFeats(category?: string): Promise<FeatData[]> {
  const feats = await ds().get('feats', () => loadJson<FeatData[]>('./data/5e/feats.json'))
  if (category) return feats.filter((f) => f.category === category)
  return feats
}

export async function load5eSpells(): Promise<SpellData[]> {
  return ds().get('spells', () => loadJson<SpellData[]>('./data/5e/spells.json'))
}

export async function load5eClassFeatures(): Promise<ClassFeaturesFile> {
  return ds().get('classFeatures', () => loadJson<ClassFeaturesFile>('./data/5e/class-features.json'))
}

export async function load5eEquipment(): Promise<EquipmentFile> {
  return ds().get('equipment', () => loadJson<EquipmentFile>('./data/5e/equipment.json'))
}

export async function load5eCrafting(): Promise<CraftingToolEntry[]> {
  return ds().get('crafting', () => loadJson<CraftingToolEntry[]>('./data/5e/crafting.json'))
}

export async function load5eDiseases(): Promise<DiseaseData[]> {
  return ds().get('diseases', () => loadJson<DiseaseData[]>('./data/5e/diseases.json'))
}

export async function load5eEncounterBudgets(): Promise<EncounterBudgetsFile> {
  return ds().get('encounterBudgets', () => loadJson<EncounterBudgetsFile>('./data/5e/encounter-budgets.json'))
}

export async function load5eTreasureTables(): Promise<TreasureTablesFile> {
  return ds().get('treasureTables', () => loadJson<TreasureTablesFile>('./data/5e/treasure-tables.json'))
}

export async function load5eRandomTables(): Promise<RandomTablesFile> {
  return ds().get('randomTables', () => loadJson<RandomTablesFile>('./data/5e/random-tables.json'))
}

export async function load5eChaseTables(): Promise<ChaseTablesFile> {
  return ds().get('chaseTables', () => loadJson<ChaseTablesFile>('./data/5e/chase-tables.json'))
}

export async function load5eEncounterPresets(): Promise<EncounterPreset[]> {
  return ds().get('encounterPresets', () => loadJson<EncounterPreset[]>('./data/5e/encounter-presets.json'))
}

export async function load5eNpcNames(): Promise<NpcNamesFile> {
  return ds().get('npcNames', () => loadJson<NpcNamesFile>('./data/5e/npc-names.json'))
}

export async function load5eInvocations(): Promise<InvocationData[]> {
  return ds().get('invocations', () => loadJson<InvocationData[]>('./data/5e/invocations.json'))
}

export async function load5eMetamagic(): Promise<MetamagicData[]> {
  return ds().get('metamagic', () => loadJson<MetamagicData[]>('./data/5e/metamagic.json'))
}

export async function load5eBastionFacilities(): Promise<import('../types/bastion').BastionFacilitiesData> {
  return ds().get('bastionFacilities', () => loadJson<import('../types/bastion').BastionFacilitiesData>('./data/5e/bastion-facilities.json'))
}

export async function load5eMagicItems(rarity?: string): Promise<MagicItemData[]> {
  const items = await ds().get('magicItems', () => loadJson<MagicItemData[]>('./data/5e/magic-items.json'))
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
  return ds().get('monsters', () => loadJson<MonsterStatBlock[]>('./data/5e/monsters.json'))
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
  return ds().get('npcs', () => loadJson<MonsterStatBlock[]>('./data/5e/npcs.json'))
}

export async function load5eCreatures(): Promise<MonsterStatBlock[]> {
  return ds().get('creatures', () => loadJson<MonsterStatBlock[]>('./data/5e/creatures.json'))
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
  return ds().get('traps', () => loadJson<Trap[]>('./data/5e/traps.json'))
}

export async function load5eHazards(): Promise<Hazard[]> {
  return ds().get('hazards', () => loadJson<Hazard[]>('./data/5e/hazards.json'))
}

export async function load5ePoisons(): Promise<Poison[]> {
  return ds().get('poisons', () => loadJson<Poison[]>('./data/5e/poisons.json'))
}

export async function load5eEnvironmentalEffects(): Promise<EnvironmentalEffect[]> {
  return ds().get('environmentalEffects', () => loadJson<EnvironmentalEffect[]>('./data/5e/environmental-effects.json'))
}

export async function load5eCurses(): Promise<Curse[]> {
  return ds().get('curses', () => loadJson<Curse[]>('./data/5e/curses.json'))
}

export async function load5eSupernaturalGifts(): Promise<SupernaturalGift[]> {
  return ds().get('supernaturalGifts', () => loadJson<SupernaturalGift[]>('./data/5e/supernatural-gifts.json'))
}

export async function load5eSiegeEquipment(): Promise<SiegeEquipment[]> {
  return ds().get('siegeEquipment', () => loadJson<SiegeEquipment[]>('./data/5e/siege-equipment.json'))
}

export async function load5eSettlements(): Promise<import('../types/dm-toolbox').Settlement[]> {
  return ds().get('settlements', async () => {
    const file = await loadJson<{ sizes: import('../types/dm-toolbox').Settlement[] }>('./data/5e/settlements.json')
    return file.sizes
  })
}

export async function load5eMounts(): Promise<import('../types/mount').MountStatBlock[]> {
  return ds().get('mounts', async () => {
    const file = await loadJson<{ mounts: import('../types/mount').MountStatBlock[] }>('./data/5e/mounts.json')
    return file.mounts
  })
}

export async function load5eVehicles(): Promise<import('../types/mount').VehicleStatBlock[]> {
  return ds().get('vehicles', async () => {
    const file = await loadJson<{ vehicles: import('../types/mount').VehicleStatBlock[] }>('./data/5e/mounts.json')
    return file.vehicles
  })
}
