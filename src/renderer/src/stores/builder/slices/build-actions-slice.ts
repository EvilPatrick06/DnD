import type { StateCreator } from 'zustand'
import type { BuilderState, BuildActionsSliceState } from '../types'
import { FOUNDATION_SLOT_ORDER } from '../types'

export const createBuildActionsSlice: StateCreator<BuilderState, [], [], BuildActionsSliceState> = (set, get) => ({
  advanceToNextSlot: () => {
    const { buildSlots } = get()

    // First walk foundation slots in order
    for (const slotId of FOUNDATION_SLOT_ORDER) {
      const slot = buildSlots.find((s) => s.id === slotId)
      if (!slot) continue
      if (slot.selectedId !== null) continue

      if (slot.category === 'ability-scores') {
        set({ customModal: 'ability-scores', activeAsiSlotId: null })
        return
      }
      if (slot.category === 'ability-boost') {
        set({ customModal: 'asi', activeAsiSlotId: slot.id })
        return
      }
      if (slot.category === 'skill-choice') {
        set({ customModal: 'skills', activeAsiSlotId: null })
        return
      }
      set({ activeAsiSlotId: null })
      get().openSelectionModal(slot.id)
      return
    }

    // Then walk remaining slots (level 1+) in order
    const nonFoundationSlots = buildSlots
      .filter((s) => !FOUNDATION_SLOT_ORDER.includes(s.id))
      .sort((a, b) => a.level - b.level)

    for (const slot of nonFoundationSlots) {
      if (slot.selectedId !== null) continue

      if (slot.category === 'ability-boost') {
        set({ customModal: 'asi', activeAsiSlotId: slot.id })
        return
      }
      // Try to open the modal for this slot
      set({ activeAsiSlotId: null })
      get().openSelectionModal(slot.id)
      return
    }

    // All slots filled
    set({ activeAsiSlotId: null, customModal: null })
  },

  confirmAbilityScores: () => {
    const { buildSlots, abilityScores } = get()
    const scores = Object.values(abilityScores)
    const summary = scores.join('/')

    const updatedSlots = buildSlots.map((slot) =>
      slot.id === 'ability-scores'
        ? { ...slot, selectedId: 'confirmed', selectedName: summary }
        : slot
    )
    set({ buildSlots: updatedSlots, customModal: null })
    // BUG FIX: replaced setTimeout with queueMicrotask to avoid race condition
    queueMicrotask(() => get().advanceToNextSlot())
  },

  confirmSkills: () => {
    const { buildSlots, selectedSkills } = get()
    const summary = selectedSkills.length > 0
      ? `${selectedSkills.length} selected`
      : 'None'

    const updatedSlots = buildSlots.map((slot) =>
      slot.id === 'skill-choices'
        ? { ...slot, selectedId: 'confirmed', selectedName: summary }
        : slot
    )
    set({ buildSlots: updatedSlots, customModal: null })
    // BUG FIX: replaced setTimeout with queueMicrotask to avoid race condition
    queueMicrotask(() => get().advanceToNextSlot())
  }
})
