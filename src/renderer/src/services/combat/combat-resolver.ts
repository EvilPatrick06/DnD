/**
 * Unified Combat Resolution Pipeline — D&D 5e 2024
 *
 * Wires together dice-service, damage-resolver, effect-resolver-5e,
 * attack-condition-effects, cover-calculator, and combat-rules into
 * a single attack → AC check → damage → broadcast flow.
 *
 * PHB 2024 Chapter 1 (Combat), Chapter 7 (Spellcasting)
 */

import {
  type AttackConditionContext,
  type ConditionEffectResult,
  getAttackConditionEffects
} from './attack-condition-effects'
import {
  type CoverType,
  canGrappleOrShove,
  checkRangedRange,
  getCoverACBonus,
  getCoverDexSaveBonus,
  getMasteryEffect,
  gridDistanceFeet,
  isInMeleeRange,
  type MasteryEffectResult,
  unarmedStrikeDC
} from './combat-rules'
import { calculateCover } from './cover-calculator'
import { type DamageApplication, type DamageResolutionSummary, resolveDamage } from './damage-resolver'
import {
  type DiceRollOptions,
  type DiceRollResult,
  roll,
  rollD20,
  rollQuiet
} from '../dice/dice-service'
import type { MapToken, WallSegment } from '../../types/map'
import type { EntityCondition, TurnState } from '../../types/game-state'
import { useGameStore } from '../../stores/useGameStore'
import { useLobbyStore } from '../../stores/useLobbyStore'
import { useNetworkStore } from '../../stores/useNetworkStore'

// ─── Types ────────────────────────────────────────────────────

export type AttackType = 'melee_weapon' | 'ranged_weapon' | 'melee_spell' | 'ranged_spell'

export interface AttackRequest {
  attackerToken: MapToken
  targetToken: MapToken
  attackType: AttackType
  /** Attack roll bonus (STR/DEX mod + proficiency + magic) */
  attackBonus: number
  /** Damage formula (e.g. "1d8+4") */
  damageFormula: string
  /** Damage type (e.g. "slashing") */
  damageType: string
  /** Whether the weapon/attack is magical */
  isMagical?: boolean
  /** Whether the weapon is silvered */
  isSilvered?: boolean
  /** Weapon mastery property, if any */
  weaponMastery?: string
  /** Ability modifier used for attack (for weapon mastery calculations) */
  abilityModifier: number
  /** Attacker's proficiency bonus */
  proficiencyBonus: number
  /** Weapon normal range (for ranged only) */
  normalRange?: number
  /** Weapon long range (for ranged only) */
  longRange?: number
  /** Melee reach in feet (default 5) */
  reach?: number
  /** Additional damage dice from effects (e.g. Sneak Attack, Smite) */
  extraDamageDice?: Array<{ formula: string; damageType: string }>
  /** Extra flat damage bonuses from feats/effects */
  extraDamageBonus?: number
  /** Override advantage/disadvantage */
  forceAdvantage?: boolean
  /** Override advantage/disadvantage */
  forceDisadvantage?: boolean
  /** Attacker's name for display */
  attackerName: string
  /** Target's name for display */
  targetName: string
  /** Weapon/spell name for display */
  weaponName: string
  /** Is this a DM roll (hidden from players)? */
  isSecretRoll?: boolean
}

export interface AttackResult {
  /** Whether the attack hit */
  hit: boolean
  /** Whether it was a critical hit (nat 20) */
  isCritical: boolean
  /** Whether it was a critical miss (nat 1) */
  isCriticalMiss: boolean
  /** The attack roll result */
  attackRoll: DiceRollResult
  /** Target AC (including cover) */
  targetAC: number
  /** Cover type applied */
  cover: CoverType
  /** Condition effects applied */
  conditionEffects: ConditionEffectResult
  /** Damage resolution (null if miss) */
  damage: DamageResolutionSummary | null
  /** Raw damage rolled before resolution (null if miss) */
  rawDamageRoll: DiceRollResult | null
  /** Weapon mastery effect (null if none) */
  masteryEffect: MasteryEffectResult | null
  /** Graze damage applied on miss (Graze mastery) */
  grazeDamage: number
  /** Whether the attacker couldn't act (incapacitated) */
  attackerBlocked: boolean
  /** Range category for ranged attacks */
  rangeCategory?: 'normal' | 'long' | 'out-of-range'
  /** Human-readable summary for chat */
  summary: string
}

export interface SavingThrowRequest {
  /** Entity making the save */
  targetToken: MapToken
  targetName: string
  /** Ability for the save (e.g. "dexterity") */
  ability: string
  /** Save DC */
  dc: number
  /** Save modifier (ability mod + proficiency if proficient) */
  saveModifier: number
  /** Damage formula on failed save (optional) */
  damageFormula?: string
  /** Damage type */
  damageType?: string
  /** Half damage on success? */
  halfOnSuccess?: boolean
  /** Additional effects on failure */
  failureEffect?: string
  /** Caster/source name */
  sourceName: string
  /** Spell/ability name */
  abilityName: string
  /** Conditions on the target (for advantage/disadvantage on saves) */
  targetConditions?: Array<{ name: string; value?: number }>
  /** Whether this is a DM roll */
  isSecretRoll?: boolean
  /** Cover type for DEX saves (provides bonus) */
  cover?: CoverType
}

