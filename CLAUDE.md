# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment Setup

Node.js is not on the default PATH. Use PowerShell helper scripts that set PATH automatically, or prefix bash commands:

```bash
# Bash (Claude Code shell) — prefix each command
PATH="/c/Program Files/nodejs:$PATH" npx electron-vite dev
```

For PowerShell scripts (`.ps1` files), use `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`. Use `.ps1` scripts when `$env:PATH` must be set inline, since `$` gets escaped in bash.

## Common Commands

```bash
# Development (hot reload)
powershell -File scripts/run-dev.ps1
# or: PATH="/c/Program Files/nodejs:$PATH" npx electron-vite dev

# Type checking (composite project — no incremental, checks all 3 targets)
powershell -File scripts/typecheck.ps1
# or: PATH="/c/Program Files/nodejs:$PATH" npx tsc --build

# Production build (vite only)
PATH="/c/Program Files/nodejs:$PATH" npx electron-vite build

# Build Windows installer (NSIS)
PATH="/c/Program Files/nodejs:$PATH" npx electron-builder --win

# Full build pipeline
PATH="/c/Program Files/nodejs:$PATH" npm run build:win
```

Helper scripts: `scripts/run-dev.ps1`, `scripts/build.ps1`, `scripts/build-installer.ps1`, `scripts/typecheck.ps1`. No test framework or linter is configured.

## Architecture

### Electron Three-Process Model

- **Main** (`src/main/`) — IPC handlers (`ipc/index.ts`), window lifecycle, CSP headers, path-validated file I/O. Storage uses async `fs/promises` writing JSON to `app.getPath('userData')/{characters,campaigns,bastions}/`.
- **Preload** (`src/preload/`) — Context bridge exposing `window.api` with typed methods. Types in `index.d.ts`, included in `tsconfig.web.json`.
- **Renderer** (`src/renderer/src/`) — React 19 SPA with MemoryRouter (not BrowserRouter — Electron `file://` requirement). Global JSX declaration in `global.d.ts` needed for React 19 + tsc.

