# Phase 3 — Code Quality, Testing & Architecture

You are working on **dnd-vtt**, an Electron + React 19 + Zustand D&D virtual tabletop. This phase improves maintainability, adds testing infrastructure, and cleans up architectural debt. No new user-facing features.

Refer to `CLAUDE.md` for build commands, architecture, and key paths.

---

## 1. Extract magic numbers into constants

**Create:** `src/renderer/src/config/constants.ts`

Centralize all scattered magic numbers:

| Constant | Value | Used In |
|----------|-------|---------|
| `CONNECTION_TIMEOUT_MS` | 15000 | client-manager |
| `RECONNECT_DELAY_MS` | 2000 | client-manager |
| `MAX_RECONNECT_RETRIES` | 3 | client-manager |
| `MESSAGE_SIZE_LIMIT` | 65536 | host-manager |
| `FILE_SIZE_LIMIT` | 8 * 1024 * 1024 | host-manager |
| `MAX_CHAT_LENGTH` | 2000 | useLobbyStore |
| `MAX_DISPLAY_NAME_LENGTH` | 32 | host-manager |
| `RATE_LIMIT_WINDOW_MS` | 10000 | host-manager |
| `VAD_THRESHOLD` | 30 | voice-manager |
| `VAD_CHECK_INTERVAL_MS` | 100 | voice-manager |
| `LOADING_GRACE_PERIOD_MS` | 4000 | InGamePage |
| `VOICE_RETRY_COUNT` | 10 | voice-manager |
| `VOICE_RETRY_INTERVAL_MS` | 1000 | voice-manager |
| `LOBBY_COPY_TIMEOUT_MS` | 2000 | LobbyPage |

Import and use these everywhere instead of the raw numbers.

---

## 2. Create a logger utility

**Create:** `src/renderer/src/utils/logger.ts`

Replace 80+ `console.log`/`warn`/`error` calls with a leveled logger:

```typescript
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
const CURRENT_LEVEL = import.meta.env.DEV ? 'debug' : 'warn'

export const logger = {
  debug: (...args: unknown[]) => { if (LOG_LEVELS[CURRENT_LEVEL] <= 0) console.log('[DEBUG]', ...args) },
  info: (...args: unknown[]) => { if (LOG_LEVELS[CURRENT_LEVEL] <= 1) console.info('[INFO]', ...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVELS[CURRENT_LEVEL] <= 2) console.warn('[WARN]', ...args) },
  error: (...args: unknown[]) => { console.error('[ERROR]', ...args) },
}
```

Replace all `console.log`/`warn`/`error` calls in networking, storage, and store files with the appropriate logger level.

---

## 3. Remove `any` types

**Files:** `host-manager.ts`, `client-manager.ts`, `voice-manager.ts`, `systems/dnd5e/index.ts`, `data-provider.ts`, `save-slice.ts`

- `validateMessage(msg: any)` → `validateMessage(msg: unknown)` with type guards
- System adapter functions returning `any[]` → proper typed returns
- `data-provider.ts` functions → add generic type parameters
- Filter/map chains using `(s: any)` → typed parameters

---

## 4. Deduplicate shared code

- **`generateInviteCode`**: exists in both `peer-manager.ts` and `useCampaignStore.ts`. Extract to `src/renderer/src/utils/invite-code.ts`.
- **`isValidUUID`**: duplicated in `ipc/index.ts` and storage modules. Extract to `src/shared/utils/uuid.ts` (shared between main and renderer).
- **Ban-loading logic**: duplicated between `startHosting()` and `setCampaignId()`. Extract to a shared `loadBansForCampaign(id)` helper.
- **Kick/ban logic**: ~80% shared between `kickPeer` and `banPeer`. Extract shared `disconnectPeer(peerId, message)` helper.
- **`SKILL_DEFINITIONS`**: duplicated in `systems/dnd5e/index.ts` and `SkillsModal.tsx`. Use single source of truth.

---

## 5. IPC channel name constants

**Create:** `src/shared/ipc-channels.ts`

Replace string literals in `src/preload/index.ts` and `src/main/ipc/index.ts` with shared constants:
```typescript
export const IPC = {
  SAVE_CHARACTER: 'storage:save-character',
  LOAD_CHARACTERS: 'storage:load-characters',
  // ... all channels
} as const
```

---

## 6. Data cache improvements

**File:** `src/renderer/src/services/data-provider.ts`

- Add LRU eviction (e.g., max 50 cached entries).
- Don't cache failed fetch results — if the promise rejects, delete it from the cache.
- Check `res.ok` before calling `res.json()`.

---

## 7. Data migration/versioning system

**Files:** Storage modules in `src/main/storage/`

Add a `schemaVersion` field to all persisted data (characters, campaigns, bastions). Create a migration pipeline that runs on load:

```typescript
const CURRENT_VERSION = 2
function migrate(data: unknown): Character5e {
  let version = (data as any).schemaVersion ?? 1
  if (version < 2) { /* apply v1→v2 migration */ }
  return validated as Character5e
}
```

---

## 8. Add Vitest + initial test suite

**Setup:** Add Vitest to `package.json` (it should already be configured per `CLAUDE.md`). If not, add it.

Write tests for these high-value pure-function targets:
- `stat-calculator-5e.ts` — HP calculation (including level 1, multiclass, low CON), AC, ability modifiers, proficiency bonus
- `build-tree-5e.ts` — slot generation for single-class and multiclass
- `character-io.ts` / `campaign-io.ts` — serialization round-trip, malformed input handling
- Network message validation — valid and invalid payloads

Place tests next to source files as `*.test.ts`.

---

## 9. Resolve circular dependencies

**Files:** `useNetworkStore.ts`, `useLobbyStore.ts`, `dm-action-executor.ts`

- `useNetworkStore` imports `useLobbyStore` and vice versa. Break the cycle using `getState()` for cross-store reads instead of direct imports.
- `dm-action-executor.ts` uses `require('../stores/useAiDmStore')` to avoid circular deps. Refactor so a static import can be used.

---

## Acceptance Criteria

- Zero raw `console.log` calls remain in networking/storage code (all replaced with logger).
- No magic number literals in networking, voice, or timer code (all use constants).
- Zero `any` types in `validateMessage`, system adapters, and data-provider.
- `generateInviteCode`, `isValidUUID`, ban-loading, kick/ban each exist in exactly one place.
- At least 20 tests pass via `npm test`.
- `npx tsc --build` passes.
