import type { AbilityName, AbilityScoreSet } from '../types/character-common'
import { abilityModifier } from '../types/character-common'
import type { ResolvedEffects } from './effect-resolver-5e'

interface SpeciesData {
  abilityBonuses: Partial<Record<AbilityName, number>>
  speed: number
  size: string
}

interface ClassData {
  hitDie: number
  savingThrows: string[]
}

export interface DerivedStats5e {
  abilityScores: AbilityScoreSet
  abilityModifiers: AbilityScoreSet
  maxHP: number
  armorClass: number
  initiative: number
  speed: number
  proficiencyBonus: number
  savingThrows: Record<string, number>
}

export function calculateHPBonusFromTraits(
  level: number,
  speciesId: string | null,
  feats: Array<{ id: string }> | null,
  draconicSorcererLevel?: number
): number {
  let bonus = 0
  if (speciesId === 'dwarf') bonus += level // Dwarven Toughness: +1 HP per level
  if (feats?.some((f) => f.id === 'tough')) bonus += level * 2 // Tough feat: +2 HP per level
  if (feats?.some((f) => f.id === 'boon-of-fortitude')) bonus += 40 // Boon of Fortitude: +40 HP
  // Draconic Resilience: +3 at Lv3, +1 per additional Sorcerer level (= sorcererLevel total for Lv3+)
  if (draconicSorcererLevel && draconicSorcererLevel >= 3) bonus += draconicSorcererLevel
  return bonus
}

// ─── Encumbrance (PHB 2024 Chapter 6) ──────────────────────

export interface EncumbranceResult {
  /** Total weight of carried equipment in lbs */
  totalWeight: number
  /** Maximum carrying capacity: STR × 15 lbs */
  carryCapacity: number
  /** Push/drag/lift maximum: STR × 30 lbs */
  pushDragLift: number
  /** Encumbrance status */
  status: 'unencumbered' | 'encumbered' | 'heavily-encumbered' | 'over-limit'
  /** Speed penalty description (empty if unencumbered) */
  speedPenalty: string
}

/**
 * Calculate encumbrance for a character based on carried equipment.
 *
 * Standard Rule (PHB 2024):
 *   - Carrying Capacity: STR × 15 lbs
 *   - Push/Drag/Lift: STR × 30 lbs
 *
 * Variant Encumbrance (DMG 2024):
 *   - Unencumbered: weight ≤ STR × 5
 *   - Encumbered: weight ≤ STR × 10 (speed -10 ft)
 *   - Heavily Encumbered: weight ≤ STR × 15 (speed -20 ft, disadvantage on ability checks, attack rolls, and saves using STR, DEX, or CON)
 *   - Over Limit: weight > STR × 15 (cannot move)
 *
 * @param strengthScore - Character's STR score
 * @param totalWeight - Sum of all carried equipment weights
 * @param useVariant - Use variant encumbrance rules (DMG optional)
 * @param sizeMultiplier - 2 for Large, 4 for Huge, 8 for Gargantuan; 0.5 for Tiny
 */
export function calculateEncumbrance(
  strengthScore: number,
  totalWeight: number,
  useVariant: boolean = false,
  sizeMultiplier: number = 1
): EncumbranceResult {
  const effectiveStr = strengthScore * sizeMultiplier
  const carryCapacity = effectiveStr * 15
  const pushDragLift = effectiveStr * 30

  if (!useVariant) {
    // Standard rules: only track carry capacity and push/drag/lift
    if (totalWeight > carryCapacity) {
      return {
        totalWeight,
        carryCapacity,
        pushDragLift,
        status: 'over-limit',
        speedPenalty: 'Speed 0 (over carrying capacity)'
      }
    }
    return {
      totalWeight,
      carryCapacity,
      pushDragLift,
      status: 'unencumbered',
      speedPenalty: ''
    }
  }

  // Variant encumbrance
  const lightThreshold = effectiveStr * 5
  const mediumThreshold = effectiveStr * 10

  if (totalWeight > carryCapacity) {
    return {
      totalWeight,
      carryCapacity,
      pushDragLift,
      status: 'over-limit',
      speedPenalty: 'Speed 0 (over carrying capacity)'
    }
  }
  if (totalWeight > mediumThreshold) {
    return {
      totalWeight,
      carryCapacity,
      pushDragLift,
      status: 'heavily-encumbered',
      speedPenalty: 'Speed -20 ft, disadvantage on STR/DEX/CON checks, attacks, and saves'
    }
  }
  if (totalWeight > lightThreshold) {
    return {
      totalWeight,
      carryCapacity,
      pushDragLift,
      status: 'encumbered',
      speedPenalty: 'Speed -10 ft'
    }
  }
  return {
    totalWeight,
    carryCapacity,
    pushDragLift,
    status: 'unencumbered',
    speedPenalty: ''
  }
}

