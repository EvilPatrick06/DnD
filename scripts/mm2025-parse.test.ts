import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Load the parsed output
const parsedPath = path.join(__dirname, 'mm2025-parsed.json')
const parsed: Array<Record<string, unknown>> = JSON.parse(fs.readFileSync(parsedPath, 'utf8'))

// CR to XP mapping (MM2025)
const CR_TO_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
}

const CR_TO_PB: Record<string, number> = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2, '1': 2, '2': 2, '3': 2, '4': 2,
  '5': 3, '6': 3, '7': 3, '8': 3, '9': 4, '10': 4, '11': 4, '12': 4,
  '13': 5, '14': 5, '15': 5, '16': 5, '17': 6, '18': 6, '19': 6, '20': 6,
  '21': 7, '22': 7, '23': 7, '24': 7, '25': 8, '26': 8, '27': 8, '28': 8,
  '29': 9, '30': 9
}

describe('MM2025 Parser Output', () => {
  it('should have parsed approximately 502 entries', () => {
    expect(parsed.length).toBeGreaterThanOrEqual(500)
    expect(parsed.length).toBeLessThanOrEqual(510)
  })

  it('every entry should have required identity fields', () => {
    for (const entry of parsed) {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('name')
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.name).toBe('string')
      expect((entry.id as string).length).toBeGreaterThan(0)
      expect((entry.name as string).length).toBeGreaterThan(0)
    }
  })

  it('every entry should have size, type, and alignment', () => {
    const validSizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
    for (const entry of parsed) {
      expect(validSizes).toContain(entry.size)
      expect(typeof entry.type).toBe('string')
      expect(typeof entry.alignment).toBe('string')
    }
  })

  it('every entry should have numeric AC and HP', () => {
    for (const entry of parsed) {
      expect(typeof entry.ac).toBe('number')
      expect(entry.ac as number).toBeGreaterThan(0)
      expect(typeof entry.hp).toBe('number')
      expect(entry.hp as number).toBeGreaterThan(0)
    }
  })

  it('every entry should have valid ability scores', () => {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']
    for (const entry of parsed) {
      expect(entry).toHaveProperty('abilityScores')
      const scores = entry.abilityScores as Record<string, number>
      for (const ability of abilities) {
        expect(typeof scores[ability]).toBe('number')
        expect(scores[ability]).toBeGreaterThanOrEqual(1)
        expect(scores[ability]).toBeLessThanOrEqual(30)
      }
    }
  })

  it('every entry should have a valid CR', () => {
    const validCRs = Object.keys(CR_TO_XP)
    for (const entry of parsed) {
      expect(validCRs).toContain(entry.cr as string)
    }
  })

  it('every entry should have speed with walk', () => {
    for (const entry of parsed) {
      expect(entry).toHaveProperty('speed')
      const speed = entry.speed as Record<string, unknown>
      expect(typeof speed.walk).toBe('number')
    }
  })

  it('every entry should have actions array', () => {
    for (const entry of parsed) {
      expect(Array.isArray(entry.actions)).toBe(true)
    }
  })

  it('every entry should have senses with passivePerception', () => {
    for (const entry of parsed) {
      expect(entry).toHaveProperty('senses')
      const senses = entry.senses as Record<string, unknown>
      expect(typeof senses.passivePerception).toBe('number')
    }
  })

  it('no duplicate IDs exist', () => {
    const ids = parsed.map((e) => e.id as string)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should parse attack actions with structured fields', () => {
    const goblin = parsed.find((e) => e.name === 'Goblin Warrior')
    expect(goblin).toBeDefined()
    const actions = goblin!.actions as Array<Record<string, unknown>>
    const attack = actions.find((a) => a.toHit !== undefined)
    expect(attack).toBeDefined()
    expect(typeof attack!.toHit).toBe('number')
    expect(typeof attack!.damageDice).toBe('string')
  })

  it('should parse spellcasting blocks', () => {
    const dryad = parsed.find((e) => e.name === 'Dryad')
    expect(dryad).toBeDefined()
    expect(dryad).toHaveProperty('spellcasting')
    const sc = dryad!.spellcasting as Record<string, unknown>
    expect(typeof sc.saveDC).toBe('number')
    expect(typeof sc.ability).toBe('string')
  })

  it('should parse legendary actions', () => {
    const beholder = parsed.find((e) => e.name === 'Beholder')
    expect(beholder).toBeDefined()
    expect(beholder).toHaveProperty('legendaryActions')
    const la = beholder!.legendaryActions as Record<string, unknown>
    expect(typeof la.uses).toBe('number')
    expect(Array.isArray(la.actions)).toBe(true)
  })

  it('should parse saving throws when proficiency differs from modifier', () => {
    // Find a creature with saving throw proficiencies
    const entriesWithSaves = parsed.filter((e) => {
      const saves = e.savingThrows as Record<string, number> | undefined
      return saves && Object.keys(saves).length > 0
    })
    expect(entriesWithSaves.length).toBeGreaterThan(50)
  })

  it('should parse multiattack actions', () => {
    const dragon = parsed.find((e) => e.name === 'Adult Red Dragon')
    expect(dragon).toBeDefined()
    const actions = dragon!.actions as Array<Record<string, unknown>>
    const multi = actions.find((a) => a.name === 'Multiattack')
    expect(multi).toBeDefined()
    expect(multi!.multiattackActions).toBeDefined()
  })

  it('should handle column-format ability scores (Dragons-Other.md)', () => {
    const dragonTurtle = parsed.find((e) => e.name === 'Dragon Turtle')
    expect(dragonTurtle).toBeDefined()
    const scores = dragonTurtle!.abilityScores as Record<string, number>
    // Dragon Turtle should not have default 10s for all abilities
    expect(scores.str).toBeGreaterThan(10)
    expect(scores.con).toBeGreaterThan(10)
  })
})

