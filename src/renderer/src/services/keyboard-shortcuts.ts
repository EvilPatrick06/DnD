// keyboard-shortcuts.ts — Global keyboard shortcut manager for the game view

import shortcutsJson from '../../public/data/5e/ui/keyboard-shortcuts.json'

export interface ShortcutDefinition {
  key: string // e.g., 'Space', 'Escape', 'd', '1'-'9'
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: string // identifier like 'end-turn', 'open-dice', etc.
  description: string // human-readable
  category: 'combat' | 'navigation' | 'tools' | 'general'
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = shortcutsJson as ShortcutDefinition[]

type ShortcutHandler = (action: string) => void

let handler: ShortcutHandler | null = null
let enabled = true
let listening = false

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

function normalizeKey(key: string): string {
  // Normalize common key representations
  if (key === ' ') return ' '
  return key.toLowerCase()
}

function matchesShortcut(e: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const wantCtrl = shortcut.ctrl ?? false
  const wantShift = shortcut.shift ?? false
  const wantAlt = shortcut.alt ?? false

  if (e.ctrlKey !== wantCtrl || e.metaKey !== wantCtrl) {
    // Allow either Ctrl or Meta (Cmd on Mac) to match ctrl requirement
    if (!(e.ctrlKey === wantCtrl || e.metaKey === wantCtrl)) return false
    // But at least one must match if wantCtrl is true
    if (wantCtrl && !e.ctrlKey && !e.metaKey) return false
    // And neither should be pressed if wantCtrl is false
    if (!wantCtrl && (e.ctrlKey || e.metaKey)) return false
  }
  if (e.shiftKey !== wantShift) return false
  if (e.altKey !== wantAlt) return false

  const pressedKey = normalizeKey(e.key)
  const shortcutKey = normalizeKey(shortcut.key)

  return pressedKey === shortcutKey
}

function handleKeyDown(e: KeyboardEvent): void {
  if (!enabled || !handler) return
  if (isEditableTarget(e.target)) return

  for (const shortcut of DEFAULT_SHORTCUTS) {
    if (matchesShortcut(e, shortcut)) {
      e.preventDefault()
      e.stopPropagation()
      handler(shortcut.action)
      return
    }
  }
}

/**
 * Register a handler that receives action strings when shortcuts are pressed.
 * Returns a cleanup function to unregister.
 */
export function registerHandler(h: ShortcutHandler): () => void {
  handler = h
  return () => {
    if (handler === h) {
      handler = null
    }
  }
}

/** Start listening for keyboard events on window. */
export function init(): void {
  if (listening) return
  window.addEventListener('keydown', handleKeyDown, true)
  listening = true
}

/** Stop listening for keyboard events. */
export function destroy(): void {
  if (!listening) return
  window.removeEventListener('keydown', handleKeyDown, true)
  listening = false
  handler = null
}

/** Enable or disable shortcut processing (e.g., disable when typing in input). */
export function setEnabled(e: boolean): void {
  enabled = e
}

/** Get all shortcut definitions (for the reference modal). */
export function getShortcuts(): ShortcutDefinition[] {
  return DEFAULT_SHORTCUTS
}

/** Get shortcut definitions grouped by category. */
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const grouped: Record<string, ShortcutDefinition[]> = {}
  for (const shortcut of DEFAULT_SHORTCUTS) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = []
    }
    grouped[shortcut.category].push(shortcut)
  }
  return grouped
}

/** Format a shortcut's key combo for display (e.g., "Ctrl+Z"). */
export function formatKeyCombo(shortcut: ShortcutDefinition): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')

  // Friendly key names for display
  let keyDisplay = shortcut.key
  if (keyDisplay === ' ') keyDisplay = 'Space'
  else if (keyDisplay === 'Escape') keyDisplay = 'Esc'
  else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase()

  parts.push(keyDisplay)
  return parts.join('+')
}
