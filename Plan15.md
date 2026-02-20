# Plan 15 — Code Review: Bugs, QoL, and Feature Suggestions

Generated: 2026-02-20

---

## 1. Bugs / Potential Data Loss

### Critical

- [ ] **Non-atomic file writes** (`src/main/storage/`): All character/campaign saves use direct `fs.writeFile`. A crash mid-write corrupts the file with no recovery path. Fix: write to a `.tmp` file first, then `fs.rename` to atomically replace.
- [ ] **Silent save failures** (`useCharacterStore`): `saveCharacter`/`deleteCharacter` catch errors but never surface them to the user. The operation appears to succeed even when it fails.
- [ ] **Death saves never auto-reset**: Death save state doesn't clear when HP goes above 0. A character stabilized then healed still shows death save boxes checked.

### High Priority

- [ ] **Double-counted bonuses** (`CombatStatsBar5e.tsx`): Defense Fighting Style bonus is potentially applied twice — once from `resolved.effects` and once in a separate check. Alert feat initiative bonus may also be double-counted via `resolved.initiativeBonus`.
- [ ] **Level 1 HP uses average instead of full hit die** (`stat-calculator-5e.ts:306-309`): Level 1 HP is calculated as `floor(hitDie/2) + 1` instead of the full hit die value.
- [ ] **ASI modal +2 bug** (`AsiModal.tsx:37`): When mode is `'+2'`, the code passes `[selected[0], selected[0]]` (same ability twice) instead of a single ability with a +2 bonus. Also missing a cap check for abilities already at 20.
- [ ] **Skill selection off-by-one** (`SkillsModal.tsx:60`): The `atCap` check fires after the toggle, allowing one extra skill past the limit before the UI disables further picks.
- [ ] **Lobby chat never sends over network** (`useLobbyStore.ts:187-253`): `/roll` and `/w` commands only add to local chat; the message is never relayed to other peers.

### Medium Priority

- [ ] **Race condition on fast double-save** (`CharacterBuilder5e.tsx:283`): The `if (saving) return` guard has a window where two rapid clicks both pass before `setSaving(true)` takes effect.
- [ ] **Race condition: AI DM stream cancellation** (`useAiDmStore`): Rapid `sendMessage` calls may cancel the wrong stream.
- [ ] **Race condition: ban list loaded twice** (`host-manager.ts:92-113, 337-363`): `loadBans` is called in both `startHosting` and `setCampaignId` without coordination.
- [ ] **Reconnection may use stale invite code** (`client-manager.ts:309-331`): Retry logic doesn't check whether `lastInviteCode` has changed, so it could reconnect to the wrong session.
- [ ] **Mount/rider token sync moves tokens twice** (`GameLayout.tsx:1042-1059`): If both mount and rider conditions are true simultaneously, tokens are repositioned twice per event.

---

## 2. Memory Leaks / Missing Cleanup

- [ ] **`GameLayout.tsx` network handler** (lines 481-652): `useEffect` registering network message handlers has no cleanup/teardown, so handlers accumulate on re-renders.
- [ ] **Voice manager retry intervals** (`voice-manager.ts:516-530`): Autoplay retry interval is never cleared on unmount. Queue grows unboundedly if `localStream` never becomes available.
- [ ] **AI conversation map grows forever** (`ai-service.ts:32-35`): The `conversations` Map is never pruned; long sessions accumulate all conversation histories in memory.
- [ ] **PeerJS event listeners not removed** (`host-manager.ts`, `client-manager.ts`): `connection`, `error`, `disconnected`, and `open` peer events are added but never cleaned up, leading to duplicate handlers on reconnect cycles.
- [ ] **Document-level voice event listeners** (`voice-manager.ts:532-544`): `click` and `keydown` listeners added to `document` are only removed on success, not on failure or unmount.

---

## 3. Code Quality / Architecture

- [ ] **Split `GameLayout.tsx`** (2,666 lines): Handles message parsing, modals, map logic, AI responses, dice, initiative, time, and inventory in one component. Suggested split:
  - `GameMessageHandlers.tsx` — all `useEffect` + network message routing
  - `GameModals.tsx` — modal open/close state and rendering
  - `GameHUD.tsx` — player-facing HUD overlays
  - `useBroadcastChat()` hook — the repeated `addChatMessage` + `sendMessage` pattern (~3 duplicates)

- [ ] **Split `useGameStore.ts`** (1,241 lines): Handles combat, map, time, and fog all in one store. Suggested split:
  - `useCombatStore` — initiative, turns, conditions
  - `useMapStore` — tokens, fog, grid
  - `useTimeStore` — in-game clock

- [ ] **Skill definitions duplicated**: `SKILL_DEFINITIONS` in `systems/dnd5e/index.ts` and `SKILLS_5E` in `SkillsModal.tsx` should be consolidated into a single source of truth.

