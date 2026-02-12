import type { AbilityScoreSet, AbilityName } from '../types/character-common'
import { abilityModifier } from '../types/character-common'

export interface DerivedStatsPf2e {
  abilityScores: AbilityScoreSet
  abilityModifiers: AbilityScoreSet
  maxHP: number
  armorClass: number
  speed: number
  perception: number
  classDC: number
  proficiencyBonus: number
  savingThrows: {
    fortitude: number
    reflex: number
    will: number
  }
}

const PROF_RANK_BONUS: Record<string, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8
}

export function calculatePf2eStats(
  baseScores: AbilityScoreSet,
  level: number,
  ancestryHP: number,
  classHP: number,
  perceptionRank: string,
  savingThrowRanks: { fortitude: string; reflex: string; will: string },
  keyAbility: string | null,
  unarmoredRank: string,
  ancestrySpeed?: number
): DerivedStatsPf2e {
  const scores: AbilityScoreSet = { ...baseScores }

  const modifiers: AbilityScoreSet = {
    strength: abilityModifier(scores.strength),
    dexterity: abilityModifier(scores.dexterity),
    constitution: abilityModifier(scores.constitution),
    intelligence: abilityModifier(scores.intelligence),
    wisdom: abilityModifier(scores.wisdom),
    charisma: abilityModifier(scores.charisma)
  }

  const conMod = modifiers.constitution

  // PF2e HP = ancestry HP + (class HP + CON mod) per level
  const maxHP = Math.max(1, ancestryHP + (classHP + conMod) * level)

  // Proficiency bonus = level + rank bonus (trained=2, expert=4, etc.)
  const proficiencyBonus = level

  // AC = 10 + DEX mod + proficiency (level + rank bonus for unarmored)
  const unarmoredBonus = PROF_RANK_BONUS[unarmoredRank] ?? 0
  const armorClass = 10 + modifiers.dexterity + (unarmoredBonus > 0 ? level + unarmoredBonus : 0)

  // Perception = WIS mod + level + rank bonus
  const perceptionBonus = PROF_RANK_BONUS[perceptionRank] ?? 0
  const perception = modifiers.wisdom + (perceptionBonus > 0 ? level + perceptionBonus : 0)

  // Class DC = 10 + key ability mod + level + rank bonus (trained = 2)
  const keyAbMod = keyAbility ? modifiers[keyAbility as AbilityName] ?? 0 : 0
  const classDC = 10 + keyAbMod + level + 2

  // Saving throws = ability mod + level + rank bonus
  const fortRank = PROF_RANK_BONUS[savingThrowRanks.fortitude] ?? 0
  const refRank = PROF_RANK_BONUS[savingThrowRanks.reflex] ?? 0
  const willRank = PROF_RANK_BONUS[savingThrowRanks.will] ?? 0

  const savingThrows = {
    fortitude: modifiers.constitution + (fortRank > 0 ? level + fortRank : 0),
    reflex: modifiers.dexterity + (refRank > 0 ? level + refRank : 0),
    will: modifiers.wisdom + (willRank > 0 ? level + willRank : 0)
  }

  return {
    abilityScores: scores,
    abilityModifiers: modifiers,
    maxHP,
    armorClass,
    speed: ancestrySpeed ?? 0,
    perception,
    classDC,
    proficiencyBonus,
    savingThrows
  }
}
