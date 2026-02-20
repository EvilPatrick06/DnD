# Phase 5 — Network & Multiplayer

You are working on **dnd-vtt**, an Electron + React 19 D&D virtual tabletop with PeerJS P2P networking. This phase fixes the biggest multiplayer gaps — game state sync, chat, and reconnection. The message types already exist in `network/types.ts` but most are never sent or received.

Refer to `CLAUDE.md` for architecture and key paths. The networking code lives in `src/renderer/src/network/`.

---

## 1. Game state sync over network (CRITICAL GAP)

**Files:** `host-manager.ts`, `client-manager.ts`, `message-handler.ts`, `GameLayout.tsx`, `useGameStore.ts`, `useNetworkStore.ts`

This is the biggest functional gap. The DM's game state (token positions, initiative, fog, conditions, map changes) is never broadcast. Each player has an independent local state.

### Implementation:

**A) Host broadcasts after mutations:**
After each `useGameStore` mutation in `GameLayout.tsx` handlers, the host sends a network message:

- `handleTokenMove` → send `dm:token-move` with `{ tokenId, x, y }`
- `handleCellClick` (fog) → send `dm:fog-reveal` with `{ cells, revealed }`
- Initiative changes → send `dm:initiative-update` with full initiative state
- Map changes → send `dm:map-change` with `{ mapId, mapData }`
- Condition changes → send `game:state-update` with condition patch
- Time/lighting changes → send `game:state-update`

**B) Full state sync on connect:**
When a new client connects (or reconnects), the host sends `game:state-full` containing the complete `useGameStore` snapshot (maps, tokens, initiative, conditions, time, lighting).

**C) Client applies received state:**
In the client's message handler, apply incoming state patches to `useGameStore`. For `game:state-full`, replace the entire store state.

---

## 2. Chat/whisper over network

**Files:** `GameLayout.tsx`, `useLobbyStore.ts`, `useNetworkStore.ts`, `ChatInput.tsx`

### In-game chat:
`handleSendChat` in `GameLayout` only updates local state. After building the local message, also call `sendMessage('chat:message', payload)`. In the network handler, push received `chat:message` packets into the local chat state.

### Whisper command:
The `/w <name> <message>` command creates a local message but never sends it. Fix:
- Resolve display name → peerId from lobby store.
- Send a `chat:whisper` message with `{ targetPeerId, content }`.
- The host forwards it only to the target peer.
- Both sender and recipient see the whisper locally.

### Lobby chat:
Verify `/roll` results are broadcast to all peers (not just added locally).

---

## 3. Reconnection with character preservation

**File:** `src/renderer/src/network/client-manager.ts`

On reconnect, `characterId` and `characterName` are sent as `null`. Fix:
- Store last `characterId` and `characterName` in module-level variables when initially set.
- On reconnect retry, include the stored values in the `player:join` payload.
- The host should recognize a returning peer (by peerId) and restore their state.

---

## 4. Map images for clients

**File:** `GameLayout.tsx`, `host-manager.ts`

Map `imagePath` is a local filesystem path — clients can't access it.

**Short-term fix:** When the DM sets a map active, read the image file as a base64 data URL and include it in the `dm:map-change` message payload. Clients use the data URL instead of the path.

**Size consideration:** For large images, consider compressing or downscaling before transmission. Set a max map image size (e.g., 4MB after encoding).

---

## 5. Map/token state persistence

**Files:** `GameLayout.tsx`, `useGameStore.ts`, `useCampaignStore.ts`

Maps, tokens, fog reveals, and initiative created during a session exist only in memory. Navigating away or crashing loses everything.

Fix: After meaningful mutations (token move, fog reveal, initiative change), debounce-save the game state back to the campaign via `useCampaignStore.saveCampaign()`. Also save on "End Session."

---

## 6. Connection quality indicator

**Files:** `host-manager.ts`, `client-manager.ts`, `useNetworkStore.ts`, player HUD component

Ping/pong message types exist but are unused.

Fix:
- Host sends `ping` every 5 seconds to each connected peer.
- Client responds with `pong` immediately.
- Host calculates RTT and stores per-peer latency.
- Broadcast latency updates to all peers.
- Display a small connection badge in the game HUD: green (<100ms), yellow (100-300ms), red (>300ms).

---

## Acceptance Criteria

- DM moving a token on the map is visible to all connected players.
- DM revealing fog is visible to all connected players.
- Initiative changes are synced to all players.
- A newly connected or reconnected client receives the full game state.
- Chat messages sent by any player appear for all players.
- Whisper messages are delivered only to the target player.
- Reconnected players retain their character selection.
- Map images are visible to clients (not just the DM).
- Game state is persisted to disk and survives app restarts.
- `npx tsc --build` passes.
