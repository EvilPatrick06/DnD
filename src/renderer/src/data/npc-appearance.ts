import { load5eNpcAppearance } from '../services/data-provider'

export const NPC_HEIGHTS: readonly string[] = []
export const NPC_BUILDS: readonly string[] = []
export const NPC_HAIR_COLORS: readonly string[] = []
export const NPC_HAIR_STYLES: readonly string[] = []
export const NPC_DISTINGUISHING_FEATURES: readonly string[] = []
export const NPC_CLOTHING_STYLES: readonly string[] = []

load5eNpcAppearance()
  .then((data) => {
    ;(NPC_HEIGHTS as string[]).push(...(data.heights ?? []))
    ;(NPC_BUILDS as string[]).push(...(data.builds ?? []))
    ;(NPC_HAIR_COLORS as string[]).push(...(data.hairColors ?? []))
    ;(NPC_HAIR_STYLES as string[]).push(...(data.hairStyles ?? []))
    ;(NPC_DISTINGUISHING_FEATURES as string[]).push(...(data.distinguishingFeatures ?? []))
    ;(NPC_CLOTHING_STYLES as string[]).push(...(data.clothingStyles ?? []))
  })
  .catch(() => {})
