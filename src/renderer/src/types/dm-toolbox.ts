// === DM Toolbox Types (DMG 2024 Chapter 3) ===

export interface Trap {
  id: string
  name: string
  level: 'low' | 'mid' | 'high'
  trigger: string
  duration: string
  detection: string
  disarm: string
  effect: string
  damage?: string
  saveDC?: number
  saveAbility?: string
  description: string
}

export interface Hazard {
  id: string
  name: string
  level: 'low' | 'mid' | 'high'
  type: 'environmental' | 'magical' | 'biological'
  effect: string
  damage?: string
  saveDC?: number
  saveAbility?: string
  avoidance?: string
  description: string
}

export interface Poison {
  id: string
  name: string
  type: 'contact' | 'ingested' | 'inhaled' | 'injury'
  rarity: string
  cost: string
  saveDC: number
  effect: string
  duration?: string
  description: string
}

export interface EnvironmentalEffect {
  id: string
  name: string
  category: 'weather' | 'terrain' | 'magical' | 'planar'
  effect: string
  mechanicalEffect?: string
  saveDC?: number
  saveAbility?: string
  description: string
}

export interface Curse {
  id: string
  name: string
  type: 'personal' | 'item' | 'location'
  effect: string
  removal: string
  description: string
}

export interface SupernaturalGift {
  id: string
  name: string
  type: 'blessing' | 'charm'
  duration?: string
  effect: string
  description: string
}