export interface SavingThrowResult {
  /** Whether the save succeeded */
  success: boolean
  /** The save roll */
  saveRoll: DiceRollResult
  /** Total rolled (including modifier) */
  total: number
  /** The DC */
  dc: number
  /** Damage dealt (0 if save succeeded with no half-damage) */
  damage: DamageResolutionSummary | null
  /** Summary for chat */
  summary: string
}

export interface GrappleRequest {
  attackerToken: MapToken
  targetToken: MapToken
  attackerName: string
  targetName: string
  /** Attacker's Athletics modifier (not used for DC, kept for display) */
  attackerAthleticsBonus: number
  /** Target's STR or DEX saving throw modifier (target's choice per PHB 2024) */
  targetEscapeBonus: number
  /** Attacker's STR score (for Unarmed Strike DC: 8 + STR mod + proficiency) */
  attackerStrScore: number
  /** Attacker's proficiency bonus */
  proficiencyBonus: number
}

export interface GrappleResult {
  success: boolean
  /** Attacker's contested roll */
  attackerRoll: DiceRollResult
  /** Target's save roll */
  targetRoll: DiceRollResult
  /** Unarmed strike DC */
  dc: number
  summary: string
}

export interface ShoveRequest {
  attackerToken: MapToken
  targetToken: MapToken
  attackerName: string
  targetName: string
  /** Attacker's Athletics modifier (not used for DC, kept for display) */
  attackerAthleticsBonus: number
  /** Target's STR or DEX saving throw modifier (target's choice per PHB 2024) */
  targetEscapeBonus: number
  /** Attacker's STR score (for Unarmed Strike DC: 8 + STR mod + proficiency) */
  attackerStrScore: number
  /** Attacker's proficiency bonus */
  proficiencyBonus: number
  /** Shove prone or push 5ft */
  shoveType: 'prone' | 'push'
}

export type ShoveResult = GrappleResult

// ─── Combat Resolver Functions ────────────────────────────────

/**
 * Resolve a full attack action: roll → check AC → damage → mastery → broadcast.
 */
