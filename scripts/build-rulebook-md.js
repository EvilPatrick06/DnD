/**
 * build-rulebook-md.js
 *
 * Extracts text from the full PHB, DMG, and MM PDFs and converts them
 * into structured markdown files for the AI DM chunk-builder.
 *
 * Strips: cover art, credits, TOC, index, art captions, page headers/footers.
 * Keeps: all chapter content, rules, flavor text, tables, appendices.
 *
 * Usage:
 *   $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
 *   node scripts/build-rulebook-md.js
 *
 * Output:
 *   5.5e References/DM/Player's Handbook (2024).md
 *   5.5e References/DM/Dungeon Master's Guide (2024).md
 *   5.5e References/DM/Monster Manual (2025).md
 */

const { PDFParse } = require('pdf-parse')
const fs = require('fs')
const path = require('path')

const PROJECT_DIR = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(PROJECT_DIR, '5.5e References', 'DM')
const REFS_DIR = path.join(PROJECT_DIR, '5.5e References')

// Source PDFs
const PHB_PDF = path.join(REFS_DIR, 'PHB2024', 'PlayersHandbook2024.pdf')
const DMG_PDF = path.join(REFS_DIR, 'DMG2024', 'Dungeon_Masters_Guide_2024.pdf')
const MM_PDF = path.join(REFS_DIR, 'MM2025', 'Monster Manual 2024.pdf')

// ─── Helpers ───────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function extractPdfText(pdfPath) {
  console.log(`  Reading ${path.basename(pdfPath)} (${(fs.statSync(pdfPath).size / 1e6).toFixed(1)} MB)...`)
  const buf = fs.readFileSync(pdfPath)
  const uint8 = new Uint8Array(buf)
  const parser = new PDFParse(uint8)

  // Suppress pdf.js font warnings
  const origWarn = console.warn
  console.warn = () => {}
  const result = await parser.getText()
  console.warn = origWarn

  console.log(`  Extracted ${result.total} pages, ${result.text.length} chars`)
  return result
}

// ─── Boilerplate Removal ───────────────────────────────────────────

/**
 * Remove ALL lines that look like TOC entries (dot leaders + page numbers).
 * Also removes isolated page number lines and dot-only lines.
 */
function removeTocLines(text) {
  const lines = text.split('\n')
  const result = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Lines with dot leaders: "Barbarian .... 50" or ".... 50"
    if (/\.{3,}/.test(trimmed)) continue
    // Isolated page numbers: just "50" or "374" on their own
    if (/^\d{1,3}\s*$/.test(trimmed)) continue
    // Page marker lines from PDF extraction: "-- 8 of 388 --"
    if (/^--\s*\d+ of \d+\s*--$/.test(trimmed)) continue
    result.push(line)
  }

  return result.join('\n')
}

/**
 * Remove credits, copyright, legal text, and cover page garbage.
 */
function removeCredits(text) {
  let cleaned = text
  // Remove CREDITS blocks
  cleaned = cleaned.replace(/CREDITS[\s\S]*?(?=\n[A-Z]{4,}\n|\n#{1,3}\s)/g, '')
  // Remove copyright/legal lines
  cleaned = cleaned.replace(/^.*©\s*\d{4}.*$/gm, '')
  cleaned = cleaned.replace(/^.*Wizards\s+o\s*f\s+the\s+Coast.*$/gm, '')
  cleaned = cleaned.replace(/^.*All Rights Reserved.*$/gm, '')
  cleaned = cleaned.replace(/^.*Hasbro.*$/gim, '')
  cleaned = cleaned.replace(/^.*ISBN.*$/gm, '')
  cleaned = cleaned.replace(/^.*Printed in.*$/gm, '')
  cleaned = cleaned.replace(/^.*trademark.*$/gim, '')
  cleaned = cleaned.replace(/^.*FABRIQUE.*$/gm, '')
  cleaned = cleaned.replace(/^.*CONTENU.*$/gm, '')
  cleaned = cleaned.replace(/^.*Importé.*$/gm, '')
  cleaned = cleaned.replace(/^.*Manufactured by.*$/gim, '')
  cleaned = cleaned.replace(/^.*Represented by.*$/gim, '')
  // Remove artist credit lines
  cleaned = cleaned.replace(/^.*\b(illustrat|Cover Art|Interior Art|Art Director|Graphic Design|Lead Design|Editor|Playtest)\b.*$/gim, '')
  return cleaned
}

/**
 * Remove index sections at end of book.
 */
function removeIndex(text) {
  const indexMatch = text.match(/\nINDEX\n/i)
  if (indexMatch && indexMatch.index > text.length * 0.85) {
    return text.substring(0, indexMatch.index)
  }
  return text
}

/**
 * Remove OCR garbage: lines of non-text characters from scanned art/borders.
 */
function removeOcrGarbage(text) {
  const lines = text.split('\n')
  const result = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip decorative/border OCR artifacts
    if (/^[-~=_.·•*:;<>{}|\\/'`^]+$/.test(trimmed)) continue
    // Skip lines that are all non-alphanumeric (garbled OCR from images)
    if (trimmed.length > 0 && trimmed.length < 30 && !/[a-zA-Z0-9]/.test(trimmed)) continue
    // Skip very short fragments that are just OCR noise (1-2 chars, no meaning)
    if (trimmed.length === 1 && /[^a-zA-Z0-9]/.test(trimmed)) continue
    if (trimmed.length === 2 && /^[^a-zA-Z]+$/.test(trimmed)) continue
    // Skip lines with mostly spaced-out single characters (OCR letter-spacing artifact)
    // e.g. "I N G S ," or "S O N" or "A I R"
    if (trimmed.length >= 3) {
      const stripped = trimmed.replace(/\s+/g, '')
      // If removing spaces reduces length by > 40% and original has spaces, it's letter-spaced
      if (stripped.length > 0 && (trimmed.length - stripped.length) / trimmed.length > 0.4 &&
          stripped.length <= 10 && /\s/.test(trimmed)) {
        continue
      }
    }
    result.push(line)
  }

  return result.join('\n')
}

/**
 * Skip the first N lines of cover/credits OCR garbage.
 * Finds where real content begins by looking for the first substantial paragraph.
 */
function skipFrontMatter(text, contentStartMarker) {
  if (contentStartMarker) {
    const idx = text.indexOf(contentStartMarker)
    if (idx > 0 && idx < text.length * 0.1) {
      return text.substring(idx)
    }
  }
  // Fallback: find first line > 100 chars with real English text
  const lines = text.split('\n')
  for (let i = 0; i < Math.min(lines.length, 500); i++) {
    if (lines[i].length > 100 && /[a-z]{3,}\s+[a-z]{3,}/i.test(lines[i]) &&
        !lines[i].includes('trademark') && !lines[i].includes('Wizards')) {
      let start = i
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        if (lines[j].trim() === '' || /^[A-Z]{3,}/.test(lines[j].trim())) {
          start = j
          break
        }
      }
      return lines.slice(start).join('\n')
    }
  }
  return text
}

/**
 * Core OCR cleanup: fix hyphenation, collapse whitespace, clean artifacts.
 */
function cleanOcrText(text) {
  let cleaned = text
  // Remove form-feed / page separators
  cleaned = cleaned.replace(/\f/g, '\n\n')
  // Remove page number + chapter header/footer lines (various formats)
  cleaned = cleaned.replace(/^\d+\s+(CHAPTER \d+\s*\|[^\n]*)/gm, '')
  cleaned = cleaned.replace(/^(CHAPTER \d+\s*\|[^\n]*)\s+\d+\s*$/gm, '')
  cleaned = cleaned.replace(/^CHAPTER \d+\s*\|[^\n]*$/gm, '')
  cleaned = cleaned.replace(/^[A-Z][A-Z\s']+\|\s*CHAPTER \d+\s*$/gm, '')
  cleaned = cleaned.replace(/^--\s*\d+ of \d+\s*--$/gm, '')
  // Fix hyphenated line breaks (word-\nrest → wordrest)
  cleaned = cleaned.replace(/(\w)-\n(\w)/g, '$1$2')
  // Collapse excessive blank lines
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n')
  // Normalize tabs to spaces
  cleaned = cleaned.replace(/\t+/g, ' ')
  return cleaned.trim()
}

/**
 * Join fragmented lines that are clearly mid-sentence OCR artifacts.
 * Consecutive short lines that form a paragraph get merged.
 */
function joinFragmentedLines(text) {
  const lines = text.split('\n')
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    // Never join blank lines, headings, or lines that look structural
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-') ||
        trimmed.startsWith('*') || trimmed.startsWith('|') ||
        /^\d+[.)]/.test(trimmed) || /^(AC|HP|DC|CR|XP)\s/i.test(trimmed)) {
      result.push(lines[i])
      continue
    }

    // Check if this is a short fragment that should be joined to the next line
    if (trimmed.length < 40 && i + 1 < lines.length) {
      const next = lines[i + 1].trim()

      // Join if next line starts with lowercase (continuation of sentence)
      // or current line ends without sentence-ending punctuation
      if (next && !next.startsWith('#') && !next.startsWith('-') &&
          !next.startsWith('|') && !/^\d+[.)]/.test(next) &&
          // Next line starts with lowercase letter — strong signal of continuation
          /^[a-z]/.test(next) &&
          // Current line doesn't end a sentence
          !/[.!?:;]$/.test(trimmed) &&
          // Current line is actual text (has letters)
          /[a-zA-Z]{2,}/.test(trimmed) &&
          // Don't join ALL CAPS lines (potential headings)
          trimmed !== trimmed.toUpperCase()) {
        // Join with next line
        const joined = trimmed + ' ' + next
        lines[i + 1] = joined  // Replace next line with joined content
        continue  // Skip this line (it's now part of next)
      }
    }

    result.push(lines[i])
  }

  return result.join('\n')
}

