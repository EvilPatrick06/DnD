# Mounted Combat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make mounted riders automatically follow their mounts, clear mount links cleanly on unmount, and expose a context-menu path to the existing mount flow.

**Architecture:** Move mounted-pair synchronization into `map-token-slice.ts` so every token move entry point benefits from the same logic. Keep UI changes thin by surfacing `Mount` and `Unmount` actions in `TokenContextMenu` that open the existing `MountModal`, while store-level cleanup owns the actual mounted-state consistency.

**Tech Stack:** React 19, TypeScript 5.9, Zustand v5 slice store, Vitest, Testing Library

---

### Task 1: Save The Approved Docs

**Files:**
- Create: `docs/plans/2026-03-09-mounted-combat-design.md`
- Create: `docs/plans/2026-03-09-mounted-combat-implementation-plan.md`

**Step 1: Write the approved design doc**

Write the accepted design covering:
- store-centered movement sync
- centralized unmount cleanup
- context-menu action opening the existing mount modal
- store and UI test coverage

**Step 2: Save the implementation plan**

Run the plan-writing workflow and save this file to disk.

**Step 3: Verify the files exist**

Run: `ls docs/plans`
Expected: both mounted-combat planning files are listed.

**Step 4: Commit**

Only if explicitly requested by the user:

```bash
git add docs/plans/2026-03-09-mounted-combat-design.md docs/plans/2026-03-09-mounted-combat-implementation-plan.md
git commit -m "docs: capture mounted combat design and plan"
```

### Task 2: Add Store Tests First

**Files:**
- Modify: `src/renderer/src/stores/game/map-token-slice.test.ts`
- Modify: `src/renderer/src/stores/game/map-token-slice.ts`

**Step 1: Write the failing test**

Add one test that proves moving a mount token also updates the linked rider token's grid position in the same map.

Add one test that proves clearing `riderId` from a mount token also clears the rider's `mountedOn` and `mountType` turn-state fields.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/stores/game/map-token-slice.test.ts`
Expected: FAIL because `moveToken()` and `updateToken()` do not yet centralize mounted state.

**Step 3: Write minimal implementation**

In `map-token-slice.ts`:
- add a small helper that updates a token position and, when the moved token has `riderId`, also updates the rider token position in the same map
- add a helper that clears mounted turn-state fields for a rider entity
- use the cleanup helper when `riderId` is explicitly cleared and when forced dismount occurs because the mount drops to `0` HP

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/stores/game/map-token-slice.test.ts`
Expected: PASS

**Step 5: Commit**

Only if explicitly requested by the user:

```bash
git add src/renderer/src/stores/game/map-token-slice.ts src/renderer/src/stores/game/map-token-slice.test.ts
git commit -m "feat: centralize mounted token sync"
```

### Task 3: Remove Duplicate Hook Sync

**Files:**
- Modify: `src/renderer/src/hooks/use-token-movement.ts`

**Step 1: Write the failing test**

If an existing hook test can capture it cleanly, add a focused assertion that mounted movement is owned by the store and the hook still exposes the same API.

If the existing hook tests are too shallow, skip new hook coverage and rely on the passing store tests while keeping the hook change minimal.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/hooks/use-token-movement.test.ts`
Expected: optional for this task; if no new assertion is added, use it as a safety check after the edit.

**Step 3: Write minimal implementation**

Remove the duplicated mount/rider sync block from `use-token-movement.ts` so mounted pairing is handled in one place.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/hooks/use-token-movement.test.ts`
Expected: PASS

**Step 5: Commit**

Only if explicitly requested by the user:

```bash
git add src/renderer/src/hooks/use-token-movement.ts src/renderer/src/hooks/use-token-movement.test.ts
git commit -m "refactor: remove duplicate mounted movement hook logic"
```

### Task 4: Add Context Menu Tests First

**Files:**
- Modify: `src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
- Modify: `src/renderer/src/components/game/overlays/TokenContextMenu.tsx`
- Modify: `src/renderer/src/components/game/GameLayout.tsx`

**Step 1: Write the failing test**

Add rendering tests that prove:
- a rider token for the current character shows `Unmount`
- a valid mount candidate token for the current character shows `Mount`
- unrelated tokens do not show either action

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
Expected: FAIL because the menu does not yet expose mount actions.

**Step 3: Write minimal implementation**

In `TokenContextMenu.tsx`:
- compute whether the clicked token is the current character token, that character's current mount, or a valid mount candidate
- render a `Mount` or `Unmount` button when the relationship is inferable
- add a callback prop that opens the existing mount modal

In `GameLayout.tsx`:
- pass `onOpenMountModal={() => setActiveModal('mount')}` into the context menu

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
Expected: PASS

**Step 5: Commit**

Only if explicitly requested by the user:

```bash
git add src/renderer/src/components/game/overlays/TokenContextMenu.tsx src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx src/renderer/src/components/game/GameLayout.tsx
git commit -m "feat: add mounted combat context menu actions"
```

### Task 5: Verify The Full Change

**Files:**
- Modify: `src/renderer/src/stores/game/map-token-slice.ts`
- Modify: `src/renderer/src/stores/game/map-token-slice.test.ts`
- Modify: `src/renderer/src/hooks/use-token-movement.ts`
- Modify: `src/renderer/src/components/game/overlays/TokenContextMenu.tsx`
- Modify: `src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
- Modify: `src/renderer/src/components/game/GameLayout.tsx`

**Step 1: Run targeted tests**

Run:
- `npx vitest run src/renderer/src/stores/game/map-token-slice.test.ts`
- `npx vitest run src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
- `npx vitest run src/renderer/src/hooks/use-token-movement.test.ts`

Expected: PASS

**Step 2: Run lint/type checks**

Run:
- `npx biome check src/renderer/src/stores/game/map-token-slice.ts src/renderer/src/components/game/overlays/TokenContextMenu.tsx src/renderer/src/components/game/GameLayout.tsx src/renderer/src/hooks/use-token-movement.ts src/renderer/src/stores/game/map-token-slice.test.ts src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx`
- `npx tsc --noEmit`

Expected: no new errors caused by the mounted combat changes

**Step 3: Review diff**

Run:
- `git diff -- docs/plans/2026-03-09-mounted-combat-design.md docs/plans/2026-03-09-mounted-combat-implementation-plan.md`
- `git diff -- src/renderer/src/stores/game/map-token-slice.ts src/renderer/src/stores/game/map-token-slice.test.ts src/renderer/src/hooks/use-token-movement.ts src/renderer/src/components/game/overlays/TokenContextMenu.tsx src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx src/renderer/src/components/game/GameLayout.tsx`

Expected: mounted movement is centralized, unmount cleanup is explicit, and the context menu opens the mount flow.

**Step 4: Commit**

Only if explicitly requested by the user:

```bash
git add docs/plans/2026-03-09-mounted-combat-design.md docs/plans/2026-03-09-mounted-combat-implementation-plan.md src/renderer/src/stores/game/map-token-slice.ts src/renderer/src/stores/game/map-token-slice.test.ts src/renderer/src/hooks/use-token-movement.ts src/renderer/src/components/game/overlays/TokenContextMenu.tsx src/renderer/src/components/game/overlays/TokenContextMenu.test.tsx src/renderer/src/components/game/GameLayout.tsx
git commit -m "feat: complete mounted combat token sync"
```
