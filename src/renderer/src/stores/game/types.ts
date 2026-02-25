import type { ShopItem } from '../../network/types'
import type { ActiveLightSource, CombatTimerConfig } from '../../types/campaign'
import type { ActiveCurse, ActiveDisease, ActiveEnvironmentalEffect, PlacedTrap } from '../../types/dm-toolbox'
import type { CustomEffect } from '../../types/effects'
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
} from '../../types/game-state'
import type { GameMap, MapToken, WallSegment } from '../../types/map'

// --- Session log entry ---

export interface SessionLogEntry {
  id: string
  sessionId: string
  sessionLabel: string
  realTimestamp: number
  inGameTimestamp?: string
  content: string
  editedAt?: number
}

// --- Initial state ---

export const initialState: GameState = {
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

// --- Helper ---

export function createTurnState(entityId: string, speed: number): TurnState {
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

// --- Slice state interfaces ---

export interface ShopSliceState {
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
}

export interface MapTokenSliceState {
  setActiveMap: (mapId: string) => void
  addMap: (map: GameMap) => void
  addToken: (mapId: string, token: MapToken) => void
  moveToken: (mapId: string, tokenId: string, gridX: number, gridY: number) => void
  removeToken: (mapId: string, tokenId: string) => void
  updateToken: (mapId: string, tokenId: string, updates: Partial<MapToken>) => void
  revealAllTokens: () => void
  addWallSegment: (mapId: string, wall: WallSegment) => void
  removeWallSegment: (mapId: string, wallId: string) => void
  updateWallSegment: (mapId: string, wallId: string, updates: Partial<WallSegment>) => void
  centerOnEntityId: string | null
  requestCenterOnEntity: (entityId: string) => void
  clearCenterRequest: () => void
  pendingPlacement: { tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'> } | null
  setPendingPlacement: (tokenData: Omit<MapToken, 'id' | 'gridX' | 'gridY'> | null) => void
  commitPlacement: (mapId: string, gridX: number, gridY: number) => void
}

export interface InitiativeSliceState {
  startInitiative: (entries: InitiativeEntry[]) => void
  addToInitiative: (entry: InitiativeEntry) => void
  nextTurn: () => void
  prevTurn: () => void
  endInitiative: () => void
  updateInitiativeEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void
  removeFromInitiative: (entryId: string) => void
  reorderInitiative: (fromIndex: number, toIndex: number) => void
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
}

export interface ConditionsSliceState {
  addCondition: (condition: EntityCondition) => void
  removeCondition: (conditionId: string) => void
  updateCondition: (conditionId: string, updates: Partial<EntityCondition>) => void
}

export interface FogSliceState {
  revealFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void
  hideFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void
}

export interface SidebarSliceState {
  allies: SidebarEntry[]
  enemies: SidebarEntry[]
  places: SidebarEntry[]
  addSidebarEntry: (category: SidebarCategory, entry: SidebarEntry) => void
  updateSidebarEntry: (category: SidebarCategory, id: string, updates: Partial<SidebarEntry>) => void
  removeSidebarEntry: (category: SidebarCategory, id: string) => void
  moveSidebarEntry: (fromCategory: SidebarCategory, toCategory: SidebarCategory, entryId: string) => void
  toggleEntryVisibility: (category: SidebarCategory, id: string) => void
  reparentPlace: (entryId: string, newParentId: string | null) => void
}

export interface TimerSliceState {
  timerSeconds: number
  timerRunning: boolean
  timerTargetName: string
  startTimer: (seconds: number, targetName: string) => void
  stopTimer: () => void
  tickTimer: () => void
  combatTimer: CombatTimerConfig | null
  setCombatTimer: (config: CombatTimerConfig | null) => void
}

export interface CombatLogSliceState {
  hiddenDiceResults: HiddenDiceResult[]
  addHiddenDiceResult: (result: HiddenDiceResult) => void
  clearHiddenDiceResults: () => void
  diceHistory: DiceRollRecord[]
  addDiceRoll: (roll: DiceRollRecord) => void
  clearDiceHistory: () => void
  combatLog: CombatLogEntry[]
  addCombatLogEntry: (entry: CombatLogEntry) => void
  clearCombatLog: () => void
  pendingGroupRoll: GroupRollRequest | null
  groupRollResults: GroupRollResult[]
  setPendingGroupRoll: (request: GroupRollRequest | null) => void
  addGroupRollResult: (result: GroupRollResult) => void
  clearGroupRollResults: () => void
}

export interface TimeSliceState {
  inGameTime: InGameTimeState | null
  setInGameTime: (time: InGameTimeState | null) => void
  advanceTimeSeconds: (seconds: number) => void
  advanceTimeDays: (days: number) => void
  restTracking: {
    lastLongRestSeconds: number | null
    lastShortRestSeconds: number | null
  } | null
  setRestTracking: (rt: { lastLongRestSeconds: number | null; lastShortRestSeconds: number | null } | null) => void
  activeLightSources: ActiveLightSource[]
  lightSource: (entityId: string, entityName: string, sourceName: string, durationSeconds: number) => void
  extinguishSource: (sourceId: string) => void
  checkExpiredSources: () => ActiveLightSource[]
  weatherOverride: {
    description: string
    temperature?: number
    temperatureUnit?: 'F' | 'C'
    windSpeed?: string
    mechanicalEffects?: string[]
    preset?: string
  } | null
  moonOverride: string | null
  savedWeatherPresets: Array<{
    name: string
    description: string
    temperature?: number
    temperatureUnit?: 'F' | 'C'
    windSpeed?: string
    mechanicalEffects?: string[]
    preset?: string
  }>
  showWeatherOverlay: boolean
  setWeatherOverride: (override: TimeSliceState['weatherOverride']) => void
  setMoonOverride: (override: string | null) => void
  setShowWeatherOverlay: (show: boolean) => void
  addSavedWeatherPreset: (preset: TimeSliceState['savedWeatherPresets'][number]) => void
  removeSavedWeatherPreset: (name: string) => void
  sessionLog: SessionLogEntry[]
  currentSessionId: string
  currentSessionLabel: string
  addLogEntry: (content: string, inGameTimestamp?: string) => void
  updateLogEntry: (entryId: string, content: string) => void
  deleteLogEntry: (entryId: string) => void
  startNewSession: () => void
  handouts: Handout[]
  addHandout: (handout: Handout) => void
  updateHandout: (id: string, updates: Partial<Handout>) => void
  removeHandout: (id: string) => void
}

export interface EffectsSliceState {
  customEffects: CustomEffect[]
  addCustomEffect: (effect: CustomEffect) => void
  removeCustomEffect: (id: string) => void
  checkExpiredEffects: () => CustomEffect[]
  activeDiseases: ActiveDisease[]
  addDisease: (disease: ActiveDisease) => void
  updateDisease: (id: string, updates: Partial<ActiveDisease>) => void
  removeDisease: (id: string) => void
  activeCurses: ActiveCurse[]
  addCurse: (curse: ActiveCurse) => void
  updateCurse: (id: string, updates: Partial<ActiveCurse>) => void
  removeCurse: (id: string) => void
  activeEnvironmentalEffects: ActiveEnvironmentalEffect[]
  addEnvironmentalEffect: (effect: ActiveEnvironmentalEffect) => void
  removeEnvironmentalEffect: (id: string) => void
  placedTraps: PlacedTrap[]
  addPlacedTrap: (trap: PlacedTrap) => void
  removeTrap: (id: string) => void
  triggerTrap: (id: string) => void
  revealTrap: (id: string) => void
  updatePlacedTrap: (id: string, updates: Partial<PlacedTrap>) => void
}

// --- Game flow actions (on the combined store, not a separate slice) ---

export interface GameFlowState {
  setPaused: (paused: boolean) => void
  setTurnMode: (mode: 'initiative' | 'free') => void
  reset: () => void
  loadGameState: (
    state:
      | (Partial<GameState> & {
          allies?: SidebarEntry[]
          enemies?: SidebarEntry[]
          places?: SidebarEntry[]
          inGameTime?: InGameTimeState | null
          restTracking?: { lastLongRestSeconds: number | null; lastShortRestSeconds: number | null } | null
          activeLightSources?: ActiveLightSource[]
          sessionLog?: SessionLogEntry[]
          currentSessionId?: string
          currentSessionLabel?: string
          weatherOverride?: GameStoreState['weatherOverride']
          moonOverride?: string | null
          savedWeatherPresets?: GameStoreState['savedWeatherPresets']
          handouts?: Handout[]
          combatTimer?: CombatTimerConfig | null
        })
      | Record<string, unknown>
  ) => void
  setUnderwaterCombat: (enabled: boolean) => void
  setFlankingEnabled: (enabled: boolean) => void
  setGroupInitiativeEnabled: (enabled: boolean) => void
  setDiagonalRule: (rule: 'standard' | 'alternate') => void
  setAmbientLight: (level: 'bright' | 'dim' | 'darkness') => void
  setTravelPace: (pace: 'fast' | 'normal' | 'slow' | null) => void
  setMarchingOrder: (order: string[]) => void
}

// --- Combined store type ---

export type GameStoreState = GameState &
  ShopSliceState &
  MapTokenSliceState &
  InitiativeSliceState &
  ConditionsSliceState &
  FogSliceState &
  SidebarSliceState &
  TimerSliceState &
  CombatLogSliceState &
  TimeSliceState &
  EffectsSliceState &
  GameFlowState
