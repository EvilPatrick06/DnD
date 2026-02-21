import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { LobbyLayout } from '../components/lobby'
import { Button, Modal } from '../components/ui'
import { logger } from '../utils/logger'
import { JOINED_SESSIONS_KEY, LAST_SESSION_KEY, LOBBY_COPY_TIMEOUT_MS } from '../config/constants'
import { onMessage as onClientMessage } from '../network/client-manager'
import {
  getConnectedPeers,
  onMessage as onHostMessage,
  onPeerJoined,
  setCampaignId as setHostCampaignId
} from '../network/host-manager'
import { getPeer } from '../network/peer-manager'
import type {
  CharacterSelectPayload,
  CharacterUpdatePayload,
  ChatPayload,
  ChatTimeoutPayload,
  FileSharingPayload,
  ForceDeafenPayload,
  ForceMutePayload,
  SlowModePayload
} from '../network/types'
import {
  callPeer,
  isListenOnly,
  onSpeakingChange,
  resumeAllAudio,
  startVoice,
  stopVoice
} from '../network/voice-manager'
import { useAiDmStore } from '../stores/useAiDmStore'
import { useCampaignStore } from '../stores/useCampaignStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import { useLobbyStore } from '../stores/useLobbyStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import type { Campaign } from '../types/campaign'
import type { Character } from '../types/character'

