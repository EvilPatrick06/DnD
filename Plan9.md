# Plan 9 — Project Review & Improvement Roadmap

## Bug Fixes (Critical)

### 1. Unhandled Promise Rejections in Selection Slice
- **File**: `src/renderer/src/stores/builder/slices/selection-slice.ts`
- **Lines**: ~137-228
- **Issue**: Multiple `.then()` chains without `.catch()` handlers. If data loading fails, errors are silently swallowed and the builder can end up in an inconsistent state.
- **Fix**: Wrap in try/catch or add `.catch()` handlers to every promise chain.

### 2. Memory Leak — `setInterval` in LobbyPage
- **File**: `src/renderer/src/pages/LobbyPage.tsx`
- **Lines**: ~132-151
- **Issue**: `setInterval` created in a `useEffect` with an empty dependency array. If the component unmounts during initialization, the interval keeps running.
- **Related**: `initVoice` callback recreated every render but listed as a dependency (~line 121-129), causing the effect to re-run more than intended.
- **Fix**: Ensure cleanup function clears the interval. Memoize `initVoice` with `useCallback`.

### 3. Memory Leak — Timeout Not Cleared on Error
- **File**: `src/renderer/src/network/client-manager.ts`
- **Lines**: ~189-192
- **Issue**: `setTimeout` for connection timeout is only cleared on success, not on error paths. If a connection errors out, the timeout callback still fires.
- **Fix**: Clear the timeout in all exit paths (success, error, and cleanup).

### 4. Unsafe Type Assertions in GearTab
- **File**: `src/renderer/src/components/builder/GearTab.tsx`
- **Lines**: ~250-281, 374-375, 385, 392-393
- **Issue**: Multiple `as unknown as Record<string, unknown>` casts followed by property access without null checks. Runtime crashes if data doesn't match expectations.
- **Fix**: Add null/undefined checks after every property access, or create typed helper functions.

### 5. Array Access Without Bounds Check
- **File**: `src/renderer/src/components/lobby/ChatInput.tsx:62`
  - `messages[messages.length - 1]` without checking if the array is empty.
- **File**: `src/renderer/src/stores/builder/slices/save-slice.ts:412`
  - `cls.keyAbility[0]` without checking array length.
- **Fix**: Add length checks before access.

### 6. Non-null Assertion on Ref
- **File**: `src/renderer/src/components/game/MapCanvas.tsx:205`
- **Issue**: `worldRef.current!` uses a non-null assertion without a prior check, risking a null reference error.
- **Fix**: Add a null guard before usage.

---

## Code Quality Improvements

### 7. Add ESLint + Prettier
- **Issue**: No linting or formatting setup for ~168 TS/TSX files.
- **Action**: Add ESLint with `@typescript-eslint`, `eslint-plugin-react-hooks`, and Prettier. This will catch missing dependency arrays, unused variables, and enforce consistent style.

### 8. Add a Test Framework
- **Issue**: No tests exist anywhere in the project.
- **Action**: Add Vitest (integrates with Vite). Priority test targets:
  - `stat-calculator-5e.ts` / `stat-calculator-pf2e.ts`
  - `dice-engine.ts`
  - `build-tree-5e.ts` / `build-tree-pf2e.ts`
  - `character-io.ts` / `campaign-io.ts`

### 9. Extract Hardcoded Constants
- **Issue**: Magic numbers scattered across the codebase.
- **Action**: Create `src/renderer/src/config/constants.ts` and centralize:
  - Voice detection threshold (`VAD_THRESHOLD = 30`) — `voice-manager.ts:34`
  - Voice check interval (`100ms`) — `voice-manager.ts:35`
  - Connection timeout (`15000ms`) — `client-manager.ts:189`
  - File size limit (`8MB`) — `host-manager.ts:501`
  - Voice retry count (`10`) and interval (`1000ms`) — `voice-manager.ts:474`
  - Grace period timeout (`4000ms`) — `InGamePage.tsx`

### 10. Break Up Large Files
- **Issue**: Several files are 500-700+ lines, hard to maintain.
- **Action**:
  - `host-manager.ts` (~700 lines) → split into connection management, message routing, and moderation modules.
  - `useNetworkStore.ts` (~540 lines) → extract host logic, client logic, and shared state into separate files.
  - `GameLayout.tsx` (~700 lines) → extract sub-panels into dedicated components.

### 11. Runtime Validation for Loaded Data
- **File**: `src/renderer/src/stores/useCharacterStore.ts:30, 40`
- **Issue**: `as unknown as Character[]` and similar casts bypass type safety when loading from disk.
- **Fix**: Add a lightweight runtime validation function to check loaded JSON structure before casting. Prevents corrupted save files from crashing the app.

### 12. Watch for Circular Dependencies
- **Issue**: `useNetworkStore` imports `useLobbyStore`, and `useLobbyStore` may import network modules.
- **Fix**: Introduce a mediator pattern or event bus to decouple stores. Alternatively, use Zustand's `getState()` for cross-store reads instead of direct imports.

---

## New Features

### 13. Toast/Notification System
- **Issue**: No reusable toast component. Ad-hoc banners, phase change toasts, and inline "Copied!" text exist but are inconsistent.
- **Action**: Build a lightweight toast manager (queue-based, auto-dismiss, stacked positioning). Use for:
  - Save confirmations
  - Connection status changes
  - Dice roll results for remote players
  - Error alerts

