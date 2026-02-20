const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');
const allIds = new Set([...monsters.map(m => m.id), ...creatures.map(c => c.id), ...npcs.map(n => n.id)]);

// Check encounter presets
const presets = require('../src/renderer/public/data/5e/encounter-presets.json');
console.log('=== Encounter Presets ===');
let broken = 0;
for (const preset of presets) {
  for (const m of preset.monsters) {
    if (!allIds.has(m.id)) {
      console.log('  MISSING:', preset.id, '->', m.id);
      broken++;
    }
  }
}
if (broken === 0) console.log('  All OK');

// Check adventures
const adventures = require('../src/renderer/public/data/adventures/adventures.json');
console.log('\n=== Adventures ===');
let advBroken = 0;
for (const adv of adventures) {
  if (adv.encounters) {
    for (const enc of adv.encounters) {
      if (enc.monsters) {
        for (const m of enc.monsters) {
          const id = m.monsterId || m.id;
          if (id && !allIds.has(id)) {
            console.log('  ENC MISSING:', adv.id, '/', enc.id, '->', id);
            advBroken++;
          }
        }
      }
    }
  }
  if (adv.npcs) {
    for (const npc of adv.npcs) {
      if (npc.statBlockId && !allIds.has(npc.statBlockId)) {
        console.log('  NPC MISSING:', adv.id, '/', npc.name, '->', npc.statBlockId);
        advBroken++;
      }
    }
  }
}
if (advBroken === 0) console.log('  All OK');

console.log('\nTotal broken:', broken + advBroken);
