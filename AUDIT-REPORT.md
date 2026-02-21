# Full-Scale Codebase Audit Report

**Project**: D&D Virtual Tabletop (`C:\Users\evilp\dnd`)
**Date**: 2026-02-21
**Trigger**: Post-reorganization audit after data directory restructure (flat `data/5e/*.json` → subdirectories)

---

## Executive Summary

| Severity | Category | Count |
|----------|----------|-------|
| **CRITICAL** | Broken file paths (AI DM non-functional) | 2 files, 6 paths |
| **HIGH** | Deleted files pending git commit | 90+ files |
| **MEDIUM** | Unused npm dependencies | 2 packages |
| **MEDIUM** | Unused type file | 1 file |
| **LOW** | Git staging/on-disk mismatch | ~10 renamed entries |
| **INFO** | Orphaned test file (standalone, still useful) | 1 file |
| **CLEAN** | Verified items with no issues | 15+ categories |

---

## 1. BROKEN FILE PATHS — Critical

The data directory was reorganized from a flat `data/5e/*.json` layout to subdirectories (`data/5e/spells/`, `data/5e/creatures/`, etc.). Two main-process files still reference the old flat paths and **silently return empty arrays** because `loadJson()` and `readFileSync()` catch errors.

### 1a. `src/main/ai/srd-provider.ts` — Lines 127, 136, 146

The `loadJson()` function joins filenames with the flat `data/5e/` base directory. The referenced files were moved to subdirectories.

| Line | Current (broken) | Correct path |
|------|-----------------|--------------|
| 127 | `'spells.json'` | `'spells/spells.json'` |
| 136 | `'equipment.json'` | `'equipment/equipment.json'` |
| 146 | `'monsters.json'` | `'creatures/monsters.json'` |

**Impact**: `detectAndLoadSrdData()` returns empty string — the AI DM cannot detect spell, equipment, or monster references in player messages to enrich its context.

### 1b. `src/main/ai/context-builder.ts` — Lines 18-21

The `loadMonsterData()` function iterates over filenames at the flat `data/5e/` base directory.

```typescript
// Line 18-19 — current (broken):
const dataDir = path.join(__dirname, '..', '..', 'renderer', 'public', 'data', '5e')
for (const file of ['monsters.json', 'creatures.json', 'npcs.json']) {
```

| Current (broken) | Correct path |
|-----------------|--------------|
| `'monsters.json'` | `'creatures/monsters.json'` |
| `'creatures.json'` | `'creatures/creatures.json'` |
| `'npcs.json'` | `'creatures/npcs.json'` |

**Impact**: `loadMonsterData()` returns an empty Map — the AI DM cannot enrich active creature context with stat block data (CR, resistances, actions, etc.) during combat.

---

## 2. DELETED FILES PENDING GIT COMMIT

90+ files have been deleted from disk but remain tracked by git. These are all obsolete and safe to commit as deletions.

### 2a. Planning & Audit Documents (20 files)

| File | Purpose (historical) |
|------|---------------------|
| `PLAN.md` | Original project plan |
| `PLANS_COMBINED.md` | Merged plan document |
| `AUDIT-5.5e-2024.md` | 2024 PHB audit |
| `Plan1.md` – `Plan16.md` | Individual phase plans (16 files) |
| `add-components.js` | One-time component scaffold script |

### 2b. Phase Documentation (7 files)

| File |
|------|
| `phases/phase1-critical-bugs.md` |
| `phases/phase2-security.md` |
| `phases/phase3-code-quality.md` |
| `phases/phase4-ux-qol.md` |
| `phases/phase5-network.md` |
| `phases/phase6-performance-a11y.md` |
| `phases/phase7-features.md` |

### 2c. Documentation Directory (2 files)

| File |
|------|
| `docs/installer-evaluation.md` |
| `docs/tech-stack-audit.md` |

### 2d. Scripts Directory (60+ files)

The entire `scripts/` directory contents except `scripts/build-chunk-index.js` (still referenced in `package.json` `prebuild:index` script). Categories:

