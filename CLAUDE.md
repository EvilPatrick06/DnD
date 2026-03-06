# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

| Command | Purpose |
|---------|---------|
| `npx electron-vite dev` | Launch app in dev mode with hot reload |
| `npx electron-vite build` | Production build |
| `npx vitest run` | Run all tests (512+ tests, 29 files) |
| `npx vitest run src/path/to/file.test.ts` | Run a single test file |
| `npx vitest --watch` | Watch mode |
| `npx biome check src/` | Lint |
| `npx biome check --write src/` | Lint with auto-fix |
| `npx biome format --write src/` | Format |
| `npx tsc --noEmit` | Type check (0 errors expected) |

**Windows note:** Shell sessions may need `export PATH="C:\Program Files\nodejs;$PATH"` prepended for node/npm.

## Architecture

**Electron 40 + React 19 + TypeScript 5.9** app — a D&D 5e virtual tabletop (VTT).

### Process Structure
- **Main process** (`src/main/`): Window management, IPC handlers (`src/main/ipc/`), AI integration (`src/main/ai/`), file storage (`src/main/storage/`), auto-updater, plugin system
- **Preload** (`src/preload/`): `contextBridge` exposing `window.api.*` — security: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
- **Renderer** (`src/renderer/src/`): React SPA with all UI, game logic, networking
- **Shared** (`src/shared/`): IPC channel constants (`IPC_CHANNELS`), Zod IPC schemas, plugin types

### IPC Pattern
All IPC channel strings are centralized in `src/shared/ipc-channels.ts`. The preload script exposes them via `contextBridge`. Renderer calls `window.api.*` methods. Never use raw `ipcRenderer` in the renderer.

### State Management — Zustand v5 Slice Pattern
10+ stores in `src/renderer/src/stores/`. Large stores use composable slices:
- **Game store** (`stores/game/`): 12 slices (combat-log, fog, initiative, journal, map-token, vision, etc.)
- **Builder store** (`stores/builder/slices/`): 6 slices (ability-score, build-actions, character-details, core, save, selection)

### Networking — PeerJS WebRTC P2P
`src/renderer/src/network/` — singleton `PeerManager`, host/client split, Zod-validated messages, exponential backoff reconnect. ICE uses Cloudflare STUN/TURN.

### Routing
React Router v7 in `App.tsx` with 15 `React.lazy()` routes. All components must have `export default` for lazy loading.

### Data
85+ JSON files in `src/renderer/public/data/5e/`. Loaded via `data-provider.ts` which uses IPC with in-memory caching and optional CDN fallback.

### Game Systems
Pluggable registry at `src/renderer/src/systems/`. D&D 5e implementation in `systems/dnd5e/`. `GameSystemPlugin` interface allows additional systems.

### AI DM
Claude API (`@anthropic-ai/sdk`) + Ollama fallback in main process. Streaming via IPC events (`ai:stream-chunk`, `ai:stream-done`, `ai:stream-error`).

### Key Renderer Directories
- `components/game/map/` — PixiJS map canvas, grid, walls, tokens, overlays
- `components/game/dice3d/` — Three.js + cannon-es 3D dice physics
- `components/game/modals/` — Subdirs: `combat/`, `dm-tools/`, `mechanics/`, `utility/`
- `services/` — Business logic with subdirs: `combat/`, `character/`, `dice/`, `io/`, `map/`, `chat-commands/`
- `constants/` — `app-constants.ts`, `damage-types.ts`, `spell-schools.ts`

## Code Style

**Biome** (not ESLint/Prettier): 2-space indent, single quotes, no semicolons, no trailing commas, 120-char line width.

Key lint rules:
- `noExplicitAny`: warn (off in tests)
- `noUnusedImports`: warn
- `useExhaustiveDependencies`: warn
- Accessibility rules: disabled

## Testing

**Vitest** with tests co-located next to source (e.g., `foo.test.ts` beside `foo.ts`). Test timeout: 15 seconds. Coverage covers `services/` and `data/` dirs.

## Conventions

- Storage uses async `fs/promises` returning `StorageResult<T>` pattern
- Path alias: `@renderer` → `src/renderer/src` (in imports)
- React 19 requires the global JSX declaration in `src/renderer/src/global.d.ts`
- `__APP_VERSION__` is injected at build time from `package.json`
- Tailwind v4 CSS-first config (via `@import "tailwindcss"` in `globals.css`)
