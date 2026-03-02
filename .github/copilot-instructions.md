# GitHub Copilot Instructions

## Commands

| Command | Purpose |
|---------|---------|
| `npx electron-vite dev` | Dev mode with hot reload |
| `npx electron-vite build` | Production build |
| `npx tsc --build` | Type-check all three tsconfigs |
| `npm run build:win` | Build Windows NSIS installer |
| `npm test` | Run all Vitest tests |
| `npx vitest run src/path/to/file.test.ts` | Run a single test file |
| `npm run lint` | Biome static analysis |
| `npm run lint:fix` | Biome auto-fix |
| `npm run format` | Biome formatter |
| `ANALYZE=1 npx electron-vite build` | Build with bundle stats |

## Architecture

This is a Windows Electron app (D&D Virtual Tabletop) with three isolated processes:

- **Main** (`src/main/`) — Node.js process. Handles window lifecycle, all file I/O, IPC registration, AI DM service, plugin protocol, and auto-updates. Entry: `src/main/index.ts`.
- **Preload** (`src/preload/index.ts`) — Sandboxed bridge. Exposes `window.api` to the renderer via `contextBridge`. The full API surface is typed in `src/preload/index.d.ts`.
- **Renderer** (`src/renderer/src/`) — React 19 SPA using `MemoryRouter`. All routes are lazy-loaded; root is `App.tsx`.

**The renderer has zero direct file system access.** Everything goes through `window.api.*` IPC calls, which invoke handlers in `src/main/ipc/`. IPC channel strings are exclusively defined in `src/shared/ipc-channels.ts` — never use string literals.

### IPC Pattern

```ts
// renderer side — always use window.api, never ipcRenderer directly
const result = await window.api.character.saveCharacter(char)

// main side — handlers registered in src/main/ipc/index.ts
// delegates to: storage-handlers.ts, ai-handlers.ts, audio-handlers.ts,
//               game-data-handlers.ts, plugin-handlers.ts
```

Storage IPC calls return `StorageResult<T> = { success: boolean; data?: T; error?: string }`. File access is path-whitelisted to `userData` dir or dialog-selected paths (60 s TTL).

### State Management

Zustand v5 stores in `src/renderer/src/stores/`. Two large stores use slice composition:

- **Game store** (`use-game-store.ts`) — 12 slices: initiative, conditions, effects, fog, map tokens, combat log, journal, shop, sidebar, time, timer, vision.
- **Builder store** (`use-builder-store.ts`) — 6 slices for the character creation wizard.

Other stores (one file each): character, campaign, bastion, data, AI DM, network, lobby, library, macro, plugin, accessibility, level-up.

`useDataStore` holds all cached game data (85+ JSON files from `src/renderer/public/data/5e/`). Data is loaded via `window.api.game.*` IPC and cached — never read JSON files directly in the renderer.

### Rendering Pipeline

- **Map canvas** — PixiJS 8 via `@pixi/react`. Layers in `src/renderer/src/components/game/map/`: grid, walls, fog, lighting, weather, tokens, AoE, movement overlays.
- **3D Dice** — Three.js + cannon-es physics in `src/renderer/src/components/game/dice3d/`.
- **Rich text** — TipTap in journal components.

### Networking

PeerJS WebRTC P2P in `src/renderer/src/network/`. The DM runs `host-manager.ts`; players run `client-manager.ts`. All messages are typed constants (in `message-types.ts`) and validated with Zod schemas (`schemas.ts`). Rate-limited to 10 msg/s per peer. Heartbeat: 15 s interval, 45 s timeout.

### AI DM

`src/main/ai/` — Claude API (primary) with Ollama fallback. `ai-service.ts` manages streaming via LangChain. Per-campaign `ConversationManager` handles context compression and token budgeting. Web search requires explicit DM approval (30 s timeout). Context is built from character sheets, campaign data, and a keyword-extracted SRD index.

### Plugin System

Two plugin types: **content packs** (JSON data extension) and **code plugins** (loaded via `plugin://` custom protocol). Plugin registry and API in `src/renderer/src/services/plugin-system/`. Installed to `userData/plugins/`.

### Game System Registry

`src/renderer/src/systems/` contains an extensible registry (`registry.ts`) initialized at startup (`init.ts`). Currently only `dnd5e` is registered. New game systems plug in here.

## Key Conventions

### TypeScript / Modules
- Three separate tsconfigs: root (references), `tsconfig.node.json` (main + preload + shared), `tsconfig.web.json` (renderer). Strict mode + `isolatedModules: true` everywhere.
- Path alias `@renderer` → `src/renderer/src/` in both Vite and Vitest.
- Shared code (IPC channels, Zod schemas, plugin types) lives in `src/shared/` and is imported by all three processes.

### React
- **Functional components only.** No class components.
- **`export default` required** on every component — `React.lazy` compatibility.
- Global JSX namespace declared in `src/renderer/src/global.d.ts` (required by React 19).
- `__APP_VERSION__` is a compile-time constant injected from `package.json`.

### Styling
- **Tailwind CSS v4 only.** No CSS modules, no inline styles, no external UI component libraries.
- UI scale is applied to `document.documentElement.fontSize` (rem-based), so Tailwind scales with it.

### File Naming
- React components: `PascalCase.tsx`
- Services, stores, utilities, hooks: `kebab-case.ts`
- Tests are co-located: `foo.ts` → `foo.test.ts`
- Components under `builder/`, `sheet/`, `levelup/` are split into `5e/` and `shared/` subdirectories.

### Logging
- **Main process:** `logToFile()` from `src/main/log.ts` → `userData/logs/app.log` (5 MB rotation).
- **Renderer:** `logger.*()` from `src/renderer/src/utils/logger.ts` — only emits in dev mode.

### Security
`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. CSP header enforced in `src/main/index.ts`. External URLs are opened in the system browser, never in the app window.

### Data Loading Pattern
Module-level data loader functions (e.g., `loadEquipmentData()`) are called once in `App.tsx`'s startup `useEffect` via dynamic imports. They cache their result and are no-ops on subsequent calls. Follow this pattern when adding new data files.

### Network Messages
Always define new message types in `src/renderer/src/network/message-types.ts` and add a Zod schema in `schemas.ts`. Validate before processing in `host-message-handlers.ts`.
