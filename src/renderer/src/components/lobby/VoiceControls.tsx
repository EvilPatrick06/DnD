import { useLobbyStore } from '../../stores/useLobbyStore'
import { useNetworkStore } from '../../stores/useNetworkStore'

export default function VoiceControls(): JSX.Element {
  const localMuted = useLobbyStore((s) => s.localMuted)
  const localDeafened = useLobbyStore((s) => s.localDeafened)
  const toggleMute = useLobbyStore((s) => s.toggleMute)
  const toggleDeafen = useLobbyStore((s) => s.toggleDeafen)
  const players = useLobbyStore((s) => s.players)
  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const sendMessage = useNetworkStore((s) => s.sendMessage)

  // Find local player's force-muted/deafened state
  const localPlayer = players.find((p) => p.peerId === localPeerId)
  const isForceMuted = localPlayer?.isForceMuted ?? false
  const isForceDeafened = localPlayer?.isForceDeafened ?? false

  const muteDisabled = isForceMuted || isForceDeafened
  const deafenDisabled = isForceDeafened

  // Status label priority: Deafened by DM > Muted by DM > Deafened > Muted > Voice Active
  let statusLabel = 'Voice Active'
  if (isForceDeafened) {
    statusLabel = 'Deafened by DM'
  } else if (isForceMuted) {
    statusLabel = 'Muted by DM'
  } else if (localDeafened) {
    statusLabel = 'Deafened'
  } else if (localMuted) {
    statusLabel = 'Muted'
  }

  const handleToggleMute = (): void => {
    const wasMuted = localMuted
    toggleMute()
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: !wasMuted })
  }

  const handleToggleDeafen = (): void => {
    const wasDeafened = localDeafened
    toggleDeafen()
    // When deafening, we're also muted; when undeafening, keep current mute state
    const newMuted = !wasDeafened ? true : localMuted
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: newMuted })
    // Update local player's isDeafened in lobby store
    if (localPeerId) {
      useLobbyStore.getState().updatePlayer(localPeerId, { isDeafened: !wasDeafened })
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 border-t border-gray-800">
      {/* Mute microphone */}
      <button
        onClick={muteDisabled ? undefined : handleToggleMute}
        disabled={muteDisabled}
        title={
          isForceMuted
            ? 'Muted by DM'
            : localMuted
              ? 'Unmute microphone'
              : 'Mute microphone'
        }
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all
          ${muteDisabled
            ? 'bg-red-900/20 border border-red-900/50 text-red-400/60 cursor-not-allowed'
            : localMuted
              ? 'bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900/60 cursor-pointer'
              : 'bg-gray-800 border border-gray-700 text-green-400 hover:bg-gray-700 cursor-pointer'
          }`}
      >
        {localMuted || isForceMuted ? (
          // Mic off
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
          </svg>
        ) : (
          // Mic on
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
          </svg>
        )}
      </button>

      {/* Deafen */}
      <button
        onClick={deafenDisabled ? undefined : handleToggleDeafen}
        disabled={deafenDisabled}
        title={
          isForceDeafened
            ? 'Deafened by DM'
            : localDeafened
              ? 'Undeafen'
              : 'Deafen'
        }
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all
          ${deafenDisabled
            ? 'bg-red-900/20 border border-red-900/50 text-red-400/60 cursor-not-allowed'
            : localDeafened
              ? 'bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900/60 cursor-pointer'
              : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 cursor-pointer'
          }`}
      >
        {localDeafened || isForceDeafened ? (
          // Headphones off
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
          </svg>
        ) : (
          // Headphones on
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
          </svg>
        )}
      </button>

      {/* Status label */}
      <div className={`ml-auto text-xs ${
        isForceDeafened || isForceMuted ? 'text-red-400' : 'text-gray-500'
      }`}>
        {statusLabel}
      </div>
    </div>
  )
}
