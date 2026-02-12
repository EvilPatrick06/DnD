import type { StateCreator } from 'zustand'
import type { AbilityName } from '../../../types/character-common'
import type { Character5e } from '../../../types/character-5e'
import type { CharacterPf2e } from '../../../types/character-pf2e'
import type { ProficiencyRank } from '../../../types/character-pf2e'
import { is5eCharacter, isPf2eCharacter } from '../../../types/character'
import type { BuilderState, SaveSliceState, AbilityScoreMethod } from '../types'
import { generate5eBuildSlots } from '../../../services/build-tree-5e'
import { generatePf2eBuildSlots } from '../../../services/build-tree-pf2e'
import type { SpellEntry } from '../../../types/character-common'
import { load5eRaces, load5eClasses, load5eBackgrounds, loadPf2eAncestries, loadPf2eClasses, loadPf2eBackgrounds, loadJson } from '../../../services/data-provider'
import { calculate5eStats } from '../../../services/stat-calculator-5e'
import { calculatePf2eStats } from '../../../services/stat-calculator-pf2e'
import { populateSkills5e, getSpellsFromTraits } from '../../../services/auto-populate-5e'
import { populateSkillsPf2e } from '../../../services/auto-populate-pf2e'

interface EquipmentArmorData {
  name: string
  category: string
  baseAC: number
  dexBonus: boolean
  dexBonusMax: number | null
  stealthDisadvantage: boolean
  strengthRequirement?: number
}

interface EquipmentWeaponData5e {
  name: string
  category: string
  damage: string
  damageType: string
  weight: number
  properties: string[]
  cost: string
}

interface EquipmentWeaponDataPf2e {
  id: string
  name: string
  category: string
  group: string
  damage: string
  damageType: string
  hands: string
  range: string | null
  bulk: string
  price: string
  traits: string[]
}

interface EquipmentFileData {
  armor?: EquipmentArmorData[]
  weapons?: EquipmentWeaponData5e[]
}

interface EquipmentFileDataPf2e {
  weapons?: EquipmentWeaponDataPf2e[]
}

async function buildArmorFromEquipment5e(
  equipment: Array<{ name: string; quantity: number }>
): Promise<import('../../../types/character-common').ArmorEntry[]> {
  try {
    const eqData = await loadJson<EquipmentFileData>('./data/5e/equipment.json')
    const armorData = eqData.armor ?? []
    const result: import('../../../types/character-common').ArmorEntry[] = []

    for (const item of equipment) {
      const nameLC = item.name.toLowerCase()
      const match = armorData.find((a) => nameLC.includes(a.name.toLowerCase()))
      if (match) {
        result.push({
          id: crypto.randomUUID(),
          name: match.name,
          acBonus: match.category === 'Shield' ? match.baseAC : match.baseAC - 10,
          equipped: result.filter((r) => r.type === (match.category === 'Shield' ? 'shield' : 'armor')).length === 0,
          type: match.category === 'Shield' ? 'shield' : 'armor',
          category: match.category.toLowerCase().replace(' armor', ''),
          dexCap: match.dexBonusMax,
          stealthDisadvantage: match.stealthDisadvantage,
          strength: match.strengthRequirement
        })
      }
    }
    return result
  } catch {
    return []
  }
}

async function buildWeaponsFromEquipment5e(
  equipment: Array<{ name: string; quantity: number }>
): Promise<import('../../../types/character-common').WeaponEntry[]> {
  try {
    const eqData = await loadJson<EquipmentFileData>('./data/5e/equipment.json')
    const weaponData = eqData.weapons ?? []
    const result: import('../../../types/character-common').WeaponEntry[] = []

    for (const item of equipment) {
      const nameLC = item.name.toLowerCase()
      const match = weaponData.find((w) => nameLC.includes(w.name.toLowerCase()))
      if (match) {
        result.push({
          id: crypto.randomUUID(),
          name: match.name,
          damage: match.damage,
          damageType: match.damageType,
          attackBonus: 0,
          properties: match.properties ?? [],
          proficient: true
        })
      }
    }
    return result
  } catch {
    return []
  }
}