| Category | Files | Count |
|----------|-------|-------|
| Monster Manual migration | `mm2025-parse.js`, `mm2025-apply.js`, `mm2025-audit.js`, `mm2025-compare.js`, `mm2025-fix-structured.js`, `mm2025-merge.js`, `mm2025-transform.js`, `mm2025-diff-report.json`, `mm2025-gap-report.json`, `mm2025-parsed.json`, `mm2025-parse.test.ts` | 11 |
| Data fix scripts | `fix-adult-red-dragon.js`, `fix-adventure-refs.js`, `fix-beholder-balor.js`, `fix-cr-mismatches.js`, `fix-dmg-data.js`, `fix-dupes.js`, `fix-monster-initiative.js`, `fix-monsters.js`, `fix-monsters-2025.js`, `fix-monsters-batch2.js`, `fix-pitfiend-vampire.js`, `fix-spells-2024.js`, `fix-tarrasque-lich.js` | 13 |
| PDF splitting | `split-dmg.js`, `split-intro-pages.js`, `split-mm.js`, `split-phb.js` | 4 |
| Extracted data | `extracted/aberrations.json`, `extracted/aberrations-verified.json`, `extracted/animals.json`, `extracted/final-missing-batch1.json`, `extracted/final-missing-batch2.json`, `extracted/gith-undead-other.json`, `extracted/lycanthropes-mephits-mindflayers-yugoloths-verified.json`, `extracted/mephits-plants-constructs.json`, `extracted/poltergeist.json`, `extracted/sphinxes.json` | 10 |
| PowerShell scripts | `add-poppler-path.ps1`, `build-installer.ps1`, `build.ps1`, `check-processes.ps1`, `find-lock.ps1`, `find-locks.ps1`, `fix-poppler-system-path.ps1`, `rename-refs.ps1`, `run-dev.ps1`, `tsc-check.ps1`, `typecheck.ps1`, `typecheck-capture.ps1`, `typecheck-tmp.ps1`, `verify-rename.ps1` | 14 |
| Audit/check/build | `audit-cursed-items.js`, `audit-monsters.js`, `audit-monsters-detail.js`, `audit-subclass-levels.js`, `benchmark.ts`, `benchmark-baseline.json`, `build-rulebook-md.js`, `check-monsters.js`, `check-refs.js`, `check-sources.js`, `convert-maps.js`, `detect-mm-sections.js`, `extract-mm-data.js`, `find-dupes.js`, `find-missing-mm.js`, `find-preset-candidates.js`, `scan-2014-spells.js`, `update-creatures.js`, `update-spell-format-2024.js`, `update-spells.js`, `validate-data.js`, `add-lair-actions.js`, `add-missing-monsters.js` | 23 |

### 2e. Deleted Data Files (2 files)

| File | Reason |
|------|--------|
| `src/renderer/public/data/5e/magic-item-tables.json` | Data merged into `treasure-tables.json`; `TreasureGeneratorModal.tsx` uses optional chaining safely |
| `src/renderer/public/data/5e/vehicles.json` | Data served from `mounts.json` via `data-provider.ts` `load5eVehicles()` |

### 2f. Deleted Component (1 file)

| File | Reason |
|------|--------|
| `src/renderer/src/components/game/ChatPanel.tsx` | Relocated to `components/game/bottom/ChatPanel.tsx` and `components/lobby/ChatPanel.tsx`; all imports updated correctly |

---

## 3. UNUSED TYPE FILE

### `src/renderer/src/types/vehicle.ts`

- Contains `VehicleData` and `MountState` interfaces
- **Never imported anywhere** in the entire codebase (confirmed via grep for `from.*vehicle`, `import.*VehicleData`, `import.*MountState` — zero matches)
- `VehicleStatBlock` in `src/renderer/src/types/mount.ts` and `MountedCombatState` serve the same purpose
- `data-provider.ts` `load5eVehicles()` imports from `types/mount`, not `types/vehicle`

**Action**: Delete entirely.

---

## 4. ORPHANED TEST FILE

### `src/renderer/src/services/json-schema.test.ts`

- Tests JSON data schema validation against TypeScript interfaces
- No corresponding `json-schema.ts` source file exists — it's a standalone validation test
- Imports from `vitest` and `fs` only, not from any project service module
- Still runs successfully and validates data files are well-formed

**Status**: Keep as-is. It's a standalone data validation test, not a truly orphaned test. Noted here for completeness.

---

## 5. UNUSED NPM DEPENDENCIES

| Package | Location in `package.json` | Used in source code? | Notes |
|---------|---------------------------|---------------------|-------|
| `pdf-lib` (^1.17.1) | `devDependencies` (line 47) | **No** | Was used by deleted `scripts/split-*.js` files |
| `pdf-parse` (^2.4.5) | `devDependencies` (line 48) | **No** | Was used by deleted `scripts/extract-*.js` files |
| `rollup-plugin-visualizer` (^6.0.5) | `devDependencies` (line 49) | **Yes** | Used in `electron.vite.config.ts` — keep |

**Action**: Remove `pdf-lib` and `pdf-parse` from `devDependencies`.

---

## 6. GIT STAGING vs ON-DISK MISMATCH

Git status shows renames to directory paths that don't match actual on-disk locations. The `DATA_PATHS` in `data-provider.ts` correctly point to the real on-disk locations. The git staging area has stale rename tracking.

