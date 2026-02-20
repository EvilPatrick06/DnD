// Fix Tarrasque and Lich to match MM 2025 stat blocks
const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '../src/renderer/public/data/5e/monsters.json');
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

// === FIX TARRASQUE ===
const tarrasque = monsters.find(m => m.id === 'tarrasque');
if (tarrasque) {
  // Speed: 60 ft., Burrow 40 ft., Climb 60 ft. (was walk 40)
  tarrasque.speed = { walk: 60, burrow: 40, climb: 60 };

  // Initiative: +18 (28)
  tarrasque.initiative = { modifier: 18, score: 28 };

  // Add Deafened to condition immunities
  if (!tarrasque.conditionImmunities.includes('deafened')) {
    tarrasque.conditionImmunities.push('deafened');
    tarrasque.conditionImmunities.sort();
  }

  // Fix Tail attack: reach 30, 3d8+10, automatic Prone for Huge or smaller
  const tail = tarrasque.actions.find(a => a.name === 'Tail');
  if (tail) {
    tail.reach = 30;
    tail.damageDice = '3d8+10';
    tail.description = 'Melee Attack Roll: +19, reach 30 ft. Hit: 23 (3d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.';
    delete tail.saveDC;
    delete tail.saveAbility;
  }

  // Fix Bite: update description (no "can't Bite another target", add "can't teleport")
  const bite = tarrasque.actions.find(a => a.name === 'Bite');
  if (bite) {
    bite.description = 'Melee Attack Roll: +19, reach 15 ft. Hit: 36 (4d12 + 10) Piercing damage, and the target has the Grappled condition (escape DC 20). Until the grapple ends, the target has the Restrained condition and can\'t teleport.';
  }

  // Add Thunderous Bellow action
  const bellowIdx = tarrasque.actions.findIndex(a => a.name === 'Thunderous Bellow');
  if (bellowIdx === -1) {
    tarrasque.actions.push({
      name: 'Thunderous Bellow (Recharge 5-6)',
      description: 'Constitution Saving Throw: DC 27, each creature and each object that isn\'t being worn or carried in a 150-foot Cone. Failure: 78 (12d12) Thunder damage, and the target has the Deafened and Frightened conditions until the end of its next turn. Success: Half damage only.',
      saveDC: 27,
      saveAbility: 'CON'
    });
  }

  // Move Swallow to bonus actions section (it's now a Bonus Action in MM 2025)
  const swallowIdx = tarrasque.actions.findIndex(a => a.name === 'Swallow');
  let swallowAction;
  if (swallowIdx !== -1) {
    swallowAction = tarrasque.actions.splice(swallowIdx, 1)[0];
    swallowAction.description = 'Strength Saving Throw: DC 27, one Large or smaller creature Grappled by the tarrasque (it can have up to six creatures swallowed at a time). Failure: The target is swallowed, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions and can\'t teleport, it has Total Cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) Acid damage at the start of each of the tarrasque\'s turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the tarrasque and has the Prone condition. If the tarrasque dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.';
  }
  // Add as bonus action
  if (!tarrasque.bonusActions) tarrasque.bonusActions = [];
  if (swallowAction) {
    tarrasque.bonusActions = [swallowAction];
  }

  // Fix legendary actions: remove Chomp (not in MM 2025)
  if (tarrasque.legendaryActions && tarrasque.legendaryActions.actions) {
    tarrasque.legendaryActions.actions = tarrasque.legendaryActions.actions.filter(
      a => !a.name.includes('Chomp')
    );
  }

  // Remove lair actions and regional effects (Tarrasque has no lair in MM 2025)
  delete tarrasque.lairActions;
  delete tarrasque.regionalEffects;

  // Remove acType (MM 2025 doesn't specify)
  delete tarrasque.acType;

  console.log('Fixed Tarrasque: speed, initiative, immunities, tail, bite, thunderous bellow, swallow→bonus, removed chomp, removed lair');
}

