# Project Audit Report
Generated: 2026-02-25T20:51:35.163Z

## Summary Dashboard
| # | Check | Category | Status | Issues | Time |
|---|-------|----------|--------|--------|------|
| 1 | TypeScript type-check | Core Quality | ✅ PASS | 0 | 1.4s |
| 2 | Biome lint | Core Quality | ✅ PASS | 0 | 3.4s |
| 3 | Biome format check | Core Quality | ✅ PASS | 0 | 1.6s |
| 4 | Unit tests | Core Quality | ✅ PASS | 0 | 4.3s |
| 5 | Test coverage | Core Quality | ✅ PASS | 0 | 5.7s |
| 6 | Production build | Core Quality | ✅ PASS | 0 | 16.2s |
| 7 | OxLint | Core Quality | ✅ PASS | 2 | 1.1s |
| 8 | npm audit | Security | ✅ PASS | 0 | 1.4s |
| 9 | Lockfile lint | Security | ✅ PASS | 0 | 1.3s |
| 10 | Electron security scan | Security | ✅ PASS | 0 | 0.0s |
| 11 | Hardcoded secrets scan | Security | ✅ PASS | 0 | 0.1s |
| 12 | eval() / new Function() | Security | ✅ PASS | 0 | 0.1s |
| 13 | dangerouslySetInnerHTML | Security | ✅ PASS | 0 | 0.1s |
| 14 | Circular dependencies | Dependencies | ⚠️ WARN | 3 | 8.8s |
| 15 | Dead code (knip) | Dependencies | ✅ PASS | 844 | 3.5s |
| 16 | Outdated packages | Dependencies | ℹ️ INFO | 14 | 2.2s |
| 17 | License compliance | Dependencies | ✅ PASS | 0 | 2.3s |
| 18 | Unused exports (ts-prune) | Dependencies | ✅ PASS | 0 | 1.3s |
| 19 | Duplicate packages | Dependencies | ⚠️ WARN | 53 | 1.5s |
| 20 | React hooks lint (OxLint) | React & Hooks | ⚠️ WARN | 1 | 1.0s |
| 21 | Missing export default on lazy components | React & Hooks | ✅ PASS | 0 | 0.0s |
| 22 | Missing key prop in .map() | React & Hooks | ⚠️ WARN | 5 | 0.1s |
| 32 | CRLF line endings | Code Quality | ✅ PASS | 0 | 0.1s |
| 33 | console.log leaks | Code Quality | ⚠️ WARN | 8 | 0.1s |
| 34 | TODO/FIXME/HACK count | Code Quality | ✅ PASS | 0 | 0.1s |
| 35 | Large files (>500 lines) | Code Quality | ⚠️ WARN | 60 | 0.1s |
| 36 | `any` type usage | Code Quality | ✅ PASS | 2 | 0.1s |
| 37 | Empty catch blocks | Code Quality | ✅ PASS | 0 | 0.1s |
| 38 | Functions >100 lines | Code Quality | ⚠️ WARN | 74 | 0.2s |
| 39 | Code duplication (jscpd) | Code Quality | ⚠️ WARN | 117 | 19.5s |
| 40 | Regex safety (ReDoS) | Code Quality | ✅ PASS | 0 | 0.1s |
| 41 | Git status (uncommitted changes) | Project Hygiene | ℹ️ INFO | 456 | 0.1s |
| 42 | File naming conventions | Project Hygiene | ✅ PASS | 1 | 0.0s |
| 43 | Missing test files | Project Hygiene | ℹ️ INFO | 201 | 0.0s |
| 44 | Orphan files (not imported) | Project Hygiene | ⚠️ WARN | 64 | 9.2s |
| 45 | Type coverage % | Project Hygiene | ⚠️ WARN | 0 | 32.3s |

**Total: 0 errors, 10 warnings, 3 informational**

---

## Detailed Results

### Core Quality

#### 1. TypeScript type-check
**Status**: ✅ PASS  
**Issues**: 0

```
0 errors across all projects
```

#### 2. Biome lint
**Status**: ✅ PASS  
**Issues**: 0

```
No lint issues
```

#### 3. Biome format check
**Status**: ✅ PASS  
**Issues**: 0

```
All files formatted
```

#### 4. Unit tests
**Status**: ✅ PASS  
**Issues**: 0

```
29 passed, 0 failed

```

#### 5. Test coverage
**Status**: ✅ PASS  
**Issues**: 0

```
Statement coverage: 16.78%
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   16.78 |    15.48 |    15.1 |    16.5 |                   
 data              |    8.31 |     4.68 |   11.01 |    8.19 |                   
  ...scriptions.ts |       0 |      100 |       0 |       0 | 3-7               
  ...ion-events.ts |       0 |        0 |       0 |       0 | 13-287            
  ...ar-presets.ts |       0 |        0 |       0 |       0 | 11-52             
  ...-resources.ts |       0 |        0 |       0 |       0 | 8-101             
  conditions.ts    |      88 |     87.5 |      70 |   86.36 | 42-43,62          
  ...efinitions.ts |   18.51 |        0 |   14.28 |   21.73 | 12-56             
  ...scriptions.ts |       0 |        0 |       0 |       0 | 3-9               
  light-sources.ts |       0 |        0 |       0 |       0 | 9-20              
  moderation.ts    |   16.66 |      100 |       0 |   16.66 | 6-11              
  ...appearance.ts |       0 |        0 |       0 |       0 | 3-17              
  ...mannerisms.ts |       0 |        0 |       0 |       0 | 3-9               
  ...ity-tables.ts |       0 |        0 |       0 |       0 | 4-62              
  ...ient-items.ts |       0 |        0 |       0 |       0 | 7-65              
  skills.ts        |       0 |        0 |       0 |       0 | 11-40             
  ...-resources.ts |       0 |        0 |       0 |       0 | 8-75              
```

#### 6. Production build
**Status**: ✅ PASS  
**Issues**: 0

```
Build succeeded
```

#### 7. OxLint
**Status**: ✅ PASS  
**Issues**: 2

