# Phase 6 — Performance & Accessibility

You are working on **dnd-vtt**, an Electron + React 19 + Tailwind CSS 4 + PixiJS D&D virtual tabletop. This phase optimizes rendering performance and adds baseline accessibility. No new features.

Refer to `CLAUDE.md` for build commands, architecture, and key paths.

---

## Performance

### 1. Virtualize long lists

**Files:** `ChatPanel.tsx` (lobby and game), `EquipmentPickerModal.tsx`, `GearTab.tsx`

These components render all items in the DOM. For long sessions or large datasets, this is slow.

Fix: Install `@tanstack/react-virtual` and virtualize scrollable lists that can exceed ~50 items. Keep the existing styling — just wrap in a virtual scroller.

---

### 2. React.memo on list items

**Files:** `PlayerCard.tsx`, `CharacterCard.tsx`, chat message components, initiative list items

Wrap frequently-rendered list item components in `React.memo` to prevent re-renders when sibling items change. Only memo components where the props are stable or can be made stable.

---

### 3. useMemo for expensive calculations

**Files:** `stat-calculator-5e.ts` callers, `GameLayout.tsx`, `PlayerList.tsx`, `ChatPanel.tsx`

Wrap expensive derivations in `useMemo`:
- Sorted/filtered player lists
- Chat message filtering (dice vs. regular)
- Stat calculations (AC, HP, modifiers) that recompute on every render
- Spell groupings and proficiency bonus calculations

---

### 4. Route-level code splitting

**File:** `src/renderer/src/App.tsx`

Use `React.lazy` + `Suspense` for heavy routes:

```typescript
const InGamePage = React.lazy(() => import('./pages/InGamePage'))
const CreateCharacterPage = React.lazy(() => import('./pages/CreateCharacterPage'))
const CampaignDetailPage = React.lazy(() => import('./pages/CampaignDetailPage'))
```

Wrap in `<Suspense fallback={<Spinner />}>`. This keeps MapCanvas (PixiJS) and DiceRoller (Three.js) out of the initial bundle.

---

### 5. Token rendering optimization

**File:** `src/renderer/src/components/game/MapCanvas.tsx`

`renderTokens` clears and rebuilds ALL sprites on any token change. Fix: diff the previous and current token arrays. Only add/remove/update sprites that actually changed. Keep a `Map<tokenId, Sprite>` for O(1) lookups.

---

### 6. Narrow Zustand store subscriptions

**Files:** Various components subscribing to `useGameStore`, `useLobbyStore`, `useNetworkStore`

Components that select the entire store object re-render on every state change. Fix:
- Use narrow selectors: `useGameStore(s => s.initiative)` instead of `useGameStore()`.
- Use `useShallow` from `zustand/react/shallow` for object selectors.
- Specifically fix `InGamePage.tsx` where `gameStore` (full store) is a useEffect dependency — depend on `gameStore.campaignId` instead.

---

### 7. Parallelize buildCharacter5e data loading

**File:** `src/renderer/src/stores/builder/slices/save-slice.ts`

Data files are loaded sequentially. Use `Promise.all` to load race, class, background, and subclass data in parallel.

---

## Accessibility

### 8. ARIA labels on all interactive elements

**Files:** All component files with icon-only buttons

Audit and add `aria-label` to every button, toggle, and interactive element that lacks visible text:
- Close buttons on modals and panels
- DM toolbar tool buttons
- Voice controls (mute, deafen)
- Panel toggle buttons
- Copy invite code button
- Dice roller buttons
- Map tool buttons (select, fog, measure)

---

### 9. Modal focus trapping

**File:** `src/renderer/src/components/ui/Modal.tsx`

- Add `role="dialog"` and `aria-modal="true"`.
- Add `aria-labelledby` pointing to the modal title.
- Implement focus trap: on open, focus the first focusable element. Tab should cycle within the modal. On close, restore focus to the element that opened it.
- Close on Escape key.

---

### 10. Focus-visible styles

**File:** `src/renderer/src/styles/globals.css` and `Button.tsx`, `Input.tsx`

- Add global `:focus-visible` ring styles.
- Replace all `focus:outline-none` with `focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1`.
- Ensure keyboard users can see what's focused while mouse users see no outlines.

---

### 11. aria-live regions

**Files:** `ChatPanel.tsx`, `DiceRoller.tsx`, `InitiativeTracker.tsx`

Add `aria-live="polite"` regions so screen readers announce:
- New chat messages
- Dice roll results
- Initiative turn changes
- Connection status changes

---

### 12. Semantic HTML fixes

**Files:** `CharacterCard.tsx`, `Input.tsx`, and components using `div onClick`

- Replace `<div onClick>` with `<button>` for all clickable cards and interactive elements.
- In `Input.tsx`: link label via `htmlFor`/`id`. Connect error messages via `aria-describedby`. Add `aria-invalid` when in error state.
- In collapsible sections: add `aria-expanded` to toggle buttons.

---

## Acceptance Criteria

- Long chat lists and equipment lists use virtual scrolling (no DOM nodes for off-screen items).
- `React.memo` wraps at least PlayerCard, CharacterCard, and chat message items.
- Heavy pages (InGame, CreateCharacter, CampaignDetail) are lazy-loaded.
- Token rendering diffs instead of full rebuild.
- Every icon-only button has an `aria-label`.
- Modals trap focus, have `role="dialog"`, and close on Escape.
- Focus-visible ring styles are visible on keyboard navigation.
- `npx tsc --build` passes.
