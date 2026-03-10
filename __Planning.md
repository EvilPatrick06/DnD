## Grok — Analysis

## 📊 Codebase Analysis Summary

Your D&D 5e VTT is remarkably comprehensive and well-architected. It's a full-featured Electron app with React 19, TypeScript, and sophisticated game systems. Let me break down my findings by your research categories:

### 1. 🧩 Feature Completeness

**What's Already Implemented (Extensive!):**

- **Complete character creation/builder** with 5e rules, multiclassing, feats, backgrounds
- **Full combat system** with initiative tracking, turn management, conditions, HP tracking
- **Advanced map system** using PixiJS with grid, walls, vision/fog of war, lighting
- **3D dice physics** with Three.js and Cannon.js
- **Peer-to-peer networking** via PeerJS with STUN/TURN servers
- **AI Dungeon Master** with Claude API integration + Ollama fallback
- **Comprehensive library** with 2000+ JSON files covering all D&D 5e content
- **Bastion stronghold management** system (unique feature!)
- **Plugin system** with IPC architecture
- **Audio system** with sound effects and ambient audio
- **Calendar/time tracking** system
- **Shop/treasure generation** tools
- **NPC/encounter building** tools
- **Homebrew content** support

**What Might Be Missing for "Full Completeness":**

- **Digital tabletop accessories**: Drawing tools, sticky notes, shared sketch pads
- **Advanced automation**: Auto-calculation of opportunity attacks, flanking rules
- **Character advancement tracking**: Long-term campaign progression beyond individual levels
- **Session management**: XP tracking, milestone advancement, character retirement
- **Integration features**: Discord webhooks, external calendar sync, Google Sheets export
- **Accessibility features**: Screen reader improvements, high contrast modes
- **Mobile/tablet support**: Touch-optimized interface

### 2. 🐛 Bugs & Errors

**Code Quality is Excellent:**

- ✅ **Zero linter errors** across the entire codebase
- ✅ **No TODO/FIXME comments** found (only legitimate domain-specific uses)
- ✅ **Comprehensive test suite** (512+ tests covering services and data)
- ✅ **TypeScript strict mode** with no `any` types in production code
- ✅ **Clean architecture** with proper separation of concerns

**Potential Areas to Check:**

- **Network reliability**: P2P connections might have edge cases with NAT/firewalls
- **Memory management**: Large maps with many tokens could cause performance issues
- **Browser compatibility**: Electron version might have WebGL/PixiJS compatibility quirks
- **File I/O race conditions**: Async storage operations during rapid saves

### 3. 💡 Ideas & Improvements from Competitor Research

Based on my knowledge of major VTT platforms:

**D&D Beyond Features Your App Could Add:**

- **Digital character sheets** with auto-calculations and rule integration
- **Adventure module marketplace** integration
- **One-click combat importing** from DDB campaigns

**Roll20 Features Missing:**

- **Macro bar/hotbar** for quick spell/ability access
- **Dynamic lighting animations** (torches flickering, etc.)
- **Tabletop audio integration** (background music playlists)
- **Character art/picture integration** in tokens

**Foundry VTT Features:**

- **Modding ecosystem** (your plugin system is a start, but could be more extensive)
- **Scene transitions** with fade effects
- **Advanced measurement tools** (ranges, templates, cones)
- **Journal linking** (clickable references between entries)

**Your App's Unique Advantages:**

- ✅ **AI DM integration** - none of the competitors have this
- ✅ **Bastion management** - completely unique feature
- ✅ **3D dice physics** - more realistic than most
- ✅ **Comprehensive offline support** - no internet required

### 4. 🗺️ Map/Token/Combat System (High Priority)

**Current Strengths:**

- ✅ **Advanced vision system** with line-of-sight calculations
- ✅ **Dynamic lighting** with multiple light sources
- ✅ **Wall/line-of-sight blocking**
- ✅ **Token animation** with smooth movement
- ✅ **Fog of war** reveal/hide tools
- ✅ **Grid snapping** and measurement tools
- ✅ **Multiple floor support** in maps

**Missing/Improvements Needed:**

- **Advanced measurement tools**: Range finders, area templates (cones, lines, bursts)
- **Token attachments**: Status effect icons, HP bars on tokens
- **Smart token placement**: Auto-spacing, formation tools
- **Map layers**: Background, object, overlay layers for complex scenes
- **Door/window states**: Interactive doors that affect vision
- **Environmental effects**: Weather overlays, difficult terrain visualization
- **Token conditions**: Visual representations of status effects
- **Combat automation**: Auto-initiative from passive perceptions, flanking detection

### 5. 🤖 AI Dungeon Master

**Current Implementation is Sophisticated:**

- ✅ **Claude API integration** with streaming responses
- ✅ **Context awareness** with character sheets, campaign state
- ✅ **Ollama fallback** for offline use
- ✅ **Structured prompting** with DM actions, stat changes
- ✅ **Conversation memory** and campaign context

**Potential Improvements:**

- **Personality customization**: Different DM styles (narrative, rules-focused, humorous)
- **Campaign memory**: Long-term story arc tracking
- **Player preference learning**: Adapting to group playstyle
- **Automated rulings**: More proactive rule enforcement
- **Creative assistance**: Map descriptions, NPC generation, encounter ideas

### 6. 📚 Library/Compendium

**Extensive Content Coverage:**

- ✅ **2000+ JSON files** with complete D&D 5e data
- ✅ **Search functionality** across all categories
- ✅ **Homebrew support** with custom content creation
- ✅ **PDF integration** for rulebooks
- ✅ **Favorites and recently viewed**

**Possible Enhancements:**

- **Content cross-referencing**: "Show me spells that work with this feat"
- **Quick reference tooltips**: Hover information in combat
- **Custom content sharing**: Import/export homebrew between users
- **Content validation**: Rule-checking for homebrew balance

### 7. 🎨 GUI/UX Review

**Current UI is Modern and Polished:**

- ✅ **React 19** with modern patterns
- ✅ **Responsive design** with Tailwind CSS
- ✅ **Accessibility features** (screen reader support, keyboard navigation)
- ✅ **Colorblind filters** and UI scaling
- ✅ **Toast notifications** and error boundaries
- ✅ **Loading states** and skeleton screens

**UX Improvements:**

- **Keyboard shortcuts**: More comprehensive hotkey system
- **Context menus**: Right-click options throughout the interface
- **Drag & drop**: Token placement, inventory management
- **Quick actions**: One-click buttons for common tasks
- **Visual feedback**: Better hover states, loading indicators
- **Mobile optimization**: Touch-friendly interface elements

### 8. 🌐 Other Observations

**Performance & Architecture:**

- ✅ **Excellent architecture** with proper state management (Zustand slices)
- ✅ **Modular design** with clear separation of concerns
- ✅ **IPC security** with proper context isolation
- ✅ **Plugin system** for extensibility

**Areas for Attention:**

- **Documentation**: Could benefit from more inline documentation for complex systems
- **Error handling**: Some areas might need better error boundaries
- **Performance monitoring**: No obvious performance issues, but could add metrics
- **Testing coverage**: While good, could expand to UI components

**Unique Selling Points:**

- **AI DM integration** sets this apart from all competitors
- **Bastion management** is a completely unique feature
- **Offline-first design** with comprehensive local data
- **Modern tech stack** with excellent developer experience

---

**Overall Assessment**: This is an impressively comprehensive and well-built D&D VTT that already surpasses many commercial offerings in features and technical quality. The AI DM and bastion systems are particularly innovative. The main gaps are in polish, automation, and some advanced tabletop features that would make it even more competitive.

---

## Cursor Composer — Analysis

*Comprehensive codebase research conducted March 2025. Complements Grok's findings with file-level detail and specific line numbers.*

---

### 1. Feature Completeness (additional detail)

#### Systems built but not hooked up


| System                               | Status    | Notes                                                                                                                                                                                       |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Memory Manager world/combat sync** | Not wired | `updateWorldState()` and `updateCombatState()` in `memory-manager.ts` are never called from main flow. Persistent `world-state.json` / `combat-state.json` not synced from live game store. |
| **Light sources in vision**          | Partial   | `computePartyVision` accepts `lightSources` but no caller passes them. Light only affects `lighting-overlay`, not fog/explored cells.                                                       |
| **cdnProvider**                      | Unused    | In `data-provider.ts`; not wired.                                                                                                                                                           |
| **cloud-sync**                       | Missing   | Referenced in audit; file not in repo.                                                                                                                                                      |


#### Features started but never finished

- **5e data extraction** — `scripts/extract-5e-data.ts` line 254: only Spells domain; Classes commented out (line 267).
- **Auto-update** — `src/main/updater.ts`: `autoDownload` and `autoInstallOnAppQuit` both `false`.

---

### 2. Bugs & Errors (specific locations)

#### Unhandled promise rejections


| File                  | Lines            | Issue                                                               |
| --------------------- | ---------------- | ------------------------------------------------------------------- |
| `LibraryPage.tsx`     | 134–140, 154–161 | `loadCategoryItems`, `searchAllCategories` — no `.catch()`.         |
| `DowntimeModal.tsx`   | 99–101           | Three `load*().then(set*)` without `.catch()`.                      |
| `CraftingBrowser.tsx` | 50–51            | `load5eCrafting()`, `Promise.all(RECIPE_FILES...)` — no `.catch()`. |
| `CreatureModal.tsx`   | 69               | `load5eMonsters().then(setMonsters)` — no `.catch()`.               |
| `DetailsTab5e.tsx`    | 64               | `load5eFeats('Origin').then(setOriginFeats)` — no `.catch()`.       |


#### Logical / network errors


| File                  | Lines   | Issue                                                                  |
| --------------------- | ------- | ---------------------------------------------------------------------- |
| `use-data-store.ts`   | 167–169 | `loadPluginContent` catch sets `pluginsLoaded: true` even on failure.  |
| `bmo-bridge.ts`       | 21–28   | No `res.ok` check before `res.json()`; 4xx/5xx can cause parse errors. |
| `BMO-setup/pi/app.py` | 62      | `cors_allowed_origins="*"` — permissive for production.                |


#### Swallowed errors (game logic never surfaced)


| File                  | Lines              | Issue                                                                        |
| --------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `creature-actions.ts` | 421, 469, 519, 624 | AI mutations, rest, encounter: `.catch(() => {})` — failures never surfaced. |
| `context-builder.ts`  | 206                | `memMgr.saveCharacterContext(...).catch(() => {})`.                          |
| `ai-service.ts`       | 588                | `memMgr.appendSessionLog(...).catch(() => {})`.                              |


#### GUI feedback gaps

- `use-library-store.ts` 69–71: `loadHomebrew` catch — no UI error state.
- `DMAudioPanel.tsx` 156–157: Upload catch — no `addToast`.
- `use-character-store.ts`, `use-campaign-store.ts`: Load/save failures logged but no `addToast`.

---

### 3. Map / Token / Battle (high-priority detail)

#### Missing

