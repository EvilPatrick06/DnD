import { useState } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import type { WeaponEntry, ArmorEntry } from '../../types/character-common'
import { abilityModifier } from '../../types/character-common'
import { useCharacterStore } from '../../stores/useCharacterStore'
import SheetSectionWrapper from './SheetSectionWrapper'

interface EquipmentSectionProps {
  character: Character
  readonly?: boolean
}

export default function EquipmentSection({ character, readonly }: EquipmentSectionProps): JSX.Element {
  const equipment = character.equipment
  const hasEquipment = equipment.length > 0
  const weapons: WeaponEntry[] = ('weapons' in character ? (character as { weapons: WeaponEntry[] }).weapons : []) ?? []
  const armor: ArmorEntry[] = character.armor ?? []
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [showAddWeapon, setShowAddWeapon] = useState(false)
  const [weaponForm, setWeaponForm] = useState({
    name: '',
    damage: '',
    damageType: '',
    properties: '',
    ability: 'STR' as 'STR' | 'DEX',
    proficient: true
  })

  const handleRemoveWeapon = (weaponId: string): void => {
    const latest = useCharacterStore.getState().characters.find(c => c.id === character.id)
    if (!latest) return
    const currentWeapons: WeaponEntry[] = ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const updated = {
      ...latest,
      weapons: currentWeapons.filter(w => w.id !== weaponId),
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
  }

  const handleAddWeapon = (): void => {
    if (!weaponForm.name.trim()) return
    const latest = useCharacterStore.getState().characters.find(c => c.id === character.id)
    if (!latest) return
    const abilityScore = weaponForm.ability === 'STR'
      ? latest.abilityScores.strength
      : latest.abilityScores.dexterity
    const mod = abilityModifier(abilityScore)
    const profBonus = is5eCharacter(latest)
      ? Math.ceil(latest.level / 4) + 1
      : latest.level + 2
    const attackBonus = mod + (weaponForm.proficient ? profBonus : 0)
    const newWeapon: WeaponEntry = {
      id: crypto.randomUUID(),
      name: weaponForm.name.trim(),
      damage: weaponForm.damage.trim() || '1d6',
      damageType: weaponForm.damageType.trim() || 'slashing',
      attackBonus,
      properties: weaponForm.properties.split(',').map(p => p.trim()).filter(Boolean),
      proficient: weaponForm.proficient
    }
    const currentWeapons: WeaponEntry[] = ('weapons' in latest ? (latest as { weapons: WeaponEntry[] }).weapons : []) ?? []
    const updated = {
      ...latest,
      weapons: [...currentWeapons, newWeapon],
      updatedAt: new Date().toISOString()
    } as Character
    useCharacterStore.getState().saveCharacter(updated)
    setWeaponForm({ name: '', damage: '', damageType: '', properties: '', ability: 'STR', proficient: true })
    setShowAddWeapon(false)
  }

  // Currency
  const currency = character.treasure

  return (
    <SheetSectionWrapper title="Equipment & Currency">
      {/* Currency display */}
      <div className="flex gap-3 mb-3">
        {currency.pp > 0 && <CoinBadge label="PP" value={currency.pp} color="gray-400" />}
        <CoinBadge label="GP" value={currency.gp} color="yellow-500" />
        {is5eCharacter(character) && (character.treasure.ep ?? 0) > 0 && <CoinBadge label="EP" value={character.treasure.ep!} color="blue-400" />}
        <CoinBadge label="SP" value={currency.sp} color="gray-300" />
        <CoinBadge label="CP" value={currency.cp} color="amber-700" />
      </div>

      {/* Weapons */}
      {weapons.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weapons</div>
          <div className="space-y-1">
            {weapons.map((w, i) => (
              <div key={w.id || i} className="bg-gray-800/50 rounded p-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-200 font-medium">{w.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400">+{w.attackBonus}</span>
                    <span className="text-gray-400">{w.damage} {w.damageType}</span>
                    {!readonly && w.id && (
                      <button
                        onClick={() => handleRemoveWeapon(w.id)}
                        className="text-gray-600 hover:text-red-400 cursor-pointer ml-1"
                        title="Remove weapon"
                      >
                        &#x2715;
                      </button>
                    )}
                  </div>
                </div>
                {w.properties.length > 0 && (
                  <div className="text-xs text-gray-500 mt-0.5">{w.properties.join(', ')}</div>
                )}
                {w.range && <span className="text-xs text-gray-600">Range: {w.range}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Weapon */}
      {!readonly && (
        <div className="mb-3">
          {showAddWeapon ? (
            <div className="bg-gray-800/50 rounded p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={weaponForm.name}
                  onChange={(e) => setWeaponForm(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Damage (1d8)"
                  value={weaponForm.damage}
                  onChange={(e) => setWeaponForm(f => ({ ...f, damage: e.target.value }))}
                  className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Damage type"
                  value={weaponForm.damageType}
                  onChange={(e) => setWeaponForm(f => ({ ...f, damageType: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Properties (comma-separated)"
                  value={weaponForm.properties}
                  onChange={(e) => setWeaponForm(f => ({ ...f, properties: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={weaponForm.ability}
                  onChange={(e) => setWeaponForm(f => ({ ...f, ability: e.target.value as 'STR' | 'DEX' }))}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="STR">STR</option>
                  <option value="DEX">DEX</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={weaponForm.proficient}
                    onChange={(e) => setWeaponForm(f => ({ ...f, proficient: e.target.checked }))}
                    className="rounded"
                  />
                  Proficient
                </label>
                <div className="flex-1" />
                <button
                  onClick={handleAddWeapon}
                  disabled={!weaponForm.name.trim()}
                  className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white cursor-pointer"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddWeapon(false)}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddWeapon(true)}
              className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              + Add Weapon
            </button>
          )}
        </div>
      )}

      {/* Armor summary */}
      {armor.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Armor</div>
          <div className="space-y-1">
            {armor.map((a) => (
              <div key={a.id} className="bg-gray-800/50 rounded p-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-200 font-medium">{a.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400">+{a.acBonus} AC</span>
                    {a.equipped && <span className="text-green-400">Equipped</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                  {a.category && <span className="capitalize">{a.category}</span>}
                  {a.dexCap != null && <span>Dex cap: +{a.dexCap}</span>}
                  {a.stealthDisadvantage && <span className="text-yellow-500">Stealth disadv.</span>}
                  {a.checkPenalty != null && a.checkPenalty < 0 && <span>Check: {a.checkPenalty}</span>}
                  {a.speedPenalty != null && a.speedPenalty < 0 && <span>Speed: {a.speedPenalty}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General equipment list */}
      {hasEquipment ? (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
          {equipment.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setExpandedItem(expandedItem === i ? null : i)}
                className="w-full flex justify-between py-1 border-b border-gray-800 last:border-0 text-sm cursor-pointer hover:bg-gray-800/30 transition-colors"
              >
                <span className="text-gray-300 flex items-center gap-1">
                  {item.name}
                  <span className="text-gray-600 text-[10px]">{expandedItem === i ? '\u25BE' : '\u25B8'}</span>
                </span>
                <div className="flex items-center gap-2">
                  {item.quantity > 1 && (
                    <span className="text-gray-500">x{item.quantity}</span>
                  )}
                  {isPf2eCharacter(character) && 'bulk' in item && (item as { bulk?: number }).bulk != null && (
                    <span className="text-xs text-gray-600">
                      {(item as { bulk?: number }).bulk}B
                    </span>
                  )}
                  {is5eCharacter(character) && 'weight' in item && (item as { weight?: number }).weight != null && (
                    <span className="text-xs text-gray-600">
                      {(item as { weight?: number }).weight} lb
                    </span>
                  )}
                </div>
              </button>
              {expandedItem === i && item.description && (
                <div className="text-xs text-gray-500 py-1 pl-2">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        weapons.length === 0 && armor.length === 0 && (
          <p className="text-sm text-gray-500">No equipment.</p>
        )
      )}

      {/* PF2e bulk tracking */}
      {isPf2eCharacter(character) && (
        <div className="mt-2 text-xs text-gray-500">
          Bulk: {equipment.reduce((sum, e) => sum + ((e as { bulk?: number }).bulk ?? 0), 0)} / {5 + Math.floor((character.abilityScores.strength - 10) / 2)} (Encumbered at {5 + Math.floor((character.abilityScores.strength - 10) / 2) + 5})
        </div>
      )}

      {/* 5e proficiencies */}
      {is5eCharacter(character) && (
        <div className="mt-3 space-y-1 text-sm text-gray-400">
          {character.proficiencies.tools.length > 0 && (
            <p><span className="text-gray-500">Tools: </span>{character.proficiencies.tools.join(', ')}</p>
          )}
          {character.proficiencies.languages.length > 0 && (
            <p><span className="text-gray-500">Languages: </span>{character.proficiencies.languages.join(', ')}</p>
          )}
        </div>
      )}

      {/* PF2e languages */}
      {isPf2eCharacter(character) && character.languages.length > 0 && (
        <div className="mt-3 text-sm text-gray-400">
          <span className="text-gray-500">Languages: </span>{character.languages.join(', ')}
        </div>
      )}
    </SheetSectionWrapper>
  )
}

function CoinBadge({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-${color} font-bold text-sm`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