```

  ! eslint(no-unused-vars): Catch parameter '_error' is caught but never used.
     ,-[src/preload/index.ts:188:12]
 187 |     contextBridge.exposeInMainWorld('api', api)
 188 |   } catch (_error) {
     :            ^^^|^^
     :               `-- '_error' is declared here
 189 |     /* console suppressed in preload */
     `----
  help: Consider handling this error.

  ! eslint-plugin-unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary
     ,-[src/renderer/src/services/character/build-tree-5e.ts:261:47]
 260 |   const slots: BuildSlot[] = []
 261 |   const classLvls: Record<string, number> = { ...(existingClassLevels ?? {}) }
     :                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 262 | 
     `----
  help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.

  ! oxc(const-comparisons): Left-hand side of `&&` operator has no effect.
    ,-[src/renderer/src/services/character/build-tree-5e.test.ts:88:54]
 87 |     // Count should match the delta
 88 |     const expectedNewSlots = fullSlots.filter((s) => s.level > 0 && s.level > 5 && !currentSlotIds.has(s.id))
    :                                                      ^^^^^|^^^^^    ^^^^^|^^^^^
    :                                                           |              `-- If this evaluates to `true`
    :                                                           `-- This will always evaluate to true.
 89 |     expect(levelUpSlots).toHaveLength(expectedNewSlots.length)
    `----
  help: if `s.level > 5` evaluates to true, `s.level > 0` will always evaluate to true as well

  ! eslint(no-unused-vars): Parameter 'campaign' is declared but never used. Unused parameters should start with a '_'.
    ,-[src/renderer/src/components/game/bottom/ChatPanel.tsx:81:3]
 80 |   playerName,
 81 |   campaign,
    :   ^^^^|^^^
    :       `-- 'campaign' is declared here
 82 |   character,
    `----
  help: Consider removing this parameter.

  ! eslint-plugin-unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary
     ,-[src/renderer/src/components/game/sidebar/StatBlockForm.tsx:202:21]
 201 |     if (!sb.spellcasting) return
 202 |     const slots = { ...(sb.spellcasting.slots ?? {}) }
     :                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 203 |     const numVal = parseInt(value, 10)
     `----
  help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.

  ! eslint-plugin-unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary
      ,-[src/renderer/src/stores/use-level-up-store.ts:1189:36]
 1188 |   const updatedSkills = character.skills.map((s) => ({ ...s }))
 1189 |   const mergedExpertiseChoices = { ...(character.buildChoices.expertiseChoices ?? {}) }
      :                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

### Security

#### 8. npm audit
**Status**: ✅ PASS  
**Issues**: 0

```
found 0 vulnerabilities

```

#### 9. Lockfile lint
**Status**: ✅ PASS  
**Issues**: 0

```
Lockfile is valid
```

#### 10. Electron security scan
**Status**: ✅ PASS  
**Issues**: 0

```
**nodeIntegration must be false**: PASS

**contextIsolation must be true**: PASS

**sandbox must be true**: PASS

**CSP headers present**: PASS

**webSecurity not disabled**: PASS

**shell.openExternal validated**: PASS

**IPC channel validation**: PASS

**No allowRunningInsecureContent**: PASS

**Preload script isolation**: PASS

```

#### 11. Hardcoded secrets scan
**Status**: ✅ PASS  
**Issues**: 0

```
No hardcoded secrets found
```

#### 12. eval() / new Function()
**Status**: ✅ PASS  
**Issues**: 0

```
No eval/Function usage
```

#### 13. dangerouslySetInnerHTML
**Status**: ✅ PASS  
**Issues**: 0

```
No dangerouslySetInnerHTML usage
```

### Dependencies

#### 14. Circular dependencies
**Status**: ⚠️ WARN  
**Issues**: 3

```
Processed 553 files (7.6s) (2 warnings)
1) renderer/src/stores/use-network-store.ts > renderer/src/network/game-sync.ts > renderer/src/stores/use-game-store.ts > renderer/src/stores/game/index.ts > renderer/src/stores/game/conditions-slice.ts > renderer/src/stores/use-lobby-store.ts
2) renderer/src/stores/use-ai-dm-store.ts > renderer/src/services/game-action-executor.ts
```

#### 15. Dead code (knip)
**Status**: ✅ PASS  
**Issues**: 844

```
[93m[4mUnused files[24m[39m (411)
electron.vite.config.ts                                                    
Tests/electron-security.js                                                 
Tests/rename-to-kebab.js                                                   
Tests/replace-console-logs.js                                              
Tests/run-audit.js                                                         
src/main/index.ts                                                          
src/main/updater.ts                                                        
src/preload/index.d.ts                                                     
src/preload/index.ts                                                       
src/shared/ipc-channels.ts                                                 
src/shared/ipc-schemas.ts                                                  
src/main/ai/ai-service.ts                                                  
src/main/ai/chunk-builder.ts                                               
src/main/ai/conversation-manager.ts                                        
src/main/ai/dm-actions.ts                                                  
src/main/ai/dm-system-prompt.ts                                            
src/main/ai/ollama-client.ts                                               
src/main/ai/ollama-manager.ts                                              
src/main/ai/stat-mutations.ts                                              
src/main/ai/web-search.ts                                                  
src/renderer/src/App.tsx                                                   
src/renderer/src/env.d.ts                                                  
src/renderer/src/global.d.ts                                               
src/renderer/src/main.tsx                                                  
src/main/storage/ai-conversation-storage.ts                                
src/main/storage/bastion-storage.ts                                        
src/main/storage/cloud-sync.ts                                             
src/main/storage/custom-creature-storage.ts                                
src/main/storage/game-state-storage.ts                                     
src/main/storage/homebrew-storage.ts                                       
src/main/storage/settings-storage.ts                                       
src/main/ipc/ai-handlers.ts                                                
src/main/ipc/audio-handlers.ts                                             
src/main/ipc/index.ts                                                      
BMO-setup/pi/static/css/bmo.css                                            
BMO-setup/pi/static/js/alpine.min.js                                       
BMO-setup/pi/static/js/bmo.js                                              
BMO-setup/pi/static/js/socket.io.min.js                                    
BMO-setup/pi/static/js/tailwind.js                                         
src/renderer/src/constants/index.ts                                        
src/renderer/src/constants/spell-schools.ts                                
src/renderer/src/data/alignment-descriptions.ts                            
src/renderer/src/data/bastion-events.ts                                    
src/renderer/src/data/calendar-presets.ts                                  
src/renderer/src/data/class-resources.ts                                   
src/renderer/src/data/language-descriptions.ts                             
src/renderer/src/data/light-sources.ts                                     
src/renderer/src/data/npc-appearance.ts                                    
src/renderer/src/data/npc-mannerisms.ts                                    
src/renderer/src/data/personality-tables.ts                                
src/renderer/src/data/sentient-items.ts                                    
src/renderer/src/data/skills.ts                                            
src/render
```

