import { useState } from 'react'

export interface SessionZeroData {
  contentLimits: string[]
  tone: string
  pvpAllowed: boolean
  characterDeathExpectation: string
  homebrewNotes: string
  playSchedule: string
  additionalNotes: string
}

export const DEFAULT_SESSION_ZERO: SessionZeroData = {
  contentLimits: [],
  tone: 'heroic',
  pvpAllowed: false,
  characterDeathExpectation: 'possible',
  homebrewNotes: '',
  playSchedule: '',
  additionalNotes: ''
}

const TONE_OPTIONS = [
  { value: 'heroic', label: 'Heroic', description: 'Classic fantasy adventure with clear heroes and villains' },
  { value: 'dark', label: 'Dark', description: 'Grim themes, moral ambiguity, and mature content' },
  { value: 'comedic', label: 'Comedic', description: 'Lighthearted fun with humor and absurdity' },
  { value: 'horror', label: 'Horror', description: 'Suspense, dread, and frightening scenarios' },
  { value: 'intrigue', label: 'Intrigue', description: 'Political machinations, espionage, and social maneuvering' },
  { value: 'sandbox', label: 'Sandbox', description: 'Open-world exploration with player-driven narrative' }
]

const DEATH_OPTIONS = [
  { value: 'rare', label: 'Rare', description: 'Death is unlikely except through extreme carelessness' },
  { value: 'possible', label: 'Possible', description: 'Death can happen in dangerous situations' },
  { value: 'likely', label: 'Likely', description: 'The world is dangerous and death is a real risk' },
  { value: 'permanent', label: 'Permanent & Harsh', description: 'No easy resurrection; death has lasting consequences' }
]

const COMMON_LIMITS = [
  'Graphic violence',
  'Torture',
  'Sexual content',
  'Real-world religions',
  'Harm to children',
  'Slavery/trafficking',
  'Mental illness',
  'Self-harm/suicide',
  'Spiders/insects',
  'Body horror',
  'Substance abuse',
  'Imprisonment/claustrophobia'
]

interface SessionZeroStepProps {
  data: SessionZeroData
  onChange: (data: SessionZeroData) => void
}

export default function SessionZeroStep({ data, onChange }: SessionZeroStepProps): JSX.Element {
  const [customLimit, setCustomLimit] = useState('')

  const update = <K extends keyof SessionZeroData>(key: K, value: SessionZeroData[K]): void => {
    onChange({ ...data, [key]: value })
  }

  const toggleLimit = (limit: string): void => {
    const limits = data.contentLimits.includes(limit)
      ? data.contentLimits.filter((l) => l !== limit)
      : [...data.contentLimits, limit]
    update('contentLimits', limits)
  }

  const addCustomLimit = (): void => {
    const trimmed = customLimit.trim()
    if (trimmed && !data.contentLimits.includes(trimmed)) {
      update('contentLimits', [...data.contentLimits, trimmed])
      setCustomLimit('')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-100 mb-1">Session Zero</h2>
        <p className="text-gray-400 text-sm">
          Establish expectations and boundaries before play begins. Players can view these in the lobby.
        </p>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Tone</label>
        <div className="grid grid-cols-2 gap-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('tone', opt.value)}
              className={`text-left p-3 rounded-lg cursor-pointer border transition-colors ${
                data.tone === opt.value
                  ? 'bg-amber-600/20 border-amber-500/40'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
            >
              <div className={`text-sm font-medium ${data.tone === opt.value ? 'text-amber-300' : 'text-gray-300'}`}>
                {opt.label}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Limits */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Content Limits & Triggers</label>
        <p className="text-xs text-gray-500 mb-2">
          Select topics that should be avoided or handled carefully.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {COMMON_LIMITS.map((limit) => (
            <label
              key={limit}
              className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer hover:text-gray-200"
            >
              <input
                type="checkbox"
                checked={data.contentLimits.includes(limit)}
                onChange={() => toggleLimit(limit)}
                className="accent-amber-500 w-3.5 h-3.5"
              />
              {limit}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            value={customLimit}
            onChange={(e) => setCustomLimit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomLimit()}
            placeholder="Add custom limit..."
            className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200"
          />
          <button
            onClick={addCustomLimit}
            disabled={!customLimit.trim()}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        {data.contentLimits.filter((l) => !COMMON_LIMITS.includes(l)).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {data.contentLimits
              .filter((l) => !COMMON_LIMITS.includes(l))
              .map((l) => (
                <span
                  key={l}
                  className="flex items-center gap-1 text-[10px] bg-red-900/30 text-red-300 px-2 py-0.5 rounded"
                >
                  {l}
                  <button onClick={() => toggleLimit(l)} className="hover:text-red-100 cursor-pointer">
                    &times;
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* PvP */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4">
        <div>
          <div className="text-sm font-medium text-gray-300">Player vs Player Combat</div>
          <div className="text-xs text-gray-500">Allow characters to attack or work against each other?</div>
        </div>
        <button
          onClick={() => update('pvpAllowed', !data.pvpAllowed)}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            data.pvpAllowed ? 'bg-amber-500' : 'bg-gray-600'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              data.pvpAllowed ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Character Death */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Character Death Expectations</label>
        <div className="grid grid-cols-2 gap-2">
          {DEATH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('characterDeathExpectation', opt.value)}
              className={`text-left p-3 rounded-lg cursor-pointer border transition-colors ${
                data.characterDeathExpectation === opt.value
                  ? 'bg-amber-600/20 border-amber-500/40'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  data.characterDeathExpectation === opt.value ? 'text-amber-300' : 'text-gray-300'
                }`}
              >
                {opt.label}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Homebrew / Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Homebrew Rules</label>
          <textarea
            value={data.homebrewNotes}
            onChange={(e) => update('homebrewNotes', e.target.value)}
            placeholder="List any homebrew rules or modifications..."
            rows={3}
            className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Play Schedule</label>
          <textarea
            value={data.playSchedule}
            onChange={(e) => update('playSchedule', e.target.value)}
            placeholder="e.g. Every Saturday 6-10 PM, biweekly..."
            rows={3}
            className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
          />
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Additional Notes</label>
        <textarea
          value={data.additionalNotes}
          onChange={(e) => update('additionalNotes', e.target.value)}
          placeholder="Any other expectations or information for players..."
          rows={2}
          className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
        />
      </div>
    </div>
  )
}
