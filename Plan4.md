# Plan 4 — D&D Virtual Tabletop Review

## Bugs & Issues

### Critical

- [ ] **1. Rate limiting memory leak** (`host-manager.ts`) — `messageRates` map accumulates timestamps without ever cleaning up entries for disconnected peers. Over a long session this grows unbounded.
- [ ] **2. Missing null checks in `save-slice.ts`** — `find()` calls that return `undefined` have properties accessed without guards (~lines 186, 458). Can crash during character save/load.
- [ ] **3. HP calculation edge case** (`stat-calculator-5e.ts`) — if `level` is 0 or negative (e.g. during construction), the HP formula doesn't handle it, potentially producing wrong results.
- [ ] **4. No level bounds validation** — neither `build-tree-5e.ts` nor `stat-calculator-5e.ts` validates that level stays within 1–20 for 5e. Level 21+ could produce invalid build trees or stat calculations.
- [ ] **5. Race condition on kick/ban** (`host-manager.ts`) — `setTimeout` with 100ms delay before closing connections could allow messages to slip through after the peer is supposed to be removed.

### Moderate

- [ ] **6. Timeout/interval leaks** — several components (`LobbyPage.tsx`, `voice-manager.ts`, `ChatInput.tsx`) use `setTimeout`/`setInterval` without reliable cleanup in `useEffect` return functions.
- [ ] **7. Inconsistent error handling** — some `catch` blocks silently swallow errors (`catch (_e) { }`), others log warnings, others rethrow. Makes debugging network issues difficult.
- [ ] **8. Version mismatch** — `package.json` says version `2.1.0` but `package-lock.json` says `1.0.0`.

---

## Code Quality

- [ ] **9. 20+ magic numbers** scattered throughout networking, voice chat, and UI code — timeouts (10s, 15s, 2s), size limits (32 chars, 2000 chars, 8MB), rate limits. Extract to a shared constants file.
- [ ] **10. 15+ `any` type usages and unsafe type assertions** — especially in `host-manager.ts`, `client-manager.ts`, `voice-manager.ts`, and extensively in `save-slice.ts`. Bypasses TypeScript safety.
- [ ] **11. Duplicated timeout cleanup pattern** — the same `setTimeout` + `clearTimeout` pattern is repeated in many components without a shared utility hook (e.g. `useTimeout`, `useInterval`).

---

## Missing / Incomplete Features

- [ ] **12. Calendar page** — route exists (`/calendar`) but has no meaningful implementation.
- [ ] **13. Journal system** — data structures exist (`SessionJournal`, `JournalEntry`) but no creation UI or rich text editor.
- [ ] **14. Spell browser** — spell data loads and spell slot tracking exists, but no spell list/search/selection UI for players.
- [ ] **15. Equipment picker** — equipment data exists in JSON, but no browse/search UI for selecting items outside the shop.
- [ ] **16. Map upload** — map background image loading works, but no user-facing upload/import flow.

---

## Quality-of-Life Suggestions

- [ ] **17. Character search & filter** on `ViewCharactersPage` — as the character list grows, finding characters becomes tedious.
- [ ] **18. Character duplication** — let users clone an existing character as a starting point.
- [ ] **19. Undo/redo for token movements** on the map — accidental drags are hard to fix.
- [ ] **20. Right-click context menus** on tokens — for quick actions like "apply damage", "add condition", "remove from map."
- [ ] **21. Initiative auto-roll** — calculate from character DEX modifier instead of requiring manual entry every combat.
- [ ] **22. Dice formula favorites** — save frequently used roll formulas (e.g. "Greatsword: 2d6+4") for one-click access.
- [ ] **23. Connection quality indicator** — show players their latency/connection status to the host.
- [ ] **24. Fog of war area reveals** — rectangle/circle selection tools instead of only brush-based fog editing.
- [ ] **25. Keyboard shortcuts documentation** — `useKeyboardShortcuts` hook exists but no discoverable help UI (a `?` overlay or settings panel).

---

## New Feature Ideas

- [ ] **26. Combat log / action history** — scrollable timeline of all combat actions, damage dealt, conditions applied.
- [ ] **27. Death save tracker (5e)** — visual tracker for successes/failures during death saves.
- [ ] **28. Drawing tools on maps** — lines, shapes, freehand, text annotations for planning movements or marking areas.
- [ ] **29. Monster/NPC stat blocks** — browseable compendium or quick-reference for DMs during encounters.
- [ ] **30. Quest tracker** — shared quests with objectives and progress that the DM can manage and players can view.
- [ ] **31. Party inventory** — shared storage for party loot, with gold splitting utilities.
- [ ] **32. Export to PDF** — printable character sheets and campaign summaries.
- [ ] **33. Push-to-talk** — voice chat currently only has mute/unmute and VAD, no push-to-talk keybind option.

---

## Accessibility

- [ ] **34. Missing ARIA labels** — most icon-only buttons (DM toolbar, panel toggles) lack `aria-label` attributes.
- [ ] **35. No visible focus indicators** — keyboard users can't see what's focused. Tailwind's `focus-visible:ring` would help.
- [ ] **36. No `aria-live` regions** — chat messages, dice rolls, and initiative changes aren't announced to screen readers.
- [ ] **37. Modal focus trapping** — `Modal` component doesn't trap focus, allowing tab to escape behind it.
- [ ] **38. Color contrast** — some gray-on-gray text combinations (e.g. secondary text on dark cards) may fail WCAG AA.

---

## Settings / Configuration

- [ ] **39. User preferences** — theme toggle, font size, UI density, keybind customization.
- [ ] **40. Voice quality settings** — bitrate, codec selection, push-to-talk keybind.
- [ ] **41. Per-campaign custom conditions** — beyond the standard conditions, let DMs define homebrew conditions.
- [ ] **42. Debug/developer mode** — network logs, state inspector, performance metrics toggle for troubleshooting.
