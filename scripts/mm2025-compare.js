#!/usr/bin/env node
/**
 * MM 2025 Comparison Tool
 *
 * Compares parsed MM2025 data against existing app data and produces
 * a field-level diff report.
 *
 * Usage: node scripts/mm2025-compare.js
 * Input: scripts/mm2025-parsed.json + data files
 * Output: scripts/mm2025-diff-report.json
 */

const fs = require('fs');
const path = require('path');

// === Load Data ===

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');
const parsedPath = path.join(__dirname, 'mm2025-parsed.json');

if (!fs.existsSync(parsedPath)) {
  console.error('ERROR: Run mm2025-parse.js first to generate mm2025-parsed.json');
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
const monsters = JSON.parse(fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8'));
const creatures = JSON.parse(fs.readFileSync(path.join(dataDir, 'creatures.json'), 'utf8'));
const npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
const allExisting = [...monsters, ...creatures, ...npcs];

// === Known Name Mappings (app name → MM2025 name) ===

const NAME_MAP_TO_MM = {
  'Bugbear': 'Bugbear Warrior',
  'Cyclops': 'Cyclops Sentry',
  'Kobold': 'Kobold Warrior',
  'Goblin': 'Goblin Warrior',
  'Flying Sword': 'Animated Flying Sword',
  'Rug of Smothering': 'Animated Rug of Smothering',
  'Shrieker': 'Shrieker Fungus',
  'Duodrone': 'Modron Duodrone',
  'Monodrone': 'Modron Monodrone',
  'Tridrone': 'Modron Tridrone',
  'Quadrone': 'Modron Quadrone',
  'Pentadrone': 'Modron Pentadrone',
  'Merfolk': 'Merfolk Skirmisher',
  'Bullywug': 'Bullywug Warrior',
  'Cult Fanatic': 'Cultist Fanatic',
  'Sahuagin': 'Sahuagin Warrior',
  'Gnoll': 'Gnoll Warrior',
  'Thri-kreen': 'Thri-kreen Marauder',
  'Yuan-ti': 'Yuan-ti Infiltrator',
  'Acolyte': 'Priest Acolyte',
  'Gas Spore': 'Gas Spore Fungus',
  'Fire Snake': 'Salamander Fire Snake',
  'Succubus/Incubus': 'Succubus',
  'Minotaur Skeleton': 'Minotaur Skeleton',
  'Ogre Zombie': 'Ogre Zombie',
  'Axe Beak': 'Axe Beak',
  'Githyanki Soldier': 'Githyanki Warrior',
  'Broom of Animated Attack': 'Animated Broom',
  'Azer': 'Azer Sentinel',
  'Centaur': 'Centaur Trooper',
};

// Reverse map: MM2025 name → app name
const NAME_MAP_FROM_MM = {};
for (const [appName, mmName] of Object.entries(NAME_MAP_TO_MM)) {
  NAME_MAP_FROM_MM[mmName] = appName;
}

// === Build Lookup Maps ===

const existingByName = new Map();
const existingByNameLower = new Map();
const existingById = new Map();

for (const entry of allExisting) {
  existingByName.set(entry.name, entry);
  existingByNameLower.set(entry.name.toLowerCase(), entry);
  existingById.set(entry.id, entry);
}

function getExistingFile(entry) {
  if (monsters.some(m => m.id === entry.id)) return 'monsters.json';
  if (creatures.some(m => m.id === entry.id)) return 'creatures.json';
  if (npcs.some(m => m.id === entry.id)) return 'npcs.json';
  return 'unknown';
}

// === Matching Logic ===

function findMatch(parsedEntry) {
  // 1. Exact name match
  const exact = existingByName.get(parsedEntry.name);
  if (exact) return { entry: exact, matchType: 'exact' };

  // 2. Known rename (MM2025 name → app name)
  const appName = NAME_MAP_FROM_MM[parsedEntry.name];
  if (appName) {
    const renamed = existingByName.get(appName);
    if (renamed) return { entry: renamed, matchType: 'rename', appName };
  }

  // 3. Case-insensitive match
  const lower = existingByNameLower.get(parsedEntry.name.toLowerCase());
  if (lower) return { entry: lower, matchType: 'case-insensitive' };

  // 4. ID match
  const byId = existingById.get(parsedEntry.id);
  if (byId) return { entry: byId, matchType: 'id' };

  return null;
}

// === Field Comparison ===

function compareFields(parsed, existing) {
  const diffs = [];

  // Identity
  if (parsed.size !== existing.size) diffs.push({ field: 'size', expected: parsed.size, actual: existing.size, severity: 'medium' });
  if (parsed.type !== existing.type) diffs.push({ field: 'type', expected: parsed.type, actual: existing.type, severity: 'medium' });
  if (parsed.alignment !== existing.alignment) diffs.push({ field: 'alignment', expected: parsed.alignment, actual: existing.alignment, severity: 'low' });
  if (parsed.subtype && parsed.subtype !== existing.subtype) diffs.push({ field: 'subtype', expected: parsed.subtype, actual: existing.subtype, severity: 'low' });

  // Stats
  if (parsed.ac !== existing.ac) diffs.push({ field: 'ac', expected: parsed.ac, actual: existing.ac, severity: 'critical' });
  if (parsed.hp !== existing.hp) diffs.push({ field: 'hp', expected: parsed.hp, actual: existing.hp, severity: 'critical' });
  if (parsed.hitDice !== existing.hitDice && normalizeHitDice(parsed.hitDice) !== normalizeHitDice(existing.hitDice)) {
    diffs.push({ field: 'hitDice', expected: parsed.hitDice, actual: existing.hitDice, severity: 'high' });
  }
  if (parsed.cr !== String(existing.cr)) diffs.push({ field: 'cr', expected: parsed.cr, actual: existing.cr, severity: 'critical' });

  // Speed
  const speedFields = ['walk', 'burrow', 'climb', 'fly', 'swim'];
  for (const sf of speedFields) {
    const pSpeed = parsed.speed[sf] || 0;
    const eSpeed = (existing.speed && existing.speed[sf]) || 0;
    if (pSpeed !== eSpeed) {
      diffs.push({ field: `speed.${sf}`, expected: pSpeed, actual: eSpeed, severity: 'high' });
    }
  }
  if (parsed.speed.hover && !(existing.speed && existing.speed.hover)) {
    diffs.push({ field: 'speed.hover', expected: true, actual: false, severity: 'medium' });
  }

  // Ability Scores
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  for (const ab of abilities) {
    if (parsed.abilityScores[ab] !== existing.abilityScores[ab]) {
      diffs.push({ field: `abilityScores.${ab}`, expected: parsed.abilityScores[ab], actual: existing.abilityScores[ab], severity: 'high' });
    }
  }

  // Saving throws
  if (parsed.savingThrows) {
    for (const [ab, val] of Object.entries(parsed.savingThrows)) {
      const existVal = existing.savingThrows && existing.savingThrows[ab];
      if (val !== existVal) {
        diffs.push({ field: `savingThrows.${ab}`, expected: val, actual: existVal || 'none', severity: 'high' });
      }
    }
  }

  // Initiative
  if (parsed.initiative) {
    if (!existing.initiative) {
      diffs.push({ field: 'initiative', expected: parsed.initiative, actual: 'missing', severity: 'medium' });
    } else {
      if (parsed.initiative.modifier !== existing.initiative.modifier) {
        diffs.push({ field: 'initiative.modifier', expected: parsed.initiative.modifier, actual: existing.initiative.modifier, severity: 'medium' });
      }
      if (parsed.initiative.score !== existing.initiative.score) {
        diffs.push({ field: 'initiative.score', expected: parsed.initiative.score, actual: existing.initiative.score, severity: 'medium' });
      }
    }
  }

  // Skills
  if (parsed.skills) {
    for (const [skill, val] of Object.entries(parsed.skills)) {
      const existVal = existing.skills && existing.skills[skill];
      if (val !== existVal) {
        diffs.push({ field: `skills.${skill}`, expected: val, actual: existVal || 'missing', severity: 'medium' });
      }
    }
  }

  // Resistances, vulnerabilities, immunities
  compareArrayField(parsed.resistances, existing.resistances, 'resistances', diffs);
  compareArrayField(parsed.vulnerabilities, existing.vulnerabilities, 'vulnerabilities', diffs);
  compareArrayField(parsed.damageImmunities, existing.damageImmunities, 'damageImmunities', diffs);
  compareArrayField(parsed.conditionImmunities, existing.conditionImmunities, 'conditionImmunities', diffs);

  // Senses
  if (parsed.senses) {
    const senseFields = ['blindsight', 'darkvision', 'tremorsense', 'truesight', 'passivePerception'];
    for (const sf of senseFields) {
      const pVal = parsed.senses[sf];
      const eVal = existing.senses && existing.senses[sf];
      if (pVal !== undefined && pVal !== eVal) {
        diffs.push({ field: `senses.${sf}`, expected: pVal, actual: eVal || 'missing', severity: 'medium' });
      }
    }
  }

  // Languages
  if (parsed.languages && existing.languages) {
    const pLangs = new Set(parsed.languages.map(l => l.toLowerCase()));
    const eLangs = new Set(existing.languages.map(l => l.toLowerCase()));
    const missing = [...pLangs].filter(l => !eLangs.has(l));
    const extra = [...eLangs].filter(l => !pLangs.has(l));
    if (missing.length > 0 || extra.length > 0) {
      diffs.push({ field: 'languages', expected: parsed.languages, actual: existing.languages, severity: 'low' });
    }
  }

  // Telepathy
  if (parsed.telepathy && parsed.telepathy !== existing.telepathy) {
    diffs.push({ field: 'telepathy', expected: parsed.telepathy, actual: existing.telepathy, severity: 'low' });
  }

  // XP — use CR-to-XP table as source of truth, not parsed value
  const CR_TO_XP = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
    '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
    '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
    '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
    '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
    '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
    '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
  };
  const expectedXp = CR_TO_XP[existing.cr] ?? parsed.xp;
  if (expectedXp !== existing.xp) {
    diffs.push({ field: 'xp', expected: expectedXp, actual: existing.xp, severity: 'medium' });
  }

  // Proficiency bonus
  if (parsed.proficiencyBonus !== existing.proficiencyBonus) {
    diffs.push({ field: 'proficiencyBonus', expected: parsed.proficiencyBonus, actual: existing.proficiencyBonus, severity: 'medium' });
  }

  // Traits
  const pTraitNames = (parsed.traits || []).map(t => t.name);
  const eTraitNames = (existing.traits || []).map(t => t.name);
  const missingTraits = pTraitNames.filter(n => !eTraitNames.includes(n));
  const extraTraits = eTraitNames.filter(n => !pTraitNames.includes(n));
  if (missingTraits.length > 0) diffs.push({ field: 'traits.missing', expected: missingTraits, actual: 'not present', severity: 'medium' });
  if (extraTraits.length > 0) diffs.push({ field: 'traits.extra', expected: 'not in source', actual: extraTraits, severity: 'low' });

  // Actions
  compareActions(parsed.actions, existing.actions, 'actions', diffs);

  // Bonus actions
  if (parsed.bonusActions && parsed.bonusActions.length > 0) {
    if (!existing.bonusActions || existing.bonusActions.length === 0) {
      diffs.push({ field: 'bonusActions', expected: parsed.bonusActions.map(a => a.name), actual: 'missing', severity: 'high' });
    } else {
      compareActions(parsed.bonusActions, existing.bonusActions, 'bonusActions', diffs);
    }
  }

  // Reactions
  if (parsed.reactions && parsed.reactions.length > 0) {
    if (!existing.reactions || existing.reactions.length === 0) {
      diffs.push({ field: 'reactions', expected: parsed.reactions.map(a => a.name), actual: 'missing', severity: 'high' });
    } else {
      compareActions(parsed.reactions, existing.reactions, 'reactions', diffs);
    }
  }

  // Legendary actions
  if (parsed.legendaryActions) {
    if (!existing.legendaryActions) {
      diffs.push({ field: 'legendaryActions', expected: `${parsed.legendaryActions.uses} uses, ${parsed.legendaryActions.actions.length} actions`, actual: 'missing', severity: 'high' });
    } else {
      if (parsed.legendaryActions.uses !== existing.legendaryActions.uses) {
        diffs.push({ field: 'legendaryActions.uses', expected: parsed.legendaryActions.uses, actual: existing.legendaryActions.uses, severity: 'high' });
      }
      compareActions(parsed.legendaryActions.actions, existing.legendaryActions.actions, 'legendaryActions.actions', diffs);
    }
  }

  // Spellcasting
  if (parsed.spellcasting) {
    if (!existing.spellcasting) {
      diffs.push({ field: 'spellcasting', expected: `${parsed.spellcasting.ability} DC ${parsed.spellcasting.saveDC}`, actual: 'missing', severity: 'high' });
    } else {
      if (parsed.spellcasting.saveDC !== existing.spellcasting.saveDC) {
        diffs.push({ field: 'spellcasting.saveDC', expected: parsed.spellcasting.saveDC, actual: existing.spellcasting.saveDC, severity: 'high' });
      }
      if (parsed.spellcasting.ability !== existing.spellcasting.ability) {
        diffs.push({ field: 'spellcasting.ability', expected: parsed.spellcasting.ability, actual: existing.spellcasting.ability, severity: 'medium' });
      }
    }
  }

  // Structured action fields check (feature completeness)
  const actionsNeedingStructure = [];
  for (const action of existing.actions || []) {
    if (action.name === 'Multiattack' || action.name === 'Spellcasting') continue;
    if (action.description && !action.attackType && !action.saveDC && !action.toHit
        && !action.utility && !action.spellAction && !action.areaOfEffect
        && !action.multiattackActions && !action.rangeNormal) {
      actionsNeedingStructure.push(action.name);
    }
  }
  if (actionsNeedingStructure.length > 0) {
    diffs.push({ field: 'structuredActions', expected: 'structured fields (toHit/saveDC/damageDice)', actual: actionsNeedingStructure, severity: 'medium' });
  }

  return diffs;
}

function compareArrayField(expected, actual, fieldName, diffs) {
  const pSet = new Set((expected || []).map(s => s.toLowerCase()));
  const eSet = new Set((actual || []).map(s => s.toLowerCase()));
  const missing = [...pSet].filter(s => !eSet.has(s));
  const extra = [...eSet].filter(s => !pSet.has(s));
  if (missing.length > 0) diffs.push({ field: `${fieldName}.missing`, expected: missing, actual: 'not present', severity: 'medium' });
  if (extra.length > 0) diffs.push({ field: `${fieldName}.extra`, expected: 'not in source', actual: extra, severity: 'low' });
}

function compareActions(parsedActions, existingActions, prefix, diffs) {
  const pNames = (parsedActions || []).map(a => a.name);
  const eNames = (existingActions || []).map(a => a.name);
  const missing = pNames.filter(n => !eNames.includes(n));
  const extra = eNames.filter(n => !pNames.includes(n));

  if (missing.length > 0) diffs.push({ field: `${prefix}.missing`, expected: missing, actual: 'not present', severity: 'high' });
  if (extra.length > 0) diffs.push({ field: `${prefix}.extra`, expected: 'not in source', actual: extra, severity: 'low' });

  // Compare matching actions
  for (const pAction of (parsedActions || [])) {
    const eAction = (existingActions || []).find(a => a.name === pAction.name);
    if (!eAction) continue;

    if (pAction.toHit !== undefined && pAction.toHit !== eAction.toHit) {
      diffs.push({ field: `${prefix}.${pAction.name}.toHit`, expected: pAction.toHit, actual: eAction.toHit, severity: 'high' });
    }
    if (pAction.saveDC !== undefined && pAction.saveDC !== eAction.saveDC) {
      diffs.push({ field: `${prefix}.${pAction.name}.saveDC`, expected: pAction.saveDC, actual: eAction.saveDC, severity: 'high' });
    }
    const normDice = s => (s || '').replace(/\s+/g, '');
    if (pAction.damageDice && normDice(pAction.damageDice) !== normDice(eAction.damageDice)) {
      diffs.push({ field: `${prefix}.${pAction.name}.damageDice`, expected: pAction.damageDice, actual: eAction.damageDice || 'missing', severity: 'high' });
    }
    if (pAction.recharge && pAction.recharge !== eAction.recharge) {
      diffs.push({ field: `${prefix}.${pAction.name}.recharge`, expected: pAction.recharge, actual: eAction.recharge || 'missing', severity: 'medium' });
    }
  }
}

function normalizeHitDice(hd) {
  if (!hd) return '';
  return hd.replace(/\s+/g, '').toLowerCase();
}

// === Main Comparison ===

const report = {
  summary: {},
  missing: [],           // In MM2025 but not in app
  legacy: [],            // In app but not in MM2025
  statMismatches: [],    // Matched but with field differences
  renamed: [],           // Matched via name mapping
  exact: 0,              // Exact matches count
};

const matchedExistingIds = new Set();
const parsedByName = new Map(parsed.map(p => [p.name, p]));

// Compare each parsed entry against existing data
for (const parsedEntry of parsed) {
  const match = findMatch(parsedEntry);

  if (!match) {
    report.missing.push({
      name: parsedEntry.name,
      id: parsedEntry.id,
      cr: parsedEntry.cr,
      type: parsedEntry.type,
      size: parsedEntry.size,
      hp: parsedEntry.hp,
      ac: parsedEntry.ac,
    });
    continue;
  }

  matchedExistingIds.add(match.entry.id);

  if (match.matchType === 'rename') {
    report.renamed.push({
      mm2025Name: parsedEntry.name,
      appName: match.entry.name,
      cr: parsedEntry.cr,
    });
  }

  if (match.matchType === 'exact' || match.matchType === 'case-insensitive' || match.matchType === 'id') {
    report.exact++;
  }

  // Compare fields
  const diffs = compareFields(parsedEntry, match.entry);
  if (diffs.length > 0) {
    const critical = diffs.filter(d => d.severity === 'critical');
    const high = diffs.filter(d => d.severity === 'high');
    const medium = diffs.filter(d => d.severity === 'medium');
    const low = diffs.filter(d => d.severity === 'low');

    report.statMismatches.push({
      name: parsedEntry.name,
      matchedTo: match.entry.name,
      matchType: match.matchType,
      file: getExistingFile(match.entry),
      diffCount: diffs.length,
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
      diffs,
    });
  }
}

// Find legacy entries (in app but not matched to any MM2025 entry)
for (const entry of allExisting) {
  if (!matchedExistingIds.has(entry.id)) {
    report.legacy.push({
      name: entry.name,
      id: entry.id,
      cr: entry.cr,
      file: getExistingFile(entry),
      source: entry.source,
    });
  }
}

// Summary
report.summary = {
  parsedTotal: parsed.length,
  existingTotal: allExisting.length,
  exactMatches: report.exact,
  renamed: report.renamed.length,
  missing: report.missing.length,
  legacy: report.legacy.length,
  withMismatches: report.statMismatches.length,
  totalDiffs: report.statMismatches.reduce((sum, m) => sum + m.diffCount, 0),
  criticalDiffs: report.statMismatches.reduce((sum, m) => sum + m.critical, 0),
  highDiffs: report.statMismatches.reduce((sum, m) => sum + m.high, 0),
  mediumDiffs: report.statMismatches.reduce((sum, m) => sum + m.medium, 0),
  lowDiffs: report.statMismatches.reduce((sum, m) => sum + m.low, 0),
};

// === Output ===

const reportPath = path.join(__dirname, 'mm2025-diff-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('=== MM 2025 COMPARISON REPORT ===\n');
console.log(`Parsed entries:    ${report.summary.parsedTotal}`);
console.log(`Existing entries:  ${report.summary.existingTotal}`);
console.log(`Exact matches:     ${report.summary.exactMatches}`);
console.log(`Renamed matches:   ${report.summary.renamed}`);
console.log(`Missing from app:  ${report.summary.missing}`);
console.log(`Legacy in app:     ${report.summary.legacy}`);
console.log('');
console.log(`Entries with diffs: ${report.summary.withMismatches}`);
console.log(`  Critical: ${report.summary.criticalDiffs}`);
console.log(`  High:     ${report.summary.highDiffs}`);
console.log(`  Medium:   ${report.summary.mediumDiffs}`);
console.log(`  Low:      ${report.summary.lowDiffs}`);

if (report.missing.length > 0) {
  console.log(`\n=== MISSING FROM APP (${report.missing.length}) ===`);
  const byCR = {};
  for (const m of report.missing) {
    if (!byCR[m.cr]) byCR[m.cr] = [];
    byCR[m.cr].push(m.name);
  }
  for (const cr of Object.keys(byCR).sort((a, b) => crToNum(a) - crToNum(b))) {
    console.log(`  CR ${cr}: ${byCR[cr].join(', ')}`);
  }
}

if (report.renamed.length > 0) {
  console.log(`\n=== RENAMED ENTRIES (${report.renamed.length}) ===`);
  for (const r of report.renamed) {
    console.log(`  "${r.appName}" → "${r.mm2025Name}" (CR ${r.cr})`);
  }
}

if (report.legacy.length > 0) {
  console.log(`\n=== LEGACY ENTRIES (${report.legacy.length}) ===`);
  for (const l of report.legacy) {
    console.log(`  ${l.name} (CR ${l.cr}, ${l.file}, source: ${l.source || 'untagged'})`);
  }
}

// Show worst mismatches
const criticalMismatches = report.statMismatches.filter(m => m.critical > 0);
if (criticalMismatches.length > 0) {
  console.log(`\n=== CRITICAL MISMATCHES (${criticalMismatches.length}) ===`);
  for (const m of criticalMismatches.slice(0, 20)) {
    const crits = m.diffs.filter(d => d.severity === 'critical');
    console.log(`  ${m.name}: ${crits.map(c => `${c.field}: ${c.actual} → ${c.expected}`).join(', ')}`);
  }
}

console.log(`\nFull report: ${reportPath}`);

function crToNum(cr) {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}
