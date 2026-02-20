// ============================================================================
// Bastion Events — D&D 5e (2024 PHB) bastion turn event tables, dice helpers,
// and resolution functions for automating bastion management between sessions.
// ============================================================================

// ---- Dice Helpers ----------------------------------------------------------

/** Roll a single die with `n` sides (1..n inclusive). */
export function rollD(n: number): number {
  return Math.floor(Math.random() * n) + 1
}

/** Roll `count` dice each with `sides` sides, return the array of results. */
export function rollND(count: number, sides: number): number[] {
  const results: number[] = []
  for (let i = 0; i < count; i++) {
    results.push(rollD(sides))
  }
  return results
}

/** Roll a d100 (1..100). */
export function rollD100(): number {
  return rollD(100)
}

// ---- Types -----------------------------------------------------------------

export interface BastionEventResult {
  eventType: string
  description: string
  roll: number
  subRolls: Record<string, number>
}

export interface AttackEventResult {
  defendersLost: number
  facilityShutdown: boolean
  attackDice: number[]
  description: string
}

export interface GamblingResult {
  roll: number
  goldEarned: number
  diceRolled: number[]
  description: string
}

export interface TreasureResult {
  roll: number
  description: string
  category: string
}

// ---- All Is Well Flavors (d8) — DMG 2024 p.235 ----------------------------

export const ALL_IS_WELL_FLAVORS: { roll: number; flavor: string }[] = [
  { roll: 1, flavor: 'Accident reports are way down.' },
  { roll: 2, flavor: 'The leak in the roof has been fixed.' },
  { roll: 3, flavor: 'No vermin infestations to report.' },
  { roll: 4, flavor: 'You-Know-Who lost their spectacles again.' },
  { roll: 5, flavor: 'One of your hirelings adopted a stray dog.' },
  { roll: 6, flavor: 'You received a lovely letter from a friend.' },
  { roll: 7, flavor: 'Some practical joker has been putting rotten eggs in people\'s boots.' },
  { roll: 8, flavor: 'Someone thought they saw a ghost.' }
]

// ---- Guest Table (d4) — DMG 2024 p.235 ------------------------------------

export const GUEST_TABLE: { roll: number; guestType: string; description: string }[] = [
  {
    roll: 1,
    guestType: 'Renowned Individual',
    description:
      'The guest is an individual of great renown who stays for 7 days. At the end of their stay, the guest gives you a letter of recommendation.'
  },
  {
    roll: 2,
    guestType: 'Sanctuary Seeker',
    description:
      'The guest requests sanctuary while avoiding persecution for their beliefs or crimes. They depart 7 days later, but not before offering you a gift of 1d6 × 100 GP.'
  },
  {
    roll: 3,
    guestType: 'Mercenary',
    description:
      "The guest is a mercenary, giving you one additional Bastion Defender. The guest doesn't require a facility to house them, and they stay until you send them away or they're killed."
  },
  {
    roll: 4,
    guestType: 'Friendly Monster',
    description:
      'The guest is a Friendly monster, such as a brass dragon or a treant. If your Bastion is attacked while this monster is your guest, it defends your Bastion, and you lose no Bastion Defenders. The monster leaves after it defends your Bastion once or when you send it away.'
  }
]

// ---- Treasure Table (d100) — DMG 2024 p.236 --------------------------------

export const TREASURE_TABLE: { min: number; max: number; category: string; description: string }[] = [
  {
    min: 1,
    max: 40,
    category: 'art-25gp',
    description: 'Roll on the 25 GP Art Objects table.'
  },
  {
    min: 41,
    max: 63,
    category: 'art-250gp',
    description: 'Roll on the 250 GP Art Objects table.'
  },
  {
    min: 64,
    max: 73,
    category: 'art-750gp',
    description: 'Roll on the 750 GP Art Objects table.'
  },
  {
    min: 74,
    max: 75,
    category: 'art-2500gp',
    description: 'Roll on the 2,500 GP Art Objects table.'
  },
  {
    min: 76,
    max: 90,
    category: 'magic-common',
    description: 'Roll on a Common Magic Items table of your choice (Arcana, Armaments, Implements, or Relics).'
  },
  {
    min: 91,
    max: 98,
    category: 'magic-uncommon',
    description: 'Roll on an Uncommon Magic Items table of your choice (Arcana, Armaments, Implements, or Relics).'
  },
  {
    min: 99,
    max: 100,
    category: 'magic-rare',
    description: 'Roll on a Rare Magic Items table of your choice (Arcana, Armaments, Implements, or Relics).'
  }
]