**TypeScript composite project:** Root `tsconfig.json` references `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer + preload types). `tsc --build` checks both.

### State Management (Zustand v5)

Nine stores: `useCharacterStore` (CRUD), `useBuilderStore` (creation, 6 slices at `stores/builder/slices/`), `useCampaignStore`, `useBastionStore`, `useNetworkStore` (PeerJS), `useLobbyStore` (lobby), `useGameStore` (in-game), `useLevelUpStore` (level-up flow), `useUIStore`.

### Character Flow: Make vs Sheet vs Level Up

1. **Make Character** (builder, `/characters/create`) — Four tabs: About, Special Abilities, Languages, Spells. Equipment lives on Sheet. `save-slice.ts` assembles the `Character` object.
2. **Character Sheet** (`/characters/:id`) — Full view/edit. Toolbar: Edit/Save toggle, Short Rest, Long Rest, Make Character, Level Up. Permission-gated.
3. **Level Up** (`/characters/:id/levelup`) — Per-level HP, ASI, feat/spell choices. `useLevelUpStore.applyLevelUp()` merges delta.

ViewCharactersPage → Sheet (not builder). XP/Milestone leveling via `levelingMode: 'xp' | 'milestone'`.

### Character Sheet Layout

Two-column grid: SheetHeader → CombatStatsBar → AbilityScoresGrid (full width), then Left (Class Resources, Saves, Skills, Conditions, Features, Actions[PF2e]) / Right (Offense, Defense, Spellcasting, Equipment & Currency, Crafting[5e]). Notes always at bottom.

**Key sheet behaviors:**
- **Dynamic AC**: Computed from equipped armor, not stored `character.armorClass`. 5e: `equippedArmor.acBonus + cappedDex + shieldBonus` (unarmored varies by class). `ArmorEntry.acBonus` = full base AC (e.g., 17 for Splint), NOT modifier.
- **Dynamic weapon stats**: Attack bonuses/damage computed from current ability scores + proficiency. Stored `weapon.attackBonus` ignored.
- **Dynamic spellcasting**: Save DC / attack bonus recomputed via `computeSpellcastingInfo()`. Stored `spellcasting` field used for persistence only.
- **Currency**: Coin badges with cross-denomination buy/sell via `utils/currency.ts`. Equipment packs expand into individual items on purchase.

### Game System Plugin Architecture (`src/renderer/src/systems/`)

- `GameSystemPlugin` interface → `dnd5e/index.ts` and `pf2e/index.ts`, auto-registered in `init.ts`
- Per-system files: `*-{5e,pf2e}.ts` (build-tree, stat-calculator, auto-populate, character types)
- SRD data: `renderer/public/data/{5e,pf2e}/` (species, classes, backgrounds, feats, spells, equipment, subclasses, class-features, crafting, magic-items, trinkets, invocations, metamagic)
- **Component tree split**: `components/{builder,sheet,levelup}/{5e,pf2e}/`, shared UI in `*/shared/`
- **Page split**: `CharacterSheet5ePage.tsx` / `CharacterSheetPf2ePage.tsx`, `LevelUp5ePage.tsx` / `LevelUpPf2ePage.tsx`

### Services Layer

| Service | Purpose |
|---------|---------|
| `data-provider.ts` | SRD data loading with caching. Exports `load5eInvocations()`, `load5eMetamagic()`, `load5eFeats()`, `load5eMagicItems()`, `load5eSpecies()`, `load5eSpells()`, `getHeritageOptions5e()`, `getOptionsForCategory()`. |
| `spell-data.ts` | Spell slot tables, `PREPARED_SPELLS`, `computeSpellcastingInfo()`, Warlock Pact Magic (`isWarlockPactMagic()`, `getWarlockPactSlots()`), third-caster support. |
| `build-tree-5e.ts` / `build-tree-pf2e.ts` | Build slot tree generation |
| `stat-calculator-5e.ts` / `stat-calculator-pf2e.ts` | Ability scores, HP, AC, saves. `calculateHPBonusFromTraits()` for Dwarven Toughness/Tough. |
| `auto-populate-5e.ts` / `auto-populate-pf2e.ts` | Auto-fill equipment/proficiencies. `getSpeciesSpellProgression()` for heritage spells. |
| `character-io.ts` / `campaign-io.ts` | Import/export via native file dialogs |

### Level Up System

`components/levelup/{5e,pf2e}/` with `useLevelUpStore`. Separate `apply5eLevelUp()` / `applyPf2eLevelUp()` handling: ASI retroactive CON bonus, spell slot delta, class features from `class-features.json`, HP bonus delta, Epic Boon (lv19), General Feat at ASI levels, Fighting Style, Invocations (Warlock), Metamagic (Sorcerer), Divine/Primal Order.

### Networking (PeerJS WebRTC P2P)

`network/` directory. **Host-authoritative**: client → host (validates & relays) → all clients. Files: `peer-manager.ts`, `host-manager.ts`, `client-manager.ts`, `voice-manager.ts`, `message-handler.ts`, `types.ts`.

**Invite code vs campaign UUID:** Invite codes are PeerJS peer IDs. Campaign IDs are UUIDs from `game:state-full` handshake. Never mix them.

**Lobby bridge:** `LobbyPage.tsx` bridges `useNetworkStore` ↔ `useLobbyStore`. Filter own messages by `senderId !== localPeerId`.

### Routing (`App.tsx`)

System-prefixed routes: `/characters/5e/create`, `/characters/5e/edit/:id`, `/characters/5e/:id`, `/characters/5e/:id/levelup` (same for `pf2e`). Legacy routes (`/characters/:id`, `/characters/edit/:id`, `/characters/:id/levelup`) redirect to system-prefixed. Other: `/` (menu), `/characters` (list), `/bastions`, `/make`, `/campaign/:id`, `/join`, `/lobby/:campaignId`, `/game/:campaignId`, `/calendar`, `/about`.

## Security Hardening

- **Sandbox enabled** (`sandbox: true`). Never set `sandbox: false`.
- **CSP headers** via `session.webRequest.onHeadersReceived`. No `'unsafe-eval'`.
- **Restricted file I/O**: Paths validated against `app.getPath('userData')` allowlist + dialog-returned paths (60s TTL).
- **UUID validation** on all storage IDs (prevents path traversal).
- **Network security pipeline**: Size limit → rate limit → type allowlist → payload validation → senderId rewrite → word filter → ban enforcement.
- **Client-side validation**: `client-manager.ts` validates all host messages.

## Key Conventions

### Critical Patterns

- **Sheet save pattern (effectiveCharacter):** All sheet components must use `useCharacterStore.getState().characters.find(c => c.id === character.id) || character` before spreading updates. Never use stale `character` prop. Always set `updatedAt: new Date().toISOString()`.
- **DM broadcast pattern:** After saving, check `role === 'host' && character.playerId !== 'local'`, then broadcast `dm:character-update` with `targetPeerId` and call `setRemoteCharacter()`.
- **Data fetch paths:** Always use relative paths (`./data/5e/species.json`). Absolute paths break under `file://` in production.
- **Store circular deps:** Dynamic imports in `useNetworkStore` and `save-slice.ts`. Harmless Vite warnings — do not convert to static.
- **PeerJS serialization:** Must use `serialization: 'raw'` with manual `JSON.stringify()`/`JSON.parse()`.

