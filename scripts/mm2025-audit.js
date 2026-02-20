#!/usr/bin/env node
/**
 * MM 2025 Comprehensive Audit Script
 *
 * Compares the complete Monster Manual 2025 "Creatures by CR" master list
 * against the app's three data files (monsters.json, creatures.json, npcs.json)
 * and produces a structured gap report.
 *
 * Usage: node scripts/mm2025-audit.js
 * Output: scripts/mm2025-gap-report.json + console summary
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// COMPLETE MM 2025 "Creatures by CR" Master List
// Source: Monster Manual 2025, Appendix B, pp. 382-384
// ============================================================

const MM2025_MASTER_LIST = {
  '0': [
    'Awakened Shrub', 'Baboon', 'Badger', 'Bat', 'Cat', 'Commoner',
    'Crab', 'Crawling Claw', 'Deer', 'Eagle', 'Frog', 'Giant Fire Beetle',
    'Goat', 'Hawk', 'Homunculus', 'Hyena', 'Jackal', 'Larva', 'Lemure',
    'Lizard', 'Myconid Sprout', 'Octopus', 'Owl', 'Piranha', 'Rat',
    'Raven', 'Scorpion', 'Seahorse', 'Shrieker Fungus', 'Spider',
    'Vulture', 'Weasel', 'Mastiff', 'Merfolk Skirmisher',
    'Modron Monodrone', 'Mule', 'Noble', 'Pony', 'Slaad Tadpole',
    'Stirge', 'Twig Blight', 'Venomous Snake', 'Warrior Infantry',
    'Wolf', 'Zombie'
  ],
  '1/8': [
    'Bandit', 'Blood Hawk', 'Camel', 'Cultist', 'Flumph', 'Flying Snake',
    'Giant Crab', 'Giant Rat', 'Giant Weasel', 'Goblin Minion', 'Guard',
    'Kobold Warrior', 'Manes', 'Steam Mephit', 'Swarm of Bats',
    'Swarm of Rats', 'Swarm of Ravens', 'Troglodyte', 'Violet Fungus',
    'Winged Kobold'
  ],
  '1/4': [
    'Aarakocra Skirmisher', 'Animated Broom', 'Animated Flying Sword',
    'Axe Beak', 'Blink Dog', 'Boar', 'Bullywug Warrior',
    'Constrictor Snake', 'Draft Horse', 'Dretch', 'Elk', 'Giant Badger',
    'Giant Bat', 'Giant Centipede', 'Giant Frog', 'Giant Lizard',
    'Giant Owl', 'Giant Venomous Snake', 'Giant Wolf Spider',
    'Goblin Warrior', 'Grimlock', 'Kenku', 'Kuo-toa',
    'Modron Duodrone', 'Mud Mephit', 'Needle Blight', 'Panther', 'Pixie',
    'Priest Acolyte', 'Pseudodragon', 'Pteranodon', 'Riding Horse',
    'Skeleton', 'Smoke Mephit', 'Sprite'
  ],
  '1/2': [
    'Ape', 'Black Bear', 'Cockatrice', 'Crocodile', 'Darkmantle',
    'Dust Mephit', 'Gas Spore Fungus', 'Giant Goat', 'Giant Seahorse',
    'Giant Wasp', 'Gnoll Warrior', 'Gray Ooze', 'Hobgoblin Warrior',
    'Ice Mephit', 'Jackalwere', 'Magma Mephit', 'Magmin',
    'Modron Tridrone', 'Myconid Adult', 'Performer', 'Piercer',
    'Reef Shark', 'Rust Monster', 'Sahuagin Warrior', 'Satyr', 'Scout',
    'Shadow', 'Swarm of Insects', 'Tough', 'Troll Limb', 'Vine Blight',
    'Warhorse', 'Warhorse Skeleton', 'Worg'
  ],
  '1': [
    'Acolyte', 'Animated Armor', 'Brass Dragon Wyrmling', 'Brown Bear',
    'Bugbear Warrior', 'Copper Dragon Wyrmling', 'Death Dog', 'Dire Wolf',
    'Dryad', 'Empyrean Iota', 'Faerie Dragon Youth', 'Ghoul',
    'Giant Eagle', 'Giant Hyena', 'Giant Octopus', 'Giant Spider',
    'Giant Toad', 'Giant Vulture', 'Goblin Boss', 'Harpy', 'Hippogriff',
    'Imp', 'Kuo-toa Whip', 'Lacedon Ghoul', 'Lion',
    'Manes Vaporspawn', 'Modron Quadrone', 'Myconid Spore Servant',
    'Ogrillon Ogre', 'Pirate', 'Psychic Gray Ooze', 'Quasit',
    'Salamander Fire Snake', 'Scarecrow', 'Specter', 'Sphinx of Wonder',
    'Spy', 'Swarm of Larvae', 'Swarm of Piranhas',
    'Thri-kreen Marauder', 'Tiger', 'Yuan-ti Infiltrator'
  ],
  '2': [
    'Allosaurus', 'Animated Rug of Smothering', 'Ankheg', 'Awakened Tree',
    'Azer Sentinel', 'Bandit Captain', 'Berserker',
    'Black Dragon Wyrmling', 'Bronze Dragon Wyrmling', 'Bulette Pup',
    'Carrion Crawler', 'Centaur Trooper', 'Cultist Fanatic', 'Druid',
    'Ettercap', 'Faerie Dragon Adult', 'Gargoyle', 'Gelatinous Cube',
    'Ghast', 'Giant Boar', 'Giant Constrictor Snake', 'Giant Elk',
    'Gibbering Mouther', 'Githzerai Monk', 'Gnoll Pack Lord',
    'Green Dragon Wyrmling', 'Grick', 'Griffon', 'Hunter Shark',
    'Intellect Devourer', 'Lizardfolk Geomancer', 'Mage Apprentice',
    'Merrow', 'Mimic', 'Minotaur', 'Modron Pentadrone',
    'Myconid Sovereign', 'Nothic', 'Ochre Jelly', 'Ogre', 'Ogre Zombie',
    'Pegasus', 'Peryton', 'Plesiosaurus', 'Polar Bear', 'Poltergeist',
    'Priest', 'Quaggoth', 'Rhinoceros', 'Saber-Toothed Tiger',
    'Sahuagin Priest', 'Sea Hag', 'Silver Dragon Wyrmling',
    'Spined Devil', 'Swarm of Stirges', 'Swarm of Venomous Snakes',
    'Wererat', 'White Dragon Wyrmling', 'Will-o\'-Wisp'
  ],
  '3': [
    'Ankylosaurus', 'Basilisk', 'Bearded Devil', 'Blue Dragon Wyrmling',
    'Bugbear Stalker', 'Displacer Beast', 'Doppelganger',
    'Flaming Skeleton', 'Giant Scorpion', 'Githyanki Warrior',
    'Goblin Hexer', 'Gold Dragon Wyrmling', 'Green Hag', 'Grell',
    'Hell Hound', 'Hobgoblin Captain', 'Hook Horror', 'Killer Whale',
    'Knight', 'Kuo-toa Monitor', 'Manticore', 'Minotaur of Baphomet',
    'Mummy', 'Nightmare', 'Owlbear', 'Phase Spider',
    'Quaggoth Thonot', 'Scout Captain', 'Spectator',
    'Swarm of Crawling Claws', 'Swarm of Lemures', 'Vampire Familiar',
    'Warrior Veteran', 'Water Weird', 'Werewolf', 'Wight',
    'Winter Wolf', 'Yeti', 'Yuan-ti Malison'
  ],
  '4': [
    'Aarakocra Aeromancer', 'Archelon', 'Banshee', 'Black Pudding',
    'Bone Naga', 'Bullywug Bog Sage', 'Chuul', 'Couatl', 'Elephant',
    'Ettin', 'Flameskull', 'Ghost', 'Gnoll Fang of Yeenoghu',
    'Guard Captain', 'Helmed Horror', 'Hippopotamus', 'Incubus',
    'Juvenile Shadow Dragon', 'Lamia', 'Lizardfolk Sovereign',
    'Red Dragon Wyrmling', 'Shadow Demon', 'Succubus',
    'Swarm of Dretches', 'Tough Boss', 'Wereboar', 'Weretiger'
  ],
  '5': [
    'Air Elemental', 'Barbed Devil', 'Barlgura', 'Beholder Zombie',
    'Bulette', 'Cambion', 'Earth Elemental', 'Fire Elemental',
    'Flesh Golem', 'Giant Axe Beak', 'Giant Crocodile', 'Giant Shark',
    'Gladiator', 'Gorgon', 'Half-Dragon', 'Hill Giant', 'Mezzoloth',
    'Night Hag', 'Otyugh', 'Pixie Wonderbringer', 'Red Slaad',
    'Revenant', 'Roper', 'Sahuagin Baron', 'Salamander',
    'Shambling Mound', 'Triceratops', 'Troll', 'Umber Hulk', 'Unicorn',
    'Vampire Spawn', 'Water Elemental', 'Werebear', 'Wraith', 'Xorn',
    'Young Remorhaz'
  ],
  '6': [
    'Azer Pyromancer', 'Chasme', 'Chimera', 'Cyclops Sentry', 'Drider',
    'Galeb Duhr', 'Ghast Gravecaller', 'Giant Squid', 'Githzerai Zerth',
    'Hobgoblin Warlord', 'Invisible Stalker', 'Kuo-toa Archpriest',
    'Mage', 'Mammoth', 'Medusa', 'Merfolk Wavebender',
    'Performer Maestro', 'Pirate Captain', 'Satyr Revelmaster', 'Vrock',
    'Wyvern', 'Young Brass Dragon', 'Young White Dragon'
  ],
  '7': [
    'Bandit Deceiver', 'Blue Slaad', 'Centaur Warden', 'Giant Ape',
    'Graveyard Revenant', 'Grick Ancient', 'Mind Flayer', 'Oni',
    'Primeval Owlbear', 'Shield Guardian', 'Stone Giant', 'Tree Blight',
    'Violet Fungus Necrohulk', 'Young Black Dragon',
    'Young Copper Dragon', 'Yuan-ti Abomination'
  ],
  '8': [
    'Aberrant Cultist', 'Assassin', 'Berserker Commander', 'Chain Devil',
    'Cloaker', 'Cockatrice Regent', 'Death Cultist', 'Elemental Cultist',
    'Fiend Cultist', 'Fomorian', 'Frost Giant', 'Githyanki Knight',
    'Gnoll Demoniac', 'Green Slaad', 'Hezrou', 'Hydra',
    'Sphinx of Secrets', 'Spirit Naga', 'Thri-kreen Psion',
    'Tyrannosaurus Rex', 'Vampire Nightbringer', 'Young Bronze Dragon',
    'Young Green Dragon'
  ],
  '9': [
    'Abominable Yeti', 'Bone Devil', 'Brazen Gorgon', 'Clay Golem',
    'Cloud Giant', 'Fire Giant', 'Glabrezu', 'Gray Slaad', 'Nycaloth',
    'Treant', 'Young Blue Dragon', 'Young Silver Dragon'
  ],
  '10': [
    'Aboleth', 'Cultist Hierophant', 'Cyclops Oracle', 'Death Slaad',
    'Deva', 'Dire Worg', 'Guardian Naga', 'Haunting Revenant',
    'Noble Prodigy', 'Performer Legend', 'Spy Master', 'Stone Golem',
    'Warrior Commander', 'Yochlol', 'Young Gold Dragon',
    'Young Red Dragon'
  ],
  '11': [
    'Bandit Crime Lord', 'Behir', 'Dao', 'Death Knight Aspirant',
    'Djinni', 'Efreeti', 'Horned Devil', 'Marid',
    'Mind Flayer Arcanist', 'Remorhaz', 'Roc', 'Sphinx of Lore'
  ],
  '12': [
    'Arcanaloth', 'Archmage', 'Archpriest', 'Erinyes',
    'Githzerai Psion', 'Pirate Admiral', 'Questing Knight'
  ],
  '13': [
    'Adult Brass Dragon', 'Adult White Dragon', 'Beholder', 'Nalfeshnee',
    'Rakshasa', 'Shadow Dragon', 'Storm Giant', 'Ultroloth', 'Vampire'
  ],
  '14': [
    'Adult Black Dragon', 'Adult Copper Dragon', 'Death Tyrant',
    'Ice Devil'
  ],
  '15': [
    'Adult Bronze Dragon', 'Adult Green Dragon', 'Mummy Lord',
    'Purple Worm', 'Salamander Inferno Master', 'Vampire Umbral Lord'
  ],
  '16': [
    'Adult Blue Dragon', 'Adult Silver Dragon', 'Githyanki Dracomancer',
    'Gulthias Blight', 'Iron Golem', 'Marilith', 'Planetar'
  ],
  '17': [
    'Adult Gold Dragon', 'Adult Red Dragon', 'Death Knight', 'Dracolich',
    'Dragon Turtle', 'Goristro', 'Sphinx of Valor'
  ],
  '18': ['Demilich'],
  '19': ['Balor'],
  '20': [
    'Ancient Brass Dragon', 'Ancient White Dragon', 'Animal Lord',
    'Pit Fiend'
  ],
  '21': [
    'Ancient Black Dragon', 'Ancient Copper Dragon', 'Arch-Hag', 'Lich',
    'Solar'
  ],
  '22': [
    'Ancient Bronze Dragon', 'Ancient Green Dragon',
    'Elemental Cataclysm'
  ],
  '23': [
    'Ancient Blue Dragon', 'Ancient Silver Dragon', 'Blob of Annihilation',
    'Empyrean', 'Kraken'
  ],
  '24': ['Ancient Gold Dragon', 'Ancient Red Dragon'],
  '25': ['Colossus'],
  '30': ['Tarrasque']
};

// ============================================================
// Known name mappings: MM 2025 name → current app name (for fuzzy matching)
// ============================================================

const NAME_MAPPINGS = {
  // Renames needed (current name → MM 2025 name)
  'Bugbear': 'Bugbear Warrior',
  'Cyclops': 'Cyclops Sentry',
  'Kobold': 'Kobold Warrior',
  'Goblin': 'Goblin Warrior',
  'Flying Sword': 'Animated Flying Sword',
  'Rug of Smothering': 'Animated Rug of Smothering',
  'Succubus/Incubus': null, // needs splitting into Succubus + Incubus
  'Shrieker': 'Shrieker Fungus',
  'Duodrone': 'Modron Duodrone',
  'Monodrone': 'Modron Monodrone',
  'Tridrone': 'Modron Tridrone',
  'Quadrone': 'Modron Quadrone',
  'Pentadrone': 'Modron Pentadrone',
  'Merfolk': 'Merfolk Skirmisher',
  'Bullywug': 'Bullywug Warrior',
  'Hobgoblin Warrior': 'Hobgoblin Warrior', // already correct name exists
  'Acolyte': 'Acolyte', // might need CR update
  'Cult Fanatic': 'Cultist Fanatic',
  'Sahuagin': 'Sahuagin Warrior',
  'Lizardfolk': 'Lizardfolk Geomancer', // or separate entries
  'Gnoll': 'Gnoll Warrior',
  'Thri-kreen': 'Thri-kreen Marauder',
  'Yuan-ti': 'Yuan-ti Infiltrator',
  'Kuo-toa': 'Kuo-toa', // same name
  'Orc': null, // legacy - not in MM 2025
  'Drow': null, // legacy - not in MM 2025
  'Drow Elite Warrior': null, // legacy
  'Orc Eye of Gruumsh': null, // legacy
  'Orc War Chief': null, // legacy
};

// Legacy entries: exist in app but NOT in MM 2025
const LEGACY_ENTRIES = [
  'Androsphinx', 'Gynosphinx',
  'Clay Colossus', 'Flesh Colossus', 'Iron Colossus', 'Stone Colossus',
  'Kobold Dragonshield', 'Kobold Scale Sorcerer',
  'Bugbear Chief',
  'Skeleton Warrior',
  'Orc', 'Orc Eye of Gruumsh', 'Orc War Chief',
  'Drow', 'Drow Elite Warrior',
  'Incubus', // MM 2025 has separate Incubus at CR 4
  'Sahuagin Priestess', // MM 2025 uses "Sahuagin Priest"
  'Lizardfolk Monarch', // MM 2025 uses "Lizardfolk Sovereign"
  'Lizardfolk Shaman', // not in MM 2025 Creatures by CR list
];

// NPC entries that belong in npcs.json (from Bestiary/NPCs folder)
const NPC_FAMILIES = [
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
  'Acolyte',
];

// Beast entries that belong in creatures.json (Animals appendix)
const BEAST_ENTRIES = [
  'Baboon', 'Badger', 'Bat', 'Cat', 'Crab', 'Deer', 'Eagle', 'Frog',
  'Goat', 'Hawk', 'Hyena', 'Jackal', 'Lizard', 'Octopus', 'Owl',
  'Piranha', 'Rat', 'Raven', 'Scorpion', 'Seahorse', 'Spider',
  'Vulture', 'Weasel', 'Mastiff', 'Mule', 'Pony',
  'Blood Hawk', 'Camel', 'Flying Snake', 'Giant Crab', 'Giant Rat',
  'Giant Weasel',
  'Boar', 'Constrictor Snake', 'Draft Horse', 'Elk', 'Giant Badger',
  'Giant Bat', 'Giant Centipede', 'Giant Frog', 'Giant Lizard',
  'Giant Owl', 'Giant Venomous Snake', 'Giant Wolf Spider', 'Panther',
  'Pteranodon', 'Riding Horse',
  'Ape', 'Black Bear', 'Crocodile', 'Giant Goat', 'Giant Seahorse',
  'Giant Wasp', 'Reef Shark', 'Warhorse',
  'Brown Bear', 'Dire Wolf', 'Giant Eagle', 'Giant Hyena',
  'Giant Octopus', 'Giant Spider', 'Giant Toad', 'Giant Vulture',
  'Lion', 'Tiger',
  'Allosaurus', 'Giant Boar', 'Giant Constrictor Snake', 'Giant Elk',
  'Hunter Shark', 'Plesiosaurus', 'Polar Bear', 'Rhinoceros',
  'Saber-Toothed Tiger',
  'Ankylosaurus', 'Giant Scorpion', 'Killer Whale',
  'Archelon', 'Elephant', 'Hippopotamus',
  'Giant Axe Beak', 'Giant Crocodile', 'Giant Shark', 'Triceratops',
  'Giant Ape', 'Giant Squid', 'Mammoth',
  'Tyrannosaurus Rex',
  'Wolf', 'Warhorse Skeleton', 'Swarm of Bats', 'Swarm of Rats',
  'Swarm of Ravens', 'Swarm of Insects', 'Swarm of Piranhas',
  'Swarm of Stirges', 'Swarm of Venomous Snakes',
];

// ============================================================
// Load data files
// ============================================================

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

function loadJsonFile(filename) {
  const fp = path.join(dataDir, filename);
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error(`Failed to load ${filename}: ${e.message}`);
    return [];
  }
}

const monsters = loadJsonFile('monsters.json');
const creatures = loadJsonFile('creatures.json');
const npcs = loadJsonFile('npcs.json');

const allEntries = [...monsters, ...creatures, ...npcs];

// Build lookup maps
const monstersByName = new Map(monsters.map(m => [m.name, m]));
const creaturesByName = new Map(creatures.map(m => [m.name, m]));
const npcsByName = new Map(npcs.map(m => [m.name, m]));
const allByName = new Map(allEntries.map(m => [m.name, m]));
const allById = new Map(allEntries.map(m => [m.id, m]));
const allNamesLower = new Map(allEntries.map(m => [m.name.toLowerCase(), m]));

// Flatten MM 2025 list
const mm2025Flat = [];
for (const [cr, names] of Object.entries(MM2025_MASTER_LIST)) {
  for (const name of names) {
    mm2025Flat.push({ name, cr });
  }
}

// ============================================================
// Analysis Functions
// ============================================================

function findExactMatch(name) {
  return allByName.get(name) || null;
}

function findFuzzyMatch(name) {
  const lower = name.toLowerCase();

  // Exact case-insensitive
  const exact = allNamesLower.get(lower);
  if (exact) return { entry: exact, matchType: 'case-insensitive' };

  // Check known mappings (reverse: MM2025 name → current name)
  for (const [currentName, mm2025Name] of Object.entries(NAME_MAPPINGS)) {
    if (mm2025Name === name) {
      const entry = allByName.get(currentName);
      if (entry) return { entry, matchType: 'known-rename', currentName };
    }
  }

  // Substring/contains match
  for (const [entryName, entry] of allByName) {
    const entryLower = entryName.toLowerCase();
    // One contains the other
    if (entryLower.includes(lower) || lower.includes(entryLower)) {
      return { entry, matchType: 'substring', currentName: entryName };
    }
  }

  return null;
}

// Determine expected file for an MM 2025 entry
function getExpectedFile(name) {
  if (NPC_FAMILIES.includes(name)) return 'npcs.json';
  if (BEAST_ENTRIES.includes(name)) return 'creatures.json';
  return 'monsters.json';
}

// Determine actual file for an entry
function getActualFile(entry) {
  if (monstersByName.has(entry.name)) return 'monsters.json';
  if (creaturesByName.has(entry.name)) return 'creatures.json';
  if (npcsByName.has(entry.name)) return 'npcs.json';
  return 'unknown';
}

// ============================================================
// Run Analysis
// ============================================================

const report = {
  summary: {
    mm2025Total: mm2025Flat.length,
    currentTotal: allEntries.length,
    monstersCount: monsters.length,
    creaturesCount: creatures.length,
    npcsCount: npcs.length,
  },
  missingEntirely: [],      // MM 2025 entries with no match at all
  nameMismatches: [],        // Entries that exist under different names
  exactMatches: [],          // Entries that match exactly
  crMismatches: [],          // Entries where CR differs
  fileMismatches: [],        // Entries in wrong data file
  duplicateIds: [],          // Same ID in multiple files
  legacyEntries: [],         // App entries not in MM 2025
  byCR: {},                  // Breakdown by CR
  byFamily: {},              // Breakdown by Bestiary folder
};

// 1. Check each MM 2025 entry against app data
for (const { name, cr } of mm2025Flat) {
  const exact = findExactMatch(name);

  if (exact) {
    // Exact match found
    report.exactMatches.push({
      name,
      cr,
      currentCR: exact.cr,
      file: getActualFile(exact),
      expectedFile: getExpectedFile(name),
    });

    // Check CR mismatch
    if (String(exact.cr) !== String(cr)) {
      report.crMismatches.push({
        name,
        mm2025CR: cr,
        currentCR: exact.cr,
        file: getActualFile(exact),
      });
    }

    // Check file placement
    const actualFile = getActualFile(exact);
    const expectedFile = getExpectedFile(name);
    if (actualFile !== expectedFile) {
      report.fileMismatches.push({
        name,
        actualFile,
        expectedFile,
      });
    }
  } else {
    // No exact match - try fuzzy
    const fuzzy = findFuzzyMatch(name);
    if (fuzzy) {
      report.nameMismatches.push({
        mm2025Name: name,
        mm2025CR: cr,
        currentName: fuzzy.entry.name,
        currentCR: fuzzy.entry.cr,
        matchType: fuzzy.matchType,
        file: getActualFile(fuzzy.entry),
      });
    } else {
      report.missingEntirely.push({
        name,
        cr,
        expectedFile: getExpectedFile(name),
      });
    }
  }
}

// 2. Find legacy entries (in app but not in MM 2025)
const mm2025Names = new Set(mm2025Flat.map(e => e.name));
const mm2025NamesLower = new Set(mm2025Flat.map(e => e.name.toLowerCase()));

for (const entry of allEntries) {
  if (!mm2025Names.has(entry.name) && !mm2025NamesLower.has(entry.name.toLowerCase())) {
    // Check if it's a known rename target
    const isRenameSource = Object.keys(NAME_MAPPINGS).includes(entry.name);
    const isKnownLegacy = LEGACY_ENTRIES.includes(entry.name);

    report.legacyEntries.push({
      name: entry.name,
      id: entry.id,
      cr: entry.cr,
      file: getActualFile(entry),
      isKnownRename: isRenameSource,
      isKnownLegacy,
    });
  }
}

// 3. Check for duplicate IDs across files
const idOccurrences = {};
for (const entry of allEntries) {
  if (!idOccurrences[entry.id]) idOccurrences[entry.id] = [];
  idOccurrences[entry.id].push({ name: entry.name, file: getActualFile(entry) });
}
for (const [id, occurrences] of Object.entries(idOccurrences)) {
  if (occurrences.length > 1) {
    report.duplicateIds.push({ id, occurrences });
  }
}

// 4. CR distribution
for (const [cr, names] of Object.entries(MM2025_MASTER_LIST)) {
  const matched = names.filter(n => findExactMatch(n));
  const fuzzy = names.filter(n => !findExactMatch(n) && findFuzzyMatch(n));
  const missing = names.filter(n => !findExactMatch(n) && !findFuzzyMatch(n));
  report.byCR[cr] = {
    total: names.length,
    matched: matched.length,
    fuzzyMatched: fuzzy.length,
    missing: missing.length,
    missingNames: missing,
  };
}

// 5. Bestiary family mapping
const BESTIARY_FAMILIES = {
  'Aberrations': ['Aboleth', 'Chuul', 'Cloaker', 'Flumph', 'Gibbering Mouther', 'Grell', 'Nothic', 'Otyugh'],
  'Beholders': ['Beholder', 'Beholder Zombie', 'Death Tyrant', 'Spectator'],
  'Celestials': ['Animal Lord', 'Couatl', 'Deva', 'Empyrean', 'Empyrean Iota', 'Pegasus', 'Planetar', 'Solar', 'Unicorn'],
  'Constructs': ['Animated Armor', 'Animated Broom', 'Animated Flying Sword', 'Animated Rug of Smothering', 'Colossus', 'Helmed Horror', 'Homunculus', 'Modron Monodrone', 'Modron Duodrone', 'Modron Tridrone', 'Modron Quadrone', 'Modron Pentadrone', 'Scarecrow', 'Shield Guardian'],
  'Demons': ['Balor', 'Barlgura', 'Chasme', 'Dretch', 'Glabrezu', 'Goristro', 'Hezrou', 'Manes', 'Manes Vaporspawn', 'Marilith', 'Nalfeshnee', 'Quasit', 'Shadow Demon', 'Swarm of Dretches', 'Vrock', 'Yochlol'],
  'Devils': ['Barbed Devil', 'Bearded Devil', 'Bone Devil', 'Chain Devil', 'Erinyes', 'Horned Devil', 'Ice Devil', 'Imp', 'Lemure', 'Swarm of Lemures', 'Pit Fiend', 'Spined Devil'],
  'Dragons - Chromatic': ['Black Dragon Wyrmling', 'Young Black Dragon', 'Adult Black Dragon', 'Ancient Black Dragon', 'Blue Dragon Wyrmling', 'Young Blue Dragon', 'Adult Blue Dragon', 'Ancient Blue Dragon', 'Green Dragon Wyrmling', 'Young Green Dragon', 'Adult Green Dragon', 'Ancient Green Dragon', 'Red Dragon Wyrmling', 'Young Red Dragon', 'Adult Red Dragon', 'Ancient Red Dragon', 'White Dragon Wyrmling', 'Young White Dragon', 'Adult White Dragon', 'Ancient White Dragon'],
  'Dragons - Metallic': ['Brass Dragon Wyrmling', 'Young Brass Dragon', 'Adult Brass Dragon', 'Ancient Brass Dragon', 'Bronze Dragon Wyrmling', 'Young Bronze Dragon', 'Adult Bronze Dragon', 'Ancient Bronze Dragon', 'Copper Dragon Wyrmling', 'Young Copper Dragon', 'Adult Copper Dragon', 'Ancient Copper Dragon', 'Gold Dragon Wyrmling', 'Young Gold Dragon', 'Adult Gold Dragon', 'Ancient Gold Dragon', 'Silver Dragon Wyrmling', 'Young Silver Dragon', 'Adult Silver Dragon', 'Ancient Silver Dragon'],
  'Dragons - Other': ['Dracolich', 'Dragon Turtle', 'Faerie Dragon Youth', 'Faerie Dragon Adult', 'Half-Dragon', 'Pseudodragon', 'Shadow Dragon', 'Juvenile Shadow Dragon'],
  'Elementals': ['Aarakocra Skirmisher', 'Aarakocra Aeromancer', 'Air Elemental', 'Azer Sentinel', 'Azer Pyromancer', 'Earth Elemental', 'Elemental Cataclysm', 'Fire Elemental', 'Galeb Duhr', 'Gargoyle', 'Invisible Stalker', 'Magmin', 'Salamander', 'Salamander Fire Snake', 'Salamander Inferno Master', 'Water Elemental', 'Water Weird', 'Xorn'],
  'Fey': ['Blink Dog', 'Centaur Trooper', 'Centaur Warden', 'Dryad', 'Pixie', 'Pixie Wonderbringer', 'Satyr', 'Satyr Revelmaster', 'Sprite'],
  'Fiends': ['Cambion', 'Hell Hound', 'Incubus', 'Succubus', 'Jackalwere', 'Larva', 'Swarm of Larvae', 'Nightmare', 'Rakshasa'],
  'Genies': ['Dao', 'Djinni', 'Efreeti', 'Marid'],
  'Giants': ['Cloud Giant', 'Cyclops Sentry', 'Cyclops Oracle', 'Ettin', 'Fire Giant', 'Fomorian', 'Frost Giant', 'Hill Giant', 'Ogre', 'Ogre Zombie', 'Ogrillon Ogre', 'Oni', 'Stone Giant', 'Storm Giant', 'Troll', 'Troll Limb'],
  'Gith': ['Githyanki Warrior', 'Githyanki Knight', 'Githyanki Dracomancer', 'Githzerai Monk', 'Githzerai Zerth', 'Githzerai Psion'],
  'Golems': ['Clay Golem', 'Flesh Golem', 'Iron Golem', 'Stone Golem'],
  'Hags': ['Arch-Hag', 'Green Hag', 'Night Hag', 'Sea Hag'],
  'Humanoids': ['Bugbear Warrior', 'Bugbear Stalker', 'Bullywug Warrior', 'Bullywug Bog Sage', 'Gnoll Warrior', 'Gnoll Pack Lord', 'Gnoll Fang of Yeenoghu', 'Gnoll Demoniac', 'Goblin Minion', 'Goblin Warrior', 'Goblin Boss', 'Goblin Hexer', 'Grimlock', 'Hobgoblin Warrior', 'Hobgoblin Captain', 'Hobgoblin Warlord', 'Kenku', 'Kobold Warrior', 'Winged Kobold', 'Kuo-toa', 'Kuo-toa Whip', 'Kuo-toa Monitor', 'Kuo-toa Archpriest', 'Lizardfolk Geomancer', 'Lizardfolk Sovereign', 'Merfolk Skirmisher', 'Merfolk Wavebender', 'Quaggoth', 'Quaggoth Thonot', 'Sahuagin Warrior', 'Sahuagin Priest', 'Sahuagin Baron', 'Thri-kreen Marauder', 'Thri-kreen Psion', 'Troglodyte', 'Yuan-ti Infiltrator', 'Yuan-ti Malison', 'Yuan-ti Abomination'],
  'Lycanthropes': ['Werebear', 'Wereboar', 'Weretiger', 'Werewolf', 'Wererat'],
  'Mephits': ['Dust Mephit', 'Ice Mephit', 'Magma Mephit', 'Mud Mephit', 'Smoke Mephit', 'Steam Mephit'],
  'Mind Flayers': ['Intellect Devourer', 'Mind Flayer', 'Mind Flayer Arcanist'],
  'Monstrosities': ['Ankheg', 'Axe Beak', 'Giant Axe Beak', 'Basilisk', 'Behir', 'Bulette', 'Bulette Pup', 'Carrion Crawler', 'Chimera', 'Cockatrice', 'Cockatrice Regent', 'Darkmantle', 'Death Dog', 'Displacer Beast', 'Doppelganger', 'Drider', 'Ettercap', 'Brazen Gorgon', 'Gorgon', 'Grick', 'Grick Ancient', 'Griffon', 'Guardian Naga', 'Harpy', 'Hippogriff', 'Hook Horror', 'Hydra', 'Kraken', 'Lamia', 'Manticore', 'Medusa', 'Merrow', 'Mimic', 'Minotaur', 'Minotaur of Baphomet', 'Owlbear', 'Primeval Owlbear', 'Peryton', 'Phase Spider', 'Piercer', 'Purple Worm', 'Remorhaz', 'Young Remorhaz', 'Roc', 'Roper', 'Rust Monster', 'Spirit Naga', 'Stirge', 'Swarm of Stirges', 'Tarrasque', 'Umber Hulk', 'Winter Wolf', 'Worg', 'Dire Worg', 'Wyvern', 'Yeti', 'Abominable Yeti'],
  'NPCs': NPC_FAMILIES,
  'Oozes': ['Black Pudding', 'Blob of Annihilation', 'Gelatinous Cube', 'Gray Ooze', 'Psychic Gray Ooze', 'Ochre Jelly'],
  'Plants': ['Awakened Shrub', 'Awakened Tree', 'Needle Blight', 'Twig Blight', 'Vine Blight', 'Tree Blight', 'Gulthias Blight', 'Gas Spore Fungus', 'Shrieker Fungus', 'Violet Fungus', 'Violet Fungus Necrohulk', 'Myconid Sprout', 'Myconid Adult', 'Myconid Sovereign', 'Myconid Spore Servant', 'Shambling Mound', 'Treant'],
  'Slaadi': ['Slaad Tadpole', 'Red Slaad', 'Blue Slaad', 'Green Slaad', 'Gray Slaad', 'Death Slaad'],
  'Sphinxes': ['Sphinx of Wonder', 'Sphinx of Secrets', 'Sphinx of Lore', 'Sphinx of Valor'],
  'Undead': ['Banshee', 'Bone Naga', 'Crawling Claw', 'Swarm of Crawling Claws', 'Death Knight', 'Death Knight Aspirant', 'Demilich', 'Flameskull', 'Flaming Skeleton', 'Ghast', 'Ghast Gravecaller', 'Ghost', 'Ghoul', 'Lacedon Ghoul', 'Lich', 'Mummy', 'Mummy Lord', 'Poltergeist', 'Graveyard Revenant', 'Haunting Revenant', 'Revenant', 'Shadow', 'Skeleton', 'Warhorse Skeleton', 'Specter', 'Vampire', 'Vampire Spawn', 'Vampire Familiar', 'Vampire Nightbringer', 'Vampire Umbral Lord', 'Wight', 'Will-o\'-Wisp', 'Wraith', 'Zombie'],
};

for (const [family, memberNames] of Object.entries(BESTIARY_FAMILIES)) {
  const matched = memberNames.filter(n => findExactMatch(n));
  const fuzzy = memberNames.filter(n => !findExactMatch(n) && findFuzzyMatch(n));
  const missing = memberNames.filter(n => !findExactMatch(n) && !findFuzzyMatch(n));
  report.byFamily[family] = {
    total: memberNames.length,
    matched: matched.length,
    fuzzyMatched: fuzzy.length,
    missing: missing.length,
    missingNames: missing,
    fuzzyMatchedNames: fuzzy.map(n => {
      const f = findFuzzyMatch(n);
      return { mm2025: n, current: f?.entry?.name, matchType: f?.matchType };
    }),
  };
}

// ============================================================
// Add summary stats
// ============================================================

report.summary.mm2025Total = mm2025Flat.length;
report.summary.exactMatches = report.exactMatches.length;
report.summary.nameMismatches = report.nameMismatches.length;
report.summary.missingEntirely = report.missingEntirely.length;
report.summary.legacyEntries = report.legacyEntries.length;
report.summary.duplicateIds = report.duplicateIds.length;
report.summary.crMismatches = report.crMismatches.length;
report.summary.fileMismatches = report.fileMismatches.length;
report.summary.coverage = `${((report.exactMatches.length + report.nameMismatches.length) / mm2025Flat.length * 100).toFixed(1)}%`;

// ============================================================
// Output
// ============================================================

// Write full report
const reportPath = path.join(__dirname, 'mm2025-gap-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Full report written to: ${reportPath}\n`);

// Console summary
console.log('=== MM 2025 AUDIT SUMMARY ===');
console.log(`MM 2025 total entries: ${report.summary.mm2025Total}`);
console.log(`Current app entries:   ${report.summary.currentTotal} (monsters: ${report.summary.monstersCount}, creatures: ${report.summary.creaturesCount}, npcs: ${report.summary.npcsCount})`);
console.log(`Coverage: ${report.summary.coverage}`);
console.log('');
console.log(`Exact matches:     ${report.summary.exactMatches}`);
console.log(`Name mismatches:   ${report.summary.nameMismatches} (exist under different names)`);
console.log(`Missing entirely:  ${report.summary.missingEntirely}`);
console.log(`Legacy entries:    ${report.summary.legacyEntries} (in app but not MM 2025)`);
console.log(`CR mismatches:     ${report.summary.crMismatches}`);
console.log(`File mismatches:   ${report.summary.fileMismatches} (in wrong data file)`);
console.log(`Duplicate IDs:     ${report.summary.duplicateIds}`);

if (report.nameMismatches.length > 0) {
  console.log('\n=== NAME MISMATCHES (need renaming) ===');
  for (const m of report.nameMismatches) {
    console.log(`  "${m.currentName}" → "${m.mm2025Name}" (${m.matchType})`);
  }
}

if (report.missingEntirely.length > 0) {
  console.log(`\n=== MISSING ENTIRELY (${report.missingEntirely.length} entries) ===`);
  // Group by expected file
  const byFile = {};
  for (const m of report.missingEntirely) {
    if (!byFile[m.expectedFile]) byFile[m.expectedFile] = [];
    byFile[m.expectedFile].push(m);
  }
  for (const [file, entries] of Object.entries(byFile)) {
    console.log(`\n  ${file} (${entries.length} missing):`);
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`    CR ${e.cr}: ${e.name}`);
    }
  }
}

if (report.crMismatches.length > 0) {
  console.log('\n=== CR MISMATCHES ===');
  for (const m of report.crMismatches) {
    console.log(`  ${m.name}: app CR ${m.currentCR} → MM 2025 CR ${m.mm2025CR}`);
  }
}

if (report.duplicateIds.length > 0) {
  console.log('\n=== DUPLICATE IDs ===');
  for (const d of report.duplicateIds) {
    console.log(`  ${d.id}: ${d.occurrences.map(o => `${o.name} (${o.file})`).join(', ')}`);
  }
}

if (report.legacyEntries.length > 0) {
  console.log(`\n=== LEGACY ENTRIES (${report.legacyEntries.length} not in MM 2025) ===`);
  for (const e of report.legacyEntries) {
    const tag = e.isKnownRename ? ' [RENAME]' : e.isKnownLegacy ? ' [LEGACY]' : '';
    console.log(`  ${e.name} (CR ${e.cr}, ${e.file})${tag}`);
  }
}

console.log('\n=== CR COVERAGE ===');
const crOrder = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '30'];
for (const cr of crOrder) {
  const data = report.byCR[cr];
  if (data) {
    const pct = ((data.matched + data.fuzzyMatched) / data.total * 100).toFixed(0);
    console.log(`  CR ${cr.padEnd(4)}: ${data.matched}/${data.total} exact, ${data.fuzzyMatched} fuzzy, ${data.missing} missing (${pct}%)`);
  }
}

console.log('\n=== FAMILY COVERAGE ===');
for (const [family, data] of Object.entries(report.byFamily).sort((a, b) => b[1].missing - a[1].missing)) {
  if (data.missing > 0 || data.fuzzyMatched > 0) {
    console.log(`  ${family}: ${data.matched}/${data.total} exact, ${data.fuzzyMatched} fuzzy, ${data.missing} missing`);
    if (data.missingNames.length > 0) {
      console.log(`    Missing: ${data.missingNames.join(', ')}`);
    }
  }
}
