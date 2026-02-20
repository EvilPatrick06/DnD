#!/usr/bin/env node
/**
 * Fix unstructured actions - add structured fields (toHit, saveDC, attackType,
 * damageDice, areaOfEffect, recharge) to actions that only have description text.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');
let monsters = JSON.parse(fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8'));
let creatures = JSON.parse(fs.readFileSync(path.join(dataDir, 'creatures.json'), 'utf8'));
let npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
const all = [...monsters, ...creatures, ...npcs];

let fixed = 0;
const fixLog = [];

function findMonster(name) {
  return all.find(m => m.name === name);
}

function findAction(monster, actionName) {
  if (!monster || !monster.actions) return null;
  return monster.actions.find(a => a.name === actionName);
}

function fixAction(monsterName, actionName, fields) {
  const m = findMonster(monsterName);
  const a = findAction(m, actionName);
  if (!a) {
    console.log(`  SKIP: ${monsterName} / ${actionName} not found`);
    return;
  }
  Object.assign(a, fields);
  fixed++;
  fixLog.push(`${monsterName}: ${actionName}`);
}

// === ATTACKS (have *Attack:* pattern in description) ===

// Pixie: Faerie Dust - Melee or Ranged Attack: +4, reach 5ft or range 60ft, 1 Radiant
fixAction('Pixie', 'Faerie Dust', {
  attackType: 'melee_or_ranged',
  toHit: 4,
  reach: 5,
  rangeNormal: 60,
  damageDice: '1',
  damageType: 'radiant'
});

// Pixie Wonderbringer: Faerie Dust - Melee or Ranged Attack: +7, reach 5ft or range 60ft, 2d10+4 Radiant
fixAction('Pixie Wonderbringer', 'Faerie Dust', {
  attackType: 'melee_or_ranged',
  toHit: 7,
  reach: 5,
  rangeNormal: 60,
  damageDice: '2d10+4',
  damageType: 'radiant'
});

// Mage Apprentice: Arcane Burst - Melee or Ranged Attack: +5, reach 5ft or range 120ft, 2d10+3 Force
fixAction('Mage Apprentice', 'Arcane Burst', {
  attackType: 'melee_or_ranged',
  toHit: 5,
  reach: 5,
  rangeNormal: 120,
  damageDice: '2d10+3',
  damageType: 'force'
});

// === EYE RAYS (save-based, complex multi-ray) ===

// Spectator Eye Rays: 4 rays, targets within 90ft
fixAction('Spectator', 'Eye Rays', {
  rangeNormal: 90
});

// Beholder Eye Rays: 10 rays, targets within 120ft
fixAction('Beholder', 'Eye Rays', {
  rangeNormal: 120
});

// Death Tyrant Eye Rays: 10 rays, targets within 120ft
fixAction('Death Tyrant', 'Eye Rays', {
  rangeNormal: 120
});

// Beholder Zombie Eye Rays: 4 rays, targets within 120ft
fixAction('Beholder Zombie', 'Eye Rays', {
  rangeNormal: 120
});

// === AoE ABILITIES ===

// Rapport Spores: 30-foot Emanation (no save, utility)
for (const name of ['Myconid Sprout', 'Myconid Adult', 'Myconid Sovereign']) {
  fixAction(name, 'Rapport Spores', {
    areaOfEffect: { type: 'emanation', size: 30 }
  });
}

// Darkness Aura: 15-foot Emanation (no save)
fixAction('Darkmantle', 'Darkness Aura', {
  areaOfEffect: { type: 'emanation', size: 15 }
});

// Djinni Create Whirlwind: 20-foot radius, 60ft high cylinder
fixAction('Djinni', 'Create Whirlwind', {
  areaOfEffect: { type: 'cylinder', size: 20 }
});

// === SPELLCASTING-LIKE ACTIONS (innate casting, no structured attack) ===
// These are utility actions that cast spells. Mark with spellAction: true for semantics.

// Invisibility casters
for (const name of ['Sprite', 'Imp', 'Quasit']) {
  fixAction(name, 'Invisibility', {
    spellAction: true
  });
}

// Fog Cloud
fixAction('Ice Mephit', 'Fog Cloud', {
  spellAction: true
});

// Ghost Etherealness
fixAction('Ghost', 'Etherealness', {
  spellAction: true
});

// Elemental Cataclysm Control Weather
fixAction('Elemental Cataclysm', 'Control Weather', {
  spellAction: true
});

// Night Hag Nightmare Haunting
fixAction('Night Hag', 'Nightmare Haunting (1/Day; Requires Soul Bag)', {
  spellAction: true,
  usesPerDay: 1
});

// Yuan-ti Spellcasting (as actions)
for (const name of ['Yuan-ti Malison (Type 1)', 'Yuan-ti Malison (Type 2)', 'Yuan-ti Malison (Type 3)', 'Yuan-ti Abomination']) {
  fixAction(name, 'Spellcasting (Yuan-ti Form Only)', {
    spellAction: true
  });
}

// === UTILITY ACTIONS (no attack, no save, no AoE) ===

// Shape-Shift (form change)
for (const name of ['Imp', 'Quasit', 'Oni']) {
  fixAction(name, 'Shape-Shift', {
    utility: true
  });
}

// Teleport
fixAction('Nalfeshnee', 'Teleport', {
  utility: true
});

// Ethereal Stride
fixAction('Nightmare', 'Ethereal Stride', {
  utility: true
});

// Animate Boulders / Trees
fixAction('Galeb Duhr', 'Animate Boulders', {
  utility: true
});
fixAction('Treant', 'Animate Trees', {
  utility: true
});

// Roper Reel
fixAction('Roper', 'Reel', {
  utility: true
});

// Wraith Create Specter
fixAction('Wraith', 'Create Specter', {
  utility: true
});

// Myconid Sovereign Animating Spores
fixAction('Myconid Sovereign', 'Animating Spores', {
  utility: true
});

// Seahorse Bubble Dash
fixAction('Seahorse', 'Bubble Dash', {
  utility: true
});

// Gnoll Pack Lord Incite Rampage
fixAction('Gnoll Pack Lord', 'Incite Rampage', {
  utility: true,
  rangeNormal: 60
});

// Rust Monster Destroy Metal (touch, no attack roll)
fixAction('Rust Monster', 'Destroy Metal', {
  utility: true,
  reach: 5
});

// Swallow (requires grapple, so utility)
fixAction('Giant Frog', 'Swallow', {
  utility: true
});
fixAction('Giant Toad', 'Swallow', {
  utility: true
});

// Clay Colossus Haste (Recharge 5-6)
fixAction('Clay Colossus', 'Haste (Recharge 5-6)', {
  recharge: '5-6',
  utility: true
});

// Sphinx of Valor Roar (complex sequential effects)
fixAction('Sphinx of Valor', 'Roar', {
  utility: true
});

// Vampire Multiattack (Vampire Form Only) - it IS a multiattack
const vampire = findMonster('Vampire');
if (vampire) {
  const ma = findAction(vampire, 'Multiattack (Vampire Form Only)');
  if (ma) {
    ma.multiattackActions = ['Grave Strike', 'Grave Strike', 'Bite'];
    fixed++;
    fixLog.push('Vampire: Multiattack (Vampire Form Only)');
  }
}

// === COMBAT RIDERS (part of weapon mastery, applied to attacks) ===

// Warrior Commander Sap/Maneuver
fixAction('Warrior Commander', 'Sap', {
  utility: true
});
fixAction('Warrior Commander', 'Maneuver', {
  utility: true
});

// Pirate Admiral Awestruck/Poison
fixAction('Pirate Admiral', 'Awestruck', {
  utility: true
});
fixAction('Pirate Admiral', 'Poison', {
  utility: true
});

// Shrieker "None" - this is a placeholder, leave it
fixAction('Shrieker Fungus', 'None', {
  utility: true
});

// === Save data ===
fs.writeFileSync(path.join(dataDir, 'monsters.json'), JSON.stringify(monsters, null, 2));
fs.writeFileSync(path.join(dataDir, 'creatures.json'), JSON.stringify(creatures, null, 2));
fs.writeFileSync(path.join(dataDir, 'npcs.json'), JSON.stringify(npcs, null, 2));

console.log(`Fixed ${fixed} unstructured actions:`);
for (const entry of fixLog) {
  console.log(`  ${entry}`);
}
