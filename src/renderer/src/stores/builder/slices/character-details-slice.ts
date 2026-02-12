import type { StateCreator } from 'zustand'
import type { BuilderState, CharacterDetailsSliceState } from '../types'

export const createCharacterDetailsSlice: StateCreator<BuilderState, [], [], CharacterDetailsSliceState> = (set, get) => ({
  characterName: '',
  iconType: 'letter',
  iconPreset: '',
  iconCustom: '',
  characterGender: '',
  characterDeity: '',
  characterAge: '',
  characterNotes: '',
  heroPoints: 0,

  // Derived from selections
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
  selectedSkills: [],
  maxSkills: 2,
  customModal: null,
  pf2eAdditionalLanguages: [],
  pf2eSpecialAbilities: [],
  pf2eAncestryHP: 0,
  pf2eClassHP: 0,
  pf2ePerceptionRank: 'trained',
  pf2eSaveRanks: { fortitude: 'trained', reflex: 'trained', will: 'trained' },
  pf2eKeyAbility: null,
  pf2eUnarmoredRank: 'trained',
  pf2eClassFeatures: [],
  speciesAbilityBonuses: {},
  selectedSpellIds: [],

  setCharacterName: (name) => set({ characterName: name }),
  setSelectedSkills: (skills) => set({ selectedSkills: skills }),

  setIconType: (type) => set({ iconType: type }),
  setIconPreset: (preset) => set({ iconType: 'preset', iconPreset: preset }),
  setIconCustom: (dataUrl) => set({ iconType: 'custom', iconCustom: dataUrl }),

  setChosenLanguages: (languages) => set({ chosenLanguages: languages }),
  setCurrency: (currency) => set({ currency }),
  addPet: (name) => set({ pets: [...get().pets, { name }] }),
  removePet: (index) => set({ pets: get().pets.filter((_, i) => i !== index) }),
  setCurrentHP: (hp) => set({ currentHP: hp }),
  setTempHP: (hp) => set({ tempHP: hp }),
  addCondition: (name, type, isCustom) => set({ conditions: [...get().conditions, { name, type, isCustom }] }),
  removeCondition: (index) => set({ conditions: get().conditions.filter((_, i) => i !== index) }),
  removeEquipmentItem: (source, index) => {
    if (source === 'class') {
      set({ classEquipment: get().classEquipment.filter((_, i) => i !== index) })
    } else {
      set({ bgEquipment: get().bgEquipment.filter((_, i) => i !== index) })
    }
  },
  addEquipmentItem: (item) => {
    set({ classEquipment: [...get().classEquipment, item] })
  },

  deductCurrency: (key, amount) => {
    const curr = { ...get().currency }
    curr[key] = Math.max(0, curr[key] - amount)
    set({ currency: curr })
  },
  setSpeciesAbilityBonuses: (bonuses) => set({ speciesAbilityBonuses: bonuses }),
  setSelectedSpellIds: (ids) => set({ selectedSpellIds: ids }),
  openCustomModal: (modal) => set({ customModal: modal }),
  closeCustomModal: () => set({ customModal: null, activeAsiSlotId: null })
})
