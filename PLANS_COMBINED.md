# D&D Virtual Tabletop — Consolidated Development Plan

*Merged from PLAN.md + Plans 1–16. Duplicates consolidated; plan numbers noted for reference.*

---

## Project Overview

**dnd-vtt** is an Electron desktop app for online D&D 5e sessions with character creation, campaign management, and real-time multiplayer via PeerJS.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 40 |
| Build | Vite 7, electron-vite |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 |
| State | Zustand (9 stores, slice architecture) |
| Maps/Canvas | Pixi.js 8 |
| 3D Dice | Three.js + cannon-es |
| Networking | PeerJS (P2P WebRTC) |
| Rich Text | TipTap |

### Key Flows

1. **Character creation** → Builder store (slices) → Character store → JSON export/import
2. **Campaign** → Campaign store → Maps, tokens, fog of war, journal
3. **Network** → Host creates session → Client joins via invite code → State sync, voice, chat
4. **In-game** → Game store (initiative, conditions) → Pixi map + tokens → Dice rolls, fog reveal

---

## Bugs

### Critical

- **Path traversal vulnerability** (Plans 5, 8) — `startsWith` checks can be bypassed. Use `path.relative()` for validation.

- **JSON.parse without try/catch** (Plan 3) — `character-io`, `campaign-io`, `host-manager`, `client-manager`, `ipc/index.ts`, and storage modules parse JSON without try/catch. Wrap in try/catch and return structured errors.

- **Unsafe type assertions / no data validation on load** (Plans 3, 4, 5, 7, 8, 9, 12) — Stores use `as unknown as Character[]` and similar casts without runtime checks. Corrupted data can crash the app. Add Zod schemas or other runtime validation.

- **Recursive reconnection stack overflow** (Plan 5) — `attemptConnection` calls itself recursively and can overflow the stack. Replace with iterative retry.

- **Ban list race condition** (Plans 7, 11, 16) — `setCampaignId` loads bans asynchronously; a banned peer can connect before bans finish. Bans may also be loaded twice between `startHosting` and `setCampaignId`. Await ban load before accepting connections, or queue connections until bans are ready.

- **Game state not synced over network** (Plans 8, 13) — Token positions, initiative, fog, and conditions are never broadcast. Message types exist but are not sent. Each client keeps its own state.

- **Race conditions on saves** (Plans 5, 12, 15) — Rapid saves can overwrite each other without locking. The double-save guard has a timing window.

### High

- **Chat/whisper not sent over network** (Plans 5, 11, 13, 15) — `/roll` and `/w` only add messages locally. In-game chat in `GameLayout` is local only. Send messages through the network store after building the local message.

- **Reconnection loses character selection** (Plans 5, 7, 14, 16) — On reconnect, `characterId` and `characterName` reset to null. Persist the last selection and reuse on retry.

- **NPC not added to active initiative** (Plan 13) — `updateInitiativeEntry` is called on a new entry that was never inserted, so the NPC is dropped. Add an `addToInitiative` action.

- **NPC initiative total is independent random number** (Plan 13) — `total` uses a second `Math.random()` instead of `roll + modifier`. DEX modifier is ignored. Fix: `total = roll + modifier`.

- **Fog brush cells computed but never passed** (Plans 10, 11) — `MapCanvas` computes a cells array for brush size but only passes the center cell. Brush size has no effect.

- **Force-deafen clobbers mute state** (Plans 7, 11, 13) — Un-deafening sets `isForceMuted=false`, overwriting an existing force-mute. Preserve the previous mute state.

- **startInitiative mutates entries in-place** (Plans 7, 10, 11, 14) — `[...entries]` is a shallow copy; `e.isActive = i === 0` mutates originals. Use `.map()` to create new objects.

- **HP calculation issues** (Plans 4, 14, 15) — Level 1 HP uses average instead of full hit die. HP can go negative per level with low CON. `hitDie=0` not guarded.

- **ASI modal +2 bug** (Plan 15) — Passes the same ability twice instead of a single ability with +2. Missing cap check for abilities at 20.

