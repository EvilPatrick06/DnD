const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');

console.log('=== Data File Summary ===');
console.log('monsters:', monsters.length, '| creatures:', creatures.length, '| npcs:', npcs.length);
console.log('Total:', monsters.length + creatures.length + npcs.length);

function checkSource(arr, name) {
  const mm = arr.filter(e => e.source === 'mm2025').length;
  const leg = arr.filter(e => e.source === 'legacy').length;
  const none = arr.filter(e => e.source !== 'mm2025' && e.source !== 'legacy').length;
  console.log(`${name} - mm2025: ${mm}, legacy: ${leg}, no source: ${none}`);
  if (none > 0) {
    const noSrc = arr.filter(e => e.source !== 'mm2025' && e.source !== 'legacy');
    noSrc.forEach(e => console.log(`  [no source] ${e.id} (${e.name}) source="${e.source || 'undefined'}"`));
  }
}

checkSource(monsters, 'Monsters');
checkSource(creatures, 'Creatures');
checkSource(npcs, 'NPCs');

// Check for entries missing critical fields
console.log('\n=== Missing Critical Fields ===');
const allEntries = [...monsters, ...creatures, ...npcs];
const missing = {
  initiative: allEntries.filter(e => !e.initiative).map(e => e.id),
  senses: allEntries.filter(e => !e.senses).map(e => e.id),
  tokenSize: allEntries.filter(e => !e.tokenSize).map(e => e.id),
  actions: allEntries.filter(e => !e.actions || e.actions.length === 0).map(e => e.id),
  hitDice: allEntries.filter(e => !e.hitDice).map(e => e.id),
  speed: allEntries.filter(e => !e.speed).map(e => e.id),
  proficiencyBonus: allEntries.filter(e => !e.proficiencyBonus && e.proficiencyBonus !== 0).map(e => e.id),
};

for (const [field, ids] of Object.entries(missing)) {
  if (ids.length > 0) {
    console.log(`Missing ${field} (${ids.length}): ${ids.slice(0, 10).join(', ')}${ids.length > 10 ? '...' : ''}`);
  }
}

// Check NPC entries - list them all for verification
console.log('\n=== All NPC Entries ===');
npcs.forEach(e => console.log(`  ${e.id} | ${e.name} | CR ${e.cr} | source: ${e.source || 'none'}`));

// Check legacy entries
console.log('\n=== Legacy Entries ===');
allEntries.filter(e => e.source === 'legacy').forEach(e =>
  console.log(`  ${e.id} | ${e.name} | CR ${e.cr}`)
);
