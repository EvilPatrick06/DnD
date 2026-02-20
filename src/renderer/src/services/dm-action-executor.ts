/**
 * DM Action Executor — dispatches AI DM actions to useGameStore.
 * Resolves entity names to IDs and validates grid coordinates.
 */

import { LIGHT_SOURCES } from '../data/light-sources'
import { rollMultiple } from './dice-service'
import { useGameStore } from '../stores/useGameStore'
import { useLobbyStore } from '../stores/useLobbyStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import type { InitiativeEntry } from '../types/game-state'
import type { MapToken } from '../types/map'
import type { MonsterStatBlock } from '../types/monster'
import { getSizeTokenDimensions } from '../types/monster'
import { play as playSound, type SoundEvent } from './sound-manager'

interface DmAction {
  action: string
  [key: string]: unknown
}

interface ExecutionFailure {
  action: DmAction
  reason: string
}

interface ExecutionResult {
  executed: DmAction[]
  failed: ExecutionFailure[]
}

const MAX_ACTIONS_PER_BATCH = 50

// Monster cache for place_creature — loaded lazily
let monsterCache: MonsterStatBlock[] | null = null

async function ensureMonsterCache(): Promise<void> {
  if (monsterCache) return
  try {
    const { load5eMonsters } = await import('./data-provider')
    monsterCache = await load5eMonsters()
  } catch {
    monsterCache = []
  }
}

// Eagerly load on first import
ensureMonsterCache()

// ── Name Resolution Helpers ──

function resolveTokenByLabel(tokens: MapToken[], label: string): MapToken | undefined {
  // Exact case-insensitive match first
  const exact = tokens.find((t) => t.label.toLowerCase() === label.toLowerCase())
  if (exact) return exact
  // Partial match fallback (e.g., "Goblin" matches "Goblin 1")
  return tokens.find((t) => t.label.toLowerCase().startsWith(label.toLowerCase()))
}

function resolveMapByName(
  maps: Array<{ id: string; name: string }>,
  name: string
): { id: string; name: string } | undefined {
  const exact = maps.find((m) => m.name.toLowerCase() === name.toLowerCase())
  if (exact) return exact
  return maps.find((m) => m.name.toLowerCase().includes(name.toLowerCase()))
}

function resolvePlayerByName(playerName: string): string | undefined {
  const players = useLobbyStore.getState().players
  const match = players.find(
    (p) =>
      p.displayName.toLowerCase() === playerName.toLowerCase() ||
      (p.characterName && p.characterName.toLowerCase() === playerName.toLowerCase())
  )
  return match?.peerId
}

// ── Dice Rolling Helper ──

function rollDiceFormula(formula: string): { rolls: number[]; total: number } {
  // Parse "NdS+M" or "NdS-M" or "NdS"
  const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!match) {
    // Try plain number
    const num = parseInt(formula, 10)
    if (!Number.isNaN(num)) return { rolls: [num], total: num }
    return { rolls: [], total: 0 }
  }

  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3], 10) : 0

  const rolls = rollMultiple(count, sides)
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier
  return { rolls, total }
}

// ── Main Executor ──

/**
 * Execute DM actions. If DM approval is required (useAiDmStore.dmApprovalRequired),
 * actions are queued as pendingActions instead of executing immediately.
 * Pass `bypassApproval: true` to force execution (used when DM approves pending actions).
 */
