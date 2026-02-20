# Phase 4 — UX Foundation & Quality of Life

You are working on **dnd-vtt**, an Electron + React 19 + Tailwind CSS 4 D&D virtual tabletop. This phase adds core UX infrastructure and fixes quality-of-life gaps. These are foundational components that later features will depend on.

Refer to `CLAUDE.md` for build commands, architecture, and key paths.

---

## 1. Toast/notification system

**Create:** `src/renderer/src/components/ui/Toast.tsx` and `src/renderer/src/hooks/useToast.ts`

Build a lightweight toast manager:
- Queue-based with max 3 visible toasts stacked in bottom-right corner.
- Auto-dismiss after 4 seconds (configurable). Manual dismiss on click.
- Variants: `success` (green), `error` (red), `warning` (amber), `info` (blue).
- Accessible: `role="alert"`, `aria-live="assertive"`.
- Use throughout the app for: save confirmations, delete confirmations, connection events, import/export results, error feedback.

---

## 2. React error boundaries

**Create or wire up:** `src/renderer/src/components/ui/ErrorBoundary.tsx`

- Wrap major route sections (InGamePage, LobbyPage, CreateCharacterPage, CampaignDetailPage) in error boundaries.
- Fallback UI: "Something went wrong" with a "Return to Menu" button.
- Log errors to the logger utility from Phase 3.
- Also add a global `window.addEventListener('unhandledrejection', ...)` handler.

---

## 3. Loading states / skeleton components

**Create:** `src/renderer/src/components/ui/Spinner.tsx` and `src/renderer/src/components/ui/Skeleton.tsx`

- `Spinner`: simple animated spinner for inline loading indicators.
- `Skeleton`: shimmer placeholder matching content layout (rows of gray bars).
- Replace all "Loading..." plain text with Spinner or Skeleton in: `ViewCharactersPage`, `CampaignDetailPage`, `InGamePage`, character builder data loads.

---

## 4. Confirmation dialog component

**Create:** `src/renderer/src/components/ui/ConfirmDialog.tsx`

Reusable confirmation modal for destructive actions:
- Props: `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `variant` (danger/warning).
- Use for: character deletion, campaign deletion, NPC deletion, kicking/banning players, leaving a game, ending a session.
- Replace all inline confirmation logic with this component.

---

## 5. Keyboard shortcuts + help overlay

**File:** Expand `useKeyboardShortcuts` or create new hooks as needed.

Add shortcuts:
- `Escape` — close topmost modal/panel (check modals before navigating away)
- `Ctrl+S` — save character/campaign
- `Space` — advance initiative (when initiative panel focused)
- `/` — focus chat input
- `?` — toggle keyboard shortcuts help overlay

**Create:** `src/renderer/src/components/ui/ShortcutsOverlay.tsx` — a modal listing all available shortcuts for the current context.

---

## 6. 404 / catch-all route

**File:** `src/renderer/src/App.tsx`

Add `<Route path="*" element={<NotFoundPage />} />` with a simple "Page not found — Return to Menu" view.

---

## 7. Search/filter for characters

**File:** `src/renderer/src/pages/ViewCharactersPage.tsx`

Add a search bar at the top that filters by character name. Add filter chips for class and level range. Apply the same pattern to character selector in lobby and NPC lists in campaign detail.

---

## 8. Chat message cap

**File:** `src/renderer/src/stores/useLobbyStore.ts`

Cap `chatMessages` array to the last 500 messages:
```typescript
chatMessages: [...state.chatMessages, msg].slice(-500)
```

---

## 9. Auto-save system

**Files:** `InGamePage.tsx`, `useGameStore.ts`, builder store

- **In-game:** Debounced auto-save (every 60 seconds after the last change) that writes `gameStore` maps/tokens/initiative back to the campaign via `useCampaignStore.saveCampaign()`.
- **Character builder:** Auto-save draft to localStorage every 30 seconds. On next launch, prompt "Resume draft?" if a draft exists.

---

## 10. Unsaved changes warning

**Files:** `CreateCharacterPage.tsx`, `CampaignDetailPage.tsx`

Track dirty state. Before navigation away, show a confirmation: "You have unsaved changes. Leave anyway?"

Use React Router's `useBlocker` or a `beforeunload` event handler.

---

## 11. Leave/End Session buttons

**File:** `src/renderer/src/components/game/GameLayout.tsx` (settings modal or top bar)

- DM: "End Session" button that broadcasts `dm:game-end` before disconnecting.
- Player: "Leave Game" button that sends `player:leave` and navigates to menu.

---

## 12. Reconnect UI

**File:** `src/renderer/src/pages/InGamePage.tsx`

When connection drops, show a reconnect banner overlay with:
- "Connection lost. Reconnecting..." with a countdown (retry 1/3, 2/3, 3/3).
- "Reconnect" manual retry button.
- "Leave Game" button.

---

## 13. Additional QoL fixes

- **Display name persistence**: Store last used display name in `localStorage`, prefill on Join Game.
- **Calendar data persistence**: Persist via IPC to campaign storage instead of component state.
- **No progress indicator on join**: Replace static "connecting" text on JoinGamePage with an animated spinner and countdown.
- **Fog drag-to-paint** (`MapCanvas.tsx`): Track pointer-down state and fire `onCellClick` continuously on `pointermove` when fog tool is active.
- **Zoom-reset button on map**: Add a "Reset View" button and `Home` key shortcut.
- **Clipboard fallback**: Use `document.execCommand('copy')` as fallback. Show toast on success or failure.
- **Duplicate dice engine**: Remove inline dice parsing from `DiceRoller.tsx`, use `dice-engine.ts` instead.

---

## Acceptance Criteria

- Toast component works and is used for at least save/delete/connection events.
- Error boundaries catch render errors on all major routes.
- Loading states use Spinner/Skeleton components (no plain "Loading..." text).
- All destructive actions require confirmation.
- Keyboard shortcuts overlay works via `?` key.
- Auto-save persists in-game state and builder drafts.
- `npx tsc --build` passes.
