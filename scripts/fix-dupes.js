const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

// Remove from creatures.json: flying-snake, axe-beak, giant-eagle, giant-vulture (Monstrosities/Celestials belong in monsters)
// Remove from monsters.json: venomous-snake (Beast belongs in creatures)

const removeFromCreatures = new Set(['flying-snake', 'axe-beak', 'giant-eagle', 'giant-vulture']);
const removeFromMonsters = new Set(['venomous-snake']);

// Fix creatures.json
const creaturesPath = path.join(dataDir, 'creatures.json');
let creatures = JSON.parse(fs.readFileSync(creaturesPath, 'utf8'));
const crBefore = creatures.length;
creatures = creatures.filter(c => !removeFromCreatures.has(c.id));
fs.writeFileSync(creaturesPath, JSON.stringify(creatures, null, 2) + '\n');
console.log(`creatures.json: ${crBefore} -> ${creatures.length} (removed ${crBefore - creatures.length})`);

// Fix monsters.json
const monstersPath = path.join(dataDir, 'monsters.json');
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
const mBefore = monsters.length;
monsters = monsters.filter(m => !removeFromMonsters.has(m.id));
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log(`monsters.json: ${mBefore} -> ${monsters.length} (removed ${mBefore - monsters.length})`);

// Also check for any within-file duplicates
for (const [name, arr] of [['monsters', monsters], ['creatures', creatures]]) {
  const seen = new Set();
  const dupes = [];
  for (const e of arr) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.add(e.id);
  }
  if (dupes.length > 0) console.log(`  ${name} internal dupes: ${dupes.join(', ')}`);
}

console.log('Done!');
