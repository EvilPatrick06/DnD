#!/usr/bin/env node
/**
 * MM 2025 Merge Script
 *
 * Merges extracted stat blocks from agent outputs into the data files.
 * Run after extracting stat blocks from all Bestiary PDFs.
 *
 * Usage: node scripts/mm2025-merge.js <input-json-file> <target: monsters|creatures|npcs>
 *
 * The input JSON file should be an array of MonsterStatBlock objects.
 * For each entry:
 *   - If an entry with the same ID already exists, UPDATE it with MM 2025 data
 *   - If no entry exists, ADD it
 *   - Preserves source tagging
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

// CR → XP mapping
const CR_TO_XP = {
  '0': 0, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
};

// CR → Prof Bonus
const CR_TO_PROF = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2,
  '1': 2, '2': 2, '3': 2, '4': 2, '5': 3, '6': 3, '7': 3, '8': 3,
  '9': 4, '10': 4, '11': 4, '12': 4, '13': 5, '14': 5, '15': 5, '16': 5,
  '17': 6, '18': 6, '19': 6, '20': 6, '21': 7, '22': 7, '23': 7, '24': 7,
  '25': 8, '26': 8, '27': 8, '28': 8, '29': 9, '30': 9
};

function crToNum(cr) {
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr);
}

function validateEntry(entry) {
  const errors = [];
  if (!entry.id) errors.push('missing id');
  if (!entry.name) errors.push('missing name');
  if (!entry.size) errors.push('missing size');
  if (!entry.type) errors.push('missing type');
  if (entry.ac === undefined) errors.push('missing ac');
  if (entry.hp === undefined) errors.push('missing hp');
  if (!entry.hitDice) errors.push('missing hitDice');
  if (!entry.speed) errors.push('missing speed');
  if (!entry.abilityScores) errors.push('missing abilityScores');
  if (!entry.cr) errors.push('missing cr');
  if (!entry.actions || entry.actions.length === 0) errors.push('missing/empty actions');
  if (!entry.senses) errors.push('missing senses');
  if (!entry.tokenSize) errors.push('missing tokenSize');
  return errors;
}

function fixEntry(entry) {
  // Ensure required fields
  entry.source = entry.source || 'mm2025';

  // Fix XP if missing or wrong
  if (entry.cr && CR_TO_XP[entry.cr] !== undefined) {
    entry.xp = CR_TO_XP[entry.cr];
  }

  // Fix proficiency bonus
  if (entry.cr && CR_TO_PROF[entry.cr] !== undefined) {
    entry.proficiencyBonus = CR_TO_PROF[entry.cr];
  }

  // Ensure tokenSize
  if (!entry.tokenSize) {
    const sizeMap = {
      'Tiny': { x: 1, y: 1 },
      'Small': { x: 1, y: 1 },
      'Medium': { x: 1, y: 1 },
      'Large': { x: 2, y: 2 },
      'Huge': { x: 3, y: 3 },
      'Gargantuan': { x: 4, y: 4 },
    };
    entry.tokenSize = sizeMap[entry.size] || { x: 1, y: 1 };
  }

  // Ensure arrays are arrays
  if (!entry.languages) entry.languages = [];
  if (!entry.actions) entry.actions = [];
  if (!entry.senses) entry.senses = { passivePerception: 10 };
  if (entry.senses.passivePerception === undefined) entry.senses.passivePerception = 10;

  // Ensure initiative
  if (!entry.initiative && entry.abilityScores) {
    const dexMod = Math.floor((entry.abilityScores.dex - 10) / 2);
    entry.initiative = { modifier: dexMod, score: 10 + dexMod };
  }

  // Clean up undefined/null optional fields
  const optionalArrays = ['resistances', 'vulnerabilities', 'damageImmunities', 'conditionImmunities', 'habitat', 'gear', 'tags'];
  for (const field of optionalArrays) {
    if (entry[field] && entry[field].length === 0) delete entry[field];
  }
  const optionalObjects = ['savingThrows', 'skills', 'spellcasting', 'legendaryActions', 'lairActions', 'regionalEffects'];
  for (const field of optionalObjects) {
    if (entry[field] === null || entry[field] === undefined) delete entry[field];
  }
  const optionalActions = ['bonusActions', 'reactions'];
  for (const field of optionalActions) {
    if (entry[field] && entry[field].length === 0) delete entry[field];
  }

  return entry;
}

function mergeIntoFile(inputEntries, targetFile) {
  const fp = path.join(dataDir, targetFile);
  let existing = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const existingById = new Map(existing.map(e => [e.id, e]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let entry of inputEntries) {
    entry = fixEntry(entry);

    const errors = validateEntry(entry);
    if (errors.length > 0) {
      console.log(`  WARN: ${entry.name || entry.id}: ${errors.join(', ')}`);
    }

    if (existingById.has(entry.id)) {
      // Update existing entry with MM 2025 data
      const existingEntry = existingById.get(entry.id);

      // Merge: prefer new data for all fields
      for (const [key, value] of Object.entries(entry)) {
        if (value !== undefined && value !== null) {
          existingEntry[key] = value;
        }
      }
      existingEntry.source = 'mm2025';
      updated++;
    } else {
      // Add new entry
      existing.push(entry);
      existingById.set(entry.id, entry);
      added++;
    }
  }

  // Sort by CR then name
  existing.sort((a, b) => {
    const crDiff = crToNum(a.cr) - crToNum(b.cr);
    if (crDiff !== 0) return crDiff;
    return a.name.localeCompare(b.name);
  });

  fs.writeFileSync(fp, JSON.stringify(existing, null, 2) + '\n');
  console.log(`  ${targetFile}: ${added} added, ${updated} updated, ${existing.length} total`);
  return { added, updated, total: existing.length };
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/mm2025-merge.js <input.json> <monsters|creatures|npcs>');
  console.log('  Or: node scripts/mm2025-merge.js --auto <input.json>');
  console.log('  --auto mode routes entries to correct file based on type');
  process.exit(1);
}

if (args[0] === '--auto') {
  const inputFile = args[1];
  const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${inputData.length} entries from ${inputFile}`);

  // NPC names that go in npcs.json
  const NPC_NAMES = new Set([
    'Acolyte', 'Assassin', 'Bandit', 'Bandit Captain', 'Bandit Deceiver', 'Bandit Crime Lord',
    'Berserker', 'Berserker Commander', 'Commoner',
    'Cultist', 'Cultist Fanatic', 'Aberrant Cultist', 'Death Cultist',
    'Elemental Cultist', 'Fiend Cultist', 'Cultist Hierophant',
    'Druid', 'Gladiator', 'Guard', 'Guard Captain',
    'Knight', 'Questing Knight',
    'Mage Apprentice', 'Mage', 'Archmage',
    'Noble', 'Noble Prodigy',
    'Performer', 'Performer Maestro', 'Performer Legend',
    'Pirate', 'Pirate Captain', 'Pirate Admiral',
    'Priest Acolyte', 'Priest', 'Archpriest',
    'Scout', 'Scout Captain', 'Spy', 'Spy Master',
    'Tough', 'Tough Boss',
    'Warrior Infantry', 'Warrior Veteran', 'Warrior Commander',
  ]);

  // Beast entries that go in creatures.json
  const BEAST_TYPES = new Set(['Beast']);

  const monstersToMerge = [];
  const creaturesToMerge = [];
  const npcsToMerge = [];

  for (const entry of inputData) {
    if (NPC_NAMES.has(entry.name)) {
      npcsToMerge.push(entry);
    } else if (BEAST_TYPES.has(entry.type) || entry.tags?.includes('beast') || entry.tags?.includes('animal')) {
      creaturesToMerge.push(entry);
    } else {
      monstersToMerge.push(entry);
    }
  }

  console.log(`Routing: ${monstersToMerge.length} monsters, ${creaturesToMerge.length} creatures, ${npcsToMerge.length} npcs`);

  if (monstersToMerge.length > 0) mergeIntoFile(monstersToMerge, 'monsters.json');
  if (creaturesToMerge.length > 0) mergeIntoFile(creaturesToMerge, 'creatures.json');
  if (npcsToMerge.length > 0) mergeIntoFile(npcsToMerge, 'npcs.json');

} else {
  const inputFile = args[0];
  const target = args[1] + '.json';
  const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${inputData.length} entries from ${inputFile}`);
  mergeIntoFile(inputData, target);
}

console.log('Done!');
