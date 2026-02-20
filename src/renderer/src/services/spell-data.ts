import type { SpellcastingInfo5e } from '../types/character-5e'
import type { AbilityName, AbilityScoreSet, SpellEntry } from '../types/character-common'
import { abilityModifier } from '../types/character-common'
import { load5eSpells } from './data-provider'

// Spellcasting ability by class
export const SPELLCASTING_ABILITY_MAP: Record<string, AbilityName> = {
  bard: 'charisma',
  cleric: 'wisdom',
  druid: 'wisdom',
  paladin: 'charisma',
  ranger: 'wisdom',
  sorcerer: 'charisma',
  warlock: 'charisma',
  wizard: 'intelligence'
}

// Third-caster subclass spellcasting abilities
const THIRD_CASTER_ABILITY_MAP: Record<string, AbilityName> = {
  'eldritch-knight': 'intelligence',
  'arcane-trickster': 'intelligence'
}

/**
 * Returns the spellcasting ability for a class (or subclass for third-casters).
 */
export function getSpellcastingAbility(classId: string, subclassId?: string): AbilityName | undefined {
  if (SPELLCASTING_ABILITY_MAP[classId]) return SPELLCASTING_ABILITY_MAP[classId]
  if (subclassId && THIRD_CASTER_ABILITY_MAP[subclassId]) return THIRD_CASTER_ABILITY_MAP[subclassId]
  return undefined
}

/**
 * Computes spellcasting info (ability, DC, attack bonus) for a 5e character.
 * Returns undefined for non-casters.
 */
export function computeSpellcastingInfo(
  classes: Array<{ classId: string; subclassId?: string; level: number }>,
  abilityScores: AbilityScoreSet,
  totalLevel: number,
  primaryClassId?: string,
  primarySubclassId?: string
): SpellcastingInfo5e | undefined {
  // Determine spellcasting ability: use primary class first, then scan classes
  let ability: AbilityName | undefined
  if (primaryClassId) {
    ability = getSpellcastingAbility(primaryClassId, primarySubclassId)
  }
  if (!ability) {
    for (const cls of classes) {
      ability = getSpellcastingAbility(cls.classId, cls.subclassId)
      if (ability) break
    }
  }
  if (!ability) return undefined

  const profBonus = Math.ceil(totalLevel / 4) + 1
  const abilityMod = abilityModifier(abilityScores[ability])

  return {
    ability,
    spellSaveDC: 8 + profBonus + abilityMod,
    spellAttackBonus: profBonus + abilityMod
  }
}

/**
 * Returns the maximum number of prepared spells for any caster class.
 * In 2024 PHB, ALL caster classes are prepared casters with fixed tables.
 * Returns null for non-casters.
 */
export function getPreparedSpellMax(classId: string, classLevel: number): number | null {
  const table = PREPARED_SPELLS[classId]
  if (!table) return null
  return table[classLevel] ?? null
}

// Warlock Pact Magic slot progression
export const WARLOCK_PACT_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 1 },
  2: { 1: 2 },
  3: { 2: 2 },
  4: { 2: 2 },
  5: { 3: 2 },
  6: { 3: 2 },
  7: { 4: 2 },
  8: { 4: 2 },
  9: { 5: 2 },
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

export function isWarlockPactMagic(classId: string): boolean {
  return classId === 'warlock'
}

/** Returns the max spell level a warlock can cast (always <= 5) */
export function getWarlockMaxSpellLevel(level: number): number {
  const slots = WARLOCK_PACT_SLOTS[level]
  if (!slots) return 0
  return Math.max(...Object.keys(slots).map(Number))
}

// Spell slot progression for 5e full casters
export const FULL_CASTER_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
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

// Cantrips known for 5e casters
export const CANTRIPS_KNOWN: Record<string, Record<number, number>> = {
  bard: { 1: 2, 4: 3, 10: 4 },
  cleric: { 1: 3, 4: 4, 10: 5 },
  druid: { 1: 2, 4: 3, 10: 4 },
  sorcerer: { 1: 4, 4: 5, 10: 6 },
  warlock: { 1: 2, 4: 3, 10: 4 },
  wizard: { 1: 3, 4: 4, 10: 5 }
}

export const FULL_CASTERS_5E = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard']
export const HALF_CASTERS_5E = ['paladin', 'ranger']

export function getCantripsKnown(classId: string, level: number): number {
  const table = CANTRIPS_KNOWN[classId]
  if (!table) return 0
  let known = 0
  for (const [lvl, count] of Object.entries(table)) {
    if (level >= Number(lvl)) known = count
  }
  return known
}

