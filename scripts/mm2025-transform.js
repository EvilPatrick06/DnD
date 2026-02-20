#!/usr/bin/env node
/**
 * MM 2025 Phase 2: Transform data files
 *
 * Applies all name corrections, CR fixes, source tagging, legacy tagging,
 * and the Succubus/Incubus split across monsters.json, creatures.json, npcs.json.
 *
 * Usage: node scripts/mm2025-transform.js
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e');

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2) + '\n');
  console.log(`Saved ${filename}: ${data.length} entries`);
}

// CR → XP mapping (MM 2025)
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

let changes = [];

function log(msg) {
  changes.push(msg);
  console.log(msg);
}

// ============================================================
// Load data
// ============================================================

let monsters = loadJson('monsters.json');
let creatures = loadJson('creatures.json');
let npcs = loadJson('npcs.json');

// ============================================================
// 1. RENAMES in monsters.json
// ============================================================

const MONSTER_RENAMES = {
  'Bugbear': { name: 'Bugbear Warrior', id: 'bugbear-warrior' },
  'Cyclops': { name: 'Cyclops Sentry', id: 'cyclops-sentry' },
  'Goblin': { name: 'Goblin Warrior', id: 'goblin-warrior' },
  'Kobold': { name: 'Kobold Warrior', id: 'kobold-warrior' },
  'Flying Sword': { name: 'Animated Flying Sword', id: 'animated-flying-sword' },
  'Rug of Smothering': { name: 'Animated Rug of Smothering', id: 'animated-rug-of-smothering' },
  'Shrieker': { name: 'Shrieker Fungus', id: 'shrieker-fungus' },
  'Monodrone': { name: 'Modron Monodrone', id: 'modron-monodrone' },
  'Duodrone': { name: 'Modron Duodrone', id: 'modron-duodrone' },
  'Tridrone': { name: 'Modron Tridrone', id: 'modron-tridrone' },
  'Quadrone': { name: 'Modron Quadrone', id: 'modron-quadrone' },
  'Pentadrone': { name: 'Modron Pentadrone', id: 'modron-pentadrone' },
  'Fire Snake': { name: 'Salamander Fire Snake', id: 'salamander-fire-snake' },
  'Faerie Dragon': { name: 'Faerie Dragon Youth', id: 'faerie-dragon-youth' },
  'Grick Alpha': { name: 'Grick Ancient', id: 'grick-ancient' },
};

for (const m of monsters) {
  const rename = MONSTER_RENAMES[m.name];
  if (rename) {
    log(`RENAME monsters.json: "${m.name}" (${m.id}) → "${rename.name}" (${rename.id})`);
    m.name = rename.name;
    m.id = rename.id;
  }
}

// ============================================================
// 2. RENAMES in npcs.json
// ============================================================

const NPC_RENAMES = {
  'Merfolk': { name: 'Merfolk Skirmisher', id: 'merfolk-skirmisher' },
  'Bullywug': { name: 'Bullywug Warrior', id: 'bullywug-warrior' },
  'Cult Fanatic': { name: 'Cultist Fanatic', id: 'cultist-fanatic' },
  'Gnoll': { name: 'Gnoll Warrior', id: 'gnoll-warrior' },
  'Sahuagin': { name: 'Sahuagin Warrior', id: 'sahuagin-warrior' },
  'Thri-kreen': { name: 'Thri-kreen Marauder', id: 'thri-kreen-marauder' },
  'Yuan-ti': { name: 'Yuan-ti Infiltrator', id: 'yuan-ti-infiltrator' },
  'Veteran': { name: 'Warrior Veteran', id: 'warrior-veteran' },
  'Githyanki Warrior': { name: 'Githyanki Soldier', id: 'githyanki-soldier' },
  'Sahuagin Priestess': { name: 'Sahuagin Priest', id: 'sahuagin-priest' },
  'Lizardfolk Monarch': { name: 'Lizardfolk Sovereign', id: 'lizardfolk-sovereign' },
  'Lizardfolk': { name: 'Lizardfolk Geomancer', id: 'lizardfolk-geomancer' },
  'Lizardfolk Shaman': { name: 'Lizardfolk Shaman', id: 'lizardfolk-shaman' }, // keep name, tag legacy
};

for (const n of npcs) {
  const rename = NPC_RENAMES[n.name];
  if (rename && rename.name !== n.name) {
    log(`RENAME npcs.json: "${n.name}" (${n.id}) → "${rename.name}" (${rename.id})`);
    n.name = rename.name;
    n.id = rename.id;
  }
}

// ============================================================
// 3. CR FIXES (MM 2025 values)
// ============================================================

const CR_FIXES = {
  // creatures.json
  'mastiff': '0',
  'mule': '0',
  'pony': '0',
  'wolf': '0',
  'stirge': '0',       // moved to monsters list? No, Stirge stays in creatures/monsters
  'swarm-of-bats': '1/8',
  'swarm-of-rats': '1/8',
  'venomous-snake': '0',
  // monsters.json
  'twig-blight': '0',
  'steam-mephit': '1/8',
  'violet-fungus': '1/8',
  'winged-kobold': '1/8',
  'zombie': '0',
  'slaad-tadpole': '0',
  'goblin-hexer': '3',
  'blob-of-annihilation': '23',
  'arch-hag': '21',
  // npcs.json
  'noble': '0',
  'warrior-infantry': '0',
  'troglodyte': '1/8',
  'acolyte': '1',
  'pirate': '1',
  'mage-apprentice': '2',
  'performer': '1/2',
  'tough': '1/2',
  'guard-captain': '4',
  'pirate-captain': '6',
  'spy-master': '10',
  'minotaur': '2',
};

for (const dataset of [monsters, creatures, npcs]) {
  for (const entry of dataset) {
    const newCR = CR_FIXES[entry.id];
    if (newCR && String(entry.cr) !== String(newCR)) {
      const oldXP = entry.xp;
      const newXP = CR_TO_XP[newCR];
      const newProf = CR_TO_PROF[newCR];
      log(`CR FIX: ${entry.name} (${entry.id}): CR ${entry.cr}→${newCR}, XP ${oldXP}→${newXP}, prof ${entry.proficiencyBonus}→${newProf}`);
      entry.cr = newCR;
      entry.xp = newXP;
      entry.proficiencyBonus = newProf;
    }
  }
}

// ============================================================
// 4. SPLIT Succubus/Incubus into separate entries
// ============================================================

const succInc = monsters.find(m => m.name === 'Succubus/Incubus');
if (succInc) {
  log('SPLIT: Succubus/Incubus → separate Succubus (CR 4) and Incubus (CR 4)');

  // Create Succubus (keep most of the original)
  const succubus = JSON.parse(JSON.stringify(succInc));
  succubus.name = 'Succubus';
  succubus.id = 'succubus';
  succubus.source = 'mm2025';

  // Create Incubus
  const incubus = JSON.parse(JSON.stringify(succInc));
  incubus.name = 'Incubus';
  incubus.id = 'incubus';
  incubus.source = 'mm2025';

  // Remove original, add both
  monsters = monsters.filter(m => m.name !== 'Succubus/Incubus');
  monsters.push(succubus);
  monsters.push(incubus);
}

// ============================================================
// 5. TAG source: 'mm2025' or 'legacy'
// ============================================================

// Complete set of MM 2025 entry names (from Creatures by CR list)
const MM2025_NAMES = new Set([
  // CR 0
  'Awakened Shrub', 'Baboon', 'Badger', 'Bat', 'Cat', 'Commoner',
  'Crab', 'Crawling Claw', 'Deer', 'Eagle', 'Frog', 'Giant Fire Beetle',
  'Goat', 'Hawk', 'Homunculus', 'Hyena', 'Jackal', 'Larva', 'Lemure',
  'Lizard', 'Myconid Sprout', 'Octopus', 'Owl', 'Piranha', 'Rat',
  'Raven', 'Scorpion', 'Seahorse', 'Shrieker Fungus', 'Spider',
  'Vulture', 'Weasel', 'Mastiff', 'Merfolk Skirmisher',
  'Modron Monodrone', 'Mule', 'Noble', 'Pony', 'Slaad Tadpole',
  'Stirge', 'Twig Blight', 'Venomous Snake', 'Warrior Infantry',
  'Wolf', 'Zombie',
  // CR 1/8
  'Bandit', 'Blood Hawk', 'Camel', 'Cultist', 'Flumph', 'Flying Snake',
  'Giant Crab', 'Giant Rat', 'Giant Weasel', 'Goblin Minion', 'Guard',
  'Kobold Warrior', 'Manes', 'Steam Mephit', 'Swarm of Bats',
  'Swarm of Rats', 'Swarm of Ravens', 'Troglodyte', 'Violet Fungus',
  'Winged Kobold',
  // CR 1/4
  'Aarakocra Skirmisher', 'Animated Broom', 'Animated Flying Sword',
  'Axe Beak', 'Blink Dog', 'Boar', 'Bullywug Warrior',
  'Constrictor Snake', 'Draft Horse', 'Dretch', 'Elk', 'Giant Badger',
  'Giant Bat', 'Giant Centipede', 'Giant Frog', 'Giant Lizard',
  'Giant Owl', 'Giant Venomous Snake', 'Giant Wolf Spider',
  'Goblin Warrior', 'Grimlock', 'Kenku', 'Kuo-toa',
  'Modron Duodrone', 'Mud Mephit', 'Needle Blight', 'Panther', 'Pixie',
  'Priest Acolyte', 'Pseudodragon', 'Pteranodon', 'Riding Horse',
  'Skeleton', 'Smoke Mephit', 'Sprite',
  // CR 1/2
  'Ape', 'Black Bear', 'Cockatrice', 'Crocodile', 'Darkmantle',
  'Dust Mephit', 'Gas Spore Fungus', 'Giant Goat', 'Giant Seahorse',
  'Giant Wasp', 'Gnoll Warrior', 'Gray Ooze', 'Hobgoblin Warrior',
  'Ice Mephit', 'Jackalwere', 'Magma Mephit', 'Magmin',
  'Modron Tridrone', 'Myconid Adult', 'Performer', 'Piercer',
  'Reef Shark', 'Rust Monster', 'Sahuagin Warrior', 'Satyr', 'Scout',
  'Shadow', 'Swarm of Insects', 'Tough', 'Troll Limb', 'Vine Blight',
  'Warhorse', 'Warhorse Skeleton', 'Worg',
  // CR 1
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
  'Thri-kreen Marauder', 'Tiger', 'Yuan-ti Infiltrator',
  // CR 2
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
  'Wererat', 'White Dragon Wyrmling', "Will-o'-Wisp",
  // CR 3
  'Ankylosaurus', 'Basilisk', 'Bearded Devil', 'Blue Dragon Wyrmling',
  'Bugbear Stalker', 'Displacer Beast', 'Doppelganger',
  'Flaming Skeleton', 'Giant Scorpion', 'Githyanki Soldier',
  'Goblin Hexer', 'Gold Dragon Wyrmling', 'Green Hag', 'Grell',
  'Hell Hound', 'Hobgoblin Captain', 'Hook Horror', 'Killer Whale',
  'Knight', 'Kuo-toa Monitor', 'Manticore', 'Minotaur of Baphomet',
  'Mummy', 'Nightmare', 'Owlbear', 'Phase Spider',
  'Quaggoth Thonot', 'Scout Captain', 'Spectator',
  'Swarm of Crawling Claws', 'Swarm of Lemures', 'Vampire Familiar',
  'Warrior Veteran', 'Water Weird', 'Werewolf', 'Wight',
  'Winter Wolf', 'Yeti', 'Yuan-ti Malison',
  // CR 4
  'Aarakocra Aeromancer', 'Archelon', 'Banshee', 'Black Pudding',
  'Bone Naga', 'Bullywug Bog Sage', 'Chuul', 'Couatl', 'Elephant',
  'Ettin', 'Flameskull', 'Ghost', 'Gnoll Fang of Yeenoghu',
  'Guard Captain', 'Helmed Horror', 'Hippopotamus', 'Incubus',
  'Juvenile Shadow Dragon', 'Lamia', 'Lizardfolk Sovereign',
  'Red Dragon Wyrmling', 'Shadow Demon', 'Succubus',
  'Swarm of Dretches', 'Tough Boss', 'Wereboar', 'Weretiger',
  // CR 5
  'Air Elemental', 'Barbed Devil', 'Barlgura', 'Beholder Zombie',
  'Bulette', 'Cambion', 'Earth Elemental', 'Fire Elemental',
  'Flesh Golem', 'Giant Axe Beak', 'Giant Crocodile', 'Giant Shark',
  'Gladiator', 'Gorgon', 'Half-Dragon', 'Hill Giant', 'Mezzoloth',
  'Night Hag', 'Otyugh', 'Pixie Wonderbringer', 'Red Slaad',
  'Revenant', 'Roper', 'Sahuagin Baron', 'Salamander',
  'Shambling Mound', 'Triceratops', 'Troll', 'Umber Hulk', 'Unicorn',
  'Vampire Spawn', 'Water Elemental', 'Werebear', 'Wraith', 'Xorn',
  'Young Remorhaz',
  // CR 6
  'Azer Pyromancer', 'Chasme', 'Chimera', 'Cyclops Sentry', 'Drider',
  'Galeb Duhr', 'Ghast Gravecaller', 'Giant Squid', 'Githzerai Zerth',
  'Hobgoblin Warlord', 'Invisible Stalker', 'Kuo-toa Archpriest',
  'Mage', 'Mammoth', 'Medusa', 'Merfolk Wavebender',
  'Performer Maestro', 'Pirate Captain', 'Satyr Revelmaster', 'Vrock',
  'Wyvern', 'Young Brass Dragon', 'Young White Dragon',
  // CR 7
  'Bandit Deceiver', 'Blue Slaad', 'Centaur Warden', 'Giant Ape',
  'Graveyard Revenant', 'Grick Ancient', 'Mind Flayer', 'Oni',
  'Primeval Owlbear', 'Shield Guardian', 'Stone Giant', 'Tree Blight',
  'Violet Fungus Necrohulk', 'Young Black Dragon',
  'Young Copper Dragon', 'Yuan-ti Abomination',
  // CR 8
  'Aberrant Cultist', 'Assassin', 'Berserker Commander', 'Chain Devil',
  'Cloaker', 'Cockatrice Regent', 'Death Cultist', 'Elemental Cultist',
  'Fiend Cultist', 'Fomorian', 'Frost Giant', 'Githyanki Knight',
  'Gnoll Demoniac', 'Green Slaad', 'Hezrou', 'Hydra',
  'Sphinx of Secrets', 'Spirit Naga', 'Thri-kreen Psion',
  'Tyrannosaurus Rex', 'Vampire Nightbringer', 'Young Bronze Dragon',
  'Young Green Dragon',
  // CR 9
  'Abominable Yeti', 'Bone Devil', 'Brazen Gorgon', 'Clay Golem',
  'Cloud Giant', 'Fire Giant', 'Glabrezu', 'Gray Slaad', 'Nycaloth',
  'Treant', 'Young Blue Dragon', 'Young Silver Dragon',
  // CR 10
  'Aboleth', 'Cultist Hierophant', 'Cyclops Oracle', 'Death Slaad',
  'Deva', 'Dire Worg', 'Guardian Naga', 'Haunting Revenant',
  'Noble Prodigy', 'Performer Legend', 'Spy Master', 'Stone Golem',
  'Warrior Commander', 'Yochlol', 'Young Gold Dragon', 'Young Red Dragon',
  // CR 11
  'Bandit Crime Lord', 'Behir', 'Dao', 'Death Knight Aspirant',
  'Djinni', 'Efreeti', 'Horned Devil', 'Marid',
  'Mind Flayer Arcanist', 'Remorhaz', 'Roc', 'Sphinx of Lore',
  // CR 12
  'Arcanaloth', 'Archmage', 'Archpriest', 'Erinyes',
  'Githzerai Psion', 'Pirate Admiral', 'Questing Knight',
  // CR 13
  'Adult Brass Dragon', 'Adult White Dragon', 'Beholder', 'Nalfeshnee',
  'Rakshasa', 'Shadow Dragon', 'Storm Giant', 'Ultroloth', 'Vampire',
  // CR 14
  'Adult Black Dragon', 'Adult Copper Dragon', 'Death Tyrant', 'Ice Devil',
  // CR 15
  'Adult Bronze Dragon', 'Adult Green Dragon', 'Mummy Lord',
  'Purple Worm', 'Salamander Inferno Master', 'Vampire Umbral Lord',
  // CR 16
  'Adult Blue Dragon', 'Adult Silver Dragon', 'Githyanki Dracomancer',
  'Gulthias Blight', 'Iron Golem', 'Marilith', 'Planetar',
  // CR 17
  'Adult Gold Dragon', 'Adult Red Dragon', 'Death Knight', 'Dracolich',
  'Dragon Turtle', 'Goristro', 'Sphinx of Valor',
  // CR 18-30
  'Demilich', 'Balor',
  'Ancient Brass Dragon', 'Ancient White Dragon', 'Animal Lord', 'Pit Fiend',
  'Ancient Black Dragon', 'Ancient Copper Dragon', 'Arch-Hag', 'Lich', 'Solar',
  'Ancient Bronze Dragon', 'Ancient Green Dragon', 'Elemental Cataclysm',
  'Ancient Blue Dragon', 'Ancient Silver Dragon', 'Blob of Annihilation', 'Empyrean', 'Kraken',
  'Ancient Gold Dragon', 'Ancient Red Dragon',
  'Colossus', 'Tarrasque',
]);

// Tag all entries
for (const dataset of [monsters, creatures, npcs]) {
  for (const entry of dataset) {
    if (MM2025_NAMES.has(entry.name)) {
      entry.source = 'mm2025';
    } else {
      entry.source = 'legacy';
    }
  }
}

// Count source tags
const mm2025Count = [...monsters, ...creatures, ...npcs].filter(e => e.source === 'mm2025').length;
const legacyCount = [...monsters, ...creatures, ...npcs].filter(e => e.source === 'legacy').length;
log(`\nSOURCE TAGS: ${mm2025Count} mm2025, ${legacyCount} legacy`);

// ============================================================
// 6. ADD subtype field where MM 2025 specifies one
// ============================================================

const SUBTYPE_FIXES = {
  'bugbear-warrior': 'Goblinoid',
  'bugbear-stalker': 'Goblinoid',
  'bugbear-chief': 'Goblinoid',
  'goblin-minion': 'Goblinoid',
  'goblin-warrior': 'Goblinoid',
  'goblin-boss': 'Goblinoid',
  'goblin-hexer': 'Goblinoid',
  'hobgoblin-warrior': 'Goblinoid',
  'hobgoblin-captain': 'Goblinoid',
  'hobgoblin-warlord': 'Goblinoid',
  'gnoll-warrior': 'Gnoll',
  'gnoll-pack-lord': 'Gnoll',
  'gnoll-fang-of-yeenoghu': 'Gnoll',
  'gnoll-demoniac': 'Gnoll',
  'yuan-ti-infiltrator': 'Yuan-ti',
  'yuan-ti-malison': 'Yuan-ti',
  'yuan-ti-abomination': 'Yuan-ti',
  'kobold-warrior': 'Kobold',
  'winged-kobold': 'Kobold',
  'succubus': 'Shapechanger',
  'incubus': 'Shapechanger',
  'jackalwere': 'Shapechanger',
  'doppelganger': 'Shapechanger',
  'wererat': 'Shapechanger',
  'werewolf': 'Shapechanger',
  'werebear': 'Shapechanger',
  'wereboar': 'Shapechanger',
  'weretiger': 'Shapechanger',
  'mimic': 'Shapechanger',
  'vampire': 'Shapechanger',
  'vampire-spawn': 'Shapechanger',
};

for (const dataset of [monsters, creatures, npcs]) {
  for (const entry of dataset) {
    const sub = SUBTYPE_FIXES[entry.id];
    if (sub && entry.subtype !== sub) {
      log(`SUBTYPE: ${entry.name}: "${entry.subtype || 'none'}" → "${sub}"`);
      entry.subtype = sub;
    }
  }
}

// ============================================================
// 7. ADD group field for creature families
// ============================================================

const GROUP_FIXES = {
  'bugbear-warrior': 'Bugbears', 'bugbear-stalker': 'Bugbears', 'bugbear-chief': 'Bugbears',
  'goblin-minion': 'Goblins', 'goblin-warrior': 'Goblins', 'goblin-boss': 'Goblins', 'goblin-hexer': 'Goblins',
  'hobgoblin-warrior': 'Hobgoblins', 'hobgoblin-captain': 'Hobgoblins', 'hobgoblin-warlord': 'Hobgoblins',
  'kobold-warrior': 'Kobolds', 'winged-kobold': 'Kobolds', 'kobold-dragonshield': 'Kobolds', 'kobold-scale-sorcerer': 'Kobolds',
  'gnoll-warrior': 'Gnolls', 'gnoll-pack-lord': 'Gnolls', 'gnoll-fang-of-yeenoghu': 'Gnolls', 'gnoll-demoniac': 'Gnolls',
  'yuan-ti-infiltrator': 'Yuan-ti', 'yuan-ti-malison': 'Yuan-ti', 'yuan-ti-abomination': 'Yuan-ti',
  'cyclops-sentry': 'Cyclopes', 'cyclops-oracle': 'Cyclopes',
  'salamander': 'Salamanders', 'salamander-fire-snake': 'Salamanders', 'salamander-inferno-master': 'Salamanders',
  'modron-monodrone': 'Modrons', 'modron-duodrone': 'Modrons', 'modron-tridrone': 'Modrons', 'modron-quadrone': 'Modrons', 'modron-pentadrone': 'Modrons',
  'slaad-tadpole': 'Slaadi', 'red-slaad': 'Slaadi', 'blue-slaad': 'Slaadi', 'green-slaad': 'Slaadi', 'gray-slaad': 'Slaadi', 'death-slaad': 'Slaadi',
  'myconid-sprout': 'Myconids', 'myconid-adult': 'Myconids', 'myconid-sovereign': 'Myconids', 'myconid-spore-servant': 'Myconids',
  'manes': 'Demons', 'manes-vaporspawn': 'Demons', 'dretch': 'Demons', 'quasit': 'Demons',
  'sphinx-of-wonder': 'Sphinxes',
  'azer-sentinel': 'Azers', 'azer-pyromancer': 'Azers',
  'faerie-dragon-youth': 'Faerie Dragons', 'faerie-dragon-adult': 'Faerie Dragons',
  'shrieker-fungus': 'Fungi', 'violet-fungus': 'Fungi',
  'needle-blight': 'Blights', 'twig-blight': 'Blights', 'vine-blight': 'Blights',
  'animated-armor': 'Animated Objects', 'animated-flying-sword': 'Animated Objects', 'animated-rug-of-smothering': 'Animated Objects',
  'empyrean': 'Empyreans', 'empyrean-iota': 'Empyreans',
  'pixie': 'Pixies', 'pixie-wonderbringer': 'Pixies',
  'satyr': 'Satyrs', 'satyr-revelmaster': 'Satyrs',
  'centaur-trooper': 'Centaurs', 'centaur-warden': 'Centaurs',
  'grick': 'Gricks', 'grick-ancient': 'Gricks',
  'merfolk-skirmisher': 'Merfolk', 'merfolk-wavebender': 'Merfolk',
  'kuo-toa': 'Kuo-toa', 'kuo-toa-whip': 'Kuo-toa', 'kuo-toa-archpriest': 'Kuo-toa',
  'lizardfolk-geomancer': 'Lizardfolk', 'lizardfolk-sovereign': 'Lizardfolk', 'lizardfolk-shaman': 'Lizardfolk',
  'sahuagin-warrior': 'Sahuagin', 'sahuagin-priest': 'Sahuagin', 'sahuagin-baron': 'Sahuagin',
  'bullywug-warrior': 'Bullywugs', 'bullywug-bog-sage': 'Bullywugs',
  'thri-kreen-marauder': 'Thri-kreen', 'thri-kreen-psion': 'Thri-kreen',
  'quaggoth': 'Quaggoths', 'quaggoth-thonot': 'Quaggoths',
  'githyanki-soldier': 'Githyanki', 'githyanki-knight': 'Githyanki',
  'githzerai-monk': 'Githzerai', 'githzerai-zerth': 'Githzerai',
  'dust-mephit': 'Mephits', 'ice-mephit': 'Mephits', 'magma-mephit': 'Mephits', 'steam-mephit': 'Mephits',
  'revenant': 'Revenants',
  'bandit': 'Bandits', 'bandit-captain': 'Bandits',
  'cultist': 'Cultists', 'cultist-fanatic': 'Cultists',
  'guard': 'Guards', 'guard-captain': 'Guards',
  'spy': 'Spies', 'spy-master': 'Spies',
  'mage': 'Mages', 'mage-apprentice': 'Mages',
  'pirate': 'Pirates', 'pirate-captain': 'Pirates',
  'performer': 'Performers',
  'tough': 'Toughs',
  'warrior-infantry': 'Warriors', 'warrior-veteran': 'Warriors',
  'scout': 'Scouts', 'scout-captain': 'Scouts',
  'knight': 'Knights',
  'priest': 'Priests', 'acolyte': 'Priests',
};

for (const dataset of [monsters, creatures, npcs]) {
  for (const entry of dataset) {
    const group = GROUP_FIXES[entry.id];
    if (group && entry.group !== group) {
      if (!entry.group) {
        log(`GROUP: ${entry.name}: added group "${group}"`);
      }
      entry.group = group;
    }
  }
}

// ============================================================
// 8. FIX creature types for MM 2025
// ============================================================

const TYPE_FIXES = {
  'bugbear-warrior': 'Fey',     // MM 2025: Bugbears are Fey
  'goblin-warrior': 'Fey',      // MM 2025: Goblins are Fey
  'goblin-minion': 'Fey',
  'goblin-boss': 'Fey',
  'goblin-hexer': 'Fey',
  'hobgoblin-warrior': 'Fey',   // MM 2025: Hobgoblins are Fey
  'hobgoblin-captain': 'Fey',
  'hobgoblin-warlord': 'Fey',
  'gnoll-warrior': 'Fiend',     // MM 2025: Gnolls are Fiend
  'gnoll-pack-lord': 'Fiend',
  'gnoll-fang-of-yeenoghu': 'Fiend',
  'kobold-warrior': 'Dragon',   // MM 2025: Kobolds are Dragon type
  'winged-kobold': 'Dragon',
  'bullywug-warrior': 'Fey',    // MM 2025: Bullywugs are Fey
  'thri-kreen-marauder': 'Monstrosity', // MM 2025
};

for (const dataset of [monsters, creatures, npcs]) {
  for (const entry of dataset) {
    const newType = TYPE_FIXES[entry.id];
    if (newType && entry.type !== newType) {
      log(`TYPE: ${entry.name}: "${entry.type}" → "${newType}"`);
      entry.type = newType;
    }
  }
}

// ============================================================
// Sort all arrays by CR then name
// ============================================================

function crToNum(cr) {
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr);
}

function sortEntries(arr) {
  return arr.sort((a, b) => {
    const crDiff = crToNum(a.cr) - crToNum(b.cr);
    if (crDiff !== 0) return crDiff;
    return a.name.localeCompare(b.name);
  });
}

monsters = sortEntries(monsters);
creatures = sortEntries(creatures);
npcs = sortEntries(npcs);

// ============================================================
// Save
// ============================================================

saveJson('monsters.json', monsters);
saveJson('creatures.json', creatures);
saveJson('npcs.json', npcs);

console.log(`\nTotal changes: ${changes.length}`);
console.log('Done!');