/**
 * Full cleaning pipeline for all books.
 * contentStartMarker: a string that appears where real content begins.
 */
function fullClean(text, contentStartMarker) {
  let cleaned = text
  cleaned = skipFrontMatter(cleaned, contentStartMarker)
  cleaned = removeTocLines(cleaned)
  cleaned = removeCredits(cleaned)
  cleaned = removeIndex(cleaned)
  cleaned = removeOcrGarbage(cleaned)
  cleaned = cleanOcrText(cleaned)
  cleaned = joinFragmentedLines(cleaned)
  return cleaned
}

// ─── Heading Detection ─────────────────────────────────────────────

/**
 * Apply heading detectors to text lines.
 * When dedupeH2 is true, each unique ## heading is only emitted once
 * (subsequent occurrences are page headers and get dropped).
 */
function addMarkdownHeadings(text, detectors, { dedupeH2 = false } = {}) {
  const lines = text.split('\n')
  const result = []
  const seenH2 = new Set()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      result.push('')
      continue
    }

    let matched = false
    for (const detector of detectors) {
      const match = detector(trimmed, i, lines)
      if (match) {
        // Deduplication: skip repeat ## headings (page headers)
        if (dedupeH2 && match.startsWith('## ')) {
          if (seenH2.has(match)) {
            // Drop the line entirely — it's a page header
            matched = true
            break
          }
          seenH2.add(match)
        }

        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('')
        }
        result.push(match)
        matched = true
        break
      }
    }

    if (!matched) {
      result.push(line)
    }
  }

  return result.join('\n')
}