/**
 * Sum the total weight of a character's equipment, weapons, armor, and inventory.
 */
export function sumEquipmentWeight(
  weapons: Array<{ weight?: number; quantity?: number }>,
  armor: Array<{ weight?: number; equipped?: boolean }>,
  gear: Array<{ weight?: number; quantity?: number }>,
  currency?: { cp?: number; sp?: number; gp?: number; pp?: number }
): number {
  let total = 0

  for (const w of weapons) {
    total += (w.weight ?? 0) * (w.quantity ?? 1)
  }
  for (const a of armor) {
    total += a.weight ?? 0
  }
  for (const g of gear) {
    total += (g.weight ?? 0) * (g.quantity ?? 1)
  }

  // Coins: 50 coins = 1 lb (PHB 2024)
  if (currency) {
    const totalCoins = (currency.cp ?? 0) + (currency.sp ?? 0) + (currency.gp ?? 0) + (currency.pp ?? 0)
    total += totalCoins / 50
  }

  return total
}

// ─── Lifestyle Expenses (PHB 2024 Chapter 6) ────────────────

export type LifestyleLevel = 'wretched' | 'squalid' | 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic'

export const LIFESTYLE_COSTS: Record<LifestyleLevel, number> = {
  wretched: 0,
  squalid: 0.1,    // 1 sp/day
  poor: 0.2,        // 2 sp/day
  modest: 1,        // 1 gp/day
  comfortable: 2,   // 2 gp/day
  wealthy: 4,       // 4 gp/day
  aristocratic: 10  // 10 gp/day minimum
}

/**
 * Calculate lifestyle expenses for a given number of downtime days.
 * Returns cost in gold pieces.
 */
export function calculateLifestyleCost(lifestyle: LifestyleLevel, days: number): number {
  return LIFESTYLE_COSTS[lifestyle] * days
}

// ─── Tool-Skill Interactions (DMG 2024) ─────────────────────

export interface ToolSkillInteraction {
  tool: string
  skills: string[]
  benefit: string
}

/**
 * Tool proficiencies that grant advantage on specific skill checks (DMG 2024).
 * When proficient with a tool AND the relevant skill, the character gains advantage.
 */
export const TOOL_SKILL_INTERACTIONS: ToolSkillInteraction[] = [
  { tool: "Alchemist's Supplies", skills: ['Arcana', 'Investigation'], benefit: 'Advantage on Arcana/Investigation checks involving potions or alchemical substances' },
  { tool: "Brewer's Supplies", skills: ['Medicine', 'Persuasion'], benefit: 'Advantage on checks to detect poisons in drinks or to ply someone with alcohol' },
  { tool: "Calligrapher's Supplies", skills: ['History', 'Deception'], benefit: 'Advantage on History checks involving written works or Deception checks involving forgeries' },
  { tool: "Carpenter's Tools", skills: ['Investigation', 'Perception'], benefit: 'Advantage on checks to identify structural weaknesses or hidden compartments' },
  { tool: "Cartographer's Tools", skills: ['Nature', 'Survival'], benefit: 'Advantage on navigation and mapping-related checks' },
  { tool: "Cobbler's Tools", skills: ['Investigation', 'Perception'], benefit: 'Advantage on tracking-related checks involving footprints' },
  { tool: "Cook's Utensils", skills: ['Medicine', 'Survival'], benefit: 'Advantage on checks to identify food safety or forage edible plants' },
  { tool: "Glassblower's Tools", skills: ['Arcana', 'Investigation'], benefit: 'Advantage on checks involving glass objects or crystal components' },
  { tool: "Herbalism Kit", skills: ['Medicine', 'Nature'], benefit: 'Advantage on checks to identify plants or create herbal remedies' },
  { tool: "Jeweler's Tools", skills: ['Arcana', 'Investigation'], benefit: 'Advantage on checks to appraise gems or identify magical gemstones' },
  { tool: "Leatherworker's Tools", skills: ['Investigation', 'Survival'], benefit: 'Advantage on checks to identify leather types or repair leather goods' },
  { tool: "Mason's Tools", skills: ['Investigation', 'Perception'], benefit: 'Advantage on checks to find secret doors or weak points in stone structures' },
  { tool: "Navigator's Tools", skills: ['Survival'], benefit: 'Advantage on checks to navigate or determine position' },
  { tool: "Painter's Supplies", skills: ['Investigation', 'Perception'], benefit: 'Advantage on checks to discern forgeries or notice visual details' },
  { tool: "Poisoner's Kit", skills: ['Medicine', 'Nature'], benefit: 'Advantage on checks to identify or treat poisons' },
  { tool: "Potter's Tools", skills: ['History', 'Investigation'], benefit: 'Advantage on checks to date ceramic artifacts or identify cultural origins' },
  { tool: "Smith's Tools", skills: ['Arcana', 'Investigation'], benefit: 'Advantage on checks to identify metal weapons/armor or assess metalwork quality' },
  { tool: "Thieves' Tools", skills: ['Investigation', 'Perception'], benefit: 'Advantage on checks to find or disable traps' },
  { tool: "Tinker's Tools", skills: ['Investigation'], benefit: 'Advantage on checks to repair or understand mechanical devices' },
  { tool: "Weaver's Tools", skills: ['Investigation', 'Perception'], benefit: 'Advantage on checks to identify fabric types or find hidden objects in cloth' },
  { tool: "Woodcarver's Tools", skills: ['Nature', 'Survival'], benefit: 'Advantage on checks involving wood identification or crafting wooden items' }
]