export function resolveAttack(
  request: AttackRequest,
  walls: WallSegment[],
  cellSize: number,
  allTokens: MapToken[],
  conditions: EntityCondition[],
  turnStates: Record<string, TurnState>,
  underwaterCombat: boolean,
  flankingAlly: string | null
): AttackResult {
  const {
    attackerToken,
    targetToken,
    attackType,
    attackBonus,
    damageFormula,
    damageType,
    isMagical = false,
    isSilvered = false,
    weaponMastery,
    abilityModifier: abilityMod,
    proficiencyBonus,
    normalRange,
    longRange,
    reach = 5,
    extraDamageDice = [],
    extraDamageBonus = 0,
    forceAdvantage,
    forceDisadvantage,
    attackerName,
    targetName,
    weaponName,
    isSecretRoll = false
  } = request

  const isRanged = attackType === 'ranged_weapon' || attackType === 'ranged_spell'

  // ── Check attacker conditions ──
  const attackerConditions = conditions
    .filter((c) => c.entityId === attackerToken.entityId)
    .map((c) => ({ name: c.condition, value: c.value }))
  const targetConditions = conditions
    .filter((c) => c.entityId === targetToken.entityId)
    .map((c) => ({ name: c.condition, value: c.value }))

  const targetTurn = turnStates[targetToken.entityId]

  // Check for enemies within 5ft of attacker (for ranged disadvantage)
  const enemyWithin5ft = allTokens.some(
    (t) =>
      t.id !== attackerToken.id &&
      t.entityType !== attackerToken.entityType &&
      isInMeleeRange(attackerToken, t)
  )

  const conditionContext: AttackConditionContext = {
    isRanged,
    isWithin5ft: isInMeleeRange(attackerToken, targetToken, reach),
    anyEnemyWithin5ftOfAttacker: enemyWithin5ft,
    targetIsDodging: targetTurn?.isDodging,
    isUnderwater: underwaterCombat,
    weaponDamageType: damageType,
    attackerHasSwimSpeed: (attackerToken.swimSpeed ?? 0) > 0,
    flankingAlly
  }

  const conditionEffects = getAttackConditionEffects(attackerConditions, targetConditions, conditionContext)

  // ── Check if attacker can act ──
  if (conditionEffects.attackerCannotAct) {
    return {
      hit: false,
      isCritical: false,
      isCriticalMiss: false,
      attackRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      targetAC: targetToken.ac ?? 10,
      cover: 'none',
      conditionEffects,
      damage: null,
      rawDamageRoll: null,
      masteryEffect: null,
      grazeDamage: 0,
      attackerBlocked: true,
      summary: `${attackerName} cannot attack (incapacitated).`
    }
  }

  // ── Check range ──
  let rangeCategory: 'normal' | 'long' | 'out-of-range' | undefined
  if (isRanged && normalRange && longRange) {
    rangeCategory = checkRangedRange(attackerToken, targetToken, normalRange, longRange)
    if (rangeCategory === 'out-of-range') {
      return {
        hit: false,
        isCritical: false,
        isCriticalMiss: false,
        attackRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
        targetAC: targetToken.ac ?? 10,
        cover: 'none',
        conditionEffects,
        damage: null,
        rawDamageRoll: null,
        masteryEffect: null,
        grazeDamage: 0,
        attackerBlocked: false,
        rangeCategory,
        summary: `${attackerName}'s ${weaponName} attack is out of range!`
      }
    }
  } else if (!isRanged) {
    if (!isInMeleeRange(attackerToken, targetToken, reach)) {
      return {
        hit: false,
        isCritical: false,
        isCriticalMiss: false,
        attackRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
        targetAC: targetToken.ac ?? 10,
        cover: 'none',
        conditionEffects,
        damage: null,
        rawDamageRoll: null,
        masteryEffect: null,
        grazeDamage: 0,
        attackerBlocked: false,
        summary: `${attackerName}'s ${weaponName} attack is out of melee range!`
      }
    }
  }

  // ── Calculate cover ──
  const cover = calculateCover(attackerToken, targetToken, walls, cellSize, allTokens)
  if (cover === 'total') {
    return {
      hit: false,
      isCritical: false,
      isCriticalMiss: false,
      attackRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      targetAC: targetToken.ac ?? 10,
      cover,
      conditionEffects,
      damage: null,
      rawDamageRoll: null,
      masteryEffect: null,
      grazeDamage: 0,
      attackerBlocked: false,
      summary: `${targetName} has total cover — ${attackerName} cannot target them.`
    }
  }

  const coverACBonus = getCoverACBonus(cover)
  const targetAC = (targetToken.ac ?? 10) + coverACBonus

  // ── Determine advantage/disadvantage ──
  let rollOptions: DiceRollOptions = {
    label: `${weaponName} Attack`,
    silent: true,
    secret: isSecretRoll
  }

  // Long range gives disadvantage
  if (rangeCategory === 'long') {
    conditionEffects.disadvantageSources.push('Long range')
    // Recompute rollMode
    if (conditionEffects.advantageSources.length > 0) {
      conditionEffects.rollMode = 'normal'
    } else {
      conditionEffects.rollMode = 'disadvantage'
    }
  }

  // Apply forced advantage/disadvantage
  if (forceAdvantage) {
    rollOptions.advantage = true
  } else if (forceDisadvantage) {
    rollOptions.disadvantage = true
  } else {
    rollOptions.advantage = conditionEffects.rollMode === 'advantage'
    rollOptions.disadvantage = conditionEffects.rollMode === 'disadvantage'
  }

  // ── Roll attack ──
  const totalBonus = attackBonus + conditionEffects.exhaustionPenalty
  const attackRoll = rollD20(totalBonus, rollOptions)

  // ── Determine hit/miss ──
  // PHB 2024: Natural 20 always hits, Natural 1 always misses
  const isCritical = attackRoll.natural20 && !conditionEffects.attackerCannotAct
  const isCriticalMiss = attackRoll.natural1
  const hit = isCritical || (!isCriticalMiss && attackRoll.total >= targetAC)

  // Auto-crit if target is Paralyzed/Unconscious within 5ft
  const effectiveCrit = isCritical || (hit && conditionEffects.autoCrit)

  // ── Resolve damage on hit ──
  let damage: DamageResolutionSummary | null = null
  let rawDamageRoll: DiceRollResult | null = null
  let grazeDamage = 0

  if (hit) {
    // Roll damage
    rawDamageRoll = rollDamage(damageFormula, effectiveCrit, extraDamageDice, isSecretRoll)

    // Build damage applications
    const damages: DamageApplication[] = [
      {
        rawDamage: rawDamageRoll.total + extraDamageBonus,
        damageType,
        isMagical,
        isFromSilveredWeapon: isSilvered
      }
    ]

    // Resolve against target resistances/immunities
    damage = resolveDamage(
      damages,
      targetToken.resistances ?? [],
      targetToken.immunities ?? [],
      targetToken.vulnerabilities ?? [],
      false, // Heavy Armor Master (would need character data)
      false, // Wearing heavy armor
      underwaterCombat
    )
  }

  // ── Weapon mastery effect ──
  let masteryEffect: MasteryEffectResult | null = null
  if (weaponMastery) {
    masteryEffect = getMasteryEffect(weaponMastery, abilityMod, proficiencyBonus, hit)

    // Graze: deal ability modifier damage on miss
    if (!hit && masteryEffect?.grazeDamage) {
      grazeDamage = masteryEffect.grazeDamage
      // Apply graze damage through resolution
      const grazeDamages: DamageApplication[] = [
        { rawDamage: grazeDamage, damageType, isMagical, isFromSilveredWeapon: isSilvered }
      ]
      const grazeResolved = resolveDamage(
        grazeDamages,
        targetToken.resistances ?? [],
        targetToken.immunities ?? [],
        targetToken.vulnerabilities ?? [],
        false,
        false,
        underwaterCombat
      )
      grazeDamage = grazeResolved.totalFinalDamage
    }
  }

  // ── Build summary ──
  const summary = buildAttackSummary(
    attackerName,
    targetName,
    weaponName,
    attackRoll,
    targetAC,
    hit,
    effectiveCrit,
    isCriticalMiss,
    damage,
    grazeDamage,
    cover,
    conditionEffects,
    masteryEffect
  )

  // ── Apply damage to token HP ──
  if (hit && damage) {
    applyDamageToToken(targetToken, damage.totalFinalDamage)
  } else if (grazeDamage > 0) {
    applyDamageToToken(targetToken, grazeDamage)
  }

  // ── Log to combat log ──
  logCombatEntry({
    type: 'attack',
    sourceEntityId: attackerToken.entityId,
    sourceEntityName: attackerName,
    targetEntityId: targetToken.entityId,
    targetEntityName: targetName,
    value: hit ? damage?.totalFinalDamage ?? 0 : grazeDamage,
    damageType: hit ? damageType : grazeDamage > 0 ? `${damageType} (graze)` : undefined,
    description: summary
  })

  // ── Broadcast result ──
  broadcastCombatResult(summary, isSecretRoll)

  return {
    hit,
    isCritical: effectiveCrit,
    isCriticalMiss,
    attackRoll,
    targetAC,
    cover,
    conditionEffects,
    damage,
    rawDamageRoll,
    masteryEffect,
    grazeDamage,
    attackerBlocked: false,
    rangeCategory,
    summary
  }
}

