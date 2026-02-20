const fs = require('fs');
const spells = require('../src/renderer/public/data/5e/spells.json');

let formatFixes = 0;
let cantripFixes = 0;

for (const spell of spells) {
  // Fix higher-level text format: "When you cast this spell using a spell slot of Xth level or higher"
  // → "Using a Higher-Level Spell Slot."
  if (spell.higherLevels) {
    const old = spell.higherLevels;
    // Replace "At Higher Levels. When you cast..." → "Using a Higher-Level Spell Slot."
    let updated = old.replace(/^At Higher Levels\.\s*/i, '');
    // Replace "When you cast this spell using a spell slot of (\d+)\w+ level or higher, "
    updated = updated.replace(
      /^When you cast this spell using a spell slot of (\d+)\w+ level or higher,\s*/i,
      'Using a Higher-Level Spell Slot. '
    );
    if (updated !== old) {
      // Capitalize first letter after "Using a Higher-Level Spell Slot. "
      spell.higherLevels = updated;
      formatFixes++;
    }
  }

  // Fix cantrip scaling text
  if (spell.level === 0 && spell.description) {
    const desc = spell.description;
    // Old: "This spell's damage increases by Xd6 when you reach 5th level (2d6), 11th level (3d6), and 17th level (4d6)."
    // New: "Cantrip Upgrade. The damage increases by Xd6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6)."
    if (desc.includes("spell's damage increases") && !desc.includes('Cantrip Upgrade')) {
      spell.description = desc.replace(
        /This spell's damage increases by (\d+d\d+) when you reach 5th level \((\d+d\d+)\), 11th level \((\d+d\d+)\), and 17th level \((\d+d\d+)\)\./,
        'Cantrip Upgrade. The damage increases by $1 when you reach levels 5 ($2), 11 ($3), and 17 ($4).'
      );
      if (spell.description !== desc) cantripFixes++;
    }
  }
}

// Fix Dispel Magic specifically - 2024 changed from ability check to same mechanism
const dispelMagic = spells.find(s => s.id === 'dispel-magic');
if (dispelMagic) {
  // 2024 Dispel Magic: auto-dispels spells of 3rd level or lower, and for higher-level spells,
  // the spellcaster makes an ability check using their spellcasting ability (this one KEPT the ability check, unlike Counterspell)
  // Actually in 2024, Dispel Magic still uses an ability check, but the DC changed.
  // Let me not change this without verifying the exact text.
  console.log('Dispel Magic left unchanged (needs manual verification)');
}

// Fix Longstrider and Ray of Sickness that still have "At Higher Levels" prefix
const longstrider = spells.find(s => s.id === 'longstrider');
if (longstrider && longstrider.higherLevels && longstrider.higherLevels.includes('At Higher Levels')) {
  longstrider.higherLevels = longstrider.higherLevels.replace(/^At Higher Levels\.\s*/i, 'Using a Higher-Level Spell Slot. ');
  formatFixes++;
}

const rayOfSickness = spells.find(s => s.id === 'ray-of-sickness');
if (rayOfSickness && rayOfSickness.higherLevels && rayOfSickness.higherLevels.includes('At Higher Levels')) {
  rayOfSickness.higherLevels = rayOfSickness.higherLevels.replace(/^At Higher Levels\.\s*/i, 'Using a Higher-Level Spell Slot. ');
  formatFixes++;
}

fs.writeFileSync('./src/renderer/public/data/5e/spells.json', JSON.stringify(spells, null, 2) + '\n');
console.log(`Format fixes (higher-level text): ${formatFixes}`);
console.log(`Cantrip scaling fixes: ${cantripFixes}`);
console.log('Saved spells.json');
