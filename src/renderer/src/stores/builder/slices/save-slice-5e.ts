import { getClassResources } from '../../../data/class-resources'
import { getSpeciesResources } from '../../../data/species-resources'
import { isWearableItem } from '../../../data/wearable-items'
import { getSpeciesSpellProgression, getSpellsFromTraits, populateSkills5e } from '../../../services/auto-populate-5e'
import { generate5eBuildSlots } from '../../../services/build-tree-5e'
import {
  load5eBackgrounds,
  load5eClasses,
  load5eMagicItems,
  load5eSpecies,
  load5eSubclasses,
  loadJson
} from '../../../services/data-provider'
import { computeSpellcastingInfo, getSlotProgression } from '../../../services/spell-data'
import { calculate5eStats, calculateArmorClass5e, getWildShapeMax } from '../../../services/stat-calculator-5e'
import type { Character5e, MagicItemEntry5e } from '../../../types/character-5e'
import type { AbilityName, SpellEntry } from '../../../types/character-common'
import type { MagicItemData } from '../../../types/data'
import { useCharacterStore } from '../../useCharacterStore'
import type { AbilityScoreMethod, BuilderState } from '../types'

function getSpeciesResistances(speciesId: string, subspeciesId?: string): string[] {
  const resistances: string[] = []
  switch (speciesId) {
    case 'aasimar':
      resistances.push('necrotic', 'radiant')
      break
    case 'dragonborn':
      switch (subspeciesId) {
        case 'black-dragonborn':
        case 'copper-dragonborn':
          resistances.push('acid')
          break
        case 'blue-dragonborn':
        case 'bronze-dragonborn':
          resistances.push('lightning')
          break
        case 'brass-dragonborn':
        case 'gold-dragonborn':
        case 'red-dragonborn':
          resistances.push('fire')
          break
        case 'green-dragonborn':
          resistances.push('poison')
          break
        case 'silver-dragonborn':
        case 'white-dragonborn':
          resistances.push('cold')
          break
      }
      break
    case 'dwarf':
      resistances.push('poison')
      break
    case 'tiefling':
      switch (subspeciesId) {
        case 'abyssal-tiefling':
          resistances.push('poison')
          break
        case 'chthonic-tiefling':
          resistances.push('necrotic')
          break
        case 'infernal-tiefling':
          resistances.push('fire')
          break
      }
      break
  }
  return resistances
}

function getSpeciesSenses(speciesId: string, subspeciesId?: string): string[] {
  switch (speciesId) {
    case 'aasimar':
    case 'dragonborn':
    case 'gnome':
    case 'tiefling':
      return ['Darkvision 60 ft']
    case 'dwarf':
    case 'orc':
      return ['Darkvision 120 ft']
    case 'elf':
      if (subspeciesId === 'drow') return ['Darkvision 120 ft']
      if (subspeciesId === 'high-elf' || subspeciesId === 'wood-elf') return ['Darkvision 60 ft']
      return ['Darkvision 60 ft']
    default:
      return []
  }
}

interface EquipmentArmorData {
  name: string
  category: string
  baseAC: number
  dexBonus: boolean
  dexBonusMax: number | null
  stealthDisadvantage: boolean
  strengthRequirement?: number
  description?: string
}

interface EquipmentWeaponData5e {
  name: string
  category: string
  damage: string
  damageType: string
  weight: number
  properties: string[]
  cost: string
  description?: string
}

interface GearDataItem {
  name: string
  description?: string
  cost?: string
  price?: string
}

interface EquipmentFileData {
  armor?: EquipmentArmorData[]
  weapons?: EquipmentWeaponData5e[]
  gear?: GearDataItem[]
}

type SetState = (partial: Partial<BuilderState>) => void
type GetState = () => BuilderState

export async function buildArmorFromEquipment5e(
  equipment: Array<{ name: string; quantity: number }>
): Promise<{ armor: import('../../../types/character-common').ArmorEntry[]; matchedNames: Set<string> }> {
  try {
    const eqData = await loadJson<EquipmentFileData>('./data/5e/equipment.json')
    const armorData = eqData.armor ?? []
    const result: import('../../../types/character-common').ArmorEntry[] = []
    const matchedNames = new Set<string>()

    for (const item of equipment) {
      const nameLC = item.name.toLowerCase()
      const match = armorData.find((a) => nameLC.includes(a.name.toLowerCase()))
      if (match) {
        matchedNames.add(item.name)
        result.push({
          id: crypto.randomUUID(),
          name: match.name,
          acBonus: match.category === 'Shield' ? match.baseAC : match.baseAC - 10,
          equipped: result.filter((r) => r.type === (match.category === 'Shield' ? 'shield' : 'armor')).length === 0,
          type: match.category === 'Shield' ? 'shield' : 'armor',
          description: match.description,
          category: match.category.toLowerCase().replace(' armor', ''),
          dexCap: match.dexBonusMax,
          stealthDisadvantage: match.stealthDisadvantage,
          strength: match.strengthRequirement
        })
      }
    }
    return { armor: result, matchedNames }
  } catch (error) {
    console.error('[SaveSlice5e] Failed to build armor from equipment:', error)
    return { armor: [], matchedNames: new Set() }
  }
}

export async function buildWeaponsFromEquipment5e(
  equipment: Array<{ name: string; quantity: number }>
): Promise<{ weapons: import('../../../types/character-common').WeaponEntry[]; matchedNames: Set<string> }> {
  try {
    const eqData = await loadJson<EquipmentFileData>('./data/5e/equipment.json')
    const weaponData = eqData.weapons ?? []
    const result: import('../../../types/character-common').WeaponEntry[] = []
    const matchedNames = new Set<string>()

    for (const item of equipment) {
      const nameLC = item.name.toLowerCase()
      const match = weaponData.find((w) => nameLC.includes(w.name.toLowerCase()))
      if (match) {
        matchedNames.add(item.name)
        result.push({
          id: crypto.randomUUID(),
          name: match.name,
          damage: match.damage,
          damageType: match.damageType,
          attackBonus: 0,
          properties: match.properties ?? [],
          description: match.description,
          proficient: true
        })
      }
    }
    return { weapons: result, matchedNames }
  } catch (error) {
    console.error('[SaveSlice5e] Failed to build weapons from equipment:', error)
    return { weapons: [], matchedNames: new Set() }
  }
}