export default function LobbyPage(): JSX.Element {
  const navigate = useNavigate()
  const { campaignId } = useParams<{ campaignId: string }>()

  const { setCampaignId, setIsHost, addPlayer, updatePlayer, reset: resetLobby } = useLobbyStore()
  const { connectionState, inviteCode, localPeerId, displayName, role, disconnect } = useNetworkStore()
  const { campaigns, loadCampaigns } = useCampaignStore()

  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  const campaign = campaigns.find((c) => c.id === campaignId)
  const isHost = role === 'host'
  const sceneStatus = useAiDmStore((s) => s.sceneStatus)

  // AI DM: Pre-generate scene while players are in lobby (host only)
  useEffect(() => {
    if (!isHost || !campaign?.aiDm?.enabled) return

    const aiDmStore = useAiDmStore.getState()

    // Initialize store from campaign config
    aiDmStore.initFromCampaign(campaign)

    // Collect any available character IDs
    const players = useLobbyStore.getState().players
    const characterIds = players.filter((p) => p.characterId).map((p) => p.characterId!)

    // Trigger scene preparation immediately
    aiDmStore.prepareScene(campaign.id, characterIds)

    // Poll for completion every 3 seconds (update status indicator)
    const interval = setInterval(async () => {
      await aiDmStore.checkSceneStatus(campaign.id)
      if (useAiDmStore.getState().sceneStatus === 'ready') {
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isHost, campaign?.id, campaign?.aiDm?.enabled, campaign])

  // Navigate away when kicked, banned, or disconnected with error
  const error = useNetworkStore((s) => s.error)

  useEffect(() => {
    if (connectionState === 'disconnected' && error) {
      stopVoice()
      resetLobby()
      navigate('/', { replace: true })
    }
  }, [connectionState, error, navigate, resetLobby])

  // Initialize lobby state
  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  // Client: update stored session with campaign name once available
  useEffect(() => {
    if (role !== 'client' || !campaign?.name || !campaignId) return
    try {
      const raw = localStorage.getItem(LAST_SESSION_KEY)
      if (!raw) return
      const session = JSON.parse(raw)
      if (session.campaignId === campaignId && !session.campaignName) {
        session.campaignName = campaign.name
        localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session))
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(JOINED_SESSIONS_KEY)
      if (!raw) return
      const sessions = JSON.parse(raw) as Array<{ campaignId: string; campaignName: string }>
      let changed = false
      for (const s of sessions) {
        if (s.campaignId === campaignId && !s.campaignName) {
          s.campaignName = campaign.name
          changed = true
        }
      }
      if (changed) {
        localStorage.setItem(JOINED_SESSIONS_KEY, JSON.stringify(sessions))
      }
    } catch { /* ignore */ }
  }, [role, campaign?.name, campaignId])

  // Set the campaign ID on the host manager so joining clients learn it
  useEffect(() => {
    if (isHost && campaignId) {
      setHostCampaignId(campaignId)
    }
  }, [isHost, campaignId])

  useEffect(() => {
    if (campaignId) {
      setCampaignId(campaignId)
    }
    setIsHost(isHost)

    // Add local player to the lobby (guard against duplicate adds in StrictMode)
    if (localPeerId && displayName && !hasInitialized.current) {
      hasInitialized.current = true
      addPlayer({
        peerId: localPeerId,
        displayName,
        characterId: null,
        characterName: null,
        isReady: false,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isHost,
        isForceMuted: false,
        isForceDeafened: false
      })
    }

    return () => {
      // Cleanup on unmount handled by leave confirmation
    }
  }, [campaignId, localPeerId, displayName, isHost, setCampaignId, setIsHost, addPlayer])

  // Auto-initialize voice when connected
  const initVoice = useCallback(async () => {
    const peer = getPeer()
    if (!peer) return

    await startVoice(peer)

    // Check if we fell back to listen-only mode
    if (isListenOnly()) {
      setVoiceError('Listen-only mode (no microphone detected)')
      logger.warn('[LobbyPage] Voice started in listen-only mode — no microphone available')
    }

    // Register speaking change callback
    onSpeakingChange((peerId, isSpeaking) => {
      updatePlayer(peerId, { isSpeaking })
    })

    // Connect voice to peers
    if (isHost) {
      // Host: call all existing connected peers
      const connectedPeers = getConnectedPeers()
      for (const p of connectedPeers) {
        callPeer(p.peerId)
      }
    } else if (inviteCode) {
      // Client: call the host
      callPeer(inviteCode)
    }
  }, [isHost, inviteCode, updatePlayer])

  useEffect(() => {
    if (connectionState === 'connected' && localPeerId) {
      initVoice()
    }

    return () => {
      stopVoice()
    }
  }, [connectionState, localPeerId, initVoice])

  // Periodically resume audio to catch late-arriving audio elements (autoplay policy)
  useEffect(() => {
    const handler = (): void => {
      resumeAllAudio()
      document.removeEventListener('click', handler)
    }
    document.addEventListener('click', handler)

    // Also periodically try resumeAllAudio for the first 10 seconds
    let count = 0
    const interval = setInterval(() => {
      count++
      resumeAllAudio()
      if (count >= 5) clearInterval(interval)
    }, 2000)

    return () => {
      document.removeEventListener('click', handler)
      clearInterval(interval)
    }
  }, [])

  // Host: call new peers when they join
  useEffect(() => {
    if (!isHost) return

    const timeouts: ReturnType<typeof setTimeout>[] = []
    const unsubscribe = onPeerJoined((peer) => {
      // Delay to let the peer's voice start (increased from 500ms for reliability)
      const id = setTimeout(() => {
        callPeer(peer.peerId)
      }, 1500)
      timeouts.push(id)
    })

    return () => {
      timeouts.forEach(clearTimeout)
      unsubscribe()
    }
  }, [isHost])

  // --- Bridge: sync networkStore.peers → lobbyStore.players ---
  const peers = useNetworkStore((s) => s.peers)

  useEffect(() => {
    // Don't sync until localPeerId is known, to avoid double-adding the local player
    if (!localPeerId) return

    const lobby = useLobbyStore.getState()
    const currentPlayers = lobby.players
    const peerIds = new Set(peers.map((p) => p.peerId))

    // Add or update remote peers in lobby
    for (const peer of peers) {
      if (peer.peerId === localPeerId) continue // Skip self (already added)
      const existing = currentPlayers.find((p) => p.peerId === peer.peerId)
      if (!existing) {
        lobby.addPlayer({
          peerId: peer.peerId,
          displayName: peer.displayName,
          characterId: peer.characterId,
          characterName: peer.characterName,
          isReady: peer.isReady,
          isMuted: peer.isMuted,
          isDeafened: peer.isDeafened,
          isSpeaking: peer.isSpeaking,
          isHost: peer.isHost,
          isForceMuted: peer.isForceMuted,
          isForceDeafened: peer.isForceDeafened,
          color: peer.color,
          isCoDM: peer.isCoDM
        })
      } else {
        lobby.updatePlayer(peer.peerId, {
          isReady: peer.isReady,
          characterId: peer.characterId,
          characterName: peer.characterName,
          isMuted: peer.isMuted,
          isDeafened: peer.isDeafened,
          isSpeaking: peer.isSpeaking,
          isForceMuted: peer.isForceMuted,
          isForceDeafened: peer.isForceDeafened,
          color: peer.color,
          isCoDM: peer.isCoDM
        })
      }
    }

    // Remove players that left (but not self)
    for (const player of currentPlayers) {
      if (player.peerId === localPeerId) continue
      if (!peerIds.has(player.peerId)) {
        lobby.removePlayer(player.peerId)
      }
    }
  }, [peers, localPeerId])

  // --- Client: listen for dm:game-start → inject campaign + navigate to game ---
  useEffect(() => {
    if (role !== 'client') return

    const unsub = onClientMessage((msg) => {
      if (msg.type === 'dm:game-start') {
        const payload = msg.payload as { campaignId?: string; campaign?: Campaign }
        if (payload.campaign) {
          // Add the DM's campaign data to local store (in-memory only)
          useCampaignStore.getState().addCampaignToState(payload.campaign)
          // Navigate using the real campaign UUID from the payload
          navigate(`/game/${payload.campaign.id}`)
        } else {
          navigate(`/game/${campaignId}`)
        }
      }
    })

    return unsub
  }, [role, campaignId, navigate])

  // --- Bridge: incoming character-select messages → store remote character data ---
  useEffect(() => {
    const handleCharacterSelect = (msg: { type: string; senderId: string; payload: unknown }): void => {
      if (msg.type !== 'player:character-select') return
      if (msg.senderId === localPeerId) return

      const payload = msg.payload as CharacterSelectPayload
      if (payload.characterId && payload.characterData) {
        useLobbyStore.getState().setRemoteCharacter(payload.characterId, payload.characterData as Character)
      }
    }

    if (role === 'host') {
      const unsub = onHostMessage(handleCharacterSelect)
      return unsub
    } else if (role === 'client') {
      const unsub = onClientMessage(handleCharacterSelect)
      return unsub
    }
  }, [role, localPeerId])

  // --- Bridge: incoming network chat messages → lobby chat ---
  const msgIdRef = useRef(0)
  const generateMsgId = (): string => `net-${Date.now()}-${++msgIdRef.current}`

  useEffect(() => {
    const handleChat = (senderId: string, senderName: string, payload: ChatPayload, timestamp: number): void => {
      // Skip own messages (already added locally by sendChat)
      if (senderId === localPeerId) return
      const senderPlayer = useLobbyStore.getState().players.find((p) => p.peerId === senderId)
      useLobbyStore.getState().addChatMessage({
        id: generateMsgId(),
        senderId,
        senderName,
        content: payload.message,
        timestamp,
        isSystem: payload.isSystem ?? false,
        isDiceRoll: payload.isDiceRoll,
        diceResult: payload.diceResult,
        senderColor: senderPlayer?.color
      })
    }

    const handleFile = (msg: {
      type: string
      senderId: string
      senderName: string
      timestamp: number
      payload: unknown
    }): void => {
      if (msg.type !== 'chat:file') return
      if (msg.senderId === localPeerId) return
      const payload = msg.payload as { fileName: string; fileType: string; fileData: string; mimeType: string }
      const senderPlayer = useLobbyStore.getState().players.find((p) => p.peerId === msg.senderId)
      useLobbyStore.getState().addChatMessage({
        id: generateMsgId(),
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: `shared a file: ${payload.fileName}`,
        timestamp: msg.timestamp,
        isSystem: false,
        senderColor: senderPlayer?.color,
        isFile: true,
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileData: payload.fileData,
        mimeType: payload.mimeType
      })
    }

    if (role === 'host') {
      // Host: listen for client chat and file messages
      const unsub = onHostMessage((msg) => {
        if (msg.type === 'chat:message') {
          handleChat(msg.senderId, msg.senderName, msg.payload as ChatPayload, msg.timestamp)
        } else if (msg.type === 'chat:file') {
          handleFile(msg)
        }
      })
      return unsub
    } else if (role === 'client') {
      // Client: listen for chat and file messages relayed by host
      const unsub = onClientMessage((msg) => {
        if (msg.type === 'chat:message') {
          handleChat(msg.senderId, msg.senderName, msg.payload as ChatPayload, msg.timestamp)
        } else if (msg.type === 'chat:file') {
          handleFile(msg)
        }
      })
      return unsub
    }
  }, [role, localPeerId, generateMsgId])

  // --- Bridge: DM character updates → client saves locally ---
  useEffect(() => {
    if (role !== 'client') return

    const unsub = onClientMessage((msg) => {
      if (msg.type === 'dm:character-update') {
        const payload = msg.payload as CharacterUpdatePayload
        if (payload.characterId && payload.characterData) {
          const character = payload.characterData as Character

          // Always update the remote character view (in-memory only, safe for all clients)
          useLobbyStore.getState().setRemoteCharacter(payload.characterId, character)

          // Only persist to disk if this update targets the local player (via targetPeerId)
          const isTargetedAtMe = payload.targetPeerId === localPeerId
          if (isTargetedAtMe) {
            const localCharacters = useCharacterStore.getState().characters
            const existsLocally = localCharacters.some((c) => c.id === payload.characterId)
            if (existsLocally) {
              useCharacterStore
                .getState()
                .saveCharacter(character)
                .then(() => {
                  logger.debug('[LobbyPage] DM character update saved:', payload.characterId)
                  // Reload characters to ensure store is in sync
                  useCharacterStore.getState().loadCharacters()
                })
                .catch((err) => {
                  logger.error('[LobbyPage] Failed to save DM character update:', err)
                })
            }
          }
        }
      }
    })

    return unsub
  }, [role, localPeerId])

  // --- Bridge: force-mute/deafen → explicitly update lobby store players ---
  useEffect(() => {
    if (role !== 'client') return

    const unsub = onClientMessage((msg) => {
      if (msg.type === 'dm:force-mute') {
        const payload = msg.payload as ForceMutePayload
        useLobbyStore.getState().updatePlayer(payload.peerId, { isForceMuted: payload.isForceMuted })
      } else if (msg.type === 'dm:force-deafen') {
        const payload = msg.payload as ForceDeafenPayload
        const isForceMuted = !!payload.isForceDeafened
        useLobbyStore.getState().updatePlayer(payload.peerId, {
          isForceDeafened: payload.isForceDeafened,
          isForceMuted
        })
      }
    })

    return unsub
  }, [role])

  // --- Bridge: dm:slow-mode and dm:file-sharing → update lobby store ---
  useEffect(() => {
    if (role !== 'client') return

    const unsub = onClientMessage((msg) => {
      if (msg.type === 'dm:slow-mode') {
        const payload = msg.payload as SlowModePayload
        useLobbyStore.getState().setSlowMode(payload.seconds)
        useLobbyStore.getState().addChatMessage({
          id: `sys-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'system',
          senderName: 'System',
          content: payload.seconds === 0 ? 'Slow mode disabled.' : `Slow mode enabled: ${payload.seconds} seconds.`,
          timestamp: Date.now(),
          isSystem: true
        })
      } else if (msg.type === 'dm:file-sharing') {
        const payload = msg.payload as FileSharingPayload
        useLobbyStore.getState().setFileSharingEnabled(payload.enabled)
        useLobbyStore.getState().addChatMessage({
          id: `sys-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'system',
          senderName: 'System',
          content: payload.enabled ? 'File sharing enabled.' : 'File sharing disabled.',
          timestamp: Date.now(),
          isSystem: true
        })
      }
    })

    return unsub
  }, [role])

  // --- Bridge: dm:chat-timeout → set muted state for local player ---
  useEffect(() => {
    const handleTimeout = (msg: { type: string; payload: unknown }): void => {
      if (msg.type !== 'dm:chat-timeout') return
      const payload = msg.payload as ChatTimeoutPayload
      const myPeerId = useNetworkStore.getState().localPeerId
      if (payload.peerId === myPeerId) {
        const mutedUntil = Date.now() + payload.duration * 1000
        useLobbyStore.getState().setChatMutedUntil(mutedUntil)
      }
      // Add a system message so all players see the timeout
      const targetPlayer = useLobbyStore.getState().players.find((p) => p.peerId === payload.peerId)
      const targetName = targetPlayer?.displayName || 'A player'
      useLobbyStore.getState().addChatMessage({
        id: `sys-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'system',
        senderName: 'System',
        content: `${targetName} has been muted for ${payload.duration} seconds.`,
        timestamp: Date.now(),
        isSystem: true
      })
    }

    if (role === 'host') {
      const unsub = onHostMessage(handleTimeout)
      return unsub
    } else if (role === 'client') {
      const unsub = onClientMessage(handleTimeout)
      return unsub
    }
  }, [role])

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopyInviteCode = async (): Promise<void> => {
    if (inviteCode) {
      const { copyToClipboard } = await import('../utils/clipboard')
      const ok = await copyToClipboard(inviteCode)
      if (ok) {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        setCodeCopied(true)
        copyTimeoutRef.current = setTimeout(() => {
          copyTimeoutRef.current = null
          setCodeCopied(false)
        }, LOBBY_COPY_TIMEOUT_MS)
      }
    }
  }

  const handleLeave = (): void => {
    setShowLeaveModal(true)
  }

  const confirmLeave = (): void => {
    stopVoice()
    disconnect()
    resetLobby()
    navigate('/')
  }

  return (
    <div className="p-6 h-screen flex flex-col overflow-hidden">
      {/* Voice error banner */}
      {voiceError && (
        <div className="mb-3 flex items-center justify-between px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-700/50 flex-shrink-0">
          <span className="text-sm text-amber-300">{voiceError}</span>
          <button
            onClick={() => setVoiceError(null)}
            className="ml-4 text-amber-400 hover:text-amber-200 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={handleLeave} className="text-amber-400 hover:text-amber-300 hover:underline cursor-pointer">
            &larr; Leave Lobby
          </button>

          <div className="h-6 w-px bg-gray-700" />

          <h1 className="text-2xl font-bold text-gray-100">{campaign?.name || 'Game Lobby'}</h1>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-green-400'
                  : connectionState === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-400'
              }`}
            />
            <span className="text-xs text-gray-500 capitalize">{connectionState}</span>
          </div>

          {/* AI DM scene preparation status */}
          {isHost && campaign?.aiDm?.enabled && sceneStatus !== 'idle' && (
            <div className="flex items-center gap-1.5">
              {sceneStatus === 'preparing' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-400">AI DM preparing scene...</span>
                </>
              )}
              {sceneStatus === 'ready' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-green-400">Scene ready</span>
                </>
              )}
              {sceneStatus === 'error' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-400">Scene prep failed</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Invite code */}
        {inviteCode && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Invite Code:</span>
            <button
              onClick={handleCopyInviteCode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700
                         hover:border-amber-600/50 transition-colors cursor-pointer group"
              title="Click to copy"
            >
              <span className="font-mono text-lg font-bold text-amber-400 tracking-widest">{inviteCode}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-gray-500 group-hover:text-amber-400 transition-colors"
              >
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
              </svg>
            </button>
            {codeCopied && <span className="text-xs text-green-400 animate-pulse">Copied!</span>}
          </div>
        )}
      </div>

      {/* Main lobby layout */}
      <div className="flex-1 min-h-0">
        <LobbyLayout />
      </div>

      {/* Leave confirmation modal */}
      <Modal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Leave Lobby?">
        <p className="text-gray-400 mb-6">
          Are you sure you want to disconnect and return to the main menu?
          {isHost && (
            <span className="block mt-2 text-amber-400 text-sm">
              As the host, leaving will end the session for all players.
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowLeaveModal(false)}>
            Stay
          </Button>
          <Button variant="danger" onClick={confirmLeave}>
            Leave
          </Button>
        </div>
      </Modal>
    </div>
  )
}
