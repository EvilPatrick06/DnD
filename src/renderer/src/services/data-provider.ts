import type { GameSystem } from '../types/game-system'
import type { SelectableOption, DetailField, BuildSlotCategory } from '../types/character-common'
import { GAME_SYSTEMS } from '../types/game-system'

const cache = new Map<string, unknown>()

export async function loadJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T
  const res = await fetch(path)
  const data = await res.json()
  cache.set(path, data)
  return data as T
}

// === 5e Data Types ===

interface RaceData {
  id: string
  name: string
  abilityBonuses: Record<string, number>
  speed: number
  size: string
  traits: Array<{ name: string; description: string; spellGranted?: string | { list: string; count: number } }>
  languages: string[]
  proficiencies?: string[]
}

interface ClassData {
  id: string
  name: string
  hitDie: number
  primaryAbility: string
  savingThrows: string[]
  proficiencies: {
    armor: string[]
    weapons: string[]
    tools: string[]
    skills: { numToChoose: number; options: string[] }
  }
  startingEquipment: Array<{ name: string; quantity: number }>
}

interface BackgroundData {
  id: string
  name: string
  proficiencies: { skills: string[]; tools: string[]; languages: number }
  equipment: Array<{ name: string; quantity: number }>
  startingGold: number
  feature: { name: string; description: string }
  originFeat?: string
}

// === PF2e Data Types ===

interface Pf2eAncestryData {
  id: string
  name: string
  hp: number
  size: string
  speed: number
  abilityBoosts: string[]
  abilityFlaws: string[]
  languages: string[]
  additionalLanguages?: string[]
  traits: Array<{ name: string; description: string }>
  specialAbilities?: Array<{ name: string; description: string }>
  heritages: Array<{ id: string; name: string; description: string }>
  description?: string
}

interface Pf2eClassData {
  id: string
  name: string
  hp: number
  keyAbility: string[]
  perception: string
  savingThrows: { fortitude: string; reflex: string; will: string }
  skills: { trained: number; options: string[] }
  mandatorySkills?: string[]
  attacks: Record<string, string>
  defenses: Record<string, string>
  classDC: string
  classFeatures?: string[]
  startingEquipment?: Array<{ name: string; quantity: number }>
  spellcasting?: { tradition: string; type: string; proficiency: string; note?: string } | null
  description: string
}

interface Pf2eBackgroundData {
  id: string
  name: string
  abilityBoosts: string[]
  skillTraining: string
  skillFeat: string
  description: string
}

// === 5e Transformers ===

function raceToOption(race: RaceData): SelectableOption {
  const hasFlexible = Object.keys(race.abilityBonuses).length === 0
  const bonusStr = hasFlexible
    ? 'Flexible (+2/+1 or +1/+1/+1)'
    : Object.entries(race.abilityBonuses)
        .map(([ab, val]) => `${ab.charAt(0).toUpperCase() + ab.slice(1)} +${val}`)
        .join(', ')

  const details: DetailField[] = [
    { label: 'Ability Score Increase', value: bonusStr },
    { label: 'Speed', value: `${race.speed} ft.` },
    { label: 'Size', value: race.size },
    { label: 'Languages', value: race.languages.join(', ') }
  ]

  for (const trait of race.traits) {
    details.push({ label: trait.name, value: trait.description })
  }

  return {
    id: race.id,
    name: race.name,
    rarity: 'common',
    description: `${race.name} - ${bonusStr}`,
    traits: race.traits.map((t) => t.name),
    source: 'SRD',
    detailFields: details
  }
}

function classToOption(cls: ClassData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Hit Die', value: `d${cls.hitDie}` },
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
    description: `Hit Die: d${cls.hitDie} | Primary: ${cls.primaryAbility}`,
    traits: [],
    source: 'SRD',
    detailFields: details
  }
}

function backgroundToOption(bg: BackgroundData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Skill Proficiencies', value: bg.proficiencies.skills.join(', ') },
    { label: 'Tool Proficiencies', value: bg.proficiencies.tools.join(', ') || 'None' },
    { label: 'Languages', value: bg.proficiencies.languages > 0 ? `${bg.proficiencies.languages} of your choice` : 'None' },
    { label: 'Starting Gold', value: `${bg.startingGold}` },
    { label: 'Feature', value: bg.feature.name },
    { label: bg.feature.name, value: bg.feature.description },
    ...(bg.originFeat ? [{ label: 'Origin Feat', value: bg.originFeat }] : [])
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
    description: `Skills: ${bg.proficiencies.skills.join(', ')}`,
    traits: [],
    source: 'SRD',
    detailFields: details
  }
}

// === PF2e Transformers ===

