const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');

const monsterIds = new Set(monsters.map(m => m.id));
const creatureIds = new Set(creatures.map(c => c.id));
const npcIds = new Set(npcs.map(n => n.id));

console.log('=== Cross-file duplicates ===');

// Monsters vs Creatures
for (const c of creatures) {
  if (monsterIds.has(c.id)) {
    const m = monsters.find(m => m.id === c.id);
    console.log(`DUPE ${c.id}: in monsters.json (${m.type}) AND creatures.json (${c.type})`);
  }
}

// Monsters vs NPCs
for (const n of npcs) {
  if (monsterIds.has(n.id)) {
    const m = monsters.find(m => m.id === n.id);
    console.log(`DUPE ${n.id}: in monsters.json (${m.type}) AND npcs.json (${n.type})`);
  }
}

// Creatures vs NPCs
for (const n of npcs) {
  if (creatureIds.has(n.id)) {
    console.log(`DUPE ${n.id}: in creatures.json AND npcs.json`);
  }
}
