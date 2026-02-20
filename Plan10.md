# Plan 10 — Project Review & Improvement Roadmap

## Bugs & Issues

### 1. Version mismatch on main menu
`MainMenuPage.tsx` hardcodes `v1.0.0` while `package.json` says `2.1.0`.
Should read from `package.json` or an environment variable.

**File:** `src/renderer/src/pages/MainMenuPage.tsx` line 57

---

### 2. Duplicate dice engine — DiceRoller doesn't use `dice-engine.ts`
There is a full-featured `dice-engine.ts` service with keep-highest/lowest, crit/fumble detection, and compound formulas, but `DiceRoller.tsx` re-implements its own simpler `parseDiceFormula` and `rollDice` inline. The component's version doesn't support `kh`/`kl` syntax or detect crits. These should be unified.

**Files:** `src/renderer/src/services/dice-engine.ts`, `src/renderer/src/components/game/DiceRoller.tsx`

---

### 3. Fog brush cells computed but never sent
In `MapCanvas.tsx` lines 316-327, when using the fog tools, the code computes a `cells` array based on brush size but then only calls `onCellClick(gridX, gridY)` — the computed cells are discarded. The callback should pass the full `cells` array, or the fog brush size feature won't actually work.

**File:** `src/renderer/src/components/game/MapCanvas.tsx` lines 316-327

---

### 4. `startInitiative` mutates input entries
In `useGameStore.ts`, `startInitiative` sorts the entries and then mutates them in-place with `e.isActive = i === 0`. This mutates the caller's objects since `[...entries]` is a shallow copy. Should spread each entry: `sorted.map((e, i) => ({ ...e, isActive: i === 0 }))`.

**File:** `src/renderer/src/stores/useGameStore.ts` lines 138-153

---

### 5. `stopHosting` clears `bannedPeers` in memory but doesn't account for campaign reuse
When a host stops and restarts a game for the same campaign, bans are loaded from disk via `setCampaignId`. But `stopHosting` clears `bannedPeers`, and if `setCampaignId` is called before `startHosting`, the bans get loaded, then `startHosting` also loads them again (double-load). Not a crash, but the flow is fragile.

**File:** `src/renderer/src/network/host-manager.ts`

---

## Code Quality

### 6. ~80+ console.log/warn/error statements in production code
Network and storage code is littered with console output. Consider a lightweight logger utility with log levels that can be toggled (e.g., `DEBUG` in dev, `ERROR` only in prod).

---

### 7. Magic numbers everywhere
Timeouts like `15000`, `10000`, `5000`, `2000`, `1500`, `100`, max sizes like `65536`, `8 * 1024 * 1024`, game constants like `2000` (max chat length), `32` (max name length) — these should be extracted to a shared `constants.ts`.

---

### 8. `any` types in critical paths
`validateMessage(msg: any)` in `host-manager.ts` and `validateIncomingMessage(msg: any)` in `client-manager.ts` handle all incoming network data as `any`. These are security-critical functions — adding a proper `unknown` type with type guards would catch invalid payloads at compile time.

**Files:** `src/renderer/src/network/host-manager.ts`, `src/renderer/src/network/client-manager.ts`

---

### 9. Silent failures in builder tabs
`SpellsTab`, `OffenseTab`, and `GearTab` catch data-loading errors by silently setting empty arrays (`.catch(() => setWeaponDb([]))`). Users get a blank tab with no indication that data failed to load. Add error state UI.

**Files:** `src/renderer/src/components/builder/SpellsTab.tsx`, `src/renderer/src/components/builder/OffenseTab.tsx`, `src/renderer/src/components/builder/GearTab.tsx`

---

### 10. No 404 / catch-all route
`App.tsx` has no `*` fallback route. If a user somehow navigates to an invalid path (e.g., stale link in MemoryRouter history), they get a blank screen.

**File:** `src/renderer/src/App.tsx`

---

## Quality of Life Improvements

### 11. Undo/Redo for character builder
The builder store has no undo mechanism. For a multi-step character builder, accidentally clearing a selection or overwriting ability scores can be frustrating. A Zustand middleware for undo/redo (like `zundo`) would be a big QoL win.

---

### 12. Keyboard shortcuts are minimal
There is a `useKeyboardShortcuts.ts` hook, but the VTT could benefit from many more shortcuts:
- `Escape` to deselect tokens / close modals
- `G` to toggle grid
- `F` to toggle fog tools
- `I` to open initiative
- Number keys `1-7` for quick dice (d4, d6, d8, d10, d12, d20, d100)
- `Ctrl+Z` / `Ctrl+Y` for undo/redo

