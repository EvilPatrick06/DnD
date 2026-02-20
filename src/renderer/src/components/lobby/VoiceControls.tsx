import { useCallback, useEffect, useRef, useState } from 'react'
import { getVoiceAdapter } from '../../network/voice-adapter'
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

  const [pushToTalk, setPushToTalk] = useState(false)
  const [pttKey, setPttKey] = useState('v')
  const [showVolumes, setShowVolumes] = useState(false)
  const [playerVolumes, setPlayerVolumes] = useState<Record<string, number>>({})
  const [connected, setConnected] = useState(false)
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([])

  // Device lists
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedInput, setSelectedInput] = useState<string>('')
  const [selectedOutput, setSelectedOutput] = useState<string>('')
  const [showDevices, setShowDevices] = useState(false)
  const [editingPttKey, setEditingPttKey] = useState(false)
  const pttKeyRef = useRef<HTMLButtonElement>(null)

  const adapter = getVoiceAdapter()

  // Find local player's force-muted/deafened state
  const localPlayer = players.find((p) => p.peerId === localPeerId)
  const isForceMuted = localPlayer?.isForceMuted ?? false
  const isForceDeafened = localPlayer?.isForceDeafened ?? false

  const muteDisabled = isForceMuted || isForceDeafened
  const deafenDisabled = isForceDeafened

  // Load audio devices
  const loadDevices = useCallback(async () => {
    const { inputs, outputs } = await adapter.getAudioDevices()
    setInputDevices(inputs)
    setOutputDevices(outputs)
    if (!selectedInput && inputs.length > 0) {
      setSelectedInput(inputs[0].deviceId)
    }
    if (!selectedOutput && outputs.length > 0) {
      setSelectedOutput(outputs[0].deviceId)
    }
  }, [adapter, selectedInput, selectedOutput])

  // Load devices on mount and listen for device changes
  useEffect(() => {
    loadDevices()
    const handler = (): void => {
      loadDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handler)
    }
  }, [loadDevices])

  // Track connection state and active speakers
  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(adapter.isConnected())
    }, 2000)
    return () => clearInterval(interval)
  }, [adapter])

  useEffect(() => {
    const cleanup = adapter.onSpeakingChanged((_peerId, _isSpeaking) => {
      setActiveSpeakers(adapter.getActiveSpeakers())
    })
    return cleanup
  }, [adapter])

  // PTT key capture
  useEffect(() => {
    if (!editingPttKey) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      setPttKey(e.key.toLowerCase())
      setEditingPttKey(false)
      adapter.setPushToTalk(pushToTalk, e.key.toLowerCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingPttKey, adapter, pushToTalk])

  // Status label priority
  let statusLabel = 'Voice Active'
  let statusColor = 'text-gray-500'
  if (!connected) {
    statusLabel = 'Disconnected'
    statusColor = 'text-yellow-500'
  } else if (isForceDeafened) {
    statusLabel = 'Deafened by DM'
    statusColor = 'text-red-400'
  } else if (isForceMuted) {
    statusLabel = 'Muted by DM'
    statusColor = 'text-red-400'
  } else if (localDeafened) {
    statusLabel = 'Deafened'
    statusColor = 'text-red-400'
  } else if (localMuted) {
    statusLabel = 'Muted'
    statusColor = 'text-red-400'
  } else if (pushToTalk) {
    statusLabel = `PTT: Hold [${pttKey.toUpperCase()}]`
    statusColor = 'text-purple-400'
  }

  const handleToggleMute = (): void => {
    const wasMuted = localMuted
    toggleMute()
    adapter.setMuted(!wasMuted)
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: !wasMuted })
  }

  const handleToggleDeafen = (): void => {
    const wasDeafened = localDeafened
    toggleDeafen()
    const newDeafened = !wasDeafened
    const newMuted = newDeafened ? true : localMuted
    adapter.setDeafened(newDeafened)
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: newMuted })
    sendMessage('voice:deafen-toggle', { peerId: localPeerId, isDeafened: newDeafened })
    if (localPeerId) {
      useLobbyStore.getState().updatePlayer(localPeerId, { isDeafened: newDeafened })
    }
  }

  const handleTogglePTT = (): void => {
    const newPTT = !pushToTalk
    setPushToTalk(newPTT)
    adapter.setPushToTalk(newPTT, pttKey)
  }

  const handleVolumeChange = (peerId: string, volume: number): void => {
    setPlayerVolumes((prev) => ({ ...prev, [peerId]: volume }))
    adapter.setParticipantVolume(peerId, volume / 100)
  }

  const handleInputChange = async (deviceId: string): Promise<void> => {
    setSelectedInput(deviceId)
    await adapter.setInputDevice(deviceId)
  }

  const handleOutputChange = async (deviceId: string): Promise<void> => {
    setSelectedOutput(deviceId)
    await adapter.setOutputDevice(deviceId)
  }

  const remotePlayers = players.filter((p) => p.peerId !== localPeerId)

  return (
    <div className="border-t border-gray-800">
      {/* Connection status indicator */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
          }`}
        />
        <span className="text-[10px] text-gray-500">
          {connected ? 'Voice Connected' : 'Voice Disconnected'}
        </span>
      </div>

      {/* Main controls row */}
      <div className="flex items-center gap-2 p-3">
        {/* Mute microphone */}
        <button
          onClick={muteDisabled ? undefined : handleToggleMute}
          disabled={muteDisabled}
          title={isForceMuted ? 'Muted by DM' : localMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all
            ${
              muteDisabled
                ? 'bg-red-900/20 border border-red-900/50 text-red-400/60 cursor-not-allowed'
                : localMuted
                  ? 'bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900/60 cursor-pointer'
                  : 'bg-gray-800 border border-gray-700 text-green-400 hover:bg-gray-700 cursor-pointer'
            }`}
        >
          {localMuted || isForceMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
            </svg>
          )}
        </button>

        {/* Deafen */}
        <button
          onClick={deafenDisabled ? undefined : handleToggleDeafen}
          disabled={deafenDisabled}
          title={isForceDeafened ? 'Deafened by DM' : localDeafened ? 'Undeafen' : 'Deafen'}
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all
            ${
              deafenDisabled
                ? 'bg-red-900/20 border border-red-900/50 text-red-400/60 cursor-not-allowed'
                : localDeafened
                  ? 'bg-red-900/40 border border-red-700 text-red-400 hover:bg-red-900/60 cursor-pointer'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 cursor-pointer'
            }`}
        >
          {localDeafened || isForceDeafened ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
            </svg>
          )}
        </button>

        {/* Push-to-talk toggle */}
        <button
          ref={pttKeyRef}
          onClick={handleTogglePTT}
          title={pushToTalk ? 'Switch to voice activity' : 'Switch to push-to-talk'}
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer
            ${
              pushToTalk
                ? 'bg-purple-900/40 border border-purple-700 text-purple-400 hover:bg-purple-900/60'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
        >
          <span className="text-xs font-bold">{pttKey.toUpperCase()}</span>
        </button>

        {/* PTT key rebind */}
        {pushToTalk && (
          <button
            onClick={() => setEditingPttKey(true)}
            title="Click to rebind push-to-talk key"
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer
              ${
                editingPttKey
                  ? 'bg-amber-900/40 border border-amber-500 text-amber-300 animate-pulse'
                  : 'bg-gray-800 border border-gray-700 text-gray-500 hover:bg-gray-700'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
            </svg>
          </button>
        )}

        {/* Audio device settings toggle */}
        <button
          onClick={() => setShowDevices(!showDevices)}
          title="Audio device settings"
          className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer
            ${
              showDevices
                ? 'bg-blue-900/40 border border-blue-700 text-blue-400'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.085a1.888 1.888 0 0 1-1.12 1.407l-.105.045a1.888 1.888 0 0 1-1.79-.088L4.64 5.594a1.875 1.875 0 0 0-2.475.656l-.422.731a1.875 1.875 0 0 0 .517 2.514l1.283.862c.506.34.78.919.689 1.505l-.02.127a1.888 1.888 0 0 1-.689 1.177l-1.283.862a1.875 1.875 0 0 0-.517 2.514l.422.731a1.875 1.875 0 0 0 2.475.656l1.393-.855a1.888 1.888 0 0 1 1.79-.088l.105.045a1.888 1.888 0 0 1 1.12 1.407l.179 1.268a1.875 1.875 0 0 0 1.85 1.567h.844c.917 0 1.699-.663 1.85-1.567l.178-1.268a1.888 1.888 0 0 1 1.12-1.407l.105-.045a1.888 1.888 0 0 1 1.79.088l1.394.855a1.875 1.875 0 0 0 2.475-.656l.422-.731a1.875 1.875 0 0 0-.517-2.514l-1.284-.862a1.888 1.888 0 0 1-.688-1.177l-.02-.127a1.888 1.888 0 0 1 .689-1.505l1.283-.862a1.875 1.875 0 0 0 .517-2.514l-.422-.731a1.875 1.875 0 0 0-2.475-.656l-1.394.855a1.888 1.888 0 0 1-1.79.088l-.105-.045a1.888 1.888 0 0 1-1.12-1.407L12.772 3.817a1.875 1.875 0 0 0-1.85-1.567h-.844Zm.844 4.5a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Volume mixer toggle */}
        {remotePlayers.length > 0 && (
          <button
            onClick={() => setShowVolumes(!showVolumes)}
            title="Player volumes"
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all cursor-pointer
              ${
                showVolumes
                  ? 'bg-amber-900/40 border border-amber-700 text-amber-400'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
              <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        )}

        {/* Status label */}
        <div className={`ml-auto text-xs ${statusColor}`}>{statusLabel}</div>
      </div>

      {/* Audio device selection */}
      {showDevices && (
        <div className="px-3 pb-3 space-y-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Audio Devices</div>

          {/* Mic input */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Microphone</label>
            <select
              value={selectedInput}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
            >
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
              {inputDevices.length === 0 && <option value="">No microphones found</option>}
            </select>
          </div>

          {/* Audio output */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Speakers / Headphones</label>
            <select
              value={selectedOutput}
              onChange={(e) => handleOutputChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
            >
              {outputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
              {outputDevices.length === 0 && <option value="">No speakers found</option>}
            </select>
          </div>
        </div>
      )}

      {/* Per-player volume sliders with speaking indicators */}
      {showVolumes && remotePlayers.length > 0 && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Player Volumes</div>
          {remotePlayers.map((player) => {
            const vol = playerVolumes[player.peerId] ?? 100
            const isSpeaking = player.isSpeaking || activeSpeakers.includes(player.peerId)
            return (
              <div key={player.peerId} className="flex items-center gap-2">
                {/* Speaking indicator dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <span className="text-xs text-gray-400 w-24 truncate" title={player.displayName}>
                  {player.displayName}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vol}
                  onChange={(e) => handleVolumeChange(player.peerId, parseInt(e.target.value, 10))}
                  className="flex-1 h-1 accent-amber-500"
                />
                <span className="text-[10px] text-gray-500 w-8 text-right">{vol}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
