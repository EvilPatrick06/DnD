import { useState, useEffect } from 'react'
import type { GameSystem } from '../../types/game-system'

interface EquipmentItem {
  name: string
  category: string
  cost?: string
  weight?: number
  bulk?: number
  description?: string
  damage?: string
  properties?: string[]
  acBonus?: number
}

interface EquipmentPickerModalProps {
  system: GameSystem | string
  onClose: () => void
  onAdd: (item: { name: string; quantity: number; description?: string }) => void
}

const EQUIPMENT_5E: EquipmentItem[] = [
  // Weapons - Simple Melee
  { name: 'Club', category: 'Simple Melee', cost: '1 sp', weight: 2, damage: '1d4 bludgeoning', properties: ['Light'] },
  { name: 'Dagger', category: 'Simple Melee', cost: '2 gp', weight: 1, damage: '1d4 piercing', properties: ['Finesse', 'Light', 'Thrown (20/60)'] },
  { name: 'Greatclub', category: 'Simple Melee', cost: '2 sp', weight: 10, damage: '1d8 bludgeoning', properties: ['Two-handed'] },
  { name: 'Handaxe', category: 'Simple Melee', cost: '5 gp', weight: 2, damage: '1d6 slashing', properties: ['Light', 'Thrown (20/60)'] },
  { name: 'Javelin', category: 'Simple Melee', cost: '5 sp', weight: 2, damage: '1d6 piercing', properties: ['Thrown (30/120)'] },
  { name: 'Mace', category: 'Simple Melee', cost: '5 gp', weight: 4, damage: '1d6 bludgeoning' },
  { name: 'Quarterstaff', category: 'Simple Melee', cost: '2 sp', weight: 4, damage: '1d6 bludgeoning', properties: ['Versatile (1d8)'] },
  { name: 'Spear', category: 'Simple Melee', cost: '1 gp', weight: 3, damage: '1d6 piercing', properties: ['Thrown (20/60)', 'Versatile (1d8)'] },
  // Weapons - Martial Melee
  { name: 'Battleaxe', category: 'Martial Melee', cost: '10 gp', weight: 4, damage: '1d8 slashing', properties: ['Versatile (1d10)'] },
  { name: 'Greatsword', category: 'Martial Melee', cost: '50 gp', weight: 6, damage: '2d6 slashing', properties: ['Heavy', 'Two-handed'] },
  { name: 'Longsword', category: 'Martial Melee', cost: '15 gp', weight: 3, damage: '1d8 slashing', properties: ['Versatile (1d10)'] },
  { name: 'Rapier', category: 'Martial Melee', cost: '25 gp', weight: 2, damage: '1d8 piercing', properties: ['Finesse'] },
  { name: 'Scimitar', category: 'Martial Melee', cost: '25 gp', weight: 3, damage: '1d6 slashing', properties: ['Finesse', 'Light'] },
  { name: 'Shortsword', category: 'Martial Melee', cost: '10 gp', weight: 2, damage: '1d6 piercing', properties: ['Finesse', 'Light'] },
  { name: 'Warhammer', category: 'Martial Melee', cost: '15 gp', weight: 2, damage: '1d8 bludgeoning', properties: ['Versatile (1d10)'] },
  // Weapons - Ranged
  { name: 'Shortbow', category: 'Ranged', cost: '25 gp', weight: 2, damage: '1d6 piercing', properties: ['Ammunition (80/320)', 'Two-handed'] },
  { name: 'Longbow', category: 'Ranged', cost: '50 gp', weight: 2, damage: '1d8 piercing', properties: ['Ammunition (150/600)', 'Heavy', 'Two-handed'] },
  { name: 'Light Crossbow', category: 'Ranged', cost: '25 gp', weight: 5, damage: '1d8 piercing', properties: ['Ammunition (80/320)', 'Loading', 'Two-handed'] },
  { name: 'Hand Crossbow', category: 'Ranged', cost: '75 gp', weight: 3, damage: '1d6 piercing', properties: ['Ammunition (30/120)', 'Light', 'Loading'] },
  // Armor
  { name: 'Padded Armor', category: 'Light Armor', cost: '5 gp', weight: 8, acBonus: 11, description: 'AC 11 + Dex. Stealth disadvantage.' },
  { name: 'Leather Armor', category: 'Light Armor', cost: '10 gp', weight: 10, acBonus: 11, description: 'AC 11 + Dex.' },
  { name: 'Studded Leather', category: 'Light Armor', cost: '45 gp', weight: 13, acBonus: 12, description: 'AC 12 + Dex.' },
  { name: 'Chain Shirt', category: 'Medium Armor', cost: '50 gp', weight: 20, acBonus: 13, description: 'AC 13 + Dex (max 2).' },
  { name: 'Scale Mail', category: 'Medium Armor', cost: '50 gp', weight: 45, acBonus: 14, description: 'AC 14 + Dex (max 2). Stealth disadvantage.' },
  { name: 'Breastplate', category: 'Medium Armor', cost: '400 gp', weight: 20, acBonus: 14, description: 'AC 14 + Dex (max 2).' },
  { name: 'Half Plate', category: 'Medium Armor', cost: '750 gp', weight: 40, acBonus: 15, description: 'AC 15 + Dex (max 2). Stealth disadvantage.' },
  { name: 'Chain Mail', category: 'Heavy Armor', cost: '75 gp', weight: 55, acBonus: 16, description: 'AC 16. Str 13 required. Stealth disadvantage.' },
  { name: 'Plate Armor', category: 'Heavy Armor', cost: '1500 gp', weight: 65, acBonus: 18, description: 'AC 18. Str 15 required. Stealth disadvantage.' },
  { name: 'Shield', category: 'Shield', cost: '10 gp', weight: 6, acBonus: 2, description: '+2 AC.' },
  // Adventuring Gear
  { name: 'Backpack', category: 'Adventuring Gear', cost: '2 gp', weight: 5 },
  { name: 'Bedroll', category: 'Adventuring Gear', cost: '1 gp', weight: 7 },
  { name: 'Rope (50 ft)', category: 'Adventuring Gear', cost: '1 gp', weight: 10 },
  { name: 'Torch', category: 'Adventuring Gear', cost: '1 cp', weight: 1, description: 'Bright light 20 ft, dim light 20 ft. Burns 1 hour.' },
  { name: 'Rations (1 day)', category: 'Adventuring Gear', cost: '5 sp', weight: 2 },
  { name: 'Waterskin', category: 'Adventuring Gear', cost: '2 sp', weight: 5 },
  { name: 'Healing Potion', category: 'Adventuring Gear', cost: '50 gp', weight: 0.5, description: 'Heals 2d4+2 HP.' },
  { name: 'Thieves\' Tools', category: 'Tools', cost: '25 gp', weight: 1, description: 'Required for picking locks and disabling traps.' },
  { name: 'Holy Symbol', category: 'Adventuring Gear', cost: '5 gp', weight: 0 },
  { name: 'Component Pouch', category: 'Adventuring Gear', cost: '25 gp', weight: 2, description: 'Contains material components for spellcasting.' },
  { name: 'Arcane Focus', category: 'Adventuring Gear', cost: '10 gp', weight: 1 },
  { name: 'Arrows (20)', category: 'Ammunition', cost: '1 gp', weight: 1 },
  { name: 'Crossbow Bolts (20)', category: 'Ammunition', cost: '1 gp', weight: 1.5 }
]

