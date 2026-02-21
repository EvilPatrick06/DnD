/**
 * JSON Data Schema Validation Tests
 * Verifies all 5e JSON data files conform to their TypeScript interfaces.
 * Catches field name mismatches, missing required fields, and type violations.
 */

/// <reference types="node" />
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

const DATA_DIR = resolve(__dirname, '../../public/data/5e')

// Files were reorganized into subdirectories — map flat names to actual paths
const FILE_PATH_MAP: Record<string, string> = {
  'species.json': 'character/species.json',
  'species-traits.json': 'character/species-traits.json',
  'classes.json': 'character/classes.json',
  'backgrounds.json': 'character/backgrounds.json',
  'subclasses.json': 'character/subclasses.json',
  'feats.json': 'character/feats.json',
  'class-features.json': 'character/class-features.json',
  'spells.json': 'spells/spells.json',
  'equipment.json': 'equipment/equipment.json',
  'magic-items.json': 'equipment/magic-items.json',
  'monsters.json': 'creatures/monsters.json',
  'creatures.json': 'creatures/creatures.json',
  'npcs.json': 'creatures/npcs.json',
  'invocations.json': 'mechanics/invocations.json',
  'metamagic.json': 'mechanics/metamagic.json',
  'crafting.json': 'world/crafting.json',
  'treasure-tables.json': 'world/treasure-tables.json',
  'encounter-budgets.json': 'encounters/encounter-budgets.json',
  'encounter-presets.json': 'encounters/encounter-presets.json',
  'random-tables.json': 'encounters/random-tables.json',
  'chase-tables.json': 'encounters/chase-tables.json',
  'diseases.json': 'hazards/diseases.json',
  'traps.json': 'hazards/traps.json',
  'hazards.json': 'hazards/hazards.json',
  'poisons.json': 'hazards/poisons.json',
}

function loadJsonFile<T>(filename: string): T {
  const resolved = FILE_PATH_MAP[filename] ?? filename
  const raw = readFileSync(resolve(DATA_DIR, resolved), 'utf-8')
  return JSON.parse(raw) as T
}