export function executeDmActions(actions: DmAction[], bypassApproval = false): ExecutionResult {
  // Check if DM approval is required
  if (!bypassApproval) {
    // Dynamic import to avoid circular dependency
    const { useAiDmStore } = require('../stores/useAiDmStore')
    const aiStore = useAiDmStore.getState()
    if (aiStore.dmApprovalRequired && actions.length > 0) {
      aiStore.setPendingActions({
        id: crypto.randomUUID(),
        text: actions.map((a) => `${a.action}: ${JSON.stringify(a)}`).join('\n'),
        actions,
        statChanges: []
      })
      return { executed: [], failed: [] }
    }
  }

  const result: ExecutionResult = { executed: [], failed: [] }

  if (actions.length > MAX_ACTIONS_PER_BATCH) {
    actions = actions.slice(0, MAX_ACTIONS_PER_BATCH)
  }

  const gameStore = useGameStore.getState()
  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId)

  for (const action of actions) {
    try {
      const success = executeOne(action, gameStore, activeMap)
      if (success) {
        result.executed.push(action)
      } else {
        result.failed.push({ action, reason: 'Action returned false' })
      }
    } catch (err) {
      result.failed.push({
        action,
        reason: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return result
}

function executeOne(
  action: DmAction,
  gameStore: ReturnType<typeof useGameStore.getState>,
  activeMap: ReturnType<typeof useGameStore.getState>['maps'][number] | undefined
): boolean {
  switch (action.action) {
    // ── Token Management ──

    case 'place_token': {
      if (!activeMap) throw new Error('No active map')
      const gridX = action.gridX as number
      const gridY = action.gridY as number
      if (typeof gridX !== 'number' || typeof gridY !== 'number') throw new Error('Missing gridX/gridY')

      const token: MapToken = {
        id: crypto.randomUUID(),
        entityId: crypto.randomUUID(),
        entityType: (action.entityType as 'player' | 'npc' | 'enemy') || 'enemy',
        label: action.label as string,
        gridX,
        gridY,
        sizeX: (action.sizeX as number) || 1,
        sizeY: (action.sizeY as number) || 1,
        visibleToPlayers: action.visibleToPlayers !== false,
        conditions: (action.conditions as string[]) || [],
        currentHP: action.hp as number | undefined,
        maxHP: action.hp as number | undefined,
        ac: action.ac as number | undefined,
        walkSpeed: action.speed as number | undefined
      }
      gameStore.addToken(activeMap.id, token)

      // Initialize turn state if in initiative
      if (gameStore.initiative && token.walkSpeed) {
        gameStore.initTurnState(token.entityId, token.walkSpeed)
      }
      return true
    }

    case 'move_token': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.label as string)
      if (!token) throw new Error(`Token not found: ${action.label}`)
      const gridX = action.gridX as number
      const gridY = action.gridY as number
      if (typeof gridX !== 'number' || typeof gridY !== 'number') throw new Error('Missing gridX/gridY')
      gameStore.moveToken(activeMap.id, token.id, gridX, gridY)
      return true
    }

    case 'remove_token': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.label as string)
      if (!token) throw new Error(`Token not found: ${action.label}`)
      gameStore.removeToken(activeMap.id, token.id)
      return true
    }

    case 'update_token': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.label as string)
      if (!token) throw new Error(`Token not found: ${action.label}`)
      const updates: Partial<MapToken> = {}
      if (action.hp !== undefined) {
        updates.currentHP = action.hp as number
        if (token.maxHP === undefined || (action.hp as number) > token.maxHP) {
          updates.maxHP = action.hp as number
        }
      }
      if (action.ac !== undefined) updates.ac = action.ac as number
      if (action.conditions !== undefined) updates.conditions = action.conditions as string[]
      if (action.visibleToPlayers !== undefined) updates.visibleToPlayers = action.visibleToPlayers as boolean
      if (action.label_new) updates.label = action.label_new as string
      gameStore.updateToken(activeMap.id, token.id, updates)
      return true
    }

    // ── Initiative ──

    case 'start_initiative': {
      const rawEntries = action.entries as Array<{
        label: string
        roll: number
        modifier: number
        entityType: 'player' | 'npc' | 'enemy'
      }>
      if (!Array.isArray(rawEntries) || rawEntries.length === 0) throw new Error('No initiative entries')

      const entries: InitiativeEntry[] = rawEntries.map((e) => {
        // Try to resolve entity ID from existing tokens
        const token = activeMap ? resolveTokenByLabel(activeMap.tokens, e.label) : undefined
        return {
          id: crypto.randomUUID(),
          entityId: token?.entityId || crypto.randomUUID(),
          entityName: e.label,
          entityType: e.entityType || 'enemy',
          roll: e.roll,
          modifier: e.modifier || 0,
          total: e.roll + (e.modifier || 0),
          isActive: false
        }
      })
      gameStore.startInitiative(entries)

      // Init turn states for all entries with speed from tokens
      for (const entry of entries) {
        const token = activeMap?.tokens.find((t) => t.entityId === entry.entityId)
        gameStore.initTurnState(entry.entityId, token?.walkSpeed ?? 30)
      }
      return true
    }

    case 'add_to_initiative': {
      const token = activeMap ? resolveTokenByLabel(activeMap.tokens, action.label as string) : undefined
      const entry: InitiativeEntry = {
        id: crypto.randomUUID(),
        entityId: token?.entityId || crypto.randomUUID(),
        entityName: action.label as string,
        entityType: (action.entityType as 'player' | 'npc' | 'enemy') || 'enemy',
        roll: action.roll as number,
        modifier: (action.modifier as number) || 0,
        total: (action.roll as number) + ((action.modifier as number) || 0),
        isActive: false
      }
      gameStore.addToInitiative(entry)
      gameStore.initTurnState(entry.entityId, token?.walkSpeed ?? 30)
      return true
    }

    case 'next_turn': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      gameStore.nextTurn()
      return true
    }

    case 'end_initiative': {
      gameStore.endInitiative()
      return true
    }

    case 'remove_from_initiative': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      const entry = gameStore.initiative.entries.find(
        (e) => e.entityName.toLowerCase() === (action.label as string).toLowerCase()
      )
      if (!entry) throw new Error(`Initiative entry not found: ${action.label}`)
      gameStore.removeFromInitiative(entry.id)
      return true
    }

    // ── Fog of War ──

    case 'reveal_fog': {
      if (!activeMap) throw new Error('No active map')
      const cells = action.cells as Array<{ x: number; y: number }>
      if (!Array.isArray(cells)) throw new Error('Missing cells array')
      gameStore.revealFog(activeMap.id, cells)
      return true
    }

    case 'hide_fog': {
      if (!activeMap) throw new Error('No active map')
      const cells = action.cells as Array<{ x: number; y: number }>
      if (!Array.isArray(cells)) throw new Error('Missing cells array')
      gameStore.hideFog(activeMap.id, cells)
      return true
    }

    // ── Environment ──

    case 'set_ambient_light': {
      const level = action.level as 'bright' | 'dim' | 'darkness'
      if (!['bright', 'dim', 'darkness'].includes(level)) throw new Error(`Invalid light level: ${level}`)
      gameStore.setAmbientLight(level)
      return true
    }

    case 'set_underwater_combat': {
      gameStore.setUnderwaterCombat(action.enabled as boolean)
      return true
    }

    case 'set_travel_pace': {
      const pace = action.pace as 'fast' | 'normal' | 'slow' | null
      gameStore.setTravelPace(pace)
      return true
    }

    // ── Shop ──

    case 'open_shop': {
      const name = (action.name as string) || 'Shop'
      gameStore.openShop(name)

      const items = action.items as
        | Array<{
            name: string
            category: string
            price: { gp?: number; sp?: number; cp?: number }
            quantity: number
            description?: string
          }>
        | undefined
      if (items && Array.isArray(items)) {
        const shopItems = items.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          category: item.category || 'General',
          price: item.price || { gp: 0 },
          quantity: item.quantity || 1,
          description: item.description
        }))
        gameStore.setShopInventory(shopItems)
      }

      // Broadcast to clients
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('dm:shop-update', {
        shopInventory: gameStore.shopInventory,
        shopName: name
      })
      return true
    }

    case 'close_shop': {
      gameStore.closeShop()
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('dm:shop-update', { shopInventory: [], shopName: '' })
      return true
    }

    case 'add_shop_item': {
      gameStore.addShopItem({
        id: crypto.randomUUID(),
        name: action.name as string,
        category: (action.category as string) || 'General',
        price: (action.price as { gp?: number; sp?: number; cp?: number }) || { gp: 0 },
        quantity: (action.quantity as number) || 1,
        description: action.description as string | undefined
      })
      return true
    }

    case 'remove_shop_item': {
      const shop = useGameStore.getState().shopInventory
      const item = shop.find((i) => i.name.toLowerCase() === (action.name as string).toLowerCase())
      if (!item) throw new Error(`Shop item not found: ${action.name}`)
      gameStore.removeShopItem(item.id)
      return true
    }

    // ── Map ──

    case 'switch_map': {
      const map = resolveMapByName(gameStore.maps, action.mapName as string)
      if (!map) throw new Error(`Map not found: ${action.mapName}`)
      gameStore.setActiveMap(map.id)
      return true
    }

    // ── Sidebar ──

    case 'add_sidebar_entry': {
      const category = action.category as 'allies' | 'enemies' | 'places'
      if (!['allies', 'enemies', 'places'].includes(category)) throw new Error(`Invalid sidebar category: ${category}`)
      gameStore.addSidebarEntry(category, {
        id: crypto.randomUUID(),
        name: action.name as string,
        description: action.description as string | undefined,
        visibleToPlayers: action.visibleToPlayers !== false,
        isAutoPopulated: false
      })
      return true
    }

    case 'remove_sidebar_entry': {
      const category = action.category as 'allies' | 'enemies' | 'places'
      const entries = gameStore[category]
      const entry = entries.find((e) => e.name.toLowerCase() === (action.name as string).toLowerCase())
      if (!entry) throw new Error(`Sidebar entry not found: ${action.name}`)
      gameStore.removeSidebarEntry(category, entry.id)
      return true
    }

    // ── Timer ──

    case 'start_timer': {
      const seconds = action.seconds as number
      const targetName = (action.targetName as string) || ''
      gameStore.startTimer(seconds, targetName)
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('dm:timer-start', { seconds, targetName })
      return true
    }

    case 'stop_timer': {
      gameStore.stopTimer()
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('dm:timer-stop', {})
      return true
    }

    // ── Hidden Dice ──

    case 'hidden_dice_roll': {
      const formula = action.formula as string
      const { rolls, total } = rollDiceFormula(formula)
      gameStore.addHiddenDiceResult({
        id: crypto.randomUUID(),
        formula,
        rolls,
        total,
        timestamp: Date.now()
      })
      return true
    }

    // ── Communication ──

    case 'whisper_player': {
      const peerId = resolvePlayerByName(action.playerName as string)
      if (!peerId) throw new Error(`Player not found: ${action.playerName}`)
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('dm:whisper-player', {
        targetPeerId: peerId,
        targetName: action.playerName as string,
        message: action.message as string
      })
      return true
    }

    case 'system_message': {
      const addChatMessage = useLobbyStore.getState().addChatMessage
      addChatMessage({
        id: `ai-sys-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'ai-dm',
        senderName: 'System',
        content: action.message as string,
        timestamp: Date.now(),
        isSystem: true
      })
      const sendMessage = useNetworkStore.getState().sendMessage
      sendMessage('chat:message', {
        message: action.message as string,
        isSystem: true
      })
      return true
    }

    // ── Entity Conditions ──

    case 'add_entity_condition': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.entityLabel as string)
      if (!token) throw new Error(`Token not found: ${action.entityLabel}`)
      gameStore.addCondition({
        id: crypto.randomUUID(),
        entityId: token.entityId,
        entityName: token.label,
        condition: action.condition as string,
        value: action.value as number | undefined,
        duration: (action.duration as number | 'permanent') ?? 'permanent',
        source: (action.source as string) || 'AI DM',
        appliedRound: gameStore.round
      })
      return true
    }

    case 'remove_entity_condition': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.entityLabel as string)
      if (!token) throw new Error(`Token not found: ${action.entityLabel}`)
      const condition = gameStore.conditions.find(
        (c) => c.entityId === token.entityId && c.condition.toLowerCase() === (action.condition as string).toLowerCase()
      )
      if (!condition) throw new Error(`Condition "${action.condition}" not found on ${action.entityLabel}`)
      gameStore.removeCondition(condition.id)
      return true
    }

    // ── Creature Placement (uses SRD stat blocks) ──

    case 'place_creature': {
      if (!activeMap) throw new Error('No active map')
      const creatureName = action.creatureName as string
      if (!creatureName) throw new Error('Missing creatureName')
      const gridX = action.gridX as number
      const gridY = action.gridY as number
      if (typeof gridX !== 'number' || typeof gridY !== 'number') throw new Error('Missing gridX/gridY')

      // Look up creature from loaded monster data
      const monsters = monsterCache
      const creature = monsters?.find((m) => m.name.toLowerCase() === creatureName.toLowerCase())
      if (!creature) {
        // Fall back to basic place_token behavior
        const token: MapToken = {
          id: crypto.randomUUID(),
          entityId: crypto.randomUUID(),
          entityType: (action.entityType as 'player' | 'npc' | 'enemy') || 'enemy',
          label: (action.label as string) || creatureName,
          gridX,
          gridY,
          sizeX: (action.sizeX as number) || 1,
          sizeY: (action.sizeY as number) || 1,
          visibleToPlayers: action.visibleToPlayers !== false,
          conditions: [],
          currentHP: action.hp as number | undefined,
          maxHP: action.hp as number | undefined,
          ac: action.ac as number | undefined,
          walkSpeed: action.speed as number | undefined
        }
        gameStore.addToken(activeMap.id, token)
        return true
      }

      const dims = getSizeTokenDimensions(creature.size)
      const token: MapToken = {
        id: crypto.randomUUID(),
        entityId: crypto.randomUUID(),
        entityType: (action.entityType as 'player' | 'npc' | 'enemy') || 'enemy',
        label: (action.label as string) || creature.name,
        gridX,
        gridY,
        sizeX: dims.x,
        sizeY: dims.y,
        visibleToPlayers: action.visibleToPlayers !== false,
        conditions: [],
        currentHP: creature.hp,
        maxHP: creature.hp,
        ac: creature.ac,
        monsterStatBlockId: creature.id,
        walkSpeed: creature.speed.walk ?? 0,
        swimSpeed: creature.speed.swim,
        climbSpeed: creature.speed.climb,
        flySpeed: creature.speed.fly,
        initiativeModifier: creature.abilityScores ? Math.floor((creature.abilityScores.dex - 10) / 2) : 0,
        resistances: creature.resistances,
        vulnerabilities: creature.vulnerabilities,
        immunities: creature.damageImmunities,
        darkvision: !!(creature.senses.darkvision && creature.senses.darkvision > 0)
      }
      gameStore.addToken(activeMap.id, token)

      // Initialize turn state if in initiative
      if (gameStore.initiative && token.walkSpeed) {
        gameStore.initTurnState(token.entityId, token.walkSpeed)
      }
      return true
    }

    // ── Time Management ──

    case 'advance_time': {
      let totalSeconds = 0
      if (action.seconds) totalSeconds += action.seconds as number
      if (action.minutes) totalSeconds += (action.minutes as number) * 60
      if (action.hours) totalSeconds += (action.hours as number) * 3600
      if (action.days) totalSeconds += (action.days as number) * 86400

      if (totalSeconds <= 0) throw new Error('advance_time requires positive time values')

      gameStore.advanceTimeSeconds(totalSeconds)

      // If advancing days, also advance bastions
      if (action.days && (action.days as number) > 0) {
        import('../stores/useBastionStore').then(({ useBastionStore }) => {
          const bastionStore = useBastionStore.getState()
          const campaignId = gameStore.campaignId
          const linked = bastionStore.bastions.filter((b: { campaignId: string | null }) => b.campaignId === campaignId)
          for (const bastion of linked) {
            bastionStore.advanceTime(bastion.id, action.days as number)
          }
        })
      }

      // Broadcast time sync
      const newTime = useGameStore.getState().inGameTime
      if (newTime) {
        const sendMsg = useNetworkStore.getState().sendMessage
        sendMsg('dm:time-sync', { totalSeconds: newTime.totalSeconds })
      }

      // Check expired light sources
      const expired = useGameStore.getState().checkExpiredSources()
      if (expired.length > 0) {
        const addChat = useLobbyStore.getState().addChatMessage
        const sendMsg2 = useNetworkStore.getState().sendMessage
        for (const ls of expired) {
          const msg = `${ls.entityName}'s ${ls.sourceName} goes out.`
          addChat({
            id: `ai-light-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            senderId: 'system',
            senderName: 'System',
            content: msg,
            timestamp: Date.now(),
            isSystem: true
          })
          sendMsg2('chat:message', { message: msg, isSystem: true })
        }
      }
      return true
    }

    case 'set_time': {
      if (action.totalSeconds !== undefined) {
        gameStore.setInGameTime({ totalSeconds: action.totalSeconds as number })
      } else if (gameStore.inGameTime) {
        // Adjust hour/minute on current day
        const hour = (action.hour as number) ?? 0
        const minute = (action.minute as number) ?? 0
        const currentSeconds = gameStore.inGameTime.totalSeconds
        const daySeconds = Math.floor(currentSeconds / 86400) * 86400
        gameStore.setInGameTime({ totalSeconds: daySeconds + hour * 3600 + minute * 60 })
      }

      const newTime2 = useGameStore.getState().inGameTime
      if (newTime2) {
        const sendMsg = useNetworkStore.getState().sendMessage
        sendMsg('dm:time-sync', { totalSeconds: newTime2.totalSeconds })
      }
      return true
    }

    case 'share_time': {
      const time = gameStore.inGameTime
      if (!time) throw new Error('No in-game time set')

      // Post as chat message
      const addChat = useLobbyStore.getState().addChatMessage
      const sendMsg = useNetworkStore.getState().sendMessage
      const customMsg = action.message as string | undefined

      if (customMsg) {
        addChat({
          id: `ai-time-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'ai-dm',
          senderName: 'Dungeon Master',
          content: customMsg,
          timestamp: Date.now(),
          isSystem: true
        })
        sendMsg('chat:message', { message: customMsg, isSystem: true })
      }

      // Also broadcast dm:time-share for client UI
      sendMsg('dm:time-share', { formattedTime: customMsg || `Time: ${time.totalSeconds}s` })
      return true
    }

    case 'light_source': {
      const entityName = action.entityName as string
      const sourceName = action.sourceName as string
      if (!entityName || !sourceName) throw new Error('Missing entityName or sourceName')

      const sourceKey = sourceName.toLowerCase().replace(/\s+/g, '-')
      const sourceData = LIGHT_SOURCES[sourceKey]
      if (!sourceData) throw new Error(`Unknown light source: ${sourceName}`)

      const token = activeMap ? resolveTokenByLabel(activeMap.tokens, entityName) : undefined
      gameStore.lightSource(token?.entityId ?? entityName, entityName, sourceKey, sourceData.durationSeconds)
      return true
    }

    case 'extinguish_source': {
      const entityName = action.entityName as string
      const sourceName = action.sourceName as string
      if (!entityName) throw new Error('Missing entityName')

      const sources = gameStore.activeLightSources
      const source = sources.find(
        (s) =>
          s.entityName.toLowerCase() === entityName.toLowerCase() &&
          (!sourceName || s.sourceName.toLowerCase().includes(sourceName.toLowerCase()))
      )
      if (!source) throw new Error(`No active light source found for ${entityName}`)
      gameStore.extinguishSource(source.id)
      return true
    }

    case 'sound_effect': {
      const sound = action.sound as string
      if (sound) playSound(sound as SoundEvent)
      return true
    }

    default:
      throw new Error(`Unknown DM action: ${action.action}`)
  }
}

