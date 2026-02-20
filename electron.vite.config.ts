import { createRequire } from 'module'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

function analyzePlugin(): Plugin | null {
  if (process.env.ANALYZE !== '1') return null
  const { visualizer } = require('rollup-plugin-visualizer') as typeof import('rollup-plugin-visualizer')
  return visualizer({ open: true, filename: 'bundle-stats.html', gzipSize: true }) as Plugin
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron-updater']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [react(), tailwindcss(), analyzePlugin()].filter(Boolean) as Plugin[],
    build: {
      rollupOptions: {
        output: {
          // Code-split heavy dependencies into separate chunks
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'vendor-three'
            if (id.includes('node_modules/cannon-es')) return 'vendor-physics'
            if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi')) return 'vendor-pixi'
            if (id.includes('node_modules/@tiptap')) return 'vendor-tiptap'
            if (id.includes('node_modules/livekit-client')) return 'vendor-livekit'
          }
        }
      }
    }
  }
})
