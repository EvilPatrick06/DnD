// Fix spells.json to match PHB 2024 — verified against reference material
// Round 2: fixes verified against PHB 2024 PDF + D&D Beyond Basic Rules
const fs = require('fs');
const path = require('path');

const spellsPath = path.join(__dirname, '../src/renderer/public/data/5e/spells.json');
let spells = JSON.parse(fs.readFileSync(spellsPath, 'utf8'));

const fixes = [];

// === 1. SHILLELAGH — Add Force damage option + cantrip upgrade (PHB 2024 p.312) ===
const shillelagh = spells.find(s => s.id === 'shillelagh');
if (shillelagh) {
  shillelagh.description =
    "A Club or Quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. If the attack deals damage, it can be Force damage or the weapon's normal damage type (your choice). The spell ends early if you cast it again or if you let go of the weapon. Cantrip Upgrade. The damage die changes when you reach levels 5 (d10), 11 (d12), and 17 (2d6).";
  fixes.push('Shillelagh: added Force damage option + cantrip upgrade scaling');
}

// === 2. CONJURE ELEMENTAL — Complete rewrite from 2014 to 2024 (PHB 2024 p.254) ===
const conjureElemental = spells.find(s => s.id === 'conjure-elemental');
if (conjureElemental) {
  conjureElemental.castingTime = '1 action';
  conjureElemental.duration = 'Concentration, up to 10 minutes';
  conjureElemental.description =
    "You conjure a Large, intangible spirit from the Elemental Planes that appears in an unoccupied space within range. Choose the spirit's element, which determines its damage type: air (Lightning), earth (Thunder), fire (Fire), or water (Cold). The spirit lasts for the duration. Whenever a creature you can see enters the spirit's space or starts its turn within 5 feet of the spirit, you can force that creature to make a Dexterity saving throw if the spirit has no creature Restrained. On a failed save, the target takes 8d8 damage of the spirit's type, and the target has the Restrained condition until the spell ends. At the start of each of its turns, the Restrained target repeats the save. On a failed save, the target takes 4d8 damage of the spirit's type. On a successful save, the target isn't Restrained by the spirit.";
  conjureElemental.higherLevels =
    'Using a Higher-Level Spell Slot. The damage increases by 2d8 for each spell slot level above 5.';
  fixes.push('Conjure Elemental: complete rewrite from 2014 to 2024 intangible spirit mechanic');
}

// === 3. CONJURE WOODLAND BEINGS — Add Disengage bonus action (PHB 2024 p.255) ===
const conjureWoodland = spells.find(s => s.id === 'conjure-woodland-beings');
if (conjureWoodland) {
  conjureWoodland.description =
    "You conjure nature spirits that flit around you in a 10-foot Emanation for the duration. Whenever the Emanation enters the space of a creature you can see and whenever a creature you can see enters the Emanation or ends its turn there, you can force that creature to make a Wisdom saving throw. The creature takes 5d8 Force damage on a failed save or half as much damage on a successful one. A creature makes this save only once per turn. In addition, you can take the Disengage action as a Bonus Action for the spell's duration.";
  fixes.push('Conjure Woodland Beings: added Disengage as Bonus Action');
}

// === 4. BANISHMENT — Rewrite to 2024 mechanic (D&D Beyond Basic Rules) ===
const banishment = spells.find(s => s.id === 'banishment');
if (banishment) {
  banishment.description =
    "One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration. While there, the target has the Incapacitated condition. When the spell ends, the target reappears in the space it left or in the nearest unoccupied space if that space is occupied. If the target is an Aberration, a Celestial, an Elemental, a Fey, or a Fiend, the target doesn't return if the spell lasts for 1 minute. The target is instead transported to a random location on a plane (DM's choice) associated with its creature type.";
  banishment.higherLevels =
    'Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 4.';
  fixes.push('Banishment: rewritten to 2024 demiplane/creature-type mechanic');
}

// === 5. HUNTER'S MARK — Force damage, attack roll, mark transfer (D&D Beyond Basic Rules) ===
const huntersMark = spells.find(s => s.id === 'hunters-mark');
if (huntersMark) {
  huntersMark.description =
    "You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra 1d6 Force damage to the target whenever you hit it with an attack roll. You also have Advantage on any Wisdom (Perception or Survival) check you make to find it. If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action to move the mark to a new creature you can see within range.";
  huntersMark.higherLevels =
    "Using a Higher-Level Spell Slot. Your Concentration can last longer with a spell slot of level 3-4 (up to 8 hours) or 5+ (up to 24 hours).";
  fixes.push("Hunter's Mark: Force damage type, attack roll (not weapon), mark transfer, updated higher-level text");
}

// Write results
fs.writeFileSync(spellsPath, JSON.stringify(spells, null, 2) + '\n');
console.log(`Applied ${fixes.length} spell fixes:`);
fixes.forEach(f => console.log(`  - ${f}`));
console.log('\nSaved spells.json');
