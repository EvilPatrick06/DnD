export interface SpellDiversityResult {
  school: string
  count: number
  percentage: number
}

export interface ConcentrationConflict {
  spellName: string
  level: number
}

export interface RitualSuggestion {
  spellName: string
  level: number
  reason: string
}

export interface SpellPrepAnalysis {
  totalPrepared: number
  diversity: SpellDiversityResult[]
  concentrationSpells: ConcentrationConflict[]
  concentrationWarning: boolean
  ritualSuggestions: RitualSuggestion[]
  missingSchools: string[]
}

const ALL_SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation'
]

/**
 * Analyze spell preparation diversity by school.
 */
export function analyzeSpellDiversity(
  preparedSpells: Array<{ name: string; school?: string; level: number }>
): SpellDiversityResult[] {
  const total = preparedSpells.length
  if (total === 0) return []

  const schoolCounts = new Map<string, number>()
  for (const spell of preparedSpells) {
    const school = spell.school || 'Unknown'
    schoolCounts.set(school, (schoolCounts.get(school) ?? 0) + 1)
  }

  return Array.from(schoolCounts.entries())
    .map(([school, count]) => ({
      school,
      count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Find all concentration spells in the prepared list.
 * Warns if more than 40% of prepared spells require concentration.
 */
export function getConcentrationConflicts(
  preparedSpells: Array<{ name: string; level: number; concentration?: boolean }>
): { spells: ConcentrationConflict[]; isWarning: boolean } {
  const concSpells = preparedSpells.filter((s) => s.concentration).map((s) => ({ spellName: s.name, level: s.level }))

  return {
    spells: concSpells,
    isWarning: preparedSpells.length > 0 && concSpells.length / preparedSpells.length > 0.4
  }
}

/**
 * Identify ritual spells the caster knows but hasn't prepared,
 * suggesting they could be cast without using a slot.
 */
export function getRitualSpells(
  preparedSpells: Array<{ name: string; level: number; ritual?: boolean }>,
  knownSpells: Array<{ name: string; level: number; ritual?: boolean }>
): RitualSuggestion[] {
  const preparedNames = new Set(preparedSpells.map((s) => s.name))
  return knownSpells
    .filter((s) => s.ritual && !preparedNames.has(s.name))
    .map((s) => ({
      spellName: s.name,
      level: s.level,
      reason: 'Can be ritual cast without preparation (takes 10 extra minutes)'
    }))
}

/**
 * Full analysis of a caster's prepared spell list.
 */
export function analyzePreparation(
  preparedSpells: Array<{
    name: string
    school?: string
    level: number
    concentration?: boolean
    ritual?: boolean
  }>,
  knownSpells: Array<{ name: string; level: number; ritual?: boolean }>
): SpellPrepAnalysis {
  const diversity = analyzeSpellDiversity(preparedSpells)
  const { spells: concentrationSpells, isWarning } = getConcentrationConflicts(preparedSpells)
  const ritualSuggestions = getRitualSpells(preparedSpells, knownSpells)
  const presentSchools = new Set(diversity.map((d) => d.school))
  const missingSchools = ALL_SCHOOLS.filter((s) => !presentSchools.has(s))

  return {
    totalPrepared: preparedSpells.length,
    diversity,
    concentrationSpells,
    concentrationWarning: isWarning,
    ritualSuggestions,
    missingSchools
  }
}
