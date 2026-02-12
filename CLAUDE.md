# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment Setup

Node.js is not on the default PATH. All shell commands need:
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
```
Adjust the path if Node.js is installed elsewhere. Use PowerShell scripts (`.ps1`) when `$env:PATH` must be set, since `$` gets escaped in inline commands.

## Common Commands

```powershell
# Development
npx electron-vite dev

# Production build (vite only)
npx electron-vite build

# Build Windows installer (NSIS)
npx electron-builder --win

# Full build pipeline
npm run build:win

# Type checking (composite project)
npx tsc --build
```

Helper scripts: `scripts/run-dev.ps1` (dev server), `scripts/build.ps1` (vite build), `scripts/build-installer.ps1` (electron-builder), `scripts/typecheck.ps1` (tsc --build).

No test framework or linter is configured.

## Architecture

**Electron three-process model:**
- **Main** (`src/main/`) — IPC handlers (`ipc/index.ts`), window lifecycle, CSP headers, path-validated file I/O. Storage uses async `fs/promises` writing JSON to `app.getPath('userData')/{characters,campaigns}/`.
- **Preload** (`src/preload/`) — Context bridge exposing `window.api` with typed methods for character CRUD, campaign CRUD, file dialogs, and raw file I/O. Types in `index.d.ts`, included in `tsconfig.web.json`.
- **Renderer** (`src/renderer/src/`) — React 19 SPA with MemoryRouter (not BrowserRouter — Electron requirement). Global JSX declaration in `global.d.ts` needed for React 19 + tsc.

**State management (Zustand v5):** Seven stores, each owning a distinct domain:
- `useCharacterStore` — Character CRUD via `window.api`. Includes `toggleArmorEquipped()` for equip/unequip toggling.
- `useBuilderStore` — Character creation state machine (`system-select → building → complete`), split into 6 slices at `stores/builder/slices/` (core, ability-score, selection, character-details, build-actions, save)
- `useCampaignStore` — Campaign CRUD via `window.api`. `loadCampaigns()` merges disk data with in-memory campaigns (preserving campaigns injected via `addCampaignToState()` from network peers).
- `useNetworkStore` — PeerJS connection lifecycle, host/client message routing. Stores `campaignId` (real UUID) received from the host during `game:state-full` handshake.
- `useLobbyStore` — Pre-game lobby state (players, chat, voice status, ready system, slow mode, file sharing toggle). `LobbyPlayer` includes `color`, `isDeafened`, `isCoDM`. `ChatMessage` supports file attachments (`isFile`, `fileData`, `mimeType`).
- `useGameStore` — In-game state (map, tokens, initiative, fog of war, shop inventory)
- `useUIStore` — UI state (sidebar toggle)

**Game system plugin architecture** (`systems/`):
- `types.ts` — `GameSystemPlugin` interface: spell slots, spell lists, class features, equipment, skills, sheet config
- `registry.ts` — `registerSystem()` / `getSystem(id)` / `getAllSystems()` backed by a Map
- `dnd5e/index.ts` — 5e plugin implementation
- `pf2e/index.ts` — PF2e plugin implementation
- `init.ts` — Registers both plugins at app startup

Plugins expose `getSheetConfig()` returning `SheetConfig` (showInitiative, showPerception, showClassDC, showBulk, showElectrum, showFocusPoints, proficiencyStyle). Sheet components use this to conditionally render system-specific UI.

**Networking (PeerJS WebRTC P2P):** Located in `network/`. Host-authoritative model:
- `peer-manager.ts` — PeerJS instance lifecycle, invite code generation (6-char alphanumeric, ambiguous chars removed)
- `host-manager.ts` — Accepts connections, routes messages, manages peer registry. Exports `setCampaignId()`/`getCampaignId()` so joining clients learn the real campaign UUID. Also handles ban list (`bannedPeers` Set), chat mute timeouts (`chatMutedPeers` Map), auto-moderation word filtering, rate limiting (10 msg/sec per peer), and message size validation (64KB default, 8MB for file messages).
- `client-manager.ts` — Connects to host, handles incoming messages. Validates all incoming messages (type, payload shape, string lengths) before processing. Uses `handleForcedDisconnection()` for kick/ban (no reconnect attempts) vs `handleDisconnection()` for network errors (retries up to 3 times).
- `voice-manager.ts` — WebRTC media calls, VAD, force-mute/deafen, per-peer local mute. Supports listen-only mode (graceful degradation when no microphone). Exports `resumeAllAudio()` to unblock browser autoplay policy and `isListenOnly()` to check mic status.
- `message-handler.ts` — Message routing utility
- `types.ts` — `MessageType` union, `PeerInfo`, all payload interfaces

Messages flow: client → host (rebroadcasts) → all clients. The host processes and relays; clients don't talk directly to each other. DM moderation (force-mute, kick, ban, chat timeout, co-DM promotion) is host-initiated via direct broadcast. The host validates all incoming messages: rate limiting, size limits, payload shape validation, senderId/senderName overwrite (spoofing prevention), and optional word filtering before relay. Kick uses `dm:kick-player`, ban uses `dm:ban-player` (distinct message types so clients show appropriate feedback).

**Invite code vs campaign UUID:** Invite codes (e.g., "DX29YF") are 6-char strings used as PeerJS peer IDs for connecting. Campaign IDs are UUIDs. When a client joins, the host sends the real `campaignId` in the `game:state-full` handshake. `JoinGamePage` waits for this UUID before navigating to `/lobby/${campaignId}`. Never use the invite code as a campaign ID for store lookups.

**Lobby bridge pattern:** `useNetworkStore` and `useLobbyStore` are deliberately separate stores. `LobbyPage.tsx` acts as the bridge:
- Syncs `networkStore.peers` → `lobbyStore.players` via useEffect (adds/updates/removes remote players)
- Registers additional `onHostMessage`/`onClientMessage` listeners for `chat:message` → adds to `lobbyStore.chatMessages`
- Bridges `player:character-select` messages to store remote character data in `lobbyStore.remoteCharacters` (keyed by characterId)
- Bridges `dm:character-update` messages: when DM edits a remote player's character and saves, sends updated data; client saves locally and updates `lobbyStore.remoteCharacters`
- Bridges `dm:force-mute`/`dm:force-deafen` explicitly to `lobbyStore` player updates
- Bridges `chat:file` messages for image/character/campaign file sharing (base64 over WebRTC, max 5MB images, 2MB .dndchar/.dndcamp)
- Bridges `player:color-change`, `dm:promote-codm`/`dm:demote-codm`, `dm:slow-mode`, and `dm:file-sharing` to lobby store
- UI components (`ChatInput`, `ReadyButton`, `LobbyLayout`) call both `lobbyStore` (local state) and `networkStore.sendMessage()` (network relay)
- Dice rolls (`/roll`) are processed locally in `useLobbyStore.sendChat()`, then the result is broadcast via `chat:message` with `isDiceRoll`/`diceResult` fields so other players see the roll
- Own chat messages are filtered by `senderId !== localPeerId` to avoid duplicates from host rebroadcast
- Watches `connectionState` for forced disconnection (kick/ban) → navigates to home page

**Network data sync:** Some data lives only on one machine (campaigns on DM's disk, characters on each player's disk). To make it available across peers:
- `player:character-select` includes full `characterData` in the payload so other players can view character sheets. Stored in `lobbyStore.remoteCharacters`.
- `dm:game-start` includes the full `campaign` object. Clients receive it and call `useCampaignStore.addCampaignToState()` (in-memory only, no disk persistence) before navigating to `/game/${payload.campaign.id}`.
- `dm:character-update` sends updated character data to a specific player after DM edits their character in the lobby.
- `dm:shop-update` broadcasts shop inventory to all players. `GameLayout.tsx` registers a message listener for this and calls `gameStore.openShop()`/`setShopInventory()`.
- `PlayerList` looks up characters from both local `useCharacterStore` and `lobbyStore.remoteCharacters`.

**Multi-system support:** D&D 5e and Pathfinder 2e. Per-system files follow the pattern `*-{5e,pf2e}.ts`:
- Build tree generators (`services/build-tree-*.ts`) — create level-based build slots
- Stat calculators (`services/stat-calculator-*.ts`) — compute derived stats from build choices
- Auto-populate services (`services/auto-populate-*.ts`) — fill in defaults for new characters. `auto-populate-5e.ts` includes `getSpellsFromTraits()` which generically detects spell-granting features via the `spellGranted` field on species traits (no hardcoded race checks)
- Character types (`types/character-*.ts`) — system-specific Character interfaces. `BuildChoices5e` includes `subclassId`, `asiChoices`, `chosenLanguages`, `speciesAbilityBonuses` for edit persistence. `BuildChoicesPf2e` includes `chosenLanguages` and `pf2eAbilityBoosts`.
- SRD data (`renderer/public/data/{5e,pf2e}/`) — JSON files for species/ancestries, classes, backgrounds, feats, spells, class features, equipment, subclasses, magic items (5e), archetypes (PF2e). PF2e feats are split into `feats/{general,skill,ancestry,class}-feats.json`. 5e feats have `category` ("Origin" | "General" | "Fighting Style") and `level` fields. 5e data uses 2024 PHB (10 species with flexible ability scores, 16 backgrounds with origin feats).

**Character sheet** (`components/sheet/`): Unified section-based layout for both systems. Each section component accepts a `Character` union and uses type guards (`is5eCharacter`/`isPf2eCharacter`) or plugin `SheetConfig` to handle system differences:
- `CharacterSheet.tsx` — Main slide-out panel, 2-column layout
- `SheetHeader`, `CombatStatsBar`, `AbilityScoresGrid` — Identity and combat stats
- `SavingThrowsSection`, `SkillsSection` — Proficiency-based sections (dots for 5e, TEML for PF2e). Skills are expandable with descriptions from `data/skills.ts`.
- `SpellcastingSection`, `OffenseSection`, `DefenseSection` — Combat mechanics. `DefenseSection` includes armor equip/unequip toggles.
- `ConditionsSection` — Active conditions and buffs with picker. Data from `data/conditions.ts` (system-specific conditions + buffs).
- `FeaturesSection`, `EquipmentSection`, `NotesSection` — Inventory and character details. `EquipmentSection` shows weapons with attack/damage, armor with AC/properties.
- `ProficiencyIndicator` — Polymorphic: dots (5e) or TEML bubbles (PF2e)

**SRD data loading:** `services/data-provider.ts` fetches JSON from `./data/{system}/`, caches in a Map, and transforms raw data into `SelectableOption` format for the builder UI. Also exposes typed loaders (`load5eSpells`, `load5eMagicItems`, `loadPf2eEquipment`, etc.) used by plugins. PF2e feat loading uses `getOptionsForSlot()` with categories `ancestry-feat`, `class-feat`, `skill-feat`, `general-feat` which load from the `feats/` subdirectory.

**Game data files:**
- `data/conditions.ts` — `CONDITIONS_5E`, `CONDITIONS_PF2E`, `BUFFS_5E`, `BUFFS_PF2E` arrays. Each has `name`, `description`, `hasValue?`, `maxValue?` (PF2e leveled conditions).
- `data/skills.ts` — System-specific skill descriptions with common uses. `getSkillDescription(name, system)`.
- `data/moderation.ts` — `DEFAULT_BLOCKED_WORDS` array and `filterMessage()` for chat auto-moderation. Used by host-manager when moderation is enabled.
- `services/spell-data.ts` — Shared spell slot/cantrip tables (`FULL_CASTER_SLOTS`, `CANTRIPS_KNOWN`, `getCantripsKnown()`, `getSlotProgression()`). Used by both `SpellsTab` (builder) and `SpellcastingSection` (sheet).
- `services/adventure-loader.ts` — Loads `./data/adventures/adventures.json` with caching. `Adventure` includes `chapters[]` and `npcs[]` (each with `role: 'ally' | 'enemy' | 'neutral'`).

**In-game rendering:** PixiJS via `@pixi/react`. Map canvas (`components/game/MapCanvas.tsx`) with grid, token, fog, and measurement layers as PixiJS display objects (not React components).

**In-game layout** (`components/game/GameLayout.tsx`): Three-panel layout with tabs:
- **Left panel** — Initiative tracker (collapsible)
- **Center** — MapCanvas with DM toolbar overlay
- **Right panel** — DM tabs: tokens, fog, npcs, notes, shop. Player tabs: character, conditions, spells.
- **Bottom panel** — Actions, dice, chat tabs
- **Shop integration** — `ShopPanel` (DM: manage inventory with preset items, broadcast) and `ShopView` (player: browse/buy). `GameLayout` registers `dm:shop-update` message listener.
- **Player overlay** — `ShopView` appears above `PlayerHUD` when shop is open

**Character builder flow:** User selects game system → foundation slots (ancestry/species, class, background, ability scores) → level-based slots (ASI, feats, features) → `buildCharacter5e()`/`buildCharacterPf2e()` (async, returns `Promise<Character>`) in `save-slice.ts` assembles final Character object (including armor parsed from equipment via `buildArmorFromEquipment5e()`) → saved via IPC. Equipment assembly merges starting equipment, background equipment, AND shop-purchased items (source-tracked). `SpellsTab` enforces cantrip limits and spells-known limits (for bard/sorcerer/ranger/warlock); `spell-data.ts` has `SPELLS_KNOWN` tables. Non-caster classes with racial spells (e.g., High Elf barbarian) show a "Racial Spells" section instead of blocking the tab.

**Character builder persistence:** `save-slice.ts` handles both saving and restoring for edit:
- `loadCharacterForEdit5e()` restores subclass slot selection, ASI selections, `chosenLanguages`, and `selectedSpellIds` from `buildChoices`/`knownSpells`
- `loadCharacterForEditPf2e()` restores `chosenLanguages`, `pf2eAbilityBoosts`, and `selectedSpellIds` from `buildChoices`/`knownSpells`
- `buildCharacter5e()` uses `getSpellsFromTraits()` to populate racial `knownSpells`, merges with builder-selected spells from `selectedSpellIds` (deduped by name), and saves `speciesAbilityBonuses` into `buildChoices`
- `selectedSpellIds` lives in `CharacterDetailsSliceState` (not local component state) so it persists through the builder flow

**Routing** (`App.tsx`):
- `/` → Main menu
- `/characters`, `/characters/create`, `/characters/edit/:id` → Character management (both systems, editable)
- `/make` → Campaign creation wizard
- `/campaign/:id` → Campaign detail
- `/join` → Join game by invite code
- `/lobby/:campaignId` → Pre-game lobby (voice auto-initializes on connect)
- `/game/:campaignId` → In-game view (DM tools vs player HUD based on role)
- `/calendar` → Fantasy calendar
- `/about` → About page (version, features, tech stack)

## Security Hardening

**Sandbox enabled:** `BrowserWindow` uses `sandbox: true`. The preload script can only use `contextBridge` and `ipcRenderer` — all Node.js work (fs, path, dialog) happens in main process IPC handlers. Never set `sandbox: false`.

**Content Security Policy:** CSP headers are injected via `session.webRequest.onHeadersReceived` in `main/index.ts`. External resources cannot be loaded in the renderer. Whitelisted origins: `ws:/wss:` and `https://0.peerjs.com` for PeerJS signaling, `blob:` for voice/media, `'unsafe-inline'` only for style-src (Tailwind). No `'unsafe-eval'`.

