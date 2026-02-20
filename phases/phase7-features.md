# Phase 7 — New Features

You are working on **dnd-vtt**, an Electron + React 19 + Tailwind CSS 4 + PixiJS D&D 5e virtual tabletop. Phases 1–6 have stabilized the app. This phase adds new gameplay, DM, and app-level features. Build each feature as a self-contained addition.

Refer to `CLAUDE.md` for build commands, architecture, and key paths.

---

## Gameplay Features

### 1. Token HP bars

**Files:** `MapCanvas.tsx`, `TokenSprite.ts`, `useGameStore.ts`

Render a small health bar beneath each token sprite. Green→yellow→red gradient based on `currentHP / maxHP`. Add a DM toggle for player-visible vs DM-only HP bars. Integrate with the existing `MapToken.hp` and `MapToken.maxHp` fields.

### 2. Condition icons on map tokens

**Files:** `TokenSprite.ts`, `MapCanvas.tsx`

Overlay small colored dot badges on token sprites for active conditions. Color-code by condition type (poisoned=green, stunned=yellow, prone=gray, frightened=purple). Show up to 3 badges; overflow shows a "+N" indicator.

### 3. Map ping/waypoint system

**Files:** `MapCanvas.tsx`, network message types, `GameLayout.tsx`

Alt+click (or a dedicated "ping" tool) places a temporary pulsing circle at the clicked grid position. Visible to all players for 3 seconds, then fades out. Broadcast via a new `map:ping` network message with `{ x, y, color, senderName }`.

### 4. Right-click context menu on tokens

**Files:** `MapCanvas.tsx`, new `TokenContextMenu.tsx`

Right-click a token to show a floating menu with: Remove from Map, Add to Initiative, Set HP, Apply Condition, Toggle Player Visibility. DM-only actions should be gated by role.

### 5. Dice roll history panel

**Create:** `src/renderer/src/components/game/DiceHistory.tsx`

A collapsible sidebar panel showing a scrollable, filterable log of all dice rolls. Each entry shows: timestamp, roller name, formula, individual die results, total. Filter by player name. Persist in `useGameStore` for the session duration.

### 6. Dice macros / quick-roll bar

**Create:** `src/renderer/src/components/game/player/MacroBar.tsx`

A row of customizable dice-roll shortcut buttons below the player HUD. Auto-generate from the character's weapons and skills (e.g., "Longsword: 1d20+5 / 1d8+3", "Stealth: 1d20+4"). Allow manual addition of custom formulas. Clicking a button rolls the formula and broadcasts the result.

### 7. Death save tracker

**Create:** `src/renderer/src/components/game/player/DeathSaveTracker.tsx`

When a player's HP hits 0, surface a 3-success / 3-failure visual tracker on the PlayerHUD. Critical hit failures count as 2. Auto-reset when HP goes above 0. Integrate with the existing condition system.

### 8. Initiative improvements

**Files:** `InitiativeTracker.tsx`, `useGameStore.ts`, `GameLayout.tsx`

- **Auto-roll from DEX**: Pre-populate initiative rolls from character DEX modifiers when starting combat.
- **Drag-to-reorder**: Add drag-and-drop reordering for manual adjustments (delayed turns, DM overrides).
- **Add mid-combat**: "Add Entry" button that accepts name + roll and inserts in sorted order.

### 9. Combat log / action history

**Create:** `src/renderer/src/components/game/CombatLog.tsx`

A structured event timeline (separate from chat) showing: initiative changes, damage dealt, conditions applied/removed, healing, death saves. Each entry is timestamped and tagged by source. Displayed in a collapsible panel alongside the map.

### 10. Rest tracking UI

**Files:** `GameLayout.tsx`, `useGameStore.ts`, PlayerHUD

Add Short Rest / Long Rest buttons that trigger the existing `restTracking` logic. Short rest: roll hit dice, recover some resources. Long rest: restore HP, reset spell slots, clear applicable conditions. Broadcast results to all players.

---

## DM Tools

### 11. Compendium browser

**Create:** `src/renderer/src/components/game/dm/CompendiumPanel.tsx`

Searchable in-game panel for spells, monsters, equipment, and rules. Data sourced from the existing `public/data/5e/` JSON files. Search by name with category tabs. Show full stat blocks / descriptions in a detail view. Collapsible side panel in the DM layout.

### 12. Encounter builder / group save

**Create:** `src/renderer/src/components/game/dm/EncounterBuilder.tsx`

Let the DM define and save named NPC groups (e.g., "Goblin Ambush: 4x Goblin, 1x Hobgoblin"). "Deploy Encounter" places all tokens on the map, rolls initiative for each, and sets HP. Save encounter templates to the campaign for reuse.

### 13. Ambient sound/music player

**Create:** `src/renderer/src/components/game/dm/AudioPlayer.tsx`

Simple collapsible panel in DM tools with:
- File picker or URL input for audio files.
- Play/pause/volume/loop controls.
- Just use HTML `<audio>` element — no additional libraries needed.
- Optionally broadcast play state so players hear the same audio (via a shared URL or file transfer).

### 14. AI DM panel in-game

**Files:** `GameLayout.tsx`, existing `src/main/ai/` services

Wire the existing AI DM service into the game layout as a collapsible side panel. DM can:
- Ask rules questions
- Generate NPC dialogue
- Get encounter suggestions
- Roll random tables
Uses the existing Claude API / Ollama integration.

---

## Content & Data

### 15. Session notes/journal

**Files:** `DMNotepad.tsx` (enhance), `useCampaignStore.ts`

Enhance the existing DM Notepad into a per-session journal:
- Auto-timestamp entries.
- Auto-log major events (combat start, rest, level up).
- Markdown support via TipTap (already in the stack).
- Export as `.md` file via the existing `dialog:show-save` + `fs:write-file` IPC path.

### 16. Character versioning/history

**Files:** `useCharacterStore.ts`, `characterStorage.ts`

On each save, keep the previous version as a `.bak` file. Add a "Version History" UI in the character view that shows previous saves with timestamps. Allow restoring any previous version.

---

## App-Level

### 17. Settings/preferences page

**Create:** `src/renderer/src/pages/SettingsPage.tsx`

Add to the router. Include:
- Theme selection (dark/parchment/high-contrast/royal-purple — the theme system already exists).
- Grid opacity/color preferences.
- Audio input/output device selection for voice chat.
- Default dice roller behavior.
- Keybinding display (read-only for now, editable later).

### 18. Spell/AoE templates

**Files:** `MapCanvas.tsx`, new overlay layer

Circle (fireball 20ft), cone (burning hands 15ft), line (lightning bolt 100ft), and cube overlays. The DM or player selects template type and size, clicks to anchor on a grid cell, affected cells are highlighted with semi-transparent color. Snap to grid.

---

## Acceptance Criteria

- Token HP bars are visible and toggle-able by the DM.
- Map pings are visible to all connected players.
- Right-click on a token shows a context menu with relevant actions.
- Dice history panel shows all rolls from the session.
- Death save tracker appears when HP reaches 0 and resets on healing.
- Initiative supports auto-roll, drag reorder, and mid-combat additions.
- Compendium panel allows searching spells, monsters, and equipment.
- Settings page allows theme selection and grid preferences.
- `npx tsc --build` passes.
