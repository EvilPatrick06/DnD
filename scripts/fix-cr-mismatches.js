const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

// CR fixes from MM 2025 audit
const crFixes = {
  'mule': { cr: '0', xp: 0 },
  'pony': { cr: '0', xp: 0 },
  'venomous-snake': { cr: '0', xp: 0 },
  'wolf': { cr: '0', xp: 0 },
  'swarm-of-bats': { cr: '1/8', xp: 25 },
  'swarm-of-rats': { cr: '1/8', xp: 25 },
  'swarm-of-ravens': { cr: '1/8', xp: 25 },
};

// CR → Prof Bonus
const CR_TO_PROF = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2,
  '1': 2, '2': 2, '3': 2, '4': 2, '5': 3, '6': 3, '7': 3, '8': 3,
  '9': 4, '10': 4, '11': 4, '12': 4, '13': 5, '14': 5, '15': 5, '16': 5,
  '17': 6, '18': 6, '19': 6, '20': 6, '21': 7, '22': 7, '23': 7, '24': 7,
  '25': 8, '26': 8, '27': 8, '28': 8, '29': 9, '30': 9
};

for (const file of ['monsters.json', 'creatures.json', 'npcs.json']) {
  const fp = path.join(dataDir, file);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let changed = 0;

  for (const entry of data) {
    if (crFixes[entry.id]) {
      const fix = crFixes[entry.id];
      const oldCr = entry.cr;
      entry.cr = fix.cr;
      entry.xp = fix.xp;
      entry.proficiencyBonus = CR_TO_PROF[fix.cr];
      console.log(`  ${file}: ${entry.name} CR ${oldCr} -> ${fix.cr}`);
      changed++;
    }
  }

  if (changed > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(`  ${file}: ${changed} entries updated`);
  }
}

console.log('Done!');
