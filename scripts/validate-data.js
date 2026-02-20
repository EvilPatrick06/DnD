const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');
const advDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', 'adventures');

// CR → XP mapping
const CR_TO_XP = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
};

// === 1. Basic file validation ===
const files = {
  'monsters.json': { minCount: 330 },
  'creatures.json': { minCount: 70 },
  'npcs.json': { minCount: 40 },
  'magic-items.json': { minCount: 400 },
  'traps.json': { minCount: 10 },
  'hazards.json': { minCount: 10 },
  'poisons.json': { minCount: 10 },
  'environmental-effects.json': { minCount: 10 },
  'curses.json': { minCount: 5 },
  'supernatural-gifts.json': { minCount: 10 }
};

let ok = true;
let totalIssues = 0;

console.log('=== File Validation ===');
for (const [file, opts] of Object.entries(files)) {
  const fp = path.join(dataDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const ids = new Set(data.map(d => d.id));
    const dupes = data.length - ids.size;
    const passed = data.length >= opts.minCount && dupes === 0;
    if (!passed) { ok = false; totalIssues++; }
    console.log((passed ? 'OK' : 'WARN') + ` ${file}: ${data.length} entries` + (dupes > 0 ? ` (${dupes} dupes)` : ''));
  } catch(e) {
    console.log('FAIL ' + file + ': ' + e.message.substring(0, 80));
    ok = false;
    totalIssues++;
  }
}

// === 2. Monster stat block validation ===
console.log('\n=== Monster Stat Block Validation ===');
const monsters = JSON.parse(fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8'));
const creatures = JSON.parse(fs.readFileSync(path.join(dataDir, 'creatures.json'), 'utf8'));
const npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
const allStatBlocks = [...monsters, ...creatures, ...npcs];

console.log(`Total stat blocks: ${allStatBlocks.length} (${monsters.length} monsters, ${creatures.length} creatures, ${npcs.length} npcs)`);

// Check for duplicate IDs across all three files
const allIds = new Map();
let crossDupes = 0;
for (const entry of allStatBlocks) {
  if (allIds.has(entry.id)) {
    console.log(`  DUPE: ${entry.id} appears in multiple files`);
    crossDupes++;
  }
  allIds.set(entry.id, entry);
}
if (crossDupes === 0) console.log('  No duplicate IDs across files');
else { ok = false; totalIssues += crossDupes; }

// Required fields check
const requiredFields = ['id', 'name', 'size', 'type', 'ac', 'hp', 'hitDice', 'speed', 'abilityScores', 'cr', 'senses', 'tokenSize', 'source'];
const missingFields = {};
for (const entry of allStatBlocks) {
  for (const field of requiredFields) {
    if (entry[field] === undefined || entry[field] === null) {
      if (!missingFields[field]) missingFields[field] = [];
      missingFields[field].push(entry.id);
    }
  }
}
for (const [field, ids] of Object.entries(missingFields)) {
  console.log(`  Missing ${field} (${ids.length}): ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);
  totalIssues += ids.length;
  ok = false;
}
if (Object.keys(missingFields).length === 0) console.log('  All required fields present');

// CR-to-XP validation
let xpMismatches = 0;
for (const entry of allStatBlocks) {
  if (entry.cr && CR_TO_XP[entry.cr] !== undefined && entry.xp !== undefined) {
    if (entry.xp !== CR_TO_XP[entry.cr]) {
      console.log(`  XP MISMATCH: ${entry.id} CR ${entry.cr} has XP ${entry.xp}, expected ${CR_TO_XP[entry.cr]}`);
      xpMismatches++;
    }
  }
}
if (xpMismatches === 0) console.log('  All CR-to-XP values correct');
else { ok = false; totalIssues += xpMismatches; }

// Source tag check
const mm2025Count = allStatBlocks.filter(e => e.source === 'mm2025').length;
const legacyCount = allStatBlocks.filter(e => e.source === 'legacy').length;
const otherCount = allStatBlocks.filter(e => e.source !== 'mm2025' && e.source !== 'legacy').length;
console.log(`  Sources: ${mm2025Count} mm2025, ${legacyCount} legacy, ${otherCount} other`);
if (otherCount > 0) {
  ok = false;
  totalIssues++;
}

// === 3. Encounter preset validation ===
console.log('\n=== Encounter Preset Validation ===');
const presets = JSON.parse(fs.readFileSync(path.join(dataDir, 'encounter-presets.json'), 'utf8'));
console.log(`  ${presets.length} encounter presets`);
const allIdSet = new Set(allStatBlocks.map(e => e.id));
let presetBroken = 0;
for (const preset of presets) {
  for (const m of preset.monsters) {
    if (!allIdSet.has(m.id)) {
      console.log(`  MISSING: preset "${preset.id}" references "${m.id}" which doesn't exist`);
      presetBroken++;
    }
  }
}
if (presetBroken === 0) console.log('  All preset monster IDs valid');
else { ok = false; totalIssues += presetBroken; }

// === 4. Adventure reference validation ===
console.log('\n=== Adventure Reference Validation ===');
const adventures = JSON.parse(fs.readFileSync(path.join(advDir, 'adventures.json'), 'utf8'));
console.log(`  ${adventures.length} adventures`);
let advBroken = 0;
for (const adv of adventures) {
  if (adv.encounters) {
    for (const enc of adv.encounters) {
      if (enc.monsters) {
        for (const m of enc.monsters) {
          const id = m.monsterId || m.id;
          if (id && !allIdSet.has(id)) {
            console.log(`  MISSING: "${adv.id}" encounter "${enc.id}" -> "${id}"`);
            advBroken++;
          }
        }
      }
    }
  }
  if (adv.npcs) {
    for (const npc of adv.npcs) {
      if (npc.statBlockId && !allIdSet.has(npc.statBlockId)) {
        console.log(`  MISSING: "${adv.id}" NPC "${npc.name}" -> "${npc.statBlockId}"`);
        advBroken++;
      }
    }
  }
}
if (advBroken === 0) console.log('  All adventure references valid');
else { ok = false; totalIssues += advBroken; }

// === Summary ===
console.log('\n=== Summary ===');
console.log(`Total stat blocks: ${allStatBlocks.length}`);
console.log(`Encounter presets: ${presets.length}`);
console.log(`Adventures: ${adventures.length}`);
console.log(`Issues: ${totalIssues}`);
console.log(ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS NEED ATTENTION');
process.exit(ok ? 0 : 1);
