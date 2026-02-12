import type { GameSystemPlugin, SheetConfig } from '../types'
import type { SpellEntry, ClassFeatureEntry, Currency, AbilityName } from '../../types/character-common'

// --- Data cache ---
const dataCache = new Map<string, unknown>()

async function loadJson<T>(path: string): Promise<T> {
  if (dataCache.has(path)) return dataCache.get(path) as T
  const res = await fetch(path)
  const data = await res.json()
  dataCache.set(path, data)
  return data as T
}

// --- PF2e Spell slot progression ---
// Prepared/spontaneous casters in PF2e follow the same slot table
// Full casters: Bard, Cleric, Druid, Oracle, Sorcerer, Witch, Wizard
// Bounded casters: Magus, Summoner (fewer slots)

const FULL_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 3, 2: 2 },
  4:  { 1: 3, 2: 3 },
  5:  { 1: 3, 2: 3, 3: 2 },
  6:  { 1: 3, 2: 3, 3: 3 },
  7:  { 1: 3, 2: 3, 3: 3, 4: 2 },
  8:  { 1: 3, 2: 3, 3: 3, 4: 3 },
  9:  { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 },
  10: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
  11: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 },
  12: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
  13: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 2 },
  14: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 },
  15: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 2 },
  16: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
  17: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 2 },
  18: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3 },
  19: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 },
  20: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 }
}

// Bounded casters (Magus, Summoner) get fewer slots
const BOUNDED_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1:  { 1: 1 },
  2:  { 1: 2 },
  3:  { 1: 2, 2: 1 },
  4:  { 1: 2, 2: 2 },
  5:  { 1: 2, 2: 2, 3: 1 },
  6:  { 1: 2, 2: 2, 3: 2 },
  7:  { 1: 2, 2: 2, 3: 2, 4: 1 },
  8:  { 1: 2, 2: 2, 3: 2, 4: 2 },
  9:  { 1: 2, 2: 2, 3: 2, 4: 2, 5: 1 },
  10: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 },
  11: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1 },
  12: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 },
  13: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1 },
  14: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 },
  15: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 1 },
  16: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2 },
  17: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 1 },
  18: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 },
  19: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 },
  20: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 }
}

const FULL_CASTERS = ['bard', 'cleric', 'druid', 'oracle', 'sorcerer', 'witch', 'wizard', 'psychic']
const BOUNDED_CASTERS = ['magus', 'summoner']
const ALL_CASTERS = [...FULL_CASTERS, ...BOUNDED_CASTERS]

// --- PF2e Skill definitions (17 skills including Lore) ---
const SKILL_DEFINITIONS: Array<{ name: string; ability: AbilityName }> = [
  { name: 'Acrobatics', ability: 'dexterity' },
  { name: 'Arcana', ability: 'intelligence' },
  { name: 'Athletics', ability: 'strength' },
  { name: 'Crafting', ability: 'intelligence' },
  { name: 'Deception', ability: 'charisma' },
  { name: 'Diplomacy', ability: 'charisma' },
  { name: 'Intimidation', ability: 'charisma' },
  { name: 'Lore', ability: 'intelligence' },
  { name: 'Medicine', ability: 'wisdom' },
  { name: 'Nature', ability: 'wisdom' },
  { name: 'Occultism', ability: 'intelligence' },
  { name: 'Performance', ability: 'charisma' },
  { name: 'Religion', ability: 'wisdom' },
  { name: 'Society', ability: 'intelligence' },
  { name: 'Stealth', ability: 'dexterity' },
  { name: 'Survival', ability: 'wisdom' },
  { name: 'Thievery', ability: 'dexterity' }
]

// --- Sheet config ---
const SHEET_CONFIG: SheetConfig = {
  showInitiative: false,
  showPerception: true,
  showClassDC: true,
  showBulk: true,
  showElectrum: false,
  showFocusPoints: true,
  proficiencyStyle: 'teml'
}

// --- Plugin implementation ---

export const pf2ePlugin: GameSystemPlugin = {
  id: 'pf2e',
  name: 'Pathfinder 2nd Edition',

  getSpellSlotProgression(className: string, level: number): Record<number, number> {
    const clampedLevel = Math.max(1, Math.min(20, level))
    const cls = className.toLowerCase()

    if (FULL_CASTERS.includes(cls)) return FULL_CASTER_SLOTS[clampedLevel] ?? {}
    if (BOUNDED_CASTERS.includes(cls)) return BOUNDED_CASTER_SLOTS[clampedLevel] ?? {}

    return {}
  },

  async getSpellList(className: string): Promise<SpellEntry[]> {
    try {
      const spells = await loadJson<any[]>('./data/pf2e/spells.json')
      const tradition = className.toLowerCase()
      return spells
        .filter((s: any) => {
          if (!s.traditions) return false
          return (s.traditions as string[]).some((t) => t.toLowerCase() === tradition)
        })
        .map((s: any) => ({
          id: s.id ?? s.name.toLowerCase().replace(/\s+/g, '-'),
          name: s.name,
          level: s.level ?? s.rank ?? 0,
          description: s.description ?? '',
          castingTime: s.castingTime ?? s.cast ?? '',
          range: s.range ?? '',
          duration: s.duration ?? '',
          components: s.components ?? '',
          school: s.school,
          concentration: false,
          ritual: s.ritual ?? false,
          traditions: s.traditions,
          traits: s.traits,
          heightened: s.heightened
        }))
    } catch {
      return []
    }
  },

  isSpellcaster(className: string): boolean {
    return ALL_CASTERS.includes(className.toLowerCase())
  },

  async getStartingGold(_classId: string, _backgroundId: string): Promise<Currency> {
    // Standard PF2e starting wealth is 15 gp
    return { cp: 0, sp: 0, gp: 15, pp: 0 }
  },

  async getClassFeatures(classId: string, level: number): Promise<ClassFeatureEntry[]> {
    try {
      const data = await loadJson<Record<string, any[]>>('./data/pf2e/class-features.json')
      const features = data[classId] ?? []
      return features
        .filter((f: any) => f.level <= level)
        .map((f: any) => ({
          level: f.level,
          name: f.name,
          source: classId,
          description: f.description ?? ''
        }))
    } catch {
      return []
    }
  },

  async loadEquipment(): Promise<{ weapons: any[]; armor: any[]; shields: any[]; gear: any[] }> {
    try {
      const data = await loadJson<any>('./data/pf2e/equipment.json')
      return {
        weapons: data.weapons ?? [],
        armor: data.armor ?? [],
        shields: data.shields ?? [],
        gear: data.gear ?? data.adventuringGear ?? []
      }
    } catch {
      return { weapons: [], armor: [], shields: [], gear: [] }
    }
  },

  getSkillDefinitions(): Array<{ name: string; ability: AbilityName }> {
    return SKILL_DEFINITIONS
  },

  getSheetConfig(): SheetConfig {
    return SHEET_CONFIG
  }
}