// Prepared spells tables for all caster classes (2024 PHB)
// In 2024, ALL caster classes are prepared casters with fixed tables
export const PREPARED_SPELLS: Record<string, Record<number, number>> = {
  bard: {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 9,
    6: 10,
    7: 11,
    8: 12,
    9: 14,
    10: 15,
    11: 16,
    12: 16,
    13: 17,
    14: 17,
    15: 18,
    16: 18,
    17: 19,
    18: 20,
    19: 21,
    20: 22
  },
  cleric: {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 9,
    6: 10,
    7: 11,
    8: 12,
    9: 14,
    10: 15,
    11: 16,
    12: 16,
    13: 17,
    14: 17,
    15: 18,
    16: 18,
    17: 19,
    18: 20,
    19: 21,
    20: 22
  },
  druid: {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 9,
    6: 10,
    7: 11,
    8: 12,
    9: 14,
    10: 15,
    11: 16,
    12: 16,
    13: 17,
    14: 17,
    15: 18,
    16: 18,
    17: 19,
    18: 20,
    19: 21,
    20: 22
  },
  paladin: {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
    6: 6,
    7: 7,
    8: 7,
    9: 9,
    10: 9,
    11: 10,
    12: 10,
    13: 11,
    14: 11,
    15: 12,
    16: 12,
    17: 14,
    18: 14,
    19: 15,
    20: 15
  },
  ranger: {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
    6: 6,
    7: 7,
    8: 7,
    9: 9,
    10: 9,
    11: 10,
    12: 10,
    13: 11,
    14: 11,
    15: 12,
    16: 12,
    17: 14,
    18: 14,
    19: 15,
    20: 15
  },
  sorcerer: {
    1: 2,
    2: 4,
    3: 6,
    4: 7,
    5: 9,
    6: 10,
    7: 11,
    8: 12,
    9: 14,
    10: 15,
    11: 16,
    12: 16,
    13: 17,
    14: 17,
    15: 18,
    16: 18,
    17: 19,
    18: 20,
    19: 21,
    20: 22
  },
  warlock: {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
    6: 7,
    7: 8,
    8: 9,
    9: 10,
    10: 10,
    11: 11,
    12: 11,
    13: 12,
    14: 12,
    15: 13,
    16: 13,
    17: 14,
    18: 14,
    19: 15,
    20: 15
  },
  wizard: {
    1: 4,
    2: 5,
    3: 6,
    4: 7,
    5: 9,
    6: 10,
    7: 11,
    8: 12,
    9: 14,
    10: 15,
    11: 16,
    12: 16,
    13: 17,
    14: 17,
    15: 18,
    16: 18,
    17: 19,
    18: 22,
    19: 23,
    20: 25
  }
}

export function getSlotProgression(classId: string, level: number): Record<number, number> {
  if (isWarlockPactMagic(classId)) {
    return WARLOCK_PACT_SLOTS[level] ?? {}
  }
  if (FULL_CASTERS_5E.includes(classId)) {
    return FULL_CASTER_SLOTS[level] ?? {}
  }
  if (HALF_CASTERS_5E.includes(classId)) {
    // Half-casters use full-caster table at half level (rounded up)
    const effectiveLevel = Math.ceil(level / 2)
    return effectiveLevel >= 1 ? (FULL_CASTER_SLOTS[effectiveLevel] ?? {}) : {}
  }
  return {}
}

// Third-caster subclasses (gain spellcasting via subclass at class level 3)
export const THIRD_CASTER_SUBCLASSES: Record<string, string[]> = {
  fighter: ['eldritch-knight'],
  rogue: ['arcane-trickster']
}

export function isThirdCaster(classId: string, subclassId?: string): boolean {
  const subs = THIRD_CASTER_SUBCLASSES[classId]
  return !!subs && subs.includes(subclassId ?? '')
}

/**
 * Calculate spell slots for a multiclass character using the PHB 2024 multiclass spellcaster table.
 * Full casters add all levels, half casters add ceil(level/2), third casters add floor(level/3).
 * Warlock (Pact Magic) is NOT added to the combined total.
 */
export function getMulticlassSpellSlots(
  classes: Array<{ classId: string; subclassId?: string; level: number }>
): Record<number, number> {
  let combinedLevel = 0
  for (const cls of classes) {
    if (cls.classId === 'warlock') continue
    if (FULL_CASTERS_5E.includes(cls.classId)) {
      combinedLevel += cls.level
    } else if (HALF_CASTERS_5E.includes(cls.classId)) {
      combinedLevel += Math.ceil(cls.level / 2)
    } else if (isThirdCaster(cls.classId, cls.subclassId)) {
      combinedLevel += Math.floor(cls.level / 3)
    }
  }
  return FULL_CASTER_SLOTS[combinedLevel] ?? {}
}

/**
 * Returns true if the character has multiple non-Warlock spellcasting classes
 * and should use the multiclass spell slot table.
 */
export function isMulticlassSpellcaster(
  classes: Array<{ classId: string; subclassId?: string; level: number }>
): boolean {
  let casterCount = 0
  for (const cls of classes) {
    if (cls.classId === 'warlock') continue
    if (
      FULL_CASTERS_5E.includes(cls.classId) ||
      HALF_CASTERS_5E.includes(cls.classId) ||
      isThirdCaster(cls.classId, cls.subclassId)
    ) {
      casterCount++
    }
  }
  return casterCount >= 2
}

/**
 * Returns Warlock Pact Magic slots for a multiclass character.
 * Returns empty object if no warlock class.
 */
export function getWarlockPactSlots(classes: Array<{ classId: string; level: number }>): Record<number, number> {
  const warlockClass = classes.find((c) => c.classId === 'warlock')
  if (!warlockClass) return {}
  return WARLOCK_PACT_SLOTS[warlockClass.level] ?? {}
}

/**
 * Returns true if any class in the array is a spellcaster (including warlock).
 */
export function hasAnySpellcasting(classId: string): boolean {
  return FULL_CASTERS_5E.includes(classId) || HALF_CASTERS_5E.includes(classId) || isWarlockPactMagic(classId)
}

/**
 * Loads the full 5e spell list from the JSON data file and returns it as SpellEntry[].
 */
export async function loadSpells(): Promise<SpellEntry[]> {
  const raw = (await load5eSpells()) as unknown as Array<Record<string, unknown>>
  return raw.map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.name ?? ''),
    level: Number(s.level ?? 0),
    school: String(s.school ?? ''),
    castingTime: String(s.castingTime ?? ''),
    range: String(s.range ?? ''),
    duration: String(s.duration ?? ''),
    components: String(s.components ?? ''),
    description: String(s.description ?? ''),
    classes: Array.isArray(s.classes) ? (s.classes as string[]) : [],
    concentration: Boolean(s.concentration),
    ritual: Boolean(s.ritual)
  }))
}
