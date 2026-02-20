/**
 * Import/Export service for characters and campaigns.
 *
 * Uses Electron's window.api for file dialogs and file I/O.
 * All functions handle errors gracefully, returning false or null on failure.
 */

const JSON_FILTER = [{ name: 'JSON Files', extensions: ['json'] }]

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export a character to a JSON file via save dialog.
 * Returns true if the file was written successfully, false otherwise.
 */
export async function exportCharacter(character: Record<string, unknown>): Promise<boolean> {
  try {
    const filePath = await window.api.showSaveDialog({
      title: 'Export Character',
      filters: JSON_FILTER
    })
    if (!filePath) return false

    const json = JSON.stringify(character, null, 2)
    await window.api.writeFile(filePath, json)
    return true
  } catch {
    return false
  }
}

/**
 * Export a campaign to a JSON file via save dialog.
 * Returns true if the file was written successfully, false otherwise.
 */
export async function exportCampaign(campaign: Record<string, unknown>): Promise<boolean> {
  try {
    const filePath = await window.api.showSaveDialog({
      title: 'Export Campaign',
      filters: JSON_FILTER
    })
    if (!filePath) return false

    const json = JSON.stringify(campaign, null, 2)
    await window.api.writeFile(filePath, json)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Import a character from a JSON file via open dialog.
 * Validates that the parsed object contains required fields: id, name, gameSystem.
 * Returns the parsed character object, or null if cancelled/invalid/error.
 */
export async function importCharacter(): Promise<any | null> {
  try {
    const filePath = await window.api.showOpenDialog({
      title: 'Import Character',
      filters: JSON_FILTER
    })
    if (!filePath) return null

    const raw = await window.api.readFile(filePath)
    const parsed = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.gameSystem !== 'string'
    ) {
      console.error('Import character: missing required fields (id, name, gameSystem)')
      return null
    }

    return parsed
  } catch (err) {
    console.error('Import character failed:', err)
    return null
  }
}

/**
 * Import a campaign from a JSON file via open dialog.
 * Validates that the parsed object contains required fields: id, name, system.
 * Returns the parsed campaign object, or null if cancelled/invalid/error.
 */
export async function importCampaign(): Promise<any | null> {
  try {
    const filePath = await window.api.showOpenDialog({
      title: 'Import Campaign',
      filters: JSON_FILTER
    })
    if (!filePath) return null

    const raw = await window.api.readFile(filePath)
    const parsed = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.system !== 'string'
    ) {
      console.error('Import campaign: missing required fields (id, name, system)')
      return null
    }

    return parsed
  } catch (err) {
    console.error('Import campaign failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// D&D Beyond import
// ---------------------------------------------------------------------------

/**
 * Map a D&D Beyond ability score block to our AbilityScoreSet.
 * DDB stores stats as an array of objects with id (1-6) and value.
 */
function extractAbilityScores(stats: Array<{ id?: number; value?: number }> | undefined): Record<string, number> {
  const idToName: Record<number, string> = {
    1: 'strength',
    2: 'dexterity',
    3: 'constitution',
    4: 'intelligence',
    5: 'wisdom',
    6: 'charisma'
  }

  const scores: Record<string, number> = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }

  if (!Array.isArray(stats)) return scores

  for (const stat of stats) {
    const name = idToName[stat.id ?? 0]
    if (name && typeof stat.value === 'number') {
      scores[name] = stat.value
    }
  }

  // Also add racial bonuses and other bonuses if present
  return scores
}

/**
 * Sum bonus values from DDB modifiers that target ability scores.
 * DDB modifiers include racial, class, background, feat, item, etc.
 */
function applyAbilityBonuses(
  baseScores: Record<string, number>,
  modifiers: Record<string, Array<{ type?: string; subType?: string; value?: number }>> | undefined
): Record<string, number> {
  const scores = { ...baseScores }
  if (!modifiers || typeof modifiers !== 'object') return scores

  const subTypeToAbility: Record<string, string> = {
    'strength-score': 'strength',
    'dexterity-score': 'dexterity',
    'constitution-score': 'constitution',
    'intelligence-score': 'intelligence',
    'wisdom-score': 'wisdom',
    'charisma-score': 'charisma'
  }

  const allModifiers = Object.values(modifiers).flat()
  for (const mod of allModifiers) {
    if (mod.type === 'bonus' && mod.subType && typeof mod.value === 'number') {
      const ability = subTypeToAbility[mod.subType]
      if (ability) {
        scores[ability] += mod.value
      }
    }
  }

  return scores
}

/**
 * Import a D&D Beyond JSON character export and convert it to our Character5e format.
 * Performs a best-effort mapping of: name, level, classes, species, ability scores,
 * hit points, alignment, and background.
 *
 * Returns the converted character object or null if cancelled/invalid/error.
 */
export async function importDndBeyondCharacter(): Promise<any | null> {
  try {
    const filePath = await window.api.showOpenDialog({
      title: 'Import D&D Beyond Character',
      filters: JSON_FILTER
    })
    if (!filePath) return null

    const raw = await window.api.readFile(filePath)
    const ddb = JSON.parse(raw)

    // DDB exports sometimes wrap in a "data" property
    const data = ddb.data ?? ddb

    // Validate minimum DDB structure
    if (!data || typeof data.name !== 'string') {
      console.error('Import DDB: not a valid D&D Beyond character export')
      return null
    }

    // Extract ability scores with bonuses
    const baseScores = extractAbilityScores(data.stats)
    const abilityScores = applyAbilityBonuses(baseScores, data.modifiers)

    // Extract classes
    const ddbClasses: Array<{
      definition?: { name?: string }
      subclassDefinition?: { name?: string }
      level?: number
      isStartingClass?: boolean
    }> = Array.isArray(data.classes) ? data.classes : []

    const classes = ddbClasses.map((c) => ({
      name: c.definition?.name ?? 'Unknown',
      level: c.level ?? 1,
      subclass: c.subclassDefinition?.name ?? undefined,
      hitDie: getHitDie(c.definition?.name ?? '')
    }))

    const totalLevel = classes.reduce((sum, c) => sum + c.level, 0) || 1

    // Extract species/race
    const speciesName: string = data.race?.fullName ?? data.race?.baseName ?? data.race?.raceName ?? 'Human'

    // Extract hit points
    const baseHP = data.baseHitPoints ?? 10
    const bonusHP = data.bonusHitPoints ?? 0
    const removedHP = data.removedHitPoints ?? 0
    const tempHP = data.temporaryHitPoints ?? 0
    const maxHP = baseHP + bonusHP
    const currentHP = maxHP - removedHP

    // Extract alignment
    const alignmentId = data.alignmentId
    const alignmentMap: Record<number, string> = {
      1: 'Lawful Good',
      2: 'Neutral Good',
      3: 'Chaotic Good',
      4: 'Lawful Neutral',
      5: 'True Neutral',
      6: 'Chaotic Neutral',
      7: 'Lawful Evil',
      8: 'Neutral Evil',
      9: 'Chaotic Evil'
    }
    const alignment = alignmentMap[alignmentId] ?? ''

    // Extract background
    const backgroundName: string = data.background?.definition?.name ?? data.background?.name ?? ''

    // Build our Character5e-compatible object
    const now = new Date().toISOString()
    const character: Record<string, unknown> = {
      id: crypto.randomUUID(),
      gameSystem: 'dnd5e' as const,
      campaignId: null,
      playerId: '',

      name: data.name,
      species: speciesName,
      classes,
      level: totalLevel,
      background: backgroundName,
      alignment,
      xp: data.currentXp ?? 0,
      levelingMode: 'milestone' as const,

      abilityScores,
      hitPoints: {
        current: currentHP,
        maximum: maxHP,
        temporary: tempHP
      },
      hitDiceRemaining: totalLevel,
      armorClass: 10,
      initiative: 0,
      speed: 30,
      speeds: { swim: 0, fly: 0, climb: 0, burrow: 0 },
      senses: [],
      resistances: [],
      immunities: [],
      vulnerabilities: [],

      details: {
        gender: data.gender ?? undefined,
        age: data.age ? String(data.age) : undefined,
        height: data.height ?? undefined,
        weight: data.weight ? String(data.weight) : undefined,
        eyes: data.eyes ?? undefined,
        hair: data.hair ?? undefined,
        skin: data.skin ?? undefined,
        personality: data.traits?.personalityTraits ?? undefined,
        ideals: data.traits?.ideals ?? undefined,
        bonds: data.traits?.bonds ?? undefined,
        flaws: data.traits?.flaws ?? undefined
      },

      proficiencies: {
        weapons: [],
        armor: [],
        tools: [],
        languages: [],
        savingThrows: []
      },
      skills: [],

      equipment: [],
      treasure: { cp: 0, sp: 0, gp: 0, pp: 0, ep: 0 },
      features: [],
      knownSpells: [],
      preparedSpellIds: [],
      spellSlotLevels: {},
      classFeatures: [],
      weapons: [],
      armor: [],
      feats: [],

      buildChoices: {
        speciesId: speciesName.toLowerCase().replace(/\s+/g, '-'),
        classId: (classes[0]?.name ?? 'fighter').toLowerCase(),
        subclassId: classes[0]?.subclass?.toLowerCase().replace(/\s+/g, '-'),
        backgroundId: backgroundName.toLowerCase().replace(/\s+/g, '-'),
        selectedSkills: [],
        abilityScoreMethod: 'custom' as const,
        abilityScoreAssignments: {}
      },

      status: 'active' as const,
      campaignHistory: [],
      backstory: data.notes?.backstory ?? '',
      notes: '',
      pets: [],
      deathSaves: { successes: 0, failures: 0 },
      heroicInspiration: false,
      attunement: [],
      conditions: [],
      languageDescriptions: {},
      createdAt: now,
      updatedAt: now
    }

    // Extract currencies from DDB inventory
    if (data.currencies) {
      character.treasure = {
        cp: data.currencies.cp ?? 0,
        sp: data.currencies.sp ?? 0,
        gp: data.currencies.gp ?? 0,
        pp: data.currencies.pp ?? 0,
        ep: data.currencies.ep ?? 0
      }
    }

    return character
  } catch (err) {
    console.error('Import D&D Beyond character failed:', err)
    return null
  }
}

/**
 * Get the hit die size for a given class name.
 */
function getHitDie(className: string): number {
  const hitDice: Record<string, number> = {
    barbarian: 12,
    bard: 8,
    cleric: 8,
    druid: 8,
    fighter: 10,
    monk: 8,
    paladin: 10,
    ranger: 10,
    rogue: 8,
    sorcerer: 6,
    warlock: 8,
    wizard: 6
  }
  return hitDice[className.toLowerCase()] ?? 8
}
