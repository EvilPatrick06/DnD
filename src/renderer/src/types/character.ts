import type { Character5e } from './character-5e'
import type { CharacterPf2e } from './character-pf2e'

export type Character = Character5e | CharacterPf2e

export function is5eCharacter(c: Character): c is Character5e {
  return c.gameSystem === 'dnd5e'
}

export function isPf2eCharacter(c: Character): c is CharacterPf2e {
  return c.gameSystem === 'pf2e'
}
