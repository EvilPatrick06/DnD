# Mounted Combat Design

**Date:** 2026-03-09

**Goal:** Complete mounted combat linking so a rider token stays aligned with its mount when the mount moves, unmounting clears the relationship cleanly, and players have an obvious way to access the mount flow from the token context menu.

## Current State

- `MapToken.riderId` already stores the rider entity on the mount token.
- `MountModal` already creates and clears mount links for the current character.
- `use-token-movement` contains partial rider-sync logic, but it only covers one interaction path and duplicates movement concerns outside the store.

## Chosen Approach

Centralize mounted movement in the game store's token move path instead of keeping it in a UI hook.

When a mount token moves, the store will update the linked rider token in the same state transition. This keeps drag movement, network-synced movement, chat commands, and any future token-move entry points consistent.

Unmount cleanup will also be centralized in the store by detecting when `riderId` is explicitly cleared from a mount token and removing the rider's `mountedOn` and `mountType` turn-state fields. The existing forced-dismount path will reuse the same cleanup behavior.

## Context Menu UX

For this pass, the token context menu will expose a `Mount` or `Unmount` action when the current character can infer the relationship:

- On the rider token itself.
- On a mount token that is already carrying the current character.
- On a mount candidate token that is adjacent to the current character token and large enough to be mounted.

The menu action will open the existing `MountModal` rather than duplicating mount rules in the menu.

## Testing Strategy

- Add store-level tests for mounted move sync and rider cleanup on unmount.
- Add context-menu rendering tests for `Mount` and `Unmount` visibility.
- Run targeted Vitest coverage for the edited files, then run lint/type checks on the touched code.
