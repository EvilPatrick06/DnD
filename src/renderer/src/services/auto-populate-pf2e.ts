import type { CharacterPf2e } from '../types/character-pf2e'
import type { ProficiencyRank } from '../types/character-pf2e'
import type { AbilityName } from '../types/character-common'

export const SKILL_ABILITY_MAP_PF2E: Record<string, AbilityName> = {
  'Acrobatics': 'dexterity',
  'Arcana': 'intelligence',
  'Athletics': 'strength',
  'Crafting': 'intelligence',
  'Deception': 'charisma',
  'Diplomacy': 'charisma',
  'Intimidation': 'charisma',
  'Lore': 'intelligence',
  'Medicine': 'wisdom',
  'Nature': 'wisdom',
  'Occultism': 'intelligence',
  'Performance': 'charisma',
  'Religion': 'wisdom',
  'Society': 'intelligence',
  'Stealth': 'dexterity',
  'Survival': 'wisdom',
  'Thievery': 'dexterity'
}

export function populateSkillsPf2e(
  trainedSkills: string[],
  mandatorySkills: string[]
): CharacterPf2e['skills'] {
  const allTrained = new Set([...trainedSkills, ...mandatorySkills])
  return Object.entries(SKILL_ABILITY_MAP_PF2E).map(([name, ability]) => ({
    name,
    ability,
    rank: (allTrained.has(name) ? 'trained' : 'untrained') as ProficiencyRank,
    source: mandatorySkills.includes(name) ? 'class' : trainedSkills.includes(name) ? 'choice' : ''
  }))
}
