import type { GameSystem } from './game-system'
import type { BuildSlot, SelectableOption, Rarity } from './character-common'

export type BuilderPhase = 'system-select' | 'building' | 'complete'

export type ContentTab = 'skills' | 'feats' | 'gear' | 'spells' | 'details' | 'defense' | 'offense'

export interface SelectionModalState {
  slotId: string
  title: string
  options: SelectableOption[]
  filteredOptions: SelectableOption[]
  rarityFilter: Rarity | 'all'
  searchQuery: string
  previewOptionId: string | null
  selectedOptionId: string | null
}

export function filterOptions(
  options: SelectableOption[],
  rarityFilter: Rarity | 'all',
  searchQuery: string
): SelectableOption[] {
  return options.filter((opt) => {
    const matchesRarity = rarityFilter === 'all' || opt.rarity === rarityFilter
    const matchesSearch =
      searchQuery === '' ||
      opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRarity && matchesSearch
  })
}
