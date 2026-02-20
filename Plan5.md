# Plan 5 — D&D VTT Audit & Improvement Plan

## P0 — Critical Bugs (Likely Causing Issues Now)

### Critical

- [ ] **`voice-adapter.ts` — `getRoom()` always returns `null`**
  `currentRoom` is set to `null` and never updated, so `getRoom()` is broken even when connected.

- [ ] **`host-manager.ts` — Join payload schema mismatch**
  The join broadcast includes `peerId` in the payload, but `JoinPayloadSchema` doesn't define `peerId`, so Zod validation will reject it.

- [ ] **`client-manager.ts` — Recursive reconnection can stack overflow**
  `attemptConnection()` calls itself recursively on failure. With enough retries, this will blow the call stack.

- [ ] **`CreateCharacterPage.tsx` — Side effect in render**
  `selectGameSystem` is called directly during render, violating React rules and potentially causing infinite re-render loops.

- [ ] **`voice-livekit.ts` — Null reference in speaker handling**
  `handleActiveSpeakersChanged()` iterates over `participantAudioElements` without checking if `room` exists.

### Medium

- [ ] **50+ missing React `key` props across pages**
  Worst offenders: `BastionPage.tsx`, `CampaignDetailPage.tsx`, `LobbyPage.tsx`, `ChatPanel.tsx`. Causes incorrect reconciliation, lost state, and performance issues.

- [ ] **Unbounded memory growth**
  Chat messages, combat log, and AI DM history all grow without limits. Long sessions will eat RAM.

- [ ] **Race conditions in async saves**
  `saveCharacter`, `saveCampaign`, and `applyLevelUp` are all async with no guard against concurrent calls. Rapid clicks can overwrite data.

- [ ] **`dice-service.ts` — `_lastRoll` global state**
  Module-level `_lastRoll` gets clobbered when multiple players roll simultaneously.

- [ ] **Stale closures**
  Several `useEffect` hooks have incomplete dependency arrays (e.g., `CampaignDetailPage.tsx`, `LobbyPage.tsx`), meaning callbacks can reference outdated state.

---

## P1 — Security Issues

### Critical

- [ ] **`audio-handlers.ts` — Insufficient path sanitization**
  `sanitizedFileName` only replaces non-alphanumeric chars but doesn't prevent `../` traversal. `campaignId` is used in paths without UUID validation.

- [ ] **`schemas.ts` — `.passthrough()` on Zod schemas**
  Allows extra undeclared fields through validation, which could smuggle malicious data past checks.

- [ ] **`ai-handlers.ts` — Path traversal in `readMemoryFile`**
  Path normalization doesn't fully prevent traversal if the normalized path starts with `..`.

### Medium

- [ ] **CSP allows `'unsafe-inline'` styles**
  Weakens XSS protection in `src/main/index.ts`.

- [ ] **`host-manager.ts` — Message validation order**
  `senderId`/`senderName` are overwritten *after* Zod validation, so malicious payloads could pass the schema check first.

- [ ] **No file size limits on IPC file handlers**
  Could cause memory exhaustion with large files.

---

## P2 — Network Reliability

- [ ] **No heartbeat/keepalive**
  Dead connections linger until timeout. No way to detect a silently-dropped peer.

- [ ] **Reconnection doesn't verify acknowledgment**
  Client sends a join message on reconnect but never confirms the host received it, causing phantom "connected" states.

- [ ] **No state sync mechanism**
  If a client misses messages, there's no way to request a full state resync short of rejoining.

- [ ] **Voice reconnection missing**
  `voice-livekit.ts` has no reconnection logic; if LiveKit drops, users must manually leave and rejoin.

- [ ] **No message ordering**
  No sequence numbers or out-of-order handling in the P2P layer.

- [ ] **Voice device switching is incomplete**
  `setInputDevice()` and `setOutputDevice()` store preferences but never actually switch the active device.

- [ ] **`voice-handlers.ts` returns stub tokens**
  No real LiveKit integration; runtime errors are likely.

---

## P2 — React Fixes

