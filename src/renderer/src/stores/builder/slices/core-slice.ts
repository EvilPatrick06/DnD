import type { StateCreator } from 'zustand'
import { generate5eBuildSlots } from '../../../services/character/build-tree-5e'
import type { BuilderState, CoreSliceState } from '../types'
import { DEFAULT_SCORES } from '../types'
import { DEFAULT_CHARACTER_DETAILS } from './character-details-slice'

export const createCoreSlice: StateCreator<BuilderState, [], [], CoreSliceState> = (set, get) => ({
  phase: 'system-select',
  gameSystem: null,
  buildSlots: [],
  activeTab: 'details',
  targetLevel: 1,
  editingCharacterId: null,

  selectGameSystem: (system) => {
    const slots = generate5eBuildSlots(1)
    set({ phase: 'building', gameSystem: system, buildSlots: slots })
    const firstCategory = 'class'
    const firstSlot = slots.find((s) => s.level === 0 && s.category === firstCategory)
    if (firstSlot) {
      get().openSelectionModal(firstSlot.id)
    }
  },

  resetBuilder: () =>
    set({
      // Core slice defaults
      phase: 'system-select',
      gameSystem: null,
      buildSlots: [],
      selectionModal: null,
      activeTab: 'details',
      targetLevel: 1,
      editingCharacterId: null,
      // Ability score slice defaults
      abilityScores: { ...DEFAULT_SCORES },
      abilityScoreMethod: 'standard',
      standardArrayAssignments: {
        strength: null,
        dexterity: null,
        constitution: null,
        intelligence: null,
        wisdom: null,
        charisma: null
      },
      activeAsiSlotId: null,
      asiSelections: {},
      // Character details slice defaults
      ...DEFAULT_CHARACTER_DETAILS
    }),

  setTargetLevel: (level) => {
    const { gameSystem } = get()
    if (!gameSystem) return
    const currentSlots = get().buildSlots
    const newSlots = generate5eBuildSlots(level)
    for (const newSlot of newSlots) {
      const existing = currentSlots.find((s) => s.id === newSlot.id)
      if (existing) {
        newSlot.selectedId = existing.selectedId
        newSlot.selectedName = existing.selectedName
      }
    }
    set({ targetLevel: level, buildSlots: newSlots })
  },

  setActiveTab: (tab) => set({ activeTab: tab })
})