/**
 * Check if a tool proficiency grants advantage on a specific skill check.
 */
export function getToolSkillAdvantage(
  toolProficiencies: string[],
  skillName: string
): ToolSkillInteraction | null {
  for (const interaction of TOOL_SKILL_INTERACTIONS) {
    if (
      toolProficiencies.some((t) => t.toLowerCase() === interaction.tool.toLowerCase()) &&
      interaction.skills.some((s) => s.toLowerCase() === skillName.toLowerCase())
    ) {
      return interaction
    }
  }
  return null
}

export function getWildShapeMax(druidLevel: number): number {
  if (druidLevel < 2) return 0
  if (druidLevel <= 5) return 2
  if (druidLevel <= 16) return 3
  return 4 // levels 17-20
}

// ─── Armor Class (PHB 2024 Chapter 1) ────────────────────────

export interface ArmorForAC {
  acBonus: number
  equipped: boolean
  type: 'armor' | 'shield' | 'clothing'
  category?: string
  dexCap?: number | null
}

export interface ArmorClassOptions {
  dexMod: number
  armor: ArmorForAC[]
  classNames?: string[]
  conMod?: number
  wisMod?: number
  draconicSorcererLevel?: number
  acBonusFromEffects?: number
}

/**
 * Calculate Armor Class per PHB 2024 rules.
 *
 * PHB 2024 AC rules:
 *   - Base: 10 + DEX mod
 *   - Light armor: armor base AC + DEX mod (no cap)
 *   - Medium armor: armor base AC + DEX mod (max +2 unless Medium Armor Master)
 *   - Heavy armor: armor base AC (no DEX)
 *   - Shield: adds its bonus (typically +2)
 *   - Unarmored Defense (Barbarian): 10 + DEX + CON
 *   - Unarmored Defense (Monk): 10 + DEX + WIS
 *   - Draconic Resilience (Sorcerer 3+): 13 + DEX
 *   - Only one base AC formula applies; use the highest
 */
export function calculateArmorClass5e(options: ArmorClassOptions): number {
  const { dexMod, armor, classNames = [], conMod = 0, wisMod = 0, draconicSorcererLevel = 0, acBonusFromEffects = 0 } =
    options

  const equippedArmor = armor.find((a) => a.type === 'armor' && a.equipped)
  const equippedShield = armor.find((a) => a.type === 'shield' && a.equipped)

  let baseAC: number

  if (equippedArmor) {
    const cat = equippedArmor.category?.toLowerCase()
    if (cat === 'heavy') {
      baseAC = 10 + equippedArmor.acBonus
    } else if (cat === 'medium') {
      const dexBonus = Math.min(dexMod, equippedArmor.dexCap ?? 2)
      baseAC = 10 + equippedArmor.acBonus + dexBonus
    } else {
      baseAC = 10 + equippedArmor.acBonus + dexMod
    }
  } else {
    // No armor equipped — check unarmored defense options, take highest
    baseAC = 10 + dexMod

    const classNamesLower = classNames.map((c) => c.toLowerCase())

    if (classNamesLower.includes('barbarian')) {
      baseAC = Math.max(baseAC, 10 + dexMod + conMod)
    }
    if (classNamesLower.includes('monk')) {
      baseAC = Math.max(baseAC, 10 + dexMod + wisMod)
    }
    if (draconicSorcererLevel >= 3) {
      baseAC = Math.max(baseAC, 13 + dexMod)
    }
  }

  if (equippedShield) {
    baseAC += equippedShield.acBonus
  }

  baseAC += acBonusFromEffects

  return baseAC
}

