# Phase 2 — Security Hardening

You are working on **dnd-vtt**, an Electron + React 19 D&D virtual tabletop with P2P networking via PeerJS. This phase hardens security across IPC, networking, and user input. Do not add new features.

Refer to `CLAUDE.md` for architecture and key paths.

---

## 1. File sharing MIME validation

**File:** `src/renderer/src/network/host-manager.ts`

Only the declared `mimeType` string is checked, not the actual file content. A malicious peer could send `mimeType: 'image/png'` with executable content.

Fix:
- Validate magic bytes of the base64-decoded data against the claimed MIME type (at least for images: PNG `89504E47`, JPEG `FFD8FF`, GIF `47494638`).
- Block `.js`, `.html`, `.bat`, `.cmd`, `.ps1` extensions explicitly.
- Tighten the MIME allowlist to only: `image/*`, `application/pdf`, `application/json`.

---

## 2. Message validation gaps

**Files:** `src/renderer/src/network/host-manager.ts`, `client-manager.ts`, `src/renderer/src/network/schemas.ts` (if exists)

- Only 3 of 40+ message types are validated server-side. Add Zod validation for all message types that carry user data (chat, file, token moves, initiative updates).
- Remove `.passthrough()` from Zod schemas — it allows undeclared fields through.
- Fix validation order: `senderId`/`senderName` are overwritten *after* Zod validation. Overwrite *before* validating or validate separately.

---

## 3. Large message parsed before size check

**File:** `src/renderer/src/network/host-manager.ts`

The host parses the full JSON of messages before checking the size limit. A malicious client can send huge payloads to cause memory spikes.

Fix: check `data.length` (raw string) before calling `JSON.parse`. Reject messages over the size limit without parsing.

---

## 4. CSP unsafe-inline

**File:** `src/main/index.ts`

Content Security Policy allows `'unsafe-inline'` for styles, which weakens XSS protection.

Fix: remove `'unsafe-inline'` from style-src. If Tailwind or runtime styles need it, use nonces or hashes instead.

---

## 5. Input length limits

**Files:** `src/main/ipc/index.ts`, `host-manager.ts`, `useLobbyStore.ts`

Some IPC handlers and network paths don't enforce max lengths. Add limits:
- Display names: min 1, max 32 characters. Reject whitespace-only.
- Chat messages: max 2000 characters (already partially enforced, make consistent).
- Character/campaign names: max 100 characters.
- File data payloads: max 8MB (verify this is enforced consistently on all paths).
- Ban peer ID arrays: validate each item is a string with max length 100.

---

## 6. Dice formula bounds

**File:** `src/renderer/src/services/dice-engine.ts` (or wherever dice parsing happens)

`rollDice("9999d9999")` is currently allowed. Cap:
- Max dice count: 100
- Max die sides: 1000
- Max total dice expressions in one formula: 10

Return an error for formulas exceeding these limits.

---

## 7. Global rate limit

**File:** `src/renderer/src/network/host-manager.ts`

Rate limiting is per-peer only. Many peers at their individual limits can collectively overwhelm the host.

Fix: add a global messages-per-second cap (e.g., 200 messages/second across all peers). If exceeded, drop excess messages and log a warning.

---

## 8. Audio handler path sanitization

**File:** `src/main/ipc/` (audio handlers)

`sanitizedFileName` only replaces non-alphanumeric chars but doesn't prevent `../` traversal after assembly. `campaignId` is used in paths without UUID validation.

Fix:
- Validate `campaignId` is a valid UUID before using in paths.
- After assembling the full path, verify it resolves within the expected directory using `path.relative()`.

---

## 9. Console logging sensitive data

**Files:** `host-manager.ts`, `voice-manager.ts`, `client-manager.ts`, `peer-manager.ts`

Peer IDs, display names, and connection details are logged to the console. In production builds these are visible in DevTools.

Fix: gate all debug-level logging behind `import.meta.env.DEV`. Only log errors in production. (This pairs with the logger utility in Phase 3, but at minimum wrap sensitive logs now.)

---

## 10. No file size limits on IPC

**File:** `src/main/ipc/index.ts`

IPC file handlers (`fs:read-file`, `fs:write-file`) don't enforce size limits. A malicious or corrupted file could exhaust memory.

Fix: check file size before reading (e.g., `fs.stat` first). Reject files over a reasonable limit (e.g., 50MB for maps, 10MB for data files).

---

## Acceptance Criteria

- All message types carrying user data are validated with Zod (no `.passthrough()`).
- File sharing validates magic bytes, not just declared MIME type.
- Message size is checked *before* JSON.parse.
- All path constructions use `path.relative()` to prevent traversal.
- Input lengths are enforced on all IPC and network boundaries.
- Dice formula parsing rejects unreasonable values.
- `npx tsc --build` passes.