### Adding a Class-Specific Build Slot

Pattern for new class-level choices (e.g., Fighting Style, Primal Order, Divine Order):

1. Add category to `BuildSlotCategory` in `character-common.ts`
2. Add `getXxxLevel(classId)` in `build-tree-5e.ts`, generate slots in `generate5eBuildSlots()` + `generate5eLevelUpSlots()`
3. Add icon mapping in `BuildSlotItem.tsx`
4. Add inline options in `data-provider.ts` → `getOptionsForCategory()`
5. Add store state/setter/reset in `useLevelUpStore.ts`
6. Add selector component in `LevelSection5e.tsx`
7. Add `buildChoices.xxxChoice` field in `character-5e.ts`
8. Add restore/save in `save-slice-5e.ts`
9. Wire proficiency effects in `save-slice-5e.ts` (builder) and `apply5eLevelUp()` (level-up)

### Shared Utilities

- `utils/currency.ts`: `parseCost()`, `deductWithConversion()`, `addCurrency()`, `computeSellPrice()`
- `utils/ac-calculator.ts`: `computeDynamicAC(character)` — shared by CharacterCard and CombatStatsBar
- `utils/character-routes.ts`: `getCharacterSheetPath()`, `getBuilderCreatePath()`, `getBuilderEditPath()`, `getLevelUpPath()`
- `data/xp-thresholds.ts`: `shouldLevelUp()` — 5e lookup table, PF2e 1000/level
- `data/class-resources.ts`: `getClassResources(classId, classLevel)` → per-rest trackers
- `data/weapon-mastery.ts`: 8 mastery properties (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex)
- `data/language-descriptions.ts`, `data/wearable-items.ts`, `data/skills.ts`, `data/starting-equipment-table.ts`

### Character Types

- Union `Character = Character5e | CharacterPf2e` with type guards `is5eCharacter()`/`isPf2eCharacter()`
- Common types in `character-common.ts`: SpellEntry (`source?`, `innateUses?` where -1 = PB uses), WeaponEntry, ArmorEntry, Currency, ActiveCondition, ClassResource
- 5e-specific: `classes: CharacterClass5e[]`, `hitDiceRemaining`, `deathSaves`, `attunement`, `heroicInspiration?`, `weaponMasteryChoices?`, `magicItems?`, `pactMagicSlotLevels?`, `classResources?`, `wildShapeUses?`, `invocationsKnown?`, `metamagicKnown?`, `subspecies?`
- PF2e-specific: `heroPoints`, `dying`, `wounded`, `actions: Pf2eAction[]`, `focusPoints`, `spellTradition`
- One JSON file per entity, named by UUID. `StorageResult<T>` with `{ success, data?, error? }`