function titleCase(str) {
  const lower = str.toLowerCase()
  const small = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
    'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it'])
  return lower.replace(/\b\w+/g, (word, idx) => {
    if (idx === 0 || !small.has(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    return word
  })
}

// ─── Shared: creature type regex for stat block context detection ──

const CREATURE_TYPES_RE = /\b(Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)\b/i

/**
 * Check if the next few lines after a potential monster name contain
 * a "Habitat:" line (present in every 2024 MM monster entry).
 * Pattern: MONSTER NAME / [Tagline] / Habitat: ...; Treasure: ...
 * Also accepts Size+Type stat block header as alternative signal.
 */
const STAT_BLOCK_HEADER_RE = /^\s*(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(Aberration|Beast|Celestial|Construct|Dragon|Elemental|Fey|Fiend|Giant|Humanoid|Monstrosity|Ooze|Plant|Undead)/i

function hasStatBlockContext(lineIdx, allLines) {
  let checked = 0
  for (let j = lineIdx + 1; j < Math.min(allLines.length, lineIdx + 8); j++) {
    const next = allLines[j].trim()
    if (!next) continue
    // 2024 MM format: "Habitat: Underdark; Treasure: Relics"
    if (/^Habitat:/i.test(next)) return true
    // Fallback: direct stat block header (for animals/beasts appendix entries)
    if (STAT_BLOCK_HEADER_RE.test(next)) return true
    if (++checked >= 4) break
  }
  return false
}

// ─── PHB ───────────────────────────────────────────────────────────

const PHB_CLASSES = new Set([
  'BARBARIAN', 'BARD', 'CLERIC', 'DRUID', 'FIGHTER',
  'MONK', 'PALADIN', 'RANGER', 'ROGUE', 'SORCERER',
  'WARLOCK', 'WIZARD'
])

const PHB_SUBCLASSES = new Set([
  'PATH OF THE BERSERKER', 'PATH OF THE WILD HEART', 'PATH OF THE WORLD TREE', 'PATH OF THE ZEALOT',
  'COLLEGE OF DANCE', 'COLLEGE OF GLAMOUR', 'COLLEGE OF LORE', 'COLLEGE OF VALOR',
  'LIFE DOMAIN', 'LIGHT DOMAIN', 'TRICKERY DOMAIN', 'WAR DOMAIN',
  'CIRCLE OF THE LAND', 'CIRCLE OF THE MOON', 'CIRCLE OF THE SEA', 'CIRCLE OF THE STARS',
  'BATTLE MASTER', 'CHAMPION', 'ELDRITCH KNIGHT', 'PSI WARRIOR',
  'WARRIOR OF MERCY', 'WARRIOR OF SHADOW', 'WARRIOR OF THE ELEMENTS', 'WARRIOR OF THE OPEN HAND',
  'OATH OF DEVOTION', 'OATH OF GLORY', 'OATH OF THE ANCIENTS', 'OATH OF VENGEANCE',
  'BEAST MASTER', 'FEY WANDERER', 'GLOOM STALKER', 'HUNTER',
  'ARCANE TRICKSTER', 'ASSASSIN', 'SOULKNIFE', 'THIEF',
  'ABERRANT SORCERY', 'CLOCKWORK SORCERY', 'DRACONIC SORCERY', 'WILD MAGIC SORCERY',
  'ARCHFEY PATRON', 'CELESTIAL PATRON', 'FIEND PATRON', 'GREAT OLD ONE PATRON',
  'ABJURER', 'DIVINER', 'EVOKER', 'ILLUSIONIST'
])

const PHB_SPECIES = new Set([
  'AASIMAR', 'DRAGONBORN', 'DWARF', 'ELF', 'GNOME',
  'GOLIATH', 'HALFLING', 'HUMAN', 'ORC', 'TIEFLING'
])

const PHB_CHAPTER_NAMES = [
  'CREATING A CHARACTER', 'CHARACTER ORIGINS', 'CHARACTER CLASSES',
  'FEATS', 'EQUIPMENT', 'SPELLS', 'PLAYING THE GAME',
  'RULES GLOSSARY', 'SPELL DESCRIPTIONS'
]

function buildPhbDetectors() {
  const spellNames = loadSrdSpellNames()
  const featNames = loadSrdFeatNames()

  return [
    // Chapter-level headings (##)
    (line) => {
      const upper = line.toUpperCase()
      for (const ch of PHB_CHAPTER_NAMES) {
        if (upper === ch) return `## ${titleCase(line)}`
      }
      return null
    },
    // Class names as sections (##)
    (line) => {
      if (PHB_CLASSES.has(line.toUpperCase().trim())) {
        return `## ${titleCase(line)}`
      }
      return null
    },
    // Subclass names (###)
    (line) => {
      if (PHB_SUBCLASSES.has(line.toUpperCase().trim())) {
        return `### ${titleCase(line)}`
      }
      return null
    },
    // Species names (###)
    (line) => {
      if (PHB_SPECIES.has(line.toUpperCase().trim())) {
        return `### ${titleCase(line)}`
      }
      return null
    },
    // Level features: "Level 1: Rage"
    (line) => {
      const m = line.match(/^(?:LEVEL|Level)\s+(\d+):\s+(.+)$/i)
      if (m) return `#### Level ${m[1]}: ${m[2].trim()}`
      return null
    },
    // Spell names from SRD data (####)
    (line, i, lines) => {
      const normalized = normalizeForCuratedMatch(line)
      const displayName = spellNames.get(normalized)
      if (!displayName) return null
      // Context: next non-empty line must contain spell header keywords
      // Uses flexible matching to handle OCR-fragmented text (e.g., "Evo ca t ion Cantrip")
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].trim()
        if (!next) continue
        if (/\bLevel\s+\d|\bCantrip\b/i.test(next)) {
          return `#### ${displayName}`
        }
        break
      }
      return null
    },
    // Feat names from SRD data (####)
    (line, i, lines) => {
      const normalized = normalizeForCuratedMatch(line)
      const displayName = featNames.get(normalized)
      if (!displayName) return null
      // Context: next non-empty line must mention "Feat" or "Boon"
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const next = lines[j].trim()
        if (!next) continue
        if (/\b(Feat|Boon)\b/i.test(next)) {
          return `#### ${displayName}`
        }
        break
      }
      return null
    },
    // Glossary terms (####) — only in the last 5% of the document, ALL CAPS only
    (line, i, lines) => {
      if (i < lines.length * 0.95) return null
      // Must be ALL CAPS (glossary entries are uppercase in the OCR)
      if (line !== line.toUpperCase()) return null
      // Strip [CONDITION], [ACTION], [HAZARD] suffixes (already fixed by fixOcrSplitTerms)
      let term = line.toUpperCase().trim()
      let suffix = ''
      const suffixMatch = term.match(/\s*\[(CONDITION|ACTION|HAZARD)\]\s*$/)
      if (suffixMatch) {
        suffix = suffixMatch[1]
        term = term.replace(suffixMatch[0], '').trim()
      }
      const normalized = normalizeForCuratedMatch(term)
      if (!PHB_GLOSSARY_TERMS.has(normalized)) return null
      const display = titleCase(normalized)
      if (suffix === 'CONDITION') return `#### ${display} (Condition)`
      if (suffix === 'ACTION') return `#### ${display} (Action)`
      if (suffix === 'HAZARD') return `#### ${display} (Hazard)`
      return `#### ${display}`
    },
    // ALL CAPS section headers (2+ words, reasonable length)
    (line) => {
      if (line.length >= 5 && line.length <= 80 &&
          line === line.toUpperCase() &&
          /^[A-Z][A-Z\s,'.&:()-]+$/.test(line) &&
          line.split(/\s+/).length >= 2 &&
          line.split(/\s+/).every(w => w.length >= 2) &&
          !/^\d/.test(line)) {
        return `### ${titleCase(line)}`
      }
      return null
    }
  ]
}

// ─── DMG ───────────────────────────────────────────────────────────

