/**
 * Split PHB 2024 PDF into individual chapter/class/subclass/topic files.
 *
 * Usage:
 *   node scripts/split-phb.js --detect-only   # print boundaries, no output
 *   node scripts/split-phb.js                 # create all output files
 *   node scripts/split-phb.js --clean         # delete old "PHB2024 - " files first, then create
 *
 * All output goes into 5.5e References/PHB2024/ alongside the source PDF.
 * Requires: pdf-lib (already a devDependency)
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const SRC = path.join(__dirname, '..', '5.5e References', 'PHB2024', 'PlayersHandbook2024.pdf');
const OUT = path.join(__dirname, '..', '5.5e References', 'PHB2024');

// ── Section definitions: [name, startPage, endPage, outputPath] ─────────
// Pages are 1-indexed (PDF page numbers). Ranges are inclusive.
// Determined by manual inspection of extracted text per page.

const SECTIONS = [
  // ═══════════════════════════════════════════════════════════════════════
  // BASICS
  // ═══════════════════════════════════════════════════════════════════════
  ['Introduction', 3, 4, 'Basics/Introduction.pdf'],
  ['Playing the Game', 6, 31, 'Basics/Playing the Game.pdf'],
  ['Rules Glossary', 359, 376, 'Basics/Rules Glossary.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // CHARACTER CREATION
  // ═══════════════════════════════════════════════════════════════════════
  ['Creating a Character', 32, 47, 'Character Creation/Creating a Character.pdf'],
  ['Character Origins', 176, 176, 'Character Creation/Character Origins.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // CLASSES & SUBCLASSES
  // ═══════════════════════════════════════════════════════════════════════
  ['Character Classes Overview', 48, 49, 'Classes/Character Classes Overview.pdf'],

  // Barbarian (pp 50-52, subclasses 53-57)
  ['Barbarian', 50, 52, 'Classes/Barbarian/Barbarian.pdf'],
  ['Path of the Berserker', 53, 53, 'Classes/Barbarian/Path of the Berserker.pdf'],
  ['Path of the Wild Heart', 54, 54, 'Classes/Barbarian/Path of the Wild Heart.pdf'],
  ['Path of the World Tree', 55, 55, 'Classes/Barbarian/Path of the World Tree.pdf'],
  ['Path of the Zealot', 56, 57, 'Classes/Barbarian/Path of the Zealot.pdf'],

  // Bard (pp 58-62, subclasses 63-67)
  ['Bard', 58, 62, 'Classes/Bard/Bard.pdf'],
  ['College of Dance', 63, 63, 'Classes/Bard/College of Dance.pdf'],
  ['College of Glamour', 64, 65, 'Classes/Bard/College of Glamour.pdf'],
  ['College of Lore', 65, 66, 'Classes/Bard/College of Lore.pdf'],
  ['College of Valor', 66, 67, 'Classes/Bard/College of Valor.pdf'],

  // Cleric (pp 68-71, subclasses 72-77)
  ['Cleric', 68, 71, 'Classes/Cleric/Cleric.pdf'],
  ['Life Domain', 72, 73, 'Classes/Cleric/Life Domain.pdf'],
  ['Light Domain', 73, 74, 'Classes/Cleric/Light Domain.pdf'],
  ['Trickery Domain', 74, 75, 'Classes/Cleric/Trickery Domain.pdf'],
  ['War Domain', 76, 77, 'Classes/Cleric/War Domain.pdf'],

  // Druid (pp 78-82, subclasses 83-89)
  ['Druid', 78, 82, 'Classes/Druid/Druid.pdf'],
  ['Circle of the Land', 83, 84, 'Classes/Druid/Circle of the Land.pdf'],
  ['Circle of the Moon', 85, 86, 'Classes/Druid/Circle of the Moon.pdf'],
  ['Circle of the Sea', 86, 87, 'Classes/Druid/Circle of the Sea.pdf'],
  ['Circle of the Stars', 87, 89, 'Classes/Druid/Circle of the Stars.pdf'],

  // Fighter (pp 90-91, subclasses 92-99)
  ['Fighter', 90, 91, 'Classes/Fighter/Fighter.pdf'],
  ['Battle Master', 92, 94, 'Classes/Fighter/Battle Master.pdf'],
  ['Champion', 95, 95, 'Classes/Fighter/Champion.pdf'],
  ['Eldritch Knight', 96, 97, 'Classes/Fighter/Eldritch Knight.pdf'],
  ['Psi Warrior', 97, 99, 'Classes/Fighter/Psi Warrior.pdf'],

  // Monk (pp 100-102, subclasses 103-107)
  ['Monk', 100, 102, 'Classes/Monk/Monk.pdf'],
  ['Warrior of Mercy', 103, 104, 'Classes/Monk/Warrior of Mercy.pdf'],
  ['Warrior of Shadow', 104, 105, 'Classes/Monk/Warrior of Shadow.pdf'],
  ['Warrior of the Elements', 105, 106, 'Classes/Monk/Warrior of the Elements.pdf'],
  ['Warrior of the Open Hand', 106, 107, 'Classes/Monk/Warrior of the Open Hand.pdf'],

  // Paladin (pp 108-111, subclasses 112-117)
  ['Paladin', 108, 111, 'Classes/Paladin/Paladin.pdf'],
  ['Oath of Devotion', 112, 113, 'Classes/Paladin/Oath of Devotion.pdf'],
  ['Oath of Glory', 113, 114, 'Classes/Paladin/Oath of Glory.pdf'],
  ['Oath of the Ancients', 114, 115, 'Classes/Paladin/Oath of the Ancients.pdf'],
  ['Oath of Vengeance', 115, 117, 'Classes/Paladin/Oath of Vengeance.pdf'],

  // Ranger (pp 118-120, subclasses 121-127)
  ['Ranger', 118, 120, 'Classes/Ranger/Ranger.pdf'],
  ['Beast Master', 121, 123, 'Classes/Ranger/Beast Master.pdf'],
  ['Fey Wanderer', 123, 124, 'Classes/Ranger/Fey Wanderer.pdf'],
  ['Gloom Stalker', 124, 125, 'Classes/Ranger/Gloom Stalker.pdf'],
  ['Hunter', 126, 127, 'Classes/Ranger/Hunter.pdf'],

  // Rogue (pp 128-130, subclasses 131-137)
  ['Rogue', 128, 130, 'Classes/Rogue/Rogue.pdf'],
  ['Arcane Trickster', 131, 132, 'Classes/Rogue/Arcane Trickster.pdf'],
  ['Assassin', 133, 133, 'Classes/Rogue/Assassin.pdf'],
  ['Soulknife', 134, 135, 'Classes/Rogue/Soulknife.pdf'],
  ['Thief', 136, 137, 'Classes/Rogue/Thief.pdf'],

  // Sorcerer (pp 138-143, subclasses 144-151)
  ['Sorcerer', 138, 143, 'Classes/Sorcerer/Sorcerer.pdf'],
  ['Aberrant Sorcery', 144, 145, 'Classes/Sorcerer/Aberrant Sorcery.pdf'],
  ['Clockwork Sorcery', 146, 147, 'Classes/Sorcerer/Clockwork Sorcery.pdf'],
  ['Draconic Sorcery', 147, 148, 'Classes/Sorcerer/Draconic Sorcery.pdf'],
  ['Wild Magic Sorcery', 148, 151, 'Classes/Sorcerer/Wild Magic Sorcery.pdf'],

  // Warlock (pp 152-157, subclasses 158-163)
  ['Warlock', 152, 157, 'Classes/Warlock/Warlock.pdf'],
  ['Archfey Patron', 158, 159, 'Classes/Warlock/Archfey Patron.pdf'],
  ['Celestial Patron', 159, 160, 'Classes/Warlock/Celestial Patron.pdf'],
  ['Fiend Patron', 160, 161, 'Classes/Warlock/Fiend Patron.pdf'],
  ['Great Old One Patron', 161, 163, 'Classes/Warlock/Great Old One Patron.pdf'],

  // Wizard (pp 164-170, subclasses 171-175)
  ['Wizard', 164, 170, 'Classes/Wizard/Wizard.pdf'],
  ['Abjurer', 171, 172, 'Classes/Wizard/Abjurer.pdf'],
  ['Diviner', 172, 173, 'Classes/Wizard/Diviner.pdf'],
  ['Evoker', 173, 174, 'Classes/Wizard/Evoker.pdf'],
  ['Illusionist', 174, 175, 'Classes/Wizard/Illusionist.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // BACKGROUNDS  (2 per page — individual PDFs include the shared page)
  // ═══════════════════════════════════════════════════════════════════════
  ['All Backgrounds', 176, 184, 'Backgrounds/All Backgrounds.pdf'],
  ['Acolyte', 177, 177, 'Backgrounds/Acolyte.pdf'],
  ['Artisan', 177, 177, 'Backgrounds/Artisan.pdf'],
  ['Charlatan', 178, 178, 'Backgrounds/Charlatan.pdf'],
  ['Criminal', 178, 178, 'Backgrounds/Criminal.pdf'],
  ['Entertainer', 179, 179, 'Backgrounds/Entertainer.pdf'],
  ['Farmer', 179, 179, 'Backgrounds/Farmer.pdf'],
  ['Guard', 180, 180, 'Backgrounds/Guard.pdf'],
  ['Guide', 180, 180, 'Backgrounds/Guide.pdf'],
  ['Hermit', 181, 181, 'Backgrounds/Hermit.pdf'],
  ['Merchant', 181, 181, 'Backgrounds/Merchant.pdf'],
  ['Noble', 182, 182, 'Backgrounds/Noble.pdf'],
  ['Sage', 182, 182, 'Backgrounds/Sage.pdf'],
  ['Sailor', 183, 183, 'Backgrounds/Sailor.pdf'],
  ['Scribe', 183, 183, 'Backgrounds/Scribe.pdf'],
  ['Soldier', 184, 184, 'Backgrounds/Soldier.pdf'],
  ['Wayfarer', 184, 184, 'Backgrounds/Wayfarer.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // SPECIES
  // ═══════════════════════════════════════════════════════════════════════
  ['All Species', 185, 196, 'Species/All Species.pdf'],
  ['Aasimar', 185, 185, 'Species/Aasimar.pdf'],
  ['Dragonborn', 186, 186, 'Species/Dragonborn.pdf'],
  ['Dwarf', 187, 187, 'Species/Dwarf.pdf'],
  ['Elf', 188, 189, 'Species/Elf.pdf'],
  ['Gnome', 190, 190, 'Species/Gnome.pdf'],
  ['Goliath', 191, 191, 'Species/Goliath.pdf'],
  ['Halfling', 192, 192, 'Species/Halfling.pdf'],
  ['Human', 193, 193, 'Species/Human.pdf'],
  ['Orc', 194, 194, 'Species/Orc.pdf'],
  ['Tiefling', 195, 196, 'Species/Tiefling.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // FEATS  (split by category)
  // ═══════════════════════════════════════════════════════════════════════
  ['All Feats', 198, 211, 'Feats/All Feats.pdf'],
  ['Feat Rules & Tables', 198, 199, 'Feats/Feat Rules & Tables.pdf'],
  ['Origin Feats', 200, 201, 'Feats/Origin Feats.pdf'],
  ['General Feats', 202, 208, 'Feats/General Feats.pdf'],
  ['Fighting Style Feats', 209, 209, 'Feats/Fighting Style Feats.pdf'],
  ['Epic Boon Feats', 210, 211, 'Feats/Epic Boon Feats.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // EQUIPMENT  (split by type)
  // ═══════════════════════════════════════════════════════════════════════
  ['All Equipment', 212, 233, 'Equipment/All Equipment.pdf'],
  ['Weapons', 212, 216, 'Equipment/Weapons.pdf'],
  ['Armor', 217, 218, 'Equipment/Armor.pdf'],
  ['Tools', 219, 220, 'Equipment/Tools.pdf'],
  ['Adventuring Gear', 221, 228, 'Equipment/Adventuring Gear.pdf'],
  ['Mounts & Vehicles', 229, 229, 'Equipment/Mounts & Vehicles.pdf'],
  ['Services & Expenses', 230, 231, 'Equipment/Services & Expenses.pdf'],
  ['Magic Items', 232, 233, 'Equipment/Magic Items.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // SPELLS  (rules vs descriptions — alphabetical order prevents level split)
  // ═══════════════════════════════════════════════════════════════════════
  ['Spellcasting Rules', 234, 237, 'Spells/Spellcasting Rules.pdf'],
  ['Spell Descriptions', 238, 342, 'Spells/Spell Descriptions.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // APPENDICES
  // ═══════════════════════════════════════════════════════════════════════
  ['The Multiverse', 343, 344, 'Lore/The Multiverse.pdf'],
  ['Creature Stat Blocks', 345, 358, 'Creatures/Creature Stat Blocks.pdf'],
];

/**
 * Recursively delete all files matching "PHB2024 - *.pdf" under a directory.
 */
