# VTT Project — Consolidated Research Findings

## Feature Completeness
- Digital tabletop accessories: Drawing tools, sticky notes, shared sketch pads.
- Advanced automation: Auto-calculation of opportunity attacks, flanking rules, cover calculation automation.
- Character advancement tracking: Long-term campaign progression beyond individual levels, XP tracking, milestone advancement, character retirement.
- Integration features: Discord webhooks, external calendar sync, Google Sheets export.
- Accessibility features: Screen reader improvements, high contrast modes.
- Mobile/tablet support: Touch-optimized interface, mobile companion app for player view.
- Full mounted combat logic: Currently in Phase 4, `riderId` exists but movement logic is incomplete.
- 3D/Elevation combat: Tokens have elevation, but line-of-sight and cover calculations operate purely on a 2D plane.
- Scene Regions / Trigger Zones: No token area-enter/leave events. No trap/teleport/macro triggers.
- Foreground/Occlusion Layer: `weather-overlay.ts` exists but no foreground tile layer with conditional opacity.
- Multi-floor Scene Levels: `FloorSelector.tsx` exists, `currentFloor` state is set, but never used for token visibility or layer filtering.
- Positional Ambient Audio: `audio-emitter-overlay.ts` creates `AudioEmitterLayer` but `updateEmitters()` is never called.
- Sound Occlusion by Walls: Not present.
- Animated Scene Transitions: Map switching is instant with no transition effect.
- Scene Preloading: No mechanism to preload map assets before switching.
- Shared vs Individual Fog Modes: Single fog mode only.
- One-Way / Transparent Wall Types: Only solid, door, window. No independent vision/movement/light/sound control per wall.
- Secret Doors: Not present.
- Light Animation Types: Lighting overlay is static.
- Darkness Sources: Not present.
- Day/Night Cycle: Weather is manual only. No calendar-driven lighting.
- Multi-Token Group Operations: Single-token selection only.
- Party Inventory / Shared Loot: Shop system exists but no shared inventory pool.
- Encounter Builder with Difficulty Calc: Has encounter presets but no CR-based difficulty calculation.
- Content Sharing Model: No content sharing mechanism.
- Rollable Tables (in-game roller): `random-tables` library category exists but no in-game table roller.
- Active Effects System: Conditions exist but don't mechanically alter token properties.
- Cloud LLM Integration: Only Ollama supported. Missing Claude, OpenAI, Gemini cloud providers (`src/main/ai/ollama-client.ts`).
- JavaScript Plugin Execution: Content packs working, but `plugin` and `game-system` type execution missing (`src/main/plugins/plugin-scanner.ts:1-137`). Entry points defined in manifest but never loaded/executed.
- Vision Capabilities for AI DM: Missing image/map analysis for AI.
- Voice/TTS Integration: Missing text-to-speech for AI DM narration.
- Advanced Map Features: Dynamic terrain elevation, animated tiles/terrain, modular map tiles, random dungeon/map generators.
- Content Marketplace: Missing in-app content purchasing/downloading.
- Map prep pipeline: Custom-map prep is slower because image import is placeholder-only. `src/renderer/src/components/campaign/MapConfigStep.tsx:83-89` only stores a filename; `src/renderer/src/components/campaign/CampaignWizard.tsx:149-169,273-274` stages maps with `campaignId: 'pending'`.
- Extensibility: Plugin/runtime maturity needs improvement. UI extension registration exists (`src/renderer/src/services/plugin-system/plugin-api.ts:197-215`), but runtime plugin enable/disable bypasses proper loader path (`src/renderer/src/pages/SettingsPage.tsx:296-305` vs `src/renderer/src/stores/use-plugin-store.ts:45-57`).

## Bugs & Errors
### Syntax Errors
- 15 Biome lint errors (mostly `useExhaustiveDependencies` in hooks like `MapConfigStep.tsx:92`, `DiceHistory.tsx:26`, `DiceRenderer.tsx:51`).
- `biome check src/` reported 429 errors, 471 warnings, and 90 infos (dominated by formatting, import ordering, and JSON/layout issues).