/**
 * Build a compact text snapshot of the current game state for AI context.
 */
export function buildGameStateSnapshot(): string {
  const gameStore = useGameStore.getState()
  const activeMap = gameStore.maps.find((m) => m.id === gameStore.activeMapId)

  const lines: string[] = ['[GAME STATE]']

  // Active map info
  if (activeMap) {
    const gridCols = Math.ceil(activeMap.width / (activeMap.grid.cellSize || 40))
    const gridRows = Math.ceil(activeMap.height / (activeMap.grid.cellSize || 40))
    lines.push(`Active Map: "${activeMap.name}" (${gridCols}x${gridRows} cells, 5ft/cell)`)

    // Tokens
    if (activeMap.tokens.length > 0) {
      lines.push('Tokens:')
      for (const t of activeMap.tokens) {
        let desc = `- ${t.label} (${t.entityType}) at (${t.gridX}, ${t.gridY}) ${t.sizeX}x${t.sizeY}`
        if (t.currentHP != null && t.maxHP != null) desc += ` HP:${t.currentHP}/${t.maxHP}`
        if (t.ac != null) desc += ` AC:${t.ac}`
        if (t.walkSpeed) desc += ` Speed:${t.walkSpeed}`
        if (t.conditions.length > 0) desc += ` [${t.conditions.join(', ')}]`
        if (t.companionType) desc += ` {${t.companionType}}`
        if (t.monsterStatBlockId) desc += ` creature:${t.monsterStatBlockId}`
        lines.push(desc)
      }
    } else {
      lines.push('Tokens: none')
    }
  } else {
    lines.push('Active Map: none')
  }

  // Initiative
  if (gameStore.initiative) {
    lines.push(`\nInitiative: Round ${gameStore.initiative.round}`)
    for (let i = 0; i < gameStore.initiative.entries.length; i++) {
      const e = gameStore.initiative.entries[i]
      const marker = i === gameStore.initiative.currentIndex ? ' <- CURRENT' : ''
      lines.push(`  ${i + 1}. ${e.entityName} (${e.total})${marker}`)
    }
  }

  // Entity conditions
  if (gameStore.conditions.length > 0) {
    lines.push('\nConditions:')
    for (const c of gameStore.conditions) {
      lines.push(`- ${c.entityName}: ${c.condition}${c.value ? ` ${c.value}` : ''} (${c.source})`)
    }
  }

  // Environment
  const envParts: string[] = []
  if (gameStore.ambientLight !== 'bright') envParts.push(`Light: ${gameStore.ambientLight}`)
  if (gameStore.underwaterCombat) envParts.push('Underwater: yes')
  if (gameStore.travelPace) envParts.push(`Travel Pace: ${gameStore.travelPace}`)
  if (envParts.length > 0) {
    lines.push(`\n${envParts.join(' | ')}`)
  }

  // Available maps
  if (gameStore.maps.length > 1) {
    lines.push(`\nAvailable Maps: ${gameStore.maps.map((m) => m.name).join(', ')}`)
  }

  // In-game time
  if (gameStore.inGameTime) {
    const totalSec = gameStore.inGameTime.totalSeconds
    const hour = Math.floor((totalSec % 86400) / 3600)
    const minute = Math.floor((totalSec % 3600) / 60)
    const dayNum = Math.floor(totalSec / 86400) + 1
    const phase =
      hour >= 5 && hour < 7
        ? 'dawn'
        : hour >= 7 && hour < 12
          ? 'morning'
          : hour >= 12 && hour < 18
            ? 'afternoon'
            : hour >= 18 && hour < 20
              ? 'dusk'
              : hour >= 20 && hour < 22
                ? 'evening'
                : 'night'
    lines.push(`\n[GAME TIME]`)
    lines.push(`Day ${dayNum}, ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} (${phase})`)
    lines.push(`Total seconds: ${totalSec}`)
    if (gameStore.restTracking) {
      if (gameStore.restTracking.lastLongRestSeconds != null) {
        const sinceLR = totalSec - gameStore.restTracking.lastLongRestSeconds
        lines.push(`Time since last long rest: ${Math.floor(sinceLR / 3600)} hours`)
      }
    }
    // Active light sources
    if (gameStore.activeLightSources.length > 0) {
      lines.push('Active light sources:')
      for (const ls of gameStore.activeLightSources) {
        const remaining =
          ls.durationSeconds === Infinity
            ? 'permanent'
            : `${Math.max(0, Math.ceil((ls.durationSeconds - (totalSec - ls.startedAtSeconds)) / 60))} min`
        lines.push(`  - ${ls.entityName}: ${ls.sourceName} (${remaining} remaining)`)
      }
    }
    lines.push(`[/GAME TIME]`)
  }

  // Shop
  if (gameStore.shopOpen) {
    lines.push(`\nShop Open: "${gameStore.shopName}" (${gameStore.shopInventory.length} items)`)
  }

  lines.push('[/GAME STATE]')
  return lines.join('\n')
}
