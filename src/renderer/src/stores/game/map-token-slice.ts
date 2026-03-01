import type { StateCreator } from 'zustand'
import type { MapToken } from '../../types/map'
import { logger } from '../../utils/logger'
import type { GameStoreState, MapTokenSliceState } from './types'

export const createMapTokenSlice: StateCreator<GameStoreState, [], [], MapTokenSliceState> = (set, get) => ({
  // --- Map actions ---

  setActiveMap: (mapId: string) => {
    set({ activeMapId: mapId })
  },

  addMap: (map) => {
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
    const state = get()
    const map = state.maps.find((m) => m.id === mapId)
    const oldToken = map?.tokens.find((t) => t.id === tokenId)

    set((s) => ({
      maps: s.maps.map((m) =>
        m.id === mapId
          ? {
              ...m,
              tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, ...updates } : t))
            }
          : m
      )
    }))

    // Force-dismount rider when mount drops to 0 HP
    if (
      oldToken?.riderId &&
      updates.currentHP !== undefined &&
      updates.currentHP <= 0 &&
      (oldToken.currentHP ?? 1) > 0
    ) {
      const riderId = oldToken.riderId
      const riderToken = map?.tokens.find((t) => t.entityId === riderId)

      // Clear riderId on mount
      set((s) => ({
        maps: s.maps.map((m) =>
          m.id === mapId
            ? { ...m, tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, riderId: undefined } : t)) }
            : m
        )
      }))

      // Clear mountedOn/mountType on rider's turn state
      if (riderId) {
        const ts = state.turnStates[riderId]
        if (ts?.mountedOn) {
          set((s) => ({
            turnStates: {
              ...s.turnStates,
              [riderId]: { ...s.turnStates[riderId], mountedOn: undefined, mountType: undefined }
            }
          }))
        }
      }

      // Log force-dismount (listeners can pick this up from state changes)
      if (riderToken) {
        logger.log(`[Mount] ${oldToken.label} drops to 0 HP! ${riderToken.label} is forcibly dismounted!`)
      }
    }

    // Detect elevation drops >= 10 ft for auto-falling damage
    if (
      oldToken &&
      updates.elevation !== undefined &&
      oldToken.elevation !== undefined &&
      oldToken.elevation - updates.elevation >= 10 &&
      !(oldToken.flySpeed && oldToken.flySpeed > 0)
    ) {
      set({
        pendingFallDamage: {
          tokenId,
          mapId,
          height: oldToken.elevation - updates.elevation
        }
      })
    }
  },

  // --- Bulk token actions ---

  revealAllTokens: () => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === state.activeMapId ? { ...m, tokens: m.tokens.map((t) => ({ ...t, visibleToPlayers: true })) } : m
      )
    }))
  },

  // --- Wall segments ---

  addWallSegment: (mapId, wall) => {
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

  updateWallSegment: (mapId, wallId, updates) => {
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

  pendingFallDamage: null,
  setPendingFallDamage: (pending) => set({ pendingFallDamage: pending }),

  pendingPlacement: null,
  setPendingPlacement: (tokenData) => set({ pendingPlacement: tokenData ? { tokenData } : null }),
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
  }
})
