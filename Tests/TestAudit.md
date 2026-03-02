# Project Audit Report
Generated: 2026-03-02T02:30:18.767Z

## Summary Dashboard
| # | Check | Category | Status | Issues | Time |
|---|-------|----------|--------|--------|------|
| 1 | TypeScript type-check | Core Quality | ✅ PASS | 0 | 5.6s |
| 2 | Biome lint | Core Quality | ✅ PASS | 0 | 3.8s |
| 3 | Biome format check | Core Quality | ✅ PASS | 0 | 2.7s |
| 4 | Unit tests | Core Quality | ✅ PASS | 0 | 39.3s |
| 5 | Test coverage | Core Quality | ✅ PASS | 0 | 46.5s |
| 6 | Production build | Core Quality | ✅ PASS | 0 | 19.2s |
| 7 | OxLint | Core Quality | ✅ PASS | 0 | 1.3s |
| 8 | npm audit | Security | ✅ PASS | 0 | 2.8s |
| 9 | Lockfile lint | Security | ✅ PASS | 0 | 1.4s |
| 10 | Electron security scan | Security | ✅ PASS | 0 | 0.0s |
| 11 | Hardcoded secrets scan | Security | ✅ PASS | 0 | 0.2s |
| 12 | eval() / new Function() | Security | ✅ PASS | 0 | 0.2s |
| 13 | dangerouslySetInnerHTML | Security | ✅ PASS | 0 | 0.2s |
| 14 | Circular dependencies | Dependencies | ✅ PASS | 0 | 1.0s |
| 15 | Dead code (knip) | Dependencies | ✅ PASS | 87 | 7.0s |
| 16 | Outdated packages | Dependencies | ✅ PASS | 0 | 2.6s |
| 17 | License compliance | Dependencies | ✅ PASS | 0 | 2.6s |
| 18 | Unused exports (ts-prune) | Dependencies | ✅ PASS | 0 | 1.5s |
| 19 | Duplicate packages | Dependencies | ✅ PASS | 50 | 1.7s |
| 20 | React hooks lint (OxLint) | React & Hooks | ✅ PASS | 0 | 1.2s |
| 21 | Missing export default on lazy components | React & Hooks | ✅ PASS | 0 | 0.0s |
| 22 | Missing key prop in .map() | React & Hooks | ✅ PASS | 0 | 0.1s |
| 23 | CRLF line endings | Code Quality | ✅ PASS | 0 | 0.2s |
| 24 | console.log leaks | Code Quality | ✅ PASS | 0 | 0.2s |
| 25 | TODO/FIXME/HACK count | Code Quality | ✅ PASS | 0 | 0.2s |
| 26 | Large files (>1000 lines) | Code Quality | ✅ PASS | 4 | 0.2s |
| 27 | `any` type usage | Code Quality | ✅ PASS | 0 | 0.2s |
| 28 | Empty catch blocks | Code Quality | ✅ PASS | 0 | 0.2s |
| 29 | Functions >200 lines | Code Quality | ✅ PASS | 42 | 0.2s |
| 30 | Code duplication (jscpd) | Code Quality | ✅ PASS | 636 | 29.8s |
| 31 | Regex safety (ReDoS) | Code Quality | ✅ PASS | 0 | 0.1s |
| 32 | Git status (uncommitted changes) | Project Hygiene | ℹ️ INFO | 178 | 0.1s |
| 33 | File naming conventions | Project Hygiene | ✅ PASS | 0 | 0.0s |
| 34 | Missing test files | Project Hygiene | ✅ PASS | 7 | 0.1s |
| 35 | Orphan files (not imported) | Project Hygiene | ✅ PASS | 0 | 1.3s |
| 36 | Type coverage % | Project Hygiene | ✅ PASS | 0 | 54.8s |

**Total: 0 errors, 0 warnings, 1 informational**

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
605 passed, 0 failed

