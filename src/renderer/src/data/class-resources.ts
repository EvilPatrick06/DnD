import type { ClassResource } from '../types/character-common'

export function getFighterResources(fighterLevel: number): ClassResource[] {
  const resources: ClassResource[] = []

  // Second Wind: 2 uses at 1-3, 3 at 4-9, 4 at 10+. Short Rest: restore 1.
  const secondWindMax = fighterLevel >= 10 ? 4 : fighterLevel >= 4 ? 3 : 2
  resources.push({
    id: 'second-wind',
    name: 'Second Wind',
    current: secondWindMax,
    max: secondWindMax,
    shortRestRestore: 1
  })

  // Action Surge: 1 use at 2+, 2 at 17+. Short Rest: restore all.
  if (fighterLevel >= 2) {
    const actionSurgeMax = fighterLevel >= 17 ? 2 : 1
    resources.push({
      id: 'action-surge',
      name: 'Action Surge',
      current: actionSurgeMax,
      max: actionSurgeMax,
      shortRestRestore: 'all'
    })
  }

  // Indomitable: 1 use at 9+, 2 at 13+, 3 at 17+. Long Rest only.
  if (fighterLevel >= 9) {
    const indomitableMax = fighterLevel >= 17 ? 3 : fighterLevel >= 13 ? 2 : 1
    resources.push({
      id: 'indomitable',
      name: 'Indomitable',
      current: indomitableMax,
      max: indomitableMax,
      shortRestRestore: 0
    })
  }

  return resources
}

export function getRogueResources(rogueLevel: number): ClassResource[] {
  const resources: ClassResource[] = []

  // Stroke of Luck: 1 use at 20. Short or Long Rest restores.
  if (rogueLevel >= 20) {
    resources.push({
      id: 'stroke-of-luck',
      name: 'Stroke of Luck',
      current: 1,
      max: 1,
      shortRestRestore: 'all'
    })
  }

  return resources
}

export function getSorcererResources(sorcererLevel: number): ClassResource[] {
  const resources: ClassResource[] = []

  // Innate Sorcery: 2 uses, Long Rest only (Lv1+)
  resources.push({
    id: 'innate-sorcery',
    name: 'Innate Sorcery',
    current: 2,
    max: 2,
    shortRestRestore: 0
  })

  // Sorcery Points: max = sorcerer level, Long Rest only (Lv2+)
  if (sorcererLevel >= 2) {
    resources.push({
      id: 'sorcery-points',
      name: 'Sorcery Points',
      current: sorcererLevel,
      max: sorcererLevel,
      shortRestRestore: 0
    })
  }

  return resources
}

export function getMonkResources(monkLevel: number): ClassResource[] {
  const resources: ClassResource[] = []

  // Focus Points: max = monk level, available at level 2+. Short Rest: restore all.
  if (monkLevel >= 2) {
    resources.push({
      id: 'focus-points',
      name: 'Focus Points',
      current: monkLevel,
      max: monkLevel,
      shortRestRestore: 'all'
    })
  }

  return resources
}

export function getPaladinResources(paladinLevel: number): ClassResource[] {
  const resources: ClassResource[] = []

  // Lay On Hands: pool = paladin level x 5. Long Rest: restore all.
  resources.push({
    id: 'lay-on-hands',
    name: 'Lay On Hands',
    current: paladinLevel * 5,
    max: paladinLevel * 5,
    shortRestRestore: 0
  })

  // Channel Divinity: 2 uses (3 at level 11+). Short Rest: restore 1. Long Rest: restore all.
  if (paladinLevel >= 3) {
    const cdMax = paladinLevel >= 11 ? 3 : 2
    resources.push({
      id: 'channel-divinity',
      name: 'Channel Divinity',
      current: cdMax,
      max: cdMax,
      shortRestRestore: 1
    })
  }

  return resources
}

export function getRangerResources(rangerLevel: number, wisdomModifier: number = 0): ClassResource[] {
  const resources: ClassResource[] = []

  // Favored Enemy: free Hunter's Mark casts. 2→3(L5)→4(L9)→5(L13)→6(L17). Long Rest only.
  const favoredEnemyMax =
    rangerLevel >= 17 ? 6 : rangerLevel >= 13 ? 5 : rangerLevel >= 9 ? 4 : rangerLevel >= 5 ? 3 : 2
  resources.push({
    id: 'favored-enemy',
    name: "Favored Enemy (Hunter's Mark)",
    current: favoredEnemyMax,
    max: favoredEnemyMax,
    shortRestRestore: 0
  })

  // Tireless: temp HP uses. WIS mod (min 1) per Long Rest. Level 10+.
  if (rangerLevel >= 10) {
    const tirelessMax = Math.max(1, wisdomModifier)
    resources.push({
      id: 'tireless',
      name: 'Tireless',
      current: tirelessMax,
      max: tirelessMax,
      shortRestRestore: 0
    })
  }

  // Nature's Veil: invisibility uses. WIS mod (min 1) per Long Rest. Level 14+.
  if (rangerLevel >= 14) {
    const naturesVeilMax = Math.max(1, wisdomModifier)
    resources.push({
      id: 'natures-veil',
      name: "Nature's Veil",
      current: naturesVeilMax,
      max: naturesVeilMax,
      shortRestRestore: 0
    })
  }

  return resources
}

export function getClassResources(classId: string, classLevel: number, wisdomModifier: number = 0): ClassResource[] {
  switch (classId) {
    case 'fighter':
      return getFighterResources(classLevel)
    case 'monk':
      return getMonkResources(classLevel)
    case 'paladin':
      return getPaladinResources(classLevel)
    case 'ranger':
      return getRangerResources(classLevel, wisdomModifier)
    case 'rogue':
      return getRogueResources(classLevel)
    case 'sorcerer':
      return getSorcererResources(classLevel)
    default:
      return []
  }
}

/** Get resources from feats (e.g., Lucky). */
export function getFeatResources(feats: Array<{ id: string }>, profBonus: number): ClassResource[] {
  const resources: ClassResource[] = []
  if (feats.some((f) => f.id === 'lucky')) {
    resources.push({
      id: 'lucky',
      name: 'Lucky (Luck Points)',
      current: profBonus,
      max: profBonus,
      shortRestRestore: 0 // Long rest only
    })
  }
  return resources
}