- **Death saves never auto-reset** (Plan 15) — Death save state is not cleared when HP is restored above 0.

- **Escape key leaves game when modal open** (Plan 13) — Escape unconditionally navigates to `/` instead of closing the open modal.

- **gameStore as useEffect dependency** (Plan 13) — Using the full store object as a dependency causes excessive re-runs. `loadGameState` can run mid-session and overwrite live state.

- **voice-adapter getRoom() always returns null** (Plan 5) — `currentRoom` is never updated.

- **CreateCharacterPage side effect in render** (Plan 5) — `selectGameSystem` is called during render instead of in an effect.

- **50+ missing React key props** (Plan 5) — `BastionPage`, `CampaignDetailPage`, `LobbyPage`, `ChatPanel`, and others.

- **IPC save-bans no peer ID validation** (Plan 16) — Array items are not validated for type or length.

- **Host manager cleanup on failure** (Plan 2) — If `createPeer` throws after `hosting=true`, state is left inconsistent.

- **Event listener leaks in network stores** (Plans 5, 7, 8, 15, 16) — `hostGame`/`joinGame` register listeners that are never removed. PeerJS events accumulate on reconnect. Voice manager retry intervals are not cleared. `GameLayout` network handler effect has no cleanup.

- **PixiJS texture memory leak** (Plan 16) — Background sprite texture is never destroyed on map change or unmount. Call `destroy({ children: true })`.

### Medium

- **setTimeout/setInterval leaks** (Plans 1, 2, 4, 5, 7, 8, 9, 16) — `LobbyPage`, `InGamePage`, `DiceRoller`, `ViewCharactersPage`, `ChatInput`, and `voice-manager` create timers without cleanup on unmount.

- **Silent error swallowing** (Plans 3, 9, 10, 12, 15, 16) — `SpellsTab`, `OffenseTab`, `GearTab` catch with empty handlers; IPC load handlers return empty arrays instead of errors; `save-slice` `Promise.all` has no catch.

- **Version mismatch** (Plans 1, 5, 7, 10, 13, 14) — `MainMenuPage.tsx` hardcodes v1.0.0 while `package.json` has 2.1.0. Inject version at build time via Vite `define`.

- **IPC null window** (Plan 2) — `BrowserWindow.getFocusedWindow()` can return null in dialog calls. Use `win ?? undefined`.

- **fs:read-file path cleanup on error** (Plans 2, 13) — `dialogAllowedPaths.delete` runs even on failure or lingers if `readFile` throws. Use a `finally` block.

- **Stale drag state on tool switch** (Plan 16) — Changing tools mid-drag leaves `dragRef` populated. Clear in `activeTool` effect.

- **useGameStore.reset() incomplete** (Plan 16) — Does not clear shop state (`shopOpen`, `shopInventory`, `shopName`).

- **Duplicate dice engine** (Plan 10) — `DiceRoller` re-implements dice parsing instead of using `dice-engine.ts`. Missing `kh`/`kl` and crit detection.

- **Array access without bounds check** (Plans 4, 8, 9) — `players[0]`, `messages[messages.length-1]`, `cls.keyAbility[0]`, `entries[nextIndex]` accessed without length checks.

- **removeFromInitiative edge case** (Plans 8, 11) — Removing the active entry can skip the next entry due to index shift.

---

## Code Quality & Architecture

- **Magic numbers extraction** (Plans 1, 4, 7, 8, 9, 10, 12) — Extract timeouts (10s, 15s, 2s, 4s), size limits (65536, 8MB), rate limits, and game constants (2000 max chat, 32 max name, voice thresholds) into a shared `constants.ts`.

- **Console logging cleanup** (Plans 1, 5, 7, 8, 9, 10, 11, 12, 13) — Replace 80+ `console.log`/`warn`/`error` calls in production (especially networking) with a logger utility that supports levels and gates debug output behind `import.meta.env.DEV`.

