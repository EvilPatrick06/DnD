import type { StateCreator } from 'zustand'
import type { BuilderState, SelectionSliceState } from '../types'
import { filterOptions } from '../../../types/builder'
import {
  getOptionsForSlot, load5eRaces, load5eClasses, load5eBackgrounds,
  loadPf2eAncestries, loadPf2eClasses, loadPf2eBackgrounds
} from '../../../services/data-provider'

export const createSelectionSlice: StateCreator<BuilderState, [], [], SelectionSliceState> = (set, get) => ({
  selectionModal: null,

  openSelectionModal: async (slotId) => {
    const { gameSystem, buildSlots } = get()
    if (!gameSystem) return
    const slot = buildSlots.find((s) => s.id === slotId)
    if (!slot) return

    // Build context for filtering (e.g. selected class for subclass/class-feat filtering)
    const classSlot = buildSlots.find((s) => s.category === 'class')
    const context = {
      slotId,
      selectedClassId: classSlot?.selectedId ?? undefined
    }

    let allOptions
    try {
      allOptions = await getOptionsForSlot(gameSystem, slot.category, context)
    } catch (err) {
      console.error('[Builder] Failed to load options for slot', slotId, err)
      return
    }
    if (allOptions.length === 0) return // Don't open empty modals

    // Filter out already-selected options from other slots of the same category
    const selectedIds = new Set(
      buildSlots
        .filter((s) => s.category === slot.category && s.id !== slotId && s.selectedId !== null && s.selectedId !== 'confirmed')
        .map((s) => s.selectedId!)
    )
    const options = selectedIds.size > 0
      ? allOptions.filter((o) => !selectedIds.has(o.id))
      : allOptions
    if (options.length === 0) return

    set({
      selectionModal: {
        slotId,
        title: `Select ${slot.label}`,
        options,
        filteredOptions: options,
        rarityFilter: 'all',
        searchQuery: '',
        previewOptionId: options.length > 0 ? options[0].id : null,
        selectedOptionId: slot.selectedId
      }
    })
  },

  closeSelectionModal: () => set({ selectionModal: null }),

  setModalRarityFilter: (filter) => {
    const modal = get().selectionModal
    if (!modal) return
    const filtered = filterOptions(modal.options, filter, modal.searchQuery)
    set({
      selectionModal: {
        ...modal,
        rarityFilter: filter,
        filteredOptions: filtered
      }
    })
  },

  setModalSearchQuery: (query) => {
    const modal = get().selectionModal
    if (!modal) return
    const filtered = filterOptions(modal.options, modal.rarityFilter, query)
    set({
      selectionModal: {
        ...modal,
        searchQuery: query,
        filteredOptions: filtered
      }
    })
  },

  setModalPreviewOption: (optionId) => {
    const modal = get().selectionModal
    if (!modal) return
    set({ selectionModal: { ...modal, previewOptionId: optionId } })
  },

  acceptSelection: (optionId) => {
    const { selectionModal, buildSlots, gameSystem } = get()
    if (!selectionModal) return
    const option = selectionModal.options.find((o) => o.id === optionId)
    if (!option) return

    const updatedSlots = buildSlots.map((slot) =>
      slot.id === selectionModal.slotId
        ? { ...slot, selectedId: optionId, selectedName: option.name, selectedDescription: option.description, selectedDetailFields: option.detailFields }
        : slot
    )

    const currentSlot = buildSlots.find((s) => s.id === selectionModal.slotId)
    let maxSkills = get().maxSkills
    if (currentSlot?.category === 'class') {
      const skillField = option.detailFields.find((f) => f.label === 'Skills')
      if (skillField) {
        const match = skillField.value.match(/Choose (\d+)/)
        if (match) maxSkills = parseInt(match[1], 10)
        const pf2eMatch = skillField.value.match(/^(\d+)/)
        if (pf2eMatch && !match) maxSkills = parseInt(pf2eMatch[1], 10)
      }
    }

    // Set starting gold synchronously from detail fields (works for both 5e and pf2e)
    if (currentSlot?.category === 'background') {
      const goldField = option.detailFields.find((f) => f.label === 'Starting Gold')
      if (goldField) {
        const goldVal = parseInt(goldField.value, 10)
        if (!isNaN(goldVal) && goldVal > 0) {
          set({ buildSlots: updatedSlots, selectionModal: null, maxSkills, currency: { pp: 0, gp: goldVal, sp: 0, cp: 0 } })
        } else {
          set({ buildSlots: updatedSlots, selectionModal: null, maxSkills })
        }
      } else {
        set({ buildSlots: updatedSlots, selectionModal: null, maxSkills })
      }
    } else {
      set({ buildSlots: updatedSlots, selectionModal: null, maxSkills })
    }

    // Derive data from SRD after selection (async, cached data is instant)
    if (gameSystem === 'dnd5e') {
      if (currentSlot?.category === 'ancestry') {
        load5eRaces().then((races) => {
          const race = races.find((r) => r.id === optionId)
          if (race) {
            const extraLangCount = race.traits.filter((t) => t.name === 'Extra Language').length
            set({
              raceLanguages: race.languages,
              raceExtraLangCount: extraLangCount,
              raceSize: race.size,
              raceSpeed: race.speed,
              raceTraits: race.traits,
              raceProficiencies: race.proficiencies ?? [],
              chosenLanguages: [] // reset when race changes
            })
          }
        })
      }
      if (currentSlot?.category === 'background') {
        load5eBackgrounds().then((bgs) => {
          const bg = bgs.find((b) => b.id === optionId)
          if (bg) {
            set({
              bgLanguageCount: bg.proficiencies.languages,
              bgEquipment: bg.equipment.map((e) => ({ ...e, source: bg.name })),
              chosenLanguages: [], // reset when background changes
              currency: { pp: 0, gp: bg.startingGold ?? 0, sp: 0, cp: 0 }
            })
          }
        })
      }
      if (currentSlot?.category === 'class') {
        load5eClasses().then((classes) => {
          const cls = classes.find((c) => c.id === optionId)
          if (cls) {
            set({
              classEquipment: cls.startingEquipment.map((e) => ({ ...e, source: cls.name })),
              classSkillOptions: cls.proficiencies.skills.options
            })
          }
        })
      }
    }

    // PF2e derivation
    if (gameSystem === 'pf2e') {
      if (currentSlot?.category === 'ancestry') {
        loadPf2eAncestries().then((ancestries) => {
          const ancestry = ancestries.find((a) => a.id === optionId)
          if (ancestry) {
            set({
              raceLanguages: ancestry.languages,
              pf2eAdditionalLanguages: ancestry.additionalLanguages ?? [],
              raceSize: ancestry.size,
              raceSpeed: ancestry.speed,
              raceTraits: ancestry.traits,
              pf2eSpecialAbilities: ancestry.specialAbilities ?? [],
              pf2eAncestryHP: ancestry.hp,
              chosenLanguages: [] // reset when ancestry changes
            })
          }
        })
      }
      if (currentSlot?.category === 'background') {
        loadPf2eBackgrounds().then((bgs) => {
          const bg = bgs.find((b) => b.id === optionId)
          if (bg) {
            set({
              chosenLanguages: [] // reset when background changes
            })
          }
        })
      }
      if (currentSlot?.category === 'class') {
        loadPf2eClasses().then((classes) => {
          const cls = classes.find((c) => c.id === optionId)
          if (cls) {
            set({
              classSkillOptions: cls.skills.options,
              classMandatorySkills: cls.mandatorySkills ?? [],
              pf2eClassHP: cls.hp,
              pf2ePerceptionRank: cls.perception,
              pf2eSaveRanks: cls.savingThrows,
              pf2eKeyAbility: cls.keyAbility[0] ?? null,
              pf2eUnarmoredRank: cls.defenses?.unarmored ?? 'trained',
              pf2eClassFeatures: cls.classFeatures ?? [],
              classEquipment: cls.startingEquipment?.map((e) => ({ ...e, source: cls.name })) ?? [],
              // PF2e starting wealth is 15 gp for all classes
              currency: { pp: 0, gp: 15, sp: 0, cp: 0 }
            })
          }
        })
      }
    }

    // BUG FIX: replaced setTimeout with queueMicrotask to avoid race condition
    queueMicrotask(() => get().advanceToNextSlot())
  }
})