export function calculate5eStats(
  baseScores: AbilityScoreSet,
  species: SpeciesData | null,
  cls: ClassData | null,
  level: number,
  backgroundAbilityBonuses?: Partial<Record<AbilityName, number>>,
  speciesId?: string | null,
  feats?: Array<{ id: string }> | null,
  draconicSorcererLevel?: number,
  resolvedEffects?: ResolvedEffects
): DerivedStats5e {
  // Apply species bonuses (or flexible species ability bonuses for 2024 species)
  const scores: AbilityScoreSet = { ...baseScores }
  if (species && Object.keys(species.abilityBonuses).length > 0) {
    for (const [ability, bonus] of Object.entries(species.abilityBonuses)) {
      scores[ability as AbilityName] += bonus as number
    }
  } else if (backgroundAbilityBonuses) {
    for (const [ability, bonus] of Object.entries(backgroundAbilityBonuses)) {
      scores[ability as AbilityName] += bonus as number
    }
  }

  // Apply ability score overrides from magic items (e.g., Amulet of Health sets CON to 19)
  if (resolvedEffects?.abilityScoreOverrides) {
    for (const [ability, minValue] of Object.entries(resolvedEffects.abilityScoreOverrides)) {
      const key = ability as AbilityName
      if (key in scores && minValue !== undefined && minValue > scores[key]) {
        scores[key] = minValue
      }
    }
  }

  // Compute modifiers
  const modifiers: AbilityScoreSet = {
    strength: abilityModifier(scores.strength),
    dexterity: abilityModifier(scores.dexterity),
    constitution: abilityModifier(scores.constitution),
    intelligence: abilityModifier(scores.intelligence),
    wisdom: abilityModifier(scores.wisdom),
    charisma: abilityModifier(scores.charisma)
  }

  const proficiencyBonus = level <= 20 ? Math.ceil(level / 4) + 1 : Math.ceil((level - 1) / 4) + 1
  const hitDie = cls?.hitDie ?? 8
  const conMod = modifiers.constitution

  // HP: max at level 1, average + CON for subsequent levels
  let maxHP = hitDie + conMod
  for (let i = 2; i <= level; i++) {
    maxHP += Math.floor(hitDie / 2) + 1 + conMod
  }
  // Add HP bonuses from species traits (Dwarven Toughness) and feats (Tough)
  maxHP += calculateHPBonusFromTraits(level, speciesId ?? null, feats ?? null, draconicSorcererLevel)
  // Add HP bonuses from resolved effects (e.g., Tough feat via effect system)
  if (resolvedEffects) maxHP += resolvedEffects.hpBonus
  maxHP = Math.max(maxHP, 1)

  const armorClass = 10 + modifiers.dexterity

  // Initiative: DEX mod + proficiency bonus if Alert feat
  let initiative = modifiers.dexterity
  if (feats?.some((f) => f.id === 'alert')) initiative += proficiencyBonus
  // Add initiative bonuses from resolved effects (supplements feat check above)
  if (resolvedEffects) initiative += resolvedEffects.initiativeBonus

  // Speed: base + feat bonuses
  let speed = species?.speed ?? 30
  if (feats?.some((f) => f.id === 'speedy')) speed += 10
  if (feats?.some((f) => f.id === 'boon-of-speed')) speed += 30
  // Add speed bonuses from resolved effects
  if (resolvedEffects) speed += resolvedEffects.speedBonus

  // Saving throws
  const savingThrows: Record<string, number> = {}
  const proficientSaves = (cls?.savingThrows ?? []).map((s) => s.toLowerCase())
  // Resilient feat grants save proficiency for chosen ability
  const resilientAbility = feats?.find((f) => f.id === 'resilient') as
    | { id: string; choices?: Record<string, string | string[]> }
    | undefined
  const resilientSave = (
    resilientAbility as { choices?: { ability?: string } } | undefined
  )?.choices?.ability?.toLowerCase()
  for (const ability of Object.keys(scores) as AbilityName[]) {
    const isProficient = proficientSaves.includes(ability) || resilientSave === ability
    savingThrows[ability] = modifiers[ability] + (isProficient ? proficiencyBonus : 0)
  }

  return {
    abilityScores: scores,
    abilityModifiers: modifiers,
    maxHP,
    armorClass,
    initiative,
    speed,
    proficiencyBonus,
    savingThrows
  }
}