- **`any` types removal** (Plans 4, 8, 9, 10, 11, 12, 15) — Replace `any` in `validateMessage(msg: any)`, system adapters returning `any[]`, data-provider functions, and filter/map chains with `unknown` plus type guards or proper types.

- **Large files needing split** (Plans 5, 7, 8, 9, 12, 15, 16):
  - `GameLayout.tsx` (2666 lines) → GameMessageHandlers, GameModals, GameHUD, useBroadcastChat hook
  - `useGameStore.ts` (1240+ lines) → combat, map, time sub-stores
  - `save-slice.ts` (850+ lines) → load-character-slice + save-character-slice
  - `host-manager.ts` (~700 lines) → connection, message routing, moderation
  - `LobbyPage.tsx` (~550 lines) → useVoiceSetup, useNetworkSync hooks
  - `MapCanvas.tsx` (~1000 lines) → rendering layers
  - `CampaignDetailPage.tsx` (~760 lines) → sub-components

- **Duplicate code** (Plans 3, 7, 11, 12, 15, 16) — Deduplicate `generateInviteCode` (peer-manager and useCampaignStore), `isValidUUID` (ipc and storage), ban-loading logic (startHosting and setCampaignId), kick/ban logic (~80% shared), and `SKILL_DEFINITIONS`.

- **Circular dependencies** (Plans 2, 9) — Resolve useNetworkStore/useLobbyStore circular dependency and dm-action-executor dynamic `require`. Consider mediator/event bus or `getState()`.

- **Data migration/versioning** (Plan 12) — Add schema versioning for saved JSON. Introduce a `schemaVersion` field and migration pipeline so changes to `Character5e` do not break existing saves.

- **Module-level mutable state** (Plans 11, 14) — host-manager and client-manager use ~15 module-level `let` variables, which complicates testing. Wrap in a class or factory function.

- **Data cache issues** (Plans 5, 7, 11) — data-provider cache grows unbounded with no LRU eviction or invalidation; stale data until restart. `loadJson` caches failed results.

- **Spell slot progression hardcoded** (Plans 7, 15) — Make spell slot progression data-driven from JSON. Handle Warlock pact magic and multiclass spell slot calculation.

- **IPC channel string literals** (Plan 5) — Replace preload string literals with shared constants for IPC channel names.

---

## Security

- **Path traversal vulnerability** (Plans 5, 8) — `startsWith` checks can be bypassed. Use `path.relative()` for validation.

- **File sharing MIME validation** (Plans 2, 5, 10, 11) — Only declared `mimeType` is validated, not actual content. Validate magic bytes and block `.js` files.

- **Chat XSS / sanitization** (Plans 1, 3, 5, 11) — Messages are filtered for blocked words but not HTML injection. Avoid `dangerouslySetInnerHTML` for user content.

- **CSP unsafe-inline** (Plans 5, 8) — `unsafe-inline` weakens XSS protection.

- **Message validation gaps** (Plans 5, 7, 8, 10) — Only 3 of many message types are validated server-side. Zod schemas use `.passthrough()`. `senderId` is overwritten after validation.

- **Large message parsed before size check** (Plan 7) — Host parses full JSON of oversized messages before rejecting. Check size before `JSON.parse`.

- **Input length limits** (Plan 3) — Some IPC handlers and network paths do not enforce length limits.

- **Dice formula bounds** (Plan 7) — `rollDice("9999d9999")` is allowed. Cap dice count and sides.

- **No global rate limit** (Plan 7) — Rate limiting is per-peer only; many peers at individual limits can overwhelm the host.

- **Console logging sensitive data** (Plan 9) — Peer IDs, display names, and connection details are logged.

- **Display name validation** (Plan 9) — Not validated for empty or excessively long strings.

- **Audio handler path sanitization** (Plan 5) — Insufficient protection against `../` traversal; `campaignId` is not UUID-validated.

- **No file size limits on IPC** (Plan 5) — Risk of memory exhaustion from large IPC payloads.

---

## Performance

- **Virtualize long lists** (Plans 2, 7, 8) — ChatPanel, EquipmentPickerModal, GearTab, QuickReference render all items. Use react-window or @tanstack/react-virtual.