function pf2eAncestryToOption(ancestry: Pf2eAncestryData): SelectableOption {
  const boosts = ancestry.abilityBoosts.map((b) =>
    b === 'free' ? 'Free' : b.charAt(0).toUpperCase() + b.slice(1)
  ).join(', ')

  const flaws = ancestry.abilityFlaws.length > 0
    ? ancestry.abilityFlaws.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')
    : 'None'

  const details: DetailField[] = [
    { label: 'Hit Points', value: `${ancestry.hp}` },
    { label: 'Size', value: ancestry.size },
    { label: 'Speed', value: `${ancestry.speed} ft.` },
    { label: 'Ability Boosts', value: boosts },
    { label: 'Ability Flaws', value: flaws },
    { label: 'Languages', value: ancestry.languages.join(', ') }
  ]

  for (const trait of ancestry.traits) {
    details.push({ label: trait.name, value: trait.description })
  }

  if (ancestry.heritages.length > 0) {
    details.push({
      label: 'Heritages',
      value: ancestry.heritages.map((h) => h.name).join(', ')
    })
  }

  return {
    id: ancestry.id,
    name: ancestry.name,
    rarity: 'common',
    description: ancestry.description ?? `HP: ${ancestry.hp} | Speed: ${ancestry.speed} ft | Boosts: ${boosts}`,
    traits: ancestry.traits.map((t) => t.name),
    source: 'PRD',
    detailFields: details
  }
}

function pf2eClassToOption(cls: Pf2eClassData): SelectableOption {
  const keyAb = cls.keyAbility.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(' or ')

  const details: DetailField[] = [
    { label: 'Hit Points', value: `${cls.hp} + CON modifier per level` },
    { label: 'Key Ability', value: keyAb },
    { label: 'Perception', value: cls.perception },
    { label: 'Fortitude Save', value: cls.savingThrows.fortitude },
    { label: 'Reflex Save', value: cls.savingThrows.reflex },
    { label: 'Will Save', value: cls.savingThrows.will },
    { label: 'Skills', value: `${cls.skills.trained} + INT modifier trained skills` },
    { label: 'Class DC', value: cls.classDC }
  ]

  if (cls.attacks) {
    const atkStr = Object.entries(cls.attacks)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    details.push({ label: 'Attacks', value: atkStr })
  }

  if (cls.defenses) {
    const defStr = Object.entries(cls.defenses)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    details.push({ label: 'Defenses', value: defStr })
  }

  if (cls.startingEquipment && cls.startingEquipment.length > 0) {
    details.push({
      label: 'Starting Equipment',
      value: cls.startingEquipment.map((e) => e.quantity > 1 ? `${e.name} x${e.quantity}` : e.name).join(', ')
    })
  }

  return {
    id: cls.id,
    name: cls.name,
    rarity: 'common',
    description: cls.description,
    traits: [],
    source: 'PRD',
    detailFields: details
  }
}

function pf2eBackgroundToOption(bg: Pf2eBackgroundData): SelectableOption {
  const boosts = bg.abilityBoosts.map((b) =>
    b === 'free' ? 'Free' : b.charAt(0).toUpperCase() + b.slice(1)
  ).join(', ')

  const details: DetailField[] = [
    { label: 'Ability Boosts', value: boosts },
    { label: 'Skill Training', value: bg.skillTraining },
    { label: 'Skill Feat', value: bg.skillFeat }
  ]

  return {
    id: bg.id,
    name: bg.name,
    rarity: 'common',
    description: bg.description,
    traits: [],
    source: 'PRD',
    detailFields: details
  }
}

function pf2eHeritageToOption(
  heritage: { id: string; name: string; description: string },
  ancestryName: string
): SelectableOption {
  return {
    id: heritage.id,
    name: heritage.name,
    rarity: 'common',
    description: heritage.description,
    traits: [],
    source: 'PRD',
    detailFields: [
      { label: 'Ancestry', value: ancestryName }
    ]
  }
}

// === 5e Subclass Types ===

interface SubclassData {
  id: string
  name: string
  class: string
  level: number
  description: string
  features: Array<{ name: string; level: number; description: string }>
}

// === PF2e Feat Types ===

interface Pf2eFeatData {
  id: string
  name: string
  level: number
  traits: string[]
  description: string
  prerequisites: string
  ancestry?: string
  class?: string
  skill?: string
}

// === Feat/Subclass Transformers ===

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

