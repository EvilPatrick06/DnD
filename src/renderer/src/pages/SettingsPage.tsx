import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import OllamaManagement from '../components/settings/OllamaManagement'
import { addToast } from '../hooks/useToast'
import { exportEntities, importEntities } from '../services/io/entity-io'
import { getTheme, getThemeNames, setTheme, type ThemeName } from '../services/theme-manager'

const THEME_LABELS: Record<ThemeName, string> = {
  dark: 'Dark',
  parchment: 'Parchment',
  'high-contrast': 'High Contrast',
  'royal-purple': 'Royal Purple'
}

const THEME_PREVIEWS: Record<ThemeName, { bg: string; accent: string; text: string }> = {
  dark: { bg: 'bg-gray-900', accent: 'bg-amber-600', text: 'text-gray-100' },
  parchment: { bg: 'bg-amber-100', accent: 'bg-yellow-700', text: 'text-amber-950' },
  'high-contrast': { bg: 'bg-black', accent: 'bg-yellow-400', text: 'text-white' },
  'royal-purple': { bg: 'bg-purple-950', accent: 'bg-purple-500', text: 'text-gray-200' }
}

interface SettingsSection {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SettingsSection): JSX.Element {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-amber-400 mb-4 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const [activeTheme, setActiveTheme] = useState<ThemeName>(getTheme())
  const [gridOpacity, setGridOpacity] = useState(() => {
    const saved = localStorage.getItem('dnd-vtt-grid-opacity')
    return saved ? Number(saved) : 40
  })
  const [gridColor, setGridColor] = useState(() => {
    return localStorage.getItem('dnd-vtt-grid-color') ?? '#ffffff'
  })
  const [diceRollMode, setDiceRollMode] = useState<'3d' | '2d'>(() => {
    return (localStorage.getItem('dnd-vtt-dice-mode') as '3d' | '2d') ?? '3d'
  })
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedInputDevice, setSelectedInputDevice] = useState(() => {
    return localStorage.getItem('dnd-vtt-audio-input') ?? 'default'
  })
  const [selectedOutputDevice, setSelectedOutputDevice] = useState(() => {
    return localStorage.getItem('dnd-vtt-audio-output') ?? 'default'
  })

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => setAudioDevices(devices))
      .catch(() => {})
  }, [])

  const handleThemeChange = useCallback((theme: ThemeName) => {
    setTheme(theme)
    setActiveTheme(theme)
  }, [])

  const handleGridOpacityChange = useCallback((val: number) => {
    setGridOpacity(val)
    localStorage.setItem('dnd-vtt-grid-opacity', String(val))
  }, [])

  const handleGridColorChange = useCallback((val: string) => {
    setGridColor(val)
    localStorage.setItem('dnd-vtt-grid-color', val)
  }, [])

  const handleDiceModeChange = useCallback((mode: '3d' | '2d') => {
    setDiceRollMode(mode)
    localStorage.setItem('dnd-vtt-dice-mode', mode)
  }, [])

  const handleInputDeviceChange = useCallback((deviceId: string) => {
    setSelectedInputDevice(deviceId)
    localStorage.setItem('dnd-vtt-audio-input', deviceId)
  }, [])

  const handleOutputDeviceChange = useCallback((deviceId: string) => {
    setSelectedOutputDevice(deviceId)
    localStorage.setItem('dnd-vtt-audio-output', deviceId)
  }, [])

  const inputDevices = audioDevices.filter((d) => d.kind === 'audioinput')
  const outputDevices = audioDevices.filter((d) => d.kind === 'audiooutput')

  const KEYBINDINGS = [
    { key: 'Space + Drag', action: 'Pan map' },
    { key: 'Scroll', action: 'Zoom in/out' },
    { key: 'WASD / Arrows', action: 'Pan map' },
    { key: 'Escape', action: 'Cancel placement / close modal' },
    { key: 'Right Click', action: 'Token context menu' },
    { key: '?', action: 'Keyboard shortcuts' },
    { key: 'F11', action: 'Toggle fullscreen' }
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-100">Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Theme */}
        <Section title="Theme">
          <div className="grid grid-cols-2 gap-3">
            {getThemeNames().map((theme) => {
              const preview = THEME_PREVIEWS[theme]
              const isActive = activeTheme === theme
              return (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-amber-500 bg-gray-700/40'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${preview.bg} border border-gray-600 flex items-center justify-center`}>
                    <div className={`w-4 h-4 rounded ${preview.accent}`} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-200">{THEME_LABELS[theme]}</div>
                    {isActive && <div className="text-[10px] text-amber-400">Active</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Grid Preferences */}
        <Section title="Grid">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Grid Opacity</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={gridOpacity}
                  onChange={(e) => handleGridOpacityChange(Number(e.target.value))}
                  className="w-36 h-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-sm text-gray-400 w-10 text-right">{gridOpacity}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Grid Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={gridColor}
                  onChange={(e) => handleGridColorChange(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-600 cursor-pointer bg-transparent"
                />
                <span className="text-sm text-gray-400 font-mono">{gridColor}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Audio Devices */}
        <Section title="Audio">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Input Device (Microphone)</label>
              <select
                value={selectedInputDevice}
                onChange={(e) => handleInputDeviceChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
              >
                <option value="default">System Default</option>
                {inputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Output Device (Speakers)</label>
              <select
                value={selectedOutputDevice}
                onChange={(e) => handleOutputDeviceChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
              >
                <option value="default">System Default</option>
                {outputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        {/* Dice Roller */}
        <Section title="Dice Roller">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Default Dice Mode</span>
            <div className="flex gap-2">
              {(['3d', '2d'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleDiceModeChange(mode)}
                  className={`px-4 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer ${
                    diceRollMode === mode
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {mode === '3d' ? '3D Dice' : '2D Quick Roll'}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Import/Export Settings */}
        <Section title="Settings Import / Export">
          <p className="text-xs text-gray-400 mb-3">
            Export your app preferences to a file, or import settings from another device.
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const settings = await window.api.loadSettings()
                  const prefs: Record<string, string> = {}
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key?.startsWith('dnd-vtt-')) prefs[key] = localStorage.getItem(key) ?? ''
                  }
                  const ok = await exportEntities('settings', [{ settings, preferences: prefs }])
                  if (ok) addToast('Settings exported', 'success')
                } catch { addToast('Settings export failed', 'error') }
              }}
              className="px-4 py-1.5 text-sm rounded-lg border bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-600 hover:text-amber-400 transition-colors cursor-pointer"
            >
              Export Settings
            </button>
            <button
              onClick={async () => {
                try {
                  const result = await importEntities<{ settings?: Record<string, unknown>; preferences?: Record<string, string> }>('settings')
                  if (!result) return
                  const item = result.items[0]
                  if (item.settings) {
                    await window.api.saveSettings(item.settings as Parameters<typeof window.api.saveSettings>[0])
                  }
                  if (item.preferences) {
                    for (const [key, value] of Object.entries(item.preferences)) {
                      if (key.startsWith('dnd-vtt-') && typeof value === 'string') {
                        localStorage.setItem(key, value)
                      }
                    }
                  }
                  addToast('Settings imported. Reload to apply all changes.', 'success')
                } catch (err) {
                  addToast(err instanceof Error ? err.message : 'Settings import failed', 'error')
                }
              }}
              className="px-4 py-1.5 text-sm rounded-lg border bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-600 hover:text-amber-400 transition-colors cursor-pointer"
            >
              Import Settings
            </button>
          </div>
        </Section>

        {/* Ollama AI */}
        <Section title="Ollama AI">
          <OllamaManagement />
        </Section>

        {/* Keybindings (read-only) */}
        <Section title="Keybindings">
          <div className="space-y-2">
            {KEYBINDINGS.map((kb) => (
              <div key={kb.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-300">{kb.action}</span>
                <kbd className="px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-300 font-mono">
                  {kb.key}
                </kbd>
              </div>
            ))}
            <p className="text-[10px] text-gray-600 mt-2">Custom keybindings coming in a future update.</p>
          </div>
        </Section>
      </div>
    </div>
  )
}
