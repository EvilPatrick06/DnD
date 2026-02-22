import { useEffect, useMemo, useState } from 'react'
import { load5eEquipment } from '../../../services/data-provider'
import { getMasteryDescription } from '../../../data/weapon-mastery'
import type { WeaponContext } from '../../../services/combat/effect-resolver-5e'
import { resolveEffects } from '../../../services/combat/effect-resolver-5e'
import { computeSpellcastingInfo } from '../../../services/character/spell-data'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import type { WeaponEntry } from '../../../types/character-common'
import { abilityModifier, formatMod } from '../../../types/character-common'
import { addCurrency, computeSellPrice, deductWithConversion, parseCost, totalInCopper } from '../../../utils/currency'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

// --- Weapon data types ---

interface WeaponData5e {
  name: string
  category: string
  damage: string
  damageType: string
  weight?: number
  properties: string[]
  cost: string
  mastery?: string
}

function useWeaponDatabase(): WeaponData5e[] {
  const [weaponList, setWeaponList] = useState<WeaponData5e[]>([])
  useEffect(() => {
    load5eEquipment()
      .then((data) => setWeaponList((data.weapons as unknown as WeaponData5e[]) ?? []))
      .catch(() => {})
  }, [])
  return weaponList
}

function weaponDataToEntry(item: WeaponData5e, character: Character5e): WeaponEntry {
  const profBonus = Math.ceil(character.level / 4) + 1
  const isFinesse = item.properties.some((p) => p.toLowerCase() === 'finesse')
  const isRanged = item.category.toLowerCase().includes('ranged')
  const usesDex = isFinesse || isRanged
  const abilityScore = usesDex ? character.abilityScores.dexterity : character.abilityScores.strength
  const mod = abilityModifier(abilityScore)
  return {
    id: crypto.randomUUID(),
    name: item.name,
    damage: item.damage,
    damageType: item.damageType,
    attackBonus: mod + profBonus,
    properties: item.properties,
    proficient: true,
    range: isRanged
      ? item.properties.find((p) => p.toLowerCase().startsWith('range'))?.replace(/range\s*/i, '')
      : undefined,
    mastery: item.mastery,
    cost: item.cost
  }
}

