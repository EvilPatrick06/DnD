import { create } from 'zustand'
import { getClassResources } from '../data/class-resources'
import { getSpeciesResources } from '../data/species-resources'
import { getSpeciesSpellProgression } from '../services/auto-populate-5e'
import { generate5eLevelUpSlots, getExpertiseGrants } from '../services/build-tree-5e'
import { load5eSpecies, load5eSubclasses, loadJson } from '../services/data-provider'
import {
  computeSpellcastingInfo,
  FULL_CASTERS_5E,
  getMulticlassSpellSlots,
  getSlotProgression,
  getWarlockPactSlots,
  HALF_CASTERS_5E,
  isMulticlassSpellcaster
} from '../services/spell-data'
import { calculateHPBonusFromTraits, getWildShapeMax } from '../services/stat-calculator-5e'
import type { Character } from '../types/character'
import { is5eCharacter } from '../types/character'
import type { Character5e, MulticlassEntry } from '../types/character-5e'
import type { AbilityName, AbilityScoreSet, BuildSlot, SpellEntry } from '../types/character-common'
import { abilityModifier } from '../types/character-common'

// 2024 PHB multiclass prerequisites (minimum ability scores)
const MULTICLASS_PREREQUISITES: Record<
  string,
  { abilities: Partial<Record<AbilityName, number>>; mode: 'all' | 'any' }
> = {
  barbarian: { abilities: { strength: 13 }, mode: 'all' },
  bard: { abilities: { charisma: 13 }, mode: 'all' },
  cleric: { abilities: { wisdom: 13 }, mode: 'all' },
  druid: { abilities: { wisdom: 13 }, mode: 'all' },
  fighter: { abilities: { strength: 13, dexterity: 13 }, mode: 'any' },
  monk: { abilities: { dexterity: 13, wisdom: 13 }, mode: 'all' },
  paladin: { abilities: { strength: 13, charisma: 13 }, mode: 'all' },
  ranger: { abilities: { dexterity: 13, wisdom: 13 }, mode: 'all' },
  rogue: { abilities: { dexterity: 13 }, mode: 'all' },
  sorcerer: { abilities: { charisma: 13 }, mode: 'all' },
  warlock: { abilities: { charisma: 13 }, mode: 'all' },
  wizard: { abilities: { intelligence: 13 }, mode: 'all' }
}

function checkMulticlassPrerequisites(classId: string, scores: AbilityScoreSet): string | null {
  const prereq = MULTICLASS_PREREQUISITES[classId]
  if (!prereq) return null
  const entries = Object.entries(prereq.abilities) as [AbilityName, number][]
  if (prereq.mode === 'all') {
    const failed = entries.filter(([ability, min]) => scores[ability] < min)
    if (failed.length > 0) {
      return `${classId}: requires ${failed.map(([a, m]) => `${a.charAt(0).toUpperCase() + a.slice(1)} ${m}+`).join(', ')} (have ${failed.map(([a]) => scores[a]).join(', ')})`
    }
  } else {
    // 'any' mode: at least one must meet the threshold
    const anyMet = entries.some(([ability, min]) => scores[ability] >= min)
    if (!anyMet) {
      return `${classId}: requires ${entries.map(([a, m]) => `${a.charAt(0).toUpperCase() + a.slice(1)} ${m}+`).join(' or ')} (have ${entries.map(([a]) => `${scores[a]}`).join(', ')})`
    }
  }
  return null
}

interface ClassFeaturesFile {
  [classId: string]: {
    features: Array<{ level: number; name: string; description: string }>
    subclassLevel: number
    spellSlots: Record<string, Record<string, number>> | null
  }
}

export type HpChoice = 'average' | 'roll'

interface LevelUpState {
  character: Character | null
  currentLevel: number
  targetLevel: number
  levelUpSlots: BuildSlot[]
  hpChoices: Record<number, HpChoice> // per level
  hpRolls: Record<number, number> // actual rolled values per level
  asiSelections: Record<string, AbilityName[]> // slotId -> [ability1, ability2]
  generalFeatSelections: Record<
    string,
    { id: string; name: string; description: string; choices?: Record<string, string | string[]> }
  > // slotId -> feat
  fightingStyleSelection: { id: string; name: string; description: string } | null
  primalOrderSelection: 'magician' | 'warden' | null
  divineOrderSelection: 'protector' | 'thaumaturge' | null
  elementalFurySelection: 'potent-spellcasting' | 'primal-strike' | null
  newSpellIds: string[]
  epicBoonSelection: { id: string; name: string; description: string } | null
  invocationSelections: string[] // invocation IDs known after level-up
  metamagicSelections: string[] // metamagic IDs known after level-up
  blessedWarriorCantrips: string[] // Blessed Warrior cantrip IDs
  druidicWarriorCantrips: string[] // Druidic Warrior cantrip IDs
  expertiseSelections: Record<string, string[]> // slotId -> chosen skill names
  classLevelChoices: Record<number, string> // charLevel -> classId for multiclass
  spellsRequired: number // set by SpellSelectionSection5e
  loading: boolean

  initLevelUp: (character: Character) => void
  setTargetLevel: (level: number) => void
  setHpChoice: (level: number, choice: HpChoice) => void
  setHpRoll: (level: number, value: number) => void
  setAsiSelection: (slotId: string, abilities: AbilityName[]) => void
  setSlotSelection: (slotId: string, selectedId: string | null, selectedName: string | null) => void
  setNewSpellIds: (ids: string[]) => void
  toggleNewSpell: (id: string) => void
  setEpicBoonSelection: (sel: { id: string; name: string; description: string } | null) => void
  setGeneralFeatSelection: (
    slotId: string,
    feat: { id: string; name: string; description: string; choices?: Record<string, string | string[]> } | null
  ) => void
  setFightingStyleSelection: (sel: { id: string; name: string; description: string } | null) => void
  setBlessedWarriorCantrips: (ids: string[]) => void
  setDruidicWarriorCantrips: (ids: string[]) => void
  setPrimalOrderSelection: (sel: 'magician' | 'warden' | null) => void
  setDivineOrderSelection: (sel: 'protector' | 'thaumaturge' | null) => void
  setElementalFurySelection: (sel: 'potent-spellcasting' | 'primal-strike' | null) => void
  setInvocationSelections: (ids: string[]) => void
  setMetamagicSelections: (ids: string[]) => void
  setExpertiseSelections: (slotId: string, skills: string[]) => void
  setClassLevelChoice: (level: number, classId: string) => void
  setSpellsRequired: (count: number) => void
  getIncompleteChoices: () => string[]
  applyLevelUp: () => Promise<Character>
  reset: () => void
}

