import { useState } from 'react'
import {
  generateWeather,
  getMoonPhase,
  getMoonPhaseWithOverride,
  getSeason,
  getSunPosition,
  getWeatherWithOverride,
  type MoonPhase,
  type Season,
  type Weather
} from '../../../services/calendar-service'
import { useGameStore } from '../../../stores/useGameStore'
import type { CalendarConfig } from '../../../types/campaign'
import {
  formatInGameDate,
  formatInGameTime,
  getDateParts,
  getTimeOfDayPhase
} from '../../../utils/calendar-utils'
import { presetToWeatherType } from '../WeatherOverlay'

interface InGameCalendarModalProps {
  calendar: CalendarConfig
  onClose: () => void
  isDM?: boolean
}

const SEASON_COLORS: Record<Season, string> = {
  spring: 'text-green-400',
  summer: 'text-yellow-400',
  autumn: 'text-orange-400',
  winter: 'text-blue-400'
}

const WEATHER_ICONS: Record<string, string> = {
  clear: '\u2600\uFE0F',
  clouds: '\u26C5',
  overcast: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  'heavy-rain': '\u26C8\uFE0F',
  thunderstorm: '\u26A1',
  snow: '\u2744\uFE0F',
  blizzard: '\uD83C\uDF28\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
  wind: '\uD83D\uDCA8'
}

const WEATHER_PRESETS = [
  'Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain',
  'Thunderstorm', 'Light Snow', 'Heavy Snow', 'Blizzard', 'Fog',
  'Hail', 'Extreme Heat', 'Extreme Cold', 'Sandstorm', 'Volcanic Ash'
] as const

const WIND_SPEEDS = ['Calm', 'Light Breeze', 'Moderate', 'Strong', 'Gale', 'Hurricane'] as const

const MECHANICAL_EFFECTS = [
  'Difficult terrain',
  'Disadvantage on Perception',
  'Disadvantage on Ranged Attacks',
  'Lightly Obscured',
  'Heavily Obscured',
  'Fire resistance',
  'Cold vulnerability'
] as const

const MOON_PHASE_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'
] as const

const MOON_PHASE_EMOJIS: Record<string, string> = {
  'New Moon': '\uD83C\uDF11',
  'Waxing Crescent': '\uD83C\uDF12',
  'First Quarter': '\uD83C\uDF13',
  'Waxing Gibbous': '\uD83C\uDF14',
  'Full Moon': '\uD83C\uDF15',
  'Waning Gibbous': '\uD83C\uDF16',
  'Last Quarter': '\uD83C\uDF17',
  'Waning Crescent': '\uD83C\uDF18'
}

function formatHour(decimalHour: number): string {
  const h = Math.floor(decimalHour)
  const m = Math.round((decimalHour - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return m > 0 ? `${hour12}:${m.toString().padStart(2, '0')} ${ampm}` : `${hour12} ${ampm}`
}

function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9)
}

function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32)
}