// ---- Bastion Events Table (d100) -------------------------------------------

interface BastionEventEntry {
  min: number
  max: number
  eventType: string
  label: string
}

export const BASTION_EVENTS_TABLE: BastionEventEntry[] = [
  { min: 1, max: 50, eventType: 'all-is-well', label: 'All Is Well' },
  { min: 51, max: 55, eventType: 'attack', label: 'Attack' },
  { min: 56, max: 58, eventType: 'criminal-hireling', label: 'Criminal Hireling' },
  { min: 59, max: 63, eventType: 'extraordinary-opportunity', label: 'Extraordinary Opportunity' },
  { min: 64, max: 72, eventType: 'friendly-visitors', label: 'Friendly Visitors' },
  { min: 73, max: 76, eventType: 'guest', label: 'Guest' },
  { min: 77, max: 79, eventType: 'lost-hirelings', label: 'Lost Hirelings' },
  { min: 80, max: 83, eventType: 'magical-discovery', label: 'Magical Discovery' },
  { min: 84, max: 91, eventType: 'refugees', label: 'Refugees' },
  { min: 92, max: 98, eventType: 'request-for-aid', label: 'Request for Aid' },
  { min: 99, max: 100, eventType: 'treasure', label: 'Treasure' }
]

// ---- Gaming Hall Winnings (d100) — DMG 2024 p.216 --------------------------

export const GAMING_HALL_WINNINGS: { min: number; max: number; diceCount: number; description: string }[] = [
  { min: 1, max: 50, diceCount: 1, description: 'The house takes in 1d6 × 10 GP.' },
  { min: 51, max: 85, diceCount: 2, description: 'The house takes in 2d6 × 10 GP.' },
  { min: 86, max: 95, diceCount: 4, description: 'The house takes in 4d6 × 10 GP.' },
  { min: 96, max: 100, diceCount: 10, description: 'The house takes in 10d6 × 10 GP.' }
]

// ---- Menagerie Creatures ---------------------------------------------------

export interface MenagerieCreatureEntry {
  name: string
  creatureType: string
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
  cost: number
  cr: string
}

// DMG 2024 p.226 — Menagerie Creatures table
export const MENAGERIE_CREATURES: MenagerieCreatureEntry[] = [
  { name: 'Ape', creatureType: 'Beast', size: 'medium', cost: 500, cr: '1/2' },
  { name: 'Black Bear', creatureType: 'Beast', size: 'medium', cost: 500, cr: '1/2' },
  { name: 'Brown Bear', creatureType: 'Beast', size: 'large', cost: 1000, cr: '1' },
  { name: 'Constrictor Snake', creatureType: 'Beast', size: 'large', cost: 250, cr: '1/4' },
  { name: 'Crocodile', creatureType: 'Beast', size: 'large', cost: 500, cr: '1/2' },
  { name: 'Dire Wolf', creatureType: 'Beast', size: 'large', cost: 1000, cr: '1' },
  { name: 'Giant Vulture', creatureType: 'Beast', size: 'large', cost: 1000, cr: '1' },
  { name: 'Hyena', creatureType: 'Beast', size: 'medium', cost: 50, cr: '0' },
  { name: 'Jackal', creatureType: 'Beast', size: 'small', cost: 50, cr: '0' },
  { name: 'Lion', creatureType: 'Beast', size: 'large', cost: 1000, cr: '1' },
  { name: 'Owlbear', creatureType: 'Monstrosity', size: 'large', cost: 3500, cr: '3' },
  { name: 'Panther', creatureType: 'Beast', size: 'medium', cost: 250, cr: '1/4' },
  { name: 'Tiger', creatureType: 'Beast', size: 'large', cost: 1000, cr: '1' }
]

