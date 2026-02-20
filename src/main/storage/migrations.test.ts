import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateData } from './migrations'

describe('migrations', () => {
  describe('migrateData', () => {
    it('data without schemaVersion gets migrated to current version', () => {
      const data = { name: 'Test', gameSystem: 'dnd5e', level: 1, classes: [{ name: 'Fighter', level: 1, hitDie: 10 }] }
      const result = migrateData(data)
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('data already at current version is unchanged', () => {
      const data = { schemaVersion: CURRENT_SCHEMA_VERSION, name: 'Test', conditions: [] }
      const result = migrateData(data)
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.name).toBe('Test')
      expect(result.conditions).toEqual([])
    })

    it('v1 dnd5e character gets conditions array added', () => {
      const data = { schemaVersion: 1, gameSystem: 'dnd5e', name: 'Hero' }
      const result = migrateData(data)
      expect(result.conditions).toEqual([])
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('non-object data passes through unchanged', () => {
      expect(migrateData(null)).toBe(null)
      expect(migrateData([])).toEqual([])
      expect(migrateData('hello')).toBe('hello')
      expect(migrateData(42)).toBe(42)
    })

    it('v2 dnd5e character gets hitDiceRemaining migrated to hitDice array', () => {
      const data = {
        schemaVersion: 2,
        gameSystem: 'dnd5e',
        name: 'Hero',
        level: 5,
        classes: [{ name: 'Fighter', level: 5, hitDie: 10 }],
        hitDiceRemaining: 3,
        conditions: []
      }
      const result = migrateData(data)
      expect(result.hitDice).toEqual([{ current: 3, maximum: 5, dieType: 10 }])
      expect(result.hitDiceRemaining).toBeUndefined()
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('v2 multiclass character distributes hitDice proportionally', () => {
      const data = {
        schemaVersion: 2,
        gameSystem: 'dnd5e',
        name: 'Multi',
        level: 7,
        classes: [
          { name: 'Fighter', level: 4, hitDie: 10 },
          { name: 'Rogue', level: 3, hitDie: 8 }
        ],
        hitDiceRemaining: 5,
        conditions: []
      }
      const result = migrateData(data)
      const hitDice = result.hitDice as Array<{ current: number; maximum: number; dieType: number }>
      expect(hitDice).toHaveLength(2)
      expect(hitDice[0].maximum).toBe(4)
      expect(hitDice[0].dieType).toBe(10)
      expect(hitDice[1].maximum).toBe(3)
      expect(hitDice[1].dieType).toBe(8)
      expect(hitDice[0].current + hitDice[1].current).toBe(5)
    })
  })

  describe('CURRENT_SCHEMA_VERSION', () => {
    it('equals 3', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(3)
    })
  })
})
