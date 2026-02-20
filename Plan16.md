# Plan 16 — Code Review: Bugs, Features & QoL

Generated from full project analysis (Feb 20, 2026).

---

## Critical Bugs

### 1. PixiJS texture memory leak — `MapCanvas.tsx`
**File:** `src/renderer/src/components/game/MapCanvas.tsx`

When the map changes or the component unmounts, the background sprite is removed from the scene but its GPU texture is never destroyed. Each map change accumulates leaked textures.

**Fix:** Call `destroy({ children: true })` on the sprite before nulling the ref in both the cleanup effect and the background-swap effect.

```typescript
// In cleanup effect:
if (bgSpriteRef.current) {
  bgSpriteRef.current.destroy({ children: true })
  bgSpriteRef.current = null
}

// In background loading effect (before replacing sprite):
if (bgSpriteRef.current) {
  worldRef.current?.removeChild(bgSpriteRef.current)
  bgSpriteRef.current.destroy({ children: true })
  bgSpriteRef.current = null
}
```

---

### 2. Reconnection clears character selection — `client-manager.ts`
**File:** `src/renderer/src/network/client-manager.ts`

On reconnect, `characterId` and `characterName` are reset to `null`, losing the player's character selection. Players must re-select their character after every disconnect.

**Fix:** Store them in module-level variables and reuse on retry.

```typescript
let lastCharacterId: string | null = null
let lastCharacterName: string | null = null

// When connecting, persist these values
// On reconnect retry, pass stored values instead of null
```

---

### 3. Silent async failures in character builder — `save-slice.ts`
**File:** `src/renderer/src/stores/builder/slices/save-slice.ts`

`Promise.all()` calls that load race/class/background SRD data have no `.catch()`. If any fetch fails, the builder silently ends up partially initialized with no user feedback.

**Fix:** Add `.catch()` and handle partial failures gracefully.

```typescript
Promise.all([load5eRaces(), load5eClasses(), load5eBackgrounds()])
  .then(([races, classes, bgs]) => {
    // existing logic
  })
  .catch((err) => {
    console.error('[SaveSlice] Failed to load SRD data:', err)
    // Allow editing with partial data rather than leaving broken state
  })
```

---

### 4. Ban race condition — `host-manager.ts`
**File:** `src/renderer/src/network/host-manager.ts`

`setCampaignId` loads bans asynchronously without confirming the campaign ID hasn't changed by the time the result arrives. Rapid campaign switches can apply the wrong ban list.

**Fix:** Capture the ID at call time and compare before applying.

```typescript
export function setCampaignId(id: string): void {
  campaignId = id
  window.api.loadBans(id).then((bans) => {
    if (campaignId !== id) return // stale response, discard
    for (const peerId of bans) {
      bannedPeers.add(peerId)
    }
  }).catch((e) => {
    console.warn('[HostManager] Failed to load bans:', e)
  })
}
```

---

## High Priority Bugs

### 5. Stale drag state on tool switch — `MapCanvas.tsx`
**File:** `src/renderer/src/components/game/MapCanvas.tsx`

Changing tools while mid-drag leaves `dragRef.current` populated. Subsequent pointer events on the new tool can fire with stale drag data, causing incorrect behavior.

**Fix:** Clear drag state in the `activeTool` effect.

```typescript
useEffect(() => {
  if (activeTool !== 'select') {
    dragRef.current = null
  }
  // existing measure clear logic...
}, [activeTool])
```

---

### 6. Event listener leak in `LobbyPage.tsx`
**File:** `src/renderer/src/pages/LobbyPage.tsx`

The audio-resume click handler and `setInterval` may not clean up properly if the component unmounts before the interval fires 5 times. The cleanup function must clear both unconditionally.

**Fix:**

```typescript
useEffect(() => {
  const handler = (): void => {
    resumeAllAudio()
    document.removeEventListener('click', handler)
  }
  document.addEventListener('click', handler)

  let count = 0
  const interval = setInterval(() => {
    count++
    resumeAllAudio()
    if (count >= 5) clearInterval(interval)
  }, 2000)

  return () => {
    document.removeEventListener('click', handler)
    clearInterval(interval)
  }
}, [])
```

---

### 7. `useGameStore.reset()` is incomplete
**File:** `src/renderer/src/stores/useGameStore.ts`

`reset()` restores initial state but does not clear shop state (`shopOpen`, `shopInventory`, `shopName`). Shop panels stay open or retain inventory when starting a new session.

**Fix:** Include all shop fields in the reset.

```typescript
reset: () => set({
  ...initialState,
  shopOpen: false,
  shopInventory: [],
  shopName: 'General Store',
})
```

---

### 8. IPC `save-bans` doesn't validate peer ID array contents
**File:** `src/main/ipc/index.ts`

The `peerIds` array items are not validated for type or length — only the campaign UUID is checked. Malformed peer IDs could cause unexpected storage behavior.

**Fix:**

```typescript
if (!Array.isArray(peerIds)) throw new Error('peerIds must be an array')
if (peerIds.some(id => typeof id !== 'string' || id.length > 100)) {
  throw new Error('Invalid peer ID in array')
}
```

---

## Medium Priority / Missing Features

### 9. No "unsaved changes" warning
**Files:** `CreateCharacterPage`, `CampaignDetailPage`

Navigating away from the character builder or campaign editor with unsaved changes gives no warning. Users can lose progress without realizing it.

