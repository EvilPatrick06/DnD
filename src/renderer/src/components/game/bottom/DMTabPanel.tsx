import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useAiDmStore } from '../../../stores/useAiDmStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import type { Campaign } from '../../../types/campaign'
import dmTabsJson from '../../../../public/data/5e/ui/dm-tabs.json'
import lightingTravelJson from '../../../../public/data/5e/mechanics/lighting-travel.json'

const DMAudioPanel = lazy(() => import('./DMAudioPanel'))
const AiContextPanel = lazy(() => import('./AiContextPanel'))
const DiseaseCurseTracker = lazy(() => import('../dm/DiseaseCurseTracker'))
const EnvironmentalEffectsPanel = lazy(() => import('../dm/EnvironmentalEffectsPanel'))
const TrapPlacerPanel = lazy(() => import('../dm/TrapPlacerPanel'))

interface DMTabPanelProps {
  onOpenModal: (modal: string) => void
  campaign: Campaign
  onDispute?: (ruling: string) => void
  onEditMap: () => void
}

const TABS = dmTabsJson as readonly { id: string; label: string; icon: string }[]

type TabId = string

const btnClass =
  'px-3 py-2 text-xs font-medium rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-300 hover:bg-amber-600/20 hover:border-amber-500/40 hover:text-amber-300 transition-all cursor-pointer whitespace-nowrap'

const toggleOnClass =
  'px-3 py-2 text-xs font-medium rounded-lg bg-amber-600/30 border border-amber-500/50 text-amber-300 transition-all cursor-pointer whitespace-nowrap'

const toggleOffClass = btnClass

