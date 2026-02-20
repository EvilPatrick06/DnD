/**
 * Convert DMG 2024 battle map PDFs to PNG images using Poppler pdftoppm.
 *
 * Usage: node scripts/convert-maps.js
 *
 * Input:  5.5e References/DMG2024/DM/10 - Maps/*.pdf (individual map PDFs)
 * Output: src/renderer/public/data/5e/maps/{kebab-name}.png at 200 DPI
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POPPLER_BIN = String.raw`C:\Users\evilp\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin\pdftoppm.exe`;
const MAPS_DIR = path.join(__dirname, '..', '5.5e References', 'DMG2024', 'DM', '10 - Maps');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'maps');
const DPI = 200;

// Map PDF filenames to output kebab-case IDs
const MAP_FILES = [
  { pdf: 'Barrow Crypt.pdf', id: 'barrow-crypt', name: 'Barrow Crypt' },
  { pdf: 'Caravan Encampment.pdf', id: 'caravan-encampment', name: 'Caravan Encampment' },
  { pdf: 'Crossroads Village.pdf', id: 'crossroads-village', name: 'Crossroads Village' },
  { pdf: 'Dragons Lair.pdf', id: 'dragons-lair', name: "Dragon's Lair" },
  { pdf: 'Dungeon Hideout.pdf', id: 'dungeon-hideout', name: 'Dungeon Hideout' },
  { pdf: 'Farmstead.pdf', id: 'farmstead', name: 'Farmstead' },
  { pdf: 'Keep.pdf', id: 'keep', name: 'Keep' },
  { pdf: 'Manor.pdf', id: 'manor', name: 'Manor' },
  { pdf: 'Mine.pdf', id: 'mine', name: 'Mine' },
  { pdf: 'Roadside Inn.pdf', id: 'roadside-inn', name: 'Roadside Inn' },
  { pdf: 'Ship.pdf', id: 'ship', name: 'Ship' },
  { pdf: 'Spooky House.pdf', id: 'spooky-house', name: 'Spooky House' },
  { pdf: 'Underdark Warren.pdf', id: 'underdark-warren', name: 'Underdark Warren' },
  { pdf: 'Volcanic Caves.pdf', id: 'volcanic-caves', name: 'Volcanic Caves' },
  { pdf: 'Wizards Tower.pdf', id: 'wizards-tower', name: "Wizard's Tower" },
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Verify Poppler exists
if (!fs.existsSync(POPPLER_BIN)) {
  console.error('ERROR: pdftoppm not found at', POPPLER_BIN);
  process.exit(1);
}

let converted = 0;
let skipped = 0;
let failed = 0;

for (const map of MAP_FILES) {
  const pdfPath = path.join(MAPS_DIR, map.pdf);
  // pdftoppm adds a page suffix like -1, so output prefix is the id
  const outputPrefix = path.join(OUTPUT_DIR, map.id);
  const expectedOutput = outputPrefix + '-1.png';
  const finalOutput = path.join(OUTPUT_DIR, map.id + '.png');

  if (fs.existsSync(finalOutput)) {
    console.log(`SKIP: ${map.name} (already exists)`);
    skipped++;
    continue;
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`MISS: ${map.pdf} not found`);
    failed++;
    continue;
  }

  try {
    // Convert PDF to PNG at specified DPI
    // -singlefile would skip the page suffix, but doesn't work reliably on all versions
    // -f 1 -l 1 ensures only first page
    const cmd = `"${POPPLER_BIN}" -png -r ${DPI} -f 1 -l 1 "${pdfPath}" "${outputPrefix}"`;
    execSync(cmd, { stdio: 'pipe' });

    // pdftoppm outputs {prefix}-{page}.png, rename to {prefix}.png
    if (fs.existsSync(expectedOutput) && !fs.existsSync(finalOutput)) {
      fs.renameSync(expectedOutput, finalOutput);
    } else if (fs.existsSync(outputPrefix + '-01.png')) {
      fs.renameSync(outputPrefix + '-01.png', finalOutput);
    }

    if (fs.existsSync(finalOutput)) {
      const stats = fs.statSync(finalOutput);
      console.log(`OK:   ${map.name} -> ${map.id}.png (${(stats.size / 1024).toFixed(0)} KB)`);
      converted++;
    } else {
      console.error(`FAIL: ${map.name} - output file not created`);
      failed++;
    }
  } catch (err) {
    console.error(`FAIL: ${map.name} - ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${failed} failed`);
