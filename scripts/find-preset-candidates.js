const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');
const presets = require('../src/renderer/public/data/5e/encounter-presets.json');

const usedIds = new Set();
for (const p of presets) {
  for (const m of p.monsters) usedIds.add(m.id);
}

const all = [...monsters, ...creatures, ...npcs];
const unused = all.filter(m => m.source === 'mm2025' && !usedIds.has(m.id));

// Show interesting combos by type
const byType = {};
for (const m of unused) {
  const t = m.type || 'unknown';
  if (!byType[t]) byType[t] = [];
  byType[t].push({ id: m.id, name: m.name, cr: m.cr });
}

for (const type of Object.keys(byType).sort()) {
  console.log(`\n${type}:`);
  byType[type].sort((a, b) => {
    const crA = a.cr === '1/8' ? 0.125 : a.cr === '1/4' ? 0.25 : a.cr === '1/2' ? 0.5 : parseFloat(a.cr);
    const crB = b.cr === '1/8' ? 0.125 : b.cr === '1/4' ? 0.25 : b.cr === '1/2' ? 0.5 : parseFloat(b.cr);
    return crA - crB;
  });
  for (const m of byType[type]) {
    console.log(`  CR ${m.cr}: ${m.name} (${m.id})`);
  }
}
