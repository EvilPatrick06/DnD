#!/usr/bin/env node
/**
 * audit-cursed-items.js
 * Audits magic-items.json for cursed items:
 * 1. Finds items with "curse" in description but no `cursed: true` flag
 * 2. Reports items that have the flag
 * 3. Can auto-fix with --fix flag
 *
 * Usage:
 *   node scripts/audit-cursed-items.js          # Report only
 *   node scripts/audit-cursed-items.js --fix    # Auto-add cursed: true
 */

const fs = require('fs')
const path = require('path')

const magicItemsPath = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'magic-items.json')
const shouldFix = process.argv.includes('--fix')

const items = JSON.parse(fs.readFileSync(magicItemsPath, 'utf-8'))

const alreadyCursed = []
const missingFlag = []
const mentionsCurse = []

for (const item of items) {
  const descLower = (item.description || '').toLowerCase()
  const hasCurseInDesc = descLower.includes('curse') || descLower.includes('cursed')
  const hasFlag = item.cursed === true

  if (hasFlag) {
    alreadyCursed.push(item)
  } else if (hasCurseInDesc) {
    missingFlag.push(item)
  }
}

console.log('=== Cursed Items Audit ===\n')

console.log(`Items with cursed: true flag (${alreadyCursed.length}):`)
for (const item of alreadyCursed) {
  console.log(`  [OK] ${item.name} (${item.id}) - ${item.rarity}`)
}

console.log(`\nItems mentioning "curse" but missing flag (${missingFlag.length}):`)
for (const item of missingFlag) {
  const snippet = item.description.substring(0, 80).replace(/\n/g, ' ')
  console.log(`  [!!] ${item.name} (${item.id}) - "${snippet}..."`)
}

if (shouldFix && missingFlag.length > 0) {
  console.log('\n--- Applying fixes ---')
  let fixed = 0
  for (const item of missingFlag) {
    // Only auto-flag items that clearly describe a curse mechanic
    const desc = item.description.toLowerCase()
    const isTrulyCursed = desc.includes('curse:') ||
      desc.includes('this weapon is cursed') ||
      desc.includes('this armor is cursed') ||
      desc.includes('cursed, and becoming attuned') ||
      desc.includes('once you don this cursed') ||
      desc.includes('can\'t be removed until') ||
      desc.includes('can\'t be discarded')

    if (isTrulyCursed) {
      const idx = items.findIndex(i => i.id === item.id)
      if (idx !== -1) {
        items[idx].cursed = true
        console.log(`  Fixed: ${item.name}`)
        fixed++
      }
    } else {
      console.log(`  Skipped (ambiguous): ${item.name}`)
    }
  }

  fs.writeFileSync(magicItemsPath, JSON.stringify(items, null, 2) + '\n', 'utf-8')
  console.log(`\nFixed ${fixed} items. Written to ${magicItemsPath}`)
} else if (missingFlag.length > 0) {
  console.log('\nRun with --fix to auto-add cursed: true to clearly cursed items.')
}

console.log('\n=== Summary ===')
console.log(`Total items: ${items.length}`)
console.log(`Flagged as cursed: ${alreadyCursed.length}`)
console.log(`Mentions curse without flag: ${missingFlag.length}`)
