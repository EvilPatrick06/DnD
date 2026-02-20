/**
 * Theme manager for the application.
 * Applies CSS custom properties to :root and persists the selection to localStorage.
 */

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

const THEME_DEFINITIONS: Record<ThemeName, ThemeVars> = {
  dark: {
    '--bg-primary': '#030712', // gray-950
    '--bg-secondary': '#111827', // gray-900
    '--bg-tertiary': '#1f2937', // gray-800
    '--text-primary': '#f3f4f6', // gray-100
    '--text-secondary': '#d1d5db', // gray-300
    '--text-muted': '#6b7280', // gray-500
    '--accent-primary': '#d97706', // amber-600
    '--accent-hover': '#f59e0b', // amber-500
    '--border-primary': '#374151', // gray-700
    '--border-secondary': '#1f2937' // gray-800
  },
  parchment: {
    '--bg-primary': '#f5f0e1',
    '--bg-secondary': '#e8e0cc',
    '--bg-tertiary': '#dbd1b8',
    '--text-primary': '#2c1810',
    '--text-secondary': '#4a3728',
    '--text-muted': '#7a6654',
    '--accent-primary': '#b8860b',
    '--accent-hover': '#d4a017',
    '--border-primary': '#c4b694',
    '--border-secondary': '#dbd1b8'
  },
  'high-contrast': {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-tertiary': '#1a1a1a',
    '--text-primary': '#ffffff',
    '--text-secondary': '#e0e0e0',
    '--text-muted': '#a0a0a0',
    '--accent-primary': '#ffff00',
    '--accent-hover': '#ffff66',
    '--border-primary': '#ffffff',
    '--border-secondary': '#666666'
  },
  'royal-purple': {
    '--bg-primary': '#1a0a2e',
    '--bg-secondary': '#241340',
    '--bg-tertiary': '#2e1c52',
    '--text-primary': '#c0c0c0',
    '--text-secondary': '#a0a0b0',
    '--text-muted': '#706080',
    '--accent-primary': '#9b59b6',
    '--accent-hover': '#b370d0',
    '--border-primary': '#4a2a6e',
    '--border-secondary': '#2e1c52'
  }
}

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