- [ ] **Fix missing `key` props (~50 instances)**
  Pages: `BastionPage.tsx`, `CampaignDetailPage.tsx`, `LobbyPage.tsx`, `CalendarPage.tsx`, `ViewCharactersPage.tsx`, `MainMenuPage.tsx`.
  Components: `ChatPanel.tsx`, `CharacterSelector.tsx`, `PlayerCard.tsx`, `PlayerList.tsx`, `VoiceControls.tsx`.

- [ ] **Fix stale closure dependency arrays**
  `CampaignDetailPage.tsx`, `LobbyPage.tsx`, `ChatPanel.tsx` have incomplete `useEffect` dependency arrays.

---

## P3 — Type System Cleanup

- [ ] **Remove PF2e remnants from shared types**
  `character-common.ts` still has PF2e-specific `BuildSlotCategory` values, and `SpellEntry` includes PF2e-only fields (`traditions`, `traits`, `heightened`).

- [ ] **Fix inconsistent `CreatureSize` casing**
  `bastion.ts` uses lowercase (`'tiny'`, `'small'`) while `monster.ts` uses title case (`'Tiny'`, `'Small'`).

- [ ] **Consolidate duplicate types**
  `vehicle.ts` vs `mount.ts` and `dm-toolbox.ts` vs `data/index.ts` define overlapping concepts (`Trap`/`TrapData`, mount/vehicle state).

- [ ] **Tighten loose typing**
  `Record<string, unknown>` used in `NPC.stats`; `abilityScoreAssignments` should be `Record<AbilityName, number>`; monster `savingThrows` should use `AbilityName`.

- [ ] **Fix `ambientLight` inconsistency**
  Uses `'bright' | 'dim' | 'darkness'` — should be `'bright' | 'dim' | 'dark'` for consistency.

- [ ] **Move `DARKVISION_SPECIES` out of types file**
  Currently in `map.ts` types file; belongs in a data/constants file.

- [ ] **Fix `AbilityName` duplication**
  Defined in both `character-common.ts` and `data/index.ts`.

- [ ] **Standardize inline object types**
  `character-5e.ts` uses inline object types for `feats` and `attunement` arrays; extract to named types (`FeatEntry`, `MagicItemAttunement`).

---

## P3 — Architecture Improvements

- [ ] **Split `useGameStore.ts` (2000+ lines)**
  Break into sub-stores: combat, map, time, lighting, conditions, etc.

- [ ] **Add undo/redo foundation**
  Especially critical for combat actions, level-ups, and AI DM actions. A single misclick can be devastating in D&D.

- [ ] **Add data cache invalidation**
  `data-provider.ts` cache grows unbounded with no LRU eviction or invalidation mechanism.

- [ ] **Parallelize `buildCharacter5e` data loading**
  Currently loads many data files sequentially; could be parallelized for speed.

- [ ] **Use IPC channel name constants**
  `src/preload/index.ts` uses string literals (`'audio:upload-custom'`) instead of shared constants, making them harder to audit and refactor.

---

## P4 — UX Improvements

- [ ] **Loading states**
  Most pages show plain "Loading..." text. Add skeleton loaders or spinners for better feedback.

- [ ] **Error recovery**
  Many components catch errors but don't offer retry buttons or actionable guidance.

- [ ] **Modal accessibility**
  `Modal.tsx` is missing focus trapping, `aria-modal`, and `aria-labelledby`.

- [ ] **Keyboard navigation**
  Interactive elements like character cards and color pickers lack keyboard handlers.

- [ ] **ARIA attributes**
  Broadly missing: `aria-label` on buttons, `aria-live` regions on chat, `role` attributes on lists, `aria-describedby` for form errors.

- [ ] **Consistent styling**
  Some components use inline styles instead of Tailwind classes. Inconsistent spacing/padding values and hardcoded colors.

---

## P4 — New Features

- [ ] **Character build progress saving**
  Currently if you close mid-creation, you lose everything.

- [ ] **Dice roll history**
  Only the last roll is tracked; a full session log would be valuable.

- [ ] **Chat message persistence**
  Chat is lost between sessions.

- [ ] **Campaign templates**
  No way to start from a template.