export function loadCharacterForEdit5e(character: Character5e, set: SetState, get: GetState): void {
  const slots = generate5eBuildSlots(character.level, character.buildChoices.classId)
  const speciesSlot = slots.find((s) => s.category === 'ancestry')
  if (speciesSlot && character.buildChoices.speciesId) {
    speciesSlot.selectedId = character.buildChoices.speciesId
    speciesSlot.selectedName = character.species
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

  // Restore heritage (subspecies) selection — slots are injected after SRD data loads below

  // Restore subclass selection
  if (character.buildChoices.subclassId) {
    const subclassSlot = slots.find((s) => s.id.includes('subclass'))
    if (subclassSlot) {
      subclassSlot.selectedId = character.buildChoices.subclassId
      subclassSlot.selectedName = character.classes[0]?.subclass ?? null
    }
  }

  // Restore Epic Boon selection
  const epicBoonSlot = slots.find((s) => s.category === 'epic-boon')
  if (epicBoonSlot && character.feats) {
    // Try to match an existing feat against Epic Boon feats by ID
    const epicBoon = character.feats.find(
      (f) => f.id.startsWith('epic-boon-') || character.buildChoices.epicBoonId === f.id
    )
    if (epicBoon) {
      epicBoonSlot.selectedId = epicBoon.id
      epicBoonSlot.selectedName = epicBoon.name
    }
  }

  // Restore Primal Order selection
  const primalOrderSlot = slots.find((s) => s.category === 'primal-order')
  if (primalOrderSlot && character.buildChoices.primalOrderChoice) {
    primalOrderSlot.selectedId = character.buildChoices.primalOrderChoice
    primalOrderSlot.selectedName = character.buildChoices.primalOrderChoice === 'magician' ? 'Magician' : 'Warden'
  }

  // Restore Divine Order selection
  const divineOrderSlot = slots.find((s) => s.category === 'divine-order')
  if (divineOrderSlot && character.buildChoices.divineOrderChoice) {
    divineOrderSlot.selectedId = character.buildChoices.divineOrderChoice
    divineOrderSlot.selectedName =
      character.buildChoices.divineOrderChoice === 'protector' ? 'Protector' : 'Thaumaturge'
  }

  // Restore Fighting Style selection
  const fightingStyleSlot = slots.find((s) => s.category === 'fighting-style')
  if (fightingStyleSlot && character.buildChoices.fightingStyleId && character.feats) {
    const fsMatch = character.feats.find((f) => f.id === character.buildChoices.fightingStyleId)
    if (fsMatch) {
      fightingStyleSlot.selectedId = fsMatch.id
      fightingStyleSlot.selectedName = fsMatch.name
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

  // Restore expertise selections
  if (character.buildChoices.expertiseChoices) {
    for (const [slotId] of Object.entries(character.buildChoices.expertiseChoices)) {
      const expertiseSlot = slots.find((s) => s.id === slotId)
      if (expertiseSlot) {
        expertiseSlot.selectedId = 'confirmed'
        expertiseSlot.selectedName = character.buildChoices.expertiseChoices[slotId].join(', ')
      }
    }
  }

  // Restore selected spell IDs from knownSpells (excluding species spells which have 'species-' prefix)
  const restoredSpellIds = (character.knownSpells ?? []).filter((s) => !s.id.startsWith('species-')).map((s) => s.id)

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
    backgroundAbilityBonuses: character.buildChoices.backgroundAbilityBonuses ?? {},
    backgroundEquipmentChoice: character.buildChoices.backgroundEquipmentChoice ?? 'equipment',
    classEquipmentChoice: character.buildChoices.classEquipmentChoice ?? 'A',
    chosenLanguages: (character.buildChoices.chosenLanguages ?? []).filter(
      (l) => l !== 'Druidic' && l !== "Thieves' Cant"
    ),
    selectedSpellIds: restoredSpellIds,
    iconType: character.iconPreset ? 'preset' : character.portraitPath ? 'custom' : 'letter',
    iconPreset: character.iconPreset ?? '',
    iconCustom: character.portraitPath ?? '',
    speciesLanguages: character.proficiencies.languages ?? [],
    currency: {
      pp: character.treasure.pp,
      gp: character.treasure.gp,
      sp: character.treasure.sp,
      cp: character.treasure.cp
    },
    classEquipment: character.equipment.map((e) => ({ ...e, source: e.source || 'existing' })),
    speciesSpeed: character.speed,
    characterGender: character.details?.gender ?? '',
    characterDeity: character.details?.deity ?? '',
    characterAge: character.details?.age ?? '',
    characterHeight: character.details?.height ?? '',
    characterWeight: character.details?.weight ?? '',
    characterEyes: character.details?.eyes ?? '',
    characterHair: character.details?.hair ?? '',
    characterSkin: character.details?.skin ?? '',
    characterAppearance: character.details?.appearance ?? '',
    characterPersonality: character.details?.personality ?? '',
    characterIdeals: character.details?.ideals ?? '',
    characterBonds: character.details?.bonds ?? '',
    characterFlaws: character.details?.flaws ?? '',
    characterBackstory: character.backstory ?? '',
    characterNotes: character.notes ?? '',
    characterAlignment: character.alignment ?? '',
    versatileFeatId: character.buildChoices.versatileFeatId ?? null,
    speciesSpellcastingAbility: character.buildChoices.speciesSpellcastingAbility ?? null,
    keenSensesSkill: character.buildChoices.keenSensesSkill ?? null,
    classExtraLangCount:
      character.classes[0]?.name.toLowerCase() === 'rogue'
        ? 1
        : character.classes[0]?.name.toLowerCase() === 'ranger'
          ? 2
          : 0,
    blessedWarriorCantrips: character.buildChoices.blessedWarriorCantrips ?? [],
    druidicWarriorCantrips: character.buildChoices.druidicWarriorCantrips ?? [],
    pets: character.pets ?? [],
    conditions: character.conditions ?? [],
    currentHP: character.hitPoints.current < character.hitPoints.maximum ? character.hitPoints.current : null,
    tempHP: character.hitPoints.temporary ?? 0
  })

  // Re-derive data from SRD
  Promise.all([load5eSpecies(), load5eClasses(), load5eBackgrounds()]).catch((err) => {
    console.error('Failed to load SRD data for character edit:', err)
    return [[], [], []] as [Awaited<ReturnType<typeof load5eSpecies>>, Awaited<ReturnType<typeof load5eClasses>>, Awaited<ReturnType<typeof load5eBackgrounds>>]
  }).then(([speciesList, classes, bgs]) => {
    const speciesData = speciesList.find((r) => r.id === character.buildChoices.speciesId)
    const cls = classes.find((c) => c.id === character.buildChoices.classId)
    const bg = bgs.find((b) => b.id === character.buildChoices.backgroundId)
    const updates: Partial<BuilderState> = {}
    if (speciesData) {
      updates.speciesLanguages = speciesData.languages
      updates.speciesExtraLangCount = speciesData.traits.filter((t) => t.name === 'Extra Language').length
      updates.speciesExtraSkillCount = speciesData.traits.filter((t) => t.name === 'Skillful').length
      updates.speciesSize = Array.isArray(speciesData.size) ? '' : speciesData.size
      updates.speciesSpeed = speciesData.speed
      updates.speciesTraits = speciesData.traits
      updates.speciesProficiencies = speciesData.proficiencies ?? []

      // Restore heritage slot if species has subraces
      const hasSubraces = speciesData.subraces && speciesData.subraces.length > 0
      if (hasSubraces) {
        let currentSlots = get().buildSlots.filter((s) => s.id !== 'heritage')
        const ancestryIdx = currentSlots.findIndex((s) => s.category === 'ancestry')
        const heritageSlot = {
          id: 'heritage',
          label: `${speciesData.name} Lineage`,
          category: 'heritage' as const,
          level: 0,
          required: true,
          selectedId: character.buildChoices.subspeciesId ?? null,
          selectedName: character.subspecies ?? null,
          selectedDescription: null,
          selectedDetailFields: [] as Array<{ label: string; value: string }>
        }
        currentSlots = [...currentSlots.slice(0, ancestryIdx + 1), heritageSlot, ...currentSlots.slice(ancestryIdx + 1)]
        updates.buildSlots = currentSlots
        updates.heritageId = character.buildChoices.subspeciesId ?? null

        // Apply heritage trait modifications
        if (character.buildChoices.subspeciesId) {
          const subrace = speciesData.subraces?.find(
            (sr: { id: string }) => sr.id === character.buildChoices.subspeciesId
          )
          if (subrace) {
            const removedNames = new Set(subrace.traitModifications.remove)
            const baseTraits = speciesData.traits.filter((t: { name: string }) => !removedNames.has(t.name))
            updates.derivedSpeciesTraits = [...baseTraits, ...subrace.traitModifications.add]
            updates.speciesExtraLangCount = (updates.derivedSpeciesTraits as Array<{ name: string }>).filter(
              (t) => t.name === 'Extra Language'
            ).length
            updates.speciesSpeed = speciesData.speed + (subrace.speedModifier ?? 0)
          }
        }
      } else {
        updates.derivedSpeciesTraits = speciesData.traits
      }
    }
    if (cls) {
      const current = get().classEquipment
      const shopItems = current.filter((e: { source?: string }) => e.source === 'shop' || e.source === 'existing')
      const startingNames = new Set(cls.startingEquipment.map((e: { name: string }) => e.name))
      const keptShop = shopItems
        .filter((e: { name: string }) => !startingNames.has(e.name))
        .map((e: { name: string; quantity: number }) => ({ ...e, source: 'shop' }))
      updates.classEquipment = [
        ...cls.startingEquipment.map((e: { name: string; quantity: number }) => ({ ...e, source: cls.name })),
        ...keptShop
      ]
      // Re-derive maxSkills from class + custom background bonus + species extra skill
      const speciesExtraSkills = speciesData?.traits.filter((t: { name: string }) => t.name === 'Skillful').length ?? 0
      updates.maxSkills =
        cls.proficiencies.skills.numToChoose +
        (character.buildChoices.backgroundId === 'custom' ? 2 : 0) +
        speciesExtraSkills
    }
    if (bg) {
      updates.bgLanguageCount = bg.proficiencies.languages
      updates.bgEquipment = bg.equipment.map((e: { name: string; quantity: number }) => ({ ...e, source: bg.name }))
    }
    set(updates)
  })
}

export async function buildCharacter5e(get: GetState): Promise<Character5e> {
  const {
    buildSlots,
    characterName,
    abilityScores,
    selectedSkills,
    targetLevel,
    abilityScoreMethod,
    editingCharacterId,
    iconType,
    iconPreset,
    iconCustom,
    characterGender,
    characterDeity,
    characterAge,
    characterNotes,
    characterHeight,
    characterWeight,
    characterEyes,
    characterHair,
    characterSkin,
    characterAppearance,
    characterPersonality,
    characterIdeals,
    characterBonds,
    characterFlaws,
    characterBackstory,
    pets,
    conditions,
    backgroundAbilityBonuses,
    selectedSpellIds,
    currentHP,
    tempHP,
    speciesSize,
    characterAlignment,
    speciesProficiencies,
    versatileFeatId,
    speciesSpellcastingAbility,
    keenSensesSkill,
    blessedWarriorCantrips,
    druidicWarriorCantrips
  } = get()

  const speciesSlot = buildSlots.find((s) => s.category === 'ancestry')
  const classSlot = buildSlots.find((s) => s.category === 'class')
  const bgSlot = buildSlots.find((s) => s.category === 'background')

  const [speciesList, classes, backgrounds, featsData, cfData] = await Promise.all([
    load5eSpecies(),
    load5eClasses(),
    load5eBackgrounds(),
    loadJson<Array<{ id: string; name: string; category: string; description: string }>>(
      './data/5e/feats.json'
    ).catch(() => [] as Array<{ id: string; name: string; category: string; description: string }>),
    loadJson<Record<string, { features: Array<{ level: number; name: string; description: string }> }>>(
      './data/5e/class-features.json'
    ).catch(
      (): Record<string, { features: Array<{ level: number; name: string; description: string }> }> => ({})
    )
  ])

  const subclassSlot = buildSlots.find((s) => s.id.includes('subclass'))

  const speciesData = speciesList.find((r) => r.id === speciesSlot?.selectedId) ?? null
  const classData = classes.find((c) => c.id === classSlot?.selectedId) ?? null
  const bgData = backgrounds.find((b) => b.id === bgSlot?.selectedId) ?? null

  const speciesForCalc = speciesData
    ? {
        abilityBonuses: speciesData.abilityBonuses as Partial<Record<AbilityName, number>>,
        speed: speciesData.speed,
        size: Array.isArray(speciesData.size) ? speciesData.size[0] : speciesData.size
      }
    : null
  const classForCalc = classData ? { hitDie: classData.hitDie, savingThrows: classData.savingThrows } : null

  const speciesBonuses =
    Object.keys(backgroundAbilityBonuses).length > 0
      ? (backgroundAbilityBonuses as Partial<Record<AbilityName, number>>)
      : undefined

  // Look up existing character for preserving weapons on edit
  let existingChar5e: Character5e | undefined
  if (editingCharacterId) {
    existingChar5e = useCharacterStore.getState().characters.find((c) => c.id === editingCharacterId) as
      | Character5e
      | undefined
  }

  // Collect feats for HP bonus calculation (origin feat + existing feats)
  const builderFeats: Array<{ id: string }> = []
  if (existingChar5e?.feats) {
    for (const f of existingChar5e.feats) {
      builderFeats.push({ id: f.id })
    }
  }

  // Draconic Resilience HP bonus: pass sorcerer level if draconic subclass is selected
  const isDraconicForHP = classSlot?.selectedId === 'sorcerer' && subclassSlot?.selectedId === 'draconic-sorcery'
  const draconicSorcererLevelForHP = isDraconicForHP ? targetLevel : undefined

  const stats = calculate5eStats(
    abilityScores,
    speciesForCalc,
    classForCalc,
    targetLevel,
    speciesBonuses,
    speciesSlot?.selectedId,
    builderFeats,
    draconicSorcererLevelForHP
  )
  const now = new Date().toISOString()

  // Compute spellcasting info
  const classId = classSlot?.selectedId ?? ''
  const subclassId = subclassSlot?.selectedId ?? undefined
  const spellcastingInfo = computeSpellcastingInfo(
    [{ classId, subclassId, level: targetLevel }],
    stats.abilityScores,
    targetLevel,
    classId,
    subclassId
  )

  // featsData already loaded in parallel above

  // Resolve origin feat from background
  let originFeat: { id: string; name: string; description: string } | null = null
  if (bgData?.originFeat) {
    const baseName = bgData.originFeat.replace(/\s*\(.*\)$/, '')
    const match = featsData.find((f) => f.name === baseName)
    if (match) {
      originFeat = { id: match.id, name: bgData.originFeat, description: match.description }
    }
  }

  // cfData already loaded in parallel above
  let creationClassFeatures: Array<{ level: number; name: string; source: string; description: string }> = []
  if (classData) {
    const classId = classSlot?.selectedId ?? ''
    const classCF = cfData[classId]
    if (classCF) {
      creationClassFeatures = classCF.features
        .filter((f) => f.level >= 1 && f.level <= targetLevel)
        .map((f) => ({ level: f.level, name: f.name, source: classData.name, description: f.description }))
    }
  }

  // Gather all equipment: starting + background + shop-purchased items
  const classEquipmentChoice = get().classEquipmentChoice || 'A'
  const classEqOptions = classData?.startingEquipmentOptions
  const startingEquipment = classEqOptions?.[classEquipmentChoice]
    ? classEqOptions[classEquipmentChoice].equipment
    : (classData?.startingEquipment ?? [])
  const classOptionGold = classEqOptions?.[classEquipmentChoice] ? classEqOptions[classEquipmentChoice].gold : 0
  const bgEquipmentChoice = get().backgroundEquipmentChoice ?? 'equipment'
  // Use builder store's bgEquipment (may have variant edits like Gaming Set → Gaming Set (Dice))
  const storeBgEquipment = get().bgEquipment
  const bgEquipment =
    bgEquipmentChoice === 'gold' ? [] : storeBgEquipment.length > 0 ? storeBgEquipment : (bgData?.equipment ?? [])
  const shopEquipment = get().classEquipment.filter((e) => e.source === 'shop' || e.source === 'trinket')
  const allEquipment = [
    ...startingEquipment.map((e: { name: string; quantity: number }) => ({ ...e, source: 'class' })),
    ...bgEquipment.map((e) => ({ ...e, source: 'background' })),
    ...shopEquipment.map((e) => ({ name: e.name, quantity: e.quantity, source: 'shop' }))
  ]

  // Build weapons and armor, get matched names to filter from equipment
  const weaponBuildResult = editingCharacterId
    ? {
        weapons: existingChar5e?.weapons ?? [],
        matchedNames: new Set(existingChar5e?.weapons?.map((w) => w.name) ?? [])
      }
    : await buildWeaponsFromEquipment5e(allEquipment)
  const armorBuildResult = await buildArmorFromEquipment5e(allEquipment)

  // Build wearable items as clothing armor entries
  const eqDataForGear = await loadJson<EquipmentFileData>('./data/5e/equipment.json').catch(() => ({
    gear: [] as GearDataItem[]
  }))
  const gearData = (eqDataForGear as { gear?: GearDataItem[] }).gear ?? []
  const wearableArmor: import('../../../types/character-common').ArmorEntry[] = []
  const wearableMatchedNames = new Set<string>()
  for (const item of allEquipment) {
    if (weaponBuildResult.matchedNames.has(item.name)) continue
    if (armorBuildResult.matchedNames.has(item.name)) continue
    if (isWearableItem(item.name)) {
      wearableMatchedNames.add(item.name)
      const gearMatch = gearData.find((g) => g.name.toLowerCase() === item.name.toLowerCase())
      wearableArmor.push({
        id: crypto.randomUUID(),
        name: item.name,
        acBonus: 0,
        equipped: false,
        type: 'clothing',
        description: gearMatch?.description
      })
    }
  }

  // Filter equipment to exclude items that became weapons, armor, or wearables
  const excludedNames = new Set([
    ...weaponBuildResult.matchedNames,
    ...armorBuildResult.matchedNames,
    ...wearableMatchedNames
  ])

  // Look up descriptions for remaining equipment items from gear database
  const filteredEquipment = allEquipment
    .filter((item) => !excludedNames.has(item.name))
    .map((item) => {
      const gearMatch = gearData.find((g) => g.name.toLowerCase() === item.name.toLowerCase())
      return { ...item, description: gearMatch?.description }
    })

  // Resolve magic items from builder selections
  const selectedMagicItemEntries = get().selectedMagicItems
  let magicItems: MagicItemEntry5e[] = existingChar5e?.magicItems ?? []
  if (selectedMagicItemEntries.some((m) => m.itemId)) {
    const allMagicItemData = await load5eMagicItems().catch(() => [] as MagicItemData[])
    magicItems = selectedMagicItemEntries
      .filter((m) => m.itemId)
      .map((m) => {
        const data = allMagicItemData.find((d) => d.id === m.itemId)
        return {
          id: m.itemId,
          name: data?.name ?? m.itemName,
          rarity: (data?.rarity ?? m.slotRarity) as MagicItemEntry5e['rarity'],
          type: data?.type ?? 'wondrous',
          attunement: data?.attunement ?? false,
          description: data?.description ?? ''
        }
      })
  }

  const character: Character5e = {
    id: editingCharacterId ?? crypto.randomUUID(),
    gameSystem: 'dnd5e',
    campaignId: existingChar5e?.campaignId ?? null,
    playerId: existingChar5e?.playerId ?? 'local',
    name: characterName || 'Unnamed Character',
    species: speciesData?.name ?? 'Unknown',
    subspecies: (() => {
      const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
      return heritageSlot?.selectedName ?? existingChar5e?.subspecies ?? undefined
    })(),
    classes: classData
      ? [
          {
            name: classData.name,
            level: targetLevel,
            hitDie: classData.hitDie,
            subclass: subclassSlot?.selectedName ?? undefined
          }
        ]
      : [],
    level: targetLevel,
    background: bgData?.name ?? 'Unknown',
    alignment: characterAlignment || existingChar5e?.alignment || '',
    xp: existingChar5e?.xp ?? 0,
    levelingMode: existingChar5e?.levelingMode ?? 'milestone',
    abilityScores: stats.abilityScores,
    hitPoints: {
      current: Math.min(currentHP ?? existingChar5e?.hitPoints?.current ?? stats.maxHP, stats.maxHP),
      maximum: stats.maxHP,
      temporary: tempHP || existingChar5e?.hitPoints?.temporary || 0
    },
    hitDice: existingChar5e?.hitDice ?? [{ current: targetLevel, maximum: targetLevel, dieType: classData?.hitDie ?? 8 }],
    armorClass: calculateArmorClass5e({
      dexMod: stats.abilityModifiers.dexterity,
      armor: [...armorBuildResult.armor, ...wearableArmor],
      classNames: classData ? [classData.name] : [],
      conMod: stats.abilityModifiers.constitution,
      wisMod: stats.abilityModifiers.wisdom,
      draconicSorcererLevel: draconicSorcererLevelForHP
    }),
    initiative: stats.initiative,
    speed: (() => {
      const base = get().speciesSpeed || stats.speed
      const rangerLevel = classId === 'ranger' ? targetLevel : 0
      return rangerLevel >= 6 ? base + 10 : base
    })(),
    speeds: (() => {
      const existing = existingChar5e?.speeds ?? { swim: 0, fly: 0, climb: 0, burrow: 0 }
      const rangerLevel = classId === 'ranger' ? targetLevel : 0
      if (rangerLevel >= 6) {
        const walkSpeed = (get().speciesSpeed || stats.speed) + 10
        return { ...existing, climb: Math.max(existing.climb, walkSpeed), swim: Math.max(existing.swim, walkSpeed) }
      }
      return existing
    })(),
    size: speciesSize || existingChar5e?.size || 'Medium',
    creatureType: speciesData?.creatureType || existingChar5e?.creatureType || 'Humanoid',
    senses: (() => {
      const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
      const subId = heritageSlot?.selectedId ?? existingChar5e?.buildChoices?.subspeciesId
      const speciesSenses = getSpeciesSenses(speciesSlot?.selectedId ?? '', subId)
      const existing = existingChar5e?.senses ?? []
      return [...new Set([...speciesSenses, ...existing])]
    })(),
    resistances: (() => {
      const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
      const subId = heritageSlot?.selectedId ?? existingChar5e?.buildChoices?.subspeciesId
      const speciesRes = getSpeciesResistances(speciesSlot?.selectedId ?? '', subId)
      const existing = existingChar5e?.resistances ?? []
      return [...new Set([...speciesRes, ...existing])]
    })(),
    immunities: existingChar5e?.immunities ?? [],
    vulnerabilities: existingChar5e?.vulnerabilities ?? [],
    details: {
      gender: characterGender || existingChar5e?.details?.gender || undefined,
      deity: characterDeity || existingChar5e?.details?.deity || undefined,
      age: characterAge || existingChar5e?.details?.age || undefined,
      height: characterHeight || existingChar5e?.details?.height || undefined,
      weight: characterWeight || existingChar5e?.details?.weight || undefined,
      eyes: characterEyes || existingChar5e?.details?.eyes || undefined,
      hair: characterHair || existingChar5e?.details?.hair || undefined,
      skin: characterSkin || existingChar5e?.details?.skin || undefined,
      appearance: characterAppearance || existingChar5e?.details?.appearance || undefined,
      personality: characterPersonality || existingChar5e?.details?.personality || undefined,
      ideals: characterIdeals || existingChar5e?.details?.ideals || undefined,
      bonds: characterBonds || existingChar5e?.details?.bonds || undefined,
      flaws: characterFlaws || existingChar5e?.details?.flaws || undefined
    },
    proficiencies: {
      weapons: (() => {
        const base = classData?.proficiencies.weapons ?? []
        const result = [...base]
        const primalOrderSlot = buildSlots.find((s) => s.category === 'primal-order')
        if (primalOrderSlot?.selectedId === 'warden' && !result.includes('Martial weapons')) {
          result.push('Martial weapons')
        }
        const divineOrderSlot = buildSlots.find((s) => s.category === 'divine-order')
        if (divineOrderSlot?.selectedId === 'protector' && !result.includes('Martial weapons')) {
          result.push('Martial weapons')
        }
        return result
      })(),
      armor: (() => {
        const base = classData?.proficiencies.armor ?? []
        const result = [...base]
        const primalOrderSlot = buildSlots.find((s) => s.category === 'primal-order')
        if (primalOrderSlot?.selectedId === 'warden' && !result.includes('Medium armor')) {
          result.push('Medium armor')
        }
        const divineOrderSlot = buildSlots.find((s) => s.category === 'divine-order')
        if (divineOrderSlot?.selectedId === 'protector' && !result.includes('Heavy armor')) {
          result.push('Heavy armor')
        }
        return result
      })(),
      tools: (() => {
        // Map bg tool proficiencies to reflect variant edits from bgEquipment
        const bgToolsRaw = bgData?.proficiencies.tools ?? []
        const bgToolsMapped = bgToolsRaw.map((tool) => {
          const toolLC = tool.toLowerCase()
          // Check if this tool was a generic variant that the user specialized
          const matchedBgItem = storeBgEquipment.find((e) => {
            const nameLC = e.name.toLowerCase()
            return nameLC !== toolLC && nameLC.includes(toolLC)
          })
          return matchedBgItem ? matchedBgItem.name : tool
        })
        const all = [...(classData?.proficiencies.tools ?? []), ...bgToolsMapped]
        const seen = new Set<string>()
        return all.filter((t) => {
          const key = t.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      })(),
      languages: [
        ...(speciesData?.languages ?? []),
        ...get().chosenLanguages,
        ...(classId === 'druid' &&
        !(speciesData?.languages ?? []).includes('Druidic') &&
        !get().chosenLanguages.includes('Druidic')
          ? ['Druidic']
          : []),
        ...(classId === 'rogue' &&
        !(speciesData?.languages ?? []).includes("Thieves' Cant") &&
        !get().chosenLanguages.includes("Thieves' Cant")
          ? ["Thieves' Cant"]
          : [])
      ],
      savingThrows: (classData?.savingThrows ?? []).map((s) => s.toLowerCase() as AbilityName)
    },
    skills: (() => {
      const skills = populateSkills5e([
        ...new Set([
          ...selectedSkills,
          ...(bgData?.proficiencies.skills ?? []),
          ...speciesProficiencies,
          ...(keenSensesSkill ? [keenSensesSkill] : [])
        ])
      ])
      // Apply expertise from existing character's build choices
      const expertiseChoices = existingChar5e?.buildChoices?.expertiseChoices
      if (expertiseChoices) {
        for (const skillNames of Object.values(expertiseChoices)) {
          for (const skillName of skillNames) {
            const skill = skills.find((s) => s.name === skillName)
            if (skill) skill.expertise = true
          }
        }
      }
      return skills
    })(),
    equipment: filteredEquipment,
    treasure: {
      cp: get().currency.cp,
      sp: get().currency.sp,
      ep: existingChar5e?.treasure?.ep ?? 0,
      gp:
        (bgEquipmentChoice === 'gold'
          ? Math.max(0, get().currency.gp - (bgData?.startingGold ?? 0) + 50)
          : get().currency.gp) +
        get().higherLevelGoldBonus +
        classOptionGold,
      pp: get().currency.pp
    },
    features: [
      ...((get().derivedSpeciesTraits.length > 0 ? get().derivedSpeciesTraits : (speciesData?.traits ?? [])).map(
        (t) => ({
          name: t.name,
          source: speciesData?.name ?? 'Species',
          description: t.description
        })
      ) ?? [])
    ],
    buildChoices: {
      speciesId: speciesSlot?.selectedId ?? '',
      subspeciesId: (() => {
        const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
        return heritageSlot?.selectedId ?? existingChar5e?.buildChoices?.subspeciesId ?? undefined
      })(),
      classId: classSlot?.selectedId ?? '',
      subclassId: subclassSlot?.selectedId ?? undefined,
      backgroundId: bgSlot?.selectedId ?? '',
      selectedSkills,
      abilityScoreMethod,
      abilityScoreAssignments: { ...abilityScores },
      asiChoices: Object.keys(get().asiSelections).length > 0 ? { ...get().asiSelections } : undefined,
      chosenLanguages: get().chosenLanguages.length > 0 ? [...get().chosenLanguages] : undefined,
      backgroundAbilityBonuses:
        Object.keys(backgroundAbilityBonuses).length > 0 ? { ...backgroundAbilityBonuses } : undefined,
      versatileFeatId: versatileFeatId ?? undefined,
      epicBoonId: buildSlots.find((s) => s.category === 'epic-boon' && s.selectedId)?.selectedId ?? undefined,
      generalFeatChoices: existingChar5e?.buildChoices?.generalFeatChoices,
      fightingStyleId:
        buildSlots.find((s) => s.category === 'fighting-style' && s.selectedId)?.selectedId ??
        existingChar5e?.buildChoices?.fightingStyleId,
      backgroundEquipmentChoice: bgEquipmentChoice !== 'equipment' ? bgEquipmentChoice : undefined,
      classEquipmentChoice: classEquipmentChoice !== 'A' ? classEquipmentChoice : undefined,
      primalOrderChoice: (() => {
        const poSlot = buildSlots.find((s) => s.category === 'primal-order')
        return (
          (poSlot?.selectedId as 'magician' | 'warden') ?? existingChar5e?.buildChoices?.primalOrderChoice ?? undefined
        )
      })(),
      divineOrderChoice: (() => {
        const doSlot = buildSlots.find((s) => s.category === 'divine-order')
        return (
          (doSlot?.selectedId as 'protector' | 'thaumaturge') ??
          existingChar5e?.buildChoices?.divineOrderChoice ??
          undefined
        )
      })(),
      elementalFuryChoice: existingChar5e?.buildChoices?.elementalFuryChoice,
      speciesSpellcastingAbility: speciesSpellcastingAbility ?? undefined,
      keenSensesSkill: keenSensesSkill ?? undefined,
      blessedWarriorCantrips: blessedWarriorCantrips.length > 0 ? blessedWarriorCantrips : undefined,
      druidicWarriorCantrips: druidicWarriorCantrips.length > 0 ? druidicWarriorCantrips : undefined,
      expertiseChoices: existingChar5e?.buildChoices?.expertiseChoices,
      multiclassEntries: existingChar5e?.buildChoices?.multiclassEntries
    },
    status: existingChar5e?.status ?? 'active',
    campaignHistory: existingChar5e?.campaignHistory ?? [],
    backstory: characterBackstory || existingChar5e?.backstory || '',
    notes: characterNotes,
    pets: [...pets],
    languageDescriptions: existingChar5e?.languageDescriptions ?? {},
    conditions: [...conditions],
    deathSaves: existingChar5e?.deathSaves ?? { successes: 0, failures: 0 },
    spellcasting: spellcastingInfo,
    heroicInspiration: existingChar5e?.heroicInspiration,
    wildShapeUses: (() => {
      if (classId !== 'druid' || targetLevel < 2) return undefined
      const max = getWildShapeMax(targetLevel)
      return { current: existingChar5e?.wildShapeUses?.current ?? max, max }
    })(),
    classResources: (() => {
      const wisMod = Math.floor((stats.abilityScores.wisdom - 10) / 2)
      const resources = getClassResources(classSlot?.selectedId ?? '', targetLevel, wisMod)
      return resources.length > 0 ? resources : existingChar5e?.classResources
    })(),
    speciesResources: (() => {
      const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
      const subId = heritageSlot?.selectedId ?? existingChar5e?.buildChoices?.subspeciesId
      const resources = getSpeciesResources(speciesSlot?.selectedId ?? '', subId, targetLevel)
      if (resources.length === 0) return existingChar5e?.speciesResources
      // Preserve current values when editing
      const oldResources = existingChar5e?.speciesResources ?? []
      return resources.map((nr) => {
        const old = oldResources.find((or) => or.id === nr.id)
        if (old) return { ...nr, current: Math.min(nr.max, old.current) }
        return nr
      })
    })(),
    attunement: existingChar5e?.attunement ?? [],
    magicItems: magicItems.length > 0 ? magicItems : undefined,
    knownSpells: await (async () => {
      // Use derived traits (with heritage modifications) for spell extraction
      const traitsForSpells =
        get().derivedSpeciesTraits.length > 0
          ? (get().derivedSpeciesTraits as Array<{
              name: string
              description: string
              spellGranted?: string | { list: string; count: number }
            }>)
          : (speciesData?.traits ?? [])
      const racialSpells = speciesData ? getSpellsFromTraits(traitsForSpells, speciesData.name) : []

      // Add species spell progression (level 3/5 spells from heritage/subrace)
      const heritageSlot = buildSlots.find((s) => s.id === 'heritage')
      const heritageId = heritageSlot?.selectedId ?? null
      let progressionSpells: SpellEntry[] = []
      if (speciesData?.subraces && heritageId) {
        const subrace = speciesData.subraces.find((sr) => sr.id === heritageId)
        if (subrace?.spellProgression) {
          progressionSpells = getSpeciesSpellProgression(subrace.spellProgression, targetLevel, speciesData.name)
        }
      }

      try {
        const spellData: Array<{
          id: string
          name: string
          level: number
          school?: string
          castingTime?: string
          castTime?: string
          range?: string
          duration?: string
          description: string
          concentration?: boolean
          ritual?: boolean
          components?: string
          classes?: string[]
          traditions?: string[]
          traits?: string[]
          heightened?: Record<string, string>
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
        const spells = [...racialSpells, ...progressionSpells, ...selectedSpells]
        // Druid: always prepare Speak with Animals (Druidic feature)
        if (classId === 'druid' && !spells.some((s) => s.name === 'Speak with Animals')) {
          const swa = spellData.find((s) => s.name === 'Speak with Animals')
          if (swa) {
            spells.push({
              id: swa.id,
              name: swa.name,
              level: swa.level,
              description: swa.description,
              castingTime: swa.castingTime || swa.castTime || '',
              range: swa.range || '',
              duration: swa.duration || '',
              components: typeof swa.components === 'string' ? swa.components : '',
              school: swa.school,
              concentration: swa.concentration,
              ritual: swa.ritual,
              classes: swa.classes,
              prepared: true
            })
          }
        }
        // Ranger: always prepare Hunter's Mark (Favored Enemy feature)
        if (classId === 'ranger' && !spells.some((s) => s.name === "Hunter's Mark")) {
          const hm = spellData.find((s) => s.name === "Hunter's Mark")
          if (hm) {
            spells.push({
              id: hm.id,
              name: hm.name,
              level: hm.level,
              description: hm.description,
              castingTime: hm.castingTime || hm.castTime || '',
              range: hm.range || '',
              duration: hm.duration || '',
              components: typeof hm.components === 'string' ? hm.components : '',
              school: hm.school,
              concentration: hm.concentration,
              ritual: hm.ritual,
              classes: hm.classes,
              prepared: true
            })
          }
        }
        // Add Blessed Warrior cantrips (Cleric cantrips via Paladin fighting style)
        if (blessedWarriorCantrips.length > 0) {
          for (const cantripId of blessedWarriorCantrips) {
            const raw = spellData.find((s) => s.id === cantripId)
            if (raw && !spells.some((s) => s.id === raw.id)) {
              spells.push({
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
                classes: raw.classes,
                source: 'feat'
              })
            }
          }
        }
        // Add Druidic Warrior cantrips (Druid cantrips via Ranger fighting style)
        if (druidicWarriorCantrips.length > 0) {
          for (const cantripId of druidicWarriorCantrips) {
            const raw = spellData.find((s) => s.id === cantripId)
            if (raw && !spells.some((s) => s.id === raw.id)) {
              spells.push({
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
                classes: raw.classes,
                source: 'feat'
              })
            }
          }
        }
        // Add subclass always-prepared spells
        if (subclassId) {
          try {
            const subclasses = await load5eSubclasses()
            const sc = subclasses.find((s) => s.id === subclassId)
            if (sc?.alwaysPreparedSpells) {
              for (const [lvlStr, spellNames] of Object.entries(sc.alwaysPreparedSpells)) {
                if (targetLevel >= Number(lvlStr)) {
                  for (const name of spellNames) {
                    if (!spells.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
                      const raw = spellData.find((s) => s.name.toLowerCase() === name.toLowerCase())
                      if (raw) {
                        spells.push({
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
                          classes: raw.classes,
                          prepared: true
                        })
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('[SaveSlice5e] Failed to load subclass spells:', error)
          }
        }
        return spells
      } catch (error) {
        console.error('[SaveSlice5e] Failed to resolve spell list:', error)
        return [...racialSpells, ...progressionSpells]
      }
    })(),
    preparedSpellIds: existingChar5e?.preparedSpellIds ?? [],
    spellSlotLevels:
      existingChar5e?.spellSlotLevels ??
      (() => {
        // Compute initial spell slots for new characters
        const slotProg = getSlotProgression(classId, targetLevel)
        const slots: Record<number, { current: number; max: number }> = {}
        for (const [lvl, count] of Object.entries(slotProg)) {
          slots[Number(lvl)] = { current: count, max: count }
        }
        return slots
      })(),
    classFeatures: (() => {
      if (editingCharacterId && existingChar5e?.classFeatures?.length) {
        const existingKeys = new Set(existingChar5e.classFeatures.map((f) => `${f.level}-${f.name}`))
        const missing = creationClassFeatures.filter((f) => !existingKeys.has(`${f.level}-${f.name}`))
        return [...existingChar5e.classFeatures, ...missing]
      }
      return creationClassFeatures
    })(),
    weapons: weaponBuildResult.weapons,
    armor: [...armorBuildResult.armor, ...wearableArmor],
    feats: (() => {
      const existing = existingChar5e?.feats ?? []
      let result = existing

      // Handle origin feat
      if (originFeat) {
        const withoutOldOrigin = result.filter((f) => {
          const baseName = f.name.replace(/\s*\(.*\)$/, '')
          return !featsData.some((fd) => fd.name === baseName && fd.category === 'Origin')
        })
        if (!withoutOldOrigin.some((f) => f.name === originFeat.name)) {
          result = [originFeat, ...withoutOldOrigin]
        } else {
          result = withoutOldOrigin
        }
      }

      // Handle Epic Boon from builder slot
      const epicBoonSlot = buildSlots.find((s) => s.category === 'epic-boon' && s.selectedId)
      if (epicBoonSlot) {
        // Remove any existing epic boon
        result = result.filter((f) => f.id !== existingChar5e?.buildChoices?.epicBoonId)
        const boonFeat = featsData.find((fd) => fd.id === epicBoonSlot.selectedId)
        if (boonFeat) {
          result = [...result, { id: boonFeat.id, name: boonFeat.name, description: boonFeat.description }]
        } else {
          result = [
            ...result,
            { id: epicBoonSlot.selectedId!, name: epicBoonSlot.selectedName ?? 'Epic Boon', description: '' }
          ]
        }
      }

      // Handle Human Versatile feat
      if (versatileFeatId) {
        // Remove old versatile feat if exists
        result = result.filter((f) => f.id !== existingChar5e?.buildChoices?.versatileFeatId)
        const vFeat = featsData.find((fd) => fd.id === versatileFeatId)
        if (vFeat) {
          result = [...result, { id: vFeat.id, name: vFeat.name, description: vFeat.description }]
        }
      } else if (existingChar5e?.buildChoices?.versatileFeatId) {
        // Species changed away from Human, remove old versatile feat
        result = result.filter((f) => f.id !== existingChar5e?.buildChoices?.versatileFeatId)
      }

      // Handle Fighting Style from builder slot
      const fsSlot = buildSlots.find((s) => s.category === 'fighting-style' && s.selectedId)
      if (fsSlot) {
        // Remove any existing fighting style from this slot
        result = result.filter((f) => f.id !== existingChar5e?.buildChoices?.fightingStyleId)
        const fsFeat = featsData.find((fd) => fd.id === fsSlot.selectedId)
        if (fsFeat) {
          result = [...result, { id: fsFeat.id, name: fsFeat.name, description: fsFeat.description }]
        } else {
          result = [
            ...result,
            { id: fsSlot.selectedId!, name: fsSlot.selectedName ?? 'Fighting Style', description: '' }
          ]
        }
      }

      return result
    })(),
    iconPreset: iconType === 'preset' ? iconPreset : undefined,
    portraitPath: iconType === 'custom' ? iconCustom : undefined,
    // Preserve sheet/level-up fields through re-saves
    ...(existingChar5e?.pactMagicSlotLevels ? { pactMagicSlotLevels: existingChar5e.pactMagicSlotLevels } : {}),
    ...(existingChar5e?.invocationsKnown ? { invocationsKnown: existingChar5e.invocationsKnown } : {}),
    ...(existingChar5e?.metamagicKnown ? { metamagicKnown: existingChar5e.metamagicKnown } : {}),
    ...(existingChar5e?.weaponMasteryChoices ? { weaponMasteryChoices: existingChar5e.weaponMasteryChoices } : {}),
    ...(existingChar5e?.companions ? { companions: existingChar5e.companions } : {}),
    ...(existingChar5e?.activeWildShapeFormId ? { activeWildShapeFormId: existingChar5e.activeWildShapeFormId } : {}),
    createdAt: existingChar5e?.createdAt ?? now,
    updatedAt: now
  }

  return character
}
