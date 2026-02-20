import type { MagicItemRarity5e } from '../types/character-common'

export interface HigherLevelEquipment {
  baseGold: number
  diceCount: number
  diceMultiplier: number
  magicItems: Partial<Record<MagicItemRarity5e, number>>
}

/**
 * 2024 PHB Starting Equipment at Higher Levels table.
 * Level ranges map to extra starting gold and magic item grants.
 */
const HIGHER_LEVEL_TABLE: Array<{ minLevel: number; maxLevel: number; equipment: HigherLevelEquipment }> = [
  {
    minLevel: 2,
    maxLevel: 4,
    equipment: {
      baseGold: 0,
      diceCount: 0,
      diceMultiplier: 0,
      magicItems: { common: 1 }
    }
  },
  {
    minLevel: 5,
    maxLevel: 10,
    equipment: {
      baseGold: 500,
      diceCount: 1,
      diceMultiplier: 25,
      magicItems: { common: 1, uncommon: 1 }
    }
  },
  {
    minLevel: 11,
    maxLevel: 16,
    equipment: {
      baseGold: 5000,
      diceCount: 1,
      diceMultiplier: 250,
      magicItems: { common: 2, uncommon: 3, rare: 1 }
    }
  },
  {
    minLevel: 17,
    maxLevel: 20,
    equipment: {
      baseGold: 20000,
      diceCount: 1,
      diceMultiplier: 250,
      magicItems: { common: 2, uncommon: 4, rare: 3, 'very-rare': 1 }
    }
  }
]

/**
 * Get the higher-level starting equipment for a given character level.
 * Returns null for level 1 (no bonus equipment).
 */
export function getHigherLevelEquipment(level: number): HigherLevelEquipment | null {
  if (level < 2) return null
  const entry = HIGHER_LEVEL_TABLE.find((e) => level >= e.minLevel && level <= e.maxLevel)
  return entry?.equipment ?? null
}

/**
 * Get starting gold bonus info for a given level.
 * Returns { base, diceCount, diceMultiplier } for display and rolling.
 */
export function getStartingGoldBonus(level: number): { base: number; diceCount: number; diceMultiplier: number } {
  const eq = getHigherLevelEquipment(level)
  if (!eq) return { base: 0, diceCount: 0, diceMultiplier: 0 }
  return { base: eq.baseGold, diceCount: eq.diceCount, diceMultiplier: eq.diceMultiplier }
}

/**
 * Get the magic item grants by rarity for a given level.
 */
export function getMagicItemGrants(level: number): Partial<Record<MagicItemRarity5e, number>> {
  const eq = getHigherLevelEquipment(level)
  return eq?.magicItems ?? {}
}

/**
 * Roll the random gold component (1d10 * multiplier).
 */
export function rollStartingGold(level: number): number {
  const bonus = getStartingGoldBonus(level)
  if (bonus.diceCount === 0) return bonus.base
  const roll = Math.floor(Math.random() * 10) + 1 // 1d10
  return bonus.base + roll * bonus.diceMultiplier
}
