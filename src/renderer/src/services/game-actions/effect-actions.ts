/**
 * Effect & state actions — time, shops, sidebar, timers, communication,
 * hidden dice, journal, map switching, bastion management.
 */

import { rollDiceFormula } from './dice-helpers'
import { findBastionByOwnerName, resolveMapByName, resolvePlayerByName } from './name-resolver'
import type { ActiveMap, DmAction, GameStoreSnapshot, StoreAccessors } from './types'

// ── Time Management ──

export function executeAdvanceTime(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  let totalSeconds = 0
  if (action.seconds) totalSeconds += action.seconds as number
  if (action.minutes) totalSeconds += (action.minutes as number) * 60
  if (action.hours) totalSeconds += (action.hours as number) * 3600
  if (action.days) totalSeconds += (action.days as number) * 86400

  if (totalSeconds <= 0) throw new Error('advance_time requires positive time values')

  gameStore.advanceTimeSeconds(totalSeconds)

  // If advancing days, also advance bastions
  if (action.days && (action.days as number) > 0) {
    import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
      const bastionStore = useBastionStore.getState()
      const campaignId = gameStore.campaignId
      const linked = bastionStore.bastions.filter((b: { campaignId: string | null }) => b.campaignId === campaignId)
      for (const bastion of linked) {
        bastionStore.advanceTime(bastion.id, action.days as number)
      }
    })
  }

  // Broadcast time sync
  const newTime = stores.getGameStore().getState().inGameTime
  if (newTime) {
    const sendMsg = stores.getNetworkStore().getState().sendMessage
    sendMsg('dm:time-sync', { totalSeconds: newTime.totalSeconds })
  }

  // Check expired light sources
  const expired = stores.getGameStore().getState().checkExpiredSources()
  if (expired.length > 0) {
    const addChat = stores.getLobbyStore().getState().addChatMessage
    const sendMsg2 = stores.getNetworkStore().getState().sendMessage
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

export function executeSetTime(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
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

  const newTime2 = stores.getGameStore().getState().inGameTime
  if (newTime2) {
    const sendMsg = stores.getNetworkStore().getState().sendMessage
    sendMsg('dm:time-sync', { totalSeconds: newTime2.totalSeconds })
  }
  return true
}

export function executeShareTime(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const time = gameStore.inGameTime
  if (!time) throw new Error('No in-game time set')

  // Post as chat message
  const addChat = stores.getLobbyStore().getState().addChatMessage
  const sendMsg = stores.getNetworkStore().getState().sendMessage
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

// ── Shop ──

export function executeOpenShop(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
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
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('dm:shop-update', {
    shopInventory: gameStore.shopInventory,
    shopName: name
  })
  return true
}

export function executeCloseShop(
  _action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  gameStore.closeShop()
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('dm:shop-update', { shopInventory: [], shopName: '' })
  return true
}

export function executeAddShopItem(action: DmAction, gameStore: GameStoreSnapshot): boolean {
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

export function executeRemoveShopItem(
  action: DmAction,
  _gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const shop = stores.getGameStore().getState().shopInventory
  const item = shop.find((i) => i.name.toLowerCase() === (action.name as string).toLowerCase())
  if (!item) throw new Error(`Shop item not found: ${action.name}`)
  stores.getGameStore().getState().removeShopItem(item.id)
  return true
}

// ── Map ──

export function executeSwitchMap(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const map = resolveMapByName(gameStore.maps, action.mapName as string)
  if (!map) throw new Error(`Map not found: ${action.mapName}`)
  gameStore.setActiveMap(map.id)
  const sendMsg = stores.getNetworkStore().getState().sendMessage
  sendMsg('dm:map-change', { mapId: map.id })
  return true
}

// ── Sidebar ──

export function executeAddSidebarEntry(action: DmAction, gameStore: GameStoreSnapshot): boolean {
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

export function executeRemoveSidebarEntry(action: DmAction, gameStore: GameStoreSnapshot): boolean {
  const category = action.category as 'allies' | 'enemies' | 'places'
  const entries = gameStore[category]
  const entry = entries.find((e) => e.name.toLowerCase() === (action.name as string).toLowerCase())
  if (!entry) throw new Error(`Sidebar entry not found: ${action.name}`)
  gameStore.removeSidebarEntry(category, entry.id)
  return true
}

// ── Timer ──

export function executeStartTimer(
  action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const seconds = action.seconds as number
  const targetName = (action.targetName as string) || ''
  gameStore.startTimer(seconds, targetName)
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('dm:timer-start', { seconds, targetName })
  return true
}

export function executeStopTimer(
  _action: DmAction,
  gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  gameStore.stopTimer()
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('dm:timer-stop', {})
  return true
}

// ── Hidden Dice ──

export function executeHiddenDiceRoll(action: DmAction, gameStore: GameStoreSnapshot): boolean {
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

export function executeWhisperPlayer(
  action: DmAction,
  _gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const peerId = resolvePlayerByName(action.playerName as string, stores)
  if (!peerId) throw new Error(`Player not found: ${action.playerName}`)
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('dm:whisper-player', {
    targetPeerId: peerId,
    targetName: action.playerName as string,
    message: action.message as string
  })
  return true
}

export function executeSystemMessage(
  action: DmAction,
  _gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const addChatMessage = stores.getLobbyStore().getState().addChatMessage
  addChatMessage({
    id: `ai-sys-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    senderId: 'ai-dm',
    senderName: 'System',
    content: action.message as string,
    timestamp: Date.now(),
    isSystem: true
  })
  const sendMessage = stores.getNetworkStore().getState().sendMessage
  sendMessage('chat:message', {
    message: action.message as string,
    isSystem: true
  })
  return true
}

// ── Journal ──

export function executeAddJournalEntry(action: DmAction, gameStore: GameStoreSnapshot): boolean {
  const content = action.content as string
  if (!content) throw new Error('No content for journal entry')
  const inGameTime = gameStore.inGameTime
  gameStore.addLogEntry(content, inGameTime ? String(inGameTime.totalSeconds) : undefined)
  return true
}

// ── Bastion Management ──

export function executeBastionAdvanceTime(action: DmAction): boolean {
  const days = action.days as number
  const ownerName = action.bastionOwner as string
  if (typeof days !== 'number' || days <= 0) throw new Error('Invalid days for bastion_advance_time')

  import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
    const bastionStore = useBastionStore.getState()
    const bastion = findBastionByOwnerName(bastionStore.bastions, ownerName)
    if (bastion) bastionStore.advanceTime(bastion.id, days)
  })
  return true
}

export function executeBastionIssueOrder(action: DmAction): boolean {
  const ownerName = action.bastionOwner as string
  const facilityName = action.facilityName as string
  const orderType = action.orderType as string
  if (!ownerName || !facilityName || !orderType) throw new Error('Missing bastion order params')

  import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
    const bastionStore = useBastionStore.getState()
    const bastion = findBastionByOwnerName(bastionStore.bastions, ownerName)
    if (!bastion) return
    const allFacilities = [...bastion.basicFacilities, ...bastion.specialFacilities]
    const facility = allFacilities.find((f) => f.name.toLowerCase() === facilityName.toLowerCase())
    if (!facility) return
    bastionStore.issueOrder(
      bastion.id,
      bastion.turns.length > 0 ? bastion.turns[bastion.turns.length - 1].turnNumber : 1,
      facility.id,
      orderType as import('../../types/bastion').BastionOrderType,
      (action.details as string) || ''
    )
  })
  return true
}

export function executeBastionDepositGold(action: DmAction): boolean {
  const ownerName = action.bastionOwner as string
  const amount = action.amount as number
  if (!ownerName || typeof amount !== 'number') throw new Error('Missing bastion deposit params')

  import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
    const bastionStore = useBastionStore.getState()
    const bastion = findBastionByOwnerName(bastionStore.bastions, ownerName)
    if (bastion) bastionStore.depositGold(bastion.id, amount)
  })
  return true
}

export function executeBastionWithdrawGold(action: DmAction): boolean {
  const ownerName = action.bastionOwner as string
  const amount = action.amount as number
  if (!ownerName || typeof amount !== 'number') throw new Error('Missing bastion withdraw params')

  import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
    const bastionStore = useBastionStore.getState()
    const bastion = findBastionByOwnerName(bastionStore.bastions, ownerName)
    if (bastion) bastionStore.withdrawGold(bastion.id, amount)
  })
  return true
}

export function executeBastionResolveEvent(
  action: DmAction,
  _gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const addChat = stores.getLobbyStore().getState().addChatMessage
  const sendMsg = stores.getNetworkStore().getState().sendMessage
  const msg = `Bastion event "${action.eventType}" resolved for ${action.bastionOwner}'s bastion.`
  addChat({
    id: `ai-bastion-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    senderId: 'ai-dm',
    senderName: 'Dungeon Master',
    content: msg,
    timestamp: Date.now(),
    isSystem: true
  })
  sendMsg('chat:message', { message: msg, isSystem: true })
  return true
}

export function executeBastionRecruit(action: DmAction): boolean {
  const ownerName = action.bastionOwner as string
  const facilityName = action.facilityName as string
  const names = action.names as string[]
  if (!ownerName || !facilityName || !Array.isArray(names)) throw new Error('Missing bastion recruit params')

  import('../../stores/use-bastion-store').then(({ useBastionStore }) => {
    const bastionStore = useBastionStore.getState()
    const bastion = findBastionByOwnerName(bastionStore.bastions, ownerName)
    if (!bastion) return
    const allFacilities = [...bastion.basicFacilities, ...bastion.specialFacilities]
    const facility = allFacilities.find((f) => f.name.toLowerCase() === facilityName.toLowerCase())
    if (!facility) return
    bastionStore.recruitDefenders(bastion.id, facility.id, names)
  })
  return true
}

export function executeBastionAddCreature(
  action: DmAction,
  _gameStore: GameStoreSnapshot,
  _activeMap: ActiveMap,
  stores: StoreAccessors
): boolean {
  const addChat = stores.getLobbyStore().getState().addChatMessage
  const sendMsg = stores.getNetworkStore().getState().sendMessage
  const msg = `${action.creatureName} added to ${action.bastionOwner}'s ${action.facilityName}.`
  addChat({
    id: `ai-bastion-cr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    senderId: 'ai-dm',
    senderName: 'Dungeon Master',
    content: msg,
    timestamp: Date.now(),
    isSystem: true
  })
  sendMsg('chat:message', { message: msg, isSystem: true })
  return true
}