// === species.json ===
describe('species.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('species.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    for (const species of data as Record<string, unknown>[]) {
      expect(species).toHaveProperty('id')
      expect(species).toHaveProperty('name')
      expect(species).toHaveProperty('speed')
      expect(species).toHaveProperty('size')
      expect(species).toHaveProperty('traits')
      expect(species).toHaveProperty('languages')
      expect(typeof species.id).toBe('string')
      expect(typeof species.name).toBe('string')
      expect(typeof species.speed).toBe('number')
      expect(Array.isArray(species.traits)).toBe(true)
      expect(Array.isArray(species.languages)).toBe(true)
    }
  })

  it('trait entries are objects with name and description', () => {
    for (const species of data as Array<{ traits: unknown[] }>) {
      for (const trait of species.traits) {
        expect(typeof trait).toBe('object')
        const t = trait as Record<string, unknown>
        expect(t).toHaveProperty('name')
        expect(t).toHaveProperty('description')
        expect(typeof t.name).toBe('string')
        expect(typeof t.description).toBe('string')
      }
    }
  })

  it('subrace traitModifications.add entries are objects with name and description', () => {
    for (const species of data as Array<{ subraces?: Array<{ traitModifications: { add: unknown[] } }> }>) {
      if (!species.subraces) continue
      for (const sr of species.subraces) {
        for (const trait of sr.traitModifications.add) {
          expect(typeof trait).toBe('object')
          const t = trait as Record<string, unknown>
          expect(t).toHaveProperty('name')
          expect(t).toHaveProperty('description')
          expect(typeof t.name).toBe('string')
          expect(typeof t.description).toBe('string')
        }
      }
    }
  })

  it('IDs are kebab-case and unique', () => {
    const ids = (data as Array<{ id: string }>).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

// === species-traits.json ===
describe('species-traits.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('species-traits.json')
  })

  it('is a non-empty object', () => {
    expect(typeof data).toBe('object')
    expect(data).not.toBeNull()
    expect(Object.keys(data).length).toBeGreaterThan(0)
  })

  it('keys are kebab-case', () => {
    for (const key of Object.keys(data)) {
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('each entry has name and description', () => {
    for (const [key, value] of Object.entries(data)) {
      const trait = value as Record<string, unknown>
      expect(trait).toHaveProperty('name')
      expect(trait).toHaveProperty('description')
      expect(typeof trait.name).toBe('string')
      expect(typeof trait.description).toBe('string')
      expect((trait.name as string).length).toBeGreaterThan(0)
      expect((trait.description as string).length).toBeGreaterThan(0)
      // spellGranted is optional
      if ('spellGranted' in trait && trait.spellGranted !== null && trait.spellGranted !== undefined) {
        expect(['string', 'object']).toContain(typeof trait.spellGranted)
      }
    }
  })
})

// === classes.json ===
describe('classes.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('classes.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    for (const cls of data as Record<string, unknown>[]) {
      expect(cls).toHaveProperty('id')
      expect(cls).toHaveProperty('name')
      expect(cls).toHaveProperty('hitDie')
      expect(cls).toHaveProperty('primaryAbility')
      expect(cls).toHaveProperty('savingThrows')
      expect(cls).toHaveProperty('proficiencies')
      expect(cls).toHaveProperty('subclassLevel')
      expect(typeof cls.hitDie).toBe('number')
      expect(typeof cls.subclassLevel).toBe('number')
      expect(Array.isArray(cls.savingThrows)).toBe(true)
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === backgrounds.json ===
describe('backgrounds.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('backgrounds.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    for (const bg of data as Record<string, unknown>[]) {
      expect(bg).toHaveProperty('id')
      expect(bg).toHaveProperty('name')
      expect(bg).toHaveProperty('proficiencies')
      expect(bg).toHaveProperty('startingGold')
      expect(typeof bg.startingGold).toBe('number')
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === subclasses.json ===
describe('subclasses.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('subclasses.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    for (const sc of data as Record<string, unknown>[]) {
      expect(sc).toHaveProperty('id')
      expect(sc).toHaveProperty('name')
      expect(sc).toHaveProperty('class')
      expect(sc).toHaveProperty('features')
      expect(Array.isArray(sc.features)).toBe(true)
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === feats.json ===
describe('feats.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('feats.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    for (const feat of data as Record<string, unknown>[]) {
      expect(feat).toHaveProperty('id')
      expect(feat).toHaveProperty('name')
      expect(feat).toHaveProperty('category')
      expect(feat).toHaveProperty('description')
      expect(['Origin', 'General', 'Fighting Style', 'Epic Boon']).toContain(feat.category)
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === spells.json ===
describe('spells.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('spells.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    const validSchools = [
      'Abjuration',
      'Conjuration',
      'Divination',
      'Enchantment',
      'Evocation',
      'Illusion',
      'Necromancy',
      'Transmutation'
    ]
    for (const spell of data as Record<string, unknown>[]) {
      expect(spell).toHaveProperty('id')
      expect(spell).toHaveProperty('name')
      expect(spell).toHaveProperty('level')
      expect(spell).toHaveProperty('school')
      expect(spell).toHaveProperty('castingTime')
      expect(spell).toHaveProperty('range')
      expect(spell).toHaveProperty('duration')
      expect(spell).toHaveProperty('description')
      expect(typeof spell.level).toBe('number')
      expect(typeof spell.concentration).toBe('boolean')
      expect(typeof spell.ritual).toBe('boolean')
      expect(validSchools).toContain(spell.school)
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === equipment.json ===
describe('equipment.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('equipment.json')
  })

  it('has weapons array', () => {
    expect(data).toHaveProperty('weapons')
    expect(Array.isArray(data.weapons)).toBe(true)
  })

  it('each weapon has required fields', () => {
    for (const w of data.weapons as Record<string, unknown>[]) {
      expect(w).toHaveProperty('name')
      expect(w).toHaveProperty('category')
      expect(w).toHaveProperty('damage')
      expect(w).toHaveProperty('damageType')
      expect(w).toHaveProperty('properties')
      expect(Array.isArray(w.properties)).toBe(true)
    }
  })
})

// === class-features.json ===
describe('class-features.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('class-features.json')
  })

  it('is an object keyed by class ID', () => {
    expect(typeof data).toBe('object')
    expect(Object.keys(data).length).toBeGreaterThan(0)
  })

  it('each class entry has features array', () => {
    for (const [_classId, classData] of Object.entries(data)) {
      const cd = classData as Record<string, unknown>
      expect(cd).toHaveProperty('features')
      expect(Array.isArray(cd.features)).toBe(true)
      for (const feat of cd.features as Record<string, unknown>[]) {
        expect(feat).toHaveProperty('level')
        expect(feat).toHaveProperty('name')
        expect(feat).toHaveProperty('description')
        expect(typeof feat.level).toBe('number')
      }
    }
  })
})

// === monsters.json ===
describe('monsters.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('monsters.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each monster has required fields', () => {
    for (const m of data as Record<string, unknown>[]) {
      expect(m).toHaveProperty('id')
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('type')
      expect(m).toHaveProperty('cr')
      expect(m).toHaveProperty('ac')
      expect(m).toHaveProperty('hp')
      expect(m).toHaveProperty('abilityScores')
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === magic-items.json ===
describe('magic-items.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('magic-items.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each item has required fields', () => {
    const validRarities = ['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact']
    for (const item of data as Record<string, unknown>[]) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('rarity')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('description')
      expect(validRarities).toContain(item.rarity)
    }
  })

  it('IDs are unique', () => {
    const ids = (data as Array<{ id: string }>).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// === invocations.json ===
describe('invocations.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('invocations.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each invocation has required fields', () => {
    for (const inv of data as Record<string, unknown>[]) {
      expect(inv).toHaveProperty('id')
      expect(inv).toHaveProperty('name')
      expect(inv).toHaveProperty('description')
      expect(inv).toHaveProperty('levelRequirement')
      expect(typeof inv.levelRequirement).toBe('number')
    }
  })
})

// === metamagic.json ===
describe('metamagic.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('metamagic.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each metamagic has required fields', () => {
    for (const mm of data as Record<string, unknown>[]) {
      expect(mm).toHaveProperty('id')
      expect(mm).toHaveProperty('name')
      expect(mm).toHaveProperty('description')
      expect(mm).toHaveProperty('sorceryPointCost')
    }
  })
})

// === crafting.json ===
describe('crafting.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('crafting.json')
  })

  it('is a non-empty array of tool entries', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each tool group has tool name and items', () => {
    for (const entry of data as Record<string, unknown>[]) {
      expect(entry).toHaveProperty('tool')
      expect(entry).toHaveProperty('items')
      expect(typeof entry.tool).toBe('string')
      expect(Array.isArray(entry.items)).toBe(true)
    }
  })
})

