import { create } from 'zustand'
import type { BuilderState } from './types'
import { createCoreSlice } from './slices/core-slice'
import { createAbilityScoreSlice } from './slices/ability-score-slice'
import { createSelectionSlice } from './slices/selection-slice'
import { createCharacterDetailsSlice } from './slices/character-details-slice'
import { createBuildActionsSlice } from './slices/build-actions-slice'
import { createSaveSlice } from './slices/save-slice'

export const useBuilderStore = create<BuilderState>()((...a) => ({
  ...createCoreSlice(...a),
  ...createAbilityScoreSlice(...a),
  ...createSelectionSlice(...a),
  ...createCharacterDetailsSlice(...a),
  ...createBuildActionsSlice(...a),
  ...createSaveSlice(...a)
}))

// Re-export types and constants so existing imports work
export type { BuilderState } from './types'
export type { AbilityScoreMethod } from './types'
export {
  POINT_BUY_COSTS,
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  PRESET_ICONS,
  FOUNDATION_SLOT_ORDER,
  DEFAULT_SCORES,
  POINT_BUY_START,
  roll4d6DropLowest,
  pointBuyTotal
} from './types'
