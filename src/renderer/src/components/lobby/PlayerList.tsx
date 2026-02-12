import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useLobbyStore } from '../../stores/useLobbyStore'
import { useNetworkStore } from '../../stores/useNetworkStore'
import { useCharacterStore } from '../../stores/useCharacterStore'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { kickPeer, banPeer, chatMutePeer } from '../../network/host-manager'
import type { Character } from '../../types/character'
import PlayerCard from './PlayerCard'
import CharacterSheet from '../sheet/CharacterSheet'

export default function PlayerList(): JSX.Element {
  const navigate = useNavigate()
  const players = useLobbyStore((s) => s.players)
  const locallyMutedPeers = useLobbyStore((s) => s.locallyMutedPeers)
  const toggleLocalMutePlayer = useLobbyStore((s) => s.toggleLocalMutePlayer)
  const updatePlayer = useLobbyStore((s) => s.updatePlayer)
  const remoteCharacters = useLobbyStore((s) => s.remoteCharacters)
  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const role = useNetworkStore((s) => s.role)
  const forceMutePlayer = useNetworkStore((s) => s.forceMutePlayer)
  const forceDeafenPlayer = useNetworkStore((s) => s.forceDeafenPlayer)
  const sendMessage = useNetworkStore((s) => s.sendMessage)
  const removePeer = useNetworkStore((s) => s.removePeer)
  const { characters, loadCharacters } = useCharacterStore()

  const { campaignId } = useParams<{ campaignId: string }>()
  const loadCharacterForEdit = useBuilderStore((s) => s.loadCharacterForEdit)
  const isHostView = role === 'host'
  const [viewingCharacter, setViewingCharacter] = useState<Character | null>(null)

  // Ensure local characters are loaded
  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  // Sort: host first, then alphabetical by display name
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1
    if (!a.isHost && b.isHost) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  const handleViewCharacter = (characterId: string | null): void => {
    if (!characterId) return
    // Check local characters first, then remote (network-synced) characters
    const char = characters.find((c) => c.id === characterId) ?? remoteCharacters[characterId] ?? null
    if (char) {
      setViewingCharacter(char)
    }
  }

  const handleKick = (peerId: string): void => {
    kickPeer(peerId)
    removePeer(peerId)
  }

  const handleBan = (peerId: string): void => {
    banPeer(peerId)
    removePeer(peerId)
  }

  const handleChatTimeout = (peerId: string): void => {
    chatMutePeer(peerId, 300000) // 5 minutes
  }

  const handlePromoteCoDM = (peerId: string): void => {
    updatePlayer(peerId, { isCoDM: true })
    sendMessage('dm:promote-codm', { peerId, isCoDM: true })
  }

  const handleDemoteCoDM = (peerId: string): void => {
    updatePlayer(peerId, { isCoDM: false })
    sendMessage('dm:demote-codm', { peerId, isCoDM: false })
  }

  const handleColorChange = (color: string): void => {
    if (localPeerId) {
      updatePlayer(localPeerId, { color })
      sendMessage('player:color-change', { color })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Players
        </h2>
        <span className="text-xs text-gray-500">{players.length} connected</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedPlayers.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-8">
            Waiting for players...
          </p>
        ) : (
          sortedPlayers.map((player) => {
            const isLocal = player.peerId === localPeerId
            return (
              <PlayerCard
                key={player.peerId}
                player={player}
                isLocal={isLocal}
                isLocallyMuted={locallyMutedPeers.has(player.peerId)}
                onToggleLocalMute={() => toggleLocalMutePlayer(player.peerId)}
                isHostView={isHostView}
                onForceMute={(force) => forceMutePlayer(player.peerId, force)}
                onForceDeafen={(force) => forceDeafenPlayer(player.peerId, force)}
                onViewCharacter={player.characterId ? () => handleViewCharacter(player.characterId) : undefined}
                onKick={isHostView && !isLocal && !player.isHost ? () => handleKick(player.peerId) : undefined}
                onBan={isHostView && !isLocal && !player.isHost ? () => handleBan(player.peerId) : undefined}
                onChatTimeout={isHostView && !isLocal && !player.isHost ? () => handleChatTimeout(player.peerId) : undefined}
                onPromoteCoDM={isHostView && !isLocal && !player.isHost ? () => handlePromoteCoDM(player.peerId) : undefined}
                onDemoteCoDM={isHostView && !isLocal && !player.isHost ? () => handleDemoteCoDM(player.peerId) : undefined}
                onColorChange={isLocal ? handleColorChange : undefined}
              />
            )
          })
        )}
      </div>

      {viewingCharacter && (
        <CharacterSheet
          character={viewingCharacter}
          onClose={() => setViewingCharacter(null)}
          readonly={!isHostView}
          onEdit={isHostView ? () => {
            const charToEdit = viewingCharacter
            // Find which player owns this character so we can tag it for network sync
            const ownerPlayer = players.find((p) => p.characterId === charToEdit.id)
            const editChar = ownerPlayer && ownerPlayer.peerId !== localPeerId
              ? { ...charToEdit, playerId: ownerPlayer.peerId }
              : charToEdit
            setViewingCharacter(null)
            loadCharacterForEdit(editChar)
            navigate('/characters/create', { state: { returnTo: `/lobby/${campaignId}` } })
          } : undefined}
        />
      )}
    </div>
  )
}
