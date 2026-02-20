# Plan 13 — Code Review: Bugs, QoL, and Feature Suggestions

---

## Confirmed Bugs

### 1. `handleNPCAddToInitiative` — NPC silently not added (`GameLayout.tsx`, ~line 299)
When initiative is already active, the code calls `gameStore.updateInitiativeEntry(entry.id, entry)` on a brand-new entry that was never inserted. `updateInitiativeEntry` maps over existing entries by ID and finds nothing, so the NPC is silently dropped.

**Fix:** Add an `addToInitiative(entry: InitiativeEntry)` action to `useGameStore` that appends to the entries array and re-sorts. Use that when initiative is already running instead of `updateInitiativeEntry`.

---

### 2. Version hardcoded incorrectly (`MainMenuPage.tsx`, line 57)
`v1.0.0` is hardcoded in the footer, but `package.json` is at `2.1.0`. These have drifted and will continue to drift.

**Fix:** Inject the version at build time via `electron.vite.config.ts`:
```ts
define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version) }
```
Then use `__APP_VERSION__` in the component.

---

### 3. Chat is entirely local — never sent over the network (`GameLayout.tsx`)
`chatMessages` is local React state. `handleSendChat` only calls `setChatMessages(...)` — it never calls `useNetworkStore.sendMessage(...)`. In multiplayer, no player or DM sees each other's messages, dice rolls, or whispers.

**Fix:** After building the local message in `handleSendChat`, also call `sendMessage('chat:message', { content, isDiceRoll, diceResult, isWhisper, whisperTarget })`. In the network message handler, push received `chat:message` packets into `chatMessages`.

---

### 4. `isForceMuted` ternary is misleadingly verbose (`useNetworkStore.ts`)
```ts
const isForceMuted = isForceDeafened ? true : false
```
This is equivalent to `const isForceMuted = isForceDeafened`. The ternary implies some nuance that doesn't exist.

**Fix:** `const isForceMuted = isForceDeafened`

---

### 5. Dialog-allowed path lingers if `fs:read-file` throws (`ipc/index.ts`, line 186)
`dialogAllowedPaths.delete(normalized)` is inside the `try` block. If `readFile` throws, the path is never removed and remains permanently allowed until the app restarts.

**Fix:** Move the delete into a `finally` block so it always runs regardless of success or failure.

---

### 6. Escape key leaves the game even when a modal is open (`InGamePage.tsx`)
The `Escape` keyboard handler unconditionally calls `navigate('/')`. If the Settings modal (or any future overlay) is open, the user is ejected to the main menu instead of the modal closing.

**Fix:** The settings state needs to be accessible to the Escape handler. Either lift `showSettings` up to `InGamePage` and pass it down, or check a ref/shared flag before navigating.

---

### 7. NPC initiative roll — `total` is a second independent random number, not `roll + modifier`
```ts
roll: Math.floor(Math.random() * 20) + 1,
modifier: 0,
total: Math.floor(Math.random() * 20) + 1,   // completely unrelated to roll!
```
`total` should be `roll + modifier`. Additionally, the NPC's actual DEX modifier from its stat block is always ignored (`modifier: 0`).

**Fix:** Calculate `roll` first, then set `total = roll + modifier`. Wire up the NPC's DEX modifier if available.

---

## Quality of Life

### 8. Fog of war only applies on single clicks — no drag-to-paint (`MapCanvas.tsx`)
The fog reveal/hide tools call `onCellClick` on `pointerdown`. There is no `pointermove` handler while the button is held, so painting a large fog area requires clicking every individual cell.

**Fix:** Track pointer-down state and fire `onCellClick` continuously on `pointermove` when the fog tool is active and the mouse button is held.

---

### 9. Map and token state is never persisted back to the campaign
Maps created during a session (tokens placed, fog revealed, grid configured) exist only in `useGameStore` (in-memory Zustand). Navigating away or closing the app loses everything permanently.

**Fix:** Auto-save after meaningful mutations, or add a "Save Session" button in the top bar that writes `gameStore.maps` back to the campaign via `useCampaignStore.saveCampaign(...)`.

---

### 10. No HP bar or health indicator on map tokens
`MapToken` has all the data needed for HP tracking, and condition tracking is wired up, but `createTokenSprite` renders no health bar. During combat the DM must track HP mentally or externally.

**Fix:** Render a small colored bar beneath each token sprite (green → yellow → red based on HP percentage). Make the bar optionally visible to players via the `visibleToPlayers` flag.

---

### 11. Map images are DM-local filesystem paths — clients see a blank canvas
`map.imagePath` is a raw local path (e.g., `C:\Users\dm\maps\dungeon.png`). The DM loads it fine locally, but clients receive this path in the game state broadcast and cannot access the DM's filesystem. They always see a black canvas.

**Fix (short term):** Detect the load failure client-side and show a "Map image unavailable" placeholder instead of silently failing.
**Fix (long term):** When the DM sets a map active, read the file as a base64 data URL and transmit it inside the `dm:map-change` message, or serve it from a local HTTP server via Electron's `protocol` module.

---

