import { load5eWearableItems } from '../services/data-provider'

export const WEARABLE_ITEM_NAMES = new Set<string>()

load5eWearableItems().then((items) => {
  for (const item of items) {
    WEARABLE_ITEM_NAMES.add(item)
  }
}).catch(() => {})

export function isWearableItem(name: string): boolean {
  const lower = name.toLowerCase()
  for (const wearable of WEARABLE_ITEM_NAMES) {
    if (lower.includes(wearable.toLowerCase())) return true
  }
  return false
}
