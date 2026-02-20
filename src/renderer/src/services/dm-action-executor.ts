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

// ── Area Geometry Helpers ──

function findTokensInArea(
  tokens: MapToken[],
  originX: number,
  originY: number,
  radiusCells: number,
  shape: string,
  widthCells?: number
): MapToken[] {
  return tokens.filter((t) => {
    const dx = t.gridX - originX
    const dy = t.gridY - originY
    switch (shape) {
      case 'sphere':
      case 'emanation':
      case 'cylinder':
        return Math.sqrt(dx * dx + dy * dy) <= radiusCells
      case 'cube':
      case 'cone': {
        const half = radiusCells
        return Math.abs(dx) <= half && Math.abs(dy) <= half
      }
      case 'line': {
        const w = widthCells ?? 1
        return Math.abs(dy) <= Math.floor(w / 2) && dx >= 0 && dx <= radiusCells
      }
      default:
        return Math.sqrt(dx * dx + dy * dy) <= radiusCells
    }
  })
}

// ── Broadcast Sync Helpers (Task 60) ──

function broadcastInitiativeSync(): void {
  const gs = useGameStore.getState()
  if (!gs.initiative) return
  const sendMsg = useNetworkStore.getState().sendMessage
  sendMsg('dm:initiative-update', {
    order: gs.initiative.entries.map((e) => ({ id: e.id, name: e.entityName, initiative: e.total })),
    currentTurnIndex: gs.initiative.currentIndex
  })
}

function broadcastTokenSync(mapId: string): void {
  const gs = useGameStore.getState()
  const map = gs.maps.find((m) => m.id === mapId)
  if (!map) return
  const sendMsg = useNetworkStore.getState().sendMessage
  for (const t of map.tokens) {
    sendMsg('dm:token-move', { tokenId: t.id, gridX: t.gridX, gridY: t.gridY })
  }
}

function broadcastConditionSync(): void {
  const gs = useGameStore.getState()
  const sendMsg = useNetworkStore.getState().sendMessage
  for (const c of gs.conditions) {
    sendMsg('dm:condition-update', { targetId: c.entityId, condition: c.condition, active: true })
  }
}

// ── Main Executor ──

/**
 * Execute DM actions. If DM approval is required (useAiDmStore.dmApprovalRequired),
 * actions are queued as pendingActions instead of executing immediately.
 * Pass `bypassApproval: true` to force execution (used when DM approves pending actions).
 */
let _useAiDmStore: typeof import('../stores/useAiDmStore').useAiDmStore | null = null
function getAiDmStore(): typeof import('../stores/useAiDmStore').useAiDmStore {
  if (!_useAiDmStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _useAiDmStore = (require('../stores/useAiDmStore') as typeof import('../stores/useAiDmStore')).useAiDmStore
  }
  return _useAiDmStore
}