describe('App Monster Data Integrity', () => {
  const dataDir = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e')
  const monsters: Array<Record<string, unknown>> = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'monsters.json'), 'utf8')
  )
  const creatures: Array<Record<string, unknown>> = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'creatures.json'), 'utf8')
  )
  const npcs: Array<Record<string, unknown>> = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8')
  )
  const all = [...monsters, ...creatures, ...npcs]

  it('should have at least 520 total entries', () => {
    expect(all.length).toBeGreaterThanOrEqual(520)
  })

  it('should have no duplicate IDs across all files', () => {
    const ids = all.map((e) => e.id as string)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('every entry should have required fields', () => {
    const required = ['id', 'name', 'size', 'type', 'ac', 'hp', 'hitDice', 'speed', 'abilityScores', 'cr', 'actions', 'senses']
    for (const entry of all) {
      for (const field of required) {
        expect(entry).toHaveProperty(field)
      }
    }
  })

  it('every entry should have correct XP for its CR', () => {
    for (const entry of all) {
      const cr = entry.cr as string
      const xp = entry.xp as number
      const expected = CR_TO_XP[cr]
      if (expected !== undefined) {
        expect(xp).toBe(expected)
      }
    }
  })

  it('every entry should have correct proficiency bonus for its CR', () => {
    for (const entry of all) {
      const cr = entry.cr as string
      const pb = entry.proficiencyBonus as number
      const expected = CR_TO_PB[cr]
      if (expected !== undefined) {
        expect(pb).toBe(expected)
      }
    }
  })

  it('every entry should have a valid tokenSize', () => {
    const validSizes = [1, 2, 3, 4]
    for (const entry of all) {
      const ts = entry.tokenSize as { x: number; y: number }
      expect(ts).toBeDefined()
      expect(validSizes).toContain(ts.x)
      expect(validSizes).toContain(ts.y)
    }
  })

  it('every entry should have a source tag', () => {
    for (const entry of all) {
      expect(['mm2025', 'legacy']).toContain(entry.source)
    }
  })

  it('action damage dice should be valid notation', () => {
    // Accepts: "2d6 + 4", "1d8", "1" (flat damage for tiny creatures), "2d6+3"
    const diceRegex = /^(\d+d\d+(\s*[+-]\s*\d+)?|\d+)$/
    for (const entry of all) {
      const actions = entry.actions as Array<Record<string, unknown>>
      for (const action of actions) {
        if (action.damageDice) {
          expect(diceRegex.test(action.damageDice as string)).toBe(true)
        }
      }
    }
  })
})