1. **Light sources in party vision** — `computePartyVision` supports `lightSources` but no caller passes them.
2. **Apply Condition from context menu** — `TokenContextMenu` `handleApplyCondition` only closes menu; no link to `QuickConditionModal`.
3. **D&D-style diagonal measurement** — Euclidean only; no 1–2–1 rules.
4. **Drawing tools in main game toolbar** — Tools only in `DMMapEditor`.
5. **Custom token images** — `MapToken.imagePath` exists; tokens use colored circles + first letter.
6. `**fogBrushSize`** — Passed as `_fogBrushSize` to MapCanvas (line 88), never used.

#### Broken / unreliable

- **Vision on client** — Recomputed only on host when `dynamicFogEnabled`; client depends on `partyVisionCells` sync — late sync can cause wrong vision (`map-overlay-effects.ts` 229–236).

#### QoL

- Auto-pan on turn change; multi-segment measurement; "Clear All Fog" / "Reset Explored" in main UI; hex measurement when hex grid used.

---

### 4. AI DM (additional gaps)

- **Provider switching** — Only Ollama wired; Anthropic/Claude in scripts only.
- **Memory sync** — `updateWorldState()` / `updateCombatState()` never called.
- **RAG** — TF-IDF only; no embeddings or semantic search.
- **Structured output** — No JSON schema for `[DM_ACTIONS]` / `[STAT_CHANGES]`.

---

### 5. Library (specific issues)

- **Global search** — `searchAllCategories` omits: `tools`, `maps`, `shop-templates`, `portraits` (`library-service.ts` 606–632).
- **Invalid favorite categories** — `equipment` and `rules` in `LibraryPage.tsx` line 217 are invalid `LibraryCategory`; favorites for these show only homebrew.

---

### 6. GUI / UX (additional)

- GameLayout: 50+ pieces of state; collapse controls easy to miss.
- ModalFormFooter buttons very small (`text-[10px]`).
- Share Macros: no feedback; auto-rejoin: no loading state.
- Scrollbar styling: Webkit-only; no Firefox support.

---

### 7. Other

- Biome lint: `MapConfigStep.tsx:92`, `DiceHistory.tsx:26`, `DiceRenderer.tsx:51` (hook deps).
- 4 files >1000 lines: DowntimeModal, SettingsPage, data-provider, CampaignDetailPage.

## Gemini 3.1 Pro Preview - Analysis

### 1. Feature Completeness

- **Missing for full VTT**: Full mounted combat logic (currently in Phase 4, `riderId` exists but movement logic is incomplete); 3D/Elevation combat (tokens have elevation, but line-of-sight and cover calculations operate purely on a 2D plane).
- **Started but never finished**: Several UI components are marked as WIP/Orphan in the audit logs, including the Library sub-component redesign (`components/library/`*), `CombatLogPanel` (awaiting sidebar integration), `JournalPanel` (TipTap journal), `RollRequestOverlay` (awaiting P2P wiring), `ThemeSelector`, and `PrintSheet`.
- **Built but not hooked up**: Sentient item generation framework (`sentient-items.ts`), S3 cloud backup/sync infrastructure (`cloud-sync.ts`), and a CDN provider for game data/images (`cdn-provider.ts`).

### 2. Bugs & Errors

- **Syntax errors**: 0 TypeScript errors, but 15 Biome lint errors (mostly `useExhaustiveDependencies` in hooks like `MapConfigStep.tsx` and `DiceHistory.tsx`).
- **Logical errors**: Hardcoded combat modifiers in `resolveDamage` (Heavy Armor Master and Heavy Armor usage are hardcoded to `false`); hardcoded species vision (`DARKVISION_SPECIES` only includes base PHB species, breaking custom lineages); Unarmed Strike DC is hardcoded to STR (ignores Monk DEX).
- **Network errors**: `RollRequestOverlay` is fully implemented but orphaned, awaiting P2P socket wiring.
- **GUI/UI errors**: "Z-index soup" in `GameLayout.tsx` using absolute positioning and manual pixel calculations (e.g., `sidebarLeftPx`), which can lead to overlapping elements and resizing glitches. Fallback light radius defaults to 4 cells (20ft) if a light source isn't found in the dictionary.

### 3. Ideas & Improvements from Competitor Research

- **D&D Beyond**: Excels at character management. We should ensure character sheet integration is seamless (like Beyond20) or add a dedicated, guided character builder rather than just importing static JSON.
- **Roll20**: Known for its accessible entry point and official marketplace. We could improve onboarding by adding pre-configured starter modules or an easy way to share homebrew compendiums.
- **Foundry VTT**: The gold standard for automation. While we have dynamic lighting and weapon masteries, we should look into Foundry's robust module/plugin system and macro support to allow power users to customize their own automation scripts.

### 4. Map / Token / Battle / In-Game System

- **Missing**: True 3D line-of-sight and cover calculations that account for token elevation.
- **Broken/Unreliable**: Hardcoded combat modifiers mean damage resolution is inaccurate for certain builds (e.g., Heavy Armor Master).
- **QoL Improvements**: Add support for custom lineages in darkvision calculations. Allow Monks to use DEX for grapple/shove DCs. 
- **Tools/Controls to add**: The system has great tools (measurement, fog of war, terrain painter, AoE overlays). We should add elevation indicators that visually affect line-of-sight, and a dedicated initiative tracker integration that auto-sorts tokens and highlights the active turn.

### 5. AI Dungeon Master

- **Missing features/behaviors**: Context injection is brittle. The `ConversationManager` only appends specific rule sets (like `PLANAR_RULES_CONTEXT`) if it detects exact keywords in the immediate context. Forced alternating roles (`user` then `assistant`) concatenates user messages, confusing the AI's understanding of the timeline.
- **Prompting issues**: JSON formatting brittleness. The game state automation relies on the LLM perfectly formatting `[STAT_CHANGES]` and `[DM_ACTIONS]`. If it hallucinates markdown inside the JSON, parsing fails. Context truncation drops older messages, losing nuanced campaign details.

### 6. Library / Compendium

- **Missing content/data**: Descriptions are severely truncated to fit on small cards (e.g., sliced to 120 characters for Feats, Invocations, Diseases, and Poisons).
- **Lookup/Search issues**: Search is a rudimentary client-side substring match (`.includes(q)`). There are no advanced faceted filtering options (cannot filter Spells by Level/School, or Monsters by CR). There are no detail views - clicking an item doesn't show full stat blocks or spell text.

### 7. GUI / UX Review

- **User-friendly**: The "Tools" menu in `PlayerBottomBar.tsx` is overloaded, mixing combat, reference, and social actions. It should be categorized. There is an over-reliance on screen-blocking modals (`GameModalDispatcher`) that take players out of the map context.
- **Visually nicer/polished**: Replace Unicode icons (e.g., arrow up) with a unified icon library (Lucide/Heroicons). Add subtle hover/active state animations. Transition the main shell to CSS Grid/Flexbox instead of absolute positioning.
- **Confusing workflows**: Collapsing the bottom bar hides the Macro Bar and Action Buttons, leaving players without quick access to core gameplay loops.

### 8. Any Other Observations

- **Accessibility**: Custom UI components lack headless UI primitives (like Radix), relying on manual `useEffect` logic for keyboard focus trapping (`Modal.tsx`), which is error-prone.
- **Code Organization**: Several "Dead" barrel files (`constants/index.ts`, `network/index.ts`) that should be cleaned up according to the audit logs.

---

## Claude 4.6 Opus â€” Analysis

*Deep codebase exploration conducted March 2026. Complements prior sections with exhaustive file-level findings, competitor feature gap analysis (83-feature checklist), and severity-rated bug catalog.*

---

### 1. Feature Completeness

#### Missing for a full, all-inclusive VTT (voice/video excluded)


| Feature                                    | Competitor Source                                             | Notes                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Scene Regions / Trigger Zones**          | Roll20 "Reactive Scenes", Foundry Scene Regions (9 behaviors) | No token area-enter/leave events. No trap/teleport/macro triggers.                                                   |
| **Foreground/Occlusion Layer**             | Roll20 (rooftops/tree cover with proximity fade)              | `weather-overlay.ts` exists but no foreground tile layer with conditional opacity.                                   |
| **Multi-floor Scene Levels**               | Foundry V14 Scene Levels                                      | `FloorSelector.tsx` exists, `currentFloor` state is set, but **never used** for token visibility or layer filtering. |
| **Positional Ambient Audio**               | Foundry (volume by token proximity)                           | `audio-emitter-overlay.ts` creates `AudioEmitterLayer` but `updateEmitters()` is never called. Feature is dead.      |
| **Sound Occlusion by Walls**               | Foundry                                                       | Not present.                                                                                                         |
| **Animated Scene Transitions**             | Foundry (14 types)                                            | Map switching is instant with no transition effect.                                                                  |
| **Scene Preloading**                       | Foundry                                                       | No mechanism to preload map assets before switching.                                                                 |
| **Shared vs Individual Fog Modes**         | Foundry (disabled/individual/shared)                          | Single fog mode only.                                                                                                |
| **One-Way / Transparent Wall Types**       | Foundry (7 wall types), Roll20 (one-way barriers)             | Only solid, door, window. No independent vision/movement/light/sound control per wall.                               |
| **Secret Doors**                           | Foundry (GM-only toggle)                                      | Not present.                                                                                                         |
| **Light Animation Types**                  | Foundry (torch, pulse, flicker, sound pulse)                  | Lighting overlay is static.                                                                                          |
| **Darkness Sources**                       | Foundry (magical darkness zones)                              | Not present.                                                                                                         |
| **Day/Night Cycle**                        | Foundry (calendar-driven ambient)                             | Weather is manual only. No calendar-driven lighting.                                                                 |
| **Multi-Token Group Operations**           | Roll20 (group select, lock, move, enumerate)                  | Single-token selection only.                                                                                         |
| **Party Inventory / Shared Loot**          | D&D Beyond (party stash)                                      | Shop system exists but no shared inventory pool.                                                                     |
| **Encounter Builder with Difficulty Calc** | D&D Beyond (CR budget)                                        | Has encounter presets but no CR-based difficulty calculation.                                                        |
| **Content Sharing Model**                  | D&D Beyond (1 subscriber shares with 12)                      | No content sharing mechanism.                                                                                        |
| **Rollable Tables (in-game roller)**       | Roll20, Foundry                                               | `random-tables` library category exists but no in-game table roller.                                                 |
| **Active Effects System**                  | Foundry V2 (auto-modifies tokens, stats, vision, disposition) | Conditions exist but don't mechanically alter token properties.                                                      |


#### Features started but never finished


