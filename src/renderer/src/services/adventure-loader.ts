import type { GameSystem } from '../types/game-system'

export interface AdventureChapter {
  title: string
  description: string
  maps: string[]
  encounters: string[]
}

export interface AdventureNPC {
  id: string
  name: string
  description: string
  location: string
  role: 'ally' | 'enemy' | 'neutral'
}

export interface Adventure {
  id: string
  name: string
  system: GameSystem
  description: string
  icon: string
  chapters: AdventureChapter[]
  npcs?: AdventureNPC[]
}

let cachedAdventures: Adventure[] | null = null

export async function loadAdventures(): Promise<Adventure[]> {
  if (cachedAdventures) return cachedAdventures

  try {
    const res = await fetch('./data/adventures/adventures.json')
    if (!res.ok) return []
    const data: Adventure[] = await res.json()
    cachedAdventures = data
    return data
  } catch {
    return []
  }
}