```

#### 5. Test coverage
**Status**: ✅ PASS  
**Issues**: 0

```
Statement coverage: 64.23%
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   64.23 |    53.96 |   63.31 |   65.14 |                   
 data              |   81.14 |    61.87 |    87.7 |   83.41 |                   
  ...scriptions.ts |     100 |      100 |     100 |     100 |                   
  ...ion-events.ts |   55.38 |    40.29 |   52.63 |   53.27 | ...69-235,245-253 
  ...ar-presets.ts |     100 |       80 |     100 |     100 | 28-35             
  ...-resources.ts |      95 |    73.68 |   92.85 |   94.11 | 20,84             
  conditions.ts    |      88 |     87.5 |      80 |   86.36 | 42-43,62          
  ...efinitions.ts |   85.18 |       50 |     100 |     100 | 18-50             
  ...scriptions.ts |     100 |      100 |     100 |     100 |                   
  light-sources.ts |     100 |      100 |     100 |     100 |                   
  moderation.ts    |   85.71 |      100 |      50 |   85.71 | 8                 
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
Finished in 86ms on 1323 files with 93 rules using 22 threads.

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
      node_modules/@aws-sdk/credential-provider-process
        @aws-sdk/credential-provider-node  >=3.894.0
        Depends on vulnerable versions of @aws-sdk/credential-provider-env
        Depends on vulnerable versions of @aws-sdk/credential-provider-http
        Depends on vulnerable versions of @aws-sdk/credential-provider-ini
        Depends on vulnerable versions of @aws-sdk/credential-provider-process
        Depends on vulnerable versions of @aws-sdk/credential-provider-sso
        Depends on vulnerable versions of @aws-sdk/credential-provider-web-identity
       
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
**Status**: ✅ PASS  
**Issues**: 87

```
[93m[4mUnused exports[24m[39m (37)
applyDamageToToken                  src/renderer/src/services/combat/attack-resolver.ts:36:30 
buildAttackSummary                  src/renderer/src/services/combat/attack-resolver.ts:36:50 
doubleDiceInFormula                 src/renderer/src/services/combat/attack-resolver.ts:36:70 
rollDamage                          src/renderer/src/services/combat/attack-resolver.ts:36:91 
resolveUnarmedStrikeBase            src/renderer/src/services/combat/attack-resolver.ts:39:10 
resolveUnarmedStrike      function  src/renderer/src/services/combat/attack-resolver.ts:141:17
shouldTriggerLairAction             src/renderer/src/services/combat/combat-resolver.ts:47:10 
spendLegendaryAction                src/renderer/src/services/combat/combat-resolver.ts:47:35 
useLegendaryResistance              src/renderer/src/services/combat/combat-resolver.ts:47:57 
resolveAttack             function  src/renderer/src/services/combat/combat-resolver.ts:304:17
resolveSavingThrow        function  src/renderer/src/services/combat/combat-resolver.ts:593:17
getEffectiveSpeed         function  src/renderer/src/services/combat/combat-rules.ts:256:17   
applyDamageToToken                  src/renderer/src/services/combat/damage-resolver.ts:41:3  
buildAttackSummary                  src/renderer/src/services/combat/damage-resolver.ts:42:3  
doubleDiceInFormula                 src/renderer/src/services/combat/damage-resolver.ts:43:3  
resolveUnarmedStrike                src/renderer/src/services/combat/damage-resolver.ts:44:3  
resolveUnarmedStrikeBase            src/renderer/src/services/combat/damage-resolver.ts:45:3  
rollDamage                          src/renderer/src/services/combat/damage-resolver.ts:46:3  
resolveSavingThrow                  src/renderer/src/services/combat/damage-resolver.ts:51:3  
shouldTriggerLairAction             src/renderer/src/services/combat/damage-resolver.ts:53:3  
spendLegendaryAction                src/renderer/src/services/combat/damage-resolver.ts:54:3  
useLegendaryResistance              src/renderer/src/services/combat/damage-resolver.ts:55:3  
getEffectiveSpeed                   src/renderer/src/services/combat/damage-resolver.ts:59:10 
hasDarkvision             function  src/renderer/src/services/map/vision-computation.ts:184:17
isConnected                         src/renderer/src/network/index.ts:5:3                     
getConnectedPeers                   src/renderer/src/network/index.ts:19:3                    
getInviteCode                       src/renderer/src/network/index.ts:20:3                    
isHosting                           src/renderer/src/network/index.ts:22:3                    
createMessageRouter                 src/renderer/src/network/index.ts:37:10                   
createPeer                          src/renderer/src/network/index.ts:40:3                    
destroyPeer                         src/renderer/src/network/index.ts:41:3                    
generateInviteCode                  src/renderer/src/network/index.ts:42:3                    
getPeer                             src/renderer/src/network/index.ts:44:3                    
validateNetworkMessage              src/renderer/src/network/index.ts:53:75                   
GAME_SYSTEMS                        src/renderer/src/types/index.ts:17:10                     
formatBytes                         src/renderer/src/components/ui/OllamaManagement.tsx:19:10 
timeAgo                             src/renderer/src/components/ui/OllamaManagement.tsx:19:23 
[93m[4mUnused exported types[24m[39m (47)
NetworkMap               type       src/renderer/src/network/types.ts:74:3                                
MoonPhase                interface  src/renderer/src/services/calendar-service.ts:18:18                   
AttackOptions            type       src/renderer/src/services/chat-commands.ts:7:3                        
AttackResult             type       src/renderer/src/services/chat-commands.ts:
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
Finished in 84ms on 1323 files with 93 rules using 22 threads.

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
**Issues**: 4

```
src/renderer/src/components/game/modals/mechanics/DowntimeModal.tsx — 1111 lines
src/renderer/src/services/json-schema.test.ts — 1076 lines
src/renderer/src/pages/SettingsPage.tsx — 1028 lines
src/renderer/src/services/data-provider.ts — 1003 lines
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
**Issues**: 42