| Feature                   | Location                              | Status                                                                                   |
| ------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Multi-floor maps          | `FloorSelector.tsx`                   | `currentFloor` state set but never used for token/layer filtering                        |
| Audio emitters            | `audio-emitter-overlay.ts`            | Layer created, `updateEmitters` never called                                             |
| Fog brush size            | `MapCanvas.tsx` line 88               | Passed as `_fogBrushSize`, never used                                                    |
| Token status ring         | `combat-animations.ts`                | `drawTokenStatusRing` exported but never referenced                                      |
| Custom token images       | `map.ts` `MapToken.imagePath`         | Field exists, tokens render as colored circles only                                      |
| CDN provider              | `data-provider.ts`                    | Referenced in code, not wired                                                            |
| Cloud sync                | Referenced in audit                   | File not in repo                                                                         |
| 5e data extraction        | `scripts/extract-5e-data.ts` line 254 | Only Spells domain implemented; "Add Nodes for the other 30 Domains"                     |
| BMO agents                | `BMO-setup/pi/agent.py` line 770      | `pass # Remaining agents not yet implemented`                                            |
| Place creature DM action  | `dm-system-prompt.ts`                 | `place_creature` in prompt but missing from `DmAction` TypeScript union                  |
| Anthropic/Claude provider | `@anthropic-ai/sdk` in deps           | Only Ollama wired in main app; Claude in scripts only                                    |
| Initiative delay          | `InitiativeTracker.tsx`               | UI `onDelayEntry` removes entry; `delayTurn`/`undelay` in slice are separate and unwired |


#### Systems built but not hooked up


| System                           | File                    | Issue                                                                                            |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Memory Manager world/combat sync | `memory-manager.ts`     | `updateWorldState()` and `updateCombatState()` never called from game flow                       |
| Light sources in vision          | `vision-computation.ts` | `computePartyVision` accepts `lightSources` but no caller passes them                            |
| Token context menu conditions    | `TokenContextMenu`      | `handleApplyCondition` closes menu, no link to `QuickConditionModal`                             |
| Drawing tools in game            | `drawing-layer.ts`      | Data and layer exist, tools only in `DMMapEditor`, not main game toolbar                         |
| Clear All Fog / Reset Explored   | `vision-slice.ts`       | Actions exist, not exposed in game UI                                                            |
| Roll request overlay             | `RollRequestOverlay`    | Component rendered in `GameLayout` but P2P `dm:roll-request` message type may not be fully wired |


---

### 2. Bugs & Errors

#### Critical


| File                                | Issue                                                                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-game-effects.ts` lines 147-167 | `setInterval` poll started when `status === 'preparing'` is **never cleared on unmount**. Poll keeps running after navigation, updating stores from stale context. 60s `setTimeout` also not cleared. Memory leak and stale state corruption. |


#### High


| File                                 | Issue                                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-character-store.ts` line 51     | On API `result.success === false`, local state is **still updated**. UI shows success even when save failed.                                                           |
| `use-character-store.ts` lines 48-74 | `saveCharacter` and `deleteCharacter` catch errors but don't rethrow or signal failure. Callers cannot handle save failures.                                           |
| `host-handlers.ts` lines 109, 133    | `BuyItemPayload` and `SellItemPayload` cast without runtime validation. Malformed network payloads from a bad client can **crash the host**.                           |
| `lighting-overlay.ts`                | `pixelWidth = map.width * cellSize` but `map.width`/`map.height` are pixel dimensions elsewhere. Unit confusion causes incorrect lighting computation bounds.          |
| `use-character-store.ts` lines 33-34 | `toggleArmorEquipped` compares `char.armor.find(x => x.id === armorId)?.type` with `a.type` while iterating. May unequip wrong armor when multiple items share a type. |


#### Medium


| File                                           | Issue                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `use-data-store.ts` lines 167-169              | `loadPluginContent` catch sets `pluginsLoaded: true` on failure. Failed plugins appear loaded.                                            |
| `bmo-bridge.ts` lines 21-28                    | No `res.ok` check before `res.json()`. 4xx/5xx or non-JSON responses cause unhandled parse errors.                                        |
| `LibraryPage.tsx` lines 214-222                | Favorites: `'equipment'` and `'rules'` are invalid `LibraryCategory`. Falls through to default, returning only homebrew.                  |
| `LibraryPage.tsx` lines 134-161                | `loadCategoryItems` and `searchAllCategories` use `.then()/.finally()` without `.catch()`. Unhandled promise rejections.                  |
| `conversation-manager.ts`                      | `ensureAlternating` merges consecutive same-role messages. Distinct user messages may be incorrectly concatenated, confusing AI timeline. |
| `context-builder.ts` line 206                  | `loadMonsterData()` uses `__dirname`. Path to renderer data may break in packaged builds.                                                 |
| `peer-manager.ts`                              | Pi host IP `10.10.20.242` hardcoded. Blocks non-Pi networking setups.                                                                     |
| `host-message-handlers.ts`                     | `CLIENT_ALLOWED_PREFIXES` includes `game:token-move` but real type is `dm:token-move`. Likely dead/obsolete prefix.                       |
| `client-manager.ts`                            | Rejoin omits `gameSystem` from join payload.                                                                                              |
| `notification-service.ts` lines 111-113        | `DEFAULT_TEMPLATES[event]` can be undefined if event is invalid. No fallback.                                                             |
| `fog-overlay.ts`                               | Fog iterates over square grid cells only. Hex grids not supported for fog.                                                                |
| `measurement-tool.ts`                          | Euclidean distance only. No hex distance. No D&D diagonal (1-2-1) rules.                                                                  |
| `creature-actions.ts` lines 421, 469, 519, 624 | `.catch(() => {})` on AI mutations, rest, encounter. Failures completely invisible to users.                                              |
| `ai-service.ts` line 588                       | `memMgr.appendSessionLog(...).catch(() => {})`. Session log writes fail silently.                                                         |
| `use-lobby-store.ts`                           | `persistDiceColors(colors)` runs on every peer update, not just local player changes.                                                     |
| Various data loaders                           | `weather-tables.ts`, `wearable-items.ts`, `variant-items.ts`, `ConditionTracker.tsx` data load `.catch(() => {})` swallows all failures.  |
| `JoinGamePage.tsx` lines 52-70                 | Auto-rejoin uses `setTimeout(..., 0)` and reads from `localStorage`; state updates and navigation can interleave (race condition).        |


#### Low


| File                                     | Issue                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `sound-playback.ts` line 34              | `audio.play().catch(() => {})` playback failures ignored (common for autoplay policy). |
| `TurnNotificationBanner.tsx` lines 17-19 | Inner `setTimeout(onDismiss, 300)` not cleared on unmount.                             |
| `plugin-api.ts` line 244                 | Catch block with no error capture or logging.                                          |
| `use-lobby-store.ts`                     | Uses `require()` for network store (circular dep workaround).                          |
| Preload `index.ts` line 181              | Orphaned `// Auto-update` comment with no related code.                                |


#### Tech debt: circular dependency workarounds

6+ modules use `require()` or dynamic `import()` to avoid cycles: `use-lobby-store`, `network-store/client-handlers`, `conditions-slice`, `plugin-api`, `game-action-executor`, `host-message-handlers`.

---

### 3. Competitor Research: Feature Gap Analysis

#### 83-feature "Ideal VTT" checklist (compiled from D&D Beyond, Roll20, Foundry VTT)

**From Foundry VTT (largest gap area for this app):**

