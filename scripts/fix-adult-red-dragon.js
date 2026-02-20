const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'monsters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const dragon = data.find(m => m.name === 'Adult Red Dragon');
if (!dragon) { console.error('Adult Red Dragon not found!'); process.exit(1); }

// ─── Saving Throws (MM 2025: DEX +6, WIS +7 only) ───
dragon.savingThrows = {
  dex: 6,
  wis: 7
};

// ─── Traits ───
dragon.traits = [
  {
    name: 'Legendary Resistance (3/Day, or 4/Day in Lair)',
    description: 'If the dragon fails a saving throw, it can choose to succeed instead.'
  }
];

// ─── Actions (MM 2025: Multiattack → 3 Rend, Rend, Spellcasting, Fire Breath) ───
dragon.actions = [
  {
    name: 'Multiattack',
    description: 'The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast Scorching Ray.',
    multiattackActions: ['Rend', 'Rend', 'Rend']
  },
  {
    name: 'Rend',
    description: 'Melee attack: +14 to hit, reach 10 ft., one target. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.',
    attackType: 'melee',
    toHit: 14,
    reach: 10,
    targets: 1,
    damageDice: '1d10+8',
    damageType: 'Slashing',
    additionalDamage: '2d4 Fire'
  },
  {
    name: 'Spellcasting',
    description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 20, +12 to hit with spell attack rolls):\n\nAt Will: Command (level 2 version), Detect Magic, Scorching Ray\n1/Day: Fireball',
    spellcastingAbility: 'Charisma',
    spellSaveDC: 20,
    spellAttackBonus: 12,
    atWill: ['Command (level 2)', 'Detect Magic', 'Scorching Ray'],
    daily: { '1': ['Fireball'] }
  },
  {
    name: 'Fire Breath',
    description: 'Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage.',
    saveDC: 21,
    saveAbility: 'Dexterity',
    damageDice: '17d6',
    damageType: 'Fire',
    areaOfEffect: { type: 'cone', size: 60 },
    recharge: '5-6'
  }
];

// ─── Legendary Actions (MM 2025) ───
dragon.legendaryActions = {
  uses: 3,
  usesInLair: 4,
  actions: [
    {
      name: 'Commanding Presence',
      description: 'The dragon uses Spellcasting to cast Command (level 2 version). The dragon can\'t take this action again until the start of its next turn.'
    },
    {
      name: 'Fiery Rays',
      description: 'The dragon uses Spellcasting to cast Scorching Ray.'
    },
    {
      name: 'Pounce (Costs 2 Actions)',
      description: 'The dragon moves up to half its Speed, and then it makes one Rend attack.'
    }
  ]
};

// ─── Remove 2014 Lair Actions (MM 2025 has no lair actions on init 20 for Adult Red) ───
delete dragon.lairActions;

// ─── Regional Effects (MM 2025) ───
dragon.regionalEffects = {
  effects: [
    {
      name: 'Burning Heat',
      description: 'Creatures within 1 mile of the lair that have the Burning condition take an extra 1d4 Fire damage at the start of each of their turns.'
    },
    {
      name: 'Smoldering Haze',
      description: 'The area within 1 mile of the lair is lightly obscured by smoke and haze. A creature that starts its turn in this area must succeed on a DC 15 Constitution saving throw or have the Poisoned condition for 1 hour.'
    }
  ],
  endCondition: 'If the dragon dies or moves its lair elsewhere, these effects end immediately.'
};

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
console.log('Adult Red Dragon fully rewritten to MM 2025 format.');
console.log('Changes: savingThrows, traits, actions (Rend + Spellcasting), legendaryActions, lairActions removed, regionalEffects updated.');
