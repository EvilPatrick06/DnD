import type { HomebrewEntry, LibraryCategory, LibraryItem } from '../types/library'
import {
  load5eBackgrounds,
  load5eChaseTables,
  load5eClasses,
  load5eClassFeatures,
  load5eConditions,
  load5eCrafting,
  load5eCreatures,
  load5eCurses,
  load5eDiseases,
  load5eDowntime,
  load5eEncounterPresets,
  load5eEnvironmentalEffects,
  load5eEquipment,
  load5eFeats,
  load5eFightingStyles,
  load5eHazards,
  load5eInvocations,
  load5eLanguages,
  load5eMagicItems,
  load5eMetamagic,
  load5eMonsters,
  load5eMounts,
  load5eNpcs,
  load5ePoisons,
  load5eRandomTables,
  load5eSettlements,
  load5eSiegeEquipment,
  load5eSkills,
  load5eSounds,
  load5eSpecies,
  load5eSpells,
  load5eSubclasses,
  load5eSupernaturalGifts,
  load5eTraps,
  load5eTreasureTables,
  load5eTrinkets,
  load5eVehicles,
  load5eWeaponMastery
} from './data-provider'

function summarizeItem(item: Record<string, unknown>, category: LibraryCategory): string {
  switch (category) {
    case 'monsters':
    case 'creatures':
    case 'npcs':
      return `CR ${item.cr ?? '?'} ${item.type ?? ''} - ${item.hp ?? '?'} HP`
    case 'spells':
      return `Level ${item.level ?? '?'} ${item.school ?? ''} - ${(item.lists as string[])?.join(', ') ?? ''}`
    case 'classes':
      return `${(item.coreTraits as Record<string, unknown>)?.hitPointDie ?? '?'} | ${((item.coreTraits as Record<string, unknown>)?.primaryAbility as string[])?.join(', ') ?? ''}`
    case 'subclasses':
      return `${((item.className as string) ?? '').charAt(0).toUpperCase() + ((item.className as string) ?? '').slice(1)} - Level ${item.level ?? '?'}`
    case 'species':
      return `Speed: ${item.speed ?? '?'} ft. | Size: ${Array.isArray(item.size) ? (item.size as string[]).join('/') : (item.size ?? '?')}`
    case 'backgrounds':
      return (
        ((item.proficiencies as Record<string, unknown>)?.skills as string[])?.join(', ') ??
        (item.description as string)?.slice(0, 80) ??
        ''
      )
    case 'feats':
      return `${item.category ?? ''} - Level ${item.level ?? '?'}`
    case 'weapons':
      return `${item.category ?? ''} - ${item.damage ?? '?'} ${item.damageType ?? ''}`
    case 'armor':
      return `${item.category ?? ''} - AC ${item.ac ?? '?'}`
    case 'magic-items':
      return `${item.rarity ?? ''} ${item.type ?? ''} ${item.attunement ? '(attunement)' : ''}`
    case 'gear':
      return `${item.cost ?? ''} - ${item.weight ?? '?'} lb.`
    case 'traps':
      return `${item.level ?? ''} - ${item.trigger ?? ''}`
    case 'hazards':
      return `${item.level ?? ''} ${item.type ?? ''}`
    case 'poisons':
      return `${item.type ?? ''} - DC ${item.saveDC ?? '?'}`
    case 'diseases':
      return `DC ${item.saveDC ?? '?'} - ${item.vector ?? ''}`
    case 'curses':
      return `${item.type ?? ''} curse`
    case 'environmental-effects':
      return `${item.category ?? ''}`
    case 'settlements':
      return `Pop: ${item.populationMin ?? '?'}-${item.populationMax ?? '?'}`
    case 'invocations':
      return `Level ${item.level ?? 'Any'}${item.pactRequired ? ' - Pact required' : ''}`
    case 'metamagic':
      return `${item.cost ?? '?'} sorcery points`
    case 'vehicles':
      return `${item.size ?? ''} - Speed: ${item.speed ?? '?'}`
    case 'mounts':
      return `${item.size ?? ''} - Speed: ${item.speed ?? '?'} ft.`
    case 'siege-equipment':
      return `AC ${item.ac ?? '?'} | HP ${item.hp ?? '?'}`
    case 'supernatural-gifts':
      return `${item.type ?? ''}`
    case 'encounter-presets':
      return `${item.difficulty ?? ''} - ${item.minLevel ?? '?'}-${item.maxLevel ?? '?'}`
    case 'crafting':
      return `${item.toolType ?? ''}`
    case 'conditions':
      return `${item.type ?? ''} - ${((item.description as string) ?? '').slice(0, 60)}`
    case 'weapon-mastery':
      return ((item.description as string) ?? '').slice(0, 80)
    case 'languages':
      return `${item.type ?? ''} - Script: ${item.script ?? 'None'}`
    case 'skills':
      return `${item.ability ?? ''} - ${((item.description as string) ?? '').slice(0, 60)}`
    case 'fighting-styles':
      return ((item.description as string) ?? '').slice(0, 80)
    case 'class-features':
      return `Level ${item.level ?? '?'} - ${((item.description as string) ?? '').slice(0, 60)}`
    default:
      return (item.description as string)?.slice(0, 80) ?? ''
  }
}