### Logical Errors
- `use-game-effects.ts` lines 147-167: `setInterval` poll started when `status === 'preparing'` is never cleared on unmount. Poll keeps running after navigation, updating stores from stale context. 60s `setTimeout` also not cleared. Memory leak and stale state corruption.
- `use-character-store.ts` line 51: On API `result.success === false`, local state is still updated. UI shows success even when save failed.
- `use-character-store.ts` lines 48-74: `saveCharacter` and `deleteCharacter` catch errors but don't rethrow or signal failure. Callers cannot handle save failures.
- `lighting-overlay.ts`: `pixelWidth = map.width * cellSize` but `map.width`/`map.height` are pixel dimensions elsewhere. Unit confusion causes incorrect lighting computation bounds.
- `use-character-store.ts` lines 33-34: `toggleArmorEquipped` compares `char.armor.find(x => x.id === armorId)?.type` with `a.type` while iterating. May unequip wrong armor when multiple items share a type.
- `use-data-store.ts` lines 167-169: `loadPluginContent` catch sets `pluginsLoaded: true` even on failure. Failed plugins appear loaded.
- `LibraryPage.tsx` lines 214-222: Favorites: `'equipment'` and `'rules'` are invalid `LibraryCategory`. Falls through to default, returning only homebrew.
- `LibraryPage.tsx` lines 134-161: `loadCategoryItems` and `searchAllCategories` use `.then()/.finally()` without `.catch()`. Unhandled promise rejections.
- `conversation-manager.ts`: `ensureAlternating` merges consecutive same-role messages. Distinct user messages may be incorrectly concatenated, confusing AI timeline.
- `context-builder.ts` line 206: `loadMonsterData()` uses `__dirname`. Path to renderer data may break in packaged builds.
- `notification-service.ts` lines 111-113: `DEFAULT_TEMPLATES[event]` can be undefined if event is invalid. No fallback.
- `fog-overlay.ts`: Fog iterates over square grid cells only. Hex grids not supported for fog.
- `measurement-tool.ts`: Euclidean distance only. No hex distance. No D&D diagonal (1-2-1) rules.
- `creature-actions.ts` lines 421, 469, 519, 624: `.catch(() => {})` on AI mutations, rest, encounter. Failures completely invisible to users.
- `ai-service.ts` line 588: `memMgr.appendSessionLog(...).catch(() => {})`. Session log writes fail silently.
- `use-lobby-store.ts`: `persistDiceColors(colors)` runs on every peer update, not just local player changes.
- `JoinGamePage.tsx` lines 52-70: Auto-rejoin uses `setTimeout(..., 0)` and reads from `localStorage`; state updates and navigation can interleave (race condition).
- `sound-playback.ts` line 34: `audio.play().catch(() => {})` playback failures ignored.
- `TurnNotificationBanner.tsx` lines 17-19: Inner `setTimeout(onDismiss, 300)` not cleared on unmount.
- `plugin-api.ts` line 244: Catch block with no error capture or logging.
- `use-lobby-store.ts`: Uses `require()` for network store (circular dep workaround).
- Preload `index.ts` line 181: Orphaned `// Auto-update` comment with no related code.
- Hardcoded combat modifiers in `resolveDamage` (Heavy Armor Master and Heavy Armor usage are hardcoded to `false`).
- Hardcoded species vision (`DARKVISION_SPECIES` only includes base PHB species, breaking custom lineages).
- Unarmed Strike DC is hardcoded to STR (ignores Monk DEX).
- `systems/dnd5e/index.ts:44`: Spell slot preload failures silently logged only.
- `use-lobby-store.ts:24-26, 33-35, 45-47, 57-59`: localStorage and chat history parse/write errors ignored.
- `context-builder.ts:162-163`: SRD data errors silently swallowed.
- `ollama-client.ts:102-109`: Malformed SSE chunks skipped (data loss possible).
- `DiceOverlay.tsx:128`: `rollerName: ''` is never populated in tray entries.
- `ai-service.ts:84-94`: 10-minute stream TTL may abort long-running AI generations mid-response.
- `web-search.ts:115-121`: Returns synthetic "No results" result instead of empty array.
- `file-reader.ts:93-99`: Only checks first 8KB for null bytes, may miss binary files with late nulls.
- `DowntimeModal.tsx` 99–101: Three `load*().then(set*)` without `.catch()`.
- `CraftingBrowser.tsx` 50–51: `load5eCrafting()`, `Promise.all(RECIPE_FILES...)` — no `.catch()`.
- `CreatureModal.tsx` 69: `load5eMonsters().then(setMonsters)` — no `.catch()`.
- `DetailsTab5e.tsx` 64: `load5eFeats('Origin').then(setOriginFeats)` — no `.catch()`.
- `use-character-store.ts`, `use-campaign-store.ts`: Load/save failures logged but no `addToast`.
- `use-library-store.ts` lines 69-71: `loadHomebrew` catch logs only; no UI error state; `homebrewLoaded` stays false forever.
- `DMAudioPanel.tsx` 156–157: Upload catch — no `addToast`.
- Various data loaders (`weather-tables.ts`, `wearable-items.ts`, `variant-items.ts`, `ConditionTracker.tsx`): data load `.catch(() => {})` swallows all failures.

