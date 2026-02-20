# Plan 11 — Project Review: Bugs, Features, QoL, and Suggestions

---

## Bug Fixes

### 1. `startInitiative` mutates entries in place
**File:** `src/renderer/src/stores/useGameStore.ts` (lines 138–142)

The spread `[...entries]` creates a shallow copy of the array, but the objects inside are still the original references. Mutating `e.isActive` directly modifies the caller's data. Should use `.map()` like `nextTurn` and `prevTurn` already do:

```typescript
const sorted = [...entries]
  .sort((a, b) => b.total - a.total)
  .map((e, i) => ({ ...e, isActive: i === 0 }))
```

---

### 2. Force-deafen clobbers existing mute state
**Files:**
- `src/renderer/src/stores/useLobbyStore.ts` (lines 299–306)
- `src/renderer/src/pages/LobbyPage.tsx` (lines 373–378)

When *un*-deafening, the lobby page handler sets `isForceMuted = false`, wiping out a pre-existing force-mute. Should preserve the existing `isForceMuted` state when `isForceDeafened` goes to `false`:

```typescript
const player = useLobbyStore.getState().players.find(p => p.peerId === payload.peerId)
const isForceMuted = payload.isForceDeafened ? true : (player?.isForceMuted ?? false)
```

---

### 3. `loadJson` has no error handling
**File:** `src/renderer/src/services/data-provider.ts` (lines 7–13)

If `fetch` returns a 404 or non-OK response, `res.json()` will throw a cryptic error. This also caches failed results if the promise partially resolves. Should check `res.ok`:

```typescript
const res = await fetch(path)
if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`)
const data = await res.json()
```

---

### 4. Chat messages grow unbounded
**File:** `src/renderer/src/stores/useLobbyStore.ts` (lines 179–183)

During a long session, the `chatMessages` array grows forever. Consider capping it (e.g., last 500 messages) to prevent memory issues:

```typescript
chatMessages: [...state.chatMessages, msg].slice(-500)
```

---

### 5. Fog brush computes cells but doesn't pass them
**File:** `src/renderer/src/components/game/MapCanvas.tsx` (lines 316–327)

The `cells` array is computed but never used — only the center `gridX, gridY` is passed to `onCellClick`. The brush-size feature appears broken. You likely want `onFogBrush(cells)` or similar.

---

### 6. `setCampaignId` race condition with ban loading
**File:** `src/renderer/src/network/host-manager.ts` (lines 289–301)

This is a fire-and-forget async call. A banned peer could connect in the window between `setCampaignId` being called and the `.then()` resolving. Consider loading bans *before* accepting connections, or queuing connections until bans are loaded.

---

## Quality of Life Improvements

### 7. Add a toast/notification system
Right now errors and status changes are mostly `console.log`/`console.warn`. Users never see messages like "Failed to load bans" or "Peer rate limited." A lightweight toast system would surface these to the DM and players.

---

### 8. Keyboard shortcut help overlay
The map canvas uses Space for panning, middle-click for panning, and scroll for zoom — but users have no way to discover these. A `?` keyboard shortcut that shows an overlay of all controls would be a big UX win.

---

### 9. Clipboard fallback is incomplete
**File:** `src/renderer/src/pages/LobbyPage.tsx` (lines 418–429)

The fallback comment says "select the text" but doesn't actually do it. You could use the old `document.execCommand('copy')` pattern or at least show a "copy failed" toast so the user knows to do it manually.

---

### 10. Whisper command doesn't actually send to a specific player
**File:** `src/renderer/src/stores/useLobbyStore.ts` (`sendChat` — `/w` handler)

The `/w` command creates a local message that *looks* like a whisper, but it never sends it over the network to the target player. It's purely cosmetic. This should either be implemented fully (route through host to the target peer) or flagged in the UI as "coming soon."

---

### 11. No data cache invalidation
**File:** `src/renderer/src/services/data-provider.ts`

The cache is a simple `Map` with no TTL or invalidation. If the user modifies game data files and restarts, stale data could still be served until the app is fully restarted. Consider clearing cache on window focus or providing a manual "reload game data" option.

---

## New Feature Suggestions

### 12. Undo/redo for token movement
Token moves on the map are one-shot. Accidentally dragging a token to the wrong cell has no undo. A simple action stack (last 20–30 moves) would let the DM `Ctrl+Z` to undo.

---

### 13. Map ping/waypoint system
Players and the DM should be able to ping a location on the map (e.g., double-click shows a temporary beacon). This is standard in VTTs and helps with "look here" communication.

---

### 14. Dice roller history
The dice results vanish into the chat. A dedicated "Dice History" panel or sidebar that shows a filterable log of all rolls (with who rolled what) would help the DM track things.

---

### 15. Session notes / journal
The DM Notepad exists, but there's no per-session journaling or export. Being able to save session notes timestamped to each game would be valuable for recaps.

---

### 16. Auto-save game state
If the host's app crashes, all game state (token positions, initiative, fog) is lost. Periodically auto-saving game state to disk (e.g., every 60 seconds) would allow recovery.

---

### 17. Player character quick-reference for DM
During a game, the DM should be able to hover over a player's token and see their key stats (AC, HP, passive Perception) without opening a full sheet.

---

### 18. Map layers / multiple map support with tabs
The store supports multiple maps, but the UI could benefit from tabs to quickly switch between maps (e.g., overworld, dungeon floor 1, dungeon floor 2).

---

## Code Quality & Architecture

### 19. Replace `any` types throughout
Several files use `any` where `unknown` would be safer:

- `host-manager.ts:434` — `validateMessage(msg: any)` should be `unknown`
- `systems/pf2e/index.ts` and `systems/dnd5e/index.ts` — multiple `any[]` return types
- `data-provider.ts:515–541` — several functions return `Promise<unknown[]>` which is better than `any` but could have proper types

---

### 20. Extract kick/ban into shared helper
**File:** `src/renderer/src/network/host-manager.ts`

`kickPeer` and `banPeer` share ~80% of their logic (send message, close connection, clean up maps, notify callbacks). Extract a shared `disconnectPeer(peerId, message)` helper to reduce duplication.

---

### 21. Module-level mutable state in host-manager
**File:** `src/renderer/src/network/host-manager.ts`

Uses ~15 module-level `let` variables and mutable `Map`/`Set` instances. This makes it hard to test and reason about. Consider encapsulating into a class or at least a factory function that returns a disposable instance.

---

### 22. `generateInviteCode` is duplicated
Exists in both `peer-manager.ts` and `useCampaignStore.ts`. Extract to a shared utility.

---

### 23. Missing `aria-label` attributes throughout
Interactive elements (copy button, close buttons, voice controls) lack accessibility labels. The map canvas is entirely inaccessible to screen readers. Even minimal ARIA labels on buttons would improve things.

---

### 24. `removeFromInitiative` edge case
**File:** `src/renderer/src/stores/useGameStore.ts` (lines 229–251)

If the *active* entry is removed and it was the last entry in the list, `currentIndex` clamps correctly, but the `round` doesn't increment. If the active entry was in the middle and gets removed, the next entry effectively gets skipped because the index stays the same but the array shifted. This needs more careful index management.

---

## Security Improvements

### 25. Chat content is not HTML-sanitized
Messages are filtered for blocked words but not for HTML injection. If chat content is rendered as `dangerouslySetInnerHTML` or via a markdown renderer anywhere, XSS is possible. Ensure all chat content is rendered as plain text or sanitized.

---

### 26. File message validation is incomplete
The host validates MIME type against an allowlist, but the actual file content (`fileData` base64 string) is never verified to match the claimed MIME type. A malicious client could send executable content with an `image/png` MIME type.

---

### 27. No total memory limit for network messages
The per-message size limit is 8MB for files, but there's no cap on total buffered data per peer. A slow client could flood the host with many messages just under the limit.

---

## Performance

### 28. Token re-rendering clears and rebuilds all sprites
**File:** `src/renderer/src/components/game/MapCanvas.tsx`

`renderTokens` calls `removeChildren()` and recreates every sprite from scratch whenever any token changes. For maps with many tokens, diffing and only updating changed tokens would be much more efficient.

---

### 29. `updatePeer` in network store creates new array every time
Each peer update creates a new array via `.map()`. For frequent updates (speaking indicators, positions), switching to a `Map<string, PeerInfo>` and converting to array only when consumed would reduce GC pressure.
