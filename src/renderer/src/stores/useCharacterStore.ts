import { create } from 'zustand'
import type { Character } from '../types/character'
import type { ActiveCondition } from '../types/character-common'

interface CharacterState {
  characters: Character[]
  selectedCharacterId: string | null
  loading: boolean
  setSelectedCharacter: (id: string | null) => void
  loadCharacters: () => Promise<void>
  saveCharacter: (character: Character) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  toggleArmorEquipped: (characterId: string, armorId: string) => Promise<void>
  addCondition: (characterId: string, condition: ActiveCondition) => Promise<void>
  removeCondition: (characterId: string, conditionName: string) => Promise<void>
  updateConditionValue: (characterId: string, conditionName: string, newValue: number) => Promise<void>
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedCharacterId: null,
  loading: false,

  setSelectedCharacter: (id) => set({ selectedCharacterId: id }),

  loadCharacters: async () => {
    set({ loading: true })
    try {
      const rawData = await window.api.loadCharacters()
      const characters = rawData as unknown as Character[]
      set({ characters, loading: false })
    } catch (error) {
      console.error('Failed to load characters:', error)
      set({ loading: false })
    }
  },

  saveCharacter: async (character: Character) => {
    try {
      const result = await window.api.saveCharacter(character as unknown as Record<string, unknown>)
      if (result && typeof result === 'object' && 'success' in result && !(result as { success: boolean }).success) {
        console.error('Character save returned failure:', (result as { error?: string }).error, 'id:', character.id)
      }
      const { characters } = get()
      const index = characters.findIndex((c) => c.id === character.id)
      if (index >= 0) {
        const updated = [...characters]
        updated[index] = character
        set({ characters: updated })
      } else {
        set({ characters: [...characters, character] })
      }
    } catch (error) {
      console.error('Failed to save character:', error, 'id:', character.id, 'name:', character.name)
    }
  },

  deleteCharacter: async (id: string) => {
    try {
      await window.api.deleteCharacter(id)
      set({ characters: get().characters.filter((c) => c.id !== id) })
    } catch (error) {
      console.error('Failed to delete character:', error)
    }
  },

  toggleArmorEquipped: async (characterId: string, armorId: string) => {
    const { characters } = get()
    const char = characters.find((c) => c.id === characterId)
    if (!char) return

    const updatedArmor = char.armor.map((a) => {
      if (a.id === armorId) {
        return { ...a, equipped: !a.equipped }
      }
      // Unequip other armor of same type when equipping
      if (char.armor.find((x) => x.id === armorId)?.type === a.type && a.id !== armorId) {
        return { ...a, equipped: false }
      }
      return a
    })

    const updated = { ...char, armor: updatedArmor, updatedAt: new Date().toISOString() } as Character
    await get().saveCharacter(updated)
  },

  addCondition: async (characterId: string, condition: ActiveCondition) => {
    const { characters } = get()
    const char = characters.find((c) => c.id === characterId)
    if (!char) return

    const conditions = [...(char.conditions ?? []), condition]
    const updated = { ...char, conditions, updatedAt: new Date().toISOString() } as Character
    await get().saveCharacter(updated)
  },

  removeCondition: async (characterId: string, conditionName: string) => {
    const { characters } = get()
    const char = characters.find((c) => c.id === characterId)
    if (!char) return

    const conditions = (char.conditions ?? []).filter((c) => c.name !== conditionName)
    const updated = { ...char, conditions, updatedAt: new Date().toISOString() } as Character
    await get().saveCharacter(updated)
  },

  updateConditionValue: async (characterId: string, conditionName: string, newValue: number) => {
    const { characters } = get()
    const char = characters.find((c) => c.id === characterId)
    if (!char) return

    if (newValue <= 0) {
      // Remove the condition when value drops to 0
      const conditions = (char.conditions ?? []).filter((c) => c.name !== conditionName)
      const updated = { ...char, conditions, updatedAt: new Date().toISOString() } as Character
      await get().saveCharacter(updated)
    } else {
      const conditions = (char.conditions ?? []).map((c) => (c.name === conditionName ? { ...c, value: newValue } : c))
      const updated = { ...char, conditions, updatedAt: new Date().toISOString() } as Character
      await get().saveCharacter(updated)
    }
  }
}))