const DMG_CHAPTER_MAP = {
  'THE BASICS': 1, 'RUNNING THE GAME': 2, "DM'S TOOLBOX": 3,
  'DMS TOOLBOX': 3, 'CREATING ADVENTURES': 4, 'CAMPAIGNS': 5,
  'COSMOLOGY': 6, 'TREASURE': 7, 'BASTIONS': 8, 'LORE GLOSSARY': 9
}

function buildDmgDetectors() {
  const magicItemNames = loadSrdMagicItemNames()

  return [
    // Chapter headings (deduplicated via addMarkdownHeadings dedupeH2)
    (line) => {
      const upper = line.toUpperCase().trim()
      for (const [title, num] of Object.entries(DMG_CHAPTER_MAP)) {
        if (upper === title || upper === `CHAPTER ${num}: ${title}`) {
          return `## Chapter ${num}: ${titleCase(title)}`
        }
      }
      return null
    },
    // Magic item names from SRD data (####)
    (line, i, lines) => {
      // Try single line first
      let normalized = normalizeForCuratedMatch(line)
      let displayName = magicItemNames.get(normalized)
      let joined = false
      // Try joining with next line for split names (e.g., "ADAMANTINE\nARMOR")
      if (!displayName && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (nextLine && nextLine === nextLine.toUpperCase() && nextLine.length < 30) {
          const joinedNorm = normalizeForCuratedMatch(line + ' ' + nextLine)
          displayName = magicItemNames.get(joinedNorm)
          if (displayName) joined = true
        }
      }
      if (!displayName) return null
      // Context: within next 3 non-empty lines, look for item type/rarity keywords
      let checked = 0
      const searchStart = joined ? i + 2 : i + 1
      for (let j = searchStart; j < Math.min(lines.length, searchStart + 5); j++) {
        const next = lines[j].trim()
        if (!next) continue
        if (/\b(Armor|Weapon|Wondrous|Ring|Rod|Staff|Potion|Scroll|Wand|Common|Uncommon|Rare|Very Rare|Legendary|Attunement)\b/i.test(next)) {
          if (joined) lines[i + 1] = '' // consume the second line of the split name
          return `#### ${displayName}`
        }
        if (++checked >= 3) break
      }
      return null
    },
    // ALL CAPS section headers (exclude short/noise)
    (line) => {
      if (line.length >= 8 && line.length <= 80 &&
          line === line.toUpperCase() &&
          /^[A-Z][A-Z\s,'.&:()-]+$/.test(line) &&
          line.split(/\s+/).length >= 2 &&
          line.split(/\s+/).every(w => w.length >= 2) &&
          !/^\d/.test(line) && !line.startsWith('TABLE')) {
        return `### ${titleCase(line)}`
      }
      return null
    },
    // Mixed-case sub-headings (Title Case line followed by substantial text)
    (line, i, lines) => {
      if (line.length >= 5 && line.length <= 60 &&
          /^[A-Z][a-z]+(\s+[A-Za-z']+)+$/.test(line) &&
          i + 1 < lines.length && lines[i + 1].trim().length > 40) {
        const words = line.split(/\s+/)
        const caps = words.filter(w => /^[A-Z]/.test(w))
        if (caps.length >= words.length * 0.6 && words.length <= 6) {
          return `#### ${line}`
        }
      }
      return null
    }
  ]
}

// ─── MM ────────────────────────────────────────────────────────────

// Comprehensive curated list of 2024 Monster Manual monster/creature family names.
// Used for OCR-tolerant heading detection (compare after normalizing whitespace).
const MM_MONSTER_NAMES = new Set([
  // A
  'AARAKOCRA', 'ABOLETH', 'AIR ELEMENTAL', 'ANGEL', 'ANIMATED ARMOR',
  'ANIMATED OBJECTS', 'ANKHEG', 'ARCANALOTH', 'ARCH-HAG',
  'ASSASSIN', 'AWAKENED SHRUB', 'AWAKENED TREE', 'AWAKENED PLANTS',
  'AXE BEAK', 'GIANT AXE BEAK', 'AZER', 'AZER SENTINEL', 'AZER PYROMANCER', 'AZERS',
  // B
  'BALOR', 'BANDIT', 'BANDIT CAPTAIN', 'BANDITS',
  'BANSHEE', 'BARBED DEVIL', 'BARLGURA', 'BASILISK',
  'BEARDED DEVIL', 'BEHIR', 'BEHOLDER',
  'BERSERKER', 'BERSERKER COMMANDER', 'BERSERKERS',
  'BLACK DRAGON WYRMLING', 'YOUNG BLACK DRAGON', 'ADULT BLACK DRAGON', 'ANCIENT BLACK DRAGON', 'BLACK DRAGONS',
  'BLACK PUDDING', 'NEEDLE BLIGHT', 'TWIG BLIGHT', 'VINE BLIGHT', 'TREE BLIGHT', 'BLIGHTS',
  'BLINK DOG', 'BLOB OF ANNIHILATION',
  'BLUE DRAGON WYRMLING', 'YOUNG BLUE DRAGON', 'ADULT BLUE DRAGON', 'ANCIENT BLUE DRAGON', 'BLUE DRAGONS',
  'BONE DEVIL', 'BONE NAGA',
  'BRASS DRAGON WYRMLING', 'YOUNG BRASS DRAGON', 'ADULT BRASS DRAGON', 'ANCIENT BRASS DRAGON', 'BRASS DRAGONS',
  'BRONZE DRAGON WYRMLING', 'YOUNG BRONZE DRAGON', 'ADULT BRONZE DRAGON', 'ANCIENT BRONZE DRAGON', 'BRONZE DRAGONS',
  'BUGBEAR', 'BUGBEAR SHADOW', 'BUGBEARS',
  'BULETTE', 'BULETTE PUP', 'BULETTES',
  'BULLYWUG', 'BULLYWUG BOG SAGE', 'BULLYWUG CROAK PRIEST',
  // C
  'CAMBION', 'CARRION CRAWLER', 'CENTAUR', 'CENTAUR TROOPER', 'CENTAUR WARDEN',
  'CHAIN DEVIL', 'CHASME', 'CHIMERA', 'CHUUL',
  'CLAY GOLEM', 'CLOUD GIANT', 'COCKATRICE', 'COCKATRICE REGENT', 'COCKATRICES',
  'COLOSSUS', 'COMMONER',
  'COPPER DRAGON WYRMLING', 'YOUNG COPPER DRAGON', 'ADULT COPPER DRAGON', 'ANCIENT COPPER DRAGON', 'COPPER DRAGONS',
  'CRAWLING CLAW', 'CRAWLING CLAWS',
  'CULTIST', 'CULTIST FANATIC', 'CULTIST HIEROPHANT', 'ELEMENTAL CULTIST', 'FIEND CULTIST', 'CULTISTS',
  'CYCLOPS', 'CYCLOPES',
  // D
  'DAO', 'DARKMANTLE', 'DEATH DOG', 'DEATH KNIGHT', 'DEATH KNIGHT ASPIRANT', 'DEATH KNIGHTS',
  'DEATH TYRANT', 'DEMILICH', 'DISPLACER BEAST',
  'DJINNI', 'DOPPELGANGER', 'DRACOLICH', 'DRETCH', 'DRETCHES',
  'DRIDER', 'DRUID', 'DRYAD',
  // E
  'EARTH ELEMENTAL', 'EFREETI', 'ELEMENTAL CATACLYSM',
  'EMPYREAN', 'EMPYREANS', 'ERINYES', 'ETTIN',
  // F
  'FAERIE DRAGON', 'FAERIE DRAGON YOUTH', 'ADULT FAERIE DRAGON', 'FAERIE DRAGONS',
  'FIRE ELEMENTAL', 'FIRE GIANT', 'FLAMESKULL', 'FLESH GOLEM', 'FLUMPH',
  'FOMORIAN', 'FROST GIANT', 'SHRIEKER FUNGUS', 'VIOLET FUNGUS', 'FUNGI',
  // G
  'GALEB DUHR', 'GARGOYLE', 'GELATINOUS CUBE',
  'GHAST', 'GHAST GRAVECALLER', 'GHASTS',
  'GHOST', 'GHOUL', 'LACEDON GHOUL', 'GHOULS',
  'GIBBERING MOUTHER',
  'GITHYANKI WARRIOR', 'GITHYANKI DRACOMANCER', 'GITHYANKI',
  'GITHZERAI MONK', 'GITHZERAI ANARCH', 'GITHZERAI ZERTH',
  'GLABREZU', 'GLADIATOR',
  'GNOLL', 'GNOLL DEATHSTALKER', 'GNOLL MARAUDER', 'GNOLLS',
  'GOBLIN', 'GOBLIN MINION', 'GOBLIN HEXER', 'GOBLINS',
  'GOLD DRAGON WYRMLING', 'YOUNG GOLD DRAGON', 'ADULT GOLD DRAGON', 'ANCIENT GOLD DRAGON', 'GOLD DRAGONS',
  'GORGON', 'GORISTRO',
  'GRAY OOZE', 'PSYCHIC GRAY OOZE', 'GRAY OOZES',
  'GREEN DRAGON WYRMLING', 'YOUNG GREEN DRAGON', 'ADULT GREEN DRAGON', 'ANCIENT GREEN DRAGON', 'GREEN DRAGONS',
  'GREEN HAG', 'GRELL', 'GRIFFON', 'GRIMLOCK',
  'GUARD', 'GUARD CAPTAIN', 'GUARDS',
  // H
  'HALF-DRAGON', 'HARPY', 'HELL HOUND', 'HELMED HORROR',
  'HEZROU', 'HILL GIANT', 'HOBGOBLIN', 'HOBGOBLIN CAPTAIN', 'HOBGOBLIN WARLORD', 'HOBGOBLINS',
  'HOMUNCULUS', 'HOOK HORROR', 'HORNED DEVIL', 'HYDRA',
  // I
  'ICE DEVIL', 'IMP', 'INCUBUS', 'INVISIBLE STALKER', 'IRON GOLEM',
  // K
  'KENKU', 'KNIGHT', 'QUESTING KNIGHT', 'KNIGHTS',
  'KOBOLD', 'WINGED KOBOLD', 'KOBOLD INVENTOR', 'KOBOLDS',
  'KRAKEN', 'KUO-TOA', 'KUO-TOA ARCHPRIEST',
  // L
  'LAMIA', 'LARVA MAGE', 'LARVAE', 'LEMURE', 'LEMURES', 'LICH',
  'LIZARDFOLK', 'LIZARDFOLK GEOMANCER', 'LIZARDFOLK SOVEREIGN',
  // M
  'MAGE', 'MAGE APPRENTICE', 'MAGES',
  'MANES', 'MANES VAPORSPAWN', 'MANTICORE', 'MARID', 'MARILITH',
  'MEDUSA', 'MEPHIT', 'MEPHITS', 'MAGMA MEPHIT', 'DUST MEPHIT', 'ICE MEPHIT', 'MUD MEPHIT', 'SMOKE MEPHIT', 'STEAM MEPHIT',
  'MERFOLK', 'MERFOLK WAVEBENDER', 'MERROW', 'MEZZOLOTH', 'MIMIC',
  'MIND FLAYER', 'MIND FLAYER ARCANIST', 'MIND FLAYERS',
  'MINOTAUR', 'MINOTAUR OF BAPHOMET',
  'MODRON', 'MODRON DUODRONE', 'MODRON QUADRONE', 'MODRON MONODRONE', 'MODRON PENTADRONE', 'MODRONS',
  'MUMMY', 'MUMMY LORD', 'MUMMIES',
  'MYCONID', 'MYCONID SPROUT', 'MYCONID ADULT', 'MYCONID SOVEREIGN', 'MYCONIDS',
  // N
  'NALFESHNEE', 'NIGHT HAG', 'NIGHTMARE', 'NOBLE', 'NOBLE PRODIGY', 'NOTHIC', 'NYCALOTH',
  // O
  'OGRE', 'OGRILLON OGRE', 'OGRES', 'ONI', 'OTYUGH', 'OWLBEAR',
  // P
  'PEGASUS', 'PERFORMER', 'PERFORMER MAESTRO', 'PERFORMER LEGEND', 'PERFORMERS',
  'PERYTON', 'PHASE SPIDER', 'PIERCER',
  'PIRATE', 'PIRATE ADMIRAL', 'PIRATES',
  'PIT FIEND', 'PIXIE', 'PIXIES', 'PLANETAR', 'POLTERGEIST',
  'PRIEST', 'ARCH PRIEST', 'PRIESTS',
  'PSEUDODRAGON', 'PURPLE WORM',
  // Q
  'QUAGGOTH', 'QUAGGOTH THONOT', 'QUAGGOTHS', 'QUASIT',
  // R
  'RAKSHASA',
  'RED DRAGON WYRMLING', 'YOUNG RED DRAGON', 'ADULT RED DRAGON', 'ANCIENT RED DRAGON', 'RED DRAGONS',
  'REMORHAZ', 'REMORHAZES', 'REVENANT', 'GRAVEYARD REVENANT', 'ROPER', 'RUST MONSTER',
  // S
  'SAHUAGIN', 'SAHUAGIN PRIESTESS', 'SAHUAGIN BARON',
  'SALAMANDER', 'SALAMANDERS', 'SATYR', 'SATYRS', 'SCARECROW',
  'SCOUT', 'SEA HAG', 'SHADOW', 'SHADOW DEMON', 'SHADOW DRAGONS',
  'SHAMBLING MOUND', 'SHIELD GUARDIAN',
  'SILVER DRAGON WYRMLING', 'YOUNG SILVER DRAGON', 'ADULT SILVER DRAGON', 'ANCIENT SILVER DRAGON', 'SILVER DRAGONS',
  'SKELETON', 'FLAMING SKELETON', 'SKELETONS',
  'SLAAD', 'RED SLAAD', 'BLUE SLAAD', 'GREEN SLAAD', 'GRAY SLAAD', 'DEATH SLAAD',
  'SOLAR', 'SPECTATOR', 'SPECTER', 'SPHINX', 'SPHINX OF WONDER', 'SPHINX OF LORE',
  'SPY', 'SPIES', 'SPINED DEVIL', 'SPRITE', 'STIRGE', 'STIRGES',
  'STONE GIANT', 'STONE GOLEM', 'STORM GIANT', 'SUCCUBUS',
  // T
  'TARRASQUE', 'THRI-KREEN', 'THRI-KREEN PSION',
  'TREANT', 'TROGLODYTE', 'TROLL', 'TROLL LIMB',
  // U
  'ULTROLOTH', 'UMBER HULK', 'UNICORN',
  // V
  'VAMPIRE', 'VAMPIRE SPAWN', 'VAMPIRES', 'VROCK',
  // W
  'WARRIOR', 'WARRIOR COMMANDER', 'WARRIORS',
  'WATER ELEMENTAL', 'WATER WEIRD',
  'WEREBEAR', 'WEREBOAR', 'WERERAT', 'WERETIGER', 'WEREWOLF',
  'WHITE DRAGON WYRMLING', 'YOUNG WHITE DRAGON', 'ADULT WHITE DRAGON', 'ANCIENT WHITE DRAGON', 'WHITE DRAGONS',
  'WIGHT', 'WILL-O\'-WISP', 'WINTER WOLF', 'WORG', 'DIRE WORG', 'WORGS', 'WRAITH', 'WYVERN',
  // X-Z
  'XORN', 'YETI', 'ABOMINABLE YETI', 'YETIS', 'YOCHLOL',
  'YUAN-TI', 'YUAN-TI ABOMINATION', 'YUAN-TI MALISON', 'YUAN-TI PUREBLOOD',
  'ZOMBIE', 'ZOMBIES',
  // Beasts & Animals (Appendix)
  'ALLOSAURUS', 'ANKYLOSAURUS', 'APE', 'BABOON', 'BADGER', 'BAT', 'BEAR',
  'BLACK BEAR', 'BROWN BEAR', 'POLAR BEAR',
  'BLOOD HAWK', 'BOAR', 'CAMEL', 'CAT', 'CONSTRICTOR SNAKE',
  'CRAB', 'CROCODILE', 'GIANT CROCODILE', 'DEER', 'DIRE WOLF',
  'DRAFT HORSE', 'EAGLE', 'ELEPHANT',
  'ELK', 'FLYING SNAKE', 'FROG', 'GIANT APE', 'GIANT BAT', 'GIANT BOAR',
  'GIANT CONSTRICTOR SNAKE', 'GIANT CRAB', 'GIANT EAGLE', 'GIANT ELK',
  'GIANT FIRE BEETLE', 'GIANT FROG', 'GIANT GOAT', 'GIANT HYENA',
  'GIANT LIZARD', 'GIANT OCTOPUS', 'GIANT OWL', 'GIANT POISONOUS SNAKE',
  'GIANT RAT', 'GIANT SCORPION', 'GIANT SHARK', 'GIANT SPIDER',
  'GIANT TOAD', 'GIANT VENOMOUS SNAKE', 'GIANT VULTURE', 'GIANT WEASEL',
  'GIANT WOLF SPIDER', 'GOAT', 'HAWK', 'HUNTER SHARK', 'HYENA',
  'JACKAL', 'KILLER WHALE', 'LION', 'LIZARD', 'MAMMOTH', 'MASTIFF',
  'MULE', 'OCTOPUS', 'OWL', 'PANTHER', 'PLESIOSAURUS', 'POISONOUS SNAKE',
  'PTERANODON', 'RAT', 'RAVEN', 'REEF SHARK', 'RHINOCEROS',
  'RIDING HORSE', 'SABER-TOOTHED TIGER', 'SCORPION', 'SEAHORSE',
  'SPIDER', 'SWARM', 'TIGER', 'TRICERATOPS', 'TYRANNOSAURUS REX',
  'VULTURE', 'WARHORSE', 'WEASEL', 'WOLF',
  // Monster group headings
  'ANIMAL LORD', 'ANIMAL LORDS',
])

/**
 * Normalize OCR text for fuzzy monster name matching.
 * Collapses multiple spaces, trims, uppercases.
 */
function normalizeForMatch(text) {
  return text.toUpperCase().replace(/\s+/g, ' ').trim()
}

// ─── SRD Data Loading (for curated heading detection) ──────────────

const SRD_DATA_DIR = path.join(PROJECT_DIR, 'src', 'renderer', 'public', 'data', '5e')

/**
 * Normalize text for matching against curated SRD lists.
 * Strips non-alphanumeric (except apostrophes), collapses whitespace, uppercases.
 */
function normalizeForCuratedMatch(text) {
  return text.replace(/[^a-zA-Z0-9' ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

function loadSrdSpellNames() {
  const data = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'spells.json'), 'utf-8'))
  const map = new Map()
  for (const spell of data) {
    map.set(normalizeForCuratedMatch(spell.name), spell.name)
  }
  return map
}

function loadSrdFeatNames() {
  const data = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'feats.json'), 'utf-8'))
  const map = new Map()
  for (const feat of data) {
    map.set(normalizeForCuratedMatch(feat.name), feat.name)
  }
  return map
}

