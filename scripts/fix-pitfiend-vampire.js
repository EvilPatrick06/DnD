// Fix Pit Fiend and Vampire Spawn to match MM 2025
const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '../src/renderer/public/data/5e/monsters.json');
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

// === FIX PIT FIEND ===
const pf = monsters.find(m => m.id === 'pit-fiend');
if (pf) {
  pf.ac = 21;
  delete pf.acType;
  pf.hp = 337;
  pf.hitDice = '27d10+189';
  pf.initiative = { modifier: 14, score: 24 };

  // Saves: DEX +8, WIS +10 (CON is NOT proficient in MM 2025)
  pf.savingThrows = { dex: 8, wis: 10 };

  // Skills: add Persuasion +19
  pf.skills = { Perception: 10, Persuasion: 19 };

  // Resistances: only Cold (remove BPS from nonmagical)
  pf.resistances = ['cold'];

  // Senses
  pf.senses = { truesight: 120, passivePerception: 20 };

  // Traits: complete rewrite
  pf.traits = [
    {
      name: 'Diabolical Restoration',
      description: "If the pit fiend dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells."
    },
    {
      name: 'Fear Aura',
      description: "The pit fiend emanates an aura in a 20-foot Emanation while it doesn't have the Incapacitated condition. Wisdom Saving Throw: DC 21, any enemy that starts its turn in the aura. Failure: The target has the Frightened condition until the start of its next turn. Success: The target is immune to this pit fiend's aura for 24 hours."
    },
    {
      name: 'Legendary Resistance (4/Day)',
      description: 'If the pit fiend fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Magic Resistance',
      description: 'The pit fiend has Advantage on saving throws against spells and other magical effects.'
    }
  ];

  // Actions: complete rewrite
  pf.actions = [
    {
      name: 'Multiattack',
      description: 'The pit fiend makes one Bite attack, two Devilish Claw attacks, and one Fiery Mace attack.',
      multiattackActions: ['Bite', 'Devilish Claw', 'Devilish Claw', 'Fiery Mace']
    },
    {
      name: 'Bite',
      description: "Melee Attack Roll: +14, reach 10 ft. Hit: 18 (3d6 + 8) Piercing damage. If the target is a creature, it must make the following saving throw. Constitution Saving Throw: DC 21. Failure: The target has the Poisoned condition. While Poisoned, the target can't regain Hit Points and takes 21 (6d6) Poison damage at the start of each of its turns, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.",
      attackType: 'melee',
      toHit: 14,
      reach: 10,
      targets: 1,
      damageDice: '3d6+8',
      damageType: 'Piercing'
    },
    {
      name: 'Devilish Claw',
      description: 'Melee Attack Roll: +14, reach 10 ft. Hit: 26 (4d8 + 8) Necrotic damage.',
      attackType: 'melee',
      toHit: 14,
      reach: 10,
      targets: 1,
      damageDice: '4d8+8',
      damageType: 'Necrotic'
    },
    {
      name: 'Fiery Mace',
      description: 'Melee Attack Roll: +14, reach 10 ft. Hit: 22 (4d6 + 8) Force damage plus 21 (6d6) Fire damage.',
      attackType: 'melee',
      toHit: 14,
      reach: 10,
      targets: 1,
      damageDice: '4d6+8',
      damageType: 'Force',
      additionalDamage: '21 (6d6) Fire damage'
    },
    {
      name: 'Hellfire Spellcasting (Recharge 4-6)',
      description: 'The pit fiend casts Fireball (level 5 version) twice, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21). It can replace one Fireball with Hold Monster (level 7 version) or Wall of Fire.'
    }
  ];

  // Remove legendary actions if they exist (Pit Fiend doesn't have them in MM 2025)
  // Actually, in 2014 the Pit Fiend didn't have legendary actions either

  console.log('Fixed Pit Fiend: AC 21, HP 337, init +14, saves, resistances, traits, actions');
}

// === FIX VAMPIRE SPAWN ===
const vs = monsters.find(m => m.id === 'vampire-spawn');
if (vs) {
  vs.ac = 16;
  vs.hp = 90;
  vs.hitDice = '12d8+36';

  // Speed: just 30 ft. (Spider Climb trait handles climbing)
  vs.speed = { walk: 30 };

  // Saves: DEX +6, WIS +3
  vs.savingThrows = { dex: 6, wis: 3 };

  // Senses
  vs.senses = { darkvision: 60, passivePerception: 13 };

  // Skills
  vs.skills = { Perception: 3, Stealth: 6 };

  // Resistances
  vs.resistances = ['necrotic'];

  // Languages
  vs.languages = ['Common plus one other language'];

  // Traits
  vs.traits = [
    {
      name: 'Spider Climb',
      description: "The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check."
    },
    {
      name: 'Vampire Weakness',
      description: "The vampire has these weaknesses: Forbiddance (can't enter a residence without invitation), Running Water (takes 20 Acid damage if it ends its turn in running water), Stake to the Heart (destroyed if a Piercing weapon is driven into its heart while Incapacitated), Sunlight (takes 20 Radiant damage at start of turn in sunlight, Disadvantage on attack rolls and ability checks)."
    }
  ];

  // Actions
  vs.actions = [
    {
      name: 'Multiattack',
      description: 'The vampire makes two Claw attacks and uses Bite.',
      multiattackActions: ['Claw', 'Claw', 'Bite']
    },
    {
      name: 'Claw',
      description: 'Melee Attack Roll: +6, reach 5 ft. Hit: 8 (2d4 + 3) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.',
      attackType: 'melee',
      toHit: 6,
      reach: 5,
      targets: 1,
      damageDice: '2d4+3',
      damageType: 'Slashing'
    },
    {
      name: 'Bite',
      description: "Constitution Saving Throw: DC 14, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. Failure: 5 (1d4 + 3) Piercing damage plus 10 (3d6) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.",
      saveDC: 14,
      saveAbility: 'CON'
    }
  ];

  // Bonus Actions
  vs.bonusActions = [
    {
      name: 'Deathless Agility',
      description: 'The vampire takes the Dash or Disengage action.'
    }
  ];

  console.log('Fixed Vampire Spawn: AC 16, HP 90, speed, saves, traits, actions, bonus actions');
}

fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log('\nSaved monsters.json');
