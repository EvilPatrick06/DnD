# D&D Virtual Tabletop — Suggestions & Improvements

## Bug Fixes

### High Priority

1. **`ViewCharactersPage.tsx:49` — setTimeout without cleanup**
   - `setTimeout(() => setImportError(null), 5000)` is never cleared.
   - If the user navigates away before 5 seconds, the callback can run on an unmounted component.
   - **Fix:** Store the timeout ID in a ref and clear it in a `useEffect` cleanup.

2. **`LobbyPage.tsx:159` — setTimeout without cleanup**
   - `setTimeout(() => callPeer(peer.peerId), 1500)` is not cleared if the component unmounts.
   - **Fix:** Store the timeout ID and clear it in the effect cleanup.

3. **`LobbyPage.tsx:141` — setInterval cleanup**
   - The interval is cleared in the effect cleanup, but `count` is captured in a closure; the logic is correct.
   - **Verify:** Ensure `clearInterval` is always called on unmount.

4. **`LobbyPage.tsx:423` — setTimeout for "code copied"**
   - `setTimeout(() => setCodeCopied(false), 2000)` is not cleared on unmount.
   - **Fix:** Store the timeout ID and clear it in cleanup.

5. **`InGamePage.tsx:30` — Loading timeout**
   - `setTimeout(() => setLoading(false), 4000)` is not cleared.
   - **Fix:** Return a cleanup that clears the timeout.

6. **`DiceRoller.tsx:77` — Animation timeout**
   - `setTimeout(() => setAnimatingId(null), 500)` is not cleared.
   - **Fix:** Store the timeout ID and clear it on unmount.

7. **`GearTab.tsx:534` — Shop warning timeout**
   - `setTimeout(() => setShopWarning(null), 3000)` is not cleared.
   - **Fix:** Store the timeout ID and clear it on unmount.

### Medium Priority

8. **`ChatInput.tsx:31–48` — Cooldown interval**
   - The effect depends on `cooldownRemaining` and `slowModeSeconds`. When `cooldownRemaining` changes every 200ms, the effect re-runs and may create multiple intervals.
   - **Fix:** Use a single interval and update state inside it, or use a ref for the interval and avoid `cooldownRemaining` in the dependency array.

9. **`voice-manager.ts` — VAD interval**
   - `vadInterval` is module-level; ensure it is cleared when `stopVoice()` is called and on cleanup paths.

10. **`host-manager.ts` / `client-manager.ts` — Timeouts**
    - Verify all `setTimeout`/`setInterval` calls are cleared on disconnect/cleanup.

---

## Quality of Life

### Navigation & Discoverability

11. **Main menu missing routes**
    - Routes exist for `/campaign/:id` and `/calendar`, but there are no main menu links.
    - **Suggestion:** Add "Campaigns" and "Calendar" to the main menu, or a "Campaigns" item that lists campaigns.

12. **Version mismatch**
    - `MainMenuPage.tsx:56` shows `v1.0.0` while `package.json` has `2.1.0`.
    - **Fix:** Use the version from `package.json` (e.g. via `import.meta.env` or a shared constant).

13. **Keyboard shortcuts**
    - Shortcuts exist but are not discoverable.
    - **Suggestion:** Add a `?` or `Ctrl+K` shortcut to show a help overlay with all shortcuts.

14. **Back navigation**
    - Some pages use "Back to Menu" and others use `BackButton` with different targets.
    - **Suggestion:** Standardize back behavior (e.g. always to previous route or to main menu).

### User Feedback

15. **No toast/notification system**
    - Errors are often only in the console.
    - **Suggestion:** Add a simple toast system for success/error (e.g. import success, connection failed).

16. **Loading states**
    - Some async operations (e.g. AI DM, network reconnects) lack loading indicators.
    - **Suggestion:** Add loading spinners or skeletons for long-running operations.

17. **Import error persistence**
    - `MakeGamePage` keeps import errors until the user navigates away; `ViewCharactersPage` auto-clears after 5 seconds.
    - **Suggestion:** Make behavior consistent (e.g. both auto-dismiss or both persist until dismissed).

### Accessibility

18. **ARIA labels**
    - Many icon buttons (settings, attach, panel toggles) lack `aria-label`.
    - **Suggestion:** Add `aria-label` to icon-only buttons.

19. **Focus management**
    - Modals and panels may not trap or restore focus correctly.
    - **Suggestion:** Ensure focus is trapped in modals and restored when they close.

---

## New Features

### Gameplay

20. **Undo/redo for DM actions**
    - Token moves, fog changes, and map edits are irreversible.
    - **Suggestion:** Add an undo stack for DM actions (e.g. last N actions).

21. **Multi-select tokens**
    - Only single-token selection is supported.
    - **Suggestion:** Shift+click or box-select to move/apply conditions to multiple tokens.

22. **Condition templates**
    - Conditions are free-form.
    - **Suggestion:** Predefined templates (e.g. "Poisoned", "Restrained") with standard effects.

23. **Initiative auto-advance**
    - Turn advancement is manual.
    - **Suggestion:** Optional timer (e.g. 30s) to auto-advance initiative.

24. **Dice history panel**
    - Dice rolls appear in chat only.
    - **Suggestion:** Dedicated dice history with basic stats (e.g. average, distribution).

### Content & Data

25. **Session notes auto-save**
    - DM notes are saved manually.
    - **Suggestion:** Auto-save every N seconds or on blur.

26. **Game state export/import**
    - Mid-session state cannot be saved/restored.
    - **Suggestion:** Export/import game state (maps, tokens, initiative) to JSON.

