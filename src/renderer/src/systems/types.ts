import type { GameSystem } from '../types/game-system'
import type { SpellEntry, ClassFeatureEntry, Currency, AbilityName } from '../types/character-common'

export interface SheetConfig {
  showInitiative: boolean
  showPerception: boolean
  showClassDC: boolean
  showBulk: boolean
  showElectrum: boolean
  showFocusPoints: boolean
  proficiencyStyle: 'dots' | 'teml'
}

export interface GameSystemPlugin {
  id: GameSystem
  name: string

  getSpellSlotProgression(className: string, level: number): Record<number, number>
  getSpellList(className: string): Promise<SpellEntry[]>
  isSpellcaster(className: string): boolean
  getStartingGold(classId: string, backgroundId: string): Promise<Currency>
  getClassFeatures(classId: string, level: number): Promise<ClassFeatureEntry[]>
  loadEquipment(): Promise<{ weapons: any[]; armor: any[]; shields: any[]; gear: any[] }>

  getSkillDefinitions(): Array<{ name: string; ability: AbilityName }>

  getSheetConfig(): SheetConfig
}