### Builder Persistence

- `save-slice.ts` dispatches to `save-slice-5e.ts` / `save-slice-pf2e.ts`
- `loadCharacterForEdit*()` restores subclass, ASI, languages, spells, HP, fighting style, heritage, versatileFeatId, speciesExtraSkillCount, speciesSpellcastingAbility, keenSensesSkill
- `buildCharacter*()` preserves ALL sheet-edited fields via spread operator — new character fields auto-survive re-saves
- `selectedSpellIds` in `CharacterDetailsSliceState` (persists through builder flow)
- `CharacterSummaryBar` loads real SRD data for correct HP/ability score calculation

### Networking Conventions

- **DM remote edits:** Check `role === 'host' && character.playerId !== 'local'`, broadcast `dm:character-update` with `targetPeerId`.
- **`PeerInfo`** fields: `isDeafened`, `color?`, `isCoDM?`. Update all construction sites when adding fields.
- **Return paths:** Pass `{ state: { returnTo: '/lobby/${campaignId}' } }` when navigating away from lobby.

### Rest System

- Rest logic in `CharacterSheet5ePage.tsx` (Long Rest) and `ShortRestDialog5e.tsx` (Short Rest). Both use effectiveCharacter pattern.
- **5e Long Rest**: ALL hit dice recovered, all spell/pact slots, all class resources + wild shape, all innate spells, clear death saves/temp HP, Exhaustion -1. Humans get Heroic Inspiration. High Elf cantrip swap dialog.
- **5e Short Rest**: Class resources per `shortRestRestore`, Hit Point Dice spending (no limit), Warlock Pact slots, wild shape +1.

### Sheet Permission Logic

```
canEdit = (character.playerId === 'local') || (role === 'host') || (localPlayer?.isCoDM) || (character.playerId === localPeerId)
```

### Styling and UI

- Tailwind CSS v4 with `@tailwindcss/vite`. Dark theme: gray-950 backgrounds, amber accents.
- `@renderer` alias → `src/renderer/src`. Reusable primitives in `components/ui/`.

### PF2e-Specific Notes

- Equipment uses `traits` (not `properties`), `acBonus`/`dexCap`/`checkPenalty`/`speedPenalty`
- Feats split: `feats/{general,skill,ancestry,class}-feats.json`
- HP deterministic: `ancestryHP + (classHP + conMod) * level`
- Actions/Reactions: `Pf2eAction[]` with action cost diamonds. Custom Lore skills. Extended personality fields.
- Dying (0-4) + Wounded in CombatStatsBar when HP <= 0

### 5e 2024 PHB Notes

**Species & Heritage:**
- "Race" → "Species". Data: `species.json`. 6 species have lineages via `subraces[]` with `traitModifications` and optional `spellProgression`. Heritage slot injected dynamically. Always use `derivedSpeciesTraits` (not `speciesTraits`).
- Species spell progression at levels 3/5 via `getSpeciesSpellProgression()`. `innateUses: -1` = PB uses/long rest.
- Elf/Tiefling/Gnome: species spellcasting ability choice (INT/WIS/CHA). High Elf: cantrip swap on Long Rest. Elf Keen Senses: Insight/Perception/Survival choice.
- Human: Skillful (+1 skill), Extra Language (+1 lang), Versatile (free Origin feat via `versatileFeatId`).
- Background ASI (not species). Custom background: any 3 abilities.