- **React.memo usage** (Plans 7, 8, 12) — PlayerCard, message bubbles, character list items, and token renderers re-render when siblings change.

- **useMemo for expensive calculations** (Plans 3, 7, 8, 9) — stat-calculator, `computeDynamicAC`, skill modifiers, spell groupings, and sorted/filtered lists recompute every render.

- **Route-level code splitting** (Plans 12, 16) — All pages are bundled together. MapCanvas (PixiJS) and DiceRoller (Three.js) load eagerly. Use `React.lazy` + `Suspense`.

- **Token re-rendering** (Plan 11) — `renderTokens` clears and rebuilds all sprites on any change. Diff and update only changed tokens.

- **Store subscription narrowing** (Plans 1, 8) — Components subscribe to more state than needed. Use narrow selectors and shallow comparison for Zustand selectors.

- **GameLayout effect dependencies** (Plans 3, 8) — Effects depend on large objects and re-run often. Narrow dependencies to primitive IDs.

- **Network peer updates** (Plan 11) — `updatePeer` creates a new array via `.map()` every time. Use `Map<string, PeerInfo>` instead.

- **Map image loading** (Plan 2) — No lazy loading or format optimization. Consider WebP/AVIF.

- **buildCharacter5e data loading** (Plan 5) — Data files are loaded sequentially; parallelize where possible.

---

## Testing

- **No tests exist** (Plans 7, 8, 9, 12, 13, 15, 16) — Zero test files. Add Vitest and prioritize: stat-calculator-5e, build-tree-5e, dice-engine, character-io/campaign-io, network message validation, and save/load logic.

---

## Quality of Life / UX

- **Toast/notification system** (Plans 1, 3, 5, 9, 11, 12) — No reusable toast. Errors only in console. Build a queue-based toast with auto-dismiss for save/delete/connection feedback.

- **Keyboard shortcuts / help overlay** (Plans 1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 14, 16) — `useKeyboardShortcuts` exists but is minimal. No discoverable help UI. Needed shortcuts: Ctrl+S save, Ctrl+Z/Y undo/redo, Escape close modals, Space advance initiative, / focus chat, D dice roller, G toggle grid, F fog tools, Delete remove token, number keys for quick dice.

- **Undo/redo** (Plans 1, 4, 7, 9, 10, 11, 12, 13, 14, 15) — No undo for token moves, map edits, character builder, fog changes, NPC/campaign deletes. Use Zustand middleware (zundo) or action stack.

- **Search/filter for characters** (Plans 3, 4, 7, 8, 9, 10, 14) — ViewCharactersPage has no name search. Also missing search on: equipment picker, feat lists, NPC list, character selector.

- **Loading states / skeletons** (Plans 1, 3, 5, 8, 9, 12) — Most pages show "Loading..." text or nothing. Create shared Spinner and skeleton loader components.

- **Error boundaries** (Plans 2, 5, 8, 12, 14, 16) — No React error boundaries. A crash in any component white-screens the app. Wrap major routes in ErrorBoundary.

- **Connection quality indicator** (Plans 4, 5, 7, 8, 9, 10) — Ping/pong messages exist but latency is never calculated or displayed. Show connection badge in game HUD.

- **Auto-save** (Plans 9, 10, 11, 13, 14, 16) — Game state (tokens, fog, initiative) is never persisted to disk. Host crash loses everything. No auto-save for character builder mid-creation. Add debounced auto-save (30–60s).

- **Confirmation dialogs** (Plans 8, 9, 12, 14) — NPC/Rule/Lore/Map/character/campaign deletes and kick/ban happen instantly with no confirmation. Create reusable ConfirmDialog component.

- **Chat message cap** (Plans 2, 5, 7, 11) — Messages grow unbounded in useLobbyStore. Cap to last 500–1000 messages.

- **404 / catch-all route** (Plans 5, 10) — No fallback route for invalid paths. Add `Route path="*"`.

- **Display name persistence** (Plan 5) — Not remembered between sessions. Store in localStorage.

