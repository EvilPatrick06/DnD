const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'monsters.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixes = 0;

function findMonster(name) {
  return data.find(m => m.name === name);
}

// ─── MIND FLAYER ───────────────────────────────────────────
const mindFlayer = findMonster('Mind Flayer');
if (mindFlayer) {
  // HP and hit dice (2014: 71, 13d8+13 → 2025: 99, 18d8+18)
  mindFlayer.hp = 99;
  mindFlayer.hitDice = '18d8 + 18';

  // Speed: add fly 15 (hover)
  mindFlayer.speed = { walk: 30, fly: 15 };

  // Initiative (2025: +4/14)
  mindFlayer.initiative = { modifier: 4, score: 14 };

  // Add DEX save +4
  if (!mindFlayer.savingThrows) mindFlayer.savingThrows = {};
  mindFlayer.savingThrows.dex = 4;

  // Add Psychic resistance
  mindFlayer.resistances = ['Psychic'];

  // Fix skills: remove Deception and Persuasion
  if (mindFlayer.skills) {
    delete mindFlayer.skills.Deception;
    delete mindFlayer.skills.Persuasion;
  }

  // Fix actions
  if (mindFlayer.actions) {
    // Fix Tentacles damage: 2d10+4 → 4d8+4
    const tentacles = mindFlayer.actions.find(a => a.name === 'Tentacles');
    if (tentacles) {
      tentacles.description = tentacles.description
        .replace(/15 \(2d10 \+ 4\)/g, '22 (4d8 + 4)')
        .replace(/DC 15/g, 'DC 14');
    }

    // Fix Extract Brain: change from attack to save
    const extractBrain = mindFlayer.actions.find(a => a.name === 'Extract Brain');
    if (extractBrain) {
      extractBrain.description = 'Constitution Saving Throw: DC 15, one creature Grappled by the mind flayer\'s Tentacles. Failure: 55 (10d10) Piercing damage. If this damage reduces the target to 0 Hit Points, the mind flayer kills it by extracting and devouring its brain. Success: Half damage.';
      delete extractBrain.attackBonus;
      delete extractBrain.damage;
    }

    // Fix Mind Blast damage and stun
    const mindBlast = mindFlayer.actions.find(a => a.name === 'Mind Blast');
    if (mindBlast) {
      mindBlast.description = 'Intelligence Saving Throw: DC 15, each creature in a 60-foot Cone. Failure: 31 (6d8 + 4) Psychic damage, and the target has the Stunned condition until the end of the mind flayer\'s next turn. Success: Half damage only.';
    }
  }

  // Fix spellcasting: remove Levitate from at-will
  if (mindFlayer.spellcasting) {
    if (mindFlayer.spellcasting.atWill) {
      mindFlayer.spellcasting.atWill = mindFlayer.spellcasting.atWill.filter(
        s => s.toLowerCase() !== 'levitate'
      );
    }
  }

  fixes++;
  console.log('Fixed: Mind Flayer (HP, speed, initiative, saves, resistances, skills, actions, spellcasting)');
}

// ─── TARRASQUE ─────────────────────────────────────────────
const tarrasque = findMonster('Tarrasque');
if (tarrasque) {
  // WIS score: 17 → 11
  tarrasque.abilityScores.wis = 11;

  // Add missing saves: DEX +9 and CON +10
  if (!tarrasque.savingThrows) tarrasque.savingThrows = {};
  tarrasque.savingThrows.dex = 9;
  tarrasque.savingThrows.con = 10;

  fixes++;
  console.log('Fixed: Tarrasque (WIS score 17→11, added DEX +9 and CON +10 saves)');
}

// ─── BEHOLDER EYE RAYS ────────────────────────────────────
const beholder = findMonster('Beholder');
if (beholder) {
  // Rays are separate action entries with numbered names like "1. Charm Ray"
  if (beholder.actions) {
    const rayUpdates = {
      '1. Charm Ray': 'Wisdom Saving Throw: DC 16. Failure: 13 (3d8) Psychic damage, and the target has the Charmed condition for 1 hour or until it takes damage. Success: Half damage only.',
      '3. Fear Ray': 'Wisdom Saving Throw: DC 16. Failure: 14 (4d6) Psychic damage, and the target has the Frightened condition until the end of its next turn. Success: Half damage only.',
      '4. Slowing Ray': 'Constitution Saving Throw: DC 16. Failure: 18 (4d8) Necrotic damage. Until the end of its next turn, the target\'s Speed is halved, and it can\'t take Reactions. On its turn, it can take either an action or a Bonus Action, not both. Success: Half damage only.',
      '5. Enervation Ray': 'Constitution Saving Throw: DC 16. Failure: 13 (3d8) Poison damage, and the target has the Poisoned condition until the end of its next turn. While Poisoned in this way, the target can\'t regain Hit Points. Success: Half damage only.',
      '6. Telekinetic Ray': 'Strength Saving Throw: DC 16, one Huge or smaller creature or nonmagical object that isn\'t being worn or carried. The target succeeds automatically if it is Gargantuan. Failure: The beholder moves the target up to 30 feet in any direction, and the target has the Restrained condition until the start of the beholder\'s next turn or until the beholder uses this ray again.',
      '7. Sleep Ray': 'Wisdom Saving Throw: DC 16, one creature (the target succeeds automatically if it is a Construct or an Undead). Failure: The target has the Unconscious condition for 1 minute. The target repeats the save when it takes damage and at the end of each of its turns, ending the effect on itself on a success. A creature within 5 feet of the Unconscious target can take an action to wake it.',
      '8. Petrification Ray': 'Constitution Saving Throw: DC 16. Failure: The target has the Restrained condition as its body begins to turn to stone. It must repeat the save at the end of its next turn. On a success, the effect ends. On a failure, the target has the Petrified condition.',
      '9. Disintegration Ray': 'Dexterity Saving Throw: DC 16. Failure: 36 (8d8) Force damage. Success: Half damage. Failure or Success: If this damage reduces the target to 0 Hit Points, it disintegrates into a pile of fine gray dust.',
      '10. Death Ray': 'Dexterity Saving Throw: DC 16. Failure: 55 (10d10) Necrotic damage. Success: Half damage. Failure or Success: The target dies if this damage reduces it to 0 Hit Points.'
    };

    let rayCount = 0;
    for (const action of beholder.actions) {
      if (rayUpdates[action.name]) {
        action.description = rayUpdates[action.name];
        rayCount++;
      }
    }

    if (rayCount > 0) {
      fixes++;
      console.log('Fixed: Beholder (updated ' + rayCount + ' eye ray descriptions to MM 2025)');
    }
  }
}

// ─── ADULT RED DRAGON FIRE BREATH ──────────────────────────
const adultRed = findMonster('Adult Red Dragon');
if (adultRed) {
  // Fire Breath: 18d6 → 17d6
  if (adultRed.actions) {
    const fireBreath = adultRed.actions.find(a => a.name === 'Fire Breath');
    if (fireBreath) {
      fireBreath.description = fireBreath.description
        .replace(/63 \(18d6\)/g, '59 (17d6)');
    }
  }

  // Initiative fix (was +0/10, should be +12/22)
  adultRed.initiative = { modifier: 12, score: 22 };

  // CHA fix (21 → 23)
  adultRed.abilityScores.cha = 23;

  fixes++;
  console.log('Fixed: Adult Red Dragon (fire breath 18d6→17d6, initiative, CHA 21→23)');
}

// Write back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
console.log(`\nDone — ${fixes} monsters fixed.`);
