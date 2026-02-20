import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackButton, Button, Input } from '../components/ui'
import { useNetworkStore } from '../stores/useNetworkStore'

export default function JoinGamePage(): JSX.Element {
  const navigate = useNavigate()
  const { connectionState, error, joinGame, setError, campaignId } = useNetworkStore()

  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [waitingForCampaign, setWaitingForCampaign] = useState(false)
  const navigatedRef = useRef(false)

  const canConnect = inviteCode.trim().length > 0 && displayName.trim().length > 0
  const isConnecting = connectionState === 'connecting' || waitingForCampaign

  // When host sends game:state-full with campaignId, navigate to the real lobby URL
  useEffect(() => {
    if (waitingForCampaign && campaignId && !navigatedRef.current) {
      navigatedRef.current = true
      setWaitingForCampaign(false)
      navigate(`/lobby/${campaignId}`)
    }
  }, [waitingForCampaign, campaignId, navigate])

  // Fallback: if connected but no campaignId after 15s, show error instead of navigating to a broken URL
  useEffect(() => {
    if (!waitingForCampaign) return
    const timeout = setTimeout(() => {
      if (!navigatedRef.current) {
        navigatedRef.current = true
        setWaitingForCampaign(false)
        useNetworkStore.getState().setError('Timed out waiting for host to send campaign data. Please try again.')
        useNetworkStore.getState().disconnect()
      }
    }, 15000)
    return () => clearTimeout(timeout)
  }, [waitingForCampaign])

  const handleConnect = async (): Promise<void> => {
    if (!canConnect || isConnecting) return

    setError(null)
    navigatedRef.current = false

    try {
      await joinGame(inviteCode.trim().toUpperCase(), displayName.trim())
      // Connection established — wait for host to send campaignId via game:state-full
      setWaitingForCampaign(true)
    } catch {
      // Error is already set in the network store
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && canConnect && !isConnecting) {
      handleConnect()
    }
  }

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <BackButton />

      <h1 className="text-3xl font-bold mb-2">Join Game</h1>
      <p className="text-gray-500 mb-8">Enter the invite code from your Dungeon Master to join their game.</p>

      <div className="max-w-md space-y-6">
        {/* Display name */}
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your name"
          maxLength={30}
        />

        {/* Invite code */}
        <div>
          <label className="block text-gray-400 mb-2 text-sm">Invite Code</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ABC123"
            maxLength={10}
            className="w-full p-4 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
                       placeholder-gray-600 focus:border-amber-500 focus:outline-none
                       transition-colors text-center text-2xl font-mono font-bold tracking-[0.3em]
                       uppercase"
          />
        </div>

        {/* Connection status indicator */}
        {isConnecting && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-900/20 border border-amber-700/30">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-amber-300">Connecting to host...</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-900/20 border border-red-700/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm text-red-300 font-medium">Connection Failed</p>
              <p className="text-xs text-red-400/70 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Connect button */}
        <Button onClick={handleConnect} disabled={!canConnect || isConnecting} className="w-full py-3 text-lg">
          {isConnecting ? 'Connecting...' : 'Connect'}
        </Button>

        {/* Help text */}
        <div className="border border-dashed border-gray-700 rounded-lg p-5 text-center">
          <p className="text-sm text-gray-500">
            Ask your Dungeon Master for an invite code to join their game. The code is displayed in the lobby when they
            create a session.
          </p>
        </div>
      </div>
    </div>
  )
}
