/**
 * add-missing-monsters.js
 *
 * Adds 11 missing monsters to monsters.json that are referenced by encounter-presets.json.
 * Stats based on the 2024 Monster Manual.
 *
 * Usage:
 *   node scripts/add-missing-monsters.js
 */

const fs = require('fs');
const path = require('path');

const MONSTERS_PATH = path.join(
  __dirname,
  '..',
  'src',
  'renderer',
  'public',
  'data',
  '5e',
  'monsters.json'
);

const newMonsters = [
  {
    id: 'bandit',
    name: 'Bandit',
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'Neutral',
    ac: 12,
    hp: 11,
    hitDice: '2d8+2',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 11,
      dex: 12,
      con: 12,
      int: 10,
      wis: 10,
      cha: 10
    },
    senses: {
      passivePerception: 10
    },
    languages: ['Common'],
    cr: '1/8',
    xp: 25,
    proficiencyBonus: 2,
    initiative: {
      modifier: 1,
      score: 11
    },
    actions: [
      {
        name: 'Scimitar',
        description:
          'Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Slashing damage.',
        attackType: 'melee',
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: '1d6+1',
        damageType: 'Slashing'
      }
    ],
    description:
      'Bandits rove in gangs and are sometimes led by thugs, veterans, or spellcasters. Not all bandits are combative; some are desperate commoners driven to thievery by poverty.',
    tags: ['cr1/8'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'bandit-captain',
    name: 'Bandit Captain',
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'Neutral',
    ac: 15,
    hp: 65,
    hitDice: '10d8+20',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 15,
      dex: 16,
      con: 14,
      int: 14,
      wis: 11,
      cha: 14
    },
    savingThrows: {
      str: 4,
      dex: 5,
      wis: 2
    },
    skills: {
      Athletics: 4,
      Deception: 4
    },
    senses: {
      passivePerception: 10
    },
    languages: ['Common'],
    cr: '2',
    xp: 450,
    proficiencyBonus: 2,
    initiative: {
      modifier: 3,
      score: 13
    },
    actions: [
      {
        name: 'Multiattack',
        description: 'The bandit captain makes three Scimitar attacks.',
        multiattackActions: ['Scimitar', 'Scimitar', 'Scimitar']
      },
      {
        name: 'Scimitar',
        description:
          'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Slashing damage.',
        attackType: 'melee',
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: '1d6+3',
        damageType: 'Slashing'
      },
      {
        name: 'Dagger',
        description:
          'Melee or Ranged Attack Roll: +5, reach 5 ft. or range 20/60 ft. Hit: 5 (1d4 + 3) Piercing damage.',
        attackType: 'melee-or-ranged',
        toHit: 5,
        reach: 5,
        rangeNormal: 20,
        rangeLong: 60,
        targets: 1,
        damageDice: '1d4+3',
        damageType: 'Piercing'
      }
    ],
    reactions: [
      {
        name: 'Parry',
        description:
          'The bandit captain adds 2 to its AC against one melee attack that would hit it. To do so, the bandit captain must see the attacker and be wielding a melee weapon.'
      }
    ],
    description:
      'It takes a strong personality, ruthless cunning, and a silver tongue to keep a gang of bandits in line. The bandit captain has these qualities in spades.',
    tags: ['cr2'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'cult-fanatic',
    name: 'Cult Fanatic',
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'Neutral',
    ac: 13,
    hp: 33,
    hitDice: '6d8+6',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 11,
      dex: 14,
      con: 12,
      int: 10,
      wis: 13,
      cha: 14
    },
    skills: {
      Deception: 4,
      Persuasion: 4,
      Religion: 2
    },
    senses: {
      passivePerception: 11
    },
    languages: ['Common'],
    cr: '2',
    xp: 450,
    proficiencyBonus: 2,
    initiative: {
      modifier: 2,
      score: 12
    },
    traits: [
      {
        name: 'Dark Devotion',
        description:
          'The fanatic has Advantage on saving throws against the Charmed and Frightened conditions.'
      }
    ],
    spellcasting: {
      ability: 'Wisdom',
      saveDC: 11,
      attackBonus: 3,
      atWill: ['Light', 'Thaumaturgy'],
      perDay: {
        '1': ['Command', 'Hold Person', 'Inflict Wounds'],
        '2': ['Shield of Faith', 'Spiritual Weapon']
      }
    },
    actions: [
      {
        name: 'Multiattack',
        description:
          'The fanatic makes two Dagger attacks, and it can use Spellcasting.',
        multiattackActions: ['Dagger', 'Dagger']
      },
      {
        name: 'Dagger',
        description:
          'Melee or Ranged Attack Roll: +4, reach 5 ft. or range 20/60 ft. Hit: 4 (1d4 + 2) Piercing damage.',
        attackType: 'melee-or-ranged',
        toHit: 4,
        reach: 5,
        rangeNormal: 20,
        rangeLong: 60,
        targets: 1,
        damageDice: '1d4+2',
        damageType: 'Piercing'
      },
      {
        name: 'Spellcasting',
        description:
          'The fanatic casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 11, +3 to hit with spell attacks): At Will: Light, Thaumaturgy. 2/Day Each: Shield of Faith, Spiritual Weapon. 1/Day Each: Command, Hold Person, Inflict Wounds.'
      }
    ],
    description:
      'Fanatics are often combative zealots who serve as the foot soldiers and enforcers of a cult leader. They are proficient at manipulating others and inspiring the faithful.',
    tags: ['cr2', 'spellcaster'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'cultist',
    name: 'Cultist',
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'Neutral',
    ac: 12,
    hp: 9,
    hitDice: '2d8',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 11,
      dex: 12,
      con: 10,
      int: 10,
      wis: 11,
      cha: 10
    },
    skills: {
      Deception: 2,
      Religion: 2
    },
    senses: {
      passivePerception: 10
    },
    languages: ['Common'],
    cr: '1/8',
    xp: 25,
    proficiencyBonus: 2,
    initiative: {
      modifier: 1,
      score: 11
    },
    traits: [
      {
        name: 'Dark Devotion',
        description:
          'The cultist has Advantage on saving throws against the Charmed and Frightened conditions.'
      }
    ],
    actions: [
      {
        name: 'Scimitar',
        description:
          'Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Slashing damage.',
        attackType: 'melee',
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: '1d6+1',
        damageType: 'Slashing'
      }
    ],
    description:
      'Cultists swear allegiance to dark powers such as elemental princes, demon lords, or archdevils. Most conceal their loyalties to avoid being ostracized, imprisoned, or executed.',
    tags: ['cr1/8'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'drow',
    name: 'Drow',
    size: 'Medium',
    type: 'Humanoid',
    subtype: 'Elf',
    alignment: 'Neutral Evil',
    ac: 15,
    hp: 13,
    hitDice: '3d8',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 10,
      dex: 14,
      con: 10,
      int: 11,
      wis: 11,
      cha: 12
    },
    skills: {
      Perception: 2,
      Stealth: 4
    },
    senses: {
      darkvision: 120,
      passivePerception: 12
    },
    languages: ['Common', 'Elvish', 'Undercommon'],
    cr: '1/4',
    xp: 50,
    proficiencyBonus: 2,
    initiative: {
      modifier: 2,
      score: 12
    },
    traits: [
      {
        name: 'Fey Ancestry',
        description:
          'The drow has Advantage on saving throws against the Charmed condition, and magic cannot put it to sleep.'
      },
      {
        name: 'Sunlight Sensitivity',
        description:
          'While in sunlight, the drow has Disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.'
      }
    ],
    spellcasting: {
      ability: 'Charisma',
      saveDC: 11,
      attackBonus: 3,
      atWill: ['Dancing Lights'],
      perDay: {
        '1': ['Darkness', 'Faerie Fire']
      }
    },
    actions: [
      {
        name: 'Shortsword',
        description:
          'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage.',
        attackType: 'melee',
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: '1d6+2',
        damageType: 'Piercing'
      },
      {
        name: 'Hand Crossbow',
        description:
          'Ranged Attack Roll: +4, range 30/120 ft. Hit: 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.',
        attackType: 'ranged',
        toHit: 4,
        rangeNormal: 30,
        rangeLong: 120,
        targets: 1,
        damageDice: '1d6+2',
        damageType: 'Piercing',
        additionalDamage: '7 (2d6) Poison damage'
      },
      {
        name: 'Spellcasting',
        description:
          'The drow casts one of the following spells, requiring no Material components, using Charisma as the spellcasting ability (spell save DC 11): At Will: Dancing Lights. 1/Day Each: Darkness, Faerie Fire.'
      }
    ],
    description:
      'Drow are elves who have adapted to life in the Underdark. Many worship the demon lord Lolth, but some reject her evil ways.',
    tags: ['cr1/4'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'drow-elite-warrior',
    name: 'Drow Elite Warrior',
    size: 'Medium',
    type: 'Humanoid',
    subtype: 'Elf',
    alignment: 'Neutral Evil',
    ac: 18,
    hp: 71,
    hitDice: '11d8+22',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 13,
      dex: 18,
      con: 14,
      int: 11,
      wis: 13,
      cha: 12
    },
    savingThrows: {
      dex: 7,
      con: 5,
      wis: 4
    },
    skills: {
      Perception: 4,
      Stealth: 7
    },
    senses: {
      darkvision: 120,
      passivePerception: 14
    },
    languages: ['Common', 'Elvish', 'Undercommon'],
    cr: '5',
    xp: 1800,
    proficiencyBonus: 3,
    initiative: {
      modifier: 4,
      score: 14
    },
    traits: [
      {
        name: 'Fey Ancestry',
        description:
          'The drow has Advantage on saving throws against the Charmed condition, and magic cannot put it to sleep.'
      },
      {
        name: 'Sunlight Sensitivity',
        description:
          'While in sunlight, the drow has Disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.'
      }
    ],
    spellcasting: {
      ability: 'Charisma',
      saveDC: 12,
      attackBonus: 4,
      atWill: ['Dancing Lights'],
      perDay: {
        '1': ['Darkness', 'Faerie Fire', 'Levitate']
      }
    },
    actions: [
      {
        name: 'Multiattack',
        description: 'The drow makes two Shortsword attacks.',
        multiattackActions: ['Shortsword', 'Shortsword']
      },
      {
        name: 'Shortsword',
        description:
          'Melee Attack Roll: +7, reach 5 ft. Hit: 7 (1d6 + 4) Piercing damage plus 10 (3d6) Poison damage.',
        attackType: 'melee',
        toHit: 7,
        reach: 5,
        targets: 1,
        damageDice: '1d6+4',
        damageType: 'Piercing',
        additionalDamage: '10 (3d6) Poison damage'
      },
      {
        name: 'Hand Crossbow',
        description:
          'Ranged Attack Roll: +7, range 30/120 ft. Hit: 7 (1d6 + 4) Piercing damage plus 10 (3d6) Poison damage.',
        attackType: 'ranged',
        toHit: 7,
        rangeNormal: 30,
        rangeLong: 120,
        targets: 1,
        damageDice: '1d6+4',
        damageType: 'Piercing',
        additionalDamage: '10 (3d6) Poison damage'
      },
      {
        name: 'Spellcasting',
        description:
          'The drow casts one of the following spells, requiring no Material components, using Charisma as the spellcasting ability (spell save DC 12): At Will: Dancing Lights. 1/Day Each: Darkness, Faerie Fire, Levitate.'
      }
    ],
    reactions: [
      {
        name: 'Parry',
        description:
          'The drow adds 3 to its AC against one melee attack that would hit it. To do so, the drow must see the attacker and be wielding a melee weapon.'
      }
    ],
    description:
      'Drow elite warriors are the highly trained soldiers of drow society, serving as guards, scouts, and shock troops in the service of their houses.',
    tags: ['cr5'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'giant-rat',
    name: 'Giant Rat',
    size: 'Small',
    type: 'Beast',
    alignment: 'Unaligned',
    ac: 12,
    hp: 7,
    hitDice: '2d6',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 7,
      dex: 15,
      con: 11,
      int: 2,
      wis: 10,
      cha: 4
    },
    senses: {
      darkvision: 60,
      passivePerception: 10
    },
    languages: [],
    cr: '1/8',
    xp: 25,
    proficiencyBonus: 2,
    initiative: {
      modifier: 2,
      score: 12
    },
    traits: [
      {
        name: 'Keen Smell',
        description:
          'The rat has Advantage on Wisdom (Perception) checks that rely on smell.'
      },
      {
        name: 'Pack Tactics',
        description:
          "The rat has Advantage on an attack roll against a creature if at least one of the rat's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      }
    ],
    actions: [
      {
        name: 'Bite',
        description:
          'Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage.',
        attackType: 'melee',
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: '1d4+2',
        damageType: 'Piercing'
      }
    ],
    description:
      'Giant rats are found in sewers, dungeons, and other subterranean locations. They are aggressive predators that hunt in packs.',
    tags: ['cr1/8', 'pack-tactics'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'grimlock',
    name: 'Grimlock',
    size: 'Medium',
    type: 'Humanoid',
    alignment: 'Neutral',
    ac: 11,
    hp: 11,
    hitDice: '2d8+2',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 16,
      dex: 12,
      con: 12,
      int: 9,
      wis: 8,
      cha: 6
    },
    skills: {
      Athletics: 5,
      Perception: 3,
      Stealth: 3
    },
    senses: {
      blindsight: 30,
      passivePerception: 13
    },
    languages: ['Undercommon'],
    cr: '1/4',
    xp: 50,
    proficiencyBonus: 2,
    initiative: {
      modifier: 1,
      score: 11
    },
    conditionImmunities: ['blinded'],
    traits: [
      {
        name: 'Blind Senses',
        description:
          "The grimlock can't use its Blindsight while Deafened and unable to smell."
      },
      {
        name: 'Keen Hearing and Smell',
        description:
          'The grimlock has Advantage on Wisdom (Perception) checks that rely on hearing or smell.'
      },
      {
        name: 'Stone Camouflage',
        description:
          'The grimlock has Advantage on Dexterity (Stealth) checks made to hide in rocky terrain.'
      }
    ],
    actions: [
      {
        name: 'Spiked Bone Club',
        description:
          'Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Bludgeoning damage.',
        attackType: 'melee',
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: '1d4+3',
        damageType: 'Bludgeoning'
      }
    ],
    description:
      'Grimlocks are blind, degenerate humanoids that dwell in the Underdark. They navigate entirely by sound and smell, and their stony skin lets them blend into rocky terrain.',
    tags: ['cr1/4'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'orc',
    name: 'Orc',
    size: 'Medium',
    type: 'Humanoid',
    subtype: 'Orc',
    alignment: 'Chaotic Evil',
    ac: 13,
    hp: 15,
    hitDice: '2d8+6',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 16,
      dex: 12,
      con: 16,
      int: 7,
      wis: 11,
      cha: 10
    },
    skills: {
      Intimidation: 2
    },
    senses: {
      darkvision: 60,
      passivePerception: 10
    },
    languages: ['Common', 'Orc'],
    cr: '1/2',
    xp: 100,
    proficiencyBonus: 2,
    initiative: {
      modifier: 1,
      score: 11
    },
    traits: [
      {
        name: 'Aggressive',
        description:
          'As a Bonus Action, the orc can move up to its Speed toward a hostile creature that it can see.'
      }
    ],
    actions: [
      {
        name: 'Greataxe',
        description:
          'Melee Attack Roll: +5, reach 5 ft. Hit: 9 (1d12 + 3) Slashing damage.',
        attackType: 'melee',
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: '1d12+3',
        damageType: 'Slashing'
      },
      {
        name: 'Javelin',
        description:
          'Melee or Ranged Attack Roll: +5, reach 5 ft. or range 30/120 ft. Hit: 6 (1d6 + 3) Piercing damage.',
        attackType: 'melee-or-ranged',
        toHit: 5,
        reach: 5,
        rangeNormal: 30,
        rangeLong: 120,
        targets: 1,
        damageDice: '1d6+3',
        damageType: 'Piercing'
      }
    ],
    bonusActions: [
      {
        name: 'Aggressive',
        description:
          'The orc moves up to its Speed toward a hostile creature that it can see.'
      }
    ],
    description:
      'Orcs are savage raiders and pillagers with stooped postures, low foreheads, and piggish faces with prominent lower canines that resemble tusks.',
    tags: ['cr1/2'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'swarm-of-rats',
    name: 'Swarm of Rats',
    size: 'Medium',
    type: 'Beast',
    alignment: 'Unaligned',
    ac: 10,
    hp: 24,
    hitDice: '7d8-7',
    speed: {
      walk: 30
    },
    abilityScores: {
      str: 9,
      dex: 11,
      con: 9,
      int: 2,
      wis: 10,
      cha: 3
    },
    senses: {
      darkvision: 30,
      passivePerception: 10
    },
    languages: [],
    cr: '1/4',
    xp: 50,
    proficiencyBonus: 2,
    initiative: {
      modifier: 0,
      score: 10
    },
    resistances: [
      'Bludgeoning',
      'Piercing',
      'Slashing'
    ],
    conditionImmunities: [
      'charmed',
      'frightened',
      'grappled',
      'paralyzed',
      'petrified',
      'prone',
      'restrained',
      'stunned'
    ],
    traits: [
      {
        name: 'Keen Smell',
        description:
          'The swarm has Advantage on Wisdom (Perception) checks that rely on smell.'
      },
      {
        name: 'Swarm',
        description:
          "The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain Hit Points or gain Temporary Hit Points."
      }
    ],
    actions: [
      {
        name: 'Bites',
        description:
          'Melee Attack Roll: +2, reach 0 ft. Hit: 7 (2d6) Piercing damage, or 3 (1d6) Piercing damage if the swarm is at half Hit Points or fewer.',
        attackType: 'melee',
        toHit: 2,
        reach: 0,
        targets: 1,
        damageDice: '2d6',
        damageType: 'Piercing'
      }
    ],
    description:
      'Swarms of rats are a common hazard in sewers, dungeons, and other dark places. They attack as a roiling mass of biting vermin.',
    tags: ['cr1/4', 'swarm'],
    tokenSize: {
      x: 1,
      y: 1
    }
  },
  {
    id: 'wolf',
    name: 'Wolf',
    size: 'Medium',
    type: 'Beast',
    alignment: 'Unaligned',
    ac: 13,
    hp: 11,
    hitDice: '2d8+2',
    speed: {
      walk: 40
    },
    abilityScores: {
      str: 12,
      dex: 15,
      con: 12,
      int: 3,
      wis: 12,
      cha: 6
    },
    skills: {
      Perception: 3,
      Stealth: 4
    },
    senses: {
      passivePerception: 13
    },
    languages: [],
    cr: '1/4',
    xp: 50,
    proficiencyBonus: 2,
    initiative: {
      modifier: 2,
      score: 12
    },
    traits: [
      {
        name: 'Keen Hearing and Smell',
        description:
          'The wolf has Advantage on Wisdom (Perception) checks that rely on hearing or smell.'
      },
      {
        name: 'Pack Tactics',
        description:
          "The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      }
    ],
    actions: [
      {
        name: 'Bite',
        description:
          'Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d4 + 2) Piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or have the Prone condition.',
        attackType: 'melee',
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: '2d4+2',
        damageType: 'Piercing',
        saveDC: 11,
        saveAbility: 'STR'
      }
    ],
    description:
      'Wolves are pack hunters known for their cunning and persistence. They communicate with each other using howls, growls, and body language.',
    tags: ['cr1/4', 'pack-tactics', 'mount'],
    tokenSize: {
      x: 1,
      y: 1
    }
  }
];

// Read existing monsters
const existingData = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'));
console.log(`Existing monsters: ${existingData.length}`);

// Check for duplicates
const existingIds = new Set(existingData.map((m) => m.id));
const toAdd = [];
const skipped = [];

for (const monster of newMonsters) {
  if (existingIds.has(monster.id)) {
    skipped.push(monster.id);
  } else {
    toAdd.push(monster);
  }
}

if (skipped.length > 0) {
  console.log(`Skipping ${skipped.length} already-existing monster(s): ${skipped.join(', ')}`);
}

if (toAdd.length === 0) {
  console.log('No new monsters to add.');
  process.exit(0);
}

// Merge and sort alphabetically by id
const merged = [...existingData, ...toAdd];
merged.sort((a, b) => a.id.localeCompare(b.id));

// Write back
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`Added ${toAdd.length} monster(s): ${toAdd.map((m) => m.id).join(', ')}`);
console.log(`Total monsters: ${merged.length}`);
