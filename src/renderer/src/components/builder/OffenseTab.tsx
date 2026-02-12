import { useMemo, useState, useEffect } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { abilityModifier, formatMod } from '../../types/character-common'

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

const TEML_LABELS = ['T', 'E', 'M', 'L'] as const

function TEMLDisplay({ rank }: { rank: number }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {TEML_LABELS.map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-gray-500 font-medium">{label}</span>
          <div
            className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
              i < rank
                ? 'border-amber-500 bg-amber-900/40 text-amber-400'
                : 'border-gray-600 bg-gray-800 text-transparent'
            }`}
          >
            {i < rank ? 'X' : '.'}
          </div>
        </div>
      ))}
    </div>
  )
}

interface WeaponData {
  id?: string
  name: string
  category: string
  damage: string
  damageType: string
  properties?: string[]
  traits?: string[]
  cost?: string
  price?: string
  weight?: number
  bulk?: string
  hands?: string
  range?: string
  group?: string
}

interface SelectedWeapon {
  id: string
  name: string
  damage: string
  damageType: string
  attackBonus: number
  properties: string[]
}

export default function OffenseTab(): JSX.Element {
  const abilityScores = useBuilderStore((s) => s.abilityScores)
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const selectedSkills = useBuilderStore((s) => s.selectedSkills)
  const gameSystem = useBuilderStore((s) => s.gameSystem)

  const [weaponDb, setWeaponDb] = useState<WeaponData[]>([])
  const [selectedWeapons, setSelectedWeapons] = useState<SelectedWeapon[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const profBonus = useMemo(() => Math.ceil(targetLevel / 4) + 1, [targetLevel])
  const strMod = useMemo(() => abilityModifier(abilityScores.strength), [abilityScores.strength])
  const dexMod = useMemo(() => abilityModifier(abilityScores.dexterity), [abilityScores.dexterity])
  const wisMod = useMemo(() => abilityModifier(abilityScores.wisdom), [abilityScores.wisdom])

  // Perception
  const perceptionTrained = selectedSkills.includes('Perception')
  const perceptionProfBonus = perceptionTrained ? profBonus : 0
  const perceptionTotal = wisMod + perceptionProfBonus
  const perceptionRank = perceptionTrained ? 1 : 0

  // Load weapon data
  useEffect(() => {
    const path = gameSystem === 'pf2e' ? './data/pf2e/equipment.json' : './data/5e/equipment.json'
    fetch(path)
      .then((r) => r.json())
      .then((data) => {
        const weapons = Array.isArray(data) ? data : data.weapons ?? []
        setWeaponDb(weapons)
      })
      .catch(() => setWeaponDb([]))
  }, [gameSystem])

  const filteredWeapons = useMemo(() => {
    if (!pickerSearch) return weaponDb
    const q = pickerSearch.toLowerCase()
    return weaponDb.filter((w) => w.name.toLowerCase().includes(q))
  }, [weaponDb, pickerSearch])

  const addWeapon = (weapon: WeaponData): void => {
    const props = weapon.properties ?? weapon.traits ?? []
    const isFinesse = props.some((p) => p.toLowerCase().includes('finesse'))
    const isRanged = !!(weapon.range && weapon.range !== '—')
    const abilityMod = isFinesse ? Math.max(strMod, dexMod) : isRanged ? dexMod : strMod
    const attackBonus = abilityMod + profBonus

    setSelectedWeapons((prev) => [
      ...prev,
      {
        id: weapon.id ?? weapon.name.toLowerCase().replace(/\s+/g, '-'),
        name: weapon.name,
        damage: weapon.damage,
        damageType: weapon.damageType,
        attackBonus,
        properties: props
      }
    ])
    setShowPicker(false)
    setPickerSearch('')
  }

  const removeWeapon = (index: number): void => {
    setSelectedWeapons((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* PERCEPTION section */}
      <SectionBanner label="PERCEPTION" />
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gray-100">{formatMod(perceptionTotal)}</span>
            <span className="text-sm text-gray-400">Perception</span>
          </div>
          <TEMLDisplay rank={perceptionRank} />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Ability</span>
            <span className="text-sm text-gray-300 font-medium">{formatMod(wisMod)}</span>
            <span className="text-[10px] text-gray-600">WIS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Prof</span>
            <span className="text-sm text-gray-300 font-medium">{formatMod(perceptionProfBonus)}</span>
            <span className="text-[10px] text-gray-600">{perceptionTrained ? 'Trained' : 'Untrained'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Item</span>
            <span className="text-sm text-gray-300 font-medium">+0</span>
            <span className="text-[10px] text-gray-600">None</span>
          </div>
        </div>
      </div>

      {/* WEAPONS section */}
      <SectionBanner label="WEAPONS" />
      <div className="px-4 py-4 border-b border-gray-800">
        {/* Selected weapons */}
        {selectedWeapons.length > 0 && (
          <div className="mb-3 space-y-1">
            {selectedWeapons.map((w, i) => (
              <div key={`${w.id}-${i}`} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-200 font-medium">{w.name}</span>
                  {w.properties.length > 0 && (
                    <span className="text-xs text-gray-500">({w.properties.join(', ')})</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-mono text-xs">{formatMod(w.attackBonus)}</span>
                  <span className="text-red-400 text-xs">{w.damage} {w.damageType}</span>
                  <button
                    onClick={() => removeWeapon(i)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-700/50 rounded hover:bg-amber-900/20 transition-colors"
          >
            {showPicker ? 'Close' : 'Add Weapon'}
          </button>
        </div>

        {/* Weapon picker */}
        {showPicker && (
          <div className="mt-3 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                placeholder="Search weapons..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredWeapons.length === 0 ? (
                <p className="p-3 text-xs text-gray-500 text-center">No weapons found.</p>
              ) : (
                filteredWeapons.map((w) => (
                  <button
                    key={w.id ?? w.name}
                    onClick={() => addWeapon(w)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-700/50 text-left border-b border-gray-800 last:border-0"
                  >
                    <div>
                      <span className="text-gray-200">{w.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{w.category}</span>
                    </div>
                    <span className="text-xs text-red-400">{w.damage} {w.damageType}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {selectedWeapons.length === 0 && !showPicker && (
          <p className="text-xs text-gray-600 italic mt-3">
            No weapons added yet. Click "Add Weapon" to equip your character.
          </p>
        )}
      </div>
    </div>
  )
}
