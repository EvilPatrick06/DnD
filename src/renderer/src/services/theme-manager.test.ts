import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock themes JSON
vi.mock('../../public/data/ui/themes.json', () => ({
  default: {
    dark: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-tertiary': '#0f3460',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#b0b0b0',
      '--text-muted': '#707070',
      '--accent-primary': '#e94560',
      '--accent-hover': '#ff6b6b',
      '--border-primary': '#333',
      '--border-secondary': '#555'
    },
    parchment: {
      '--bg-primary': '#f5f0e1',
      '--bg-secondary': '#ebe5d4',
      '--bg-tertiary': '#d9d0bc',
      '--text-primary': '#3e2723',
      '--text-secondary': '#5d4037',
      '--text-muted': '#8d6e63',
      '--accent-primary': '#8b0000',
      '--accent-hover': '#a52a2a',
      '--border-primary': '#bfae94',
      '--border-secondary': '#a09070'
    },
    'high-contrast': {
      '--bg-primary': '#000000',
      '--bg-secondary': '#111111',
      '--bg-tertiary': '#222222',
      '--text-primary': '#ffffff',
      '--text-secondary': '#eeeeee',
      '--text-muted': '#cccccc',
      '--accent-primary': '#00ffff',
      '--accent-hover': '#00cccc',
      '--border-primary': '#ffffff',
      '--border-secondary': '#eeeeee'
    },
    'royal-purple': {
      '--bg-primary': '#1a0a2e',
      '--bg-secondary': '#2d1b4e',
      '--bg-tertiary': '#3d2b5e',
      '--text-primary': '#e8d5f5',
      '--text-secondary': '#c8a5e5',
      '--text-muted': '#9575cd',
      '--accent-primary': '#bb86fc',
      '--accent-hover': '#d4a5ff',
      '--border-primary': '#4a2b7e',
      '--border-secondary': '#6a4b9e'
    }
  }
}))

// Mock document.documentElement.style
const mockStyle = {
  setProperty: vi.fn(),
  removeProperty: vi.fn()
}

vi.stubGlobal('document', {
  documentElement: { style: mockStyle }
})

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn(),
  clear: vi.fn()
}

vi.stubGlobal('localStorage', localStorageMock)

describe('theme-manager', () => {
  let themeManager: typeof import('./theme-manager')

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorageMock.store = {}
    vi.resetModules()
    themeManager = await import('./theme-manager')
  })

  describe('getTheme', () => {
    it('returns the default theme (dark)', () => {
      expect(themeManager.getTheme()).toBe('dark')
    })
  })

  describe('getThemeNames', () => {
    it('returns all available theme names', () => {
      const names = themeManager.getThemeNames()
      expect(names).toContain('dark')
      expect(names).toContain('parchment')
      expect(names).toContain('high-contrast')
      expect(names).toContain('royal-purple')
      expect(names).toHaveLength(4)
    })
  })

  describe('setTheme', () => {
    it('sets CSS custom properties on document root', () => {
      themeManager.setTheme('dark')
      expect(mockStyle.setProperty).toHaveBeenCalledWith('--bg-primary', '#1a1a2e')
      expect(mockStyle.setProperty).toHaveBeenCalledWith('--text-primary', '#e0e0e0')
    })

    it('updates the current theme', () => {
      themeManager.setTheme('parchment')
      expect(themeManager.getTheme()).toBe('parchment')
    })

    it('persists choice to localStorage', () => {
      themeManager.setTheme('high-contrast')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('dnd-vtt-theme', 'high-contrast')
    })

    it('does nothing for unknown theme name', () => {
      const callCountBefore = mockStyle.setProperty.mock.calls.length
      themeManager.setTheme('nonexistent' as never)
      expect(mockStyle.setProperty.mock.calls.length).toBe(callCountBefore)
    })

    it('applies all 10 CSS variables', () => {
      themeManager.setTheme('royal-purple')
      expect(mockStyle.setProperty).toHaveBeenCalledTimes(10)
    })
  })

  describe('loadSavedTheme', () => {
    it('loads theme from localStorage', () => {
      localStorageMock.store['dnd-vtt-theme'] = 'parchment'
      themeManager.loadSavedTheme()
      expect(themeManager.getTheme()).toBe('parchment')
    })

    it('falls back to dark when no saved theme', () => {
      themeManager.loadSavedTheme()
      expect(themeManager.getTheme()).toBe('dark')
    })

    it('falls back to dark for invalid saved theme', () => {
      localStorageMock.store['dnd-vtt-theme'] = 'nonexistent-theme'
      themeManager.loadSavedTheme()
      expect(themeManager.getTheme()).toBe('dark')
    })
  })

  describe('applyColorblindFilter', () => {
    it('removes filter for none mode', () => {
      themeManager.applyColorblindFilter('none')
      expect(mockStyle.removeProperty).toHaveBeenCalledWith('filter')
    })

    it('sets filter for deuteranopia', () => {
      themeManager.applyColorblindFilter('deuteranopia')
      expect(mockStyle.setProperty).toHaveBeenCalledWith('filter', 'url(#deuteranopia-filter)')
    })

    it('sets filter for protanopia', () => {
      themeManager.applyColorblindFilter('protanopia')
      expect(mockStyle.setProperty).toHaveBeenCalledWith('filter', 'url(#protanopia-filter)')
    })

    it('sets filter for tritanopia', () => {
      themeManager.applyColorblindFilter('tritanopia')
      expect(mockStyle.setProperty).toHaveBeenCalledWith('filter', 'url(#tritanopia-filter)')
    })
  })
})
