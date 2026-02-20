# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

Node.js PATH must be prepended in shell sessions:
```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

| Command | Purpose |
|---------|---------|
| `npx electron-vite dev` | Launch app with hot reload |
| `npx electron-vite build` | Production build |
| `npx tsc --build` | Type-check all projects (main + preload + renderer) |
| `npm run build:win` | Build Windows installer via electron-builder |

| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage |

Tests are co-located next to source files (`*.test.ts`). Vitest config in `vitest.config.ts` (node env, `@renderer` alias).

## Architecture

**Electron three-process model:**
- **Main** (`src/main/`) — Window lifecycle, IPC handlers, file storage, AI DM service
- **Preload** (`src/preload/`) — Context-isolated bridge exposing `window.api` (typed in `index.d.ts`)
- **Renderer** (`src/renderer/`) — React 19 SPA with MemoryRouter

**State management:** 9 Zustand v5 stores. The builder store uses a slice architecture split across 6 files in `src/renderer/src/stores/builder/slices/`.

**Networking:** PeerJS WebRTC P2P with host-manager (DM) and client-manager (player) in `src/renderer/src/network/`. 50+ message types.

**Storage:** All data stored as JSON files via Electron's `app.getPath('userData')`. IPC calls return `StorageResult<T> = { success, data?, error? }`.

**Rendering:** PixiJS for map canvas, Three.js + cannon-es for 3D dice physics, TipTap for journal rich text.

## Key Conventions

- **System split:** Components under `builder/`, `sheet/`, `levelup/` have `5e/` and `shared/` subdirs (5e only)
- **All styling:** Tailwind CSS v4 utility classes only — no CSS modules or external UI libraries
- **React 19:** Requires global JSX declaration in `src/renderer/src/global.d.ts`
- **Preload types:** `src/preload/index.d.ts` is included in `tsconfig.web.json` for `window.api` typing
- **TypeScript strict mode** enabled across all configs
- **Functional components only** — no class components
- **File naming:** Components are PascalCase `.tsx`, services/utils are kebab-case `.ts`
- **Route structure:** System-prefixed routes (`/characters/5e/...`)
- **Data files:** Static JSON in `src/renderer/public/data/5e/` (30+ files: classes, spells, equipment, species, etc.)

## Important Paths

| Path | Purpose |
|------|---------|
| `src/renderer/src/App.tsx` | React Router root (all routes) |
| `src/renderer/src/stores/builder/` | Builder store slices |
| `src/renderer/src/services/stat-calculator-5e.ts` | Character stat computation |
| `src/renderer/src/services/data-provider.ts` | Game data loading with cache |
| `src/renderer/src/components/game/` | In-game UI (map, dice, DM tools, player HUD, modals, overlays) |
| `src/renderer/src/network/` | P2P networking (host/client managers, voice, types) |
| `src/main/ipc/` | IPC handler registration |
| `src/main/ai/` | AI DM integration (Claude API + Ollama) |
| `src/main/storage/` | File-based CRUD (characters, campaigns, bastions, AI conversations) |

## Type System

Character type hierarchy: `Character = Character5e` (union type, currently 5e only). Key types in `src/renderer/src/types/`:
- `character-5e.ts` — Full character model with `BuildChoices5e`
- `game-state.ts` — `GameState`, `InitiativeEntry`, `TurnState`
- `builder.ts` — `BuildSlot`, `BuildSlotCategory`, foundation slot IDs
- `campaign.ts`, `monster.ts`, `encounter.ts`, `effects.ts`, `bastion.ts`

## IPC Channels

Storage: `storage:save/load/delete-character`, `storage:save/load/delete-campaign`, `storage:save/load/delete-bastion`
AI DM: `ai:configure`, `ai:chat-stream`, `ai:cancel-stream`, `ai:apply-mutations`, plus Ollama-specific channels
Window: `window:toggle-fullscreen`, `window:open-devtools`
Files: `fs:read-file`, `fs:write-file` (path-whitelisted)
