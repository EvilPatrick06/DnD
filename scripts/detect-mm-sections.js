/**
 * Detect Monster Manual 2024 section boundaries by extracting text from each page.
 *
 * Usage:
 *   node scripts/detect-mm-sections.js                  # full extraction + detection
 *   node scripts/detect-mm-sections.js --text-only       # dump text only, skip detection
 *   node scripts/detect-mm-sections.js --pages 10-20     # process only specified page range
 *   node scripts/detect-mm-sections.js --summary         # skip text dump, only print detection summary
 *
 * Output (in 5.5e References/MM2025/):
 *   _mm_text_dump.txt              — full page-by-page text
 *   _mm_detected_sections.json     — detected entries with page ranges
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const SRC = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Monster Manual 2024.pdf');
const OUT_DIR = path.join(__dirname, '..', '5.5e References', 'MM2025');
const TEXT_DUMP = path.join(OUT_DIR, '_mm_text_dump.txt');
const SECTIONS_JSON = path.join(OUT_DIR, '_mm_detected_sections.json');

// ── Creature type and size keywords ──────────────────────────────────────────
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const CREATURE_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental',
  'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead',
];

// Stat block markers — a page with 3+ of these is likely a stat block page
const STAT_MARKERS = [
  /AC\s+\d/i,
  /HP\s+\d/i,
  /Speed\s+\d+\s*ft/i,
  /STR.*DEX.*CON/i,
];

// Pattern: "Size CreatureType" (e.g., "Large Fiend", "Medium Humanoid (Elf)")
const SIZE_TYPE_RE = new RegExp(
  `\\b(${SIZES.join('|')})\\s+(${CREATURE_TYPES.join('|')})\\b`,
  'i'
);

// ── CLI argument parsing ─────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { textOnly: false, summary: false, pageRange: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--text-only') opts.textOnly = true;
    else if (args[i] === '--summary') opts.summary = true;
    else if (args[i] === '--pages' && args[i + 1]) {
      const m = args[++i].match(/^(\d+)-(\d+)$/);
      if (m) opts.pageRange = [parseInt(m[1]), parseInt(m[2])];
      else { console.error('Invalid --pages format. Use: --pages 10-20'); process.exit(1); }
    }
  }
  return opts;
}

// ── Detection heuristics ─────────────────────────────────────────────────────

/**
 * Count how many stat block markers appear on a page.
 */
function countStatMarkers(text) {
  return STAT_MARKERS.filter(re => re.test(text)).length;
}

/**
 * Try to extract creature names from a page's text.
 * Looks for "Size CreatureType" patterns and takes the ALL-CAPS text before it
 * as the creature name.
 */
function extractCreatureNames(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const creatures = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = SIZE_TYPE_RE.exec(line);
    if (!match) continue;

    // The creature name is typically the ALL-CAPS line(s) before the Size/Type line.
    // Walk backwards from the current line to find the name.
    let name = '';
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const candidate = lines[j].replace(/[^A-Za-z\s'-]/g, '').trim();
      // Check if this line is mostly uppercase (creature name)
      if (candidate.length >= 2 && candidate === candidate.toUpperCase()) {
        name = candidate;
        break;
      }
      // Also accept Title Case names (some entries format differently)
      if (candidate.length >= 2 && /^[A-Z][a-z]/.test(candidate) && !/\b(the|of|and|or|a|an|in|on|at|to|for|is|it|that|this|with|from|but|not)\b/i.test(candidate.split(' ')[0])) {
        // Only if it looks like a proper name (starts with capital, short)
        if (candidate.split(' ').length <= 5 && !candidate.includes('.')) {
          name = candidate;
          break;
        }
      }
    }

    if (name) {
      // Normalize: Title Case
      const normalized = name.split(/\s+/).map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      creatures.push({
        name: normalized,
        size: match[1],
        type: match[2],
        lineIndex: i,
      });
    }
  }

  return creatures;
}

/**
 * Detect monster entry boundaries across all pages.
 */
