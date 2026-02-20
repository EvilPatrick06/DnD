/**
 * Split DMG 2024 PDF into individual chapter/topic files.
 *
 * Usage:
 *   node scripts/split-dmg.js --detect-only   # print boundaries, no output
 *   node scripts/split-dmg.js                 # create all output files
 *   node scripts/split-dmg.js --clean         # delete output dir first, then create
 *
 * All output goes into 5.5e References/DMG2024/DM/ alongside the source PDF.
 * Requires: pdf-lib (already a devDependency)
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const SRC = path.join(__dirname, '..', '5.5e References', 'DMG2024', 'Dungeon_Masters_Guide_2024.pdf');
const OUT = path.join(__dirname, '..', '5.5e References', 'DMG2024', 'DM');

// ── Section definitions: [name, startPage, endPage, outputPath] ─────────
// Pages are 1-indexed PDF physical pages (book page + 4 for front matter).
// Ranges are inclusive. Some sub-sections intentionally share a boundary page.

const SECTIONS = [
  // ═══════════════════════════════════════════════════════════════════════
  // 01 - THE BASICS (Chapter 1, PDF 9-23)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 1 - The Basics (All)',   9,  23, '01 - The Basics/Chapter 1 - The Basics (All).pdf'],
  ['Getting Started',                9,  11, '01 - The Basics/Getting Started.pdf'],
  ['Preparing a Session',           12,  13, '01 - The Basics/Preparing a Session.pdf'],
  ['Example of Play',               14,  16, '01 - The Basics/Example of Play.pdf'],
  ['Every DM Is Unique',            17,  18, '01 - The Basics/Every DM Is Unique.pdf'],
  ['Ensuring Fun for All',          19,  23, '01 - The Basics/Ensuring Fun for All.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 02 - RUNNING THE GAME (Chapter 2, PDF 25-53)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 2 - Running the Game (All)', 25, 53, '02 - Running the Game/Chapter 2 - Running the Game (All).pdf'],
  ['Know Your Players',             25,  29, '02 - Running the Game/Know Your Players.pdf'],
  ['Narration and Resolving Outcomes', 30, 35, '02 - Running the Game/Narration and Resolving Outcomes.pdf'],
  ['Running Social Interaction',    36,  37, '02 - Running the Game/Running Social Interaction.pdf'],
  ['Running Exploration',           37,  45, '02 - Running the Game/Running Exploration.pdf'],
  ['Running Combat',                46,  53, '02 - Running the Game/Running Combat.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 03 - DMs TOOLBOX (Chapter 3, PDF 55-107)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 3 - DMs Toolbox (All)', 55, 107, '03 - DMs Toolbox/Chapter 3 - DMs Toolbox (All).pdf'],
  ['Alignment',                     55,  55, '03 - DMs Toolbox/Alignment.pdf'],
  ['Chases',                        56,  58, '03 - DMs Toolbox/Chases.pdf'],
  ['Creating a Background',         59,  59, '03 - DMs Toolbox/Creating a Background.pdf'],
  ['Creating a Creature',           60,  61, '03 - DMs Toolbox/Creating a Creature.pdf'],
  ['Creating a Magic Item',         62,  62, '03 - DMs Toolbox/Creating a Magic Item.pdf'],
  ['Creating a Spell',              63,  63, '03 - DMs Toolbox/Creating a Spell.pdf'],
  ['Curses and Magical Contagions', 64,  65, '03 - DMs Toolbox/Curses and Magical Contagions.pdf'],
  ['Death',                         66,  67, '03 - DMs Toolbox/Death.pdf'],
  ['Doors',                         68,  68, '03 - DMs Toolbox/Doors.pdf'],
  ['Dungeons',                      69,  71, '03 - DMs Toolbox/Dungeons.pdf'],
  ['Environmental Effects',         72,  73, '03 - DMs Toolbox/Environmental Effects.pdf'],
  ['Fear and Mental Stress',        74,  75, '03 - DMs Toolbox/Fear and Mental Stress.pdf'],
  ['Firearms and Explosives',       76,  77, '03 - DMs Toolbox/Firearms and Explosives.pdf'],
  ['Gods and Other Powers',         78,  79, '03 - DMs Toolbox/Gods and Other Powers.pdf'],
  ['Hazards',                       80,  83, '03 - DMs Toolbox/Hazards.pdf'],
  ['Marks of Prestige',             84,  85, '03 - DMs Toolbox/Marks of Prestige.pdf'],
  ['Mobs',                          86,  87, '03 - DMs Toolbox/Mobs.pdf'],
  ['Nonplayer Characters',          88,  93, '03 - DMs Toolbox/Nonplayer Characters.pdf'],
  ['Poison',                        94,  95, '03 - DMs Toolbox/Poison.pdf'],
  ['Renown',                        96,  96, '03 - DMs Toolbox/Renown.pdf'],
  ['Settlements',                   97,  99, '03 - DMs Toolbox/Settlements.pdf'],
  ['Siege Equipment',              100, 101, '03 - DMs Toolbox/Siege Equipment.pdf'],
  ['Supernatural Gifts',           102, 103, '03 - DMs Toolbox/Supernatural Gifts.pdf'],
  ['Traps',                        104, 107, '03 - DMs Toolbox/Traps.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 04 - CREATING ADVENTURES (Chapter 4, PDF 109-129)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 4 - Creating Adventures (All)', 109, 129, '04 - Creating Adventures/Chapter 4 - Creating Adventures (All).pdf'],
  ['Lay Out the Premise',          109, 113, '04 - Creating Adventures/Lay Out the Premise.pdf'],
  ['Draw In the Players',          114, 115, '04 - Creating Adventures/Draw In the Players.pdf'],
  ['Plan Encounters',              116, 123, '04 - Creating Adventures/Plan Encounters.pdf'],
  ['Bring It to an End',           124, 129, '04 - Creating Adventures/Bring It to an End.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 05 - CAMPAIGNS (Chapter 5, PDF 131-175)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 5 - Campaign Rules (All)', 131, 146, '05 - Campaigns/Chapter 5 - Campaign Rules (All).pdf'],
  ['Step-by-Step Campaigns',       131, 140, '05 - Campaigns/Step-by-Step Campaigns.pdf'],
  ['Running a Campaign',           141, 146, '05 - Campaigns/Running a Campaign.pdf'],
  ['Greyhawk (All)',               147, 175, '05 - Campaigns/Greyhawk/Greyhawk (All).pdf'],
  ['Important Names and Premise',  147, 152, '05 - Campaigns/Greyhawk/Important Names and Premise.pdf'],
  ['Free City of Greyhawk',        153, 163, '05 - Campaigns/Greyhawk/Free City of Greyhawk.pdf'],
  ['Greyhawk Gazetteer',           164, 175, '05 - Campaigns/Greyhawk/Greyhawk Gazetteer.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 06 - COSMOLOGY (Chapter 6, PDF 177-215)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 6 - Cosmology (All)',  177, 215, '06 - Cosmology/Chapter 6 - Cosmology (All).pdf'],
  ['The Planes',                   177, 179, '06 - Cosmology/The Planes.pdf'],
  ['Planar Travel',                180, 181, '06 - Cosmology/Planar Travel.pdf'],
  ['Planar Adventuring',           182, 183, '06 - Cosmology/Planar Adventuring.pdf'],
  ['Tour of the Multiverse',       184, 215, '06 - Cosmology/Tour of the Multiverse.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 07 - TREASURE (Chapter 7, PDF 217-335)
  // ═══════════════════════════════════════════════════════════════════════
  ['Treasure Tables',              217, 219, '07 - Treasure/Treasure Tables.pdf'],
  ['Magic Item Rules',             220, 230, '07 - Treasure/Magic Item Rules.pdf'],
  ['Magic Items A-B',              231, 241, '07 - Treasure/Magic Items A-B.pdf'],
  ['Magic Items C-D',              242, 259, '07 - Treasure/Magic Items C-D.pdf'],
  ['Magic Items E-H',              260, 273, '07 - Treasure/Magic Items E-H.pdf'],
  ['Magic Items I-O',              274, 287, '07 - Treasure/Magic Items I-O.pdf'],
  ['Magic Items P-R',              288, 305, '07 - Treasure/Magic Items P-R.pdf'],
  ['Magic Items S-Z',              306, 329, '07 - Treasure/Magic Items S-Z.pdf'],
  ['Random Magic Items',           330, 335, '07 - Treasure/Random Magic Items.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 08 - BASTIONS (Chapter 8, PDF 337-357)
  // ═══════════════════════════════════════════════════════════════════════
  ['Chapter 8 - Bastions (All)',   337, 357, '08 - Bastions/Chapter 8 - Bastions (All).pdf'],
  ['Bastion Rules',                337, 338, '08 - Bastions/Bastion Rules.pdf'],
  ['Bastion Facilities',           339, 353, '08 - Bastions/Bastion Facilities.pdf'],
  ['Bastion Events',               354, 357, '08 - Bastions/Bastion Events.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 09 - LORE (Appendix A, PDF 358-368)
  // ═══════════════════════════════════════════════════════════════════════
  ['Appendix A - Lore Glossary',   358, 368, '09 - Lore/Appendix A - Lore Glossary.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // 10 - MAPS (PDF 369-383)
  // ═══════════════════════════════════════════════════════════════════════
  ['All Maps',                     369, 383, '10 - Maps/All Maps.pdf'],
  ['Barrow Crypt',                 369, 369, '10 - Maps/Barrow Crypt.pdf'],
  ['Caravan Encampment',           370, 370, '10 - Maps/Caravan Encampment.pdf'],
  ['Crossroads Village',           371, 371, '10 - Maps/Crossroads Village.pdf'],
  ['Dragons Lair',                 372, 372, '10 - Maps/Dragons Lair.pdf'],
  ['Dungeon Hideout',              373, 373, '10 - Maps/Dungeon Hideout.pdf'],
  ['Farmstead',                    374, 374, '10 - Maps/Farmstead.pdf'],
  ['Keep',                         375, 375, '10 - Maps/Keep.pdf'],
  ['Manor',                        376, 376, '10 - Maps/Manor.pdf'],
  ['Mine',                         377, 377, '10 - Maps/Mine.pdf'],
  ['Roadside Inn',                 378, 378, '10 - Maps/Roadside Inn.pdf'],
  ['Ship',                         379, 379, '10 - Maps/Ship.pdf'],
  ['Spooky House',                 380, 380, '10 - Maps/Spooky House.pdf'],
  ['Underdark Warren',             381, 381, '10 - Maps/Underdark Warren.pdf'],
  ['Volcanic Caves',               382, 382, '10 - Maps/Volcanic Caves.pdf'],
  ['Wizards Tower',                383, 383, '10 - Maps/Wizards Tower.pdf'],

  // ═══════════════════════════════════════════════════════════════════════
  // TRACKING SHEETS (single-page printable sheets scattered throughout)
  // ═══════════════════════════════════════════════════════════════════════
  ['Game Expectations',             18,  18, 'Tracking Sheets/Game Expectations.pdf'],
  ['Travel Planner',                41,  41, 'Tracking Sheets/Travel Planner.pdf'],
  ['NPC Tracker',                   91,  91, 'Tracking Sheets/NPC Tracker.pdf'],
  ['Settlement Tracker',            99,  99, 'Tracking Sheets/Settlement Tracker.pdf'],
  ['Campaign Journal',             132, 132, 'Tracking Sheets/Campaign Journal.pdf'],
  ['DMs Character Tracker',        134, 134, 'Tracking Sheets/DMs Character Tracker.pdf'],
  ['Campaign Conflicts',           136, 136, 'Tracking Sheets/Campaign Conflicts.pdf'],
  ['Magic Item Tracker',           223, 223, 'Tracking Sheets/Magic Item Tracker.pdf'],
  ['Bastion Tracker',              357, 357, 'Tracking Sheets/Bastion Tracker.pdf'],
];

/**
 * Recursively delete the output directory.
 */
function cleanOutputDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += cleanOutputDir(fullPath);
      fs.rmdirSync(fullPath);
    } else if (entry.name.endsWith('.pdf')) {
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

  if (doClean) {
    console.log('Cleaning output directory...');
    const removed = cleanOutputDir(OUT);
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
      const clampedEnd = Math.min(end, totalPages);
      console.log(`    ${name.padEnd(44)} pp ${String(start).padStart(3)}-${String(clampedEnd).padStart(3)}  (${String(pages).padStart(3)} pg)  → ${outPath}`);
      if (start < 1 || start > totalPages) {
        console.log(`      ⚠ START OUT OF RANGE (total pages: ${totalPages})`);
      }
      if (end > totalPages) {
        console.log(`      ⚠ END CLAMPED from ${end} to ${totalPages}`);
      }
      if (start > end) {
        console.log(`      ⚠ INVALID RANGE: start > end`);
      }
    }

    // Stats
    const chapterSubs = (prefix) => SECTIONS.filter(s => s[3].startsWith(prefix) && !s[0].includes('(All)') && !s[0].startsWith('Chapter'));
    const toolboxFiles = SECTIONS.filter(s => s[3].startsWith('03 - DMs Toolbox/') && !s[0].includes('(All)'));
    const greyhawkFiles = SECTIONS.filter(s => s[3].includes('Greyhawk/') && !s[0].includes('(All)'));
    const treasureFiles = SECTIONS.filter(s => s[3].startsWith('07 - Treasure/'));
    const mapFiles = SECTIONS.filter(s => s[3].startsWith('10 - Maps/') && !s[0].startsWith('All'));
    const trackingFiles = SECTIONS.filter(s => s[3].startsWith('Tracking Sheets/'));

    console.log(`\n  Total sections: ${SECTIONS.length}`);
    console.log(`    Ch1 sub-sections:     ${chapterSubs('01 -').length}`);
    console.log(`    Ch2 sub-sections:     ${chapterSubs('02 -').length}`);
    console.log(`    DMs Toolbox topics:   ${toolboxFiles.length}`);
    console.log(`    Ch4 sub-sections:     ${chapterSubs('04 -').length}`);
    console.log(`    Ch5 sub-sections:     ${chapterSubs('05 - Campaigns/').filter(s => !s[3].includes('Greyhawk/')).length}`);
    console.log(`    Greyhawk sections:    ${greyhawkFiles.length}`);
    console.log(`    Ch6 sub-sections:     ${chapterSubs('06 -').length}`);
    console.log(`    Treasure sections:    ${treasureFiles.length}`);
    console.log(`    Ch8 sub-sections:     ${chapterSubs('08 -').length}`);
    console.log(`    Individual maps:      ${mapFiles.length}`);
    console.log(`    Tracking sheets:      ${trackingFiles.length}`);
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

    const clampedEnd = Math.min(end, totalPages);
    const fullPath = path.join(OUT, outPath);
    const pages = clampedEnd - start + 1;
    process.stdout.write(`    ${name} (pp ${start}-${clampedEnd}, ${pages} pg) ... `);

    if (start < 1 || start > totalPages || start > clampedEnd) {
      console.log('SKIPPED (invalid range)');
      continue;
    }

    const newDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let i = start - 1; i <= clampedEnd - 1; i++) {
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
