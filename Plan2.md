# D&D VTT – Suggestions & Improvements

## Critical / Bug Fixes

### 1. **IPC: Handle null `BrowserWindow.getFocusedWindow()`**
In `src/main/ipc/index.ts` (lines 145, 164), `BrowserWindow.getFocusedWindow()` can return `null` (e.g., no focused window). Passing `null` to `dialog.showSaveDialog` / `dialog.showOpenDialog` can cause issues.

**Fix:** Use `win ?? undefined` or `win || undefined` so the dialog falls back to the main window when no window is focused.

### 2. **Host manager: Cleanup on `startHosting` failure**
In `host-manager.ts`, if `createPeer(inviteCode)` throws after `hosting = true`, the host state is left inconsistent.

**Fix:** Wrap the setup in try/catch and call `stopHosting()` (or equivalent cleanup) on error so `hosting` and other state are reset.

### 3. **`fs:read-file` path cleanup on error**
In `ipc/index.ts` (lines 186–187), `dialogAllowedPaths.delete(normalize(path))` runs even when the read fails. That blocks retrying the same path without reopening the dialog.

**Fix:** Only delete the path from `dialogAllowedPaths` when the read succeeds.

---

## Quality of Life

### 4. **Chat message cap**
`useLobbyStore` keeps all chat messages indefinitely. Long sessions can lead to large arrays and slower UI.

**Fix:** Cap the number of messages (e.g. keep the last 500) or add a "load more" pattern.

### 5. **In-game loading logic**
`InGamePage.tsx` uses a fixed 4s timeout before showing "No Campaign Found." That can be too short on slow networks or too long when the campaign is already loaded.

**Fix:** Clear loading when the campaign is found (e.g. when `campaign` becomes truthy) instead of relying only on the timeout.

### 6. **Keyboard shortcuts help UI**
`useKeyboardShortcuts` and `getShortcutsForContext` exist, but there's no visible way to show the `?` shortcut help.

**Fix:** Add a help overlay or modal that lists shortcuts when `?` is pressed, using `getShortcutsForContext`.

### 7. **Import error auto-dismiss**
`ViewCharactersPage` uses `setTimeout(() => setImportError(null), 5000)` without storing the timeout ID.

**Fix:** Store the timeout ID and clear it in a `useEffect` cleanup to avoid leaks if the component unmounts before 5 seconds.

---

## New Features

### 8. **Macro / quick-action system**
Support for reusable macros (e.g. common rolls, actions) would speed up play.

**Idea:** Add a macro bar or modal where users can define and trigger custom dice formulas and actions.

### 9. **Roll tables**
Random tables for loot, encounters, etc. are common in VTTs.

**Idea:** Add a roll-table system where DMs can define tables and roll from them.

### 10. **Compendium browser**
Game data is in JSON, but there's no unified browser for spells, items, monsters, etc.

**Idea:** A searchable compendium UI for rules, spells, items, and creatures.

### 11. **Character versioning**
No history or versioning for characters.

**Idea:** Store snapshots on save so users can revert or compare versions.

### 12. **Per-player fog of war**
Fog is shared; each player could have their own revealed areas.

**Idea:** Track fog per player and sync only what each player should see.

---

## Performance

### 13. **Virtualize long lists**
These lists render all items and could benefit from virtualization:

- `ChatPanel.tsx` (lobby and game) – chat messages
- `EquipmentPickerModal.tsx` – item list
- `GearTab.tsx` – equipment list
- `QuickReference.tsx` – conditions/actions

**Fix:** Use `react-window` or `@tanstack/react-virtual` for scrollable lists that can grow large.

### 14. **Map image loading**
Map backgrounds are loaded without lazy loading or format optimization.

**Idea:** Lazy-load map images when a map is selected and consider WebP/AVIF for smaller files.

---

## Accessibility

### 15. **ARIA and semantics**
There are no `aria-*` attributes or semantic roles in the renderer.

**Fix:** Add:

- `aria-label` on icon-only buttons
- `role="dialog"` and `aria-modal="true"` on modals
- `aria-live` regions for chat and dice rolls
- Focus management in modals (trap focus, return focus on close)

---

## Architecture / Code Quality

### 16. **Error boundaries**
`App.tsx` has no error boundaries. A crash in one route can take down the whole app.

**Fix:** Wrap major routes (e.g. `InGamePage`, `LobbyPage`, `CreateCharacterPage`) in error boundaries with fallback UI.

### 17. **Global unhandled rejection handler**
There's no global handler for unhandled promise rejections.

**Fix:** Add a `window.addEventListener('unhandledrejection', ...)` handler that logs and optionally shows a user-facing error message.

### 18. **`useNetworkStore` dynamic import**
`useNetworkStore` uses a dynamic import for `useGameStore` to avoid circular deps. The callback runs asynchronously, which can introduce subtle races.

**Fix:** If possible, restructure to use a direct import, or ensure the callback is robust to late execution and state changes.

---

## Security

### 19. **File sharing validation**
In `host-manager.ts`, file sharing blocks executables but may allow `.js` and similar files.

**Fix:** Tighten the allowlist to only permit safe types (e.g. images, PDFs, JSON) and block scripts and executables.

### 20. **Path whitelist TTL**
`dialogAllowedPaths` keeps paths for 60 seconds (or until used). That may be too long for sensitive operations.

**Fix:** Shorten the TTL or clear paths sooner after use.

---

## Summary Priority Matrix

| Priority | Category      | Items                                                                 |
|----------|---------------|-----------------------------------------------------------------------|
| **P0**   | Bug fixes     | #1 (IPC null window), #2 (host cleanup), #3 (fs path cleanup)         |
| **P1**   | QoL           | #4 (chat cap), #5 (loading logic), #6 (shortcuts help), #7 (import timeout cleanup) |
| **P2**   | Robustness    | #16 (error boundaries), #17 (unhandled rejections)                     |
| **P3**   | Performance   | #13 (virtualization), #14 (map images)                                |
| **P4**   | Accessibility | #15 (ARIA)                                                            |
| **P5**   | Features      | #8–12 (macros, roll tables, compendium, versioning, per-player fog)  |
