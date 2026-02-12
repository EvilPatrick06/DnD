import type { GameSystem } from '../../types/game-system'
import type { BuildSlot, Rarity, AbilityScoreSet, AbilityName } from '../../types/character-common'
import { ABILITY_NAMES } from '../../types/character-common'
import type { BuilderPhase, ContentTab, SelectionModalState } from '../../types/builder'
import type { Character5e } from '../../types/character-5e'
import type { CharacterPf2e } from '../../types/character-pf2e'
import type { Character } from '../../types/character'

// --- Constants ---

export const FOUNDATION_SLOT_ORDER = [
  'ancestry',
  'heritage',
  'background',
  'class',
  'ability-scores',
  'skill-choices'
]

export type AbilityScoreMethod = 'standard' | 'pointBuy' | 'roll' | 'custom'

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
}
export const POINT_BUY_BUDGET = 27

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

export const PRESET_ICONS = [
  { id: 'sword', label: 'Sword', emoji: '\u2694\uFE0F' },
  { id: 'shield', label: 'Shield', emoji: '\uD83D\uDEE1\uFE0F' },
  { id: 'bow', label: 'Bow', emoji: '\uD83C\uDFF9' },
  { id: 'staff', label: 'Staff', emoji: '\uD83E\uDE84' },
  { id: 'skull', label: 'Skull', emoji: '\uD83D\uDC80' },
  { id: 'crown', label: 'Crown', emoji: '\uD83D\uDC51' },
  { id: 'dragon', label: 'Dragon', emoji: '\uD83D\uDC09' },
  { id: 'fire', label: 'Fire', emoji: '\uD83D\uDD25' },
  { id: 'star', label: 'Star', emoji: '\u2B50' },
  { id: 'moon', label: 'Moon', emoji: '\uD83C\uDF19' },
  { id: 'gem', label: 'Gem', emoji: '\uD83D\uDC8E' },
  { id: 'wolf', label: 'Wolf', emoji: '\uD83D\uDC3A' },
  { id: 'eagle', label: 'Eagle', emoji: '\uD83E\uDD85' },
  { id: 'book', label: 'Book', emoji: '\uD83D\uDCD6' },
  { id: 'potion', label: 'Potion', emoji: '\uD83E\uDDEA' },
  { id: 'dagger', label: 'Dagger', emoji: '\uD83D\uDDE1\uFE0F' },
  { id: 'crystal', label: 'Crystal Ball', emoji: '\uD83D\uDD2E' },
  { id: 'helmet', label: 'Helmet', emoji: '\uD83E\uDE96' }
]

export const DEFAULT_SCORES: AbilityScoreSet = {
  strength: 15,
  dexterity: 14,
  constitution: 13,
  intelligence: 12,
  wisdom: 10,
  charisma: 8
}

export const POINT_BUY_START: AbilityScoreSet = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8
}

// --- Helper functions ---

export function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
  dice.sort((a, b) => a - b)
  return dice[1] + dice[2] + dice[3]
}

export function pointBuyTotal(scores: AbilityScoreSet): number {
  return ABILITY_NAMES.reduce((total, ab) => {
    const score = Math.max(8, Math.min(15, scores[ab]))
    return total + (POINT_BUY_COSTS[score] ?? 0)
  }, 0)
}

// --- State interface ---

export interface CoreSliceState {
  phase: BuilderPhase
  gameSystem: GameSystem | null
  buildSlots: BuildSlot[]
  activeTab: ContentTab
  targetLevel: number
  editingCharacterId: string | null

  selectGameSystem: (system: GameSystem) => void
  resetBuilder: () => void
  setTargetLevel: (level: number) => void
  setActiveTab: (tab: ContentTab) => void
}

export interface AbilityScoreSliceState {
  abilityScores: AbilityScoreSet
  abilityScoreMethod: AbilityScoreMethod
  standardArrayAssignments: Record<string, number | null>

