import type { StateCreator } from 'zustand'
import type { GameStoreState, VisionSliceState } from './types'

export const createVisionSlice: StateCreator<GameStoreState, [], [], VisionSliceState> = (set) => ({
  partyVisionCells: [],

  setPartyVisionCells: (cells: Array<{ x: number; y: number }>) => {
    set({ partyVisionCells: cells })
  },

  addExploredCells: (mapId: string, cells: Array<{ x: number; y: number }>) => {
    set((state) => ({
      maps: state.maps.map((m) => {
        if (m.id !== mapId) return m
        const existing = new Set((m.fogOfWar.exploredCells ?? []).map((c) => `${c.x},${c.y}`))
        const newCells = cells.filter((c) => !existing.has(`${c.x},${c.y}`))
        if (newCells.length === 0) return m
        return {
          ...m,
          fogOfWar: {
            ...m.fogOfWar,
            exploredCells: [...(m.fogOfWar.exploredCells ?? []), ...newCells]
          }
        }
      })
    }))
  },

  setDynamicFogEnabled: (mapId: string, enabled: boolean) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, fogOfWar: { ...m.fogOfWar, dynamicFogEnabled: enabled } } : m
      )
    }))
  }
})
