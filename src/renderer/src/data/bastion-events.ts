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
  multiplier: number
  description: string
}

export interface TreasureResult {
  roll: number
  description: string
  category: string
}

// ---- All Is Well Flavors (d8) ----------------------------------------------

export const ALL_IS_WELL_FLAVORS: { roll: number; flavor: string }[] = [
  { roll: 1, flavor: 'A gentle rain waters your gardens and fills the cisterns. The hirelings enjoy a quiet week.' },
  { roll: 2, flavor: 'A traveling bard spends the evening entertaining your hirelings with songs and stories.' },
  {
    roll: 3,
    flavor:
      'Local wildlife has been spotted near the bastion, but poses no threat. A family of foxes has made a den nearby.'
  },
  { roll: 4, flavor: 'Your hirelings complete minor repairs and maintenance ahead of schedule. Morale is high.' },
  {
    roll: 5,
    flavor: 'A clear night sky provides excellent stargazing. One hireling claims to have seen a shooting star.'
  },
  { roll: 6, flavor: 'A merchant caravan passes nearby and waves in friendly greeting, but does not stop.' },
  {
    roll: 7,
    flavor: 'The local village sends a small gift of bread and preserves as thanks for your presence in the region.'
  },
  {
    roll: 8,
    flavor: 'Your hirelings organize a small festival among themselves to celebrate the season. No incidents reported.'
  }
]

// ---- Guest Table (d4) ------------------------------------------------------

export const GUEST_TABLE: { roll: number; guestType: string; description: string }[] = [
  {
    roll: 1,
    guestType: 'Traveling Merchant',
    description:
      'A traveling merchant arrives seeking shelter. They offer to sell rare goods at a 10% discount during their stay.'
  },
  {
    roll: 2,
    guestType: 'Noble',
    description:
      'A noble and their retinue request lodging. Hosting them well could earn political favor or a future quest hook.'
  },
  {
    roll: 3,
    guestType: 'Pilgrim',
    description:
      'A pilgrim on a sacred journey stops at your bastion. They offer a blessing on one facility, granting advantage on its next order.'
  },
  {
    roll: 4,
    guestType: 'Wandering Adventurer',
    description:
      'A wandering adventurer seeks a place to rest. They share tales of nearby dungeons and may offer to serve as a temporary defender.'
  }
]

// ---- Treasure Table (d100) -------------------------------------------------

