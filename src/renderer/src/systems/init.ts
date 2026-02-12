import { registerSystem } from './registry'
import { dnd5ePlugin } from './dnd5e'
import { pf2ePlugin } from './pf2e'

export function initGameSystems(): void {
  registerSystem(dnd5ePlugin)
  registerSystem(pf2ePlugin)
}