export default function DMTabPanel({
  onOpenModal,
  campaign,
  onDispute,
  onEditMap
}: DMTabPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('combat')

  // AI DM store
  const aiEnabled = useAiDmStore((s) => s.enabled)
  const aiPaused = useAiDmStore((s) => s.paused)
  const aiIsTyping = useAiDmStore((s) => s.isTyping)
  const aiProvider = useAiDmStore((s) => s.provider)
  const setPaused = useAiDmStore((s) => s.setPaused)
  const cancelStream = useAiDmStore((s) => s.cancelStream)
  const dmApprovalRequired = useAiDmStore((s) => s.dmApprovalRequired)
  const setDmApprovalRequired = useAiDmStore((s) => s.setDmApprovalRequired)

  // Lobby store for broadcasting disease/curse messages
  const addChatMessage = useLobbyStore((s) => s.addChatMessage)

  // Game store environment toggles
  const underwaterCombat = useGameStore((s) => s.underwaterCombat)
  const setUnderwaterCombat = useGameStore((s) => s.setUnderwaterCombat)
  const flankingEnabled = useGameStore((s) => s.flankingEnabled)
  const setFlankingEnabled = useGameStore((s) => s.setFlankingEnabled)
  const groupInitiativeEnabled = useGameStore((s) => s.groupInitiativeEnabled)
  const setGroupInitiativeEnabled = useGameStore((s) => s.setGroupInitiativeEnabled)
  const diagonalRule = useGameStore((s) => s.diagonalRule)
  const setDiagonalRule = useGameStore((s) => s.setDiagonalRule)
  const ambientLight = useGameStore((s) => s.ambientLight)
  const setAmbientLight = useGameStore((s) => s.setAmbientLight)
  const travelPace = useGameStore((s) => s.travelPace)
  const setTravelPace = useGameStore((s) => s.setTravelPace)

  // Token budget state (for AI DM tab)
  const [tokenBudget, setTokenBudget] = useState<{
    rulebookChunks: number
    srdData: number
    characterData: number
    campaignData: number
    creatures: number
    gameState: number
    memory: number
    total: number
  } | null>(null)
  const [showTokenDetail, setShowTokenDetail] = useState(false)

  const refreshTokenBudget = useCallback(async () => {
    try {
      // First try to get the cached breakdown from the last context build
      const data = await window.api.ai.getTokenBudget()
      if (data && data.total > 0) {
        setTokenBudget(data)
        return
      }

      // No breakdown yet (no chat sent) — run a preview build so the user
      // can see realistic token counts for characters, campaign, SRD, etc.
      const characterIds = campaign.players
        .map((p) => p.characterId)
        .filter((id): id is string => id !== null)
      const preview = await window.api.ai.previewTokenBudget(campaign.id, characterIds)
      if (preview) {
        setTokenBudget(preview)
      }
    } catch {
      // Non-fatal
    }
  }, [campaign.id, campaign.players])

  // Refresh token budget when switching to AI DM tab
  useEffect(() => {
    if (activeTab === 'aidm' && aiEnabled) {
      refreshTokenBudget()
    }
  }, [activeTab, aiEnabled, refreshTokenBudget])

  // Auto-refresh token budget after AI stream completes
  const wasTypingRef = useRef(false)
  useEffect(() => {
    if (wasTypingRef.current && !aiIsTyping && activeTab === 'aidm') {
      // Stream just finished — refresh the token budget
      refreshTokenBudget()
    }
    wasTypingRef.current = aiIsTyping
  }, [aiIsTyping, activeTab, refreshTokenBudget])

  function renderTabContent(): JSX.Element {
    switch (activeTab) {
      case 'combat':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('initiative')}>
              Initiative
            </button>
            <button className={btnClass} onClick={() => onOpenModal('quickCondition')}>
              Quick Conditions
            </button>
            <button className={btnClass} onClick={() => onOpenModal('creatures')}>
              Monster Lookup
            </button>
          </div>
        )

      case 'magic':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('aoe')}>
              AoE Template
            </button>
            <button className={btnClass} onClick={() => onOpenModal('customEffect')}>
              Custom Effect
            </button>
          </div>
        )

      case 'dmtools':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('whisper')}>
              Whisper
            </button>
            <button className={btnClass} onClick={() => onOpenModal('lightSource')}>
              Light Source
            </button>
            <button className={btnClass} onClick={() => onOpenModal('encounterBuilder')}>
              Encounter Builder
            </button>
            <button className={btnClass} onClick={() => onOpenModal('treasureGenerator')}>
              Treasure Generator
            </button>
            <button className={btnClass} onClick={() => onOpenModal('groupRoll')}>
              Group Roll
            </button>
            <button className={btnClass} onClick={() => onOpenModal('npcGenerator')}>
              Generate NPC
            </button>

            {/* Environment toggles */}
            <div className="w-full border-t border-gray-700/40 mt-1 pt-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">
                Environment
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={underwaterCombat ? toggleOnClass : toggleOffClass}
                  onClick={() => setUnderwaterCombat(!underwaterCombat)}
                >
                  Underwater {underwaterCombat ? 'ON' : 'OFF'}
                </button>
                <button
                  className={flankingEnabled ? toggleOnClass : toggleOffClass}
                  onClick={() => setFlankingEnabled(!flankingEnabled)}
                  title="DMG optional rule: allies on opposite sides gain advantage on melee attacks"
                >
                  Flanking {flankingEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  className={groupInitiativeEnabled ? toggleOnClass : toggleOffClass}
                  onClick={() => setGroupInitiativeEnabled(!groupInitiativeEnabled)}
                  title="DMG optional rule: identical monster types share one initiative roll"
                >
                  Group Init {groupInitiativeEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  className={diagonalRule === 'alternate' ? toggleOnClass : toggleOffClass}
                  onClick={() => setDiagonalRule(diagonalRule === 'alternate' ? 'standard' : 'alternate')}
                  title="DMG 2024 p.18 optional rule: alternating 5/10/5/10 diagonal movement costs"
                >
                  Diag 5/10 {diagonalRule === 'alternate' ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Lighting */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-500">Lighting:</span>
                {lightingTravelJson.lightingLevels.map(({ level, tip }) => (
                  <button
                    key={level}
                    onClick={() => setAmbientLight(level as 'bright' | 'dim' | 'darkness')}
                    title={tip}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                      ambientLight === level
                        ? level === 'bright'
                          ? 'bg-yellow-600 text-white'
                          : level === 'dim'
                            ? 'bg-amber-700 text-white'
                            : 'bg-gray-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>

              {/* Travel pace */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-500">Pace:</span>
                {(lightingTravelJson.travelPaces as Array<string | null>).map((pace) => (
                  <button
                    key={pace ?? 'none'}
                    onClick={() => setTravelPace(pace as 'fast' | 'normal' | 'slow' | null)}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                      travelPace === pace
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {pace ? pace.charAt(0).toUpperCase() + pace.slice(1) : 'None'}
                  </button>
                ))}
              </div>
            </div>

            {/* Disease & Curse Tracker */}
            <div className="w-full border-t border-gray-700/40 mt-2 pt-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 block">
                Diseases & Curses
              </span>
              <Suspense
                fallback={
                  <div className="text-[10px] text-gray-500">Loading tracker...</div>
                }
              >
                <DiseaseCurseTracker
                  onBroadcastResult={(message) => {
                    addChatMessage({
                      id: `disease-curse-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
                      senderId: 'system',
                      senderName: 'System',
                      content: message,
                      timestamp: Date.now(),
                      isSystem: true
                    })
                  }}
                />
              </Suspense>
            </div>

            {/* Environmental Effects */}
            <div className="w-full border-t border-gray-700/40 mt-2 pt-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 block">
                Environmental Effects
              </span>
              <Suspense
                fallback={
                  <div className="text-[10px] text-gray-500">Loading effects...</div>
                }
              >
                <EnvironmentalEffectsPanel
                  onBroadcastResult={(message) => {
                    addChatMessage({
                      id: `env-effect-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
                      senderId: 'system',
                      senderName: 'System',
                      content: message,
                      timestamp: Date.now(),
                      isSystem: true
                    })
                  }}
                />
              </Suspense>
            </div>

            {/* Trap Placer */}
            <div className="w-full border-t border-gray-700/40 mt-2 pt-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 block">
                Traps
              </span>
              <Suspense
                fallback={
                  <div className="text-[10px] text-gray-500">Loading traps...</div>
                }
              >
                <TrapPlacerPanel
                  onBroadcastResult={(message) => {
                    addChatMessage({
                      id: `trap-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
                      senderId: 'system',
                      senderName: 'System',
                      content: message,
                      timestamp: Date.now(),
                      isSystem: true
                    })
                  }}
                />
              </Suspense>
            </div>
          </div>
        )

      case 'map':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={onEditMap}>
              Edit Map
            </button>
            <button className={btnClass} onClick={() => onOpenModal('jump')}>
              Jump Calculator
            </button>
            <button className={btnClass} onClick={() => onOpenModal('falling')}>
              Falling Damage
            </button>
            <button className={btnClass} onClick={() => onOpenModal('travelPace')}>
              Travel Calculator
            </button>
            <button className={btnClass} onClick={() => onOpenModal('gridSettings')}>
              Grid Settings
            </button>
          </div>
        )

      case 'party':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('shortRest')}>
              Short Rest
            </button>
            <button className={btnClass} onClick={() => onOpenModal('longRest')}>
              Long Rest
            </button>
          </div>
        )

      case 'audio':
        return (
          <Suspense
            fallback={
              <div className="text-xs text-gray-500 p-2">Loading audio panel...</div>
            }
          >
            <DMAudioPanel />
          </Suspense>
        )

      case 'aidm':
        return (
          <div className="flex flex-wrap gap-1.5 items-start">
            {aiEnabled ? (
              <>
                <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider w-full">
                  AI DM ({aiProvider}) {aiPaused ? '\u2014 Paused' : ''}
                </span>
                <button
                  className={aiPaused ? toggleOnClass : btnClass}
                  onClick={() => setPaused(!aiPaused)}
                >
                  {aiPaused ? 'Resume AI' : 'Pause AI'}
                </button>
                {aiIsTyping && (
                  <button
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 hover:bg-red-800/40 hover:border-red-600/50 transition-all cursor-pointer whitespace-nowrap"
                    onClick={() => cancelStream()}
                  >
                    Cancel Response
                  </button>
                )}
                <button
                  className={dmApprovalRequired ? toggleOnClass : toggleOffClass}
                  onClick={() => setDmApprovalRequired(!dmApprovalRequired)}
                  title="Require DM approval before AI DM actions take effect"
                >
                  DM Approval {dmApprovalRequired ? 'ON' : 'OFF'}
                </button>
                <button
                  className={btnClass}
                  onClick={() => {
                    refreshTokenBudget()
                    setShowTokenDetail((t) => !t)
                  }}
                >
                  Token Budget {tokenBudget ? `(${tokenBudget.total.toLocaleString()})` : ''}
                </button>

                {showTokenDetail && tokenBudget && (
                  <div className="w-full bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2 space-y-0.5">
                    {(
                      [
                        ['Rulebook', tokenBudget.rulebookChunks],
                        ['SRD Data', tokenBudget.srdData],
                        ['Characters', tokenBudget.characterData],
                        ['Campaign', tokenBudget.campaignData],
                        ['Creatures', tokenBudget.creatures],
                        ['Game State', tokenBudget.gameState],
                        ['Memory', tokenBudget.memory]
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label} className="flex justify-between text-[10px]">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-gray-400">{val.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[10px] border-t border-gray-700 pt-0.5 mt-0.5">
                      <span className="text-purple-400 font-semibold">Total Context</span>
                      <span className="text-purple-400 font-semibold">
                        {tokenBudget.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <Suspense
                  fallback={
                    <div className="text-[10px] text-gray-500 w-full">Loading context panel...</div>
                  }
                >
                  <AiContextPanel campaignId={campaign.id} />
                </Suspense>

                {onDispute && (
                  <button
                    className={btnClass}
                    onClick={() => onDispute('last ruling')}
                  >
                    Dispute Ruling
                  </button>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-500">
                AI DM is not enabled for this campaign.
              </span>
            )}
          </div>
        )

      case 'campaign':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('notes')}>
              DM Notes
            </button>
            {campaign.calendar && (
              <button className={btnClass} onClick={() => onOpenModal('calendar')}>
                Calendar
              </button>
            )}
            <button className={btnClass} onClick={() => onOpenModal('chaseTracker')}>
              Chase Tracker
            </button>
            <button className={btnClass} onClick={() => onOpenModal('magic-item-tracker')}>
              Magic Items
            </button>
          </div>
        )

      case 'dice':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('dmRoller')}>
              DM Roller
            </button>
            <button className={btnClass} onClick={() => onOpenModal('hiddenDice')}>
              Hidden Dice
            </button>
            <button className={btnClass} onClick={() => onOpenModal('mobCalculator')}>
              Mob Calculator
            </button>
            <button className={btnClass} onClick={() => onOpenModal('groupRoll')}>
              Group Roll
            </button>
          </div>
        )

      case 'chat':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('whisper')}>
              Whisper
            </button>
            <button className={btnClass} onClick={() => onOpenModal('shop')}>
              Shop
            </button>
          </div>
        )

      case 'utility':
        return (
          <div className="flex flex-wrap gap-1.5">
            <button className={btnClass} onClick={() => onOpenModal('handout')}>
              Handouts
            </button>
            <button className={btnClass} onClick={() => onOpenModal('commandRef')}>
              Command Reference
            </button>
            <button className={btnClass} onClick={() => onOpenModal('shortcutRef')}>
              Shortcut Reference
            </button>
            <button className={btnClass} onClick={() => onOpenModal('spellRef')}>
              Quick Reference
            </button>
          </div>
        )

      default:
        return <div />
    }
  }

  return (
    <div className="flex flex-col gap-1 h-full min-h-0">
      {/* Tab bar */}
      <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 gap-0.5 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              activeTab === tab.id
                ? 'bg-amber-600/25 border border-b-0 border-amber-500/50 text-amber-300'
                : 'bg-gray-800/40 border border-b-0 border-gray-700/30 text-gray-400 hover:bg-gray-700/40 hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-2 min-h-[60px] flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  )
}