export const TREASURE_TABLE: { min: number; max: number; category: string; description: string }[] = [
  {
    min: 1,
    max: 12,
    category: 'art-25gp',
    description: 'Art object worth 25 GP (small statuette, bone carving, or painted portrait)'
  },
  {
    min: 13,
    max: 24,
    category: 'art-250gp',
    description: 'Art object worth 250 GP (gold ring with bloodstones, carved ivory statuette, or silver chalice)'
  },
  {
    min: 25,
    max: 36,
    category: 'art-750gp',
    description:
      "Art object worth 750 GP (gold birdcage with electrum filigree, painted gold child's sarcophagus, or silver-plated steel longsword)"
  },
  {
    min: 37,
    max: 44,
    category: 'art-2500gp',
    description: 'Art object worth 2,500 GP (jeweled anklet, brass music box, or gold-filigreed decanter)'
  },
  {
    min: 45,
    max: 48,
    category: 'art-7500gp',
    description:
      'Art object worth 7,500 GP (bejeweled platinum crown, platinum and ruby ring, or painted gold war mask)'
  },
  {
    min: 49,
    max: 60,
    category: 'gems-10gp',
    description: 'A pouch of gemstones worth 10 GP each (1d6 gems: azurite, banded agate, blue quartz, or moss agate)'
  },
  {
    min: 61,
    max: 68,
    category: 'gems-50gp',
    description: 'A pouch of gemstones worth 50 GP each (1d4 gems: bloodstone, carnelian, jasper, or moonstone)'
  },
  {
    min: 69,
    max: 76,
    category: 'gems-100gp',
    description: 'A pouch of gemstones worth 100 GP each (1d4 gems: amber, amethyst, garnet, or jade)'
  },
  {
    min: 77,
    max: 80,
    category: 'gems-500gp',
    description: 'A pouch of gemstones worth 500 GP each (1d4 gems: alexandrite, aquamarine, black pearl, or topaz)'
  },
  {
    min: 81,
    max: 84,
    category: 'gems-1000gp',
    description: 'A single gemstone worth 1,000 GP (black opal, blue sapphire, emerald, fire opal, or star ruby)'
  },
  {
    min: 85,
    max: 91,
    category: 'magic-common',
    description: 'A common magic item (Potion of Healing, Spell Scroll of a 1st-level spell, or similar)'
  },
  {
    min: 92,
    max: 96,
    category: 'magic-uncommon',
    description: 'An uncommon magic item (Bag of Holding, Cloak of Elvenkind, Goggles of Night, or similar)'
  },
  {
    min: 97,
    max: 99,
    category: 'magic-rare',
    description: 'A rare magic item (Flame Tongue, Ring of Protection, Wand of Fireballs, or similar)'
  },
  {
    min: 100,
    max: 100,
    category: 'magic-very-rare',
    description: 'A very rare magic item (Amulet of the Planes, Rod of Absorption, Vorpal Sword, or similar)'
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

// ---- Gaming Hall Winnings (d100) -------------------------------------------

export const GAMING_HALL_WINNINGS: { min: number; max: number; multiplier: number; description: string }[] = [
  { min: 1, max: 10, multiplier: 0, description: 'Terrible luck! The house loses everything wagered.' },
  { min: 11, max: 25, multiplier: 0.5, description: 'Poor showing. The hall earns half the wagered amount.' },
  { min: 26, max: 50, multiplier: 1, description: 'Break even. The hall earns back exactly what was wagered.' },
  { min: 51, max: 75, multiplier: 1.5, description: 'Good night! The hall earns 1.5 times the wagered amount.' },
  { min: 76, max: 90, multiplier: 2, description: 'Great night! The hall earns double the wagered amount.' },
  { min: 91, max: 98, multiplier: 3, description: 'Exceptional night! The hall earns triple the wagered amount.' },
  { min: 99, max: 100, multiplier: 5, description: 'Jackpot! A legendary streak earns five times the wagered amount.' }
]

// ---- Menagerie Creatures ---------------------------------------------------

export interface MenagerieCreatureEntry {
  name: string
  creatureType: string
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
  cost: number
  cr: string
}

export const MENAGERIE_CREATURES: MenagerieCreatureEntry[] = [
  { name: 'Hawk', creatureType: 'Beast', size: 'tiny', cost: 25, cr: '0' },
  { name: 'Cat', creatureType: 'Beast', size: 'tiny', cost: 10, cr: '0' },
  { name: 'Mastiff', creatureType: 'Beast', size: 'medium', cost: 50, cr: '1/8' },
  { name: 'Pony', creatureType: 'Beast', size: 'medium', cost: 30, cr: '1/8' },
  { name: 'Giant Rat', creatureType: 'Beast', size: 'small', cost: 15, cr: '1/8' },
  { name: 'Giant Weasel', creatureType: 'Beast', size: 'medium', cost: 50, cr: '1/8' },
  { name: 'Wolf', creatureType: 'Beast', size: 'medium', cost: 75, cr: '1/4' },
  { name: 'Boar', creatureType: 'Beast', size: 'medium', cost: 75, cr: '1/4' },
  { name: 'Giant Goat', creatureType: 'Beast', size: 'large', cost: 100, cr: '1/2' },
  { name: 'Brown Bear', creatureType: 'Beast', size: 'large', cost: 200, cr: '1' },
  { name: 'Dire Wolf', creatureType: 'Beast', size: 'large', cost: 200, cr: '1' },
  { name: 'Giant Eagle', creatureType: 'Beast', size: 'large', cost: 300, cr: '1' },
  { name: 'Griffon', creatureType: 'Monstrosity', size: 'large', cost: 500, cr: '2' }
]

// ---- Expert Trainers -------------------------------------------------------

export interface ExpertTrainerEntry {
  type: 'battle' | 'skills' | 'tools' | 'unarmed-combat' | 'weapon'
  name: string
  empowerEffect: string
  description: string
}

export const EXPERT_TRAINERS: ExpertTrainerEntry[] = [
  {
    type: 'battle',
    name: 'Battle Trainer',
    empowerEffect:
      'One creature that trains here gains Temporary Hit Points equal to your level at the start of your next adventure.',
    description:
      'A veteran warrior who drills defenders and visitors in combat tactics, formations, and battlefield awareness.'
  },
  {
    type: 'skills',
    name: 'Skills Trainer',
    empowerEffect:
      'One creature that trains here gains proficiency in one skill of your choice until the end of your next adventure.',
    description:
      'A versatile instructor who coaches students in acrobatics, athletics, stealth, persuasion, and other practical skills.'
  },
  {
    type: 'tools',
    name: 'Tools Trainer',
    empowerEffect:
      "One creature that trains here gains proficiency with one set of Artisan's Tools of your choice until the end of your next adventure.",
    description:
      'A master artisan who teaches the finer points of craftsmanship, from smithing and carpentry to alchemy and calligraphy.'
  },
  {
    type: 'unarmed-combat',
    name: 'Unarmed Combat Trainer',
    empowerEffect:
      'One creature that trains here deals an extra 1d6 Bludgeoning damage with Unarmed Strikes until the end of your next adventure.',
    description: 'A martial arts master who teaches striking, grappling, and defensive techniques for unarmed fighting.'
  },
  {
    type: 'weapon',
    name: 'Weapon Trainer',
    empowerEffect:
      'One creature that trains here gains proficiency with one weapon of your choice until the end of your next adventure.',
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

function findGamblingEntry(roll: number): { multiplier: number; description: string } {
  const entry = GAMING_HALL_WINNINGS.find((e) => roll >= e.min && roll <= e.max)
  return entry ?? { multiplier: 1, description: 'Break even.' }
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
        'Extraordinary Opportunity! A rare chance presents itself — a visiting artisan, a cache of rare materials, or an unusual discovery. If you invest 500 GP, one facility of your choice can issue a special order this turn at no additional cost and with double the usual benefit.'
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
      const discoveryType = rollD(2)
      subRolls['d2-discovery'] = discoveryType
      if (discoveryType === 1) {
        description =
          'Magical Discovery! Your hirelings uncover a Potion of Healing hidden in the bastion — wedged behind a loose stone, buried in the garden, or found in an old crate.'
      } else {
        description =
          'Magical Discovery! Your hirelings find a Spell Scroll of a random 1st-level spell tucked away in an overlooked corner of the bastion.'
      }
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
        'Request for Aid! A neighboring settlement or allied faction sends a plea for help. You may send some of your defenders to assist. For each defender sent, roll 1d6 — on a 4 or higher, that defender survives and returns. On a 3 or lower, they are lost. If the total of all dice is 10 or higher, the mission is a success and you earn a favor or reward.'
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
 * Resolve an Attack bastion event. Rolls 6d6 (or more/fewer depending on
 * modifiers). Each die showing a 1 means one defender is killed.
 *
 * @param defenderCount  - Number of defenders currently in the bastion.
 * @param hasArmory      - If true, reroll one die that shows a 1 (armory benefit).
 * @param hasWalls       - If true, subtract 1 from the number of 1s (walls benefit, min 0).
 * @returns The attack outcome including dice results.
 */
export function resolveAttackEvent(defenderCount: number, hasArmory: boolean, hasWalls: boolean): AttackEventResult {
  const attackDice = rollND(6, 6)
  let onesCount = attackDice.filter((d) => d === 1).length

  // Armory benefit: reroll one die that shows 1
  if (hasArmory && onesCount > 0) {
    const firstOneIndex = attackDice.indexOf(1)
    if (firstOneIndex >= 0) {
      const reroll = rollD(6)
      attackDice[firstOneIndex] = reroll
      if (reroll !== 1) {
        onesCount--
      }
    }
  }

  // Defensive walls benefit: reduce casualties by 1
  if (hasWalls && onesCount > 0) {
    onesCount = Math.max(0, onesCount - 1)
  }

  const defendersLost = Math.min(onesCount, defenderCount)
  const facilityShutdown = defenderCount === 0

  let description: string
  if (facilityShutdown) {
    description = `Attack on the bastion! With no defenders present, a random facility is shut down for 1d6 days. Dice: [${attackDice.join(', ')}].`
  } else if (defendersLost === 0) {
    description = `Attack on the bastion! Your defenders repel the assault with no losses. Dice: [${attackDice.join(', ')}].`
  } else {
    description = `Attack on the bastion! ${defendersLost} defender(s) killed in the fighting. Dice: [${attackDice.join(', ')}].`
    if (hasArmory) description += ' (Armory: rerolled one casualty die.)'
    if (hasWalls) description += ' (Walls: absorbed one casualty.)'
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
  return {
    roll,
    multiplier: entry.multiplier,
    description: entry.description
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
