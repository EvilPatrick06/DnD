/**
 * Theme manager for the application.
 * Applies CSS custom properties to :root and persists the selection to localStorage.
 */

import themesJson from '../../public/data/5e/ui/themes.json'

export type ThemeName = 'dark' | 'parchment' | 'high-contrast' | 'royal-purple'

interface ThemeVars {
  '--bg-primary': string
  '--bg-secondary': string
  '--bg-tertiary': string
  '--text-primary': string
  '--text-secondary': string
  '--text-muted': string
  '--accent-primary': string
  '--accent-hover': string
  '--border-primary': string
  '--border-secondary': string
}

const STORAGE_KEY = 'dnd-vtt-theme'

const THEME_DEFINITIONS = themesJson as Record<ThemeName, ThemeVars>

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let currentTheme: ThemeName = 'dark'

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/** Returns the currently active theme name. */
export function getTheme(): ThemeName {
  return currentTheme
}

/** Returns the ordered list of all available theme names. */
export function getThemeNames(): ThemeName[] {
  return Object.keys(THEME_DEFINITIONS) as ThemeName[]
}

/**
 * Applies the given theme by setting CSS custom properties on :root
 * and persists the choice to localStorage.
 */
export function setTheme(theme: ThemeName): void {
  const vars = THEME_DEFINITIONS[theme]
  if (!vars) return

  currentTheme = theme

  const style = document.documentElement.style
  for (const [prop, value] of Object.entries(vars)) {
    style.setProperty(prop, value)
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage may be unavailable; silently ignore
  }
}

/**
 * Reads the saved theme from localStorage and applies it.
 * Falls back to 'dark' if nothing is saved or the value is invalid.
 * Call this once on app start.
 */
export function loadSavedTheme(): void {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage may be unavailable
  }

  const names = getThemeNames()
  const theme: ThemeName = saved && names.includes(saved as ThemeName) ? (saved as ThemeName) : 'dark'
  setTheme(theme)
}
