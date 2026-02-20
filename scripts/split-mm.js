/**
 * Split Monster Manual 2024 PDF into individual monster/section files.
 *
 * Usage:
 *   node scripts/split-mm.js --detect-only         # print boundaries, no output
 *   node scripts/split-mm.js                       # create all output files
 *   node scripts/split-mm.js --clean               # delete output PDFs first, then create
 *   node scripts/split-mm.js --generate-sections    # generate SECTIONS from detected JSON
 *
 * All output goes into 5.5e References/MM2025/ alongside the source PDF.
 * Requires: pdf-lib (already a devDependency)
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const SRC = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Monster Manual 2024.pdf');
const OUT = path.join(__dirname, '..', '5.5e References', 'MM2025');
const DETECTED_JSON = path.join(OUT, '_mm_detected_sections.json');

// ── Monster family groupings ─────────────────────────────────────────────────
// Maps creature name substrings → subfolder under Bestiary/
const MONSTER_FAMILIES = {
  // ── Aberrations ──
  'Aboleth': 'Aberrations',
  'Chuul': 'Aberrations',
  'Cloaker': 'Aberrations',
  'Flumph': 'Aberrations',
  'Gibbering Mouther': 'Aberrations',
  'Grell': 'Aberrations',
  'Nothic': 'Aberrations',
  'Otyugh': 'Aberrations',

  // ── Beholders ──
  'Beholder': 'Beholders',
  'Death Tyrant': 'Beholders',
  'Spectator': 'Beholders',

  // ── Celestials ──
  'Animal Lord': 'Celestials',
  'Couatl': 'Celestials',
  'Deva': 'Celestials',
  'Empyrean': 'Celestials',
  'Pegasus': 'Celestials',
  'Planetar': 'Celestials',
  'Solar': 'Celestials',
  'Unicorn': 'Celestials',

  // ── Constructs ──
  'Animated Objects': 'Constructs',
  'Colossus': 'Constructs',
  'Helmed Horror': 'Constructs',
  'Homunculus': 'Constructs',
  'Modron': 'Constructs',
  'Scarecrow': 'Constructs',
  'Shield Guardian': 'Constructs',

  // ── Demons ──
  'Balor': 'Demons',
  'Barlgura': 'Demons',
  'Chasme': 'Demons',
  'Dretch': 'Demons',
  'Goristro': 'Demons',
  'Glabrezu': 'Demons',
  'Hezrou': 'Demons',
  'Manes': 'Demons',
  'Marilith': 'Demons',
  'Nalfeshnee': 'Demons',
  'Quasit': 'Demons',
  'Shadow Demon': 'Demons',
  'Vrock': 'Demons',
  'Yochlol': 'Demons',

  // ── Devils ──
  'Barbed Devil': 'Devils',
  'Bearded Devil': 'Devils',
  'Bone Devil': 'Devils',
  'Chain Devil': 'Devils',
  'Erinyes': 'Devils',
  'Horned Devil': 'Devils',
  'Ice Devil': 'Devils',
  'Imp': 'Devils',
  'Lemure': 'Devils',
  'Pit Fiend': 'Devils',
  'Spined Devil': 'Devils',

  // ── Dragons — Chromatic ──
  'Black Dragon': 'Dragons/Chromatic',
  'Blue Dragon': 'Dragons/Chromatic',
  'Green Dragon': 'Dragons/Chromatic',
  'Red Dragon': 'Dragons/Chromatic',
  'White Dragon': 'Dragons/Chromatic',

  // ── Dragons — Metallic ──
  'Brass Dragon': 'Dragons/Metallic',
  'Bronze Dragon': 'Dragons/Metallic',
  'Copper Dragon': 'Dragons/Metallic',
  'Gold Dragon': 'Dragons/Metallic',
  'Silver Dragon': 'Dragons/Metallic',

  // ── Dragons — Other ──
  'Dracolich': 'Dragons',
  'Dragon Turtle': 'Dragons',
  'Faerie Dragon': 'Dragons',
  'Half-Dragon': 'Dragons',
  'Pseudodragon': 'Dragons',
  'Shadow Dragon': 'Dragons',

  // ── Elementals ──
  'Aarakocra': 'Elementals',
  'Air Elemental': 'Elementals',
  'Azer': 'Elementals',
  'Earth Elemental': 'Elementals',
  'Elemental Cataclysm': 'Elementals',
  'Fire Elemental': 'Elementals',
  'Galeb Duhr': 'Elementals',
  'Gargoyle': 'Elementals',
  'Invisible Stalker': 'Elementals',
  'Magmin': 'Elementals',
  'Salamander': 'Elementals',
  'Water Elemental': 'Elementals',
  'Water Weird': 'Elementals',
  'Xorn': 'Elementals',

  // ── Fey ──
  'Blink Dog': 'Fey',
  'Centaur': 'Fey',
  'Dryad': 'Fey',
  'Pixie': 'Fey',
  'Satyr': 'Fey',
  'Sprite': 'Fey',

  // ── Fiends (misc, not Demons/Devils) ──
  'Cambion': 'Fiends',
  'Hell Hound': 'Fiends',
  'Incubus': 'Fiends',
  'Jackalwere': 'Fiends',
  'Larva': 'Fiends',
  'Nightmare': 'Fiends',
  'Rakshasa': 'Fiends',
  'Succubus': 'Fiends',

  // ── Genies ──
  'Dao': 'Genies',
  'Djinni': 'Genies',
  'Efreeti': 'Genies',
  'Marid': 'Genies',

  // ── Giants ──
  'Cloud Giant': 'Giants',
  'Cyclops': 'Giants',
  'Ettin': 'Giants',
  'Fire Giant': 'Giants',
  'Fomorian': 'Giants',
  'Frost Giant': 'Giants',
  'Hill Giant': 'Giants',
  'Ogre': 'Giants',
  'Oni': 'Giants',
  'Stone Giant': 'Giants',
  'Storm Giant': 'Giants',
  'Troll': 'Giants',

  // ── Gith ──
  'Githyanki': 'Gith',
  'Githzerai': 'Gith',

  // ── Golems ──
  'Clay Golem': 'Golems',
  'Flesh Golem': 'Golems',
  'Iron Golem': 'Golems',
  'Stone Golem': 'Golems',

  // ── Hags ──
  'Arch-Hag': 'Hags',
  'Green Hag': 'Hags',
  'Night Hag': 'Hags',
  'Sea Hag': 'Hags',

  // ── Humanoids ──
  'Bugbear': 'Humanoids',
  'Bullywug': 'Humanoids',
  'Gnoll': 'Humanoids',
  'Goblin': 'Humanoids',
  'Grimlock': 'Humanoids',
  'Hobgoblin': 'Humanoids',
  'Kenku': 'Humanoids',
  'Kobold': 'Humanoids',
  'Kuo-toa': 'Humanoids',
  'Lizardfolk': 'Humanoids',
  'Merfolk': 'Humanoids',
  'Quaggoth': 'Humanoids',
  'Sahuagin': 'Humanoids',
  'Thri-kreen': 'Humanoids',
  'Troglodyte': 'Humanoids',
  'Yuan-ti': 'Humanoids',

  // ── Lycanthropes ──
  'Werebear': 'Lycanthropes',
  'Wereboar': 'Lycanthropes',
  'Wererat': 'Lycanthropes',
  'Weretiger': 'Lycanthropes',
  'Werewolf': 'Lycanthropes',

  // ── Mephits ──
  'Mephit': 'Mephits',

  // ── Mind Flayers ──
  'Intellect Devourer': 'Mind Flayers',
  'Mind Flayer': 'Mind Flayers',

  // ── Monstrosities ──
  'Ankheg': 'Monstrosities',
  'Axe Beak': 'Monstrosities',
  'Basilisk': 'Monstrosities',
  'Behir': 'Monstrosities',
  'Bulette': 'Monstrosities',
  'Carrion Crawler': 'Monstrosities',
  'Chimera': 'Monstrosities',
  'Cockatrice': 'Monstrosities',
  'Darkmantle': 'Monstrosities',
  'Death Dog': 'Monstrosities',
  'Displacer Beast': 'Monstrosities',
  'Doppelganger': 'Monstrosities',
  'Drider': 'Monstrosities',
  'Ettercap': 'Monstrosities',
  'Gorgon': 'Monstrosities',
  'Grick': 'Monstrosities',
  'Griffon': 'Monstrosities',
  'Guardian Naga': 'Monstrosities',
  'Harpy': 'Monstrosities',
  'Hippogriff': 'Monstrosities',
  'Hook Horror': 'Monstrosities',
  'Hydra': 'Monstrosities',
  'Kraken': 'Monstrosities',
  'Lamia': 'Monstrosities',
  'Manticore': 'Monstrosities',
  'Medusa': 'Monstrosities',
  'Merrow': 'Monstrosities',
  'Mimic': 'Monstrosities',
  'Minotaur': 'Monstrosities',
  'Owlbear': 'Monstrosities',
  'Peryton': 'Monstrosities',
  'Phase Spider': 'Monstrosities',
  'Piercer': 'Monstrosities',
  'Purple Worm': 'Monstrosities',
  'Remorhaz': 'Monstrosities',
  'Roc': 'Monstrosities',
  'Roper': 'Monstrosities',
  'Rust Monster': 'Monstrosities',
  'Spirit Naga': 'Monstrosities',
  'Stirge': 'Monstrosities',
  'Tarrasque': 'Monstrosities',
  'Umber Hulk': 'Monstrosities',
  'Winter Wolf': 'Monstrosities',
  'Worg': 'Monstrosities',
  'Wyvern': 'Monstrosities',
  'Yeti': 'Monstrosities',

  // ── NPCs ──
  'Assassin': 'NPCs',
  'Bandit': 'NPCs',
  'Berserker': 'NPCs',
  'Commoner': 'NPCs',
  'Cultist': 'NPCs',
  'Druid': 'NPCs',
  'Gladiator': 'NPCs',
  'Guard': 'NPCs',
  'Knight': 'NPCs',
  'Mage': 'NPCs',
  'Noble': 'NPCs',
  'Performer': 'NPCs',
  'Pirate': 'NPCs',
  'Priest': 'NPCs',
  'Scout': 'NPCs',
  'Spy': 'NPCs',
  'Tough': 'NPCs',
  'Warrior': 'NPCs',

  // ── Oozes ──
  'Black Pudding': 'Oozes',
  'Blob of Annihilation': 'Oozes',
  'Gelatinous Cube': 'Oozes',
  'Gray Ooze': 'Oozes',
  'Ochre Jelly': 'Oozes',

  // ── Plants ──
  'Awakened Plants': 'Plants',
  'Blight': 'Plants',
  'Fungi': 'Plants',
  'Myconid': 'Plants',
  'Shambling Mound': 'Plants',
  'Treant': 'Plants',

  // ── Slaadi ──
  'Slaad': 'Slaadi',

  // ── Sphinxes ──
  'Sphinx': 'Sphinxes',

  // ── Undead ──
  'Banshee': 'Undead',
  'Bone Naga': 'Undead',
  'Crawling Claw': 'Undead',
  'Death Knight': 'Undead',
  'Demilich': 'Undead',
  'Flameskull': 'Undead',
  'Ghast': 'Undead',
  'Ghost': 'Undead',
  'Ghoul': 'Undead',
  'Lich': 'Undead',
  'Mummy': 'Undead',
  'Poltergeist': 'Undead',
  'Revenant': 'Undead',
  'Shadow': 'Undead',
  'Skeleton': 'Undead',
  'Specter': 'Undead',
  'Vampire': 'Undead',
  'Wight': 'Undead',
  'Will-o\'-Wisp': 'Undead',
  'Wraith': 'Undead',
  'Zombie': 'Undead',

  // ── Yugoloths ──
  'Arcanaloth': 'Yugoloths',
  'Mezzoloth': 'Yugoloths',
  'Nycaloth': 'Yugoloths',
  'Ultroloth': 'Yugoloths',
};

// ── Section definitions ──────────────────────────────────────────────────────
// [name, startPage, endPage, outputPath]
// Pages are 1-indexed, ranges inclusive.
// Populated after running detect-mm-sections.js and reviewing output.
const SECTIONS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FRONT MATTER
  // ═══════════════════════════════════════════════════════════════════════════
  ['Introduction', 7, 11, 'Introduction/Introduction.pdf'],

  // ═══════════════════════════════════════════════════════════════════════════
  // BESTIARY  (pages 12–349)
  // ═══════════════════════════════════════════════════════════════════════════

  // A
  ['Aarakocra', 12, 12, 'Bestiary/Elementals/Aarakocra.pdf'],
  ['Aboleth', 13, 14, 'Bestiary/Aberrations/Aboleth.pdf'],
  ['Air Elemental', 15, 15, 'Bestiary/Elementals/Air Elemental.pdf'],
  ['Animal Lord', 16, 17, 'Bestiary/Celestials/Animal Lord.pdf'],
  ['Animated Objects', 18, 19, 'Bestiary/Constructs/Animated Objects.pdf'],
  ['Ankheg', 20, 20, 'Bestiary/Monstrosities/Ankheg.pdf'],
  ['Arcanaloth', 21, 21, 'Bestiary/Yugoloths/Arcanaloth.pdf'],
  ['Arch-Hag', 22, 23, 'Bestiary/Hags/Arch-Hag.pdf'],
  ['Assassin', 24, 24, 'Bestiary/NPCs/Assassin.pdf'],
  ['Awakened Plants', 25, 25, 'Bestiary/Plants/Awakened Plants.pdf'],
  ['Axe Beak', 26, 26, 'Bestiary/Monstrosities/Axe Beak.pdf'],
  ['Azer', 27, 27, 'Bestiary/Elementals/Azer.pdf'],

  // B
  ['Balor', 28, 28, 'Bestiary/Demons/Balor.pdf'],
  ['Bandit', 29, 30, 'Bestiary/NPCs/Bandit.pdf'],
  ['Banshee', 31, 31, 'Bestiary/Undead/Banshee.pdf'],
  ['Barbed Devil', 32, 32, 'Bestiary/Devils/Barbed Devil.pdf'],
  ['Barlgura', 33, 33, 'Bestiary/Demons/Barlgura.pdf'],
  ['Basilisk', 34, 34, 'Bestiary/Monstrosities/Basilisk.pdf'],
  ['Bearded Devil', 35, 35, 'Bestiary/Devils/Bearded Devil.pdf'],
  ['Behir', 36, 36, 'Bestiary/Monstrosities/Behir.pdf'],
  ['Beholder', 37, 38, 'Bestiary/Beholders/Beholder.pdf'],
  ['Berserker', 39, 39, 'Bestiary/NPCs/Berserker.pdf'],
  ['Black Dragon', 40, 42, 'Bestiary/Dragons/Chromatic/Black Dragon.pdf'],
  ['Black Pudding', 44, 44, 'Bestiary/Oozes/Black Pudding.pdf'],
  ['Blight', 45, 47, 'Bestiary/Plants/Blight.pdf'],
  ['Blink Dog', 48, 48, 'Bestiary/Fey/Blink Dog.pdf'],
  ['Blob of Annihilation', 49, 49, 'Bestiary/Oozes/Blob of Annihilation.pdf'],
  ['Blue Dragon', 50, 52, 'Bestiary/Dragons/Chromatic/Blue Dragon.pdf'],
  ['Bone Devil', 54, 54, 'Bestiary/Devils/Bone Devil.pdf'],
  ['Bone Naga', 55, 55, 'Bestiary/Undead/Bone Naga.pdf'],
  ['Brass Dragon', 56, 58, 'Bestiary/Dragons/Metallic/Brass Dragon.pdf'],
  ['Bronze Dragon', 60, 63, 'Bestiary/Dragons/Metallic/Bronze Dragon.pdf'],
  ['Bugbear', 64, 64, 'Bestiary/Humanoids/Bugbear.pdf'],
  ['Bulette', 65, 65, 'Bestiary/Monstrosities/Bulette.pdf'],
  ['Bullywug', 66, 66, 'Bestiary/Humanoids/Bullywug.pdf'],

  // C
  ['Cambion', 67, 67, 'Bestiary/Fiends/Cambion.pdf'],
  ['Carrion Crawler', 68, 68, 'Bestiary/Monstrosities/Carrion Crawler.pdf'],
  ['Centaur', 69, 69, 'Bestiary/Fey/Centaur.pdf'],
  ['Chain Devil', 70, 70, 'Bestiary/Devils/Chain Devil.pdf'],
  ['Chasme', 71, 71, 'Bestiary/Demons/Chasme.pdf'],
  ['Chimera', 72, 72, 'Bestiary/Monstrosities/Chimera.pdf'],
  ['Chuul', 73, 73, 'Bestiary/Aberrations/Chuul.pdf'],
  ['Clay Golem', 74, 74, 'Bestiary/Golems/Clay Golem.pdf'],
  ['Cloaker', 75, 75, 'Bestiary/Aberrations/Cloaker.pdf'],
  ['Cloud Giant', 76, 76, 'Bestiary/Giants/Cloud Giant.pdf'],
  ['Cockatrice', 77, 77, 'Bestiary/Monstrosities/Cockatrice.pdf'],
  ['Colossus', 78, 78, 'Bestiary/Constructs/Colossus.pdf'],
  ['Commoner', 79, 79, 'Bestiary/NPCs/Commoner.pdf'],
  ['Copper Dragon', 80, 82, 'Bestiary/Dragons/Metallic/Copper Dragon.pdf'],
  ['Couatl', 84, 84, 'Bestiary/Celestials/Couatl.pdf'],
  ['Crawling Claw', 85, 85, 'Bestiary/Undead/Crawling Claw.pdf'],
  ['Cultist', 86, 89, 'Bestiary/NPCs/Cultist.pdf'],
  ['Cyclops', 90, 90, 'Bestiary/Giants/Cyclops.pdf'],

  // D
  ['Dao', 91, 91, 'Bestiary/Genies/Dao.pdf'],
  ['Darkmantle', 92, 92, 'Bestiary/Monstrosities/Darkmantle.pdf'],
  ['Death Dog', 93, 93, 'Bestiary/Monstrosities/Death Dog.pdf'],
  ['Death Knight', 94, 95, 'Bestiary/Undead/Death Knight.pdf'],
  ['Death Tyrant', 96, 97, 'Bestiary/Beholders/Death Tyrant.pdf'],
  ['Demilich', 98, 98, 'Bestiary/Undead/Demilich.pdf'],
  ['Deva', 99, 99, 'Bestiary/Celestials/Deva.pdf'],
  ['Displacer Beast', 100, 100, 'Bestiary/Monstrosities/Displacer Beast.pdf'],
  ['Djinni', 101, 101, 'Bestiary/Genies/Djinni.pdf'],
  ['Doppelganger', 102, 102, 'Bestiary/Monstrosities/Doppelganger.pdf'],
  ['Dracolich', 103, 104, 'Bestiary/Dragons/Dracolich.pdf'],
  ['Dragon Turtle', 105, 105, 'Bestiary/Dragons/Dragon Turtle.pdf'],
  ['Dretch', 106, 106, 'Bestiary/Demons/Dretch.pdf'],
  ['Drider', 107, 107, 'Bestiary/Monstrosities/Drider.pdf'],
  ['Druid', 108, 108, 'Bestiary/NPCs/Druid.pdf'],
  ['Dryad', 109, 109, 'Bestiary/Fey/Dryad.pdf'],

  // E
  ['Earth Elemental', 110, 110, 'Bestiary/Elementals/Earth Elemental.pdf'],
  ['Efreeti', 111, 111, 'Bestiary/Genies/Efreeti.pdf'],
  ['Elemental Cataclysm', 112, 113, 'Bestiary/Elementals/Elemental Cataclysm.pdf'],
  ['Empyrean', 114, 115, 'Bestiary/Celestials/Empyrean.pdf'],
  ['Erinyes', 116, 116, 'Bestiary/Devils/Erinyes.pdf'],
  ['Ettercap', 117, 117, 'Bestiary/Monstrosities/Ettercap.pdf'],
  ['Ettin', 118, 118, 'Bestiary/Giants/Ettin.pdf'],

  // F
  ['Faerie Dragon', 119, 119, 'Bestiary/Dragons/Faerie Dragon.pdf'],
  ['Fire Elemental', 120, 120, 'Bestiary/Elementals/Fire Elemental.pdf'],
  ['Fire Giant', 121, 121, 'Bestiary/Giants/Fire Giant.pdf'],
  ['Flameskull', 122, 122, 'Bestiary/Undead/Flameskull.pdf'],
  ['Flesh Golem', 123, 123, 'Bestiary/Golems/Flesh Golem.pdf'],
  ['Flumph', 124, 124, 'Bestiary/Aberrations/Flumph.pdf'],
  ['Fomorian', 125, 125, 'Bestiary/Giants/Fomorian.pdf'],
  ['Frost Giant', 126, 126, 'Bestiary/Giants/Frost Giant.pdf'],
  ['Fungi', 127, 128, 'Bestiary/Plants/Fungi.pdf'],

  // G
  ['Galeb Duhr', 129, 129, 'Bestiary/Elementals/Galeb Duhr.pdf'],
  ['Gargoyle', 130, 130, 'Bestiary/Elementals/Gargoyle.pdf'],
  ['Gelatinous Cube', 131, 131, 'Bestiary/Oozes/Gelatinous Cube.pdf'],
  ['Ghast', 132, 132, 'Bestiary/Undead/Ghast.pdf'],
  ['Ghost', 133, 133, 'Bestiary/Undead/Ghost.pdf'],
  ['Ghoul', 134, 134, 'Bestiary/Undead/Ghoul.pdf'],
  ['Gibbering Mouther', 135, 135, 'Bestiary/Aberrations/Gibbering Mouther.pdf'],
  ['Githyanki', 136, 137, 'Bestiary/Gith/Githyanki.pdf'],
  ['Githzerai', 138, 139, 'Bestiary/Gith/Githzerai.pdf'],
  ['Glabrezu', 140, 140, 'Bestiary/Demons/Glabrezu.pdf'],
  ['Gladiator', 141, 141, 'Bestiary/NPCs/Gladiator.pdf'],
  ['Gnoll', 142, 143, 'Bestiary/Humanoids/Gnoll.pdf'],
  ['Goblin', 144, 145, 'Bestiary/Humanoids/Goblin.pdf'],
  ['Gold Dragon', 146, 148, 'Bestiary/Dragons/Metallic/Gold Dragon.pdf'],
  ['Gorgon', 150, 151, 'Bestiary/Monstrosities/Gorgon.pdf'],
  ['Goristro', 152, 152, 'Bestiary/Demons/Goristro.pdf'],
  ['Gray Ooze', 153, 153, 'Bestiary/Oozes/Gray Ooze.pdf'],
  ['Green Dragon', 154, 156, 'Bestiary/Dragons/Chromatic/Green Dragon.pdf'],
  ['Green Hag', 158, 158, 'Bestiary/Hags/Green Hag.pdf'],
  ['Grell', 159, 159, 'Bestiary/Aberrations/Grell.pdf'],
  ['Grick', 160, 160, 'Bestiary/Monstrosities/Grick.pdf'],
  ['Griffon', 161, 161, 'Bestiary/Monstrosities/Griffon.pdf'],
  ['Grimlock', 162, 162, 'Bestiary/Humanoids/Grimlock.pdf'],
  ['Guardian Naga', 163, 163, 'Bestiary/Monstrosities/Guardian Naga.pdf'],
  ['Guard', 164, 164, 'Bestiary/NPCs/Guard.pdf'],

  // H
  ['Half-Dragon', 165, 165, 'Bestiary/Dragons/Half-Dragon.pdf'],
  ['Harpy', 166, 166, 'Bestiary/Monstrosities/Harpy.pdf'],
  ['Hell Hound', 167, 167, 'Bestiary/Fiends/Hell Hound.pdf'],
  ['Helmed Horror', 168, 168, 'Bestiary/Constructs/Helmed Horror.pdf'],
  ['Hezrou', 169, 169, 'Bestiary/Demons/Hezrou.pdf'],
  ['Hill Giant', 170, 170, 'Bestiary/Giants/Hill Giant.pdf'],
  ['Hippogriff', 171, 171, 'Bestiary/Monstrosities/Hippogriff.pdf'],
  ['Hobgoblin', 172, 173, 'Bestiary/Humanoids/Hobgoblin.pdf'],
  ['Homunculus', 174, 174, 'Bestiary/Constructs/Homunculus.pdf'],
  ['Hook Horror', 175, 175, 'Bestiary/Monstrosities/Hook Horror.pdf'],
  ['Horned Devil', 176, 176, 'Bestiary/Devils/Horned Devil.pdf'],
  ['Hydra', 177, 177, 'Bestiary/Monstrosities/Hydra.pdf'],

  // I
  ['Ice Devil', 178, 178, 'Bestiary/Devils/Ice Devil.pdf'],
  ['Imp', 179, 179, 'Bestiary/Devils/Imp.pdf'],
  ['Incubus', 180, 180, 'Bestiary/Fiends/Incubus.pdf'],
  ['Intellect Devourer', 181, 181, 'Bestiary/Mind Flayers/Intellect Devourer.pdf'],
  ['Invisible Stalker', 182, 182, 'Bestiary/Elementals/Invisible Stalker.pdf'],
  ['Iron Golem', 183, 183, 'Bestiary/Golems/Iron Golem.pdf'],

  // J
  ['Jackalwere', 184, 184, 'Bestiary/Fiends/Jackalwere.pdf'],

  // K
  ['Kenku', 185, 185, 'Bestiary/Humanoids/Kenku.pdf'],
  ['Knight', 186, 186, 'Bestiary/NPCs/Knight.pdf'],
  ['Kobold', 187, 187, 'Bestiary/Humanoids/Kobold.pdf'],
  ['Kraken', 188, 189, 'Bestiary/Monstrosities/Kraken.pdf'],
  ['Kuo-toa', 190, 193, 'Bestiary/Humanoids/Kuo-toa.pdf'],

  // L
  ['Lamia', 194, 194, 'Bestiary/Monstrosities/Lamia.pdf'],
  ['Larva', 195, 195, 'Bestiary/Fiends/Larva.pdf'],
  ['Lemure', 196, 196, 'Bestiary/Devils/Lemure.pdf'],
  ['Lich', 197, 198, 'Bestiary/Undead/Lich.pdf'],
  ['Lizardfolk', 199, 199, 'Bestiary/Humanoids/Lizardfolk.pdf'],

  // M
  ['Mage', 200, 201, 'Bestiary/NPCs/Mage.pdf'],
  ['Magmin', 202, 202, 'Bestiary/Elementals/Magmin.pdf'],
  ['Manes', 203, 203, 'Bestiary/Demons/Manes.pdf'],
  ['Manticore', 204, 204, 'Bestiary/Monstrosities/Manticore.pdf'],
  ['Marid', 205, 205, 'Bestiary/Genies/Marid.pdf'],
  ['Marilith', 206, 206, 'Bestiary/Demons/Marilith.pdf'],
  ['Medusa', 207, 207, 'Bestiary/Monstrosities/Medusa.pdf'],
  ['Mephit', 208, 210, 'Bestiary/Mephits/Mephit.pdf'],
  ['Merfolk', 211, 211, 'Bestiary/Humanoids/Merfolk.pdf'],
  ['Merrow', 212, 212, 'Bestiary/Monstrosities/Merrow.pdf'],
  ['Mezzoloth', 213, 213, 'Bestiary/Yugoloths/Mezzoloth.pdf'],
  ['Mimic', 214, 214, 'Bestiary/Monstrosities/Mimic.pdf'],
  ['Mind Flayer', 215, 216, 'Bestiary/Mind Flayers/Mind Flayer.pdf'],
  ['Minotaur', 217, 217, 'Bestiary/Monstrosities/Minotaur.pdf'],
  ['Modron', 218, 220, 'Bestiary/Constructs/Modron.pdf'],
  ['Mummy', 221, 223, 'Bestiary/Undead/Mummy.pdf'],
  ['Myconid', 224, 225, 'Bestiary/Plants/Myconid.pdf'],

  // N
  ['Nalfeshnee', 226, 226, 'Bestiary/Demons/Nalfeshnee.pdf'],
  ['Night Hag', 227, 227, 'Bestiary/Hags/Night Hag.pdf'],
  ['Nightmare', 228, 228, 'Bestiary/Fiends/Nightmare.pdf'],
  ['Noble', 229, 229, 'Bestiary/NPCs/Noble.pdf'],
  ['Nothic', 230, 230, 'Bestiary/Aberrations/Nothic.pdf'],
  ['Nycaloth', 231, 231, 'Bestiary/Yugoloths/Nycaloth.pdf'],

  // O
  ['Ochre Jelly', 232, 232, 'Bestiary/Oozes/Ochre Jelly.pdf'],
  ['Ogre', 233, 233, 'Bestiary/Giants/Ogre.pdf'],
  ['Oni', 234, 234, 'Bestiary/Giants/Oni.pdf'],
  ['Otyugh', 235, 235, 'Bestiary/Aberrations/Otyugh.pdf'],
  ['Owlbear', 236, 236, 'Bestiary/Monstrosities/Owlbear.pdf'],

  // P
  ['Pegasus', 237, 237, 'Bestiary/Celestials/Pegasus.pdf'],
  ['Performer', 238, 239, 'Bestiary/NPCs/Performer.pdf'],
  ['Peryton', 240, 240, 'Bestiary/Monstrosities/Peryton.pdf'],
  ['Phase Spider', 241, 241, 'Bestiary/Monstrosities/Phase Spider.pdf'],
  ['Piercer', 242, 242, 'Bestiary/Monstrosities/Piercer.pdf'],
  ['Pirate', 243, 244, 'Bestiary/NPCs/Pirate.pdf'],
  ['Pit Fiend', 245, 245, 'Bestiary/Devils/Pit Fiend.pdf'],
  ['Pixie', 246, 246, 'Bestiary/Fey/Pixie.pdf'],
  ['Planetar', 247, 247, 'Bestiary/Celestials/Planetar.pdf'],
  ['Poltergeist', 248, 248, 'Bestiary/Undead/Poltergeist.pdf'],
  ['Priest', 249, 250, 'Bestiary/NPCs/Priest.pdf'],
  ['Pseudodragon', 251, 251, 'Bestiary/Dragons/Pseudodragon.pdf'],
  ['Purple Worm', 252, 252, 'Bestiary/Monstrosities/Purple Worm.pdf'],

  // Q
  ['Quaggoth', 253, 253, 'Bestiary/Humanoids/Quaggoth.pdf'],
  ['Quasit', 254, 254, 'Bestiary/Demons/Quasit.pdf'],

  // R
  ['Rakshasa', 255, 255, 'Bestiary/Fiends/Rakshasa.pdf'],
  ['Red Dragon', 256, 258, 'Bestiary/Dragons/Chromatic/Red Dragon.pdf'],
  ['Remorhaz', 260, 260, 'Bestiary/Monstrosities/Remorhaz.pdf'],
  ['Revenant', 261, 262, 'Bestiary/Undead/Revenant.pdf'],
  ['Roc', 263, 263, 'Bestiary/Monstrosities/Roc.pdf'],
  ['Roper', 264, 264, 'Bestiary/Monstrosities/Roper.pdf'],
  ['Rust Monster', 265, 265, 'Bestiary/Monstrosities/Rust Monster.pdf'],

  // S
  ['Sahuagin', 266, 267, 'Bestiary/Humanoids/Sahuagin.pdf'],
  ['Salamander', 268, 269, 'Bestiary/Elementals/Salamander.pdf'],
  ['Satyr', 270, 270, 'Bestiary/Fey/Satyr.pdf'],
  ['Scarecrow', 271, 271, 'Bestiary/Constructs/Scarecrow.pdf'],
  ['Scout', 272, 272, 'Bestiary/NPCs/Scout.pdf'],
  ['Sea Hag', 273, 273, 'Bestiary/Hags/Sea Hag.pdf'],
  ['Shadow', 274, 274, 'Bestiary/Undead/Shadow.pdf'],
  ['Shadow Demon', 275, 275, 'Bestiary/Demons/Shadow Demon.pdf'],
  ['Shadow Dragon', 276, 277, 'Bestiary/Dragons/Shadow Dragon.pdf'],
  ['Shambling Mound', 278, 278, 'Bestiary/Plants/Shambling Mound.pdf'],
  ['Shield Guardian', 279, 279, 'Bestiary/Constructs/Shield Guardian.pdf'],
  ['Silver Dragon', 280, 282, 'Bestiary/Dragons/Metallic/Silver Dragon.pdf'],
  ['Skeleton', 284, 285, 'Bestiary/Undead/Skeleton.pdf'],
  ['Slaad', 286, 289, 'Bestiary/Slaadi/Slaad.pdf'],
  ['Solar', 290, 290, 'Bestiary/Celestials/Solar.pdf'],
  ['Spectator', 291, 291, 'Bestiary/Beholders/Spectator.pdf'],
  ['Specter', 292, 292, 'Bestiary/Undead/Specter.pdf'],
  ['Sphinx', 293, 296, 'Bestiary/Sphinxes/Sphinx.pdf'],
  ['Spy', 297, 297, 'Bestiary/NPCs/Spy.pdf'],
  ['Spined Devil', 298, 298, 'Bestiary/Devils/Spined Devil.pdf'],
  ['Spirit Naga', 299, 299, 'Bestiary/Monstrosities/Spirit Naga.pdf'],
  ['Sprite', 300, 300, 'Bestiary/Fey/Sprite.pdf'],
  ['Stirge', 301, 301, 'Bestiary/Monstrosities/Stirge.pdf'],
  ['Stone Giant', 302, 302, 'Bestiary/Giants/Stone Giant.pdf'],
  ['Stone Golem', 303, 303, 'Bestiary/Golems/Stone Golem.pdf'],
  ['Storm Giant', 304, 304, 'Bestiary/Giants/Storm Giant.pdf'],
  ['Succubus', 305, 305, 'Bestiary/Fiends/Succubus.pdf'],

  // T
  ['Tarrasque', 306, 307, 'Bestiary/Monstrosities/Tarrasque.pdf'],
  ['Thri-kreen', 308, 308, 'Bestiary/Humanoids/Thri-kreen.pdf'],
  ['Tough', 309, 309, 'Bestiary/NPCs/Tough.pdf'],
  ['Treant', 310, 310, 'Bestiary/Plants/Treant.pdf'],
  ['Troglodyte', 311, 311, 'Bestiary/Humanoids/Troglodyte.pdf'],
  ['Troll', 312, 312, 'Bestiary/Giants/Troll.pdf'],

  // U
  ['Ultroloth', 313, 313, 'Bestiary/Yugoloths/Ultroloth.pdf'],
  ['Umber Hulk', 314, 314, 'Bestiary/Monstrosities/Umber Hulk.pdf'],
  ['Unicorn', 315, 315, 'Bestiary/Celestials/Unicorn.pdf'],

  // V
  ['Vampire', 316, 320, 'Bestiary/Undead/Vampire.pdf'],
  ['Vrock', 321, 321, 'Bestiary/Demons/Vrock.pdf'],

  // W
  ['Warrior', 322, 323, 'Bestiary/NPCs/Warrior.pdf'],
  ['Water Elemental', 324, 324, 'Bestiary/Elementals/Water Elemental.pdf'],
  ['Water Weird', 325, 325, 'Bestiary/Elementals/Water Weird.pdf'],
  ['Werebear', 326, 326, 'Bestiary/Lycanthropes/Werebear.pdf'],
  ['Wereboar', 327, 327, 'Bestiary/Lycanthropes/Wereboar.pdf'],
  ['Weretiger', 328, 328, 'Bestiary/Lycanthropes/Weretiger.pdf'],
  ['Werewolf', 329, 329, 'Bestiary/Lycanthropes/Werewolf.pdf'],
  ['White Dragon', 330, 332, 'Bestiary/Dragons/Chromatic/White Dragon.pdf'],
  ['Wight', 334, 334, 'Bestiary/Undead/Wight.pdf'],
  ['Will-o\'-Wisp', 335, 335, 'Bestiary/Undead/Will-o\'-Wisp.pdf'],
  ['Winter Wolf', 336, 336, 'Bestiary/Monstrosities/Winter Wolf.pdf'],
  ['Worg', 337, 337, 'Bestiary/Monstrosities/Worg.pdf'],
  ['Wraith', 338, 338, 'Bestiary/Undead/Wraith.pdf'],
  ['Wyvern', 339, 339, 'Bestiary/Monstrosities/Wyvern.pdf'],

  // X–Z
  ['Xorn', 340, 340, 'Bestiary/Elementals/Xorn.pdf'],
  ['Yeti', 341, 342, 'Bestiary/Monstrosities/Yeti.pdf'],
  ['Yochlol', 343, 343, 'Bestiary/Demons/Yochlol.pdf'],
  ['Yuan-ti', 344, 347, 'Bestiary/Humanoids/Yuan-ti.pdf'],
  ['Zombie', 348, 349, 'Bestiary/Undead/Zombie.pdf'],

  // ═══════════════════════════════════════════════════════════════════════════
  // APPENDICES
  // ═══════════════════════════════════════════════════════════════════════════
  ['Animals', 350, 383, 'Appendices/Animals.pdf'],
];

// ── Helper: get output path for a creature name ──────────────────────────────
function getOutputPath(name) {
  // Check family mappings (longest match first to handle "Black Dragon Wyrmling" → Dragons/Chromatic)
  const sortedFamilies = Object.entries(MONSTER_FAMILIES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [pattern, folder] of sortedFamilies) {
    if (name.includes(pattern)) {
      return `Bestiary/${folder}/${name}.pdf`;
    }
  }
  // Default: standalone monster at Bestiary root
  return `Bestiary/${name}.pdf`;
}

// ── Generate SECTIONS from detected JSON ─────────────────────────────────────
function generateSections() {
  if (!fs.existsSync(DETECTED_JSON)) {
    console.error('Detected sections JSON not found:', DETECTED_JSON);
    console.error('Run detect-mm-sections.js first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DETECTED_JSON, 'utf8'));
  console.log(`Loaded ${data.entriesDetected} detected entries from ${DETECTED_JSON}\n`);

  console.log('// ── Paste this into the SECTIONS array in split-mm.js ──');
  console.log('// Review and adjust page ranges manually before splitting.\n');
  console.log('const SECTIONS = [');

  // Front matter (before first monster)
  const firstMonsterPage = data.entries.length > 0 ? data.entries[0].startPage : 12;
  if (firstMonsterPage > 5) {
    console.log(`  // Front Matter`);
    console.log(`  ['Introduction', 5, ${firstMonsterPage - 1}, 'Introduction/Introduction.pdf'],`);
    console.log('');
  }

  // Monster entries
  console.log('  // Bestiary');
  let lastFamily = '';
  for (const entry of data.entries) {
    const outPath = getOutputPath(entry.name);
    const family = outPath.split('/').length > 2 ? outPath.split('/').slice(1, -1).join('/') : '';

    if (family !== lastFamily) {
      if (family) console.log(`\n  // ${family}`);
      else if (lastFamily) console.log('');
      lastFamily = family;
    }

    const conf = entry.confidence === 'high' ? '' : ` // ${entry.confidence} confidence`;
    console.log(`  ['${entry.name}', ${entry.startPage}, ${entry.endPage}, '${outPath}'],${conf}`);
  }

  // Appendices (after last monster)
  const lastMonsterEnd = data.entries.length > 0 ? data.entries[data.entries.length - 1].endPage : 383;
  if (lastMonsterEnd < data.totalPages) {
    console.log('\n  // Appendices');
    console.log(`  ['Creatures by CR', ${lastMonsterEnd + 1}, ${data.totalPages - 2}, 'Appendices/Creatures by CR.pdf'],`);
  }

  console.log('];');
}

// ── Clean output files ───────────────────────────────────────────────────────
function cleanOutputFiles(dir) {
  const PROTECTED = 'Monster Manual 2024.pdf';
  let count = 0;
  if (!fs.existsSync(dir)) return count;

  const subdirs = ['Introduction', 'Bestiary', 'Appendices'];
  for (const sub of subdirs) {
    const subDir = path.join(dir, sub);
    if (!fs.existsSync(subDir)) continue;
    count += cleanDir(subDir);
  }
  return count;
}

function cleanDir(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return count;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += cleanDir(fullPath);
      try {
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) fs.rmdirSync(fullPath);
      } catch { /* ignore */ }
    } else if (entry.name.endsWith('.pdf')) {
      fs.unlinkSync(fullPath);
      count++;
    }
  }
  return count;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const detectOnly = process.argv.includes('--detect-only');
  const doClean = process.argv.includes('--clean');
  const doGenerate = process.argv.includes('--generate-sections');

  if (doGenerate) {
    generateSections();
    return;
  }

  if (SECTIONS.length === 0) {
    console.log('SECTIONS array is empty.');
    console.log('Run detect-mm-sections.js first, then use --generate-sections to populate it.');
    console.log('');
    console.log('Workflow:');
    console.log('  1. node scripts/detect-mm-sections.js');
    console.log('  2. Review _mm_text_dump.txt and _mm_detected_sections.json');
    console.log('  3. node scripts/split-mm.js --generate-sections');
    console.log('  4. Paste generated SECTIONS into this file');
    console.log('  5. node scripts/split-mm.js --detect-only');
    console.log('  6. node scripts/split-mm.js');
    return;
  }

  if (!fs.existsSync(SRC)) {
    console.error('Source PDF not found:', SRC);
    process.exit(1);
  }

  // Clean output files if requested
  if (doClean) {
    console.log('Cleaning output PDFs...');
    const removed = cleanOutputFiles(OUT);
    console.log(`  Removed ${removed} files.\n`);
  }

  console.log('Loading source PDF...');
  const srcBytes = fs.readFileSync(SRC);
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();
  console.log(`Source: ${totalPages} pages\n`);

  if (detectOnly) {
    console.log('=== SECTION BOUNDARIES (--detect-only) ===\n');
    let currentCategory = '';
    let invalidCount = 0;
    for (const [name, start, end, outPath] of SECTIONS) {
      const category = outPath.split('/')[0];
      if (category !== currentCategory) {
        currentCategory = category;
        console.log(`\n  ── ${category} ──`);
      }
      const pages = end - start + 1;
      console.log(`    ${name.padEnd(40)} pp ${String(start).padStart(3)}-${String(end).padStart(3)}  (${String(pages).padStart(3)} pg)  → ${outPath}`);
      if (start < 1 || end > totalPages || start > end) {
        console.log(`      ⚠ INVALID RANGE (total pages: ${totalPages})`);
        invalidCount++;
      }
    }

    // Stats
    const bestiaryFiles = SECTIONS.filter(s => s[3].startsWith('Bestiary/'));
    const introFiles = SECTIONS.filter(s => s[3].startsWith('Introduction/'));
    const appendixFiles = SECTIONS.filter(s => s[3].startsWith('Appendices/'));

    console.log(`\n  Total sections:     ${SECTIONS.length}`);
    console.log(`    Introduction:     ${introFiles.length}`);
    console.log(`    Bestiary:         ${bestiaryFiles.length}`);
    console.log(`    Appendices:       ${appendixFiles.length}`);
    if (invalidCount > 0) console.log(`    ⚠ Invalid ranges: ${invalidCount}`);
    return;
  }

  // Create output directories
  const dirs = new Set();
  for (const [, , , outPath] of SECTIONS) {
    dirs.add(path.join(OUT, path.dirname(outPath)));
  }
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate PDFs
  let created = 0;
  let currentCategory = '';
  for (const [name, start, end, outPath] of SECTIONS) {
    const category = outPath.split('/')[0];
    if (category !== currentCategory) {
      currentCategory = category;
      console.log(`\n  ── ${category} ──`);
    }

    const fullPath = path.join(OUT, outPath);
    const pages = end - start + 1;
    process.stdout.write(`    ${name} (pp ${start}-${end}, ${pages} pg) ... `);

    if (start < 1 || end > totalPages || start > end) {
      console.log('SKIPPED (invalid range)');
      continue;
    }

    const newDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let i = start - 1; i <= end - 1; i++) {
      pageIndices.push(i);
    }
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    const pdfBytes = await newDoc.save();
    fs.writeFileSync(fullPath, pdfBytes);
    created++;
    console.log('OK');
  }

  console.log(`\nDone! Created ${created} files.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
