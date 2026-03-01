# Project Audit Report
Generated: 2026-03-01T02:17:40.696Z

## Summary Dashboard
| # | Check | Category | Status | Issues | Time |
|---|-------|----------|--------|--------|------|
| 1 | TypeScript type-check | Core Quality | ✅ PASS | 0 | 5.8s |
| 2 | Biome lint | Core Quality | ✅ PASS | 0 | 3.8s |
| 3 | Biome format check | Core Quality | ✅ PASS | 0 | 2.9s |
| 4 | Unit tests | Core Quality | ✅ PASS | 0 | 4.5s |
| 5 | Test coverage | Core Quality | ✅ PASS | 0 | 5.6s |
| 6 | Production build | Core Quality | ✅ PASS | 0 | 19.7s |
| 7 | OxLint | Core Quality | ✅ PASS | 0 | 0.9s |
| 8 | npm audit | Security | ✅ PASS | 0 | 2.1s |
| 9 | Lockfile lint | Security | ✅ PASS | 0 | 1.1s |
| 10 | Electron security scan | Security | ✅ PASS | 0 | 0.0s |
| 11 | Hardcoded secrets scan | Security | ✅ PASS | 0 | 0.2s |
| 12 | eval() / new Function() | Security | ✅ PASS | 0 | 0.1s |
| 13 | dangerouslySetInnerHTML | Security | ✅ PASS | 0 | 0.1s |
| 14 | Circular dependencies | Dependencies | ✅ PASS | 0 | 7.8s |
| 15 | Dead code (knip) | Dependencies | ℹ️ INFO | 1188 | 3.5s |
| 16 | Outdated packages | Dependencies | ℹ️ INFO | 6 | 1.9s |
| 17 | License compliance | Dependencies | ✅ PASS | 0 | 2.1s |
| 18 | Unused exports (ts-prune) | Dependencies | ✅ PASS | 0 | 1.2s |
| 19 | Duplicate packages | Dependencies | ⚠️ WARN | 61 | 1.4s |
| 20 | React hooks lint (OxLint) | React & Hooks | ✅ PASS | 0 | 0.9s |
| 21 | Missing export default on lazy components | React & Hooks | ✅ PASS | 0 | 0.0s |
| 22 | Missing key prop in .map() | React & Hooks | ✅ PASS | 0 | 0.1s |
| 23 | CRLF line endings | Code Quality | ✅ PASS | 0 | 0.1s |
| 24 | console.log leaks | Code Quality | ✅ PASS | 0 | 0.1s |
| 25 | TODO/FIXME/HACK count | Code Quality | ✅ PASS | 0 | 0.1s |
| 26 | Large files (>1000 lines) | Code Quality | ✅ PASS | 2 | 0.1s |
| 27 | `any` type usage | Code Quality | ✅ PASS | 0 | 0.2s |
| 28 | Empty catch blocks | Code Quality | ✅ PASS | 0 | 0.2s |
| 29 | Functions >200 lines | Code Quality | ✅ PASS | 40 | 0.2s |
| 30 | Code duplication (jscpd) | Code Quality | ✅ PASS | 35 | 18.9s |
| 31 | Regex safety (ReDoS) | Code Quality | ✅ PASS | 0 | 0.2s |
| 32 | Git status (uncommitted changes) | Project Hygiene | ℹ️ INFO | 443 | 0.1s |
| 33 | File naming conventions | Project Hygiene | ✅ PASS | 0 | 0.1s |
| 34 | Missing test files | Project Hygiene | ℹ️ INFO | 284 | 0.2s |
| 35 | Orphan files (not imported) | Project Hygiene | ⚠️ WARN | 23 | 8.1s |
| 36 | Type coverage % | Project Hygiene | ✅ PASS | 0 | 47.6s |

**Total: 0 errors, 2 warnings, 4 informational**

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
42 passed, 0 failed