export function executeDmActions(actions: DmAction[], bypassApproval = false): ExecutionResult {
  if (!bypassApproval) {
    const aiStore = getAiDmStore().getState()
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
      broadcastTokenSync(activeMap.id)
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
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:token-move', { tokenId: token.id, gridX, gridY })
      return true
    }

    case 'remove_token': {
      if (!activeMap) throw new Error('No active map')
      const token = resolveTokenByLabel(activeMap.tokens, action.label as string)
      if (!token) throw new Error(`Token not found: ${action.label}`)
      gameStore.removeToken(activeMap.id, token.id)
      broadcastTokenSync(activeMap.id)
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
      broadcastTokenSync(activeMap.id)
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
      broadcastInitiativeSync()
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
      broadcastInitiativeSync()
      return true
    }

    case 'next_turn': {
      if (!gameStore.initiative) throw new Error('No initiative running')

      // Reset legendary actions for the creature whose turn is starting
      const currentIdx = gameStore.initiative.currentIndex
      const nextIdx = (currentIdx + 1) % gameStore.initiative.entries.length
      const nextEntry = gameStore.initiative.entries[nextIdx]
      if (nextEntry?.legendaryActions) {
        gameStore.updateInitiativeEntry(nextEntry.id, {
          legendaryActions: { maximum: nextEntry.legendaryActions.maximum, used: 0 }
        })
      }

      // Auto-roll recharge abilities for the next creature
      if (nextEntry?.rechargeAbilities && nextEntry.entityType === 'enemy') {
        const abilities = [...nextEntry.rechargeAbilities]
        let anyRecharged = false
        for (const ability of abilities) {
          if (!ability.available) {
            const roll = rollDiceFormula('1d6')
            if (roll.total >= ability.rechargeOn) {
              ability.available = true
              anyRecharged = true
              const addChat = useLobbyStore.getState().addChatMessage
              const sendMsg = useNetworkStore.getState().sendMessage
              const msg = `${nextEntry.entityName}'s ${ability.name} has recharged! (rolled ${roll.total})`
              addChat({
                id: `ai-recharge-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'ai-dm',
                senderName: 'Dungeon Master',
                content: msg,
                timestamp: Date.now(),
                isSystem: true
              })
              sendMsg('chat:message', { message: msg, isSystem: true })
            }
          }
        }
        if (anyRecharged) {
          gameStore.updateInitiativeEntry(nextEntry.id, { rechargeAbilities: abilities })
        }
      }

      gameStore.nextTurn()
      broadcastInitiativeSync()
      return true
    }

    case 'end_initiative': {
      gameStore.endInitiative()
      broadcastInitiativeSync()
      return true
    }

    case 'remove_from_initiative': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      const entry = gameStore.initiative.entries.find(
        (e) => e.entityName.toLowerCase() === (action.label as string).toLowerCase()
      )
      if (!entry) throw new Error(`Initiative entry not found: ${action.label}`)
      gameStore.removeFromInitiative(entry.id)
      broadcastInitiativeSync()
      return true
    }

    // ── Fog of War ──

    case 'reveal_fog': {
      if (!activeMap) throw new Error('No active map')
      const cells = action.cells as Array<{ x: number; y: number }>
      if (!Array.isArray(cells)) throw new Error('Missing cells array')
      gameStore.revealFog(activeMap.id, cells)
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:fog-reveal', { cells, reveal: true })
      return true
    }

    case 'hide_fog': {
      if (!activeMap) throw new Error('No active map')
      const cells = action.cells as Array<{ x: number; y: number }>
      if (!Array.isArray(cells)) throw new Error('Missing cells array')
      gameStore.hideFog(activeMap.id, cells)
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:fog-reveal', { cells, reveal: false })
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
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:map-change', { mapId: map.id })
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
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:condition-update', {
        targetId: token.entityId,
        condition: action.condition as string,
        active: true
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
      const sendMsg = useNetworkStore.getState().sendMessage
      sendMsg('dm:condition-update', {
        targetId: token.entityId,
        condition: action.condition as string,
        active: false
      })
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
        broadcastTokenSync(activeMap.id)
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
      broadcastTokenSync(activeMap.id)
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

    // ── Resting ──

    case 'short_rest': {
      const names = action.characterNames as string[]
      if (!Array.isArray(names) || names.length === 0) throw new Error('No character names for short_rest')

      // Advance time by 1 hour
      gameStore.advanceTimeSeconds(3600)

      // Track rest timing
      const totalSec = useGameStore.getState().inGameTime?.totalSeconds ?? 0
      gameStore.setRestTracking({
        lastLongRestSeconds: gameStore.restTracking?.lastLongRestSeconds ?? null,
        lastShortRestSeconds: totalSec
      })

      const addChat = useLobbyStore.getState().addChatMessage
      const sendMsg = useNetworkStore.getState().sendMessage
      const msg = `Short rest completed for ${names.join(', ')}. Hit dice may be spent to recover HP. Warlock spell slots restored.`
      addChat({
        id: `ai-rest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'ai-dm',
        senderName: 'Dungeon Master',
        content: msg,
        timestamp: Date.now(),
        isSystem: true
      })
      sendMsg('chat:message', { message: msg, isSystem: true })

      const newTime = useGameStore.getState().inGameTime
      if (newTime) sendMsg('dm:time-sync', { totalSeconds: newTime.totalSeconds })
      return true
    }

    case 'long_rest': {
      const names = action.characterNames as string[]
      if (!Array.isArray(names) || names.length === 0) throw new Error('No character names for long_rest')

      // Advance time by 8 hours
      gameStore.advanceTimeSeconds(28800)

      // Track rest timing
      const totalSec = useGameStore.getState().inGameTime?.totalSeconds ?? 0
      gameStore.setRestTracking({
        lastLongRestSeconds: totalSec,
        lastShortRestSeconds: gameStore.restTracking?.lastShortRestSeconds ?? null
      })

      // Remove all Exhaustion conditions for named characters
      if (activeMap) {
        for (const name of names) {
          const token = resolveTokenByLabel(activeMap.tokens, name)
          if (token) {
            const exhaustionConditions = gameStore.conditions.filter(
              (c) => c.entityId === token.entityId && c.condition.toLowerCase() === 'exhaustion'
            )
            for (const ec of exhaustionConditions) {
              gameStore.removeCondition(ec.id)
            }
          }
        }
      }

      const addChat = useLobbyStore.getState().addChatMessage
      const sendMsg = useNetworkStore.getState().sendMessage
      const msg = `Long rest completed for ${names.join(', ')}. All HP restored, spell slots recovered, class resources reset, and all Exhaustion removed.`
      addChat({
        id: `ai-rest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'ai-dm',
        senderName: 'Dungeon Master',
        content: msg,
        timestamp: Date.now(),
        isSystem: true
      })
      sendMsg('chat:message', { message: msg, isSystem: true })

      const newTime = useGameStore.getState().inGameTime
      if (newTime) sendMsg('dm:time-sync', { totalSeconds: newTime.totalSeconds })

      // Broadcast condition changes
      broadcastConditionSync()
      return true
    }

    // ── Area Effects ──

    case 'apply_area_effect': {
      if (!activeMap) throw new Error('No active map')
      const originX = action.originX as number
      const originY = action.originY as number
      const radius = action.radiusOrLength as number
      const shape = action.shape as string
      if (typeof originX !== 'number' || typeof originY !== 'number' || typeof radius !== 'number')
        throw new Error('Missing origin/radius for area effect')

      const radiusCells = Math.ceil(radius / 5)
      const affectedTokens = findTokensInArea(
        activeMap.tokens,
        originX,
        originY,
        radiusCells,
        shape,
        action.widthOrHeight as number | undefined
      )

      if (affectedTokens.length === 0) return true

      const saveType = action.saveType as string | undefined
      const saveDC = action.saveDC as number | undefined
      const damageFormula = action.damageFormula as string | undefined
      const halfOnSave = action.halfOnSave as boolean | undefined
      const condition = action.condition as string | undefined
      const conditionDuration = action.conditionDuration as number | 'permanent' | undefined

      for (const token of affectedTokens) {
        let saved = false
        if (saveType && saveDC) {
          const saveRoll = rollDiceFormula('1d20')
          saved = saveRoll.total >= saveDC
        }

        if (damageFormula) {
          const dmg = rollDiceFormula(damageFormula)
          let finalDamage = dmg.total
          if (saved && halfOnSave) finalDamage = Math.floor(finalDamage / 2)
          else if (saved && !halfOnSave) finalDamage = 0

          if (finalDamage > 0 && token.currentHP != null) {
            const newHP = Math.max(0, token.currentHP - finalDamage)
            gameStore.updateToken(activeMap.id, token.id, { currentHP: newHP })
          }
        }

        if (condition && (!saved || !saveType)) {
          gameStore.addCondition({
            id: crypto.randomUUID(),
            entityId: token.entityId,
            entityName: token.label,
            condition,
            duration: conditionDuration ?? 'permanent',
            source: 'Area Effect',
            appliedRound: gameStore.round
          })
        }
      }

      broadcastTokenSync(activeMap.id)
      broadcastConditionSync()
      return true
    }

    // ── Legendary Actions & Resistances ──

    case 'use_legendary_action': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      const label = action.entityLabel as string
      const cost = (action.cost as number) || 1
      const entry = gameStore.initiative.entries.find(
        (e) => e.entityName.toLowerCase() === label.toLowerCase()
      )
      if (!entry) throw new Error(`Initiative entry not found: ${label}`)
      if (!entry.legendaryActions) throw new Error(`${label} has no legendary actions`)
      const available = entry.legendaryActions.maximum - entry.legendaryActions.used
      if (available < cost) throw new Error(`${label} has only ${available} legendary actions remaining (needs ${cost})`)

      gameStore.updateInitiativeEntry(entry.id, {
        legendaryActions: {
          maximum: entry.legendaryActions.maximum,
          used: entry.legendaryActions.used + cost
        }
      })
      broadcastInitiativeSync()
      return true
    }

    case 'use_legendary_resistance': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      const label = action.entityLabel as string
      const entry = gameStore.initiative.entries.find(
        (e) => e.entityName.toLowerCase() === label.toLowerCase()
      )
      if (!entry) throw new Error(`Initiative entry not found: ${label}`)
      if (!entry.legendaryResistances || entry.legendaryResistances.remaining <= 0)
        throw new Error(`${label} has no legendary resistances remaining`)

      gameStore.updateInitiativeEntry(entry.id, {
        legendaryResistances: {
          max: entry.legendaryResistances.max,
          remaining: entry.legendaryResistances.remaining - 1
        }
      })

      const addChat = useLobbyStore.getState().addChatMessage
      const sendMsg = useNetworkStore.getState().sendMessage
      const remaining = entry.legendaryResistances.remaining - 1
      const msg = `${label} uses a Legendary Resistance! (${remaining}/${entry.legendaryResistances.max} remaining)`
      addChat({
        id: `ai-lr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'ai-dm',
        senderName: 'Dungeon Master',
        content: msg,
        timestamp: Date.now(),
        isSystem: true
      })
      sendMsg('chat:message', { message: msg, isSystem: true })
      broadcastInitiativeSync()
      return true
    }

    // ── Recharge Roll ──

    case 'recharge_roll': {
      if (!gameStore.initiative) throw new Error('No initiative running')
      const label = action.entityLabel as string
      const abilityName = action.abilityName as string
      const rechargeOn = action.rechargeOn as number
      if (!abilityName || typeof rechargeOn !== 'number') throw new Error('Missing abilityName or rechargeOn')

      const entry = gameStore.initiative.entries.find(
        (e) => e.entityName.toLowerCase() === label.toLowerCase()
      )
      if (!entry) throw new Error(`Initiative entry not found: ${label}`)

      const roll = rollDiceFormula('1d6')
      const recharged = roll.total >= rechargeOn

      const abilities = entry.rechargeAbilities ? [...entry.rechargeAbilities] : []
      const existing = abilities.find((a) => a.name.toLowerCase() === abilityName.toLowerCase())
      if (existing) {
        existing.available = recharged
      } else {
        abilities.push({ name: abilityName, rechargeOn, available: recharged })
      }
      gameStore.updateInitiativeEntry(entry.id, { rechargeAbilities: abilities })

      const addChat = useLobbyStore.getState().addChatMessage
      const sendMsg = useNetworkStore.getState().sendMessage
      const resultText = recharged
        ? `${label}'s ${abilityName} has recharged! (rolled ${roll.total}, needed ${rechargeOn}+)`
        : `${label}'s ${abilityName} did not recharge. (rolled ${roll.total}, needed ${rechargeOn}+)`
      addChat({
        id: `ai-recharge-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'ai-dm',
        senderName: 'Dungeon Master',
        content: resultText,
        timestamp: Date.now(),
        isSystem: true
      })
      sendMsg('chat:message', { message: resultText, isSystem: true })
      broadcastInitiativeSync()
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
        if (t.currentHP != null && t.maxHP != null) {
          const bloodied = t.currentHP <= Math.floor(t.maxHP / 2) && t.currentHP > 0
          desc += ` HP:${t.currentHP}/${t.maxHP}${bloodied ? ' [BLOODIED]' : ''}`
        }
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
      let extras = ''
      if (e.legendaryActions) {
        const avail = e.legendaryActions.maximum - e.legendaryActions.used
        extras += ` LA:${avail}/${e.legendaryActions.maximum}`
      }
      if (e.legendaryResistances) {
        extras += ` LR:${e.legendaryResistances.remaining}/${e.legendaryResistances.max}`
      }
      if (e.rechargeAbilities && e.rechargeAbilities.length > 0) {
        const abilities = e.rechargeAbilities
          .map((a) => `${a.name}(${a.available ? 'ready' : `recharge ${a.rechargeOn}+`})`)
          .join(', ')
        extras += ` [${abilities}]`
      }
      lines.push(`  ${i + 1}. ${e.entityName} (${e.total})${extras}${marker}`)
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

  // Active environmental effects
  if (gameStore.activeEnvironmentalEffects.length > 0) {
    lines.push('\n[ACTIVE EFFECTS]')
    for (const e of gameStore.activeEnvironmentalEffects) {
      lines.push(`- ${e.name}`)
    }
    lines.push('[/ACTIVE EFFECTS]')
  }

  // Active diseases
  if (gameStore.activeDiseases.length > 0) {
    lines.push('\nActive Diseases:')
    for (const d of gameStore.activeDiseases) {
      lines.push(`- ${d.targetName}: ${d.name} (saves: ${d.successCount} success / ${d.failCount} fail)`)
    }
  }

  // Active curses
  if (gameStore.activeCurses.length > 0) {
    lines.push('\nActive Curses:')
    for (const c of gameStore.activeCurses) {
      lines.push(`- ${c.targetName}: ${c.name}${c.source ? ` (from ${c.source})` : ''}`)
    }
  }

  // Placed traps (DM context only — don't reveal to players)
  const armedTraps = gameStore.placedTraps.filter((t) => t.armed)
  if (armedTraps.length > 0) {
    lines.push('\n[DM ONLY] Armed Traps:')
    for (const t of armedTraps) {
      lines.push(`- ${t.name} at (${t.gridX}, ${t.gridY})${t.revealed ? ' [REVEALED]' : ' [HIDDEN]'}`)
    }
  }

  lines.push('[/GAME STATE]')
  return lines.join('\n')
}