---

### 13. Dice roll history not shared
`DiceRoller.tsx` keeps roll results in local component state. Other players can't see your rolls unless you also send a network message. The `onRoll` callback exists but it's optional — results should be automatically broadcast to all players in multiplayer.

---

### 14. No reconnection handling for players
If a player loses connection briefly (Wi-Fi hiccup), they're gone. The client-manager should attempt automatic reconnection with exponential backoff, preserving their character selection and lobby state.

---

### 15. No auto-save for campaigns in progress
If the DM's app crashes mid-session, all game state (token positions, initiative order, fog reveals) is lost. Periodic auto-save of `useGameStore` state to disk would prevent this.

---

### 16. Initiative tracker should auto-populate from lobby
The DM has to manually type each player/NPC name into the initiative tracker. It should pre-populate entries from connected players' character names.

---

### 17. Measurement tool shows no distance text on canvas
The `MeasurementTool.ts` draws a line but should show the distance in feet/squares as an overlay label — this is standard in VTTs.

---

## New Feature Suggestions

### 18. Dice roll animations
The `DiceResult` component shows results statically. Even a simple CSS animation (tumbling numbers that settle, a brief "bounce" on crits, red flash on fumbles) would add life.

---

### 19. Token HP bars
`MapToken` supports HP data but there are no visible HP bars on tokens in the map canvas. A small health bar overlay above each token would be hugely useful for combat.

---

### 20. Map ping / pointer system
Let any player click to "ping" a location on the map, showing a brief animated marker visible to all. Essential for coordinating in combat ("I'm targeting this square").

---

### 21. Ambient sound / music player
Many VTT sessions use background music. A simple audio player panel in the DM tools (with play/pause/volume and maybe some bundled ambient tracks) would round out the experience.

---

### 22. Character sheet during gameplay
Players have `CharacterMiniSheet` in the HUD, but there's no way to view the full `CharacterSheet` during a game session. A toggle or modal to expand to full sheet view would be valuable.

---

### 23. Encounter / combat log
A persistent log panel showing initiative changes, damage dealt, conditions applied/removed, and dice rolls in chronological order. Different from chat — this is structured game event history.

---

### 24. Map layers / multi-map support during sessions
The DM can switch maps via `MapSelector`, but there's no concept of "map layers" (e.g., separate layer for building interiors vs. overhead). Also, preloading the next map for instant transitions would feel smoother.

---

### 25. Settings / preferences page
No settings page exists in the router. Users should be able to configure:
- Default dice roller modifier
- Audio input/output device for voice chat
- Grid opacity/color preferences
- Keybinding customization
- Theme tweaks

---

## Security & Robustness

### 26. Invite code collision is possible but not retried
`generateInviteCode` creates a 6-character code (30^6 = ~729M possibilities). If PeerJS returns `unavailable-id`, the error propagates up but there's no automatic retry loop — the user has to manually click again.

**File:** `src/renderer/src/network/peer-manager.ts`

---

### 27. File sharing mime validation is bypassable
The `validateMessage` check for `chat:file` only validates the declared `mimeType` string, not the actual file content. A malicious peer could send `mimeType: 'image/png'` with executable content. Consider validating magic bytes of the base64-decoded data.

**File:** `src/renderer/src/network/host-manager.ts` lines 446-454

---

### 28. No ping/latency display
The `ping`/`pong` messages exist in the network types, but there's no UI showing latency to each player. This is useful for debugging connection issues during a game.

---

## Priority Summary

| Priority | Item | Type |
|----------|------|------|
| High | Fix fog brush cells not being passed (#3) | Bug |
| High | Fix initiative entry mutation (#4) | Bug |
| High | Unify dice engines (#2) | Bug / Code Quality |
| High | Fix version display (#1) | Bug |
| Medium | Add auto-reconnection (#14) | Robustness |
| Medium | Auto-save game state (#15) | QoL |
| Medium | Extract magic numbers (#7) | Code Quality |
| Medium | Replace `any` with proper types (#8) | Code Quality |
| Medium | Add catch-all route (#10) | Bug |
| Medium | Token HP bars (#19) | Feature |
| Medium | Map ping system (#20) | Feature |
| Low | Logger utility (#6) | Code Quality |
| Low | Undo/redo in builder (#11) | QoL |
| Low | More keyboard shortcuts (#12) | QoL |
| Low | Error states in builder tabs (#9) | QoL |
| Low | Settings page (#25) | Feature |
