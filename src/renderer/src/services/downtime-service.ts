/**
 * Downtime activity service — PHB 2024 Ch.8 / DMG 2024 Ch.7
 * Manages between-adventure activities: crafting, training, recuperating, etc.
 */

import { load5eDowntime } from './data-provider'

export interface DowntimeActivity {
  id: string
  name: string
  description: string
  daysRequired: number
  goldCostPerDay: number
  requirements: string[]
  outcome: string
  reference: string
  rarityTable?: Array<{ rarity: string; days: number; goldCost: number; minLevel: number }>
  spellLevelTable?: Array<{ level: number; days: number; goldCost: number }>
  potionTable?: Array<{ type: string; days: number; goldCost: number; heals: string }>
}

export interface DowntimeProgress {
  activityId: string
  characterId: string
  characterName: string
  daysSpent: number
  daysRequired: number
  goldSpent: number
  goldRequired: number
  startedAt: string
  details?: string
}

let cachedActivities: DowntimeActivity[] | null = null

export async function loadDowntimeActivities(): Promise<DowntimeActivity[]> {
  if (cachedActivities) return cachedActivities
  const data = await load5eDowntime()
  cachedActivities = data as unknown as DowntimeActivity[]
  return cachedActivities
}

/**
 * Calculate the gold cost for a downtime activity.
 */
export function calculateDowntimeCost(
  activity: DowntimeActivity,
  days: number,
  option?: { rarity?: string; spellLevel?: number; potionType?: string }
): { days: number; goldCost: number } {
  // Magic item crafting uses rarity table
  if (activity.rarityTable && option?.rarity) {
    const entry = activity.rarityTable.find((r) => r.rarity === option.rarity)
    if (entry) return { days: entry.days, goldCost: entry.goldCost }
  }

  // Spell scroll uses spell level table
  if (activity.spellLevelTable && option?.spellLevel !== undefined) {
    const entry = activity.spellLevelTable.find((r) => r.level === option.spellLevel)
    if (entry) return { days: entry.days, goldCost: entry.goldCost }
  }

  // Potion brewing uses potion table
  if (activity.potionTable && option?.potionType) {
    const entry = activity.potionTable.find((r) => r.type === option.potionType)
    if (entry) return { days: entry.days, goldCost: entry.goldCost }
  }

  // Standard per-day activities
  return {
    days,
    goldCost: activity.goldCostPerDay * days
  }
}

/**
 * Create a new downtime progress tracker.
 */
export function startDowntime(
  activity: DowntimeActivity,
  characterId: string,
  characterName: string,
  daysRequired: number,
  goldRequired: number,
  details?: string
): DowntimeProgress {
  return {
    activityId: activity.id,
    characterId,
    characterName,
    daysSpent: 0,
    daysRequired,
    goldSpent: 0,
    goldRequired,
    startedAt: new Date().toISOString(),
    details
  }
}

/**
 * Advance a downtime activity by one or more days.
 * Returns updated progress and whether the activity is complete.
 */
export function advanceDowntime(
  progress: DowntimeProgress,
  days: number
): { progress: DowntimeProgress; complete: boolean; goldPerDay: number } {
  const goldPerDay = progress.goldRequired > 0 ? progress.goldRequired / progress.daysRequired : 0
  const goldForDays = goldPerDay * days
  const newDaysSpent = Math.min(progress.daysRequired, progress.daysSpent + days)
  const newGoldSpent = Math.min(progress.goldRequired, progress.goldSpent + goldForDays)

  return {
    progress: {
      ...progress,
      daysSpent: newDaysSpent,
      goldSpent: newGoldSpent
    },
    complete: newDaysSpent >= progress.daysRequired,
    goldPerDay
  }
}
