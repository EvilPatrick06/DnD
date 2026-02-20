// Fix monster data issues:
// 1. Remove duplicate entries from monsters.json that exist in npcs.json/creatures.json
// 2. Add initiative fields to all entries missing them
// 3. Fix CR 0 XP values (MM 2025: CR 0 = 0 XP)
const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '../src/renderer/public/data/5e/monsters.json');
const creaturesPath = path.join(__dirname, '../src/renderer/public/data/5e/creatures.json');
const npcsPath = path.join(__dirname, '../src/renderer/public/data/5e/npcs.json');

let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
let creatures = JSON.parse(fs.readFileSync(creaturesPath, 'utf8'));
let npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf8'));

// === 1. Remove duplicates from monsters.json ===
// NPCs that exist in both: keep in npcs.json, remove from monsters.json
const npcIds = new Set(npcs.map(n => n.id));
const creatureIds = new Set(creatures.map(c => c.id));

const dupeRemoved = [];
const beforeCount = monsters.length;
monsters = monsters.filter(m => {
  if (npcIds.has(m.id)) {
    dupeRemoved.push(`${m.name} (duplicate in npcs.json)`);
    return false;
  }
  if (creatureIds.has(m.id)) {
    dupeRemoved.push(`${m.name} (duplicate in creatures.json)`);
    return false;
  }
  return true;
});
console.log(`Removed ${dupeRemoved.length} duplicates from monsters.json (${beforeCount} -> ${monsters.length}):`);
dupeRemoved.forEach(d => console.log(`  ${d}`));

// === 2. Add initiative fields to entries missing them ===
function addInitiative(entries, fileName) {
  let count = 0;
  for (const m of entries) {
    if (m.initiative === undefined || m.initiative === null) {
      const dexMod = Math.floor((m.abilityScores.dex - 10) / 2);
      m.initiative = {
        modifier: dexMod,
        score: 10 + dexMod
      };
      count++;
    }
  }
  if (count > 0) console.log(`\nAdded initiative to ${count} entries in ${fileName}`);
}

addInitiative(monsters, 'monsters.json');
addInitiative(creatures, 'creatures.json');
addInitiative(npcs, 'npcs.json');

// === 3. Fix CR 0 XP values ===
// MM 2025: CR 0 = 0 XP (not 10 XP which was from 2014)
let xpFixed = 0;
for (const m of [...monsters, ...creatures, ...npcs]) {
  if (String(m.cr) === '0' && m.xp !== 0) {
    m.xp = 0;
    xpFixed++;
  }
}
console.log(`\nFixed XP to 0 for ${xpFixed} CR 0 entries`);

// === Write back ===
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
fs.writeFileSync(creaturesPath, JSON.stringify(creatures, null, 2) + '\n');
fs.writeFileSync(npcsPath, JSON.stringify(npcs, null, 2) + '\n');

console.log('\nDone. Written:', monsters.length, 'monsters,', creatures.length, 'creatures,', npcs.length, 'npcs');