function WeaponRow({
  weapon,
  onRemove,
  onSell,
  character,
  weaponDatabase
}: {
  weapon: WeaponEntry
  onRemove?: () => void
  onSell?: () => void
  character: Character5e
  weaponDatabase?: WeaponData5e[]
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  // Dynamically compute attack bonus and damage modifier from character stats
  const profBonus = Math.ceil(character.level / 4) + 1
  const isFinesse = weapon.properties.some((p) => p.toLowerCase() === 'finesse')
  const isRanged = weapon.properties.some((p) => p.toLowerCase().startsWith('range')) || weapon.range != null
  const isHeavy = weapon.properties.some((p) => p.toLowerCase() === 'heavy')
  const isThrown = weapon.properties.some((p) => p.toLowerCase() === 'thrown')
  const isCrossbow = weapon.name.toLowerCase().includes('crossbow')
  const strMod = abilityModifier(character.abilityScores.strength)
  const dexMod = abilityModifier(character.abilityScores.dexterity)

  let abilityMod: number
  if (isFinesse) {
    abilityMod = Math.max(strMod, dexMod)
  } else if (isRanged) {
    abilityMod = dexMod
  } else {
    abilityMod = strMod
  }

  const proficient = weapon.proficient !== false
  const baseAttackBonus = abilityMod + (proficient ? profBonus : 0)

  // Resolve effects for tooltip breakdown
  const resolved = useMemo(() => resolveEffects(character), [character])
  const weaponCtx: WeaponContext = {
    isMelee: !isRanged,
    isRanged,
    isHeavy,
    isThrown,
    isCrossbow,
    isSpell: false,
    damageType: weapon.damageType
  }
  const effectAttackBonus = resolved.attackBonus(weaponCtx)
  const effectDamageBonus = resolved.damageBonus(weaponCtx)
  const dynamicAttackBonus = baseAttackBonus + effectAttackBonus
  const totalDamageMod = abilityMod + effectDamageBonus

  // Build damage string with ability modifier + effect bonus
  const damageDisplay =
    totalDamageMod !== 0 ? `${weapon.damage}${totalDamageMod >= 0 ? '+' : ''}${totalDamageMod}` : weapon.damage

  // Attack tooltip breakdown
  const attackTooltipParts = [
    `${isFinesse ? 'DEX/STR' : isRanged ? 'DEX' : 'STR'} ${formatMod(abilityMod)}`,
    proficient ? `Prof ${formatMod(profBonus)}` : ''
  ]
  if (effectAttackBonus !== 0) {
    const atkSources = resolved.sources
      .filter((s) => s.effects.some((e) => e.type === 'attack_bonus'))
      .map((s) => {
        const bonus = s.effects.filter((e) => e.type === 'attack_bonus').reduce((sum, e) => sum + (e.value ?? 0), 0)
        return `${s.sourceName} ${formatMod(bonus)}`
      })
    attackTooltipParts.push(...atkSources)
  }
  const attackTooltip = `${attackTooltipParts.filter(Boolean).join('\n')}\n= ${formatMod(dynamicAttackBonus)}`

  // Damage tooltip breakdown
  const damageTooltipParts = [
    `${weapon.damage} + ${isFinesse ? 'DEX/STR' : isRanged ? 'DEX' : 'STR'} ${formatMod(abilityMod)}`
  ]
  if (effectDamageBonus !== 0) {
    const dmgSources = resolved.sources
      .filter((s) => s.effects.some((e) => e.type === 'damage_bonus'))
      .map((s) => {
        const bonus = s.effects.filter((e) => e.type === 'damage_bonus').reduce((sum, e) => sum + (e.value ?? 0), 0)
        return `${s.sourceName} ${formatMod(bonus)}`
      })
    damageTooltipParts.push(...dmgSources)
  }
  const extraDice = resolved.getExtraDamageDice(weaponCtx)
  if (extraDice.length > 0) {
    for (const ed of extraDice) damageTooltipParts.push(`+${ed.dice} ${ed.damageType}`)
  }

  // Look up weapon data for description
  const dbWeapon = weaponDatabase?.find((w) => w.name.toLowerCase() === weapon.name.toLowerCase())

  return (
    <div>
      <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 text-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1 transition-colors"
        >
          <span className="text-gray-200 font-medium">{weapon.name}</span>
          <span className="text-gray-600 text-[10px]">{expanded ? '\u25BE' : '\u25B8'}</span>
          {weapon.mastery && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700"
              title={getMasteryDescription(weapon.mastery)}
            >
              {weapon.mastery}
            </span>
          )}
        </button>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-amber-400 font-mono" title={attackTooltip}>
            {formatMod(dynamicAttackBonus)}
          </span>
          <span className="text-red-400 font-medium" title={damageTooltipParts.join('\n')}>
            {damageDisplay} {weapon.damageType}
          </span>
          {weapon.range && <span className="text-gray-500">{weapon.range}</span>}
          {onSell && (
            <button
              onClick={onSell}
              className="text-gray-600 hover:text-green-400 cursor-pointer ml-1"
              title="Sell (half price)"
            >
              &#x24;
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-gray-600 hover:text-red-400 cursor-pointer ml-1"
              title="Remove weapon"
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="text-xs text-gray-500 py-1 pl-2 space-y-0.5">
          {weapon.properties.length > 0 && (
            <div>
              <span className="text-gray-600">Properties:</span> {weapon.properties.join(', ')}
            </div>
          )}
          {(weapon.cost || dbWeapon?.cost) && (
            <div>
              <span className="text-gray-600">Cost:</span> {weapon.cost || dbWeapon?.cost}
            </div>
          )}
          {dbWeapon?.weight != null && (
            <div>
              <span className="text-gray-600">Weight:</span> {dbWeapon.weight} lb
            </div>
          )}
          {weapon.description || dbWeapon ? (
            <div>
              {weapon.description ||
                `${dbWeapon?.category ?? ''} weapon. ${dbWeapon?.damage} ${dbWeapon?.damageType} damage.`}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

interface OffenseSection5eProps {
  character: Character5e
  readonly?: boolean
}

export default function OffenseSection5e({ character, readonly }: OffenseSection5eProps): JSX.Element {
  const newWeapons: WeaponEntry[] = character.weapons ?? []
  const weaponDatabase = useWeaponDatabase()

  const [showCustomForm, setShowCustomForm] = useState(false)
  const [showSrdBrowser, setShowSrdBrowser] = useState(false)
  const [selectedWeaponIdx, setSelectedWeaponIdx] = useState(-1)
  const [buyWarning, setBuyWarning] = useState<string | null>(null)
  const [costError, setCostError] = useState<string | null>(null)
  const [showAddWeaponProf, setShowAddWeaponProf] = useState(false)
  const [customWeaponProf, setCustomWeaponProf] = useState('')
  const [expandedWeaponProf, setExpandedWeaponProf] = useState<string | null>(null)

  const [weaponForm, setWeaponForm] = useState({
    name: '',
    damage: '',
    damageType: '',
    properties: '',
    ability: 'STR' as 'STR' | 'DEX',
    proficient: true,
    cost: ''
  })

  const broadcastIfDM = (updated: Character): void => {
    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated)
    }
  }

  const handleRemoveWeapon = (weaponId: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentWeapons: WeaponEntry[] =
      ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const updated = {
      ...latest,
      weapons: currentWeapons.filter((w) => w.id !== weaponId),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleSellWeapon = (weaponId: string): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return
    const currentWeapons: WeaponEntry[] =
      ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const weapon = currentWeapons.find((w) => w.id === weaponId)
    if (!weapon) return

    let costStr = weapon.cost
    if (!costStr) {
      // Try to look up cost from database
      const dbWeapon = weaponDatabase.find((w) => w.name.toLowerCase() === weapon.name.toLowerCase())
      if (dbWeapon) costStr = dbWeapon.cost
    }

    let updatedTreasure = latest.treasure
    if (costStr) {
      const sellPrice = computeSellPrice(costStr)
      if (sellPrice) {
        const currentCurrency = {
          pp: latest.treasure.pp,
          gp: latest.treasure.gp,
          sp: latest.treasure.sp,
          cp: latest.treasure.cp
        }
        updatedTreasure = { ...latest.treasure, ...addCurrency(currentCurrency, sellPrice) }
      }
    }

    const updated = {
      ...latest,
      weapons: currentWeapons.filter((w) => w.id !== weaponId),
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
  }

  const handleAddCustomWeapon = (): void => {
    if (!weaponForm.name.trim()) return
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return

    let updatedTreasure = latest.treasure
    const costStr = weaponForm.cost.trim()
    if (costStr) {
      const cost = parseCost(costStr)
      if (cost && cost.amount > 0) {
        const treasureForDeduction = {
          pp: latest.treasure.pp,
          gp: latest.treasure.gp,
          sp: latest.treasure.sp,
          cp: latest.treasure.cp
        }
        const newCurrency = deductWithConversion(treasureForDeduction, cost)
        if (!newCurrency) {
          setCostError('Not enough funds')
          setTimeout(() => setCostError(null), 3000)
          return
        }
        updatedTreasure = { ...latest.treasure, ...newCurrency }
      }
    }

    const abilityScore = weaponForm.ability === 'STR' ? latest.abilityScores.strength : latest.abilityScores.dexterity
    const mod = abilityModifier(abilityScore)
    const prof = Math.ceil(latest.level / 4) + 1
    const attackBonus = mod + (weaponForm.proficient ? prof : 0)

    const newWeapon: WeaponEntry = {
      id: crypto.randomUUID(),
      name: weaponForm.name.trim(),
      damage: weaponForm.damage.trim() || '1d6',
      damageType: weaponForm.damageType.trim() || 'slashing',
      attackBonus,
      properties: weaponForm.properties
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      proficient: weaponForm.proficient,
      cost: costStr || undefined
    }
    const currentWeapons: WeaponEntry[] =
      ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const updated = {
      ...latest,
      weapons: [...currentWeapons, newWeapon],
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setCostError(null)
    setWeaponForm({ name: '', damage: '', damageType: '', properties: '', ability: 'STR', proficient: true, cost: '' })
    setShowCustomForm(false)
  }

  const handleBuySrdWeapon = (): void => {
    if (selectedWeaponIdx < 0 || selectedWeaponIdx >= weaponDatabase.length) return
    const weaponItem = weaponDatabase[selectedWeaponIdx]
    const cost = parseCost(weaponItem.cost)

    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
    if (!latest) return

    const treasure = latest.treasure
    const currentCurrency = { pp: treasure.pp, gp: treasure.gp, sp: treasure.sp, cp: treasure.cp }

    let newCurrency = currentCurrency
    if (cost && cost.amount > 0) {
      const result = deductWithConversion(currentCurrency, cost)
      if (!result) {
        const rates = { pp: 1000, gp: 100, sp: 10, cp: 1 } as const
        const totalCp = totalInCopper(currentCurrency)
        const costCp = cost.amount * rates[cost.currency]
        setBuyWarning(
          `Not enough funds (need ${cost.amount} ${cost.currency.toUpperCase()} = ${costCp} cp, have ${totalCp} cp total)`
        )
        setTimeout(() => setBuyWarning(null), 4000)
        return
      }
      newCurrency = result
    }

    const newWeapon = weaponDataToEntry(weaponItem, latest as Character5e)
    newWeapon.cost = weaponItem.cost
    const currentWeapons: WeaponEntry[] =
      ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const updatedTreasure = {
      ...treasure,
      pp: newCurrency.pp,
      gp: newCurrency.gp,
      sp: newCurrency.sp,
      cp: newCurrency.cp
    }

    const updated = {
      ...latest,
      weapons: [...currentWeapons, newWeapon],
      treasure: updatedTreasure,
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    broadcastIfDM(updated)
    setSelectedWeaponIdx(-1)
    setShowSrdBrowser(false)
    setBuyWarning(null)
  }

  // Spellcasting info — dynamically computed
  const spellAttack = (() => {
    const scInfo = computeSpellcastingInfo(
      character.classes.map((c) => ({
        classId: c.name.toLowerCase(),
        subclassId: c.subclass?.toLowerCase(),
        level: c.level
      })),
      character.abilityScores,
      character.level,
      character.buildChoices.classId,
      character.buildChoices.subclassId
    )
    if (!scInfo) return null
    return {
      label: 'Spell Attack',
      bonus: scInfo.spellAttackBonus,
      dc: scInfo.spellSaveDC
    }
  })()

  return (
    <SheetSectionWrapper title="Offense">
      {/* Weapons */}
      {newWeapons.length > 0 ? (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weapons</div>
          {newWeapons.map((w, i) => (
            <WeaponRow
              key={w.id || i}
              weapon={w}
              character={character}
              weaponDatabase={weaponDatabase}
              onRemove={!readonly && w.id ? () => handleRemoveWeapon(w.id) : undefined}
              onSell={!readonly && w.id ? () => handleSellWeapon(w.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-3">No weapons equipped.</p>
      )}

      {/* Add Weapon buttons */}
      {!readonly && !showCustomForm && !showSrdBrowser && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowCustomForm(true)}
            className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Custom Weapon
          </button>
          <button
            onClick={() => setShowSrdBrowser(true)}
            className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Shop
          </button>
        </div>
      )}

      {/* Custom weapon form */}
      {!readonly && showCustomForm && (
        <div className="bg-gray-800/50 rounded p-3 space-y-2 mb-3">
          <div className="text-xs text-gray-400 font-medium mb-1">Custom Weapon</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name"
              value={weaponForm.name}
              onChange={(e) => setWeaponForm((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Damage (1d8)"
              value={weaponForm.damage}
              onChange={(e) => setWeaponForm((f) => ({ ...f, damage: e.target.value }))}
              className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Damage type"
              value={weaponForm.damageType}
              onChange={(e) => setWeaponForm((f) => ({ ...f, damageType: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Properties (comma-separated)"
              value={weaponForm.properties}
              onChange={(e) => setWeaponForm((f) => ({ ...f, properties: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Cost (e.g. 25 gp)"
              value={weaponForm.cost}
              onChange={(e) => {
                setWeaponForm((f) => ({ ...f, cost: e.target.value }))
                setCostError(null)
              }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          {costError && <div className="text-xs text-red-400">{costError}</div>}
          <div className="flex items-center gap-3">
            <select
              value={weaponForm.ability}
              onChange={(e) => setWeaponForm((f) => ({ ...f, ability: e.target.value as 'STR' | 'DEX' }))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="STR">STR</option>
              <option value="DEX">DEX</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={weaponForm.proficient}
                onChange={(e) => setWeaponForm((f) => ({ ...f, proficient: e.target.checked }))}
                className="rounded"
              />
              Proficient
            </label>
            <div className="flex-1" />
            <button
              onClick={handleAddCustomWeapon}
              disabled={!weaponForm.name.trim()}
              className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white cursor-pointer"
            >
              Add
            </button>
            <button
              onClick={() => setShowCustomForm(false)}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SRD weapon browser */}
      {!readonly && showSrdBrowser && (
        <div className="bg-gray-800/50 rounded p-3 space-y-2 mb-3">
          <div className="text-xs text-gray-400 font-medium mb-1">Weapon Shop</div>
          <select
            value={selectedWeaponIdx}
            onChange={(e) => {
              setSelectedWeaponIdx(parseInt(e.target.value, 10))
              setBuyWarning(null)
            }}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
          >
            <option value={-1}>-- Select weapon --</option>
            {weaponDatabase.map((item, idx) => (
              <option key={idx} value={idx}>
                {item.name} — {item.damage} {item.damageType} ({item.cost || 'free'})
              </option>
            ))}
          </select>
          {selectedWeaponIdx >= 0 && selectedWeaponIdx < weaponDatabase.length && (
            <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-2">
              {(() => {
                const w = weaponDatabase[selectedWeaponIdx]
                return `${w.damage} ${w.damageType} | ${w.category}${w.properties.length > 0 ? ` | ${w.properties.join(', ')}` : ''}`
              })()}
            </div>
          )}
          {buyWarning && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
              {buyWarning}
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleBuySrdWeapon}
              disabled={selectedWeaponIdx < 0}
              className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white cursor-pointer"
            >
              Buy
            </button>
            <button
              onClick={() => {
                setShowSrdBrowser(false)
                setBuyWarning(null)
                setSelectedWeaponIdx(-1)
              }}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Spell attack for 5e */}
      {spellAttack && (
        <div className="border-t border-gray-800 pt-2 mt-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Spellcasting</div>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">
              Attack: <span className="text-amber-400 font-mono">{formatMod(spellAttack.bonus)}</span>
            </span>
            <span className="text-gray-400">
              Save DC: <span className="text-amber-400 font-mono">{spellAttack.dc}</span>
            </span>
          </div>
        </div>
      )}

      {/* Weapon Proficiencies */}
      {(character.proficiencies.weapons.length > 0 || !readonly) && (
        <div className="border-t border-gray-800 pt-2 mt-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weapon Proficiencies</div>
          <div className="flex flex-wrap gap-1.5">
            {character.proficiencies.weapons.map((prof) => {
              const weaponProfDescriptions: Record<string, string> = {
                'simple weapons':
                  'Includes clubs, daggers, greatclubs, handaxes, javelins, light hammers, maces, quarterstaffs, sickles, and spears.',
                'martial weapons':
                  'Includes battleaxes, flails, glaives, greataxes, greatswords, halberds, lances, longswords, mauls, morningstars, pikes, rapiers, scimitars, shortswords, tridents, war picks, and warhammers.'
              }
              const desc =
                weaponProfDescriptions[prof.toLowerCase()] ||
                (weaponDatabase.find((w) => w.name.toLowerCase() === prof.toLowerCase())
                  ? (() => {
                      const w = weaponDatabase.find((wd) => wd.name.toLowerCase() === prof.toLowerCase())
                      return w
                        ? `${w.category} weapon. ${w.damage} ${w.damageType}. ${w.properties.length > 0 ? `Properties: ${w.properties.join(', ')}.` : ''}`
                        : undefined
                    })()
                  : undefined)
              const isExpanded = expandedWeaponProf === prof
              return (
                <div key={prof} className="inline-flex flex-col">
                  <span
                    className={`inline-flex items-center bg-gray-800/50 text-gray-400 border border-gray-700 rounded-full px-2 py-0.5 text-xs ${desc ? 'cursor-pointer hover:bg-gray-800 hover:text-gray-300' : ''}`}
                    onClick={() => {
                      if (desc) setExpandedWeaponProf(isExpanded ? null : prof)
                    }}
                  >
                    {prof}
                    {desc && <span className="text-gray-600 text-[10px] ml-1">{isExpanded ? '\u25BE' : '?'}</span>}
                  </span>
                  {isExpanded && desc && (
                    <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded px-2 py-1 mt-1 max-w-xs">
                      {desc}
                    </div>
                  )}
                </div>
              )
            })}
            {!readonly && !showAddWeaponProf && (
              <button
                onClick={() => setShowAddWeaponProf(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Add
              </button>
            )}
          </div>
          {!readonly && showAddWeaponProf && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {['Simple weapons', 'Martial weapons']
                .filter((p) => !character.proficiencies.weapons.some((w) => w.toLowerCase() === p.toLowerCase()))
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                      if (!latest || latest.gameSystem !== 'dnd5e') return
                      const l = latest as Character5e
                      const updated = {
                        ...l,
                        proficiencies: { ...l.proficiencies, weapons: [...l.proficiencies.weapons, p] },
                        updatedAt: new Date().toISOString()
                      }
                      useCharacterStore.getState().saveCharacter(updated)
                      broadcastIfDM(updated)
                      setShowAddWeaponProf(false)
                    }}
                    className="px-2 py-0.5 text-[11px] rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/40 cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              <input
                type="text"
                placeholder="Custom..."
                value={customWeaponProf}
                onChange={(e) => setCustomWeaponProf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customWeaponProf.trim()) {
                    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id)
                    if (!latest || latest.gameSystem !== 'dnd5e') return
                    const l = latest as Character5e
                    const updated = {
                      ...l,
                      proficiencies: {
                        ...l.proficiencies,
                        weapons: [...l.proficiencies.weapons, customWeaponProf.trim()]
                      },
                      updatedAt: new Date().toISOString()
                    }
                    useCharacterStore.getState().saveCharacter(updated)
                    broadcastIfDM(updated)
                    setCustomWeaponProf('')
                    setShowAddWeaponProf(false)
                  }
                }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100 w-28 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  setShowAddWeaponProf(false)
                  setCustomWeaponProf('')
                }}
                className="text-[10px] text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Damage Cantrips */}
      {(() => {
        const damageCantrips = (character.knownSpells ?? []).filter(
          (s) => s.level === 0 && /\d+d\d+/.test(s.description)
        )
        if (damageCantrips.length === 0) return null
        return (
          <div className="border-t border-gray-800 pt-2 mt-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Damage Cantrips</div>
            {damageCantrips.map((spell) => {
              const damageMatch = spell.description.match(/(\d+d\d+)\s+(\w+)\s+damage/)
              const damageStr = damageMatch ? `${damageMatch[1]} ${damageMatch[2]}` : ''
              const isSaveSpell = /saving throw/i.test(spell.description)
              return (
                <div
                  key={spell.id}
                  className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-200 font-medium">{spell.name}</span>
                    {spell.concentration && (
                      <span className="text-[10px] text-yellow-500 border border-yellow-700 rounded px-1">C</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {spellAttack && (
                      <span className="text-amber-400 font-mono">
                        {isSaveSpell ? `DC ${spellAttack.dc}` : formatMod(spellAttack.bonus)}
                      </span>
                    )}
                    {damageStr && <span className="text-red-400 font-medium">{damageStr}</span>}
                    <span className="text-gray-500">{spell.range}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </SheetSectionWrapper>
  )
}