function cleanOldFiles(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return count;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += cleanOldFiles(fullPath);
      // Remove empty directories left behind
      try {
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
        }
      } catch { /* ignore */ }
    } else if (entry.name.startsWith('PHB2024 - ') && entry.name.endsWith('.pdf')) {
      fs.unlinkSync(fullPath);
      count++;
    }
  }
  return count;
}

async function main() {
  const detectOnly = process.argv.includes('--detect-only');
  const doClean = process.argv.includes('--clean');

  if (!fs.existsSync(SRC)) {
    console.error('Source PDF not found:', SRC);
    process.exit(1);
  }

  // Clean old prefixed files if requested
  if (doClean) {
    console.log('Cleaning old "PHB2024 - *.pdf" files...');
    const removed = cleanOldFiles(OUT);
    console.log(`  Removed ${removed} old files.\n`);
  }

  console.log('Loading source PDF...');
  const srcBytes = fs.readFileSync(SRC);
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();
  console.log(`Source: ${totalPages} pages\n`);

  if (detectOnly) {
    console.log('=== SECTION BOUNDARIES (--detect-only) ===\n');
    let currentCategory = '';
    for (const [name, start, end, outPath] of SECTIONS) {
      const category = outPath.split('/')[0];
      if (category !== currentCategory) {
        currentCategory = category;
        console.log(`\n  ── ${category} ──`);
      }
      const pages = end - start + 1;
      console.log(`    ${name.padEnd(32)} pp ${String(start).padStart(3)}-${String(end).padStart(3)}  (${String(pages).padStart(3)} pg)  → ${outPath}`);
      if (start < 1 || end > totalPages || start > end) {
        console.log(`      ⚠ INVALID RANGE (total pages: ${totalPages})`);
      }
    }

    // Stats
    const classFiles = SECTIONS.filter(s => s[3].startsWith('Classes/') && s[3].split('/').length === 3);
    const subclassFiles = SECTIONS.filter(s => {
      const p = s[3];
      if (!p.startsWith('Classes/') || p.split('/').length !== 3) return false;
      const classes = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
      return !classes.some(c => p.endsWith(`${c}.pdf`)) && !p.includes('Overview');
    });
    const bgFiles = SECTIONS.filter(s => s[3].startsWith('Backgrounds/') && !s[0].startsWith('All'));
    const speciesFiles = SECTIONS.filter(s => s[3].startsWith('Species/') && !s[0].startsWith('All'));
    const featFiles = SECTIONS.filter(s => s[3].startsWith('Feats/') && !s[0].startsWith('All') && !s[0].includes('Rules'));
    const equipFiles = SECTIONS.filter(s => s[3].startsWith('Equipment/') && !s[0].startsWith('All'));

    console.log(`\n  Total sections: ${SECTIONS.length}`);
    console.log(`    Class base files:     ${classFiles.length - subclassFiles.length}`);
    console.log(`    Subclass files:       ${subclassFiles.length}`);
    console.log(`    Background files:     ${bgFiles.length} individual`);
    console.log(`    Species files:        ${speciesFiles.length} individual`);
    console.log(`    Feat category files:  ${featFiles.length}`);
    console.log(`    Equipment type files: ${equipFiles.length}`);
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
