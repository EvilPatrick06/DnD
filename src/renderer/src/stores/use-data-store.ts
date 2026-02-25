import { create } from 'zustand'

type DataCategory =
  | 'species' | 'speciesTraits' | 'classes' | 'backgrounds' | 'subclasses' | 'feats' | 'spells'
  | 'classFeatures' | 'equipment' | 'crafting' | 'diseases' | 'encounterBudgets'
  | 'treasureTables' | 'randomTables' | 'chaseTables' | 'encounterPresets'
  | 'npcNames' | 'invocations' | 'metamagic' | 'bastionFacilities' | 'magicItems'
  | 'monsters' | 'npcs' | 'creatures' | 'traps' | 'hazards' | 'poisons'
  | 'environmentalEffects' | 'curses' | 'supernaturalGifts' | 'siegeEquipment'
  | 'settlements' | 'mounts' | 'vehicles' | 'downtime'
  | 'conditions' | 'weaponMastery' | 'languages' | 'skills' | 'fightingStyles'
  | 'variantItems' | 'lightSources' | 'npcAppearance' | 'npcMannerisms'
  | 'alignmentDescriptions' | 'wearableItems' | 'personalityTables'
  | 'xpThresholds' | 'startingEquipment' | 'bastionEvents' | 'sentientItems'
  | 'weatherGeneration' | 'calendarPresets' | 'effectDefinitions' | 'spellSlots' | 'trinkets'
  | 'soundEvents' | 'speciesSpells' | 'classResources' | 'speciesResources'
  | 'abilityScoreConfig' | 'presetIcons' | 'keyboardShortcuts' | 'themes'
  | 'diceColors' | 'dmTabs' | 'notificationTemplates' | 'builtInMaps'
  | 'sessionZeroConfig' | 'diceTypes' | 'lightingTravel' | 'currencyConfig' | 'moderation'
  | 'adventureSeeds' | 'creatureTypes' | 'ambientTracks' | 'languageD12Table' | 'rarityOptions'

interface CacheEntry {
  data: unknown
  timestamp: number
  loading: boolean
}

const CACHE_TTL_MS = 30 * 60 * 1000

interface DataStoreState {
  cache: Map<DataCategory, CacheEntry>
  homebrewByCategory: Map<string, Record<string, unknown>[]>
  homebrewLoaded: boolean

  loadHomebrew: () => Promise<void>
  get: <T>(category: DataCategory, loader: () => Promise<T>) => Promise<T>
  refresh: (category: DataCategory) => void
  clearAll: () => void
}

export const useDataStore = create<DataStoreState>((set, get) => ({
  cache: new Map(),
  homebrewByCategory: new Map(),
  homebrewLoaded: false,

  loadHomebrew: async () => {
    if (get().homebrewLoaded) return
    try {
      const result = await window.api.loadAllHomebrew()
      if (Array.isArray(result)) {
        const byCategory = new Map<string, Record<string, unknown>[]>()
        for (const entry of result) {
          const cat = (entry.type as string) || 'unknown'
          const existing = byCategory.get(cat) || []
          existing.push(entry)
          byCategory.set(cat, existing)
        }
        set({ homebrewByCategory: byCategory, homebrewLoaded: true })
      }
    } catch {
      set({ homebrewLoaded: true })
    }
  },

  get: async <T>(category: DataCategory, loader: () => Promise<T>): Promise<T> => {
    const state = get()
    const cached = state.cache.get(category)

    if (cached && !cached.loading && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T
    }

    if (cached?.loading) {
      return new Promise<T>((resolve) => {
        const check = (): void => {
          const entry = get().cache.get(category)
          if (entry && !entry.loading) {
            resolve(entry.data as T)
          } else {
            setTimeout(check, 10)
          }
        }
        check()
      })
    }

    const newCache = new Map(state.cache)
    newCache.set(category, { data: null, timestamp: Date.now(), loading: true })
    set({ cache: newCache })

    try {
      const data = await loader()

      if (!state.homebrewLoaded) {
        await state.loadHomebrew()
      }

      const merged = mergeHomebrew(category, data, get().homebrewByCategory)

      const finalCache = new Map(get().cache)
      finalCache.set(category, { data: merged, timestamp: Date.now(), loading: false })
      set({ cache: finalCache })

      return merged as T
    } catch (err) {
      const errCache = new Map(get().cache)
      errCache.delete(category)
      set({ cache: errCache })
      throw err
    }
  },

  refresh: (category: DataCategory) => {
    const newCache = new Map(get().cache)
    newCache.delete(category)
    set({ cache: newCache })
  },

  clearAll: () => {
    set({ cache: new Map(), homebrewByCategory: new Map(), homebrewLoaded: false })
  }
}))