// DMG 2024 p.226 — Creature Costs by Challenge Rating (for custom creatures)
export const CREATURE_COSTS_BY_CR: { cr: string; cost: number }[] = [
  { cr: '0', cost: 50 },
  { cr: '1/8', cost: 50 },
  { cr: '1/4', cost: 250 },
  { cr: '1/2', cost: 500 },
  { cr: '1', cost: 1000 },
  { cr: '2', cost: 2000 },
  { cr: '3', cost: 3500 }
]

// ---- Expert Trainers -------------------------------------------------------

export interface ExpertTrainerEntry {
  type: 'battle' | 'skills' | 'tools' | 'unarmed-combat' | 'weapon'
  name: string
  empowerEffect: string
  description: string
}

// DMG 2024 p.232 — Expert Trainers table
export const EXPERT_TRAINERS: ExpertTrainerEntry[] = [
  {
    type: 'battle',
    name: 'Battle Expert',
    empowerEffect:
      'When you take damage from an attack made with an Unarmed Strike or a weapon, you can take a Reaction to reduce this damage by 1d4.',
    description:
      'A veteran warrior who drills defenders and visitors in combat tactics, formations, and battlefield awareness.'
  },
  {
    type: 'skills',
    name: 'Skills Expert',
    empowerEffect:
      'You gain proficiency in one of the following skills of your choice: Acrobatics, Athletics, Performance, Sleight of Hand, or Stealth.',
    description:
      'A versatile instructor who coaches students in acrobatics, athletics, stealth, performance, and sleight of hand.'
  },
  {
    type: 'tools',
    name: 'Tools Expert',
    empowerEffect: 'You gain proficiency with one tool of your choice.',
    description:
      'A master artisan who teaches the finer points of craftsmanship, from smithing and carpentry to alchemy and calligraphy.'
  },
  {
    type: 'unarmed-combat',
    name: 'Unarmed Combat Expert',
    empowerEffect:
      'When you hit with your Unarmed Strike and deal damage, the attack deals an extra 1d4 Bludgeoning damage.',
    description: 'A martial arts master who teaches striking, grappling, and defensive techniques for unarmed fighting.'
  },
  {
    type: 'weapon',
    name: 'Weapon Expert',
    empowerEffect:
      "Choose a kind of Simple or Martial weapon, such as Spear or Longbow. If you aren't proficient with the weapon, you gain proficiency with it. If you already have proficiency with the weapon, you can use its mastery property.",
    description: 'An arms instructor specializing in swordsmanship, archery, polearms, and other weapon disciplines.'
  }
]

// ---- Pub Specials ----------------------------------------------------------

export interface PubSpecialEntry {
  name: string
  description: string
  effect: string
}

export const PUB_SPECIALS: PubSpecialEntry[] = [
  {
    name: 'Dragonfire Ale',
    description: 'A fiery red ale brewed with fire pepper extract. Smoke curls from the mug.',
    effect: 'A creature that drinks this gains resistance to Fire damage for 1 hour.'
  },
  {
    name: 'Fey Nectar Mead',
    description: 'A shimmering golden mead said to be made from honey gathered in the Feywild.',
    effect: 'A creature that drinks this has advantage on Charisma (Persuasion) checks for 1 hour.'
  },
  {
    name: 'Shadowdark Stout',
    description: 'An impossibly dark beer that seems to absorb light. Served in an opaque tankard.',
    effect:
      'A creature that drinks this gains Darkvision (60 ft.) for 8 hours, or extends existing Darkvision by 30 ft.'
  },
  {
    name: "Healer's Herbal Tonic",
    description: 'A warm, soothing brew of medicinal herbs and honey with a hint of mint.',
    effect:
      'A creature that drinks this regains 2d4 + 2 Hit Points and is cured of one minor ailment (headache, nausea, etc.).'
  },
  {
    name: "Giant's Grog",
    description: 'A thick, foamy brew served in an oversized stein. Even a sip makes you feel ten feet tall.',
    effect:
      'A creature that drinks this has advantage on Strength checks for 1 hour and gains 1d4 Temporary Hit Points.'
  }
]

// ---- Sample Guilds ---------------------------------------------------------

export interface GuildEntry {
  guildType: string
  description: string
}

