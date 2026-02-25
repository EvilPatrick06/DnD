import { create } from 'zustand'
import type { ActiveLightSource, CombatTimerConfig } from '../../types/campaign'
import type { Handout, InGameTimeState, SidebarEntry } from '../../types/game-state'
import { createCombatLogSlice } from './combat-log-slice'
import { createConditionsSlice } from './conditions-slice'
import { createEffectsSlice } from './effects-slice'
import { createFogSlice } from './fog-slice'
import { createInitiativeSlice } from './initiative-slice'
import { createMapTokenSlice } from './map-token-slice'
import { createShopSlice } from './shop-slice'
import { createSidebarSlice } from './sidebar-slice'
import { createTimeSlice } from './time-slice'
import { createTimerSlice } from './timer-slice'
import { type GameStoreState, initialState, type SessionLogEntry } from './types'

export const useGameStore = create<GameStoreState>()((...a) => {
  const [set, _get] = a

  return {
    ...initialState,

    // Compose all slices
    ...createShopSlice(...a),
    ...createMapTokenSlice(...a),
    ...createInitiativeSlice(...a),
    ...createConditionsSlice(...a),
    ...createFogSlice(...a),
    ...createSidebarSlice(...a),
    ...createTimerSlice(...a),
    ...createCombatLogSlice(...a),
    ...createTimeSlice(...a),
    ...createEffectsSlice(...a),

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
      state: Partial<import('../../types/game-state').GameState> & {
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
      }
    ) => {
      const {
        allies,
        enemies,
        places,
        inGameTime,
        restTracking,
        activeLightSources,
        sessionLog,
        currentSessionId,
        currentSessionLabel,
        weatherOverride,
        moonOverride,
        savedWeatherPresets,
        handouts,
        combatTimer,
        ...gameState
      } = state
      set({
        ...gameState,
        ...(allies ? { allies } : {}),
        ...(enemies ? { enemies } : {}),
        ...(places ? { places } : {}),
        ...(inGameTime !== undefined ? { inGameTime } : {}),
        ...(restTracking !== undefined ? { restTracking } : {}),
        ...(activeLightSources ? { activeLightSources } : {}),
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
    setMarchingOrder: (order: string[]) => set({ marchingOrder: order })
  }
})

// Re-export types
export type { GameStoreState, SessionLogEntry } from './types'