async function buildWeaponsFromEquipmentPf2e(
  equipment: Array<{ name: string; quantity: number }>
): Promise<import('../../../types/character-common').WeaponEntry[]> {
  try {
    const eqData = await loadJson<EquipmentFileDataPf2e>('./data/pf2e/equipment.json')
    const weaponData = eqData.weapons ?? []
    const result: import('../../../types/character-common').WeaponEntry[] = []

    for (const item of equipment) {
      const nameLC = item.name.toLowerCase()
      const match = weaponData.find((w) => nameLC.includes(w.name.toLowerCase()))
      if (match) {
        result.push({
          id: match.id || crypto.randomUUID(),
          name: match.name,
          damage: match.damage,
          damageType: match.damageType,
          attackBonus: 0,
          properties: match.traits ?? [],
          hands: match.hands,
          group: match.group,
          bulk: match.bulk,
          range: match.range ?? undefined,
          proficient: true
        })
      }
    }
    return result
  } catch {
    return []
  }
}

type SetState = (partial: Partial<BuilderState>) => void
type GetState = () => BuilderState

function loadCharacterForEdit5e(character: Character5e, set: SetState, get: GetState): void {
  const slots = generate5eBuildSlots(character.level)
  const raceSlot = slots.find((s) => s.category === 'ancestry')
  if (raceSlot && character.buildChoices.raceId) {
    raceSlot.selectedId = character.buildChoices.raceId
    raceSlot.selectedName = character.race
  }
  const classSlot = slots.find((s) => s.category === 'class')
  if (classSlot && character.buildChoices.classId) {
    classSlot.selectedId = character.buildChoices.classId
    classSlot.selectedName = character.classes[0]?.name ?? null
  }
  const bgSlot = slots.find((s) => s.category === 'background')
  if (bgSlot && character.buildChoices.backgroundId) {
    bgSlot.selectedId = character.buildChoices.backgroundId
    bgSlot.selectedName = character.background
  }
  const abilitySlot = slots.find((s) => s.id === 'ability-scores')
  if (abilitySlot) {
    abilitySlot.selectedId = 'confirmed'
    abilitySlot.selectedName = Object.values(character.abilityScores).join('/')
  }
  const skillSlot = slots.find((s) => s.id === 'skill-choices')
  if (skillSlot) {
    skillSlot.selectedId = 'confirmed'
    skillSlot.selectedName = `${character.buildChoices.selectedSkills.length} selected`
  }

  // Restore subclass selection
  if (character.buildChoices.subclassId) {
    const subclassSlot = slots.find((s) => s.id.includes('subclass'))
    if (subclassSlot) {
      subclassSlot.selectedId = character.buildChoices.subclassId
      subclassSlot.selectedName = character.classes[0]?.subclass ?? null
    }
  }

  // Restore ASI selections
  const restoredAsiSelections: Record<string, AbilityName[]> = {}
  if (character.buildChoices.asiChoices) {
    for (const [slotId, abilities] of Object.entries(character.buildChoices.asiChoices)) {
      const asiSlot = slots.find((s) => s.id === slotId)
      if (asiSlot) {
        asiSlot.selectedId = 'confirmed'
        asiSlot.selectedName = abilities.join(', ')
      }
      restoredAsiSelections[slotId] = abilities as AbilityName[]
    }
  }

  // Restore selected spell IDs from knownSpells (excluding racial spells which have 'racial-' prefix)
  const restoredSpellIds = (character.knownSpells ?? [])
    .filter((s) => !s.id.startsWith('racial-'))
    .map((s) => s.id)

  set({
    phase: 'building',
    gameSystem: 'dnd5e',
    buildSlots: slots,
    selectionModal: null,
    activeTab: 'details',
    targetLevel: character.level,
    characterName: character.name,
    abilityScores: character.abilityScores,
    abilityScoreMethod: (character.buildChoices.abilityScoreMethod as AbilityScoreMethod) || 'custom',
    selectedSkills: character.buildChoices.selectedSkills,
    editingCharacterId: character.id,
    asiSelections: restoredAsiSelections,
    speciesAbilityBonuses: character.buildChoices.speciesAbilityBonuses ?? {},
    chosenLanguages: character.buildChoices.chosenLanguages ?? [],
    selectedSpellIds: restoredSpellIds,
    iconType: character.iconPreset ? 'preset' : character.portraitPath ? 'custom' : 'letter',
    iconPreset: character.iconPreset ?? '',
    iconCustom: character.portraitPath ?? '',
    raceLanguages: character.proficiencies.languages ?? [],
    currency: {
      pp: character.treasure.pp,
      gp: character.treasure.gp,
      sp: character.treasure.sp,
      cp: character.treasure.cp
    },
    classEquipment: character.equipment.map((e) => ({ ...e, source: e.source || 'existing' })),
    raceSpeed: character.speed,
    characterGender: character.details?.gender ?? '',
    characterDeity: character.details?.deity ?? '',
    characterAge: character.details?.age ?? '',
    characterNotes: character.notes ?? '',
    heroPoints: character.heroPoints ?? 0,
    pets: character.pets ?? [],
    conditions: character.conditions ?? []
  })

  // Re-derive data from SRD
  Promise.all([load5eRaces(), load5eClasses(), load5eBackgrounds()]).then(([races, classes, bgs]) => {
    const race = races.find((r) => r.id === character.buildChoices.raceId)
    const cls = classes.find((c) => c.id === character.buildChoices.classId)
    const bg = bgs.find((b) => b.id === character.buildChoices.backgroundId)
    const updates: Partial<BuilderState> = {}
    if (race) {
      updates.raceLanguages = race.languages
      updates.raceExtraLangCount = race.traits.filter((t) => t.name === 'Extra Language').length
      updates.raceSize = race.size
      updates.raceSpeed = race.speed
      updates.raceTraits = race.traits
      updates.raceProficiencies = race.proficiencies ?? []
    }
    if (cls) {
      const current = get().classEquipment
      const shopItems = current.filter((e: { source?: string }) => e.source === 'shop' || e.source === 'existing')
      const startingNames = new Set(cls.startingEquipment.map((e: { name: string }) => e.name))
      const keptShop = shopItems.filter((e: { name: string }) => !startingNames.has(e.name))
        .map((e: { name: string; quantity: number }) => ({ ...e, source: 'shop' }))
      updates.classEquipment = [
        ...cls.startingEquipment.map((e: { name: string; quantity: number }) => ({ ...e, source: cls.name })),
        ...keptShop
      ]
    }
    if (bg) {
      updates.bgLanguageCount = bg.proficiencies.languages
      updates.bgEquipment = bg.equipment.map((e: { name: string; quantity: number }) => ({ ...e, source: bg.name }))
    }
    set(updates)
  })
}

