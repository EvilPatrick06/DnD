import type { BuildSlot } from '../types/character-common'

// Class-specific subclass levels in 5e SRD
const SUBCLASS_LEVELS: Record<string, number> = {
  cleric: 1,
  sorcerer: 1,
  warlock: 1,
  druid: 2,
  wizard: 2,
  bard: 3,
  fighter: 3,
  monk: 3,
  paladin: 3,
  ranger: 3,
  rogue: 3,
  barbarian: 3
}

const DEFAULT_SUBCLASS_LEVEL = 3

export function generate5eBuildSlots(targetLevel: number, classId?: string): BuildSlot[] {
  const slots: BuildSlot[] = [
    {
      id: 'ancestry',
      label: 'Species',
      category: 'ancestry',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    },
    {
      id: 'background',
      label: 'Background',
      category: 'background',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    },
    {
      id: 'class',
      label: 'Class',
      category: 'class',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    },
    {
      id: 'ability-scores',
      label: 'Ability Scores',
      category: 'ability-scores',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    },
    {
      id: 'skill-choices',
      label: 'Skill Proficiencies',
      category: 'skill-choice',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    }
  ]

  const subclassLevel = classId
    ? (SUBCLASS_LEVELS[classId] ?? DEFAULT_SUBCLASS_LEVEL)
    : DEFAULT_SUBCLASS_LEVEL

  // Add level-based slots
  for (let lvl = 1; lvl <= targetLevel; lvl++) {
    // ASI at levels 4, 8, 12, 16, 19
    if (lvl === 4 || lvl === 8 || lvl === 12 || lvl === 16 || lvl === 19) {
      slots.push({
        id: `level${lvl}-asi`,
        label: 'Ability Score Improvement',
        category: 'ability-boost',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }

    // Subclass at class-appropriate level
    if (lvl === subclassLevel) {
      slots.push({
        id: `level${lvl}-subclass`,
        label: 'Subclass',
        category: 'class-feat',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }
  }

  return slots
}
