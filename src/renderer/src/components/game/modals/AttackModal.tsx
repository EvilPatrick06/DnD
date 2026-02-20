import { useMemo, useState } from 'react'
import { trigger3dDice } from '../../../components/game/dice3d'
import { getAttackConditionEffects } from '../../../services/attack-condition-effects'
import {
  type CoverType,
  canGrappleOrShove,
  checkRangedRange,
  getCoverACBonus,
  getMasteryEffect,
  isAdjacent,
  isInMeleeRange,
  type MasteryEffectResult,
  unarmedStrikeDC
} from '../../../services/combat-rules'
import { calculateCover } from '../../../services/cover-calculator'
import { rollMultiple, rollSingle } from '../../../services/dice-service'
import { resolveEffects, type WeaponContext } from '../../../services/effect-resolver-5e'
import { checkFlanking as checkFlankingFn } from '../../../services/flanking'
import { useGameStore } from '../../../stores/useGameStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import { abilityModifier, formatMod } from '../../../types/character-common'
import type { MapToken } from '../../../types/map'
import { applyDamageToCharacter, type DamageApplicationResult } from '../../../utils/damage'

interface AttackModalProps {
  character: Character | null
  tokens: MapToken[]
  attackerToken: MapToken | null
  onClose: () => void
  onApplyDamage?: (
    targetTokenId: string,
    damage: number,
    damageType?: string,
    damageResult?: DamageApplicationResult
  ) => void
  onBroadcastResult?: (message: string) => void
}

type Step = 'weapon' | 'unarmed-mode' | 'target' | 'roll' | 'damage' | 'result'
type UnarmedMode = 'damage' | 'grapple' | 'shove'

function rollD20(): number {
  return rollSingle(20)
}

function rollDice(count: number, sides: number): number[] {
  return rollMultiple(count, sides)
}

function parseDamageDice(damage: string): { count: number; sides: number; modifier: number } | null {
  const match = damage.trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?/)
  if (!match) return null
  return {
    count: match[1] ? parseInt(match[1], 10) : 1,
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3].replace(/\s/g, ''), 10) : 0
  }
}