// === FIX LICH ===
const lich = monsters.find(m => m.id === 'lich');
if (lich) {
  // AC: 17 → 20
  lich.ac = 20;
  delete lich.acType;

  // HP: 135 → 315 (42d8+126)
  lich.hp = 315;
  lich.hitDice = '42d8+126';

  // INT: 20 → 21
  lich.abilityScores.int = 21;

  // Initiative: +17 (27)
  lich.initiative = { modifier: 17, score: 27 };

  // Alignment: Any Evil → Neutral Evil
  lich.alignment = 'Neutral Evil';

  // Saving Throws: add DEX +10
  lich.savingThrows = { dex: 10, con: 10, int: 12, wis: 9 };

  // Resistances: remove Necrotic (moved to immunity)
  lich.resistances = ['cold', 'lightning'];

  // Damage Immunities: add Necrotic
  lich.damageImmunities = ['necrotic', 'poison'];

  // Languages: All
  lich.languages = ['All'];

  // Traits: update
  lich.traits = [
    {
      name: 'Legendary Resistance (4/Day, or 5/Day in Lair)',
      description: 'If the lich fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Spirit Jar',
      description: 'If destroyed, the lich reforms in 1d10 days if it has a spirit jar, reviving with all its Hit Points. The new body appears in an unoccupied space within the lich\'s lair.'
    }
  ];

  // Spellcasting: restructure to MM 2025 innate format
  lich.spellcasting = {
    ability: 'Intelligence',
    saveDC: 20,
    attackBonus: 12,
    atWill: [
      'Detect Magic', 'Detect Thoughts', 'Dispel Magic',
      'Fireball (level 5 version)', 'Invisibility', 'Lightning Bolt (level 5 version)',
      'Mage Hand', 'Prestidigitation'
    ],
    perDay: {
      '2': ['Animate Dead', 'Dimension Door', 'Plane Shift'],
      '1': ['Chain Lightning', 'Finger of Death', 'Power Word Kill', 'Scrying']
    }
  };

  // Actions: restructure
  lich.actions = [
    {
      name: 'Multiattack',
      description: 'The lich makes three attacks, using Eldritch Burst or Paralyzing Touch in any combination.',
      multiattackActions: ['Eldritch Burst', 'Eldritch Burst', 'Eldritch Burst']
    },
    {
      name: 'Eldritch Burst',
      description: 'Melee or Ranged Attack Roll: +12, reach 5 ft. or range 120 ft. Hit: 31 (4d12 + 5) Force damage.',
      attackType: 'melee-or-ranged',
      toHit: 12,
      reach: 5,
      rangeNormal: 120,
      targets: 1,
      damageDice: '4d12+5',
      damageType: 'Force'
    },
    {
      name: 'Paralyzing Touch',
      description: 'Melee Attack Roll: +12, reach 5 ft. Hit: 15 (3d6 + 5) Cold damage, and the target has the Paralyzed condition until the start of the lich\'s next turn.',
      attackType: 'melee',
      toHit: 12,
      reach: 5,
      targets: 1,
      damageDice: '3d6+5',
      damageType: 'Cold'
    }
  ];

  // Reactions
  lich.reactions = [
    {
      name: 'Protective Magic',
      description: 'The lich casts Counterspell or Shield in response to the spell\'s trigger, using the same spellcasting ability as Spellcasting.'
    }
  ];

  // Legendary Actions: restructure
  lich.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Deathly Teleport',
        description: 'The lich teleports up to 60 feet to an unoccupied space it can see, and each creature within 10 feet of the space it left takes 11 (2d10) Necrotic damage.'
      },
      {
        name: 'Disrupt Life',
        description: 'Constitution Saving Throw: DC 20, each creature that isn\'t an Undead in a 20-foot Emanation originating from the lich. Failure: 31 (9d6) Necrotic damage. Success: Half damage. The lich can\'t take this action again until the start of its next turn.',
        saveDC: 20,
        saveAbility: 'CON'
      },
      {
        name: 'Frightening Gaze',
        description: 'The lich casts Fear, using the same spellcasting ability as Spellcasting. The lich can\'t take this action again until the start of its next turn.'
      }
    ]
  };

  // Lair Actions: update to MM 2025
  lich.lairActions = {
    initiativeCount: 20,
    actions: [
      {
        name: 'All-Seeing',
        description: 'While in its lair, the lich can cast Clairvoyance, requiring no spell components and using the same spellcasting ability as its Spellcasting action.'
      },
      {
        name: 'Inevitable Siphon',
        description: 'Whenever a Humanoid dies within 1 mile of the lair, its soul is immediately consumed by the lich. A Humanoid whose soul is consumed in this way can be brought back to life only by a True Resurrection or Wish spell.'
      }
    ]
  };

  // Regional effects: remove old ones (MM 2025 doesn't list separate regional effects, they're lair effects)
  delete lich.regionalEffects;

  console.log('Fixed Lich: AC, HP, INT, initiative, saves, resistances, immunities, languages, traits, spellcasting, actions, legendary, lair');
}

fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log('\nSaved monsters.json');