export const SAMPLE_GUILDS: GuildEntry[] = [
  {
    guildType: "Adventurers' Guild",
    description:
      'A guild for adventurers seeking quests, companions, and shared resources. Members post job boards and split bounties.'
  },
  {
    guildType: "Merchants' Guild",
    description:
      'A trade guild that negotiates bulk rates, protects caravans, and maintains trade routes. Members enjoy discounted goods.'
  },
  {
    guildType: "Crafters' Guild",
    description:
      'A guild of artisans and crafters who share techniques, tools, and apprentices. Members can use shared workshops.'
  },
  {
    guildType: "Thieves' Guild",
    description:
      'A secretive guild of rogues and information brokers. Members gain access to fences, safe houses, and underworld contacts.'
  },
  {
    guildType: "Mages' Guild",
    description:
      'An arcane society for sharing magical knowledge, spell research, and component sourcing. Members can copy spells at reduced cost.'
  },
  {
    guildType: 'Mercenary Company',
    description:
      'A guild of soldiers-for-hire providing security, escorts, and military contracts. Members can recruit trained fighters.'
  }
]

// ---- Emerald Enclave Creatures (FR setting) --------------------------------

export interface EnclaveCreatureEntry {
  creatureType: string
  examples: string
  cr: string
}

export const EMERALD_ENCLAVE_CREATURES: EnclaveCreatureEntry[] = [
  { creatureType: 'Awakened Shrub', examples: 'Awakened Shrub', cr: '0' },
  { creatureType: 'Awakened Tree', examples: 'Awakened Tree', cr: '2' },
  { creatureType: 'Blink Dog', examples: 'Blink Dog', cr: '1/4' },
  { creatureType: 'Dryad', examples: 'Dryad', cr: '1' },
  { creatureType: 'Giant Elk', examples: 'Giant Elk', cr: '2' },
  { creatureType: 'Pixie', examples: 'Pixie', cr: '1/4' },
  { creatureType: 'Satyr', examples: 'Satyr', cr: '1/2' },
  { creatureType: 'Sprite', examples: 'Sprite', cr: '1/4' },
  { creatureType: 'Treant', examples: 'Treant (grove guardian)', cr: '9' },
  { creatureType: 'Unicorn', examples: 'Unicorn', cr: '5' },
  { creatureType: "Will-o'-Wisp", examples: "Will-o'-Wisp (tamed, guides lost travelers)", cr: '2' },
  { creatureType: 'Wood Woad', examples: 'Wood Woad', cr: '5' }
]

// ---- Forge Constructs (Eberron construct-forge) ----------------------------

export interface ForgeConstructEntry {
  name: string
  cr: string
  timeDays: number
  costGP: number
  description: string
}

export const FORGE_CONSTRUCTS: ForgeConstructEntry[] = [
  {
    name: 'Homunculus Servant',
    cr: '0',
    timeDays: 7,
    costGP: 100,
    description: 'A tiny mechanical helper that can perform simple tasks and deliver messages.'
  },
  {
    name: 'Iron Defender',
    cr: '1',
    timeDays: 14,
    costGP: 500,
    description: 'A loyal mechanical hound that serves as a guard and combatant.'
  },
  {
    name: 'Steel Defender',
    cr: '1',
    timeDays: 14,
    costGP: 750,
    description: 'An advanced mechanical guardian with enhanced combat capabilities.'
  },
  {
    name: 'Bronze Scout',
    cr: '1',
    timeDays: 14,
    costGP: 500,
    description: 'A small, agile construct designed for reconnaissance and scouting missions.'
  },
  {
    name: 'Iron Cobra',
    cr: '4',
    timeDays: 30,
    costGP: 2000,
    description: 'A serpentine construct capable of delivering venomous strikes and guarding passages.'
  },
  {
    name: 'Stone Defender',
    cr: '4',
    timeDays: 30,
    costGP: 2500,
    description: 'A hulking stone guardian with exceptional durability and crushing strength.'
  },
  {
    name: 'Shield Guardian',
    cr: '7',
    timeDays: 60,
    costGP: 10000,
    description: 'A powerful construct bound to an amulet, capable of absorbing damage for its master.'
  },
  {
    name: 'Iron Golem',
    cr: '16',
    timeDays: 120,
    costGP: 50000,
    description: 'The pinnacle of construct creation. A massive iron automaton of devastating power.'
  }
]

