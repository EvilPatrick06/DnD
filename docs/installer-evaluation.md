# Installer Evaluation

Assessment of bundling, code signing, and packaging for the D&D VTT Electron application.

## Current Packaging

- **Builder:** electron-builder with NSIS target for Windows
- **Installer:** NSIS (Nullsoft Scriptable Install System) — allows custom install directory, desktop/start menu shortcuts
- **File association:** `.dndvtt` registered for character/campaign import/export
- **Config:** `electron-builder.yml` with `signAndEditExecutable: true` (icon/metadata embedded; signing skipped without certificate)
- **Extra resources:** Rulebook markdown files and chunk-index.json bundled via `extraResources`

## Ollama Sidecar Bundling

**Recommendation: Separate install (do not bundle)**

- Ollama is a standalone Go binary with GPU-specific runtime dependencies (~500MB+ installed)
- Ollama releases update independently and frequently; bundling would lock users to a stale version
- The app already implements Ollama management: detect, download, install, start, pull models (see `src/main/ai/` and the `ai:detect-ollama` / `ai:download-ollama` / `ai:install-ollama` IPC channels)
- Users who want local AI can install Ollama once; the app guides them through setup
- Bundling would inflate the installer from ~120MB to ~600MB+ with no benefit over the current guided install flow

## LiveKit Server Bundling

**Recommendation: Cloud-hosted (do not bundle)**

- LiveKit is a WebRTC SFU (Selective Forwarding Unit) server written in Go
- It requires a publicly accessible server with open UDP/TCP ports for media relay
- Running a local LiveKit server behind NAT defeats the purpose (peers already use PeerJS for direct WebRTC)
- Voice chat via LiveKit is intended for scenarios where direct P2P fails (symmetric NAT, firewalls)
- Cloud-hosted options: LiveKit Cloud (free tier available), self-hosted on a VPS
- The app already connects to a configured LiveKit server URL; no local server needed

## Code Signing

**Recommendation: Purchase certificate when preparing for public distribution**

- **Why:** Unsigned Windows executables trigger SmartScreen warnings ("Windows protected your PC"), which discourages installation
- **Provider options:** DigiCert, Sectigo (Comodo), GlobalSign — standard code signing certificates cost $200-500/year; EV certificates ($400-700/year) bypass SmartScreen immediately
- **electron-builder integration:** Set `WIN_CSC_LINK` (path to .pfx) and `WIN_CSC_KEY_PASSWORD` environment variables; electron-builder signs automatically during build
- **Current state:** `electron-builder.yml` has `signAndEditExecutable: true` — rcedit embeds icon and version metadata, but signing is gracefully skipped without a certificate
- **macOS:** Would require an Apple Developer certificate ($99/year) and notarization; not currently relevant (Windows-only target)

## Summary

| Item | Action | Rationale |
|------|--------|-----------|
| Ollama | Keep separate install | Too large, updates independently, guided setup already implemented |
| LiveKit | Cloud-hosted | Requires public server, not suitable for local bundling |
| Code signing | Purchase when distributing | Eliminates SmartScreen warnings, ~$200-500/year |
| NSIS installer | Keep current config | Working well, supports custom install dir and file associations |