function pf2eFeatToOption(feat: Pf2eFeatData): SelectableOption {
  const details: DetailField[] = [
    { label: 'Level', value: `${feat.level}` },
    { label: 'Traits', value: feat.traits.join(', ') || 'None' }
  ]
  if (feat.prerequisites) {
    details.push({ label: 'Prerequisites', value: feat.prerequisites })
  }
  return {
    id: feat.id,
    name: feat.name,
    rarity: 'common',
    description: feat.description,
    traits: feat.traits,
    source: 'PRD',
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
        const races = await loadJson<RaceData[]>(`${basePath}/races.json`)
        return races.map(raceToOption)
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
        } catch {
          return []
        }
      }
      default:
        return []
    }
  }

  if (system === 'pf2e') {
    switch (category) {
      case 'ancestry': {
        const ancestries = await loadJson<Pf2eAncestryData[]>(`${basePath}/ancestries.json`)
        return ancestries.map(pf2eAncestryToOption)
      }
      case 'heritage': {
        const ancestries = await loadJson<Pf2eAncestryData[]>(`${basePath}/ancestries.json`)
        const options: SelectableOption[] = []
        for (const ancestry of ancestries) {
          for (const heritage of ancestry.heritages) {
            options.push(pf2eHeritageToOption(heritage, ancestry.name))
          }
        }
        return options
      }
      case 'class': {
        const classes = await loadJson<Pf2eClassData[]>(`${basePath}/classes.json`)
        return classes.map(pf2eClassToOption)
      }
      case 'background': {
        const bgs = await loadJson<Pf2eBackgroundData[]>(`${basePath}/backgrounds.json`)
        return bgs.map(pf2eBackgroundToOption)
      }
      case 'ancestry-feat': {
        try {
          const feats = await loadJson<Pf2eFeatData[]>(`${basePath}/feats/ancestry-feats.json`)
          return feats.map(pf2eFeatToOption)
        } catch {
          return []
        }
      }
      case 'class-feat': {
        try {
          const feats = await loadJson<Pf2eFeatData[]>(`${basePath}/feats/class-feats.json`)
          return feats.map(pf2eFeatToOption)
        } catch {
          return []
        }
      }
      case 'skill-feat': {
        try {
          const feats = await loadJson<Pf2eFeatData[]>(`${basePath}/feats/skill-feats.json`)
          return feats.map(pf2eFeatToOption)
        } catch {
          return []
        }
      }
      case 'general-feat': {
        try {
          const feats = await loadJson<Pf2eFeatData[]>(`${basePath}/feats/general-feats.json`)
          return feats.map(pf2eFeatToOption)
        } catch {
          return []
        }
      }
      default:
        return []
    }
  }

  return []
}

// Expose raw data loaders for the stat calculator and save flow
export async function load5eRaces(): Promise<RaceData[]> {
  return loadJson<RaceData[]>('./data/5e/races.json')
}

export async function load5eClasses(): Promise<ClassData[]> {
  return loadJson<ClassData[]>('./data/5e/classes.json')
}

export async function load5eBackgrounds(): Promise<BackgroundData[]> {
  return loadJson<BackgroundData[]>('./data/5e/backgrounds.json')
}

export async function load5eSubclasses(): Promise<SubclassData[]> {
  return loadJson<SubclassData[]>('./data/5e/subclasses.json')
}

export async function loadPf2eAncestries(): Promise<Pf2eAncestryData[]> {
  return loadJson<Pf2eAncestryData[]>('./data/pf2e/ancestries.json')
}

export async function loadPf2eClasses(): Promise<Pf2eClassData[]> {
  return loadJson<Pf2eClassData[]>('./data/pf2e/classes.json')
}

export async function loadPf2eBackgrounds(): Promise<Pf2eBackgroundData[]> {
  return loadJson<Pf2eBackgroundData[]>('./data/pf2e/backgrounds.json')
}

export async function load5eSpells(): Promise<unknown[]> {
  return loadJson<unknown[]>('./data/5e/spells.json')
}

export async function load5eFeats(): Promise<unknown[]> {
  return loadJson<unknown[]>('./data/5e/feats.json')
}

export async function load5eClassFeatures(): Promise<Record<string, unknown>> {
  return loadJson<Record<string, unknown>>('./data/5e/class-features.json')
}

export async function loadPf2eSpells(): Promise<unknown[]> {
  return loadJson<unknown[]>('./data/pf2e/spells.json')
}

export async function loadPf2eEquipment(): Promise<Record<string, unknown[]>> {
  return loadJson<Record<string, unknown[]>>('./data/pf2e/equipment.json')
}

export async function loadPf2eClassFeatures(): Promise<Record<string, unknown>> {
  return loadJson<Record<string, unknown>>('./data/pf2e/class-features.json')
}

export async function load5eMagicItems(): Promise<unknown[]> {
  return loadJson<unknown[]>('./data/5e/magic-items.json')
}