function loadCharacterForEditPf2e(character: CharacterPf2e, set: SetState, get: GetState): void {
  const slots = generatePf2eBuildSlots(character.level)

  // Restore foundation selections
  const ancestrySlot = slots.find((s) => s.category === 'ancestry')
  if (ancestrySlot && character.buildChoices.ancestryId) {
    ancestrySlot.selectedId = character.buildChoices.ancestryId
    ancestrySlot.selectedName = character.ancestryName
  }
  const heritageSlot = slots.find((s) => s.category === 'heritage')
  if (heritageSlot && character.buildChoices.heritageId) {
    heritageSlot.selectedId = character.buildChoices.heritageId
    heritageSlot.selectedName = character.heritageName
  }
  const classSlot = slots.find((s) => s.category === 'class')
  if (classSlot && character.buildChoices.classId) {
    classSlot.selectedId = character.buildChoices.classId
    classSlot.selectedName = character.className
  }
  const bgSlot = slots.find((s) => s.category === 'background')
  if (bgSlot && character.buildChoices.backgroundId) {
    bgSlot.selectedId = character.buildChoices.backgroundId
    bgSlot.selectedName = character.backgroundName
  }
  const abilitySlot = slots.find((s) => s.id === 'ability-scores')
  if (abilitySlot) {
    abilitySlot.selectedId = 'confirmed'
    abilitySlot.selectedName = Object.values(character.abilityScores).join('/')
  }
  const skillSlot = slots.find((s) => s.id === 'skill-choices')
  if (skillSlot) {
    skillSlot.selectedId = 'confirmed'
    skillSlot.selectedName = `${character.skills.filter((s) => s.rank !== 'untrained').length} trained`
  }

  // Restore feat selections
  for (const feat of character.buildChoices.selectedAncestryFeats) {
    const slot = slots.find((s) => s.category === 'ancestry-feat' && s.level === feat.level && !s.selectedId)
    if (slot) { slot.selectedId = feat.featId; slot.selectedName = feat.featName }
  }
  for (const feat of character.buildChoices.selectedClassFeats) {
    const slot = slots.find((s) => s.category === 'class-feat' && s.level === feat.level && !s.selectedId)
    if (slot) { slot.selectedId = feat.featId; slot.selectedName = feat.featName }
  }
  for (const feat of character.buildChoices.selectedSkillFeats) {
    const slot = slots.find((s) => s.category === 'skill-feat' && s.level === feat.level && !s.selectedId)
    if (slot) { slot.selectedId = feat.featId; slot.selectedName = feat.featName }
  }
  for (const feat of character.buildChoices.selectedGeneralFeats) {
    const slot = slots.find((s) => s.category === 'general-feat' && s.level === feat.level && !s.selectedId)
    if (slot) { slot.selectedId = feat.featId; slot.selectedName = feat.featName }
  }

  // Restore selected spell IDs from knownSpells
  const restoredPf2eSpellIds = (character.knownSpells ?? []).map((s) => s.id)

  // Restore ability boost selections
  const restoredPf2eAsiSelections: Record<string, AbilityName[]> = {}
  if (character.buildChoices.pf2eAbilityBoosts) {
    for (const boost of character.buildChoices.pf2eAbilityBoosts) {
      if (!restoredPf2eAsiSelections[boost.source]) {
        restoredPf2eAsiSelections[boost.source] = []
      }
      restoredPf2eAsiSelections[boost.source].push(boost.ability as AbilityName)

      // Mark the corresponding build slot as confirmed
      const boostSlot = slots.find((s) => s.id === boost.source)
      if (boostSlot && !boostSlot.selectedId) {
        boostSlot.selectedId = 'confirmed'
        boostSlot.selectedName = restoredPf2eAsiSelections[boost.source]
          .map((a) => `+1 ${a.slice(0, 3).toUpperCase()}`)
          .join(', ')
      }
    }
  }

  set({
    phase: 'building',
    gameSystem: 'pf2e',
    buildSlots: slots,
    selectionModal: null,
    activeTab: 'details',
    targetLevel: character.level,
    characterName: character.name,
    abilityScores: character.abilityScores,
    abilityScoreMethod: 'custom',
    selectedSkills: character.skills.filter((s) => s.rank !== 'untrained').map((s) => s.name),
    editingCharacterId: character.id,
    chosenLanguages: character.buildChoices.chosenLanguages ?? [],
    selectedSpellIds: restoredPf2eSpellIds,
    asiSelections: restoredPf2eAsiSelections,
    iconType: character.iconPreset ? 'preset' : character.portraitPath ? 'custom' : 'letter',
    iconPreset: character.iconPreset ?? '',
    iconCustom: character.portraitPath ?? '',
    raceLanguages: character.languages,
    currency: character.treasure,
    classEquipment: character.equipment.map((e) => ({ ...e, source: e.source || 'existing' })),
    raceSpeed: character.speed,
    raceSize: character.size,
    characterGender: character.details?.gender ?? '',
    characterDeity: character.details?.deity ?? '',
    characterAge: character.details?.age ?? '',
    characterNotes: character.notes ?? '',
    heroPoints: character.heroPoints ?? 0,
    pets: character.pets ?? [],
    conditions: character.conditions ?? [],
    pf2eAncestryHP: 0,
    pf2eClassHP: 0,
    pf2ePerceptionRank: character.perception,
    pf2eSaveRanks: { ...character.saves },
    pf2eKeyAbility: character.buildChoices.keyAbility,
    pf2eUnarmoredRank: character.defenses.unarmored
  })

  // Re-derive data from SRD
  Promise.all([loadPf2eAncestries(), loadPf2eClasses(), loadPf2eBackgrounds()]).then(([ancestries, classes, bgs]) => {
    const ancestry = ancestries.find((a) => a.id === character.buildChoices.ancestryId)
    const cls = classes.find((c) => c.id === character.buildChoices.classId)
    const updates: Partial<BuilderState> = {}
    if (ancestry) {
      updates.raceLanguages = ancestry.languages
      updates.raceSize = ancestry.size
      updates.raceSpeed = ancestry.speed
      updates.raceTraits = ancestry.traits
      updates.pf2eAncestryHP = ancestry.hp
      updates.pf2eSpecialAbilities = ancestry.specialAbilities ?? []
    }
    if (cls) {
      updates.pf2eClassHP = cls.hp
      updates.pf2ePerceptionRank = cls.perception
      updates.pf2eSaveRanks = cls.savingThrows
      updates.pf2eKeyAbility = cls.keyAbility[0] ?? null
      updates.pf2eUnarmoredRank = cls.defenses?.unarmored ?? 'trained'
      updates.pf2eClassFeatures = cls.classFeatures ?? []
      const currentPf2e = get().classEquipment
      const pf2eShopItems = currentPf2e.filter((e: { source?: string }) => e.source === 'shop' || e.source === 'existing')
      const pf2eStartingNames = new Set((cls.startingEquipment ?? []).map((e: { name: string }) => e.name))
      const keptPf2eShop = pf2eShopItems.filter((e: { name: string }) => !pf2eStartingNames.has(e.name))
        .map((e: { name: string; quantity: number }) => ({ ...e, source: 'shop' }))
      updates.classEquipment = [
        ...(cls.startingEquipment ?? []).map((e: { name: string; quantity: number }) => ({ ...e, source: cls.name })),
        ...keptPf2eShop
      ]
    }
    set(updates)
  })
}