### 14. Undo/Redo in Character Builder
- **Issue**: Complex multi-step character creation with no way to backtrack.
- **Action**: Add undo/redo via Zustand middleware (e.g., `zundo`). Apply to builder store state changes.

### 15. Keyboard Shortcuts Expansion
- **Issue**: `useKeyboardShortcuts.ts` exists but is minimal.
- **Action**: Add shortcuts:
  - `Ctrl+S` — save character/campaign
  - `Ctrl+Z` / `Ctrl+Y` — undo/redo
  - `Escape` — close modals
  - `Space` — advance initiative
  - `/` — focus chat input
  - `D` — open dice roller

### 16. Auto-Save / Draft System
- **Issue**: If the app crashes mid-character-creation, all progress is lost.
- **Action**: Auto-save drafts to localStorage or a temp file every 30 seconds. Restore on next launch with a "Resume draft?" prompt.

### 17. Search & Filter for Characters
- **Issue**: `ViewCharactersPage` lists characters without search or filtering.
- **Action**: Add search bar + filters for class, level, and game system. Essential as the character list grows.

### 18. Session History / Adventure Log
- **Issue**: No persistent record of game sessions.
- **Action**: Track and persist dice rolls, chat messages, initiative changes, and key events per session. Let players review past session summaries.

### 19. Map Grid Snapping & Measurement Tool
- **Issue**: Standard VTT expectation that may be missing.
- **Action**: Add grid-snap for token movement and a click-drag measurement tool (displays distance in feet).

### 20. Campaign Notes Sharing
- **Issue**: `DMNotepad.tsx` exists for DM-only notes, but no shared notes for players.
- **Action**: Add a shared notes panel or session summary that the DM can publish to all connected players.

---

## UX / Quality of Life

### 21. Skeleton Loaders
- **Issue**: Loading states are text-only (`"Loading characters..."`) or basic spinners.
- **Action**: Add skeleton loaders (shimmer placeholders matching content layout) for character lists, campaign details, and other content-heavy pages.

### 22. Modal Animations
- **Issue**: Modals pop in without transitions.
- **Action**: Add fade-in + scale-up animation (150-200ms) for modals. Add fade-out on close.

### 23. Theme System Migration
- **Issue**: 4-theme system exists (`dark`, `parchment`, `high-contrast`, `royal-purple`) with CSS custom properties, but many components still use hardcoded Tailwind colors (`bg-gray-800`, `text-amber-400`) instead of CSS variables.
- **Action**: Audit all components and migrate hardcoded colors to `var(--bg-primary)`, `var(--accent-primary)`, etc. so all themes work correctly everywhere.

### 24. Confirmation Dialogs for Destructive Actions
- **Issue**: Verify that all destructive actions have confirmation dialogs.
- **Action**: Ensure character deletion, campaign deletion, kicking/banning players, and leaving a game all prompt for confirmation.

### 25. Connection Status Indicator
- **Issue**: No persistent network quality indicator during multiplayer sessions.
- **Action**: Add a connection quality badge to the game HUD showing latency and connection state (connected/reconnecting/disconnected).

### 26. Dice Roll History Panel
- **Issue**: No persistent view of recent rolls.
- **Action**: Add a scrollable sidebar or collapsible panel showing recent dice rolls (who rolled, what formula, result, timestamp).

---

## Accessibility

### 27. Missing ARIA Labels
- **Issue**: Many interactive elements (buttons, icon-only controls) lack `aria-label` attributes.
- **Examples**: Close button in `LobbyPage`, remove buttons in `GearTab`.
- **Action**: Audit all buttons and interactive elements. Add descriptive `aria-label` to every icon-only or ambiguous control.

### 28. Fix Focus Outline Handling
- **Issue**: `focus:outline-none` is used on inputs/buttons, breaking keyboard accessibility.
- **Fix**: Replace with `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500` so mouse users don't see outlines but keyboard users do.

### 29. Add Global `focus-visible` Styles
- **File**: `src/renderer/src/styles/globals.css`
- **Issue**: No `:focus-visible` styles defined.
- **Action**: Add global focus-visible styling for keyboard navigation support.

### 30. Screen Reader Announcements for Dynamic Content
- **Issue**: Dice results, chat messages, initiative changes, and connection events are not announced.
- **Action**: Add an `aria-live` region so screen reader users can follow dynamic game events.

---

## Security

### 31. Console Logging of Sensitive Data
- **Files**: `host-manager.ts:629`, `voice-manager.ts:79, 176`
- **Issue**: Peer IDs, display names, and connection details logged to console.
- **Action**: Strip or reduce console output in production builds. Use a log-level system.

### 32. Display Name Validation
- **File**: `src/renderer/src/network/host-manager.ts:610`
- **Issue**: Display names are sanitized but not validated for empty strings or excessively long strings.
- **Fix**: Add min length (1), max length (32), and reject whitespace-only names.

---

## Priority Matrix

| Priority | Category | Items |
|----------|----------|-------|
| **Now** | Bug fixes | #1-6 (memory leaks, unhandled promises, unsafe casts) |
| **Soon** | Infra | #7 ESLint, #9 constants file, #11 runtime validation |
| **Next** | Features | #13 toast system, #16 auto-save, #14 undo/redo |
| **Ongoing** | UX | #21-23 skeletons, modal animations, theme migration |
| **Backlog** | Features | #17-20 search, session log, measurement, shared notes |
| **Backlog** | A11y | #27-30 ARIA, focus-visible, screen reader support |