// ---- Resolution Functions --------------------------------------------------

function findEventEntry(roll: number): BastionEventEntry {
  const entry = BASTION_EVENTS_TABLE.find((e) => roll >= e.min && roll <= e.max)
  // Should never happen for 1-100, but fallback to All Is Well
  return entry ?? BASTION_EVENTS_TABLE[0]
}

function findTreasureEntry(roll: number): { description: string; category: string } {
  const entry = TREASURE_TABLE.find((e) => roll >= e.min && roll <= e.max)
  return entry ?? { description: 'A curious trinket of unknown value', category: 'art-25gp' }
}

function findGamblingEntry(roll: number): { diceCount: number; description: string } {
  const entry = GAMING_HALL_WINNINGS.find((e) => roll >= e.min && roll <= e.max)
  return entry ?? { diceCount: 1, description: 'The house takes in 1d6 × 10 GP.' }
}

/**
 * Roll a bastion event on the d100 table. Returns the event type, a
 * human-readable description with all sub-rolls already resolved, the
 * primary d100 roll, and a record of any sub-rolls that were made.
 */
export function rollBastionEvent(): BastionEventResult {
  const roll = rollD100()
  const entry = findEventEntry(roll)
  const subRolls: Record<string, number> = {}

  let description = ''

  switch (entry.eventType) {
    case 'all-is-well': {
      const flavorRoll = rollD(8)
      subRolls['d8-flavor'] = flavorRoll
      const flavor = ALL_IS_WELL_FLAVORS.find((f) => f.roll === flavorRoll)
      description = `All Is Well. ${flavor?.flavor ?? 'Nothing eventful happens this bastion turn.'}`
      break
    }

    case 'attack': {
      const attackDice = rollND(6, 6)
      const onesCount = attackDice.filter((d) => d === 1).length
      subRolls['6d6-attack'] = attackDice.reduce((a, b) => a + b, 0)
      subRolls['defenders-killed'] = onesCount
      description = `Attack! Enemies assault the bastion. Roll 6d6 [${attackDice.join(', ')}] — each 1 means a defender is killed. ${onesCount} defender(s) lost. If you have no defenders, a random facility is shut down for 1d6 days.`
      break
    }

    case 'criminal-hireling': {
      const bribeRoll = rollD(6)
      subRolls['d6-bribe'] = bribeRoll
      const bribeCost = bribeRoll * 100
      description = `Criminal Hireling! One of your hirelings has been caught engaging in criminal activity. You can pay a bribe of ${bribeCost} GP (${bribeRoll}d100) to make the problem go away, or dismiss the hireling and lose use of their facility for 1 bastion turn.`
      break
    }

    case 'extraordinary-opportunity': {
      description =
        'Extraordinary Opportunity! Your Bastion is given the opportunity to host an important festival or celebration, fund the research of a powerful spellcaster, or appease a domineering noble. If you invest 500 GP, the DM rolls again on the Bastion Events table (rerolling this result if it comes up again). If you decline, nothing happens.'
      break
    }

    case 'friendly-visitors': {
      const incomeRoll = rollD(6)
      subRolls['d6-income'] = incomeRoll
      const income = incomeRoll * 100
      description = `Friendly Visitors! A group of friendly visitors arrives at the bastion. They spend freely, generating ${income} GP (${incomeRoll} x 100) in income. You may also let them use one facility of your choice for free.`
      break
    }

    case 'guest': {
      const guestRoll = rollD(4)
      subRolls['d4-guest'] = guestRoll
      const guest = GUEST_TABLE.find((g) => g.roll === guestRoll)
      description = `Guest! ${guest?.guestType ?? 'A mysterious visitor'} arrives at the bastion. ${guest?.description ?? 'They request lodging for a few days.'}`
      break
    }

    case 'lost-hirelings': {
      description =
        'Lost Hirelings! Some of your hirelings have gone missing — lost in nearby wilderness, lured away by rival employers, or simply wandered off. A random facility loses its hirelings and is offline for 1 bastion turn until replacements are found.'
      break
    }

    case 'magical-discovery': {
      description =
        'Magical Discovery! Your hirelings discover or accidentally create an Uncommon magic item of your choice at no cost to you. The magic item must be a Potion or Scroll.'
      break
    }

    case 'refugees': {
      const refugeeRoll = rollND(2, 4)
      const refugeeCount = refugeeRoll.reduce((a, b) => a + b, 0)
      const refugeeIncomeRoll = rollD(6)
      subRolls['2d4-refugees'] = refugeeCount
      subRolls['d6-refugee-income'] = refugeeIncomeRoll
      const refugeeIncome = refugeeIncomeRoll * 100
      description = `Refugees! ${refugeeCount} refugees (2d4 [${refugeeRoll.join(', ')}]) arrive at the bastion seeking shelter. If you take them in, they contribute ${refugeeIncome} GP (${refugeeIncomeRoll} x 100) in labor and services over the next bastion turn. Some may be willing to stay on as hirelings.`
      break
    }

    case 'request-for-aid': {
      description =
        'Request for Aid! Your Bastion is called on to help a local leader. You may send one or more Bastion Defenders. Roll 1d6 for each defender sent. If the total is 10 or higher, the problem is solved and you earn 1d6 × 100 GP. If the total is less than 10, the problem is still solved, but the reward is halved and one defender is killed.'
      break
    }

    case 'treasure': {
      const treasureRoll = rollD100()
      subRolls['d100-treasure'] = treasureRoll
      const treasure = findTreasureEntry(treasureRoll)
      description = `Treasure! Your hirelings discover a hidden cache or unexpected windfall. ${treasure.description}.`
      break
    }

    default:
      description = 'An uneventful bastion turn.'
  }

  return {
    eventType: entry.eventType,
    description,
    roll,
    subRolls
  }
}

