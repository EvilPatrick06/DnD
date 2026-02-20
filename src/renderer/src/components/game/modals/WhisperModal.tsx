import { useState } from 'react'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'

interface WhisperModalProps {
  onClose: () => void
}

export default function WhisperModal({ onClose }: WhisperModalProps): JSX.Element {
  const players = useLobbyStore((s) => s.players)
  const addChatMessage = useLobbyStore((s) => s.addChatMessage)
  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const sendMessage = useNetworkStore((s) => s.sendMessage)

  const [targetPeerId, setTargetPeerId] = useState('')
  const [message, setMessage] = useState('')

  const nonHostPlayers = players.filter((p) => !p.isHost && p.peerId !== localPeerId)
  const targetPlayer = players.find((p) => p.peerId === targetPeerId)

  const handleSend = (): void => {
    if (!targetPeerId || !message.trim()) return

    // Send via network
    sendMessage('dm:whisper-player', {
      targetPeerId,
      targetName: targetPlayer?.displayName || 'Player',
      message: message.trim()
    })

    // Add to local chat as whisper
    addChatMessage({
      id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      senderId: 'dm',
      senderName: 'DM',
      content: `[Whisper to ${targetPlayer?.displayName}]: ${message.trim()}`,
      timestamp: Date.now(),
      isSystem: false
    })

    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-purple-300">Whisper to Player</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer">
            &times;
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Select Player</label>
            <select
              value={targetPeerId}
              onChange={(e) => setTargetPeerId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="">Choose a player...</option>
              {nonHostPlayers.map((p) => (
                <option key={p.peerId} value={p.peerId}>
                  {p.displayName}
                  {p.characterName ? ` (${p.characterName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-xs focus:outline-none focus:border-purple-500 resize-none"
              rows={3}
              placeholder="Type your whisper..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!targetPeerId || !message.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white
                transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Whisper
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
