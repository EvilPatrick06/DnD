import { describe, expect, it } from 'vitest'
import { calculate5eStats, calculateArmorClass5e, calculateHPBonusFromTraits, getWildShapeMax } from './stat-calculator-5e'

describe('calculateHPBonusFromTraits', () => {
  it('returns 0 with no matching traits', () => {
    expect(calculateHPBonusFromTraits(5, null, null)).toBe(0)
  })

  it('adds +1 HP per level for dwarves', () => {
    expect(calculateHPBonusFromTraits(5, 'dwarf', null)).toBe(5)
    expect(calculateHPBonusFromTraits(10, 'dwarf', null)).toBe(10)
  })

  it('adds +2 HP per level for Tough feat', () => {
    expect(calculateHPBonusFromTraits(5, null, [{ id: 'tough' }])).toBe(10)
  })

  it('adds +40 HP for Boon of Fortitude', () => {
    expect(calculateHPBonusFromTraits(1, null, [{ id: 'boon-of-fortitude' }])).toBe(40)
  })

  it('stacks dwarf + tough', () => {
    expect(calculateHPBonusFromTraits(5, 'dwarf', [{ id: 'tough' }])).toBe(15)
  })

  it('adds draconic resilience at level 3+', () => {
    expect(calculateHPBonusFromTraits(1, null, null, 3)).toBe(3)
    expect(calculateHPBonusFromTraits(1, null, null, 5)).toBe(5)
  })

  it('does not add draconic resilience below level 3', () => {
    expect(calculateHPBonusFromTraits(1, null, null, 2)).toBe(0)
    expect(calculateHPBonusFromTraits(1, null, null, 0)).toBe(0)
  })
})

describe('getWildShapeMax', () => {
  it('returns 0 for druid levels below 2', () => {
    expect(getWildShapeMax(0)).toBe(0)
    expect(getWildShapeMax(1)).toBe(0)
  })

  it('returns 2 for druid levels 2-5', () => {
    expect(getWildShapeMax(2)).toBe(2)
    expect(getWildShapeMax(5)).toBe(2)
  })

  it('returns 3 for druid levels 6-16', () => {
    expect(getWildShapeMax(6)).toBe(3)
    expect(getWildShapeMax(16)).toBe(3)
  })

  it('returns 4 for druid levels 17-20', () => {
    expect(getWildShapeMax(17)).toBe(4)
    expect(getWildShapeMax(20)).toBe(4)
  })
})

describe('calculate5eStats', () => {
  const baseScores = {
    strength: 10,
    dexterity: 14,
    constitution: 12,
    intelligence: 8,
    wisdom: 13,
    charisma: 15
  }

  it('computes proficiency bonus from level', () => {
    const result = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: ['dexterity', 'intelligence'] }, 1)
    expect(result.proficiencyBonus).toBe(2)

    const result5 = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: ['dexterity', 'intelligence'] }, 5)
    expect(result5.proficiencyBonus).toBe(3)

    const result9 = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: ['dexterity', 'intelligence'] }, 9)
    expect(result9.proficiencyBonus).toBe(4)
  })

  it('computes ability modifiers correctly', () => {
    const result = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: [] }, 1)
    expect(result.abilityModifiers.strength).toBe(0) // 10 → +0
    expect(result.abilityModifiers.dexterity).toBe(2) // 14 → +2
    expect(result.abilityModifiers.constitution).toBe(1) // 12 → +1
    expect(result.abilityModifiers.intelligence).toBe(-1) // 8 → -1
    expect(result.abilityModifiers.wisdom).toBe(1) // 13 → +1
    expect(result.abilityModifiers.charisma).toBe(2) // 15 → +2
  })

  it('computes initiative from DEX modifier', () => {
    const result = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: [] }, 1)
    expect(result.initiative).toBe(2) // DEX mod = +2
  })

  it('applies background ability bonuses', () => {
    const result = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: [] }, 1, { strength: 2, dexterity: 1 })
    expect(result.abilityScores.strength).toBe(12) // 10 + 2
    expect(result.abilityScores.dexterity).toBe(15) // 14 + 1
  })

  it('computes saving throws with proficiency', () => {
    const result = calculate5eStats(baseScores, null, { hitDie: 8, savingThrows: ['dexterity', 'intelligence'] }, 1)
    expect(result.savingThrows.dexterity).toBe(4) // +2 DEX mod + 2 prof
    expect(result.savingThrows.intelligence).toBe(1) // -1 INT mod + 2 prof
    expect(result.savingThrows.strength).toBe(0) // 0 STR mod, no prof
  })
})