27. **Adventure loader**
    - `adventure-loader.ts` exists but integration is unclear.
    - **Suggestion:** Document and expose "Load adventure" in the campaign flow.

### Integration

28. **D&D Beyond import**
    - Basic import exists; validation and error reporting could be improved.
    - **Suggestion:** Clear validation errors and guidance when import fails.

29. **Clipboard paste for maps**
    - Map images are added via file picker.
    - **Suggestion:** Support paste from clipboard for quick map setup.

---

## Code Quality

### Maintainability

30. **Extract magic numbers**
    - Examples: `host-manager.ts` (65536, 8*1024*1024, 10000), `LobbyPage` (1500, 2000), `InGamePage` (4000).
    - **Suggestion:** Move to named constants (e.g. `MESSAGE_SIZE_LIMIT`, `JOIN_TIMEOUT_MS`).

31. **Logging**
    - Many `console.log`/`console.warn` calls.
    - **Suggestion:** Use a logging utility with levels (e.g. `debug`/`info`/`warn`/`error`) and disable debug in production.

32. **`dm-action-executor.ts` dynamic require**
    - `require('../stores/useAiDmStore')` is used to avoid circular deps.
    - **Suggestion:** Refactor to break the circular dependency so a static import can be used.

### Type Safety

33. **Array access**
    - Patterns like `players[0]` or `players.find() || players[0]` can be `undefined`.
    - **Suggestion:** Add null checks or use `players[0] ?? fallback` with proper typing.

34. **`characterId!` non-null assertion**
    - `GameLayout.tsx` uses `p.characterId!` after filtering.
    - **Suggestion:** Use a type guard: `filter((p): p is LobbyPlayer & { characterId: string } => !!p.characterId)`.

---

## Performance

35. **`GameLayout.tsx` size**
    - Large component with many responsibilities.
    - **Suggestion:** Split into smaller components (e.g. `GameTopBar`, `GameMapArea`, `GameSidePanel`) to reduce re-renders.

36. **Store subscriptions**
    - Components may subscribe to more store state than needed.
    - **Suggestion:** Use narrow selectors (e.g. `(s) => s.initiative`) instead of the whole store where possible.

37. **Monster/spell data**
    - Large JSON files are loaded eagerly.
    - **Suggestion:** Lazy-load or paginate when lists are large.

---

## Security

38. **Chat content**
    - Chat is rendered with `{msg.content}`; React escapes by default, so XSS risk is low.
    - **Suggestion:** Avoid `dangerouslySetInnerHTML` for user content; if needed, sanitize first.

39. **File upload validation**
    - MIME and size checks exist in `host-manager.ts`.
    - **Suggestion:** Document and keep validation consistent for all file upload paths.

---

## Summary

| Category      | Count |
|---------------|-------|
| Bug fixes     | 10    |
| Quality of life | 9   |
| New features  | 10    |
| Code quality  | 5     |
| Performance   | 3     |
| Security      | 2     |

**Suggested order of work:**
1. Fix timeout/interval cleanup bugs (items 1–7).
2. Sync version display with `package.json`.
3. Add main menu links for Campaigns and Calendar.
4. Introduce a simple toast system for user feedback.
5. Extract magic numbers into constants.
6. Split `GameLayout` into smaller components.

---

## DMG 2024 Markdown Reference Files

All 18 files live in `5.5e References/DMG2024/markdown/`.

| File | Chapter | Content |
|------|---------|---------|
| `ch1-the-basics.md` | Ch 1 | DM role, tips, session prep, example of play |
| `ch2-running-the-game.md` | Ch 2 | Know your players, narration, combat, exploration, social interaction |
| `ch3-dms-toolbox.md` | Ch 3 | Alignment, backgrounds, creatures, spells, chases, curses, death, doors, dungeons, environment, fear, firearms, gods, hazards, mobs, NPCs, poison, prestige, renown, settlements, siege, gifts, traps |
| `ch4-creating-adventures.md` | Ch 4 | Premise, encounters, hooks, adventure situations by level, sample adventures |
| `ch5-creating-campaigns.md` | Ch 5 | Campaign creation, journal, premise, characters, conflicts, flavors of fantasy, settings, Greyhawk |
| `ch6-cosmology.md` | Ch 6 | Planes overview, Great Wheel, planar travel, portals, Blood War, full Tour of the Multiverse (30+ planes) |
| `ch7-treasure-tables.md` | Ch 7 | Coins, trade bars, trade goods, gemstones, art objects, treasure themes, random treasure tables |
| `ch7-magic-item-rules.md` | Ch 7 | Categories, rarity, attunement, crafting, charges, cursed items, sentient items, artifacts, random magic item tables |
| `ch7-magic-items-a-b.md` | Ch 7 | Magic items A–B |
| `ch7-magic-items-c-d.md` | Ch 7 | Magic items C–D |
| `ch7-magic-items-e-h.md` | Ch 7 | Magic items E–H |
| `ch7-magic-items-i-o.md` | Ch 7 | Magic items I–O |
| `ch7-magic-items-p-r.md` | Ch 7 | Magic items P–R |
| `ch7-magic-items-s-z.md` | Ch 7 | Magic items S–Z |
| `ch8-bastions.md` | Ch 8 | Bastion rules, basic/special facilities, orders, hirelings, events |
| `appendix-a-lore-glossary.md` | App A | Lore glossary of iconic people and places |
| `appendix-b-maps.md` | App B | Map descriptions and references |
| `index.md` | Index | Full alphabetical index with page numbers |
