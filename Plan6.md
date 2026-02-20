# D&D Virtual Tabletop – Suggestions & Recommendations

## Bug Fixes

### 1. **Version Mismatch**
- **MainMenuPage.tsx** displays `v1.0.0` but **package.json** says `2.1.0`.
- **Fix:** Import version from package.json (e.g. `import packageJson from '../../package.json'`) or use an env variable.

### 2. **Whisper Command Never Sends Over Network**
- The `/w <name> <message>` command only adds a message locally — the recipient never receives it.
- **Fix:** In `ChatInput.tsx`, handle `/w` and send `chat:whisper` with `targetPeerId` (resolve display name → peerId from lobby store). The host already forwards whispers in `useNetworkStore.ts`.

### 3. **Potential Race in Dice Roll Send**
- In `ChatInput.handleSend`, `sendChat(value)` is called, then `useLobbyStore.getState().chatMessages` is read. Zustand updates are synchronous, but the last message might not be the one just added if `sendChat` does multiple updates.
- **Fix:** Have `sendChat` return the created message, or compute the dice result in `ChatInput` and pass it to both `sendChat` and `sendMessage`.

### 4. **Client Reconnect Loses Character Selection**
- On reconnect, `attemptConnection` sends `characterId: null, characterName: null` in the join payload.
- **Fix:** Persist the last selected character and pass it into the reconnect join payload.

### 5. **Modal Accessibility**
- `Modal.tsx` lacks `role="dialog"`, `aria-modal`, focus trap, and Escape-to-close.
- **Fix:** Add ARIA attributes, trap focus when open, and handle Escape key.

---

## Quality of Life

### 6. **No 404 / Unknown Route**
- No catch-all route for unknown paths.
- **Fix:** Add `<Route path="*" element={<NotFoundPage />} />` with a simple "Page not found" view.

### 7. **Calendar Page Not in Main Menu**
- `CalendarPage` exists but isn't linked from the main menu.
- **Fix:** Add a "Calendar" or "Schedule" item to the main menu, or link it from campaign detail.

### 8. **Calendar Data Not Persisted**
- Calendar session schedules and availability are stored only in component state — lost on refresh.
- **Fix:** Persist via IPC (campaign storage) or a dedicated calendar store.

### 9. **Display Name Not Persisted**
- Display name isn't remembered between sessions.
- **Fix:** Store in `localStorage` and prefill on Join Game.

### 10. **Invite Code Input UX**
- Invite code input auto-uppercases but could handle paste/format better.
- **Fix:** Normalize on paste (trim, uppercase) and optionally add a "Paste" button.

### 11. **Loading States**
- Some pages (e.g. `ViewCharactersPage`, `CampaignDetailPage`) may not show loading while data is fetched.
- **Fix:** Add loading spinners or skeletons where data loads asynchronously.

### 12. **Error Boundaries**
- No React error boundary — a component crash blanks the whole app.
- **Fix:** Add an error boundary at app root and optionally per major section.

---

## New Features

### 13. **Quick Dice Roller**
- Add a floating or toolbar dice button for quick rolls (e.g. 1d20, 2d6) without typing `/roll`.

### 14. **Keyboard Shortcuts**
- Add shortcuts (e.g. Escape to close modals, Enter to submit forms) and document them in a help modal or tooltip.

### 15. **Connection Quality Indicator**
- Show connection quality or latency for host and clients.
- **Fix:** Use PeerJS connection metadata or periodic ping/pong to estimate latency.

### 16. **Chat History Limit**
- Chat messages grow unbounded in memory.
- **Fix:** Cap the number of messages (e.g. last 500) or paginate.

### 17. **Offline / Solo Mode**
- Make it clearer that users can use the app without hosting/joining (e.g. character builder, campaign prep).

### 18. **Export / Backup**
- Add campaign and character export/backup (e.g. JSON or `.dndcamp` / `.dndchar`).

---

## Code Quality

### 19. **LobbyPage Effect Dependencies**
- The `useEffect` that syncs peers → lobby players uses `useLobbyStore.getState()` inside the effect; dependency arrays may not reflect all used values.
- **Fix:** Review dependencies and consider extracting logic into a stable callback or custom hook.

### 20. **Duplicate Player on Lobby Mount**
- `addPlayer` runs in an effect when `localPeerId` and `displayName` exist; if the effect runs multiple times, the local player might be added more than once.
- **Fix:** Use `addPlayer`'s "upsert" behavior or guard with a ref so the local player is added only once.

### 21. **NetworkStore Handler Registration**
- `joinGame` registers `onMessage` and `onDisconnected` on every join; previous handlers may not be cleared.
- **Fix:** Unsubscribe on disconnect or before re-registering to avoid duplicate handlers.

### 22. **Console Logging in Production**
- Many `console.log`/`warn`/`error` calls throughout; consider a logging utility that can be disabled in production.

---

## Security / Robustness

### 23. **Input Sanitization**
- Chat and display names are validated but not sanitized for XSS if rendered as HTML.
- **Fix:** Ensure React's default escaping is used and avoid `dangerouslySetInnerHTML` for user content.

### 24. **File Type Validation**
- File uploads check extension and MIME; a malicious file could still be mislabeled.
- **Fix:** Add stricter validation (e.g. magic bytes) for critical file types.

### 25. **Rate Limiting**
- Host has rate limiting; consider similar limits on the client to avoid accidental spam.

---

## Suggested Priorities

| Priority | Item |
|----------|------|
| **High** | Version mismatch, whisper bug, client reconnect character loss |
| **Medium** | 404 route, modal accessibility, display name persistence |
| **Low** | Calendar persistence, error boundaries, chat history limit |
