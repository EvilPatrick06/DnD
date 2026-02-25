import { create } from 'zustand'
import type { HomebrewEntry, LibraryCategory, LibraryItem } from '../types/library'
import { logger } from '../utils/logger'

interface LibraryState {
  selectedCategory: LibraryCategory | null
  searchQuery: string
  items: LibraryItem[]
  homebrewEntries: HomebrewEntry[]
  loading: boolean
  homebrewLoaded: boolean

  setCategory: (category: LibraryCategory | null) => void
  setSearchQuery: (query: string) => void
  setItems: (items: LibraryItem[]) => void
  setLoading: (loading: boolean) => void

  loadHomebrew: () => Promise<void>
  saveHomebrewEntry: (entry: HomebrewEntry) => Promise<boolean>
  deleteHomebrewEntry: (category: string, id: string) => Promise<boolean>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  selectedCategory: null,
  searchQuery: '',
  items: [],
  homebrewEntries: [],
  loading: false,
  homebrewLoaded: false,

  setCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),

  loadHomebrew: async () => {
    if (get().homebrewLoaded) return
    try {
      const raw = await window.api.loadAllHomebrew()
      if (Array.isArray(raw)) {
        set({ homebrewEntries: raw as unknown as HomebrewEntry[], homebrewLoaded: true })
      }
    } catch (err) {
      logger.error('Failed to load homebrew entries:', err)
    }
  },

  saveHomebrewEntry: async (entry) => {
    try {
      const result = await window.api.saveHomebrew(entry as unknown as Record<string, unknown>)
      if (result.success) {
        const { homebrewEntries } = get()
        const idx = homebrewEntries.findIndex((e) => e.id === entry.id)
        if (idx >= 0) {
          const updated = [...homebrewEntries]
          updated[idx] = entry
          set({ homebrewEntries: updated })
        } else {
          set({ homebrewEntries: [...homebrewEntries, entry] })
        }
        return true
      }
      return false
    } catch (err) {
      logger.error('Failed to save homebrew entry:', err)
      return false
    }
  },

  deleteHomebrewEntry: async (category, id) => {
    try {
      await window.api.deleteHomebrew(category, id)
      set({ homebrewEntries: get().homebrewEntries.filter((e) => e.id !== id) })
      return true
    } catch (err) {
      logger.error('Failed to delete homebrew entry:', err)
      return false
    }
  }
}))
