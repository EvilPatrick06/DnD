#!/usr/bin/env node
/**
 * Updates monsters.json with all 2024 PHB Appendix B creature stat blocks.
 * - Adds ~37 missing creatures
 * - Audits and updates 13 existing creatures to match 2024 PHB
 * - Adds tags field for categorization (familiar, mount, beast, wild-shape, etc.)
 */

const fs = require('fs')
const path = require('path')

const MONSTERS_PATH = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'monsters.json')

// Load existing
const existing = JSON.parse(fs.readFileSync(MONSTERS_PATH, 'utf-8'))
const byId = new Map(existing.map(m => [m.id, m]))

// ── New creatures from 2024 PHB Appendix B ──

const newCreatures = [
  {
    id: "ape",
    name: "Ape",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 19,
    hitDice: "3d8+6",
    speed: { walk: 30, climb: 30 },
    abilityScores: { str: 16, dex: 14, con: 14, int: 6, wis: 12, cha: 7 },
    skills: { "Athletics": 5, "Perception": 3 },
    senses: { passivePerception: 13 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    actions: [
      {
        name: "Multiattack",
        description: "The ape makes two Fist attacks.",
        multiattackActions: ["Fist", "Fist"]
      },
      {
        name: "Fist",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Bludgeoning damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d4+3",
        damageType: "Bludgeoning"
      },
      {
        name: "Rock",
        description: "Ranged Attack Roll: +5, range 25/50 ft. Hit: 10 (2d6 + 3) Bludgeoning damage.",
        attackType: "ranged",
        toHit: 5,
        rangeNormal: 25,
        rangeLong: 50,
        targets: 1,
        damageDice: "2d6+3",
        damageType: "Bludgeoning",
        recharge: "6"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "badger",
    name: "Badger",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 5,
    hitDice: "1d4+3",
    speed: { walk: 20, burrow: 5 },
    abilityScores: { str: 10, dex: 11, con: 16, int: 2, wis: 12, cha: 5 },
    skills: { "Perception": 3 },
    resistances: ["Poison"],
    senses: { darkvision: 30, passivePerception: 13 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "black-bear",
    name: "Black Bear",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 19,
    hitDice: "3d8+6",
    speed: { walk: 30, climb: 30, swim: 30 },
    abilityScores: { str: 15, dex: 12, con: 14, int: 2, wis: 12, cha: 7 },
    skills: { "Perception": 5 },
    senses: { darkvision: 60, passivePerception: 15 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    actions: [
      {
        name: "Multiattack",
        description: "The bear makes two Rend attacks.",
        multiattackActions: ["Rend", "Rend"]
      },
      {
        name: "Rend",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d6+2",
        damageType: "Slashing"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "boar",
    name: "Boar",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 13,
    hitDice: "2d8+4",
    speed: { walk: 40 },
    abilityScores: { str: 13, dex: 11, con: 14, int: 2, wis: 9, cha: 5 },
    senses: { passivePerception: 9 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Bloodied Fury",
        description: "While Bloodied, the boar has Advantage on attack rolls."
      }
    ],
    actions: [
      {
        name: "Gore",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Piercing damage. If the boar moved at least 20 feet straight toward the target immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and, if it is Large or smaller, has the Prone condition.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "1d6+1",
        damageType: "Piercing"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "camel",
    name: "Camel",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 17,
    hitDice: "2d10+6",
    speed: { walk: 50 },
    abilityScores: { str: 15, dex: 8, con: 17, int: 2, wis: 11, cha: 5 },
    senses: { darkvision: 60, passivePerception: 10 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: -1, score: 9 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Bludgeoning damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "constrictor-snake",
    name: "Constrictor Snake",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 13,
    hitDice: "2d10+2",
    speed: { walk: 30, swim: 30 },
    abilityScores: { str: 15, dex: 14, con: 12, int: 1, wis: 10, cha: 3 },
    skills: { "Perception": 2, "Stealth": 4 },
    senses: { blindsight: 10, passivePerception: 12 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8 + 2) Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d8+2",
        damageType: "Piercing"
      },
      {
        name: "Constrict",
        description: "Strength Saving Throw: DC 12, one Medium or smaller creature the snake can see within 5 feet. Failure: 7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.",
        saveDC: 12,
        saveAbility: "STR",
        damageDice: "3d4",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "crab",
    name: "Crab",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 3,
    hitDice: "1d4+1",
    speed: { walk: 20, swim: 20 },
    abilityScores: { str: 6, dex: 11, con: 12, int: 1, wis: 8, cha: 2 },
    skills: { "Stealth": 2 },
    senses: { blindsight: 30, passivePerception: 9 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Amphibious",
        description: "The crab can breathe air and water."
      }
    ],
    actions: [
      {
        name: "Claw",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Bludgeoning damage.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "crocodile",
    name: "Crocodile",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 13,
    hitDice: "2d10+2",
    speed: { walk: 20, swim: 30 },
    abilityScores: { str: 15, dex: 10, con: 13, int: 2, wis: 10, cha: 5 },
    skills: { "Stealth": 2 },
    senses: { passivePerception: 10 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Hold Breath",
        description: "The crocodile can hold its breath for 1 hour."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8 + 2) Piercing damage. If the target is Medium or smaller, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d8+2",
        damageType: "Piercing",
        saveDC: 12,
        saveAbility: "STR"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "draft-horse",
    name: "Draft Horse",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 15,
    hitDice: "2d10+4",
    speed: { walk: 40 },
    abilityScores: { str: 18, dex: 10, con: 15, int: 2, wis: 11, cha: 7 },
    senses: { passivePerception: 10 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Hooves",
        description: "Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d4 + 4) Bludgeoning damage.",
        attackType: "melee",
        toHit: 6,
        reach: 5,
        targets: 1,
        damageDice: "1d4+4",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "elephant",
    name: "Elephant",
    size: "Huge",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 76,
    hitDice: "8d12+24",
    speed: { walk: 40 },
    abilityScores: { str: 22, dex: 9, con: 17, int: 3, wis: 11, cha: 6 },
    senses: { passivePerception: 10 },
    languages: [],
    cr: "4",
    xp: 1100,
    proficiencyBonus: 2,
    initiative: { modifier: -1, score: 9 },
    actions: [
      {
        name: "Multiattack",
        description: "The elephant makes two Gore attacks.",
        multiattackActions: ["Gore", "Gore"]
      },
      {
        name: "Gore",
        description: "Melee Attack Roll: +8, reach 5 ft. Hit: 15 (2d8 + 6) Piercing damage. If the elephant moved at least 20 feet straight toward the target immediately before the hit, the target also has the Prone condition.",
        attackType: "melee",
        toHit: 8,
        reach: 5,
        targets: 1,
        damageDice: "2d8+6",
        damageType: "Piercing"
      }
    ],
    bonusActions: [
      {
        name: "Trample",
        description: "Dexterity Saving Throw: DC 16, one creature within 5 feet that has the Prone condition. Failure: 17 (2d10 + 6) Bludgeoning damage. Success: Half damage.",
        saveDC: 16,
        saveAbility: "DEX",
        damageDice: "2d10+6",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["beast"],
    tokenSize: { x: 3, y: 3 }
  },
  {
    id: "elk",
    name: "Elk",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 11,
    hitDice: "2d10",
    speed: { walk: 50 },
    abilityScores: { str: 16, dex: 10, con: 11, int: 2, wis: 10, cha: 6 },
    skills: { "Perception": 2 },
    senses: { darkvision: 60, passivePerception: 12 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Ram",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage. If the elk moved at least 20 feet straight toward the target immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and, if it is Huge or smaller, has the Prone condition.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount", "beast"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "frog",
    name: "Frog",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 20, swim: 20 },
    abilityScores: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
    skills: { "Perception": 1, "Stealth": 3 },
    senses: { darkvision: 30, passivePerception: 11 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    traits: [
      {
        name: "Amphibious",
        description: "The frog can breathe air and water."
      },
      {
        name: "Standing Leap",
        description: "The frog's Long Jump is up to 10 feet and its High Jump is up to 5 feet with or without a running start."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "giant-badger",
    name: "Giant Badger",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 15,
    hitDice: "2d8+6",
    speed: { walk: 30, burrow: 10 },
    abilityScores: { str: 13, dex: 10, con: 17, int: 2, wis: 12, cha: 5 },
    skills: { "Perception": 3 },
    resistances: ["Poison"],
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 6 (2d4 + 1) Piercing damage.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "2d4+1",
        damageType: "Piercing"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "giant-crab",
    name: "Giant Crab",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 15,
    hp: 13,
    hitDice: "3d8",
    speed: { walk: 30, swim: 30 },
    abilityScores: { str: 13, dex: 13, con: 11, int: 1, wis: 9, cha: 3 },
    skills: { "Stealth": 3 },
    senses: { blindsight: 30, passivePerception: 9 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    traits: [
      {
        name: "Amphibious",
        description: "The crab can breathe air and water."
      }
    ],
    actions: [
      {
        name: "Claw",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning damage. If the target is Medium or smaller, it has the Grappled condition (escape DC 11). The crab has two claws, each of which can grapple one target.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "1d6+1",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "giant-goat",
    name: "Giant Goat",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 19,
    hitDice: "3d10+3",
    speed: { walk: 40, climb: 30 },
    abilityScores: { str: 17, dex: 13, con: 12, int: 3, wis: 12, cha: 6 },
    skills: { "Perception": 3 },
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    actions: [
      {
        name: "Ram",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage. If the goat moved at least 20 feet straight toward the target immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and, if it is Huge or smaller, has the Prone condition.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "giant-seahorse",
    name: "Giant Seahorse",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 14,
    hp: 16,
    hitDice: "3d10",
    speed: { walk: 5, swim: 40 },
    abilityScores: { str: 15, dex: 12, con: 11, int: 2, wis: 12, cha: 5 },
    senses: { passivePerception: 11 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    traits: [
      {
        name: "Water Breathing",
        description: "The seahorse can breathe only underwater."
      }
    ],
    actions: [
      {
        name: "Ram",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d6 + 2) Bludgeoning damage, or the seahorse deals 11 (2d8 + 2) Bludgeoning damage if it moved at least 20 feet straight toward the target immediately before the hit.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "2d6+2",
        damageType: "Bludgeoning"
      }
    ],
    bonusActions: [
      {
        name: "Bubble Dash",
        description: "While underwater, the seahorse moves up to half its Swim Speed without provoking Opportunity Attacks."
      }
    ],
    tags: ["beast"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "giant-weasel",
    name: "Giant Weasel",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 9,
    hitDice: "2d8",
    speed: { walk: 40, climb: 30 },
    abilityScores: { str: 11, dex: 17, con: 10, int: 4, wis: 12, cha: 5 },
    skills: { "Acrobatics": 5, "Perception": 3, "Stealth": 5 },
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 3, score: 13 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Piercing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d4+3",
        damageType: "Piercing"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "goat",
    name: "Goat",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 4,
    hitDice: "1d8",
    speed: { walk: 40, climb: 30 },
    abilityScores: { str: 11, dex: 10, con: 11, int: 2, wis: 10, cha: 5 },
    skills: { "Perception": 2 },
    senses: { darkvision: 60, passivePerception: 12 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Ram",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Bludgeoning damage, or the goat deals 2 (1d4) Bludgeoning damage if it moved at least 20 feet straight toward the target immediately before the hit.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["beast"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "hawk",
    name: "Hawk",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 10, fly: 60 },
    abilityScores: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
    skills: { "Perception": 6 },
    senses: { passivePerception: 16 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 3, score: 13 },
    actions: [
      {
        name: "Talons",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 1 Slashing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Slashing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "lion",
    name: "Lion",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 22,
    hitDice: "4d10",
    speed: { walk: 50 },
    abilityScores: { str: 17, dex: 15, con: 11, int: 3, wis: 12, cha: 8 },
    skills: { "Perception": 3, "Stealth": 4 },
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "1",
    xp: 200,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Pack Tactics",
        description: "The lion has Advantage on an attack roll against a creature if at least one of the lion's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      },
      {
        name: "Running Leap",
        description: "With a 10-foot running start, the lion can Long Jump up to 25 feet."
      }
    ],
    actions: [
      {
        name: "Multiattack",
        description: "The lion makes two Rend attacks. It can replace one of these attacks with a use of Roar.",
        multiattackActions: ["Rend", "Rend"]
      },
      {
        name: "Rend",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Slashing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d8+3",
        damageType: "Slashing"
      },
      {
        name: "Roar",
        description: "Wisdom Saving Throw: DC 11, one creature within 15 feet. Failure: The target has the Frightened condition until the start of the lion's next turn.",
        saveDC: 11,
        saveAbility: "WIS"
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "lizard",
    name: "Lizard",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 2,
    hitDice: "1d4",
    speed: { walk: 20, climb: 20 },
    abilityScores: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
    senses: { darkvision: 30, passivePerception: 9 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Spider Climb",
        description: "The lizard can climb difficult surfaces, including along ceilings, without needing to make an ability check."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "mastiff",
    name: "Mastiff",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 5,
    hitDice: "1d8+1",
    speed: { walk: 40 },
    abilityScores: { str: 13, dex: 14, con: 12, int: 3, wis: 12, cha: 7 },
    skills: { "Perception": 5 },
    senses: { darkvision: 60, passivePerception: 15 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Piercing damage, and the target has the Prone condition if it is Large or smaller.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "1d6+1",
        damageType: "Piercing"
      }
    ],
    tags: ["mount", "beast"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "mule",
    name: "Mule",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 11,
    hitDice: "2d8+2",
    speed: { walk: 40 },
    abilityScores: { str: 14, dex: 10, con: 13, int: 2, wis: 10, cha: 5 },
    senses: { passivePerception: 10 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Beast of Burden",
        description: "The mule counts as one size larger for the purpose of determining its carrying capacity."
      }
    ],
    actions: [
      {
        name: "Hooves",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Bludgeoning damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "octopus",
    name: "Octopus",
    size: "Small",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 3,
    hitDice: "1d6",
    speed: { walk: 5, swim: 30 },
    abilityScores: { str: 4, dex: 15, con: 11, int: 3, wis: 10, cha: 4 },
    skills: { "Perception": 2, "Stealth": 6 },
    senses: { darkvision: 30, passivePerception: 12 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Compression",
        description: "The octopus can move through a space as narrow as 1 inch without squeezing."
      },
      {
        name: "Water Breathing",
        description: "The octopus can breathe only underwater."
      }
    ],
    actions: [
      {
        name: "Tentacles",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Bludgeoning damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Bludgeoning"
      }
    ],
    reactions: [
      {
        name: "Ink Cloud (1/Day)",
        description: "Trigger: A creature ends its turn within 5 feet of the octopus while underwater. Response: The octopus releases ink that fills a 5-foot Cube centered on itself, and the octopus moves up to its Swim Speed. The Cube is Heavily Obscured for 1 minute or until a strong current or similar effect disperses the ink."
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "owl",
    name: "Owl",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 5, fly: 60 },
    abilityScores: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
    skills: { "Perception": 5, "Stealth": 5 },
    senses: { darkvision: 120, passivePerception: 15 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    traits: [
      {
        name: "Flyby",
        description: "The owl doesn't provoke Opportunity Attacks when it flies out of an enemy's reach."
      }
    ],
    actions: [
      {
        name: "Talons",
        description: "Melee Attack Roll: +3, reach 5 ft. Hit: 1 Slashing damage.",
        attackType: "melee",
        toHit: 3,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Slashing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "panther",
    name: "Panther",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 13,
    hitDice: "3d8",
    speed: { walk: 50, climb: 40 },
    abilityScores: { str: 14, dex: 15, con: 10, int: 3, wis: 14, cha: 7 },
    skills: { "Perception": 4, "Stealth": 6 },
    senses: { darkvision: 60, passivePerception: 14 },
    languages: [],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    actions: [
      {
        name: "Multiattack",
        description: "The panther makes one Pounce attack and uses Prowl.",
        multiattackActions: ["Pounce", "Prowl"]
      },
      {
        name: "Pounce",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Slashing damage, or the panther deals 7 (2d4 + 2) Slashing damage if it had Advantage on the attack roll.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Slashing"
      },
      {
        name: "Prowl",
        description: "The panther moves up to half its Speed without provoking Opportunity Attacks. At the end of this movement, the panther can take the Hide action."
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "pony",
    name: "Pony",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 10,
    hp: 11,
    hitDice: "2d8+2",
    speed: { walk: 40 },
    abilityScores: { str: 15, dex: 10, con: 13, int: 2, wis: 11, cha: 7 },
    senses: { passivePerception: 10 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Hooves",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Bludgeoning damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "raven",
    name: "Raven",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 2,
    hitDice: "1d4",
    speed: { walk: 10, fly: 50 },
    abilityScores: { str: 2, dex: 14, con: 10, int: 5, wis: 13, cha: 6 },
    skills: { "Perception": 3 },
    senses: { passivePerception: 13 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Mimicry",
        description: "The raven can mimic simple sounds it has heard, such as a whisper or chitter. A hearer can discern the sounds are imitations with a successful DC 10 Wisdom (Insight) check."
      }
    ],
    actions: [
      {
        name: "Beak",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "reef-shark",
    name: "Reef Shark",
    size: "Medium",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 22,
    hitDice: "4d8+4",
    speed: { walk: 0, swim: 30 },
    abilityScores: { str: 14, dex: 15, con: 13, int: 1, wis: 10, cha: 4 },
    skills: { "Perception": 2 },
    senses: { blindsight: 30, passivePerception: 12 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Pack Tactics",
        description: "The shark has Advantage on an attack roll against a creature if at least one of the shark's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      },
      {
        name: "Water Breathing",
        description: "The shark can breathe only underwater."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d4 + 2) Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "2d4+2",
        damageType: "Piercing"
      }
    ],
    tags: ["beast"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "scorpion",
    name: "Scorpion",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 10 },
    abilityScores: { str: 2, dex: 11, con: 8, int: 1, wis: 8, cha: 2 },
    senses: { blindsight: 10, passivePerception: 9 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 0, score: 10 },
    actions: [
      {
        name: "Sting",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Piercing damage plus 3 (1d6) Poison damage.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing",
        additionalDamage: "1d6 Poison"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "slaad-tadpole",
    name: "Slaad Tadpole",
    size: "Tiny",
    type: "Aberration",
    alignment: "Chaotic Neutral",
    ac: 12,
    hp: 7,
    hitDice: "3d4",
    speed: { walk: 30, burrow: 10 },
    abilityScores: { str: 7, dex: 15, con: 10, int: 3, wis: 5, cha: 3 },
    skills: { "Stealth": 4 },
    resistances: ["Acid", "Cold", "Fire", "Lightning", "Thunder"],
    senses: { darkvision: 60, passivePerception: 7 },
    languages: ["Understands Slaad but can't speak"],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Magic Resistance",
        description: "The slaad has Advantage on saving throws against spells and other magical effects."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d6+2",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar", "chain-pact"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "sphinx-of-wonder",
    name: "Sphinx of Wonder",
    size: "Tiny",
    type: "Celestial",
    alignment: "Lawful Good",
    ac: 13,
    hp: 24,
    hitDice: "7d4+7",
    speed: { walk: 20, fly: 40 },
    abilityScores: { str: 6, dex: 17, con: 13, int: 15, wis: 12, cha: 11 },
    skills: { "Arcana": 4, "Religion": 4, "Stealth": 5 },
    resistances: ["Necrotic", "Psychic", "Radiant"],
    senses: { darkvision: 60, passivePerception: 11 },
    languages: ["Celestial", "Common"],
    cr: "1",
    xp: 200,
    proficiencyBonus: 2,
    initiative: { modifier: 3, score: 13 },
    traits: [
      {
        name: "Magic Resistance",
        description: "The sphinx has Advantage on saving throws against spells and other magical effects."
      }
    ],
    actions: [
      {
        name: "Rend",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Slashing damage plus 7 (2d6) Radiant damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d4+3",
        damageType: "Slashing",
        additionalDamage: "2d6 Radiant"
      }
    ],
    reactions: [
      {
        name: "Burst of Ingenuity (2/Day)",
        description: "Trigger: The sphinx or another creature within 30 feet makes an ability check or a saving throw. Response: The sphinx adds 2 to the roll."
      }
    ],
    tags: ["familiar", "chain-pact"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "spider",
    name: "Spider",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 20, climb: 20 },
    abilityScores: { str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2 },
    skills: { "Stealth": 4 },
    senses: { darkvision: 30, passivePerception: 10 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Spider Climb",
        description: "The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check."
      },
      {
        name: "Web Walker",
        description: "The spider ignores movement restrictions caused by webs, and the spider knows the location of any other creature in contact with the same web."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage plus 2 (1d4) Poison damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing",
        additionalDamage: "1d4 Poison"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "sprite",
    name: "Sprite",
    size: "Tiny",
    type: "Fey",
    alignment: "Neutral Good",
    ac: 15,
    hp: 10,
    hitDice: "4d4",
    speed: { walk: 10, fly: 40 },
    abilityScores: { str: 3, dex: 18, con: 10, int: 14, wis: 13, cha: 11 },
    skills: { "Perception": 3, "Stealth": 8 },
    senses: { passivePerception: 13 },
    languages: ["Common", "Elvish", "Sylvan"],
    cr: "1/4",
    xp: 50,
    proficiencyBonus: 2,
    initiative: { modifier: 4, score: 14 },
    actions: [
      {
        name: "Needle Sword",
        description: "Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d4 + 4) Piercing damage.",
        attackType: "melee",
        toHit: 6,
        reach: 5,
        targets: 1,
        damageDice: "1d4+4",
        damageType: "Piercing"
      },
      {
        name: "Enchanting Bow",
        description: "Ranged Attack Roll: +6, range 40/160 ft. Hit: 1 Piercing damage, and the target has the Charmed condition until the start of the sprite's next turn.",
        attackType: "ranged",
        toHit: 6,
        rangeNormal: 40,
        rangeLong: 160,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      },
      {
        name: "Heart Sight",
        description: "Charisma Saving Throw: DC 10, one creature within 5 feet the sprite can see. Celestials, Fiends, and Undead automatically fail the save. Failure: The sprite knows the target's emotions and alignment.",
        saveDC: 10,
        saveAbility: "CHA"
      },
      {
        name: "Invisibility",
        description: "The sprite casts Invisibility on itself, requiring no spell components and using Charisma as the spellcasting ability."
      }
    ],
    tags: ["familiar", "chain-pact"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "tiger",
    name: "Tiger",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 22,
    hitDice: "3d10+6",
    speed: { walk: 40 },
    abilityScores: { str: 17, dex: 16, con: 14, int: 3, wis: 12, cha: 8 },
    skills: { "Perception": 3, "Stealth": 7 },
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "1",
    xp: 200,
    proficiencyBonus: 2,
    initiative: { modifier: 3, score: 13 },
    actions: [
      {
        name: "Multiattack",
        description: "The tiger makes one Pounce attack and uses Prowl.",
        multiattackActions: ["Pounce", "Prowl"]
      },
      {
        name: "Pounce",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Slashing damage. If the tiger had Advantage on the attack roll, the target takes an extra 3 (1d6) Slashing damage and, if it is Huge or smaller, has the Prone condition.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Slashing"
      },
      {
        name: "Prowl",
        description: "The tiger moves up to half its Speed without provoking Opportunity Attacks. At the end of this movement, the tiger can take the Hide action."
      }
    ],
    tags: ["beast", "wild-shape"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "venomous-snake",
    name: "Venomous Snake",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 12,
    hp: 5,
    hitDice: "2d4",
    speed: { walk: 30, swim: 30 },
    abilityScores: { str: 2, dex: 15, con: 11, int: 1, wis: 10, cha: 3 },
    senses: { blindsight: 10, passivePerception: 10 },
    languages: [],
    cr: "1/8",
    xp: 25,
    proficiencyBonus: 2,
    initiative: { modifier: 2, score: 12 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage plus 3 (1d6) Poison damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Piercing",
        additionalDamage: "1d6 Poison"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  },
  {
    id: "warhorse",
    name: "Warhorse",
    size: "Large",
    type: "Beast",
    alignment: "Unaligned",
    ac: 11,
    hp: 19,
    hitDice: "3d10+3",
    speed: { walk: 60 },
    abilityScores: { str: 18, dex: 12, con: 13, int: 2, wis: 12, cha: 7 },
    senses: { passivePerception: 11 },
    languages: [],
    cr: "1/2",
    xp: 100,
    proficiencyBonus: 2,
    initiative: { modifier: 1, score: 11 },
    actions: [
      {
        name: "Hooves",
        description: "Melee Attack Roll: +6, reach 5 ft. Hit: 9 (2d4 + 4) Bludgeoning damage. If the horse moved at least 20 feet straight toward the target immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and, if it is Huge or smaller, has the Prone condition.",
        attackType: "melee",
        toHit: 6,
        reach: 5,
        targets: 1,
        damageDice: "2d4+4",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"],
    tokenSize: { x: 2, y: 2 }
  },
  {
    id: "weasel",
    name: "Weasel",
    size: "Tiny",
    type: "Beast",
    alignment: "Unaligned",
    ac: 13,
    hp: 1,
    hitDice: "1d4-1",
    speed: { walk: 30, climb: 30 },
    abilityScores: { str: 3, dex: 16, con: 8, int: 2, wis: 12, cha: 3 },
    skills: { "Acrobatics": 5, "Perception": 3, "Stealth": 5 },
    senses: { darkvision: 60, passivePerception: 13 },
    languages: [],
    cr: "0",
    xp: 10,
    proficiencyBonus: 2,
    initiative: { modifier: 3, score: 13 },
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"],
    tokenSize: { x: 1, y: 1 }
  }
]

// ── Updates to existing creatures for 2024 PHB compliance ──

const updates = {
  "bat": {
    initiative: { modifier: 2, score: 12 },
    traits: [], // 2024 PHB Bat has no traits
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"]
  },
  "brown-bear": {
    acType: undefined, // No longer "Natural Armor"
    hp: 22,
    hitDice: "3d10+6",
    speed: { walk: 40, climb: 30, swim: 30 },
    abilityScores: { str: 17, dex: 12, con: 15, int: 2, wis: 13, cha: 7 },
    senses: { darkvision: 60, passivePerception: 13 },
    initiative: { modifier: 1, score: 11 },
    traits: [], // Removed Keen Smell
    actions: [
      {
        name: "Multiattack",
        description: "The bear makes one Bite attack and one Claw attack.",
        multiattackActions: ["Bite", "Claw"]
      },
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d8+3",
        damageType: "Piercing"
      },
      {
        name: "Claw",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Slashing damage, and the target has the Prone condition if it is Huge or smaller.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d4+3",
        damageType: "Slashing"
      }
    ],
    tags: ["beast", "wild-shape"]
  },
  "cat": {
    speed: { walk: 40, climb: 40 },
    skills: { "Perception": 3, "Stealth": 4 },
    senses: { darkvision: 60, passivePerception: 13 },
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Jumper",
        description: "The cat's jump distance is determined using its Dexterity rather than its Strength."
      }
    ],
    actions: [
      {
        name: "Scratch",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 1 Slashing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Slashing"
      }
    ],
    tags: ["familiar"]
  },
  "dire-wolf": {
    acType: undefined,
    hp: 22,
    hitDice: "3d10+6",
    skills: { "Perception": 5, "Stealth": 4 },
    senses: { darkvision: 60, passivePerception: 15 },
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Pack Tactics",
        description: "The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 8 (1d10 + 3) Piercing damage, and the target has the Prone condition if it is Huge or smaller.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d10+3",
        damageType: "Piercing"
      }
    ],
    tags: ["beast", "wild-shape"]
  },
  "giant-spider": {
    skills: { "Perception": 4, "Stealth": 7 },
    senses: { darkvision: 60, passivePerception: 14 },
    initiative: { modifier: 3, score: 13 },
    traits: [
      {
        name: "Spider Climb",
        description: "The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check."
      },
      {
        name: "Web Walker",
        description: "The spider ignores movement restrictions caused by webs, and it knows the location of any other creature in contact with the same web."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d8+3",
        damageType: "Piercing",
        additionalDamage: "2d6 Poison"
      },
      {
        name: "Web",
        description: "Dexterity Saving Throw: DC 13, one creature the spider can see within 60 feet (Recharge 5-6). Failure: The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).",
        saveDC: 13,
        saveAbility: "DEX",
        recharge: "5-6"
      }
    ],
    tags: ["beast", "wild-shape"]
  },
  "imp": {
    hp: 21,
    hitDice: "6d4+6",
    subtype: "Devil",
    skills: { "Deception": 4, "Insight": 3, "Stealth": 5 },
    resistances: ["Cold"],
    damageImmunities: ["Fire", "Poison"],
    conditionImmunities: ["Poisoned"],
    initiative: { modifier: 3, score: 13 },
    traits: [
      {
        name: "Devil's Sight",
        description: "Magical Darkness doesn't impede the imp's Darkvision."
      },
      {
        name: "Magic Resistance",
        description: "The imp has Advantage on saving throws against spells and other magical effects."
      }
    ],
    actions: [
      {
        name: "Sting",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Piercing",
        additionalDamage: "2d6 Poison"
      },
      {
        name: "Invisibility",
        description: "The imp casts Invisibility on itself, requiring no spell components and using Charisma as the spellcasting ability."
      },
      {
        name: "Shape-Shift",
        description: "The imp shape-shifts to resemble a rat (Speed 20 ft.), a raven (20 ft., Fly 60 ft.), or a spider (20 ft., Climb 20 ft.), or it returns to its true form. Its statistics are the same in each form, except for its Speed. Any equipment it's wearing or carrying isn't transformed."
      }
    ],
    tags: ["familiar", "chain-pact"]
  },
  "pseudodragon": {
    ac: 14,
    acType: undefined,
    hp: 10,
    hitDice: "3d4+3",
    skills: { "Perception": 5, "Stealth": 4 },
    senses: { blindsight: 10, darkvision: 60, passivePerception: 15 },
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Magic Resistance",
        description: "The pseudodragon has Advantage on saving throws against spells and other magical effects."
      }
    ],
    actions: [
      {
        name: "Multiattack",
        description: "The pseudodragon makes two Bite attacks.",
        multiattackActions: ["Bite", "Bite"]
      },
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d4+2",
        damageType: "Piercing"
      },
      {
        name: "Sting",
        description: "Constitution Saving Throw: DC 12, one creature the pseudodragon can see within 5 feet. Failure: 5 (2d4 + 2) Poison damage, and the target has the Poisoned condition for 1 hour. Failure by 5 or More: The Poisoned target also has the Unconscious condition until it takes damage or another creature takes an action to shake it awake.",
        saveDC: 12,
        saveAbility: "CON",
        damageDice: "2d4+2",
        damageType: "Poison"
      }
    ],
    tags: ["familiar", "chain-pact"]
  },
  "quasit": {
    hp: 25,
    hitDice: "10d4",
    subtype: "Demon",
    resistances: ["Cold", "Fire", "Lightning"],
    initiative: { modifier: 3, score: 13 },
    traits: [
      {
        name: "Magic Resistance",
        description: "The quasit has Advantage on saving throws against spells and other magical effects."
      }
    ],
    actions: [
      {
        name: "Rend",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Slashing damage, and the target has the Poisoned condition until the start of the quasit's next turn.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d4+3",
        damageType: "Slashing"
      },
      {
        name: "Invisibility",
        description: "The quasit casts Invisibility on itself, requiring no spell components and using Charisma as the spellcasting ability."
      },
      {
        name: "Scare (1/Day)",
        description: "Wisdom Saving Throw: DC 10, one creature within 20 feet. Failure: The target has the Frightened condition. At the end of each of its turns, the target repeats the save, ending the effect on itself on a success. After 1 minute, it succeeds automatically.",
        saveDC: 10,
        saveAbility: "WIS"
      },
      {
        name: "Shape-Shift",
        description: "The quasit shape-shifts to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its statistics are the same in each form, except for its Speed. Any equipment it's wearing or carrying isn't transformed."
      }
    ],
    tags: ["familiar", "chain-pact"]
  },
  "rat": {
    speed: { walk: 20, climb: 20 },
    skills: { "Perception": 2 },
    senses: { darkvision: 30, passivePerception: 12 },
    initiative: { modifier: 0, score: 10 },
    traits: [
      {
        name: "Agile",
        description: "The rat doesn't provoke Opportunity Attacks when it moves out of an enemy's reach."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +2, reach 5 ft. Hit: 1 Piercing damage.",
        attackType: "melee",
        toHit: 2,
        reach: 5,
        targets: 1,
        damageDice: "1",
        damageType: "Piercing"
      }
    ],
    tags: ["familiar"]
  },
  "riding-horse": {
    ac: 11,
    abilityScores: { str: 16, dex: 13, con: 12, int: 2, wis: 11, cha: 7 },
    initiative: { modifier: 1, score: 11 },
    actions: [
      {
        name: "Hooves",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Bludgeoning damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d8+3",
        damageType: "Bludgeoning"
      }
    ],
    tags: ["mount"]
  },
  "skeleton": {
    abilityScores: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 },
    initiative: { modifier: 3, score: 13 },
    gear: ["Shortbow", "Shortsword"],
    actions: [
      {
        name: "Shortsword",
        description: "Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage.",
        attackType: "melee",
        toHit: 5,
        reach: 5,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Piercing"
      },
      {
        name: "Shortbow",
        description: "Ranged Attack Roll: +5, range 80/320 ft. Hit: 6 (1d6 + 3) Piercing damage.",
        attackType: "ranged",
        toHit: 5,
        rangeNormal: 80,
        rangeLong: 320,
        targets: 1,
        damageDice: "1d6+3",
        damageType: "Piercing"
      }
    ],
    tags: ["undead"]
  },
  "wolf": {
    ac: 12,
    acType: undefined,
    abilityScores: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skills: { "Perception": 5, "Stealth": 4 },
    senses: { darkvision: 60, passivePerception: 15 },
    initiative: { modifier: 2, score: 12 },
    traits: [
      {
        name: "Pack Tactics",
        description: "The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition."
      }
    ],
    actions: [
      {
        name: "Bite",
        description: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage, and the target has the Prone condition if it is Medium or smaller.",
        attackType: "melee",
        toHit: 4,
        reach: 5,
        targets: 1,
        damageDice: "1d6+2",
        damageType: "Piercing"
      }
    ],
    tags: ["beast", "wild-shape"]
  },
  "zombie": {
    hp: 15,
    hitDice: "2d8+6",
    initiative: { modifier: -2, score: 8 },
    traits: [
      {
        name: "Undead Fortitude",
        description: "If damage reduces the zombie to 0 Hit Points, it must make a Constitution saving throw with a DC of 5 plus the damage taken unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead."
      }
    ],
    tags: ["undead"]
  }
}

// ── Apply changes ──

// Add new creatures
let added = 0
for (const creature of newCreatures) {
  if (!byId.has(creature.id)) {
    existing.push(creature)
    added++
  }
}

// Update existing creatures
let updated = 0
for (const [id, patch] of Object.entries(updates)) {
  const monster = byId.get(id)
  if (!monster) {
    console.log(`WARNING: Cannot find ${id} to update`)
    continue
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete monster[key]
    } else {
      monster[key] = value
    }
  }
  updated++
}

// Sort alphabetically by name
existing.sort((a, b) => a.name.localeCompare(b.name))

// Write back
fs.writeFileSync(MONSTERS_PATH, JSON.stringify(existing, null, 2))

console.log(`Done! Added ${added} new creatures, updated ${updated} existing.`)
console.log(`Total creatures: ${existing.length}`)
