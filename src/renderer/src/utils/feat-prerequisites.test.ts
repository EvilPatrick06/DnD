/**
 * Tests for feat-prerequisites.ts — feat prerequisite validation
 */
import { describe, expect, it } from 'vitest'
import type { Character5e } from '../types/character-5e'
import { meetsFeatPrerequisites } from './feat-prerequisites'

function makeCharacter(overrides: Partial<Character5e> = {}): Character5e {
  return {
    id: 'test-char',
    name: 'Test',
    gameSystem: 'dnd5e',
    level: 5,
    species: 'Human',
    classes: [{ name: 'Fighter', level: 5, hitDie: 10, subclass: undefined }],
    abilityScores: {
      strength: 16,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 8
    },
    proficiencies: {
      armor: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'],
      weapons: ['Simple weapons', 'Martial weapons'],
      tools: [],
      languages: ['Common'],
      skills: []
    },
    feats: [],
    hp: { current: 44, max: 44, temp: 0 },
    hitDice: { d10: { current: 5, max: 5 } },
    spellSlots: {},
    spells: [],
    equipment: [],
    senses: [],
    resistances: [],
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 },
    background: 'soldier',
    skills: {},
    ...overrides
  } as Character5e
}

describe('meetsFeatPrerequisites', () => {
  it('passes with no prerequisites', () => {
    const char = makeCharacter()
    expect(meetsFeatPrerequisites(char, [])).toBe(true)
  })

  it('checks single ability score "Strength 13 or higher"', () => {
    const char = makeCharacter({
      abilityScores: { strength: 16, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    expect(meetsFeatPrerequisites(char, ['Strength 13 or higher'])).toBe(true)
  })

  it('fails single ability score when too low', () => {
    const char = makeCharacter({
      abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    expect(meetsFeatPrerequisites(char, ['Strength 13 or higher'])).toBe(false)
  })

  it('checks dual ability "Strength or Dexterity 13 or higher"', () => {
    // STR 10 but DEX 14 — should pass
    const char = makeCharacter({
      abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    expect(meetsFeatPrerequisites(char, ['Strength or Dexterity 13 or higher'])).toBe(true)
  })

  it('fails dual ability when both too low', () => {
    const char = makeCharacter({
      abilityScores: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    expect(meetsFeatPrerequisites(char, ['Strength or Dexterity 13 or higher'])).toBe(false)
  })

  it('checks armor proficiency', () => {
    const char = makeCharacter()
    expect(meetsFeatPrerequisites(char, ['Proficiency with heavy armor'])).toBe(true)
  })

  it('fails armor proficiency when lacking', () => {
    const char = makeCharacter({
      proficiencies: { armor: ['Light armor'], weapons: [], tools: [], languages: ['Common'], savingThrows: [] }
    })
    expect(meetsFeatPrerequisites(char, ['Proficiency with heavy armor'])).toBe(false)
  })

  it('checks spellcasting prerequisite', () => {
    const char = makeCharacter({
      classes: [{ name: 'Wizard', level: 5, hitDie: 6, subclass: undefined }]
    })
    expect(meetsFeatPrerequisites(char, ['The ability to cast at least one spell'])).toBe(true)
  })

  it('fails spellcasting for non-caster', () => {
    const char = makeCharacter()
    expect(meetsFeatPrerequisites(char, ['The ability to cast at least one spell'])).toBe(false)
  })

  it('checks multiple prerequisites (all must pass)', () => {
    const char = makeCharacter()
    // STR 13+ (has 16) AND heavy armor (has it)
    expect(meetsFeatPrerequisites(char, ['Strength 13 or higher', 'Proficiency with heavy armor'])).toBe(true)
  })

  it('fails if any prerequisite fails', () => {
    const char = makeCharacter({
      abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    // STR 13+ fails even though heavy armor passes
    expect(meetsFeatPrerequisites(char, ['Strength 13 or higher', 'Proficiency with heavy armor'])).toBe(false)
  })

  it('handles "13+" format', () => {
    const char = makeCharacter({
      abilityScores: { strength: 16, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 8 }
    })
    expect(meetsFeatPrerequisites(char, ['Strength 13+'])).toBe(true)
  })

  it('unknown prerequisites pass by default', () => {
    const char = makeCharacter()
    expect(meetsFeatPrerequisites(char, ['Some unknown requirement'])).toBe(true)
  })
})
