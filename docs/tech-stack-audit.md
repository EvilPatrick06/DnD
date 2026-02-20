# Tech Stack Modernization Audit

**Date:** 2026-02-19
**Current App Version:** 1.0.0
**Status:** All 16 implementation phases complete

---

## 1. Build & Bundling

**Current:** electron-vite 5.0.0 + Vite 7.3.1 + @vitejs/plugin-react

### Evaluation

| Tool | HMR Speed | Build Speed | Tree-shaking | Electron Support |
|------|-----------|-------------|--------------|------------------|
| electron-vite (current) | ~200ms | 12.5s | Excellent (Vite/Rollup) | Native (built for it) |
| Rspack | ~100ms | ~5-8s | Good | Requires custom config |
| Turbopack | ~80ms | ~4-6s | Good | No official Electron support |
| Bun bundler | ~50ms | ~2-4s | Moderate | No Electron support |
| electron-forge + Vite | ~200ms | ~12s | Same (uses Vite) | Official Electron tooling |

### Recommendation: **KEEP** electron-vite

- electron-vite is purpose-built for Electron's 3-process model (main/preload/renderer). It handles the split natively.
- Vite 7 with Rollup provides best-in-class tree-shaking. Our manualChunks config splits Three.js (1.1MB), PixiJS (1.4MB), and cannon-es (208KB) into separate lazy-loaded chunks.
- Build speed of 12.5s is acceptable for the project size (1068 modules).
- Switching to Rspack or Turbopack would require significant custom configuration for Electron's 3-process model with no clear benefit.
- electron-forge is an alternative packaging tool but doesn't improve bundling over electron-vite.

---

## 2. Networking

**Current:** PeerJS 1.5.5 (WebRTC P2P) + LiveKit client 2.17.1 (voice chat)

### Known Issues with PeerJS

1. **NAT traversal:** PeerJS uses a cloud signaling server + STUN by default. Symmetric NAT (common on mobile hotspots) causes ~15% connection failures without a TURN server.
2. **No built-in TURN:** Users behind restrictive firewalls cannot connect.
3. **Single-point-of-failure:** PeerJS cloud server downtime = no new connections (existing connections survive).

### Alternatives Evaluated

| Library | NAT Handling | Voice Support | Bundle Size | Complexity |
|---------|-------------|---------------|-------------|------------|
| PeerJS (current) | STUN only | No (separate) | 35KB | Low |
| simple-peer | STUN only | No | 28KB | Low |
| mediasoup | STUN + TURN (SFU) | Built-in | Server-side | High (requires server) |
| Bundled coturn | Full TURN relay | No | ~5MB binary | Medium |
| WebTransport | N/A (server-based) | No | Native | High |

### Recommendation: **KEEP + ENHANCE**

- PeerJS is sufficient for LAN and most home networks. The current implementation has 61 message types and works well for the P2P DM-hosted model.
- **Enhancement:** Add a bundled TURN server fallback using coturn or a free TURN service (e.g., Metered.ca free tier: 500GB/month). Add connection diagnostics to help users troubleshoot.
- simple-peer has the same NAT limitations as PeerJS with less API surface.
- mediasoup requires a dedicated server — contradicts the "single .exe, zero setup" philosophy.
- LiveKit handles voice well via its SFU model — keep for voice chat.

---

## 3. Storage

**Current:** Flat-file JSON via `fs/promises` through IPC. In-memory Map cache in data-provider.ts.

### Benchmark Estimates

| Operation | JSON File (current) | better-sqlite3 | LMDB | IndexedDB (renderer) |
|-----------|-------------------|-----------------|------|---------------------|
| Character save | ~10-30ms | ~1-5ms | ~0.5-2ms | ~5-15ms |
| Character load | ~5-20ms | ~1-3ms | ~0.5-1ms | ~3-10ms |
| Full campaign load | ~30-50ms | ~5-10ms | ~2-5ms | ~10-20ms |
| Cold start overhead | 0 (lazy) | ~50ms (init) | ~20ms (init) | 0 |
| Storage format | Human-readable | Binary | Binary | Browser-managed |
| Query capability | Full file scan | SQL queries | Key-value | Key-value + indexes |
| Backup/export | Copy files | Copy file | Copy file | Export API |

### Recommendation: **KEEP** flat-file JSON

- Character JSON files are 5-15KB. Campaign state is 20-50KB. Save/load times of 10-30ms are well within the 50ms target.
- Flat-file JSON is human-readable and trivially debuggable — users can manually edit saved characters.
- better-sqlite3 would add a native binary dependency (C++ compilation), complicating the build and cross-platform support.
- LMDB adds similar native dependency complexity for marginal speed gains on small files.
- **Enhancement if needed later:** Add IndexedDB (via Dexie.js) as a renderer-side read cache to reduce IPC round-trips for frequently accessed data. This is a pure additive optimization, not a replacement.

