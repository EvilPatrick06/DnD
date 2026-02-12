import type { BuildSlot } from '../types/character-common'

export function generatePf2eBuildSlots(targetLevel: number): BuildSlot[] {
  const slots: BuildSlot[] = [
    {
      id: 'ancestry',
      label: 'Ancestry',
      category: 'ancestry',
      level: 0,
      selectedId: null,
      selectedName: null,
      required: true
    },
    {
      id: 'heritage',
      label: 'Heritage',
      category: 'heritage',
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
      label: 'Ability Boosts',
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

  for (let lvl = 1; lvl <= targetLevel; lvl++) {
    // Ancestry feat at 1, 5, 9, 13, 17
    if (lvl === 1 || lvl === 5 || lvl === 9 || lvl === 13 || lvl === 17) {
      slots.push({
        id: `level${lvl}-ancestry-feat`,
        label: 'Ancestry Feat',
        category: 'ancestry-feat',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }

    // Class feat at 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
    if (lvl === 1 || (lvl >= 2 && lvl % 2 === 0)) {
      slots.push({
        id: `level${lvl}-class-feat`,
        label: 'Class Feat',
        category: 'class-feat',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }

    // Skill feat at 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
    if (lvl >= 2 && lvl % 2 === 0) {
      slots.push({
        id: `level${lvl}-skill-feat`,
        label: 'Skill Feat',
        category: 'skill-feat',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }

    // General feat at 3, 7, 11, 15, 19
    if (lvl === 3 || lvl === 7 || lvl === 11 || lvl === 15 || lvl === 19) {
      slots.push({
        id: `level${lvl}-general-feat`,
        label: 'General Feat',
        category: 'general-feat',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }

    // Ability boosts at 5, 10, 15, 20
    if (lvl === 5 || lvl === 10 || lvl === 15 || lvl === 20) {
      slots.push({
        id: `level${lvl}-ability-boost`,
        label: 'Ability Boosts',
        category: 'ability-boost',
        level: lvl,
        selectedId: null,
        selectedName: null,
        required: false
      })
    }
  }

  return slots
}
