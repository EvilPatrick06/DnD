import * as fs from 'fs'
import * as path from 'path'
import { formatCampaignForContext, loadCampaignById } from './campaign-context'
import { formatCharacterAbbreviated, formatCharacterForContext, loadCharacterById } from './character-context'
import { getMemoryManager } from './memory-manager'
import type { SearchEngine } from './search-engine'
import { detectAndLoadSrdData } from './srd-provider'
import type { ContextTokenBreakdown } from './token-budget'
import { estimateTokens, TOKEN_BUDGETS, trimToTokenBudget } from './token-budget'
import type { ActiveCreatureInfo, ScoredChunk } from './types'

// Cache loaded monster data
let monsterDataCache: Map<string, Record<string, unknown>> | null = null

function loadMonsterData(): Map<string, Record<string, unknown>> {
  if (monsterDataCache) return monsterDataCache
  monsterDataCache = new Map()
  const dataDir = path.join(__dirname, '..', '..', 'renderer', 'public', 'data', '5e')
  for (const file of ['monsters.json', 'creatures.json', 'npcs.json']) {
    try {
      const filePath = path.join(dataDir, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>[]
      for (const entry of data) {
        if (typeof entry.id === 'string') {
          monsterDataCache.set(entry.id, entry)
        }
      }
    } catch {
      // Non-fatal — file may not exist in dev
    }
  }
  return monsterDataCache
}

function formatCreatureContext(creature: ActiveCreatureInfo): string {
  let line = `- ${creature.label}: HP ${creature.currentHP}/${creature.maxHP}, AC ${creature.ac}`
  if (creature.conditions.length) {
    line += `, Conditions: ${creature.conditions.join(', ')}`
  }

  // Enrich with stat block data if available
  if (creature.monsterStatBlockId) {
    const monsters = loadMonsterData()
    const statBlock = monsters.get(creature.monsterStatBlockId)
    if (statBlock) {
      const parts: string[] = []

      // CR
      if (statBlock.cr) parts.push(`CR ${statBlock.cr}`)

      // Key resistances/immunities
      const res = statBlock.resistances as string[] | undefined
      const imm = statBlock.damageImmunities as string[] | undefined
      const vuln = statBlock.vulnerabilities as string[] | undefined
      if (res?.length) parts.push(`Resist: ${res.join(', ')}`)
      if (imm?.length) parts.push(`Immune: ${imm.join(', ')}`)
      if (vuln?.length) parts.push(`Vulnerable: ${vuln.join(', ')}`)

      // Key actions (name, to-hit or DC, damage)
      const actions = statBlock.actions as Array<Record<string, unknown>> | undefined
      if (actions?.length) {
        const actionSummaries = actions.slice(0, 4).map((a) => {
          let s = a.name as string
          if (a.toHit !== undefined) s += ` (+${a.toHit})`
          else if (a.saveDC) s += ` (DC ${a.saveDC})`
          if (a.damageDice) s += ` ${a.damageDice} ${a.damageType || ''}`
          return s.trim()
        })
        parts.push(`Actions: ${actionSummaries.join('; ')}`)
      }

      // Legendary actions
      const legendary = statBlock.legendaryActions as Record<string, unknown> | undefined
      if (legendary?.uses) {
        parts.push(`${legendary.uses} legendary actions/turn`)
      }

      // Spellcasting
      const spellcasting = statBlock.spellcasting as Record<string, unknown> | undefined
      if (spellcasting) {
        parts.push(`Spellcaster (DC ${spellcasting.saveDC || '?'})`)
      }

      if (parts.length) {
        line += `\n    ${parts.join(' | ')}`
      }
    }
  }

  return line
}

let searchEngine: SearchEngine | null = null
let lastTokenBreakdown: ContextTokenBreakdown | null = null

export function setSearchEngine(engine: SearchEngine | null): void {
  searchEngine = engine
}

export function getSearchEngine(): SearchEngine | null {
  return searchEngine
}

export function getLastTokenBreakdown(): ContextTokenBreakdown | null {
  return lastTokenBreakdown
}

/**
 * Build the full context block for an API call.
 * actingCharacterId: the character performing the current action (gets full sheet).
 * Other characters in activeCharacterIds get abbreviated sheets.
 */
export async function buildContext(
  query: string,
  activeCharacterIds: string[],
  campaignId?: string,
  activeCreatures?: ActiveCreatureInfo[],
  gameState?: string,
  actingCharacterId?: string
): Promise<string> {
  const parts: string[] = []
  const breakdown: ContextTokenBreakdown = {
    rulebookChunks: 0,
    srdData: 0,
    characterData: 0,
    campaignData: 0,
    creatures: 0,
    gameState: 0,
    memory: 0,
    total: 0
  }

  // 1. Search rulebook chunks
  if (searchEngine) {
    const results = searchEngine.search(query, 5)

    if (results.length > 0) {
      const chunkText = formatChunks(results)
      const trimmed = trimToTokenBudget(`[CONTEXT: Rulebook Excerpts]\n${chunkText}`, TOKEN_BUDGETS.retrievedChunks)
      breakdown.rulebookChunks = estimateTokens(trimmed)
      parts.push(trimmed)
    }
  }

  // 2. SRD JSON lookups
  try {
    const srdData = detectAndLoadSrdData(query)
    if (srdData) {
      const trimmed = trimToTokenBudget(`[CONTEXT: SRD Data]\n${srdData}`, TOKEN_BUDGETS.srdData)
      breakdown.srdData = estimateTokens(trimmed)
      parts.push(trimmed)
    }
  } catch {
    // Non-fatal
  }

  // 3. Character data — full sheet for acting character, abbreviated for others
  if (activeCharacterIds.length > 0) {
    const charParts: string[] = []
    const cacheEntries: Array<{ id: string; formatted: string }> = []
    for (const id of activeCharacterIds) {
      const char = await loadCharacterById(id)
      if (char) {
        let formatted: string
        if (actingCharacterId && id === actingCharacterId) {
          formatted = formatCharacterForContext(char)
        } else if (actingCharacterId) {
          formatted = formatCharacterAbbreviated(char)
        } else {
          // No acting character specified — send full sheets for all
          formatted = formatCharacterForContext(char)
        }
        charParts.push(formatted)
        cacheEntries.push({ id, formatted })
      }
    }
    if (charParts.length > 0) {
      const charBlock = `[CHARACTER DATA]\n${charParts.join('\n\n')}`
      breakdown.characterData = estimateTokens(charBlock)
      parts.push(charBlock)

      // Cache character context for persistence
      if (campaignId) {
        const memMgr = getMemoryManager(campaignId)
        memMgr.saveCharacterContext(cacheEntries).catch(() => {})
      }
    }
  }

  // 4. Campaign data
  if (campaignId) {
    try {
      const campaign = await loadCampaignById(campaignId)
      if (campaign) {
        const campaignText = formatCampaignForContext(campaign)
        const trimmed = trimToTokenBudget(campaignText, TOKEN_BUDGETS.campaignData)
        breakdown.campaignData = estimateTokens(trimmed)
        parts.push(trimmed)
      }
    } catch {
      // Non-fatal
    }
  }

  // 5. Active map creatures (enriched with stat block data)
  if (activeCreatures?.length) {
    const creatureBlock =
      '[ACTIVE CREATURES ON MAP]\n' +
      activeCreatures.map((c) => formatCreatureContext(c)).join('\n')
    const trimmed = trimToTokenBudget(creatureBlock, TOKEN_BUDGETS.creatures)
    breakdown.creatures = estimateTokens(trimmed)
    parts.push(trimmed)
  }

  // 6. Game state snapshot (pre-formatted by renderer)
  if (gameState) {
    const trimmed = trimToTokenBudget(gameState, TOKEN_BUDGETS.gameState)
    breakdown.gameState = estimateTokens(trimmed)
    parts.push(trimmed)
  }

  // 7. Memory manager context (world state, combat, NPCs, places, notes)
  if (campaignId) {
    try {
      const memoryManager = getMemoryManager(campaignId)
      const memoryContext = await memoryManager.assembleContext()
      if (memoryContext) {
        const trimmed = trimToTokenBudget(memoryContext, TOKEN_BUDGETS.memory)
        breakdown.memory = estimateTokens(trimmed)
        parts.push(trimmed)
      }
    } catch {
      // Non-fatal — memory files may not exist yet
    }
  }

  const result = parts.join('\n\n')
  breakdown.total = estimateTokens(result)
  lastTokenBreakdown = breakdown

  return result
}

function formatChunks(chunks: ScoredChunk[]): string {
  return chunks
    .map((chunk) => {
      const breadcrumb = chunk.headingPath.join(' > ')
      return `--- ${chunk.source}: ${breadcrumb} ---\n${chunk.content}`
    })
    .join('\n\n')
}
