import type { AbilityScoreSet } from '../types/character-common'

export const ABILITY_PERSONALITY: Record<string, { high: string[]; low: string[] }> = {
  strength: {
    high: ['Muscular', 'Sinewy', 'Protective', 'Direct'],
    low: ['Weak', 'Slight', 'Self-conscious', 'Indirect']
  },
  dexterity: {
    high: ['Lithe', 'Dynamic', 'Fidgety', 'Poised'],
    low: ['Jittery', 'Clumsy', 'Hesitant', 'Unsteady']
  },
  constitution: {
    high: ['Energetic', 'Hale', 'Hearty', 'Stable'],
    low: ['Frail', 'Squeamish', 'Lethargic', 'Fragile']
  },
  intelligence: {
    high: ['Decisive', 'Logical', 'Informative', 'Curious'],
    low: ['Artless', 'Illogical', 'Uninformed', 'Frivolous']
  },
  wisdom: {
    high: ['Serene', 'Considerate', 'Attentive', 'Wary'],
    low: ['Rash', 'Distracted', 'Oblivious', 'Naive']
  },
  charisma: {
    high: ['Charming', 'Commanding', 'Hilarious', 'Inspiring'],
    low: ['Pedantic', 'Humorless', 'Reserved', 'Tactless']
  }
}

export const ALIGNMENT_PERSONALITY: Record<string, string[]> = {
  Chaotic: ['Boastful', 'Impulsive', 'Rebellious', 'Self-absorbed'],
  Good: ['Compassionate', 'Helpful', 'Honest', 'Kind'],
  Evil: ['Dishonest', 'Vengeful', 'Cruel', 'Greedy'],
  Lawful: ['Cooperative', 'Loyal', 'Judgmental', 'Methodical'],
  Neutral: ['Selfish', 'Disinterested', 'Laconic', 'Pragmatic']
}

function rollD4<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * 4)]
}

/**
 * Rolls personality trait suggestions based on ability scores and alignment.
 * PHB pg 39-40 tables.
 *
 * - Ability scores >= 12 → roll on "high" table
 * - Ability scores <= 9 → roll on "low" table
 * - Scores 10-11 → skip (average)
 * - Alignment parsed into components (e.g. "Lawful Good" → Lawful + Good)
 */
export function rollPersonalityTraits(
  abilityScores: AbilityScoreSet,
  backgroundBonuses: Record<string, number>,
  alignment: string
): string[] {
  const traits: string[] = []

  // Ability-based traits
  for (const [ability, table] of Object.entries(ABILITY_PERSONALITY)) {
    const base = abilityScores[ability as keyof AbilityScoreSet] ?? 10
    const bonus = backgroundBonuses[ability] ?? 0
    const final = base + bonus
    if (final >= 12) {
      traits.push(rollD4(table.high))
    } else if (final <= 9) {
      traits.push(rollD4(table.low))
    }
  }

  // Alignment-based traits
  if (alignment) {
    const parts = alignment.split(' ')
    if (alignment === 'Neutral') {
      // Pure Neutral — roll once on Neutral table
      traits.push(rollD4(ALIGNMENT_PERSONALITY.Neutral))
    } else {
      for (const part of parts) {
        const table = ALIGNMENT_PERSONALITY[part]
        if (table) {
          traits.push(rollD4(table))
        }
      }
    }
  }

  return traits
}
