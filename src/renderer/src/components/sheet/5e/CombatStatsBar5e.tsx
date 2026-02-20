import { useEffect, useMemo, useState } from 'react'
import { trigger3dDice } from '../../../components/game/dice3d'
import { rollSingle } from '../../../services/dice-service'
import { resolveEffects } from '../../../services/effect-resolver-5e'
import { computeSpellcastingInfo } from '../../../services/spell-data'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { ArmorEntry } from '../../../types/character-common'
import { abilityModifier, formatMod } from '../../../types/character-common'

interface CombatStatsBar5eProps {
  character: Character5e
  readonly?: boolean
}

export default function CombatStatsBar5e({ character, readonly }: CombatStatsBar5eProps): JSX.Element {
  const saveCharacter = useCharacterStore((s) => s.saveCharacter)
  const storeCharacter = useCharacterStore((s) => s.characters.find((c) => c.id === character.id))
  const effectiveCharacter = (storeCharacter ?? character) as Character5e
  const [editingHP, setEditingHP] = useState(false)
  const [hpCurrent, setHpCurrent] = useState(effectiveCharacter.hitPoints.current)
  const [hpMax, setHpMax] = useState(effectiveCharacter.hitPoints.maximum)
  const [hpTemp, setHpTemp] = useState(effectiveCharacter.hitPoints.temporary)

  useEffect(() => {
    setHpCurrent(effectiveCharacter.hitPoints.current)
    setHpMax(effectiveCharacter.hitPoints.maximum)
    setHpTemp(effectiveCharacter.hitPoints.temporary)
  }, [
    effectiveCharacter.hitPoints.current,
    effectiveCharacter.hitPoints.maximum,
    effectiveCharacter.hitPoints.temporary
  ])

  const profBonus = Math.ceil(character.level / 4) + 1

  // Dynamic AC calculation from equipped armor
  const armor: ArmorEntry[] = effectiveCharacter.armor ?? []
  const equippedArmor = armor.find((a) => a.equipped && a.type === 'armor')
  const equippedShield = armor.find((a) => a.equipped && a.type === 'shield')
  const dexMod = abilityModifier(effectiveCharacter.abilityScores.dexterity)

  const feats = effectiveCharacter.feats ?? []
  const hasDefenseFS = feats.some((f) => f.id === 'fighting-style-defense')
  const hasMediumArmorMaster = feats.some((f) => f.id === 'medium-armor-master')
  const hasHeavyArmorMaster = feats.some((f) => f.id === 'heavy-armor-master')

  // Resolve mechanical effects from magic items, feats, fighting styles
  const resolved = useMemo(() => resolveEffects(effectiveCharacter), [effectiveCharacter])

  const dynamicAC = (() => {
    let ac: number
    if (equippedArmor) {
      // 5e: acBonus IS the full base AC (e.g., 17 for Splint)
      let dexCap = equippedArmor.dexCap
      // Medium Armor Master: increase DEX cap by 1 for medium armor
      if (hasMediumArmorMaster && dexCap != null && dexCap > 0 && equippedArmor.category === 'medium') {
        dexCap = dexCap + 1
      }
      const cappedDex = dexCap === 0 ? 0 : dexCap != null ? Math.min(dexMod, dexCap) : dexMod
      ac = equippedArmor.acBonus + cappedDex
      // Defense FS: +1 AC while wearing armor
      if (hasDefenseFS) ac += 1
    } else {
      // Unarmored Defense class features
      const classNames = effectiveCharacter.classes.map((c) => c.name.toLowerCase())
      const conMod = abilityModifier(effectiveCharacter.abilityScores.constitution)
      const wisMod = abilityModifier(effectiveCharacter.abilityScores.wisdom)
      const chaMod = abilityModifier(effectiveCharacter.abilityScores.charisma)
      const isDraconicSorcerer = effectiveCharacter.classes.some(
        (c) =>
          c.name.toLowerCase() === 'sorcerer' && c.subclass?.toLowerCase().replace(/\s+/g, '-') === 'draconic-sorcery'
      )
      const candidates: number[] = [10 + dexMod]
      if (classNames.includes('barbarian')) candidates.push(10 + dexMod + conMod)
      if (classNames.includes('monk') && !equippedShield) candidates.push(10 + dexMod + wisMod)
      if (isDraconicSorcerer) candidates.push(10 + dexMod + chaMod)
      ac = Math.max(...candidates)
    }
    // Add shield bonus
    if (equippedShield) {
      ac += equippedShield.acBonus
    }
    // Add resolved effect AC bonuses (magic items like Ring of Protection, Bracers of Defense)
    // Exclude Defense FS since it's already checked above via hasDefenseFS
    const effectACBonus = resolved.acBonus - (hasDefenseFS && equippedArmor ? 1 : 0)
    if (effectACBonus > 0) ac += effectACBonus
    return ac
  })()

  const saveHP = (): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    const updated = {
      ...latest,
      hitPoints: { current: hpCurrent, maximum: hpMax, temporary: hpTemp },
      updatedAt: new Date().toISOString()
    }
    saveCharacter(updated)
    setEditingHP(false)

    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated as Character)
    }
  }

  // Death saves state
  const deathSaves = effectiveCharacter.deathSaves

  const saveDeathSaves = (successes: number, failures: number): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    const updated = {
      ...latest,
      deathSaves: { successes, failures },
      updatedAt: new Date().toISOString()
    }
    saveCharacter(updated)

    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated as Character)
    }
  }

  const resetDeathSaves = (): void => {
    saveDeathSaves(0, 0)
  }

  const toggleSuccess = (index: number): void => {
    if (readonly) return
    const newSuccesses = index < deathSaves.successes ? index : index + 1
    saveDeathSaves(Math.min(3, Math.max(0, newSuccesses)), deathSaves.failures)
  }

  const toggleFailure = (index: number): void => {
    if (readonly) return
    const newFailures = index < deathSaves.failures ? index : index + 1
    saveDeathSaves(deathSaves.successes, Math.min(3, Math.max(0, newFailures)))
  }

  // Initiative for 5e — include Alert feat bonus + resolved effects
  const hasAlert = feats.some((f) => f.id === 'alert')
  const dynamicInitiative = dexMod + (hasAlert ? profBonus : 0) + resolved.initiativeBonus
  const thirdStat = { label: 'Initiative', value: formatMod(dynamicInitiative) }

  // Initiative tooltip breakdown
  const initTooltipParts = [`DEX ${formatMod(dexMod)}`]
  if (hasAlert) initTooltipParts.push(`+${profBonus} (Alert)`)
  if (resolved.initiativeBonus > 0) {
    resolved.sources
      .filter((s) => s.effects.some((e) => e.type === 'initiative_bonus'))
      .forEach((s) => {
        const bonus = s.effects.filter((e) => e.type === 'initiative_bonus').reduce((sum, e) => sum + (e.value ?? 0), 0)
        initTooltipParts.push(`+${bonus} (${s.sourceName})`)
      })
  }
  initTooltipParts.push(`= ${formatMod(dynamicInitiative)}`)

  // AC equipment bonus indicator (use best unarmored AC for comparison)
  const classNames = effectiveCharacter.classes.map((c) => c.name.toLowerCase())
  const unarmoredCandidates: number[] = [10 + dexMod]
  if (classNames.includes('barbarian'))
    unarmoredCandidates.push(10 + dexMod + abilityModifier(effectiveCharacter.abilityScores.constitution))
  if (classNames.includes('monk') && !equippedShield)
    unarmoredCandidates.push(10 + dexMod + abilityModifier(effectiveCharacter.abilityScores.wisdom))
  const isDraconicSorcererForBonus = effectiveCharacter.classes.some(
    (c) => c.name.toLowerCase() === 'sorcerer' && c.subclass?.toLowerCase().replace(/\s+/g, '-') === 'draconic-sorcery'
  )
  if (isDraconicSorcererForBonus)
    unarmoredCandidates.push(10 + dexMod + abilityModifier(effectiveCharacter.abilityScores.charisma))
  const unarmoredAC = Math.max(...unarmoredCandidates)
  const acEquipmentBonus = dynamicAC - unarmoredAC

  // Size display
  const characterSize = effectiveCharacter.size ?? 'Medium'

  return (
    <div className="mb-6">
      <div className="grid grid-cols-5 gap-3">
        {/* HP */}
        <div
          className={`bg-gray-900/50 border rounded-lg p-3 text-center transition-colors ${
            readonly
              ? 'border-gray-700'
              : editingHP
                ? 'border-amber-500 cursor-pointer'
                : 'border-gray-700 hover:border-gray-500 cursor-pointer'
          }`}
          onClick={readonly ? undefined : () => !editingHP && setEditingHP(true)}
          title={readonly ? undefined : editingHP ? undefined : 'Click to edit HP'}
        >
          <div className="text-xs text-gray-400 uppercase">HP</div>
          {editingHP ? (
            <div className="space-y-1 mt-1">
              <div className="flex items-center justify-center gap-1">
                <input
                  type="number"
                  value={hpCurrent}
                  onChange={(e) => setHpCurrent(parseInt(e.target.value, 10) || 0)}
                  className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-sm text-green-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-gray-500">/</span>
                <input
                  type="number"
                  value={hpMax}
                  onChange={(e) => setHpMax(parseInt(e.target.value, 10) || 0)}
                  className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-sm text-green-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-gray-500">Temp:</span>
                <input
                  type="number"
                  value={hpTemp}
                  onChange={(e) => setHpTemp(parseInt(e.target.value, 10) || 0)}
                  className="w-10 bg-gray-800 border border-gray-600 rounded text-center text-xs text-blue-400 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-1 justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    saveHP()
                  }}
                  className="px-2 py-0.5 text-xs bg-green-700 hover:bg-green-600 rounded text-white"
                >
                  Save
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingHP(false)
                  }}
                  className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold text-green-400">
                {effectiveCharacter.hitPoints.current + effectiveCharacter.hitPoints.temporary}/
                {effectiveCharacter.hitPoints.maximum}
              </div>
              {effectiveCharacter.hitPoints.temporary > 0 && (
                <div className="text-xs text-blue-400">+{effectiveCharacter.hitPoints.temporary} temp</div>
              )}
              {/* Bloodied indicator */}
              {effectiveCharacter.hitPoints.current > 0 &&
                effectiveCharacter.hitPoints.current <= Math.floor(effectiveCharacter.hitPoints.maximum / 2) && (
                  <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-0.5">Bloodied</div>
                )}
              {/* Hit Point Dice */}
              {(() => {
                const remaining = effectiveCharacter.hitDiceRemaining
                const isMulticlass = effectiveCharacter.classes.length > 1
                const spent = effectiveCharacter.level - remaining
                if (isMulticlass) {
                  // Show per-class die breakdown
                  const diceDisplay = effectiveCharacter.classes.map((c) => `${c.level}d${c.hitDie}`).join(' + ')
                  return (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {remaining}/{effectiveCharacter.level} ({diceDisplay})
                      {spent > 0 && <span className="text-red-400 ml-1">({spent} spent)</span>}
                    </div>
                  )
                }
                const hitDie = effectiveCharacter.classes[0]?.hitDie ?? 8
                return (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {remaining}/{effectiveCharacter.level} d{hitDie}
                    {spent > 0 && <span className="text-red-400 ml-1">({spent} spent)</span>}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* AC */}
        <div
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center"
          title={[
            equippedArmor ? `${equippedArmor.name}: ${equippedArmor.acBonus}` : `Unarmored: 10 + DEX`,
            equippedShield ? `Shield: +${equippedShield.acBonus}` : '',
            hasDefenseFS && equippedArmor ? '+1 (Defense)' : '',
            hasMediumArmorMaster && equippedArmor?.category === 'medium' ? '+1 DEX cap (Medium Armor Master)' : '',
            hasHeavyArmorMaster && equippedArmor?.category === 'heavy' ? `DR ${profBonus} (Heavy Armor Master)` : '',
            ...resolved.sources
              .filter((s) => s.effects.some((e) => e.type === 'ac_bonus') && s.sourceType !== 'fighting-style')
              .map((s) => {
                const bonus = s.effects.filter((e) => e.type === 'ac_bonus').reduce((sum, e) => sum + (e.value ?? 0), 0)
                return `+${bonus} (${s.sourceName})`
              })
          ]
            .filter(Boolean)
            .join('\n')}
        >
          <div className="text-xs text-gray-400 uppercase">AC</div>
          <div className="text-xl font-bold">{dynamicAC}</div>
          {acEquipmentBonus > 0 && <div className="text-xs text-blue-400">+{acEquipmentBonus} equip</div>}
          {hasDefenseFS && equippedArmor && <div className="text-[10px] text-green-400">+1 Defense</div>}
          {resolved.sources
            .filter((s) => s.effects.some((e) => e.type === 'ac_bonus') && s.sourceType !== 'fighting-style')
            .map((s) => (
              <div key={s.sourceId} className="text-[10px] text-purple-400">
                +{s.effects.filter((e) => e.type === 'ac_bonus').reduce((sum, e) => sum + (e.value ?? 0), 0)}{' '}
                {s.sourceName}
              </div>
            ))}
        </div>

        {/* Initiative */}
        <div
          className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center"
          title={initTooltipParts.join('\n')}
        >
          <div className="text-xs text-gray-400 uppercase">{thirdStat.label}</div>
          <div className="text-xl font-bold">{thirdStat.value}</div>
          {hasAlert && <div className="text-[10px] text-green-400">+PB (Alert)</div>}
        </div>

        {/* Speed */}
        {(() => {
          const rawSpeed = character.speed ?? 30
          // Apply feat speed bonuses
          const hasSpeedy = feats.some((f) => f.id === 'speedy')
          const hasBoonOfSpeed = feats.some((f) => f.id === 'boon-of-speed')
          const featSpeedBonus = (hasSpeedy ? 10 : 0) + (hasBoonOfSpeed ? 30 : 0)
          const baseSpeed = rawSpeed + featSpeedBonus + resolved.speedBonus
          const conditions = effectiveCharacter.conditions ?? []
          const hasGrappled = conditions.some((c) => c.name?.toLowerCase() === 'grappled')
          const hasRestrained = conditions.some((c) => c.name?.toLowerCase() === 'restrained')
          const exhaustionLevel = (() => {
            const exh = conditions.find((c) => c.name?.toLowerCase() === 'exhaustion')
            return exh?.value ?? 0
          })()
          const speedZero = hasGrappled || hasRestrained
          const exhaustionPenalty = exhaustionLevel * 5
          const effectiveSpeed = speedZero ? 0 : Math.max(0, baseSpeed - exhaustionPenalty)
          const isReduced = effectiveSpeed < baseSpeed

          const tooltipParts: string[] = [`Base: ${rawSpeed} ft`]
          if (hasSpeedy) tooltipParts.push('+10 ft (Speedy)')
          if (hasBoonOfSpeed) tooltipParts.push('+30 ft (Boon of Speed)')
          if (resolved.speedBonus > 0) {
            resolved.sources
              .filter((s) => s.effects.some((e) => e.type === 'speed_bonus'))
              .forEach((s) => {
                const bonus = s.effects
                  .filter((e) => e.type === 'speed_bonus')
                  .reduce((sum, e) => sum + (e.value ?? 0), 0)
                tooltipParts.push(`+${bonus} ft (${s.sourceName})`)
              })
          }
          if (hasGrappled) tooltipParts.push('Grappled: Speed 0')
          if (hasRestrained) tooltipParts.push('Restrained: Speed 0')
          if (exhaustionLevel > 0) tooltipParts.push(`Exhaustion ${exhaustionLevel}: -${exhaustionPenalty} ft`)

          return (
            <div
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center"
              title={isReduced || featSpeedBonus > 0 || resolved.speedBonus > 0 ? tooltipParts.join('\n') : undefined}
            >
              <div className="text-xs text-gray-400 uppercase">Speed</div>
              <div className={`text-xl font-bold ${isReduced ? 'text-red-400' : ''}`}>{effectiveSpeed} ft</div>
              {isReduced && <div className="text-[10px] text-red-400 mt-0.5">(base {baseSpeed} ft)</div>}
              {(() => {
                const speeds = effectiveCharacter.speeds
                if (!speeds) return null
                const entries = Object.entries(speeds).filter(([, v]) => v > 0)
                if (entries.length === 0) return null
                return (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {entries.map(([k, v]) => `${k} ${v} ft`).join(', ')}
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* Size */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 uppercase">Size</div>
          <div className="text-xl font-bold">{characterSize}</div>
          {effectiveCharacter.creatureType && (
            <div className="text-[10px] text-gray-500">{effectiveCharacter.creatureType}</div>
          )}
        </div>

        {/* Prof Bonus + Save DC + Passive Perception */}
        <div className="col-span-5 text-sm text-gray-400 flex gap-4">
          <span>
            Proficiency Bonus: <span className="text-amber-400 font-semibold">+{profBonus}</span>
          </span>
          {(() => {
            const scInfo = computeSpellcastingInfo(
              effectiveCharacter.classes.map((c) => ({
                classId: c.name.toLowerCase(),
                subclassId: c.subclass?.toLowerCase(),
                level: c.level
              })),
              effectiveCharacter.abilityScores,
              effectiveCharacter.level,
              effectiveCharacter.buildChoices.classId,
              effectiveCharacter.buildChoices.subclassId
            )
            if (!scInfo) return null
            // 2024 PHB: Exhaustion reduces spell save DC by 2 per level
            const conditions = effectiveCharacter.conditions ?? []
            const exhCond = conditions.find((c) => c.name?.toLowerCase() === 'exhaustion')
            const exhLevel = exhCond?.value ?? 0
            const exhPenalty = exhLevel * 2
            const effectiveDC = scInfo.spellSaveDC + resolved.spellDCBonus - exhPenalty
            const effectiveAttack = scInfo.spellAttackBonus + resolved.spellAttackBonus
            const dcTooltipParts = [`Base ${scInfo.spellSaveDC}`]
            if (resolved.spellDCBonus > 0) dcTooltipParts.push(`+${resolved.spellDCBonus} (items)`)
            if (exhPenalty > 0) dcTooltipParts.push(`-${exhPenalty} (Exhaustion ${exhLevel})`)
            return (
              <>
                <span title={dcTooltipParts.length > 1 ? dcTooltipParts.join(' ') : undefined}>
                  Save DC:{' '}
                  <span className={`font-semibold ${exhPenalty > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {effectiveDC}
                  </span>
                </span>
                <span
                  title={
                    resolved.spellAttackBonus > 0
                      ? `Base ${formatMod(scInfo.spellAttackBonus)} + ${resolved.spellAttackBonus} (items)`
                      : undefined
                  }
                >
                  Spell Atk: <span className="text-amber-400 font-semibold">{formatMod(effectiveAttack)}</span>
                </span>
              </>
            )
          })()}
          {(() => {
            const percSkill = effectiveCharacter.skills.find((s) => s.name === 'Perception')
            const percBonus = percSkill?.expertise ? profBonus * 2 : percSkill?.proficient ? profBonus : 0
            const conditions = effectiveCharacter.conditions ?? []
            const exhCond = conditions.find((c) => c.name?.toLowerCase() === 'exhaustion')
            const exhPenalty = (exhCond?.value ?? 0) * 2
            const passivePerc = 10 + abilityModifier(effectiveCharacter.abilityScores.wisdom) + percBonus - exhPenalty
            return (
              <span
                title={
                  exhPenalty > 0
                    ? `Base ${10 + abilityModifier(effectiveCharacter.abilityScores.wisdom) + percBonus} - ${exhPenalty} (Exhaustion)`
                    : undefined
                }
              >
                Passive Perception:{' '}
                <span className={`font-semibold ${exhPenalty > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {passivePerc}
                </span>
              </span>
            )
          })()}
        </div>

        {/* Senses */}
        {effectiveCharacter.senses && effectiveCharacter.senses.length > 0 && (
          <div className="col-span-5 text-sm text-gray-400">
            Senses: <span className="text-amber-400">{effectiveCharacter.senses.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Wild Shape Tracker (Druid level 2+) */}
      {effectiveCharacter.wildShapeUses && effectiveCharacter.wildShapeUses.max > 0 && (
        <div className="mt-3 bg-gray-900/50 border border-green-900/50 rounded-lg p-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-400 font-semibold">Wild Shape:</span>
            <div className="flex items-center gap-2">
              <button
                disabled={readonly || effectiveCharacter.wildShapeUses.current <= 0}
                onClick={() => {
                  const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
                  const ws = (latest as Character5e).wildShapeUses
                  if (!ws || ws.current <= 0) return
                  const updated = {
                    ...latest,
                    wildShapeUses: { ...ws, current: ws.current - 1 },
                    updatedAt: new Date().toISOString()
                  }
                  saveCharacter(updated)
                  const { role: r, sendMessage } = useNetworkStore.getState()
                  if (r === 'host' && updated.playerId !== 'local') {
                    sendMessage('dm:character-update', {
                      characterId: updated.id,
                      characterData: updated,
                      targetPeerId: updated.playerId
                    })
                    useLobbyStore.getState().setRemoteCharacter(updated.id, updated as Character)
                  }
                }}
                className="w-6 h-6 rounded bg-gray-800 border border-gray-600 hover:border-green-500 text-gray-400 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold flex items-center justify-center"
              >
                -
              </button>
              <span className="text-lg font-bold text-green-400">{effectiveCharacter.wildShapeUses.current}</span>
              <span className="text-sm text-gray-500">/ {effectiveCharacter.wildShapeUses.max}</span>
              <button
                disabled={readonly || effectiveCharacter.wildShapeUses.current >= effectiveCharacter.wildShapeUses.max}
                onClick={() => {
                  const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
                  const ws = (latest as Character5e).wildShapeUses
                  if (!ws || ws.current >= ws.max) return
                  const updated = {
                    ...latest,
                    wildShapeUses: { ...ws, current: ws.current + 1 },
                    updatedAt: new Date().toISOString()
                  }
                  saveCharacter(updated)
                  const { role: r, sendMessage } = useNetworkStore.getState()
                  if (r === 'host' && updated.playerId !== 'local') {
                    sendMessage('dm:character-update', {
                      characterId: updated.id,
                      characterData: updated,
                      targetPeerId: updated.playerId
                    })
                    useLobbyStore.getState().setRemoteCharacter(updated.id, updated as Character)
                  }
                }}
                className="w-6 h-6 rounded bg-gray-800 border border-gray-600 hover:border-green-500 text-gray-400 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold flex items-center justify-center"
              >
                +
              </button>
            </div>
            <span className="text-xs text-gray-500 ml-auto">Short Rest: +1 | Long Rest: all</span>
          </div>
        </div>
      )}

      {/* Death Saves (when HP <= 0) */}
      {effectiveCharacter.hitPoints.current <= 0 && (
        <div className="mt-3 bg-gray-900/50 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-400 font-semibold">Death Saves:</span>

            {/* Successes */}
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <button
                  key={`success-${i}`}
                  onClick={() => toggleSuccess(i)}
                  disabled={readonly}
                  className={`text-lg ${readonly ? '' : 'cursor-pointer'}`}
                  title={`Success ${i + 1}`}
                >
                  {i < deathSaves.successes ? (
                    <span className="text-green-500">{'\u25CF'}</span>
                  ) : (
                    <span className="text-gray-600">{'\u25CB'}</span>
                  )}
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-1">Successes</span>
            </div>

            <span className="text-gray-600">|</span>

            {/* Failures */}
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <button
                  key={`failure-${i}`}
                  onClick={() => toggleFailure(i)}
                  disabled={readonly}
                  className={`text-lg ${readonly ? '' : 'cursor-pointer'}`}
                  title={`Failure ${i + 1}`}
                >
                  {i < deathSaves.failures ? (
                    <span className="text-red-500">{'\u25CF'}</span>
                  ) : (
                    <span className="text-gray-600">{'\u25CB'}</span>
                  )}
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-1">Failures</span>
            </div>

            {/* Roll Death Save button */}
            {!readonly && deathSaves.successes < 3 && deathSaves.failures < 3 && (
              <button
                onClick={() => {
                  const roll = rollSingle(20)
                  // Trigger 3D dice animation for death save
                  trigger3dDice({
                    formula: '1d20',
                    rolls: [roll],
                    total: roll,
                    rollerName: effectiveCharacter.name
                  })
                  let newSuccesses = deathSaves.successes
                  let newFailures = deathSaves.failures
                  let resultMsg = ''

                  if (roll === 1) {
                    // Nat 1: two failures
                    newFailures = Math.min(3, newFailures + 2)
                    resultMsg = `Death Save: Natural 1! Two failures (${newFailures}/3)`
                  } else if (roll === 20) {
                    // Nat 20: regain 1 HP, clear death saves
                    resultMsg = `Death Save: Natural 20! Regains 1 HP!`
                    const latest =
                      useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
                    const updated = {
                      ...latest,
                      hitPoints: { ...effectiveCharacter.hitPoints, current: 1 },
                      deathSaves: { successes: 0, failures: 0 },
                      updatedAt: new Date().toISOString()
                    }
                    saveCharacter(updated)
                    const { role, sendMessage } = useNetworkStore.getState()
                    if (role === 'host' && updated.playerId !== 'local') {
                      sendMessage('dm:character-update', {
                        characterId: updated.id,
                        characterData: updated,
                        targetPeerId: updated.playerId
                      })
                      useLobbyStore.getState().setRemoteCharacter(updated.id, updated as Character)
                    }
                    // Broadcast to chat
                    const { sendMessage: send } = useNetworkStore.getState()
                    send('chat:message', { message: `${effectiveCharacter.name} ${resultMsg}`, isSystem: true })
                    return
                  } else if (roll >= 10) {
                    newSuccesses = Math.min(3, newSuccesses + 1)
                    resultMsg = `Death Save: ${roll} - Success! (${newSuccesses}/3)`
                  } else {
                    newFailures = Math.min(3, newFailures + 1)
                    resultMsg = `Death Save: ${roll} - Failure (${newFailures}/3)`
                  }

                  saveDeathSaves(newSuccesses, newFailures)
                  const { sendMessage: send } = useNetworkStore.getState()
                  send('chat:message', { message: `${effectiveCharacter.name} ${resultMsg}`, isSystem: true })
                }}
                className="px-2.5 py-1 text-xs bg-amber-700 hover:bg-amber-600 rounded text-white font-semibold cursor-pointer"
              >
                Roll Death Save
              </button>
            )}

            {/* Reset button */}
            {!readonly && (deathSaves.successes > 0 || deathSaves.failures > 0) && (
              <button
                onClick={resetDeathSaves}
                className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 ml-auto"
              >
                Reset
              </button>
            )}
          </div>

          {/* Status messages */}
          {deathSaves.successes >= 3 && <div className="mt-2 text-sm text-green-400 font-semibold">Stabilized!</div>}
          {deathSaves.failures >= 3 && <div className="mt-2 text-sm text-red-400 font-semibold">Dead!</div>}
        </div>
      )}
    </div>
  )
}
