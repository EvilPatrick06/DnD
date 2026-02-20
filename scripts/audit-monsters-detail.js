// Detailed monster audit
const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');

const all = [...monsters, ...creatures, ...npcs];

// List all 39 missing initiative entries
console.log('=== ALL ENTRIES MISSING INITIATIVE ===');
const noInit = all.filter(m => m.initiative === undefined || m.initiative === null);
noInit.forEach(m => console.log(`  ${m.name} (${m.type}, CR ${m.cr}, DEX ${m.abilityScores?.dex})`));

// List all 11 duplicate IDs with which file they're in
console.log('\n=== DUPLICATE ID DETAILS ===');
const byId = {};
for (const m of monsters) { byId[m.id] = byId[m.id] || []; byId[m.id].push({name: m.name, file: 'monsters'}); }
for (const m of creatures) { byId[m.id] = byId[m.id] || []; byId[m.id].push({name: m.name, file: 'creatures'}); }
for (const m of npcs) { byId[m.id] = byId[m.id] || []; byId[m.id].push({name: m.name, file: 'npcs'}); }
for (const [id, entries] of Object.entries(byId)) {
  if (entries.length > 1) {
    console.log(`  ${id}: ${entries.map(e => e.name + ' (' + e.file + ')').join(', ')}`);
  }
}

// All XP = 10 for CR 0 — is this correct in MM 2025?
console.log('\n=== CR 0 MONSTERS WITH XP=10 ===');
const cr0 = all.filter(m => String(m.cr) === '0' && m.xp === 10);
cr0.forEach(m => console.log(`  ${m.name}`));

// CR 0 with XP=0
const cr0zero = all.filter(m => String(m.cr) === '0' && m.xp === 0);
console.log('\nCR 0 with XP=0:', cr0zero.length);
cr0zero.forEach(m => console.log(`  ${m.name}`));