#### 16. Outdated packages
**Status**: ℹ️ INFO  
**Issues**: 14

```
 @aws-sdk/client-s3        ^3.997.0  →  ^3.998.0
 @biomejs/biome              ^2.4.2  →    ^2.4.4
 @tailwindcss/vite          ^4.1.18  →    ^4.2.1
 @tanstack/react-virtual   ^3.13.18  →  ^3.13.19
 @types/node                ^25.2.3  →   ^25.3.0
 @types/react              ^19.2.13  →  ^19.2.14
 @types/three              ^0.183.0  →  ^0.183.1
 @types/uuid                ^10.0.0  →   ^11.0.0
 electron                   ^40.2.1  →   ^40.6.1
 electron-builder           ^26.7.0  →   ^26.8.1
 react-router               ^7.13.0  →   ^7.13.1
 rollup-plugin-visualizer    ^6.0.5  →    ^7.0.0
 tailwindcss                ^4.1.18  →    ^4.2.1
 three                     ^0.183.0  →  ^0.183.1
```

#### 17. License compliance
**Status**: ✅ PASS  
**Issues**: 0

```
No copyleft licenses in production deps
```

#### 18. Unused exports (ts-prune)
**Status**: ✅ PASS  
**Issues**: 0

```
No unused exports
```

#### 19. Duplicate packages
**Status**: ⚠️ WARN  
**Issues**: 53

```
53 packages with multiple versions installed
```

### React & Hooks

#### 20. React hooks lint (OxLint)
**Status**: ⚠️ WARN  
**Issues**: 1