| Git says renamed to | Actual on-disk location |
|--------------------|------------------------|
| `creatures/npc-names.json` | `npc/npc-names.json` |
| `world/bastion-facilities.json` | `bastions/bastion-facilities.json` |
| `flavor/sounds.json` | `audio/sounds.json` |
| `flavor/supernatural-gifts.json` | `equipment/supernatural-gifts.json` |

**Action**: `git reset` the affected renamed files and re-add them with correct paths.

---

## 7. DATA FILE TS → JSON MIGRATION STATUS

TypeScript data files in `src/renderer/src/data/` were migrated to load from JSON via `data-provider.ts`. The `.ts` files now serve as **thin wrappers** that export runtime-populated arrays.

| TS Wrapper | Loads from JSON | Status |
|-----------|----------------|--------|
| `conditions.ts` | `hazards/conditions.json` | Wrapper — keep |
| `effect-definitions.ts` | `mechanics/effect-definitions.json` | Wrapper — keep |
| `alignment-descriptions.ts` | `npc/alignment-descriptions.json` | Wrapper — keep |
| `bastion-events.ts` | `bastions/bastion-events.json` | Wrapper — keep |
| `calendar-presets.ts` | `world/calendar-presets.json` | Wrapper — keep |
| `npc-appearance.ts` | `npc/npc-appearance.json` | Wrapper — keep |
| `npc-mannerisms.ts` | `npc/npc-mannerisms.json` | Wrapper — keep |
| `personality-tables.ts` | `npc/personality-tables.json` | Wrapper — keep |
| `xp-thresholds.ts` | `mechanics/xp-thresholds.json` | Wrapper — keep |
| `language-descriptions.ts` | `mechanics/languages.json` | Wrapper — keep |
| `light-sources.ts` | `equipment/light-sources.json` | Wrapper — keep |
| `sentient-items.ts` | `equipment/sentient-items.json` | Wrapper — keep |
| `skills.ts` | `mechanics/skills.json` | Wrapper — keep |
| `starting-equipment-table.ts` | `character/starting-equipment.json` | Wrapper — keep |
| `variant-items.ts` | `equipment/variant-items.json` | Wrapper — keep |
| `weapon-mastery.ts` | `mechanics/weapon-mastery.json` | Wrapper — keep |
| `wearable-items.ts` | `equipment/wearable-items.json` | Wrapper — keep |
| `weather-tables.ts` | `world/weather-generation.json` | Wrapper — keep |

**Status**: Migration complete. TS files are intentional thin wrappers, not duplicates. No action needed.

---

## 8. VERIFIED CLEAN — No Issues Found

The following areas were audited and confirmed clean:

| Category | Status |
|----------|--------|
| **57 JSON data files** on disk | All match `DATA_PATHS` in `data-provider.ts` |
| **81 IPC channels** | All properly used in both main and renderer (169 references) |
| **50+ preload APIs** | All used — no orphaned bridge methods |
| **All routes in `App.tsx`** | Reference existing components |
| **10 Zustand stores** | All actively used |
| **ChatPanel relocation** | Old imports all updated to new locations |
| **New files** (`file-reader.ts`, `web-search.ts`, 19 JSON data files, `sounds/`) | All properly integrated |
| **Inline styles** | None — Tailwind CSS only |
| **PF2e remnants** | None — fully cleaned in earlier phases |
| **Empty directories** | None |
| **Config files** (biome, electron-vite, vitest, tsconfig, electron-builder) | All actively used |
| **`adventure-loader.ts`** | Fetches from `./data/5e/adventures/adventures.json` — file exists, path correct |
| **Map images** | All 15 built-in maps exist at `data/5e/maps/` |
| **`scripts/build-chunk-index.js`** | Still referenced in `package.json` `prebuild:index` — keep |

---

## Action Summary

| # | Action | Severity | Files Affected |
|---|--------|----------|---------------|
| 1 | Fix `srd-provider.ts` paths (lines 127, 136, 146) | CRITICAL | 1 |
| 2 | Fix `context-builder.ts` paths (lines 19-21) | CRITICAL | 1 |
| 3 | Commit 90+ deleted files | HIGH | 90+ |
| 4 | Remove `pdf-lib` and `pdf-parse` from `package.json` | MEDIUM | 1 |
| 5 | Delete `src/renderer/src/types/vehicle.ts` | MEDIUM | 1 |
| 6 | Reset and re-stage git renames to match on-disk paths | LOW | ~10 |
| 7 | Keep `json-schema.test.ts` as standalone validation | INFO | 0 |
| 8 | Keep TS wrapper files (intentional thin wrappers) | INFO | 0 |
