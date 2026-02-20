import type { ClassResource } from '../types/character-common'

/**
 * Returns species resources for a given species and heritage at a given level.
 * Uses ClassResource type for compatibility with existing resource UI.
 */
export function getSpeciesResources(
  speciesId: string,
  subspeciesId: string | undefined,
  level: number
): ClassResource[] {
  const pb = Math.ceil(level / 4) + 1
  const resources: ClassResource[] = []

  switch (speciesId) {
    case 'aasimar':
      resources.push({
        id: 'species-healing-hands',
        name: 'Healing Hands',
        current: 1,
        max: 1,
        shortRestRestore: 0
      })
      if (level >= 3) {
        resources.push({
          id: 'species-celestial-revelation',
          name: 'Celestial Revelation',
          current: 1,
          max: 1,
          shortRestRestore: 0
        })
      }
      break

    case 'dragonborn':
      resources.push({
        id: 'species-breath-weapon',
        name: 'Breath Weapon',
        current: pb,
        max: pb,
        shortRestRestore: 0
      })
      if (level >= 5) {
        resources.push({
          id: 'species-draconic-flight',
          name: 'Draconic Flight',
          current: 1,
          max: 1,
          shortRestRestore: 0
        })
      }
      break

    case 'dwarf':
      resources.push({
        id: 'species-stonecunning',
        name: 'Stonecunning',
        current: pb,
        max: pb,
        shortRestRestore: 0
      })
      break

    case 'goliath':
      // Heritage-specific ability
      switch (subspeciesId) {
        case 'cloud-goliath':
          resources.push({
            id: 'species-clouds-jaunt',
            name: "Cloud's Jaunt",
            current: pb,
            max: pb,
            shortRestRestore: 0
          })
          break
        case 'fire-goliath':
          resources.push({ id: 'species-fires-burn', name: "Fire's Burn", current: pb, max: pb, shortRestRestore: 0 })
          break
        case 'frost-goliath':
          resources.push({
            id: 'species-frosts-chill',
            name: "Frost's Chill",
            current: pb,
            max: pb,
            shortRestRestore: 0
          })
          break
        case 'hill-goliath':
          resources.push({
            id: 'species-hills-tumble',
            name: "Hill's Tumble",
            current: pb,
            max: pb,
            shortRestRestore: 0
          })
          break
        case 'stone-goliath':
          resources.push({
            id: 'species-stones-endurance',
            name: "Stone's Endurance",
            current: pb,
            max: pb,
            shortRestRestore: 0
          })
          break
        case 'storm-goliath':
          resources.push({
            id: 'species-storms-thunder',
            name: "Storm's Thunder",
            current: pb,
            max: pb,
            shortRestRestore: 0
          })
          break
      }
      if (level >= 5) {
        resources.push({
          id: 'species-large-form',
          name: 'Large Form',
          current: 1,
          max: 1,
          shortRestRestore: 0
        })
      }
      break

    case 'orc':
      resources.push({
        id: 'species-adrenaline-rush',
        name: 'Adrenaline Rush',
        current: pb,
        max: pb,
        shortRestRestore: 'all'
      })
      resources.push({
        id: 'species-relentless-endurance',
        name: 'Relentless Endurance',
        current: 1,
        max: 1,
        shortRestRestore: 0
      })
      break
  }

  return resources
}