**Build Order & Feats:**
- Class → Background → Species → Heritage → Ability Scores → Skills. All subclasses at level 3.
- ASI at 4, 8, 12, 16 (Fighter +6/14, Rogue +10). Level 19: Epic Boon.
- 4 feat categories: Origin (lv1), General (lv4+), Fighting Style, Epic Boon (lv19+). 4 repeatable feats.
- ASI/Feat toggle: at ASI levels choose ASI feat OR General feat.

**Class Features:**
- Fighting Style: Fighter(lv1), Paladin(lv2), Ranger(lv2). `getFightingStyleLevel()`.
- Cleric Divine Order (lv1): Protector/Thaumaturge. Druid Primal Order (lv1): Magician/Warden.
- Druid Wild Shape: tracking via `wildShapeUses`. Elemental Fury (lv7): Potent Spellcasting/Primal Strike.
- Druid auto-grants: Druidic language, Speak with Animals always-prepared.
- Warlock Pact Magic: separate system (max 4 slots, max 5th-level). Invocations: `invocations.json` (42). Count: 1/3/5/6/7/8/9.
- Sorcerer Metamagic: `metamagic.json` (10). Count: 2/3/4.
- Weapon mastery: 8 properties. `weaponMastery: { count, progression }` in classes.json.

**Equipment & Gold:**
- Class starting equipment options (A/B/C choices). Background 50 GP toggle replaces background equipment.
- Starting equipment at higher levels: bonus gold + magic item slots per PHB table.
- Crafting: tool-based recipes in `crafting.json`. Spell scroll crafting with Arcana/Calligrapher's.
- Trinkets: d100 table in `trinkets.json`.

**Combat & Conditions:**
- Heroic Inspiration (renamed from inspiration). Humans gain on Long Rest.
- Hit Point Dice (renamed from Hit Dice in UI). Long Rest recovers ALL.
- Exhaustion: 6 levels (-2 D20 Tests, -5 ft Speed each). Level 6 = death.
- Bloodied: auto-indicator when HP > 0 and HP <= half max.
- Spell lists: arcane/divine/primal. Spell components shown with "M" badge.
- No background features in 2024 PHB. No Hero Points for 5e.

### 5e Multiclassing

- `Character5e.classes: CharacterClass5e[]` (array of `{ name, level, subclass?, hitDie }`)
- `BuildChoices5e.multiclassEntries?: MulticlassEntry[]`
- `classes.json`: `multiclassPrerequisites` and `multiclassProficiencies` per class
- Level-up: `classLevelChoices: Record<number, string>` maps level → classId. `ClassLevelSelector` shows eligible classes via `meetsPrerequisites()`
- Spell slots: `getMulticlassSpellSlots()` combines caster levels. Warlock Pact Magic separate (`pactMagicSlotLevels`).
- Sheet: "Level X (Fighter 5 / Wizard 3)" format, multiclass hit dice display

### Bastion System

Types in `types/bastion.ts`. 15 room definitions in `BASTION_ROOM_DEFINITIONS`. Storage in `main/storage/bastionStorage.ts`. Store: `useBastionStore`. Page: `BastionPage.tsx` at `/bastions`.

### Build Configuration

NSIS installer only. `requestedExecutionLevel: asInvoker`. Single-instance lock. Code signing via `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` env vars.

## Common Pitfalls

- **Edit tool `replace_all` substring danger**: Substring matches inside identifiers get mangled. Always use targeted, unique-context replacements.
- **Gold stacking on save**: Background `startingGold` loaded at selection. Additive gold logic must account for existing `currency.gp` to avoid double-counting.
- **Relative fetch paths**: `fetch('./data/...')` works. `fetch('/data/...')` breaks under `file://`. Always relative.
- **MemoryRouter, not BrowserRouter**: Never switch — `file://` origin breaks BrowserRouter.
- **PeerJS `serialization: 'raw'`**: Don't change to `'binary'` or `'json'` — binary doesn't bundle with Vite.
