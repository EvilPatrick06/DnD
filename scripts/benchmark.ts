/**
 * Performance Benchmark Script
 *
 * Measures key performance metrics for the D&D VTT application.
 * Run with: npx tsx scripts/benchmark.ts
 *
 * Metrics measured (Node.js-compatible only):
 * 1. Data file load time — read and parse all JSON files from data/5e/
 * 2. Character save round-trip — write then read a test character JSON
 * 3. Stat calculator execution — run calculate5eStats with realistic input
 *
 * Uses performance.now() for sub-millisecond precision.
 * Outputs formatted table to console and saves baseline JSON.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync, statSync } from 'fs'
import { join, extname } from 'path'
import { performance } from 'perf_hooks'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT_DIR = join(__dirname, '..')
const DATA_DIR = join(ROOT_DIR, 'src', 'renderer', 'public', 'data', '5e')
const SRC_DIR = join(ROOT_DIR, 'src', 'renderer', 'src')
const DIST_DIR = join(ROOT_DIR, 'out', 'renderer')
const BASELINE_PATH = join(__dirname, 'benchmark-baseline.json')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TimedResult<T> {
  value: T
  ms: number
}

function timed<T>(fn: () => T): TimedResult<T> {
  const start = performance.now()
  const value = fn()
  return { value, ms: performance.now() - start }
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(3)}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDirectorySize(dir: string): number {
  let total = 0
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        total += getDirectorySize(fullPath)
      } else {
        total += statSync(fullPath).size
      }
    }
  } catch {
    // Directory might not exist
  }
  return total
}

function countFiles(dir: string, ext: string): number {
  let count = 0
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        count += countFiles(fullPath, ext)
      } else if (extname(entry.name) === ext) {
        count++
      }
    }
  } catch {
    // Directory might not exist
  }
  return count
}

// ---------------------------------------------------------------------------
// Benchmark: Data file loading
// ---------------------------------------------------------------------------

interface DataLoadResult {
  totalMs: number
  fileCount: number
  totalBytes: number
  perFile: Array<{ name: string; ms: number; bytes: number }>
}

function benchmarkDataLoad(): DataLoadResult {
  const files = readdirSync(DATA_DIR).filter((f) => extname(f) === '.json')
  const perFile: Array<{ name: string; ms: number; bytes: number }> = []
  let totalBytes = 0

  const start = performance.now()
  for (const file of files) {
    const fullPath = join(DATA_DIR, file)
    const fileStart = performance.now()
    const content = readFileSync(fullPath, 'utf-8')
    JSON.parse(content)
    const fileMs = performance.now() - fileStart
    const bytes = Buffer.byteLength(content, 'utf-8')
    totalBytes += bytes
    perFile.push({ name: file, ms: fileMs, bytes })
  }
  const totalMs = performance.now() - start

  return { totalMs, fileCount: files.length, totalBytes, perFile }
}

// ---------------------------------------------------------------------------
// Benchmark: Character save round-trip
// ---------------------------------------------------------------------------

interface SaveRoundTripResult {
  writeMs: number
  readMs: number
  roundTripMs: number
  characterSizeBytes: number
}

function benchmarkCharacterSaveRoundTrip(): SaveRoundTripResult {
  // Create a realistic test character matching Character5e shape
  const testCharacter = {
    id: 'bench-test-00000000-0000-0000-0000-000000000000',
    gameSystem: 'dnd5e',
    campaignId: null,
    playerId: 'benchmark-player',
    name: 'Benchmark Hero',
    species: 'human',
    classes: [{ classId: 'fighter', level: 5, subclassId: 'champion' }],
    level: 5,
    background: 'soldier',
    alignment: 'Neutral Good',
    xp: 6500,
    levelingMode: 'xp',
    abilityScores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
    hitPoints: { current: 44, max: 44, temporary: 0 },
    hitDiceRemaining: 5,
    armorClass: 18,
    initiative: 2,
    speed: 30,
    speeds: { swim: 0, fly: 0, climb: 0, burrow: 0 },
    size: 'Medium',
    senses: ['Darkvision 60 ft.'],
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    details: {
      age: '25',
      height: "6'1\"",
      weight: '200 lbs',
      eyes: 'Brown',
      skin: 'Tan',
      hair: 'Black',
      personalityTraits: 'Brave and bold.',
      ideals: 'Honor',
      bonds: 'My squad',
      flaws: 'Stubborn'
    },
    proficiencies: {
      armor: ['Light', 'Medium', 'Heavy', 'Shields'],
      weapons: ['Simple', 'Martial'],
      tools: [],
      languages: ['Common', 'Dwarvish']
    },
    skills: [
      { name: 'Athletics', proficient: true, expertise: false, bonus: 6 },
      { name: 'Perception', proficient: true, expertise: false, bonus: 4 },
      { name: 'Intimidation', proficient: true, expertise: false, bonus: 2 },
      { name: 'Survival', proficient: true, expertise: false, bonus: 4 }
    ],
    equipment: [
      { id: 'chain-mail', name: 'Chain Mail', quantity: 1, weight: 55, equipped: true },
      { id: 'longsword', name: 'Longsword', quantity: 1, weight: 3, equipped: true },
      { id: 'shield', name: 'Shield', quantity: 1, weight: 6, equipped: true },
      { id: 'javelin', name: 'Javelin', quantity: 4, weight: 2, equipped: false }
    ],
    treasure: { cp: 0, sp: 25, ep: 0, gp: 150, pp: 0 },
    features: [
      { name: 'Second Wind', description: 'Regain 1d10+5 HP as a bonus action.', source: 'Fighter 1' },
      { name: 'Action Surge', description: 'Take one additional action.', source: 'Fighter 2' },
      { name: 'Extra Attack', description: 'Attack twice when taking the Attack action.', source: 'Fighter 5' }
    ],
    knownSpells: [],
    preparedSpellIds: [],
    spellSlotLevels: {},
    classFeatures: [],
    weapons: [
      {
        id: 'longsword',
        name: 'Longsword',
        damage: '1d8+3',
        damageType: 'slashing',
        attackBonus: 6,
        properties: ['Versatile (1d10)']
      }
    ],
    armor: [{ id: 'chain-mail', name: 'Chain Mail', ac: 16, type: 'heavy' }],
    feats: [],
    buildChoices: {
      speciesId: 'human',
      classId: 'fighter',
      subclassId: 'champion',
      backgroundId: 'soldier',
      selectedSkills: ['athletics', 'perception', 'intimidation', 'survival'],
      abilityScoreMethod: 'standard',
      selectedFeats: [],
      selections: {}
    },
    status: 'active',
    campaignHistory: [],
    backstory: 'A seasoned soldier who seeks adventure after years of service.',
    notes: 'Benchmark test character.',
    pets: [],
    deathSaves: { successes: 0, failures: 0 },
    heroicInspiration: false,
    attunement: [],
    conditions: [],
    languageDescriptions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const json = JSON.stringify(testCharacter, null, 2)
  const characterSizeBytes = Buffer.byteLength(json, 'utf-8')

  // Use a temp file for the round-trip test
  const tmpDir = join(ROOT_DIR, 'scripts')
  const tmpPath = join(tmpDir, '_benchmark-character-tmp.json')

  // Write
  const writeStart = performance.now()
  writeFileSync(tmpPath, json, 'utf-8')
  const writeMs = performance.now() - writeStart

  // Read + parse
  const readStart = performance.now()
  const content = readFileSync(tmpPath, 'utf-8')
  JSON.parse(content)
  const readMs = performance.now() - readStart

  // Cleanup
  try {
    unlinkSync(tmpPath)
  } catch {
    // Ignore cleanup errors
  }

  return {
    writeMs,
    readMs,
    roundTripMs: writeMs + readMs,
    characterSizeBytes
  }
}

// ---------------------------------------------------------------------------
// Benchmark: Stat calculator
// ---------------------------------------------------------------------------

interface StatCalcResult {
  singleRunMs: number
  avg100Ms: number
  avg1000Ms: number
}

function benchmarkStatCalculator(): StatCalcResult {
  // Inline the pure math from stat-calculator-5e to avoid renderer/browser imports.
  // This tests the same algorithm without requiring the full module dependency chain.

  function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2)
  }

  interface AbilityScoreSet {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }

  type AbilityName = keyof AbilityScoreSet

  function calculate5eStats(
    baseScores: AbilityScoreSet,
    species: { abilityBonuses: Partial<Record<AbilityName, number>>; speed: number; size: string } | null,
    cls: { hitDie: number; savingThrows: string[] } | null,
    level: number,
    backgroundAbilityBonuses?: Partial<Record<AbilityName, number>>,
    speciesId?: string | null,
    feats?: Array<{ id: string }> | null
  ): Record<string, unknown> {
    const scores: AbilityScoreSet = { ...baseScores }
    if (species && Object.keys(species.abilityBonuses).length > 0) {
      for (const [ability, bonus] of Object.entries(species.abilityBonuses)) {
        scores[ability as AbilityName] += bonus as number
      }
    } else if (backgroundAbilityBonuses) {
      for (const [ability, bonus] of Object.entries(backgroundAbilityBonuses)) {
        scores[ability as AbilityName] += bonus as number
      }
    }

    const modifiers: AbilityScoreSet = {
      strength: abilityModifier(scores.strength),
      dexterity: abilityModifier(scores.dexterity),
      constitution: abilityModifier(scores.constitution),
      intelligence: abilityModifier(scores.intelligence),
      wisdom: abilityModifier(scores.wisdom),
      charisma: abilityModifier(scores.charisma)
    }

    const proficiencyBonus = level <= 20 ? Math.ceil(level / 4) + 1 : Math.ceil((level - 1) / 4) + 1
    const hitDie = cls?.hitDie ?? 8
    const conMod = modifiers.constitution

    let maxHP = hitDie + conMod
    for (let i = 2; i <= level; i++) {
      maxHP += Math.floor(hitDie / 2) + 1 + conMod
    }
    // HP bonus from traits
    if (speciesId === 'dwarf') maxHP += level
    if (feats?.some((f) => f.id === 'tough')) maxHP += level * 2
    if (feats?.some((f) => f.id === 'boon-of-fortitude')) maxHP += 40
    maxHP = Math.max(maxHP, 1)

    const armorClass = 10 + modifiers.dexterity
    let initiative = modifiers.dexterity
    if (feats?.some((f) => f.id === 'alert')) initiative += proficiencyBonus

    let speed = species?.speed ?? 30
    if (feats?.some((f) => f.id === 'speedy')) speed += 10

    const savingThrows: Record<string, number> = {}
    const proficientSaves = (cls?.savingThrows ?? []).map((s) => s.toLowerCase())
    for (const ability of Object.keys(scores) as AbilityName[]) {
      const isProficient = proficientSaves.includes(ability)
      savingThrows[ability] = modifiers[ability] + (isProficient ? proficiencyBonus : 0)
    }

    return {
      abilityScores: scores,
      abilityModifiers: modifiers,
      maxHP,
      armorClass,
      initiative,
      speed,
      proficiencyBonus,
      savingThrows
    }
  }

  const baseScores: AbilityScoreSet = {
    strength: 16,
    dexterity: 14,
    constitution: 14,
    intelligence: 10,
    wisdom: 12,
    charisma: 8
  }
  const species = { abilityBonuses: {}, speed: 30, size: 'Medium' }
  const cls = { hitDie: 10, savingThrows: ['strength', 'constitution'] }
  const bgBonuses = { strength: 2, constitution: 1 } as Partial<Record<AbilityName, number>>
  const feats = [{ id: 'tough' }, { id: 'alert' }]

  // Single run
  const single = timed(() => calculate5eStats(baseScores, species, cls, 10, bgBonuses, 'human', feats))

  // 100 iterations
  const run100 = timed(() => {
    for (let i = 0; i < 100; i++) {
      calculate5eStats(baseScores, species, cls, i % 20 + 1, bgBonuses, 'human', feats)
    }
  })

  // 1000 iterations
  const run1000 = timed(() => {
    for (let i = 0; i < 1000; i++) {
      calculate5eStats(baseScores, species, cls, i % 20 + 1, bgBonuses, 'human', feats)
    }
  })

  return {
    singleRunMs: single.ms,
    avg100Ms: run100.ms / 100,
    avg1000Ms: run1000.ms / 1000
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface BenchmarkEntry {
  metric: string
  value: string
  target: string
  status: 'PASS' | 'WARN' | 'FAIL'
}

function main(): void {
  console.log('=== D&D VTT Performance Benchmark ===')
  console.log(`Date: ${new Date().toISOString()}\n`)

  // --- Static analysis ---
  const srcFiles = countFiles(SRC_DIR, '.tsx') + countFiles(SRC_DIR, '.ts')
  const distSize = getDirectorySize(DIST_DIR)

  console.log('--- Static Analysis ---')
  console.log(`Source files (renderer): ${srcFiles}`)
  if (distSize > 0) {
    console.log(`Build output size: ${formatBytes(distSize)}`)
  } else {
    console.log('Build output: not found (run `npx electron-vite build` first)')
  }

  // --- Benchmark 1: Data file loading ---
  console.log('\n--- Benchmark: Data File Loading ---')
  const dataLoad = benchmarkDataLoad()
  console.log(`Files loaded: ${dataLoad.fileCount}`)
  console.log(`Total data size: ${formatBytes(dataLoad.totalBytes)}`)
  console.log(`Total load time: ${formatMs(dataLoad.totalMs)}`)
  console.log(`Average per file: ${formatMs(dataLoad.totalMs / dataLoad.fileCount)}`)

  // Show top 5 slowest files
  const sorted = [...dataLoad.perFile].sort((a, b) => b.ms - a.ms)
  console.log('\nSlowest files:')
  for (const f of sorted.slice(0, 5)) {
    console.log(`  ${f.name.padEnd(30)} ${formatMs(f.ms).padStart(10)}  (${formatBytes(f.bytes)})`)
  }

  // --- Benchmark 2: Character save round-trip ---
  console.log('\n--- Benchmark: Character Save Round-Trip ---')
  const saveRT = benchmarkCharacterSaveRoundTrip()
  console.log(`Character size: ${formatBytes(saveRT.characterSizeBytes)}`)
  console.log(`Write time: ${formatMs(saveRT.writeMs)}`)
  console.log(`Read + parse time: ${formatMs(saveRT.readMs)}`)
  console.log(`Total round-trip: ${formatMs(saveRT.roundTripMs)}`)

  // --- Benchmark 3: Stat calculator ---
  console.log('\n--- Benchmark: Stat Calculator ---')
  const statCalc = benchmarkStatCalculator()
  console.log(`Single execution: ${formatMs(statCalc.singleRunMs)}`)
  console.log(`Average over 100 runs: ${formatMs(statCalc.avg100Ms)}`)
  console.log(`Average over 1000 runs: ${formatMs(statCalc.avg1000Ms)}`)

  // --- Summary table ---
  const entries: BenchmarkEntry[] = [
    {
      metric: 'Data load (all JSON)',
      value: formatMs(dataLoad.totalMs),
      target: '< 500ms',
      status: dataLoad.totalMs < 500 ? 'PASS' : dataLoad.totalMs < 1000 ? 'WARN' : 'FAIL'
    },
    {
      metric: 'Character save write',
      value: formatMs(saveRT.writeMs),
      target: '< 10ms',
      status: saveRT.writeMs < 10 ? 'PASS' : saveRT.writeMs < 50 ? 'WARN' : 'FAIL'
    },
    {
      metric: 'Character save read',
      value: formatMs(saveRT.readMs),
      target: '< 10ms',
      status: saveRT.readMs < 10 ? 'PASS' : saveRT.readMs < 50 ? 'WARN' : 'FAIL'
    },
    {
      metric: 'Save round-trip',
      value: formatMs(saveRT.roundTripMs),
      target: '< 20ms',
      status: saveRT.roundTripMs < 20 ? 'PASS' : saveRT.roundTripMs < 50 ? 'WARN' : 'FAIL'
    },
    {
      metric: 'Stat calc (single)',
      value: formatMs(statCalc.singleRunMs),
      target: '< 1ms',
      status: statCalc.singleRunMs < 1 ? 'PASS' : statCalc.singleRunMs < 5 ? 'WARN' : 'FAIL'
    },
    {
      metric: 'Stat calc (avg/1000)',
      value: formatMs(statCalc.avg1000Ms),
      target: '< 0.1ms',
      status: statCalc.avg1000Ms < 0.1 ? 'PASS' : statCalc.avg1000Ms < 1 ? 'WARN' : 'FAIL'
    }
  ]

  console.log('\n--- Summary ---')
  console.log('Metric'.padEnd(28) + 'Value'.padEnd(14) + 'Target'.padEnd(14) + 'Status')
  console.log('-'.repeat(62))
  for (const e of entries) {
    console.log(e.metric.padEnd(28) + e.value.padEnd(14) + e.target.padEnd(14) + e.status)
  }

  // --- Save baseline JSON ---
  const baseline = {
    timestamp: new Date().toISOString(),
    staticAnalysis: {
      srcFiles,
      jsonDataFiles: dataLoad.fileCount,
      jsonDataTotalBytes: dataLoad.totalBytes,
      buildOutputBytes: distSize
    },
    benchmarks: {
      dataLoad: {
        totalMs: dataLoad.totalMs,
        fileCount: dataLoad.fileCount,
        totalBytes: dataLoad.totalBytes,
        avgPerFileMs: dataLoad.totalMs / dataLoad.fileCount,
        slowestFiles: sorted.slice(0, 5).map((f) => ({ name: f.name, ms: f.ms, bytes: f.bytes }))
      },
      characterSaveRoundTrip: {
        writeMs: saveRT.writeMs,
        readMs: saveRT.readMs,
        roundTripMs: saveRT.roundTripMs,
        characterSizeBytes: saveRT.characterSizeBytes
      },
      statCalculator: {
        singleRunMs: statCalc.singleRunMs,
        avg100Ms: statCalc.avg100Ms,
        avg1000Ms: statCalc.avg1000Ms
      }
    },
    results: entries
  }

  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf-8')
  console.log(`\nBaseline saved to: ${BASELINE_PATH}`)
}

main()