/**
 * Resolve a saving throw (typically from a spell or ability).
 */
export function resolveSavingThrow(request: SavingThrowRequest): SavingThrowResult {
  const {
    targetToken,
    targetName,
    ability,
    dc,
    saveModifier,
    damageFormula,
    damageType,
    halfOnSuccess = false,
    failureEffect,
    sourceName,
    abilityName,
    targetConditions = [],
    isSecretRoll = false,
    cover
  } = request

  // DEX save cover bonus
  let totalModifier = saveModifier
  if (ability.toLowerCase() === 'dexterity' && cover) {
    totalModifier += getCoverDexSaveBonus(cover)
  }

  // Check for condition-based advantage on saves
  const hasAdvantage = targetConditions.some(
    (c) => c.name.toLowerCase() === 'magic resistance' // Monsters with Magic Resistance
  )

  const saveRoll = rollD20(totalModifier, {
    label: `${ability} Save`,
    silent: true,
    secret: isSecretRoll,
    advantage: hasAdvantage
  })

  const total = saveRoll.total
  const success = total >= dc

  // Resolve damage
  let damage: DamageResolutionSummary | null = null
  if (damageFormula && damageType) {
    const rawDmg = rollQuiet(damageFormula)
    let damageAmount = rawDmg.total

    if (success && halfOnSuccess) {
      damageAmount = Math.floor(damageAmount / 2)
    } else if (success) {
      damageAmount = 0
    }

    if (damageAmount > 0) {
      damage = resolveDamage(
        [{ rawDamage: damageAmount, damageType, isMagical: true }],
        targetToken.resistances ?? [],
        targetToken.immunities ?? [],
        targetToken.vulnerabilities ?? [],
        false,
        false
      )

      // Apply damage
      applyDamageToToken(targetToken, damage.totalFinalDamage)
    }
  }

  // Build summary
  const parts: string[] = []
  parts.push(`${targetName} rolls ${ability} save: ${saveRoll.total} vs DC ${dc}`)
  parts.push(success ? '— Success!' : '— Failure!')
  if (damage && damage.totalFinalDamage > 0) {
    parts.push(`Takes ${damage.totalFinalDamage} ${damageType} damage.`)
  } else if (success && halfOnSuccess && damage) {
    parts.push(`Takes ${damage.totalFinalDamage} ${damageType} damage (halved).`)
  }
  if (!success && failureEffect) {
    parts.push(`Effect: ${failureEffect}`)
  }
  const summary = parts.join(' ')

  // Log
  logCombatEntry({
    type: 'save',
    sourceEntityName: sourceName,
    targetEntityId: targetToken.entityId,
    targetEntityName: targetName,
    value: damage?.totalFinalDamage ?? 0,
    damageType,
    description: summary
  })

  broadcastCombatResult(summary, isSecretRoll)

  return { success, saveRoll, total, dc, damage, summary }
}

/**
 * Resolve a grapple attempt (PHB 2024).
 * Attacker: Unarmed Strike save DC (8 + STR mod + proficiency).
 * Target: STR or DEX save (target's choice).
 */
