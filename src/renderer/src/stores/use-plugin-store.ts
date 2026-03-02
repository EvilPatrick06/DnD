import { create } from 'zustand'
import type { PluginStatus } from '../../../shared/plugin-types'
import { type LoadedPlugin, loadPlugin, unloadPlugin } from '../services/plugin-system/plugin-registry'

// Ensure imported type is used for type-safety
type _LoadedPlugin = LoadedPlugin

interface PluginStoreState {
  plugins: PluginStatus[]
  initialized: boolean

  initPlugins: () => Promise<void>
  enablePlugin: (id: string) => Promise<void>
  disablePlugin: (id: string) => Promise<void>
  refreshPluginList: () => Promise<void>
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  plugins: [],
  initialized: false,

  initPlugins: async () => {
    if (get().initialized) return

    try {
      const result = await window.api.plugins.scan()
      if (result.success && result.data) {
        const plugins = result.data as unknown as PluginStatus[]
        set({ plugins, initialized: true })

        // Load enabled code plugins
        for (const plugin of plugins) {
          if (plugin.enabled && !plugin.error && plugin.manifest.type !== 'content-pack') {
            await loadPlugin(plugin.manifest)
          }
        }
      } else {
        set({ initialized: true })
      }
    } catch {
      set({ initialized: true })
    }
  },

  enablePlugin: async (id: string) => {
    await window.api.plugins.enable(id)
    const plugin = get().plugins.find((p) => p.id === id)
    if (plugin && plugin.manifest.type !== 'content-pack') {
      await loadPlugin(plugin.manifest)
    }
    await get().refreshPluginList()
  },

  disablePlugin: async (id: string) => {
    await window.api.plugins.disable(id)
    unloadPlugin(id)
    await get().refreshPluginList()
  },

  refreshPluginList: async () => {
    try {
      const result = await window.api.plugins.scan()
      if (result.success && result.data) {
        set({ plugins: result.data as unknown as PluginStatus[] })
      }
    } catch {
      // scan failed silently
    }
  }
}))