```

#### 5. Test coverage
**Status**: ✅ PASS  
**Issues**: 0

```
Statement coverage: 15.98%
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   15.98 |    13.92 |   16.68 |   15.62 |                   
 data              |    8.65 |     4.68 |   10.92 |    8.59 |                   
  ...scriptions.ts |       0 |      100 |       0 |       0 | 3-7               
  ...ion-events.ts |       0 |        0 |       0 |       0 | 13-287            
  ...ar-presets.ts |       0 |        0 |       0 |       0 | 11-52             
  ...-resources.ts |       0 |        0 |       0 |       0 | 8-101             
  conditions.ts    |      88 |     87.5 |      70 |   86.36 | 42-43,62          
  ...efinitions.ts |   18.51 |        0 |   14.28 |   21.73 | 12-56             
  ...scriptions.ts |       0 |        0 |       0 |       0 | 3-9               
  light-sources.ts |       0 |        0 |       0 |       0 | 9-20              
  moderation.ts    |       0 |      100 |       0 |       0 | 3-11              
  ...requisites.ts |     100 |      100 |     100 |     100 |                   
  ...appearance.ts |       0 |        0 |       0 |       0 | 3-17              
  ...mannerisms.ts |       0 |        0 |       0 |       0 | 3-9               
  ...ity-tables.ts |       0 |        0 |       0 |       0 | 4-62              
  ...ient-items.ts |       0 |        0 |       0 |       0 | 7-79              
  skills.ts        |       0 |        0 |       0 |       0 | 11-40             
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
Finished in 49ms on 755 files with 93 rules using 22 threads.

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
**Issues**: 1188

```
[93m[4mUnused files[24m[39m (636)
scripts/build-blank-jsons.ts                                                
scripts/build-data-architecture.ts                                          
scripts/check-batch.ts                                                      
scripts/comprehensive-audit.ts                                              
scripts/data-audit-full.ts                                                  
scripts/data-audit.ts                                                       
scripts/debug-batch.ts                                                      
scripts/deep-verify.ts                                                      
scripts/extract-5e-data.ts                                                  
scripts/extract-animals.ts                                                  
scripts/extract-armor.ts                                                    
scripts/extract-dmg-content.ts                                              
scripts/extract-dmg-toolbox.ts                                              
scripts/extract-feats.ts                                                    
scripts/extract-gear.ts                                                     
scripts/extract-magic-items.ts                                              
scripts/extract-monsters.ts                                                 
scripts/extract-origins.ts                                                  
scripts/extract-phb-creatures.ts                                            
scripts/extract-rules-glossary.ts                                           
scripts/extract-subclasses-to-batch.ts                                      
scripts/extract-tools.ts                                                    
scripts/extract-traps-langs-misc.ts                                         
scripts/extract-treasure-tables.ts                                          
scripts/extract-weapons.ts                                                  
scripts/find-data.js                                                        
scripts/fix-data-placements.ts                                              
scripts/fix-monster-enums.ts                                                
scripts/generate-bestiary-schema.ts                                         
scripts/generate-domain-schemas.ts                                          
scripts/generate-extended-schemas.ts                                        
scripts/generate-indexes.ts                                                 
scripts/generate-mass-batch.ts                                              
scripts/generate-mega-batch.ts                                              
scripts/generate-missing-data-batch.ts                                      
scripts/generate-phase4-batch.ts                                            
scripts/generate-phase5-batch.ts                                            
scripts/monitor-mass-batch.ts                                               
scripts/monitor-phase4-batch.ts                                             
scripts/phase4-discovery.ts                                                 
scripts/reorganize-data.ts                                                  
scripts/resume-batch.ts                                                     
scripts/retry-failed.ts                                                     
scripts/submit-integration-batch.ts                                         
scripts/submit-mass-batch.ts                                                
scripts/submit-missing-data-batch.ts                                        
scripts/submit-phase4-batch.ts                                              
scripts/submit-phase5-batch.ts                                              
scripts/submit-subclass-batch.ts                                            
scripts/test-batch-connection.ts                                            
scripts/test-models.ts                                                      
scripts/ultimate-audit-v2.ts       
```

#### 16. Outdated packages
**Status**: ℹ️ INFO  
**Issues**: 6