function toLibraryItems(
  items: Record<string, unknown>[],
  category: LibraryCategory,
  source: 'official' | 'homebrew' = 'official'
): LibraryItem[] {
  return items.map((item) => ({
    id: (item.id as string) ?? crypto.randomUUID(),
    name: (item.name as string) ?? 'Unknown',
    category,
    source,
    summary: summarizeItem(item, category),
    data: item
  }))
}

function homebrewToLibraryItems(entries: HomebrewEntry[], category: LibraryCategory): LibraryItem[] {
  return entries
    .filter((e) => e.type === category)
    .map((e) => ({
      id: e.id,
      name: e.name,
      category,
      source: 'homebrew' as const,
      summary: summarizeItem(e.data, category),
      data: { ...e.data, _homebrewId: e.id, _basedOn: e.basedOn }
    }))
}

export async function loadCategoryItems(category: LibraryCategory, homebrew: HomebrewEntry[]): Promise<LibraryItem[]> {
  const hbItems = homebrewToLibraryItems(homebrew, category)

  switch (category) {
    case 'characters': {
      const raw = await window.api.loadCharacters()
      if (!Array.isArray(raw)) return hbItems
      return [
        ...raw.map((c) => ({
          id: (c.id as string) ?? '',
          name: (c.name as string) ?? 'Unknown',
          category: 'characters' as const,
          source: 'official' as const,
          summary: `Level ${c.level ?? '?'} ${c.className ?? c.class ?? '?'}`,
          data: c
        })),
        ...hbItems
      ]
    }
    case 'campaigns': {
      const raw = await window.api.loadCampaigns()
      if (!Array.isArray(raw)) return hbItems
      return raw.map((c) => ({
        id: (c.id as string) ?? '',
        name: (c.name as string) ?? 'Unknown',
        category: 'campaigns' as const,
        source: 'official' as const,
        summary: `${c.system ?? '5e'} - ${c.description ?? 'No description'}`.slice(0, 80),
        data: c
      }))
    }
    case 'bastions': {
      const raw = await window.api.loadBastions()
      if (!Array.isArray(raw)) return hbItems
      return raw.map((b) => ({
        id: (b.id as string) ?? '',
        name: (b.name as string) ?? 'Unknown',
        category: 'bastions' as const,
        source: 'official' as const,
        summary: `Level ${b.level ?? '?'}`,
        data: b
      }))
    }
    case 'monsters': {
      const data = await load5eMonsters()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'creatures': {
      const data = await load5eCreatures()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'npcs': {
      const data = await load5eNpcs()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'spells': {
      const data = await load5eSpells()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'invocations': {
      const data = await load5eInvocations()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'metamagic': {
      const data = await load5eMetamagic()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'classes': {
      const data = await load5eClasses()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'subclasses': {
      const data = await load5eSubclasses()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'species': {
      const data = await load5eSpecies()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'backgrounds': {
      const data = await load5eBackgrounds()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'feats': {
      const data = await load5eFeats()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'supernatural-gifts': {
      const data = await load5eSupernaturalGifts()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'weapons': {
      const eq = await load5eEquipment()
      return [...toLibraryItems(eq.weapons as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'armor': {
      const eq = await load5eEquipment()
      return [...toLibraryItems(eq.armor as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'gear': {
      const eq = await load5eEquipment()
      return [...toLibraryItems(eq.gear as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'tools': {
      const crafting = await load5eCrafting()
      return [...toLibraryItems(crafting as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'magic-items': {
      const data = await load5eMagicItems()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'vehicles': {
      const data = await load5eVehicles()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'mounts': {
      const data = await load5eMounts()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'siege-equipment': {
      const data = await load5eSiegeEquipment()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'trinkets': {
      const data = await load5eTrinkets()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'settlements': {
      const data = await load5eSettlements()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'traps': {
      const data = await load5eTraps()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'hazards': {
      const data = await load5eHazards()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'poisons': {
      const data = await load5ePoisons()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'diseases': {
      const data = await load5eDiseases()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'curses': {
      const data = await load5eCurses()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'environmental-effects': {
      const data = await load5eEnvironmentalEffects()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'crafting': {
      const data = await load5eCrafting()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'downtime': {
      const data = await load5eDowntime()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'encounter-presets': {
      const data = await load5eEncounterPresets()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'treasure-tables': {
      const data = await load5eTreasureTables()
      const tables = data as unknown as Record<string, unknown>
      return toLibraryItems(
        Object.entries(tables).map(([key, val]) => ({ id: key, name: key, ...(val as Record<string, unknown>) })),
        category
      )
    }
    case 'random-tables': {
      const data = await load5eRandomTables()
      const tables = data as unknown as Record<string, unknown>
      return toLibraryItems(
        Object.entries(tables).map(([key, val]) => ({ id: key, name: key, ...(val as Record<string, unknown>) })),
        category
      )
    }
    case 'chase-tables': {
      const data = await load5eChaseTables()
      const tables = data as unknown as Record<string, unknown>
      return toLibraryItems(
        Object.entries(tables).map(([key, val]) => ({ id: key, name: key, ...(val as Record<string, unknown>) })),
        category
      )
    }
    case 'sounds': {
      const data = await load5eSounds()
      return toLibraryItems(data as unknown as Record<string, unknown>[], category)
    }
    case 'conditions': {
      const data = await load5eConditions()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'weapon-mastery': {
      const data = await load5eWeaponMastery()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'languages': {
      const data = await load5eLanguages()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'skills': {
      const data = await load5eSkills()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'fighting-styles': {
      const data = await load5eFightingStyles()
      return [...toLibraryItems(data as unknown as Record<string, unknown>[], category), ...hbItems]
    }
    case 'class-features': {
      const cfData = await load5eClassFeatures()
      const items: Record<string, unknown>[] = []
      for (const [className, classData] of Object.entries(cfData)) {
        for (const feat of (classData as unknown as Record<string, unknown>).features as {
          level: number
          name: string
          description: string
        }[]) {
          items.push({
            id: `${className}-${feat.name}-${feat.level}`,
            name: feat.name,
            level: feat.level,
            description: feat.description,
            class: className
          })
        }
      }
      return [...toLibraryItems(items, category), ...hbItems]
    }
    default:
      return hbItems
  }
}

export async function searchAllCategories(query: string, homebrew: HomebrewEntry[]): Promise<LibraryItem[]> {
  if (!query.trim()) return []
  const q = query.toLowerCase()

  const allCategories: LibraryCategory[] = [
    'monsters',
    'creatures',
    'npcs',
    'spells',
    'classes',
    'subclasses',
    'species',
    'backgrounds',
    'feats',
    'weapons',
    'armor',
    'magic-items',
    'traps',
    'poisons',
    'diseases',
    'curses',
    'conditions',
    'weapon-mastery',
    'languages',
    'skills',
    'fighting-styles',
    'class-features'
  ]

  const results = await Promise.allSettled(allCategories.map((cat) => loadCategoryItems(cat, homebrew)))

  const allItems: LibraryItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allItems.push(
        ...r.value.filter((item) => item.name.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q))
      )
    }
  }

  return allItems.slice(0, 100)
}
