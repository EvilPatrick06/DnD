import type { GameSystem } from '../types/game-system'
import type { GameSystemPlugin } from './types'

const registry = new Map<GameSystem, GameSystemPlugin>()

export function registerSystem(plugin: GameSystemPlugin): void {
  registry.set(plugin.id, plugin)
}

export function getSystem(id: GameSystem): GameSystemPlugin {
  const plugin = registry.get(id)
  if (!plugin) throw new Error(`Game system '${id}' not registered`)
  return plugin
}

export function getAllSystems(): GameSystemPlugin[] {
  return Array.from(registry.values())
}
