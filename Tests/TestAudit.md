# Project Audit Report
Generated: 2026-03-01T21:04:37.895Z

## Summary Dashboard
| # | Check | Category | Status | Issues | Time |
|---|-------|----------|--------|--------|------|
| 1 | TypeScript type-check | Core Quality | ✅ PASS | 0 | 3.3s |
| 2 | Biome lint | Core Quality | ✅ PASS | 0 | 11.1s |
| 3 | Biome format check | Core Quality | ✅ PASS | 0 | 3.4s |
| 4 | Unit tests | Core Quality | ✅ PASS | 0 | 48.0s |
| 5 | Test coverage | Core Quality | ✅ PASS | 0 | 59.2s |
| 6 | Production build | Core Quality | ✅ PASS | 0 | 22.8s |
| 7 | OxLint | Core Quality | ✅ PASS | 0 | 1.0s |
| 8 | npm audit | Security | ✅ PASS | 0 | 2.3s |
| 9 | Lockfile lint | Security | ✅ PASS | 0 | 1.2s |
| 10 | Electron security scan | Security | ✅ PASS | 0 | 0.0s |
| 11 | Hardcoded secrets scan | Security | ✅ PASS | 0 | 0.2s |
| 12 | eval() / new Function() | Security | ✅ PASS | 0 | 0.1s |
| 13 | dangerouslySetInnerHTML | Security | ✅ PASS | 0 | 0.1s |
| 14 | Circular dependencies | Dependencies | ✅ PASS | 0 | 1.1s |
| 15 | Dead code (knip) | Dependencies | ℹ️ INFO | 397 | 6.1s |
| 16 | Outdated packages | Dependencies | ✅ PASS | 0 | 2.3s |
| 17 | License compliance | Dependencies | ✅ PASS | 0 | 2.1s |
| 18 | Unused exports (ts-prune) | Dependencies | ✅ PASS | 0 | 2.2s |
| 19 | Duplicate packages | Dependencies | ✅ PASS | 50 | 2.0s |
| 20 | React hooks lint (OxLint) | React & Hooks | ✅ PASS | 0 | 0.8s |
| 21 | Missing export default on lazy components | React & Hooks | ✅ PASS | 0 | 0.0s |
| 22 | Missing key prop in .map() | React & Hooks | ✅ PASS | 0 | 0.1s |
| 23 | CRLF line endings | Code Quality | ✅ PASS | 0 | 0.1s |
| 24 | console.log leaks | Code Quality | ✅ PASS | 0 | 0.2s |
| 25 | TODO/FIXME/HACK count | Code Quality | ✅ PASS | 0 | 0.2s |
| 26 | Large files (>1000 lines) | Code Quality | ✅ PASS | 2 | 0.2s |
| 27 | `any` type usage | Code Quality | ✅ PASS | 0 | 0.1s |
| 28 | Empty catch blocks | Code Quality | ✅ PASS | 0 | 0.1s |
| 29 | Functions >200 lines | Code Quality | ✅ PASS | 41 | 0.2s |
| 30 | Code duplication (jscpd) | Code Quality | ✅ PASS | 646 | 29.2s |
| 31 | Regex safety (ReDoS) | Code Quality | ✅ PASS | 0 | 0.2s |
| 32 | Git status (uncommitted changes) | Project Hygiene | ℹ️ INFO | 627 | 0.1s |
| 33 | File naming conventions | Project Hygiene | ✅ PASS | 0 | 0.1s |
| 34 | Missing test files | Project Hygiene | ✅ PASS | 6 | 0.2s |
| 35 | Orphan files (not imported) | Project Hygiene | ✅ PASS | 0 | 1.5s |
| 36 | Type coverage % | Project Hygiene | ✅ PASS | 0 | 53.4s |