- **Calendar data not persisted** (Plan 5) — Stored only in component state, lost on refresh.

- **No "Leave Game" / "End Session" button** (Plan 13) — Only exit is Escape (which has bugs) or killing the app.

- **No reconnect UI** (Plan 16) — When connection drops, screen freezes with no feedback. Show reconnect banner with countdown and manual retry.

- **No progress indicator on join** (Plan 16) — 15s timeout with static "connecting" message.

- **No unsaved changes warning** (Plans 15, 16) — Navigating away from builder/editor loses progress silently.

- **No step indicator in wizards** (Plan 14) — Campaign wizard and character builder have no breadcrumb or progress indicator.

- **No zoom-reset button on map** (Plan 14) — No "reset view" or Home key shortcut.

- **Map and token state never persisted** (Plan 13) — Maps during session exist only in memory.

- **Map images are DM-local paths** (Plan 13) — Clients cannot access DM filesystem paths. Show placeholder or transmit image data.

- **Fog of war only single clicks** (Plan 13) — No drag-to-paint. Requires clicking every cell.

- **Clipboard fallback incomplete** (Plan 11) — Copy fallback does not work. No "copy failed" feedback.

- **No onboarding/tutorial** (Plan 7) — New users have no guided introduction.

- **Inconsistent styling** (Plans 8, 9) — Mix of inline styles and Tailwind. Hardcoded colors instead of theme tokens. Many components not migrated to CSS variable themes.

---

## Accessibility

- **ARIA labels missing** (Plans 1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 15, 16) — Nearly all icon-only buttons, DM toolbar, panel toggles, close buttons, and voice controls lack `aria-label`.

- **Modal focus trapping** (Plans 1, 2, 4, 5, 7, 8, 12, 15) — Modal component does not trap focus; tab can escape. Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Implement focus trap and restore focus on close.

- **Focus-visible styles** (Plans 4, 8, 9) — No `:focus-visible` styles. `focus:outline-none` used on inputs/buttons. Replace with `focus-visible:ring-2`.

- **aria-live regions** (Plans 2, 4, 7, 9, 11) — Chat messages, dice rolls, initiative changes, and connection events are not announced to screen readers.

- **Clickable divs instead of buttons** (Plan 12) — CharacterCard and others use `div onClick` instead of `button` or `a`.

- **Color contrast** (Plan 4) — Some gray-on-gray text may fail WCAG AA.

- **No keyboard navigation for custom dropdowns** (Plan 7) — CharacterSelector and calendar picker do not support arrow keys, Enter, or Escape.

- **Collapsible sections missing aria-expanded** (Plan 7) — SheetSectionWrapper toggles visibility without communicating state.

- **Input component** (Plan 15) — Should link label via `htmlFor`/`id`, connect errors via `aria-describedby`, and add `aria-invalid`.

- **Interactive elements missing keyboard handlers** (Plans 5, 8) — Character cards and color pickers lack keyboard equivalents.

---

## New Feature Suggestions

### Gameplay

