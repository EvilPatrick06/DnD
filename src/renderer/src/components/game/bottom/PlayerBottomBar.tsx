import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import type { Campaign } from '../../../types/campaign'
import type { Character } from '../../../types/character'
import { is5eCharacter } from '../../../types/character'
import { getCharacterSheetPath } from '../../../utils/character-routes'
import ChatPanel from './ChatPanel'

interface PlayerBottomBarProps {
  character: Character | null
  campaignId: string
  onAction: () => void
  onItem: () => void
  onFamiliar?: () => void
  onWildShape?: () => void
  onSteed?: () => void
  onJump?: () => void
  onFallingDamage?: () => void
  onTravelPace?: () => void
  onQuickCondition?: () => void
  onCheckTime?: () => void
  playerName: string
  campaign: Campaign
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenModal?: (modal: string) => void
}

export default function PlayerBottomBar({
  character,
  campaignId,
  onAction,
  onItem,
  onFamiliar,
  onWildShape,
  onSteed,
  onJump,
  onFallingDamage,
  onTravelPace,
  onQuickCondition,
  onCheckTime,
  playerName,
  campaign,
  collapsed,
  onToggleCollapse,
  onOpenModal
}: PlayerBottomBarProps): JSX.Element {
  const navigate = useNavigate()
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleViewSheet = (): void => {
    if (!character) return
    navigate(getCharacterSheetPath(character), { state: { returnTo: `/game/${campaignId}` } })
  }

  // Re-fetch character from store to ensure fresh data with populated classes array
  const freshCharacter = useCharacterStore((s) =>
    character ? (s.characters.find((c) => c.id === character.id) ?? character) : character
  )

  // Determine which companion options to show based on character class
  const is5e = freshCharacter && is5eCharacter(freshCharacter)
  const isDruid = is5e && freshCharacter.classes.some((c) => c.name.toLowerCase() === 'druid')
  const hasWizardOrWarlock =
    is5e && freshCharacter.classes.some((c) => ['wizard', 'warlock'].includes(c.name.toLowerCase()))
  const isPaladin = is5e && freshCharacter.classes.some((c) => c.name.toLowerCase() === 'paladin')

  return (
    <div className="min-h-0 h-full bg-gray-950/90 backdrop-blur-sm border-t border-amber-900/30 flex min-w-0 relative">
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 px-3 py-0.5 text-[10px]
          bg-gray-800 border border-gray-700/50 rounded-t-lg text-gray-400 hover:text-gray-200
          cursor-pointer transition-colors"
        title={collapsed ? 'Expand bottom bar' : 'Collapse bottom bar'}
      >
        {collapsed ? '\u25B2' : '\u25BC'}
      </button>

      {collapsed ? (
        <div className="flex-1 px-3 py-1.5">
          <ChatPanel
            isDM={false}
            playerName={playerName}
            campaign={campaign}
            character={character}
            collapsed
            onOpenModal={onOpenModal}
          />
        </div>
      ) : (
        <>
          {/* Left: action buttons */}
          <div className="w-36 shrink-0 flex flex-col gap-1.5 p-2 border-r border-gray-700/50 overflow-y-auto">
            <button
              onClick={handleViewSheet}
              disabled={!character}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
            text-gray-200 hover:bg-amber-600/30 hover:border-amber-500/50 hover:text-amber-300
            transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              View Sheet
            </button>
            <button
              onClick={onAction}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
            text-gray-200 hover:bg-amber-600/30 hover:border-amber-500/50 hover:text-amber-300
            transition-all cursor-pointer"
            >
              Do an Action
            </button>
            <button
              onClick={onItem}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
            text-gray-200 hover:bg-amber-600/30 hover:border-amber-500/50 hover:text-amber-300
            transition-all cursor-pointer"
            >
              Use an Item
            </button>

            {/* Tools dropdown */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
              text-gray-200 hover:bg-gray-700/60 hover:text-gray-100
              transition-all cursor-pointer"
              >
                Tools...
              </button>

              {toolsOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-48 max-h-[60vh] overflow-y-auto bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-xl z-20">
                  <button
                    onClick={() => {
                      setToolsOpen(false)
                      onJump?.()
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
                  >
                    Jump Calculator
                  </button>
                  <button
                    onClick={() => {
                      setToolsOpen(false)
                      onFallingDamage?.()
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
                  >
                    Falling Damage
                  </button>
                  <button
                    onClick={() => {
                      setToolsOpen(false)
                      onTravelPace?.()
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
                  >
                    Travel Pace Reference
                  </button>
                  {onCheckTime && (
                    <button
                      onClick={() => {
                        setToolsOpen(false)
                        onCheckTime()
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
                    >
                      Check Time
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setToolsOpen(false)
                      onQuickCondition?.()
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 transition-colors cursor-pointer"
                  >
                    Conditions Viewer
                  </button>
                </div>
              )}
            </div>

            {/* Class-specific companion buttons */}
            {hasWizardOrWarlock && (
              <button
                onClick={onFamiliar}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
              text-amber-400 hover:bg-amber-600/30 hover:border-amber-500/50 hover:text-amber-300
              transition-all cursor-pointer"
              >
                Find Familiar
              </button>
            )}
            {isDruid && (
              <button
                onClick={onWildShape}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
              text-green-400 hover:bg-green-600/30 hover:border-green-500/50 hover:text-green-300
              transition-all cursor-pointer"
              >
                Wild Shape
              </button>
            )}
            {isPaladin && (
              <button
                onClick={onSteed}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-800/60 border border-gray-700/50
              text-blue-400 hover:bg-blue-600/30 hover:border-blue-500/50 hover:text-blue-300
              transition-all cursor-pointer"
              >
                Find Steed
              </button>
            )}
          </div>

          {/* Right: chat panel */}
          <ChatPanel
            isDM={false}
            playerName={playerName}
            campaign={campaign}
            character={character}
            onOpenModal={onOpenModal}
          />
        </>
      )}
    </div>
  )
}
