import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useCampaignStore } from '../stores/useCampaignStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import { useGameStore } from '../stores/useGameStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import GameLayout from '../components/game/GameLayout'

export default function InGamePage(): JSX.Element {
  const navigate = useNavigate()
  const { campaignId } = useParams<{ campaignId: string }>()

  const campaigns = useCampaignStore((s) => s.campaigns)
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns)
  const characters = useCharacterStore((s) => s.characters)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)
  const networkRole = useNetworkStore((s) => s.role)
  const displayName = useNetworkStore((s) => s.displayName)
  const gameStore = useGameStore()
  const [loading, setLoading] = useState(true)

  // Load data on mount
  useEffect(() => {
    loadCampaigns()
    loadCharacters()
  }, [loadCampaigns, loadCharacters])

  // Grace period before showing "No Campaign Found" — allows campaign data to arrive via network
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 4000)
    return () => clearTimeout(timeout)
  }, [])

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null

  // Determine if the user is the DM
  // DM is whoever is hosting the network session, or the campaign owner if offline
  const isDM = networkRole === 'host' || (networkRole === 'none' && campaign?.dmId === 'local')

  // For offline/solo mode, default to DM
  const effectiveDM = isDM || networkRole === 'none'

  // Find the player's character for this campaign
  const playerCharacter =
    characters.find((c) => c.campaignId === campaignId) ?? characters[0] ?? null

  // Initialize game state from campaign
  useEffect(() => {
    if (!campaign) return

    // Only initialize if not already set or different campaign
    if (gameStore.campaignId !== campaign.id) {
      gameStore.loadGameState({
        campaignId: campaign.id,
        system: campaign.system,
        activeMapId: campaign.activeMapId ?? null,
        maps: campaign.maps ?? [],
        turnMode: campaign.turnMode ?? 'free',
        initiative: null,
        round: 0,
        conditions: [],
        isPaused: false
      })
    }
  }, [campaign, gameStore])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle if not focused on an input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return
      }

      // Escape - back to menu
      if (e.key === 'Escape') {
        navigate('/')
        return
      }

      // DM shortcuts
      if (effectiveDM) {
        // N - next turn
        if (e.key === 'n' || e.key === 'N') {
          if (gameStore.initiative) {
            gameStore.nextTurn()
          }
        }
      }
    },
    [effectiveDM, gameStore, navigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Skip "no campaign" check while loading (grace period for network data)
  if (!campaign && loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Loading campaign...</p>
      </div>
    )
  }

  // No campaign found
  if (!campaign) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100">
        <div className="text-center">
          <div className="text-5xl mb-4">&#9876;</div>
          <h1 className="text-2xl font-bold mb-2">No Campaign Found</h1>
          <p className="text-gray-400 mb-6">
            {campaignId
              ? `Campaign "${campaignId}" could not be loaded.`
              : 'No campaign ID specified.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-lg font-semibold bg-amber-600 hover:bg-amber-500
              text-white transition-colors cursor-pointer"
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  const playerName = displayName || 'Player'

  return (
    <GameLayout
      campaign={campaign}
      isDM={effectiveDM}
      character={playerCharacter}
      playerName={playerName}
    />
  )
}
