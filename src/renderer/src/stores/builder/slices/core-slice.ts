import type { StateCreator } from 'zustand'
import type { BuilderState, CoreSliceState } from '../types'
import { DEFAULT_SCORES } from '../types'
import { generate5eBuildSlots } from '../../../services/build-tree-5e'
import { generatePf2eBuildSlots } from '../../../services/build-tree-pf2e'

export const createCoreSlice: StateCreator<BuilderState, [], [], CoreSliceState> = (set, get) => ({
  phase: 'system-select',
  gameSystem: null,
  buildSlots: [],
  activeTab: 'details',
  targetLevel: 1,
  editingCharacterId: null,

  selectGameSystem: (system) => {
    const slots =
      system === 'dnd5e' ? generate5eBuildSlots(1) : generatePf2eBuildSlots(1)
    set({ phase: 'building', gameSystem: system, buildSlots: slots })
    const firstSlot = slots.find((s) => s.level === 0 && s.category === 'ancestry')
    if (firstSlot) {
      get().openSelectionModal(firstSlot.id)
    }
  },

  resetBuilder: () =>
    set({
      phase: 'system-select',
      gameSystem: null,
      buildSlots: [],
      selectionModal: null,
      activeTab: 'details',
      targetLevel: 1,
      characterName: '',
      abilityScores: { ...DEFAULT_SCORES },
      abilityScoreMethod: 'standard',
      standardArrayAssignments: {
        strength: null, dexterity: null, constitution: null,
        intelligence: null, wisdom: null, charisma: null
      },
      selectedSkills: [],
      maxSkills: 2,
      iconType: 'letter',
      iconPreset: '',
      iconCustom: '',
      editingCharacterId: null,
      activeAsiSlotId: null,
      asiSelections: {},
      customModal: null,
      characterGender: '',
      characterDeity: '',
      characterAge: '',
      characterNotes: '',
      heroPoints: 0,
      raceLanguages: [],
      raceExtraLangCount: 0,
      bgLanguageCount: 0,
      chosenLanguages: [],
      raceSize: 'Medium',
      raceSpeed: 30,
      raceTraits: [],
      raceProficiencies: [],
      classEquipment: [],
      bgEquipment: [],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      pets: [],
      currentHP: null,
      tempHP: 0,
      conditions: [],
      classSkillOptions: [],
      classMandatorySkills: [],
      pf2eAdditionalLanguages: [],
      pf2eSpecialAbilities: [],
      pf2eAncestryHP: 0,
      pf2eClassHP: 0,
      pf2ePerceptionRank: 'trained',
      pf2eSaveRanks: { fortitude: 'trained', reflex: 'trained', will: 'trained' },
      pf2eKeyAbility: null,
      pf2eUnarmoredRank: 'trained',
      pf2eClassFeatures: [],
      selectedSpellIds: [],
      speciesAbilityBonuses: {}
    }),

  setTargetLevel: (level) => {
    const { gameSystem } = get()
    if (!gameSystem) return
    const currentSlots = get().buildSlots
    const newSlots = gameSystem === 'dnd5e' ? generate5eBuildSlots(level) : generatePf2eBuildSlots(level)
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
