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

export const FULL_CASTERS_5E = ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard']
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

// Spells known tables for classes that use "spells known" mechanic
export const SPELLS_KNOWN: Record<string, Record<number, number>> = {
  bard: {
    1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11,
    9: 12, 10: 14, 11: 15, 12: 15, 13: 16, 14: 18, 15: 19,
    16: 19, 17: 20, 18: 22, 19: 22, 20: 22
  },
  sorcerer: {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9,
    9: 10, 10: 11, 11: 12, 12: 12, 13: 13, 14: 13, 15: 14,
    16: 14, 17: 15, 18: 15, 19: 15, 20: 15
  },
  ranger: {
    1: 0, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5,
    9: 6, 10: 6, 11: 7, 12: 7, 13: 8, 14: 8, 15: 9,
    16: 9, 17: 10, 18: 10, 19: 11, 20: 11
  },
  warlock: {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9,
    9: 10, 10: 10, 11: 11, 12: 11, 13: 12, 14: 12, 15: 13,
    16: 13, 17: 14, 18: 14, 19: 15, 20: 15
  }
}

// Classes that use "spells known" (as opposed to prepared casting)
export const SPELLS_KNOWN_CLASSES = ['bard', 'sorcerer', 'ranger', 'warlock']

export function getSpellsKnownMax(classId: string, level: number): number | null {
  const table = SPELLS_KNOWN[classId]
  if (!table) return null // prepared casters have no strict limit
  return table[level] ?? null
}

export function getSlotProgression(classId: string, level: number): Record<number, number> {
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
