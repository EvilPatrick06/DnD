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

// --- Spell slot progression tables ---

// Full casters: Bard, Cleric, Druid, Sorcerer, Wizard
const FULL_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
}

// Half casters: Paladin, Ranger
const HALF_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1:  {},
  2:  { 1: 2 },
  3:  { 1: 3 },
  4:  { 1: 3 },
  5:  { 1: 4, 2: 2 },
  6:  { 1: 4, 2: 2 },
  7:  { 1: 4, 2: 3 },
  8:  { 1: 4, 2: 3 },
  9:  { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
}

// Third casters: Eldritch Knight (Fighter), Arcane Trickster (Rogue)
const THIRD_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1:  {},
  2:  {},
  3:  { 1: 2 },
  4:  { 1: 3 },
  5:  { 1: 3 },
  6:  { 1: 3 },
  7:  { 1: 4, 2: 2 },
  8:  { 1: 4, 2: 2 },
  9:  { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 },
  11: { 1: 4, 2: 3 },
  12: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 },
  14: { 1: 4, 2: 3, 3: 2 },
  15: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 },
  17: { 1: 4, 2: 3, 3: 3 },
  18: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 1 }
}

// Warlock Pact Magic
const WARLOCK_SLOTS: Record<number, Record<number, number>> = {
  1:  { 1: 1 },
  2:  { 1: 2 },
  3:  { 2: 2 },
  4:  { 2: 2 },
  5:  { 3: 2 },
  6:  { 3: 2 },
  7:  { 4: 2 },
  8:  { 4: 2 },
  9:  { 5: 2 },
  10: { 5: 2 },
  11: { 5: 3 },
  12: { 5: 3 },
  13: { 5: 3 },
  14: { 5: 3 },
  15: { 5: 3 },
  16: { 5: 3 },
  17: { 5: 4 },
  18: { 5: 4 },
  19: { 5: 4 },
  20: { 5: 4 }
}

const FULL_CASTERS = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
const HALF_CASTERS = ['paladin', 'ranger']
const THIRD_CASTERS = ['fighter', 'rogue'] // subclass-dependent, but we include at class level
const SPELLCASTERS = [...FULL_CASTERS, ...HALF_CASTERS, 'warlock']

// --- 5e Skill definitions ---
const SKILL_DEFINITIONS: Array<{ name: string; ability: AbilityName }> = [
  { name: 'Acrobatics', ability: 'dexterity' },
  { name: 'Animal Handling', ability: 'wisdom' },
  { name: 'Arcana', ability: 'intelligence' },
  { name: 'Athletics', ability: 'strength' },
  { name: 'Deception', ability: 'charisma' },
  { name: 'History', ability: 'intelligence' },
  { name: 'Insight', ability: 'wisdom' },
  { name: 'Intimidation', ability: 'charisma' },
  { name: 'Investigation', ability: 'intelligence' },
  { name: 'Medicine', ability: 'wisdom' },
  { name: 'Nature', ability: 'intelligence' },
  { name: 'Perception', ability: 'wisdom' },
  { name: 'Performance', ability: 'charisma' },
  { name: 'Persuasion', ability: 'charisma' },
  { name: 'Religion', ability: 'intelligence' },
  { name: 'Sleight of Hand', ability: 'dexterity' },
  { name: 'Stealth', ability: 'dexterity' },
  { name: 'Survival', ability: 'wisdom' }
]

// --- Sheet config ---
const SHEET_CONFIG: SheetConfig = {
  showInitiative: true,
  showPerception: false,
  showClassDC: false,
  showBulk: false,
  showElectrum: true,
  showFocusPoints: false,
  proficiencyStyle: 'dots'
}

// --- Plugin implementation ---

export const dnd5ePlugin: GameSystemPlugin = {
  id: 'dnd5e',
  name: "D&D 5th Edition",

  getSpellSlotProgression(className: string, level: number): Record<number, number> {
    const clampedLevel = Math.max(1, Math.min(20, level))
    const cls = className.toLowerCase()

    if (cls === 'warlock') return WARLOCK_SLOTS[clampedLevel] ?? {}
    if (FULL_CASTERS.includes(cls)) return FULL_CASTER_SLOTS[clampedLevel] ?? {}
    if (HALF_CASTERS.includes(cls)) return HALF_CASTER_SLOTS[clampedLevel] ?? {}
    if (THIRD_CASTERS.includes(cls)) return THIRD_CASTER_SLOTS[clampedLevel] ?? {}

    return {}
  },

  async getSpellList(className: string): Promise<SpellEntry[]> {
    try {
      const spells = await loadJson<any[]>('./data/5e/spells.json')
      const cls = className.toLowerCase()
      return spells
        .filter((s: any) => {
          if (!s.classes) return false
          return (s.classes as string[]).some((c) => c.toLowerCase() === cls)
        })
        .map((s: any) => ({
          id: s.id ?? s.name.toLowerCase().replace(/\s+/g, '-'),
          name: s.name,
          level: s.level ?? 0,
          description: s.description ?? '',
          castingTime: s.castingTime ?? s.casting_time ?? '',
          range: s.range ?? '',
          duration: s.duration ?? '',
          components: s.components ?? '',
          school: s.school,
          concentration: s.concentration ?? false,
          ritual: s.ritual ?? false,
          classes: s.classes
        }))
    } catch {
      return []
    }
  },

  isSpellcaster(className: string): boolean {
    return SPELLCASTERS.includes(className.toLowerCase())
  },

  async getStartingGold(classId: string, backgroundId: string): Promise<Currency> {
    try {
      const backgrounds = await loadJson<any[]>('./data/5e/backgrounds.json')
      const bg = backgrounds.find((b: any) => b.id === backgroundId)
      const gold = bg?.startingGold ?? 10
      return { cp: 0, sp: 0, gp: gold, pp: 0, ep: 0 }
    } catch {
      return { cp: 0, sp: 0, gp: 10, pp: 0, ep: 0 }
    }
  },

  async getClassFeatures(classId: string, level: number): Promise<ClassFeatureEntry[]> {
    try {
      const data = await loadJson<Record<string, any[]>>('./data/5e/class-features.json')
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
      const data = await loadJson<any>('./data/5e/equipment.json')
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
