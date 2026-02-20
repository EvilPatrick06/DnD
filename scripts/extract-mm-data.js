#!/usr/bin/env node
/**
 * extract-mm-data.js
 * Parse Monster Manual markdown files for regional effects and lair actions.
 * Outputs JSON patches that can be applied to monsters.json.
 *
 * Usage: node scripts/extract-mm-data.js [--input <dir>] [--output <file>]
 *
 * Default input: 5.5e References/mm/ (markdown files split per creature)
 * Default output: stdout (JSON)
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const inputDir = getArg('--input') || path.join(__dirname, '..', '5.5e References', 'mm')
const outputFile = getArg('--output') || null

function getArg(flag) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

function extractLairActions(text) {
  const lairMatch = text.match(/##?\s*Lair Actions?\s*\n([\s\S]*?)(?=\n##?\s|\n---|\Z)/i)
  if (!lairMatch) return null

  const section = lairMatch[1]
  const actions = []
  const lines = section.split('\n')
  let currentAction = null

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+\*\*(.+?)\*\*[.:]?\s*(.*)/)
    if (bulletMatch) {
      if (currentAction) actions.push(currentAction)
      currentAction = { name: bulletMatch[1], description: bulletMatch[2] || '' }
    } else if (currentAction && line.trim() && !line.startsWith('#')) {
      currentAction.description += ' ' + line.trim()
    } else if (line.startsWith('#') || line.startsWith('---')) {
      break
    }
  }
  if (currentAction) actions.push(currentAction)

  return actions.length > 0 ? { initiativeCount: 20, actions } : null
}

function extractRegionalEffects(text) {
  const regionMatch = text.match(/##?\s*Regional Effects?\s*\n([\s\S]*?)(?=\n##?\s|\n---|\Z)/i)
  if (!regionMatch) return null

  const section = regionMatch[1]
  const effects = []
  const lines = section.split('\n')
  let currentEffect = null
  let endCondition = null

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+\*\*(.+?)\*\*[.:]?\s*(.*)/)
    if (bulletMatch) {
      if (currentEffect) effects.push(currentEffect)
      currentEffect = { name: bulletMatch[1], description: bulletMatch[2] || '' }
    } else if (line.match(/dies|destroyed|leaves/i) && !line.startsWith('-')) {
      endCondition = line.trim()
    } else if (currentEffect && line.trim() && !line.startsWith('#')) {
      currentEffect.description += ' ' + line.trim()
    }
  }
  if (currentEffect) effects.push(currentEffect)

  return effects.length > 0 ? { effects, endCondition: endCondition || undefined } : null
}

function processDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Input directory not found: ${dir}`)
    console.error('Provide markdown files with --input <dir>, or place them in "5.5e References/mm/"')
    process.exit(1)
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  const patches = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8')
    const nameMatch = content.match(/^#\s+(.+)/m)
    if (!nameMatch) continue

    const name = nameMatch[1].trim()
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const lairActions = extractLairActions(content)
    const regionalEffects = extractRegionalEffects(content)

    if (lairActions || regionalEffects) {
      patches.push({
        id,
        name,
        ...(lairActions ? { lairActions } : {}),
        ...(regionalEffects ? { regionalEffects } : {})
      })
    }
  }

  return patches
}

try {
  const patches = processDirectory(inputDir)
  const output = JSON.stringify(patches, null, 2)

  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8')
    console.log(`Wrote ${patches.length} patches to ${outputFile}`)
  } else {
    console.log(output)
    console.error(`\nFound ${patches.length} creatures with lair/regional data`)
  }
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
