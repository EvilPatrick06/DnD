# D&D VTT – Suggestions & Improvements

## Critical / Bug Fixes

### 1. **IPC handlers hide errors**
`src/main/ipc/index.ts` – Load handlers return empty arrays or `null` on failure, so the UI can't show errors.

```51:65:src/main/ipc/index.ts
  ipcMain.handle('storage:load-characters', async () => {
    const result = await loadCharacters()
    if (result.success) {
      return result.data
    }
    return []
  })
```

**Suggestion:** Return `{ success, data?, error? }` (like save handlers) and surface `result.error` in the UI.

---

### 2. **`JSON.parse` without try/catch**
Several places call `JSON.parse` without handling parse errors:

| File | Line | Risk |
|------|------|------|
| `character-io.ts` | 15 | Malformed import file crashes |
| `campaign-io.ts` | 21 | Same for campaigns |
| `host-manager.ts` | 500, 520 | Malformed network message can crash host |
| `client-manager.ts` | 218 | Same for client |
| `main/ipc/index.ts` | 116 | Corrupt bans file crashes |
| `characterStorage.ts` / `campaignStorage.ts` | 64, 93 | Corrupt file can crash |

**Suggestion:** Wrap in `try/catch` and return structured errors or fallbacks instead of letting parse errors propagate.

---

### 3. **`load-bans` assumes directory exists**
`src/main/ipc/index.ts:107–119` – `readFile` on a bans file can fail if the `bans` directory doesn't exist.

**Suggestion:** Ensure the directory exists (e.g. `mkdir` with `recursive: true`) before reading, or handle `ENOENT` and return `[]`.

---

### 4. **`useCharacterStore` save result handling**
`src/renderer/src/stores/useCharacterStore.ts:40–42` – On save failure, the store still updates local state as if the save succeeded.

**Suggestion:** Only update `characters` when `result.success` is true; otherwise show an error and keep the previous state.

---

## Quality of Life

### 5. **User-facing error feedback**
Load/save failures are mostly logged to the console. Users see empty lists or no feedback.

**Suggestion:** Add a toast/notification system and show messages like "Failed to load characters" or "Save failed" with optional retry.

---

### 6. **Loading states**
`useCharacterStore.loadCharacters()` sets `loading: true`, but many pages don't show it. Campaign loads and other async work often have no loading UI.

**Suggestion:** Use `loading` in `ViewCharactersPage` and `CampaignDetailPage`, and add loading states for other heavy async flows.

---

### 7. **Keyboard shortcuts**
`CLAUDE.md` mentions shortcuts, but only "N" for next turn is wired in `InGamePage`.

**Suggestion:** Add shortcuts for:
- HP +/- (e.g. `+` / `-`)
- Condition toggles
- Quick spell slot use
- Undo/redo for map edits (when implemented)

---

### 8. **Search in large lists**
SpellsTab, QuickReference, and builder modals already have search. Other large lists do not:

- Equipment picker
- Feat lists
- Character list (only status filter)
- NPC list in campaign

**Suggestion:** Add search/filter where lists are long (e.g. 20+ items).

---

### 9. **Accessibility**
- Many buttons lack `aria-label` or `title`
- Modals may not trap focus
- Color-only indicators (e.g. spell slots) lack text alternatives

**Suggestion:** Add `aria-label`/`title` on icon-only buttons, implement focus trapping in modals, and ensure important state has text (e.g. "3 of 4 slots remaining").

---

## New Features

### 10. **Rest tracking UI**
`restTracking` exists in game state but has no UI.

**Suggestion:** Add a small "Rest" control (Short Rest / Long Rest) that triggers the existing rest logic and updates character state.

---

### 11. **Concentration tracking**
Concentration is tracked in turn state but not clearly surfaced.

**Suggestion:** Add a visible concentration indicator (e.g. badge or icon) and a way to drop concentration.

---

### 12. **Spell preparation limits**
Prepared casters can exceed limits in the builder.

**Suggestion:** Validate prepared spell count against `PREPARED_SPELLS` and show a warning or block over-selection.

---

### 13. **Encumbrance warnings**
No encumbrance logic in the builder.

**Suggestion:** Compute carried weight vs. capacity and show a warning when over limit (optional, behind a setting).

---

### 14. **Export/import game state**
Characters and campaigns can be exported; game state cannot.

**Suggestion:** Add export/import for initiative, map state, tokens, and fog of war for session persistence.

---

## Code Quality

### 15. **Shared storage layer**
`characterStorage.ts`, `campaignStorage.ts`, and `bastionStorage.ts` share the same pattern.

**Suggestion:** Extract a generic `JsonFileStorage<T>` (or similar) to reduce duplication and centralize error handling.

---

### 16. **Shared UUID validation**
`isValidUUID` is duplicated in `ipc/index.ts` and storage modules.

**Suggestion:** Move to a shared util (e.g. `utils/uuid.ts`) and reuse everywhere.

---

### 17. **`character-io` / `campaign-io` error handling**
`deserializeCharacter` and `importCampaign` can throw on malformed JSON. Callers may not catch.

**Suggestion:** Wrap parsing in try/catch and return `{ success, data?, error }` instead of throwing, or document that callers must catch.

---

### 18. **`SpellSlotTracker` local vs. external state**
`SpellSlotTracker` keeps local state when `onSlotChange` is not provided, so parent-driven updates can be ignored.

**Suggestion:** Prefer controlled usage: always pass `spellSlots`/`focusPoints` and `onSlotChange`/`onFocusChange` from the parent, or clearly document when local state is used.

---

## Performance

### 19. **Memoization of heavy calculations**
`stat-calculator-5e`, `computeDynamicAC`, and similar logic run on each render.

**Suggestion:** Memoize with `useMemo` when inputs (character, equipment, etc.) are stable, or move to selectors that only recompute when dependencies change.

---

### 20. **`GameLayout` effect dependencies**
Effects in `GameLayout` depend on large objects (e.g. `map`, `gameStore`), which can cause frequent re-runs.

**Suggestion:** Narrow dependencies to primitive IDs or specific fields instead of whole objects.

---

## Security

### 21. **Chat message display**
Chat messages are rendered without HTML sanitization.

**Suggestion:** Sanitize or escape user content before rendering (e.g. DOMPurify or a safe HTML subset) to avoid XSS.

---

### 22. **Input length limits**
Some IPC handlers and network paths don't enforce length limits.

**Suggestion:** Add max lengths for names, descriptions, and chat messages, and reject oversized payloads.

---

## Quick Wins

| Change | Effort | Impact |
|--------|--------|--------|
| Wrap `JSON.parse` in try/catch | Low | High |
| Return errors from IPC load handlers | Low | Medium |
| Add `mkdir` before reading bans | Low | Low |
| Add `aria-label` to icon buttons | Low | Medium |
| Add search to EquipmentPickerModal | Medium | Medium |
| Extract shared storage helper | Medium | Medium |

---

## Suggested Order

1. Fix `JSON.parse` error handling.
2. Fix IPC error propagation and UI feedback.
3. Add toast/notification for errors.
4. Add search where lists are large.
5. Implement rest tracking UI.
6. Extract shared storage and UUID utilities.