- [ ] **Level-up preview**
  No way to see what stats will look like before committing.

- [ ] **Combat replay / log export**
  No way to review or share past combat encounters.

- [ ] **Custom chat commands**
  No extensibility for homebrew commands.

- [ ] **Bulk operations**
  e.g., apply a condition to all characters at once.

- [ ] **Character versioning/history**
  No way to revert a character to a previous state.

- [ ] **Message search/filter in chat**
  No way to find old messages.

---

## Store-Specific Notes

### `useAiDmStore.ts`
- Race condition: `sendMessage` doesn't check if a stream is already in progress
- Memory leak: `setupListeners` registers IPC listeners with no cleanup
- Missing: No undo for AI DM actions, no way to edit/regenerate responses

### `useGameStore.ts`
- Race condition: `advanceTimeSeconds` updates multiple time-dependent systems non-atomically
- Edge case: Round-based condition expiration doesn't account for mid-round conditions
- Performance: `checkExpiredSources` iterates all light sources/conditions every tick; use priority queue
- Missing: No pause/resume for time advancement

### `useLobbyStore.ts`
- Edge case: `/w` whisper command doesn't validate target player exists
- Missing: No message search, no chat export, no persistence

### `useLevelUpStore.ts`
- Edge case: Multiclass HP calculation doesn't account for class-taken-at-level
- Missing validation: `getIncompleteChoices` doesn't validate ASI/feat legality
- Performance: `apply5eLevelUp` loads class/species/subclass data multiple times; should cache

### `useNetworkStore.ts`
- Race condition: `sendMessage` routes via host/client manager, but if role changes mid-op, sends to wrong manager
- Memory leak: `hostGame`/`joinGame` register listeners but `disconnect` may not clean all up
- Missing: No message queuing, no connection quality metrics, no auto-reconnect

### `useBastionStore.ts`
- Race condition: `advanceTime` could trigger multiple turns if called rapidly
- Edge case: Construction start doesn't validate treasury has enough gold

### `useCharacterStore.ts`
- Race condition: Rapid `saveCharacter` calls for same character can overwrite each other
- Missing validation: `deleteCharacter` doesn't check if character is in use (selected, in-game)
- Missing validation: `addCondition` doesn't validate condition name against known conditions

### `useBuilderStore.ts`
- Race condition: `advanceToNextSlot` could skip slots if slots change mid-iteration
- Missing: No mid-creation save, no validation that built character is legal

### `useCampaignStore.ts`
- Race condition: Rapid `saveCampaign` calls can overwrite each other
- Edge case: `loadCampaigns` merges in-memory and disk data without conflict resolution
- Missing: No campaign versioning, no templates

---

## Service-Specific Notes

### `stat-calculator-5e.ts`
- Bug: `calculateHPBonusFromTraits` checks "Dwarven Toughness" but doesn't distinguish Hill Dwarf vs Mountain Dwarf
- Edge case: `calculateEncumbrance` doesn't account for containers (Bag of Holding)

### `combat-resolver.ts`
- Edge case: Cover calculation doesn't account for movement through cover during attack
- Bug: Critical hit damage doubling may not account for all damage sources
- Performance: `calculateCover` LOS calculations expensive with many tokens

### `data-provider.ts`
- Race condition: If first `loadJson` call fails, all waiting callers also fail
- Memory: Cache grows unbounded; needs LRU eviction
- Missing: No cache invalidation

### `dm-action-executor.ts`
- Race condition: Sequential action execution on same entities uses stale state
- Performance: `buildGameStateSnapshot` serializes entire game state; expensive for large campaigns

### `xp-thresholds.ts`
- Bug: `xpThresholdForLevel(0)` returns 0 but level 0 is documented as unused; should validate `level >= 1`

### `effect-definitions.ts`
- Bug: Alert feat has `initiative_bonus` with `value: 100, stringValue: 'swap_lowest'` — unclear semantics, comment says "+PB to initiative" but value is 100

### `dnd5e/index.ts` (system plugin)
- Unsafe cast: `(s as unknown as Record<string, unknown>).casting_time` fallback
- Unsafe cast: `dataAny` used without structure validation
