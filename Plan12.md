# Plan 12 — Project Review & Improvement Plan

## Bug Risks & Stability

### Silent Error Swallowing
Several async operations silently discard errors, which could make debugging difficult and hide real issues from users:
- `SpellsTab.tsx` — `.catch(() => setAllSpells([]))` silently returns empty on failure
- `OffenseTab.tsx` — `.catch(() => setWeaponDb([]))` same pattern
- `GearTab.tsx` — `.catch(() => {})` completely empty catch block

**Suggestion:** At minimum, log the error. Better yet, surface a user-facing message like "Failed to load spells data."

### Race Condition Risk on Character Saves
Character and campaign saves use last-write-wins with no locking or versioning. If two save operations fire close together (e.g., auto-save + manual save), one could overwrite the other.

**Suggestion:** Add a version field to saved data and use optimistic locking to detect conflicts, or serialize writes with a queue.

### No Data Migration System
There's no schema versioning on saved JSON files. If you change the shape of `Character5e` or `Campaign`, existing user saves could silently break or lose data.

**Suggestion:** Add a `schemaVersion` field to all persisted data and implement a migration pipeline that runs on load.

### ErrorBoundary Exists but May Not Be Wired Up Globally
`ErrorBoundary.tsx` exists but it's unclear if it wraps the top-level `<App />`. An uncaught render error could crash the entire app.

**Suggestion:** Ensure `<ErrorBoundary>` wraps the router in `App.tsx` with a friendly fallback UI.

---

## Code Quality

### Leftover Debug Logging (~80+ console statements)
The networking layer (`voice-manager.ts`, `host-manager.ts`, `client-manager.ts`, `peer-manager.ts`) is particularly heavy with `console.log` statements. These leak internal state to the DevTools console in production.

**Suggestion:** Create a simple logging utility with log levels (`debug`, `info`, `warn`, `error`) and gate debug output behind `import.meta.env.DEV`.

### `any` Types in Critical Paths
- `systems/pf2e/index.ts` — Multiple `(s: any)` and `(f: any)` in filter/map chains
- `systems/dnd5e/index.ts` — Same pattern
- `systems/types.ts` — `loadEquipment()` returns `any[]`
- Network validation — `validateMessage(msg: any)`, `validateIncomingMessage(msg: any)`

**Suggestion:** Define proper types for equipment items and system data. The network validators especially should use discriminated unions or Zod schemas (you already have Zod for some message schemas).

### Duplicate Invite Code Logic
The invite code character set `'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` is duplicated in both `useCampaignStore.ts` and `peer-manager.ts`.

**Suggestion:** Extract to a shared utility like `generateInviteCode()`.

### Large Files That Would Benefit from Splitting
- `MapCanvas.tsx` — ~1000+ lines of PixiJS integration
- `save-slice.ts` — ~850+ lines
- `GearTab.tsx` — ~500+ lines
- `LobbyPage.tsx` — 10+ `useEffect` hooks

**Suggestion:** `MapCanvas` could be split into rendering layers (grid, tokens, fog-of-war, interaction handlers). `LobbyPage` effects could be extracted into custom hooks.

---

## Testing (Currently None)

There are zero test files and no test framework configured. For a project of this complexity (stat calculators, network protocols, game state management), this is a significant risk.

**High-value test targets:**
1. `stat-calculator-5e.ts` / `stat-calculator-pf2e.ts` — Pure functions, easy to test, high correctness importance
2. Network message validation schemas — Ensures malformed messages are rejected
3. `data-provider.ts` — Caching logic
4. Character/campaign import validation — Edge cases in user-provided data
5. Builder store slices — State transitions

**Suggestion:** Add Vitest (works great with electron-vite) and start with the stat calculators and validation logic.

---

## New Feature Ideas

### Undo/Redo System
There's no undo support. A misclick moving a token, accidentally deleting an NPC, or a wrong dice roll could be frustrating.

**Suggestion:** Zustand middleware can implement undo/redo with a state history stack. Prioritize this for the map canvas and game state.

### Offline Resilience / Auto-Recovery
If a player disconnects mid-session, their state could be lost. There's no reconnection logic beyond rejoining.

**Suggestion:** Implement reconnection with state resync — when a peer reconnects, the host sends a `game:state-full` message to restore their view.

### Keyboard Shortcuts
There's a reference to a deleted `useKeyboardShortcuts.ts` hook. Power users (especially DMs) would benefit greatly from shortcuts.

