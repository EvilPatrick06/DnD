import { useEffect } from 'react'

type ShortcutContext = 'game' | 'lobby' | 'builder' | 'global'

interface ShortcutDef {
  key: string
  event: string
  description: string
}

const SHORTCUTS: Record<ShortcutContext, ShortcutDef[]> = {
  game: [
    { key: 'r', event: 'shortcut:open-dice-roller', description: 'Open dice roller' },
    { key: 'n', event: 'shortcut:next-turn', description: 'Next turn' },
    { key: 'Escape', event: 'shortcut:deselect-token', description: 'Deselect token' },
    { key: 'm', event: 'shortcut:toggle-minimap', description: 'Toggle minimap' },
    { key: 'c', event: 'shortcut:toggle-character-sheet', description: 'Toggle character sheet' },
    { key: 'i', event: 'shortcut:toggle-initiative', description: 'Toggle initiative' },
    { key: 'Enter', event: 'shortcut:focus-chat', description: 'Focus chat' }
  ],
  lobby: [
    { key: 'Enter', event: 'shortcut:focus-chat', description: 'Focus chat' },
    { key: 'Escape', event: 'shortcut:leave-lobby', description: 'Leave lobby' }
  ],
  builder: [
    { key: 'Escape', event: 'shortcut:close-modal', description: 'Close modal' }
  ],
  global: [
    { key: '?', event: 'shortcut:show-help', description: 'Show keyboard shortcuts' }
  ]
}

/**
 * Context-aware keyboard shortcuts hook.
 *
 * Dispatches custom events on `window` that other components can listen to.
 * Ignores shortcuts when the user is typing in an input, textarea, or
 * contenteditable element (except for Escape and Enter).
 */
export function useKeyboardShortcuts(context: ShortcutContext): void {
  useEffect(() => {
    const contextShortcuts = SHORTCUTS[context] ?? []
    const globalShortcuts = context !== 'global' ? SHORTCUTS.global : []
    const allShortcuts = [...contextShortcuts, ...globalShortcuts]

    function handleKeyDown(e: KeyboardEvent): void {
      // Allow Escape and Enter through even in inputs; block other shortcuts
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (isTyping && e.key !== 'Escape' && e.key !== 'Enter') {
        return
      }

      // Don't trigger shortcuts when modifier keys are held (allow normal browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }

      for (const shortcut of allShortcuts) {
        if (e.key === shortcut.key) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent(shortcut.event))
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [context])
}

/**
 * Get all shortcut definitions for a given context (including global).
 * Useful for rendering a help overlay.
 */
export function getShortcutsForContext(
  context: ShortcutContext
): ShortcutDef[] {
  const contextShortcuts = SHORTCUTS[context] ?? []
  const globalShortcuts = context !== 'global' ? SHORTCUTS.global : []
  return [...contextShortcuts, ...globalShortcuts]
}
