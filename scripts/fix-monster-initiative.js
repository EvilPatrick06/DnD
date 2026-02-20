const fs = require('fs');
const monsters = require('../src/renderer/public/data/5e/monsters.json');

let fixed = 0;
for (const m of monsters) {
  if (m.initiative !== undefined) continue;

  // Calculate initiative from DEX score
  let dex = 10; // default
  if (m.abilityScores) {
    dex = m.abilityScores.dex || m.abilityScores.dexterity || 10;
  }
  const modifier = Math.floor((dex - 10) / 2);
  const score = 10 + modifier;

  m.initiative = { modifier, score };
  fixed++;
}

console.log(`Added initiative to ${fixed} monsters`);

// Verify all have initiative now
const missing = monsters.filter(m => m.initiative === undefined);
console.log(`Monsters still missing initiative: ${missing.length}`);

fs.writeFileSync(
  './src/renderer/public/data/5e/monsters.json',
  JSON.stringify(monsters, null, 2) + '\n'
);
console.log('Saved monsters.json');