### Network Errors
- `host-handlers.ts` lines 109, 133: `BuyItemPayload` and `SellItemPayload` cast without runtime validation. Malformed network payloads from a bad client can crash the host.
- `bmo-bridge.ts` lines 21-28: No `res.ok` check before `res.json()`. 4xx/5xx or non-JSON responses cause unhandled parse errors.
- `BMO-setup/pi/app.py` line 62: `cors_allowed_origins="*"` — permissive for production.
- `peer-manager.ts`: Pi host IP `10.10.20.242` hardcoded. Blocks non-Pi networking setups.
- `host-message-handlers.ts`: `CLIENT_ALLOWED_PREFIXES` includes `game:token-move` but real type is `dm:token-move`. Likely dead/obsolete prefix.
- `client-manager.ts`: Rejoin omits `gameSystem` from join payload.
- `RollRequestOverlay` is fully implemented but orphaned, awaiting P2P socket wiring.
- No Request Rate Limiting on Ollama: Could overwhelm local Ollama instance with rapid requests.
- PowerShell Dependency (`src/main/plugins/plugin-installer.ts:27-28`): Plugin installation requires PowerShell. Won't work on non-Windows.

### GUI/UI Errors
- "Z-index soup" in `GameLayout.tsx` using absolute positioning and manual pixel calculations (e.g., `sidebarLeftPx`), which can lead to overlapping elements and resizing glitches.
- Fallback light radius defaults to 4 cells (20ft) if a light source isn't found in the dictionary.
- `JournalPanel.tsx:64-65`: Campaign ID tracked but not used for persistence.
- `CreatureSearchModal.tsx:29-30`: Loading failures show empty results without error message.

## Missing / Unfinished Systems
- Memory Manager world/combat sync: `updateWorldState()` and `updateCombatState()` in `memory-manager.ts` are never called from main flow. Persistent `world-state.json` / `combat-state.json` not synced from live game store.
- Light sources in vision: `computePartyVision` accepts `lightSources` but no caller passes them. Light only affects `lighting-overlay`, not fog/explored cells.
- CDN provider: Unused in `data-provider.ts`; not wired.
- Cloud sync: Missing, referenced in audit; file not in repo. (Also mentioned as S3 cloud backup/sync infrastructure `cloud-sync.ts`).
- 5e data extraction: `scripts/extract-5e-data.ts` line 254: only Spells domain; Classes commented out (line 267).
- Auto-update: `src/main/updater.ts`: `autoDownload` and `autoInstallOnAppQuit` both `false`.
- UI components marked as WIP/Orphan: Library sub-component redesign (`components/library/*`), `CombatLogPanel` (awaiting sidebar integration), `JournalPanel` (TipTap journal), `RollRequestOverlay` (awaiting P2P wiring), `ThemeSelector`, and `PrintSheet`.
- Sentient item generation framework: Built but not hooked up (`sentient-items.ts`).
- Fog brush size: `MapCanvas.tsx` line 88 passed as `_fogBrushSize`, never used.
- Token status ring: `combat-animations.ts` `drawTokenStatusRing` exported but never referenced.
- Custom token images: `map.ts` `MapToken.imagePath` exists, tokens render as colored circles only.
- BMO agents: `BMO-setup/pi/agent.py` line 770 `pass # Remaining agents not yet implemented`.
- Place creature DM action: `dm-system-prompt.ts` `place_creature` in prompt but missing from `DmAction` TypeScript union.
- Anthropic/Claude provider: `@anthropic-ai/sdk` in deps, only Ollama wired in main app; Claude in scripts only.
- Initiative delay: `InitiativeTracker.tsx` UI `onDelayEntry` removes entry; `delayTurn`/`undelay` in slice are separate and unwired.
- Token context menu conditions: `TokenContextMenu` `handleApplyCondition` closes menu, no link to `QuickConditionModal`.
- Drawing tools in game: `drawing-layer.ts` Data and layer exist, tools only in `DMMapEditor`, not main game toolbar.
- Clear All Fog / Reset Explored: `vision-slice.ts` Actions exist, not exposed in game UI.