/**
 * Resolve an Attack bastion event. Rolls 6d6 by default; each 1 kills a
 * defender. Armory upgrades dice to d8s; defensive walls reduce dice count by 2.
 *
 * @param defenderCount  - Number of defenders currently in the bastion.
 * @param hasArmory      - If true, roll d8s instead of d6s (stocked armory).
 * @param hasWalls       - If true, roll 4 dice instead of 6 (fully enclosed walls).
 * @returns The attack outcome including dice results.
 */
export function resolveAttackEvent(defenderCount: number, hasArmory: boolean, hasWalls: boolean): AttackEventResult {
  const diceCount = hasWalls ? 4 : 6
  const diceSides = hasArmory ? 8 : 6
  const attackDice = rollND(diceCount, diceSides)
  const onesCount = attackDice.filter((d) => d === 1).length

  const defendersLost = Math.min(onesCount, defenderCount)
  const facilityShutdown = defenderCount === 0

  let description: string
  if (facilityShutdown) {
    description = `Attack on the bastion! With no defenders present, a random facility is shut down until after the next Bastion turn. Dice: [${attackDice.join(', ')}].`
  } else if (defendersLost === 0) {
    description = `Attack on the bastion! Your defenders repel the assault with no losses. Dice: [${attackDice.join(', ')}].`
  } else {
    description = `Attack on the bastion! ${defendersLost} defender(s) killed in the fighting. Dice: [${attackDice.join(', ')}].`
    if (hasArmory) description += ' (Armory: rolled d8s instead of d6s.)'
    if (hasWalls) description += ' (Defensive Walls: reduced dice count by 2.)'
  }

  return {
    defendersLost,
    facilityShutdown,
    attackDice,
    description
  }
}

/**
 * Roll gambling winnings for a Gaming Hall facility order.
 * Returns the d100 roll, the GP multiplier, and a description.
 */
export function rollGamblingWinnings(): GamblingResult {
  const roll = rollD100()
  const entry = findGamblingEntry(roll)
  const diceRolled = rollND(entry.diceCount, 6)
  const goldEarned = diceRolled.reduce((a, b) => a + b, 0) * 10
  return {
    roll,
    goldEarned,
    diceRolled,
    description: `${entry.description} Rolled [${diceRolled.join(', ')}] × 10 = ${goldEarned} GP.`
  }
}

/**
 * Roll on the treasure table (d100) and return the result.
 */
export function rollTreasure(): TreasureResult {
  const roll = rollD100()
  const entry = findTreasureEntry(roll)
  return {
    roll,
    description: entry.description,
    category: entry.category
  }
}
