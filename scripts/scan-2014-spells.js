// Scan spells.json for indicators of 2014 text vs 2024 text
const spells = require('../src/renderer/public/data/5e/spells.json');

const indicators2014 = [];

for (const spell of spells) {
  const desc = (spell.description || '') + ' ' + (spell.higherLevels || '');

  // 2014 indicators
  if (desc.includes('At Higher Levels') && !desc.includes('Using a Higher-Level Spell Slot')) {
    indicators2014.push({ name: spell.name, issue: 'Uses "At Higher Levels" instead of "Using a Higher-Level Spell Slot"' });
  }
  if (desc.includes("this spell's damage increases") && spell.level === 0 && !desc.includes('Cantrip Upgrade')) {
    indicators2014.push({ name: spell.name, issue: 'Cantrip uses old scaling text instead of "Cantrip Upgrade"' });
  }
  if (desc.includes('ability check') && spell.name === 'Dispel Magic') {
    indicators2014.push({ name: spell.name, issue: 'Uses "ability check" — may need 2024 update' });
  }
}

// Check for spells that should have spellList field
const missingSpellList = spells.filter(s => !s.spellList || s.spellList.length === 0);

console.log('=== 2014 Text Indicators ===');
indicators2014.forEach(i => console.log(`  ${i.name}: ${i.issue}`));
console.log(`\nTotal with 2014 indicators: ${indicators2014.length}`);

console.log(`\n=== Missing spellList field ===`);
console.log(`${missingSpellList.length} spells missing spellList (arcane/divine/primal)`);
if (missingSpellList.length > 0 && missingSpellList.length <= 20) {
  missingSpellList.forEach(s => console.log(`  ${s.name}`));
}

// Count "At Higher Levels" vs "Using a Higher-Level Spell Slot"
const oldFormat = spells.filter(s => (s.higherLevels || '').includes('At Higher Levels') ||
  ((s.higherLevels || '').includes('When you cast this spell using a spell slot') && !(s.higherLevels || '').includes('Using a Higher-Level Spell Slot')));
const newFormat = spells.filter(s => (s.higherLevels || '').includes('Using a Higher-Level Spell Slot'));
const cantripsOld = spells.filter(s => s.level === 0 && (s.description || '').includes("spell's damage increases") && !(s.description || '').includes('Cantrip Upgrade'));
const cantripsNew = spells.filter(s => s.level === 0 && ((s.description || '') + ' ' + (s.higherLevels || '')).includes('Cantrip Upgrade'));

console.log(`\n=== Higher Level Format ===`);
console.log(`Old format ("At Higher Levels"/"When you cast..."): ${oldFormat.length}`);
console.log(`New format ("Using a Higher-Level Spell Slot"): ${newFormat.length}`);
console.log(`\n=== Cantrip Scaling Format ===`);
console.log(`Old format cantrips: ${cantripsOld.length}`);
console.log(`New "Cantrip Upgrade" format: ${cantripsNew.length}`);
console.log(`Total cantrips: ${spells.filter(s => s.level === 0).length}`);

// Sample old-format spells
console.log('\n=== Sample Old Format Spells ===');
oldFormat.slice(0, 10).forEach(s => console.log(`  ${s.name}: "${(s.higherLevels || '').substring(0, 80)}..."`));