## Map / Token / Battle System
### Missing Features
- Light sources in party vision: `computePartyVision` supports `lightSources` but no caller passes them. Fog/explored cells ignore token light.
- Hex fog of war: `fog-overlay.ts` iterates square grid cells only.
- Hex measurement distance: `measurement-tool.ts` uses Euclidean distance only.
- D&D diagonal measurement: No 1-2-1 or 5/10/5 diagonal rules.
- Multi-segment ruler: Single measurement only; no waypoint/path measurement.
- Custom token images: `MapToken.imagePath` field exists but tokens render as colored circles.
- Attack modal map-click targeting: Target selection is modal-only; no click-on-map integration.
- Drawing tools in main game toolbar: Available only in `DMMapEditor`, not during gameplay.
- Clear All Fog / Reset Explored in UI: Actions in `vision-slice.ts` exist but no buttons in game interface.
- Multi-token selection: No group select, move, or operate on multiple tokens. Box-select for multiple tokens.
- Auto-pan to active token: "Center on entity" is manual via portrait click; no auto-pan on turn advance.
- Foreground/occlusion tiles: No layer that renders above tokens with conditional fade.
- Trigger zones: No token-enter/leave events for traps, teleportation, or environmental effects.
- Token aura rings: No visual indicators for light radius, spell range, or aura effects.
- Grid coordinate display: No coordinate readout on hover.
- Token rotation: No rotation indicator or facing direction.
- Elevation line-of-sight and cover calculations: Tokens have elevation but combat is 2D only.
- Advanced Movement Visualization: No pathfinding display, no threatened area highlighting, no reach visualization.
- Cover Calculation: Walls exist but don't calculate cover bonuses.
- Map Bookmarks: No quick navigation to map areas, no named waypoints.

### Broken / Unreliable
- Multi-floor filtering: `currentFloor` in `FloorSelector.tsx` is set but never used for token visibility or layer filtering. Floors are decorative.
- `fogBrushSize`: Passed to `MapCanvas` as `_fogBrushSize` (line 88), completely ignored.
- Audio emitters: `AudioEmitterLayer` created in `audio-emitter-overlay.ts`, `updateEmitters` never called with map `audioEmitters`.
- Vision update timing: Recomputed only on mount/token changes, not on every token move during dynamic fog. Late vision for moving players.
- Combat animation listener: `onCombatAnimation` single listener: re-registering overwrites previous listener.
- Lighting unit confusion: `lighting-overlay.ts` computes `map.width * cellSize` where `map.width` may already be pixel dimensions.
- Initiative delay: UI `onDelayEntry` removes entries; `delayTurn`/`undelay` slice methods are separate and not wired to the UI.
- Initiative identity: Initiative created from map tokens loses entity identity in `src/renderer/src/components/game/dm/InitiativeSetupForm.tsx:183-194` and `src/renderer/src/components/game/dm/InitiativeTracker.tsx:175-191`.
- GameLayout limits `activeTool` to `'select' | 'fog-reveal' | 'fog-hide' | 'wall'` in `src/renderer/src/components/game/GameLayout.tsx:154-156`.
- Fog enablement: New maps default to `fogOfWar.enabled: false` in `src/renderer/src/pages/campaign-detail/MapManager.tsx:74-77`, rendering bails when fog is disabled in `src/renderer/src/components/game/map/fog-overlay.ts:105-116`.

### QoL Improvements
- Auto-pan to active token on turn change.
- Render token images when `imagePath` is set (fall back to colored circle).
- Expose "Clear All Fog" and "Reset Explored" buttons in game UI.
- Wire context menu "Apply Condition" to `QuickConditionModal`.
- Expose drawing tools in main game toolbar (not just `DMMapEditor`).
- Highlight path from initiative tracker to active token on map.
- Debounce vision recomputation (runs on any token/wall change).
- Cache pathfinding results when movement/terrain/walls haven't changed.
- Health bar color thresholds (green > 50%, yellow 25-50%, red < 25%).
- Add support for custom lineages in darkvision calculations.
- Allow Monks to use DEX for grapple/shove DCs.
- Token Snap Options: Currently always snaps to grid, no "no snap" or "half-snap" options.
- Grid Alignment Tools: No manual grid offset adjustment, no rotate/scale grid to fit map image.

