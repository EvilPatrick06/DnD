const data = require('../src/renderer/public/data/5e/subclasses.json');

const expected = {
  barbarian: [3, 6, 10, 14],
  bard: [3, 6, 14],
  cleric: [3, 6, 17],
  druid: [3, 6, 10, 14],
  fighter: [3, 7, 10, 15, 18],
  monk: [3, 6, 11, 17],
  paladin: [3, 7, 15, 20],
  ranger: [3, 7, 11, 15],
  rogue: [3, 9, 13, 17],
  sorcerer: [3, 6, 14, 18],
  warlock: [3, 6, 10, 14],
  wizard: [3, 6, 10, 14]
};

const discrepancies = [];

for (const sc of data) {
  const cls = sc.class;
  const pattern = expected[cls];
  if (!pattern) {
    discrepancies.push({name: sc.name, class: cls, issue: 'Unknown class'});
    continue;
  }

  // Get unique sorted levels from features
  const featureLevels = [...new Set(sc.features.map(f => f.level))].sort((a, b) => a - b);

  // Check which expected levels are missing
  const missingLevels = pattern.filter(l => !featureLevels.includes(l));
  // Check which levels exist but aren't in the pattern
  const extraLevels = featureLevels.filter(l => !pattern.includes(l));

  if (missingLevels.length > 0 || extraLevels.length > 0) {
    discrepancies.push({
      name: sc.name,
      class: cls,
      expectedPattern: pattern,
      actualLevels: featureLevels,
      missingLevels: missingLevels.length > 0 ? missingLevels : undefined,
      extraLevels: extraLevels.length > 0 ? extraLevels : undefined
    });
  }
}

console.log('=== SUBCLASS FEATURE LEVEL AUDIT ===');
console.log('Total subclasses:', data.length);
console.log('Discrepancies found:', discrepancies.length);
console.log('');

if (discrepancies.length === 0) {
  console.log('All subclasses match their expected patterns!');
} else {
  for (const d of discrepancies) {
    console.log('DISCREPANCY: ' + d.name + ' (' + d.class + ')');
    console.log('  Expected pattern: [' + d.expectedPattern.join(', ') + ']');
    console.log('  Actual levels:    [' + d.actualLevels.join(', ') + ']');
    if (d.missingLevels) console.log('  MISSING levels:   [' + d.missingLevels.join(', ') + ']');
    if (d.extraLevels) console.log('  EXTRA levels:     [' + d.extraLevels.join(', ') + ']');
    console.log('');
  }
}

// Also print a full summary per class
console.log('=== PER-CLASS SUMMARY ===');
const classes = [...new Set(data.map(s => s.class))].sort();
for (const cls of classes) {
  const subs = data.filter(s => s.class === cls);
  console.log(cls.toUpperCase() + ' (expected: [' + expected[cls].join(', ') + ']):');
  for (const s of subs) {
    const levels = [...new Set(s.features.map(f => f.level))].sort((a, b) => a - b);
    const ok = expected[cls].every(l => levels.includes(l)) && levels.every(l => expected[cls].includes(l));
    console.log('  ' + (ok ? 'OK' : 'XX') + ' ' + s.name + ': [' + levels.join(', ') + ']');
  }
}