- 7 wall types with independent vision/movement/light/sound control (this app has 3)
- Scene Regions with programmable behaviors (teleport, traps, darkness, movement cost)
- Active Effects V2 (auto-modify tokens, stats, vision based on conditions/equipped items)
- Positional ambient audio with wall occlusion
- Scene Levels for multi-floor dungeons within a single scene
- Animated scene transitions (14 types)
- Light animation types (torch, pulse, flicker, emanation)
- Module ecosystem (3,947+ community modules vs this app's nascent plugin system)
- ProseMirror rich text editor for journals (this app uses TipTap, which is comparable)
- Animated tiles (video/spritesheet support)
- Sound walls (walls block sound propagation)
- Darkness sources (magical darkness zones)
- Adventure compendiums (package and distribute entire adventures as installable modules)
- Effect stacking rules and transfer effects from items

**From Roll20:**

- Foreground layer with conditional fade on token proximity
- Reactive Scenes (trigger zones for traps/macros on token overlap)
- Multi-token group operations (select, lock, move, enumerate)
- Integrated map creation (Dungeon Scrawl)
- Rollable tables for random generation (in-game roller)
- Auto-center on active token during combat turns
- Transmogrifier (cross-campaign content transfer)
- Built-in voice/video chat (this app uses Discord instead, which is intentional)
- One-way vision barriers
- Map Pins with player/GM visibility (beta 2026)
- Loot Manager for instant shop/treasure generation
- Inline dice rolls in chat messages

**From D&D Beyond:**

- Encounter builder with CR-based difficulty calculator (easy/medium/hard/deadly)
- Party inventory / shared loot pool
- Content sharing (one subscriber's library shared with 12 players)
- Guided character builder with full rules enforcement and auto-calculations
- Mobile app for character access on the go
- Avrae Discord bot integration

**This app's unique advantages over all three:**

- AI Dungeon Master (no competitor has this)
- Bastion management system (unique feature)
- 3D dice physics with Three.js + cannon-es
- Full offline support (desktop-first, no internet required)
- P2P networking (no central server dependency)

---

### 4. Map / Token / Battle / In-Game System (High Priority)

#### Missing


| Item                                 | Detail                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Light sources in party vision        | `computePartyVision` supports `lightSources` but no caller passes them. Fog/explored cells ignore token light. |
| Hex fog of war                       | `fog-overlay.ts` iterates square grid cells only.                                                              |
| Hex measurement distance             | `measurement-tool.ts` uses Euclidean distance only.                                                            |
| D&D diagonal measurement             | No 1-2-1 or 5/10/5 diagonal rules.                                                                             |
| Multi-segment ruler                  | Single measurement only; no waypoint/path measurement.                                                         |
| Custom token images                  | `MapToken.imagePath` field exists but tokens render as colored circles.                                        |
| Attack modal map-click targeting     | Target selection is modal-only; no click-on-map integration.                                                   |
| Drawing tools in main game toolbar   | Available only in `DMMapEditor`, not during gameplay.                                                          |
| Clear All Fog / Reset Explored in UI | Actions in `vision-slice.ts` exist but no buttons in game interface.                                           |
| Multi-token selection                | No group select, move, or operate on multiple tokens.                                                          |
| Auto-pan to active token             | "Center on entity" is manual via portrait click; no auto-pan on turn advance.                                  |
| Foreground/occlusion tiles           | No layer that renders above tokens with conditional fade.                                                      |
| Trigger zones                        | No token-enter/leave events for traps, teleportation, or environmental effects.                                |
| Token aura rings                     | No visual indicators for light radius, spell range, or aura effects.                                           |
| Grid coordinate display              | No coordinate readout on hover.                                                                                |
| Token rotation                       | No rotation indicator or facing direction.                                                                     |


#### Broken / Unreliable


| Item                      | Detail                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Multi-floor filtering     | `currentFloor` in `FloorSelector.tsx` is set but never used for token visibility or layer filtering. Floors are decorative. |
| `fogBrushSize`            | Passed to `MapCanvas` as `_fogBrushSize` (line 88), completely ignored.                                                     |
| Audio emitters            | `AudioEmitterLayer` created in `audio-emitter-overlay.ts`, `updateEmitters` never called with map `audioEmitters`.          |
| Vision update timing      | Recomputed only on mount/token changes, not on every token move during dynamic fog. Late vision for moving players.         |
| Combat animation listener | `onCombatAnimation` single listener: re-registering overwrites previous listener.                                           |
| Lighting unit confusion   | `lighting-overlay.ts` computes `map.width * cellSize` where `map.width` may already be pixel dimensions.                    |
| Initiative delay          | UI `onDelayEntry` removes entries; `delayTurn`/`undelay` slice methods are separate and not wired to the UI.                |


#### QoL Improvements

- Auto-pan to active token on turn change
- Render token images when `imagePath` is set (fall back to colored circle)
- Expose "Clear All Fog" and "Reset Explored" buttons in game UI
- Wire context menu "Apply Condition" to `QuickConditionModal`
- Expose drawing tools in main game toolbar (not just `DMMapEditor`)
- Highlight path from initiative tracker to active token on map
- Debounce vision recomputation (runs on any token/wall change)
- Cache pathfinding results when movement/terrain/walls haven't changed
- Health bar color thresholds (green > 50%, yellow 25-50%, red < 25%)

#### Additional Tools to Consider

- Cone/line template preview before AoE placement
- Multi-waypoint ruler for path distance
- Token aura/range ring visualization
- Grid coordinate readout on hover
- Snap feedback for wall placement (show nearby intersection snap points)
- Token rotation/facing direction indicator
- Elevation line-of-sight and cover calculations (tokens have elevation but combat is 2D only)

---

### 5. AI Dungeon Master

#### Missing Features


| Item                       | Detail                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Provider switching         | Only Ollama wired. `@anthropic-ai/sdk` and `@langchain/anthropic` in deps but not in main app flow.                           |
| Memory sync                | `updateWorldState()` / `updateCombatState()` in `memory-manager.ts` never called. Live game state not persisted to AI memory. |
| Semantic RAG               | TF-IDF keyword search only (`search-engine.ts`). No embeddings or vector search.                                              |
| Structured output schemas  | No JSON schema for `[DM_ACTIONS]` / `[STAT_CHANGES]`. Relies on model formatting text-based tags perfectly.                   |
| Validation loop            | No check/feedback when AI action or stat change is incorrect or impossible.                                                   |
| Few-shot examples          | No examples in prompts for `[STAT_CHANGES]` or `[DM_ACTIONS]` formatting.                                                     |
| `place_creature` action    | Listed in `dm-system-prompt.ts` but missing from `DmAction` TypeScript union in `dm-actions.ts`.                              |
| Web search fallback        | Only DuckDuckGo Instant Answer API. No alternative backends, no rate limiting.                                                |
| Multi-turn tool use        | FILE_READ and WEB_SEARCH have max depth 3 but no iterative reasoning between reads.                                           |
| DM personality modes       | No customizable DM style (narrative-heavy, rules-focused, humorous, etc.).                                                    |
| Player preference learning | No adaptive behavior based on group playstyle or feedback.                                                                    |


#### Prompting Issues

- System prompt is ~490 lines in a single file (`dm-system-prompt.ts`). No modular loading by campaign type, setting, or context.
- `ensureAlternating` in `conversation-manager.ts` merges consecutive same-role messages, potentially confusing the AI's understanding of conversation timeline.
- Context truncation drops older messages without summary, losing nuanced campaign details.
- Keyword-based rule injection (planar rules only if exact keywords detected) is brittle. Misses paraphrased or indirect references.

#### Response Quality Concerns

- No response quality scoring or automatic retry on poor output.
- Streaming buffer grows unbounded (no backpressure) in `ollama-client.ts`.
- 120s timeout on Ollama with no partial-result recovery.
- 60s safety timeout in `use-ai-dm-store.ts` calls `cancelStream()` without await. Race condition possible.
- Duplicated stream completion logic: `ai-service.ts` has its own `handleStreamCompletion` instead of importing from `ai-stream-handler.ts`.

---

### 6. Library / Compendium

#### Missing Content / Categories

- `searchAllCategories` (`library-service.ts` lines 606-632) omits: `tools`, `maps`, `shop-templates`, `portraits`, `gear`, `vehicles`, `trinkets`, `light-sources`, `sentient-items`.
- No item counts for official data on category tiles (only homebrew counts via `homebrewCounts`).
- Descriptions truncated to ~120 chars on cards with no expandable preview.
- `core-books` group has no categories in `LIBRARY_GROUPS`. Handled separately by `CoreBooksGrid`.

#### Bugs

- `LibraryPage.tsx` line 217: `'equipment'` and `'rules'` in favorites `allCats` are invalid `LibraryCategory` values. `loadCategoryItems` falls through to default handler, returning homebrew only.
- `LibraryPage.tsx` lines 134-161: Multiple promise chains without `.catch()`. Unhandled rejections.
- `use-library-store.ts` lines 69-71: `loadHomebrew` catch logs only; no UI error state; `homebrewLoaded` stays false forever.

#### Duplication

- `CompendiumModal` (in-game, read-only, limited tabs) vs `LibraryPage` (full compendium + homebrew + favorites + recently viewed). Share data loaders but have separate rendering logic and different feature sets.

#### Search Improvements Needed

- Client-side substring match only (`.includes(query)`).
- No faceted filtering in global search (can't combine level + school for spells).
- No fuzzy/typo-tolerant matching.
- No search history or suggestions.

---

### 7. GUI / UX Review

#### User-Friendliness Issues


| Area                      | Issue                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| GameLayout complexity     | Holds 50+ pieces of state. Should extract into dedicated hooks.                                           |
| Main menu navigation      | Settings and Calendar not on main menu nav. No in-app nav to Library/Bastions/Calendar from game session. |
| Character creation routes | Confusing duplicates: `/characters/create` vs `/characters/5e/create`.                                    |
| Bottom bar collapse       | Hides Macro Bar and Action Buttons. Players lose core gameplay access.                                    |
| Tools dropdown            | Long, nested, "Tools..." label unclear.                                                                   |
| DM character picker       | Must pick character in `CharacterPickerOverlay`. Not obvious workflow.                                    |
| Auto-rejoin               | `JoinGamePage` has no loading state feedback during reconnection.                                         |
| Breadcrumbs               | No breadcrumb or context indicator during gameplay.                                                       |


#### Visual Polish


| Area            | Issue                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Typography      | System font only (Segoe UI). No thematic/fantasy font option.           |
| Animations      | Limited to toasts and dice. No page transitions, no micro-interactions. |
| Scrollbars      | Webkit-only styling. Firefox gets default scrollbars.                   |
| Dark UI density | `gray-800`/`gray-900` everywhere. Possible contrast issues.             |
| Modal buttons   | `ModalFormFooter` uses `text-[10px]`. Very small touch targets.         |
| Icons           | Unicode characters instead of consistent icon library.                  |


#### Accessibility Gaps

- Many buttons lack `aria-label`.
- `aria-expanded` on collapsible elements not audited.
- `CompendiumModal` and `LibraryDetailModal` don't use shared `Modal` component. Missing focus trap, escape handling, aria attributes.
- No `prefers-reduced-motion` support in focus ring animation.
- Screen reader mode must be manually enabled in Settings (not auto-detected from OS preference).
- No comprehensive focus management review beyond the main `Modal` component.

#### Recommendations

1. Extract `GameLayout` state into dedicated hooks.
2. Add Settings and Calendar to main menu.
3. Standardize all overlays/modals on shared `Modal` component.
4. Increase `ModalFormFooter` button size to at least `text-sm`.
5. Add Firefox scrollbar support (`scrollbar-color`, `scrollbar-width`).
6. Add loading states for auto-rejoin and lazy-loaded modals.
7. Consolidate character creation routes.
8. Add page/scene transition animations.
9. Consider a fantasy display font for headers and titles.
10. Replace Unicode icons with Lucide or Heroicons.

---

### 8. Other Observations

#### Performance

- Knip reports 110 dead-code items across the codebase.
- 4 files exceed 1000 lines: `DowntimeModal`, `SettingsPage`, `data-provider`, `CampaignDetailPage`. Candidates for splitting.
- Multiple `useEffect` hooks in `map-overlay-effects.ts` could be merged to reduce rerenders.
- Pathfinding (`pathfinder.ts`) runs on every movement state change. Should cache when movement/terrain/walls unchanged.
- Fog animation does per-cell alpha updates. Could batch by alpha bucket.
- Vision recomputation runs on any token or wall change. Should debounce.

#### Tech Debt

- 6+ circular dependency workarounds using `require()` or dynamic `import()`.
- Inconsistent error handling: some paths use `addToast`, some `console.error`, some swallow silently.
- `console.warn` in production code (`combat-resolver.ts`, `PdfViewer.tsx`) instead of project logger.
- Dead barrel files (`constants/index.ts`, `network/index.ts`, `types/index.ts`). Imports go to subfiles directly.
- `ai-stream-handler.ts` exists as a test module but `ai-service.ts` has its own inlined version of `handleStreamCompletion`.

#### Testing

- 512+ tests across 29 files with Vitest. Solid for services and data.
- Coverage limited to `services/` and `data/`. No component test coverage.
- No E2E or integration tests.
- No network/P2P integration tests.

#### Security

- Electron security passes: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- `BMO-setup/pi/app.py` line 62: `cors_allowed_origins="*"`. Very permissive for production.
- Network messages validated via Zod schemas (good).
- Rate limiting and bounded send queues (50 msgs) on network (good).
- `MAX_READ_FILE_SIZE` = 50MB, `MAX_WRITE_CONTENT_SIZE` = 10MB limits (good).
- `host-handlers.ts` buy/sell payloads not runtime-validated. Attack surface for malicious clients.

#### Documentation

- `README.md` (minimal install/test/license).
- `CLAUDE.md` (comprehensive for AI agents, excellent).
- `.github/copilot-instructions.md` (mirrors CLAUDE.md).
- No public API docs for plugin developers.
- No user-facing documentation, help system, or tooltips for new users.
- No architecture diagrams.

#### Codebase Stats

- Version: 1.9.9
- Electron 40, React 19, TypeScript 5.9, Tailwind v4, Zustand v5
- 14+ Zustand stores (many with composable slices)
- 40+ service modules
- 90+ IPC channels
- 85+ JSON data files in `data/5e/`
- 15 lazy-loaded routes

---

## kimi-k2.5 — Extensive Codebase Analysis

---

### Executive Summary

This is a sophisticated Electron-based D&D 5e Virtual Tabletop (v1.9.9) featuring:

- **Architecture**: Electron 40 + React 19 + TypeScript 5.9
- **Networking**: PeerJS WebRTC P2P with Cloudflare STUN/TURN
- **Graphics**: PixiJS for maps, Three.js + Cannon.js for 3D dice physics
- **AI**: Local Ollama LLM integration with RAG rulebook search
- **Data**: 3,000+ JSON files covering 5e 2024 rules
- **Tests**: 512+ tests across 29 files, all passing
- **Type Safety**: Zero TypeScript errors

---

### 1. Feature Completeness Analysis

#### 1.1 Core VTT Features Present


| Feature                | Status   | Notes                                                  |
| ---------------------- | -------- | ------------------------------------------------------ |
| **Map System**         | Complete | PixiJS-based with fog of war, lighting, walls, weather |
| **Token Management**   | Complete | HP bars, conditions, elevation, lighting badges        |
| **Initiative Tracker** | Complete | Integrated with combat log                             |
| **3D Dice Physics**    | Complete | Cannon.js + Three.js, all polyhedral dice              |
| **Character Builder**  | Complete | Full 5e 2024 character creation with level-up          |
| **Character Sheet**    | Complete | Digital sheet with auto-calculation                    |
| **Library/Compendium** | Complete | 3,000+ entries across 57 categories                    |
| **AI DM**              | Complete | Ollama-powered with 50+ action types                   |
| **Multiplayer P2P**    | Complete | Host/client with WebRTC                                |
| **Audio System**       | Complete | Sound effects + ambient loops                          |
| **Chat System**        | Complete | With dice rolling, whisper, file sharing               |
| **Journal System**     | Complete | Shared party notes                                     |
| **Fog of War**         | Complete | Three-state (visible/explored/hidden)                  |
| **Dynamic Lighting**   | Complete | Raycast-based with darkvision                          |
| **Macro System**       | Complete | User-defined command shortcuts                         |
| **Plugin System**      | Partial  | Content packs working, JS plugins stubbed              |


#### 1.2 Missing/Incomplete Features for Full VTT

**High Priority Missing Features:**

1. **Cloud LLM Integration** (Critical Gap)
  - **Current**: Only Ollama (local) supported
  - **Missing**: Claude, OpenAI, Gemini cloud providers
  - **Location**: `src/main/ai/ollama-client.ts`
  - **Impact**: Users must run local AI; no cloud option available
2. **JavaScript Plugin Execution** (Major Gap)
  - **Current**: Content packs (JSON) fully working
  - **Missing**: `plugin` and `game-system` type execution
  - **Location**: `src/main/plugins/plugin-scanner.ts:1-137`
  - **Note**: Entry points defined in manifest but never loaded/executed
3. **Vision Capabilities for AI DM**
  - **Missing**: Image/map analysis for AI
  - **Potential**: AI could analyze map screenshots, token positions
4. **Voice/TTS Integration**
  - **Missing**: Text-to-speech for AI DM narration
  - **Note**: Intentionally excluded per spec (Discord handles voice)
5. **Advanced Map Features**
  - **Missing**: Dynamic terrain elevation (3D positioning)
  - **Missing**: Animated tiles/terrain
  - **Missing**: Modular map tiles (dungeon tile sets)
  - **Missing**: Random dungeon/map generators
6. **Advanced Combat Features**
  - **Missing**: Cover calculation automation
  - **Missing**: Flanking detection
  - **Missing**: Automatic opportunity attack prompts
  - **Missing**: Area effect template placement (cone/circle/line tools exist but limited)
7. **Content Marketplace**
  - **Missing**: In-app content purchasing/downloading
  - **Current**: Manual plugin installation only
8. **Mobile/Web Companion App**
  - **Missing**: Player view for mobile devices
  - **Current**: Desktop Electron app only

---

### 2. Bugs & Errors Found

#### 2.1 Syntax/Logic Errors

**Status: 0 TypeScript errors found**

#### 2.2 Silent Error Handling (Empty Catch Blocks)


| Location                                           | Issue                                             | Severity |
| -------------------------------------------------- | ------------------------------------------------- | -------- |
| `src/renderer/src/systems/dnd5e/index.ts:44`       | Spell slot preload failures silently logged only  | Low      |
| `src/renderer/src/stores/use-lobby-store.ts:24-26` | localStorage parse errors ignored                 | Low      |
| `src/renderer/src/stores/use-lobby-store.ts:33-35` | localStorage write errors ignored                 | Low      |
| `src/renderer/src/stores/use-lobby-store.ts:45-47` | Chat history parse errors ignored                 | Low      |
| `src/renderer/src/stores/use-lobby-store.ts:57-59` | Chat history write errors ignored                 | Low      |
| `src/main/ai/context-builder.ts:162-163`           | SRD data errors silently swallowed                | Medium   |
| `src/main/ai/ollama-client.ts:102-109`             | Malformed SSE chunks skipped (data loss possible) | Medium   |


#### 2.3 Logical Errors / Bugs

1. **DiceTray rollerName Empty** (`src/renderer/src/components/game/dice3d/DiceOverlay.tsx:128`)
  ```typescript
   rollerName: '', // filled by event source
  ```
  - The roller name is never populated in tray entries
2. **FloorSelector Not Integrated** (`src/renderer/src/components/game/map/FloorSelector.tsx`)
  - Component accepts `onFloorChange` callback
  - `MapCanvas.tsx:152` sets floor state locally but doesn't trigger actual map floor change
  - **Result**: Floor switching UI exists but doesn't work
3. **Stream TTL Race Condition** (`src/main/ai/ai-service.ts:84-94`)
  - 10-minute stream TTL may abort long-running AI generations mid-response
  - No warning to user when this happens
4. **Web Search Fake Results** (`src/main/ai/web-search.ts:115-121`)
  - Returns synthetic "No results" result instead of empty array
  - AI may misinterpret this as an actual search result
5. **Binary Detection Limitation** (`src/main/ai/file-reader.ts:93-99`)
  - Only checks first 8KB for null bytes
  - May miss binary files with late nulls

#### 2.4 Network Issues

1. **No Request Rate Limiting on Ollama**
  - Could overwhelm local Ollama instance with rapid requests
2. **PowerShell Dependency** (`src/main/plugins/plugin-installer.ts:27-28`)
  ```typescript
   const psCommand = `Expand-Archive -Path '${zipPath...`
   await execAsync(`powershell -NoProfile -Command "${psCommand}"`)
  ```
  - Plugin installation requires PowerShell
  - Won't work on non-Windows without modification

#### 2.5 UI/GUI Issues

1. **Unused Variable Suppression** (`JournalPanel.tsx:64-65`)
  - Campaign ID tracked but not used for persistence
2. **Creature Search Silent Fail** (`CreatureSearchModal.tsx:29-30`)
  ```typescript
   } catch {
     setCreatures([])
   }
  ```
  - Loading failures show empty results without error message

---

### 3. Competitor Research: Feature Comparison

#### 3.1 D&D Beyond Features This VTT Lacks


| Feature                          | D&D Beyond | This VTT           | Priority |
| -------------------------------- | ---------- | ------------------ | -------- |
| Official D&D Content Integration | Full       | None (SRD only)    | Medium   |
| Cloud Save/Character Sync        | Yes        | P2P only           | High     |
| Mobile App                       | Yes        | No                 | Medium   |
| LFG (Looking for Group)          | Yes        | No                 | Low      |
| Marketplace                      | Yes        | Plugin system only | Medium   |
| Character Builder Visual Polish  | High       | Medium             | Medium   |
| Digital Dice Branding            | Animated   | 3D Physics         | N/A      |
| Quick Play Encounters            | Yes        | Manual setup       | Medium   |
| Stickers/Map Decorations         | Yes        | Weather only       | Low      |


#### 3.2 Roll20 Features This VTT Lacks


| Feature                     | Roll20         | This VTT           | Priority |
| --------------------------- | -------------- | ------------------ | -------- |
| Dynamic Lighting (Advanced) | Yes            | Basic raycast      | Medium   |
| Marketplace (Assets)        | 1,200+ systems | Plugin system      | Medium   |
| Built-in Video/Voice        | Yes            | Excluded (Discord) | N/A      |
| LFG Matchmaking             | Yes            | No                 | Low      |
| Dungeon Scrawl Integration  | Yes            | No                 | Low      |
| Macro/Script API            | Extensive      | Basic              | Low      |
| Card Decks                  | Yes            | No                 | Low      |
| Jukebox (Audio)             | Yes            | Yes (par)          | N/A      |
| Character Sheet Templates   | Many           | D&D 5e only        | Low      |
| Roll Tables                 | Yes            | Random tables      | Partial  |
| Patreon Integration         | Yes            | No                 | Low      |


#### 3.3 Foundry VTT Features This VTT Lacks


| Feature             | Foundry VTT | This VTT        | Priority |
| ------------------- | ----------- | --------------- | -------- |
| Self-Hosted Server  | Yes         | P2P only        | Medium   |
| 8,000+ Modules      | Yes         | ~10 plugins     | High     |
| Advanced Lighting   | 8.0+ vision | Basic           | Medium   |
| 3D Audio            | Yes         | No              | Low      |
| Scene Regions       | Yes         | No              | Medium   |
| Active Effects      | Full        | Conditions only | High     |
| MIDI-QOL Automation | Extensive   | Basic combat    | High     |
| Dice So Nice        | 3D dice     | Built-in 3D     | N/A      |
| API Documentation   | Extensive   | Minimal         | Medium   |
| One-Time Purchase   | $50         | Free            | N/A      |
| Data Ownership      | Full        | Local files     | N/A      |


#### 3.4 Innovation Opportunities

Based on competitor gaps, this VTT could lead in:

1. **AI Integration** - Most competitors lack built-in AI DM
2. **Modern Stack** - Electron 40 + React 19 vs older web tech
3. **3D Dice Physics** - Superior to primitive 3D dice in competitors
4. **Offline-First** - Works without internet (except AI)
5. **Performance** - PixiJS WebGL vs canvas-based competitors

---

### 4. Map/Token/Battle System Analysis

#### 4.1 What's Missing


| Feature           | Status   | Location                   |
| ----------------- | -------- | -------------------------- |
| Measuring Tools   | Basic    | `measurement-tool.ts`      |
| Fog of War        | Complete | `fog-overlay.ts`           |
| Lighting System   | Complete | `lighting-overlay.ts`      |
| Wall System       | Complete | `wall-layer.ts`            |
| Weather Effects   | Complete | `weather-overlay.ts`       |
| Grid (Square/Hex) | Complete | `grid-layer.ts`            |
| Token Conditions  | Complete | `token-sprite.ts`          |
| Token Animations  | Complete | `token-animation.ts`       |
| AoE Overlays      | Basic    | `aoe-overlay.ts`           |
| Drawing Layer     | Complete | `drawing-layer.ts`         |
| Audio Emitters    | Complete | `audio-emitter-overlay.ts` |
| Combat Animations | Basic    | `combat-animations.ts`     |


**Missing/Broken:**

1. **Floor Switching Broken**
  - `FloorSelector.tsx` exists but doesn't integrate with map data
  - Multi-floor dungeons not actually functional
2. **No Advanced Movement Visualization**
  - No pathfinding display
  - No threatened area highlighting
  - No reach visualization
3. **No Cover Calculation**
  - Walls exist but don't calculate cover bonuses
  - Could integrate with combat resolver
4. **Limited AoE Templates**
  - Basic shapes exist
  - No drag-to-place cone/line
  - No template rotation

#### 4.2 QoL Improvements Needed

1. **Token Snap Options**
  - Currently always snaps to grid
  - No "no snap" or "half-snap" options
2. **Mass Token Selection**
  - No box-select for multiple tokens
  - No token groups/party selection
3. **Map Bookmarks**
  - No quick navigation to map areas
  - No named waypoints
4. **Grid Alignment Tools**
  - No manual grid offset adjustment
  - No rotate/scale grid to fit map image

#### 4.3 Additional Tools Needed

1. **Ruler/Measuring Enhancements**
  - Current: Basic distance measurement
  - Needed: Path distance (around walls), vertical distance, multi-point path
2. **Template Tools**
  - Spell template placement (drag from caster)
  - Custom shapes
  - Save templates for reuse
3. **Map Builder Tools**
  - Tile placement (dungeon tiles)
  - Stamp tool (trees, rocks, furniture)
  - Procedural map generation (dungeon, wilderness)

---

### 5. AI Dungeon Master Analysis

#### 5.1 What's Implemented

**Core Features:**

- Ollama LLM integration with streaming
- 700+ line system prompt covering 5e 2024 rules
- RAG rulebook search (chunk-based)
- 50+ DM action types (tokens, initiative, environment, audio)
- 20+ stat mutation types (HP, conditions, spell slots, etc.)
- Web search capability (DuckDuckGo)
- File reading (sandboxed to userData)
- NPC memory and relationship tracking
- DM approval gating
- Conversation persistence

**UI Components:**

- `AiDmCard.tsx` - Campaign settings
- `ChatPanel.tsx` - AI chat display
- `DMTabPanel.tsx` - DM controls (pause, approval toggle)
- `AiContextPanel.tsx` - Memory file viewer
- `RulingApprovalModal.tsx` - Action approval

#### 5.2 What's Missing

1. **Cloud LLM Providers** (Critical)
  - Claude API integration missing
  - OpenAI integration missing
  - Only Ollama (local) works
2. **Vision Capabilities**
  - Cannot analyze map screenshots
  - Cannot read token positions visually
  - Could enable "DM, what do I see?" from map context
3. **Voice Output**
  - No TTS for AI narration
  - Could enhance immersion significantly
4. **Proactive DM**
  - Currently reactive (waits for player input)
  - Could initiate based on:
    - Initiative changes ("It's your turn, what do you do?")
    - HP thresholds ("You're looking hurt...")
    - Time passing ("Night falls...")
5. **Combat Tactics**
  - AI can control tokens but limited tactical depth
  - Could use cover, flanking, opportunity attacks

#### 5.3 Prompting Issues

1. **Token Budget Warnings**
  - Context can exceed model limits
  - Graceful degradation could be improved
2. **Response Quality**
  - Depends entirely on local model quality
  - Smaller models (3B) produce poor results
  - No model recommendation guidance in UI

---

### 6. Library / Compendium Analysis

#### 6.1 Content Coverage

**Complete (57 categories):**

- Spells (391 files)
- Monsters/Creatures/NPCs (654 files)
- Equipment (1,121 files)
- Character Options (classes, species, backgrounds, feats)
- World Building (planes, settlements, deities)
- Hazards (traps, diseases, curses)
- Game Mechanics (conditions, skills, languages)
- Audio (sound events, ambient tracks)

**Missing:**

- Legendary Actions/Lair Actions (may be in monster data)
- Monster Templates (vampire template, lycanthrope, etc.)
- Specific Campaign Settings (Forgotten Realms lore, etc.)
- Treasure Hoard tables (separate from individual items)

#### 6.2 Search Functionality

**Working:**

- Global search across 42+ categories
- Category-specific filtering
- Favorites system
- Recently viewed
- Sort by: name, CR, level, rarity, cost, weight

**Could Improve:**

- No full-text search in descriptions (name/summary only)
- No saved searches
- No content tagging/filtering by source (PHB vs DMG vs homebrew)
- No fuzzy search (misspellings fail)

#### 6.3 PDF Integration

**Working:**

- PDF.js viewer with ToC
- Drawing overlay for annotations
- Core books integration (PHB, DMG, MM)

**Could Improve:**

- No text extraction for search
- No bookmarking within PDFs
- No hyperlinking from rules to PDF pages

---

### 7. GUI / UX Review

#### 7.1 Strengths

1. **Modern Stack**
  - Tailwind v4 for consistent styling
  - React 19 with concurrent features
  - Smooth animations throughout
2. **Accessibility**
  - SkipToContent component
  - ScreenReaderAnnouncer
  - Colorblind filters
  - Keyboard shortcuts overlay
3. **Polished Components**
  - Modal system with ErrorBoundary
  - Toast notifications
  - Loading states with Spinner
  - EmptyState components
4. **Responsive Design**
  - Game layout adapts to screen size
  - Sidebar collapsible

#### 7.2 Areas for Improvement

1. **Navigation Clarity**
  - Many modals (20+ utility modals, 12+ combat modals)
  - No clear "workflow" guidance for new users
  - Discoverability of features is low
2. **Onboarding**
  - No interactive tutorial
  - No guided first-character creation
  - Help modal exists but is text-heavy
3. **Visual Consistency**
  - Some components use different color schemes
  - Dice tray styling differs from main UI
4. **Mobile Responsiveness**
  - Game UI not designed for small screens
  - Character sheet works but cramped
5. **Settings Organization**
  - Many settings scattered across stores
  - No centralized settings UI
  - GlobalSettingsButton exists but limited scope

#### 7.3 Specific UX Issues

1. **Error Visibility**
  - Silent failures in several places
  - User not notified when AI stream times out
  - Creature search fails silently
2. **Loading States**
  - Some long operations lack progress indication
  - AI response streaming shows progress but no timeout warning
3. **Confirmation Dialogs**
  - `ConfirmDialog.tsx` exists but underutilized
  - Destructive actions (delete character) need confirmations

---

### 8. Other Observations

#### 8.1 Performance Concerns

1. **PixiJS Memory**
  - No explicit texture garbage collection seen
  - Frequent map switching may leak memory
2. **AI Context Building**
  - Synchronous context assembly for AI
  - Large campaigns may cause UI stutter
3. **Data Loading**
  - 3,000+ JSON files loaded on demand
  - No service worker caching
  - No compression of data files
4. **Network**
  - P2P has hard 2MB message limit
  - Large character sheets may hit this

#### 8.2 Code Organization

**Strengths:**

- Clean directory structure
- Co-located tests
- Zustand slice pattern for large stores
- IPC channels centralized

**Concerns:**

- Some stores becoming large (game store has 12 slices)
- Plugin system incomplete
- AI code (53 files) is substantial but isolated

#### 8.3 Documentation

**Present:**

- CLAUDE.md for development
- README.md (minimal)
- ARCHITECTURE.md in BMO-setup

**Missing:**

- User documentation
- Plugin development guide
- API documentation for plugin system
- AI prompting guide for users

#### 8.4 Security Observations

**Strengths:**

- Path traversal protection throughout
- UUID validation on all IDs
- Sandboxed file reading for AI
- Dialog allowed paths with TTL

**Concerns:**

- Plugin installation requires PowerShell
- No plugin permission system
- AI file reading limited but extensible

#### 8.5 Testing Coverage

**Good:**

- 512+ tests passing
- Services and data directories covered
- Co-located test files

**Gaps:**

- UI components minimally tested
- Main process tests limited
- No E2E tests
- No performance tests

---

### 9. Recommendations Summary

#### 9.1 Critical (Fix ASAP)

1. Fix FloorSelector integration (`MapCanvas.tsx:152`)
2. Add Claude/OpenAI integration for AI DM
3. Fix silent error handlers to show user feedback
4. Complete JavaScript plugin execution system

#### 9.2 High Priority

1. Add Active Effects system (like Foundry)
2. Implement cover calculation in combat
3. Add cloud save/sync option
4. Create onboarding/tutorial flow
5. Improve plugin installation cross-platform support

#### 9.3 Medium Priority

1. Add more AoE template tools
2. Implement token groups/multi-select
3. Add map bookmarks/waypoints
4. Create content marketplace UI
5. Add TTS for AI DM

#### 9.4 Low Priority / Nice to Have

1. Random dungeon generator
2. Card deck system
3. LFG matchmaking
4. Mobile companion app
5. Advanced 3D audio positioning

---

### 10. File References for Key Issues


| Issue                        | File                  | Line(s) |
| ---------------------------- | --------------------- | ------- |
| FloorSelector not integrated | `MapCanvas.tsx`       | 152     |
| DiceTray rollerName empty    | `DiceOverlay.tsx`     | 128     |
| Empty catch blocks           | `use-lobby-store.ts`  | 24-59   |
| Claude API missing           | `ai-service.ts`       | N/A     |
| Plugin execution missing     | `plugin-scanner.ts`   | 1-137   |
| Web search fake results      | `web-search.ts`       | 115-121 |
| Stream TTL race condition    | `ai-service.ts`       | 84-94   |
| Silent SRD errors            | `context-builder.ts`  | 162-163 |
| PowerShell dependency        | `plugin-installer.ts` | 27-28   |
| Binary detection limit       | `file-reader.ts`      | 93-99   |


---

**Analysis completed by kimi-k2.5 on March 9, 2026**
**Coverage**: 4,587 files analyzed across renderer, main, preload, and shared processes
**Test Status**: All 512+ tests passing, 0 TypeScript errors
**Lines of Code**: ~150,000+ (estimated)
## GPT-5.4 - Analysis

### 0. Validation And Research Artifacts

- TypeScript is clean in the current source tree: `node C:\Users\evilp\dnd\node_modules\typescript\bin\tsc --noEmit -p C:\Users\evilp\.cursor\worktrees\dnd\jdx\tsconfig.json` completed with exit code `0`.
- Static analysis is not clean. `biome check src/` reported `429 errors`, `471 warnings`, and `90 infos`. The visible diagnostics were dominated by formatting, import ordering, and JSON/layout issues rather than hard parser failures.
- Vitest from this worktree is currently environment-noisy rather than trustworthy as an app-health signal. Running it against the shared dependency tree produced many module-resolution failures (`react/jsx-dev-runtime`, `electron`, `zustand`, `zod`, `peerjs`), so I am not treating that as a reliable regression read on the app itself.
- Deep research artifacts generated in this pass:
  - `ddb-ultra-report.md`
  - `ddb-ultra-report.json`
  - `roll20-ultra-report.md`
  - `roll20-ultra-report.json`
  - `foundry-ultra-report.md`
  - `foundry-ultra-report.json`

### 1. Main Takeaway From The Scrape

The three competitors are not winning on the same axis:

- `D&D Beyond` wins on official-content integration, character-sheet/VTT continuity, low-friction combat setup, and an intentionally accessible product philosophy ([Maps](https://www.dndbeyond.com/games), [2026 Roadmap](https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap), [Subscribe](https://marketplace.dndbeyond.com/subscribe)).
- `Roll20` wins on GM workflow breadth, campaign/page organization, map prep shortcuts, LFG/onboarding, and a more productized API + sheet ecosystem after Jumpgate ([Project Jumpgate](https://wiki.roll20.net/Project_Jumpgate), [VTT QoL and Feature Improvements](https://help.roll20.net/hc/en-us/articles/25289127045143-VTT-Quality-of-Life-Feature-Improvements), [Beacon SDK](https://wiki.roll20.net/Beacon_Sheet_Development_Kit)).
- `Foundry VTT` wins on systems depth: scene logic, trigger zones, wall/light/sound rules, automation stacks, importers, and a mature module ecosystem ([Scene Regions](https://foundryvtt.com/article/scene-regions/), [Active Effects](https://foundryvtt.com/article/active-effects/), [Ambient Sounds](https://foundryvtt.com/article/ambient-sound/), [API](https://foundryvtt.com/api/)).

This codebase already contains pieces of all three strategies, but too many of them are either half-wired or not reliable enough to compete in practice.

### 2. Normalized Competitor Matrix

The matrix below summarizes the cited platform notes in Sections 3-5.

| Area | D&D Beyond | Roll20 | Foundry VTT | This app right now |
| --- | --- | --- | --- | --- |
| Map reveal and vision | Manual fog, polygonal fog, no true dynamic lighting/LOS | Unified Dynamic Lighting, Explorer Mode, Hide/Reveal Mask | Walls, light, sound, Scene Regions, strong canvas model | Has fog, walls, vision, terrain, floors, audio emitters in data model, but fog defaults off and several systems are dormant |
| GM prep speed | Quickplay maps, integrated official content, shared sheets/game log | Build a Map, Dungeon Scrawl sync, page folders, pins, journal linkage | Importer ecosystem, module stacks, rich automation | Custom map import is still placeholder-only and adventure/map setup is slower than all three |
| Combat flow | Integrated tracker, shared dice, sheet HP sync, stat block rolls | Mature sheet automation and API scripts | Deep automation via modules like midi-qol and DAE | Initiative identity and movement flow are not yet trustworthy |
| Information architecture | Strong library + campaigns + owned content | Page folders, journal, map pins, compendium | Documents, journals, regions, modules, importers | Library and in-game compendium are split; no strong map-linked journal/pin workflow |
| Extensibility | Little/no public API or module story | Pro/Elite Mod API + Beacon SDK | Strong API + module ecosystem | Plugin architecture exists but runtime loading and UI integration are still partial |
| Onboarding and accessibility | Explicit accessibility-first philosophy | LFG, PUG, tutorials, streamlined Build a Map | Powerful but more expert-oriented | Navigation and creation flows are less guided than DDB/Roll20 |
| Audio / AV stance | Shared dice and game log; no special AV edge | Built-in WebRTC but even Roll20 recommends Discord for reliability | Strong ambient audio and effects; self-hosted flexibility | Voice/video excluded by product choice, which is fine, but spatial audio features are still unfinished |

### 3. D&D Beyond: What It Proves Users Will Expect

- `Maps` is positioned as a browser-based VTT that is deeply integrated with owned D&D Beyond content, character sheets, and encounter workflows. The important part is not just the feature list, but the continuity: library -> campaign -> encounter -> sheet -> map -> game log ([Maps](https://www.dndbeyond.com/games), [The Official D&D VTT: Navigating Maps on D&D Beyond](https://www.dndbeyond.com/posts/1816-the-official-d-d-vtt-navigating-maps-on-d-d-beyond)).
- D&D Beyond Maps now has core tabletop affordances that players will treat as baseline even if the system is intentionally lightweight: token controls, multi-select/group operations, manual fog with polygonal shapes, drawing tools, ping/point tools, quickplay encounters, initiative, shared dice, and a shared game log ([Maps](https://www.dndbeyond.com/games), [Changelog](https://www.dndbeyond.com/changelog)).
- Content sharing is a major product-level differentiator. `Master Tier` allows content sharing across up to `5` campaigns and `12` other members per campaign, but VTT-specific customization such as custom map uploads and homebrew monster usage is also gated behind Master Tier ([Master Tier](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238580500-Master-Tier), [Campaign Content Sharing and You](https://dndbeyond-support.wizards.com/hc/en-us/articles/7747210355604-Campaign-Content-Sharing-and-You), [Subscribe](https://marketplace.dndbeyond.com/subscribe)).
- The platform is explicitly choosing accessibility over power-user depth. The product philosophy in the 2026 roadmap is basically "Honda Accord, not an F-16": reliable, easy to use, broad-audience, low-friction. That means they still lack scripting, a public extension API, true dynamic lighting, and Foundry-style automation stacks ([2026 Roadmap](https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap), [The Road Ahead](https://www.dndbeyond.com/posts/2120-the-road-ahead-join-our-journey-to-improve-the)).
- The 2026 rebuild matters strategically. D&D Beyond is investing in a new data-defined game platform, a Quickbuilder-first character-builder refresh, and a new suite of DM tools. Even where they are behind Foundry technically, they are actively closing the workflow gap with platform-level investment ([2026 Roadmap](https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap), [2025 Wrap-Up](https://www.dndbeyond.com/posts/2116-d-d-beyond-2025-wrap-up)).

#### D&D Beyond -> This codebase

- The most painful contrast is that D&D Beyond's integration surfaces are coherent while this app's are not. The lobby-selected character still does not determine the in-game PC; `src/renderer/src/components/lobby/LobbyLayout.tsx:20-29` sends `player:character-select`, but `src/renderer/src/pages/InGamePage.tsx:53` still picks `characters.find((c) => c.campaignId === campaignId) ?? characters[0] ?? null`.
- D&D Beyond's prep-speed advantage highlights how unfinished this app's custom-map path still is. `src/renderer/src/components/campaign/MapConfigStep.tsx:83-89` says image import is for a future phase and only stores a filename; `src/renderer/src/components/campaign/CampaignWizard.tsx:149-169,273-274` still stages maps with `campaignId: 'pending'`.
- D&D Beyond's sheet/VTT continuity makes our library/compendium split and custom-creature propagation issues more severe, not less. Imported custom creatures are saved via `src/renderer/src/pages/LibraryPage.tsx:322-333`, but official monster loaders dominate runtime search and lookup in `src/renderer/src/services/library-service.ts:387-389` and `src/renderer/src/services/data-provider.ts:638-672`.
- D&D Beyond's direction also sharpens the AI opportunity: if this app wants to beat DDB, it should not try to out-DDB them on accessibility alone. It should combine DDB-style continuity with a better AI layer. Right now that AI layer is not yet trustworthy because stat mutations bypass approval in `src/renderer/src/hooks/use-game-effects.ts:236-285` and `actingCharacterId` support exists in `src/main/ai/context-builder.ts:122-128` but is never wired through `src/main/ai/types.ts:17-24` or `src/main/ai/ai-service.ts:389-396`.

### 4. Roll20: What A Mature Generalist VTT Looks Like

- `Project Jumpgate` moved Roll20 from an older-feeling VTT into a more modern platform with a rebuilt engine, revised lighting/fog workflows, page folders, Map Pins, Beacon SDK sheets, and a more serious QoL/onboarding push ([Project Jumpgate](https://wiki.roll20.net/Project_Jumpgate), [The Future of Tabletop Gaming: Jumpgate Officially Launches](https://blog.roll20.net/posts/the-future-of-tabletop-gaming-jumpgate-officially-launches/), [2024 Change Log](https://help.roll20.net/hc/en-us/articles/34086640235927-2024-Change-Log)).
- Their visibility stack is productized in a way users understand immediately: `Hide / Reveal Mask` is free and manual, while Unified Dynamic Lighting adds Explorer Mode, token vision, directional light, and performance tuning ([Hide / Reveal Mask](https://help.roll20.net/hc/en-us/articles/360051768534-Hide-Reveal-Mask-Free), [How To Set Up Dynamic Lighting](https://help.roll20.net/hc/en-us/articles/4403861702679-How-To-Set-Up-Dynamic-Lighting), [VTT QoL and Feature Improvements](https://help.roll20.net/hc/en-us/articles/25289127045143-VTT-Quality-of-Life-Feature-Improvements)).
- Roll20's `Build a Map` and `Dungeon Scrawl` integration is the clearest prep-time lesson for this app. It is one-way sync, not perfect, but it dramatically cuts export/upload/align friction and supports improvisational map creation during play ([Dungeon Scrawl and Roll20 Connection](https://help.roll20.net/hc/en-us/articles/29069123512471-Dungeon-Scrawl-and-Roll20-Connection), [Build Epic VTT Maps In Minutes](https://blog.roll20.net/posts/build-epic-vtt-maps-in-minutes-dungeon-scrawl-connects-with-roll20/)).
- Roll20's `Map Pins` and `Journal` linkage are stronger than they sound. They turn map locations into an information architecture: page folders + pins + handouts + tooltips + GM-only notes + API access ([Map Pins](https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins), [Page Toolbar Folders](https://help.roll20.net/hc/en-us/articles/360039675413-Page-Toolbar-Folders), [Journal](https://help.roll20.net/hc/en-us/articles/360039675133-Journal)).
- Roll20 has a more mature "builder and automation middle layer" than D&D Beyond: Beacon SDK for sheets, modernized roll parsing, API server variants, and premium-gated scriptability ([Beacon SDK](https://wiki.roll20.net/Beacon_Sheet_Development_Kit), [How to Update Mod/API Scripts for D&D 2024 Beacon](https://help.roll20.net/hc/en-us/articles/30377793782423-How-to-Update-Mod-API-Scripts-for-D-D-2024-Beacon), [API Objects](https://help.roll20.net/hc/en-us/articles/360037772793-API-Objects)).
- Roll20 also invests more in acquisition and onboarding than this app currently does: LFG directory, Player Directory, PUG flow, Jumpgate tutorial, and small-but-important UX reductions like default game naming ([Using Our Looking for Group Tool](https://help.roll20.net/hc/en-us/articles/360037774473-Using-Our-Looking-for-Group-Tool), [Player Directory](https://help.roll20.net/hc/articles/360039178994-Player-Directory), [Roll20 Public Roadmap](https://help.roll20.net/hc/en-us/articles/38696415232279-Roll20-s-Public-Roadmap)).

#### Roll20 -> This codebase

- We do not have an equivalent to Roll20's map-linked information architecture. There is no Map Pins / Journal / handout-anchor workflow even though our game already wants location-aware knowledge. `src/renderer/src/components/game/modals/utility/CompendiumModal.tsx:23-58` hardcodes a narrow in-game compendium, and the main library is split away in `src/renderer/src/pages/LibraryPage.tsx`.
- We also do not have Roll20's campaign organization affordances. The main menu in `src/renderer/src/pages/MainMenuPage.tsx:4-80` exposes no direct Settings or Calendar entry, while the route table in `src/renderer/src/App.tsx:163-210` still duplicates character creation/edit paths in ways that add cognitive load.
- Roll20's sheet/API modernization makes our plugin story look unfinished. We can register UI extensions in `src/renderer/src/services/plugin-system/plugin-api.ts:197-215`, but runtime plugin enable/disable still bypasses the proper loader path in `src/renderer/src/pages/SettingsPage.tsx:296-305` versus `src/renderer/src/stores/use-plugin-store.ts:45-57`.
- Roll20's map-prep shortcut also exposes how much value we would get from a simple, opinionated import flow before chasing exotic features. Right now our custom-map workflow is still slower and less reliable than Roll20's integrated one-way sync.
- Roll20's official recommendation to use Discord for AV is also strategically validating. Since voice/video are intentionally excluded here, that is not a weakness by itself. The real issue is that our map/network/session flows still need to be much more reliable than they are today, especially with the current hardcoded relay defaults in `src/renderer/src/network/peer-manager.ts:11-32`.

### 5. Foundry VTT: The Ceiling For Systems Depth

- Foundry's real advantage is not any single feature; it is the consistency of its document model. Scenes, Walls, Tokens, Active Effects, Ambient Sounds, Measured Templates, and Scene Regions are all first-class objects in one extensible rules environment ([API](https://foundryvtt.com/api/), [Canvas Layers](https://foundryvtt.com/article/canvas-layers/), [Scene Regions](https://foundryvtt.com/article/scene-regions/)).
- `Scene Regions` are the biggest direct contrast to our current map toolset. They support shaped areas, vertical ranges, built-in behaviors like darkness adjustment, teleport, pause, script execution, weather suppression, and movement-cost changes, all driven by enter/exit/move/turn triggers ([Scene Regions](https://foundryvtt.com/article/scene-regions/), [Release 12.324](https://foundryvtt.com/releases/12.324)).
- `Active Effects` give Foundry a generalized, non-destructive rules-modification system that can be extended by automation modules like `DAE` and `midi-qol` ([Active Effects](https://foundryvtt.com/article/active-effects/), [midi-qol](https://foundryvtt.com/packages/midi-qol), [DAE](https://foundryvtt.com/packages/dae)).
- `Ambient Sounds` plus wall-aware occlusion are far beyond our current dormant audio-emitter layer. Foundry's audio pipeline already treats sound as a first-class scene object with radius, easing, wall constraints, and scripting hooks ([Ambient Sounds](https://foundryvtt.com/article/ambient-sound/), [Media Optimization Guide](https://foundryvtt.com/article/media/)).
- Foundry is also ahead on importer and ecosystem maturity. `DDB-Importer`, `Beyond20`, `Levels`, `Sequencer`, `Token Magic FX`, `socketlib`, and `libWrapper` are not edge extras - they are how the platform compounds value ([DDB-Importer](https://foundryvtt.com/packages/ddb-importer), [Beyond20](https://foundryvtt.com/packages/beyond20), [Levels](https://foundryvtt.com/packages/levels), [libWrapper](https://foundryvtt.com/packages/lib-wrapper), [socketlib](https://foundryvtt.com/packages/socketlib)).
- Release velocity matters too. Foundry keeps shipping foundational upgrades (v12 Scene Regions, v13 token drag measurement and ApplicationV2, v14 preview work around Scene Levels / editor migration) that steadily raise the ceiling ([Release 12.324](https://foundryvtt.com/releases/12.324), [Release 13.341](https://foundryvtt.com/releases/13.341), [Release 14.352](https://foundryvtt.com/releases/14.352)).

#### Foundry -> This codebase

- Our `types/map.ts` already hints at ambitions closer to Foundry than DDB: walls, terrain portals/hazards, floors, audio emitters, drawings, elevation, special senses, and mounted-combat fields are all there in `src/renderer/src/types/map.ts:1-163`. The problem is that the runtime does not honor enough of them.
- Floors are still decorative. `src/renderer/src/components/game/map/MapCanvas.tsx:152,678-680` tracks and renders `currentFloor`, but no filtering path uses it.
- Fog/vision are still not production-ready. New maps default to `fogOfWar.enabled: false` in `src/renderer/src/pages/campaign-detail/MapManager.tsx:74-77`, rendering bails when fog is disabled in `src/renderer/src/components/game/map/fog-overlay.ts:105-116`, and the store/UI only toggle `dynamicFogEnabled` in `src/renderer/src/stores/game/vision-slice.ts:65-71`.
- Our combat flow is much weaker than Foundry's automation floor. Initiative created from map tokens loses entity identity in `src/renderer/src/components/game/dm/InitiativeSetupForm.tsx:183-194` and `src/renderer/src/components/game/dm/InitiativeTracker.tsx:175-191`, and gameplay never fully surfaces the richer map toolset because `GameLayout` limits `activeTool` to `'select' | 'fog-reveal' | 'fog-hide' | 'wall'` in `src/renderer/src/components/game/GameLayout.tsx:154-156`.
- Audio emitters are closer to a Foundry-like idea than a finished feature. The type exists in `src/renderer/src/types/map.ts:17-27`, the layer is instantiated in `src/renderer/src/components/game/map/MapCanvas.tsx:219-221`, but repo search only found `updateEmitters()` in `src/renderer/src/components/game/map/audio-emitter-overlay.ts:15-33` and tests.
- Our plugin system is still much more primitive than Foundry's ecosystem. UI extension registration exists, but broad consumption, sandboxing, lifecycle control, and importer-style leverage are not mature enough yet.

### 6. What The Three Competitors Make Unavoidably Important

These are the clearest product gaps after scraping all three:

1. `Prep speed is a first-class feature.`
   - D&D Beyond uses quickplay and owned-content integration.
   - Roll20 uses Build a Map + Dungeon Scrawl.
   - Foundry uses importers, packages, and module stacks.
   - Our app still makes custom-map prep slower than all three because image import is placeholder-only and there is no polished map-pipeline or quickplay equivalent.

2. `Visibility and reveal need to feel finished.`
   - DDB has coherent manual fog with polygon tools.
   - Roll20 has mature manual and dynamic modes.
   - Foundry has walls/light/sound/region logic.
   - Our app has promising primitives but unreliable execution: fog defaults off, `fogBrushSize` is dead, and floor-aware visibility does not exist.

3. `Combat needs identity integrity and group operations.`
   - DDB already supports multi-select and encounter/initiative flows.
   - Roll20 and Foundry both support stronger token-driven workflows.
   - Our initiative flow still severs token identity and our main game view does not expose enough of the map/combat toolset.

4. `Information architecture on the map matters more than we currently treat it.`
   - DDB has reveals and integrated content.
   - Roll20 has map pins + journal + page folders.
   - Foundry has journals, regions, documents, importers.
   - Our library and compendium are still split, and there is no location-based note/pin model.

5. `Extensibility is not optional once the core is this ambitious.`
   - DDB is the only one of the three that is intentionally weak here.
   - Roll20 has Beacon SDK + Mod/API.
   - Foundry lives on modules and importers.
   - Our app already has enough systems complexity that plugin/runtime maturity now matters to product viability, not just nice-to-have customization.

### 7. Map / Token / Combat Implications

High-priority implications from the competitor scrape plus repo audit:

- Add a real `region/trigger` model instead of relying only on terrain cells. We already have hazard and portal semantics in `src/renderer/src/types/map.ts:31-45`, but not a general event-driven scene system. Foundry proves how much leverage this unlocks.
- Turn floors and elevation into actual rules/rendering behavior. Foundry is moving toward core Scene Levels; our app currently stores floor/elevation data but does not use it enough.
- Finish map prep before adding more map complexity. Roll20's Build a Map and DDB's quickplay both show that prep friction is product risk.
- Make visibility solid before adding more reveal tools. Competitors make even manual fog feel intentional; ours currently feels unfinished because the enablement model is wrong.
- Add stronger group operations: multi-select, bulk add to initiative, path rulers, map-linked notes/handouts, and better token status UX.

### 8. AI DM, Library, And UX Implications

- `AI DM`: The best way to leapfrog all three is to combine DDB-like rules/context continuity with Foundry-like actionability. But the current AI DM should not be trusted with automatic state changes until approval and routing are fixed (`src/renderer/src/hooks/use-game-effects.ts:236-285`, `src/main/ai/context-builder.ts:122-128`, `src/renderer/src/stores/use-ai-dm-store.ts:155-177`).
- `Library / Compendium`: Competitor scraping makes it clear that users expect one coherent content plane, not separate islands. We need a single story for main library, in-game compendium, homebrew/custom creatures, search, and map-linked reference objects (`src/renderer/src/pages/LibraryPage.tsx:214-222`, `src/renderer/src/services/library-service.ts:751-797`, `src/renderer/src/components/game/modals/utility/CompendiumModal.tsx:23-58`).
- `Navigation / Onboarding`: DDB is explicitly optimizing new-user flow, and Roll20 now invests heavily in onboarding, tutorials, LFG, and guided map setup. Our app still feels more like a power-user prototype than a guided product shell in its route structure and menu affordances.

### 9. Where This App Can Still Leapfrog The Field

If the current codebase is stabilized, it can still beat all three in a few ways:

- `AI-native tabletop`: none of the three has a genuinely integrated AI DM layer in the product core.
- `Desktop/local-first`: this app can remain more private, more offline-friendly, and less subscription-shaped than DDB or Roll20.
- `Hybrid lane`: DDB-style ease, Roll20-style onboarding, Foundry-style tactical depth, plus AI DM, is a stronger product vision than trying to imitate any one competitor directly.

But that only works if the app first makes its existing tactical and state-management systems reliable.

### 10. Revised Priority Order After Exhaustive Scrape

1. `Stabilize the current tabletop core before shipping more features.`
   - Fix fog enablement, initiative identity, movement/pathing, floor handling, and audio-emitter dormancy.
   - Key files: `src/renderer/src/pages/campaign-detail/MapManager.tsx:74-77`, `src/renderer/src/components/game/map/fog-overlay.ts:105-116`, `src/renderer/src/components/game/map/MapCanvas.tsx:152,678-680`, `src/renderer/src/components/game/dm/InitiativeSetupForm.tsx:183-194`, `src/renderer/src/components/game/dm/InitiativeTracker.tsx:175-191`.

2. `Build a real prep-speed pipeline.`
   - Quickplay/adventure setup, proper custom-map asset import, better content-to-map flow, location-linked notes/pins/reveals.
   - Key files: `src/renderer/src/components/campaign/MapConfigStep.tsx:83-89`, `src/renderer/src/components/campaign/CampaignWizard.tsx:149-169,273-274`, `src/renderer/src/components/game/modals/utility/CompendiumModal.tsx:23-58`.

3. `Choose and implement the automation/extensibility lane.`
   - If this app wants Foundry-grade ambition, it needs first-class trigger zones, active-effect style rule application, and a more serious plugin/importer story.
   - Key files: `src/renderer/src/services/plugin-system/plugin-api.ts:197-215`, `src/renderer/src/stores/use-plugin-store.ts:45-57`, `src/renderer/src/pages/SettingsPage.tsx:296-305`.

4. `Make the AI DM trustworthy enough to be a differentiator instead of a novelty.`
   - Gate all state mutations behind approval, wire `actingCharacterId`, restore per-campaign runtime config, and deepen integration with map/combat state.
   - Key files: `src/renderer/src/hooks/use-game-effects.ts:236-285`, `src/main/ai/types.ts:17-24`, `src/main/ai/context-builder.ts:122-128`, `src/renderer/src/stores/use-ai-dm-store.ts:155-177`.

5. `Unify content discovery.`
   - Merge the library and in-game compendium mental model, fix invalid categories, propagate homebrew/custom creatures everywhere, and surface world lore.
   - Key files: `src/renderer/src/pages/LibraryPage.tsx:214-222`, `src/renderer/src/services/library-service.ts:387-389,751-797`, `src/renderer/src/services/data-provider.ts:638-672`.

6. `Polish onboarding and shell navigation.`
   - DDB and Roll20 both show that smoother entry paths matter as much as raw feature count.
   - Key files: `src/renderer/src/pages/MainMenuPage.tsx:4-80`, `src/renderer/src/App.tsx:163-210`, `src/renderer/src/components/game/GameLayout.tsx:154-189`.