const CATEGORIES = ['All', 'Simple Melee', 'Martial Melee', 'Ranged', 'Light Armor', 'Medium Armor', 'Heavy Armor', 'Shield', 'Adventuring Gear', 'Tools', 'Ammunition']

export default function EquipmentPickerModal({ system, onClose, onAdd }: EquipmentPickerModalProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const items = EQUIPMENT_5E // For now, same items for both systems

  const filtered = items.filter((item) => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = category === 'All' || item.category === category
    return matchesSearch && matchesCat
  })

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900 p-3 max-h-80 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-200">Add Equipment</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer"
        >
          Close
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items..."
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 mb-2"
      />

      <div className="flex flex-wrap gap-1 mb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
              category === cat
                ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {filtered.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-1.5 hover:bg-gray-800/50 rounded text-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-200">{item.name}</span>
                {item.cost && <span className="text-xs text-gray-500">{item.cost}</span>}
              </div>
              <div className="text-[10px] text-gray-600 flex gap-2">
                {item.damage && <span>{item.damage}</span>}
                {item.acBonus && <span>+{item.acBonus} AC</span>}
                {item.weight && <span>{item.weight} lb</span>}
                {item.properties && item.properties.length > 0 && <span>{item.properties.join(', ')}</span>}
              </div>
            </div>
            <button
              onClick={() => {
                onAdd({ name: item.name, quantity: 1, description: item.description })
              }}
              className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 cursor-pointer"
            >
              Add
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No items found.</p>
        )}
      </div>
    </div>
  )
}
