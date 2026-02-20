import { create } from 'zustand'
import type { ShopItem } from '../network/types'
import type { ActiveLightSource, CombatTimerConfig } from '../types/campaign'
import type {
  ActiveCurse,
  ActiveDisease,
  ActiveEnvironmentalEffect,
  PlacedTrap
} from '../types/dm-toolbox'
import type { CustomEffect } from '../types/effects'
import type {
  CombatLogEntry,
  DiceRollRecord,
  EntityCondition,
  GameState,
  GroupRollRequest,
  GroupRollResult,
  Handout,
  HiddenDiceResult,
  InGameTimeState,
  InitiativeEntry,
  SidebarCategory,
  SidebarEntry,
  TurnState
} from '../types/game-state'
import type { GameMap, MapToken } from '../types/map'

interface GameStoreState extends GameState {
  // Shop
  shopOpen: boolean
  shopName: string
  shopInventory: ShopItem[]
  shopMarkup: number
  openShop: (name?: string) => void
  closeShop: () => void
  setShopInventory: (items: ShopItem[]) => void
  addShopItem: (item: ShopItem) => void
  removeShopItem: (itemId: string) => void
  setShopMarkup: (markup: number) => void
  updateShopItem: (itemId: string, updates: Partial<ShopItem>) => void
  purchaseItem: (itemId: string) => void
  // Map actions
  setActiveMap: (mapId: string) => void
  addMap: (map: GameMap) => void

  // Token actions
  addToken: (mapId: string, token: MapToken) => void
  moveToken: (mapId: string, tokenId: string, gridX: number, gridY: number) => void
  removeToken: (mapId: string, tokenId: string) => void
  updateToken: (mapId: string, tokenId: string, updates: Partial<MapToken>) => void

  // Initiative
  startInitiative: (entries: InitiativeEntry[]) => void
  addToInitiative: (entry: InitiativeEntry) => void
  nextTurn: () => void
  prevTurn: () => void
  endInitiative: () => void
  updateInitiativeEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void
  removeFromInitiative: (entryId: string) => void
  reorderInitiative: (fromIndex: number, toIndex: number) => void

  // Conditions
  addCondition: (condition: EntityCondition) => void
  removeCondition: (conditionId: string) => void
  updateCondition: (conditionId: string, updates: Partial<EntityCondition>) => void

  // Fog of war
  revealFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void
  hideFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void

  // Sidebar entries
  allies: SidebarEntry[]
  enemies: SidebarEntry[]
  places: SidebarEntry[]
  addSidebarEntry: (category: SidebarCategory, entry: SidebarEntry) => void
  updateSidebarEntry: (category: SidebarCategory, id: string, updates: Partial<SidebarEntry>) => void
  removeSidebarEntry: (category: SidebarCategory, id: string) => void
  moveSidebarEntry: (fromCategory: SidebarCategory, toCategory: SidebarCategory, entryId: string) => void
  toggleEntryVisibility: (category: SidebarCategory, id: string) => void
  reparentPlace: (entryId: string, newParentId: string | null) => void

  // Timer
  timerSeconds: number
  timerRunning: boolean
  timerTargetName: string
  startTimer: (seconds: number, targetName: string) => void
  stopTimer: () => void
  tickTimer: () => void

  // Hidden dice (DM only)
  hiddenDiceResults: HiddenDiceResult[]
  addHiddenDiceResult: (result: HiddenDiceResult) => void
  clearHiddenDiceResults: () => void

  // Dice roll history (session-wide)
  diceHistory: DiceRollRecord[]
  addDiceRoll: (roll: DiceRollRecord) => void
  clearDiceHistory: () => void

  // Turn state (combat)
  initTurnState: (entityId: string, speed: number) => void
  useAction: (entityId: string) => void
  useBonusAction: (entityId: string) => void
  useReaction: (entityId: string) => void
  useMovement: (entityId: string, feet: number) => void
  setDashing: (entityId: string) => void
  setDisengaging: (entityId: string) => void
  setDodging: (entityId: string) => void
  setHidden: (entityId: string, hidden: boolean) => void
  setConcentrating: (entityId: string, spell: string | undefined) => void
  resetTurnState: (entityId: string, speed: number) => void
  getTurnState: (entityId: string) => TurnState | undefined

  // Bulk token actions
  revealAllTokens: () => void

  // Game flow
  setPaused: (paused: boolean) => void
  setTurnMode: (mode: 'initiative' | 'free') => void
  reset: () => void
  loadGameState: (
    state: Partial<GameState> & {
      allies?: SidebarEntry[]
      enemies?: SidebarEntry[]
      places?: SidebarEntry[]
      inGameTime?: InGameTimeState | null
      restTracking?: { lastLongRestSeconds: number | null; lastShortRestSeconds: number | null } | null
      activeLightSources?: ActiveLightSource[]
      dmNotes?: string
      sessionLog?: SessionLogEntry[]
      currentSessionId?: string
      currentSessionLabel?: string
      weatherOverride?: GameStoreState['weatherOverride']
      moonOverride?: string | null
      savedWeatherPresets?: GameStoreState['savedWeatherPresets']
      handouts?: Handout[]
      combatTimer?: CombatTimerConfig | null
    }
  ) => void

  // Combat environment
  setUnderwaterCombat: (enabled: boolean) => void
  setFlankingEnabled: (enabled: boolean) => void
  setGroupInitiativeEnabled: (enabled: boolean) => void
  setDiagonalRule: (rule: 'standard' | 'alternate') => void
  setAmbientLight: (level: 'bright' | 'dim' | 'darkness') => void