// === encounter-budgets.json ===
describe('encounter-budgets.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('encounter-budgets.json')
  })

  it('has perCharacterBudget array', () => {
    expect(data).toHaveProperty('perCharacterBudget')
    expect(Array.isArray(data.perCharacterBudget)).toBe(true)
  })

  it('each budget entry has level and difficulty tiers', () => {
    for (const entry of data.perCharacterBudget as Record<string, unknown>[]) {
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('low')
      expect(entry).toHaveProperty('moderate')
      expect(entry).toHaveProperty('high')
      expect(typeof entry.level).toBe('number')
    }
  })
})

// === treasure-tables.json ===
describe('treasure-tables.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('treasure-tables.json')
  })

  it('has individual and hoard arrays with all 4 CR tiers', () => {
    expect(data).toHaveProperty('individual')
    expect(data).toHaveProperty('hoard')
    expect(data).toHaveProperty('magicItemRarities')
    expect(Array.isArray(data.individual)).toBe(true)
    expect(Array.isArray(data.hoard)).toBe(true)
    const individual = data.individual as { crRange: string }[]
    const hoard = data.hoard as { crRange: string }[]
    expect(individual).toHaveLength(4)
    expect(hoard).toHaveLength(4)
    for (const entry of individual) {
      expect(entry).toHaveProperty('crRange')
      expect(entry).toHaveProperty('amount')
      expect(entry).toHaveProperty('unit')
    }
    for (const entry of hoard) {
      expect(entry).toHaveProperty('crRange')
      expect(entry).toHaveProperty('coins')
      expect(entry).toHaveProperty('magicItems')
    }
  })
})

// === diseases.json ===
describe('diseases.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('diseases.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each disease has required fields', () => {
    for (const d of data as Record<string, unknown>[]) {
      expect(d).toHaveProperty('id')
      expect(d).toHaveProperty('name')
      expect(d).toHaveProperty('effect')
    }
  })
})

// === encounter-presets.json ===
describe('encounter-presets.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('encounter-presets.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each preset has required fields', () => {
    for (const p of data as Record<string, unknown>[]) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('monsters')
      expect(Array.isArray(p.monsters)).toBe(true)
    }
  })
})

// === traps.json ===
describe('traps.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('traps.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each trap has required fields', () => {
    for (const t of data as Record<string, unknown>[]) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('trigger')
      expect(t).toHaveProperty('effect')
    }
  })
})