function detectEntries(pages) {
  const entries = [];
  const seen = new Set();

  for (const page of pages) {
    const text = page.text;
    const markerCount = countStatMarkers(text);
    const creatures = extractCreatureNames(text);

    for (const creature of creatures) {
      // Skip duplicates on the same page (lair stat blocks repeat the name)
      const key = `${creature.name}-${page.num}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Confidence: higher if more stat markers on this page
      let confidence = 'low';
      if (markerCount >= 3) confidence = 'high';
      else if (markerCount >= 2) confidence = 'medium';

      entries.push({
        name: creature.name,
        size: creature.size,
        type: creature.type,
        startPage: page.num,
        confidence,
        markerCount,
      });
    }
  }

  // Deduplicate: keep only the first occurrence of each creature name
  // (many monsters have lore pages before their stat block page)
  const deduped = [];
  const namesSeen = new Map();
  for (const entry of entries) {
    if (!namesSeen.has(entry.name)) {
      namesSeen.set(entry.name, deduped.length);
      deduped.push({ ...entry, endPage: null });
    }
  }

  // Resolve end pages: each entry ends where the next begins (or same page if single-page)
  // Sort by startPage first
  deduped.sort((a, b) => a.startPage - b.startPage);
  for (let i = 0; i < deduped.length; i++) {
    if (i < deduped.length - 1) {
      // End page is the page before the next entry starts,
      // or same page if next starts on same page
      deduped[i].endPage = Math.max(deduped[i].startPage, deduped[i + 1].startPage - 1);
    } else {
      // Last entry — assume it runs to the end of the bestiary section
      deduped[i].endPage = deduped[i].startPage;
    }
  }

  return deduped;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(SRC)) {
    console.error('Source PDF not found:', SRC);
    process.exit(1);
  }

  console.log('Loading Monster Manual 2024 PDF...');
  const data = fs.readFileSync(SRC);
  const parser = new PDFParse({ data });
  const result = await parser.getText({ lineEnforce: true });
  console.log(`Loaded: ${result.pages.length} pages\n`);

  // Filter to page range if specified
  let pages = result.pages;
  if (opts.pageRange) {
    const [start, end] = opts.pageRange;
    pages = pages.filter(p => p.num >= start && p.num <= end);
    console.log(`Filtered to pages ${start}-${end}: ${pages.length} pages\n`);
  }

  // ── Text dump ────────────────────────────────────────────────────────────
  if (!opts.summary) {
    console.log(`Writing text dump to ${TEXT_DUMP}...`);
    const lines = [];
    for (const page of pages) {
      lines.push(`--- PAGE ${page.num} ---`);
      lines.push(page.text);
      lines.push('');
    }
    fs.writeFileSync(TEXT_DUMP, lines.join('\n'), 'utf8');
    console.log(`  Done (${pages.length} pages dumped)\n`);
  }

  if (opts.textOnly) {
    console.log('Text-only mode. Skipping detection.');
    return;
  }

  // ── Detection ────────────────────────────────────────────────────────────
  console.log('Detecting monster entries...\n');
  const entries = detectEntries(pages);

  // Write JSON output
  const output = {
    totalPages: result.pages.length,
    processedPages: pages.length,
    pageRange: opts.pageRange || [1, result.pages.length],
    entriesDetected: entries.length,
    entries,
  };
  fs.writeFileSync(SECTIONS_JSON, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${SECTIONS_JSON}\n`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('=== DETECTION SUMMARY ===\n');
  console.log(`  Total entries detected: ${entries.length}`);

  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const e of entries) byConfidence[e.confidence]++;
  console.log(`  High confidence:   ${byConfidence.high}`);
  console.log(`  Medium confidence:  ${byConfidence.medium}`);
  console.log(`  Low confidence:     ${byConfidence.low}`);

  const byType = {};
  for (const e of entries) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  console.log('\n  By creature type:');
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(14)} ${count}`);
  }

  console.log('\n  Entries:');
  for (const e of entries) {
    const conf = e.confidence === 'high' ? ' ' : e.confidence === 'medium' ? '?' : '!';
    console.log(`  ${conf} ${e.name.padEnd(35)} pp ${String(e.startPage).padStart(3)}-${String(e.endPage).padStart(3)}  ${e.size} ${e.type}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
