import type { StateCreator } from 'zustand'
import { load5eClasses } from '../../../services/data-provider'
import type { BuilderState, CharacterDetailsSliceState } from '../types'

export const createCharacterDetailsSlice: StateCreator<BuilderState, [], [], CharacterDetailsSliceState> = (
  set,
  get
) => ({
  characterName: '',
  iconType: 'letter',
  iconPreset: '',
  iconCustom: '',
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

  // Derived from selections
  speciesLanguages: [],
  speciesExtraLangCount: 0,
  speciesExtraSkillCount: 0,
  versatileFeatId: null,
  heritageId: null,
  derivedSpeciesTraits: [],
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
  selectedSkills: [],
  maxSkills: 2,
  customModal: null,
  backgroundAbilityBonuses: {},
  backgroundEquipmentChoice: null,
  classEquipmentChoice: null,
  selectedSpellIds: [],
  speciesSpellcastingAbility: null,
  keenSensesSkill: null,
  blessedWarriorCantrips: [],
  druidicWarriorCantrips: [],

  setCharacterName: (name) => set({ characterName: name }),
  setSelectedSkills: (skills) => set({ selectedSkills: skills }),

  setIconType: (type) => set({ iconType: type }),
  setIconPreset: (preset) => set({ iconType: 'preset', iconPreset: preset }),
  setIconCustom: (dataUrl) => set({ iconType: 'custom', iconCustom: dataUrl }),

  setChosenLanguages: (languages) => set({ chosenLanguages: languages }),
  setCurrency: (currency) => set({ currency }),
  addPet: (name, type) => set({ pets: [...get().pets, { name, type }] }),
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
  setBackgroundAbilityBonuses: (bonuses) => set({ backgroundAbilityBonuses: bonuses }),
  setBackgroundEquipmentChoice: (choice) => set({ backgroundEquipmentChoice: choice }),
  setClassEquipmentChoice: (choice) => {
    set({ classEquipmentChoice: choice })
    // Update class equipment based on the selected option
    const { buildSlots, gameSystem } = get()
    if (gameSystem !== 'dnd5e') return
    const classSlot = buildSlots.find((s) => s.category === 'class')
    if (!classSlot?.selectedId) return
    load5eClasses().then((classes) => {
      const cls = classes.find((c) => c.id === classSlot.selectedId)
      if (!cls) return
      const options = cls.startingEquipmentOptions
      if (options?.[choice]) {
        const shopItems = get().classEquipment.filter((e) => e.source === 'shop')
        set({
          classEquipment: [
            ...options[choice].equipment.map((e: { name: string; quantity: number }) => ({ ...e, source: cls.name })),
            ...shopItems
          ]
        })
      }
    })
  },
  setSpeciesSize: (size) => set({ speciesSize: size }),
  setSelectedSpellIds: (ids) => set({ selectedSpellIds: ids }),
  setHigherLevelGoldBonus: (amount) => set({ higherLevelGoldBonus: amount }),
  setSelectedMagicItems: (items) => set({ selectedMagicItems: items }),
  setSpeciesSpellcastingAbility: (ability) => set({ speciesSpellcastingAbility: ability }),
  setKeenSensesSkill: (skill) => set({ keenSensesSkill: skill }),
  setBlessedWarriorCantrips: (ids) => set({ blessedWarriorCantrips: ids }),
  setDruidicWarriorCantrips: (ids) => set({ druidicWarriorCantrips: ids }),
  setVersatileFeat: (featId) => set({ versatileFeatId: featId }),
  openCustomModal: (modal) => set({ customModal: modal }),
  closeCustomModal: () => set({ customModal: null, activeAsiSlotId: null })
})