**Suggestion:** Add shortcuts for common actions: `Ctrl+Z` undo, `Space` next initiative turn, `D` roll dice, `Escape` close modals, `Tab` cycle tokens.

### Session Notes / DM Journal
`SessionJournal` exists in the data model but could be enhanced with:
- Timestamps and auto-logging of major events (combat start, level ups, deaths)
- Markdown editing
- Export to PDF/text for between-session recaps

### Character Sheet Export
Allow exporting character sheets to PDF or a printable format for players who want physical copies.

---

## UX & Quality of Life

### No Toast/Notification System
Currently errors show as inline banners and success actions have no feedback. Users don't know if a save succeeded, a character was deleted, or a network action completed.

**Suggestion:** Create a `Toast` component and `useToast()` hook. Use it for: save confirmations, delete confirmations, network events, import/export results.

### Inconsistent Loading States
Some pages show "Loading..." text, others show nothing while async operations run. No shared spinner or skeleton component exists.

**Suggestion:** Create a shared `Spinner` component and optionally skeleton loaders for content-heavy pages like character lists and campaign details.

### No Confirmation Dialog Component
Delete confirmations are implemented inline in multiple pages with duplicated modal logic.

**Suggestion:** Create a reusable `ConfirmDialog` component (or a `useConfirm()` hook) that standardizes destructive action confirmations.

### Missing Empty States
When a user has no characters or campaigns, the experience could be more welcoming.

**Suggestion:** `EmptyState` component exists — ensure it's used consistently with actionable CTAs like "Create your first character" with a direct button.

---

## Accessibility

This is currently the weakest area of the project:

- **No ARIA attributes** — No `aria-label`, `aria-describedby`, or `role` attributes found
- **Clickable divs** — `CharacterCard` and others use `<div onClick>` instead of `<button>` or `<a>`
- **No focus trapping in modals** — Tab key can escape modal boundaries
- **No ESC-to-close on modals** — Standard expected behavior is missing
- **Icon-only buttons lack labels** — Screen readers can't describe them

**Suggestion:** Start with the most impactful changes: add `role="dialog"` and focus trapping to `Modal`, convert clickable divs to buttons, and add `aria-label` to icon-only buttons.

---

## Performance

### No `React.memo` Usage
With 9 Zustand stores and complex game state, child components likely re-render more than necessary, especially during game sessions when state changes frequently.

**Suggestion:** Add `React.memo` to expensive components like token renderers, initiative list items, and chat message items. Profile with React DevTools first.

### No Route-Level Code Splitting
All pages are bundled together. The character builder, game engine, and campaign management are large feature areas that many users won't access simultaneously.

**Suggestion:** Use `React.lazy()` with `Suspense` for route-level code splitting:
```typescript
const InGamePage = React.lazy(() => import('./pages/InGamePage'))
const CreateCharacterPage = React.lazy(() => import('./pages/CreateCharacterPage'))
```

### Network Message Sequencing
Messages have sequence numbers but they're not used for ordering guarantees. Out-of-order messages could cause state inconsistencies.

**Suggestion:** Implement a message ordering buffer on the client that reorders messages by sequence number before processing.

---

## Security (Already Good, Minor Gaps)

Your security posture is solid (sandbox, CSP, path validation, UUID validation, rate limiting, file extension blocking). A few additions:

- **Runtime schema validation on loaded files** — Corrupted or tampered JSON files bypass TypeScript's compile-time checks. Validate with Zod on load.
- **Message size validation** — You have 65KB/8MB limits, but verify these are enforced consistently across all message types.

---

## Summary Priority Matrix

| Priority | Area | Effort |
|----------|------|--------|
| **High** | Data migration/versioning system | Medium |
| **High** | Fix silent error swallowing | Low |
| **High** | Add toast notification system | Low |
| **High** | Wire up ErrorBoundary globally | Low |
| **High** | Add Vitest + test stat calculators | Medium |
| **Medium** | Replace `any` types in systems/ | Medium |
| **Medium** | Create logging utility, remove console.log | Low |
| **Medium** | Undo/redo system | High |
| **Medium** | Extract duplicate code (invite codes, etc.) | Low |
| **Medium** | Route-level code splitting | Low |
| **Medium** | Keyboard shortcuts | Medium |
| **Medium** | Reusable ConfirmDialog component | Low |
| **Low** | Accessibility improvements | Medium |
| **Low** | Responsive design improvements | High |
| **Low** | Split large components | Medium |
| **Low** | Reconnection/recovery logic | High |
| **Low** | i18n support | High |