export default function InGameCalendarModal({ calendar, onClose, isDM }: InGameCalendarModalProps): JSX.Element {
  const inGameTime = useGameStore((s) => s.inGameTime)
  const advanceTimeSeconds = useGameStore((s) => s.advanceTimeSeconds)
  const weatherOverride = useGameStore((s) => s.weatherOverride)
  const moonOverride = useGameStore((s) => s.moonOverride)
  const setWeatherOverride = useGameStore((s) => s.setWeatherOverride)
  const setMoonOverride = useGameStore((s) => s.setMoonOverride)
  const savedWeatherPresets = useGameStore((s) => s.savedWeatherPresets)
  const addSavedWeatherPreset = useGameStore((s) => s.addSavedWeatherPreset)
  const removeSavedWeatherPreset = useGameStore((s) => s.removeSavedWeatherPreset)
  const showWeatherOverlay = useGameStore((s) => s.showWeatherOverlay)
  const setShowWeatherOverlay = useGameStore((s) => s.setShowWeatherOverlay)

  const [advanceDays, setAdvanceDays] = useState(1)

  // Weather builder local state
  const [weatherMode, setWeatherMode] = useState<'auto' | 'manual'>(weatherOverride ? 'manual' : 'auto')
  const [wPreset, setWPreset] = useState(weatherOverride?.preset ?? 'Clear')
  const [wDescription, setWDescription] = useState(weatherOverride?.description ?? '')
  const [wTempUnit, setWTempUnit] = useState<'F' | 'C'>(weatherOverride?.temperatureUnit ?? 'F')
  const [wTemp, setWTemp] = useState(weatherOverride?.temperature ?? 70)
  const [wWind, setWWind] = useState(weatherOverride?.windSpeed ?? 'Calm')
  const [wEffects, setWEffects] = useState<string[]>(weatherOverride?.mechanicalEffects ?? [])
  const [presetSaveName, setPresetSaveName] = useState('')

  // Moon override local state
  const [moonMode, setMoonMode] = useState<'auto' | 'manual'>(moonOverride ? 'manual' : 'auto')
  const [selectedMoonPhase, setSelectedMoonPhase] = useState(moonOverride ?? 'Full Moon')

  if (!inGameTime) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 text-center">
          <p className="text-gray-400 text-sm">No in-game time configured</p>
          <button onClick={onClose} className="mt-3 px-4 py-1 text-sm bg-gray-700 rounded cursor-pointer">
            Close
          </button>
        </div>
      </div>
    )
  }

  const parts = getDateParts(inGameTime.totalSeconds, calendar)
  const phase = getTimeOfDayPhase(parts.hour)
  const daysPerYear = calendar.months.reduce(
    (sum: number, m: { days: number }) => sum + m.days,
    0
  )
  const dayOfYear = parts.dayOfMonth + calendar.months.slice(0, parts.monthIndex).reduce(
    (sum: number, m: { days: number }) => sum + m.days,
    0
  )

  const season: Season = getSeason(dayOfYear, daysPerYear)
  const sunPos = getSunPosition(dayOfYear, parts.hour, daysPerYear)
  const totalDays = Math.floor(inGameTime.totalSeconds / (calendar.hoursPerDay * 3600))
  const moon: MoonPhase = getMoonPhaseWithOverride(moonOverride, totalDays)
  const weather: Weather = getWeatherWithOverride(weatherOverride, dayOfYear, season, totalDays)

  function handleToggleEffect(effect: string): void {
    setWEffects((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect]
    )
  }

  function applyWeatherOverride(): void {
    if (weatherMode === 'auto') {
      setWeatherOverride(null)
    } else {
      setWeatherOverride({
        description: wDescription,
        temperature: wTemp,
        temperatureUnit: wTempUnit,
        windSpeed: wWind,
        mechanicalEffects: wEffects,
        preset: wPreset
      })
    }
  }

  function applyMoonOverride(): void {
    if (moonMode === 'auto') {
      setMoonOverride(null)
    } else {
      setMoonOverride(selectedMoonPhase)
    }
  }

  function handleSavePreset(): void {
    const name = presetSaveName.trim()
    if (!name) return
    addSavedWeatherPreset({
      name,
      description: wDescription,
      temperature: wTemp,
      temperatureUnit: wTempUnit,
      windSpeed: wWind,
      mechanicalEffects: wEffects,
      preset: wPreset
    })
    setPresetSaveName('')
  }

  function handleLoadSavedPreset(preset: typeof savedWeatherPresets[number]): void {
    setWPreset(preset.preset ?? 'Clear')
    setWDescription(preset.description)
    setWTemp(preset.temperature ?? 70)
    setWTempUnit(preset.temperatureUnit ?? 'F')
    setWWind(preset.windSpeed ?? 'Calm')
    setWEffects(preset.mechanicalEffects ?? [])
  }

  // Temperature range depends on unit
  const tempMin = wTempUnit === 'F' ? -40 : fToC(-40)
  const tempMax = wTempUnit === 'F' ? 130 : fToC(130)

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-[480px] max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">In-Game Calendar</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Time & Date */}
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-300">
              {formatInGameTime(inGameTime.totalSeconds, calendar)}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {formatInGameDate(inGameTime.totalSeconds, calendar)}
            </div>
            <div className="text-xs text-gray-500 capitalize mt-0.5">{phase}</div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Season */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Season</div>
              <div className={`text-sm font-semibold capitalize ${SEASON_COLORS[season]}`}>
                {season}
              </div>
            </div>

            {/* Moon Phase */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                Moon{moonOverride ? ' (Override)' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-200">
                {moon.emoji} {moon.name}
              </div>
              <div className="text-[10px] text-gray-500">
                {Math.round(moon.illumination * 100)}% illumination
              </div>
            </div>

            {/* Sunrise / Sunset */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sun</div>
              <div className="text-xs text-gray-300">
                Rise: {formatHour(sunPos.sunrise)}
              </div>
              <div className="text-xs text-gray-300">
                Set: {formatHour(sunPos.sunset)}
              </div>
              <div className={`text-[10px] mt-0.5 ${sunPos.isDaytime ? 'text-yellow-400' : 'text-blue-400'}`}>
                {sunPos.isDaytime ? 'Daytime' : 'Nighttime'} ({sunPos.lightLevel})
              </div>
            </div>

            {/* Weather */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                Weather{weatherOverride ? ' (Override)' : ''}
              </div>
              <div className="text-sm font-semibold text-gray-200">
                {WEATHER_ICONS[weather.condition] ?? ''} {weather.condition.replace('-', ' ')}
              </div>
              <div className="text-[10px] text-gray-400">{weather.temperature}</div>
              {weather.mechanicalEffects.length > 0 && (
                <div className="text-[10px] text-gray-500">{weather.mechanicalEffects[0]}</div>
              )}
            </div>
          </div>

          {/* Show Weather on Map toggle */}
          {presetToWeatherType(weatherOverride?.preset) !== null && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showWeatherOverlay}
                onChange={(e) => setShowWeatherOverlay(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-300">Show Weather on Map</span>
            </label>
          )}

          {/* Quick Advance */}
          <div className="border-t border-gray-800 pt-3">
            <div className="text-xs text-gray-400 mb-2">Advance Time</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { label: '+10 min', seconds: 600 },
                { label: '+1 hour', seconds: 3600 },
                { label: '+4 hours', seconds: 14400 },
                { label: '+8 hours', seconds: 28800 }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => advanceTimeSeconds(btn.seconds)}
                  className="px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={advanceDays}
                onChange={(e) => setAdvanceDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
              />
              <button
                onClick={() => advanceTimeSeconds(advanceDays * calendar.hoursPerDay * 3600)}
                className="px-3 py-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded text-amber-300 cursor-pointer"
              >
                Advance {advanceDays} day{advanceDays > 1 ? 's' : ''}
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* DM-Only: Weather Override Section                             */}
          {/* ============================================================ */}
          {isDM && (
            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-300">Weather Override</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setWeatherMode('auto'); setWeatherOverride(null) }}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      weatherMode === 'auto'
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setWeatherMode('manual')}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      weatherMode === 'manual'
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {weatherMode === 'manual' && (
                <div className="space-y-3 bg-gray-800/50 rounded-lg p-3">
                  {/* Preset Dropdown */}
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Preset</label>
                    <select
                      value={wPreset}
                      onChange={(e) => setWPreset(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
                    >
                      {WEATHER_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Description */}
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Description</label>
                    <textarea
                      value={wDescription}
                      onChange={(e) => setWDescription(e.target.value)}
                      placeholder="A thick fog rolls in from the marshlands..."
                      rows={2}
                      className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
                    />
                  </div>

                  {/* Temperature Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Temperature: {wTemp}{'\u00b0'}{wTempUnit}
                      </label>
                      <button
                        onClick={() => {
                          if (wTempUnit === 'F') {
                            setWTempUnit('C')
                            setWTemp(fToC(wTemp))
                          } else {
                            setWTempUnit('F')
                            setWTemp(cToF(wTemp))
                          }
                        }}
                        className="px-1.5 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer"
                      >
                        {'\u00b0'}{wTempUnit === 'F' ? 'C' : 'F'}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={tempMin}
                      max={tempMax}
                      value={wTemp}
                      onChange={(e) => setWTemp(parseInt(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>{tempMin}{'\u00b0'}{wTempUnit}</span>
                      <span>{tempMax}{'\u00b0'}{wTempUnit}</span>
                    </div>
                  </div>

                  {/* Wind Speed */}
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Wind Speed</label>
                    <select
                      value={wWind}
                      onChange={(e) => setWWind(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
                    >
                      {WIND_SPEEDS.map((ws) => (
                        <option key={ws} value={ws}>{ws}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mechanical Effects Checkboxes */}
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Mechanical Effects</label>
                    <div className="grid grid-cols-2 gap-1">
                      {MECHANICAL_EFFECTS.map((effect) => (
                        <label key={effect} className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wEffects.includes(effect)}
                            onChange={() => handleToggleEffect(effect)}
                            className="accent-amber-500 w-3 h-3"
                          />
                          {effect}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Apply + Save as Preset */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={applyWeatherOverride}
                      className="px-3 py-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded text-amber-300 cursor-pointer"
                    >
                      Apply Override
                    </button>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={presetSaveName}
                        onChange={(e) => setPresetSaveName(e.target.value)}
                        placeholder="Preset name..."
                        className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
                      />
                      <button
                        onClick={handleSavePreset}
                        disabled={!presetSaveName.trim()}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Saved Presets */}
                  {savedWeatherPresets.length > 0 && (
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Saved Presets</label>
                      <div className="flex flex-wrap gap-1">
                        {savedWeatherPresets.map((sp) => (
                          <div key={sp.name} className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleLoadSavedPreset(sp)}
                              className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded-l text-gray-300 cursor-pointer"
                            >
                              {sp.name}
                            </button>
                            <button
                              onClick={() => removeSavedWeatherPreset(sp.name)}
                              className="px-1 py-0.5 text-[10px] bg-gray-700 hover:bg-red-700/50 rounded-r text-gray-500 hover:text-red-300 cursor-pointer"
                              title="Remove preset"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* DM-Only: Moon Phase Override Section                          */}
          {/* ============================================================ */}
          {isDM && (
            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-300">Moon Override</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setMoonMode('auto'); setMoonOverride(null) }}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      moonMode === 'auto'
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setMoonMode('manual')}
                    className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
                      moonMode === 'manual'
                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {moonMode === 'manual' && (
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {MOON_PHASE_NAMES.map((phaseName) => (
                      <button
                        key={phaseName}
                        onClick={() => setSelectedMoonPhase(phaseName)}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded cursor-pointer border transition-colors ${
                          selectedMoonPhase === phaseName
                            ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                        }`}
                      >
                        <span className="text-lg">{MOON_PHASE_EMOJIS[phaseName]}</span>
                        <span className="text-[9px] leading-tight text-center">{phaseName}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={applyMoonOverride}
                    className="px-3 py-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded text-amber-300 cursor-pointer"
                  >
                    Apply Moon Override
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