### Tools to Add
- Cone/line template preview before AoE placement.
- Multi-waypoint ruler for path distance.
- Token aura/range ring visualization.
- Grid coordinate readout on hover.
- Snap feedback for wall placement (show nearby intersection snap points).
- Token rotation/facing direction indicator.
- Dedicated initiative tracker integration that auto-sorts tokens and highlights the active turn.
- Spell template placement (drag from caster), custom shapes, save templates for reuse.
- Map Builder Tools: Tile placement (dungeon tiles), stamp tool (trees, rocks, furniture), procedural map generation (dungeon, wilderness).

## AI Dungeon Master
- Provider switching: Only Ollama wired. `@anthropic-ai/sdk` and `@langchain/anthropic` in deps but not in main app flow.
- Memory sync: `updateWorldState()` / `updateCombatState()` in `memory-manager.ts` never called. Live game state not persisted to AI memory.
- Semantic RAG: TF-IDF keyword search only (`search-engine.ts`). No embeddings or vector search.
- Structured output schemas: No JSON schema for `[DM_ACTIONS]` / `[STAT_CHANGES]`. Relies on model formatting text-based tags perfectly.
- Validation loop: No check/feedback when AI action or stat change is incorrect or impossible.
- Few-shot examples: No examples in prompts for `[STAT_CHANGES]` or `[DM_ACTIONS]` formatting.
- `place_creature` action: Listed in `dm-system-prompt.ts` but missing from `DmAction` TypeScript union in `dm-actions.ts`.
- Web search fallback: Only DuckDuckGo Instant Answer API. No alternative backends, no rate limiting.
- Multi-turn tool use: FILE_READ and WEB_SEARCH have max depth 3 but no iterative reasoning between reads.
- DM personality modes: No customizable DM style (narrative-heavy, rules-focused, humorous, etc.).
- Player preference learning: No adaptive behavior based on group playstyle or feedback.
- Context injection is brittle: `ConversationManager` only appends specific rule sets (like `PLANAR_RULES_CONTEXT`) if it detects exact keywords in the immediate context.
- Forced alternating roles (`user` then `assistant`) concatenates user messages, confusing the AI's understanding of the timeline.
- JSON formatting brittleness: If it hallucinates markdown inside the JSON, parsing fails.
- Context truncation drops older messages without summary, losing nuanced campaign details.
- System prompt is ~490 lines in a single file (`dm-system-prompt.ts`). No modular loading by campaign type, setting, or context.
- No response quality scoring or automatic retry on poor output.
- Streaming buffer grows unbounded (no backpressure) in `ollama-client.ts`.
- 120s timeout on Ollama with no partial-result recovery.
- 60s safety timeout in `use-ai-dm-store.ts` calls `cancelStream()` without await. Race condition possible.
- Duplicated stream completion logic: `ai-service.ts` has its own `handleStreamCompletion` instead of importing from `ai-stream-handler.ts`.
- Vision Capabilities: Cannot analyze map screenshots or read token positions visually.
- Voice Output: No TTS for AI narration.
- Proactive DM: Currently reactive (waits for player input). Could initiate based on initiative changes, HP thresholds, time passing.
- Combat Tactics: AI can control tokens but limited tactical depth. Could use cover, flanking, opportunity attacks.
- Token Budget Warnings: Context can exceed model limits, graceful degradation could be improved.
- Model recommendation guidance: Smaller models (3B) produce poor results, no guidance in UI.
- Trustworthiness: Stat mutations bypass approval in `src/renderer/src/hooks/use-game-effects.ts:236-285` and `actingCharacterId` support exists in `src/main/ai/context-builder.ts:122-128` but is never wired through `src/main/ai/types.ts:17-24` or `src/main/ai/ai-service.ts:389-396`.

