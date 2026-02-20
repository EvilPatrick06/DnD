# Plan 14 — Review: Bugs, QoL, New Features & Architecture

---

## Bugs / Likely Issues

### 1. Version mismatch in the main menu
`MainMenuPage.tsx` hardcodes `v1.0.0` at the bottom, but `package.json` says version `2.1.0`. Should pull from the actual package version — Electron exposes `process.env.npm_package_version` or it can be injected via `vite.config` as a define constant.

### 2. `startInitiative` mutates array elements in-place
In `useGameStore.ts` the `startInitiative` action does `e.isActive = i === 0` directly on the sorted entries before calling `set()`. Since Zustand relies on reference equality and this mutates the spread copy, this can cause subtle state bugs. Should use `map` to produce new entry objects.

### 3. Reconnection retry logic may leave the player stuck
`client-manager.ts` allows only 3 retries with a 2-second delay. If the host's PeerJS signaling server hiccups briefly (common with the free PeerJS cloud), the player gets permanently disconnected with no UI way to attempt a manual reconnect beyond going back to the menu.

### 4. `MapCanvas` fog layer ordering
The fog layer is added after the token layer (`world.addChild(fogGfx)` comes after `tokenContainerRef`), so tokens always render underneath fog. The DM likely wants to see tokens through fog while players don't — but the current single-layer approach applies the same fog to everyone. There is no per-role fog compositing.

### 5. HP calculation ignores per-level con-mod floor
In `stat-calculator-5e.ts`, HP can go negative if CON is very low. `Math.max(maxHP, 1)` only clamps the final total, not per-level values. A character with CON 1 (−5 mod) and a d6 hit die would accumulate negative HP per level before the final clamp.

---

## Quality of Life

### 6. No autosave / save indicator
There is no feedback when character or campaign data is persisted. If the app crashes after edits, the user has no way to know whether data was lost. An autosave-on-change with a small "Saved" toast would help significantly.

### 7. No search or filtering on the characters page
With a growing roster of characters across campaigns and systems, the `ViewCharactersPage` should have a search bar and filters for game system and character status (active / retired / deceased).

### 8. No keyboard shortcuts in-game
The map canvas supports tool switching (select, fog, measure, token) but there are no keyboard shortcuts (e.g. `S` for select, `F` for fog, `M` for measure). Power users and DMs running live sessions need these.

### 9. No confirmation dialog before deleting characters or campaigns
Deletion is permanent (file-based storage). A simple "Are you sure?" confirmation modal is an essential safety net.

### 10. Initiative tracker has no drag-to-reorder
DMs frequently need to adjust initiative order manually (e.g. a player rolls late, or wants to delay their turn). Drag-and-drop reordering would be more natural than numeric editing.

### 11. No step indicator in the campaign wizard or character builder
Users going through multi-step wizards have no breadcrumb or progress indicator showing how many steps remain or allowing them to jump back to a prior step.

### 12. No zoom-reset button on the map canvas
There is mouse-wheel zoom and panning, but no "reset view" button or `Home` key shortcut to snap back to the full-map view. This is annoying when zoomed too far in or panned off-screen.

---

## New Features

### 13. Undo / Redo for map editing
Fog reveals, token placements, and wall edits are the actions most prone to accidental misclicks. A simple command stack (e.g. 20-deep) for the DM's map actions would prevent a lot of frustration.

### 14. Condition reference panel
Conditions are tracked in `EntityCondition` but there is no inline reference for what "Poisoned" or "Incapacitated" actually does mechanically. A small tooltip or slide-in panel showing the 5e / PF2e rules text for each condition would reduce the need to alt-tab to a wiki.

### 15. Quick dice roller (formula input)
The Three.js physics dice roller is great for dramatic moments but slow for quick checks. A compact text input that accepts a roll formula (`2d6+3`) and resolves instantly in the chat would complement it well.

### 16. Spell / monster compendium viewer in-game
The DM needs to look up stat blocks and spell descriptions constantly. An in-game search-and-view panel backed by the existing `public/data/5e/` JSON files would eliminate constant alt-tabbing.

### 17. Session log / combat log export
Recording what happened in a session (attacks, spells cast, initiative order, damage totals) and exporting it as a text or markdown file would be very useful for DM campaign notes and player recaps.

### 18. Token health bar visibility toggle
A per-token or global DM toggle controlling whether players can see enemy HP bars (hidden, percentage-only, or exact) is a standard VTT feature that is currently missing.

### 19. Portrait / custom image upload for tokens
`Character5e` already has `portraitPath`. If custom image uploads are not fully wired up for token sprites on the map, completing the workflow (upload image → assign to token) would make the VTT feel much more personalized.

### 20. Offline / LAN mode via configurable PeerJS server
PeerJS uses a cloud signaling server by default. Supporting a self-hosted PeerJS server URL in settings would let groups play on a local network without internet and remove the dependency on PeerJS's free-tier reliability.

---

## Architecture / Code Health

### 21. No React Error Boundaries
A crash in any component (e.g. a null-deref in the map canvas or character sheet) will white-screen the entire app. Wrapping major sections (map, character sheet, lobby, initiative tracker) in `<ErrorBoundary>` components with a graceful fallback would prevent total crashes.

### 22. IPC calls have no loading or error states in the UI
`storage:save-character`, `storage:load-characters`, and related calls are async but the pages calling them likely render immediately without spinners or user-visible error messages if a file system operation fails.

### 23. Module-level mutable state in network managers
Both `host-manager.ts` and `client-manager.ts` use module-level `let` variables as singletons. This makes testing impossible and can produce hard-to-diagnose bugs if the module is hot-reloaded or two instances are accidentally created. Wrapping in a class or factory function would be cleaner.

### 24. `KNOWN_MESSAGE_TYPES` is duplicated across host and client
The client validates incoming message types against a hardcoded set. The host likely has its own parallel list. These should be a single shared constant in `network/types.ts` to prevent the two lists from diverging silently when new message types are added.

### 25. No TypeScript null-safety on IPC return values
IPC handlers return `null` or `[]` on failure without throwing. The renderer code likely does not consistently check for `null` responses, which can cause runtime errors when loading characters or campaigns that no longer exist on disk.

---

## Priority Quick Wins
The most impactful low-effort fixes:
- **#1** — Fix the hardcoded version string
- **#2** — Fix the initiative mutation bug
- **#6** — Add an autosave indicator
- **#9** — Add delete confirmation dialogs
- **#21** — Add React Error Boundaries
