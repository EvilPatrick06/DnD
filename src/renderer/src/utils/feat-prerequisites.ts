import type { Character5e } from '../types/character-5e'
import type { AbilityName } from '../types/character-common'
import { ABILITY_NAMES } from '../types/character-common'

/**
 * Check whether a character meets all prerequisites for a feat.
 * Returns true if all prerequisites are satisfied.
 */
export function meetsFeatPrerequisites(character: Character5e, prerequisites: string[]): boolean {
  return prerequisites.every((prereq) => checkSinglePrerequisite(character, prereq))
}

function checkSinglePrerequisite(character: Character5e, prereq: string): boolean {
  const lower = prereq.toLowerCase().trim()

  // "Strength 13 or higher", "Dexterity 13 or higher"
  const singleAbilityMatch = lower.match(
    /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)\s+or\s+higher$/
  )
  if (singleAbilityMatch) {
    const ability = singleAbilityMatch[1] as AbilityName
    const threshold = parseInt(singleAbilityMatch[2], 10)
    return character.abilityScores[ability] >= threshold
  }

  // "Strength or Dexterity 13 or higher", "Intelligence or Wisdom 13 or higher", "Dexterity or Constitution 13 or higher"
  const dualAbilityMatch = lower.match(
    /^(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+or\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)\s+or\s+higher$/
  )
  if (dualAbilityMatch) {
    const ability1 = dualAbilityMatch[1] as AbilityName
    const ability2 = dualAbilityMatch[2] as AbilityName
    const threshold = parseInt(dualAbilityMatch[3], 10)
    return character.abilityScores[ability1] >= threshold || character.abilityScores[ability2] >= threshold
  }

  // "Charisma 13 or higher" (already covered by single ability match)

  // "Proficiency with medium armor" / "Medium Armor Training"
  if (lower === 'proficiency with medium armor' || lower === 'medium armor training') {
    return character.proficiencies.armor.some((a) => a.toLowerCase().includes('medium'))
  }

  // "Proficiency with heavy armor"
  if (lower === 'proficiency with heavy armor') {
    return character.proficiencies.armor.some((a) => a.toLowerCase().includes('heavy'))
  }

  // "Proficiency with light armor"
  if (lower === 'proficiency with light armor') {
    return character.proficiencies.armor.some((a) => a.toLowerCase().includes('light'))
  }

  // "Shield Training"
  if (lower === 'shield training') {
    return character.proficiencies.armor.some((a) => a.toLowerCase().includes('shield'))
  }

  // Spellcasting checks
  if (
    lower === 'the ability to cast at least one spell' ||
    lower === 'spellcasting or pact magic feature' ||
    lower === 'spellcasting feature'
  ) {
    return hasSpellcasting(character)
  }

  // Class checks — e.g. "paladin"
  const classMatch = ABILITY_NAMES.every((a) => !lower.startsWith(a))
  if (classMatch && lower.length < 30) {
    const hasClass = character.classes.some((c) => c.name.toLowerCase() === lower)
    if (hasClass) return true
  }

  // "Wielding a Shield" — display-only, always pass (checked at runtime)
  if (lower === 'wielding a shield') {
    return true
  }

  // Level-based prerequisite: "Level 4 or higher", "4th level or higher", "Level 8+"
  const levelMatch = lower.match(/^(?:level\s+)?(\d+)(?:th|st|nd|rd)?\s*(?:level\s+)?(?:or\s+higher|\+)$/i)
  if (levelMatch) {
    return character.level >= parseInt(levelMatch[1], 10)
  }

  // Ability score checks with "13+" format: "Strength or Dexterity 13+"
  const plusMatch = lower.match(
    /^(strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s+or\s+(strength|dexterity|constitution|intelligence|wisdom|charisma))?\s+(\d+)\+$/
  )
  if (plusMatch) {
    const threshold = parseInt(plusMatch[3], 10)
    const ability1 = plusMatch[1] as AbilityName
    if (plusMatch[2]) {
      const ability2 = plusMatch[2] as AbilityName
      return character.abilityScores[ability1] >= threshold || character.abilityScores[ability2] >= threshold
    }
    return character.abilityScores[ability1] >= threshold
  }

  // Unknown prerequisite — pass by default
  return true
}

function hasSpellcasting(character: Character5e): boolean {
  if (character.spellcasting) return true
  if (character.pactMagicSlotLevels && Object.keys(character.pactMagicSlotLevels).length > 0) return true
  const spellcastingClasses = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
  return character.classes.some((c) => spellcastingClasses.includes(c.name.toLowerCase()))
}