export const createSaveSlice: StateCreator<BuilderState, [], [], SaveSliceState> = (set, get) => ({
  loadCharacterForEdit: (character) => {
    if (is5eCharacter(character)) {
      loadCharacterForEdit5e(character, set, get)
    } else if (isPf2eCharacter(character)) {
      loadCharacterForEditPf2e(character, set, get)
    }
  },

  buildCharacter5e: async () => {
    const {
      buildSlots, characterName, abilityScores, selectedSkills,
      targetLevel, abilityScoreMethod, editingCharacterId,
      iconType, iconPreset, iconCustom,
      characterGender, characterDeity, characterAge, characterNotes,
      heroPoints, pets, conditions, speciesAbilityBonuses,
      selectedSpellIds
    } = get()

    const raceSlot = buildSlots.find((s) => s.category === 'ancestry')
    const classSlot = buildSlots.find((s) => s.category === 'class')
    const bgSlot = buildSlots.find((s) => s.category === 'background')

    const [races, classes, backgrounds] = await Promise.all([
      load5eRaces(),
      load5eClasses(),
      load5eBackgrounds()
    ])

    const subclassSlot = buildSlots.find((s) => s.id.includes('subclass'))

    const raceData = races.find((r) => r.id === raceSlot?.selectedId) ?? null
    const classData = classes.find((c) => c.id === classSlot?.selectedId) ?? null
    const bgData = backgrounds.find((b) => b.id === bgSlot?.selectedId) ?? null

    const raceForCalc = raceData
      ? { abilityBonuses: raceData.abilityBonuses as Partial<Record<AbilityName, number>>, speed: raceData.speed, size: raceData.size }
      : null
    const classForCalc = classData
      ? { hitDie: classData.hitDie, savingThrows: classData.savingThrows }
      : null

    const speciesBonuses = Object.keys(speciesAbilityBonuses).length > 0
      ? speciesAbilityBonuses as Partial<Record<AbilityName, number>>
      : undefined
    const stats = calculate5eStats(abilityScores, raceForCalc, classForCalc, targetLevel, speciesBonuses)
    const now = new Date().toISOString()

    // Gather all equipment: starting + background + shop-purchased items
    const startingEquipment = classData?.startingEquipment ?? []
    const bgEquipment = bgData?.equipment ?? []
    const shopEquipment = get().classEquipment.filter((e) => e.source === 'shop')
    const allEquipment = [
      ...startingEquipment.map((e) => ({ ...e, source: 'class' })),
      ...bgEquipment.map((e) => ({ ...e, source: 'background' })),
      ...shopEquipment.map((e) => ({ name: e.name, quantity: e.quantity, source: 'shop' }))
    ]

    // Look up existing character for preserving weapons on edit
    let existingChar5e: Character5e | undefined
    if (editingCharacterId) {
      const { useCharacterStore } = await import('../../useCharacterStore')
      existingChar5e = useCharacterStore.getState().characters.find(
        (c) => c.id === editingCharacterId
      ) as Character5e | undefined
    }

    const character: Character5e = {
      id: editingCharacterId ?? crypto.randomUUID(),
      gameSystem: 'dnd5e',
      campaignId: null,
      playerId: 'local',
      name: characterName || 'Unnamed Character',
      race: raceData?.name ?? 'Unknown',
      classes: classData
        ? [{
            name: classData.name,
            level: targetLevel,
            hitDie: classData.hitDie,
            subclass: subclassSlot?.selectedName ?? undefined
          }]
        : [],
      level: targetLevel,
      background: bgData?.name ?? 'Unknown',
      alignment: '',
      xp: 0,
      abilityScores: stats.abilityScores,
      hitPoints: { current: stats.maxHP, maximum: stats.maxHP, temporary: 0 },
      armorClass: stats.armorClass,
      initiative: stats.initiative,
      speed: stats.speed,
      details: {
        gender: characterGender || undefined,
        deity: characterDeity || undefined,
        age: characterAge || undefined
      },
      proficiencies: {
        weapons: classData?.proficiencies.weapons ?? [],
        armor: classData?.proficiencies.armor ?? [],
        tools: [
          ...(classData?.proficiencies.tools ?? []),
          ...(bgData?.proficiencies.tools ?? [])
        ],
        languages: [...(raceData?.languages ?? []), ...get().chosenLanguages],
        savingThrows: (classData?.savingThrows ?? []).map(
          (s) => s.toLowerCase() as AbilityName
        )
      },
      skills: populateSkills5e(selectedSkills),
      equipment: allEquipment,
      treasure: {
        cp: get().currency.cp,
        sp: get().currency.sp,
        ep: 0,
        gp: get().currency.gp,
        pp: get().currency.pp
      },
      features: raceData?.traits.map((t) => ({
        name: t.name,
        source: raceData.name,
        description: t.description
      })) ?? [],
      buildChoices: {
        raceId: raceSlot?.selectedId ?? '',
        classId: classSlot?.selectedId ?? '',
        subclassId: subclassSlot?.selectedId ?? undefined,
        backgroundId: bgSlot?.selectedId ?? '',
        selectedSkills,
        abilityScoreMethod,
        abilityScoreAssignments: { ...abilityScores },
        asiChoices: Object.keys(get().asiSelections).length > 0 ? { ...get().asiSelections } : undefined,
        chosenLanguages: get().chosenLanguages.length > 0 ? [...get().chosenLanguages] : undefined,
        speciesAbilityBonuses: Object.keys(speciesAbilityBonuses).length > 0 ? { ...speciesAbilityBonuses } : undefined
      },
      status: 'active',
      campaignHistory: [],
      backstory: '',
      notes: characterNotes,
      heroPoints,
      pets: [...pets],
      conditions: [...conditions],
      knownSpells: await (async () => {
        const racialSpells = raceData ? getSpellsFromTraits(raceData.traits, raceData.name) : []
        if (selectedSpellIds.length === 0) return racialSpells

        // Load spell data to convert IDs to SpellEntry objects
        try {
          const spellData: Array<{
            id: string; name: string; level: number; school?: string;
            castingTime?: string; castTime?: string; range?: string;
            duration?: string; description: string; concentration?: boolean;
            ritual?: boolean; components?: string; classes?: string[];
            traditions?: string[]; traits?: string[]; heightened?: Record<string, string>
          }> = await loadJson('./data/5e/spells.json')

          const selectedSpells: SpellEntry[] = []
          for (const id of selectedSpellIds) {
            const raw = spellData.find((s) => s.id === id)
            if (raw && !racialSpells.some((rs) => rs.name === raw.name)) {
              selectedSpells.push({
                id: raw.id,
                name: raw.name,
                level: raw.level,
                description: raw.description,
                castingTime: raw.castingTime || raw.castTime || '',
                range: raw.range || '',
                duration: raw.duration || '',
                components: typeof raw.components === 'string' ? raw.components : '',
                school: raw.school,
                concentration: raw.concentration,
                ritual: raw.ritual,
                traditions: raw.traditions,
                traits: raw.traits,
                heightened: raw.heightened,
                classes: raw.classes
              })
            }
          }
          return [...racialSpells, ...selectedSpells]
        } catch {
          return racialSpells
        }
      })(),
      preparedSpellIds: [],
      spellSlotLevels: {},
      classFeatures: [],
      weapons: editingCharacterId
        ? existingChar5e?.weapons ?? []
        : await buildWeaponsFromEquipment5e(allEquipment),
      armor: await buildArmorFromEquipment5e(allEquipment),
      feats: [],
      iconPreset: iconType === 'preset' ? iconPreset : undefined,
      portraitPath: iconType === 'custom' ? iconCustom : undefined,
      createdAt: now, // will be overwritten by existing value for edits
      updatedAt: now
    }

    return character
  },

  buildCharacterPf2e: async () => {
    const {
      buildSlots, characterName, abilityScores, selectedSkills, classMandatorySkills,
      targetLevel, editingCharacterId,
      iconType, iconPreset, iconCustom,
      pf2eAncestryHP, pf2eClassHP, pf2ePerceptionRank,
      pf2eSaveRanks, pf2eKeyAbility, pf2eUnarmoredRank,
      raceSpeed, raceSize, raceLanguages, chosenLanguages,
      pf2eClassFeatures,
      characterGender, characterDeity, characterAge, characterNotes,
      heroPoints, pets, conditions,
      selectedSpellIds,
      asiSelections
    } = get()

    const ancestrySlot = buildSlots.find((s) => s.category === 'ancestry')
    const heritageSlot = buildSlots.find((s) => s.category === 'heritage')
    const classSlot = buildSlots.find((s) => s.category === 'class')
    const bgSlot = buildSlots.find((s) => s.category === 'background')

    const [ancestries, classes, backgrounds] = await Promise.all([
      loadPf2eAncestries(),
      loadPf2eClasses(),
      loadPf2eBackgrounds()
    ])

    const ancestryData = ancestries.find((a) => a.id === ancestrySlot?.selectedId) ?? null
    const classData = classes.find((c) => c.id === classSlot?.selectedId) ?? null
    const bgData = backgrounds.find((b) => b.id === bgSlot?.selectedId) ?? null

    // Find heritage from the ancestry's heritages array
    let heritageName = heritageSlot?.selectedName ?? ''
    if (ancestryData && heritageSlot?.selectedId) {
      const heritage = ancestryData.heritages.find((h) => h.id === heritageSlot.selectedId)
      if (heritage) heritageName = heritage.name
    }

    const stats = calculatePf2eStats(
      abilityScores,
      targetLevel,
      pf2eAncestryHP || (ancestryData?.hp ?? 0),
      pf2eClassHP || (classData?.hp ?? 0),
      pf2ePerceptionRank || (classData?.perception ?? 'trained'),
      pf2eSaveRanks || (classData?.savingThrows ?? { fortitude: 'trained', reflex: 'trained', will: 'trained' }),
      pf2eKeyAbility || (classData?.keyAbility[0] ?? null),
      pf2eUnarmoredRank || (classData?.defenses?.unarmored ?? 'trained'),
      raceSpeed || (ancestryData?.speed ?? 25)
    )

    const now = new Date().toISOString()

    // Collect feat selections from build slots
    const ancestryFeats = buildSlots
      .filter((s) => s.category === 'ancestry-feat' && s.selectedId && s.selectedId !== 'confirmed')
      .map((s) => ({ level: s.level, featId: s.selectedId!, featName: s.selectedName ?? '' }))

    const classFeats = buildSlots
      .filter((s) => s.category === 'class-feat' && s.selectedId && s.selectedId !== 'confirmed')
      .map((s) => ({ level: s.level, featId: s.selectedId!, featName: s.selectedName ?? '' }))

    const skillFeats = buildSlots
      .filter((s) => s.category === 'skill-feat' && s.selectedId && s.selectedId !== 'confirmed')
      .map((s) => ({ level: s.level, featId: s.selectedId!, featName: s.selectedName ?? '' }))

    const generalFeats = buildSlots
      .filter((s) => s.category === 'general-feat' && s.selectedId && s.selectedId !== 'confirmed')
      .map((s) => ({ level: s.level, featId: s.selectedId!, featName: s.selectedName ?? '' }))

    // Gather all equipment: starting + shop-purchased items
    const pf2eStartingEquipment = classData?.startingEquipment ?? []
    const pf2eShopEquipment = get().classEquipment.filter((e) => e.source === 'shop')
    const allPf2eEquipment = [
      ...pf2eStartingEquipment.map((e) => ({ name: e.name, quantity: e.quantity, source: 'class' })),
      ...pf2eShopEquipment.map((e) => ({ name: e.name, quantity: e.quantity, source: 'shop' }))
    ]

    // Look up existing character for preserving weapons on edit
    let existingCharPf2e: CharacterPf2e | undefined
    if (editingCharacterId) {
      const { useCharacterStore } = await import('../../useCharacterStore')
      existingCharPf2e = useCharacterStore.getState().characters.find(
        (c) => c.id === editingCharacterId
      ) as CharacterPf2e | undefined
    }

    const character: CharacterPf2e = {
      id: editingCharacterId ?? crypto.randomUUID(),
      gameSystem: 'pf2e',
      campaignId: null,
      playerId: 'local',
      name: characterName || 'Unnamed Character',
      ancestryId: ancestrySlot?.selectedId ?? '',
      ancestryName: ancestryData?.name ?? ancestrySlot?.selectedName ?? 'Unknown',
      heritageId: heritageSlot?.selectedId ?? '',
      heritageName,
      backgroundId: bgSlot?.selectedId ?? '',
      backgroundName: bgData?.name ?? bgSlot?.selectedName ?? 'Unknown',
      classId: classSlot?.selectedId ?? '',
      className: classData?.name ?? classSlot?.selectedName ?? 'Unknown',
      level: targetLevel,
      xp: 0,
      abilityScores: stats.abilityScores,
      abilityBoosts: [],
      hitPoints: { current: stats.maxHP, maximum: stats.maxHP, temporary: 0 },
      armorClass: stats.armorClass,
      speed: stats.speed,
      size: raceSize || (ancestryData?.size ?? 'Medium'),
      saves: {
        fortitude: (pf2eSaveRanks?.fortitude ?? classData?.savingThrows?.fortitude ?? 'trained') as ProficiencyRank,
        reflex: (pf2eSaveRanks?.reflex ?? classData?.savingThrows?.reflex ?? 'trained') as ProficiencyRank,
        will: (pf2eSaveRanks?.will ?? classData?.savingThrows?.will ?? 'trained') as ProficiencyRank
      },
      perception: (pf2ePerceptionRank || classData?.perception || 'trained') as ProficiencyRank,
      classDC: (classData?.classDC ?? 'trained') as ProficiencyRank,
      skills: populateSkillsPf2e(selectedSkills, classMandatorySkills),
      attacks: {
        simple: (classData?.attacks?.simple ?? 'trained') as ProficiencyRank,
        martial: (classData?.attacks?.martial ?? 'untrained') as ProficiencyRank,
        unarmed: (classData?.attacks?.unarmed ?? 'trained') as ProficiencyRank
      },
      defenses: {
        unarmored: (classData?.defenses?.unarmored ?? 'trained') as ProficiencyRank,
        light: (classData?.defenses?.light ?? 'untrained') as ProficiencyRank,
        medium: (classData?.defenses?.medium ?? 'untrained') as ProficiencyRank,
        heavy: (classData?.defenses?.heavy ?? 'untrained') as ProficiencyRank
      },
      ancestryFeats,
      classFeats,
      skillFeats,
      generalFeats,
      classFeatures: pf2eClassFeatures.map((name, idx) => ({
        level: 1,
        name,
        description: ''
      })),
      equipment: allPf2eEquipment,
      treasure: {
        cp: get().currency.cp,
        sp: get().currency.sp,
        gp: get().currency.gp,
        pp: get().currency.pp
      },
      languages: [...(raceLanguages ?? []), ...chosenLanguages],
      knownSpells: await (async () => {
        if (selectedSpellIds.length === 0) return []
        try {
          const spellData: Array<{
            id: string; name: string; level: number;
            castTime?: string; range?: string; duration?: string;
            description: string; concentration?: boolean;
            traditions?: string[]; traits?: string[];
            heightened?: Record<string, string>
          }> = await loadJson('./data/pf2e/spells.json')

          const selectedSpells: SpellEntry[] = []
          for (const id of selectedSpellIds) {
            const raw = spellData.find((s) => s.id === id)
            if (raw) {
              selectedSpells.push({
                id: raw.id,
                name: raw.name,
                level: raw.level,
                description: raw.description,
                castingTime: raw.castTime || '',
                range: raw.range || '',
                duration: raw.duration || '',
                components: '',
                traditions: raw.traditions,
                traits: raw.traits,
                heightened: raw.heightened
              })
            }
          }
          return selectedSpells
        } catch {
          return []
        }
      })(),
      preparedSpellIds: [],
      spellSlotLevels: {},
      focusPoints: { current: 0, max: 0 },
      weapons: editingCharacterId
        ? existingCharPf2e?.weapons ?? []
        : await buildWeaponsFromEquipmentPf2e(allPf2eEquipment),
      armor: await buildArmorFromEquipment5e(allPf2eEquipment),
      details: {
        gender: characterGender || undefined,
        deity: characterDeity || undefined,
        age: characterAge || undefined
      },
      buildChoices: {
        ancestryId: ancestrySlot?.selectedId ?? '',
        heritageId: heritageSlot?.selectedId ?? '',
        backgroundId: bgSlot?.selectedId ?? '',
        classId: classSlot?.selectedId ?? '',
        keyAbility: (pf2eKeyAbility ?? classData?.keyAbility[0] ?? 'strength') as AbilityName,
        abilityBoosts: [],
        selectedAncestryFeats: ancestryFeats,
        selectedClassFeats: classFeats,
        selectedSkillFeats: skillFeats,
        selectedGeneralFeats: generalFeats,
        selectedSkillIncreases: [],
        chosenLanguages: chosenLanguages.length > 0 ? [...chosenLanguages] : undefined,
        pf2eAbilityBoosts: Object.keys(asiSelections).length > 0
          ? Object.entries(asiSelections).flatMap(([source, abilities]) =>
              abilities.map((ability) => ({ source, ability }))
            )
          : undefined
      },
      status: 'active',
      campaignHistory: [],
      notes: characterNotes,
      heroPoints,
      pets: [...pets],
      conditions: [...conditions],
      iconPreset: iconType === 'preset' ? iconPreset : undefined,
      portraitPath: iconType === 'custom' ? iconCustom : undefined,
      createdAt: now,
      updatedAt: now
    }

    return character
  }
})