function loadSrdMagicItemNames() {
  const data = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'magic-items.json'), 'utf-8'))
  const map = new Map()
  for (const item of data) {
    map.set(normalizeForCuratedMatch(item.name), item.name)
  }
  return map
}

/**
 * Hardcoded set of PHB Rules Glossary terms for heading detection.
 * Stored without [CONDITION]/[ACTION] suffixes — the detector strips those.
 */
const PHB_GLOSSARY_TERMS = new Set([
  // Conditions
  'BLINDED', 'CHARMED', 'DEAFENED', 'EXHAUSTION', 'FRIGHTENED',
  'GRAPPLED', 'INCAPACITATED', 'INVISIBLE', 'PARALYZED', 'PETRIFIED',
  'POISONED', 'PRONE', 'RESTRAINED', 'STUNNED', 'UNCONSCIOUS',
  // Actions
  'ATTACK', 'DASH', 'DISENGAGE', 'DODGE', 'HELP', 'HIDE',
  'INFLUENCE', 'MAGIC', 'READY', 'SEARCH', 'STUDY', 'UTILIZE',
  // Core rules terms
  'ABILITY CHECK', 'ABILITY SCORE', 'ACTION', 'ADVANTAGE', 'ALIGNMENT',
  'ALLY', 'AREA OF EFFECT', 'ARMOR CLASS', 'ARMOR TRAINING',
  'ATTACK ROLL', 'ATTITUDE', 'BLOODIED', 'BONUS ACTION',
  'BREAKING OBJECTS', 'BRIGHT LIGHT', 'BURROW SPEED',
  'CAMPAIGN', 'CANTRIP', 'CHALLENGE RATING', 'CHARACTER SHEET',
  'CHARM', 'CLIMB SPEED', 'CONCENTRATION', 'CONDITION', 'CONE',
  'CONJURE', 'COVER', 'CREATURE', 'CREATURE TYPE', 'CRITICAL HIT',
  'CUBE', 'CURE', 'CYLINDER',
  'D20 TEST', 'DAMAGE', 'DAMAGE ROLL', 'DAMAGE TYPE', 'DARKNESS',
  'DEAD', 'DEATH SAVING THROW', 'DEHYDRATION', 'DIFFICULTY CLASS',
  'DIM LIGHT', 'DISADVANTAGE',
  'EMANATION', 'ENCOUNTER', 'ENEMY', 'EQUIPMENT', 'EXPERIENCE POINTS',
  'EXPERTISE',
  'FALLING', 'FEAT', 'FLY SPEED', 'FLYING', 'FRIENDLY',
  'GRAPPLING',
  'HAZARD', 'HEALING', 'HEAVILY OBSCURED', 'HEROIC INSPIRATION',
  'HIT POINT DICE', 'HIT POINTS', 'HOSTILE',
  'ILLUSION', 'IMMUNITY', 'IMPROVISED WEAPON', 'INDIFFERENT', 'INITIATIVE',
  'JUMP',
  'KNOCKING OUT',
  'LEVEL', 'LIGHTLY OBSCURED', 'LINE', 'LONG JUMP', 'LONG REST',
  'MALNUTRITION', 'MELEE ATTACK', 'MONSTER', 'MOUNTED COMBAT',
  'MOVEMENT', 'MULTICLASS',
  'NONPLAYER CHARACTER',
  'OBSERVATION', 'OPPORTUNITY ATTACK',
  'PASSIVE PERCEPTION', 'PER DAY', 'PLAYER CHARACTER', 'POSSESSION',
  'PREPARED SPELL', 'PROFICIENCY', 'PROFICIENCY BONUS',
  'RANGE', 'RANGED ATTACK', 'REACTION', 'RESISTANCE', 'REST',
  'RITUAL', 'ROUND',
  'SAVING THROW', 'SHAPE', 'SHORT REST', 'SIMULTANEOUS EFFECTS',
  'SIZE', 'SKILL', 'SPACE', 'SPEED', 'SPELL', 'SPELL ATTACK',
  'SPELL LEVEL', 'SPELL SAVE DC', 'SPELL SCROLL', 'SPELL SLOT',
  'SPELLCASTING FOCUS', 'SPHERE', 'STARVATION', 'SUFFOCATING',
  'SUMMONS', 'SURPRISE', 'SWIM SPEED',
  'TARGET', 'TELEPATHY', 'TELEPORTATION', 'TEMPORARY HIT POINTS',
  'TERRAIN', 'TOOL', 'TRAP', 'TREMORSENSE', 'TRUESIGHT', 'TURN',
  'TWO-WEAPON FIGHTING',
  'UNARMED STRIKE', 'UNOCCUPIED SPACE',
  'VISION', 'VULNERABILITY',
  'WEAPON', 'WEAPON MASTERY'
])

