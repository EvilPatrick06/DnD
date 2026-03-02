// ============================================================================
// Plugin Registry
// Manages the lifecycle of loaded plugins: load, unload, track status.
// ============================================================================

import type { PluginManifest } from '../../../../shared/plugin-types'
import { logger } from '../../utils/logger'
import {
  type DmAction,
  type ExecutionFailure,
  type ExecutionResult,
  type GameStoreSnapshot,
  registerPluginDmAction,
  unregisterPluginDmAction
} from '../game-action-executor'

type _DmAction = DmAction
type _ExecutionFailure = ExecutionFailure
type _ExecutionResult = ExecutionResult
type _GameStoreSnapshot = GameStoreSnapshot

import { pluginEventBus } from './event-bus'
import { createPluginAPI, type PluginAPI, type PluginCommandDef } from './plugin-api'

export interface LoadedPlugin {
  id: string
  manifest: PluginManifest
  status: 'loaded' | 'error' | 'unloaded'
  instance?: {
    activate: (api: PluginAPI) => void
    deactivate?: () => void
  }
  api?: PluginAPI
  errorMessage?: string
}

// --- Global registries for plugin contributions ---

interface PluginCommandEntry extends PluginCommandDef {
  pluginId: string
}

interface PluginContextMenuItem {
  pluginId: string
  label: string
  icon?: string
  onClick: (tokenId: string) => void
  dmOnly?: boolean
}

interface PluginBottomBarWidget {
  pluginId: string
  id: string
  label: string
  render: () => HTMLElement | null
}

interface PluginUIRegistry {
  contextMenuItems: PluginContextMenuItem[]
  bottomBarWidgets: PluginBottomBarWidget[]
}

const pluginCommandRegistry: PluginCommandEntry[] = []
const pluginUIRegistry: PluginUIRegistry = {
  contextMenuItems: [],
  bottomBarWidgets: []
}
const loadedPlugins = new Map<string, LoadedPlugin>()

export function getPluginCommandRegistry(): PluginCommandEntry[] {
  return pluginCommandRegistry
}

export function getPluginUIRegistry(): PluginUIRegistry {
  return pluginUIRegistry
}

export function getLoadedPlugins(): LoadedPlugin[] {
  return Array.from(loadedPlugins.values())
}

export function getLoadedPlugin(id: string): LoadedPlugin | undefined {
  return loadedPlugins.get(id)
}

/**
 * Load a code plugin by importing its entry point via the plugin:// protocol.
 */
export async function loadPlugin(manifest: PluginManifest): Promise<LoadedPlugin> {
  const id = manifest.id

  // Only code plugins and game system plugins have entry points
  if (manifest.type === 'content-pack') {
    const loaded: LoadedPlugin = { id, manifest, status: 'loaded' }
    loadedPlugins.set(id, loaded)
    return loaded
  }

  if (!('entry' in manifest) || !manifest.entry) {
    const loaded: LoadedPlugin = { id, manifest, status: 'error', errorMessage: 'No entry point' }
    loadedPlugins.set(id, loaded)
    return loaded
  }

  try {
    // Load the plugin module via the custom protocol
    const moduleUrl = `plugin://${id}/${manifest.entry}`
    const module = await import(/* @vite-ignore */ moduleUrl)

    if (typeof module.activate !== 'function') {
      throw new Error('Plugin module must export an activate() function')
    }

    const api = createPluginAPI(id, manifest)
    module.activate(api)

    // Register a default plugin DM action handler if the plugin provides one
    if (typeof module.handleDmAction === 'function') {
      registerPluginDmAction(`plugin:${id}:action`, module.handleDmAction)
    }

    const loaded: LoadedPlugin = {
      id,
      manifest,
      status: 'loaded',
      instance: {
        activate: module.activate,
        deactivate: typeof module.deactivate === 'function' ? module.deactivate : undefined
      },
      api
    }
    loadedPlugins.set(id, loaded)
    return loaded
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error(`[PluginRegistry] Failed to load plugin "${id}":`, errorMessage)
    const loaded: LoadedPlugin = { id, manifest, status: 'error', errorMessage }
    loadedPlugins.set(id, loaded)
    return loaded
  }
}

/**
 * Unload a plugin: call deactivate(), remove event subscriptions, clean up registries.
 */
export function unloadPlugin(id: string): void {
  const loaded = loadedPlugins.get(id)
  if (!loaded) return

  // Call deactivate if available
  try {
    loaded.instance?.deactivate?.()
  } catch (err) {
    logger.error(`[PluginRegistry] Error deactivating plugin "${id}":`, err)
  }

  // Remove all event subscriptions
  pluginEventBus.removePlugin(id)

  // Remove any registered plugin DM actions (prefixed with 'plugin:<id>:')
  unregisterPluginDmAction(`plugin:${id}:action`)

  // Remove registered commands
  for (let i = pluginCommandRegistry.length - 1; i >= 0; i--) {
    if (pluginCommandRegistry[i].pluginId === id) {
      pluginCommandRegistry.splice(i, 1)
    }
  }

  // Remove UI contributions
  pluginUIRegistry.contextMenuItems = pluginUIRegistry.contextMenuItems.filter((item) => item.pluginId !== id)
  pluginUIRegistry.bottomBarWidgets = pluginUIRegistry.bottomBarWidgets.filter((w) => w.pluginId !== id)

  loaded.status = 'unloaded'
  loadedPlugins.delete(id)
}

/**
 * Unload all plugins.
 */
export function unloadAllPlugins(): void {
  for (const id of Array.from(loadedPlugins.keys())) {
    unloadPlugin(id)
  }
}