  setAbilityScores: (scores: AbilityScoreSet) => void
  setAbilityScoreMethod: (method: AbilityScoreMethod) => void
  setStandardArrayAssignment: (ability: AbilityName, value: number | null) => void
  rollAbilityScores: () => void
  setActiveAsiSlot: (slotId: string | null) => void
  activeAsiSlotId: string | null
  asiSelections: Record<string, AbilityName[]>
  confirmAsi: (slotId: string, abilities: AbilityName[]) => void
  resetAsi: (slotId: string) => void
}

export interface SelectionSliceState {
  selectionModal: SelectionModalState | null

  openSelectionModal: (slotId: string) => Promise<void>
  closeSelectionModal: () => void
  setModalRarityFilter: (filter: Rarity | 'all') => void
  setModalSearchQuery: (query: string) => void
  setModalPreviewOption: (optionId: string | null) => void
  acceptSelection: (optionId: string) => void
}

export interface CharacterDetailsSliceState {
  characterName: string
  iconType: 'letter' | 'preset' | 'custom'
  iconPreset: string
  iconCustom: string
  characterGender: string
  characterDeity: string
  characterAge: string
  characterNotes: string
  heroPoints: number

  // Derived from selections
  raceLanguages: string[]
  raceExtraLangCount: number
  bgLanguageCount: number
  chosenLanguages: string[]
  raceSize: string
  raceSpeed: number
  raceTraits: Array<{ name: string; description: string }>
  raceProficiencies: string[]
  classEquipment: Array<{ name: string; quantity: number; source: string }>
  bgEquipment: Array<{ name: string; quantity: number; source: string }>
  currency: { pp: number; gp: number; sp: number; cp: number }
  pets: Array<{ name: string }>
  currentHP: number | null
  tempHP: number
  conditions: Array<{ name: string; type: 'condition' | 'buff'; isCustom: boolean }>
  classSkillOptions: string[]
  classMandatorySkills: string[]
  selectedSkills: string[]
  maxSkills: number
  customModal: 'ability-scores' | 'skills' | 'asi' | null
  pf2eAdditionalLanguages: string[]
  pf2eSpecialAbilities: Array<{ name: string; description: string }>
  pf2eAncestryHP: number
  pf2eClassHP: number
  pf2ePerceptionRank: string
  pf2eSaveRanks: { fortitude: string; reflex: string; will: string }
  pf2eKeyAbility: string | null
  pf2eUnarmoredRank: string
  pf2eClassFeatures: string[]
  speciesAbilityBonuses: Record<string, number>
  selectedSpellIds: string[]

  setCharacterName: (name: string) => void
  setSelectedSkills: (skills: string[]) => void
  setIconType: (type: 'letter' | 'preset' | 'custom') => void
  setIconPreset: (preset: string) => void
  setIconCustom: (dataUrl: string) => void
  setChosenLanguages: (languages: string[]) => void
  setCurrency: (currency: { pp: number; gp: number; sp: number; cp: number }) => void
  addPet: (name: string) => void
  removePet: (index: number) => void
  setCurrentHP: (hp: number | null) => void
  setTempHP: (hp: number) => void
  addCondition: (name: string, type: 'condition' | 'buff', isCustom: boolean) => void
  removeCondition: (index: number) => void
  removeEquipmentItem: (source: 'class' | 'bg', index: number) => void
  addEquipmentItem: (item: { name: string; quantity: number; source: string }) => void
  deductCurrency: (key: 'pp' | 'gp' | 'sp' | 'cp', amount: number) => void
  setSpeciesAbilityBonuses: (bonuses: Record<string, number>) => void
  setSelectedSpellIds: (ids: string[]) => void
  openCustomModal: (modal: 'ability-scores' | 'skills' | 'asi') => void
  closeCustomModal: () => void
}

export interface BuildActionsSliceState {
  advanceToNextSlot: () => void
  confirmAbilityScores: () => void
  confirmSkills: () => void
}

export interface SaveSliceState {
  loadCharacterForEdit: (character: Character) => void
  buildCharacter5e: () => Promise<Character5e>
  buildCharacterPf2e: () => Promise<CharacterPf2e>
}

export type BuilderState = CoreSliceState &
  AbilityScoreSliceState &
  SelectionSliceState &
  CharacterDetailsSliceState &
  BuildActionsSliceState &
  SaveSliceState