- **Map ping/waypoint system** (Plans 10, 11, 13) — Alt+click to place a temporary pulsing beacon visible to all.
- **Token HP bars** (Plans 10, 13, 14) — HP data exists but no visible bar on tokens. Green→yellow→red gradient. Toggle visibility for players.
- **Condition icons on map tokens** (Plan 13) — Small colored dot badges (poisoned=green, stunned=yellow) on token sprites.
- **Spell/AoE templates** (Plan 13) — Circle, cone, line, and cube overlays on the grid.
- **Dice roll history panel** (Plans 1, 5, 7, 9, 10, 11) — Dedicated filterable log with who rolled, formula, result, and timestamp.
- **Dice macros / quick-roll bar** (Plans 2, 4, 5, 8, 13, 14) — One-click buttons for common rolls. Auto-generate from character weapons/skills.
- **Quick dice roller text input** (Plan 14) — Compact formula input that resolves instantly without physics animation.
- **Death save tracker** (Plans 4, 13) — Visual 3-success/3-failure tracker when HP=0.
- **Initiative auto-roll from DEX** (Plans 4, 14) — Auto-populate from character DEX modifier.
- **Initiative drag-to-reorder** (Plan 14) — Manual reorder for delayed turns.
- **Rest tracking UI** (Plan 3) — `restTracking` exists in game state but has no UI.
- **Concentration tracking** (Plan 3) — Tracked in turn state but not surfaced.
- **Encounter builder / group save** (Plans 8, 13) — Define named NPC groups and deploy at once with initiative and tokens.
- **Combat log / action history** (Plans 4, 8, 10, 14) — Scrollable timeline of combat actions, damage, and conditions.
- **Right-click context menu on tokens** (Plans 4, 13) — Quick actions: Remove, Add to initiative, Set HP, Apply condition, Toggle visibility.
- **Drawing tools on maps** (Plan 4) — Lines, shapes, freehand, and text annotations.
- **Multi-select tokens** (Plan 1) — Shift+click or box-select to move or apply conditions to multiple tokens.

### Content & Data

- **Compendium browser** (Plans 2, 4, 14) — Searchable in-game UI for spells, items, monsters, and rules.
- **Session notes/journal/recap** (Plans 4, 8, 9, 11, 12, 13) — Per-session journal with timestamps, auto-log of major events, markdown editing, and export.
- **Session log export** (Plans 13, 14, 15) — Export chat and combat log as .txt or .md.
- **Character versioning/history** (Plans 2, 5, 12, 15) — Store snapshots on save for revert and compare.
- **Roll tables** (Plan 2) — DM-defined random tables for loot, encounters.
- **Quest tracker** (Plan 4) — Shared quests with objectives and progress.
- **Party inventory** (Plan 4) — Shared storage for loot with gold splitting.
- **Campaign templates** (Plans 5, 12) — Start from pre-built templates.
- **Spell preparation limits** (Plan 3) — Validate prepared spell count against limits.
- **Encumbrance warnings** (Plan 3) — Compare carried weight vs capacity.

### Multiplayer & Networking

- **Per-player fog of war** (Plans 2, 14) — Track fog per player and sync only what each should see.
- **Host migration** (Plan 7) — If the DM disconnects, the session ends. Add host migration or session persistence.
- **Player handouts** (Plan 8) — DM reveals images or text to specific players.
- **Offline/LAN mode** (Plans 10, 14) — Self-hosted PeerJS server URL for local network play.
- **Push-to-talk** (Plan 4) — Voice chat has mute/unmute and VAD but no push-to-talk keybind.

### DM Tools

- **AI DM panel in-game** (Plan 13) — AI DM service exists but is not wired into the game layout. Collapsible side panel for rules queries, NPC dialogue, and random tables.
- **Ambient sound/music player** (Plans 8, 10, 13) — Simple audio panel with play/pause/volume.
- **Player character quick-reference for DM** (Plan 11) — Hover over token to see AC, HP, passive Perception.
- **Map layers/tabs** (Plans 10, 11, 14) — Quick switch between maps. Preload next map.

### Export & Import

- **Character sheet PDF export** (Plans 4, 7, 8, 12) — Printable character sheets.
- **Game state export/import** (Plans 1, 3, 5) — Export/import initiative, map state, tokens, and fog for session persistence.
- **D&D Beyond import improvements** (Plan 1) — Better validation and error reporting.

### App-Level

- **Settings/preferences page** (Plans 4, 10) — Theme toggle, font size, UI density, keybind customization, voice quality, grid preferences.
- **Dark/light theme toggle** (Plan 8) — Currently dark-only.
- **Character templates** (Plan 8) — Pre-built characters for quick starts.
- **Offline/solo mode clarity** (Plan 5) — Make it clear users can use builder and campaign prep without hosting.
- **Custom chat commands** (Plan 5) — Extensibility for homebrew.
- **Macro system** (Plan 2) — Reusable custom dice formulas and actions.

---

*Consolidated Feb 2026 from Plans 1–16.*
