import type { StateCreator } from 'zustand'
import type { MapToken } from '../../types/map'
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