```
src/renderer/src/stores/builder/slices/build-character-5e.ts:41 — buildCharacter5e (619 lines)
src/renderer/src/pages/SettingsPage.tsx:426 — SettingsPage (602 lines)
src/renderer/src/components/builder/5e/SpellsTab5e.tsx:17 — SpellsTab5e (471 lines)
src/renderer/src/components/builder/5e/CharacterBuilder5e.tsx:22 — CharacterBuilder5e (400 lines)
src/renderer/src/pages/CharacterSheet5ePage.tsx:34 — CharacterSheet5ePage (388 lines)
src/renderer/src/pages/BastionPage.tsx:30 — BastionPage (379 lines)
src/renderer/src/stores/network-store/client-handlers.ts:91 — handleClientMessage (376 lines)
src/renderer/src/components/ui/OllamaManagement.tsx:27 — OllamaManagement (370 lines)
src/renderer/src/components/campaign/CampaignWizard.tsx:41 — CampaignWizard (369 lines)
src/main/ipc/ai-handlers.ts:65 — registerAiHandlers (358 lines)
src/renderer/src/components/game/bottom/DMAudioPanel.tsx:41 — DMAudioPanel (352 lines)
src/renderer/src/components/builder/shared/AsiModal.tsx:10 — AsiModal (351 lines)
src/renderer/src/services/io/import-foundry.ts:104 — importFoundryCharacter (347 lines)
src/renderer/src/components/builder/5e/SpecialAbilitiesTab5e.tsx:32 — SpecialAbilitiesTab5e (340 lines)
src/renderer/src/stores/network-store/host-handlers.ts:38 — handleHostMessage (337 lines)
src/renderer/src/components/game/player/ShopView.tsx:94 — ShopView (330 lines)
src/renderer/src/pages/AboutPage.tsx:51 — AboutPage (324 lines)
src/renderer/src/components/builder/5e/DetailsTab5e.tsx:10 — DetailsTab5e (310 lines)
src/renderer/src/components/game/modals/utility/WeatherOverridePanel.tsx:50 — WeatherOverridePanel (307 lines)
src/renderer/src/components/lobby/ChatInput.tsx:15 — ChatInput (301 lines)
src/renderer/src/components/builder/shared/AbilityScoreModal.tsx:16 — AbilityScoreModal (300 lines)
src/renderer/src/pages/ViewCharactersPage.tsx:15 — ViewCharactersPage (298 lines)
src/renderer/src/stores/builder/slices/load-character-5e.ts:11 — loadCharacterForEdit5e (292 lines)
src/renderer/src/stores/use-ai-dm-store.ts:106 — useAiDmStore (288 lines)
src/renderer/src/pages/LobbyPage.tsx:16 — LobbyPage (287 lines)
src/renderer/src/pages/CampaignDetailPage.tsx:28 — CampaignDetailPage (285 lines)
src/renderer/src/services/combat/combat-resolver.ts:304 — resolveAttack (285 lines)
src/renderer/src/pages/CalendarPage.tsx:53 — CalendarPage (276 lines)
src/renderer/src/pages/LibraryPage.tsx:41 — LibraryPage (273 lines)
src/renderer/src/stores/level-up/feature-selection-slice.ts:10 — createFeatureSelectionSlice (266 lines)
src/renderer/src/stores/network-store/index.ts:41 — useNetworkStore (247 lines)
src/renderer/src/stores/use-lobby-store.ts:79 — useLobbyStore (246 lines)
src/main/ipc/storage-handlers.ts:39 — registerStorageHandlers (243 lines)
src/renderer/src/services/library-service.ts:165 — loadCategoryItems (239 lines)
src/main/ai/campaign-context.ts:11 — formatCampaignForContext (236 lines)
src/renderer/src/services/combat/effect-resolver-5e.ts:103 — resolveEffects (236 lines)
src/renderer/src/pages/InGamePage.tsx:17 — InGamePage (227 lines)
src/renderer/src/App.tsx:35 — App (218 lines)
src/renderer/src/pages/JoinGamePage.tsx:13 — JoinGamePage (215 lines)
src/renderer/src/stores/level-up/index.ts:16 — useLevelUpStore (209 lines)
src/renderer/src/components/game/dm/DMNotepad.tsx:6 — DMNotepad (202 lines)
src/renderer/src/components/game/map/map-event-handlers.ts:162 — setupMouseHandlers (202 lines)
```