// === hazards.json ===
describe('hazards.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('hazards.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each hazard has required fields', () => {
    for (const h of data as Record<string, unknown>[]) {
      expect(h).toHaveProperty('id')
      expect(h).toHaveProperty('name')
      expect(h).toHaveProperty('effect')
    }
  })
})

// === poisons.json ===
describe('poisons.json', () => {
  let data: unknown[]
  beforeAll(() => {
    data = loadJsonFile('poisons.json')
  })

  it('is a non-empty array', () => {
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('each poison has required fields', () => {
    for (const p of data as Record<string, unknown>[]) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('type')
      expect(['ingested', 'inhaled', 'contact', 'injury']).toContain(p.type)
    }
  })
})

// === random-tables.json ===
describe('random-tables.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('random-tables.json')
  })

  it('has expected top-level keys', () => {
    expect(data).toHaveProperty('npcTraits')
    expect(data).toHaveProperty('weather')
    expect(data).toHaveProperty('tavernNames')
    expect(data).toHaveProperty('shopNames')
    expect(data).toHaveProperty('plotHooks')
  })
})

// === chase-tables.json ===
describe('chase-tables.json', () => {
  let data: Record<string, unknown>
  beforeAll(() => {
    data = loadJsonFile('chase-tables.json')
  })

  it('has urban and wilderness arrays', () => {
    expect(data).toHaveProperty('urban')
    expect(data).toHaveProperty('wilderness')
    expect(Array.isArray(data.urban)).toBe(true)
    expect(Array.isArray(data.wilderness)).toBe(true)
  })
})

// === Cross-reference: encounter-presets monster IDs vs monsters.json ===
describe('cross-references', () => {
  it('encounter preset monster IDs exist in monsters.json, creatures.json, or npcs.json', () => {
    const monsters = loadJsonFile<Array<{ id: string }>>('monsters.json')
    const creatures = loadJsonFile<Array<{ id: string }>>('creatures.json')
    const npcs = loadJsonFile<Array<{ id: string }>>('npcs.json')
    const allIds = new Set([...monsters.map((m) => m.id), ...creatures.map((c) => c.id), ...npcs.map((n) => n.id)])
    const presets = loadJsonFile<Array<{ monsters: Array<{ id: string }> }>>('encounter-presets.json')
    for (const preset of presets) {
      for (const m of preset.monsters) {
        expect(allIds.has(m.id)).toBe(true)
      }
    }
  })

  it('background origin feats exist in feats.json', () => {
    const backgrounds = loadJsonFile<Array<{ originFeat?: string }>>('backgrounds.json')
    const feats = loadJsonFile<Array<{ id: string; name: string }>>('feats.json')
    const featNames = new Set(feats.map((f) => f.name))
    for (const bg of backgrounds) {
      if (bg.originFeat && bg.originFeat !== 'any') {
        // originFeat uses display names; strip parenthetical variant (e.g. "Magic Initiate (Cleric)" → "Magic Initiate")
        const baseName = bg.originFeat.replace(/\s*\(.*\)$/, '')
        expect(featNames.has(baseName)).toBe(true)
      }
    }
  })

  it('subclass class references match classes.json', () => {
    const classes = loadJsonFile<Array<{ id: string }>>('classes.json')
    const classIds = new Set(classes.map((c) => c.id))
    const subclasses = loadJsonFile<Array<{ class: string }>>('subclasses.json')
    for (const sc of subclasses) {
      expect(classIds.has(sc.class)).toBe(true)
    }
  })

  it('species inline traits have name and description', () => {
    const species = loadJsonFile<Array<{
      id: string
      traits: Array<{ name: string; description: string }>
      subraces?: Array<{ id: string; traitModifications: { add: Array<{ name: string; description: string }> } }>
    }>>('species.json')
    for (const sp of species) {
      for (const trait of sp.traits) {
        expect(typeof trait.name, `Species "${sp.id}" has trait with invalid name`).toBe('string')
        expect(trait.name.length).toBeGreaterThan(0)
        expect(typeof trait.description, `Species "${sp.id}" trait "${trait.name}" has invalid description`).toBe('string')
        expect(trait.description.length).toBeGreaterThan(0)
      }
      if (sp.subraces) {
        for (const sr of sp.subraces) {
          for (const trait of sr.traitModifications.add) {
            expect(typeof trait.name, `Subrace "${sr.id}" has trait with invalid name`).toBe('string')
            expect(typeof trait.description, `Subrace "${sr.id}" trait "${trait.name}" has invalid description`).toBe('string')
          }
        }
      }
    }
  })
})