describe('calculateArmorClass5e — PHB 2024', () => {
  it('unarmored: 10 + DEX mod', () => {
    expect(calculateArmorClass5e({ dexMod: 2, armor: [] })).toBe(12)
    expect(calculateArmorClass5e({ dexMod: -1, armor: [] })).toBe(9)
    expect(calculateArmorClass5e({ dexMod: 0, armor: [] })).toBe(10)
  })

  it('light armor: base + DEX mod (no cap)', () => {
    const leather = { acBonus: 1, equipped: true, type: 'armor' as const, category: 'light' }
    expect(calculateArmorClass5e({ dexMod: 3, armor: [leather] })).toBe(14) // 10 + 1 + 3
    expect(calculateArmorClass5e({ dexMod: 5, armor: [leather] })).toBe(16) // 10 + 1 + 5
  })

  it('medium armor: base + DEX mod (max +2)', () => {
    const chainShirt = { acBonus: 3, equipped: true, type: 'armor' as const, category: 'medium', dexCap: 2 }
    expect(calculateArmorClass5e({ dexMod: 1, armor: [chainShirt] })).toBe(14) // 10 + 3 + 1
    expect(calculateArmorClass5e({ dexMod: 3, armor: [chainShirt] })).toBe(15) // 10 + 3 + 2(cap)
    expect(calculateArmorClass5e({ dexMod: 5, armor: [chainShirt] })).toBe(15) // 10 + 3 + 2(cap)
  })

  it('heavy armor: base AC, no DEX', () => {
    const plate = { acBonus: 8, equipped: true, type: 'armor' as const, category: 'heavy' }
    expect(calculateArmorClass5e({ dexMod: 5, armor: [plate] })).toBe(18) // 10 + 8
    expect(calculateArmorClass5e({ dexMod: -2, armor: [plate] })).toBe(18) // same
  })

  it('shield adds its bonus', () => {
    const shield = { acBonus: 2, equipped: true, type: 'shield' as const }
    expect(calculateArmorClass5e({ dexMod: 2, armor: [shield] })).toBe(14) // 10 + 2 + 2

    const plate = { acBonus: 8, equipped: true, type: 'armor' as const, category: 'heavy' }
    expect(calculateArmorClass5e({ dexMod: 2, armor: [plate, shield] })).toBe(20) // 18 + 2
  })

  it('ignores unequipped armor', () => {
    const plate = { acBonus: 8, equipped: false, type: 'armor' as const, category: 'heavy' }
    expect(calculateArmorClass5e({ dexMod: 2, armor: [plate] })).toBe(12) // unarmored
  })

  it('Barbarian unarmored defense: 10 + DEX + CON', () => {
    expect(calculateArmorClass5e({
      dexMod: 2, armor: [], classNames: ['Barbarian'], conMod: 3
    })).toBe(15) // 10 + 2 + 3
  })

  it('Monk unarmored defense: 10 + DEX + WIS', () => {
    expect(calculateArmorClass5e({
      dexMod: 3, armor: [], classNames: ['Monk'], wisMod: 2
    })).toBe(15) // 10 + 3 + 2
  })

  it('Draconic Resilience: 13 + DEX (Sorcerer level 3+)', () => {
    expect(calculateArmorClass5e({
      dexMod: 2, armor: [], draconicSorcererLevel: 3
    })).toBe(15) // 13 + 2
  })

  it('unarmored defense uses highest available formula', () => {
    // Barbarian with CON +1, DEX +3: standard = 13, barb = 14
    expect(calculateArmorClass5e({
      dexMod: 3, armor: [], classNames: ['Barbarian'], conMod: 1
    })).toBe(14) // 10 + 3 + 1 > 10 + 3
  })

  it('wearing armor overrides unarmored defense', () => {
    const chainShirt = { acBonus: 3, equipped: true, type: 'armor' as const, category: 'medium', dexCap: 2 }
    // Barbarian in medium armor: uses armor formula, NOT unarmored defense
    expect(calculateArmorClass5e({
      dexMod: 3, armor: [chainShirt], classNames: ['Barbarian'], conMod: 5
    })).toBe(15) // 10 + 3 + 2(cap), NOT 10 + 3 + 5 = 18
  })

  it('adds AC bonus from effects', () => {
    expect(calculateArmorClass5e({
      dexMod: 2, armor: [], acBonusFromEffects: 3
    })).toBe(15) // 10 + 2 + 3
  })
})
