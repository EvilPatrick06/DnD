#!/usr/bin/env node
/**
 * MM 2025 Apply Tool
 *
 * Reads the diff report and parsed data, then:
 * 1. Adds all missing entries from parsed MM2025 data
 * 2. Applies stat corrections to matched entries
 * 3. Fixes file placements (moves entries between files)
 * 4. Tags legacy entries with source: 'legacy'
 * 5. Applies group, habitat, and subtype metadata
 *
 * Usage: node scripts/mm2025-apply.js [--dry-run]
 *
 * WARNING: This modifies monsters.json, creatures.json, and npcs.json in place.
 * Back up your data before running.
 */

const fs = require('fs');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');
const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

// Load data
const parsedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'mm2025-parsed.json'), 'utf8'));
const diffReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'mm2025-diff-report.json'), 'utf8'));

let monsters = JSON.parse(fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8'));
let creatures = JSON.parse(fs.readFileSync(path.join(dataDir, 'creatures.json'), 'utf8'));
let npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));

// CR to XP/PB
const CR_TO_XP = {
  '0': 0, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
};
const CR_TO_PB = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2, '1': 2, '2': 2, '3': 2, '4': 2,
  '5': 3, '6': 3, '7': 3, '8': 3, '9': 4, '10': 4, '11': 4, '12': 4,
  '13': 5, '14': 5, '15': 5, '16': 5, '17': 6, '18': 6, '19': 6, '20': 6,
  '21': 7, '22': 7, '23': 7, '24': 7, '25': 8, '26': 8, '27': 8, '28': 8,
  '29': 9, '30': 9
};
const SIZE_TO_TOKEN = {
  'Tiny': { x: 1, y: 1 }, 'Small': { x: 1, y: 1 }, 'Medium': { x: 1, y: 1 },
  'Large': { x: 2, y: 2 }, 'Huge': { x: 3, y: 3 }, 'Gargantuan': { x: 4, y: 4 }
};

