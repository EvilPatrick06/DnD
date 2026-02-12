import { create } from 'zustand'
import type { GameState, InitiativeState, InitiativeEntry, EntityCondition } from '../types/game-state'
import type { GameMap, MapToken } from '../types/map'
import type { ShopItem } from '../network/types'

interface GameStoreState extends GameState {
  // Shop
  shopOpen: boolean
  shopName: string
  shopInventory: ShopItem[]
  openShop: (name?: string) => void
  closeShop: () => void
  setShopInventory: (items: ShopItem[]) => void
  addShopItem: (item: ShopItem) => void
  removeShopItem: (itemId: string) => void
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
  nextTurn: () => void
  prevTurn: () => void
  endInitiative: () => void
  updateInitiativeEntry: (entryId: string, updates: Partial<InitiativeEntry>) => void
  removeFromInitiative: (entryId: string) => void

  // Conditions
  addCondition: (condition: EntityCondition) => void
  removeCondition: (conditionId: string) => void
  updateCondition: (conditionId: string, updates: Partial<EntityCondition>) => void

  // Fog of war
  revealFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void
  hideFog: (mapId: string, cells: Array<{ x: number; y: number }>) => void

  // Game flow
  setPaused: (paused: boolean) => void
  setTurnMode: (mode: 'initiative' | 'free') => void
  reset: () => void
  loadGameState: (state: Partial<GameState>) => void
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
  isPaused: false
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,

  // --- Shop ---
  shopOpen: false,
  shopName: 'General Store',
  shopInventory: [],

  openShop: (name?: string) => set({ shopOpen: true, shopName: name ?? 'General Store' }),
  closeShop: () => set({ shopOpen: false }),
  setShopInventory: (items: ShopItem[]) => set({ shopInventory: items }),
  addShopItem: (item: ShopItem) => set((s) => ({ shopInventory: [...s.shopInventory, item] })),
  removeShopItem: (itemId: string) => set((s) => ({ shopInventory: s.shopInventory.filter((i) => i.id !== itemId) })),

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
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m
      )
    }))
  },

  moveToken: (mapId: string, tokenId: string, gridX: number, gridY: number) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? {
              ...m,
              tokens: m.tokens.map((t) =>
                t.id === tokenId ? { ...t, gridX, gridY } : t
              )
            }
          : m
      )
    }))
  },

  removeToken: (mapId: string, tokenId: string) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) }
          : m
      )
    }))
  },

  updateToken: (mapId: string, tokenId: string, updates: Partial<MapToken>) => {
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId
          ? {
              ...m,
              tokens: m.tokens.map((t) =>
                t.id === tokenId ? { ...t, ...updates } : t
              )
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

  nextTurn: () => {
    const { initiative } = get()
    if (!initiative) return

    const { entries, currentIndex } = initiative
    const nextIndex = (currentIndex + 1) % entries.length
    const newRound = nextIndex === 0 ? initiative.round + 1 : initiative.round

    const updatedEntries = entries.map((e, i) => ({
      ...e,
      isActive: i === nextIndex
    }))

    set({
      initiative: {
        ...initiative,
        entries: updatedEntries,
        currentIndex: nextIndex,
        round: newRound
      },
      round: newRound
    })
  },

  prevTurn: () => {
    const { initiative } = get()
    if (!initiative) return

    const { entries, currentIndex } = initiative
    const prevIndex =
      currentIndex === 0 ? entries.length - 1 : currentIndex - 1
    const newRound =
      prevIndex === entries.length - 1 && initiative.round > 1
        ? initiative.round - 1
        : initiative.round

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
        entries: initiative.entries.map((e) =>
          e.id === entryId ? { ...e, ...updates } : e
        )
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

  // --- Conditions ---

  addCondition: (condition: EntityCondition) => {
    set((state) => ({ conditions: [...state.conditions, condition] }))
  },

  removeCondition: (conditionId: string) => {
    set((state) => ({
      conditions: state.conditions.filter((c) => c.id !== conditionId)
    }))
  },

  updateCondition: (conditionId: string, updates: Partial<EntityCondition>) => {
    set((state) => ({
      conditions: state.conditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
      )
    }))
  },

  // --- Fog of war ---

  revealFog: (mapId: string, cells: Array<{ x: number; y: number }>) => {
    set((state) => ({
      maps: state.maps.map((m) => {
        if (m.id !== mapId) return m
        const existing = new Set(
          m.fogOfWar.revealedCells.map((c) => `${c.x},${c.y}`)
        )
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
            revealedCells: m.fogOfWar.revealedCells.filter(
              (c) => !toHide.has(`${c.x},${c.y}`)
            )
          }
        }
      })
    }))
  },

  // --- Game flow ---

  setPaused: (paused: boolean) => set({ isPaused: paused }),

  setTurnMode: (mode: 'initiative' | 'free') => set({ turnMode: mode }),

  reset: () => set({ ...initialState }),

  loadGameState: (state: Partial<GameState>) => set({ ...state })
}))
