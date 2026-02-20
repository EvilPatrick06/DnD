# Plan 7 — Audit & Improvement Plan

## Bugs (Fix Now)

### 1. Armor toggle logic bug in `useCharacterStore`
The comparison in `toggleArmorEquipped` appears to compare `armorId` against itself rather than the found armor's type, which could lead to incorrect armor equip/unequip behavior.

### 2. Direct mutation in `useGameStore.startInitiative`
`sorted.forEach((e, i) => { e.isActive = i === 0 })` mutates objects directly instead of creating new ones. This can cause Zustand to miss updates since it relies on reference equality.

### 3. Force-deafen logic in `useNetworkStore`
`isForceMuted = isForceDeafened ? true : false` is a roundabout way to write `isForceMuted = isForceDeafened`, and may not correctly represent the intended relationship between mute and deafen states.

### 4. Client reconnection loses character selection
When a client reconnects, `characterId` and `characterName` are sent as `null` in the `player:join` message. The reconnection flow doesn't store/restore these values, so the player loses their character assignment.

### 5. Host ban-list race condition
`setCampaignId()` loads bans asynchronously but doesn't block incoming connections. A banned peer could connect before the ban list finishes loading.

### 6. Event listener memory leaks in `useNetworkStore`
Listeners registered in `hostGame` and `joinGame` are never cleaned up. Calling these multiple times (e.g., host retries) stacks duplicate listeners.

### 7. Host connection timeouts not cleared on close/error
If a connection closes before the join timeout fires, the timeout still executes and tries to close an already-closed connection.

---

## Code Quality & Refactoring

### 8. `save-slice.ts` is 853 lines
`buildCharacter5e` and `buildCharacterPf2e` share significant patterns but are duplicated. Split into `save-slice-5e.ts` and `save-slice-pf2e.ts`, and extract shared equipment-building logic into a utility.

### 9. Unsafe type casts throughout stores
Multiple `as unknown as Campaign[]` and `as unknown as Character[]` casts in store loading functions. These bypass TypeScript safety entirely. Consider adding runtime validation with a library like Zod.

### 10. Unbounded chat message array in `useLobbyStore`
Chat messages grow forever with no cap. In a long session this could consume significant memory. Add a rolling limit (e.g., keep the last 1,000 messages).

### 11. Race conditions in `selection-slice.ts`
Multiple parallel `load*().then(...)` calls after `acceptSelection` can complete out of order, potentially overwriting each other's state. Use `Promise.all()` to coordinate them.

### 12. Data provider cache never expires
`loadJson` caches data forever. If you ever support hot-reloading data files or modding, this will serve stale results.

### 13. Magic numbers in networking
Timeouts (`10000`, `15000`), size limits (`65536`, `8 * 1024 * 1024`), and rate limits are hardcoded throughout. Extract to named constants.

---

## Security

### 14. Large message parsed before size rejection
The host parses the full JSON of messages > 64KB before checking if they should be rejected. A malicious client could send huge payloads to cause memory spikes. Check size *before* `JSON.parse`.

### 15. No global rate limit
Rate limiting is per-peer only. Many peers at their individual limit could collectively overwhelm the host. Add a global messages-per-second cap.

### 16. Dice formula has no bounds validation
`rollDice("9999d9999")` would work. Lobby chat parses dice commands from user input without validating reasonable bounds. Cap dice count and sides.

### 17. Character/campaign import has minimal validation
`deserializeCharacter` only checks `id`, `gameSystem`, and `name`. Malformed nested data (skills, spells, ability scores) would pass through and cause runtime errors later.

---

## Accessibility (a11y)

### 18. Modals lack ARIA attributes
No `role="dialog"`, `aria-modal="true"`, or `aria-labelledby` on modals. Focus is not trapped inside modals and not restored on close.

### 19. No keyboard navigation for custom dropdowns
Components like `CharacterSelector` and the calendar day picker don't support arrow keys, Enter, or Escape.

### 20. Interactive elements missing `aria-label`
Buttons, inputs, and icon-only controls throughout the app lack accessible labels.

### 21. No `aria-live` regions for dynamic content
Chat messages, dice rolls, and status changes don't announce to screen readers.

### 22. Collapsible sections missing `aria-expanded`
`SheetSectionWrapper` toggles visibility but doesn't communicate state to assistive technology.

---

## Performance

### 23. No memoization on expensive calculations
Skill modifiers, spell groupings, proficiency bonuses, and stat calculations recompute on every render in sheet components. Wrap in `useMemo`.

### 24. Chat messages need virtualization
`ChatPanel` renders every message in the DOM. For long sessions, use `react-window` or similar.

### 25. Large page components cause full re-renders
`CampaignDetailPage` (~760 lines) and `LobbyPage` (~550 lines) re-render entirely on any related store change. Break into smaller sub-components with targeted store subscriptions.

### 26. List items should use `React.memo`
`PlayerCard`, message bubbles, and character list items re-render when sibling items change.

---

## Missing Features & QoL

### 27. No undo/redo
Campaign editing (NPCs, rules, lore, maps) has no undo. Accidental deletes are permanent.

### 28. No keyboard shortcuts help overlay
`useKeyboardShortcuts` hook exists but there's no discoverable UI showing available shortcuts.

### 29. No connection quality indicator
Players have no visibility into their P2P connection quality (latency, packet loss).

### 30. No host migration
If the DM disconnects, the entire session ends. Consider a host-migration or session-persistence mechanism.

### 31. No print/PDF export for character sheets
A frequently requested feature for tabletop players who want paper backups.

### 32. Quick HP adjustment buttons
The character sheet could have +1/-1, +5/-5 quick buttons instead of requiring manual number entry.

### 33. Search/filter for spells, equipment, and features
Long lists on the character sheet have no filtering. This gets unwieldy at higher levels.

### 34. No onboarding or tutorial
New users have no guided introduction to the app's features.

### 35. Warlock pact magic not handled
`spell-data.ts` uses standard slot progression. Warlocks use a completely different system (pact magic) that isn't accounted for.

### 36. No multiclass spell slot calculation
Spell slot progression is per-class only; multiclassed characters would get incorrect slots.

### 37. No test framework
No vitest, jest, or any test configuration. Critical business logic (stat calculators, build trees, dice engine, networking) has zero test coverage.

### 38. No linter configured
No ESLint or Prettier. Code style consistency relies entirely on developer discipline.

### 39. No README
Only `CLAUDE.md` exists. A proper README would help onboard contributors.

---

## Priority Summary

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| Bugs | 4 (#1-4) | 3 (#5-7) | — | — |
| Code Quality | — | 2 (#8-9) | 4 (#10-13) | — |
| Security | 1 (#14) | 2 (#15-16) | 1 (#17) | — |
| Accessibility | 2 (#18-19) | 3 (#20-22) | — | — |
| Performance | — | 2 (#23-24) | 2 (#25-26) | — |
| Features/QoL | — | 3 (#30, #35-36) | 5 (#27-29, #37-38) | 5 (#31-34, #39) |