// NPC entries (belong in npcs.json)
const NPC_NAMES = new Set([
  'Assassin', 'Bandit', 'Bandit Captain', 'Bandit Deceiver', 'Bandit Crime Lord',
  'Berserker', 'Berserker Commander', 'Commoner',
  'Cultist', 'Cultist Fanatic', 'Aberrant Cultist', 'Death Cultist',
  'Elemental Cultist', 'Fiend Cultist', 'Cultist Hierophant',
  'Druid', 'Gladiator',
  'Guard', 'Guard Captain',
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

const BEAST_NAMES = new Set([
  'Allosaurus', 'Ankylosaurus', 'Ape', 'Archelon', 'Axe Beak',
  'Baboon', 'Badger', 'Bat', 'Black Bear', 'Blood Hawk', 'Boar', 'Brown Bear',
  'Camel', 'Cat', 'Constrictor Snake', 'Crab', 'Crocodile',
  'Deer', 'Dire Wolf', 'Draft Horse', 'Eagle', 'Elephant', 'Elk',
  'Flying Snake', 'Frog',
  'Giant Ape', 'Giant Axe Beak', 'Giant Badger', 'Giant Bat', 'Giant Boar',
  'Giant Centipede', 'Giant Constrictor Snake', 'Giant Crab', 'Giant Crocodile',
  'Giant Eagle', 'Giant Elk', 'Giant Frog', 'Giant Goat', 'Giant Hyena',
  'Giant Lizard', 'Giant Octopus', 'Giant Owl', 'Giant Rat', 'Giant Scorpion',
  'Giant Seahorse', 'Giant Shark', 'Giant Spider', 'Giant Squid',
  'Giant Toad', 'Giant Venomous Snake', 'Giant Vulture', 'Giant Wasp',
  'Giant Weasel', 'Giant Wolf Spider', 'Goat', 'Hawk', 'Hippopotamus',
  'Hunter Shark', 'Hyena', 'Jackal', 'Killer Whale', 'Lion', 'Lizard',
  'Mammoth', 'Mastiff', 'Mule', 'Octopus', 'Owl', 'Panther', 'Piranha',
  'Plesiosaurus', 'Polar Bear', 'Pony', 'Pteranodon', 'Rat', 'Raven',
  'Reef Shark', 'Rhinoceros', 'Riding Horse', 'Saber-Toothed Tiger',
  'Scorpion', 'Seahorse', 'Spider', 'Swarm of Bats', 'Swarm of Insects',
  'Swarm of Piranhas', 'Swarm of Rats', 'Swarm of Ravens',
  'Swarm of Stirges', 'Swarm of Venomous Snakes',
  'Tiger', 'Triceratops', 'Tyrannosaurus Rex', 'Venomous Snake', 'Vulture',
  'Warhorse', 'Warhorse Skeleton', 'Weasel', 'Wolf',
]);

function getTargetFile(name) {
  if (NPC_NAMES.has(name)) return 'npcs';
  if (BEAST_NAMES.has(name)) return 'creatures';
  return 'monsters';
}

// Group assignments
const GROUP_MAP = {
  // Aberrations
  'Aboleth': 'Aboleths', 'Chuul': 'Aberrations', 'Cloaker': 'Aberrations',
  'Flumph': 'Aberrations', 'Gibbering Mouther': 'Aberrations',
  'Grell': 'Aberrations', 'Nothic': 'Aberrations', 'Otyugh': 'Aberrations',
  // Beholders
  'Beholder': 'Beholders', 'Beholder Zombie': 'Beholders',
  'Death Tyrant': 'Beholders', 'Spectator': 'Beholders',
  // Constructs
  'Animated Armor': 'Animated Objects', 'Animated Broom': 'Animated Objects',
  'Animated Flying Sword': 'Animated Objects', 'Animated Rug of Smothering': 'Animated Objects',
  'Colossus': 'Constructs', 'Helmed Horror': 'Constructs',
  'Homunculus': 'Constructs', 'Scarecrow': 'Constructs', 'Shield Guardian': 'Constructs',
  'Modron Monodrone': 'Modrons', 'Modron Duodrone': 'Modrons',
  'Modron Tridrone': 'Modrons', 'Modron Quadrone': 'Modrons', 'Modron Pentadrone': 'Modrons',
  // Dragons
  'Dracolich': 'Dragons', 'Dragon Turtle': 'Dragons',
  'Faerie Dragon Youth': 'Faerie Dragons', 'Faerie Dragon Adult': 'Faerie Dragons',
  'Half-Dragon': 'Dragons', 'Pseudodragon': 'Dragons',
  'Shadow Dragon': 'Shadow Dragons', 'Juvenile Shadow Dragon': 'Shadow Dragons',
  // Elementals
  'Air Elemental': 'Elementals', 'Earth Elemental': 'Elementals',
  'Fire Elemental': 'Elementals', 'Water Elemental': 'Elementals',
  'Elemental Cataclysm': 'Elementals',
  'Azer Sentinel': 'Azers', 'Azer Pyromancer': 'Azers',
  'Galeb Duhr': 'Elementals', 'Gargoyle': 'Elementals',
  'Invisible Stalker': 'Elementals', 'Magmin': 'Elementals',
  'Salamander': 'Salamanders', 'Salamander Fire Snake': 'Salamanders',
  'Salamander Inferno Master': 'Salamanders',
  'Water Weird': 'Elementals', 'Xorn': 'Elementals',
  // Fey
  'Blink Dog': 'Fey', 'Dryad': 'Fey',
  'Centaur Trooper': 'Centaurs', 'Centaur Warden': 'Centaurs',
  'Pixie': 'Pixies', 'Pixie Wonderbringer': 'Pixies',
  'Satyr': 'Satyrs', 'Satyr Revelmaster': 'Satyrs', 'Sprite': 'Fey',
  // Giants
  'Cloud Giant': 'Giants', 'Fire Giant': 'Giants', 'Frost Giant': 'Giants',
  'Hill Giant': 'Giants', 'Stone Giant': 'Giants', 'Storm Giant': 'Giants',
  'Cyclops Sentry': 'Cyclopes', 'Cyclops Oracle': 'Cyclopes',
  'Ettin': 'Giants', 'Fomorian': 'Giants',
  'Ogre': 'Ogres', 'Ogre Zombie': 'Ogres', 'Ogrillon Ogre': 'Ogres',
  'Oni': 'Giants', 'Troll': 'Trolls', 'Troll Limb': 'Trolls',
  // Gith
  'Githyanki Warrior': 'Githyanki', 'Githyanki Knight': 'Githyanki', 'Githyanki Dracomancer': 'Githyanki',
  'Githzerai Monk': 'Githzerai', 'Githzerai Zerth': 'Githzerai', 'Githzerai Psion': 'Githzerai',
  // Golems
  'Clay Golem': 'Golems', 'Flesh Golem': 'Golems',
  'Iron Golem': 'Golems', 'Stone Golem': 'Golems',
  // Hags
  'Arch-Hag': 'Hags', 'Green Hag': 'Hags', 'Night Hag': 'Hags', 'Sea Hag': 'Hags',
  // Lycanthropes
  'Werebear': 'Lycanthropes', 'Wereboar': 'Lycanthropes',
  'Weretiger': 'Lycanthropes', 'Werewolf': 'Lycanthropes', 'Wererat': 'Lycanthropes',
  // Mind Flayers
  'Intellect Devourer': 'Mind Flayers', 'Mind Flayer': 'Mind Flayers',
  'Mind Flayer Arcanist': 'Mind Flayers',
  // Slaadi
  'Slaad Tadpole': 'Slaadi', 'Red Slaad': 'Slaadi', 'Blue Slaad': 'Slaadi',
  'Green Slaad': 'Slaadi', 'Gray Slaad': 'Slaadi', 'Death Slaad': 'Slaadi',
  // Sphinxes
  'Sphinx of Wonder': 'Sphinxes', 'Sphinx of Secrets': 'Sphinxes',
  'Sphinx of Lore': 'Sphinxes', 'Sphinx of Valor': 'Sphinxes',
  // Yugoloths
  'Arcanaloth': 'Yugoloths', 'Mezzoloth': 'Yugoloths',
  'Nycaloth': 'Yugoloths', 'Ultroloth': 'Yugoloths',
  // Mephits
  'Dust Mephit': 'Mephits', 'Ice Mephit': 'Mephits', 'Magma Mephit': 'Mephits',
  'Mud Mephit': 'Mephits', 'Smoke Mephit': 'Mephits', 'Steam Mephit': 'Mephits',
  // Undead families
  'Ghoul': 'Ghouls', 'Lacedon Ghoul': 'Ghouls', 'Ghast': 'Ghouls', 'Ghast Gravecaller': 'Ghouls',
  'Vampire': 'Vampires', 'Vampire Spawn': 'Vampires', 'Vampire Familiar': 'Vampires',
  'Vampire Nightbringer': 'Vampires', 'Vampire Umbral Lord': 'Vampires',
  'Revenant': 'Revenants', 'Graveyard Revenant': 'Revenants', 'Haunting Revenant': 'Revenants',
  'Skeleton': 'Skeletons', 'Warhorse Skeleton': 'Skeletons', 'Minotaur Skeleton': 'Skeletons',
  'Flaming Skeleton': 'Skeletons', 'Death Knight': 'Death Knights',
  'Death Knight Aspirant': 'Death Knights',
  'Mummy': 'Mummies', 'Mummy Lord': 'Mummies',
  'Zombie': 'Zombies',
  // Demons
  'Balor': 'Demons', 'Barlgura': 'Demons', 'Chasme': 'Demons',
  'Dretch': 'Demons', 'Swarm of Dretches': 'Demons',
  'Glabrezu': 'Demons', 'Goristro': 'Demons', 'Hezrou': 'Demons',
  'Manes': 'Demons', 'Manes Vaporspawn': 'Demons',
  'Marilith': 'Demons', 'Nalfeshnee': 'Demons', 'Quasit': 'Demons',
  'Shadow Demon': 'Demons', 'Vrock': 'Demons', 'Yochlol': 'Demons',
  // Devils
  'Barbed Devil': 'Devils', 'Bearded Devil': 'Devils', 'Bone Devil': 'Devils',
  'Chain Devil': 'Devils', 'Erinyes': 'Devils', 'Horned Devil': 'Devils',
  'Ice Devil': 'Devils', 'Imp': 'Devils', 'Lemure': 'Devils',
  'Swarm of Lemures': 'Devils', 'Pit Fiend': 'Devils', 'Spined Devil': 'Devils',
  // Fiends
  'Cambion': 'Fiends', 'Hell Hound': 'Fiends', 'Incubus': 'Fiends',
  'Succubus': 'Fiends', 'Jackalwere': 'Fiends', 'Larva': 'Fiends',
  'Swarm of Larvae': 'Fiends', 'Nightmare': 'Fiends', 'Rakshasa': 'Fiends',
  // Genies
  'Dao': 'Genies', 'Djinni': 'Genies', 'Efreeti': 'Genies', 'Marid': 'Genies',
};

// Build dynamic dragon group assignments
for (const color of ['Black', 'Blue', 'Green', 'Red', 'White']) {
  for (const age of ['Wyrmling', 'Young', 'Adult', 'Ancient']) {
    GROUP_MAP[`${color} Dragon ${age}`] = `${color} Dragons`;
    GROUP_MAP[`${age} ${color} Dragon`] = `${color} Dragons`;
  }
}
for (const metal of ['Brass', 'Bronze', 'Copper', 'Gold', 'Silver']) {
  for (const age of ['Wyrmling', 'Young', 'Adult', 'Ancient']) {
    GROUP_MAP[`${metal} Dragon ${age}`] = `${metal} Dragons`;
    GROUP_MAP[`${age} ${metal} Dragon`] = `${metal} Dragons`;
  }
}

// Subtype assignments
const SUBTYPE_MAP = {
  'Goblin Minion': 'Goblinoid', 'Goblin Warrior': 'Goblinoid',
  'Goblin Boss': 'Goblinoid', 'Goblin Hexer': 'Goblinoid',
  'Bugbear Warrior': 'Goblinoid', 'Bugbear Stalker': 'Goblinoid',
  'Hobgoblin Warrior': 'Goblinoid', 'Hobgoblin Captain': 'Goblinoid',
  'Hobgoblin Warlord': 'Goblinoid',
  'Jackalwere': 'Shapechanger', 'Wererat': 'Shapechanger',
  'Werewolf': 'Shapechanger', 'Werebear': 'Shapechanger',
  'Wereboar': 'Shapechanger', 'Weretiger': 'Shapechanger',
  'Doppelganger': 'Shapechanger', 'Mimic': 'Shapechanger',
  'Vampire': 'Shapechanger', 'Vampire Spawn': 'Shapechanger',
};

// Known name mappings (old → new)
const RENAME_MAP = {
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
  'Lizardfolk': 'Lizardfolk Geomancer',
  'Gnoll': 'Gnoll Warrior',
  'Thri-kreen': 'Thri-kreen Marauder',
  'Yuan-ti Pureblood': 'Yuan-ti Infiltrator',
  'Githyanki Soldier': 'Githyanki Warrior',
  'Acolyte': 'Priest Acolyte',
  'Veteran': 'Warrior Veteran',
  'Gas Spore': 'Gas Spore Fungus',
};

const REVERSE_RENAME = {};
for (const [old, newName] of Object.entries(RENAME_MAP)) {
  REVERSE_RENAME[newName] = old;
}

function nameToId(name) {
  return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function crToNumber(cr) {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

// Build existing ID set
const existingIds = new Set([...monsters, ...creatures, ...npcs].map(e => e.id));

// Prepare a parsed data lookup
const parsedByName = new Map(parsedData.map(p => [p.name, p]));
const parsedById = new Map(parsedData.map(p => [p.id, p]));

let stats = { added: 0, updated: 0, renamed: 0, moved: 0, legacyTagged: 0, errors: [] };

// === Step 1: Add missing entries ===
console.log('=== STEP 1: Adding missing entries ===');
for (const missing of diffReport.missing) {
  // Look up full parsed data by name or ID
  const parsed = parsedByName.get(missing.name) || parsedById.get(missing.id);
  if (!parsed) {
    stats.errors.push(`No parsed data for missing entry: ${missing.name}`);
    continue;
  }

  // Create clean entry (deep copy)
  const entry = JSON.parse(JSON.stringify(parsed));

  // Ensure required fields
  if (!entry.id) entry.id = nameToId(entry.name);
  if (!entry.tokenSize) entry.tokenSize = SIZE_TO_TOKEN[entry.size] || { x: 1, y: 1 };
  if (!entry.source) entry.source = 'mm2025';
  if (entry.xp === undefined) entry.xp = CR_TO_XP[entry.cr] || 0;
  if (entry.proficiencyBonus === undefined) entry.proficiencyBonus = CR_TO_PB[entry.cr] || 2;
  if (!entry.languages) entry.languages = [];
  if (!entry.actions) entry.actions = [];
  if (!entry.senses) entry.senses = { passivePerception: 10 };

  // Apply group
  if (GROUP_MAP[entry.name]) entry.group = GROUP_MAP[entry.name];

  // Apply subtype
  if (SUBTYPE_MAP[entry.name]) entry.subtype = SUBTYPE_MAP[entry.name];

  // Handle duplicate IDs
  if (existingIds.has(entry.id)) {
    // Disambiguate
    let suffix = 2;
    while (existingIds.has(`${entry.id}-${suffix}`)) suffix++;
    entry.id = `${entry.id}-${suffix}`;
  }
  existingIds.add(entry.id);

  // Route to correct file
  const target = getTargetFile(entry.name);
  if (target === 'npcs') { npcs.push(entry); }
  else if (target === 'creatures') { creatures.push(entry); }
  else { monsters.push(entry); }

  console.log(`  Added: ${entry.name} (CR ${entry.cr}) -> ${target}.json`);
  stats.added++;
}

// === Step 2: Update matched entries with stat corrections ===
console.log('\n=== STEP 2: Applying stat corrections ===');

function findInFile(id, file) {
  if (file === 'monsters') return monsters.find(m => m.id === id);
  if (file === 'creatures') return creatures.find(m => m.id === id);
  if (file === 'npcs') return npcs.find(m => m.id === id);
  return null;
}

function findEntry(id) {
  return monsters.find(m => m.id === id) ||
         creatures.find(m => m.id === id) ||
         npcs.find(m => m.id === id);
}

for (const mismatch of diffReport.statMismatches) {
  // Find existing entry by matchedTo name (the existing name in our data)
  const existingName = mismatch.matchedTo || mismatch.name;
  const existing = [...monsters, ...creatures, ...npcs].find(e => e.name === existingName);
  if (!existing) {
    stats.errors.push(`Entry not found for update: ${existingName}`);
    continue;
  }

  // Find the MM2025 parsed data by the MM2025 name
  let parsed = parsedByName.get(mismatch.name);
  if (!parsed) {
    parsed = parsedById.get(nameToId(mismatch.name));
  }
  if (!parsed) continue;

  let changed = false;

  // Apply core stat corrections
  for (const diff of mismatch.diffs) {
    switch (diff.severity) {
      case 'critical':
      case 'high':
      case 'medium':
        if (applyDiff(existing, parsed, diff)) changed = true;
        break;
      case 'low':
        // Apply low severity too - names, alignment, source
        if (diff.field === 'source') {
          existing.source = 'mm2025';
          changed = true;
        }
        break;
    }
  }

  // Apply group and subtype if not set
  if (!existing.group && GROUP_MAP[existing.name]) {
    existing.group = GROUP_MAP[existing.name];
    changed = true;
  }
  if (!existing.subtype && SUBTYPE_MAP[existing.name]) {
    existing.subtype = SUBTYPE_MAP[existing.name];
    changed = true;
  }
  if (!existing.subtype && parsed.subtype) {
    existing.subtype = parsed.subtype;
    changed = true;
  }

  // Ensure source tag
  if (existing.source !== 'mm2025') {
    existing.source = 'mm2025';
    changed = true;
  }

  if (changed) {
    stats.updated++;
    if (stats.updated <= 20) {
      const critCount = mismatch.diffs.filter(d => d.severity === 'critical').length;
      const highCount = mismatch.diffs.filter(d => d.severity === 'high').length;
      console.log(`  Updated: ${existing.name} (${critCount} critical, ${highCount} high)`);
    }
  }
}
if (stats.updated > 20) console.log(`  ... and ${stats.updated - 20} more`);

function applyDiff(existing, parsed, diff) {
  const field = diff.field;

  // Simple field updates
  if (['ac', 'hp', 'cr', 'hitDice', 'size', 'type', 'alignment', 'xp', 'proficiencyBonus'].includes(field)) {
    if (existing[field] !== parsed[field]) {
      existing[field] = parsed[field];
      // Fix XP/PB when CR changes
      if (field === 'cr') {
        existing.xp = CR_TO_XP[parsed.cr] || existing.xp;
        existing.proficiencyBonus = CR_TO_PB[parsed.cr] || existing.proficiencyBonus;
      }
      // Fix tokenSize when size changes
      if (field === 'size') {
        existing.tokenSize = SIZE_TO_TOKEN[parsed.size] || existing.tokenSize;
      }
      return true;
    }
    return false;
  }

  // Ability scores
  if (field.startsWith('abilityScores.')) {
    const ability = field.split('.')[1];
    if (existing.abilityScores[ability] !== parsed.abilityScores[ability]) {
      existing.abilityScores[ability] = parsed.abilityScores[ability];
      return true;
    }
    return false;
  }

  // Saving throws
  if (field.startsWith('savingThrows.')) {
    const ability = field.split('.')[1];
    if (!existing.savingThrows) existing.savingThrows = {};
    if (parsed.savingThrows && parsed.savingThrows[ability] !== undefined) {
      existing.savingThrows[ability] = parsed.savingThrows[ability];
    } else {
      delete existing.savingThrows[ability];
    }
    if (Object.keys(existing.savingThrows).length === 0) delete existing.savingThrows;
    return true;
  }

  // Speed
  if (field.startsWith('speed.')) {
    const mode = field.split('.')[1];
    if (mode === 'hover') {
      if (parsed.speed.hover) existing.speed.hover = true;
      else delete existing.speed.hover;
    } else {
      if (parsed.speed[mode]) existing.speed[mode] = parsed.speed[mode];
      else delete existing.speed[mode];
    }
    return true;
  }

  // Senses
  if (field.startsWith('senses.')) {
    const sense = field.split('.')[1];
    if (!existing.senses) existing.senses = {};
    if (parsed.senses && parsed.senses[sense] !== undefined) {
      existing.senses[sense] = parsed.senses[sense];
    }
    return true;
  }

  // Initiative
  if (field === 'initiative' || field.startsWith('initiative.')) {
    if (parsed.initiative) {
      existing.initiative = parsed.initiative;
      return true;
    }
    return false;
  }

  // Resistances/Immunities/Vulnerabilities
  if (['resistances', 'vulnerabilities', 'damageImmunities', 'conditionImmunities'].includes(field)) {
    if (parsed[field] && parsed[field].length > 0) {
      existing[field] = parsed[field];
    } else {
      delete existing[field];
    }
    return true;
  }

  // Actions - replace entire action list from parsed
  if (field === 'actions.missing' || field.startsWith('actions.')) {
    existing.actions = parsed.actions;
    return true;
  }

  // Traits
  if (field === 'traits.missing') {
    existing.traits = parsed.traits;
    return true;
  }

  // Bonus actions
  if (field === 'bonusActions.missing') {
    existing.bonusActions = parsed.bonusActions;
    return true;
  }

  // Reactions
  if (field === 'reactions.missing') {
    existing.reactions = parsed.reactions;
    return true;
  }

  // Legendary actions
  if (field === 'legendaryActions' || field.startsWith('legendaryActions.')) {
    if (parsed.legendaryActions) {
      existing.legendaryActions = parsed.legendaryActions;
    }
    return true;
  }

  // Spellcasting
  if (field === 'spellcasting' || field.startsWith('spellcasting.')) {
    if (parsed.spellcasting) {
      existing.spellcasting = parsed.spellcasting;
    }
    return true;
  }

  return false;
}

// === Step 3: Handle renames ===
console.log('\n=== STEP 3: Applying renames ===');
for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
  const entry = [...monsters, ...creatures, ...npcs].find(e => e.name === oldName);
  if (entry) {
    const oldId = entry.id;
    entry.name = newName;
    entry.id = nameToId(newName);
    console.log(`  Renamed: ${oldName} -> ${newName} (${oldId} -> ${entry.id})`);
    stats.renamed++;
  }
}

// === Step 4: Fix file placements ===
console.log('\n=== STEP 4: Fixing file placements ===');
// Check every entry is in the correct file based on NPC_NAMES/BEAST_NAMES
const fileSets = [
  { name: 'monsters', arr: monsters },
  { name: 'creatures', arr: creatures },
  { name: 'npcs', arr: npcs }
];
for (const { name: fromFile, arr: fromArray } of fileSets) {
  for (let i = fromArray.length - 1; i >= 0; i--) {
    const entry = fromArray[i];
    const targetFile = getTargetFile(entry.name);
    if (targetFile !== fromFile) {
      const toArray = targetFile === 'monsters' ? monsters : targetFile === 'creatures' ? creatures : npcs;
      fromArray.splice(i, 1);
      toArray.push(entry);
      console.log(`  Moved: ${entry.name} from ${fromFile}.json to ${targetFile}.json`);
      stats.moved++;
    }
  }
}

// === Step 5: Tag legacy entries ===
console.log('\n=== STEP 5: Tagging legacy entries ===');
for (const legacy of diffReport.legacy) {
  const entry = findEntry(legacy.id);
  if (entry && entry.source !== 'legacy') {
    entry.source = 'legacy';
    console.log(`  Tagged legacy: ${entry.name}`);
    stats.legacyTagged++;
  }
}

// === Step 6: Sort all files by CR then name ===
function sortByCrName(arr) {
  return arr.sort((a, b) => {
    const crA = crToNumber(a.cr);
    const crB = crToNumber(b.cr);
    if (crA !== crB) return crA - crB;
    return a.name.localeCompare(b.name);
  });
}

monsters = sortByCrName(monsters);
creatures = sortByCrName(creatures);
npcs = sortByCrName(npcs);

// === Write output ===
if (!dryRun) {
  fs.writeFileSync(path.join(dataDir, 'monsters.json'), JSON.stringify(monsters, null, 2));
  fs.writeFileSync(path.join(dataDir, 'creatures.json'), JSON.stringify(creatures, null, 2));
  fs.writeFileSync(path.join(dataDir, 'npcs.json'), JSON.stringify(npcs, null, 2));
  console.log('\nFiles written successfully.');
} else {
  console.log('\n[DRY RUN] No files written.');
}

// === Summary ===
console.log('\n=== SUMMARY ===');
console.log(`Added: ${stats.added}`);
console.log(`Updated: ${stats.updated}`);
console.log(`Renamed: ${stats.renamed}`);
console.log(`Moved: ${stats.moved}`);
console.log(`Legacy tagged: ${stats.legacyTagged}`);
console.log(`Errors: ${stats.errors.length}`);
if (stats.errors.length > 0) {
  for (const err of stats.errors) console.log(`  ${err}`);
}
console.log(`\nFinal counts: monsters=${monsters.length}, creatures=${creatures.length}, npcs=${npcs.length}`);
console.log(`Total: ${monsters.length + creatures.length + npcs.length}`);