**Restricted file I/O:** `fs:read-file` and `fs:write-file` IPC handlers validate paths against an allowlist (`main/ipc/index.ts`). Only two categories of paths are permitted:
1. Paths under `app.getPath('userData')` (the app's own data directory)
2. Paths returned by `dialog:show-save` or `dialog:show-open` (consumed after single use)

Any other path throws `"Access denied: path not allowed"`. This means file export/import must always follow the pattern: call dialog first → use returned path for read/write. Paths are normalized with `path.normalize()` for Windows compatibility.

**Network security:** `host-manager.ts` enforces a multi-layer security pipeline on all incoming peer messages:
1. **Size limit** — Messages > 64KB rejected (exception: `chat:file` up to 8MB)
2. **Rate limit** — Sliding window of 10 messages/second per peer; excess dropped
3. **Payload validation** — `player:join` (displayName max 32 chars), `chat:message` (max 2000 chars), `chat:file` (allowed MIME types only)
4. **SenderId spoofing prevention** — Host overwrites `senderId`/`senderName` with actual peer info from `peerInfoMap` before relay
5. **Chat moderation** — Optional word filter (`data/moderation.ts`) replaces blocked words with `***` before relay
6. **Ban enforcement** — Banned peers rejected immediately on connection attempt. Bans are persisted to `userData/bans/{campaignId}.json` via IPC and restored on `setCampaignId()` or `startHosting()`.

**Client-side validation:** `client-manager.ts` validates all incoming messages from host: type must match known `MessageType`, payload must be an object, string fields have max length checks (displayName 100, message 5000).

Chat messages are also truncated to 2000 chars client-side in `useLobbyStore.sendChat()`.

**Code signing prep:** `electron-builder.yml` has `signAndEditExecutable: false`. When a certificate is purchased, set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` env vars (electron-builder reads them automatically), then change `signAndEditExecutable` to `true`.

## Key Conventions

- **Styling:** Tailwind CSS v4 with `@tailwindcss/vite` plugin. Dark theme: gray-950 backgrounds, amber accents.
- **Path alias:** `@renderer` maps to `src/renderer/src` (configured in electron-vite and tsconfig).
- **UI components:** Reusable primitives in `components/ui/` (Button, Card, Input, Modal, EmptyState, BackButton) exported via barrel file.
- **Character types:** Union type `Character = Character5e | CharacterPf2e` with type guards `is5eCharacter()`/`isPf2eCharacter()` in `types/character.ts`. Common types (SpellEntry, WeaponEntry, ArmorEntry, Currency, ClassFeatureEntry, ActiveCondition) in `character-common.ts`. Both systems use `Currency` (`{ cp, sp, gp, pp, ep? }`) for treasure. Both have `heroPoints`, `pets`, `conditions` fields.
- **Campaign types:** `Campaign` in `types/campaign.ts` includes `lore: LoreEntry[]` for world-building entries with player visibility toggles, `npcs: NPC[]` for campaign NPCs, and `customRules: CustomRule[]`. `CampaignDetailPage` provides full CRUD for NPCs, lore, maps, and custom rules.
- **Readonly character sheets:** `CharacterSheet`, `SheetHeader`, `CombatStatsBar`, and `DefenseSection` accept an optional `readonly` prop. When true, level editing, HP editing, and armor equip toggles are disabled and the Edit button is hidden. Used in the lobby when players view other players' sheets (DM gets edit access, players get readonly).
- **Adding a game system:** Implement `GameSystemPlugin` interface, register in `systems/init.ts`, add character type + build tree + stat calculator + auto-populate service, add SRD data files under `renderer/public/data/{system}/`.
- **Data fetch paths:** All `fetch()` calls for SRD data MUST use relative paths (`./data/5e/races.json`, not `/data/5e/races.json`). In Electron production builds, absolute `/data/` resolves to the filesystem root under the `file://` protocol and will 404.
- **Network types:** `PeerInfo` is the canonical player descriptor used across network, lobby, and game stores. Fields include `isDeafened`, `color?`, `isCoDM?`. When adding fields to `PeerInfo`, update all construction sites (host-manager `handleJoin`, network store `player:join` handler, lobby page peer sync bridge).
- **Player colors:** 12-color preset palette (`PLAYER_COLORS` in `network/types.ts`). Auto-assigned on join (first unused color). `LobbyPlayer.color` used in `PlayerCard` avatars and `ChatPanel` sender names.
- **Lobby moderation:** `host-manager.ts` exports `banPeer()`, `chatMutePeer()`, `setModerationEnabled()`, `setCustomBlockedWords()`. `PlayerCard` renders DM controls (kick, ban, timeout, co-DM promote). `ChatInput` supports slow mode and file attachments.
- **PeerJS serialization:** Must use `serialization: 'raw'` for data connections. PeerJS's `binary` serializer (the default) doesn't bundle correctly with Vite, and `'none'` doesn't exist. Valid values: `raw`, `json`, `binary`, `binary-utf8`, `default`. The codebase manually calls `JSON.stringify()`/`JSON.parse()` so `raw` is correct.
- **Navigation state for return paths:** When navigating to `/characters/create` from within the lobby, `CharacterSelector` passes `{ state: { returnTo: '/lobby/${campaignId}' } }`. `CharacterBuilder` and `CreateCharacterPage` read `location.state.returnTo` and navigate there instead of the default `/characters` after save or back. This prevents players from losing their lobby connection when creating a character mid-session.
- **DM remote character edits:** When DM edits a remote player's character, `PlayerList` sets `playerId` to the remote player's peerId. After save, `CharacterBuilder` checks if `role === 'host'` and `character.playerId !== 'local'`, then sends `dm:character-update` with the updated character data.
- **Persistence:** One JSON file per entity (character/campaign), named by UUID. Storage functions return `StorageResult<T>` with `{ success, data?, error? }`.
- **Build targets:** NSIS installer only (portable build removed). Configured in `electron-builder.yml` with `requestedExecutionLevel: asInvoker` (no admin elevation). Building the installer requires an admin terminal (symlink permissions for code signing cache).
- **App icon path:** `main/index.ts` uses `app.isPackaged` to resolve `icon.ico` — dev uses `__dirname`-relative, production uses `process.resourcesPath`. `electron-builder.yml` has `extraResources` to copy the icon into the packaged app.
- **Single-instance lock:** `main/index.ts` calls `app.requestSingleInstanceLock()` to prevent multiple app instances. A second launch focuses the existing window instead.
- **Equipment source tracking:** `EquipmentItem` (5e) and `EquipmentItemPf2e` have an optional `source` field (`'class'`, `'background'`, `'shop'`). This enables source-based filtering during save and proper preservation of shop-purchased items on edit.
- **Shop currency:** `GearTab.tsx` uses `parseCost()` to extract cost from item strings (e.g., "50 gp" → 50 gold) and `deductWithConversion()` to subtract from builder currency with cross-denomination conversion and change-making (e.g., breaking gold into silver/copper).
- **Store circular dependency avoidance:** `useNetworkStore` uses dynamic `import('./useGameStore')` and `save-slice.ts` uses dynamic `import('../../useCharacterStore')` to avoid circular dependencies between stores. These cause harmless Vite build warnings ("dynamically imported by ... but also statically imported by ...") — do not "fix" these warnings by converting to static imports.
- **Weapon persistence:** `Character5e` has a `weapons: WeaponEntry[]` field (same as PF2e). `buildCharacter5e()` and `buildCharacterPf2e()` preserve existing weapons on edit and auto-populate from starting equipment for new characters via `buildWeaponsFromEquipment5e()`/`buildWeaponsFromEquipmentPf2e()`.
- **Spell level validation:** `SpellsTab.tsx` filters available spells by max accessible level (5e: derived from slot progression; PF2e: ceil(level/2)) and validates in `toggleSpell()`. Players cannot see or select spells above their accessible level.
- **UUID validation:** All storage functions (`characterStorage`, `campaignStorage`, ban IPC handlers) validate IDs against UUID regex before constructing filesystem paths. Prevents path traversal attacks via malicious IDs.
