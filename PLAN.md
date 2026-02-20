# D&D Virtual Tabletop — Development Plan

## Project Overview

**dnd-vtt** is an Electron desktop app for online Dungeons & Dragons sessions. It supports D&D 5e and Pathfinder 2e, with character creation, campaign management, and real-time multiplayer via PeerJS.

---

## Current Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 40 |
| Build | Vite 7, electron-vite |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Maps/Canvas | Pixi.js 8 |
| Networking | PeerJS (P2P) |
| IDs | uuid |

### Directory Structure

```
src/
├── main/           # Electron main process
├── preload/        # Preload scripts
└── renderer/src/
    ├── components/ # UI components (game, lobby, sheet, ui)
    ├── data/       # Static data (skills, conditions, moderation)
    ├── hooks/      # useKeyboardShortcuts, etc.
    ├── network/    # PeerJS host/client, voice, message routing
    ├── pages/      # Route-level pages
    ├── services/   # Stat calculators, dice engine, data loaders
    ├── stores/     # Zustand stores (campaign, character, game, network, etc.)
    ├── systems/    # D&D 5e and PF2e system adapters
    └── types/      # TypeScript types
```

### Key Flows

1. **Character creation** → Builder store (slices) → Character store → JSON export/import
2. **Campaign** → Campaign store → Maps, tokens, fog of war, journal
3. **Network** → Host creates session → Client joins via invite code → State sync, voice, chat
4. **In-game** → Game store (initiative, conditions) → Pixi map + tokens → Dice rolls, fog reveal

---

## Current Features

### Implemented

- [x] Main menu and navigation
- [x] Character creation (5e, PF2e) with builder UI
- [x] Character sheet display
- [x] Campaign creation and management
- [x] Map support (grid, tokens, fog of war)
- [x] Make game (host) / Join game (client)
- [x] Lobby with ready state, player list, voice controls
- [x] In-game view with map, tokens, initiative
- [x] Dice rolling (shared across network)
- [x] Voice chat (PeerJS)
- [x] Calendar page
- [x] Campaign journal / session notes

### Partially Implemented / Needs Polish

- [ ] Token movement sync (TokenMovePayload exists; verify full flow)
- [ ] Fog reveal sync (FogRevealPayload exists)
- [ ] Condition application to tokens
- [ ] Spell/ability integration with dice
- [ ] Adventure loader integration

---

## Roadmap

### Phase 1: Core Stability

| Task | Priority | Notes |
|------|----------|-------|
| Fix token movement sync | High | Ensure TokenMovePayload flows host→clients correctly |
| Fog of war sync | High | FogRevealPayload; DM reveals, players see |
| Reconnection handling | High | Peer drops; rejoin without full reload |
| Error boundaries | Medium | Graceful UI on network/store failures |

### Phase 2: Gameplay

| Task | Priority | Notes |
|------|----------|-------|
| Initiative tracker UI | High | Turn order, next/previous, round counter |
| Condition application | High | Apply conditions to tokens, show on sheet |
| Dice from sheet | Medium | Roll from character sheet (skills, saves, attacks) |
| Spell/ability macros | Medium | One-click roll + modifier |

### Phase 3: Content & UX

| Task | Priority | Notes |
|------|----------|-------|
| Adventure loader | Medium | Load pre-built adventures/maps |
| Map import | Medium | Drag-drop images, grid calibration |
| Character import | Low | Import from JSON/PDF parsers |
| Theming | Low | Dark/light, accent colors |

### Phase 4: Scale & Polish

| Task | Priority | Notes |
|------|----------|-------|
| TURN server fallback | Medium | PeerJS TURN when direct P2P fails |
| Performance profiling | Medium | Large maps, many tokens |
| Automated tests | Low | Unit + integration |
| Packaging | Low | Windows installer, macOS, Linux |

---

## Technical Debt & Notes

- **Network**: PeerJS is P2P; NAT traversal can fail. Consider TURN relay or optional server.
- **State sync**: Host is source of truth; clients receive updates. Ensure idempotency for out-of-order messages.
- **Storage**: Campaign/character data stored locally (Electron); no cloud sync.
- **System split**: 5e and PF2e have separate types and services; registry pattern in `systems/` keeps them pluggable.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Electron dev mode |
| `npm run build` | Production build |
| `npm run build:win` | Build + Windows installer |

---

*Last updated: Feb 2025*