function mergeHomebrew<T>(
  category: DataCategory,
  baseData: T,
  homebrewByCategory: Map<string, Record<string, unknown>[]>
): T {
  const catKey = categoryToHomebrewKey(category)
  const homebrewEntries = homebrewByCategory.get(catKey)
  if (!homebrewEntries || homebrewEntries.length === 0) return baseData

  if (!Array.isArray(baseData)) return baseData

  const result = [...baseData]

  for (const entry of homebrewEntries) {
    const entryWithSource = { ...entry, source: 'homebrew' }
    result.push(entryWithSource as (typeof result)[number])
  }

  return result as unknown as T
}

function categoryToHomebrewKey(category: DataCategory): string {
  const map: Record<DataCategory, string> = {
    species: 'species',
    speciesTraits: 'species-traits',
    classes: 'classes',
    backgrounds: 'backgrounds',
    subclasses: 'subclasses',
    feats: 'feats',
    spells: 'spells',
    classFeatures: 'class-features',
    equipment: 'equipment',
    crafting: 'crafting',
    diseases: 'diseases',
    encounterBudgets: 'encounter-budgets',
    treasureTables: 'treasure-tables',
    randomTables: 'random-tables',
    chaseTables: 'chase-tables',
    encounterPresets: 'encounter-presets',
    npcNames: 'npc-names',
    invocations: 'invocations',
    metamagic: 'metamagic',
    bastionFacilities: 'bastion-facilities',
    magicItems: 'magic-items',
    monsters: 'monsters',
    npcs: 'npcs',
    creatures: 'creatures',
    traps: 'traps',
    hazards: 'hazards',
    poisons: 'poisons',
    environmentalEffects: 'environmental-effects',
    curses: 'curses',
    supernaturalGifts: 'supernatural-gifts',
    siegeEquipment: 'siege-equipment',
    settlements: 'settlements',
    mounts: 'mounts',
    vehicles: 'vehicles',
    downtime: 'downtime',
    conditions: 'conditions',
    weaponMastery: 'weapon-mastery',
    languages: 'languages',
    skills: 'skills',
    fightingStyles: 'fighting-styles',
    variantItems: 'variant-items',
    lightSources: 'light-sources',
    npcAppearance: 'npc-appearance',
    npcMannerisms: 'npc-mannerisms',
    alignmentDescriptions: 'alignment-descriptions',
    wearableItems: 'wearable-items',
    personalityTables: 'personality-tables',
    xpThresholds: 'xp-thresholds',
    startingEquipment: 'starting-equipment',
    bastionEvents: 'bastion-events',
    sentientItems: 'sentient-items',
    weatherGeneration: 'weather-generation',
    calendarPresets: 'calendar-presets',
    effectDefinitions: 'effect-definitions',
    spellSlots: 'spell-slots',
    trinkets: 'trinkets',
    soundEvents: 'sound-events',
    speciesSpells: 'species-spells',
    classResources: 'class-resources',
    speciesResources: 'species-resources',
    abilityScoreConfig: 'ability-score-config',
    presetIcons: 'preset-icons',
    keyboardShortcuts: 'keyboard-shortcuts',
    themes: 'themes',
    diceColors: 'dice-colors',
    dmTabs: 'dm-tabs',
    notificationTemplates: 'notification-templates',
    builtInMaps: 'built-in-maps',
    sessionZeroConfig: 'session-zero-config',
    diceTypes: 'dice-types',
    lightingTravel: 'lighting-travel',
    currencyConfig: 'currency-config',
    moderation: 'moderation',
    adventureSeeds: 'adventure-seeds',
    creatureTypes: 'creature-types',
    ambientTracks: 'ambient-tracks',
    languageD12Table: 'language-d12-table',
    rarityOptions: 'rarity-options'
  }
  return map[category]
}
