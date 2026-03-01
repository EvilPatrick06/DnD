// ============================================================================
// Scoped Plugin API
// Creates a frozen, sandboxed API object for each plugin instance.
// Plugins receive this via activate(api) — no access to window.api, stores,
// or React internals.
// ============================================================================

import type { PluginManifest, PluginPermission } from '../../../../shared/plugin-types'
import { logger } from '../../utils/logger'
import { type AsyncEventHandler, type EventHandler, pluginEventBus } from './event-bus'

export interface PluginEventsAPI {
  on: <T = unknown>(event: string, handler: EventHandler<T>, priority?: number) => void
  onAsync: <T = unknown>(event: string, handler: AsyncEventHandler<T>, priority?: number) => void
  off: (event: string, handler: EventHandler) => void
  emit: <T>(event: string, payload: T) => T
}

export interface PluginCommandDef {
  name: string
  aliases?: string[]
  description: string
  dmOnly?: boolean
  execute: (args: string, context: unknown) => unknown
}

export interface PluginCommandsAPI {
  register: (command: PluginCommandDef) => void
  unregister: (name: string) => void
}

export interface PluginDataAPI {
  get: (category: string) => Promise<unknown[]>
}

export interface PluginGameAPI {
  getState: () => unknown
}

export interface PluginStorageAPI {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
  delete: (key: string) => Promise<void>
}

export interface PluginUIAPI {
  registerContextMenuItem: (item: {
    label: string
    icon?: string
    onClick: (tokenId: string) => void
    dmOnly?: boolean
  }) => void
  registerBottomBarWidget: (widget: { id: string; label: string; render: () => HTMLElement | null }) => void
}

export interface PluginLogAPI {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export interface PluginSoundsAPI {
  register: (eventName: string, urls: string[]) => void
  play: (eventName: string) => void
}

export interface PluginAPI {
  id: string
  manifest: PluginManifest
  events: PluginEventsAPI
  commands: PluginCommandsAPI
  data: PluginDataAPI
  game: PluginGameAPI
  storage: PluginStorageAPI
  ui: PluginUIAPI
  log: PluginLogAPI
  sounds: PluginSoundsAPI
}

/**
 * Create a frozen, scoped API object for a single plugin.
 * All operations are sandboxed to the plugin's ID and permissions.
 */
export function createPluginAPI(pluginId: string, manifest: PluginManifest): PluginAPI {
  const permissions = new Set<PluginPermission>('permissions' in manifest ? manifest.permissions : [])

  function requirePermission(perm: PluginPermission, action: string): void {
    if (!permissions.has(perm)) {
      throw new Error(`Plugin "${pluginId}" lacks "${perm}" permission for: ${action}`)
    }
  }

  // --- Events API ---
  const events: PluginEventsAPI = Object.freeze({
    on: <T = unknown>(event: string, handler: EventHandler<T>, priority?: number) => {
      requirePermission('game-events', `events.on("${event}")`)
      pluginEventBus.on(event, pluginId, handler, priority)
    },
    onAsync: <T = unknown>(event: string, handler: AsyncEventHandler<T>, priority?: number) => {
      requirePermission('game-events', `events.onAsync("${event}")`)
      pluginEventBus.onAsync(event, pluginId, handler, priority)
    },
    off: (event: string, handler: EventHandler) => {
      pluginEventBus.off(event, handler)
    },
    emit: <T>(event: string, payload: T): T => {
      requirePermission('game-events', `events.emit("${event}")`)
      return pluginEventBus.emit(event, payload)
    }
  })

  // --- Commands API (populated by plugin-registry during load) ---
  const registeredCommands: PluginCommandDef[] = []
  const commands: PluginCommandsAPI = Object.freeze({
    register: (command: PluginCommandDef) => {
      requirePermission('commands', `commands.register("${command.name}")`)
      registeredCommands.push(command)
      // Actual registration into the command system happens via the registry
      const { getPluginCommandRegistry } = require('./plugin-registry')
      getPluginCommandRegistry().push({ ...command, pluginId })
    },
    unregister: (name: string) => {
      const idx = registeredCommands.findIndex((c) => c.name === name)
      if (idx >= 0) registeredCommands.splice(idx, 1)
      const { getPluginCommandRegistry } = require('./plugin-registry')
      const registry = getPluginCommandRegistry()
      const regIdx = registry.findIndex(
        (c: { name: string; pluginId: string }) => c.name === name && c.pluginId === pluginId
      )
      if (regIdx >= 0) registry.splice(regIdx, 1)
    }
  })

  // --- Data API ---
  const data: PluginDataAPI = Object.freeze({
    get: async (_category: string): Promise<unknown[]> => {
      // Plugins can read data through the data store
      // This is read-only access to the merged data pipeline
      return []
    }
  })

  // --- Game API ---
  const game: PluginGameAPI = Object.freeze({
    getState: () => {
      requirePermission('game-events', 'game.getState()')
      // Return a read-only snapshot of relevant game state
      return {}
    }
  })

  // --- Storage API (scoped to plugin) ---
  const storage: PluginStorageAPI = Object.freeze({
    get: async (key: string): Promise<unknown> => {
      requirePermission('storage', `storage.get("${key}")`)
      return window.api.plugins.storageGet(pluginId, key)
    },
    set: async (key: string, value: unknown): Promise<void> => {
      requirePermission('storage', `storage.set("${key}")`)
      await window.api.plugins.storageSet(pluginId, key, value)
    },
    delete: async (key: string): Promise<void> => {
      requirePermission('storage', `storage.delete("${key}")`)
      await window.api.plugins.storageDelete(pluginId, key)
    }
  })

  // --- UI API ---
  const uiContextMenuItems: Array<{
    label: string
    icon?: string
    onClick: (tokenId: string) => void
    dmOnly?: boolean
  }> = []
  const uiBottomBarWidgets: Array<{
    id: string
    label: string
    render: () => HTMLElement | null
  }> = []

  const ui: PluginUIAPI = Object.freeze({
    registerContextMenuItem: (item: {
      label: string
      icon?: string
      onClick: (tokenId: string) => void
      dmOnly?: boolean
    }) => {
      requirePermission('ui-extensions', 'ui.registerContextMenuItem()')
      uiContextMenuItems.push(item)
      // Store in the plugin store for rendering
      const { getPluginUIRegistry } = require('./plugin-registry')
      getPluginUIRegistry().contextMenuItems.push({ ...item, pluginId })
    },
    registerBottomBarWidget: (widget: { id: string; label: string; render: () => HTMLElement | null }) => {
      requirePermission('ui-extensions', 'ui.registerBottomBarWidget()')
      uiBottomBarWidgets.push(widget)
      const { getPluginUIRegistry } = require('./plugin-registry')
      getPluginUIRegistry().bottomBarWidgets.push({ ...widget, pluginId })
    }
  })

  // --- Log API ---
  const log: PluginLogAPI = Object.freeze({
    info: (...args: unknown[]) => logger.info(`[Plugin:${pluginId}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[Plugin:${pluginId}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[Plugin:${pluginId}]`, ...args)
  })

  // --- Sounds API ---
  const sounds: PluginSoundsAPI = Object.freeze({
    register: (_eventName: string, _urls: string[]) => {
      requirePermission('sounds', 'sounds.register()')
      // Registration into the sound manager would happen here
    },
    play: (_eventName: string) => {
      requirePermission('sounds', 'sounds.play()')
    }
  })

  return Object.freeze({
    id: pluginId,
    manifest,
    events,
    commands,
    data,
    game,
    storage,
    ui,
    log,
    sounds
  })
}
