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
| `npm run lint` | Biome static analysis (`biome check src/`) |
| `npm run lint:fix` | Biome auto-fix (`biome check --write src/`) |
| `npm run format` | Biome formatter (`biome format --write src/`) |

Tests are co-located next to source files (`*.test.ts`). Vitest config in `vitest.config.ts` (node env, `@renderer` alias). Coverage targets `services/` and `data/` only.

Run a single test file: `npx vitest run src/path/to/file.test.ts`

## Architecture

**Electron three-process model:**
- **Main** (`src/main/`) — Window lifecycle, IPC handlers, file storage, AI DM service, plugin system
- **Preload** (`src/preload/`) — Context-isolated bridge exposing `window.api` (typed in `index.d.ts`)
- **Renderer** (`src/renderer/`) — React 19 SPA with MemoryRouter, lazy-loaded routes

**State management:** Zustand v5 stores, several using slice architecture:
- Builder store: 6 slices in `src/renderer/src/stores/builder/slices/`
- Game store: 10 slices in `src/renderer/src/stores/game/`
- Other stores: character, campaign, bastion, data, AI DM, network, lobby, library, macro, plugin, accessibility, level-up

**Networking:** PeerJS WebRTC P2P with host-manager (DM) and client-manager (player) in `src/renderer/src/network/`. 79 typed message constants. Zod-validated payloads. Rate limiting (10 msg/s per peer). Heartbeat (15s interval, 45s timeout).

**Storage:** All data stored as JSON files via Electron's `app.getPath('userData')`. IPC calls return `StorageResult<T> = { success, data?, error? }`. File access path-whitelisted to userData dir or dialog-selected paths (60s TTL).

**Rendering:** PixiJS for map canvas (grid, walls, fog, lighting, weather, tokens), Three.js + cannon-es for 3D dice physics, TipTap for journal rich text.

**AI DM:** Claude API primary, Ollama fallback. Per-campaign conversation manager with context compression. Exponential backoff retry. Web search requires DM approval (30s timeout). Streaming via IPC events.

**Plugin system:** Content packs (JSON data extension) and code plugins (`plugin://` protocol), stored in `userData/plugins/`.

## Key Conventions

- **System split:** Components under `builder/`, `sheet/`, `levelup/` have `5e/` and `shared/` subdirs (5e only for now)
- **All styling:** Tailwind CSS v4 utility classes only — no CSS modules, inline styles, or external UI libraries
- **React 19:** Requires global JSX declaration in `src/renderer/src/global.d.ts`
- **Preload types:** `src/preload/index.d.ts` is included in `tsconfig.web.json` for `window.api` typing
- **TypeScript strict mode** enabled across all configs with `isolatedModules: true`
- **Functional components only** — no class components
- **`export default` required** on all components (React.lazy compatibility)
- **File naming:** Components are PascalCase `.tsx`, services/utils/stores are kebab-case `.ts`
- **Route structure:** System-prefixed routes (`/characters/5e/...`)
- **IPC channels:** All channel strings from `IPC_CHANNELS` in `src/shared/ipc-channels.ts` — never use string literals
- **Path alias:** `@renderer` → `src/renderer/src/` in both Vite and Vitest configs
- **Data files:** Static JSON in `src/renderer/public/data/5e/` (85+ files), served through `window.api.game.*` IPC, cached in `useDataStore`
- **Error logging (main):** `logToFile()` in `src/main/log.ts` → `userData/logs/app.log` (5MB rotation)
- **Error logging (renderer):** `logger.*()` in `src/renderer/src/utils/logger.ts` — dev mode only
- **Network validation:** All messages validated with Zod schemas in `network/schemas.ts`; UUID validated before storage IPC
- **Security:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP header enforced

## Important Paths

| Path | Purpose |
|------|---------|
| `src/renderer/src/App.tsx` | React Router root (all routes, lazy-loaded) |
| `src/renderer/src/stores/builder/` | Builder store (6 slices) |
| `src/renderer/src/stores/game/` | Game store (10 slices) |
| `src/renderer/src/services/character/stat-calculator-5e.ts` | Character stat computation |
| `src/renderer/src/services/data-provider.ts` | Game data loading with cache |
| `src/renderer/src/services/combat/` | Attack, damage, effects, flanking, cover, AoE (30+ files) |
| `src/renderer/src/services/character/` | Stats, build tree, spells, rest, companions |
| `src/renderer/src/services/dice/` | Dice engine, service, inline roller |
| `src/renderer/src/services/io/` | Character/campaign IO, auto-save, import/export |
| `src/renderer/src/services/map/` | Pathfinding, visibility, map utilities |
| `src/renderer/src/services/chat-commands/` | 34 files, 26 modular command modules |
| `src/renderer/src/services/sound-manager.ts` | Sound manager (63 events, 9 ambient) |
| `src/renderer/src/components/game/map/` | MapCanvas, PixiJS layers (grid, walls, fog, tokens) |
| `src/renderer/src/components/game/dice3d/` | 3D dice physics + UI |
| `src/renderer/src/components/game/modals/` | 4 subdirs: combat/, dm-tools/, mechanics/, utility/ |
| `src/renderer/src/components/game/overlays/` | 24 overlay components |
| `src/renderer/src/components/ui/` | 19 shared UI primitives |
| `src/renderer/src/constants/` | App constants, damage types, spell schools |
| `src/renderer/src/network/` | P2P networking (host/client managers, voice, types) |
| `src/renderer/src/types/` | TypeScript types (20 files) |
| `src/main/ipc/` | IPC handler registration (delegates to 5 handler files) |
| `src/main/ai/` | AI DM integration (26 files) |
| `src/main/storage/` | File-based CRUD (10 files) |
| `src/shared/` | IPC channels, schemas, plugin types, shared utils |

## Type System

Character type hierarchy: `Character = Character5e` (union type, currently 5e only). Key types in `src/renderer/src/types/`:
- `character-5e.ts` — Full character model with `BuildChoices5e`
- `game-state.ts` — `GameState`, `InitiativeEntry`, `TurnState`
- `builder.ts` — `BuildSlot`, `BuildSlotCategory`, foundation slot IDs
- `campaign.ts`, `monster.ts`, `encounter.ts`, `effects.ts`, `bastion.ts`

## IPC Channels

All defined in `src/shared/ipc-channels.ts` (170 named channels). Key categories:
- Storage: character, campaign, bastion, homebrew, custom creature, game state, bans, settings
- AI DM: configure, chat stream, cancel, mutations, Ollama management, memory, NPC tracking (40+ channels)
- Window: toggle-fullscreen, is-fullscreen, open-devtools
- Files: read-file, write-file, write-file-binary (path-whitelisted)
- Audio: upload, list, delete, path, pick custom audio tracks
- Plugins: scan, enable, disable, load, install, uninstall
- Cloud Sync: upload, download, list (S3-backed)
- Game Data: load all 85+ JSON data files by category
- Updates: check, download, install, status listener

## Build Configuration

- **Vendor chunking:** Three.js, cannon-es, PixiJS, TipTap split into separate chunks
- **Bundle analysis:** Set `ANALYZE=1` env var to generate bundle stats
- **`__APP_VERSION__`** injected from `package.json` at build time
- **Three tsconfigs:** root (references node + web), `tsconfig.node.json` (main + preload + shared), `tsconfig.web.json` (renderer)
