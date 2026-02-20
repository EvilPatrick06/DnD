# Phase 1 — Critical Bugs & Data Safety

You are working on **dnd-vtt**, an Electron + React 19 + Zustand D&D virtual tabletop app. This phase focuses on fixing bugs that cause crashes, data loss, or security vulnerabilities. Do not add new features. Fix only what is listed below.

Refer to `CLAUDE.md` for build commands, architecture, and key paths.

---

## 1. Path traversal vulnerability

**Files:** `src/main/ipc/index.ts`

The `startsWith()` path validation can be bypassed (e.g., `userData/../../../etc/passwd`). Replace with `path.relative()` validation:

```typescript
const rel = path.relative(userData, normalized)
if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
  return true
}
```

Also fix `audio-handlers.ts` — `campaignId` is used in paths without UUID validation.

---

## 2. JSON.parse without try/catch

**Files:** `character-io.ts`, `campaign-io.ts`, `host-manager.ts`, `client-manager.ts`, `src/main/ipc/index.ts`, `characterStorage.ts`, `campaignStorage.ts`

Wrap every `JSON.parse` call in try/catch. Return structured errors `{ success: false, error: string }` instead of letting parse errors propagate.

---

## 3. Unsafe type assertions / no data validation on load

**Files:** `useCharacterStore.ts`, `useCampaignStore.ts`, all stores that load from IPC

Every store uses `as unknown as Character[]` etc. without runtime checks. Add lightweight runtime validation (Zod schemas or manual shape checks) so corrupted save files produce an error message instead of crashing.

---

## 4. Race conditions on saves

**Files:** `useCharacterStore.ts`, `useCampaignStore.ts`, `CharacterBuilder5e.tsx`

Rapid saves can overwrite each other. The double-save guard in CharacterBuilder5e has a timing window between the `if (saving)` check and `setSaving(true)`.

Fix: serialize writes with a queue or mutex. For the builder, use a ref-based guard instead of state.

---

## 5. Recursive reconnection stack overflow

**File:** `src/renderer/src/network/client-manager.ts`

`attemptConnection` calls itself recursively on failure. Replace with an iterative retry loop using `setTimeout` or an async while loop with delay.

---

## 6. Ban list race condition

**File:** `src/renderer/src/network/host-manager.ts`

`setCampaignId` loads bans asynchronously but connections are accepted immediately. A banned peer can connect before bans finish loading. Also, bans are loaded twice between `startHosting` and `setCampaignId`.

Fix: await ban load before accepting connections, or queue incoming connections until bans are ready. Deduplicate ban-loading into a single shared helper.

---

## 7. startInitiative mutates entries in-place

**File:** `src/renderer/src/stores/useGameStore.ts`

`[...entries]` is a shallow copy. `e.isActive = i === 0` mutates the originals. Replace with:
```typescript
const sorted = [...entries]
  .sort((a, b) => b.total - a.total)
  .map((e, i) => ({ ...e, isActive: i === 0 }))
```

---

## 8. HP calculation issues

**File:** `src/renderer/src/services/stat-calculator-5e.ts`

- Level 1 HP should use the full hit die value, not `floor(hitDie/2) + 1`.
- Per-level HP can go negative with low CON. Clamp each level's contribution to a minimum of 1.
- Guard against `hitDie === 0` (malformed class data).

---

## 9. Event listener leaks in network stores

**Files:** `host-manager.ts`, `client-manager.ts`, `voice-manager.ts`, `useNetworkStore.ts`, `GameLayout.tsx`

- `hostGame`/`joinGame` register listeners that are never removed. Calling these multiple times stacks duplicate listeners.
- PeerJS events accumulate on reconnect cycles.
- Voice manager retry intervals are not cleared on failure/unmount.
- `GameLayout` network handler `useEffect` has no cleanup return.

Fix: return cleanup functions from all listener registrations. Track and clear all intervals/timeouts.

---

## 10. PixiJS texture memory leak

**File:** `src/renderer/src/components/game/MapCanvas.tsx`

When the map changes or component unmounts, the background sprite is removed but its GPU texture is never destroyed. Call `destroy({ children: true })` on the sprite before nulling the ref.

---

## 11. Silent error swallowing

**Files:** `SpellsTab.tsx`, `OffenseTab.tsx`, `GearTab.tsx`, `save-slice.ts`, IPC load handlers in `src/main/ipc/index.ts`

- Builder tabs catch errors with empty handlers (`.catch(() => {})`). Add error state and show user-facing messages.
- IPC load handlers return empty arrays on failure instead of propagating errors. Return `{ success, data?, error? }`.
- `save-slice.ts` `Promise.all` has no `.catch()`. Add error handling.

---

## 12. Additional high-priority bugs to fix in this pass

- **ASI modal +2 bug** (`AsiModal.tsx`): Passes `[selected[0], selected[0]]` instead of single ability with +2. Add cap check for 20.
- **Death saves never auto-reset**: Clear death save state when HP restored above 0.
- **NPC initiative total** (`GameLayout.tsx`): `total` uses second `Math.random()`. Fix: `total = roll + modifier`. Wire NPC DEX modifier.
- **NPC not added to active initiative**: `updateInitiativeEntry` on new entry silently drops it. Add `addToInitiative` action to `useGameStore`.
- **Fog brush cells not passed** (`MapCanvas.tsx`): Computed cells array discarded; only center cell sent. Pass full array.
- **Force-deafen clobbers mute**: Preserve existing `isForceMuted` when un-deafening.
- **50+ missing React key props**: Add keys to all list renders in BastionPage, CampaignDetailPage, LobbyPage, ChatPanel, etc.
- **CreateCharacterPage side effect in render**: Move `selectGameSystem` into a `useEffect`.
- **Escape key leaves game when modal open** (`InGamePage.tsx`): Check if any modal is open before navigating.
- **gameStore as useEffect dependency** (`InGamePage.tsx`): Depend on `gameStore.campaignId` instead of the full store. Gate `loadGameState` behind a ref (`hasInitialized`).
- **setTimeout/setInterval leaks**: Add cleanup to all timer effects in LobbyPage, InGamePage, DiceRoller, ViewCharactersPage, ChatInput, voice-manager.
- **Version mismatch**: Inject version at build time in `electron.vite.config.ts` via `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`. Use in MainMenuPage.
- **removeFromInitiative edge case**: Handle index shift when removing the active entry.
- **Array access without bounds check**: Add length checks before `players[0]`, `messages[messages.length-1]`, `entries[nextIndex]`, `cls.keyAbility[0]`.
- **useGameStore.reset() incomplete**: Include `shopOpen`, `shopInventory`, `shopName` in reset.
- **Stale drag state on tool switch**: Clear `dragRef` in `activeTool` effect.
- **IPC null window**: Use `win ?? undefined` in dialog calls.
- **fs:read-file path cleanup**: Move `dialogAllowedPaths.delete` into a `finally` block.

---

## Acceptance Criteria

- `npx tsc --build` passes with no new errors.
- All JSON.parse calls are wrapped in try/catch.
- No `as unknown as X[]` casts without preceding validation.
- All useEffect hooks with timers return cleanup functions.
- All list renders have stable `key` props.
- The app does not crash on corrupted save files — it shows an error.
