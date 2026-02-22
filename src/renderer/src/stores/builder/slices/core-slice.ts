import type { StateCreator } from 'zustand'
import { generate5eBuildSlots } from '../../../services/character/build-tree-5e'
import type { BuilderState, CoreSliceState } from '../types'
import { DEFAULT_SCORES } from '../types'

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
        strength: null,
        dexterity: null,
        constitution: null,
        intelligence: null,
        wisdom: null,
        charisma: null
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
      characterPersonality: '',
      characterIdeals: '',
      characterBonds: '',
      characterFlaws: '',
      characterBackstory: '',
      characterHeight: '',
      characterWeight: '',
      characterEyes: '',
      characterHair: '',
      characterSkin: '',
      characterAppearance: '',
      characterAlignment: '',
      speciesLanguages: [],
      speciesExtraLangCount: 0,
      bgLanguageCount: 0,
      classExtraLangCount: 0,
      chosenLanguages: [],
      speciesSize: 'Medium',
      speciesSpeed: 30,
      speciesTraits: [],
      speciesProficiencies: [],
      classEquipment: [],
      bgEquipment: [],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      higherLevelGoldBonus: 0,
      selectedMagicItems: [],
      pets: [],
      currentHP: null,
      tempHP: 0,
      conditions: [],
      classSkillOptions: [],
      classMandatorySkills: [],
      selectedSpellIds: [],
      backgroundAbilityBonuses: {},
      backgroundEquipmentChoice: null,
      classEquipmentChoice: null,
      speciesSpellcastingAbility: null,
      keenSensesSkill: null,
      blessedWarriorCantrips: []
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