export default function AttackModal({
  character,
  tokens,
  attackerToken,
  onClose,
  onApplyDamage,
  onBroadcastResult
}: AttackModalProps): JSX.Element {
  const [step, setStep] = useState<Step>('weapon')
  const [selectedWeaponIndex, setSelectedWeaponIndex] = useState<number | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [cover, setCover] = useState<CoverType>('none')
  const [attackRoll, setAttackRoll] = useState<{
    d20: number
    d20_2?: number
    modifier: number
    total: number
    isCrit: boolean
    isFumble: boolean
  } | null>(null)
  const [damageResult, setDamageResult] = useState<{
    rolls: number[]
    modifier: number
    total: number
    isCrit: boolean
  } | null>(null)
  const [conditionOverrides, setConditionOverrides] = useState<Record<string, boolean>>({})
  const [damageAppResult, setDamageAppResult] = useState<DamageApplicationResult | null>(null)
  const [knockOutPrompt, setKnockOutPrompt] = useState(false)
  const [isHit, setIsHit] = useState<boolean | null>(null)
  const [masteryEffect, setMasteryEffect] = useState<MasteryEffectResult | null>(null)
  const [unarmedMode, setUnarmedMode] = useState<UnarmedMode>('damage')
  const [shoveChoice, setShoveChoice] = useState<'push' | 'prone'>('push')
  const [grappleResult, setGrappleResult] = useState<{ success: boolean; message: string } | null>(null)

  const gameConditions = useGameStore((s) => s.conditions)
  const turnStates = useGameStore((s) => s.turnStates)

  if (!character) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
          <p className="text-gray-400">No character selected</p>
          <button onClick={onClose} className="mt-3 px-4 py-1 text-sm bg-gray-700 rounded cursor-pointer">
            Close
          </button>
        </div>
      </div>
    )
  }

  const char5e = character as Character5e
  const profBonus = Math.ceil(character.level / 4) + 1
  const realWeapons = char5e.weapons ?? []
  const strMod = abilityModifier(character.abilityScores.strength)

  // Resolve mechanical effects from magic items, feats, fighting styles
  const resolved = useMemo(() => resolveEffects(char5e), [char5e])

  // Build weapon context for the currently selected weapon
  const getWeaponContext = (
    weapon: { range?: string; properties?: string[]; damageType?: string } | null
  ): WeaponContext | undefined => {
    if (!weapon) return undefined
    const isRanged = !!weapon.range
    return {
      isMelee: !isRanged,
      isRanged,
      isHeavy: weapon.properties?.includes('Heavy') ?? false,
      isThrown: weapon.properties?.includes('Thrown') ?? false,
      isCrossbow: weapon.properties?.some((p) => p.toLowerCase().includes('crossbow')) ?? false,
      isSpell: false,
      damageType: weapon.damageType
    }
  }

  // Synthetic weapon entries for Unarmed Strike and Improvised Weapon
  const UNARMED_STRIKE: {
    id: string
    name: string
    damage: string
    damageType: string
    proficient: boolean
    properties: string[]
    range?: string
    equipped: boolean
    attackBonus: number
    mastery?: string
  } = {
    id: '__unarmed__',
    name: 'Unarmed Strike',
    damage: '0', // Special: 1 + STR mod, no dice
    damageType: 'bludgeoning',
    proficient: true,
    properties: [],
    equipped: true,
    attackBonus: 0
  }
  const IMPROVISED_WEAPON: {
    id: string
    name: string
    damage: string
    damageType: string
    proficient: boolean
    properties: string[]
    range?: string
    equipped: boolean
    attackBonus: number
    mastery?: string
  } = {
    id: '__improvised__',
    name: 'Improvised Weapon',
    damage: '1d4',
    damageType: 'bludgeoning',
    proficient: false, // No proficiency bonus
    properties: [],
    range: '20/60',
    equipped: true,
    attackBonus: 0
  }
  const weapons = [...realWeapons, UNARMED_STRIKE, IMPROVISED_WEAPON]

  const selectedWeapon = selectedWeaponIndex !== null ? weapons[selectedWeaponIndex] : null
  const isUnarmed = selectedWeapon?.id === '__unarmed__'
  const isImprovised = selectedWeapon?.id === '__improvised__'
  const selectedTarget = selectedTargetId ? tokens.find((t) => t.id === selectedTargetId) : null

  // Feat detection for combat bonuses
  const charFeats = char5e.feats ?? []
  const hasArcheryFS = charFeats.some((f) => f.id === 'fighting-style-archery')
  const hasDuelingFS = charFeats.some((f) => f.id === 'fighting-style-dueling')
  const hasThrownWeaponFS = charFeats.some((f) => f.id === 'fighting-style-thrown-weapon-fighting')
  const hasGWM = charFeats.some((f) => f.id === 'great-weapon-master')

  // Calculate attack modifier
  const getAttackMod = (): number => {
    if (!selectedWeapon) return 0

    // Unarmed Strike: always STR + PB
    if (isUnarmed) return strMod + profBonus

    // Improvised Weapon: ability mod only (no proficiency)
    if (isImprovised) {
      const isRanged = !!selectedWeapon.range
      return isRanged ? abilityModifier(character.abilityScores.dexterity) : strMod
    }

    const isFinesse = selectedWeapon.properties?.includes('Finesse')
    const isRanged = !!selectedWeapon.range
    const dexMod = abilityModifier(character.abilityScores.dexterity)

    let abilMod: number
    if (isFinesse) {
      abilMod = Math.max(strMod, dexMod)
    } else if (isRanged) {
      abilMod = dexMod
    } else {
      abilMod = strMod
    }

    const prof = selectedWeapon.proficient !== false ? profBonus : 0
    let bonus = abilMod + prof

    // Archery FS: +2 to ranged weapon attacks
    if (hasArcheryFS && isRanged) bonus += 2

    // Add effect resolver attack bonuses (magic weapon +X, etc.)
    bonus += resolved.attackBonus(getWeaponContext(selectedWeapon))

    return bonus
  }

  // Calculate damage modifier
  const getDamageMod = (): number => {
    if (!selectedWeapon) return 0
    // Unarmed Strike damage: 1 + STR mod (flat, no dice)
    if (isUnarmed) return 1 + strMod
    if (isImprovised) {
      const isRanged = !!selectedWeapon.range
      return isRanged ? abilityModifier(character.abilityScores.dexterity) : strMod
    }
    const isFinesse = selectedWeapon.properties?.includes('Finesse')
    const isRanged = !!selectedWeapon.range
    const isThrown = selectedWeapon.properties?.includes('Thrown')
    const isHeavy = selectedWeapon.properties?.includes('Heavy')
    const dexMod = abilityModifier(character.abilityScores.dexterity)

    let baseMod: number
    if (isFinesse) baseMod = Math.max(strMod, dexMod)
    else if (isRanged) baseMod = dexMod
    else baseMod = strMod

    let bonus = baseMod

    // Dueling FS: +2 damage when wielding melee weapon in one hand with no other weapon
    if (hasDuelingFS && !isRanged && !selectedWeapon.properties?.includes('Two-Handed')) {
      bonus += 2
    }

    // Thrown Weapon Fighting FS: +2 damage with thrown weapons
    if (hasThrownWeaponFS && isThrown && isRanged) {
      bonus += 2
    }

    // Great Weapon Master: +PB damage with Heavy weapons
    if (hasGWM && isHeavy) {
      bonus += profBonus
    }

    // Add effect resolver damage bonuses (magic weapon +X, etc.)
    bonus += resolved.damageBonus(getWeaponContext(selectedWeapon))

    return bonus
  }

  // Compute condition effects based on current attacker/target
  const computedEffects = (() => {
    if (!selectedWeapon || !selectedTarget || !attackerToken) return null

    const attackerConds = gameConditions
      .filter((c) => c.entityId === attackerToken.entityId)
      .map((c) => ({ name: c.condition, value: c.value }))
    const targetConds = gameConditions
      .filter((c) => c.entityId === selectedTarget.entityId)
      .map((c) => ({ name: c.condition, value: c.value }))

    const isRanged = !!selectedWeapon.range
    const within5ft = isInMeleeRange(attackerToken, selectedTarget)

    // Check if any enemy is within 5ft of attacker (for ranged-in-close-combat)
    const anyEnemyWithin5ft = tokens.some(
      (t) => t.id !== attackerToken.id && t.entityType !== attackerToken.entityType && isAdjacent(attackerToken, t)
    )

    const targetTs = turnStates[selectedTarget.entityId]

    // Flanking check (DMG optional rule)
    const gameState = useGameStore.getState()
    let flankingAlly: string | null = null
    if (gameState.flankingEnabled && !isRanged) {
      const incapConditions = ['Incapacitated', 'Paralyzed', 'Stunned', 'Petrified', 'Unconscious']
      const incapIds = new Set(
        gameConditions.filter((c) => incapConditions.includes(c.condition)).map((c) => c.entityId)
      )
      flankingAlly = checkFlankingFn(attackerToken, selectedTarget, tokens, incapIds)
    }

    return getAttackConditionEffects(attackerConds, targetConds, {
      isRanged,
      isWithin5ft: within5ft,
      anyEnemyWithin5ftOfAttacker: anyEnemyWithin5ft,
      targetIsDodging: targetTs?.isDodging,
      targetEntityId: selectedTarget.entityId,
      attackerGrapplerEntityId: (() => {
        const grappleCond = gameConditions.find(
          (c) => c.entityId === attackerToken.entityId && c.condition === 'Grappled'
        )
        return grappleCond?.sourceEntityId
      })(),
      isUnderwater: gameState.underwaterCombat,
      weaponDamageType: selectedWeapon.damageType,
      attackerHasSwimSpeed: !!(attackerToken.swimSpeed && attackerToken.swimSpeed > 0),
      flankingAlly
    })
  })()

  const handleRollAttack = (): void => {
    if (!selectedWeapon || !selectedTarget) return

    const effects = computedEffects
    const mod = getAttackMod() + (effects?.exhaustionPenalty ?? 0)

    // Roll based on advantage/disadvantage (accounting for DM overrides)
    let effectiveRollMode = effects?.rollMode ?? 'normal'

    if (effects) {
      const activeAdv = effects.advantageSources.filter((_, i) => !conditionOverrides[`adv-${i}`])
      const activeDisadv = effects.disadvantageSources.filter((_, i) => !conditionOverrides[`disadv-${i}`])
      if (activeAdv.length > 0 && activeDisadv.length > 0) {
        effectiveRollMode = 'normal'
      } else if (activeAdv.length > 0) {
        effectiveRollMode = 'advantage'
      } else if (activeDisadv.length > 0) {
        effectiveRollMode = 'disadvantage'
      } else {
        effectiveRollMode = 'normal'
      }
    }

    const d20_1 = rollD20()
    let d20: number
    let d20_2: number | undefined

    if (effectiveRollMode === 'advantage') {
      d20_2 = rollD20()
      d20 = Math.max(d20_1, d20_2)
    } else if (effectiveRollMode === 'disadvantage') {
      d20_2 = rollD20()
      d20 = Math.min(d20_1, d20_2)
    } else {
      d20 = d20_1
    }

    // Auto-crit from conditions (Paralyzed/Unconscious within 5ft)
    const isCrit = d20 === 20 || (effects?.autoCrit ?? false)
    const isFumble = d20 === 1
    const total = d20 + mod

    // Sharpshooter: bypass half/three-quarters cover on ranged weapon attacks
    const hasSharpshooter = charFeats.some((f) => f.id === 'sharpshooter')
    const isRangedAttack = !!selectedWeapon.range
    const coverBonus = hasSharpshooter && isRangedAttack && cover !== 'total' ? 0 : getCoverACBonus(cover)
    const targetAC = (selectedTarget.ac ?? 10) + coverBonus
    const hit = isFumble ? false : isCrit || total >= targetAC
    setIsHit(hit)

    setAttackRoll({ d20: d20_2 !== undefined ? d20_1 : d20, d20_2, modifier: mod, total, isCrit, isFumble })

    // Trigger 3D dice animation for attack roll
    const rollerName = (() => { const pid = useNetworkStore.getState().localPeerId; const players = useLobbyStore.getState().players; const p = pid ? players.find((pl) => pl.peerId === pid) : (players.length > 0 ? players[0] : undefined); return p?.displayName || character.name; })()
    const attackRolls = d20_2 !== undefined ? [d20_1, d20_2] : [d20_1]
    trigger3dDice({
      formula: d20_2 !== undefined ? '2d20' : '1d20',
      rolls: attackRolls,
      total: d20 + mod,
      rollerName
    })

    setStep('damage')
  }

  const handleRollDamage = (): void => {
    if (!selectedWeapon || !selectedTarget) return

    const isCrit = attackRoll?.isCrit ?? false

    // Unarmed Strike: flat damage (1 + STR mod), no dice. Crit doesn't double (no dice to double).
    if (isUnarmed) {
      const total = Math.max(1, getDamageMod())
      const targetResistances = selectedTarget.resistances ?? []
      const targetVulnerabilities = selectedTarget.vulnerabilities ?? []
      const targetImmunities = selectedTarget.immunities ?? []
      const currentHP = selectedTarget.currentHP ?? 0
      const maxHP = selectedTarget.maxHP ?? 0
      const damageApp = applyDamageToCharacter(
        currentHP,
        maxHP,
        0,
        total,
        'bludgeoning',
        targetResistances,
        targetVulnerabilities,
        targetImmunities
      )
      setDamageAppResult(damageApp)
      setDamageResult({ rolls: [], modifier: total, total: damageApp.effectiveDamage, isCrit })
      const isMelee = true
      if (isMelee && damageApp.reducedToZero && !damageApp.instantDeath) {
        setKnockOutPrompt(true)
      }
      setStep('result')
      return
    }

    const parsed = parseDamageDice(selectedWeapon.damage)
    if (!parsed) return

    const diceCount = isCrit ? parsed.count * 2 : parsed.count
    const rolls = rollDice(diceCount, parsed.sides)
    const damageMod = getDamageMod() + parsed.modifier

    // Roll extra damage dice from effects (e.g., Flame Tongue 2d6 fire)
    const weaponCtx = getWeaponContext(selectedWeapon)
    const extraDice = resolved.getExtraDamageDice(weaponCtx)
    let extraDamage = 0
    for (const ed of extraDice) {
      const edParsed = parseDamageDice(ed.dice)
      if (edParsed) {
        const edCount = isCrit ? edParsed.count * 2 : edParsed.count
        const edRolls = rollDice(edCount, edParsed.sides)
        extraDamage += edRolls.reduce((s, r) => s + r, 0)
      }
    }

    const total = Math.max(0, rolls.reduce((s, r) => s + r, 0) + damageMod + extraDamage)

    // Trigger 3D dice animation for damage roll
    const damageRollerName = (() => { const pid = useNetworkStore.getState().localPeerId; const players = useLobbyStore.getState().players; const p = pid ? players.find((pl) => pl.peerId === pid) : (players.length > 0 ? players[0] : undefined); return p?.displayName || character.name; })()
    trigger3dDice({
      formula: `${diceCount}d${parsed.sides}`,
      rolls,
      total,
      rollerName: damageRollerName
    })

    // Apply damage type modifiers (resistance/vulnerability/immunity) from token data
    let targetResistances = selectedTarget.resistances ?? []
    const targetVulnerabilities = selectedTarget.vulnerabilities ?? []
    const targetImmunities = selectedTarget.immunities ?? []

    // Underwater: add fire resistance
    if (useGameStore.getState().underwaterCombat) {
      if (!targetResistances.includes('fire')) {
        targetResistances = [...targetResistances, 'fire']
      }
    }

    // Compute damage application with temp HP, R/V/I
    const currentHP = selectedTarget.currentHP ?? 0
    const maxHP = selectedTarget.maxHP ?? 0
    const tempHP = 0 // Tokens don't track temp HP directly yet; full damage flows through

    const damageApp = applyDamageToCharacter(
      currentHP,
      maxHP,
      tempHP,
      total,
      selectedWeapon.damageType,
      targetResistances,
      targetVulnerabilities,
      targetImmunities
    )

    setDamageAppResult(damageApp)
    setDamageResult({ rolls, modifier: damageMod, total: damageApp.effectiveDamage, isCrit })

    // Check for knock-out opportunity (B1): melee attack reducing target to 0 HP
    const isMelee = !selectedWeapon.range
    if (isMelee && damageApp.reducedToZero && !damageApp.instantDeath) {
      setKnockOutPrompt(true)
    }

    // Check weapon mastery effects
    const weaponMastery = selectedWeapon.mastery
    const chosenMasteries = char5e.weaponMasteryChoices ?? []
    if (weaponMastery && chosenMasteries.includes(weaponMastery)) {
      const isFinesse = selectedWeapon.properties?.includes('Finesse')
      const isRanged = !!selectedWeapon.range
      const dexMod = abilityModifier(character.abilityScores.dexterity)
      let atkAbilMod: number
      if (isFinesse) atkAbilMod = Math.max(strMod, dexMod)
      else if (isRanged) atkAbilMod = dexMod
      else atkAbilMod = strMod
      const effect = getMasteryEffect(weaponMastery, atkAbilMod, profBonus, true)
      setMasteryEffect(effect)
    } else {
      setMasteryEffect(null)
    }

    setStep('result')
  }

  const handleApply = (knockOut = false): void => {
    if (!selectedTarget || !damageResult || !selectedWeapon || !attackRoll) return

    if (onApplyDamage) {
      onApplyDamage(selectedTarget.id, damageResult.total, selectedWeapon.damageType, damageAppResult ?? undefined)
    }

    // Crit at 0 HP = 2 death save failures, normal hit at 0 HP = 1 failure
    if (selectedTarget.currentHP != null && selectedTarget.currentHP <= 0 && damageResult.total > 0) {
      const failures = attackRoll.isCrit ? 2 : 1
      onBroadcastResult?.(
        `${selectedTarget.label} takes damage at 0 HP: +${failures} death save failure${failures > 1 ? 's' : ''}!`
      )
    }

    if (onBroadcastResult) {
      const coverBonus = getCoverACBonus(cover)
      const targetAC = (selectedTarget.ac ?? 10) + coverBonus
      const hitStr = attackRoll.isCrit ? 'CRITICAL HIT' : `Attack: ${attackRoll.total} vs AC ${targetAC} - HIT`
      const finalDmg = `${damageResult.total} ${selectedWeapon.damageType} damage`
      const modNote = damageAppResult?.modifierDescription ? ` [${damageAppResult.modifierDescription}]` : ''
      const critNote = damageResult.isCrit ? ' (Critical!)' : ''
      const koNote = knockOut ? ' [Knocked Out - Unconscious at 1 HP]' : ''
      const massiveNote = damageAppResult?.instantDeath ? ' [INSTANT DEATH - Massive Damage!]' : ''
      const masteryNote = masteryEffect ? ` [${masteryEffect.mastery}: ${masteryEffect.description}]` : ''
      onBroadcastResult(
        `${character.name} attacks ${selectedTarget.label} with ${selectedWeapon.name} - ${hitStr}! ${finalDmg}${modNote}${critNote}${koNote}${massiveNote}${masteryNote}`
      )
    }

    onClose()
  }

  // Enemy tokens for targeting (exclude friendlies)
  const targetableTokens = tokens.filter((t) => {
    if (!attackerToken) return t.entityType === 'enemy'
    return t.id !== attackerToken.id
  })

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-5 w-[420px] max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">
            {step === 'weapon' && 'Choose Weapon'}
            {step === 'unarmed-mode' && 'Unarmed Strike Mode'}
            {step === 'target' && 'Select Target'}
            {step === 'roll' &&
              (isUnarmed && unarmedMode !== 'damage'
                ? `Unarmed Strike — ${unarmedMode === 'grapple' ? 'Grapple' : 'Shove'}`
                : 'Attack Roll')}
            {step === 'damage' && 'Attack Result'}
            {step === 'result' && 'Damage Applied'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer" aria-label="Close">
            &times;
          </button>
        </div>

        {/* Step 1: Choose weapon */}
        {step === 'weapon' && (
          <div className="space-y-2">
            {weapons.map((w, i) => {
              const isUnarmedEntry = w.id === '__unarmed__'
              const isImprovisedEntry = w.id === '__improvised__'
              return (
                <button
                  key={w.id || i}
                  onClick={() => {
                    setSelectedWeaponIndex(i)
                    if (isUnarmedEntry) {
                      setStep('unarmed-mode')
                    } else {
                      setStep('target')
                    }
                  }}
                  className={`w-full text-left px-3 py-2 border rounded-lg cursor-pointer ${
                    isUnarmedEntry || isImprovisedEntry
                      ? 'bg-gray-800/50 hover:bg-gray-700 border-gray-600 border-dashed'
                      : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-200">{w.name}</span>
                    {isUnarmedEntry ? (
                      <span className="text-xs text-amber-400 font-mono">3 modes</span>
                    ) : (
                      <span className="text-xs text-amber-400 font-mono">
                        {isImprovisedEntry
                          ? `${formatMod(abilityModifier(character.abilityScores.strength))} to hit`
                          : `${formatMod(getAttackMod())} to hit`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {isUnarmedEntry ? (
                      `1 + STR mod (${Math.max(1, 1 + strMod)}) bludgeoning / Grapple / Shove`
                    ) : isImprovisedEntry ? (
                      '1d4 bludgeoning (no proficiency)'
                    ) : (
                      <>
                        {w.damage} {w.damageType}
                        {w.range && <span className="ml-2 text-gray-500">Range: {w.range}</span>}
                        {w.properties?.length > 0 && (
                          <span className="ml-2 text-gray-500">{w.properties.join(', ')}</span>
                        )}
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 1b: Unarmed Strike mode selection */}
        {step === 'unarmed-mode' && (
          <div className="space-y-2">
            <button
              onClick={() => {
                setUnarmedMode('damage')
                setStep('target')
              }}
              className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg cursor-pointer"
            >
              <div className="text-sm font-semibold text-gray-200">Damage</div>
              <div className="text-xs text-gray-400">
                Attack roll (STR + PB). Hit: {Math.max(1, 1 + strMod)} bludgeoning damage.
              </div>
            </button>
            <button
              onClick={() => {
                setUnarmedMode('grapple')
                setStep('target')
              }}
              className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-blue-700/50 rounded-lg cursor-pointer"
            >
              <div className="text-sm font-semibold text-blue-300">Grapple</div>
              <div className="text-xs text-gray-400">
                Target within 5ft, max 1 size larger. Target STR/DEX save vs DC{' '}
                {unarmedStrikeDC(character.abilityScores.strength, profBonus)}.
                <span className="text-yellow-400 ml-1">Requires free hand.</span>
              </div>
            </button>
            <button
              onClick={() => {
                setUnarmedMode('shove')
                setStep('target')
              }}
              className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-orange-700/50 rounded-lg cursor-pointer"
            >
              <div className="text-sm font-semibold text-orange-300">Shove</div>
              <div className="text-xs text-gray-400">
                Target within 5ft, max 1 size larger. Target STR/DEX save vs DC{' '}
                {unarmedStrikeDC(character.abilityScores.strength, profBonus)}. On fail: push 5ft OR knock Prone.
              </div>
            </button>
            <button
              onClick={() => setStep('weapon')}
              className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 2: Select target */}
        {step === 'target' && selectedWeapon && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
              {isUnarmed ? (
                <>
                  Unarmed Strike:{' '}
                  <span
                    className={`font-semibold ${unarmedMode === 'grapple' ? 'text-blue-400' : unarmedMode === 'shove' ? 'text-orange-400' : 'text-amber-400'}`}
                  >
                    {unarmedMode === 'damage' ? 'Damage' : unarmedMode === 'grapple' ? 'Grapple' : 'Shove'}
                  </span>
                </>
              ) : (
                <>
                  Attacking with: <span className="text-amber-400 font-semibold">{selectedWeapon.name}</span>
                  <span className="ml-2 text-gray-500">
                    ({selectedWeapon.damage} {selectedWeapon.damageType})
                  </span>
                </>
              )}
            </div>

            {/* Range check info */}
            {selectedWeapon.range && attackerToken && (
              <div className="text-[10px] text-gray-500">Range: {selectedWeapon.range}</div>
            )}

            <div className="space-y-1.5">
              {targetableTokens.length === 0 ? (
                <p className="text-sm text-gray-500">No targets on the map</p>
              ) : (
                targetableTokens.map((token) => {
                  // Range validation
                  let rangeStatus = ''
                  let rangeColor = 'text-gray-400'
                  if (attackerToken && selectedWeapon.range) {
                    const [normalStr, longStr] = selectedWeapon.range.split('/')
                    const normalRange = parseInt(normalStr, 10) || 30
                    const longRange = parseInt(longStr, 10) || normalRange * 4
                    const range = checkRangedRange(attackerToken, token, normalRange, longRange)
                    if (range === 'out-of-range') {
                      rangeStatus = 'Out of range'
                      rangeColor = 'text-red-400'
                    } else if (range === 'long') {
                      // Underwater: ranged beyond normal range auto-miss
                      if (useGameStore.getState().underwaterCombat) {
                        rangeStatus = 'Out of range (underwater)'
                        rangeColor = 'text-red-400'
                      } else {
                        rangeStatus = 'Long range (Disadvantage)'
                        rangeColor = 'text-yellow-400'
                      }
                    } else {
                      rangeStatus = 'In range'
                      rangeColor = 'text-green-400'
                    }
                  } else if (attackerToken && !selectedWeapon.range) {
                    const melee = isInMeleeRange(attackerToken, token)
                    rangeStatus = melee ? 'In melee range' : 'Out of melee range'
                    rangeColor = melee ? 'text-green-400' : 'text-red-400'
                  }

                  // Check grapple/shove size restriction
                  const grappleShoveBlocked =
                    isUnarmed &&
                    (unarmedMode === 'grapple' || unarmedMode === 'shove') &&
                    attackerToken &&
                    !canGrappleOrShove(attackerToken, token)

                  // Charmed: cannot attack charmer
                  const charmedBlocked =
                    attackerToken &&
                    gameConditions.some(
                      (c) =>
                        c.entityId === attackerToken.entityId &&
                        c.condition === 'Charmed' &&
                        c.sourceEntityId === token.entityId
                    )

                  return (
                    <button
                      key={token.id}
                      onClick={() => {
                        if (grappleShoveBlocked || charmedBlocked) return
                        setSelectedTargetId(token.id)
                        setConditionOverrides({})
                        setGrappleResult(null)
                        // Auto-calculate cover from token positions + walls
                        if (attackerToken) {
                          const gs = useGameStore.getState()
                          const activeMap = gs.maps.find((m) => m.id === gs.activeMapId)
                          const walls = activeMap?.wallSegments ?? []
                          const cellSize = activeMap?.grid.cellSize ?? 70
                          const otherTokens = tokens.filter((t) => t.id !== attackerToken.id && t.id !== token.id)
                          const autoCover = calculateCover(attackerToken, token, walls, cellSize, otherTokens)
                          setCover(autoCover)
                        }
                        setStep('roll')
                      }}
                      disabled={!!grappleShoveBlocked || !!charmedBlocked}
                      className={`w-full text-left px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg ${
                        grappleShoveBlocked || charmedBlocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-200">{token.label}</span>
                        {token.currentHP != null && (
                          <span className="text-xs text-gray-500">
                            HP: {token.currentHP}/{token.maxHP}
                          </span>
                        )}
                      </div>
                      {rangeStatus && <div className={`text-[10px] mt-0.5 ${rangeColor}`}>{rangeStatus}</div>}
                      {grappleShoveBlocked && (
                        <div className="text-[10px] mt-0.5 text-red-400">Too large to {unarmedMode}</div>
                      )}
                      {charmedBlocked && (
                        <div className="text-[10px] mt-0.5 text-pink-400">Charmed - cannot attack</div>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Cover selector */}
            <div className="mt-3">
              <span className="text-xs text-gray-400">
                Cover: <span className="text-gray-600">(auto-calculated, click to override)</span>
              </span>
              <div className="flex gap-1 mt-1">
                {(['none', 'half', 'three-quarters', 'total'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCover(c)}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      cover === c ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {c === 'none' ? 'None' : c === 'half' ? 'Half (+2)' : c === 'three-quarters' ? '3/4 (+5)' : 'Total'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep('weapon')}
              className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              Back
            </button>
          </div>
        )}

        {/* Step 3: Attack roll / Grapple-Shove save */}
        {step === 'roll' && selectedWeapon && selectedTarget && (
          <div className="space-y-3">
            {isUnarmed && (unarmedMode === 'grapple' || unarmedMode === 'shove') ? (
              /* Grapple / Shove: target makes a save */
              <>
                <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
                  <span
                    className={
                      unarmedMode === 'grapple' ? 'text-blue-400 font-semibold' : 'text-orange-400 font-semibold'
                    }
                  >
                    {unarmedMode === 'grapple' ? 'Grapple' : 'Shove'}
                  </span>
                  <span className="mx-2">→</span>
                  <span className="text-red-400 font-semibold">{selectedTarget.label}</span>
                </div>

                <div className="px-3 py-2 bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-300 mb-1">
                    {selectedTarget.label} must make a{' '}
                    <span className="text-white font-semibold">STR or DEX saving throw</span>
                  </div>
                  <div className="text-lg font-bold text-center text-white">
                    DC {unarmedStrikeDC(character.abilityScores.strength, profBonus)}
                  </div>
                </div>

                {unarmedMode === 'shove' && !grappleResult && (
                  <div className="px-3 py-2 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">On failure, choose effect:</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShoveChoice('push')}
                        className={`flex-1 px-2 py-1 text-xs rounded cursor-pointer ${shoveChoice === 'push' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                      >
                        Push 5ft
                      </button>
                      <button
                        onClick={() => setShoveChoice('prone')}
                        className={`flex-1 px-2 py-1 text-xs rounded cursor-pointer ${shoveChoice === 'prone' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                      >
                        Knock Prone
                      </button>
                    </div>
                  </div>
                )}

                {!grappleResult ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const dc = unarmedStrikeDC(character.abilityScores.strength, profBonus)
                        const roll = rollD20()
                        const success = roll >= dc || roll === 20
                        const fail = roll === 1 || !success
                        const msg =
                          roll === 20
                            ? `Natural 20! ${selectedTarget.label} resists the ${unarmedMode}!`
                            : roll === 1
                              ? `Natural 1! ${selectedTarget.label} fails the ${unarmedMode} save!`
                              : success
                                ? `Rolled ${roll} vs DC ${dc} — ${selectedTarget.label} resists!`
                                : `Rolled ${roll} vs DC ${dc} — ${selectedTarget.label} fails!`
                        setGrappleResult({ success: !fail || roll === 20, message: msg })

                        // Apply effects on failure
                        if (fail && roll !== 20) {
                          if (unarmedMode === 'grapple') {
                            // Apply Grappled condition
                            const gameStore = useGameStore.getState()
                            gameStore.addCondition({
                              id: `cond-${Date.now()}`,
                              entityId: selectedTarget.entityId,
                              entityName: selectedTarget.label,
                              condition: 'Grappled',
                              duration: 'permanent',
                              source: character.name,
                              appliedRound: gameStore.round
                            })
                          }
                          // Shove effects (push/prone) handled in the result display
                        }
                      }}
                      className={`flex-1 px-4 py-3 text-white font-semibold rounded-lg cursor-pointer text-sm ${
                        unarmedMode === 'grapple'
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-orange-600 hover:bg-orange-500'
                      }`}
                    >
                      Roll Target's Save (d20)
                    </button>
                    <button
                      onClick={() => {
                        setGrappleResult({
                          success: false,
                          message: `${selectedTarget.label} fails the ${unarmedMode} save (manual).`
                        })
                        if (unarmedMode === 'grapple') {
                          const gameStore = useGameStore.getState()
                          gameStore.addCondition({
                            id: `cond-${Date.now()}`,
                            entityId: selectedTarget.entityId,
                            entityName: selectedTarget.label,
                            condition: 'Grappled',
                            duration: 'permanent',
                            source: character.name,
                            appliedRound: gameStore.round
                          })
                        }
                      }}
                      className="px-3 py-3 text-xs font-semibold bg-red-700 hover:bg-red-600 text-white rounded-lg cursor-pointer"
                    >
                      Fail
                    </button>
                    <button
                      onClick={() => {
                        setGrappleResult({
                          success: true,
                          message: `${selectedTarget.label} resists the ${unarmedMode} (manual).`
                        })
                      }}
                      className="px-3 py-3 text-xs font-semibold bg-green-700 hover:bg-green-600 text-white rounded-lg cursor-pointer"
                    >
                      Pass
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className={`text-center p-3 rounded-lg border ${grappleResult.success ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'}`}
                    >
                      <div className={`text-sm font-bold ${grappleResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {grappleResult.success ? 'Save Succeeded!' : 'Save Failed!'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{grappleResult.message}</div>
                      {!grappleResult.success && unarmedMode === 'grapple' && (
                        <div className="text-xs text-blue-400 mt-1">Grappled condition applied!</div>
                      )}
                      {!grappleResult.success && unarmedMode === 'shove' && (
                        <div className="text-xs text-orange-400 mt-1">
                          {shoveChoice === 'push' ? 'Target pushed 5ft!' : 'Target knocked Prone!'}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const resultMsg = `${character.name} attempts to ${unarmedMode} ${selectedTarget.label}: ${grappleResult.message}`
                        if (onBroadcastResult) onBroadcastResult(resultMsg)

                        // Apply shove effects
                        if (!grappleResult.success && unarmedMode === 'shove') {
                          if (shoveChoice === 'prone') {
                            const gameStore = useGameStore.getState()
                            gameStore.addCondition({
                              id: `cond-${Date.now()}`,
                              entityId: selectedTarget.entityId,
                              entityName: selectedTarget.label,
                              condition: 'Prone',
                              duration: 'permanent',
                              source: character.name,
                              appliedRound: gameStore.round
                            })
                          }
                          // Push: would require moving token 1 cell — left for DM to adjudicate direction
                        }

                        onClose()
                      }}
                      className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg cursor-pointer text-sm"
                    >
                      Done
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setGrappleResult(null)
                    setIsHit(null)
                    setStep('target')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Back
                </button>
              </>
            ) : (
              /* Normal attack roll (including Unarmed Strike damage mode) */
              <>
                <div className="text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-amber-400 font-semibold">
                    {isUnarmed ? 'Unarmed Strike' : selectedWeapon.name}
                  </span>
                  <span className="mx-2">vs</span>
                  <span className="text-red-400 font-semibold">{selectedTarget.label}</span>
                  {cover !== 'none' && (
                    <span className="ml-2 text-blue-400">
                      ({cover} cover: +{getCoverACBonus(cover)} AC)
                    </span>
                  )}
                </div>

                {/* Condition effect banners */}
                {computedEffects && (
                  <div className="space-y-1">
                    {computedEffects.attackerCannotAct && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 border border-red-500/50 rounded-lg">
                        <span className="text-xs text-red-300 font-semibold">Cannot attack — Incapacitated</span>
                      </div>
                    )}
                    {computedEffects.advantageSources.map((src, i) => (
                      <div
                        key={`adv-${i}`}
                        className="flex items-center justify-between px-3 py-1 bg-green-900/30 border border-green-500/40 rounded-lg"
                      >
                        <span className="text-[11px] text-green-300">ADV: {src}</span>
                        <button
                          onClick={() => setConditionOverrides((o) => ({ ...o, [`adv-${i}`]: !o[`adv-${i}`] }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${conditionOverrides[`adv-${i}`] ? 'bg-gray-700 text-gray-400 line-through' : 'bg-green-800 text-green-200'}`}
                        >
                          {conditionOverrides[`adv-${i}`] ? 'Overridden' : 'Active'}
                        </button>
                      </div>
                    ))}
                    {computedEffects.disadvantageSources.map((src, i) => (
                      <div
                        key={`disadv-${i}`}
                        className="flex items-center justify-between px-3 py-1 bg-red-900/30 border border-red-500/40 rounded-lg"
                      >
                        <span className="text-[11px] text-red-300">DISADV: {src}</span>
                        <button
                          onClick={() => setConditionOverrides((o) => ({ ...o, [`disadv-${i}`]: !o[`disadv-${i}`] }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${conditionOverrides[`disadv-${i}`] ? 'bg-gray-700 text-gray-400 line-through' : 'bg-red-800 text-red-200'}`}
                        >
                          {conditionOverrides[`disadv-${i}`] ? 'Overridden' : 'Active'}
                        </button>
                      </div>
                    ))}
                    {computedEffects.advantageSources.length > 0 && computedEffects.disadvantageSources.length > 0 && (
                      <div className="px-3 py-1 bg-gray-800/50 border border-gray-600 rounded-lg">
                        <span className="text-[11px] text-gray-400">
                          Advantage and Disadvantage cancel out → Normal roll
                        </span>
                      </div>
                    )}
                    {computedEffects.autoCrit && (
                      <div className="px-3 py-1 bg-purple-900/30 border border-purple-500/40 rounded-lg">
                        <span className="text-[11px] text-purple-300">
                          AUTO-CRIT: Any hit is a Critical Hit (within 5ft of Paralyzed/Unconscious target)
                        </span>
                      </div>
                    )}
                    {computedEffects.exhaustionPenalty !== 0 && (
                      <div className="px-3 py-1 bg-orange-900/30 border border-orange-500/40 rounded-lg">
                        <span className="text-[11px] text-orange-300">
                          Exhaustion: {computedEffects.exhaustionPenalty} penalty to roll
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleRollAttack}
                  disabled={computedEffects?.attackerCannotAct}
                  className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Roll Attack (d20 {formatMod(getAttackMod() + (computedEffects?.exhaustionPenalty ?? 0))})
                  {computedEffects?.rollMode === 'advantage'
                    ? ' (Advantage)'
                    : computedEffects?.rollMode === 'disadvantage'
                      ? ' (Disadvantage)'
                      : ''}
                </button>

                <button
                  onClick={() => {
                    setIsHit(null)
                    setStep('target')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Back
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Show attack result + roll damage */}
        {step === 'damage' &&
          attackRoll &&
          selectedWeapon &&
          selectedTarget &&
          (() => {
            const coverBonus = getCoverACBonus(cover)
            const targetAC = (selectedTarget.ac ?? 10) + coverBonus
            return (
              <div className="space-y-3">
                <div
                  className={`text-center p-4 rounded-lg border ${
                    attackRoll.isCrit
                      ? 'border-green-500 bg-green-900/20'
                      : attackRoll.isFumble
                        ? 'border-red-500 bg-red-900/20'
                        : isHit
                          ? 'border-green-500 bg-green-900/20'
                          : 'border-red-500 bg-red-900/20'
                  }`}
                >
                  <div className="text-3xl font-bold font-mono mb-1">
                    <span
                      className={
                        attackRoll.isCrit
                          ? 'text-green-400'
                          : attackRoll.isFumble
                            ? 'text-red-400'
                            : isHit
                              ? 'text-green-400'
                              : 'text-red-400'
                      }
                    >
                      {attackRoll.total}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    d20: {attackRoll.d20}
                    {attackRoll.d20_2 !== undefined ? `, ${attackRoll.d20_2}` : ''} {formatMod(attackRoll.modifier)}
                    {attackRoll.d20_2 !== undefined && (
                      <span className="text-gray-500 ml-1">(took {attackRoll.total - attackRoll.modifier})</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    vs AC {targetAC}
                    {coverBonus > 0 && (
                      <span className="text-blue-400 ml-1">
                        ({selectedTarget.ac ?? 10} + {coverBonus} cover)
                      </span>
                    )}
                  </div>
                  {attackRoll.isCrit && (
                    <div className="text-sm text-green-400 font-bold mt-1">NATURAL 20 - CRITICAL HIT!</div>
                  )}
                  {attackRoll.isFumble && (
                    <div className="text-sm text-red-400 font-bold mt-1">NATURAL 1 - AUTOMATIC MISS!</div>
                  )}
                  {!attackRoll.isCrit && !attackRoll.isFumble && (
                    <div className={`text-sm font-bold mt-1 ${isHit ? 'text-green-400' : 'text-red-400'}`}>
                      {isHit ? 'HIT' : 'MISS'}
                    </div>
                  )}
                </div>

                {isHit === true && (
                  <button
                    onClick={handleRollDamage}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg cursor-pointer text-sm"
                  >
                    {isUnarmed
                      ? `Apply Damage (${Math.max(1, getDamageMod())} bludgeoning)`
                      : `Roll Damage (${attackRoll.isCrit ? `${(parseDamageDice(selectedWeapon?.damage ?? '')?.count ?? 1) * 2}` : (parseDamageDice(selectedWeapon?.damage ?? '')?.count ?? 1)}d${parseDamageDice(selectedWeapon?.damage ?? '')?.sides ?? 8} ${formatMod(getDamageMod())} ${selectedWeapon?.damageType ?? ''})`}
                  </button>
                )}

                {isHit === false &&
                  (() => {
                    // Check for Graze mastery on miss
                    const weaponMastery = selectedWeapon.mastery
                    const chosenMasteries = char5e.weaponMasteryChoices ?? []
                    const hasGraze = weaponMastery === 'Graze' && chosenMasteries.includes('Graze')
                    const grazeEffect = hasGraze
                      ? getMasteryEffect(
                          'Graze',
                          (() => {
                            const isFinesse = selectedWeapon.properties?.includes('Finesse')
                            const isRanged = !!selectedWeapon.range
                            const dexMod = abilityModifier(character.abilityScores.dexterity)
                            if (isFinesse) return Math.max(strMod, dexMod)
                            if (isRanged) return dexMod
                            return strMod
                          })(),
                          profBonus,
                          false
                        )
                      : null

                    return (
                      <div className="space-y-2">
                        {grazeEffect && grazeEffect.grazeDamage != null && grazeEffect.grazeDamage > 0 && (
                          <div className="px-3 py-2 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                            <div className="text-xs text-amber-300 font-semibold">Graze Mastery</div>
                            <div className="text-[11px] text-gray-300 mt-0.5">
                              On miss: deal {grazeEffect.grazeDamage} {selectedWeapon.damageType} damage (ability
                              modifier)
                            </div>
                            <button
                              onClick={() => {
                                if (onApplyDamage)
                                  onApplyDamage(selectedTarget.id, grazeEffect.grazeDamage!, selectedWeapon.damageType)
                                if (onBroadcastResult) {
                                  onBroadcastResult(
                                    `${character.name} attacks ${selectedTarget.label} with ${selectedWeapon.name} - MISS! (Graze: ${grazeEffect.grazeDamage} ${selectedWeapon.damageType})`
                                  )
                                }
                                onClose()
                              }}
                              className="mt-1 w-full py-1 text-[10px] rounded bg-amber-600 hover:bg-amber-500 text-white cursor-pointer font-semibold"
                            >
                              Apply Graze Damage ({grazeEffect.grazeDamage})
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            if (onBroadcastResult) {
                              const missMsg = attackRoll.isFumble
                                ? `${character.name} attacks ${selectedTarget.label} with ${selectedWeapon.name} - Natural 1, MISS!`
                                : `${character.name} attacks ${selectedTarget.label} with ${selectedWeapon.name} - Attack: ${attackRoll.total} vs AC ${targetAC}, MISS!`
                              onBroadcastResult(missMsg)
                            }
                            onClose()
                          }}
                          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer text-sm"
                        >
                          Miss - Close
                        </button>
                      </div>
                    )
                  })()}
              </div>
            )
          })()}

        {/* Step 5: Damage result */}
        {step === 'result' && damageResult && selectedWeapon && selectedTarget && (
          <div className="space-y-3">
            <div
              className={`text-center p-4 rounded-lg border ${
                damageResult.isCrit ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">{selectedWeapon.damageType} damage</div>
              <div className="text-4xl font-bold font-mono text-red-400 mb-1">{damageResult.total}</div>
              <div className="flex gap-1 justify-center flex-wrap">
                {damageResult.rolls.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-mono bg-gray-700 text-gray-300 border border-gray-600"
                  >
                    {r}
                  </span>
                ))}
                {damageResult.modifier !== 0 && (
                  <span className="text-xs text-gray-400 self-center ml-1">{formatMod(damageResult.modifier)}</span>
                )}
              </div>
              {damageResult.isCrit && (
                <div className="text-xs text-green-400 font-bold mt-2">Dice doubled for critical hit!</div>
              )}
              {damageAppResult?.modifierDescription && (
                <div className="text-xs text-blue-400 mt-2">{damageAppResult.modifierDescription}</div>
              )}
            </div>

            {/* Massive damage instant death warning */}
            {damageAppResult?.instantDeath && (
              <div className="px-3 py-2 bg-red-900/50 border border-red-500 rounded-lg text-center">
                <span className="text-sm text-red-300 font-bold">INSTANT DEATH</span>
                <p className="text-xs text-red-400 mt-1">
                  Remaining damage equals or exceeds HP maximum — creature dies instantly.
                </p>
              </div>
            )}

            {/* Knock-out option (melee attack reducing to 0 HP) */}
            {knockOutPrompt && !damageAppResult?.instantDeath && (
              <div className="px-3 py-2 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                <p className="text-xs text-amber-300 mb-2">
                  This melee attack would reduce the target to 0 HP. Knock out instead?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApply(true)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
                  >
                    Knock Out (1 HP + Unconscious)
                  </button>
                  <button
                    onClick={() => setKnockOutPrompt(false)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer"
                  >
                    Deal Full Damage
                  </button>
                </div>
              </div>
            )}

            {/* Weapon Mastery Effect */}
            {masteryEffect && (
              <div className="px-3 py-2 bg-indigo-900/30 border border-indigo-500/50 rounded-lg">
                <div className="text-xs text-indigo-300 font-semibold">{masteryEffect.mastery} Mastery</div>
                <div className="text-[11px] text-gray-300 mt-0.5">{masteryEffect.description}</div>
                {masteryEffect.requiresSave && (
                  <div className="text-[10px] text-yellow-400 mt-0.5">
                    Target must make a {masteryEffect.requiresSave.ability.toUpperCase()} save (DC{' '}
                    {masteryEffect.requiresSave.dc})
                  </div>
                )}
              </div>
            )}

            {!knockOutPrompt && (
              <>
                <button
                  onClick={() => handleApply()}
                  className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg cursor-pointer text-sm"
                >
                  Apply {damageResult.total} damage to {selectedTarget.label}
                  {masteryEffect ? ` + ${masteryEffect.mastery}` : ''}
                </button>

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer text-sm"
                >
                  Close without applying
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
