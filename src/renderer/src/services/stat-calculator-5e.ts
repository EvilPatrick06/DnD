import type { AbilityScoreSet, AbilityName } from '../types/character-common'
import { abilityModifier } from '../types/character-common'

interface RaceData {
  abilityBonuses: Partial<Record<AbilityName, number>>
  speed: number
  size: string
}

interface ClassData {
  hitDie: number
  savingThrows: string[]
}

export interface DerivedStats5e {
  abilityScores: AbilityScoreSet
  abilityModifiers: AbilityScoreSet
  maxHP: number
  armorClass: number
  initiative: number
  speed: number
  proficiencyBonus: number
  savingThrows: Record<string, number>
}

export function calculate5eStats(
  baseScores: AbilityScoreSet,
  race: RaceData | null,
  cls: ClassData | null,
  level: number,
  speciesAbilityBonuses?: Partial<Record<AbilityName, number>>
): DerivedStats5e {
  // Apply racial bonuses (or flexible species ability bonuses for 2024 species)
  const scores: AbilityScoreSet = { ...baseScores }
  if (race && Object.keys(race.abilityBonuses).length > 0) {
    for (const [ability, bonus] of Object.entries(race.abilityBonuses)) {
      scores[ability as AbilityName] += bonus as number
    }
  } else if (speciesAbilityBonuses) {
    for (const [ability, bonus] of Object.entries(speciesAbilityBonuses)) {
      scores[ability as AbilityName] += bonus as number
    }
  }

  // Compute modifiers
  const modifiers: AbilityScoreSet = {
    strength: abilityModifier(scores.strength),
    dexterity: abilityModifier(scores.dexterity),
    constitution: abilityModifier(scores.constitution),
    intelligence: abilityModifier(scores.intelligence),
    wisdom: abilityModifier(scores.wisdom),
    charisma: abilityModifier(scores.charisma)
  }

  const proficiencyBonus = Math.ceil(level / 4) + 1
  const hitDie = cls?.hitDie ?? 8
  const conMod = modifiers.constitution

  // HP: max at level 1, average + CON for subsequent levels
  let maxHP = hitDie + conMod
  for (let i = 2; i <= level; i++) {
    maxHP += Math.floor(hitDie / 2) + 1 + conMod
  }
  maxHP = Math.max(maxHP, 1)

  const armorClass = 10 + modifiers.dexterity
  const initiative = modifiers.dexterity
  const speed = race?.speed ?? 30

  // Saving throws
  const savingThrows: Record<string, number> = {}
  const proficientSaves = (cls?.savingThrows ?? []).map((s) => s.toLowerCase())
  for (const ability of Object.keys(scores) as AbilityName[]) {
    const isProficient = proficientSaves.includes(ability)
    savingThrows[ability] = modifiers[ability] + (isProficient ? proficiencyBonus : 0)
  }

  return {
    abilityScores: scores,
    abilityModifiers: modifiers,
    maxHP,
    armorClass,
    initiative,
    speed,
    proficiencyBonus,
    savingThrows
  }
}
