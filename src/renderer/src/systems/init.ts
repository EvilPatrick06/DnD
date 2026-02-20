import { dnd5ePlugin } from './dnd5e'
import { registerSystem } from './registry'

export function initGameSystems(): void {
  registerSystem(dnd5ePlugin)
}
