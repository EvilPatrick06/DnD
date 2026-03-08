import type { LibraryCategory, LibraryItem } from '../types/library'

export type SortField = 'name' | 'cr' | 'level' | 'rarity' | 'cost' | 'weight' | 'type' | 'school'
export type SortDirection = 'asc' | 'desc'

export interface SortOption {
  field: SortField
  label: string
}

export interface FilterConfig {
  field: string
  label: string
  values: string[]
}

export interface LibrarySortFilterState {
  sortField: SortField
  sortDirection: SortDirection
  activeFilters: Record<string, string[]>
}

const RARITY_ORDER: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  'very rare': 4,
  legendary: 5,
  artifact: 6
}

function parseCR(cr: unknown): number {
  if (typeof cr === 'number') return cr
  if (typeof cr !== 'string') return 0
  if (cr.includes('/')) {
    const [n, d] = cr.split('/')
    return Number(n) / Number(d)
  }
  return Number(cr) || 0
}

function parseCost(cost: unknown): number {
  if (typeof cost === 'number') return cost
  if (typeof cost !== 'string') return 0
  const match = cost.match(/^([\d,]+)\s*(cp|sp|ep|gp|pp)$/i)
  if (!match) return 0
  const value = Number(match[1].replace(/,/g, ''))
  const multipliers: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }
  return value * (multipliers[match[2].toLowerCase()] ?? 1)
}

export function getSortOptions(category: LibraryCategory): SortOption[] {
  switch (category) {
    case 'monsters':
    case 'creatures':
    case 'npcs':
    case 'companions':
      return [
        { field: 'name', label: 'Name' },
        { field: 'cr', label: 'Challenge Rating' }
      ]
    case 'spells':
      return [
        { field: 'name', label: 'Name' },
        { field: 'level', label: 'Spell Level' },
        { field: 'school', label: 'School' }
      ]
    case 'weapons':
      return [
        { field: 'name', label: 'Name' },
        { field: 'cost', label: 'Cost' },
        { field: 'weight', label: 'Weight' }
      ]
    case 'armor':
      return [
        { field: 'name', label: 'Name' },
        { field: 'cost', label: 'Cost' }
      ]
    case 'magic-items':
      return [
        { field: 'name', label: 'Name' },
        { field: 'rarity', label: 'Rarity' }
      ]
    case 'feats':
      return [
        { field: 'name', label: 'Name' },
        { field: 'level', label: 'Level' }
      ]
    case 'gear':
    case 'tools':
      return [
        { field: 'name', label: 'Name' },
        { field: 'cost', label: 'Cost' },
        { field: 'weight', label: 'Weight' }
      ]
    default:
      return [{ field: 'name', label: 'Name' }]
  }
}