  // Exploration
  setTravelPace: (pace: 'fast' | 'normal' | 'slow' | null) => void
  setMarchingOrder: (order: string[]) => void

  // In-game time
  inGameTime: InGameTimeState | null
  setInGameTime: (time: InGameTimeState | null) => void
  advanceTimeSeconds: (seconds: number) => void
  advanceTimeDays: (days: number) => void

  // Rest tracking
  restTracking: {
    lastLongRestSeconds: number | null
    lastShortRestSeconds: number | null
  } | null
  setRestTracking: (rt: { lastLongRestSeconds: number | null; lastShortRestSeconds: number | null } | null) => void

  // Light sources
  activeLightSources: ActiveLightSource[]
  lightSource: (entityId: string, entityName: string, sourceName: string, durationSeconds: number) => void
  extinguishSource: (sourceId: string) => void
  checkExpiredSources: () => ActiveLightSource[]

  // Custom DM effects
  customEffects: CustomEffect[]
  addCustomEffect: (effect: CustomEffect) => void
  removeCustomEffect: (id: string) => void
  checkExpiredEffects: () => CustomEffect[]

  // Combat log
  combatLog: CombatLogEntry[]
  addCombatLogEntry: (entry: CombatLogEntry) => void
  clearCombatLog: () => void

  // Group roll
  pendingGroupRoll: GroupRollRequest | null
  groupRollResults: GroupRollResult[]
  setPendingGroupRoll: (request: GroupRollRequest | null) => void
  addGroupRollResult: (result: GroupRollResult) => void
  clearGroupRollResults: () => void

  // Wall segments
  addWallSegment: (mapId: string, wall: import('../types/map').WallSegment) => void
  removeWallSegment: (mapId: string, wallId: string) => void
  updateWallSegment: (mapId: string, wallId: string, updates: Partial<import('../types/map').WallSegment>) => void

  // Center map on entity (initiative portrait click)
  centerOnEntityId: string | null
  requestCenterOnEntity: (entityId: string) => void
  clearCenterRequest: () => void

  // Click-to-place token system
  pendingPlacement: { tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'> } | null
  setPendingPlacement: (tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'> | null) => void
  commitPlacement: (mapId: string, gridX: number, gridY: number) => void

  // Weather & moon overrides
  weatherOverride: {
    description: string
    temperature?: number
    temperatureUnit?: 'F' | 'C'
    windSpeed?: string
    mechanicalEffects?: string[]
    preset?: string
  } | null
  moonOverride: string | null
  savedWeatherPresets: Array<{ name: string; description: string; temperature?: number; temperatureUnit?: 'F' | 'C'; windSpeed?: string; mechanicalEffects?: string[]; preset?: string }>
  showWeatherOverlay: boolean
  setWeatherOverride: (override: GameStoreState['weatherOverride']) => void
  setMoonOverride: (override: string | null) => void
  setShowWeatherOverlay: (show: boolean) => void
  addSavedWeatherPreset: (preset: GameStoreState['savedWeatherPresets'][number]) => void
  removeSavedWeatherPreset: (name: string) => void

  // DM Notes (legacy single-text, kept for migration)
  dmNotes: string
  setDmNotes: (notes: string) => void

  // Session Log
  sessionLog: SessionLogEntry[]
  currentSessionId: string
  currentSessionLabel: string
  addLogEntry: (content: string, inGameTimestamp?: string) => void
  updateLogEntry: (entryId: string, content: string) => void
  deleteLogEntry: (entryId: string) => void
  startNewSession: () => void

  // Handouts
  handouts: Handout[]
  addHandout: (handout: Handout) => void
  updateHandout: (id: string, updates: Partial<Handout>) => void
  removeHandout: (id: string) => void

  // Combat timer config
  combatTimer: CombatTimerConfig | null
  setCombatTimer: (config: CombatTimerConfig | null) => void

  // Diseases
  activeDiseases: ActiveDisease[]
  addDisease: (disease: ActiveDisease) => void
  updateDisease: (id: string, updates: Partial<ActiveDisease>) => void
  removeDisease: (id: string) => void

  // Curses
  activeCurses: ActiveCurse[]
  addCurse: (curse: ActiveCurse) => void
  updateCurse: (id: string, updates: Partial<ActiveCurse>) => void
  removeCurse: (id: string) => void

  // Environmental effects
  activeEnvironmentalEffects: ActiveEnvironmentalEffect[]
  addEnvironmentalEffect: (effect: ActiveEnvironmentalEffect) => void
  removeEnvironmentalEffect: (id: string) => void

  // Placed traps
  placedTraps: PlacedTrap[]
  addPlacedTrap: (trap: PlacedTrap) => void
  removeTrap: (id: string) => void
  triggerTrap: (id: string) => void
  revealTrap: (id: string) => void
  updatePlacedTrap: (id: string, updates: Partial<PlacedTrap>) => void
}

export interface SessionLogEntry {
  id: string
  sessionId: string
  sessionLabel: string
  realTimestamp: number
  inGameTimestamp?: string
  content: string
  editedAt?: number
}

const initialState: GameState = {
  campaignId: '',
  system: 'dnd5e',
  activeMapId: null,
  maps: [],
  turnMode: 'free',
  initiative: null,
  round: 0,
  conditions: [],
  isPaused: false,
  turnStates: {},
  underwaterCombat: false,
  flankingEnabled: false,
  groupInitiativeEnabled: false,
  diagonalRule: 'standard',
  ambientLight: 'bright',
  travelPace: null,
  marchingOrder: [],
  hpBarsVisibility: 'all'
}

function createTurnState(entityId: string, speed: number): TurnState {
  return {
    entityId,
    movementRemaining: speed,
    movementMax: speed,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    freeInteractionUsed: false,
    isDashing: false,
    isDisengaging: false,
    isDodging: false,
    isHidden: false
  }
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,

  // --- Shop ---
  shopOpen: false,
  shopName: 'General Store',
  shopInventory: [],
  shopMarkup: 1.0,

  // --- Sidebar ---
  allies: [],
  enemies: [],
  places: [],

  // --- Timer ---
  timerSeconds: 0,
  timerRunning: false,
  timerTargetName: '',

  // --- Hidden dice ---
  hiddenDiceResults: [],

  // --- Dice roll history ---
  diceHistory: [],

  openShop: (name?: string) => set({ shopOpen: true, shopName: name ?? 'General Store' }),
  closeShop: () => set({ shopOpen: false }),
  setShopInventory: (items: ShopItem[]) => set({ shopInventory: items }),
  addShopItem: (item: ShopItem) => set((s) => ({ shopInventory: [...s.shopInventory, item] })),
  removeShopItem: (itemId: string) => set((s) => ({ shopInventory: s.shopInventory.filter((i) => i.id !== itemId) })),
  setShopMarkup: (markup: number) => set({ shopMarkup: markup }),
  updateShopItem: (itemId: string, updates: Partial<ShopItem>) =>
    set((s) => ({
      shopInventory: s.shopInventory.map((i) => (i.id === itemId ? { ...i, ...updates } : i))
    })),
  purchaseItem: (itemId: string) =>
    set((s) => ({
      shopInventory: s.shopInventory.map((i) => {
        if (i.id !== itemId) return i
        if (i.stockLimit != null && i.stockRemaining != null && i.stockRemaining > 0) {
          return { ...i, stockRemaining: i.stockRemaining - 1 }
        }
        if (i.stockLimit == null && i.quantity > 0) {
          return { ...i, quantity: i.quantity - 1 }
        }
        return i
      })
    })),

  // --- Map actions ---

  setActiveMap: (mapId: string) => {
    set({ activeMapId: mapId })
  },

  addMap: (map: GameMap) => {
    set((state) => ({ maps: [...state.maps, map] }))
  },

  // --- Token actions ---

  addToken: (mapId: string, token: MapToken) => {
    set((state) => ({
      maps: state.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m))
    }))
  },

