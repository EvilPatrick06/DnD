// DMG 2024 Ch7 — Sentient Magic Items tables and generation logic

import type { SentientCommunication, SentientItemTraits } from '../types/character-5e'

// ---- Alignment Table (d100) ------------------------------------------------

const ALIGNMENT_TABLE: { min: number; max: number; alignment: string }[] = [
  { min: 1, max: 15, alignment: 'Lawful Good' },
  { min: 16, max: 35, alignment: 'Neutral Good' },
  { min: 36, max: 50, alignment: 'Chaotic Good' },
  { min: 51, max: 63, alignment: 'Lawful Neutral' },
  { min: 64, max: 73, alignment: 'Neutral' },
  { min: 74, max: 85, alignment: 'Chaotic Neutral' },
  { min: 86, max: 89, alignment: 'Lawful Evil' },
  { min: 90, max: 96, alignment: 'Neutral Evil' },
  { min: 97, max: 100, alignment: 'Chaotic Evil' }
]

// ---- Communication Table (d10) ---------------------------------------------

const COMMUNICATION_TABLE: { min: number; max: number; method: SentientCommunication; description: string }[] = [
  {
    min: 1,
    max: 6,
    method: 'empathy',
    description: 'The item communicates by transmitting emotion to the creature carrying or wielding it.'
  },
  { min: 7, max: 9, method: 'speech', description: 'The item speaks one or more languages.' },
  {
    min: 10,
    max: 10,
    method: 'telepathy',
    description:
      'The item speaks one or more languages. In addition, the item can communicate telepathically with any creature that carries or wields it.'
  }
]

// ---- Senses Table (d4) -----------------------------------------------------

const SENSES_TABLE: { roll: number; senses: string }[] = [
  { roll: 1, senses: 'Hearing and standard vision out to 30 feet' },
  { roll: 2, senses: 'Hearing and standard vision out to 60 feet' },
  { roll: 3, senses: 'Hearing and standard vision out to 120 feet' },
  { roll: 4, senses: 'Hearing and Darkvision out to 120 feet' }
]

// ---- Special Purpose Table (d10) -------------------------------------------

export const SPECIAL_PURPOSES: { roll: number; name: string; description: string }[] = [
  {
    roll: 1,
    name: 'Aligned',
    description:
      'The item seeks to defeat or destroy those of a diametrically opposed alignment. Such an item is never Neutral.'
  },
  {
    roll: 2,
    name: 'Bane',
    description:
      'The item seeks to thwart or destroy creatures of a particular type, such as Constructs, Fiends, or Undead.'
  },
  {
    roll: 3,
    name: 'Creator Seeker',
    description: 'The item seeks its creator and wants to understand why it was created.'
  },
  {
    roll: 4,
    name: 'Destiny Seeker',
    description: 'The item believes it and its bearer have key roles to play in future events.'
  },
  { roll: 5, name: 'Destroyer', description: 'The item craves destruction and goads its user to fight arbitrarily.' },
  {
    roll: 6,
    name: 'Glory Seeker',
    description:
      'The item seeks renown as the greatest magic item in the world by winning fame or notoriety for its user.'
  },
  {
    roll: 7,
    name: 'Lore Seeker',
    description:
      'The item craves knowledge or is determined to solve a mystery, learn a secret, or unravel a cryptic prophecy.'
  },
  {
    roll: 8,
    name: 'Protector',
    description: 'The item seeks to defend a particular kind of creature, such as elves or werewolves.'
  },
  {
    roll: 9,
    name: 'Soulmate Seeker',
    description: 'The item seeks another sentient magic item, perhaps one that is similar to itself.'
  },
  {
    roll: 10,
    name: 'Templar',
    description: 'The item seeks to defend the servants and interests of a particular deity.'
  }
]

// ---- Conflict Demands ------------------------------------------------------

export const CONFLICT_DEMANDS = [
  {
    name: 'Chase My Dreams',
    description: "The item demands that its bearer pursue the item's goals to the exclusion of all other goals."
  },
  {
    name: 'Get Rid of It',
    description: 'The item demands that its bearer dispose of anything the item finds repugnant.'
  },
  { name: "It's Time for a Change", description: 'The item demands to be given to someone else.' },
  { name: 'Keep Me Close', description: 'The item insists on being carried or worn at all times.' }
]

// ---- Dice Helpers ----------------------------------------------------------

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function rollAbility(): number {
  const dice = [roll(6), roll(6), roll(6), roll(6)]
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

// ---- Generation Functions --------------------------------------------------

function rollAlignment(): string {
  const r = roll(100)
  const entry = ALIGNMENT_TABLE.find((e) => r >= e.min && r <= e.max)
  return entry?.alignment ?? 'Neutral'
}

function rollCommunication(): { method: SentientCommunication; description: string } {
  const r = roll(10)
  const entry = COMMUNICATION_TABLE.find((e) => r >= e.min && r <= e.max)
  return entry ?? COMMUNICATION_TABLE[0]
}

function rollSenses(): string {
  const r = roll(4)
  return SENSES_TABLE.find((e) => e.roll === r)?.senses ?? SENSES_TABLE[0].senses
}

function rollSpecialPurpose(): { name: string; description: string } {
  const r = roll(10)
  const entry = SPECIAL_PURPOSES.find((e) => e.roll === r)
  return entry ?? SPECIAL_PURPOSES[0]
}

/** Generate a random sentient item traits block using DMG 2024 tables. */
export function generateSentientTraits(): SentientItemTraits {
  const communication = rollCommunication()
  const purpose = rollSpecialPurpose()

  return {
    intelligence: rollAbility(),
    wisdom: rollAbility(),
    charisma: rollAbility(),
    alignment: rollAlignment(),
    communication: communication.method,
    senses: rollSenses(),
    specialPurpose: `${purpose.name}: ${purpose.description}`
  }
}

/** Calculate the conflict save DC for a sentient item (DC 12 + CHA modifier). */
export function getConflictSaveDC(charisma: number): number {
  const modifier = Math.floor((charisma - 10) / 2)
  return 12 + modifier
}
