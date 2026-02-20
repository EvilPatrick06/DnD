export const WEARABLE_ITEM_NAMES = new Set([
  'Robes',
  'Common Clothes',
  'Fine Clothes',
  "Traveler's Clothes",
  'Costume Clothes',
  'Cloak',
  'Ring',
  'Amulet',
  'Boots',
  'Bracers',
  'Belt',
  'Gloves',
  'Hat',
  'Necklace',
  'Vestments'
])

export function isWearableItem(name: string): boolean {
  const lower = name.toLowerCase()
  for (const wearable of WEARABLE_ITEM_NAMES) {
    if (lower.includes(wearable.toLowerCase())) return true
  }
  return false
}