const initialState = {
  character: null,
  currentLevel: 0,
  targetLevel: 0,
  levelUpSlots: [],
  hpChoices: {} as Record<number, HpChoice>,
  hpRolls: {} as Record<number, number>,
  asiSelections: {} as Record<string, AbilityName[]>,
  generalFeatSelections: {} as Record<
    string,
    { id: string; name: string; description: string; choices?: Record<string, string | string[]> }
  >,
  fightingStyleSelection: null as { id: string; name: string; description: string } | null,
  primalOrderSelection: null as 'magician' | 'warden' | null,
  divineOrderSelection: null as 'protector' | 'thaumaturge' | null,
  elementalFurySelection: null as 'potent-spellcasting' | 'primal-strike' | null,
  newSpellIds: [] as string[],
  invocationSelections: [] as string[],
  metamagicSelections: [] as string[],
  epicBoonSelection: null as { id: string; name: string; description: string } | null,
  blessedWarriorCantrips: [] as string[],
  druidicWarriorCantrips: [] as string[],
  expertiseSelections: {} as Record<string, string[]>,
  classLevelChoices: {} as Record<number, string>,
  spellsRequired: 0,
  loading: false
}

export const useLevelUpStore = create<LevelUpState>((set, get) => ({
  ...initialState,

  initLevelUp: (character: Character) => {
    const targetLevel = Math.min(20, character.level + 1)

    // Default class choices: all levels go to primary class
    const classLevelChoices: Record<number, string> = {}
    if (is5eCharacter(character)) {
      for (let lvl = character.level + 1; lvl <= targetLevel; lvl++) {
        classLevelChoices[lvl] = character.buildChoices.classId
      }
    }

    const slots = generate5eLevelUpSlots(character.level, targetLevel, character.buildChoices.classId)

    set({
      character,
      currentLevel: character.level,
      targetLevel,
      levelUpSlots: slots,
      hpChoices: {},
      hpRolls: {},
      asiSelections: {},
      generalFeatSelections: {},
      fightingStyleSelection: null,
      primalOrderSelection: null,
      divineOrderSelection: null,
      elementalFurySelection: null,
      newSpellIds: [],
      invocationSelections: is5eCharacter(character) ? [...(character.invocationsKnown ?? [])] : [],
      metamagicSelections: is5eCharacter(character) ? [...(character.metamagicKnown ?? [])] : [],
      epicBoonSelection: null,
      blessedWarriorCantrips: [],
      druidicWarriorCantrips: [],
      expertiseSelections: {},
      classLevelChoices,
      loading: false
    })
  },

  setTargetLevel: (level: number) => {
    const { character, currentLevel, hpChoices, hpRolls, asiSelections, classLevelChoices } = get()
    if (!character) return
    const clamped = Math.max(currentLevel + 1, Math.min(20, level))

    // Preserve/extend class level choices
    const newClassChoices: Record<number, string> = {}
    if (is5eCharacter(character)) {
      for (let lvl = currentLevel + 1; lvl <= clamped; lvl++) {
        newClassChoices[lvl] = classLevelChoices[lvl] ?? character.buildChoices.classId
      }
    }

    // Compute existing class levels for multiclass slot generation
    let existingClassLevels: Record<string, number> | undefined
    if (
      is5eCharacter(character) &&
      Object.values(newClassChoices).some((id) => id !== character.buildChoices.classId)
    ) {
      existingClassLevels = {}
      for (const cls of character.classes) {
        existingClassLevels[cls.name.toLowerCase()] = cls.level
      }
    }

    const slots = generate5eLevelUpSlots(
      currentLevel,
      clamped,
      character.buildChoices.classId,
      existingClassLevels ? newClassChoices : undefined,
      existingClassLevels
    )

    // Preserve existing HP choices/rolls for levels that still exist
    const newHpChoices: Record<number, HpChoice> = {}
    const newHpRolls: Record<number, number> = {}
    for (let lvl = currentLevel + 1; lvl <= clamped; lvl++) {
      if (hpChoices[lvl]) newHpChoices[lvl] = hpChoices[lvl]
      if (hpRolls[lvl] !== undefined) newHpRolls[lvl] = hpRolls[lvl]
    }

    // Preserve ASI selections for slots that still exist
    const slotIds = new Set(slots.map((s) => s.id))
    const newAsi: Record<string, AbilityName[]> = {}
    for (const [key, val] of Object.entries(asiSelections)) {
      if (slotIds.has(key)) newAsi[key] = val
    }

    // Preserve general feat selections for slots that still exist
    const newGeneralFeats: Record<string, { id: string; name: string; description: string }> = {}
    for (const [key, val] of Object.entries(get().generalFeatSelections)) {
      if (slotIds.has(key)) newGeneralFeats[key] = val
    }

    // Clear selections if their slots are no longer in the level-up range
    const hasEpicBoonSlot = slots.some((s) => s.category === 'epic-boon')
    const hasFightingStyleSlot = slots.some((s) => s.category === 'fighting-style')
    const hasPrimalOrderSlot = slots.some((s) => s.category === 'primal-order')
    const hasDivineOrderSlot = slots.some((s) => s.category === 'divine-order')
    set({
      targetLevel: clamped,
      levelUpSlots: slots,
      hpChoices: newHpChoices,
      hpRolls: newHpRolls,
      asiSelections: newAsi,
      generalFeatSelections: newGeneralFeats,
      classLevelChoices: newClassChoices,
      ...(hasEpicBoonSlot ? {} : { epicBoonSelection: null }),
      ...(hasFightingStyleSlot ? {} : { fightingStyleSelection: null }),
      ...(hasPrimalOrderSlot ? {} : { primalOrderSelection: null }),
      ...(hasDivineOrderSlot ? {} : { divineOrderSelection: null })
    })
  },

  setHpChoice: (level, choice) => {
    set((s) => ({ hpChoices: { ...s.hpChoices, [level]: choice } }))
  },

  setHpRoll: (level, value) => {
    set((s) => ({ hpRolls: { ...s.hpRolls, [level]: value } }))
  },

  setAsiSelection: (slotId, abilities) => {
    set((s) => ({ asiSelections: { ...s.asiSelections, [slotId]: abilities } }))
  },

  setSlotSelection: (slotId, selectedId, selectedName) => {
    set((s) => ({
      levelUpSlots: s.levelUpSlots.map((slot) => (slot.id === slotId ? { ...slot, selectedId, selectedName } : slot))
    }))
  },

  setEpicBoonSelection: (sel) => set({ epicBoonSelection: sel }),

  setGeneralFeatSelection: (slotId, feat) => {
    if (feat) {
      set((s) => ({
        generalFeatSelections: { ...s.generalFeatSelections, [slotId]: feat },
        // Clear ASI for this slot when choosing a feat instead
        asiSelections: (() => {
          const { [slotId]: _, ...rest } = s.asiSelections
          return rest
        })()
      }))
    } else {
      set((s) => {
        const { [slotId]: _, ...rest } = s.generalFeatSelections
        return { generalFeatSelections: rest }
      })
    }
  },

  setFightingStyleSelection: (sel) => set({ fightingStyleSelection: sel }),
  setBlessedWarriorCantrips: (ids) => set({ blessedWarriorCantrips: ids }),
  setDruidicWarriorCantrips: (ids) => set({ druidicWarriorCantrips: ids }),
  setPrimalOrderSelection: (sel) => set({ primalOrderSelection: sel }),
  setDivineOrderSelection: (sel) => set({ divineOrderSelection: sel }),
  setElementalFurySelection: (sel) => set({ elementalFurySelection: sel }),
  setInvocationSelections: (ids) => set({ invocationSelections: ids }),
  setMetamagicSelections: (ids) => set({ metamagicSelections: ids }),
  setExpertiseSelections: (slotId, skills) => {
    set((s) => ({ expertiseSelections: { ...s.expertiseSelections, [slotId]: skills } }))
  },

  setSpellsRequired: (count: number) => set({ spellsRequired: count }),

  getIncompleteChoices: (): string[] => {
    const {
      character,
      currentLevel,
      targetLevel,
      hpChoices,
      hpRolls,
      levelUpSlots,
      asiSelections,
      generalFeatSelections,
      epicBoonSelection,
      fightingStyleSelection,
      blessedWarriorCantrips,
      druidicWarriorCantrips,
      primalOrderSelection,
      divineOrderSelection,
      elementalFurySelection,
      expertiseSelections,
      invocationSelections,
      metamagicSelections,
      newSpellIds,
      spellsRequired,
      classLevelChoices
    } = get()
    if (!character || !is5eCharacter(character)) return []

    const incomplete: string[] = []

    // HP per level
    for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
      const choice = hpChoices[lvl]
      if (!choice) {
        incomplete.push(`Level ${lvl}: HP method`)
      } else if (choice === 'roll' && hpRolls[lvl] === undefined) {
        incomplete.push(`Level ${lvl}: Roll HP`)
      }
    }

    // Multiclass prerequisites (2024 PHB)
    const primaryClassId = character.buildChoices.classId
    const multiclassClasses = new Set<string>()
    for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
      const chosenClass = classLevelChoices[lvl]
      if (chosenClass && chosenClass !== primaryClassId) {
        multiclassClasses.add(chosenClass)
      }
    }
    if (multiclassClasses.size > 0) {
      // Must meet prereqs for current class AND each new class
      const currentClassCheck = checkMulticlassPrerequisites(primaryClassId, character.abilityScores)
      if (currentClassCheck) {
        incomplete.push(`Multiclass blocked — current class ${currentClassCheck}`)
      }
      for (const newClass of multiclassClasses) {
        const newClassCheck = checkMulticlassPrerequisites(newClass, character.abilityScores)
        if (newClassCheck) {
          incomplete.push(`Multiclass blocked — new class ${newClassCheck}`)
        }
      }
    }

    // ASI / General Feat at ASI levels
    const asiSlots = levelUpSlots.filter((s) => s.category === 'ability-boost')
    for (const slot of asiSlots) {
      const asi = asiSelections[slot.id]
      const feat = generalFeatSelections[slot.id]
      const hasAsi = asi && asi.length > 0
      if (!hasAsi && !feat) {
        incomplete.push(`Level ${slot.level}: Ability Score Improvement or Feat`)
      }
    }

    // Epic Boon
    if (levelUpSlots.some((s) => s.category === 'epic-boon') && !epicBoonSelection) {
      incomplete.push('Epic Boon')
    }

    // Fighting Style
    if (levelUpSlots.some((s) => s.category === 'fighting-style') && !fightingStyleSelection) {
      incomplete.push('Fighting Style')
    }

    // Blessed Warrior cantrips
    if (fightingStyleSelection?.id === 'fighting-style-blessed-warrior' && blessedWarriorCantrips.length < 2) {
      incomplete.push(`Blessed Warrior cantrips (${blessedWarriorCantrips.length}/2)`)
    }

    // Druidic Warrior cantrips
    if (fightingStyleSelection?.id === 'druidic-warrior' && druidicWarriorCantrips.length < 2) {
      incomplete.push(`Druidic Warrior cantrips (${druidicWarriorCantrips.length}/2)`)
    }

    // Primal Order
    if (levelUpSlots.some((s) => s.category === 'primal-order') && !primalOrderSelection) {
      incomplete.push('Primal Order')
    }

    // Divine Order
    if (levelUpSlots.some((s) => s.category === 'divine-order') && !divineOrderSelection) {
      incomplete.push('Divine Order')
    }

    // Elemental Fury (Druid level 7)
    // Check if any level in the range gains Elemental Fury
    const hasFurySlot = (() => {
      for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
        const effectiveClassId = classLevelChoices[lvl] ?? character.buildChoices.classId
        if (effectiveClassId !== 'druid') continue
        const existingDruidLevel = character.classes.find((c) => c.name.toLowerCase() === 'druid')?.level ?? 0
        const levelsGained = (() => {
          let count = 0
          for (let l = currentLevel + 1; l <= lvl; l++) {
            if ((classLevelChoices[l] ?? character.buildChoices.classId) === 'druid') count++
          }
          return count
        })()
        if (existingDruidLevel + levelsGained === 7) return true
      }
      return false
    })()
    if (hasFurySlot && !elementalFurySelection) {
      incomplete.push('Elemental Fury')
    }

    // Expertise
    const expertiseSlots = levelUpSlots.filter((s) => s.category === 'expertise')
    for (const slot of expertiseSlots) {
      const effectiveClassId = (() => {
        // Find which class this slot belongs to by checking the slot id
        for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
          if (slot.id.includes(`level${lvl}`)) {
            return classLevelChoices[lvl] ?? character.buildChoices.classId
          }
        }
        return character.buildChoices.classId
      })()
      const grants = getExpertiseGrants(effectiveClassId)
      const grant = grants[0]
      if (grant) {
        const selected = expertiseSelections[slot.id] ?? []
        if (selected.length < grant.count) {
          incomplete.push(`Level ${slot.level}: Expertise (${selected.length}/${grant.count})`)
        }
      }
    }

    // Subclass (slots with category 'class-feat' and label 'Subclass')
    const subclassSlots = levelUpSlots.filter((s) => s.category === 'class-feat' && s.label === 'Subclass')
    for (const slot of subclassSlots) {
      if (!slot.selectedId) {
        incomplete.push(`Level ${slot.level}: Subclass`)
      }
    }

    // Spells (only when spellsRequired > 0)
    if (spellsRequired > 0 && newSpellIds.length < spellsRequired) {
      incomplete.push(`Spells (${newSpellIds.length}/${spellsRequired})`)
    }

    // Invocations (Warlock)
    const warlockLevel = (() => {
      const existing = character.classes.find((c) => c.name.toLowerCase() === 'warlock')?.level ?? 0
      let gained = 0
      for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
        if ((classLevelChoices[lvl] ?? character.buildChoices.classId) === 'warlock') gained++
      }
      return existing + gained
    })()
    if (warlockLevel > 0) {
      const INVOC_COUNT: Record<number, number> = {
        1: 1,
        2: 3,
        3: 3,
        4: 3,
        5: 5,
        6: 5,
        7: 6,
        8: 6,
        9: 7,
        10: 7,
        11: 7,
        12: 8,
        13: 8,
        14: 8,
        15: 9,
        16: 9,
        17: 9,
        18: 10,
        19: 10,
        20: 10
      }
      const maxInvocations = INVOC_COUNT[warlockLevel] ?? 0
      if (maxInvocations > 0 && invocationSelections.length < maxInvocations) {
        incomplete.push(`Invocations (${invocationSelections.length}/${maxInvocations})`)
      }
    }

    // Metamagic (Sorcerer)
    const sorcererLevel = (() => {
      const existing = character.classes.find((c) => c.name.toLowerCase() === 'sorcerer')?.level ?? 0
      let gained = 0
      for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
        if ((classLevelChoices[lvl] ?? character.buildChoices.classId) === 'sorcerer') gained++
      }
      return existing + gained
    })()
    if (sorcererLevel >= 2) {
      const maxMeta = sorcererLevel >= 17 ? 6 : sorcererLevel >= 10 ? 4 : 2
      if (metamagicSelections.length < maxMeta) {
        incomplete.push(`Metamagic (${metamagicSelections.length}/${maxMeta})`)
      }
    }

    return incomplete
  },

  setClassLevelChoice: (level: number, classId: string) => {
    const { character, currentLevel, targetLevel, classLevelChoices } = get()
    if (!character || !is5eCharacter(character)) return

    const newChoices = { ...classLevelChoices, [level]: classId }

    // Recompute existing class levels for slot generation
    const existingClassLevels: Record<string, number> = {}
    for (const cls of character.classes) {
      existingClassLevels[cls.name.toLowerCase()] = cls.level
    }

    const isMulticlass = Object.values(newChoices).some((id) => id !== character.buildChoices.classId)
    const slots = generate5eLevelUpSlots(
      currentLevel,
      targetLevel,
      character.buildChoices.classId,
      isMulticlass ? newChoices : undefined,
      isMulticlass ? existingClassLevels : undefined
    )

    // Preserve valid ASI and general feat selections
    const slotIds = new Set(slots.map((s) => s.id))
    const newAsi: Record<string, AbilityName[]> = {}
    for (const [key, val] of Object.entries(get().asiSelections)) {
      if (slotIds.has(key)) newAsi[key] = val
    }
    const newGeneralFeats: Record<string, { id: string; name: string; description: string }> = {}
    for (const [key, val] of Object.entries(get().generalFeatSelections)) {
      if (slotIds.has(key)) newGeneralFeats[key] = val
    }

    set({
      classLevelChoices: newChoices,
      levelUpSlots: slots,
      asiSelections: newAsi,
      generalFeatSelections: newGeneralFeats,
      ...(slots.some((s) => s.category === 'fighting-style') ? {} : { fightingStyleSelection: null })
    })
  },

  setNewSpellIds: (ids) => set({ newSpellIds: ids }),

  toggleNewSpell: (id) => {
    const { newSpellIds } = get()
    if (newSpellIds.includes(id)) {
      set({ newSpellIds: newSpellIds.filter((s) => s !== id) })
    } else {
      set({ newSpellIds: [...newSpellIds, id] })
    }
  },

  applyLevelUp: async () => {
    const {
      character,
      currentLevel,
      targetLevel,
      hpChoices,
      hpRolls,
      asiSelections,
      newSpellIds,
      epicBoonSelection,
      classLevelChoices,
      generalFeatSelections,
      fightingStyleSelection,
      primalOrderSelection,
      divineOrderSelection,
      elementalFurySelection,
      invocationSelections,
      metamagicSelections,
      blessedWarriorCantrips,
      druidicWarriorCantrips,
      expertiseSelections
    } = get()
    if (!character) throw new Error('No character to level up')

    return apply5eLevelUp(
      character as Character5e,
      currentLevel,
      targetLevel,
      hpChoices,
      hpRolls,
      asiSelections,
      newSpellIds,
      epicBoonSelection,
      classLevelChoices,
      generalFeatSelections,
      fightingStyleSelection,
      primalOrderSelection,
      divineOrderSelection,
      elementalFurySelection,
      invocationSelections,
      metamagicSelections,
      blessedWarriorCantrips,
      druidicWarriorCantrips,
      expertiseSelections
    )
  },

  reset: () => set(initialState)
}))