```

  ! oxc(const-comparisons): Left-hand side of `&&` operator has no effect.
    ,-[src/renderer/src/services/character/build-tree-5e.test.ts:88:54]
 87 |     // Count should match the delta
 88 |     const expectedNewSlots = fullSlots.filter((s) => s.level > 0 && s.level > 5 && !currentSlotIds.has(s.id))
    :                                                      ^^^^^|^^^^^    ^^^^^|^^^^^
    :                                                           |              `-- If this evaluates to `true`
    :                                                           `-- This will always evaluate to true.
 89 |     expect(levelUpSlots).toHaveLength(expectedNewSlots.length)
    `----
  help: if `s.level > 5` evaluates to true, `s.level > 0` will always evaluate to true as well

  ! eslint(no-unused-vars): Catch parameter '_error' is caught but never used.
     ,-[src/preload/index.ts:188:12]
 187 |     contextBridge.exposeInMainWorld('api', api)
 188 |   } catch (_error) {
     :            ^^^|^^
     :               `-- '_error' is declared here
 189 |     /* console suppressed in preload */
     `----
  help: Consider handling this error.

  ! eslint(no-unused-vars): Parameter 'realWeapons' is declared but never used. Unused parameters should start with a '_'.
    ,-[src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx:25:3]
 24 |   weapons,
 25 |   realWeapons,
    :   ^^^^^|^^^^^
    :        `-- 'realWeapons' is declared here
 26 |   character,
    `----
  help: Consider removing this parameter.

  ! eslint(no-unused-vars): Parameter 'character' is declared but never used. Unused parameters should start with a '_'.
    ,-[src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx:26:3]
 25 |   realWeapons,
 26 |   character,
    :   ^^^^|^^^^
    :       `-- 'character' is declared here
 27 |   strMod,
    `----
  help: Consider removing this parameter.

  ! eslint(no-unused-vars): Parameter 'isOffhandAttack' is declared but never used. Unused parameters should start with a '_'.
     ,-[src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx:548:3]
 547 |   isUnarmed,
 548 |   isOffhandAttack,
     :   ^^^^^^^|^^^^^^^
     :          `-- 'isOffhandAttack' is declared here
 549 |   getDamageMod,
     `----
  help: Consider removing this parameter.

  ! eslint(no-unused-vars): Parameter 'onClose' is declared but never used. Unused parameters should start with a '_'.
     ,-[src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx:558:3]
 557 |   onBroadcastMiss,
 558 |   onClose,
     :   ^^^|^^^
     :      `-- 'onClose' is declared here
 559 |   getMasteryEffect
     `----
  help: Consider removing this parameter.

  ! eslint-plugin-unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary
     ,-[src/renderer/src/services/character/build-tree-5e.ts:261:47]
 260 |   const slots: BuildSlot[] = []
 261 |   const classLvls: Record<string, number> = { ...(existingClassLevels ?? {})
```

#### 21. Missing export default on lazy components
**Status**: ✅ PASS  
**Issues**: 0

```
All 15 lazy components have default exports
```

#### 22. Missing key prop in .map()
**Status**: ⚠️ WARN  
**Issues**: 5

```
src/renderer/src/components/game/dm/StatBlockEditor.tsx:166 — onChange={(e) => onChange(traits.map((t, idx) => (idx === i ? { ...t, name: e.target.value } : t)))}
src/renderer/src/components/game/dm/StatBlockEditor.tsx:173 — onChange={(e) => onChange(traits.map((t, idx) => (idx === i ? { ...t, description: e.target.value } 
src/renderer/src/components/game/modals/dm-tools/DMMapEditor.tsx:575 — const maps = gameStore.maps.map((m) => (m.id === activeMap.id ? { ...m, grid: newGrid } : m))
src/renderer/src/components/game/modals/dm-tools/GridSettingsModal.tsx:31 — maps: state.maps.map((m) => (m.id === activeMap.id ? { ...m, grid: { ...m.grid, ...updates } } : m))
src/renderer/src/pages/campaign-detail/LoreManager.tsx:69 — const updated = lore.map((l) => (l.id === loreId ? { ...l, isVisibleToPlayers: !l.isVisibleToPlayers
```

### Code Quality

#### 32. CRLF line endings
**Status**: ✅ PASS  
**Issues**: 0

```
All files use LF
```

#### 33. console.log leaks
**Status**: ⚠️ WARN  
**Issues**: 8

```
src/main/index.ts:13 — console.error('[Main] Uncaught exception:', error)
src/main/index.ts:20 — console.error('[Main] Unhandled rejection:', reason)
src/main/index.ts:44 — console.error('[Main] Failed to load app icon from:', iconPath)
src/renderer/src/utils/logger.ts:5 — if (isDev) console.debug('[DEBUG]', ...args)
src/renderer/src/utils/logger.ts:8 — if (isDev) console.info('[INFO]', ...args)
src/renderer/src/utils/logger.ts:11 — if (isDev) console.warn('[WARN]', ...args)
src/renderer/src/utils/logger.ts:14 — if (isDev) console.error('[ERROR]', ...args)
src/renderer/src/utils/logger.ts:17 — if (isDev) console.log(...args)
```

#### 34. TODO/FIXME/HACK count
**Status**: ✅ PASS  
**Issues**: 0

```
No developer notes
```

#### 35. Large files (>500 lines)
**Status**: ⚠️ WARN  
**Issues**: 60

```
src/renderer/src/components/game/GameLayout.tsx — 1624 lines
src/renderer/src/stores/use-level-up-store.ts — 1317 lines
src/renderer/src/stores/builder/slices/save-slice-5e.ts — 1192 lines
src/renderer/src/pages/CampaignDetailPage.tsx — 1183 lines
src/renderer/src/pages/bastion/BastionModals.tsx — 1120 lines
src/renderer/src/components/game/map/MapCanvas.tsx — 1087 lines
src/renderer/src/components/sheet/5e/DefenseSection5e.tsx — 1069 lines
src/renderer/src/services/data-provider.ts — 975 lines
src/renderer/src/components/levelup/5e/LevelSelectors5e.tsx — 940 lines
src/renderer/src/network/host-manager.ts — 932 lines
src/renderer/src/stores/use-network-store.ts — 908 lines
src/renderer/src/components/game/dm/InitiativeTracker.tsx — 903 lines
src/renderer/src/components/game/overlays/PlayerHUDOverlay.tsx — 889 lines
src/renderer/src/services/combat/combat-resolver.ts — 886 lines
src/renderer/src/components/game/modals/combat/AttackModal.tsx — 876 lines
src/renderer/src/types/data/index.ts — 832 lines
src/renderer/src/components/builder/5e/GearTab5e.tsx — 827 lines
src/renderer/src/components/game/modals/combat/AttackModalSteps.tsx — 824 lines
src/renderer/src/components/game/modals/dm-tools/DMRollerModal.tsx — 807 lines
src/renderer/src/components/sheet/5e/OffenseSection5e.tsx — 783 lines
src/renderer/src/components/game/sidebar/QuickReferencePanel.tsx — 763 lines
src/renderer/src/components/game/modals/dm-tools/DMShopModal.tsx — 752 lines
src/renderer/src/services/json-schema.test.ts — 751 lines
src/renderer/src/components/builder/5e/DetailsTab5e.tsx — 716 lines
src/renderer/src/stores/use-bastion-store.ts — 715 lines
src/renderer/src/components/game/dm/StatBlockEditor.tsx — 708 lines
src/renderer/src/components/builder/5e/SpellsTab5e.tsx — 684 lines
src/renderer/src/components/sheet/5e/CombatStatsBar5e.tsx — 675 lines
src/renderer/src/components/game/modals/utility/InGameCalendarModal.tsx — 671 lines
src/renderer/src/services/combat/attack-resolver.ts — 658 lines
src/renderer/src/services/chat-commands/commands-dm-map.ts — 644 lines
src/renderer/src/components/game/GameModalDispatcher.tsx — 641 lines
src/renderer/src/components/game/sidebar/StatBlockForm.tsx — 640 lines
src/main/ai/dm-system-prompt.ts — 623 lines
src/renderer/src/components/sheet/5e/MagicItemsPanel5e.tsx — 622 lines
src/renderer/src/components/levelup/5e/LevelUpWizard5e.tsx — 602 lines
src/renderer/src/services/game-actions/creature-actions.ts — 602 lines
src/renderer/src/services/calendar-service.ts — 601 lines
src/renderer/src/components/sheet/5e/SpellcastingSection5e.tsx — 598 lines
src/renderer/src/services/sound-manager.ts — 596 lines
src/renderer/src/components/game/modals/dm-tools/DMMapEditor.tsx — 594 lines
src/renderer/src/pages/bastion/BastionTabs.tsx — 593 lines
src/renderer/src/pages/LobbyPage.tsx — 588 lines
src/renderer/src/components/sheet/5e/CraftingSection5e.tsx — 583 lines
src/main/ai/ai-service.ts — 581 lines
src/renderer/src/components/game/modals/mechanics/RestModal.tsx — 559 lines
src/renderer/src/components/game/dice3d/dice-meshes.ts — 545 lines
src/renderer/src/services/chat-commands/commands-player-combat.ts — 537 lines
src/renderer/src/services/io/import-export.ts — 535 lines
src/renderer/src/services/character/stat-calculator-5e.ts — 530 lines
src/renderer/src/components/game/bottom/DMTabPanel.tsx — 523 lines
src/renderer/src/components/game/modals/dm-tools/TreasureGeneratorModal.tsx — 523 lines
src/renderer/src/components/sheet/shared/PrintSheet.tsx — 514 lines
src/renderer/src/network/types.ts — 512 lines
src/renderer/src/components/sheet/5e/CharacterTraitsPanel5e.tsx — 509 lines
src/renderer/src/components/sheet/5e/FeaturesSection5e.tsx — 508 lines
src/renderer/src/pages/LibraryPage.tsx — 507 lines
src/renderer/src/components/game/modals/combat/ChaseTrackerModal.tsx — 506 lines
src/renderer/src/components/ui/OllamaManagement.tsx — 504 lines
src/renderer/src/services/combat/attack-resolver.test.ts — 504 lines
```

#### 36. `any` type usage
**Status**: ✅ PASS  
**Issues**: 2

```
src/renderer/src/services/io/game-auto-save.ts:130 — useGameStore.getState().loadGameState(data as any)
src/renderer/src/stores/use-network-store.ts:862 — .loadGameState(data as any)
```

#### 37. Empty catch blocks
**Status**: ✅ PASS  
**Issues**: 0

```
No empty catch blocks
```

#### 38. Functions >100 lines
**Status**: ⚠️ WARN  
**Issues**: 74

```
src/renderer/src/pages/CampaignDetailPage.tsx:24 — CampaignDetailPage (1159 lines)
src/renderer/src/stores/builder/slices/save-slice-5e.ts:387 — buildCharacter5e (805 lines)
src/renderer/src/stores/use-bastion-store.ts:101 — useBastionStore (614 lines)
src/renderer/src/pages/LobbyPage.tsx:27 — LobbyPage (561 lines)
src/renderer/src/components/builder/5e/DetailsTab5e.tsx:185 — DetailsTab5e (531 lines)
src/renderer/src/stores/use-level-up-store.ts:153 — useLevelUpStore (484 lines)
src/renderer/src/components/game/GameModalDispatcher.tsx:162 — GameModalDispatcher (479 lines)
src/renderer/src/components/builder/5e/SpellsTab5e.tsx:208 — SpellsTab5e (469 lines)
src/renderer/src/components/ui/OllamaManagement.tsx:50 — OllamaManagement (454 lines)
src/renderer/src/pages/LibraryPage.tsx:80 — LibraryPage (422 lines)
src/renderer/src/components/builder/5e/CharacterBuilder5e.tsx:18 — CharacterBuilder5e (382 lines)
src/renderer/src/pages/CharacterSheet5ePage.tsx:31 — CharacterSheet5ePage (374 lines)
src/renderer/src/pages/BastionPage.tsx:17 — BastionPage (365 lines)
src/main/ipc/index.ts:80 — registerIpcHandlers (362 lines)
src/renderer/src/components/game/bottom/DMAudioPanel.tsx:35 — DMAudioPanel (352 lines)
src/renderer/src/components/builder/5e/SpecialAbilitiesTab5e.tsx:32 — SpecialAbilitiesTab5e (340 lines)
src/renderer/src/components/campaign/CampaignWizard.tsx:22 — CampaignWizard (339 lines)
src/renderer/src/components/game/player/ShopView.tsx:94 — ShopView (329 lines)
src/renderer/src/pages/AboutPage.tsx:48 — AboutPage (324 lines)
src/renderer/src/services/combat/combat-resolver.ts:226 — resolveAttack (302 lines)
src/renderer/src/components/builder/shared/AbilityScoreModal.tsx:16 — AbilityScoreModal (300 lines)
src/renderer/src/components/lobby/ChatInput.tsx:14 — ChatInput (300 lines)
src/renderer/src/pages/SettingsPage.tsx:36 — SettingsPage (296 lines)
src/main/ipc/ai-handlers.ts:25 — registerAiHandlers (288 lines)
src/renderer/src/stores/use-network-store.ts:526 — handleClientMessage (287 lines)
src/renderer/src/stores/use-network-store.ts:74 — useNetworkStore (279 lines)
src/renderer/src/stores/use-lobby-store.ts:90 — useLobbyStore (277 lines)
src/renderer/src/pages/CalendarPage.tsx:53 — CalendarPage (276 lines)
src/renderer/src/stores/use-ai-dm-store.ts:95 — useAiDmStore (276 lines)
src/renderer/src/stores/builder/slices/save-slice-5e.ts:124 — loadCharacterForEdit5e (262 lines)
src/renderer/src/services/library-service.ts:148 — loadCategoryItems (239 lines)
src/main/ai/campaign-context.ts:11 — formatCampaignForContext (236 lines)
src/renderer/src/services/combat/effect-resolver-5e.ts:103 — resolveEffects (236 lines)
src/renderer/src/pages/InGamePage.tsx:14 — InGamePage (227 lines)
src/renderer/src/pages/ViewCharactersPage.tsx:12 — ViewCharactersPage (216 lines)
src/renderer/src/pages/JoinGamePage.tsx:10 — JoinGamePage (205 lines)
src/renderer/src/components/game/dm/DMNotepad.tsx:6 — DMNotepad (202 lines)
src/renderer/src/components/builder/5e/CharacterSummaryBar5e.tsx:118 — CharacterSummaryBar5e (194 lines)
src/main/ai/character-context.ts:52 — formatCharacter5e (192 lines)
src/renderer/src/services/io/import-export.ts:336 — importDndBeyondCharacter (178 lines)
src/main/ai/ai-service.ts:304 — handleStreamCompletion (176 lines)
src/renderer/src/components/builder/5e/LanguagesTab5e.tsx:74 — LanguagesTab5e (172 lines)
src/renderer/src/services/game-action-executor.ts:158 — executeOne (170 lines)
src/renderer/src/stores/use-network-store.ts:356 — handleHostMessage (167 lines)
src/renderer/src/components/game/map/token-sprite.ts:44 — createTokenSprite (165 lines)
src/renderer/src/services/game-actions/state-snapshot.ts:7 — buildGameStateSnapshot (164 lines)
src/renderer/src/pages/LevelUp5ePage.tsx:12 — LevelUp5ePage (159 lines)
src/renderer/src/components/builder/shared/AsiModal.tsx:6 — AsiModal (157 lines)
src/renderer/src/services/character/build-tree-5e.ts:82 — generate5eBuildSlots (153 lines)
src/renderer/src/components/game/dm/ShopPanel.tsx:81 — ShopPanel (152 lines)
src/renderer/src/services/combat/attack-condition-effects.ts:59 — getAttackConditionEffects (152 lines)
src/renderer/src/network/client-manager.ts:212 — attemptConnection (145 lines)
src/renderer/src/App.tsx:25 — App (141 lines)
src/renderer/src/components/builder/shared/SkillsModal.tsx:11 — SkillsModal (141 lines)
src/renderer/src/components/game/dice3d/DiceTray.tsx:41 — DiceTray (139 lines)
src/main/ai/stat-mutations.ts:130 — applyChange (138 lines)
src/renderer/src/network/host-manager.ts:693 — handleNewConnection (136 lines)
src/renderer/src/stores/game/index.ts:16 — useGameStore (130 lines)
src/main/ai/context-builder.ts:113 — buildContext (128 lines)
src/renderer/src/services/character/rest-service-5e.ts:338 — applyLongRest (128 lines)
src/renderer/src/components/lobby/PlayerList.tsx:9 — PlayerList (126 lines)
src/renderer/src/services/character/feat-mechanics-5e.ts:16 — getActiveFeatMechanics (126 lines)
src/renderer/src/components/builder/5e/GearTab5e.tsx:596 — HigherLevelEquipmentSection (125 lines)
src/renderer/src/services/character/build-tree-5e.ts:244 — generate5eLevelUpSlots (125 lines)
src/renderer/src/stores/use-character-store.ts:21 — useCharacterStore (125 lines)
src/renderer/src/services/character/rest-service-5e.ts:170 — applyShortRest (121 lines)
src/renderer/src/network/game-sync.ts:54 — startGameSync (116 lines)
src/renderer/src/components/game/sidebar/QuickReferencePanel.tsx:330 — SpellsTab (112 lines)
src/main/ipc/audio-handlers.ts:23 — registerAudioHandlers (109 lines)
src/renderer/src/components/builder/5e/GearTab5e.tsx:722 — GearTab5e (105 lines)
src/renderer/src/components/game/modals/utility/RulingApprovalModal.tsx:8 — RulingApprovalModal (104 lines)
src/renderer/src/components/game/sidebar/QuickReferencePanel.tsx:588 — EquipmentTab (104 lines)
src/renderer/src/data/bastion-events.ts:160 — rollBastionEvent (103 lines)
src/renderer/src/stores/use-campaign-store.ts:26 — useCampaignStore (103 lines)
```

#### 39. Code duplication (jscpd)
**Status**: ⚠️ WARN  
**Issues**: 117

```
Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\mechanics\RestModal.tsx[39m[22m [184:11 - 201:15] (17 lines, 122 tokens)
   [1m[32msrc\renderer\src\components\game\modals\mechanics\RestModal.tsx[39m[22m [141:11 - 158:16]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\dm-tools\DMMapEditor.tsx[39m[22m [168:2 - 180:2] (12 lines, 108 tokens)
   [1m[32msrc\renderer\src\components\game\modals\dm-tools\DMMapEditor.tsx[39m[22m [118:7 - 129:8]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\dm-tools\DMMapEditor.tsx[39m[22m [186:12 - 200:3] (14 lines, 203 tokens)
   [1m[32msrc\renderer\src\components\game\modals\dm-tools\DMMapEditor.tsx[39m[22m [135:18 - 149:26]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\combat\FallingDamageModal.tsx[39m[22m [135:5 - 146:3] (11 lines, 78 tokens)
   [1m[32msrc\renderer\src\components\game\modals\utility\HelpModal.tsx[39m[22m [307:6 - 317:2]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\combat\AttackModal.tsx[39m[22m [98:10 - 112:7] (14 lines, 113 tokens)
   [1m[32msrc\renderer\src\components\game\modals\mechanics\MountModal.tsx[39m[22m [28:14 - 42:3]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\game\modals\combat\AttackModal.tsx[39m[22m [651:5 - 665:6] (14 lines, 108 tokens)
   [1m[32msrc\renderer\src\components\game\modals\combat\AttackModal.tsx[39m[22m [630:7 - 643:2]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\SpellcastingSection5e.tsx[39m[22m [259:20 - 269:17] (10 lines, 92 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\SpellcastingSection5e.tsx[39m[22m [238:16 - 248:13]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\SpellcastingSection5e.tsx[39m[22m [473:70 - 487:97] (14 lines, 119 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\SpellcastingSection5e.tsx[39m[22m [436:75 - 450:3]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\OffenseSection5e.tsx[39m[22m [415:2 - 426:7] (11 lines, 95 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\SpellcastingSection5e.tsx[39m[22m [204:2 - 216:11]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\MagicItemsPanel5e.tsx[39m[22m [114:29 - 129:9] (15 lines, 163 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\MagicItemsPanel5e.tsx[39m[22m [92:29 - 107:2]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\MagicItemsPanel5e.tsx[39m[22m [278:4 - 291:4] (13 lines, 140 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\MagicItemsPanel5e.tsx[39m[22m [251:2 - 262:4]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\FeaturesSection5e.tsx[39m[22m [176:5 - 187:17] (11 lines, 105 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\HighElfCantripSwapModal5e.tsx[39m[22m [98:5 - 164:15]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\EquipmentListPanel5e.tsx[39m[22m [64:5 - 82:10] (18 lines, 145 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\OffenseSection5e.tsx[39m[22m [279:5 - 297:8]

Clone found (typescript):
 - [1m[32msrc\renderer\src\components\sheet\5e\defense-utils.ts[39m[22m [128:1 - 153:2] (25 lines, 243 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\equipment-utils.ts[39m[22m [43:1 - 68:2]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\CraftingSection5e.tsx[39m[22m [91:1 - 110:2] (19 lines, 272 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\OffenseSection5e.tsx[39m[22m [33:1 - 51:2]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\CraftingSection5e.tsx[39m[22m [333:9 - 343:2] (10 lines, 89 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\EquipmentListPanel5e.tsx[39m[22m [185:7 - 325:5]

Clone found (tsx):
 - [1m[32msrc\renderer\src\components\sheet\5e\CombatStatsBar5e.tsx[39m[22m [125:5 
```

#### 40. Regex safety (ReDoS)
**Status**: ✅ PASS  
**Issues**: 0

```
No ReDoS-prone patterns found
```

### Project Hygiene

#### 41. Git status (uncommitted changes)
**Status**: ℹ️ INFO  
**Issues**: 456

```
 M .claude/settings.local.json
 M CLAUDE.md
 M electron.vite.config.ts
 M package-lock.json
 M package.json
 M src/main/ai/ai-service.ts
 M src/main/ai/campaign-context.ts
 M src/main/ai/character-context.ts
 M src/main/ai/chunk-builder.ts
 D src/main/ai/claude-client.ts
 M src/main/ai/context-builder.ts
 M src/main/ai/conversation-manager.ts
 M src/main/ai/dm-actions.ts
 M src/main/ai/dm-system-prompt.ts
 M src/main/ai/file-reader.test.ts
 M src/main/ai/file-reader.ts
 M src/main/ai/memory-manager.ts
 M src/main/ai/ollama-client.ts
 M src/main/ai/stat-mutations.ts
 M src/main/ai/types.ts
 M src/main/ai/web-search.ts
 M src/main/data/dnd-terms.json
 M src/main/data/token-budgets.json
 M src/main/data/tone-validation.json
 M src/main/index.ts
 M src/main/ipc/ai-handlers.ts
 M src/main/ipc/audio-handlers.ts
 M src/main/ipc/index.ts
 D src/main/ipc/voice-handlers.ts
R  src/main/storage/aiConversationStorage.ts -> src/main/storage/ai-conversation-storage.ts
```

#### 42. File naming conventions
**Status**: ✅ PASS  
**Issues**: 1

```
src/renderer/src/main.tsx — TSX file should be PascalCase
```

#### 43. Missing test files
**Status**: ℹ️ INFO  
**Issues**: 201

```
201 source files without test counterpart
src/main/ai/ai-service.ts
src/main/ai/campaign-context.ts
src/main/ai/character-context.ts
src/main/ai/chunk-builder.ts
src/main/ai/conversation-manager.ts
src/main/ai/dm-actions.ts
src/main/ai/dm-system-prompt.ts
src/main/ai/dnd-terms.ts
src/main/ai/keyword-extractor.ts
src/main/ai/memory-manager.ts
src/main/ai/ollama-client.ts
src/main/ai/ollama-manager.ts
src/main/ai/search-engine.ts
src/main/ai/srd-provider.ts
src/main/ai/stat-mutations.ts
src/main/ai/types.ts
src/main/ai/web-search.ts
src/main/ipc/ai-handlers.ts
src/main/ipc/audio-handlers.ts
src/main/log.ts
src/main/storage/ai-conversation-storage.ts
src/main/storage/bastion-storage.ts
src/main/storage/campaign-storage.ts
src/main/storage/character-storage.ts
src/main/storage/cloud-sync.ts
src/main/storage/custom-creature-storage.ts
src/main/storage/game-state-storage.ts
src/main/storage/homebrew-storage.ts
src/main/storage/settings-storage.ts
src/main/storage/types.ts
```

#### 44. Orphan files (not imported)
**Status**: ⚠️ WARN  
**Issues**: 64

```
main/ai/context-builder.test.ts
main/ai/file-reader.test.ts
main/ai/token-budget.test.ts
main/ai/tone-validator.test.ts
main/index.ts
main/storage/cloud-sync.ts
main/storage/migrations.test.ts
preload/index.d.ts
preload/index.ts
renderer/src/components/builder/5e/GearTab5e.tsx
renderer/src/components/game/dice3d/DiceColorPicker.tsx
renderer/src/components/game/dice3d/DiceHistory.tsx
renderer/src/components/game/dice3d/DiceRoller.tsx
renderer/src/components/game/map/audio-emitter-overlay.ts
renderer/src/components/game/map/combat-animations.ts
renderer/src/components/game/overlays/RollRequestOverlay.tsx
renderer/src/components/game/overlays/ThemeSelector.tsx
renderer/src/components/game/sidebar/CombatLogPanel.tsx
renderer/src/components/game/sidebar/JournalPanel.tsx
renderer/src/components/library/index.ts
renderer/src/components/sheet/shared/PrintSheet.tsx
renderer/src/constants/index.ts
renderer/src/data/conditions.test.ts
renderer/src/data/sentient-items.ts
renderer/src/data/xp-thresholds.test.ts
renderer/src/env.d.ts
renderer/src/global.d.ts
renderer/src/main.tsx
renderer/src/network/index.ts
renderer/src/network/schemas.test.ts
```

#### 45. Type coverage %
**Status**: ⚠️ WARN  
**Issues**: 0

```
Type coverage: unknown%
Maximum call stack size exceeded

```

---

## Recommendations

1. **[HIGH]** Review: Circular dependencies (3 issues)
1. **[LOW]** Consider: Outdated packages (14 items)
1. **[HIGH]** Review: Duplicate packages (53 issues)
1. **[HIGH]** Review: React hooks lint (OxLint) (1 issues)
1. **[HIGH]** Review: Missing key prop in .map() (5 issues)
1. **[HIGH]** Review: console.log leaks (8 issues)
1. **[HIGH]** Review: Large files (>500 lines) (60 issues)
1. **[HIGH]** Review: Functions >100 lines (74 issues)
1. **[HIGH]** Review: Code duplication (jscpd) (117 issues)
1. **[LOW]** Consider: Git status (uncommitted changes) (456 items)
1. **[LOW]** Consider: Missing test files (201 items)
1. **[HIGH]** Review: Orphan files (not imported) (64 issues)
1. **[HIGH]** Review: Type coverage % (0 issues)

---

## Quick Fix Reference

- **Check 14** (Circular dependencies): Convert eager store imports to lazy `require()` accessors (see game-sync.ts pattern).
- **Check 33** (console.log leaks): Import `{ logger }` from `utils/logger.ts` (renderer) or `logToFile` from `main/index.ts` (main process).
- **Check 35** (Large files (>500 lines)): Split files >500 lines into sub-modules. See `stores/game/` and `services/game-actions/` for patterns.
- **Check 39** (Code duplication (jscpd)): Extract duplicate code into shared hooks (see `hooks/use-character-editor.ts` pattern).

---

## Dead Code Verdict

| File | Status | Verdict | Reason |
|------|--------|---------|--------|
| CombatLogPanel.tsx | Orphan | WIP | Fully implemented, awaiting sidebar integration |
| JournalPanel.tsx | Orphan | WIP | TipTap journal, awaiting sidebar integration |
| sentient-items.ts | Unused | PLANNED | DMG 2024 sentient item generation framework |
| RollRequestOverlay.tsx | Orphan | WIP | DM roll request overlay, awaiting P2P wiring |
| ThemeSelector.tsx | Orphan | WIP | Theme picker, awaiting settings integration |
| PrintSheet.tsx | Orphan | WIP | Print-ready character sheet layout |
| cloud-sync.ts | Untracked | PLANNED | S3 cloud backup/sync infrastructure |
| cdn-provider.ts | Untracked | PLANNED | CDN provider for game data/images |

---

## Automation Scripts (Tests/)

| Script | Purpose | Usage |
|--------|---------|-------|
| `run-audit.js` | Master audit — runs all checks, generates this report | `node Tests/run-audit.js` |
| `electron-security.js` | Electron security scan (CSP, sandbox, etc.) | Called by run-audit.js check #10 |
| `rename-to-kebab.js` | Rename camelCase files to kebab-case + update imports | `node Tests/rename-to-kebab.js [--dry-run]` |
| `replace-console-logs.js` | Replace console.* with structured logger | `node Tests/replace-console-logs.js [--dry-run|--count]` |

All scripts are modular and export reusable functions for programmatic use.

---

## Remaining Implementation Work

Items are automatically removed from this list when their completion criteria are met.

### 7a. Split GameLayout.tsx
Current size: 1624 lines
Extract from `src/renderer/src/components/game/GameLayout.tsx`:
1. `GameModalDispatcher.tsx` — all lazy modal imports + render logic
2. `hooks/use-game-network.ts` — host/client network message handlers
3. `hooks/use-game-sound.ts` — sound event mapping
4. `hooks/use-token-movement.ts` — drag/drop/pathfinding handlers
**Pattern**: Extract custom hooks and sub-components, keep GameLayout as orchestrator.

### 7c. Split remaining large files (>800 lines)
Apply the same extraction pattern to these files:
| File | Lines | Suggested Split |
|------|-------|----------------|
| GameLayout.tsx | 1624 | See item 7a above |
| use-level-up-store.ts | 1317 | Convert to Zustand slices (follow stores/game/ pattern) |
| save-slice-5e.ts | 1192 | Extract save/load helpers, migration logic |
| CampaignDetailPage.tsx | 1183 | See item 7b above |
| BastionModals.tsx | 1120 | Extract sub-components / helpers |
| MapCanvas.tsx | 1087 | Extract PixiJS setup, event handlers, toolbar |
| DefenseSection5e.tsx | 1069 | Extract armor manager, defense adder, proficiency editor |
| data-provider.ts | 975 | Extract sub-components / helpers |
| LevelSelectors5e.tsx | 940 | Extract sub-components / helpers |
| host-manager.ts | 932 | Extract sub-components / helpers |
| use-network-store.ts | 908 | Extract sub-components / helpers |
| InitiativeTracker.tsx | 903 | Extract sub-components / helpers |
| PlayerHUDOverlay.tsx | 889 | Extract sub-components / helpers |
| combat-resolver.ts | 886 | Extract save resolver, AOE handler, spell attack handler |
| AttackModal.tsx | 876 | Extract target selector, damage calculator, roll display |
| index.ts | 832 | Extract sub-components / helpers |
| GearTab5e.tsx | 827 | Extract sub-components / helpers |
| AttackModalSteps.tsx | 824 | Extract sub-components / helpers |
| DMRollerModal.tsx | 807 | Extract sub-components / helpers |

### New WIP features (found untracked)
These files were found as new untracked/WIP code and need integration:
- `src/main/storage/cloud-sync.ts` — Cloud save/sync backend (S3-based)
- `src/renderer/src/services/cdn-provider.ts` — CDN asset provider
- `src/renderer/src/data/sentient-items.ts` — Sentient item data for DM tools



---

## AI Prompting Quick Reference

Copy-pasteable prompts for an AI agent to fix common issues:

### Split large files
```
Follow the patterns in stores/game/ (Zustand slices) and
services/game-actions/ (action sub-modules). Extract sub-components,
hooks, or helper modules into new files.
```

### Split GameLayout.tsx
```
Extract from GameLayout.tsx: (1) GameModalDispatcher.tsx with all 46 lazy modal
imports, (2) hooks/use-game-network.ts with host/client message handlers,
(3) hooks/use-game-sound.ts with sound event mapping, (4) hooks/use-token-movement.ts.
Keep GameLayout.tsx as the orchestrator that imports these sub-modules.
```

### Split CampaignDetailPage.tsx
```
Extract from CampaignDetailPage.tsx into pages/campaign-detail/ directory:
NPCManager.tsx, RuleManager.tsx, LoreManager.tsx, AdventureWizard.tsx, MonsterLinker.tsx.
Each manager is a self-contained React component with its own local state.
```

### Wire orphan WIP components
```
Integrate these completed but unused components: CombatLogPanel.tsx and
JournalPanel.tsx into game sidebar tabs, RollRequestOverlay.tsx to P2P
"dm:roll-request" message type, ThemeSelector.tsx to SettingsDropdown.tsx,
PrintSheet.tsx to character sheet header.
```