export function resolveGrapple(request: GrappleRequest): GrappleResult {
  const {
    attackerToken,
    targetToken,
    attackerName,
    targetName,
    attackerStrScore,
    proficiencyBonus,
    targetEscapeBonus
  } = request

  // Size check
  if (!canGrappleOrShove(attackerToken, targetToken)) {
    return {
      success: false,
      attackerRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      targetRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      dc: 0,
      summary: `${attackerName} cannot grapple ${targetName} — target is too large!`
    }
  }

  const dc = unarmedStrikeDC(attackerStrScore, proficiencyBonus)
  const attackerRoll = rollD20(0, { label: 'Grapple DC', silent: true })
  const targetRoll = rollD20(targetEscapeBonus, { label: 'Escape Grapple', silent: true })
  const success = targetRoll.total < dc

  const summary = success
    ? `${attackerName} grapples ${targetName}! (DC ${dc}, target rolled ${targetRoll.total}) — ${targetName} is Grappled.`
    : `${attackerName}'s grapple attempt fails! (DC ${dc}, target rolled ${targetRoll.total})`

  // Apply grappled condition on success
  if (success) {
    const gameStore = useGameStore.getState()
    gameStore.addCondition({
      id: crypto.randomUUID(),
      entityId: targetToken.entityId,
      entityName: targetName,
      condition: 'Grappled',
      duration: 'permanent',
      source: `Grappled by ${attackerName}`,
      sourceEntityId: attackerToken.entityId,
      appliedRound: gameStore.round
    })
  }

  logCombatEntry({
    type: 'attack',
    sourceEntityId: attackerToken.entityId,
    sourceEntityName: attackerName,
    targetEntityId: targetToken.entityId,
    targetEntityName: targetName,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { success, attackerRoll, targetRoll, dc, summary }
}

/**
 * Resolve a shove attempt (PHB 2024).
 * Same DC as grapple. Target falls Prone or is pushed 5 ft.
 */
export function resolveShove(request: ShoveRequest): ShoveResult {
  const {
    attackerToken,
    targetToken,
    attackerName,
    targetName,
    attackerStrScore,
    proficiencyBonus,
    targetEscapeBonus,
    shoveType
  } = request

  if (!canGrappleOrShove(attackerToken, targetToken)) {
    return {
      success: false,
      attackerRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      targetRoll: { formula: '—', rolls: [0], total: 0, natural20: false, natural1: false },
      dc: 0,
      summary: `${attackerName} cannot shove ${targetName} — target is too large!`
    }
  }

  const dc = unarmedStrikeDC(attackerStrScore, proficiencyBonus)
  const attackerRoll = rollD20(0, { label: 'Shove DC', silent: true })
  const targetRoll = rollD20(targetEscapeBonus, { label: 'Resist Shove', silent: true })
  const success = targetRoll.total < dc

  let summary: string
  if (success && shoveType === 'prone') {
    summary = `${attackerName} shoves ${targetName} Prone! (DC ${dc}, target rolled ${targetRoll.total})`
    const gameStore = useGameStore.getState()
    gameStore.addCondition({
      id: crypto.randomUUID(),
      entityId: targetToken.entityId,
      entityName: targetName,
      condition: 'Prone',
      duration: 'permanent',
      source: `Shoved by ${attackerName}`,
      sourceEntityId: attackerToken.entityId,
      appliedRound: gameStore.round
    })
  } else if (success && shoveType === 'push') {
    summary = `${attackerName} pushes ${targetName} 5 ft away! (DC ${dc}, target rolled ${targetRoll.total})`
  } else {
    summary = `${attackerName}'s shove attempt fails! (DC ${dc}, target rolled ${targetRoll.total})`
  }

  logCombatEntry({
    type: 'attack',
    sourceEntityId: attackerToken.entityId,
    sourceEntityName: attackerName,
    targetEntityId: targetToken.entityId,
    targetEntityName: targetName,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { success, attackerRoll, targetRoll, dc, summary }
}

// ─── Concentration Check (PHB 2024 p.236) ─────────────────────

/**
 * Perform a concentration check when a concentrating creature takes damage.
 * DC = max(10, floor(damage / 2)). CON save.
 * Returns true if concentration is maintained.
 */
export function resolveConcentrationCheck(
  entityId: string,
  entityName: string,
  damageTaken: number,
  conSaveModifier: number,
  hasWarCasterAdvantage: boolean = false
): { maintained: boolean; roll: DiceRollResult; dc: number; summary: string } {
  const dc = Math.max(10, Math.floor(damageTaken / 2))

  const saveRoll = rollD20(conSaveModifier, {
    label: 'Concentration',
    silent: true,
    advantage: hasWarCasterAdvantage
  })

  const maintained = saveRoll.total >= dc

  const gameStore = useGameStore.getState()
  const concentratingSpell = gameStore.turnStates[entityId]?.concentratingSpell

  if (!maintained && concentratingSpell) {
    // Drop concentration
    gameStore.setConcentrating(entityId, undefined)
  }

  const summary = maintained
    ? `${entityName} maintains concentration on ${concentratingSpell ?? 'spell'}. (CON save: ${saveRoll.total} vs DC ${dc})`
    : `${entityName} loses concentration on ${concentratingSpell ?? 'spell'}! (CON save: ${saveRoll.total} vs DC ${dc})`

  logCombatEntry({
    type: 'save',
    targetEntityId: entityId,
    targetEntityName: entityName,
    value: saveRoll.total,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { maintained, roll: saveRoll, dc, summary }
}

// ─── Death Save Mechanics (PHB 2024 p.230) ─────────────────────

export interface DeathSaveState {
  successes: number
  failures: number
}

export interface DeathSaveResult {
  roll: DiceRollResult
  successes: number
  failures: number
  outcome: 'continue' | 'stabilized' | 'dead' | 'revived'
  summary: string
}

/**
 * Roll a death saving throw at the start of a turn.
 * - Nat 20: regain 1 HP (revived).
 * - Nat 1: counts as 2 failures.
 * - >= 10: success. < 10: failure.
 * - 3 successes = stabilized. 3 failures = dead.
 */
export function resolveDeathSave(
  entityId: string,
  entityName: string,
  currentState: DeathSaveState
): DeathSaveResult {
  const saveRoll = rollD20(0, { label: 'Death Save', silent: true })

  let { successes, failures } = currentState

  if (saveRoll.natural20) {
    // Nat 20: regain 1 HP
    successes = 0
    failures = 0
    const summary = `${entityName} rolls a Natural 20 on their death save — they regain 1 HP!`

    logCombatEntry({
      type: 'death',
      targetEntityId: entityId,
      targetEntityName: entityName,
      value: 1,
      description: summary
    })

    broadcastCombatResult(summary, false)

    return { roll: saveRoll, successes, failures, outcome: 'revived', summary }
  }

  if (saveRoll.natural1) {
    failures += 2
  } else if (saveRoll.total >= 10) {
    successes += 1
  } else {
    failures += 1
  }

  let outcome: DeathSaveResult['outcome'] = 'continue'
  let summary: string

  if (successes >= 3) {
    outcome = 'stabilized'
    summary = `${entityName} is stabilized! (Death saves: ${successes} successes)`
  } else if (failures >= 3) {
    outcome = 'dead'
    summary = `${entityName} has died! (Death saves: ${failures} failures)`
  } else {
    const rollDesc = saveRoll.natural1 ? 'Natural 1 (2 failures!)' : `${saveRoll.total}`
    summary = `${entityName} death save: ${rollDesc} — Successes: ${successes}/3, Failures: ${failures}/3`
  }

  logCombatEntry({
    type: 'death',
    targetEntityId: entityId,
    targetEntityName: entityName,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { roll: saveRoll, successes, failures, outcome, summary }
}

/**
 * Handle taking damage while at 0 HP (PHB 2024).
 * - Any damage = 1 death save failure.
 * - Critical hit = 2 death save failures.
 * - Damage >= maxHP remaining = instant death (massive damage).
 */
export function deathSaveDamageAtZero(
  entityId: string,
  entityName: string,
  currentState: DeathSaveState,
  damageTaken: number,
  isCritical: boolean,
  maxHP: number
): { failures: number; outcome: 'continue' | 'dead'; summary: string } {
  // Massive damage: if damage at 0 HP >= max HP, instant death
  if (damageTaken >= maxHP) {
    const summary = `${entityName} takes ${damageTaken} damage at 0 HP (max HP: ${maxHP}) — Massive damage! Instant death!`
    logCombatEntry({
      type: 'death',
      targetEntityId: entityId,
      targetEntityName: entityName,
      value: damageTaken,
      description: summary
    })
    broadcastCombatResult(summary, false)
    return { failures: 3, outcome: 'dead', summary }
  }

  const addedFailures = isCritical ? 2 : 1
  const newFailures = currentState.failures + addedFailures

  const outcome = newFailures >= 3 ? 'dead' : 'continue'
  const summary =
    outcome === 'dead'
      ? `${entityName} takes damage at 0 HP${isCritical ? ' (critical!)' : ''} — ${addedFailures} death save failure(s). ${entityName} has died!`
      : `${entityName} takes damage at 0 HP${isCritical ? ' (critical!)' : ''} — ${addedFailures} death save failure(s). Failures: ${newFailures}/3`

  logCombatEntry({
    type: 'death',
    targetEntityId: entityId,
    targetEntityName: entityName,
    value: damageTaken,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { failures: newFailures, outcome, summary }
}

// ─── Spell Slot Mechanics (PHB 2024 Chapter 7) ────────────────

export interface SpellSlotState {
  spellSlotLevels: Record<number, { current: number; max: number }>
  pactMagicSlotLevels?: Record<number, { current: number; max: number }>
}

/**
 * Attempt to spend a spell slot of the given level.
 * Returns true if successful, false if no slot available.
 */
export function expendSpellSlot(
  slots: SpellSlotState,
  level: number,
  usePactSlot: boolean = false
): { success: boolean; updatedSlots: SpellSlotState; summary: string } {
  if (level === 0) {
    // Cantrips don't use slots
    return { success: true, updatedSlots: slots, summary: 'Cantrip (no slot needed)' }
  }

  const slotPool = usePactSlot ? slots.pactMagicSlotLevels : slots.spellSlotLevels
  if (!slotPool) {
    return { success: false, updatedSlots: slots, summary: `No ${usePactSlot ? 'pact magic ' : ''}spell slots available.` }
  }

  const slot = slotPool[level]
  if (!slot || slot.current <= 0) {
    return {
      success: false,
      updatedSlots: slots,
      summary: `No level ${level} ${usePactSlot ? 'pact magic ' : ''}spell slots remaining.`
    }
  }

  const updatedPool = {
    ...slotPool,
    [level]: { ...slot, current: slot.current - 1 }
  }

  const updatedSlots: SpellSlotState = usePactSlot
    ? { ...slots, pactMagicSlotLevels: updatedPool }
    : { ...slots, spellSlotLevels: updatedPool }

  return {
    success: true,
    updatedSlots,
    summary: `Expended level ${level} ${usePactSlot ? 'pact magic ' : ''}spell slot. (${slot.current - 1}/${slot.max} remaining)`
  }
}

/**
 * Check if a spell can be cast as a ritual (no slot cost, +10 min casting time).
 * Requires: spell has ritual tag, caster has Ritual Caster feat or class feature.
 */
export function canCastAsRitual(spellLevel: number, isRitual: boolean, hasRitualCasting: boolean): boolean {
  return isRitual && hasRitualCasting && spellLevel > 0
}

/**
 * Get cantrip damage scaling based on character level (PHB 2024 p.236).
 * Cantrips scale at levels 5, 11, and 17.
 */
export function getCantripDiceCount(characterLevel: number): number {
  if (characterLevel >= 17) return 4
  if (characterLevel >= 11) return 3
  if (characterLevel >= 5) return 2
  return 1
}

/**
 * Scale a cantrip damage formula based on character level.
 * E.g., "1d10" at level 5 becomes "2d10", at level 11 becomes "3d10".
 */
export function scaleCantrip(baseFormula: string, characterLevel: number): string {
  const match = baseFormula.match(/^(\d*)d(\d+)(.*)$/)
  if (!match) return baseFormula
  const diceCount = getCantripDiceCount(characterLevel)
  const sides = match[2]
  const rest = match[3] || ''
  return `${diceCount}d${sides}${rest}`
}

// ─── Legendary Actions & Lair Actions ──────────────────────────

/**
 * Spend a legendary action. Returns remaining count.
 */
export function spendLegendaryAction(
  entryId: string,
  cost: number = 1
): { success: boolean; remaining: number; summary: string } {
  const gameStore = useGameStore.getState()
  const initiative = gameStore.initiative
  if (!initiative) return { success: false, remaining: 0, summary: 'No active initiative.' }

  const entry = initiative.entries.find((e) => e.id === entryId)
  if (!entry?.legendaryResistances) {
    return { success: false, remaining: 0, summary: 'This creature has no legendary actions.' }
  }

  // Using legendaryResistances to track legendary action budget as well
  // In real usage, a separate field would be ideal, but we reuse the existing field
  const remaining = entry.legendaryResistances.remaining
  if (remaining < cost) {
    return { success: false, remaining, summary: `Not enough legendary actions remaining (${remaining}/${entry.legendaryResistances.max}).` }
  }

  gameStore.updateInitiativeEntry(entryId, {
    legendaryResistances: {
      ...entry.legendaryResistances,
      remaining: remaining - cost
    }
  })

  return {
    success: true,
    remaining: remaining - cost,
    summary: `Legendary action used (cost: ${cost}). Remaining: ${remaining - cost}/${entry.legendaryResistances.max}`
  }
}

/**
 * Use a legendary resistance to auto-succeed a failed save.
 */
export function useLegendaryResistance(
  entryId: string,
  entityName: string,
  saveName: string
): { success: boolean; remaining: number; summary: string } {
  const gameStore = useGameStore.getState()
  const initiative = gameStore.initiative
  if (!initiative) return { success: false, remaining: 0, summary: 'No active initiative.' }

  const entry = initiative.entries.find((e) => e.id === entryId)
  if (!entry?.legendaryResistances || entry.legendaryResistances.remaining <= 0) {
    return { success: false, remaining: 0, summary: `${entityName} has no legendary resistances remaining.` }
  }

  const newRemaining = entry.legendaryResistances.remaining - 1
  gameStore.updateInitiativeEntry(entryId, {
    legendaryResistances: {
      ...entry.legendaryResistances,
      remaining: newRemaining
    }
  })

  const summary = `${entityName} uses Legendary Resistance to succeed on the ${saveName} save! (${newRemaining}/${entry.legendaryResistances.max} remaining)`

  logCombatEntry({
    type: 'save',
    targetEntityName: entityName,
    description: summary
  })

  broadcastCombatResult(summary, false)

  return { success: true, remaining: newRemaining, summary }
}

/**
 * Trigger lair actions at initiative count 20 (losing ties).
 * Returns true if a lair action should trigger.
 */
export function shouldTriggerLairAction(initiative: { entries: Array<{ inLair?: boolean }>, currentIndex: number }): boolean {
  // Lair actions fire at initiative 20, after any creature with initiative 20+
  // In practice: check if any entry with inLair flag is in the initiative
  return initiative.entries.some((e) => e.inLair)
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Roll damage with critical hit doubling (PHB 2024: double damage dice, not modifier).
 */
function rollDamage(
  formula: string,
  isCritical: boolean,
  extraDice: Array<{ formula: string; damageType: string }>,
  isSecret: boolean
): DiceRollResult {
  if (isCritical) {
    // Double the dice count for critical hits
    const critFormula = doubleDiceInFormula(formula)
    const critResult = roll(critFormula, { silent: true, secret: isSecret })

    // Extra damage dice also doubled on crit
    let extraTotal = 0
    for (const extra of extraDice) {
      const doubled = doubleDiceInFormula(extra.formula)
      const extraRoll = rollQuiet(doubled)
      extraTotal += extraRoll.total
    }

    return {
      ...critResult,
      total: critResult.total + extraTotal
    }
  }

  const baseResult = roll(formula, { silent: true, secret: isSecret })
  let extraTotal = 0
  for (const extra of extraDice) {
    const extraRoll = rollQuiet(extra.formula)
    extraTotal += extraRoll.total
  }

  return {
    ...baseResult,
    total: baseResult.total + extraTotal
  }
}

/**
 * Double the dice count in a formula (for critical hits).
 * "2d6+4" → "4d6+4", "1d8+3" → "2d8+3"
 */
function doubleDiceInFormula(formula: string): string {
  return formula.replace(/(\d*)d(\d+)/, (_, count, sides) => {
    const n = count ? parseInt(count, 10) : 1
    return `${n * 2}d${sides}`
  })
}

/** Apply damage to a token's HP via the game store. */
function applyDamageToToken(token: MapToken, damage: number): void {
  if (damage <= 0) return
  const gameStore = useGameStore.getState()
  const map = gameStore.maps.find((m) => m.id === gameStore.activeMapId)
  if (!map) return

  const currentHP = token.currentHP ?? 0
  const newHP = Math.max(0, currentHP - damage)
  gameStore.updateToken(map.id, token.id, { currentHP: newHP })
}

/** Add an entry to the combat log. */
function logCombatEntry(
  entry: Omit<import('../types/game-state').CombatLogEntry, 'id' | 'timestamp' | 'round'>
): void {
  const gameStore = useGameStore.getState()
  gameStore.addCombatLogEntry({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    round: gameStore.round
  })
}

/** Broadcast a combat result as a system chat message and network message. */
function broadcastCombatResult(summary: string, isSecret: boolean): void {
  if (isSecret) return

  const { addChatMessage } = useLobbyStore.getState()
  addChatMessage({
    id: `combat-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    senderId: 'system',
    senderName: 'Combat',
    content: summary,
    timestamp: Date.now(),
    isSystem: true
  })

  const { sendMessage } = useNetworkStore.getState()
  sendMessage('chat:message', { message: summary, isSystem: true })
}

/** Build a human-readable attack summary. */
function buildAttackSummary(
  attackerName: string,
  targetName: string,
  weaponName: string,
  attackRoll: DiceRollResult,
  targetAC: number,
  hit: boolean,
  isCritical: boolean,
  isCriticalMiss: boolean,
  damage: DamageResolutionSummary | null,
  grazeDamage: number,
  cover: CoverType,
  conditionEffects: ConditionEffectResult,
  masteryEffect: MasteryEffectResult | null
): string {
  const parts: string[] = []

  // Attack roll
  if (isCritical) {
    parts.push(`${attackerName} rolls a CRITICAL HIT with ${weaponName} against ${targetName}!`)
  } else if (isCriticalMiss) {
    parts.push(`${attackerName} rolls a Critical Miss with ${weaponName} against ${targetName}.`)
  } else if (hit) {
    parts.push(`${attackerName} hits ${targetName} with ${weaponName}! (${attackRoll.total} vs AC ${targetAC})`)
  } else {
    parts.push(`${attackerName} misses ${targetName} with ${weaponName}. (${attackRoll.total} vs AC ${targetAC})`)
  }

  // Cover
  if (cover !== 'none') {
    parts.push(`[${cover} cover]`)
  }

  // Advantage/disadvantage
  if (conditionEffects.rollMode !== 'normal') {
    parts.push(`[${conditionEffects.rollMode}]`)
  }

  // Damage
  if (hit && damage) {
    const dmgParts: string[] = []
    for (const r of damage.results) {
      let desc = `${r.finalDamage} ${r.damageType}`
      if (r.modification !== 'normal') desc += ` (${r.modification})`
      dmgParts.push(desc)
    }
    parts.push(`Damage: ${dmgParts.join(', ')}`)
  }

  // Graze
  if (!hit && grazeDamage > 0) {
    parts.push(`Graze: ${grazeDamage} damage.`)
  }

  // Mastery effect
  if (hit && masteryEffect && masteryEffect.mastery !== 'Graze') {
    parts.push(`[${masteryEffect.mastery}: ${masteryEffect.description}]`)
  }

  return parts.join(' ')
}