### 12. No "Leave Game" / "End Session" button visible anywhere in the game UI
The only exits are: pressing Escape (which has bug #6), or killing the app. There is no visible leave/end button in the top bar or settings modal.

**Fix:** Add an "End Session" button for the DM and a "Leave Game" button for players in the settings modal. DM button should broadcast `dm:game-end` before disconnecting; player button should send `player:leave`.

---

### 13. No way to add a player character to a running initiative
The DM can add NPCs (once bug #1 is fixed) and start a fresh initiative, but there is no flow for a player to roll initiative and be inserted mid-fight (late-joiners, second wave encounters, etc.).

**Fix:** Add an "Add Player" button in the initiative tracker that accepts a name + roll value and inserts the entry in sorted order.

---

### 14. Right-click context menu missing on map tokens
Left-click selects a token. Right-clicking does nothing. The DM has no quick access to per-token operations without switching to a separate panel.

**Fix:** Add a `rightclick` / `contextmenu` handler on token sprites that shows a floating menu: Remove token, Add to initiative, Set HP, Apply condition, Toggle player visibility.

---

### 15. `gameStore` object used as `useEffect` dependency causes excessive re-runs (`InGamePage.tsx`)
```ts
useEffect(() => { ... }, [campaign, gameStore])
```
`gameStore` is the entire store object reference. Since Zustand recreates this on every state change, the effect re-runs on every single store mutation while in-game.

**Fix:** Depend only on `gameStore.campaignId` (a stable primitive) instead of the full store object.

---

## New Feature Suggestions

### 16. Real-time game state sync to clients (multiplayer gap)
The `game:state-update` and `game:state-full` message types are defined in `network/types.ts` but the host never broadcasts store mutations (token moves, fog changes, initiative updates, conditions) to clients. This is the most significant functional gap for multiplayer — the map is effectively a single-player view.

**How:** After each `useGameStore` mutation in `GameLayout.tsx` handlers (`handleTokenMove`, `handleCellClick` for fog, etc.), call `sendMessage('game:state-update', { patch })`. Clients apply the patch in the network message handler. On a new client connection, the host sends a `game:state-full` snapshot.

---

### 17. Spell / AoE templates on the map
Circle (fireball), cone (burning hands), line (lightning bolt), and cube overlays anchored to grid cells. The DM or player selects the template type, clicks to place it, and the affected cells are highlighted as a semi-transparent overlay.

---

### 18. Ping / waypoint tool for players
Players hold a key (e.g., `Alt+click`) to drop a temporary pulsing waypoint visible to all players for a few seconds. Broadcast via the network as a short-lived overlay. Standard VTT feature that costs minimal effort to add.

---

### 19. Condition icons as visual badges on map tokens
Conditions in `useGameStore.conditions` are tracked but not reflected on the canvas. Small colored dot badges (poisoned = green, stunned = yellow, prone = gray, etc.) overlaid on token sprites would surface this information passively during play without requiring panel interaction.

---

### 20. Encounter / group save system
Let the DM define and save named groups of NPCs (e.g., "Goblin Ambush: 4× Goblin, 1× Hobgoblin") and deploy an entire encounter at once — rolling initiative for all creatures, placing tokens, setting HP. Saves significant setup time every session.

---

### 21. Session recap / export
Export the chat log and DM notepad content as a `.txt` or `.md` file at session end via the existing `dialog:show-save` + `fs:write-file` IPC path. Provides a record of what happened for campaign journaling.

---

### 22. Ambient audio / table sounds for the DM
A simple collapsible panel in the DM tools with a file-picker or URL input for background music / ambience (tavern, dungeon, battle). Just an HTML `<audio>` element with play/pause/volume — no additional libraries needed.

---

### 23. Macro / quick-roll bar for players
A customizable row of dice-roll shortcut buttons: "Attack: 1d20+5", "Damage: 1d8+3", "Stealth Check: 1d20+4". These could be auto-generated from the character's weapons and skills to eliminate manual formula entry during combat.

---

### 24. Death saving throw tracker
When a player's HP hits 0, surface a three-successes / three-failures death save tracker on the `PlayerHUD`. Failures from critical hits count double. Integrates with the existing `ConditionTracker` and `ActiveCondition` types.

---

### 25. AI DM assistant panel in-game
The AI DM service exists in `src/main/ai/` but is not wired into the in-game layout. A collapsible "DM Assistant" side panel would let the DM query rules, generate NPC dialogue, roll random tables, or get encounter suggestions without leaving the session.

---

## Architecture / Code Health

### 26. Replace raw `console.log/warn/error` calls with a leveled logger
50+ raw console statements exist across the network layer, stores, and components. A thin `logger.ts` wrapper with `debug/info/warn/error` levels that no-ops `debug` and `info` in production would keep the end-user console clean while preserving developer utility.

---

### 27. No tests exist despite Vitest being in the stack
Zero test files found. `stat-calculator-5e.ts`, the initiative sort/advance logic, `updateCondition`, and the network message validator are all pure functions that are easy to unit test and critical to game correctness.

**Suggestion:** Start with `stat-calculator-5e.test.ts` and `useGameStore` action tests as the highest-value initial coverage.

---

### 28. `useGameStore.reset()` has no confirmation and is unrecoverable
Calling `reset()` silently wipes all maps, tokens, conditions, and initiative with no prompt and no undo. If triggered accidentally, the entire session state is gone.

**Fix:** Require explicit confirmation (a modal prompt) before executing a full reset, or implement a simple undo stack for destructive operations.

---

### 29. `gameStore.loadGameState` called on every render — missing stable deps (`InGamePage.tsx`)
Related to #15 but specifically about `loadGameState`: if `gameStore` (the full store) is in the effect deps, `loadGameState` can fire mid-session whenever any store value changes, potentially clobbering live game state back to the campaign's saved state.

**Fix:** Use a ref to track whether the initial load has happened (`hasInitialized.current`) and gate the call behind it, removing `gameStore` from the dependency array entirely.