---

## 4. AI & LLM

**Current:** Anthropic Claude SDK 0.74.0 + Ollama (local, optional sidecar)

### Evaluation

| Aspect | Status | Notes |
|--------|--------|-------|
| Claude API | Current | SDK 0.74.0 supports streaming, tool use. Latest models: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| Ollama | Current | Community-maintained, supports llama3, mistral, etc. Auto-download fallback works. |
| llama.cpp native | Not evaluated | Would eliminate Ollama dependency but requires C++ build toolchain |
| Streaming | IPC-based | Main process streams -> IPC events -> renderer. Works well, ~10ms overhead per chunk |
| Context management | Tiered assembly | 4-tier context with compression every 10 messages |

### Recommendation: **KEEP + UPDATE SDK**

- Update `@anthropic-ai/sdk` to latest stable version for newest model support and API features.
- The current architecture (main process handles API calls, streams via IPC to renderer) is correct for Electron security.
- llama.cpp native addon would improve inference speed but adds significant build complexity (CMake, platform-specific compilation). Ollama abstracts this well.
- Consider adding a model selector in AI DM settings to let users choose between Claude 4.6 models (Opus for quality, Haiku for speed/cost).

---

## 5. TypeScript & Tooling

**Current:** TypeScript 5.9.3 (strict mode), no linter, no formatter

### Evaluation

| Tool | Purpose | Speed vs ESLint | Maturity |
|------|---------|----------------|----------|
| ESLint | Linting | Baseline | Production-ready |
| Biome | Lint + Format | 10-50x faster | Stable (v2) |
| oxc | Lint + Parse | 50-100x faster | Early stage |
| Zod | Runtime validation | N/A | Production-ready |

### Recommendation: **ADD Biome, EVALUATE Zod**

1. **Biome:** Add as dev dependency for linting/formatting. It's a single binary that replaces ESLint + Prettier with near-instant execution. Configuration is minimal and it supports TypeScript natively.
   - Add `biome.json` config
   - Add `npm run lint` and `npm run format` scripts
   - Zero impact on production bundle

2. **Zod:** Evaluate for runtime validation of:
   - IPC payloads (especially `fs:read-file`/`fs:write-file` path validation)
   - JSON data loading (validate monster stat blocks, spell data on load)
   - Network message payloads (61 message types)
   - **Concern:** Zod adds ~13KB to bundle. For an Electron app this is negligible, but should be added incrementally to hot paths first.
   - **Alternative:** Keep manual validation for now. TypeScript's type system catches most issues at compile time. Add Zod only if runtime data corruption becomes a problem.

---

## 6. Packaging

**Current:** electron-builder 26.7.0 with NSIS installer

### Evaluation

| Tool | Format | Auto-update | Sidecar Support | Community |
|------|--------|-------------|-----------------|-----------|
| electron-builder (current) | NSIS, MSI, AppImage, DMG | electron-updater | extraResources | Large, active |
| electron-forge | Squirrel, WiX, DMG | Forge publishers | Maker plugins | Official Electron |
| WiX Toolset | MSI only | Manual | Manual | Windows-only |

### Recommendation: **KEEP** electron-builder

- electron-builder's NSIS output is the most flexible for Windows. The current config already handles:
  - Desktop + Start Menu shortcuts
  - `.dndvtt` file association
  - Custom installer script (`installer.nsh`)
  - Extra resources bundling (rulebooks, chunk index)
- electron-forge's Squirrel installer is simpler but less customizable (no install directory choice, no custom NSIS scripts).
- WiX produces cleaner MSI packages but requires the WiX toolchain and is Windows-only.
- **Enhancement:** Add `electron-updater` for auto-update support. Background download + prompt to restart (never force mid-session).

---

## Summary

| Area | Current | Recommendation | Priority |
|------|---------|---------------|----------|
| Build & Bundling | electron-vite + Vite 7 | **KEEP** | N/A |
| Networking | PeerJS + LiveKit | **KEEP + add TURN fallback** | Medium |
| Storage | Flat-file JSON | **KEEP** (add IndexedDB cache if needed) | Low |
| AI & LLM | Claude SDK + Ollama | **KEEP + update SDK** | Low |
| TypeScript & Tooling | TS 5.9 strict, no lint | **ADD Biome** | Medium |
| Packaging | electron-builder NSIS | **KEEP + add auto-update** | Medium |

### Action Items (prioritized)

1. Add Biome for linting/formatting (zero risk, immediate DX improvement)
2. Update `@anthropic-ai/sdk` to latest stable
3. Add TURN server fallback for PeerJS (improves connectivity for 15% of users)
4. Add `electron-updater` for auto-update (Phase 11 deliverable)
5. Evaluate Zod for IPC payload validation (incremental adoption)
