const monsters = require('../src/renderer/public/data/5e/monsters.json');
const withInit = monsters.filter(m => m.initiative !== undefined);
const withoutInit = monsters.filter(m => m.initiative === undefined);
console.log('Total monsters:', monsters.length);
console.log('With initiative:', withInit.length);
console.log('Without initiative:', withoutInit.length);
console.log('\nSample missing initiative:');
withoutInit.slice(0, 5).forEach(m => {
  const dex = m.abilityScores ? m.abilityScores.dexterity : 'unknown';
  console.log(`  ${m.name} | DEX: ${dex}`);
});
console.log('\nSample with initiative:');
withInit.slice(0, 3).forEach(m => {
  console.log(`  ${m.name} | initiative: ${JSON.stringify(m.initiative)}`);
});