/**
 * Build a Map<strippedUppercase, correctForm> of all known game terms.
 * Used by fixOcrSplitTerms() to repair OCR word-splitting artifacts.
 */
function buildKnownTermsMap() {
  const map = new Map()

  // Glossary terms
  for (const term of PHB_GLOSSARY_TERMS) {
    map.set(term.replace(/[^A-Z0-9']/g, ''), term)
  }

  // Spell names
  const spells = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'spells.json'), 'utf-8'))
  for (const spell of spells) {
    const upper = spell.name.toUpperCase()
    map.set(upper.replace(/[^A-Z0-9']/g, ''), upper)
  }

  // Feat names
  const feats = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'feats.json'), 'utf-8'))
  for (const feat of feats) {
    const upper = feat.name.toUpperCase()
    map.set(upper.replace(/[^A-Z0-9']/g, ''), upper)
  }

  // Magic item names
  const items = JSON.parse(fs.readFileSync(path.join(SRD_DATA_DIR, 'magic-items.json'), 'utf-8'))
  for (const item of items) {
    const upper = item.name.toUpperCase()
    map.set(upper.replace(/[^A-Z0-9']/g, ''), upper)
  }

  return map
}

/**
 * Fix OCR word-splitting artifacts on ALL CAPS lines.
 * Uses known game term dictionaries to repair split words like
 * "CHARM ED" → "CHARMED", "POISONED [CO N DITIO N]" → "POISONED [CONDITION]".
 */
function fixOcrSplitTerms(text, knownTermsMap) {
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.length > 60) continue
    // Only fix ALL CAPS lines (potential headings)
    if (trimmed !== trimmed.toUpperCase()) continue
    if (!/[A-Z]/.test(trimmed)) continue

    // Fix bracket suffixes: "[CO N DITIO N]" → "[CONDITION]"
    let base = trimmed
    let suffix = ''
    const bracketMatch = base.match(/\s*\[([^\]]+)\]\s*$/)
    if (bracketMatch) {
      const bracketContent = bracketMatch[1].replace(/\s+/g, '')
      if (bracketContent === 'CONDITION') { suffix = ' [CONDITION]'; base = base.replace(bracketMatch[0], '').trim() }
      else if (bracketContent === 'ACTION') { suffix = ' [ACTION]'; base = base.replace(bracketMatch[0], '').trim() }
      else if (bracketContent === 'HAZARD') { suffix = ' [HAZARD]'; base = base.replace(bracketMatch[0], '').trim() }
    }

    // Try to match the base term with spaces removed against known terms
    const stripped = base.replace(/[^A-Z0-9']/g, '')
    if (!stripped) continue

    const correctForm = knownTermsMap.get(stripped)
    const fixedBase = correctForm || base
    const newLine = fixedBase + suffix
    if (newLine !== trimmed) {
      lines[i] = newLine
    }
  }

  return lines.join('\n')
}

function buildMmDetectors() {
  return [
    // Intro sections (##)
    (line) => {
      const upper = line.toUpperCase().trim()
      if (['HOW TO USE A MONSTER', 'STAT BLOCK OVERVIEW', 'MONSTER ENTRIES',
           'PARTS OF A STAT BLOCK', 'CREATURE TYPES', 'MONSTER LISTS',
           'MONSTER LAIRS', 'LEGENDARY MONSTERS', 'BESTIARY'].includes(upper)) {
        return `## ${titleCase(line)}`
      }
      return null
    },
    // Monster names from curated list with OCR-tolerant matching (##)
    (line) => {
      // Must look like a heading: reasonable length, mostly uppercase
      if (line.length < 2 || line.length > 55) return null
      if (!/[A-Z]/.test(line)) return null
      // Normalize and check against curated list
      const normalized = normalizeForMatch(line)
      if (MM_MONSTER_NAMES.has(normalized)) {
        return `## ${titleCase(normalized)}`
      }
      return null
    },
    // Stat block sub-headers: Actions, Reactions, etc. (####)
    (line) => {
      const upper = line.toUpperCase().trim()
      if (['ACTIONS', 'REACTIONS', 'BONUS ACTIONS', 'LEGENDARY ACTIONS',
           'LAIR ACTIONS', 'REGIONAL EFFECTS', 'TRAITS'].includes(upper)) {
        return `#### ${titleCase(line)}`
      }
      return null
    }
  ]
}

// ─── DMG Chapter Reordering ───────────────────────────────────────

/**
 * Reorder DMG chapters by number. The PDF extraction sometimes
 * produces chapters out of order due to page layout.
 */
function reorderDmgChapters(text) {
  const lines = text.split('\n')
  const chunks = []
  let currentChapter = -1
  let currentLines = []

  for (const line of lines) {
    const match = line.match(/^## Chapter (\d+):/)
    if (match) {
      chunks.push({ num: currentChapter, lines: currentLines })
      currentChapter = parseInt(match[1])
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }
  chunks.push({ num: currentChapter, lines: currentLines })

  // Separate pre-chapter content (num === -1) from chapter content
  const preChapter = chunks.filter(c => c.num === -1)
  const chapters = chunks.filter(c => c.num !== -1)
  chapters.sort((a, b) => a.num - b.num)

  const ordered = [...preChapter, ...chapters]
  return ordered.map(c => c.lines.join('\n')).join('\n')
}

// ─── Build Functions ───────────────────────────────────────────────

// Lazily built once and shared across all books
let _knownTermsMap = null
function getKnownTermsMap() {
  if (!_knownTermsMap) _knownTermsMap = buildKnownTermsMap()
  return _knownTermsMap
}

async function buildPHB() {
  console.log('\n=== Building PHB Markdown ===')
  const result = await extractPdfText(PHB_PDF)
  let text = fullClean(result.text, 'Together you and friends')
  text = fixOcrSplitTerms(text, getKnownTermsMap())
  text = addMarkdownHeadings(text, buildPhbDetectors(), { dedupeH2: true })

  const md = "# Player's Handbook (2024)\n\n" + text
  const outPath = path.join(OUTPUT_DIR, "Player's Handbook (2024).md")
  fs.writeFileSync(outPath, md, 'utf-8')
  console.log(`  Written: ${outPath} (${(md.length / 1024).toFixed(0)} KB)`)
}

async function buildDMG() {
  console.log('\n=== Building DMG Markdown ===')
  const result = await extractPdfText(DMG_PDF)
  let text = fullClean(result.text, 'you and your friends take on roles')
  text = fixOcrSplitTerms(text, getKnownTermsMap())
  text = addMarkdownHeadings(text, buildDmgDetectors(), { dedupeH2: true })
  text = reorderDmgChapters(text)

  const md = "# Dungeon Master's Guide (2024)\n\n" + text
  const outPath = path.join(OUTPUT_DIR, "Dungeon Master's Guide (2024).md")
  fs.writeFileSync(outPath, md, 'utf-8')
  console.log(`  Written: ${outPath} (${(md.length / 1024).toFixed(0)} KB)`)
}

async function buildMM() {
  console.log('\n=== Building MM Markdown ===')
  const result = await extractPdfText(MM_PDF)
  let text = fullClean(result.text, 'a def a ult suggestion')
  text = addMarkdownHeadings(text, buildMmDetectors(), { dedupeH2: true })

  const md = '# Monster Manual (2025)\n\n' + text
  const outPath = path.join(OUTPUT_DIR, 'Monster Manual (2025).md')
  fs.writeFileSync(outPath, md, 'utf-8')
  console.log(`  Written: ${outPath} (${(md.length / 1024).toFixed(0)} KB)`)
}

// ─── Entry Point ───────────────────────────────────────────────────

async function main() {
  console.log('Building rulebook markdown files for AI DM chunk-builder...')
  console.log(`Output directory: ${OUTPUT_DIR}`)
  ensureDir(OUTPUT_DIR)

  for (const [name, p] of [['PHB', PHB_PDF], ['DMG', DMG_PDF], ['MM', MM_PDF]]) {
    if (!fs.existsSync(p)) {
      console.error(`ERROR: ${name} PDF not found at ${p}`)
      process.exit(1)
    }
  }

  await buildPHB()
  await buildDMG()
  await buildMM()

  console.log('\n=== Done! ===')
  console.log('Files ready for chunk-builder indexing.')
  console.log('Run the app and rebuild the chunk index to use the new rulebooks.')

  // Clean up test files if they exist
  for (const f of ['_phb_test.txt', '_dmg_test.txt', '_mm_test.txt', '_barb_test.txt', '_test_phb_extract.txt']) {
    const p = path.join(PROJECT_DIR, f)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