```
 @aws-sdk/client-s3  ^3.998.0  →  ^3.1000.0
 @types/node          ^25.3.0  →    ^25.3.3
 @types/uuid          ^10.0.0  →    ^11.0.0
 ajv                  ^6.14.0  →    ^8.18.0
 npm-check-updates    ^19.5.0  →    ^19.6.3
 three               ^0.183.1  →   ^0.183.2
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
**Issues**: 61

```
61 packages with multiple versions installed
@anthropic-ai/sdk: 0.78.0, 0.74.0
tslib: 2.8.1, 1.14.1
@smithy/util-utf8: 2.3.0, 4.2.1
@smithy/util-buffer-from: 2.2.0, 4.2.1
@smithy/is-array-buffer: 2.2.0, 4.2.1
ansi-styles: 5.2.0, 4.3.0, 6.2.3, 3.2.1
chalk: 5.6.2, 4.1.2, 2.4.2
p-queue: 6.6.2, 9.1.0
semver: 7.7.4, 6.3.1, 5.7.2
uuid: 10.0.0, 11.1.0, 13.0.0
eventemitter3: 4.0.7, 5.0.4
p-timeout: 3.2.0, 7.0.1
scheduler: 0.25.0, 0.27.0
argparse: 2.0.1, 1.0.10
entities: 4.5.0, 7.0.1
escape-string-regexp: 4.0.0, 1.0.5
@types/node: 25.3.3, 24.11.0
undici-types: 7.18.2, 7.16.0
js-tokens: 4.0.0, 10.0.0
lru-cache: 5.1.1, 10.4.3, 6.0.0
yallist: 3.1.1, 4.0.0, 5.0.0
debug: 4.4.3, 3.2.7
estree-walker: 3.0.3, 2.0.2
supports-color: 7.2.0, 5.5.0
has-flag: 4.0.0, 3.0.0
dotenv: 17.3.1, 16.6.1
commander: 5.1.0, 9.5.0, 7.2.0, 12.1.0, 6.2.1
glob: 7.2.3, 10.5.0
fs-extra: 9.1.0, 8.1.0, 10.1.0, 11.3.3, 7.0.1
jsonfile: 6.2.0, 4.0.0
```

### React & Hooks

#### 20. React hooks lint (OxLint)
**Status**: ✅ PASS  
**Issues**: 0

```
Found 0 warnings and 0 errors.
Finished in 67ms on 755 files with 93 rules using 22 threads.

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
**Issues**: 40

