import { useEffect, useRef, useState } from 'react'
import { PRESET_LABELS } from '../../../data/calendar-presets'
import { useAiDmStore } from '../../../stores/useAiDmStore'
import { useGameStore } from '../../../stores/useGameStore'
import type { Campaign } from '../../../types/campaign'
import { formatInGameTime } from '../../../utils/calendar-utils'

interface SettingsDropdownProps {
  campaign: Campaign
  isDM: boolean
  isOpen: boolean
  onToggle: () => void
  onToggleFullscreen: () => void
  isFullscreen: boolean
  onLeaveGame: (destination: string) => void
  onSaveCampaign?: () => Promise<void>
}

function SaveCampaignButton({ onSave }: { onSave: () => Promise<void> }): JSX.Element {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await onSave()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[SettingsDropdown] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-2 border-b border-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Campaign</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-0.5 text-xs rounded transition-colors cursor-pointer bg-amber-600/30 text-amber-400 hover:bg-amber-600/50 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function CalendarSettingsSection({
  calendar
}: {
  calendar: import('../../../types/campaign').CalendarConfig
}): JSX.Element {
  const inGameTime = useGameStore((s) => s.inGameTime)

  return (
    <div className="px-4 py-2 border-b border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Calendar</span>
        <span className="text-[10px] text-amber-400">{PRESET_LABELS[calendar.preset]}</span>
      </div>
      {inGameTime && (
        <div className="text-[10px] text-gray-500">{formatInGameTime(inGameTime.totalSeconds, calendar)}</div>
      )}
    </div>
  )
}

function AiDmSettingsSection(): JSX.Element {
  const aiPaused = useAiDmStore((s) => s.paused)
  const aiProvider = useAiDmStore((s) => s.provider)
  const aiIsTyping = useAiDmStore((s) => s.isTyping)
  const setPaused = useAiDmStore((s) => s.setPaused)

  return (
    <div className="px-4 py-2 border-b border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">AI DM</span>
        <span className="text-[10px] text-purple-400 capitalize">{aiProvider}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">
          {aiIsTyping ? 'Responding...' : aiPaused ? 'Paused' : 'Active'}
        </span>
        <button
          onClick={() => setPaused(!aiPaused)}
          className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
            aiPaused
              ? 'bg-green-600/30 text-green-400 hover:bg-green-600/50'
              : 'bg-yellow-600/30 text-yellow-400 hover:bg-yellow-600/50'
          }`}
        >
          {aiPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

export default function SettingsDropdown({
  campaign,
  isDM,
  isOpen,
  onToggle,
  onToggleFullscreen,
  isFullscreen,
  onLeaveGame,
  onSaveCampaign
}: SettingsDropdownProps): JSX.Element {
  const turnMode = useGameStore((s) => s.turnMode)
  const isPaused = useGameStore((s) => s.isPaused)
  const setPaused = useGameStore((s) => s.setPaused)
  const setTurnMode = useGameStore((s) => s.setTurnMode)
  const endInitiative = useGameStore((s) => s.endInitiative)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const playerCount = campaign.players.filter((p) => p.isActive).length

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (isOpen) onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  return (
    <div className="absolute top-3 right-3 z-20" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="w-9 h-9 bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded-xl
          flex items-center justify-center text-gray-400 hover:text-gray-200 cursor-pointer transition-colors text-lg"
        title="Settings"
      >
        &#9881;
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 w-64 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden shadow-xl">
          {/* Campaign info */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-sm font-semibold text-gray-100 truncate">{campaign.name}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              D&D 5e &middot; {playerCount} player{playerCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Turn mode (DM only) */}
          {isDM && (
            <div className="px-4 py-2 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Turn Mode</span>
                <select
                  value={turnMode}
                  onChange={(e) => {
                    const val = e.target.value as 'initiative' | 'free'
                    if (val === 'free') {
                      endInitiative()
                    } else {
                      setTurnMode(val)
                    }
                  }}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200"
                >
                  <option value="free">Free</option>
                  <option value="initiative">Initiative</option>
                </select>
              </div>
            </div>
          )}

          {/* Pause toggle (DM only) */}
          {isDM && (
            <div className="px-4 py-2 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Game Status</span>
                <button
                  onClick={() => setPaused(!isPaused)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                    isPaused
                      ? 'bg-red-600/30 text-red-400 hover:bg-red-600/50'
                      : 'bg-green-600/30 text-green-400 hover:bg-green-600/50'
                  }`}
                >
                  {isPaused ? 'Paused' : 'Running'}
                </button>
              </div>
            </div>
          )}

          {/* AI DM (when enabled) */}
          {campaign.aiDm?.enabled && isDM && <AiDmSettingsSection />}

          {/* Calendar info (DM only) */}
          {isDM && campaign.calendar && <CalendarSettingsSection calendar={campaign.calendar} />}

          {/* Save Campaign (DM only) */}
          {isDM && onSaveCampaign && <SaveCampaignButton onSave={onSaveCampaign} />}

          {/* Fullscreen toggle */}
          <div className="px-4 py-2 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Fullscreen</span>
              <button
                onClick={onToggleFullscreen}
                className="px-2 py-0.5 text-xs rounded transition-colors cursor-pointer bg-gray-800 text-gray-300 hover:text-gray-100 hover:bg-gray-700"
              >
                {isFullscreen ? 'Exit (F11)' : 'Enter (F11)'}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="py-1">
            <button
              onClick={() => onLeaveGame(`/lobby/${campaign.id}`)}
              className="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
            <button
              onClick={() => onLeaveGame('/')}
              className="w-full px-4 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
            >
              Exit to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