## Library / Compendium
- Missing Content / Categories: `searchAllCategories` (`library-service.ts` lines 606-632) omits: `tools`, `maps`, `shop-templates`, `portraits`, `gear`, `vehicles`, `trinkets`, `light-sources`, `sentient-items`.
- No item counts for official data on category tiles (only homebrew counts via `homebrewCounts`).
- Descriptions truncated to ~120 chars on cards with no expandable preview.
- `core-books` group has no categories in `LIBRARY_GROUPS`. Handled separately by `CoreBooksGrid`.
- Duplication: `CompendiumModal` (in-game, read-only, limited tabs) vs `LibraryPage` (full compendium + homebrew + favorites + recently viewed). Share data loaders but have separate rendering logic and different feature sets.
- Search Improvements Needed: Client-side substring match only (`.includes(query)`). No faceted filtering in global search (can't combine level + school for spells). No fuzzy/typo-tolerant matching. No search history or suggestions.
- Missing Content: Legendary Actions/Lair Actions, Monster Templates, Specific Campaign Settings, Treasure Hoard tables.
- PDF Integration Improvements: No text extraction for search, no bookmarking within PDFs, no hyperlinking from rules to PDF pages.
- Content cross-referencing: "Show me spells that work with this feat".
- Quick reference tooltips: Hover information in combat.
- Custom content sharing: Import/export homebrew between users.
- Content validation: Rule-checking for homebrew balance.
- Unify content discovery: Merge the library and in-game compendium mental model, fix invalid categories, propagate homebrew/custom creatures everywhere, and surface world lore (`src/renderer/src/pages/LibraryPage.tsx:214-222`, `src/renderer/src/services/library-service.ts:387-389,751-797`, `src/renderer/src/services/data-provider.ts:638-672`).

## GUI & UX Improvements
- GameLayout complexity: Holds 50+ pieces of state. Should extract into dedicated hooks.
- Main menu navigation: Settings and Calendar not on main menu nav. No in-app nav to Library/Bastions/Calendar from game session.
- Character creation routes: Confusing duplicates: `/characters/create` vs `/characters/5e/create`.
- Bottom bar collapse: Hides Macro Bar and Action Buttons. Players lose core gameplay access.
- Tools dropdown: Long, nested, "Tools..." label unclear. Overloaded, mixing combat, reference, and social actions.
- DM character picker: Must pick character in `CharacterPickerOverlay`. Not obvious workflow.
- Auto-rejoin: `JoinGamePage` has no loading state feedback during reconnection.
- Breadcrumbs: No breadcrumb or context indicator during gameplay.
- Typography: System font only (Segoe UI). No thematic/fantasy font option.
- Animations: Limited to toasts and dice. No page transitions, no micro-interactions.
- Scrollbars: Webkit-only styling. Firefox gets default scrollbars.
- Dark UI density: `gray-800`/`gray-900` everywhere. Possible contrast issues.
- Modal buttons: `ModalFormFooter` uses `text-[10px]`. Very small touch targets. Increase to at least `text-sm`.
- Icons: Unicode characters instead of consistent icon library (Lucide or Heroicons).
- Accessibility Gaps: Many buttons lack `aria-label`. `aria-expanded` on collapsible elements not audited. `CompendiumModal` and `LibraryDetailModal` don't use shared `Modal` component (missing focus trap, escape handling, aria attributes). No `prefers-reduced-motion` support in focus ring animation. Screen reader mode must be manually enabled in Settings.
- Over-reliance on screen-blocking modals (`GameModalDispatcher`) that take players out of the map context.
- Transition the main shell to CSS Grid/Flexbox instead of absolute positioning.
- Onboarding: No interactive tutorial, no guided first-character creation, help modal is text-heavy.
- Visual Consistency: Some components use different color schemes, dice tray styling differs from main UI.
- Mobile Responsiveness: Game UI not designed for small screens, character sheet works but cramped.
- Settings Organization: Many settings scattered across stores, no centralized settings UI.
- Confirmation Dialogs: `ConfirmDialog.tsx` exists but underutilized, destructive actions need confirmations.
- Keyboard shortcuts: More comprehensive hotkey system.
- Context menus: Right-click options throughout the interface.
- Drag & drop: Token placement, inventory management.
- Quick actions: One-click buttons for common tasks.
- Character selection: The lobby-selected character still does not determine the in-game PC; `src/renderer/src/components/lobby/LobbyLayout.tsx:20-29` sends `player:character-select`, but `src/renderer/src/pages/InGamePage.tsx:53` still picks `characters.find((c) => c.campaignId === campaignId) ?? characters[0] ?? null`.

## Ideas from Competitor Research
### From D&D Beyond
- Digital character sheets with auto-calculations and rule integration.
- Adventure module marketplace integration.
- One-click combat importing from DDB campaigns.
- Party inventory / shared loot pool.
- Content sharing (one subscriber's library shared with 12 players).
- Guided character builder with full rules enforcement and auto-calculations.
- Mobile app for character access on the go.
- Avrae Discord bot integration.
- Encounter builder with CR-based difficulty calculator (easy/medium/hard/deadly).
- Quickplay maps, integrated official content, shared sheets/game log.
- Prep speed is a first-class feature; quickplay and owned-content integration.

### From Roll20
- Macro bar/hotbar for quick spell/ability access.
- Dynamic lighting animations (torches flickering, etc.).
- Tabletop audio integration (background music playlists).
- Character art/picture integration in tokens.
- Foreground layer with conditional fade on token proximity.
- Reactive Scenes (trigger zones for traps/macros on token overlap).
- Multi-token group operations (select, lock, move, enumerate).
- Integrated map creation (Dungeon Scrawl).
- Rollable tables for random generation (in-game roller).
- Auto-center on active token during combat turns.
- Transmogrifier (cross-campaign content transfer).
- Built-in voice/video chat.
- One-way vision barriers.
- Map Pins with player/GM visibility.
- Loot Manager for instant shop/treasure generation.
- Inline dice rolls in chat messages.
- Build a Map, page folders, journal linkage.
- LFG, PUG, tutorials, streamlined onboarding.

### From Foundry VTT
- Modding ecosystem.
- Scene transitions with fade effects.
- Advanced measurement tools (ranges, templates, cones).
- Journal linking (clickable references between entries).
- 7 wall types with independent vision/movement/light/sound control.
- Scene Regions with programmable behaviors (teleport, traps, darkness, movement cost).
- Active Effects V2 (auto-modify tokens, stats, vision based on conditions/equipped items).
- Positional ambient audio with wall occlusion.
- Scene Levels for multi-floor dungeons within a single scene.
- Animated scene transitions (14 types).
- Light animation types (torch, pulse, flicker, emanation).
- ProseMirror rich text editor for journals.
- Animated tiles (video/spritesheet support).
- Sound walls (walls block sound propagation).
- Darkness sources (magical darkness zones).
- Adventure compendiums (package and distribute entire adventures as installable modules).
- Effect stacking rules and transfer effects from items.
- Importer ecosystem, module stacks, rich automation (e.g., midi-qol, DAE).

## Other Observations
- Code Organization: Several "Dead" barrel files (`constants/index.ts`, `network/index.ts`, `types/index.ts`) that should be cleaned up.
- Performance: Knip reports 110 dead-code items across the codebase.
- 4 files exceed 1000 lines: `DowntimeModal`, `SettingsPage`, `data-provider`, `CampaignDetailPage`. Candidates for splitting.
- Multiple `useEffect` hooks in `map-overlay-effects.ts` could be merged to reduce rerenders.
- Pathfinding (`pathfinder.ts`) runs on every movement state change. Should cache when movement/terrain/walls unchanged.
- Fog animation does per-cell alpha updates. Could batch by alpha bucket.
- Vision recomputation runs on any token or wall change. Should debounce.
- Tech Debt: 6+ circular dependency workarounds using `require()` or dynamic `import()` (`use-lobby-store`, `network-store/client-handlers`, `conditions-slice`, `plugin-api`, `game-action-executor`, `host-message-handlers`).
- Inconsistent error handling: some paths use `addToast`, some `console.error`, some swallow silently.
- `console.warn` in production code (`combat-resolver.ts`, `PdfViewer.tsx`) instead of project logger.
- `ai-stream-handler.ts` exists as a test module but `ai-service.ts` has its own inlined version of `handleStreamCompletion`.
- Testing: Coverage limited to `services/` and `data/`. No component test coverage. No E2E or integration tests. No network/P2P integration tests.
- Security: `host-handlers.ts` buy/sell payloads not runtime-validated. Attack surface for malicious clients. No plugin permission system. AI file reading limited but extensible.
- Documentation: No public API docs for plugin developers. No user-facing documentation, help system, or tooltips for new users. No architecture diagrams. AI prompting guide for users missing.
- PixiJS Memory: No explicit texture garbage collection seen. Frequent map switching may leak memory.
- AI Context Building: Synchronous context assembly for AI. Large campaigns may cause UI stutter.
- Data Loading: 3,000+ JSON files loaded on demand. No service worker caching. No compression of data files.
- Network: P2P has hard 2MB message limit. Large character sheets may hit this.