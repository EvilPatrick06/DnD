# Plan 8 — Project Review & Roadmap

## Critical Issues

### 1. Path Validation Vulnerability (`src/main/ipc/index.ts`)
The current `startsWith()` check for path validation can be bypassed with path traversal. A path like `userData/../../../etc/passwd` could slip through. Replace with `path.relative()` validation:

```typescript
const rel = path.relative(userData, normalized)
if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
  return true
}
```

### 2. Game State Not Synchronized Over Network
This is the biggest functional gap. The networking layer syncs lobby state, chat, and shop inventory, but **does not sync during gameplay**:
- Token positions on the map
- Initiative order and current turn
- Fog of war reveals
- Map changes
- Conditions/status effects

The message types exist in `network/types.ts` (`dm:token-move`, `dm:initiative-update`, `dm:fog-reveal`, `dm:map-change`) but are **never sent or received**. Each player currently has an independent game state — the DM moving a token is invisible to players.

### 3. No Data Validation on Load (All Stores)
Every store uses `as unknown as Character[]` / `as unknown as Campaign[]` to cast IPC data without runtime checks. Corrupted or malformed data will crash the app silently. Adding Zod schemas would catch this at load time and allow graceful fallbacks.

### 4. No Error Boundaries
There are zero React error boundaries in the app. Any unhandled render error will white-screen the entire application. At minimum, wrap major route sections with error boundaries.

---

## High Priority

### Bugs & Reliability

| Issue | Location |
|-------|----------|
| `nextTurn()` accesses `entries[nextIndex]` without bounds check — can crash | `useGameStore.ts:434` |
| `removeFromInitiative()` could leave `currentIndex` out of bounds | `useGameStore.ts:546` |
| Voice init may run multiple times if `connectionState` changes rapidly | `LobbyPage.tsx:121-129` |
| `broadcastMessage` iterates connections without checking if they're still open | `host-manager.ts:154-165` |
| Dialog-allowed paths have no TTL — remain allowed indefinitely (CLAUDE.md says 60s, not implemented) | `main/ipc/index.ts:24` |
| Missing dependency arrays in `useEffect` across multiple pages | `ViewCharactersPage`, `CharacterSelector`, `PlayerList` |
| Deleting last map may leave `activeMapId` pointing to a deleted map | `CampaignDetailPage.tsx:184-188` |

### Security

| Issue | Location |
|-------|----------|
| IPC handlers don't validate input shape for `saveCharacter`/`saveCampaign` | `main/ipc/index.ts:46-79` |
| Only 3 of many message types are validated server-side; others pass through unchecked | `host-manager.ts:425-457` |
| Preload type definitions don't match actual return types (missing `error` field) | `preload/index.d.ts` |
| CSP allows `'unsafe-inline'` for styles | `main/index.ts:52` |

### Memory Leaks

| Issue | Location |
|-------|----------|
| `useAiDmStore.sendMessage()` timeout not cleared on unmount | `useAiDmStore.ts:195` |
| `useAiDmStore.setupListeners()` returns cleanup but may not be called | `useAiDmStore.ts:294` |
| Network listeners registered in `hostGame()`/`joinGame()` but cleanup unclear on disconnect | `useNetworkStore.ts` |

---

## Medium Priority — Quality of Life

### Missing Features

- **Search/filter for characters** — the character list only has a status filter, no name search
- **Confirmation dialogs** — NPC, Rule, Lore, and Map deletes happen instantly with no confirmation. Same for kick/ban.
- **Connection quality indicators** — ping/pong messages exist but latency is never calculated or displayed
- **Better error messages for networking** — generic "Connection failed" with no troubleshooting guidance (firewall, NAT, etc.)
- **Undo for destructive actions** — character/campaign/NPC deletions are irreversible
- **Character name search** in `CharacterSelector`, `NPCManager`, campaign detail lists
- **Tooltips on truncated text** — character names, NPC names, display names truncate but don't show full text on hover

### Component Architecture

These components are oversized and should be split:

| Component | Lines | Suggested splits |
|-----------|-------|-----------------|
| `CampaignDetailPage.tsx` | 760 | Overview, NPCs, Rules, Lore, Maps cards |
| `GameLayout.tsx` | 695 | `DMGameLayout` + `PlayerGameLayout` |
| `useLevelUpStore.ts` | 637 | `applyLevelUp()` is a 700-line function |
| `LobbyPage.tsx` | 551 | Extract `useVoiceSetup`, `useNetworkSync` hooks |
| `useGameStore.ts` | 1240 | Maps/tokens, initiative, conditions sub-stores |
| `MapCanvas.tsx` | 461 | Extract `useMapCanvas` hook for PixiJS logic |

### Performance

- **Missing `useMemo`** on sorted/filtered lists: `PlayerList.sortedPlayers`, `ChatPanel.chatMessages`/`diceMessages`, `SkillsSection.profBonus`
- **No shallow comparison** on Zustand selectors — large object selections cause unnecessary re-renders
- **`useGameStore.loadGameState()`** updates many fields at once, triggering many subscribers — batch updates

### Accessibility

- Modal close buttons missing `aria-label="Close"`
- Main menu buttons missing `aria-label` and keyboard navigation
- DM toolbar tools need `aria-label` (not just `title`)
- Initiative tracker uses clickable `<span>` instead of `<button>`
- No focus-visible styles on `Button` component
- Avatar click handlers have no keyboard equivalent

---

## Low Priority — Polish

### Styling Inconsistencies
- Mix of `gap-3`, `gap-4`, `gap-6` without clear system in `CampaignDetailPage`
- Hardcoded color classes (e.g., `bg-red-900/30`) instead of consistent theme tokens
- Fixed widths in `LobbyLayout` (`w-64`, `w-72`) break on smaller screens
- `ChatPanel` has `overflow-y-auto` but no max-height constraint

### Loading States
- "Loading characters..." and "Loading..." are plain text — add spinners/skeletons
- `InGamePage` has a hardcoded 4-second timeout for loading
- Join game page has a 15-second timeout with no progress indicator

### Networking Polish
- Only 3 reconnect retries — may be too few for flaky networks
- Sequence numbers exist in message types but are unused (no ordering or dedup)
- No protection against rapid connect/disconnect cycles (resource exhaustion)
- Host reconnection logic may have an undeclared variable (`reconnectAttempts`)

### Tooling & Config
- No test framework installed (Vitest mentioned in CLAUDE.md but not in `package.json`)
- No linter configured (ESLint/Biome mentioned but absent)
- Code signing disabled in electron-builder (`signAndEditExecutable: false`)
- CLAUDE.md documents features that aren't implemented (60s path TTL, `path.relative()` validation)

---

## New Feature Suggestions

1. **Encounter Builder** — plan encounters with CR/XP budgets before sessions, drag monsters from a bestiary
2. **Session Notes / Recap** — auto-generate session summaries from chat logs and events
3. **Player Handouts** — DM can prepare and reveal images/text to specific players
4. **Ambient Sound/Music** — integrate simple audio playback for atmosphere
5. **Dice Macros** — save common rolls (e.g., "Fireball: 8d6 fire") as one-click buttons
6. **Export Campaign to PDF** — generate a printable campaign summary with NPCs, maps, notes
7. **Character Templates** — pre-built characters for quick starts or one-shots
8. **Measurement/Distance tool improvements** — show movement range overlays per-token based on speed
9. **Dark/Light theme toggle** — currently dark-only, some users prefer light