```
src/renderer/src/stores/builder/slices/build-character-5e.ts:38 — buildCharacter5e (611 lines)
src/renderer/src/components/ui/OllamaManagement.tsx:19 — OllamaManagement (529 lines)
src/renderer/src/pages/LobbyPage.tsx:25 — LobbyPage (525 lines)
src/renderer/src/components/builder/5e/SpellsTab5e.tsx:17 — SpellsTab5e (471 lines)
src/renderer/src/pages/LibraryPage.tsx:80 — LibraryPage (422 lines)
src/renderer/src/components/builder/5e/CharacterBuilder5e.tsx:18 — CharacterBuilder5e (382 lines)
src/renderer/src/pages/CharacterSheet5ePage.tsx:31 — CharacterSheet5ePage (374 lines)
src/renderer/src/stores/network-store/client-handlers.ts:88 — handleClientMessage (370 lines)
src/renderer/src/pages/BastionPage.tsx:17 — BastionPage (365 lines)
src/renderer/src/components/game/bottom/DMAudioPanel.tsx:35 — DMAudioPanel (352 lines)
src/renderer/src/components/builder/shared/AsiModal.tsx:10 — AsiModal (351 lines)
src/renderer/src/services/io/import-foundry.ts:104 — importFoundryCharacter (347 lines)
src/main/ipc/ai-handlers.ts:26 — registerAiHandlers (345 lines)
src/renderer/src/components/builder/5e/SpecialAbilitiesTab5e.tsx:32 — SpecialAbilitiesTab5e (340 lines)
src/renderer/src/components/campaign/CampaignWizard.tsx:23 — CampaignWizard (339 lines)
src/renderer/src/stores/network-store/host-handlers.ts:32 — handleHostMessage (333 lines)
src/renderer/src/pages/SettingsPage.tsx:385 — SettingsPage (332 lines)
src/renderer/src/components/game/player/ShopView.tsx:94 — ShopView (329 lines)
src/renderer/src/pages/AboutPage.tsx:48 — AboutPage (324 lines)
src/renderer/src/components/builder/5e/DetailsTab5e.tsx:10 — DetailsTab5e (309 lines)
src/renderer/src/components/game/modals/utility/WeatherOverridePanel.tsx:50 — WeatherOverridePanel (307 lines)
src/renderer/src/services/combat/combat-resolver.ts:226 — resolveAttack (302 lines)
src/renderer/src/components/builder/shared/AbilityScoreModal.tsx:16 — AbilityScoreModal (300 lines)
src/renderer/src/components/lobby/ChatInput.tsx:14 — ChatInput (300 lines)
src/renderer/src/pages/ViewCharactersPage.tsx:15 — ViewCharactersPage (298 lines)
src/renderer/src/stores/builder/slices/load-character-5e.ts:11 — loadCharacterForEdit5e (292 lines)
src/renderer/src/stores/use-ai-dm-store.ts:106 — useAiDmStore (288 lines)
src/renderer/src/pages/CampaignDetailPage.tsx:26 — CampaignDetailPage (277 lines)
src/renderer/src/pages/CalendarPage.tsx:53 — CalendarPage (276 lines)
src/renderer/src/stores/level-up/feature-selection-slice.ts:10 — createFeatureSelectionSlice (266 lines)
src/renderer/src/stores/network-store/index.ts:57 — useNetworkStore (247 lines)
src/renderer/src/stores/use-lobby-store.ts:79 — useLobbyStore (246 lines)
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
**Issues**: 35

```
Clone found (typescript):
 - [1m[32msrc\renderer\src\components\sheet\5e\defense-utils.ts[39m[22m [128:1 - 153:2] (25 lines, 243 tokens)
   [1m[32msrc\renderer\src\components\sheet\5e\equipment-utils.ts[39m[22m [43:1 - 68:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\components\game\dice3d\dice-generators.ts[39m[22m [105:3 - 130:7] (25 lines, 318 tokens)
   [1m[32msrc\renderer\src\components\game\dice3d\dice-meshes.ts[39m[22m [134:3 - 159:65]

Clone found (typescript):
 - [1m[32msrc\renderer\src\components\game\dice3d\dice-generators.ts[39m[22m [224:3 - 252:7] (28 lines, 382 tokens)
   [1m[32msrc\renderer\src\components\game\dice3d\dice-meshes.ts[39m[22m [273:3 - 301:65]

Clone found (typescript):
 - [1m[32msrc\renderer\src\components\game\dice3d\dice-generators.ts[39m[22m [257:3 - 284:2] (27 lines, 371 tokens)
   [1m[32msrc\renderer\src\components\game\dice3d\dice-meshes.ts[39m[22m [309:3 - 336:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\types\data\index.ts[39m[22m [8:1 - 48:24] (40 lines, 330 tokens)
   [1m[32msrc\renderer\src\types\data\shared-enums.ts[39m[22m [5:1 - 45:7]

Clone found (typescript):
 - [1m[32msrc\renderer\src\types\data\index.ts[39m[22m [339:1 - 437:34] (98 lines, 539 tokens)
   [1m[32msrc\renderer\src\types\data\world-data-types.ts[39m[22m [8:1 - 106:25]

Clone found (typescript):
 - [1m[32msrc\renderer\src\types\data\creature-data-types.ts[39m[22m [3:1 - 109:48] (106 lines, 576 tokens)
   [1m[32msrc\renderer\src\types\data\index.ts[39m[22m [437:1 - 543:78]

Clone found (typescript):
 - [1m[32msrc\renderer\src\stores\bastion-store\event-slice.ts[39m[22m [29:7 - 58:2] (29 lines, 294 tokens)
   [1m[32msrc\renderer\src\stores\bastion-store\facility-slice.ts[39m[22m [197:5 - 227:6]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\game-actions\creature-actions.ts[39m[22m [9:2 - 157:27] (148 lines, 1449 tokens)
   [1m[32msrc\renderer\src\services\game-actions\creature-initiative.ts[39m[22m [8:2 - 156:41]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\game-actions\creature-actions.ts[39m[22m [207:3 - 280:2] (73 lines, 720 tokens)
   [1m[32msrc\renderer\src\services\game-actions\creature-conditions.ts[39m[22m [73:3 - 146:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\game-actions\creature-actions.ts[39m[22m [278:23 - 391:2] (113 lines, 1287 tokens)
   [1m[32msrc\renderer\src\services\game-actions\creature-initiative.ts[39m[22m [152:24 - 265:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\combat\combat-resolver.ts[39m[22m [697:1 - 756:2] (59 lines, 591 tokens)
   [1m[32msrc\renderer\src\services\combat\grapple-shove-resolver.ts[39m[22m [102:1 - 161:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\combat\attack-resolver.ts[39m[22m [141:1 - 211:14] (70 lines, 807 tokens)
   [1m[32msrc\renderer\src\services\combat\unarmed-strike-resolver.ts[39m[22m [28:1 - 98:17]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\combat\attack-resolver.ts[39m[22m [224:3 - 320:2] (96 lines, 844 tokens)
   [1m[32msrc\renderer\src\services\combat\unarmed-strike-resolver.ts[39m[22m [107:3 - 203:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\combat\attack-helpers.ts[39m[22m [11:2 - 52:4] (41 lines, 310 tokens)
   [1m[32msrc\renderer\src\services\combat\combat-resolver.ts[39m[22m [763:1 - 804:4]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\combat\attack-helpers.ts[39m[22m [73:2 - 133:2] (60 lines, 566 tokens)
   [1m[32msrc\renderer\src\services\combat\combat-resolver.ts[39m[22m [825:1 - 885:2]

Clone found (typescript):
 - [1m[32msrc\renderer\src\services\chat-commands\commands-dm-map.ts[39m[22m [6:1 - 35:6] (29 lines, 263 tokens)
   [1m[32msrc\renderer\src\services\chat-commands\map-environment-commands.ts[39m[22m [5:2 - 34:7]

Clone found (typescript)
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
**Issues**: 443

```
 M .gitignore
 M BMO-setup/BMO-SETUP-GUIDE.md
 M BMO-setup/aws-setup.sh
 D BMO-setup/deploy.sh
 M BMO-setup/misc+directions/architecture.md
 M BMO-setup/misc+directions/aws-services-reference.md
 M BMO-setup/misc+directions/cloudflare-setup.md
 M BMO-setup/misc+directions/troubleshooting.md
 M BMO-setup/pi-setup.sh
 M BMO-setup/pi/agent.py
 M BMO-setup/pi/app.py
 D BMO-setup/pi/deploy-pi.sh
 M BMO-setup/pi/dev_tools.py
 M Tests/TestAudit.md
 M Tests/run-audit.js
 M biome.json
 M package-lock.json
 M package.json
 M src/main/ai/ai-service.ts
 M src/main/ai/context-builder.ts
 M src/main/ai/conversation-manager.ts
 M src/main/ai/dm-actions.ts
 M src/main/ai/dm-system-prompt.ts
 M src/main/ai/memory-manager.ts
 M src/main/ai/ollama-client.ts
 M src/main/ai/ollama-manager.ts
 M src/main/ai/types.ts
 M src/main/index.ts
 M src/main/ipc/ai-handlers.ts
 M src/main/ipc/index.ts
```

#### 33. File naming conventions
**Status**: ✅ PASS  
**Issues**: 0

```
All files follow naming conventions
```

#### 34. Missing test files
**Status**: ℹ️ INFO  
**Issues**: 284

```
284 source files without test counterpart
src/main/ai/ai-response-parser.ts
src/main/ai/ai-service.ts
src/main/ai/ai-stream-handler.ts
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
src/main/ai/prompt-sections/character-rules.ts
src/main/ai/prompt-sections/combat-rules.ts
src/main/ai/prompt-sections/combat-tactics.ts
src/main/ai/search-engine.ts
src/main/ai/srd-provider.ts
src/main/ai/stat-mutations.ts
src/main/ai/types.ts
src/main/ai/web-search.ts
src/main/ipc/audio-handlers.ts
src/main/ipc/game-data-handlers.ts
src/main/ipc/plugin-handlers.ts
src/main/ipc/storage-handlers.ts
src/main/log.ts
src/main/plugins/content-pack-loader.ts
src/main/plugins/plugin-config.ts
src/main/plugins/plugin-installer.ts
```

#### 35. Orphan files (not imported)
**Status**: ⚠️ WARN  
**Issues**: 23

```
main/storage/cloud-sync.ts
renderer/src/components/builder/5e/GearTab5e.tsx
renderer/src/components/game/dice3d/DiceRoller.tsx
renderer/src/components/sheet/shared/PrintSheet.tsx
renderer/src/pages/campaign-detail/MonsterLinker.tsx
renderer/src/pages/library/LibraryFilters.tsx
renderer/src/pages/lobby/use-lobby-bridges.ts
renderer/src/services/cdn-provider.ts
renderer/src/services/character/feat-mechanics-5e.ts
renderer/src/services/combat/multi-attack-tracker.ts
renderer/src/services/combat/reaction-tracker.ts
renderer/src/services/io/auto-save.ts
renderer/src/services/library-service.ts
renderer/src/services/map/map-utils.ts
renderer/src/services/notification-service.ts
renderer/src/services/sound-playback.ts
renderer/src/stores/use-library-store.ts
renderer/src/systems/init.ts
renderer/src/types/data/character-data-types.ts
renderer/src/types/data/creature-data-types.ts
renderer/src/types/data/equipment-data-types.ts
renderer/src/types/data/world-data-types.ts
renderer/src/utils/dawn-recharge.ts
```

#### 36. Type coverage %
**Status**: ✅ PASS  
**Issues**: 0

```
Type coverage: 99.68%
(217981 / 218666) 99.68%
type-coverage success.

```

---

## Recommendations

1. **[LOW]** Consider: Dead code (knip) (1188 items)
1. **[LOW]** Consider: Outdated packages (6 items)
1. **[HIGH]** Review: Duplicate packages (61 issues)
1. **[LOW]** Consider: Git status (uncommitted changes) (443 items)
1. **[LOW]** Consider: Missing test files (284 items)
1. **[HIGH]** Review: Orphan files (not imported) (23 issues)

---

## Quick Fix Reference


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
Current size: 928 lines
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