export function getFilterConfigs(category: LibraryCategory, items: LibraryItem[]): FilterConfig[] {
  const configs: FilterConfig[] = []

  // Source filter for all categories
  const sources = [...new Set(items.map((i) => i.source))].sort()
  if (sources.length > 1) {
    configs.push({ field: 'source', label: 'Source', values: sources })
  }

  switch (category) {
    case 'monsters':
    case 'creatures':
    case 'npcs': {
      const types = [...new Set(items.map((i) => (i.data.type as string) ?? '').filter(Boolean))].sort()
      if (types.length > 1) configs.push({ field: 'type', label: 'Type', values: types })
      const sizes = [...new Set(items.map((i) => (i.data.size as string) ?? '').filter(Boolean))].sort()
      if (sizes.length > 1) configs.push({ field: 'size', label: 'Size', values: sizes })
      break
    }
    case 'spells': {
      const schools = [...new Set(items.map((i) => (i.data.school as string) ?? '').filter(Boolean))].sort()
      if (schools.length > 1) configs.push({ field: 'school', label: 'School', values: schools })
      const levels = [...new Set(items.map((i) => String(i.data.level ?? '')).filter(Boolean))].sort(
        (a, b) => Number(a) - Number(b)
      )
      if (levels.length > 1) configs.push({ field: 'level', label: 'Level', values: levels })
      break
    }
    case 'weapons': {
      const cats = [...new Set(items.map((i) => (i.data.category as string) ?? '').filter(Boolean))].sort()
      if (cats.length > 1) configs.push({ field: 'category', label: 'Category', values: cats })
      const dmgTypes = [...new Set(items.map((i) => (i.data.damageType as string) ?? '').filter(Boolean))].sort()
      if (dmgTypes.length > 1) configs.push({ field: 'damageType', label: 'Damage Type', values: dmgTypes })
      break
    }
    case 'armor': {
      const cats = [...new Set(items.map((i) => (i.data.category as string) ?? '').filter(Boolean))].sort()
      if (cats.length > 1) configs.push({ field: 'category', label: 'Category', values: cats })
      break
    }
    case 'magic-items': {
      const rarities = [...new Set(items.map((i) => (i.data.rarity as string) ?? '').filter(Boolean))].sort(
        (a, b) => (RARITY_ORDER[a.toLowerCase()] ?? 0) - (RARITY_ORDER[b.toLowerCase()] ?? 0)
      )
      if (rarities.length > 1) configs.push({ field: 'rarity', label: 'Rarity', values: rarities })
      const types = [...new Set(items.map((i) => (i.data.type as string) ?? '').filter(Boolean))].sort()
      if (types.length > 1) configs.push({ field: 'type', label: 'Type', values: types })
      const attunement = [...new Set(items.map((i) => (i.data.attunement ? 'Yes' : 'No')))].sort()
      if (attunement.length > 1) configs.push({ field: 'attunement', label: 'Attunement', values: attunement })
      break
    }
    case 'feats': {
      const cats = [...new Set(items.map((i) => (i.data.category as string) ?? '').filter(Boolean))].sort()
      if (cats.length > 1) configs.push({ field: 'category', label: 'Category', values: cats })
      break
    }
    case 'sounds': {
      const subcats = [...new Set(items.map((i) => (i.data.subcategory as string) ?? '').filter(Boolean))].sort()
      if (subcats.length > 1) configs.push({ field: 'subcategory', label: 'Subcategory', values: subcats })
      break
    }
  }

  return configs
}

export function sortItems(items: LibraryItem[], field: SortField, direction: SortDirection): LibraryItem[] {
  const sorted = [...items].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'cr':
        cmp = parseCR(a.data.cr) - parseCR(b.data.cr)
        break
      case 'level':
        cmp = (Number(a.data.level) || 0) - (Number(b.data.level) || 0)
        break
      case 'rarity':
        cmp =
          (RARITY_ORDER[String(a.data.rarity ?? '').toLowerCase()] ?? 0) -
          (RARITY_ORDER[String(b.data.rarity ?? '').toLowerCase()] ?? 0)
        break
      case 'cost':
        cmp = parseCost(a.data.cost) - parseCost(b.data.cost)
        break
      case 'weight':
        cmp = (Number(a.data.weight) || 0) - (Number(b.data.weight) || 0)
        break
      case 'type':
        cmp = String(a.data.type ?? '').localeCompare(String(b.data.type ?? ''))
        break
      case 'school':
        cmp = String(a.data.school ?? '').localeCompare(String(b.data.school ?? ''))
        break
    }
    return direction === 'desc' ? -cmp : cmp
  })
  return sorted
}

export function filterItems(items: LibraryItem[], filters: Record<string, string[]>): LibraryItem[] {
  const activeFilters = Object.entries(filters).filter(([, vals]) => vals.length > 0)
  if (activeFilters.length === 0) return items

  return items.filter((item) => {
    for (const [field, values] of activeFilters) {
      if (field === 'source') {
        if (!values.includes(item.source)) return false
      } else if (field === 'attunement') {
        const hasAttunement = item.data.attunement ? 'Yes' : 'No'
        if (!values.includes(hasAttunement)) return false
      } else {
        const itemVal = String(item.data[field] ?? '')
        if (!values.includes(itemVal)) return false
      }
    }
    return true
  })
}

/** Compute total item counts per category (cached) */
const categoryCountsCache = new Map<string, number>()
let countsLoaded = false

export async function loadCategoryCounts(
  loader: (cat: LibraryCategory, hb: []) => Promise<LibraryItem[]>,
  categories: LibraryCategory[]
): Promise<Record<string, number>> {
  if (countsLoaded) return Object.fromEntries(categoryCountsCache)

  const results = await Promise.allSettled(categories.map((cat) => loader(cat, [])))
  for (let i = 0; i < categories.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      categoryCountsCache.set(categories[i], r.value.length)
    }
  }
  countsLoaded = true
  return Object.fromEntries(categoryCountsCache)
}