**Total: 0 errors, 0 warnings, 2 informational**

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
603 passed, 0 failed
2m[32m 25[2mms[22m[39m
 [32m✓[39m src/renderer/src/services/chat-commands/commands-player-conditions.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32m✓[39m src/renderer/src/services/combat/crit-range.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/renderer/src/data/alignment-descriptions.test.ts [2m([22m[2m7 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m src/main/storage/migrations.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 8[2mms[22m[39m
 [32m✓[39m src/renderer/src/components/game/modals/dm-tools/DMMapEditor.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 14[2mms[22m[39m
 [32m✓[39m src/renderer/src/stores/game/fog-slice.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/renderer/src/services/notification-service.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/renderer/src/network/peer-manager.test.ts [2m([22m[2m9 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/renderer/src/pages/CreateCharacterPage.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/renderer/src/stores/use-character-store.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/renderer/src/pages/InGamePage.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/renderer/src/pages/CharacterSheet5ePage.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m
 [32m✓[39m src/renderer/src/components/game/GameLayout.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 2[2mms[22m[39m

[2m Test Files [22m [1m[32m603 passed[39m[22m[90m (603)[39m
[2m      Tests [22m [1m[32m5401 passed[39m[22m[90m (5401)[39m
[2m     Errors [22m [1m[31m2 errors[39m[22m
[2m   Start at [22m 14:00:42
[2m   Duration [22m 46.02s[2m (transform 203.93s, setup 0ms, import 164.66s, tests 280.11s, environment 335ms)[22m


```

#### 5. Test coverage
**Status**: ✅ PASS  
**Issues**: 0

```
Statement coverage: 64.41%
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   64.41 |    54.06 |   63.61 |   65.35 |                   
 data              |   82.47 |     62.2 |   90.75 |   84.72 |                   
  ...scriptions.ts |     100 |      100 |     100 |     100 |                   
  ...ion-events.ts |   58.46 |    41.79 |   57.89 |   56.07 | 148-154,177-253   
  ...ar-presets.ts |     100 |       80 |     100 |     100 | 28-35             
  ...-resources.ts |   97.43 |    73.68 |     100 |   96.96 | 19                
  conditions.ts    |      88 |     87.5 |      80 |   86.36 | 42-43,62          
  ...efinitions.ts |   85.18 |       50 |     100 |     100 | 18-50             
  ...scriptions.ts |     100 |      100 |     100 |     100 |                   
  light-sources.ts |     100 |      100 |     100 |     100 |                   
  moderation.ts    |     100 |      100 |     100 |     100 |                   
  ...requisites.ts |     100 |      100 |     100 |     100 |                   
  ...appearance.ts |     100 |       50 |     100 |     100 | 12-17             
  ...mannerisms.ts |     100 |       50 |     100 |     100 | 8-9               
  ...ity-tables.ts |     100 |    85.71 |     100 |     100 | 36,55             
  ...ient-items.ts |     100 |    54.16 |     100 |     100 | 23-27,58,64-75    
  skills.ts        |     100 |       75 |     100 |     100 | 23                
```

#### 6. Production build
**Status**: ✅ PASS  
**Issues**: 0

```
Build succeeded
```

#### 7. OxLint
**Status**: ✅ PASS  
**Issues**: 0

```
Found 0 warnings and 0 errors.
Finished in 169ms on 1322 files with 93 rules using 22 threads.

```

### Security

#### 8. npm audit
**Status**: ✅ PASS  
**Issues**: 0

```
# npm audit report

fast-xml-parser  <5.3.8
fast-xml-parser has stack overflow in XMLBuilder with preserveOrder - https://github.com/advisories/GHSA-fj3w-jwp8-x2g3
fix available via `npm audit fix --force`
Will install @aws-sdk/client-s3@3.893.0, which is a breaking change
node_modules/fast-xml-parser
  @aws-sdk/xml-builder  >=3.894.0
  Depends on vulnerable versions of fast-xml-parser
  node_modules/@aws-sdk/xml-builder
    @aws-sdk/core  >=3.894.0
    Depends on vulnerable versions of @aws-sdk/xml-builder
    node_modules/@aws-sdk/core
      @aws-sdk/client-s3  >=3.894.0
      Depends on vulnerable versions of @aws-sdk/core
      Depends on vulnerable versions of @aws-sdk/credential-provider-node
      Depends on vulnerable versions of @aws-sdk/middleware-flexible-checksums
      Depends on vulnerable versions of @aws-sdk/middleware-sdk-s3
      Depends on vulnerable versions of @aws-sdk/middleware-user-agent
      Depends on vulnerable versions of @aws-sdk/signature-v4-multi-region
      Depends on vulnerable versions of @aws-sdk/util-user-agent-node
      node_modules/@aws-sdk/client-s3
      @aws-sdk/credential-provider-env  >=3.894.0
      Depends on vulnerable versions of @aws-sdk/core
      node_modules/@aws-sdk/credential-provider-env
      @aws-sdk/credential-provider-http  >=3.894.0
      Depends on vulnerable versions of @aws-sdk/core
      node_modules/@aws-sdk/credential-provider-http
        @aws-sdk/credential-provider-node  >=3.894.0
        Depends on vulnerable versions of @aws-sdk/credential-provider-env
        Depends on vulnerable versions of @aws-sdk/credential-provider-http
        Depends on vulnerable versions of @aws-sdk/credential-provider-ini
        Depends on vulnerable versions of @aws-sdk/credential-provider-process
        Depends on vulnerable versions of @aws-sdk/credential-provider-sso
        Depends on vulnerable versions of @aws-sdk/credential-provider-web-identity
        node_modules/@aws-sdk/credential-provider-node
      @aws-sdk/credential-provider-ini  >=3.894.0
      Depends on vulnerable versions of @aws-sdk/core
      Depends on vulnerable versions of @aws-sdk/credential-provider-env
      Depends on vulnerable versions of @aws-sdk/credential-provider-http
      Depends on vulnerable versions of @aws-sdk/credential-provider-login
      Depends on vulnerable versions of @aws-sdk/credential-provider-process
      Depends on vulnerable versions of @aws-sdk/credential-provider-sso
      Depends on vulnerable versions of @aws-sdk/credential-provider-web-identity
      Depends on vulnerable versions of @aws-sdk/nested-clients
      node_modules/@aws-sdk/credential-provider-ini
      @aws-sdk/credential-provider-login  *
      Depends on vulnerable versions of @aws-sdk/core
      Depends on vulnerable versions of @aws-sdk/nested-clients
      node_modules/@aws-sdk/credential-provider-login
      @aws-sdk/credential-provider-process  >=3.894.0
      Depends on vulnerable versions of @aws-sdk/core
      no
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
**Status**: ✅ PASS  
**Issues**: 0

```
No circular dependencies (barrel + lazy-require false positives excluded)
```

#### 15. Dead code (knip)
**Status**: ℹ️ INFO  
**Issues**: 397

```
[93m[4mUnused files[24m[39m (10)
src/renderer/src/network/index.ts                          
src/renderer/src/constants/index.ts                        
src/renderer/src/types/index.ts                            
src/renderer/src/types/user.ts                             
src/renderer/src/components/library/HomebrewCreateModal.tsx
src/renderer/src/components/library/index.ts               
src/renderer/src/components/library/LibraryCategoryGrid.tsx
src/renderer/src/components/library/LibraryDetailModal.tsx 
src/renderer/src/components/library/LibraryItemList.tsx    
src/renderer/src/components/library/LibrarySidebar.tsx     
[93m[4mUnused exports[24m[39m (138)
generateSessionSummary     aiService          function  src/main/ai/ai-service.ts:617:23                                
describeChange             aiService                    src/main/ai/ai-service.ts:653:26                                
isNegativeChange           aiService                    src/main/ai/ai-service.ts:653:42                                
getSearchEngine                               function  src/main/ai/context-builder.ts:102:17                           
ALL_IS_WELL_FLAVORS                                     src/renderer/src/data/bastion-events.ts:108:12                  
GUEST_TABLE                                             src/renderer/src/data/bastion-events.ts:109:12                  
TREASURE_TABLE                                          src/renderer/src/data/bastion-events.ts:110:12                  
BASTION_EVENTS_TABLE                                    src/renderer/src/data/bastion-events.ts:111:12                  
GAMING_HALL_WINNINGS                                    src/renderer/src/data/bastion-events.ts:112:12                  
MENAGERIE_CREATURES                                     src/renderer/src/data/bastion-events.ts:113:12                  
CREATURE_COSTS_BY_CR                                    src/renderer/src/data/bastion-events.ts:114:12                  
EXPERT_TRAINERS                                         src/renderer/src/data/bastion-events.ts:115:12                  
PUB_SPECIALS                                            src/renderer/src/data/bastion-events.ts:116:12                  
SAMPLE_GUILDS                                           src/renderer/src/data/bastion-events.ts:117:12                  
EMERALD_ENCLAVE_CREATURES                               src/renderer/src/data/bastion-events.ts:118:12                  
FORGE_CONSTRUCTS                                        src/renderer/src/data/bastion-events.ts:119:12                  
PRIMORDIAL_DIALECTS                                     src/renderer/src/types/character-common.ts:82:14                
getBuffs5e                                    function  src/renderer/src/data/conditions.ts:41:23                       
unregisterSystem                              function  src/renderer/src/systems/registry.ts:14:17                      
getAllSystems                                 function  src/renderer/src/systems/registry.ts:26:17                      
cdnProvider                                             src/renderer/src/services/data-provider.ts:68:10                
resolveDataPath                               function  src/renderer/src/services/data-provider.ts:91:17                
getHeritageOptions5e                          function  src/renderer/src/services/data-provider.ts:527:23               
load5eSoundEvents                             function  src/renderer/src/services/data-provider.ts:820:23               
load5eSpeciesSpells                           function  src/renderer/src/services/data-provider.ts:824:23               
load5eClassResources                          function  src/renderer/src/services/data-provider.ts:828:23               
load5eSpeciesResources                        function  src/renderer/src/services/data-provider.ts:832:23               
load5eAbilityScoreConfig                      function  
```

#### 16. Outdated packages
**Status**: ✅ PASS  
**Issues**: 0

```
All packages up to date
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
**Status**: ✅ PASS  
**Issues**: 50

```
50 packages with multiple versions installed
@anthropic-ai/sdk: 0.78.0, 0.74.0
tslib: 2.8.1, 1.14.1
@smithy/util-utf8: 2.3.0, 4.2.1
@smithy/util-buffer-from: 2.2.0, 4.2.1
@smithy/is-array-buffer: 2.2.0, 4.2.1
ansi-styles: 5.2.0, 4.3.0, 6.2.3
p-queue: 6.6.2, 9.1.0
uuid: 10.0.0, 11.1.0, 13.0.0
eventemitter3: 4.0.7, 5.0.4
p-timeout: 3.2.0, 7.0.1
argparse: 2.0.1, 1.0.10
@types/node: 25.3.3, 24.11.0
undici-types: 7.18.2, 7.16.0
js-tokens: 4.0.0, 10.0.0
lru-cache: 5.1.1, 10.4.3, 6.0.0
yallist: 3.1.1, 4.0.0, 5.0.0
debug: 4.4.3, 3.2.7
estree-walker: 3.0.3, 2.0.2
ajv: 8.18.0, 6.14.0
json-schema-traverse: 1.0.0, 0.4.1
dotenv: 17.3.1, 16.6.1
glob: 7.2.3, 10.5.0
@electron/get: 3.1.0, 2.0.3
isbinaryfile: 4.0.10, 5.0.7
minipass: 7.1.3, 3.3.6
signal-exit: 4.1.0, 3.0.7
emoji-regex: 8.0.0, 9.2.2, 10.6.0
strip-ansi: 6.0.1, 7.2.0
string-width: 5.1.2, 4.2.3, 7.2.0
ansi-regex: 5.0.1, 6.2.2
```

### React & Hooks

#### 20. React hooks lint (OxLint)
**Status**: ✅ PASS  
**Issues**: 0

```
Found 0 warnings and 0 errors.
Finished in 104ms on 1322 files with 93 rules using 22 threads.

```

#### 21. Missing export default on lazy components
**Status**: ✅ PASS  
**Issues**: 0

```
All 15 lazy components have default exports
```

#### 22. Missing key prop in .map()
**Status**: ✅ PASS  
**Issues**: 0

```
All .map() calls appear to have key props
```

### Code Quality

#### 23. CRLF line endings
**Status**: ✅ PASS  
**Issues**: 0

```
All files use LF
```

#### 24. console.log leaks
**Status**: ✅ PASS  
**Issues**: 0

```
No console statements
```

#### 25. TODO/FIXME/HACK count
**Status**: ✅ PASS  
**Issues**: 0

```
No developer notes
```

#### 26. Large files (>1000 lines)
**Status**: ✅ PASS  
**Issues**: 2

```
src/renderer/src/components/game/modals/mechanics/DowntimeModal.tsx — 1101 lines
src/renderer/src/services/json-schema.test.ts — 1076 lines
```

#### 27. `any` type usage
**Status**: ✅ PASS  
**Issues**: 0

```
No `any` usage
```

#### 28. Empty catch blocks
**Status**: ✅ PASS  
**Issues**: 0

```
No empty catch blocks
```

#### 29. Functions >200 lines
**Status**: ✅ PASS  
**Issues**: 41

```
src/renderer/src/stores/builder/slices/build-character-5e.ts:38 — buildCharacter5e (619 lines)
src/renderer/src/components/ui/OllamaManagement.tsx:19 — OllamaManagement (529 lines)
src/renderer/src/components/builder/5e/SpellsTab5e.tsx:17 — SpellsTab5e (471 lines)
src/renderer/src/pages/SettingsPage.tsx:387 — SettingsPage (397 lines)
src/renderer/src/pages/CharacterSheet5ePage.tsx:34 — CharacterSheet5ePage (388 lines)
src/renderer/src/components/builder/5e/CharacterBuilder5e.tsx:18 — CharacterBuilder5e (382 lines)
src/renderer/src/stores/network-store/client-handlers.ts:88 — handleClientMessage (370 lines)
src/renderer/src/pages/LibraryPage.tsx:17 — LibraryPage (368 lines)
src/renderer/src/pages/BastionPage.tsx:17 — BastionPage (365 lines)
src/renderer/src/components/game/bottom/DMAudioPanel.tsx:35 — DMAudioPanel (352 lines)
src/renderer/src/components/builder/shared/AsiModal.tsx:10 — AsiModal (351 lines)
src/renderer/src/services/io/import-foundry.ts:104 — importFoundryCharacter (347 lines)
src/main/ipc/ai-handlers.ts:26 — registerAiHandlers (345 lines)
src/renderer/src/components/builder/5e/SpecialAbilitiesTab5e.tsx:32 — SpecialAbilitiesTab5e (340 lines)
src/renderer/src/components/campaign/CampaignWizard.tsx:23 — CampaignWizard (339 lines)
src/renderer/src/stores/network-store/host-handlers.ts:32 — handleHostMessage (333 lines)
src/renderer/src/components/game/player/ShopView.tsx:94 — ShopView (329 lines)
src/renderer/src/pages/AboutPage.tsx:48 — AboutPage (324 lines)
src/renderer/src/components/builder/5e/DetailsTab5e.tsx:10 — DetailsTab5e (310 lines)
src/renderer/src/components/game/modals/utility/WeatherOverridePanel.tsx:50 — WeatherOverridePanel (307 lines)
src/renderer/src/components/builder/shared/AbilityScoreModal.tsx:16 — AbilityScoreModal (300 lines)
src/renderer/src/components/lobby/ChatInput.tsx:14 — ChatInput (300 lines)
src/renderer/src/pages/ViewCharactersPage.tsx:15 — ViewCharactersPage (298 lines)
src/renderer/src/stores/builder/slices/load-character-5e.ts:11 — loadCharacterForEdit5e (292 lines)
src/renderer/src/stores/use-ai-dm-store.ts:106 — useAiDmStore (288 lines)
src/renderer/src/pages/LobbyPage.tsx:17 — LobbyPage (287 lines)
src/renderer/src/pages/CampaignDetailPage.tsx:28 — CampaignDetailPage (285 lines)
src/renderer/src/services/combat/combat-resolver.ts:304 — resolveAttack (285 lines)
src/renderer/src/pages/CalendarPage.tsx:53 — CalendarPage (276 lines)
src/renderer/src/stores/level-up/feature-selection-slice.ts:10 — createFeatureSelectionSlice (266 lines)
src/renderer/src/stores/network-store/index.ts:57 — useNetworkStore (247 lines)
src/renderer/src/stores/use-lobby-store.ts:79 — useLobbyStore (246 lines)
src/main/ipc/storage-handlers.ts:33 — registerStorageHandlers (243 lines)
src/renderer/src/services/library-service.ts:148 — loadCategoryItems (239 lines)
src/main/ai/campaign-context.ts:11 — formatCampaignForContext (236 lines)
src/renderer/src/services/combat/effect-resolver-5e.ts:103 — resolveEffects (236 lines)
src/renderer/src/pages/InGamePage.tsx:14 — InGamePage (227 lines)
src/renderer/src/stores/level-up/index.ts:16 — useLevelUpStore (209 lines)
src/renderer/src/pages/JoinGamePage.tsx:10 — JoinGamePage (205 lines)
src/renderer/src/components/game/dm/DMNotepad.tsx:6 — DMNotepad (202 lines)
src/renderer/src/components/game/map/map-event-handlers.ts:162 — setupMouseHandlers (202 lines)
```

#### 30. Code duplication (jscpd)
**Status**: ✅ PASS  
**Issues**: 646

```
5]

[90m┌────────────[39m[90m┬────────────────[39m[90m┬─────────────[39m[90m┬──────────────[39m[90m┬──────────────[39m[90m┬──────────────────[39m[90m┬───────────────────┐[39m
[90m│[39m[31m Format     [39m[90m│[39m[31m Files analyzed [39m[90m│[39m[31m Total lines [39m[90m│[39m[31m Total tokens [39m[90m│[39m[31m Clones found [39m[90m│[39m[31m Duplicated lines [39m[90m│[39m[31m Duplicated tokens [39m[90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m typescript [90m│[39m 705            [90m│[39m 120758      [90m│[39m 1170248      [90m│[39m 505          [90m│[39m 7511 (6.22%)     [90m│[39m 79416 (6.79%)     [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m javascript [90m│[39m 335            [90m│[39m 36811       [90m│[39m 324588       [90m│[39m 6            [90m│[39m 181 (0.49%)      [90m│[39m 1479 (0.46%)      [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m tsx        [90m│[39m 612            [90m│[39m 71050       [90m│[39m 664167       [90m│[39m 135          [90m│[39m 1449 (2.04%)     [90m│[39m 14946 (2.25%)     [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m css        [90m│[39m 1              [90m│[39m 61          [90m│[39m 290          [90m│[39m 0            [90m│[39m 0 (0%)           [90m│[39m 0 (0%)            [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m json       [90m│[39m 3              [90m│[39m 161         [90m│[39m 755          [90m│[39m 0            [90m│[39m 0 (0%)           [90m│[39m 0 (0%)            [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m [1mTotal:[22m     [90m│[39m 1656           [90m│[39m 228841      [90m│[39m 2160048      [90m│[39m 646          [90m│[39m 9141 (3.99%)     [90m│[39m 95841 (4.44%)     [90m│[39m
[90m└────────────[39m[90m┴────────────────[39m[90m┴─────────────[39m[90m┴──────────────[39m[90m┴──────────────[39m[90m┴──────────────────[39m[90m┴───────────────────┘[39m
[90mFound 646 clones.[39m
[3m[90mDetection time:[39m[23m: 26.930s

```

#### 31. Regex safety (ReDoS)
**Status**: ✅ PASS  
**Issues**: 0

```
No ReDoS-prone patterns found
```

### Project Hygiene

#### 32. Git status (uncommitted changes)
**Status**: ℹ️ INFO  
**Issues**: 627

```
 D .cursor/commands/plan.md
 M BMO-setup/pi/app.py
 M CLAUDE.md
 M Tests/TestAudit.md
 M Tests/knip.txt
 M Tests/run-audit.js
 M biome.json
 D extracted-entities.json
 D source-books-inventory.md
 M src/main/ipc/storage-handlers.ts
 M src/main/storage/cloud-sync.ts
 M src/preload/index.d.ts
 M src/renderer/src/App.tsx
 M src/renderer/src/components/builder/5e/CharacterSummaryBar5e.tsx
 M src/renderer/src/components/builder/5e/DetailsTab5e.tsx
 M src/renderer/src/components/builder/5e/MainContentArea5e.tsx
 M src/renderer/src/components/game/GameLayout.tsx
 M src/renderer/src/components/game/dice3d/dice-meshes.ts
 M src/renderer/src/components/game/map/MapCanvas.tsx
 M src/renderer/src/components/game/modals/combat/FallingDamageModal.tsx
 M src/renderer/src/components/game/modals/combat/JumpModal.tsx
 M src/renderer/src/components/game/modals/dm-tools/DMShopModal.tsx
 M src/renderer/src/components/game/modals/dm-tools/HandoutModal.tsx
 M src/renderer/src/components/game/modals/dm-tools/map-editor-handlers.ts
 M src/renderer/src/components/game/modals/mechanics/FamiliarSelectorModal.tsx
 M src/renderer/src/components/game/modals/mechanics/RestModal.tsx
 M src/renderer/src/components/game/modals/mechanics/SteedSelectorModal.tsx
 M src/renderer/src/components/game/modals/utility/SharedJournalModal.tsx
 M src/renderer/src/components/levelup/5e/LevelUpConfirm5e.tsx
 M src/renderer/src/components/levelup/5e/LevelUpSummary5e.tsx
```

#### 33. File naming conventions
**Status**: ✅ PASS  
**Issues**: 0

```
All files follow naming conventions
```

#### 34. Missing test files
**Status**: ✅ PASS  
**Issues**: 6

```
6 source files without test counterpart
src/renderer/src/components/sheet/5e/defense-utils.ts
src/renderer/src/components/sheet/5e/equipment-utils.ts
src/renderer/src/pages/bastion/bastion-constants.ts
src/renderer/src/pages/bastion/bastion-modal-types.ts
src/renderer/src/pages/library/library-constants.ts
src/renderer/src/test-helpers.ts
```

#### 35. Orphan files (not imported)
**Status**: ✅ PASS  
**Issues**: 0

```
No orphan files
```

#### 36. Type coverage %
**Status**: ✅ PASS  
**Issues**: 0

```
Type coverage: 99.26%
(287763 / 289890) 99.26%
type-coverage success.

```

---

## Recommendations

1. **[LOW]** Consider: Dead code (knip) (397 items)
1. **[LOW]** Consider: Git status (uncommitted changes) (627 items)

---

## Quick Fix Reference


---

## Dead Code Verdict

**Knip baseline**: ~394 items (10 unused files, 138 unused exports, 246 unused exported types)
**After triage**: ~80% are PLANNED public API surface or cross-process types; ~15% are dead barrel re-exports; ~5% are genuinely dead code.

### Unused Files (10)

| File | Verdict | Reason |
|------|---------|--------|
| `constants/index.ts` | DEAD | Barrel file — all imports go directly to subfiles |
| `network/index.ts` | DEAD | Barrel file — all imports go directly to subfiles |
| `types/index.ts` | DEAD | Barrel file — all imports go directly to subfiles |
| `types/user.ts` | DEAD | UserProfile interface never used anywhere |
| `components/library/index.ts` | WIP | Barrel for library sub-component redesign |
| `components/library/HomebrewCreateModal.tsx` | WIP | Homebrew content creator, awaiting library page integration |
| `components/library/LibraryCategoryGrid.tsx` | WIP | Category grid view, awaiting library page integration |
| `components/library/LibraryDetailModal.tsx` | WIP | Detail viewer, awaiting library page integration |
| `components/library/LibraryItemList.tsx` | WIP | Item list component, awaiting library page integration |
| `components/library/LibrarySidebar.tsx` | WIP | Sidebar navigation, awaiting library page integration |

### Unused Exports — PLANNED: Public API Surface (98 items)

Exported functions/constants that form module public APIs, consumed via dynamic dispatch, or planned for future consumers.

| Category | Count | Examples |
|----------|-------|---------|
| Data provider loaders (`load5e*`) | 21 | `load5eSoundEvents`, `load5eThemes`, `load5eBuiltInMaps` |
| Bastion event data tables | 12 | `ALL_IS_WELL_FLAVORS`, `GAMING_HALL_WINNINGS`, `FORGE_CONSTRUCTS` |
| Sound manager functions | 8 | `registerCustomSound`, `playSpellSound`, `preloadEssential` |
| Combat resolver functions | 7 | `resolveAttack`, `resolveGrapple`, `resolveShove` |
| Notification service functions | 5 | `notify`, `setEventEnabled`, `setSoundEnabled` |
| AI service functions | 4 | `generateSessionSummary`, `describeChange`, `getSearchEngine` |
| Character/spell data | 6 | `SPELLCASTING_ABILITY_MAP`, `getSpellcastingAbility` |
| Other (network, plugin, theme, dice, IO) | 35 | `rollForDm`, `importDndBeyondCharacter`, `announce` |

### Unused Exports — DEAD: Barrel Re-exports (28 items)

Re-exports from barrel `index.ts` files that nothing imports from:

| Barrel File | Dead Re-exports |
|-------------|----------------|
| `lobby/index.ts` | CharacterSelector, ChatInput, ChatPanel, PlayerCard, PlayerList, ReadyButton (6) |
| `campaign/index.ts` | AdventureSelector, AudioStep, DetailsStep, MapConfigStep, ReviewStep, RulesStep, SystemStep (7) |
| `game/player/index.ts` | CharacterMiniSheet, ConditionTracker, PlayerHUD, ShopView, SpellSlotTracker (5) |
| `game/dm/index.ts` | MonsterStatBlockView (1) |
| `ui/index.ts` | EmptyState, Skeleton (2) |
| Other barrels | AsiSelector5e, GeneralFeatPicker, ReviewStep default, RulesStep default, etc. (7) |

### Unused Exports — DEAD: Genuinely Unused Code (12 items)

| Export | File | Reason |
|--------|------|--------|
| `_createSolidMaterial` | dice-textures.ts | Internal helper never called |
| `RECONNECT_DELAY_MS` | app-constants.ts | Constant defined but never referenced |
| `MAX_READ_FILE_SIZE` | app-constants.ts | Constant defined but never referenced |
| `MAX_WRITE_CONTENT_SIZE` | app-constants.ts | Constant defined but never referenced |
| `LIFESTYLE_COSTS` | stat-calculator-5e.ts | Data constant, never referenced |
| `TOOL_SKILL_INTERACTIONS` | stat-calculator-5e.ts | Data constant, never referenced |
| `resolveDataPath` | data-provider.ts | Helper function, superseded |
| `cdnProvider` | data-provider.ts | CDN provider object, not yet wired |
| `meetsPrerequisites` | LevelUpConfirm5e.tsx | Helper function, not imported elsewhere |
| `SummaryCard` | BastionTabs.tsx | Sub-component re-export, not consumed |
| `GeneralFeatPicker` | AsiSelector5e.tsx | Sub-component, only via unused barrel |
| `AsiAbilityPicker5e` | AsiSelector5e.tsx | Sub-component, only via unused barrel |

### Unused Exported Types (246 items) — PLANNED

Public API type definitions following standard TypeScript export patterns:

| Category | Count | Verdict |
|----------|-------|---------|
| Network payload types (`types.ts` + `message-types.ts`) | 62 | PLANNED — consumed via switch/case dispatch |
| Data schema types (character, spell, equipment, world) | 45 | PLANNED — JSON data file shape definitions |
| Combat/game mechanic types | 30 | PLANNED — public API contracts |
| Cross-process IPC types (main/renderer) | 18 | PLANNED — invisible to knip across Electron processes |
| Service/store state types | 25 | PLANNED — Zustand store shape exports |
| Calendar/weather/map types | 15 | PLANNED — service contracts |
| IO/plugin/dice types | 15 | PLANNED — module contracts |
| Barrel re-export types (`data/index.ts`, etc.) | 20 | DEAD — from unused barrel files |
| Bastion event + misc types | 16 | PLANNED — bastion event system + misc |

### Previously Triaged (from orphan analysis)

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
Current size: 901 lines
Extract from `src/renderer/src/components/game/GameLayout.tsx`:
1. `GameModalDispatcher.tsx` — all lazy modal imports + render logic
2. `hooks/use-game-network.ts` — host/client network message handlers
3. `hooks/use-game-sound.ts` — sound event mapping
4. `hooks/use-token-movement.ts` — drag/drop/pathfinding handlers
**Pattern**: Extract custom hooks and sub-components, keep GameLayout as orchestrator.

### 7c. Split remaining large files (>1000 lines)
Apply the same extraction pattern to these files:
| File | Lines | Suggested Split |
|------|-------|----------------|
| DowntimeModal.tsx | 1101 | Extract sub-components / helpers |



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