**Fix:** Add a `beforeunload` handler and in-app route guard when dirty state is detected.

---

### 10. No React error boundaries
**Files:** All page components

A runtime error in any page component crashes the entire renderer — users see a white screen with no recovery path. Wrapping routes in an `<ErrorBoundary>` would let users navigate back or reload.

---

### 11. No reconnect UI in `InGamePage`
**File:** `src/renderer/src/pages/InGamePage.tsx`

When the connection drops, there is no visible banner, countdown, or retry button. Players sit on a frozen screen with no feedback or action to take.

**Fix:** Surface a reconnect banner with a countdown and manual retry option when disconnect is detected.

---

### 12. No progress indicator on `JoinGamePage` (15s timeout)
**File:** `src/renderer/src/pages/JoinGamePage.tsx`

Users wait up to 15 seconds with a static "connecting" message and no indication of progress. A countdown timer or animated progress bar would significantly improve perceived responsiveness.

---

### 13. No periodic auto-save for in-game state
**File:** `src/renderer/src/pages/InGamePage.tsx`

Token positions, fog-of-war reveals, and map changes are never automatically persisted to disk. A host crash or accidental close loses all in-session state.

**Fix:** Add a debounced auto-save (e.g., 30s after last change) that writes campaign state via IPC.

---

### 14. No warning for empty/default character name
**File:** `src/renderer/src/stores/builder/slices/save-slice.ts`

Character name silently defaults to `"Unnamed Character"` before saving. Should validate and warn the user if the name is blank or still at the default.

---

### 15. Duplicate ban-loading logic
**File:** `src/renderer/src/network/host-manager.ts`

The ban load-and-populate pattern is copy-pasted between `startHosting()` and `setCampaignId()`. Extract to a shared helper so the race condition fix (#4 above) only needs to be applied once.

---

### 16. `hitDie` not guarded against zero in stat calculator
**File:** `src/renderer/src/services/stat-calculator-5e.ts`

If a class entry has a malformed or missing `hitDie`, `Math.floor(0 / 2) + 1 = 1` is silently used for HP with no warning. Should validate and fall back with an explicit log.

```typescript
const hitDie = cls?.hitDie ?? 8
if (hitDie <= 0) {
  console.warn('[StatCalculator] Invalid hitDie for class, using default 8')
  // use fallback
}
```

---

## QoL / Low Priority

### 17. Keyboard shortcuts missing
The following shortcuts would significantly improve daily usability:
- `Ctrl+S` — Save character / campaign
- `Ctrl+C` (when invite code is focused) — Copy invite code
- `/roll <dice>` — Quick dice roll from chat input (e.g., `/roll 2d6+3`)
- `Escape` — Close open panels (shop, notes, condition tracker)
- `Delete` — Remove selected map token (DM only)

---

### 18. Network message payload types are too loose
**Files:** `src/renderer/src/network/message-handler.ts`, `useNetworkStore.ts`

Many message payloads use `unknown` or unsafe `as` casts. A discriminated union for all 40+ message types would let the compiler catch mismatches instead of runtime errors surfacing in a live session.

---

### 19. `save-slice.ts` handles too many concerns (850+ lines)
**File:** `src/renderer/src/stores/builder/slices/save-slice.ts`

The file mixes character loading/hydration logic with assembly and validation. Consider splitting into:
- `load-character-slice.ts` — hydrating builder state from saved characters
- `save-character-slice.ts` — assembling and validating the final character object

---

### 20. No unit tests
There are no test files anywhere in the project. The stat calculator, build tree, and save/load logic are pure functions that are easy to unit-test.

**Suggested starting point:** Add Vitest and write tests for:
- `stat-calculator-5e.ts` (HP, AC, modifier calculations)
- `save-slice.ts` (character assembly edge cases)
- `build-tree-5e.ts` (slot generation for multiclass builds)

---

### 21. Heavy components not lazy-loaded
`MapCanvas` (PixiJS) and `DiceRoller` (Three.js + cannon-es) are bundled eagerly. Lazy-loading them via `React.lazy()` + `Suspense` would reduce initial render time and memory overhead for users who don't enter a session.

---

### 22. No ARIA labels / keyboard navigation on custom UI
The dice roller, token panel, and initiative tracker have no ARIA roles or keyboard focus management. Accessibility improvements would also benefit keyboard-first power users.

---

## Priority Summary

| # | Area | Severity |
|---|------|----------|
| 1 | PixiJS texture memory leak | Critical |
| 2 | Reconnect loses character selection | Critical |
| 3 | Silent async failures in builder | Critical |
| 4 | Ban list race condition | Critical |
| 5 | Stale drag state on tool switch | High |
| 6 | LobbyPage event listener leak | High |
| 7 | Incomplete store reset | High |
| 8 | IPC peer ID validation | High |
| 9 | No unsaved-changes guard | Medium |
| 10 | No error boundaries | Medium |
| 11 | No reconnect UI | Medium |
| 12 | No join progress indicator | Medium |
| 13 | No in-game auto-save | Medium |
| 14 | No empty name warning | Medium |
| 15 | Duplicate ban-loading logic | Medium |
| 16 | hitDie zero guard | Medium |
| 17 | Keyboard shortcuts | Low |
| 18 | Loose network payload types | Low |
| 19 | save-slice.ts too large | Low |
| 20 | No unit tests | Low |
| 21 | No lazy loading for heavy components | Low |
| 22 | No ARIA / keyboard navigation | Low |
