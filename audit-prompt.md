# Comprehensive VTT Audit Prompt

> **Instructions for the auditing agent**: Read this entire document before beginning. You are auditing a D&D 5e (2024 rules) Virtual Tabletop built with Electron + React + TypeScript. Your job is to find every bug, missing feature, rules error, UX gap, performance issue, and security vulnerability. Do NOT search the web. Use the markdown reference files in `5.5e References/` (PHB2024/, DMG2024/, MM2025/) as your source of truth for D&D rules. Output format: executive summary, then detailed per-file findings organized by section, then a prioritized actionable task list at the end. No numerical scoring.

---

## Table of Contents

1. [Core Architecture & IPC Integrity](#1-core-architecture--ipc-integrity)
2. [Spatial & Sensory Simulation](#2-spatial--sensory-simulation)
3. [D&D 2024 Rules Enforcement](#3-dd-2024-rules-enforcement)
4. [AI DM Pipeline](#4-ai-dm-pipeline)
5. [Networking & Social](#5-networking--social)
6. [Combat System](#6-combat-system)
7. [Character System](#7-character-system)
8. [Data Completeness](#8-data-completeness)
9. [Sound & Audio System](#9-sound--audio-system)
10. [Campaign Management](#10-campaign-management)
11. [Chat Commands](#11-chat-commands)
12. [UI/UX Ghost System Audit](#12-uiux-ghost-system-audit)
13. [Security](#13-security)
14. [Performance](#14-performance)
15. [Deployment & CI/CD](#15-deployment--cicd)
16. [BMO Infrastructure](#16-bmo-infrastructure)
17. [State Persistence](#17-state-persistence)
18. [Test Coverage & TypeScript Integrity](#18-test-coverage--typescript-integrity)
19. [Competitor Feature Matrix](#19-competitor-feature-matrix)

---

## 1. Core Architecture & IPC Integrity

### Scope
Trace every IPC channel from renderer to main and back. Verify that every channel defined in the shared constants file has a matching handler registration, a matching preload bridge method, and a matching TypeScript type declaration. Flag orphaned handlers, missing preload bindings, and type mismatches.

### Files to Audit

**Shared channel definitions:**
- `src/shared/ipc-channels.ts` — All channel string constants (single source of truth)

**Main process handler registration:**
- `src/main/ipc/index.ts` — Master handler registrar (directly implements storage/dialog/file/window/settings, delegates to sub-registrars)
- `src/main/ipc/ai-handlers.ts` — AI DM handlers (called via `registerAiHandlers()`)
- `src/main/ipc/audio-handlers.ts` — Audio handlers (called via `registerAudioHandlers()`)
- `src/main/ipc/game-data-handlers.ts` — Game data JSON loader (called via `registerGameDataHandlers()`)
- `src/main/ipc/storage-handlers.ts` — **Suspected dead file**: exports `registerStorageHandlers()` but never called; duplicates handlers in `index.ts`

**Preload bridge:**
- `src/preload/index.ts` — `contextBridge.exposeInMainWorld` bindings
- `src/preload/index.d.ts` — TypeScript declarations for `window.api`

**Main process entry:**
- `src/main/index.ts` — Window creation, handler registration calls

**Updater:**
- `src/main/updater.ts` — Registers `app:version`, `update:check`, `update:download`, `update:install`; emits `update:status` push

### Known IPC Channel Inventory (~80 channels)

**Storage channels (34):**
- Characters: `storage:save-character`, `storage:load-character`, `storage:load-characters`, `storage:delete-character`, `storage:character-versions`, `storage:character-restore-version`
- Campaigns: `storage:save-campaign`, `storage:load-campaign`, `storage:load-campaigns`, `storage:delete-campaign`
- Bastions: `storage:save-bastion`, `storage:load-bastion`, `storage:load-bastions`, `storage:delete-bastion`
- Custom creatures: `storage:save-custom-creature`, `storage:load-custom-creature`, `storage:load-custom-creatures`, `storage:delete-custom-creature`
- Homebrew: `storage:save-homebrew`, `storage:load-homebrew-by-category`, `storage:load-all-homebrew`, `storage:delete-homebrew`
- Game state: `storage:save-game-state`, `storage:load-game-state`, `storage:delete-game-state`
- Bans: `storage:load-bans`, `storage:save-bans`
- Settings: `storage:save-settings`, `storage:load-settings`

**Dialog/File channels (4):**
- `dialog:show-save`, `dialog:show-open`
- `fs:read-file`, `fs:write-file`

**Window channels (3):**
- `window:toggle-fullscreen`, `window:is-fullscreen`, `window:open-devtools`

**Audio channels (5):**
- `audio:upload-custom`, `audio:list-custom`, `audio:delete-custom`, `audio:get-custom-path`, `audio:pick-file`

**Game data (1 multiplexed):**
- `game:load-json` — Single channel with 60+ typed convenience wrappers on `window.api.game`

**AI DM channels (30+):**
- Config: `ai:configure`, `ai:get-config`, `ai:check-providers`
- Index: `ai:build-index`, `ai:load-index`, `ai:get-chunk-count`
- Streaming: `ai:chat-stream`, `ai:cancel-stream`, `ai:apply-mutations`, `ai:web-search-approve`
- Scene: `ai:prepare-scene`, `ai:get-scene-status`
- Connection: `ai:connection-status` (**known issue: no preload binding**)
- Token budget: `ai:token-budget`, `ai:token-budget-preview`
- Conversations: `ai:save-conversation`, `ai:load-conversation`, `ai:delete-conversation`
- Memory: `ai:list-memory-files`, `ai:read-memory-file`, `ai:clear-memory`
- Ollama: `ai:detect-ollama`, `ai:get-vram`, `ai:download-ollama`, `ai:install-ollama`, `ai:start-ollama`, `ai:pull-model`, `ai:get-curated-models`, `ai:list-installed-models`, `ai:list-installed-models-detailed`, `ai:ollama-check-update`, `ai:ollama-update`, `ai:delete-model`
- Push events (main→renderer): `ai:stream-chunk`, `ai:stream-done`, `ai:stream-error`, `ai:index-progress`, `ai:ollama-progress`, `ai:stream-file-read`, `ai:stream-web-search`

**Update channels (5):**
- `app:version`, `update:check`, `update:download`, `update:install`, `update:status` (push)

### Specific Checks

1. For every constant in `ipc-channels.ts`, verify a handler exists in `src/main/ipc/` AND a preload binding exists in `src/preload/index.ts`
2. Flag `ai:connection-status` — handler registered but no preload binding
3. Flag `src/main/ipc/storage-handlers.ts` — dead file duplicating `index.ts` handlers
4. Flag `src/main/ai/prompt-sections/world-rules.ts` — registers 11 raw `ipcMain.handle` calls using non-constant string literals (`game:loadSpells`, `game:loadMonsters`, etc.) that conflict with `game:load-json` pattern
5. Verify all `ipcRenderer.on` listeners in preload have corresponding `webContents.send` calls in main
6. Check for channel string typos (compare constants vs raw strings)
7. Verify `StorageResult<T>` return type consistency across all storage handlers
8. Check that `fs:read-file` and `fs:write-file` have proper path whitelisting

---

## 2. Spatial & Sensory Simulation

### Scope
Audit the PixiJS map rendering pipeline and Three.js dice physics. Verify lighting, fog of war, vision computation, weather overlays, token rendering, wall occlusion, and 3D dice correctness.

### Files to Audit

**Map canvas & overlays (15 files):**
- `src/renderer/src/components/game/map/MapCanvas.tsx` — Main PixiJS canvas orchestrator
- `src/renderer/src/components/game/map/fog-overlay.ts` — Fog of war rendering
- `src/renderer/src/components/game/map/lighting-overlay.ts` — Dynamic lighting
- `src/renderer/src/components/game/map/weather-overlay.ts` — Weather visual effects
- `src/renderer/src/components/game/map/grid-layer.ts` — Grid rendering (square/hex)
- `src/renderer/src/components/game/map/wall-layer.ts` — Wall/door segments
- `src/renderer/src/components/game/map/token-sprite.ts` — Token rendering
- `src/renderer/src/components/game/map/aoe-overlay.ts` — Area of Effect templates
- `src/renderer/src/components/game/map/audio-emitter-overlay.ts` — Positional audio markers
- `src/renderer/src/components/game/map/combat-animations.ts` — Attack/spell visual effects
- `src/renderer/src/components/game/map/map-overlay-effects.ts` — Environmental visual effects
- `src/renderer/src/components/game/map/map-event-handlers.ts` — Mouse/touch interaction
- `src/renderer/src/components/game/map/map-pixi-setup.ts` — PixiJS initialization
- `src/renderer/src/components/game/map/measurement-tool.ts` — Distance measurement
- `src/renderer/src/components/game/map/movement-overlay.ts` — Movement path display
- `src/renderer/src/components/game/map/FloorSelector.tsx` — Multi-floor map support

**Vision & pathfinding (6 files):**
- `src/renderer/src/services/map/vision-computation.ts` — Raycasting vision
- `src/renderer/src/services/map/vision-computation.test.ts`
- `src/renderer/src/services/map/raycast-visibility.ts` — Line-of-sight checks
- `src/renderer/src/services/map/pathfinder.ts` — A* pathfinding
- `src/renderer/src/services/map/pathfinder.test.ts`
- `src/renderer/src/services/map/map-utils.ts` — Grid math utilities

**3D dice (12 files):**
- `src/renderer/src/components/game/dice3d/DiceRoller.tsx` — Dice rolling UI
- `src/renderer/src/components/game/dice3d/DiceRenderer.tsx` — Three.js scene
- `src/renderer/src/components/game/dice3d/DiceOverlay.tsx` — Overlay container
- `src/renderer/src/components/game/dice3d/DiceResult.tsx` — Result display
- `src/renderer/src/components/game/dice3d/DiceHistory.tsx` — Roll history
- `src/renderer/src/components/game/dice3d/DiceTray.tsx` — Dice tray UI
- `src/renderer/src/components/game/dice3d/DiceColorPicker.tsx` — Color customization
- `src/renderer/src/components/game/dice3d/dice-meshes.ts` — Three.js geometry
- `src/renderer/src/components/game/dice3d/dice-physics.ts` — cannon-es physics
- `src/renderer/src/components/game/dice3d/dice-textures.ts` — Texture generation
- `src/renderer/src/components/game/dice3d/dice-generators.ts` — Dice shape generators
- `src/renderer/src/components/game/dice3d/dice-types.ts` — Type definitions
- `src/renderer/src/components/game/dice3d/index.ts` — Barrel export

**Game store vision/fog slices:**
- `src/renderer/src/stores/game/fog-slice.ts`
- `src/renderer/src/stores/game/vision-slice.ts`

### Specific Checks

1. **GLSL shaders**: Does the lighting overlay use custom WebGL shaders, or is it purely PixiJS filters? If GLSL exists, audit for correctness
2. **Vision modes**: Does the system support darkvision (60ft, 120ft), blindsight, tremorsense, truesight, and Devil's Sight? Verify ranges match PHB 2024
3. **Fog of war**: Is there both "explored" (grey) and "unexplored" (black) fog? Can the DM reveal/hide fog per-token?
4. **Wall occlusion**: Do walls properly block vision raycasts? Do doors toggle between blocking and non-blocking?
5. **Weather overlay**: Does weather affect visibility (heavy rain = lightly obscured, blizzard = heavily obscured per DMG 2024)?
6. **Token sizes**: Does `token-sprite.ts` support Tiny/Small/Medium/Large/Huge/Gargantuan (1/4, 1, 1, 2, 3, 4 squares)?
7. **Elevation**: Does the map support elevation differences (flying, multi-floor buildings)?
8. **3D dice sync**: Are dice roll results synced over P2P, or only the visual? Verify physics determinism or result-first approach
9. **Hex grid**: Does the grid layer support hex grids in addition to square grids?
10. **Measurement tool**: Does it account for diagonal movement (5e variant: 5-10-5 or equal distance)?
11. **AoE templates**: Sphere, cone, cube, cylinder, line — verify all 5 shapes match PHB 2024 specifications
12. **Cover calculation**: Does `cover-calculator.ts` (in combat services) integrate with wall positions on the map?

---

## 3. D&D 2024 Rules Enforcement

### Scope
Verify that the application implements 2024 PHB/DMG/MM rules correctly. Cross-reference against `5.5e References/PHB2024/`, `5.5e References/DMG2024/`, and `5.5e References/MM2025/`.

### Files to Audit

**Stat calculation:**
- `src/renderer/src/services/character/stat-calculator-5e.ts` — Core stat computation
- `src/renderer/src/services/character/stat-calculator-5e.test.ts`
- `src/renderer/src/services/character/stat-calculator-5e-encumbrance.test.ts`
- `src/renderer/src/services/character/armor-class-calculator.ts` — AC computation

**Build tree & feat mechanics:**
- `src/renderer/src/services/character/build-tree-5e.ts` — Character build progression
- `src/renderer/src/services/character/build-tree-5e.test.ts`
- `src/renderer/src/services/character/feat-mechanics-5e.ts` — Feat prerequisites and effects
- `src/renderer/src/services/character/auto-populate-5e.ts` — Auto-fill character details

**Rest mechanics:**
- `src/renderer/src/services/character/rest-service-5e.ts` — Short/long rest recovery
- `src/renderer/src/services/character/rest-service-5e.test.ts`

**Spell system:**
- `src/renderer/src/services/character/spell-data.ts` — Spell data loading
- `src/renderer/src/services/character/spell-data.test.ts`
- `src/renderer/src/services/character/spell-preparation-analyzer.ts` — Spell prep optimization
- `src/renderer/src/services/character/spell-preparation-analyzer.test.ts`
- `src/renderer/src/services/combat/spell-slot-manager.ts` — Slot tracking

**Multiclass:**
- `src/renderer/src/services/character/multiclass-advisor.ts` — Multiclass prereqs and recommendations
- `src/renderer/src/services/character/multiclass-advisor.test.ts`
- `src/renderer/src/data/multiclass-prerequisites.ts`

**Companions:**
- `src/renderer/src/services/character/companion-service.ts` — Beast companion, familiar, etc.

**Equipment:**
- `src/renderer/src/services/character/equipment-utilities.ts` — Equipment weight, properties
- `src/renderer/src/hooks/use-equipment-data.ts` — Equipment data hook

**Effect/condition system:**
- `src/renderer/src/services/combat/effect-resolver-5e.ts` — Condition effects on gameplay
- `src/renderer/src/services/combat/condition-extractor.ts` — Parse conditions from descriptions
- `src/renderer/src/services/combat/attack-condition-effects.ts` — Conditions affecting attacks

**Class/species data:**
- `src/renderer/src/data/class-resources.ts` — Class resource tables
- `src/renderer/src/data/species-resources.ts` — Species ability tables

### Specific Checks

1. **Weapon mastery**: Does the system implement Cleave, Graze, Nick, Push, Sap, Slow, Topple, and Vex? Verify each mastery effect matches PHB 2024
2. **Exhaustion 2024**: Is exhaustion a cumulative -2 penalty (not the old 6-level table)? Verify 10 levels = death
3. **Origin feats**: Does every background grant a 1st-level Origin feat? Verify the 10 origin feats match PHB 2024
4. **Spell slot recovery**: Wizards recover slots on long rest. Warlocks use Pact Magic (short rest recovery). Verify multiclass spell slot calculation uses the 2024 table
5. **Hit Dice on short rest**: Players can spend Hit Dice on short rest. Recover half (round down, min 1) on long rest. Verify
6. **Crafting**: Does the crafting system (sheet components) implement the 2024 crafting rules from DMG?
7. **Species traits**: Verify all species from PHB 2024: Aasimar, Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling. Check trait accuracy
8. **Class features by level**: For each of the 12 classes, verify feature progression matches PHB 2024. Check all 48 subclasses
9. **Multiclass prerequisites**: Verify ability score requirements match PHB 2024 table
10. **Conditions**: Verify all 15 conditions match PHB 2024 definitions (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious)
11. **Death saves**: 3 successes = stabilize, 3 failures = death. Natural 20 = regain 1 HP. Verify
12. **Concentration**: Only one concentration spell at a time. Taking damage requires CON save (DC = max(10, half damage)). Verify

---

## 4. AI DM Pipeline

### Scope
Full audit of the AI DM system: prompt construction, context compression, streaming, response parsing, stat mutations, memory, conversation persistence, Ollama management, and web search integration.

### Files to Audit (31 files)

**Core service:**
- `src/main/ai/ai-service.ts` — Main AI DM service orchestrator
- `src/main/ai/types.ts` — AI type definitions

**Prompt construction:**
- `src/main/ai/dm-system-prompt.ts` — DM system prompt template
- `src/main/ai/prompt-sections/character-rules.ts` — Character rules section
- `src/main/ai/prompt-sections/combat-rules.ts` — Combat rules section
- `src/main/ai/prompt-sections/world-rules.ts` — World rules section (**also contains rogue IPC handlers**)

**Context building:**
- `src/main/ai/context-builder.ts` — Assembles full context for AI
- `src/main/ai/context-builder.test.ts`
- `src/main/ai/campaign-context.ts` — Campaign state serialization
- `src/main/ai/character-context.ts` — Character state serialization

**Token management:**
- `src/main/ai/token-budget.ts` — Token budget allocation
- `src/main/ai/token-budget.test.ts`

**Streaming & parsing:**
- `src/main/ai/ai-stream-handler.ts` — SSE stream processing
- `src/main/ai/ai-response-parser.ts` — Parse AI responses for actions
- `src/main/ai/chunk-builder.ts` — Chunk assembly for streaming

**Stat mutations:**
- `src/main/ai/stat-mutations.ts` — AI-driven character stat changes

**Memory & conversation:**
- `src/main/ai/memory-manager.ts` — Long-term memory file management
- `src/main/ai/conversation-manager.ts` — Conversation history management

**Knowledge retrieval:**
- `src/main/ai/srd-provider.ts` — SRD content provider
- `src/main/ai/search-engine.ts` — Semantic search over game data
- `src/main/ai/keyword-extractor.ts` — Extract keywords for search
- `src/main/ai/dnd-terms.ts` — D&D terminology dictionary
- `src/main/ai/file-reader.ts` — Read game data files for context
- `src/main/ai/file-reader.test.ts`
- `src/main/ai/web-search.ts` — External web search integration

**DM actions:**
- `src/main/ai/dm-actions.ts` — Actions the AI DM can take (spawn monster, modify map, etc.)

**Tone & moderation:**
- `src/main/ai/tone-validator.ts` — Validate AI response tone
- `src/main/ai/tone-validator.test.ts`

**Ollama management:**
- `src/main/ai/ollama-client.ts` — Ollama HTTP client
- `src/main/ai/ollama-manager.ts` — Ollama lifecycle management

**Renderer-side AI:**
- `src/renderer/src/stores/use-ai-dm-store.ts` — AI DM Zustand store
- `src/renderer/src/services/ai-renderer-actions.ts` — Execute AI actions in renderer
- `src/renderer/src/components/ui/OllamaManagement.tsx` — Ollama UI
- `src/renderer/src/components/ui/OllamaModelList.tsx` — Model list UI
- `src/renderer/src/components/game/bottom/AiContextPanel.tsx` — AI context display
- `src/renderer/src/data/moderation.ts` — Content moderation rules

**AI IPC handlers:**
- `src/main/ipc/ai-handlers.ts` — All AI-related IPC handler registrations

### Specific Checks

1. **Prompt injection**: Can a player craft a chat message that escapes the DM system prompt? Check for prompt boundary markers
2. **Token budget**: Does the token budget correctly account for system prompt + context + conversation history? What happens when it overflows?
3. **Context compression**: When conversation history exceeds the budget, how is it compressed? Is important game state preserved?
4. **Streaming error recovery**: If a stream fails mid-response, does the UI show a partial response or retry? Check `ai:stream-error` handling
5. **Stat mutation validation**: Does `stat-mutations.ts` validate AI-proposed changes before applying? Can the AI set HP to negative or give invalid items?
6. **Memory files**: What format are memory files? Are they human-readable? Can they be corrupted?
7. **Ollama model compatibility**: Does the manager handle models that don't support the expected prompt format?
8. **Web search approval flow**: The `ai:web-search-approve` channel suggests user approval is required — verify the full flow works
9. **Rate limiting**: Is there any rate limiting on AI requests? What prevents a player from spamming the AI?
10. **Multi-provider support**: Claude API + Ollama fallback — verify the failover logic

---

## 5. Networking & Social

### Scope
Audit the PeerJS WebRTC P2P networking stack. Verify message validation, state synchronization, reconnection, voice chat, and social features.

### Files to Audit (14 network files + stores)

**Network core:**
- `src/renderer/src/network/index.ts` — Barrel export
- `src/renderer/src/network/peer-manager.ts` — PeerJS connection management
- `src/renderer/src/network/host-manager.ts` — DM host connection handling
- `src/renderer/src/network/client-manager.ts` — Player client connection handling
- `src/renderer/src/network/host-connection.ts` — Host connection lifecycle
- `src/renderer/src/network/message-handler.ts` — Message routing
- `src/renderer/src/network/host-message-handlers.ts` — Host-side message processing
- `src/renderer/src/network/host-state-sync.ts` — State sync from host to clients
- `src/renderer/src/network/game-sync.ts` — Game state synchronization

**Message types & validation:**
- `src/renderer/src/network/message-types.ts` — 50+ message type definitions
- `src/renderer/src/network/types.ts` — Network type definitions
- `src/renderer/src/network/state-types.ts` — Synchronized state types
- `src/renderer/src/network/schemas.ts` — Zod schemas for message validation
- `src/renderer/src/network/schemas.test.ts`

**Network stores:**
- `src/renderer/src/stores/network-store/index.ts` — Network Zustand store
- `src/renderer/src/stores/network-store/host-handlers.ts` — Store-level host handlers
- `src/renderer/src/stores/network-store/client-handlers.ts` — Store-level client handlers
- `src/renderer/src/stores/network-store/types.ts` — Network store types

**Lobby:**
- `src/renderer/src/stores/use-lobby-store.ts` — Lobby state
- `src/renderer/src/components/lobby/LobbyLayout.tsx` — Lobby UI
- `src/renderer/src/components/lobby/PlayerCard.tsx` — Player display
- `src/renderer/src/components/lobby/PlayerList.tsx` — Player list
- `src/renderer/src/components/lobby/ChatPanel.tsx` — Lobby chat
- `src/renderer/src/components/lobby/ChatInput.tsx` — Chat input
- `src/renderer/src/components/lobby/CharacterSelector.tsx` — Character picker
- `src/renderer/src/components/lobby/ReadyButton.tsx` — Ready toggle
- `src/renderer/src/components/lobby/DiscordLink.tsx` — Discord integration
- `src/renderer/src/pages/LobbyPage.tsx`
- `src/renderer/src/pages/lobby/use-lobby-bridges.ts`

### Specific Checks

1. **Discord Rich Presence**: Does `DiscordLink.tsx` integrate with Discord's RPC? Or is it just a link display? Check for `discord-rpc` or `@xhayper/discord-rpc` imports
2. **JSON patching**: Is game state synced via full snapshots or JSON patches (RFC 6902)? If patches, verify correctness of diff/apply
3. **Message validation**: Are all incoming P2P messages validated with Zod schemas before processing? Check for messages that bypass validation
4. **Reconnection**: What happens when a player disconnects and reconnects? Is game state restored? Check exponential backoff
5. **Host migration**: If the DM disconnects, can another player become host? Or does the game end?
6. **Bandwidth**: What is the message frequency? Are large payloads (map images, token sprites) chunked?
7. **Player bans**: Does the ban system (`storage:load-bans`, `storage:save-bans`) persist across sessions?
8. **Voice chat**: Is there voice chat integration? Check for LiveKit, WebRTC audio, or similar
9. **Reaction pause**: When a creature takes an action that could trigger reactions (opportunity attacks, Shield, Counterspell), does the system pause for player input?
10. **Dice result integrity**: Can a malicious client send fake dice results? Verify that dice results are validated or rolled host-side
11. **Chat message sanitization**: Are chat messages sanitized for XSS before rendering?
12. **Concurrent modification**: What happens if two players modify the same entity simultaneously?

---

## 6. Combat System

### Scope
Full audit of the combat engine: attack resolution, damage calculation, effects, conditions, initiative, legendary actions, AoE, flanking, cover, death mechanics, grapple/shove, and unarmed strikes.

### Files to Audit (34 files in `src/renderer/src/services/combat/`)

**Attack pipeline:**
- `attack-resolver.ts` + `attack-resolver.test.ts` — Core attack resolution
- `attack-types.ts` — Attack type definitions
- `attack-modifiers.test.ts` — Modifier calculation tests
- `attack-condition-effects.ts` — How conditions affect attacks
- `attack-helpers.ts` — Attack utility functions
- `attack-formatter.ts` — Format attack results for display

**Damage pipeline:**
- `damage-resolver.ts` + `damage-resolver.test.ts` — Damage calculation with resistance/vulnerability/immunity
- `combat-resolver.ts` + `combat-resolver.test.ts` — Full combat turn resolution
- `critical-hits.test.ts` — Critical hit damage
- `crit-range.ts` + `crit-range.test.ts` — Critical hit range (Champion, Hexblade, etc.)

**Conditions & effects:**
- `condition-extractor.ts` + `condition-extractor.test.ts` — Parse conditions
- `effect-resolver-5e.ts` + `effect-resolver-5e.test.ts` — Apply 5e effects
- `combat-rules.ts` + `combat-rules.test.ts` — Core combat rules

**Spatial combat:**
- `flanking.ts` + `flanking.test.ts` — Flanking detection
- `cover-calculator.ts` + `cover-calculator.test.ts` — Cover calculation (half/three-quarters/full)
- `aoe-targeting.ts` + `aoe-targeting.test.ts` — Area of Effect targeting

**Special mechanics:**
- `legendary-actions.ts` — Legendary action tracking
- `reaction-tracker.ts` — Reaction usage per round
- `multi-attack-tracker.ts` — Multi-attack sequences
- `spell-slot-manager.ts` — Spell slot usage
- `death-mechanics.ts` — Death saves, instant death, massive damage
- `grapple-shove-resolver.ts` — Grapple and shove contests
- `unarmed-strike-resolver.ts` — Unarmed strike resolution
- `combat-log.ts` — Combat event logging

**Combat UI components:**
- `src/renderer/src/components/game/modals/combat/AttackModal.tsx` — Attack wizard
- `src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx` — Step navigation
- `src/renderer/src/components/game/modals/combat/WeaponSelectionStep.tsx` — Weapon picker
- `src/renderer/src/components/game/modals/combat/TargetSelectionStep.tsx` — Target picker
- `src/renderer/src/components/game/modals/combat/AttackRollStep.tsx` — Roll display
- `src/renderer/src/components/game/modals/combat/DamageResultStep.tsx` — Damage display
- `src/renderer/src/components/game/modals/combat/AttackResultStep.tsx` — Final result
- `src/renderer/src/components/game/modals/combat/attack-handlers.ts` — Attack event handlers
- `src/renderer/src/components/game/modals/combat/attack-computations.ts` — Pre-computation
- `src/renderer/src/components/game/modals/combat/attack-utils.ts` — Utilities
- `src/renderer/src/components/game/modals/combat/ActionModal.tsx` — Action selection
- `src/renderer/src/components/game/modals/combat/InitiativeModal.tsx` — Initiative setup
- `src/renderer/src/components/game/modals/combat/GroupRollModal.tsx` — Group checks/saves
- `src/renderer/src/components/game/modals/combat/QuickConditionModal.tsx` — Quick condition apply
- `src/renderer/src/components/game/modals/combat/CustomEffectModal.tsx` — Custom effect creation
- `src/renderer/src/components/game/modals/combat/FallingDamageModal.tsx` — Falling damage
- `src/renderer/src/components/game/modals/combat/JumpModal.tsx` — Jump distance
- `src/renderer/src/components/game/modals/combat/MobCalculatorModal.tsx` — Mob attack rules
- `src/renderer/src/components/game/modals/combat/HiddenDiceModal.tsx` — DM hidden rolls
- `src/renderer/src/components/game/modals/combat/ChaseTrackerModal.tsx` — Chase sequences
- `src/renderer/src/components/game/modals/combat/ChaseControls.tsx`
- `src/renderer/src/components/game/modals/combat/ChaseMap.tsx`

**Initiative system:**
- `src/renderer/src/stores/game/initiative-slice.ts`
- `src/renderer/src/components/game/dm/InitiativeTracker.tsx`
- `src/renderer/src/components/game/dm/InitiativeEntry.tsx`
- `src/renderer/src/components/game/dm/InitiativeControls.tsx`
- `src/renderer/src/components/game/dm/InitiativeSetupForm.tsx`

**Game actions:**
- `src/renderer/src/services/game-actions/token-actions.ts` — Token manipulation
- `src/renderer/src/services/game-actions/creature-conditions.ts` — Apply/remove conditions
- `src/renderer/src/services/game-actions/creature-initiative.ts` — Initiative management

**Condition/effect stores:**
- `src/renderer/src/stores/game/conditions-slice.ts`
- `src/renderer/src/stores/game/effects-slice.ts`
- `src/renderer/src/stores/game/combat-log-slice.ts`

### Specific Checks

1. **Attack roll**: d20 + ability mod + proficiency bonus (if proficient). Verify the formula in `attack-resolver.ts`
2. **Advantage/disadvantage**: Roll 2d20 take highest/lowest. They cancel each other out. Verify stacking rules
3. **Critical hits**: Natural 20 = double damage dice. Verify 2024 rules (no extra modifier, just dice)
4. **Resistance/vulnerability/immunity**: Resistance = half damage (round down). Immunity = 0. Vulnerability = double. Verify stacking (multiple resistances don't stack)
5. **Flanking (optional rule)**: Two allies on opposite sides = advantage. Verify geometry calculation
6. **Cover**: Half (+2 AC), Three-quarters (+5 AC), Full (untargetable). Verify integration with wall positions
7. **Opportunity attacks**: Moving out of reach provokes. Verify the trigger conditions
8. **Grapple/shove**: Athletics vs Athletics/Acrobatics. Verify 2024 rules (contested check, not save)
9. **Death saves**: Verify massive damage instant kill (damage >= max HP in one hit)
10. **Initiative**: Dexterity check (d20 + DEX mod). Verify tie-breaking rules
11. **Concentration saves**: DC = max(10, half damage taken). Verify
12. **Two-weapon fighting**: Light weapon in each hand. Bonus action attack. No ability mod to damage (unless Fighting Style). Verify 2024 changes

---

## 7. Character System

### Scope
Audit the character builder, character sheet, level-up flow, and all character management UIs.

### Files to Audit

**Builder (17 files in `src/renderer/src/components/builder/5e/`):**
- `CharacterBuilder5e.tsx` — Main builder orchestrator
- `ContentTabs5e.tsx` — Tab navigation
- `MainContentArea5e.tsx` — Content display
- `CharacterSummaryBar5e.tsx` — Summary bar
- `DetailsTab5e.tsx` — Name, appearance, personality
- `SpellsTab5e.tsx` — Spell selection
- `SpellPicker5e.tsx` — Spell picker modal
- `SpellSummary5e.tsx` — Spell summary display
- `CantripPicker5e.tsx` — Cantrip selection
- `GearTab5e.tsx` — Equipment selection
- `gear-tab-types.ts` — Gear tab types
- `EquipmentShop5e.tsx` — Equipment store
- `HigherLevelEquipment5e.tsx` — Higher-level starting gear
- `LanguagesTab5e.tsx` — Language selection
- `AppearanceEditor5e.tsx` — Appearance customization
- `BackstoryEditor5e.tsx` — Backstory editor
- `PersonalityEditor5e.tsx` — Personality traits

**Builder shared (12 files in `src/renderer/src/components/builder/shared/`):**
- `BuildSidebar.tsx` — Build slot sidebar
- `BuildLevelGroup.tsx` — Level group display
- `BuildSlotItem.tsx` — Individual build slot
- `SelectionModal.tsx` — Generic selection modal
- `SelectionFilterBar.tsx` — Filter bar
- `SelectionOptionList.tsx` — Option list
- `SelectionDetailPanel.tsx` — Detail panel
- `AbilityScoreModal.tsx` — Ability score assignment
- `AsiModal.tsx` — Ability Score Improvement
- `SectionBanner.tsx` — Section headers
- `IconPicker.tsx` — Icon selection
- `SkillsModal.tsx` — Skill proficiency selection

**Builder store (12 files):**
- `src/renderer/src/stores/builder/index.ts`
- `src/renderer/src/stores/builder/types.ts`
- `src/renderer/src/stores/builder/slices/core-slice.ts`
- `src/renderer/src/stores/builder/slices/selection-slice.ts`
- `src/renderer/src/stores/builder/slices/ability-score-slice.ts`
- `src/renderer/src/stores/builder/slices/character-details-slice.ts`
- `src/renderer/src/stores/builder/slices/character-species-helpers.ts`
- `src/renderer/src/stores/builder/slices/build-actions-slice.ts`
- `src/renderer/src/stores/builder/slices/build-character-5e.ts`
- `src/renderer/src/stores/builder/slices/load-character-5e.ts`
- `src/renderer/src/stores/builder/slices/save-slice.ts`
- `src/renderer/src/stores/builder/slices/save-slice-5e.ts`

**Character sheet (48+ files in `src/renderer/src/components/sheet/5e/`):**
- `SheetHeader5e.tsx`, `AbilityScoresGrid5e.tsx`, `SkillsSection5e.tsx`, `SavingThrowsSection5e.tsx`
- `CombatStatsBar5e.tsx`, `HitPointsBar5e.tsx`, `DeathSaves5e.tsx`
- `OffenseSection5e.tsx`, `DefenseSection5e.tsx`, `WeaponList5e.tsx`, `ArmorManager5e.tsx`
- `SpellCastingSection5e.tsx`, `SpellList5e.tsx`, `SpellSlotGrid5e.tsx`, `SpellSlotTracker5e.tsx`, `SpellPrepOptimizer.tsx`
- `EquipmentSection5e.tsx`, `EquipmentListPanel5e.tsx`, `MagicItemsPanel5e.tsx`, `MagicItemCard5e.tsx`
- `AttunementTracker5e.tsx`, `CoinBadge5e.tsx`, `ResistancePanel5e.tsx`
- `FeaturesSection5e.tsx`, `FeatureCard5e.tsx`, `FeatureFilter5e.tsx`
- `ClassResourcesSection5e.tsx`, `ConditionsSection5e.tsx`, `CompanionsSection5e.tsx`
- `ToolProficiencies5e.tsx`, `BackgroundPanel5e.tsx`, `CharacterTraitsPanel5e.tsx`
- `CraftingSection5e.tsx`, `CraftingProgress5e.tsx`, `CraftingRecipeList5e.tsx`
- `NotesSection5e.tsx`, `TraitEditor5e.tsx`, `ProficiencyIndicator5e.tsx`
- `HighElfCantripSwapModal5e.tsx`, `ShortRestModal5e.tsx`
- `MulticlassAdvisor.tsx` — Multiclass recommendation engine
- `defense-utils.ts`, `equipment-utils.ts`

**Print sheet (4 files in `src/renderer/src/components/sheet/shared/`):**
- `PrintSheet.tsx`, `PrintSheetHeader.tsx`, `PrintSheetSpells.tsx`, `PrintSheetStats.tsx`
- `SheetSectionWrapper.tsx`

**Level-up store (7 files):**
- `src/renderer/src/stores/level-up/index.ts`
- `src/renderer/src/stores/level-up/types.ts`
- `src/renderer/src/stores/level-up/hp-slice.ts`
- `src/renderer/src/stores/level-up/feature-selection-slice.ts`
- `src/renderer/src/stores/level-up/spell-slot-slice.ts`
- `src/renderer/src/stores/level-up/level-up-spells.ts`
- `src/renderer/src/stores/level-up/apply-level-up.ts`

**Level-up UI:**
- `src/renderer/src/components/levelup/5e/SpellSelectionSection5e.tsx`

**Character I/O:**
- `src/renderer/src/services/io/character-io.ts` + `character-io.test.ts`
- `src/renderer/src/services/io/import-export.ts` — Import/export characters
- `src/renderer/src/services/io/import-dnd-beyond.ts` — D&D Beyond import
- `src/renderer/src/services/io/entity-io.ts` — Generic entity I/O

**Character stores:**
- `src/renderer/src/stores/use-character-store.ts`
- `src/renderer/src/stores/use-builder-store.ts`

**Character types:**
- `src/renderer/src/types/character-5e.ts` — Full character model
- `src/renderer/src/types/character-common.ts` — Common character types
- `src/renderer/src/types/character.ts` — Union type
- `src/renderer/src/types/builder.ts` — Builder types
- `src/renderer/src/types/companion.ts` — Companion types

### Specific Checks

1. **D&D Beyond import**: Does `import-dnd-beyond.ts` correctly parse D&D Beyond JSON exports? What fields are lost in translation?
2. **Build order enforcement**: Does the builder enforce the correct order: species → background → class → ability scores → equipment?
3. **Multiclass prerequisites**: Are minimum ability scores enforced for multiclassing (e.g., 13 STR/DEX for Fighter)?
4. **Level-up spell selection**: When leveling up a prepared caster (Cleric, Druid), can they swap prepared spells? When leveling up a known caster (Sorcerer, Bard), can they learn/replace spells?
5. **HP on level-up**: Roll or take average? Verify CON modifier is added correctly
6. **Print sheet**: Does `PrintSheet.tsx` generate a printable character sheet? Is it connected to any UI?
7. **Attunement limit**: Maximum 3 attuned items. Does the tracker enforce this?
8. **Encumbrance**: Optional encumbrance rules — STR x 15 lbs carrying capacity. Verify
9. **Auto-save**: Does the character auto-save? What triggers a save?
10. **Version history**: `storage:character-versions` exists — verify version diffing/restore works

---

## 8. Data Completeness

### Scope
Cross-reference the 3,000+ JSON data files against the PHB 2024, DMG 2024, and MM 2025. Identify missing entries, incorrect values, and schema inconsistencies.

### Files to Audit

**Data loading infrastructure:**
- `src/renderer/src/services/data-provider.ts` + `data-provider.test.ts` — Cached data loader
- `src/renderer/src/services/data-paths.ts` — Data file path registry
- `src/renderer/src/stores/use-data-store.ts` — Data Zustand store
- `src/main/ipc/game-data-handlers.ts` — JSON file reader
- `src/renderer/src/services/json-schema.test.ts` — Schema validation tests
- `src/renderer/src/services/equipment-schema.test.ts` — Equipment schema tests

**Data type definitions:**
- `src/renderer/src/types/data/character-data-types.ts`
- `src/renderer/src/types/data/creature-data-types.ts`
- `src/renderer/src/types/data/equipment-data-types.ts`
- `src/renderer/src/types/data/spell-data-types.ts`
- `src/renderer/src/types/data/world-data-types.ts`
- `src/renderer/src/types/data/shared-enums.ts`
- `src/renderer/src/types/data/index.ts`

**Data directories (3,040 JSON files in `src/renderer/public/data/`):**

| Directory | Contents | Expected Count |
|-----------|----------|----------------|
| `5e/classes/` | Class + subclass data (12 classes, 48 subclasses) | ~60 files |
| `5e/spells/` | Spell definitions by level + cantrips | ~400 spells |
| `5e/equipment/magic-items/` | Magic items by rarity | ~300+ items |
| `5e/equipment/weapons/` | Weapon definitions | ~40 weapons |
| `5e/equipment/armor/` | Armor definitions | ~15 armor types |
| `5e/equipment/items/` | Adventuring gear | ~100+ items |
| `5e/equipment/tools/` | Tool definitions | ~20 tools |
| `5e/origins/` | Species + background data | ~25+ files |
| `5e/feats/` | Feat definitions | ~80+ feats |
| `5e/dm/` | DM tools: NPCs, loot, creatures, encounters | ~200+ files |
| `5e/world/` | Calendar, deities, factions, planes, environments | ~100+ files |
| `5e/hazards/` | Diseases, traps, environmental hazards | ~50+ files |
| `5e/character/` | Companions, spellbooks, supernatural gifts | ~50+ files |
| `5e/bastions/` | Bastion facilities and events | ~20+ files |
| `5e/adventures/` | Adventure templates | Variable |
| `5e/game/` | Game mechanics data | Variable |
| `audio/` | Audio configuration | Variable |
| `ui/` | UI configuration | Variable |

### Specific Checks

1. **Spell completeness**: Count all spells in `5e/spells/`. Cross-reference against PHB 2024 spell list. Flag missing spells
2. **Monster completeness**: Count all monsters in `5e/dm/`. Cross-reference against MM 2025 creature list. Flag missing monsters
3. **Magic item completeness**: Cross-reference against DMG 2024 magic item tables
4. **Class feature accuracy**: For each class JSON, verify feature descriptions match PHB 2024 text
5. **Subclass completeness**: Verify all 48 subclasses from PHB 2024 are present with correct features
6. **Feat accuracy**: Verify feat prerequisites, effects, and levels match PHB 2024
7. **Species trait accuracy**: Verify species traits match PHB 2024 (new 2024 versions, not 2014)
8. **Equipment properties**: Verify weapon properties (finesse, heavy, light, loading, range, reach, thrown, two-handed, versatile) match PHB 2024
9. **Spell school assignments**: Verify each spell's school matches PHB 2024
10. **CR calculations**: For monsters, verify AC, HP, attack bonus, damage, and save DCs match MM 2025
11. **Data schema consistency**: Do all files of the same type follow the same schema? Flag inconsistencies
12. **Library browser**: Does `src/renderer/src/services/library-service.ts` and `src/renderer/src/pages/LibraryPage.tsx` provide browsing for ALL data categories?

### Reference Material
Use `5.5e References/PHB2024/`, `5.5e References/DMG2024/`, and `5.5e References/MM2025/` markdown files as source of truth. Do NOT search the web.

---

## 9. Sound & Audio System

### Scope
Audit the two-tier sound architecture: sound effects (triggered by game events) and ambient tracks (background music/atmosphere).

### Files to Audit

- `src/renderer/src/services/sound-manager.ts` — Sound event dispatching (63 events)
- `src/renderer/src/services/sound-playback.ts` — Audio playback engine
- `src/renderer/src/components/game/bottom/DMAudioPanel.tsx` — DM audio control panel
- `src/renderer/src/components/game/map/audio-emitter-overlay.ts` — Positional audio markers on map
- `src/renderer/src/services/chat-commands/commands-dm-sound.ts` — Sound chat commands
- `src/main/ipc/audio-handlers.ts` — Audio file IPC handlers
- `src/renderer/public/data/audio/` — Audio configuration data
- `src/renderer/src/pages/campaign-detail/AudioManager.tsx` — Campaign audio management

### Specific Checks

1. **Sound event coverage**: Are all 63 declared sound events actually triggered from game logic? Find orphaned events
2. **Ambient track categories**: Verify all 9 ambient categories exist and have tracks
3. **Custom audio upload**: Does the upload flow (`audio:upload-custom`) work? What file formats are supported?
4. **P2P audio sync**: When the DM plays ambient music, do all connected players hear it? How is audio streamed?
5. **Positional audio**: Do audio emitters on the map attenuate with distance?
6. **Volume controls**: Per-category volume sliders? Master volume? Mute?
7. **Audio format support**: MP3, WAV, OGG? What about file size limits for custom uploads?

---

## 10. Campaign Management

### Scope
Audit campaign creation wizard, adventure management, calendar/weather system, bastion system, and campaign detail page.

### Files to Audit

**Campaign wizard (16 files):**
- `src/renderer/src/components/campaign/CampaignWizard.tsx`
- `src/renderer/src/components/campaign/StartStep.tsx`
- `src/renderer/src/components/campaign/SystemStep.tsx`
- `src/renderer/src/components/campaign/DetailsStep.tsx`
- `src/renderer/src/components/campaign/RulesStep.tsx`
- `src/renderer/src/components/campaign/CalendarStep.tsx`
- `src/renderer/src/components/campaign/AudioStep.tsx`
- `src/renderer/src/components/campaign/MapConfigStep.tsx`
- `src/renderer/src/components/campaign/OllamaSetupStep.tsx`
- `src/renderer/src/components/campaign/SessionZeroStep.tsx`
- `src/renderer/src/components/campaign/ReviewStep.tsx`
- `src/renderer/src/components/campaign/AdventureSelector.tsx`
- `src/renderer/src/components/campaign/AdventureWizard.tsx`
- `src/renderer/src/components/campaign/AdventureImportWizard.tsx`
- `src/renderer/src/components/campaign/MagicItemTracker.tsx`

**Campaign detail page (13 files):**
- `src/renderer/src/pages/CampaignDetailPage.tsx`
- `src/renderer/src/pages/campaign-detail/OverviewCard.tsx`
- `src/renderer/src/pages/campaign-detail/AdventureManager.tsx`
- `src/renderer/src/pages/campaign-detail/MapManager.tsx`
- `src/renderer/src/pages/campaign-detail/AudioManager.tsx`
- `src/renderer/src/pages/campaign-detail/AiDmCard.tsx`
- `src/renderer/src/pages/campaign-detail/CalendarCard.tsx`
- `src/renderer/src/pages/campaign-detail/MetricsCard.tsx`
- `src/renderer/src/pages/campaign-detail/SessionZeroCard.tsx`
- `src/renderer/src/pages/campaign-detail/TimelineCard.tsx`
- `src/renderer/src/pages/campaign-detail/NPCManager.tsx`
- `src/renderer/src/pages/campaign-detail/LoreManager.tsx`
- `src/renderer/src/pages/campaign-detail/RuleManager.tsx`
- `src/renderer/src/pages/campaign-detail/MonsterLinker.tsx`

**Calendar & weather system:**
- `src/renderer/src/services/calendar-service.ts`
- `src/renderer/src/services/calendar-types.ts`
- `src/renderer/src/services/calendar-weather.ts`
- `src/renderer/src/services/weather-mechanics.ts` + `weather-mechanics.test.ts`
- `src/renderer/src/pages/CalendarPage.tsx`
- `src/renderer/src/data/calendar-presets.ts`
- `src/renderer/src/data/weather-tables.ts`
- `src/renderer/src/stores/game/time-slice.ts`
- `src/renderer/src/stores/game/timer-slice.ts`
- `src/renderer/src/components/game/modals/utility/WeatherOverridePanel.tsx` (in utility modals path)

**Timeline & metrics:**
- `src/renderer/src/services/timeline-builder.ts` + `timeline-builder.test.ts`
- `src/renderer/src/services/metrics-tracker.ts` + `metrics-tracker.test.ts`

**Adventure system:**
- `src/renderer/src/services/adventure-loader.ts`
- `src/renderer/src/services/io/adventure-io.ts` + `adventure-io.test.ts`

**Downtime:**
- `src/renderer/src/services/downtime-service.ts`

**Bastion system (13 files):**
- `src/renderer/src/pages/BastionPage.tsx`
- `src/renderer/src/pages/bastion/BastionTabs.tsx`
- `src/renderer/src/pages/bastion/BastionModals.tsx`
- `src/renderer/src/pages/bastion/BastionTurnModal.tsx`
- `src/renderer/src/pages/bastion/CreateBastionModal.tsx`
- `src/renderer/src/pages/bastion/OverviewTab.tsx`
- `src/renderer/src/pages/bastion/FacilityTabs.tsx`
- `src/renderer/src/pages/bastion/FacilityModals.tsx`
- `src/renderer/src/pages/bastion/DefendersTab.tsx`
- `src/renderer/src/pages/bastion/DefenseModals.tsx`
- `src/renderer/src/pages/bastion/TreasuryTimeModals.tsx`
- `src/renderer/src/pages/bastion/TurnEventsTab.tsx`
- `src/renderer/src/pages/bastion/bastion-constants.ts`
- `src/renderer/src/pages/bastion/bastion-modal-types.ts`

**Bastion store:**
- `src/renderer/src/stores/bastion-store/index.ts`
- `src/renderer/src/stores/bastion-store/types.ts`
- `src/renderer/src/stores/bastion-store/event-slice.ts`
- `src/renderer/src/stores/bastion-store/facility-slice.ts`

**Bastion data:**
- `src/renderer/public/data/5e/bastions/` — Bastion facilities and events JSON

**Campaign types:**
- `src/renderer/src/types/campaign.ts`
- `src/renderer/src/types/bastion.ts`

**Campaign store & I/O:**
- `src/renderer/src/stores/use-campaign-store.ts`
- `src/renderer/src/services/io/campaign-io.ts` + `campaign-io.test.ts`

**Campaign storage (main process):**
- `src/main/storage/campaign-storage.ts`
- `src/main/storage/bastion-storage.ts`

### Specific Checks

1. **Calendar integration**: Does advancing the in-game calendar trigger weather changes, event rolls, and bastion turns?
2. **Weather mechanics**: Verify weather effects match DMG 2024 (temperature, precipitation, wind → mechanical effects on gameplay)
3. **Bastion facilities**: Cross-reference facility list against DMG 2024 bastion chapter. Are all facilities present?
4. **Bastion turns**: Every 7 in-game days triggers a bastion turn. Verify the turn resolution logic
5. **Adventure import**: Does `AdventureImportWizard.tsx` support importing adventure modules? What format?
6. **Downtime activities**: Does `downtime-service.ts` implement all DMG 2024 downtime activities (Crafting, Brewing, Scribing, etc.)?
7. **Session zero**: Does the session zero wizard cover all topics from the DMG 2024 session zero checklist?
8. **Timeline**: Does the timeline builder track major events, session history, and narrative arcs?
9. **Metrics**: What campaign metrics are tracked? XP, gold, sessions, combat encounters, etc.?
10. **Time advancement**: Does the time system handle short rests (1 hour), long rests (8 hours), travel (overland movement rates), and downtime (days/weeks)?

---

## 11. Chat Commands

### Scope
Audit the 172+ chat commands across 26+ modules. Verify all commands work, have help text, and produce correct game effects.

### Files to Audit (33 files in `src/renderer/src/services/chat-commands/`)

**Command infrastructure:**
- `index.ts` — Command registry and dispatcher
- `types.ts` — Command type definitions
- `helpers.ts` — Shared command helpers
- `src/renderer/src/services/chat-commands.ts` — Top-level chat command service

**Command modules:**
- `commands-dice.ts` — Dice rolling commands (/roll, /r, /advantage, etc.)
- `commands-player-hp.ts` — HP management (/heal, /damage, /temphp, etc.)
- `commands-player-combat.ts` — Player combat actions (/attack, /cast, etc.)
- `commands-player-conditions.ts` — Condition management (/condition, /uncondition)
- `commands-condition-shortcuts.ts` — Short condition commands (/prone, /grapple, etc.)
- `commands-player-inventory.ts` — Inventory management (/give, /drop, /equip, etc.)
- `commands-player-currency.ts` — Currency management (/gold, /silver, etc.)
- `commands-player-spells.ts` — Spell slot management (/spellslot, /pact, etc.)
- `commands-player-resources.ts` — Class resource management (/ki, /rage, /channel, etc.)
- `commands-player-movement.ts` — Movement commands (/dash, /disengage, etc.)
- `commands-player-mount.ts` — Mount commands (/mount, /dismount)
- `commands-player-companions.ts` — Companion commands (/companion, /familiar)
- `commands-player-checks.ts` — Ability check commands (/check, /save, etc.)
- `commands-player-utility.ts` — Utility commands (/note, /status, etc.)
- `commands-dm-combat.ts` — DM combat commands (/initiative, /endcombat, etc.)
- `commands-dm-monsters.ts` — Monster management (/spawn, /summon, etc.)
- `commands-dm-map.ts` — Map commands (/fog, /light, /weather, etc.)
- `commands-dm-campaign.ts` — Campaign commands (/save, /load, etc.)
- `commands-dm-economy.ts` — Economy commands (/shop, /price, etc.)
- `commands-dm-narrative.ts` — Narrative commands (/describe, /handout, etc.)
- `commands-dm-sound.ts` — Sound commands (/play, /ambient, /sfx, etc.)
- `commands-dm-time.ts` — Time commands (/time, /dawn, /dusk, etc.)
- `commands-dm-ai.ts` — AI DM commands (/ask, /aidm, etc.)
- `commands-dm-bastion.ts` — Bastion commands (/bastion, /facility, etc.)
- `commands-social.ts` — Social commands (/whisper, /emote, etc.)
- `commands-utility.ts` — Global utility commands (/help, /clear, etc.)
- `action-commands.ts` — Action-based commands
- `attack-commands.ts` — Attack-specific commands
- `map-environment-commands.ts` — Map environment commands
- `map-token-commands.ts` — Map token commands

**Chat UI:**
- `src/renderer/src/components/game/bottom/ChatPanel.tsx`
- `src/renderer/src/components/game/bottom/CommandAutocomplete.tsx`

### Specific Checks

1. **Command discovery**: Is there a `/help` command that lists all available commands? Does it categorize them?
2. **Autocomplete**: Does `CommandAutocomplete.tsx` suggest commands as the user types? Does it show argument hints?
3. **Error messages**: When a command fails (wrong arguments, invalid target), does it give a clear error message?
4. **Permission enforcement**: Are DM-only commands (`/spawn`, `/fog`, `/initiative`) blocked for players?
5. **Dice notation**: Does `/roll` support standard notation (2d6+3, 4d8kh3, 2d20kl1, etc.)? What about exploding dice, reroll, etc.?
6. **Command count**: Count all registered commands. Verify the claimed 172+ count
7. **P2P sync**: Do commands that modify game state (HP, conditions, initiative) sync over P2P?

---

## 12. UI/UX Ghost System Audit

### Scope
Find features with backend logic but no GUI, orphaned UI components, and discoverability issues. Identify features that exist but users can't find.

### Files to Audit

**Game layout & modals:**
- `src/renderer/src/components/game/GameLayout.tsx` — Main game layout orchestrator
- `src/renderer/src/components/game/GameModalDispatcher.tsx` — Modal routing
- `src/renderer/src/components/game/active-modal-types.ts` — Active modal type definitions
- `src/renderer/src/components/game/modal-groups/CombatModals.tsx`
- `src/renderer/src/components/game/modal-groups/DmModals.tsx`
- `src/renderer/src/components/game/modal-groups/MechanicsModals.tsx`
- `src/renderer/src/components/game/modal-groups/UtilityModals.tsx`

**DM tools & sidebar:**
- `src/renderer/src/components/game/dm/DMToolbar.tsx` — DM toolbar buttons
- `src/renderer/src/components/game/dm/DMNotepad.tsx` — DM notes
- `src/renderer/src/components/game/bottom/DMBottomBar.tsx` — DM bottom bar
- `src/renderer/src/components/game/bottom/DMTabPanel.tsx` — DM tab panel
- `src/renderer/src/components/game/bottom/DMToolsTabContent.tsx` — DM tools content
- `src/renderer/src/components/game/sidebar/LeftSidebar.tsx` — Left sidebar
- `src/renderer/src/components/game/sidebar/JournalPanel.tsx` — TipTap journal
- `src/renderer/src/components/game/sidebar/StatBlockForm.tsx` — Stat block form
- `src/renderer/src/components/game/sidebar/StatBlockFormSections.tsx`
- `src/renderer/src/components/game/sidebar/RandomNpcGenerator.tsx` — NPC generator
- `src/renderer/src/components/game/sidebar/MonstersTab.tsx`
- `src/renderer/src/components/game/sidebar/SpellsTab.tsx`
- `src/renderer/src/components/game/sidebar/EquipmentTab.tsx`

**Player components:**
- `src/renderer/src/components/game/player/MacroBar.tsx` — Player macro bar
- `src/renderer/src/components/game/player/ShopView.tsx` — Player shop view
- `src/renderer/src/components/game/bottom/PlayerBottomBar.tsx`

**Overlays:**
- `src/renderer/src/components/game/overlays/ActionEconomyBar.tsx` — Action/bonus/reaction tracking
- `src/renderer/src/components/game/overlays/CharacterPickerOverlay.tsx`
- `src/renderer/src/components/game/overlays/EmptyCellContextMenu.tsx`
- `src/renderer/src/components/game/overlays/GamePrompts.tsx`
- `src/renderer/src/components/game/overlays/GameToasts.tsx`
- `src/renderer/src/components/game/overlays/LairActionPrompt.tsx`
- `src/renderer/src/components/game/overlays/PlayerHUDEffects.tsx`
- `src/renderer/src/components/game/overlays/ReactionPrompts.tsx`
- `src/renderer/src/components/game/overlays/RollRequestOverlay.tsx`
- `src/renderer/src/components/game/overlays/TimerOverlay.tsx`
- `src/renderer/src/components/game/overlays/TokenContextMenu.tsx`
- `src/renderer/src/components/game/overlays/TurnNotificationBanner.tsx`
- `src/renderer/src/components/game/overlays/DmAlertTray.tsx`

**Library & compendium:**
- `src/renderer/src/pages/LibraryPage.tsx` — Library browser
- `src/renderer/src/pages/library/LibraryFilters.tsx`
- `src/renderer/src/pages/library/library-constants.ts`
- `src/renderer/src/services/library-service.ts` — Library data loader
- `src/renderer/src/stores/use-library-store.ts`
- `src/renderer/src/components/game/modals/utility/CompendiumModal.tsx` — In-game compendium

**Keyboard shortcuts:**
- `src/renderer/src/services/keyboard-shortcuts.ts`
- `src/renderer/src/components/ui/ShortcutsOverlay.tsx`

**Notification & theme:**
- `src/renderer/src/services/notification-service.ts`
- `src/renderer/src/services/theme-manager.ts`
- `src/renderer/src/components/ui/Toast.tsx`

**All pages (routes):**
- `src/renderer/src/App.tsx` — Route definitions
- `src/renderer/src/pages/MainMenuPage.tsx`
- `src/renderer/src/pages/CreateCharacterPage.tsx`
- `src/renderer/src/pages/ViewCharactersPage.tsx`
- `src/renderer/src/pages/CharacterSheet5ePage.tsx`
- `src/renderer/src/pages/LevelUp5ePage.tsx`
- `src/renderer/src/pages/MakeGamePage.tsx`
- `src/renderer/src/pages/JoinGamePage.tsx`
- `src/renderer/src/pages/InGamePage.tsx`
- `src/renderer/src/pages/SettingsPage.tsx`
- `src/renderer/src/pages/AboutPage.tsx`
- `src/renderer/src/pages/NotFoundPage.tsx` (if it exists)

### Specific Checks

1. **Known orphan WIP components** (from TestAudit.md): `CombatLogPanel.tsx` (sidebar), `JournalPanel.tsx` (sidebar), `RollRequestOverlay.tsx` (P2P), `ThemeSelector.tsx` (settings), `PrintSheet.tsx` (character sheet) — verify if these are now wired up or still orphaned
2. **Ghost features**: Services with no UI: `downtime-service.ts`, `cdn-provider.ts`, `cloud-sync.ts`, `undo-manager.ts` — are these used?
3. **DM tool discoverability**: Are all DM tools (NPC generator, encounter builder, treasure generator, map editor, shop builder, creature creator, roll table, DM screen, handout system, sentient items) accessible from the DM toolbar?
4. **Player action economy**: Does `ActionEconomyBar.tsx` show action/bonus action/reaction/movement usage during a player's turn?
5. **Lair action prompt**: Does `LairActionPrompt.tsx` appear at initiative count 20 for monsters with lair actions?
6. **Reaction prompts**: Does `ReactionPrompts.tsx` pause for opportunity attacks, Shield, Counterspell?
7. **Empty cell context menu**: Can the DM right-click empty map cells to place tokens, mark locations, etc.?
8. **Macro bar**: What can players put on their macro bar? Attacks, spells, abilities, custom macros?
9. **Library coverage gaps**: Does the library browser cover all data categories (spells, monsters, items, feats, species, classes, backgrounds, conditions)?

---

## 13. Security

### Scope
Penetration testing mindset. Find vulnerabilities in P2P networking, file I/O, IPC, AI prompt injection, and Electron security configuration.

### Files to Audit

**Electron security:**
- `src/main/index.ts` — BrowserWindow creation (nodeIntegration, contextIsolation, sandbox, CSP)
- `src/preload/index.ts` — Context bridge (verify no leaking of Node.js APIs)
- `Tests/electron-security.js` — Existing security check script (9 checks)

**P2P attack surface:**
- `src/renderer/src/network/schemas.ts` — Zod message validation
- `src/renderer/src/network/message-handler.ts` — Message routing
- `src/renderer/src/network/host-message-handlers.ts` — Host-side processing
- `src/renderer/src/stores/network-store/client-handlers.ts` — Client-side processing

**File I/O:**
- `src/main/ipc/index.ts` — `fs:read-file` and `fs:write-file` path whitelisting
- All storage files in `src/main/storage/` — verify path traversal protection

**AI prompt injection:**
- `src/main/ai/dm-system-prompt.ts` — System prompt boundaries
- `src/main/ai/ai-response-parser.ts` — Response parsing for code execution
- `src/main/ai/stat-mutations.ts` — AI-proposed stat changes
- `src/main/ai/tone-validator.ts` — Content filtering

**Data validation:**
- `src/renderer/src/services/io/import-export.ts` — Character import validation
- `src/renderer/src/services/io/import-dnd-beyond.ts` — External data parsing
- `src/renderer/src/services/io/entity-io.ts` — Entity I/O

### Specific Checks

1. **CSP policy**: Read the Content-Security-Policy header. Is `unsafe-eval` blocked? Is `unsafe-inline` blocked?
2. **nodeIntegration**: Must be `false`. Verify
3. **contextIsolation**: Must be `true`. Verify
4. **sandbox**: Must be `true`. Verify
5. **Path traversal**: Can `fs:read-file` read files outside the app's data directory? (e.g., `../../etc/passwd`)
6. **P2P message injection**: Can a malicious peer send messages that bypass Zod validation? Look for `as unknown as` casts or unvalidated message paths
7. **AI stat mutation abuse**: Can a player craft input that causes the AI to set their HP to 9999 or give them legendary items?
8. **Prototype pollution**: Any use of `Object.assign` or spread on unvalidated P2P data?
9. **File upload**: Audio upload (`audio:upload-custom`) — can it overwrite arbitrary files? What about file type validation?
10. **WebView**: Are there any `<webview>` tags or `BrowserView` instances?
11. **External URLs**: Does `shell.openExternal` validate URLs before opening?
12. **npm audit**: Verify 0 vulnerabilities (confirmed in TestAudit.md, but re-verify)
13. **Hardcoded secrets**: Verify no API keys, tokens, or passwords in source code

---

## 14. Performance

### Scope
Identify performance bottlenecks in rendering, state updates, bundle size, lazy loading, and P2P bandwidth.

### Files to Audit

**Bundle & lazy loading:**
- `src/renderer/src/App.tsx` — React.lazy imports for route-level code splitting
- `electron.vite.config.ts` (or `vite.config.ts`) — Vite build configuration
- `package.json` — Dependencies (total count and sizes)

**Render-heavy components:**
- `src/renderer/src/components/game/map/MapCanvas.tsx` (522 lines) — PixiJS canvas
- `src/renderer/src/components/game/GameLayout.tsx` (543 lines) — Main game layout
- `src/renderer/src/components/game/dice3d/DiceRenderer.tsx` — Three.js scene
- `src/renderer/src/stores/builder/slices/build-character-5e.ts` (610 lines) — Large compute function

**State management:**
- All 11 Zustand stores — check for unnecessary re-renders, missing selectors
- `src/renderer/src/stores/game/index.ts` — Game store with 12 slices

**Data loading:**
- `src/renderer/src/services/data-provider.ts` — Data caching strategy
- `src/renderer/src/services/library-service.ts` — Library loading (3,000+ files)

**Network bandwidth:**
- `src/renderer/src/network/host-state-sync.ts` — State sync frequency
- `src/renderer/src/network/game-sync.ts` — Game sync payload size

### Specific Checks

1. **Bundle analysis**: Run `npx electron-vite build` and analyze output size. What is the total JS bundle size?
2. **Lazy loading coverage**: Are all 12+ routes lazy-loaded? Are the 37+ modals lazy-loaded?
3. **PixiJS object cleanup**: Does `MapCanvas.tsx` properly destroy PixiJS objects when unmounting? Check for memory leaks
4. **Three.js cleanup**: Does `DiceRenderer.tsx` dispose of geometries, materials, and textures?
5. **Zustand selector efficiency**: Are components using granular selectors (e.g., `useGameStore(s => s.initiative)`) or pulling the entire store?
6. **Data provider caching**: What is the cache strategy? LRU? TTL? Memory-bounded?
7. **Large file loading**: With 3,000+ data files, what is the startup time? Are files loaded lazily on demand?
8. **P2P state sync**: Is game state synced as full snapshots or incremental updates? What's the typical payload size?
9. **React re-render profiling**: Are there components re-rendering on every keystroke or mouse move?
10. **Web Worker usage**: Are any heavy computations (pathfinding, vision, AI) offloaded to Web Workers?
11. **Image optimization**: Are map images and token sprites optimized? What formats are supported?

---

## 15. Deployment & CI/CD

### Scope
Audit the build pipeline, installer configuration, auto-update mechanism, code signing, and crash reporting.

### Files to Audit

- `package.json` — Build scripts, electron-builder config
- `electron.vite.config.ts` — Vite configuration
- `electron-builder.yml` (or `electron-builder.json5` or inline in `package.json`) — Installer config
- `src/main/updater.ts` — Auto-update via electron-updater
- `src/renderer/src/pages/AboutPage.tsx` — Version display and update check UI
- `.github/` — CI/CD workflows (if any)
- `biome.json` — Linter/formatter configuration
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` — TypeScript configs
- `vitest.config.ts` — Test configuration

### Specific Checks

1. **Code signing**: Is the Windows installer signed? Check electron-builder config for certificate settings
2. **Auto-update**: Does `electron-updater` check for updates on startup? What is the update URL?
3. **.dndvtt file association**: Is there a custom file association for `.dndvtt` files? Check electron-builder file association config
4. **Crash reporting**: Is there Sentry, Crashpad, or any crash reporter integrated?
5. **CI/CD pipeline**: Are there GitHub Actions workflows for build, test, and release?
6. **Build reproducibility**: Can the build be reproduced from a clean clone? Check for missing environment variables or secrets
7. **Installer size**: What is the expected installer size? (Electron + dependencies + data files)
8. **Log rotation**: `app.getPath('userData')/logs/app.log` — verify 5MB rotation is implemented in `src/main/log.ts`

---

## 16. BMO Infrastructure

### Scope
Audit the BMO (Raspberry Pi AI companion) deployment and AWS backend. Skip hardware-specific features (OLED display, camera, smart home). Focus on D&D integration, deployment scripts, and AI server configuration.

### Files to Audit

**Setup scripts:**
- `BMO-setup/bmo.sh` — BMO deployment script
- `BMO-setup/lib.sh` — Shared library functions
- `BMO-setup/aws-setup.sh` — AWS infrastructure setup
- `BMO-setup/pi-setup.sh` — Pi initial setup
- `BMO-setup/pi/post-setup-auth.sh` — Post-setup authentication

**Pi application:**
- `BMO-setup/pi/app.py` — Main Pi application
- `BMO-setup/pi/agent.py` — AI agent system
- `BMO-setup/pi/dev_tools.py` — Development tools

**BMO documentation:**
- `BMO-setup/BMO-SETUP-GUIDE.md` — Setup guide
- `BMO-setup/misc+directions/architecture.md` — Architecture docs
- `BMO-setup/misc+directions/aws-services-reference.md` — AWS service reference
- `BMO-setup/misc+directions/cloudflare-setup.md` — Cloudflare config
- `BMO-setup/misc+directions/troubleshooting.md` — Troubleshooting guide

### Specific Checks

1. **D&D agent integration**: Does the Pi's D&D agent (`agents/` directory) integrate with the VTT's AI DM system?
2. **AWS backend**: Does `aws-setup.sh` provision the correct services? Are there hardcoded credentials?
3. **Deployment automation**: Can `bmo.sh` deploy a fresh Pi from scratch? What are the prerequisites?
4. **Spot instance monitoring**: Is there monitoring for AWS spot instance interruptions?
5. **SSL certificates**: Are SSL certs properly configured? Check `pi/` for cert files
6. **Security**: Are API keys/credentials stored securely? Check `config/` directory for exposed secrets

---

## 17. State Persistence

### Scope
Verify that all entity types can be saved, loaded, and deleted correctly. Test the full lifecycle for characters, campaigns, bastions, creatures, homebrew, game state, and AI conversations.

### Files to Audit

**Storage handlers (main process):**
- `src/main/storage/character-storage.ts` — Character CRUD
- `src/main/storage/campaign-storage.ts` — Campaign CRUD
- `src/main/storage/bastion-storage.ts` — Bastion CRUD
- `src/main/storage/custom-creature-storage.ts` — Custom creature CRUD
- `src/main/storage/homebrew-storage.ts` — Homebrew content CRUD
- `src/main/storage/game-state-storage.ts` — In-game state save/load
- `src/main/storage/ai-conversation-storage.ts` — AI conversation persistence
- `src/main/storage/settings-storage.ts` — User settings
- `src/main/storage/migrations.ts` + `migrations.test.ts` — Data migrations
- `src/main/storage/types.ts` — `StorageResult<T>` type

**Renderer-side I/O:**
- `src/renderer/src/services/io/character-io.ts` + `character-io.test.ts`
- `src/renderer/src/services/io/campaign-io.ts` + `campaign-io.test.ts`
- `src/renderer/src/services/io/adventure-io.ts` + `adventure-io.test.ts`
- `src/renderer/src/services/io/entity-io.ts`
- `src/renderer/src/services/io/import-export.ts`
- `src/renderer/src/services/io/auto-save.ts`
- `src/renderer/src/services/io/game-auto-save.ts`
- `src/renderer/src/services/io/game-state-saver.ts`
- `src/renderer/src/services/io/backup-io.ts`

**Planned/WIP:**
- `src/main/storage/cloud-sync.ts` — Cloud sync (S3-based backup)

### Specific Checks

1. **Full save/load cycle**: For each entity type (character, campaign, bastion, creature, homebrew, game state, AI conversation), trace the complete flow: UI action → store method → IPC call → storage handler → file system → response
2. **Data migration**: Does `migrations.ts` handle upgrading old save formats? What migration versions exist?
3. **Concurrent writes**: What happens if two operations write to the same file simultaneously? Is there locking?
4. **Error recovery**: If a save fails mid-write (e.g., disk full), is the original file preserved?
5. **Auto-save frequency**: How often does auto-save trigger? Can it be configured?
6. **Game state restore**: When reloading a saved game, is the complete state restored (initiative order, conditions, fog, token positions, chat history)?
7. **Character versioning**: Does `character-versions` properly create version snapshots? Can they be restored?
8. **Backup/export**: Does `backup-io.ts` create complete backups? What format (zip, tar, custom)?
9. **Cloud sync status**: Is `cloud-sync.ts` functional or just a skeleton?
10. **Storage location**: Where does `app.getPath('userData')` point on Windows? Are paths handled cross-platform?

---

## 18. Test Coverage & TypeScript Integrity

### Scope
Run and verify the existing test infrastructure. Check TypeScript compilation. Identify gaps in test coverage.

### Files to Audit

**Test infrastructure:**
- `Tests/run-audit.js` — 36-check master audit orchestrator
- `Tests/TestAudit.md` — Last audit report (36 checks, 0 errors, 0 warnings)
- `Tests/electron-security.js` — 9 Electron security checks
- `Tests/knip.txt` + `Tests/knip-report.json` — Dead code analysis (1,233 items)
- `Tests/rename-to-kebab.js` — File rename utility
- `Tests/replace-console-logs.js` — Console log replacement

**Configuration:**
- `vitest.config.ts` — Vitest configuration
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` — TypeScript configs
- `biome.json` — Linter/formatter config

**Test files (co-located with source):**
- `src/main/ai/context-builder.test.ts`
- `src/main/ai/file-reader.test.ts`
- `src/main/ai/token-budget.test.ts`
- `src/main/ai/tone-validator.test.ts`
- `src/main/ai/ai-service-web-search-approval.test.ts`
- `src/main/storage/migrations.test.ts`
- `src/renderer/src/services/data-provider.test.ts`
- `src/renderer/src/services/json-schema.test.ts`
- `src/renderer/src/services/equipment-schema.test.ts`
- `src/renderer/src/services/metrics-tracker.test.ts`
- `src/renderer/src/services/timeline-builder.test.ts`
- `src/renderer/src/services/weather-mechanics.test.ts`
- `src/renderer/src/services/combat/aoe-targeting.test.ts`
- `src/renderer/src/services/combat/attack-modifiers.test.ts`
- `src/renderer/src/services/combat/attack-resolver.test.ts`
- `src/renderer/src/services/combat/combat-resolver.test.ts`
- `src/renderer/src/services/combat/combat-rules.test.ts`
- `src/renderer/src/services/combat/condition-extractor.test.ts`
- `src/renderer/src/services/combat/cover-calculator.test.ts`
- `src/renderer/src/services/combat/critical-hits.test.ts`
- `src/renderer/src/services/combat/crit-range.test.ts`
- `src/renderer/src/services/combat/damage-resolver.test.ts`
- `src/renderer/src/services/combat/effect-resolver-5e.test.ts`
- `src/renderer/src/services/combat/flanking.test.ts`
- `src/renderer/src/services/character/build-tree-5e.test.ts`
- `src/renderer/src/services/character/multiclass-advisor.test.ts`
- `src/renderer/src/services/character/rest-service-5e.test.ts`
- `src/renderer/src/services/character/spell-data.test.ts`
- `src/renderer/src/services/character/spell-preparation-analyzer.test.ts`
- `src/renderer/src/services/character/stat-calculator-5e.test.ts`
- `src/renderer/src/services/character/stat-calculator-5e-encumbrance.test.ts`
- `src/renderer/src/services/dice/inline-roller.test.ts`
- `src/renderer/src/services/io/adventure-io.test.ts`
- `src/renderer/src/services/io/campaign-io.test.ts`
- `src/renderer/src/services/io/character-io.test.ts`
- `src/renderer/src/services/map/pathfinder.test.ts`
- `src/renderer/src/services/map/vision-computation.test.ts`
- `src/renderer/src/network/schemas.test.ts`

### Specific Checks

1. **Run the audit**: Execute `node Tests/run-audit.js` and verify all 36 checks still pass
2. **TypeScript integrity**: Run `npx tsc --noEmit` across all three tsconfig projects. Verify 0 errors
3. **Test count**: Run `npx vitest run` and verify the test count matches expectations (~34 test suites, 500+ individual tests)
4. **Coverage gaps**: Statement coverage is 17.09% — identify the most critical untested files. Priority: combat resolver, stat calculator, data provider
5. **Dead code analysis**: 1,233 knip items — categorize as: truly dead code vs WIP features vs false positives
6. **Missing test categories**: No tests exist for: network (P2P message handling), stores (Zustand state management), UI components (React component rendering), AI DM (prompt construction, streaming). Recommend test strategy for each
7. **Integration tests**: Are there any integration tests (e.g., full combat round simulation)? If not, identify critical integration test scenarios
8. **Test infrastructure health**: Does the audit script itself need updates? Are all 36 checks still relevant?
9. **Biome linting**: Run `npx biome check` and verify 0 issues
10. **Type coverage**: 99.88% — identify the 0.12% uncovered types

---

## 19. Competitor Feature Matrix

### Scope
Compare this VTT against all major competitors. Identify features the competitors have that this VTT lacks, and features this VTT has that competitors lack.

### Competitors to Compare

| Competitor | Key Strength |
|------------|-------------|
| **Roll20** | Web-based, largest user base, marketplace |
| **Foundry VTT** | Self-hosted, module ecosystem, most customizable |
| **D&D Beyond** | Official digital tools, character builder, encounter builder |
| **Owlbear Rodeo** | Minimal, fast, easy to use |
| **Fantasy Grounds** | Deep rules automation, longest history |
| **Talespire** | 3D maps and environments |
| **Alchemy RPG** | Mobile-first, streamlined |
| **Shmeppy** | Ultra-minimal whiteboard VTT |
| **AboveVTT** | D&D Beyond browser extension |

### Feature Categories to Compare

1. **Map & Fog**: Dynamic lighting, fog of war, wall tools, hex support, 3D maps
2. **Combat**: Initiative tracker, attack automation, condition tracking, AoE templates
3. **Character Management**: Character builder, character sheet, import/export, D&D Beyond integration
4. **Dice**: 3D dice, dice physics, custom dice, shared rolling
5. **AI/Automation**: AI DM, auto-calculation, rules enforcement
6. **Audio**: Ambient music, sound effects, voice chat
7. **Content**: Spell compendium, monster database, item database, adventure modules
8. **Social**: Voice/video chat, Discord integration, spectator mode
9. **Networking**: P2P vs server-hosted, latency, max players
10. **Customization**: Themes, homebrew support, scripting/macros, module system
11. **Platform**: Desktop, web, mobile, offline support
12. **Pricing**: Free, subscription, one-time purchase, marketplace
13. **Bastions**: Does any competitor implement the DMG 2024 bastion system?
14. **Calendar/Weather**: In-game time tracking with weather mechanics
15. **Chat Commands**: CLI-style commands for power users

### Specific Checks

1. **Unique advantages**: What features does this VTT have that NO competitor offers? (AI DM, bastion system, local-first P2P, etc.)
2. **Critical gaps**: What common features are present in ALL competitors but missing here?
3. **Feature parity with Foundry VTT**: Foundry is the closest competitor in terms of feature depth. Where does this VTT fall short?
4. **D&D Beyond parity**: Since this VTT focuses on 2024 rules, compare character builder completeness against D&D Beyond
5. **Market differentiators**: Based on the feature matrix, what is this VTT's strongest market position?

---

## Output Format

### Expected Deliverables

1. **Executive Summary** (1-2 pages)
   - Overall assessment
   - Critical issues requiring immediate attention
   - Top 5 most impactful improvements
   - Unique strengths

2. **Detailed Findings** (organized by section 1-19)
   - For each section:
     - Files examined
     - Issues found (per-file, with line numbers where relevant)
     - Severity classification: CRITICAL / HIGH / MEDIUM / LOW / INFO
     - Existing tests that validate the system

3. **Actionable Task List** (prioritized)
   - Group by severity
   - Each task includes:
     - Description of what needs to change
     - Files to modify
     - Estimated complexity (S/M/L/XL)
     - Dependencies on other tasks

4. **Competitor Gap Analysis** (matrix format)
   - Feature × Competitor grid
   - Clear indication of where this VTT leads and where it trails

### Rules for the Auditor

- Do NOT search the web. Use `5.5e References/` markdown files as D&D rules source
- Do NOT give numerical scores. Use severity classifications instead
- DO read actual file contents — do not guess based on file names alone
- DO cross-reference findings across sections (e.g., a combat rule error might affect both Section 3 and Section 6)
- DO verify claims in `Tests/TestAudit.md` by examining the actual test code
- DO check for consistency between types, stores, and UI components
- Flag any `as any` casts, `@ts-ignore` comments, or `eslint-disable` directives
- Flag any hardcoded magic numbers or strings that should be constants
- Flag any TODO/FIXME/HACK comments (should be 0 per TestAudit.md — verify)