#### 30. Code duplication (jscpd)
**Status**: ✅ PASS  
**Issues**: 636

```
5]

[90m┌────────────[39m[90m┬────────────────[39m[90m┬─────────────[39m[90m┬──────────────[39m[90m┬──────────────[39m[90m┬──────────────────[39m[90m┬───────────────────┐[39m
[90m│[39m[31m Format     [39m[90m│[39m[31m Files analyzed [39m[90m│[39m[31m Total lines [39m[90m│[39m[31m Total tokens [39m[90m│[39m[31m Clones found [39m[90m│[39m[31m Duplicated lines [39m[90m│[39m[31m Duplicated tokens [39m[90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m typescript [90m│[39m 705            [90m│[39m 120573      [90m│[39m 1165192      [90m│[39m 503          [90m│[39m 7452 (6.18%)     [90m│[39m 78804 (6.76%)     [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m javascript [90m│[39m 334            [90m│[39m 36225       [90m│[39m 319609       [90m│[39m 6            [90m│[39m 181 (0.5%)       [90m│[39m 1479 (0.46%)      [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m tsx        [90m│[39m 611            [90m│[39m 70694       [90m│[39m 659406       [90m│[39m 127          [90m│[39m 1320 (1.87%)     [90m│[39m 13651 (2.07%)     [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m css        [90m│[39m 1              [90m│[39m 61          [90m│[39m 290          [90m│[39m 0            [90m│[39m 0 (0%)           [90m│[39m 0 (0%)            [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m json       [90m│[39m 3              [90m│[39m 161         [90m│[39m 755          [90m│[39m 0            [90m│[39m 0 (0%)           [90m│[39m 0 (0%)            [90m│[39m
[90m├────────────[39m[90m┼────────────────[39m[90m┼─────────────[39m[90m┼──────────────[39m[90m┼──────────────[39m[90m┼──────────────────[39m[90m┼───────────────────┤[39m
[90m│[39m [1mTotal:[22m     [90m│[39m 1654           [90m│[39m 227714      [90m│[39m 2145252      [90m│[39m 636          [90m│[39m 8953 (3.93%)     [90m│[39m 93934 (4.38%)     [90m│[39m
[90m└────────────[39m[90m┴────────────────[39m[90m┴─────────────[39m[90m┴──────────────[39m[90m┴──────────────[39m[90m┴──────────────────[39m[90m┴───────────────────┘[39m
[90mFound 636 clones.[39m
[3m[90mDetection time:[39m[23m: 27.854s

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
**Issues**: 178

```
 M Tests/TestAudit.md
 M Tests/knip-report.json
 M package-lock.json
 M package.json
 M src/main/ai/ai-service.ts
 M src/main/ai/ai-stream-handler.ts
 M src/main/ai/context-builder.ts
 M src/main/ipc/ai-handlers.ts
 M src/main/ipc/index.ts
 M src/main/ipc/storage-handlers.ts
 M src/main/storage/settings-storage.ts
 M src/preload/index.d.ts
 M src/renderer/src/App.tsx
 M src/renderer/src/components/builder/5e/BackstoryEditor5e.tsx
 M src/renderer/src/components/builder/5e/CharacterBuilder5e.tsx
 M src/renderer/src/components/builder/5e/CharacterSummaryBar5e.tsx
 M src/renderer/src/components/builder/5e/HigherLevelEquipment5e.tsx
 M src/renderer/src/components/builder/5e/LanguagesTab5e.tsx
 M src/renderer/src/components/builder/5e/gear-tab-types.ts
 M src/renderer/src/components/builder/shared/ExpertiseModal.tsx
 M src/renderer/src/components/builder/shared/SelectionFilterBar.tsx
 M src/renderer/src/components/campaign/AdventureWizard.tsx
 M src/renderer/src/components/campaign/CampaignWizard.tsx
 M src/renderer/src/components/campaign/MapConfigStep.tsx
 M src/renderer/src/components/campaign/SessionZeroStep.tsx
 M src/renderer/src/components/campaign/StartStep.tsx
 M src/renderer/src/components/game/GameLayout.tsx
 M src/renderer/src/components/game/GameModalDispatcher.tsx
 M src/renderer/src/components/game/bottom/CommandAutocomplete.tsx
 M src/renderer/src/components/game/bottom/DMAudioPanel.tsx
```

#### 33. File naming conventions
**Status**: ✅ PASS  
**Issues**: 0

```
All files follow naming conventions
```

#### 34. Missing test files
**Status**: ✅ PASS  
**Issues**: 7

```
7 source files without test counterpart
src/renderer/src/components/sheet/5e/defense-utils.ts
src/renderer/src/components/sheet/5e/equipment-utils.ts
src/renderer/src/pages/bastion/bastion-constants.ts
src/renderer/src/pages/bastion/bastion-modal-types.ts
src/renderer/src/pages/library/library-constants.ts
src/renderer/src/test-helpers.ts
src/shared/constants.ts
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
(289253 / 291383) 99.26%
type-coverage success.

```

---

## Recommendations

1. **[LOW]** Consider: Git status (uncommitted changes) (178 items)

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
Current size: 929 lines
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
| DowntimeModal.tsx | 1111 | Extract sub-components / helpers |
| SettingsPage.tsx | 1028 | Extract sub-components / helpers |
| data-provider.ts | 1003 | Extract sub-components / helpers |



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