async function apply5eLevelUp(
  character: Character5e,
  currentLevel: number,
  targetLevel: number,
  hpChoices: Record<number, HpChoice>,
  hpRolls: Record<number, number>,
  asiSelections: Record<string, AbilityName[]>,
  newSpellIds: string[],
  epicBoonSelection: { id: string; name: string; description: string } | null,
  classLevelChoices: Record<number, string>,
  generalFeatSelections: Record<
    string,
    { id: string; name: string; description: string; choices?: Record<string, string | string[]> }
  >,
  fightingStyleSelection: { id: string; name: string; description: string } | null,
  primalOrderSelection: 'magician' | 'warden' | null,
  divineOrderSelection: 'protector' | 'thaumaturge' | null,
  elementalFurySelection: 'potent-spellcasting' | 'primal-strike' | null,
  invocationSelections: string[],
  metamagicSelections: string[],
  blessedWarriorCantrips: string[],
  druidicWarriorCantrips: string[],
  expertiseSelections: Record<string, string[]>
): Promise<Character5e> {
  // Load class data for hit dice and names
  const classDataMap: Record<
    string,
    { name: string; hitDie: number; multiclassProficiencies?: { armor: string[]; weapons: string[]; tools: string[] } }
  > = {}
  try {
    const classes: Array<{
      id: string
      name: string
      hitDie: number
      multiclassProficiencies?: { armor: string[]; weapons: string[]; tools: string[] }
    }> = await loadJson('./data/5e/classes.json')
    for (const cls of classes) {
      classDataMap[cls.id] = {
        name: cls.name,
        hitDie: cls.hitDie,
        multiclassProficiencies: cls.multiclassProficiencies
      }
    }
  } catch {
    /* ignore */
  }

  const primaryClassId = character.buildChoices.classId
  const defaultHitDie = character.classes[0]?.hitDie ?? 8

  // 1. Process ASI first to update ability scores
  const updatedScores: AbilityScoreSet = { ...character.abilityScores }
  const oldConMod = abilityModifier(character.abilityScores.constitution)

  for (const [slotId, abilities] of Object.entries(asiSelections)) {
    // Skip ASI slots that have a general feat selection instead
    if (generalFeatSelections[slotId]) continue
    for (const ability of abilities) {
      updatedScores[ability] = Math.min(20, updatedScores[ability] + 1)
    }
  }

  const newConMod = abilityModifier(updatedScores.constitution)

  // 2. Calculate HP gain per new level (using correct hit die per class)
  let hpGain = 0
  for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
    const levelClassId = classLevelChoices[lvl] ?? primaryClassId
    const hitDie = classDataMap[levelClassId]?.hitDie ?? defaultHitDie

    let dieResult: number
    if (hpChoices[lvl] === 'roll' && hpRolls[lvl] !== undefined) {
      dieResult = hpRolls[lvl]
    } else {
      dieResult = Math.floor(hitDie / 2) + 1
    }
    hpGain += Math.max(1, dieResult + newConMod)
  }

  // 3. Retroactive CON bonus if CON changed (applies to existing levels only)
  const retroactiveBonus = (newConMod - oldConMod) * currentLevel

  // 3b. HP bonus from species traits (Dwarven Toughness) and feats (Tough)
  // Calculate delta between old and new level bonuses
  const existingFeats = character.feats ?? []
  // Check if Tough feat was newly selected during this level-up (as a general feat)
  const newToughSelected = Object.values(generalFeatSelections).some((f) => f.id === 'tough')
  const featsForHP =
    newToughSelected && !existingFeats.some((f) => f.id === 'tough')
      ? [...existingFeats, { id: 'tough' }]
      : existingFeats
  // Compute Draconic Sorcerer level for Draconic Resilience HP bonus
  const isDraconicSorcerer = character.classes.some(
    (c) => c.name.toLowerCase() === 'sorcerer' && c.subclass?.toLowerCase().replace(/\s+/g, '-') === 'draconic-sorcery'
  )
  const oldSorcererLevel = isDraconicSorcerer
    ? (character.classes.find((c) => c.name.toLowerCase() === 'sorcerer')?.level ?? 0)
    : 0
  let newSorcererLevels = 0
  if (isDraconicSorcerer) {
    for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
      if ((classLevelChoices[lvl] ?? primaryClassId) === 'sorcerer') newSorcererLevels++
    }
  }
  const newSorcererLevel = oldSorcererLevel + newSorcererLevels

  const oldTraitBonus = calculateHPBonusFromTraits(
    currentLevel,
    character.buildChoices.speciesId,
    existingFeats,
    isDraconicSorcerer ? oldSorcererLevel : undefined
  )
  const newTraitBonus = calculateHPBonusFromTraits(
    targetLevel,
    character.buildChoices.speciesId,
    featsForHP,
    isDraconicSorcerer ? newSorcererLevel : undefined
  )
  const traitBonusDelta = newTraitBonus - oldTraitBonus

  // 4. Calculate new HP
  const newMaxHP = character.hitPoints.maximum + hpGain + retroactiveBonus + traitBonusDelta
  const damageTaken = character.hitPoints.maximum - character.hitPoints.current
  const newCurrentHP = Math.max(1, newMaxHP - damageTaken)

  // 5. Update classes array
  const updatedClasses = character.classes.map((c) => ({ ...c }))
  const newClassesAdded: string[] = []

  for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
    const levelClassId = classLevelChoices[lvl] ?? primaryClassId
    const existingIdx = updatedClasses.findIndex((c) => c.name.toLowerCase() === levelClassId)
    if (existingIdx >= 0) {
      updatedClasses[existingIdx] = { ...updatedClasses[existingIdx], level: updatedClasses[existingIdx].level + 1 }
    } else {
      // New class entry
      const classInfo = classDataMap[levelClassId]
      updatedClasses.push({
        name: classInfo?.name ?? levelClassId,
        level: 1,
        hitDie: classInfo?.hitDie ?? 8
      })
      newClassesAdded.push(levelClassId)
    }
  }

  // 6. Load class features for new levels (class-level aware)
  const allNewFeatures: Array<{ level: number; name: string; description: string; source: string }> = []
  try {
    const cfData = await loadJson<ClassFeaturesFile>('./data/5e/class-features.json')

    // Track class levels as we iterate
    const classLvlTracker: Record<string, number> = {}
    for (const cls of character.classes) {
      classLvlTracker[cls.name.toLowerCase()] = cls.level
    }

    for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
      const levelClassId = classLevelChoices[lvl] ?? primaryClassId
      classLvlTracker[levelClassId] = (classLvlTracker[levelClassId] ?? 0) + 1
      const classLevel = classLvlTracker[levelClassId]

      const classCF = cfData[levelClassId]
      if (classCF) {
        const levelFeatures = classCF.features.filter((f) => f.level === classLevel)
        allNewFeatures.push(
          ...levelFeatures.map((f) => ({
            level: lvl,
            name: f.name,
            description: f.description,
            source: classDataMap[levelClassId]?.name ?? levelClassId
          }))
        )
      }
    }
  } catch {
    /* ignore */
  }

  // 7. Load new spells
  const newSpells: SpellEntry[] = []
  if (newSpellIds.length > 0) {
    try {
      const spellData: Array<{
        id: string
        name: string
        level: number
        school?: string
        castingTime?: string
        castTime?: string
        range?: string
        duration?: string
        description: string
        concentration?: boolean
        ritual?: boolean
        components?: string
        classes?: string[]
      }> = await loadJson('./data/5e/spells.json')

      for (const id of newSpellIds) {
        const raw = spellData.find((s) => s.id === id)
        if (raw && !character.knownSpells.some((ks) => ks.id === raw.id)) {
          newSpells.push({
            id: raw.id,
            name: raw.name,
            level: raw.level,
            description: raw.description,
            castingTime: raw.castingTime || raw.castTime || '',
            range: raw.range || '',
            duration: raw.duration || '',
            components: typeof raw.components === 'string' ? raw.components : '',
            school: raw.school,
            concentration: raw.concentration,
            ritual: raw.ritual,
            classes: raw.classes
          })
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 7b. Add Blessed Warrior cantrips if fighting style was selected
  if (fightingStyleSelection?.id === 'fighting-style-blessed-warrior' && blessedWarriorCantrips.length > 0) {
    try {
      const spellData: Array<{
        id: string
        name: string
        level: number
        school?: string
        castingTime?: string
        castTime?: string
        range?: string
        duration?: string
        description: string
        concentration?: boolean
        ritual?: boolean
        components?: string
        classes?: string[]
      }> = await loadJson('./data/5e/spells.json')
      for (const cantripId of blessedWarriorCantrips) {
        if (!character.knownSpells.some((ks) => ks.id === cantripId) && !newSpells.some((ns) => ns.id === cantripId)) {
          const raw = spellData.find((s) => s.id === cantripId)
          if (raw) {
            newSpells.push({
              id: raw.id,
              name: raw.name,
              level: raw.level,
              description: raw.description,
              castingTime: raw.castingTime || raw.castTime || '',
              range: raw.range || '',
              duration: raw.duration || '',
              components: typeof raw.components === 'string' ? raw.components : '',
              school: raw.school,
              concentration: raw.concentration,
              ritual: raw.ritual,
              classes: raw.classes,
              source: 'feat'
            })
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 7b2. Add Druidic Warrior cantrips if fighting style was selected (Ranger)
  if (fightingStyleSelection?.id === 'druidic-warrior' && druidicWarriorCantrips.length > 0) {
    try {
      const spellData: Array<{
        id: string
        name: string
        level: number
        school?: string
        castingTime?: string
        castTime?: string
        range?: string
        duration?: string
        description: string
        concentration?: boolean
        ritual?: boolean
        components?: string
        classes?: string[]
      }> = await loadJson('./data/5e/spells.json')
      for (const cantripId of druidicWarriorCantrips) {
        if (!character.knownSpells.some((ks) => ks.id === cantripId) && !newSpells.some((ns) => ns.id === cantripId)) {
          const raw = spellData.find((s) => s.id === cantripId)
          if (raw) {
            newSpells.push({
              id: raw.id,
              name: raw.name,
              level: raw.level,
              description: raw.description,
              castingTime: raw.castingTime || raw.castTime || '',
              range: raw.range || '',
              duration: raw.duration || '',
              components: typeof raw.components === 'string' ? raw.components : '',
              school: raw.school,
              concentration: raw.concentration,
              ritual: raw.ritual,
              classes: raw.classes,
              source: 'feat'
            })
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 7c. Inject species spell progression (level 3/5 spells from subrace)
  if (character.buildChoices.subspeciesId) {
    try {
      const speciesDataArr = await load5eSpecies()
      const speciesData = speciesDataArr.find((s) => s.id === character.buildChoices.speciesId)
      if (speciesData?.subraces) {
        const subrace = speciesData.subraces.find((sr) => sr.id === character.buildChoices.subspeciesId)
        if (subrace?.spellProgression) {
          const progressionSpells = getSpeciesSpellProgression(subrace.spellProgression, targetLevel, speciesData.name)
          for (const spell of progressionSpells) {
            // Only add spells not already known
            if (
              !character.knownSpells.some((ks) => ks.id === spell.id) &&
              !newSpells.some((ns) => ns.id === spell.id)
            ) {
              newSpells.push(spell)
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 7c. Add subclass always-prepared spells
  const primarySubclassId = character.classes[0]?.subclass?.toLowerCase().replace(/\s+/g, '-') ?? ''
  if (primarySubclassId) {
    try {
      const subclasses = await load5eSubclasses()
      const sc = subclasses.find((s) => s.id === primarySubclassId)
      if (sc?.alwaysPreparedSpells) {
        const spellData: Array<{
          id: string
          name: string
          level: number
          school?: string
          castingTime?: string
          castTime?: string
          range?: string
          duration?: string
          description: string
          concentration?: boolean
          ritual?: boolean
          components?: string
          classes?: string[]
        }> = await loadJson('./data/5e/spells.json')
        for (const [lvlStr, spellNames] of Object.entries(sc.alwaysPreparedSpells)) {
          if (targetLevel >= Number(lvlStr)) {
            for (const name of spellNames) {
              if (
                !character.knownSpells.some((ks) => ks.name.toLowerCase() === name.toLowerCase()) &&
                !newSpells.some((ns) => ns.name.toLowerCase() === name.toLowerCase())
              ) {
                const raw = spellData.find((s) => s.name.toLowerCase() === name.toLowerCase())
                if (raw) {
                  newSpells.push({
                    id: raw.id,
                    name: raw.name,
                    level: raw.level,
                    description: raw.description,
                    castingTime: raw.castingTime || raw.castTime || '',
                    range: raw.range || '',
                    duration: raw.duration || '',
                    components: typeof raw.components === 'string' ? raw.components : '',
                    school: raw.school,
                    concentration: raw.concentration,
                    ritual: raw.ritual,
                    classes: raw.classes,
                    prepared: true
                  })
                }
              }
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 8. Update spell slot progression (multiclass-aware)
  const classesForSlots = updatedClasses.map((c) => ({
    classId: c.name.toLowerCase(),
    subclassId: c.subclass?.toLowerCase(),
    level: c.level
  }))

  const useMulticlassTable = isMulticlassSpellcaster(classesForSlots)
  let newSlotProg: Record<number, number>
  if (useMulticlassTable) {
    newSlotProg = getMulticlassSpellSlots(classesForSlots)
  } else {
    // Single spellcasting class: find the caster and use its progression
    const casterClass = updatedClasses.find((c) => {
      const id = c.name.toLowerCase()
      return [...FULL_CASTERS_5E, ...HALF_CASTERS_5E].includes(id)
    })
    if (casterClass) {
      newSlotProg = getSlotProgression(casterClass.name.toLowerCase(), casterClass.level)
    } else {
      newSlotProg = {}
    }
  }

  // Handle Warlock Pact Magic slots (separate from regular spell slots)
  const warlockPactSlots = getWarlockPactSlots(classesForSlots)

  // Merge pact magic into slot progression for single-class warlock
  // For multiclass, pact slots are stored separately and shown alongside regular slots
  const hasNonWarlockCasting = classesForSlots.some(
    (c) => c.classId !== 'warlock' && (FULL_CASTERS_5E.includes(c.classId) || HALF_CASTERS_5E.includes(c.classId))
  )

  if (Object.keys(warlockPactSlots).length > 0 && !hasNonWarlockCasting) {
    // Pure warlock (possibly multiclass with non-casters): use pact magic as the only slots
    newSlotProg = warlockPactSlots
  }
  // If hasNonWarlockCasting && warlock: pact slots are stored in pactMagicSlotLevels on character

  const updatedSlotLevels: Record<number, { current: number; max: number }> = {}
  for (const [lvlStr, max] of Object.entries(newSlotProg)) {
    const lvl = Number(lvlStr)
    const existing = character.spellSlotLevels?.[lvl]
    if (existing) {
      const gained = max - existing.max
      updatedSlotLevels[lvl] = { current: existing.current + Math.max(0, gained), max }
    } else {
      updatedSlotLevels[lvl] = { current: max, max }
    }
  }

  // Build pact magic slot levels for multiclass warlock + other casters
  let updatedPactSlotLevels: Record<number, { current: number; max: number }> | undefined
  if (hasNonWarlockCasting && Object.keys(warlockPactSlots).length > 0) {
    updatedPactSlotLevels = {}
    for (const [lvlStr, max] of Object.entries(warlockPactSlots)) {
      const lvl = Number(lvlStr)
      const existing = character.pactMagicSlotLevels?.[lvl]
      if (existing) {
        const gained = max - existing.max
        updatedPactSlotLevels[lvl] = { current: existing.current + Math.max(0, gained), max }
      } else {
        updatedPactSlotLevels[lvl] = { current: max, max }
      }
    }
  }

  // 9. Merge ASI choices into existing buildChoices
  const existingAsi = character.buildChoices.asiChoices ?? {}
  const mergedAsi = { ...existingAsi }
  for (const [slotId, abilities] of Object.entries(asiSelections)) {
    mergedAsi[slotId] = abilities
  }

  // 10. Update class features
  const mergedClassFeatures = [
    ...(character.classFeatures ?? []),
    ...allNewFeatures.map((f) => ({
      level: f.level,
      name: f.name,
      source: f.source,
      description: f.description
    }))
  ]

  // 11. Add Epic Boon feat, general feats, and fighting style if selected
  const updatedFeats = [...(character.feats ?? [])]
  if (epicBoonSelection) {
    updatedFeats.push(epicBoonSelection)
  }
  for (const feat of Object.values(generalFeatSelections)) {
    updatedFeats.push(feat)
  }
  if (fightingStyleSelection) {
    updatedFeats.push(fightingStyleSelection)
  }

  // 12. Add multiclass proficiencies for newly added classes
  let updatedProficiencies = { ...character.proficiencies }
  for (const newClassId of newClassesAdded) {
    const mcProfs = classDataMap[newClassId]?.multiclassProficiencies
    if (mcProfs) {
      updatedProficiencies = {
        ...updatedProficiencies,
        armor: [...new Set([...updatedProficiencies.armor, ...mcProfs.armor])],
        weapons: [...new Set([...updatedProficiencies.weapons, ...mcProfs.weapons])],
        tools: [...new Set([...updatedProficiencies.tools, ...mcProfs.tools])]
      }
    }
  }

  // 12b. Apply Primal Order proficiency bonuses (multiclass into Druid)
  if (primalOrderSelection === 'warden') {
    updatedProficiencies = {
      ...updatedProficiencies,
      armor: [...new Set([...updatedProficiencies.armor, 'Medium armor'])],
      weapons: [...new Set([...updatedProficiencies.weapons, 'Martial weapons'])]
    }
  }

  // 12b2. Apply Divine Order proficiency bonuses (multiclass into Cleric)
  if (divineOrderSelection === 'protector') {
    updatedProficiencies = {
      ...updatedProficiencies,
      armor: [...new Set([...updatedProficiencies.armor, 'Heavy armor'])],
      weapons: [...new Set([...updatedProficiencies.weapons, 'Martial weapons'])]
    }
  }

  // 12c. Auto-grant Druidic language if leveling into Druid
  let updatedLanguages = [...updatedProficiencies.languages]
  const isDruidMulticlass = newClassesAdded.includes('druid')
  if (isDruidMulticlass && !updatedLanguages.includes('Druidic')) {
    updatedLanguages = [...updatedLanguages, 'Druidic']
    updatedProficiencies = { ...updatedProficiencies, languages: updatedLanguages }
  }

  // 12d. Recalculate Wild Shape uses based on new Druid class level
  const druidClass = updatedClasses.find((c) => c.name.toLowerCase() === 'druid')
  const newWildShapeMax = druidClass ? getWildShapeMax(druidClass.level) : 0
  const updatedWildShapeUses =
    newWildShapeMax > 0
      ? {
          current: Math.min(
            newWildShapeMax,
            (character.wildShapeUses?.current ?? 0) + Math.max(0, newWildShapeMax - (character.wildShapeUses?.max ?? 0))
          ),
          max: newWildShapeMax
        }
      : character.wildShapeUses

  // 12e. Ensure Speak with Animals is always prepared for Druids, Hunter's Mark for Rangers
  const updatedKnownSpells = [...character.knownSpells, ...newSpells]
  const rangerClass = updatedClasses.find((c) => c.name.toLowerCase() === 'ranger')
  const alwaysPreparedClassSpells: Array<{ className: string; spellName: string; classRef: unknown }> = [
    { className: 'druid', spellName: 'Speak with Animals', classRef: druidClass },
    { className: 'ranger', spellName: "Hunter's Mark", classRef: rangerClass }
  ]
  for (const { spellName, classRef } of alwaysPreparedClassSpells) {
    if (classRef && !updatedKnownSpells.some((s) => s.name === spellName)) {
      try {
        const spellData: Array<{
          id: string
          name: string
          level: number
          school?: string
          castingTime?: string
          castTime?: string
          range?: string
          duration?: string
          description: string
          concentration?: boolean
          ritual?: boolean
          components?: string
          classes?: string[]
        }> = await loadJson('./data/5e/spells.json')
        const found = spellData.find((s) => s.name === spellName)
        if (found) {
          updatedKnownSpells.push({
            id: found.id,
            name: found.name,
            level: found.level,
            description: found.description,
            castingTime: found.castingTime || found.castTime || '',
            range: found.range || '',
            duration: found.duration || '',
            components: typeof found.components === 'string' ? found.components : '',
            school: found.school,
            concentration: found.concentration,
            ritual: found.ritual,
            classes: found.classes,
            prepared: true,
            source: 'class'
          })
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 13. Track multiclass entries in buildChoices
  const multiclassEntries: MulticlassEntry[] = [...(character.buildChoices.multiclassEntries ?? [])]
  for (let lvl = currentLevel + 1; lvl <= targetLevel; lvl++) {
    const levelClassId = classLevelChoices[lvl] ?? primaryClassId
    if (levelClassId !== primaryClassId) {
      multiclassEntries.push({ classId: levelClassId, levelTaken: lvl })
    }
  }

  // 14. Recompute spellcasting info with updated scores and level
  const spellcastingClasses = updatedClasses.map((c) => ({
    classId: c.name.toLowerCase(),
    subclassId: c.subclass?.toLowerCase(),
    level: c.level
  }))
  const spellcastingInfo = computeSpellcastingInfo(
    spellcastingClasses,
    updatedScores,
    targetLevel,
    character.buildChoices.classId,
    character.buildChoices.subclassId
  )

  // 15. Apply expertise selections to skills
  const updatedSkills = character.skills.map((s) => ({ ...s }))
  const mergedExpertiseChoices = { ...(character.buildChoices.expertiseChoices ?? {}) }
  for (const [slotId, skillNames] of Object.entries(expertiseSelections)) {
    mergedExpertiseChoices[slotId] = skillNames
    for (const skillName of skillNames) {
      const skill = updatedSkills.find((s) => s.name === skillName)
      if (skill) skill.expertise = true
    }
  }

  const updated: Character5e = {
    ...character,
    level: targetLevel,
    classes: updatedClasses,
    abilityScores: updatedScores,
    hitPoints: {
      current: newCurrentHP,
      maximum: newMaxHP,
      temporary: character.hitPoints.temporary
    },
    hitDice: (() => {
      const levelsGained = targetLevel - currentLevel
      const classIdx = character.hitDice.findIndex(
        (hd) => hd.dieType === (updatedClasses.find((c) => c.name.toLowerCase() === primaryClassId)?.hitDie ?? 8)
      )
      if (classIdx >= 0) {
        return character.hitDice.map((hd, i) =>
          i === classIdx
            ? { ...hd, current: hd.current + levelsGained, maximum: hd.maximum + levelsGained }
            : hd
        )
      }
      const newDie = updatedClasses.find((c) => c.name.toLowerCase() === primaryClassId)?.hitDie ?? 8
      return [...character.hitDice, { current: levelsGained, maximum: levelsGained, dieType: newDie }]
    })(),
    proficiencies: updatedProficiencies,
    spellcasting: spellcastingInfo,
    knownSpells: updatedKnownSpells,
    spellSlotLevels: updatedSlotLevels,
    ...(updatedPactSlotLevels ? { pactMagicSlotLevels: updatedPactSlotLevels } : {}),
    classFeatures: mergedClassFeatures,
    feats: updatedFeats,
    wildShapeUses: updatedWildShapeUses,
    classResources: (() => {
      // Recompute class resources for the primary class at new level
      const wisMod = Math.floor((updatedScores.wisdom - 10) / 2)
      const newResources = getClassResources(
        primaryClassId,
        updatedClasses.find((c) => c.name.toLowerCase() === primaryClassId)?.level ?? targetLevel,
        wisMod
      )
      if (newResources.length === 0) return character.classResources
      const oldResources = character.classResources ?? []
      return newResources.map((nr) => {
        const old = oldResources.find((or) => or.id === nr.id)
        if (old && old.max === nr.max) {
          // Max didn't change, preserve current uses
          return { ...nr, current: old.current }
        }
        if (old) {
          // Max changed, grant the difference
          const gained = nr.max - old.max
          return { ...nr, current: Math.min(nr.max, old.current + Math.max(0, gained)) }
        }
        // New resource
        return nr
      })
    })(),
    speciesResources: (() => {
      const newResources = getSpeciesResources(
        character.buildChoices.speciesId,
        character.buildChoices.subspeciesId,
        targetLevel
      )
      if (newResources.length === 0) return character.speciesResources
      const oldResources = character.speciesResources ?? []
      return newResources.map((nr) => {
        const old = oldResources.find((or) => or.id === nr.id)
        if (old && old.max === nr.max) {
          return { ...nr, current: old.current }
        }
        if (old) {
          const gained = nr.max - old.max
          return { ...nr, current: Math.min(nr.max, old.current + Math.max(0, gained)) }
        }
        return nr
      })
    })(),
    buildChoices: {
      ...character.buildChoices,
      asiChoices: Object.keys(mergedAsi).length > 0 ? mergedAsi : undefined,
      multiclassEntries: multiclassEntries.length > 0 ? multiclassEntries : undefined,
      ...(epicBoonSelection ? { epicBoonId: epicBoonSelection.id } : {}),
      ...(Object.keys(generalFeatSelections).length > 0
        ? {
            generalFeatChoices: Object.fromEntries(
              Object.entries(generalFeatSelections).map(([slotId, feat]) => [slotId, feat.id])
            )
          }
        : {}),
      ...(fightingStyleSelection ? { fightingStyleId: fightingStyleSelection.id } : {}),
      ...(blessedWarriorCantrips.length > 0 ? { blessedWarriorCantrips } : {}),
      ...(druidicWarriorCantrips.length > 0 ? { druidicWarriorCantrips } : {}),
      ...(primalOrderSelection ? { primalOrderChoice: primalOrderSelection } : {}),
      ...(divineOrderSelection ? { divineOrderChoice: divineOrderSelection } : {}),
      ...(elementalFurySelection ? { elementalFuryChoice: elementalFurySelection } : {}),
      ...(Object.keys(mergedExpertiseChoices).length > 0 ? { expertiseChoices: mergedExpertiseChoices } : {})
    },
    skills: updatedSkills,
    invocationsKnown: invocationSelections.length > 0 ? invocationSelections : undefined,
    metamagicKnown: metamagicSelections.length > 0 ? metamagicSelections : undefined,
    // Roving (Ranger L6+): +10 walking speed, climb/swim = walking speed
    ...(() => {
      const rangerLevel = updatedClasses.find((c) => c.name.toLowerCase() === 'ranger')?.level ?? 0
      if (rangerLevel >= 6) {
        const baseSpeed = character.speed
        // Only add the Roving bonus if character didn't already have it
        const prevRangerLevel = character.classes.find((c) => c.name.toLowerCase() === 'ranger')?.level ?? 0
        const newSpeed = prevRangerLevel < 6 ? baseSpeed + 10 : baseSpeed
        return {
          speed: newSpeed,
          speeds: { ...(character.speeds ?? { swim: 0, fly: 0, climb: 0, burrow: 0 }), climb: newSpeed, swim: newSpeed }
        }
      }
      return {}
    })(),
    updatedAt: new Date().toISOString()
  }

  return updated
}
