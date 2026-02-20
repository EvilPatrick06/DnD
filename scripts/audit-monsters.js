// Monster data audit script
const monsters = require('../src/renderer/public/data/5e/monsters.json');
const creatures = require('../src/renderer/public/data/5e/creatures.json');
const npcs = require('../src/renderer/public/data/5e/npcs.json');

const all = [...monsters, ...creatures, ...npcs];
console.log('Total entries:', all.length, '(monsters:', monsters.length, 'creatures:', creatures.length, 'npcs:', npcs.length, ')');

// Check for missing required fields
const requiredFields = ['id', 'name', 'size', 'type', 'ac', 'hp', 'hitDice', 'speed', 'abilityScores', 'cr', 'xp', 'proficiencyBonus', 'initiative', 'actions'];
const missing = {};
for (const m of all) {
  for (const field of requiredFields) {
    if (m[field] === undefined || m[field] === null) {
      if (!(field in missing)) missing[field] = [];
      missing[field].push(m.name);
    }
  }
}

console.log('\n=== MISSING REQUIRED FIELDS ===');
for (const [field, names] of Object.entries(missing)) {
  console.log(`${field} missing in ${names.length} entries:`);
  names.slice(0, 5).forEach(n => console.log('  ', n));
  if (names.length > 5) console.log(`  ...and ${names.length - 5} more`);
}
if (Object.keys(missing).length === 0) console.log('None - all fields present');

// Check proficiency bonus consistency
const crToProf = {'0': 2, '1/8': 2, '1/4': 2, '1/2': 2, '1': 2, '2': 2, '3': 2, '4': 2, '5': 3, '6': 3, '7': 3, '8': 3, '9': 4, '10': 4, '11': 4, '12': 4, '13': 5, '14': 5, '15': 5, '16': 5, '17': 6, '18': 6, '19': 6, '20': 6, '21': 7, '22': 7, '23': 7, '24': 7, '25': 8, '26': 8, '27': 8, '28': 8, '29': 9, '30': 9};
const profIssues = [];
for (const m of all) {
  const expected = crToProf[String(m.cr)];
  if (expected && m.proficiencyBonus !== expected) {
    profIssues.push(`${m.name} CR:${m.cr} has prof=${m.proficiencyBonus} expected=${expected}`);
  }
}
console.log('\n=== PROFICIENCY BONUS MISMATCHES ===');
console.log('Count:', profIssues.length);
profIssues.forEach(i => console.log('  ', i));

// Check initiative consistency (should be DEX mod in most cases, but MM 2025 initiative can differ)
const initIssues = [];
for (const m of all) {
  if (m.initiative && m.abilityScores) {
    const dexMod = Math.floor((m.abilityScores.dex - 10) / 2);
    if (m.initiative.modifier !== dexMod) {
      initIssues.push(`${m.name} init=${m.initiative.modifier} dexMod=${dexMod} (dex=${m.abilityScores.dex})`);
    }
  }
}
console.log('\n=== INITIATIVE != DEX MOD ===');
console.log('Count:', initIssues.length);
initIssues.slice(0, 30).forEach(i => console.log('  ', i));
if (initIssues.length > 30) console.log(`  ...and ${initIssues.length - 30} more`);

// Check for duplicate IDs
const idCounts = {};
for (const m of all) {
  idCounts[m.id] = (idCounts[m.id] || 0) + 1;
}
const dupes = Object.entries(idCounts).filter(([, c]) => c > 1);
console.log('\n=== DUPLICATE IDs ===');
console.log('Count:', dupes.length);
dupes.forEach(([id, count]) => console.log(`  ${id}: ${count} entries`));

// Check XP values match CR
const crToXP = {'0': 0, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000};
const xpIssues = [];
for (const m of all) {
  const expected = crToXP[String(m.cr)];
  if (expected !== undefined && m.xp !== expected) {
    xpIssues.push(`${m.name} CR:${m.cr} has xp=${m.xp} expected=${expected}`);
  }
}
console.log('\n=== XP MISMATCHES ===');
console.log('Count:', xpIssues.length);
xpIssues.slice(0, 20).forEach(i => console.log('  ', i));
if (xpIssues.length > 20) console.log(`  ...and ${xpIssues.length - 20} more`);

// Check for monsters with empty actions
const noActions = all.filter(m => m.actions && m.actions.length === 0);
console.log('\n=== EMPTY ACTIONS ===');
console.log('Count:', noActions.length);
noActions.forEach(m => console.log('  ', m.name));

// Check speed format consistency
const speedIssues = [];
for (const m of all) {
  if (typeof m.speed !== 'object') {
    speedIssues.push(`${m.name}: speed is ${typeof m.speed}`);
  } else if (m.speed.walk === undefined) {
    speedIssues.push(`${m.name}: no walk speed`);
  }
}
console.log('\n=== SPEED FORMAT ISSUES ===');
console.log('Count:', speedIssues.length);
speedIssues.forEach(i => console.log('  ', i));

// List CR distribution
const crDist = {};
for (const m of monsters) {
  crDist[m.cr] = (crDist[m.cr] || 0) + 1;
}
console.log('\n=== CR DISTRIBUTION (monsters.json) ===');
const crOrder = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
for (const cr of crOrder) {
  if (crDist[cr]) console.log(`  CR ${cr}: ${crDist[cr]} monsters`);
}