- [ ] **Spell slot progression hardcoded**: Spell slot tables in `dnd5e/index.ts` should be data-driven from the existing JSON files to make multiclass slot calculations easier to audit.

- [ ] **Missing loading/error states on async store actions**: `saveCharacter`, `deleteCharacter`, `loadGameState`, and several network actions have no `isLoading`/`error` state. Users get no feedback when operations take time or fail.

---

## 4. Type Safety

- [ ] **`levelingMode` should be a union**: Change from `string` to `'xp' | 'milestone'`.
- [ ] **Naming inconsistency — species vs ancestry**: `character-5e.ts` uses `species`/`subspecies`; the builder UI uses `ancestry`/`heritage`. Standardize to one convention throughout.
- [ ] **`BuildSlot` missing discriminant**: `selectedId`/`selectedName` are optional but logically required once confirmed. Add an `isConfirmed: boolean` flag.
- [ ] **Remove `any` types** in `systems/dnd5e/index.ts` and `systems/pf2e/index.ts` — these suppress legitimate type errors.

---

## 5. Accessibility (UI Components)

- [ ] **Modal** (`Modal.tsx`): Add `aria-modal="true"`, `aria-labelledby`. Implement a focus trap so keyboard focus cannot leave the modal.
- [ ] **Input** (`Input.tsx`): Link label via `htmlFor`/`id` instead of a wrapper div. Connect error messages via `aria-describedby`. Add `aria-invalid` when in error state.
- [ ] **Button** (`Button.tsx`): Add `aria-label` for icon-only buttons. Ensure visible keyboard focus indicator.
- [ ] **SelectionModal**: Prevent background scroll when open. Add arrow-key navigation for list items. Announce disabled state to screen readers.

---

## 6. Quality of Life / UX

- [ ] **Auto-clear death saves on healing**: Reset death save successes/failures automatically when HP is restored above 0.
- [ ] **Unsaved changes warning**: Add a "you have unsaved changes" prompt before navigating away from the character builder.
- [ ] **Reject whitespace-only names**: `CharacterBuilder5e.tsx` currently accepts names that are purely whitespace after `.trim()`.
- [ ] **Reject empty lobby messages**: `useLobbyStore` enforces a 2000-char limit but never rejects empty or whitespace-only messages.
- [ ] **Spell list loading state**: Show a spinner or disable the spell list while spell data is fetching in the builder to prevent interaction with a partially-loaded list.
- [ ] **Ability score breakdown tooltip**: `AbilityScoresGrid5e` shows no breakdown of base vs. racial vs. ASI bonuses. A tooltip showing the full calculation would help players understand their sheet.
- [ ] **Hit dice multiclass display**: The HP bar's hit dice section doesn't correctly handle multiclass characters who have different hit die types per class.
- [ ] **AI unavailability notice**: When the Claude API is unreachable and Ollama isn't configured, there is no user-facing message — just silence.

---

## 7. New Feature Suggestions

- [ ] **Atomic save backups**: On each save, write a `.bak` copy of the previous file before overwriting. Provides simple one-step crash recovery.
- [ ] **ASI conflict indicator**: Highlight abilities already at 20 in the ASI modal and prevent their selection.
- [ ] **Temporary HP visual distinction**: Current HP and temp HP are summed together in the display. Show them as visually distinct segments on the HP bar.
- [ ] **Session / combat log export**: Add a chat command (e.g. `/exportlog`) to export the current session's chat/combat log as a Markdown file, using the existing 167+ command infrastructure.
- [ ] **AI conversation pruning**: Add a max-token cap to stored conversations in `ai-service.ts` so old entries are summarized/evicted rather than growing indefinitely.
- [ ] **Undo / reset in character builder**: At minimum a "reset to last save" button, since the builder has no undo and save failures are currently silent.

---

## 8. Testing Gap

Vitest is configured but there are **zero test files**. Highest-value first targets:

- [ ] `stat-calculator-5e.ts` — pure functions, easy to unit test, directly affected by the HP/AC/initiative bugs above.
- [ ] `network/message-handler.ts` — already noted as clean; tests would lock in that correctness.
- [ ] Storage functions — test atomic write behavior once implemented.

---

## Priority Order

| Priority | Item |
|----------|------|
| 1 | Atomic file writes (data loss risk) |
| 2 | Silent save failures (data loss risk) |
| 3 | Level 1 HP calculation bug |
| 4 | ASI modal +2 bug |
| 5 | Death save auto-reset |
| 6 | Lobby chat not sending over network |
| 7 | GameLayout.tsx cleanup / split |
| 8 | Memory leaks (event listener cleanup) |
| 9 | Missing loading/error states in stores |
| 10 | Accessibility improvements |