  moveToken: (mapId: string, tokenId: string, gridX: number, gridY: number) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? {
              ...m,
              tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, gridX, gridY } : t))
            }
          : m
      )
    }))
  },

  removeToken: (mapId: string, tokenId: string) => {
    set((state) => ({
      maps: state.maps.map((m) => (m.id === mapId ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) } : m))
    }))
  },

  updateToken: (mapId: string, tokenId: string, updates: Partial<MapToken>) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? {
              ...m,
              tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, ...updates } : t))
            }
          : m
      )
    }))
  },

  // --- Initiative ---

  startInitiative: (entries: InitiativeEntry[]) => {
    const sorted = [...entries].sort((a, b) => b.total - a.total)
    sorted.forEach((e, i) => {
      e.isActive = i === 0
    })

    set({
      initiative: {
        entries: sorted,
        currentIndex: 0,
        round: 1
      },
      round: 1,
      turnMode: 'initiative'
    })
  },

  addToInitiative: (entry: InitiativeEntry) => {
    const { initiative } = get()
    if (!initiative) {
      get().startInitiative([entry])
      return
    }

    const newEntries = [...initiative.entries, entry].sort((a, b) => b.total - a.total)
    const newCurrentIndex = newEntries.findIndex((e) => e.id === initiative.entries[initiative.currentIndex]?.id)

    const updated = newEntries.map((e, i) => ({
      ...e,
      isActive: i === (newCurrentIndex >= 0 ? newCurrentIndex : 0)
    }))

    set({
      initiative: {
        ...initiative,
        entries: updated,
        currentIndex: newCurrentIndex >= 0 ? newCurrentIndex : 0
      }
    })
  },

  nextTurn: () => {
    const { initiative, turnStates, inGameTime } = get()
    if (!initiative || initiative.entries.length === 0) return

    const { entries, currentIndex } = initiative
    const nextIndex = (currentIndex + 1) % entries.length
    const newRound = nextIndex === 0 ? initiative.round + 1 : initiative.round

    const updatedEntries = entries.map((e, i) => ({
      ...e,
      isActive: i === nextIndex
    }))

    // Reset the next entity's turn state
    const nextEntity = entries[nextIndex]
    if (!nextEntity) return
    const existingTs = turnStates[nextEntity.entityId]
    const speed = existingTs?.movementMax ?? 30

    // Auto-advance 6 seconds when a new round begins (5e: 1 round = 6 seconds)
    const newInGameTime = nextIndex === 0 && inGameTime ? { totalSeconds: inGameTime.totalSeconds + 6 } : inGameTime

    set({
      initiative: {
        ...initiative,
        entries: updatedEntries,
        currentIndex: nextIndex,
        round: newRound
      },
      round: newRound,
      turnStates: {
        ...turnStates,
        [nextEntity.entityId]: {
          ...createTurnState(nextEntity.entityId, speed),
          concentratingSpell: existingTs?.concentratingSpell
        }
      },
      inGameTime: newInGameTime
    })

    // Check for expired custom effects after round/time update
    get().checkExpiredEffects()

    // Auto-countdown round-based conditions
    if (nextIndex === 0) {
      const currentConditions = get().conditions
      const expired: EntityCondition[] = []
      const remaining: EntityCondition[] = []
      for (const c of currentConditions) {
        if (typeof c.duration === 'number' && c.duration > 0 && newRound - c.appliedRound >= c.duration) {
          expired.push(c)
        } else {
          remaining.push(c)
        }
      }
      if (expired.length > 0) {
        set({ conditions: remaining })
        // Post system messages for expired conditions
        import('./useLobbyStore').then(({ useLobbyStore }) => {
          for (const c of expired) {
            useLobbyStore.getState().addChatMessage({
              id: crypto.randomUUID(),
              senderId: 'system',
              senderName: 'System',
              content: `${c.entityName}'s ${c.condition} condition has expired (after ${c.duration} round${c.duration !== 1 ? 's' : ''}).`,
              timestamp: Date.now(),
              isSystem: true
            })
          }
        })
      }
    }
  },

  prevTurn: () => {
    const { initiative } = get()
    if (!initiative || initiative.entries.length === 0) return

    const { entries, currentIndex } = initiative
    const prevIndex = currentIndex === 0 ? entries.length - 1 : currentIndex - 1
    const newRound = prevIndex === entries.length - 1 && initiative.round > 1 ? initiative.round - 1 : initiative.round

    const updatedEntries = entries.map((e, i) => ({
      ...e,
      isActive: i === prevIndex
    }))

    set({
      initiative: {
        ...initiative,
        entries: updatedEntries,
        currentIndex: prevIndex,
        round: newRound
      },
      round: newRound
    })
  },

  endInitiative: () => {
    set({
      initiative: null,
      turnMode: 'free',
      round: 0
    })
  },

  updateInitiativeEntry: (entryId: string, updates: Partial<InitiativeEntry>) => {
    const { initiative } = get()
    if (!initiative) return

    set({
      initiative: {
        ...initiative,
        entries: initiative.entries.map((e) => (e.id === entryId ? { ...e, ...updates } : e))
      }
    })
  },

  removeFromInitiative: (entryId: string) => {
    const { initiative } = get()
    if (!initiative) return

    const newEntries = initiative.entries.filter((e) => e.id !== entryId)
    if (newEntries.length === 0) {
      get().endInitiative()
      return
    }

    const newIndex = Math.min(initiative.currentIndex, newEntries.length - 1)
    const updated = newEntries.map((e, i) => ({
      ...e,
      isActive: i === newIndex
    }))

    set({
      initiative: {
        ...initiative,
        entries: updated,
        currentIndex: newIndex
      }
    })
  },

  reorderInitiative: (fromIndex: number, toIndex: number) => {
    const { initiative } = get()
    if (!initiative) return

    const entries = [...initiative.entries]
    const [moved] = entries.splice(fromIndex, 1)
    if (!moved) return
    entries.splice(toIndex, 0, moved)

    // Track the currently active entry by ID so it stays active after reorder
    const activeEntry = initiative.entries[initiative.currentIndex]
    const activeId = activeEntry?.id
    const newCurrentIndex = entries.findIndex((e) => e.id === activeId)

    set({
      initiative: {
        ...initiative,
        entries,
        currentIndex: newCurrentIndex >= 0 ? newCurrentIndex : 0
      }
    })
  },

  // --- Conditions ---

  addCondition: (condition: EntityCondition) => {
    set((state) => ({ conditions: [...state.conditions, condition] }))

    // Exhaustion level 6 = death
    if (condition.condition === 'Exhaustion' && (condition.value ?? 0) >= 6) {
      const maps = get().maps
      for (const map of maps) {
        const token = map.tokens.find((t) => t.entityId === condition.entityId)
        if (token?.currentHP && token.currentHP > 0) {
          get().updateToken(map.id, token.id, { currentHP: 0 })
        }
      }
      import('./useLobbyStore').then(({ useLobbyStore }) => {
        useLobbyStore.getState().addChatMessage({
          id: crypto.randomUUID(),
          senderId: 'system',
          senderName: 'System',
          content: `${condition.entityName} dies from Exhaustion level 6!`,
          timestamp: Date.now(),
          isSystem: true
        })
      })
    }
  },

  removeCondition: (conditionId: string) => {
    set((state) => ({
      conditions: state.conditions.filter((c) => c.id !== conditionId)
    }))
  },

  updateCondition: (conditionId: string, updates: Partial<EntityCondition>) => {
    set((state) => ({
      conditions: state.conditions.map((c) => (c.id === conditionId ? { ...c, ...updates } : c))
    }))

    // Check if updated condition is now Exhaustion >= 6
    if (updates.value !== undefined) {
      const updated = get().conditions.find((c) => c.id === conditionId)
      if (updated && updated.condition === 'Exhaustion' && (updated.value ?? 0) >= 6) {
        const maps = get().maps
        for (const map of maps) {
          const token = map.tokens.find((t) => t.entityId === updated.entityId)
          if (token?.currentHP && token.currentHP > 0) {
            get().updateToken(map.id, token.id, { currentHP: 0 })
          }
        }
        import('./useLobbyStore').then(({ useLobbyStore }) => {
          useLobbyStore.getState().addChatMessage({
            id: crypto.randomUUID(),
            senderId: 'system',
            senderName: 'System',
            content: `${updated.entityName} dies from Exhaustion level 6!`,
            timestamp: Date.now(),
            isSystem: true
          })
        })
      }
    }
  },

  // --- Fog of war ---

  revealFog: (mapId: string, cells: Array<{ x: number; y: number }>) => {
    set((state) => ({
      maps: state.maps.map((m) => {
        if (m.id !== mapId) return m
        const existing = new Set(m.fogOfWar.revealedCells.map((c) => `${c.x},${c.y}`))
        const newCells = cells.filter((c) => !existing.has(`${c.x},${c.y}`))
        return {
          ...m,
          fogOfWar: {
            ...m.fogOfWar,
            revealedCells: [...m.fogOfWar.revealedCells, ...newCells]
          }
        }
      })
    }))
  },

  hideFog: (mapId: string, cells: Array<{ x: number; y: number }>) => {
    set((state) => ({
      maps: state.maps.map((m) => {
        if (m.id !== mapId) return m
        const toHide = new Set(cells.map((c) => `${c.x},${c.y}`))
        return {
          ...m,
          fogOfWar: {
            ...m.fogOfWar,
            revealedCells: m.fogOfWar.revealedCells.filter((c) => !toHide.has(`${c.x},${c.y}`))
          }
        }
      })
    }))
  },

  // --- Sidebar entries ---

  addSidebarEntry: (category: SidebarCategory, entry: SidebarEntry) => {
    set((state) => {
      const entries = state[category] as SidebarEntry[]
      return { [category]: [...entries, entry] }
    })
  },

  updateSidebarEntry: (category: SidebarCategory, id: string, updates: Partial<SidebarEntry>) => {
    set((state) => {
      const entries = state[category] as SidebarEntry[]
      return { [category]: entries.map((e) => (e.id === id ? { ...e, ...updates } : e)) }
    })
  },

  removeSidebarEntry: (category: SidebarCategory, id: string) => {
    set((state) => {
      const entries = state[category] as SidebarEntry[]
      return { [category]: entries.filter((e) => e.id !== id) }
    })
  },

  moveSidebarEntry: (fromCategory: SidebarCategory, toCategory: SidebarCategory, entryId: string) => {
    set((state) => {
      const fromEntries = state[fromCategory] as SidebarEntry[]
      const entry = fromEntries.find((e) => e.id === entryId)
      if (!entry) return state
      const toEntries = state[toCategory] as SidebarEntry[]
      return {
        [fromCategory]: fromEntries.filter((e) => e.id !== entryId),
        [toCategory]: [...toEntries, entry]
      }
    })
  },

  toggleEntryVisibility: (category: SidebarCategory, id: string) => {
    set((state) => {
      const entries = state[category] as SidebarEntry[]
      return { [category]: entries.map((e) => (e.id === id ? { ...e, visibleToPlayers: !e.visibleToPlayers } : e)) }
    })
  },

  reparentPlace: (entryId: string, newParentId: string | null) => {
    set((state) => ({
      places: state.places.map((e) =>
        e.id === entryId ? { ...e, parentId: newParentId ?? undefined } : e
      )
    }))
  },

  // --- Timer ---

  startTimer: (seconds: number, targetName: string) => {
    set({ timerSeconds: seconds, timerRunning: true, timerTargetName: targetName })
  },

  stopTimer: () => {
    set({ timerSeconds: 0, timerRunning: false, timerTargetName: '' })
  },

  tickTimer: () => {
    const { timerSeconds, timerRunning } = get()
    if (!timerRunning || timerSeconds <= 0) {
      set({ timerRunning: false })
      return
    }
    set({ timerSeconds: timerSeconds - 1 })
  },

  // --- Hidden dice ---

  addHiddenDiceResult: (result: HiddenDiceResult) => {
    set((state) => ({ hiddenDiceResults: [...state.hiddenDiceResults, result] }))
  },

  clearHiddenDiceResults: () => set({ hiddenDiceResults: [] }),

  // --- Dice roll history ---
  addDiceRoll: (roll: DiceRollRecord) => {
    set((state) => ({ diceHistory: [...state.diceHistory, roll] }))
  },
  clearDiceHistory: () => set({ diceHistory: [] }),

  // --- Turn state (combat) ---

  initTurnState: (entityId: string, speed: number) => {
    set((state) => ({
      turnStates: { ...state.turnStates, [entityId]: createTurnState(entityId, speed) }
    }))
  },

  useAction: (entityId: string) => {
    set((state) => ({
      turnStates: {
        ...state.turnStates,
        [entityId]: state.turnStates[entityId]
          ? { ...state.turnStates[entityId], actionUsed: true }
          : createTurnState(entityId, 30)
      }
    }))
  },

  useBonusAction: (entityId: string) => {
    set((state) => ({
      turnStates: {
        ...state.turnStates,
        [entityId]: state.turnStates[entityId]
          ? { ...state.turnStates[entityId], bonusActionUsed: true }
          : createTurnState(entityId, 30)
      }
    }))
  },

  useReaction: (entityId: string) => {
    set((state) => ({
      turnStates: {
        ...state.turnStates,
        [entityId]: state.turnStates[entityId]
          ? { ...state.turnStates[entityId], reactionUsed: true }
          : createTurnState(entityId, 30)
      }
    }))
  },

  useMovement: (entityId: string, feet: number) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: { ...ts, movementRemaining: Math.max(0, ts.movementRemaining - feet) }
        }
      }
    })
  },

  setDashing: (entityId: string) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: {
            ...ts,
            isDashing: true,
            actionUsed: true,
            movementRemaining: ts.movementRemaining + ts.movementMax
          }
        }
      }
    })
  },

  setDisengaging: (entityId: string) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: { ...ts, isDisengaging: true, actionUsed: true }
        }
      }
    })
  },

  setDodging: (entityId: string) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: { ...ts, isDodging: true, actionUsed: true }
        }
      }
    })
  },

  setHidden: (entityId: string, hidden: boolean) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: { ...ts, isHidden: hidden }
        }
      }
    })
  },

  setConcentrating: (entityId: string, spell: string | undefined) => {
    set((state) => {
      const ts = state.turnStates[entityId]
      if (!ts) return state
      return {
        turnStates: {
          ...state.turnStates,
          [entityId]: { ...ts, concentratingSpell: spell }
        }
      }
    })
  },

  resetTurnState: (entityId: string, speed: number) => {
    set((state) => ({
      turnStates: {
        ...state.turnStates,
        [entityId]: {
          ...createTurnState(entityId, speed),
          // Reaction resets at start of own turn
          reactionUsed: false,
          // Concentration persists across turns
          concentratingSpell: state.turnStates[entityId]?.concentratingSpell
        }
      }
    }))
  },

  getTurnState: (entityId: string) => {
    return get().turnStates[entityId]
  },

  // --- Bulk token actions ---

  revealAllTokens: () => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === state.activeMapId ? { ...m, tokens: m.tokens.map((t) => ({ ...t, visibleToPlayers: true })) } : m
      )
    }))
  },

  // --- Game flow ---

  setPaused: (paused: boolean) => set({ isPaused: paused }),

  setTurnMode: (mode: 'initiative' | 'free') => set({ turnMode: mode }),

  reset: () =>
    set({
      ...initialState,
      shopOpen: false,
      shopName: 'General Store',
      shopInventory: [],
      shopMarkup: 1.0,
      allies: [],
      enemies: [],
      places: [],
      timerSeconds: 0,
      timerRunning: false,
      timerTargetName: '',
      hiddenDiceResults: [],
      diceHistory: [],
      underwaterCombat: false,
      flankingEnabled: false,
      groupInitiativeEnabled: false,
      diagonalRule: 'standard' as const,
      ambientLight: 'bright' as const,
      travelPace: null,
      marchingOrder: [],
      inGameTime: null,
      restTracking: null,
      activeLightSources: [],
      pendingPlacement: null,
      dmNotes: '',
      weatherOverride: null,
      moonOverride: null,
      savedWeatherPresets: [],
      showWeatherOverlay: true,
      handouts: [],
      combatTimer: null,
      customEffects: [],
      combatLog: [],
      pendingGroupRoll: null,
      groupRollResults: [],
      centerOnEntityId: null,
      sessionLog: [],
      currentSessionId: `session-${Date.now()}`,
      currentSessionLabel: `Session 1`
    }),

  loadGameState: (
    state: Partial<GameState> & {
      allies?: SidebarEntry[]
      enemies?: SidebarEntry[]
      places?: SidebarEntry[]
      inGameTime?: InGameTimeState | null
      restTracking?: { lastLongRestSeconds: number | null; lastShortRestSeconds: number | null } | null
      activeLightSources?: ActiveLightSource[]
      dmNotes?: string
      sessionLog?: SessionLogEntry[]
      currentSessionId?: string
      currentSessionLabel?: string
      weatherOverride?: GameStoreState['weatherOverride']
      moonOverride?: string | null
      savedWeatherPresets?: GameStoreState['savedWeatherPresets']
      handouts?: Handout[]
      combatTimer?: CombatTimerConfig | null
    }
  ) => {
    const { allies, enemies, places, inGameTime, restTracking, activeLightSources, dmNotes, sessionLog, currentSessionId, currentSessionLabel, weatherOverride, moonOverride, savedWeatherPresets, handouts, combatTimer, ...gameState } = state
    set({
      ...gameState,
      ...(allies ? { allies } : {}),
      ...(enemies ? { enemies } : {}),
      ...(places ? { places } : {}),
      ...(inGameTime !== undefined ? { inGameTime } : {}),
      ...(restTracking !== undefined ? { restTracking } : {}),
      ...(activeLightSources ? { activeLightSources } : {}),
      ...(dmNotes !== undefined ? { dmNotes } : {}),
      ...(sessionLog ? { sessionLog } : {}),
      ...(currentSessionId ? { currentSessionId } : {}),
      ...(currentSessionLabel ? { currentSessionLabel } : {}),
      ...(weatherOverride !== undefined ? { weatherOverride } : {}),
      ...(moonOverride !== undefined ? { moonOverride } : {}),
      ...(savedWeatherPresets ? { savedWeatherPresets } : {}),
      ...(handouts ? { handouts } : {}),
      ...(combatTimer !== undefined ? { combatTimer } : {})
    })
  },

  // --- Combat environment ---
  setUnderwaterCombat: (enabled: boolean) => set({ underwaterCombat: enabled }),
  setFlankingEnabled: (enabled: boolean) => set({ flankingEnabled: enabled }),
  setGroupInitiativeEnabled: (enabled: boolean) => set({ groupInitiativeEnabled: enabled }),
  setDiagonalRule: (rule: 'standard' | 'alternate') => set({ diagonalRule: rule }),
  setAmbientLight: (level: 'bright' | 'dim' | 'darkness') => set({ ambientLight: level }),

  // --- Exploration ---
  setTravelPace: (pace: 'fast' | 'normal' | 'slow' | null) => set({ travelPace: pace }),
  setMarchingOrder: (order: string[]) => set({ marchingOrder: order }),

  // --- In-game time ---
  inGameTime: null,
  setInGameTime: (time: InGameTimeState | null) => set({ inGameTime: time }),
  advanceTimeSeconds: (seconds: number) => {
    const { inGameTime } = get()
    if (!inGameTime) return
    set({ inGameTime: { totalSeconds: inGameTime.totalSeconds + seconds } })
    // Check for expired custom effects after time advance
    get().checkExpiredEffects()
  },
  advanceTimeDays: (days: number) => {
    const { inGameTime } = get()
    if (!inGameTime) return
    set({ inGameTime: { totalSeconds: inGameTime.totalSeconds + days * 24 * 3600 } })
    // Check for expired custom effects after time advance
    get().checkExpiredEffects()
  },

  // --- Rest tracking ---
  restTracking: null,
  setRestTracking: (rt) => set({ restTracking: rt }),

  // --- Light sources ---
  activeLightSources: [],
  lightSource: (entityId: string, entityName: string, sourceName: string, durationSeconds: number) => {
    const { inGameTime } = get()
    if (!inGameTime) return
    const source: ActiveLightSource = {
      id: crypto.randomUUID(),
      entityId,
      entityName,
      sourceName,
      durationSeconds,
      startedAtSeconds: inGameTime.totalSeconds
    }
    set((s) => ({ activeLightSources: [...s.activeLightSources, source] }))
  },
  extinguishSource: (sourceId: string) => {
    set((s) => ({ activeLightSources: s.activeLightSources.filter((ls) => ls.id !== sourceId) }))
  },
  checkExpiredSources: (): ActiveLightSource[] => {
    const { inGameTime, activeLightSources } = get()
    if (!inGameTime) return []
    const expired = activeLightSources.filter(
      (ls) => ls.durationSeconds !== Infinity && inGameTime.totalSeconds - ls.startedAtSeconds >= ls.durationSeconds
    )
    if (expired.length > 0) {
      set({
        activeLightSources: activeLightSources.filter(
          (ls) => ls.durationSeconds === Infinity || inGameTime.totalSeconds - ls.startedAtSeconds < ls.durationSeconds
        )
      })
    }
    return expired
  },

  // Custom DM effects
  customEffects: [],
  addCustomEffect: (effect: CustomEffect): void => {
    set((s) => ({ customEffects: [...s.customEffects, effect] }))
  },
  removeCustomEffect: (id: string): void => {
    set((s) => ({ customEffects: s.customEffects.filter((e) => e.id !== id) }))
  },
  checkExpiredEffects: (): CustomEffect[] => {
    const { customEffects, round, inGameTime } = get()
    const expired: CustomEffect[] = []
    const remaining: CustomEffect[] = []
    for (const effect of customEffects) {
      if (!effect.duration) {
        remaining.push(effect)
        continue
      }
      let isExpired = false
      if (effect.duration.type === 'rounds' && effect.duration.startRound != null) {
        isExpired = round - effect.duration.startRound >= effect.duration.value
      } else if (
        (effect.duration.type === 'minutes' || effect.duration.type === 'hours') &&
        effect.duration.startSeconds != null &&
        inGameTime
      ) {
        const durationSeconds =
          effect.duration.type === 'minutes' ? effect.duration.value * 60 : effect.duration.value * 3600
        isExpired = inGameTime.totalSeconds - effect.duration.startSeconds >= durationSeconds
      }
      if (isExpired) {
        expired.push(effect)
      } else {
        remaining.push(effect)
      }
    }
    if (expired.length > 0) {
      set({ customEffects: remaining })
    }
    return expired
  },

  // --- Combat log ---
  combatLog: [],
  addCombatLogEntry: (entry: CombatLogEntry) => {
    set((s) => ({ combatLog: [...s.combatLog, entry] }))
  },
  clearCombatLog: () => set({ combatLog: [] }),

  // --- Group roll ---
  pendingGroupRoll: null,
  groupRollResults: [],
  setPendingGroupRoll: (request: GroupRollRequest | null) => set({ pendingGroupRoll: request, groupRollResults: [] }),
  addGroupRollResult: (result: GroupRollResult) => {
    set((s) => ({ groupRollResults: [...s.groupRollResults, result] }))
  },
  clearGroupRollResults: () => set({ groupRollResults: [], pendingGroupRoll: null }),

  // --- Wall segments ---
  addWallSegment: (mapId: string, wall) => {
    set((state) => ({
      maps: state.maps.map((m) => (m.id === mapId ? { ...m, wallSegments: [...(m.wallSegments || []), wall] } : m))
    }))
  },
  removeWallSegment: (mapId: string, wallId: string) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, wallSegments: (m.wallSegments || []).filter((w) => w.id !== wallId) } : m
      )
    }))
  },
  updateWallSegment: (mapId: string, wallId: string, updates) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? { ...m, wallSegments: (m.wallSegments || []).map((w) => (w.id === wallId ? { ...w, ...updates } : w)) }
          : m
      )
    }))
  },

  // --- Center on entity ---
  centerOnEntityId: null,
  requestCenterOnEntity: (entityId: string) => set({ centerOnEntityId: entityId }),
  clearCenterRequest: () => set({ centerOnEntityId: null }),

  // --- Click-to-place token ---
  pendingPlacement: null,
  setPendingPlacement: (tokenData) =>
    set({ pendingPlacement: tokenData ? { tokenData } : null }),
  commitPlacement: (mapId, gridX, gridY) => {
    const { pendingPlacement } = get()
    if (!pendingPlacement) return
    const token: MapToken = {
      ...pendingPlacement.tokenData,
      id: crypto.randomUUID(),
      gridX,
      gridY
    }
    get().addToken(mapId, token)
    set({ pendingPlacement: null })
  },

  // --- Weather & Moon Overrides ---
  weatherOverride: null,
  moonOverride: null,
  savedWeatherPresets: [],
  showWeatherOverlay: true,
  setWeatherOverride: (override) => set({ weatherOverride: override }),
  setMoonOverride: (override) => set({ moonOverride: override }),
  setShowWeatherOverlay: (show: boolean) => set({ showWeatherOverlay: show }),
  addSavedWeatherPreset: (preset) => set((s) => ({
    savedWeatherPresets: [...s.savedWeatherPresets.filter((p) => p.name !== preset.name), preset]
  })),
  removeSavedWeatherPreset: (name) => set((s) => ({
    savedWeatherPresets: s.savedWeatherPresets.filter((p) => p.name !== name)
  })),

  // --- DM Notes ---
  dmNotes: '',
  setDmNotes: (notes: string) => set({ dmNotes: notes }),

  // --- Session Log ---
  sessionLog: [],
  currentSessionId: `session-${Date.now()}`,
  currentSessionLabel: `Session 1 — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,

  addLogEntry: (content: string, inGameTimestamp?: string) => {
    const { currentSessionId, currentSessionLabel } = get()
    const entry: SessionLogEntry = {
      id: `log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
      sessionId: currentSessionId,
      sessionLabel: currentSessionLabel,
      realTimestamp: Date.now(),
      inGameTimestamp,
      content
    }
    set((s) => ({ sessionLog: [entry, ...s.sessionLog] }))
  },

  updateLogEntry: (entryId: string, content: string) => {
    set((s) => ({
      sessionLog: s.sessionLog.map((e) =>
        e.id === entryId ? { ...e, content, editedAt: Date.now() } : e
      )
    }))
  },

  deleteLogEntry: (entryId: string) => {
    set((s) => ({
      sessionLog: s.sessionLog.filter((e) => e.id !== entryId)
    }))
  },

  startNewSession: () => {
    const { sessionLog } = get()
    const sessionCount = new Set(sessionLog.map((e) => e.sessionId)).size + 1
    const label = `Session ${sessionCount} — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    set({
      currentSessionId: `session-${Date.now()}`,
      currentSessionLabel: label
    })
  },

  // --- Handouts ---
  handouts: [],
  addHandout: (handout: Handout) => {
    set((s) => ({ handouts: [...s.handouts, handout] }))
  },
  updateHandout: (id: string, updates: Partial<Handout>) => {
    set((s) => ({
      handouts: s.handouts.map((h) => (h.id === id ? { ...h, ...updates } : h))
    }))
  },
  removeHandout: (id: string) => {
    set((s) => ({ handouts: s.handouts.filter((h) => h.id !== id) }))
  },

  // --- Combat Timer Config ---
  combatTimer: null,
  setCombatTimer: (config: CombatTimerConfig | null) => {
    set({ combatTimer: config })
  },

  // --- Diseases ---
  activeDiseases: [],
  addDisease: (disease: ActiveDisease) => {
    set((s) => ({ activeDiseases: [...s.activeDiseases, disease] }))
  },
  updateDisease: (id: string, updates: Partial<ActiveDisease>) => {
    set((s) => ({
      activeDiseases: s.activeDiseases.map((d) => (d.id === id ? { ...d, ...updates } : d))
    }))
  },
  removeDisease: (id: string) => {
    set((s) => ({ activeDiseases: s.activeDiseases.filter((d) => d.id !== id) }))
  },

  // --- Curses ---
  activeCurses: [],
  addCurse: (curse: ActiveCurse) => {
    set((s) => ({ activeCurses: [...s.activeCurses, curse] }))
  },
  updateCurse: (id: string, updates: Partial<ActiveCurse>) => {
    set((s) => ({
      activeCurses: s.activeCurses.map((c) => (c.id === id ? { ...c, ...updates } : c))
    }))
  },
  removeCurse: (id: string) => {
    set((s) => ({ activeCurses: s.activeCurses.filter((c) => c.id !== id) }))
  },

  // --- Environmental Effects ---
  activeEnvironmentalEffects: [],
  addEnvironmentalEffect: (effect: ActiveEnvironmentalEffect) => {
    set((s) => ({ activeEnvironmentalEffects: [...s.activeEnvironmentalEffects, effect] }))
  },
  removeEnvironmentalEffect: (id: string) => {
    set((s) => ({
      activeEnvironmentalEffects: s.activeEnvironmentalEffects.filter((e) => e.id !== id)
    }))
  },

  // --- Placed Traps ---
  placedTraps: [],
  addPlacedTrap: (trap: PlacedTrap) => {
    set((s) => ({ placedTraps: [...s.placedTraps, trap] }))
  },
  removeTrap: (id: string) => {
    set((s) => ({ placedTraps: s.placedTraps.filter((t) => t.id !== id) }))
  },
  triggerTrap: (id: string) => {
    set((s) => ({
      placedTraps: s.placedTraps.map((t) => (t.id === id ? { ...t, armed: false } : t))
    }))
  },
  revealTrap: (id: string) => {
    set((s) => ({
      placedTraps: s.placedTraps.map((t) => (t.id === id ? { ...t, revealed: true } : t))
    }))
  },
  updatePlacedTrap: (id: string, updates: Partial<PlacedTrap>) => {
    set((s) => ({
      placedTraps: s.placedTraps.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }))
  }
}))
