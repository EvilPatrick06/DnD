import type { DataConnection } from 'peerjs'
import { pushDmAlert } from '../components/game/overlays/DmAlertTray'
import { DEFAULT_BLOCKED_WORDS, filterMessage } from '../data/moderation'
import { createMessageRouter } from './message-handler'
import { createPeer, destroyPeer, generateInviteCode, getPeer, getPeerId } from './peer-manager'
import { validateNetworkMessage } from './schemas'
import type { JoinPayload, NetworkMessage, PeerInfo } from './types'

// Module-level state
let hosting = false
let inviteCode: string | null = null
let displayName = ''
let sequenceCounter = 0
let campaignId: string | null = null

// Rate limiting
const messageRates = new Map<string, number[]>()
const MAX_MESSAGES_PER_SECOND = 10
const RATE_WINDOW_MS = 1000

// Connected peers
const connections = new Map<string, DataConnection>()
const peerInfoMap = new Map<string, PeerInfo>()

// Ban system
const bannedPeers = new Set<string>()
const bannedNames = new Set<string>()

// Chat mute system (peerId -> unmute timestamp)
const chatMutedPeers = new Map<string, number>()

// Auto-moderation
let moderationEnabled = false
let customBlockedWords: string[] = []

// Client message type allowlist — only these prefixes are permitted from non-host peers.
// dm: prefixed messages are host-only and must never be accepted from clients.
const CLIENT_ALLOWED_PREFIXES = ['player:', 'chat:', 'voice:', 'game:dice-roll', 'game:token-move', 'ping']

function isClientAllowedMessageType(type: string): boolean {
  return CLIENT_ALLOWED_PREFIXES.some((prefix) => type.startsWith(prefix))
}

// Blocked executable file extensions for file sharing
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.msi',
  '.scr',
  '.com',
  '.pif',
  '.vbs',
  '.js',
  '.wsh',
  '.wsf'
]

// Event callbacks
type PeerCallback = (peer: PeerInfo) => void
type MessageCallback = (message: NetworkMessage, fromPeerId: string) => void

const joinCallbacks = new Set<PeerCallback>()
const leaveCallbacks = new Set<PeerCallback>()
const messageCallbacks = new Set<MessageCallback>()

// Internal message router for host-side message handling
const router = createMessageRouter()

/**
 * Start hosting a game session. Creates a PeerJS peer with an invite code
 * as its ID and listens for incoming connections.
 * Returns the invite code for players to join.
 */
export async function startHosting(hostDisplayName: string, existingInviteCode?: string): Promise<string> {
  if (hosting) {
    throw new Error('Already hosting a game')
  }

  displayName = hostDisplayName
  sequenceCounter = 0

  // Use the provided invite code or generate a new one
  inviteCode = existingInviteCode || generateInviteCode()

  try {
    const peer = await createPeer(inviteCode)
    hosting = true

    // Restore persisted bans if a campaign ID is already set
    if (campaignId) {
      try {
        const bans = await window.api.loadBans(campaignId)
        for (const peerId of bans.peerIds) {
          bannedPeers.add(peerId)
        }
        for (const name of bans.names) {
          bannedNames.add(name.toLowerCase())
        }
        if (bans.peerIds.length > 0 || bans.names.length > 0) {
          console.log(
            '[HostManager] Restored',
            bans.peerIds.length,
            'banned peers and',
            bans.names.length,
            'banned names from storage'
          )
        }
      } catch (e) {
        console.warn('[HostManager] Failed to load persisted bans:', e)
      }
    }

    // Listen for incoming data connections
    peer.on('connection', (conn: DataConnection) => {
      handleNewConnection(conn)
    })

    // Handle peer-level errors while hosting
    peer.on('error', (err) => {
      console.error('[HostManager] Peer error while hosting:', err)
      pushDmAlert('error', `Network error: ${err.type ?? err.message ?? String(err)}`)
    })

    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 5
    peer.on('disconnected', () => {
      const currentPeer = getPeer()
      if (!currentPeer || currentPeer.destroyed) return
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[HostManager] Max reconnect attempts reached, giving up')
        pushDmAlert('error', 'Host reconnection failed after 5 attempts')
        return
      }
      reconnectAttempts++
      const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000)
      console.warn(
        `[HostManager] Disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
      )
      setTimeout(() => {
        const p = getPeer()
        if (p && !p.destroyed) p.reconnect()
      }, delay)
    })

    peer.on('open', () => {
      reconnectAttempts = 0 // Reset on successful connection
    })

    console.log('[HostManager] Hosting started with invite code:', inviteCode)
    return inviteCode
  } catch (err) {
    hosting = false
    inviteCode = null
    throw err
  }
}

/**
 * Stop hosting — disconnect all peers and destroy the PeerJS instance.
 */
export function stopHosting(): void {
  if (!hosting) return

  console.log('[HostManager] Stopping host...')

  // Notify all peers that the game is ending
  broadcastMessage(buildMessage('dm:game-end', {}))

  // Close all connections
  for (const [peerId, conn] of connections) {
    try {
      conn.close()
    } catch (e) {
      console.warn('[HostManager] Error closing connection to', peerId, e)
    }
  }

  connections.clear()
  peerInfoMap.clear()
  messageRates.clear()
  bannedPeers.clear()
  bannedNames.clear()
  chatMutedPeers.clear()
  router.clear()
  joinCallbacks.clear()
  leaveCallbacks.clear()
  messageCallbacks.clear()

  moderationEnabled = false
  customBlockedWords = []

  destroyPeer()
  hosting = false
  inviteCode = null
  campaignId = null
  sequenceCounter = 0
}

/**
 * Send a message to all connected peers.
 */
export function broadcastMessage(msg: NetworkMessage): void {
  const serialized = JSON.stringify(msg)
  for (const [peerId, conn] of connections) {
    try {
      if (conn.open) {
        conn.send(serialized)
      }
    } catch (e) {
      console.warn('[HostManager] Failed to send to peer', peerId, e)
    }
  }
}

/**
 * Send a message to a specific peer.
 */
export function sendToPeer(peerId: string, msg: NetworkMessage): void {
  const conn = connections.get(peerId)
  if (!conn) {
    console.warn('[HostManager] No connection found for peer:', peerId)
    return
  }
  try {
    if (conn.open) {
      conn.send(JSON.stringify(msg))
    }
  } catch (e) {
    console.warn('[HostManager] Failed to send to peer', peerId, e)
  }
}

/**
 * Kick a peer from the game.
 */
export function kickPeer(peerId: string): void {
  const peerInfo = peerInfoMap.get(peerId)
  const conn = connections.get(peerId)

  if (conn) {
    // Send a kick message before closing
    try {
      const kickMsg = buildMessage('dm:kick-player', { peerId, reason: 'Kicked by DM' })
      conn.send(JSON.stringify(kickMsg))
    } catch (_e) {
      // Ignore send errors during kick
    }

    // Small delay to let the kick message arrive before closing
    setTimeout(() => {
      try {
        conn.close()
      } catch (_e) {
        // Ignore close errors
      }
    }, 100)
  }

  connections.delete(peerId)
  peerInfoMap.delete(peerId)

  if (peerInfo) {
    // Notify other peers
    broadcastMessage(buildMessage('player:leave', { displayName: peerInfo.displayName }))
    // Notify host callbacks
    for (const cb of leaveCallbacks) {
      try {
        cb(peerInfo)
      } catch (e) {
        console.error('[HostManager] Error in leave callback:', e)
      }
    }
  }
}

/**
 * Get a list of all currently connected peers (not including the host).
 */
export function getConnectedPeers(): PeerInfo[] {
  return Array.from(peerInfoMap.values())
}

/**
 * Register a callback for when a peer joins.
 * Returns an unsubscribe function.
 */
export function onPeerJoined(callback: PeerCallback): () => void {
  joinCallbacks.add(callback)
  return () => {
    joinCallbacks.delete(callback)
  }
}

/**
 * Register a callback for when a peer leaves.
 * Returns an unsubscribe function.
 */
export function onPeerLeft(callback: PeerCallback): () => void {
  leaveCallbacks.add(callback)
  return () => {
    leaveCallbacks.delete(callback)
  }
}

/**
 * Register a callback for incoming messages.
 * Returns an unsubscribe function.
 */
export function onMessage(callback: MessageCallback): () => void {
  messageCallbacks.add(callback)
  return () => {
    messageCallbacks.delete(callback)
  }
}

/**
 * Check if currently hosting.
 */
export function isHosting(): boolean {
  return hosting
}

/**
 * Get the current invite code.
 */
export function getInviteCode(): string | null {
  return inviteCode
}

/**
 * Set the campaign ID for this hosted game.
 * Sent to clients in the game:state-full handshake.
 * Also loads persisted bans for this campaign.
 */
export function setCampaignId(id: string): void {
  campaignId = id
  // Load persisted bans for this campaign
  window.api
    .loadBans(id)
    .then((bans) => {
      for (const peerId of bans.peerIds) {
        bannedPeers.add(peerId)
      }
      for (const name of bans.names) {
        bannedNames.add(name.toLowerCase())
      }
      if (bans.peerIds.length > 0 || bans.names.length > 0) {
        console.log(
          '[HostManager] Restored',
          bans.peerIds.length,
          'banned peers and',
          bans.names.length,
          'banned names for campaign:',
          id
        )
      }
    })
    .catch((e) => {
      console.warn('[HostManager] Failed to load bans for campaign:', e)
    })
}

/**
 * Get the campaign ID for this hosted game.
 */
export function getCampaignId(): string | null {
  return campaignId
}

/**
 * Ban a peer — kicks them and prevents reconnection.
 */
export function banPeer(peerId: string): void {
  bannedPeers.add(peerId)

  const peerInfo = peerInfoMap.get(peerId)
  const conn = connections.get(peerId)

  // Also ban by display name to prevent bypass via new peer ID
  if (peerInfo) {
    bannedNames.add(peerInfo.displayName.toLowerCase())
  }

  if (conn) {
    // Send a ban-specific message before closing
    try {
      const banMsg = buildMessage('dm:ban-player', { peerId, reason: 'Banned by DM' })
      conn.send(JSON.stringify(banMsg))
    } catch (_e) {
      // Ignore send errors during ban
    }

    setTimeout(() => {
      try {
        conn.close()
      } catch (_e) {
        // Ignore close errors
      }
    }, 100)
  }

  connections.delete(peerId)
  peerInfoMap.delete(peerId)

  if (peerInfo) {
    broadcastMessage(buildMessage('player:leave', { displayName: peerInfo.displayName }))
    for (const cb of leaveCallbacks) {
      try {
        cb(peerInfo)
      } catch (e) {
        console.error('[HostManager] Error in leave callback:', e)
      }
    }
  }

  console.log('[HostManager] Banned peer:', peerId, peerInfo ? `(name: ${peerInfo.displayName})` : '')
  persistBans()
}

/**
 * Unban a peer — allows them to reconnect.
 */
export function unbanPeer(peerId: string): void {
  bannedPeers.delete(peerId)
  console.log('[HostManager] Unbanned peer:', peerId)
  persistBans()
}

/**
 * Unban a display name — allows users with that name to reconnect.
 */
export function unbanName(name: string): void {
  bannedNames.delete(name.toLowerCase())
  console.log('[HostManager] Unbanned name:', name)
  persistBans()
}

/**
 * Get all currently banned peer IDs.
 */
export function getBannedPeers(): string[] {
  return Array.from(bannedPeers)
}

/**
 * Get all currently banned display names.
 */
export function getBannedNames(): string[] {
  return Array.from(bannedNames)
}

/**
 * Chat-mute a peer for a specified duration.
 * Broadcasts a dm:chat-timeout message so the muted player (and others) are notified.
 */
export function chatMutePeer(peerId: string, durationMs: number): void {
  chatMutedPeers.set(peerId, Date.now() + durationMs)
  console.log('[HostManager] Chat-muted peer:', peerId, 'for', durationMs, 'ms')

  // Notify the muted player and all other peers
  const durationSeconds = Math.round(durationMs / 1000)
  broadcastMessage(buildMessage('dm:chat-timeout', { peerId, duration: durationSeconds }))
}

/**
 * Check if a peer is currently chat-muted.
 */
export function isChatMuted(peerId: string): boolean {
  const expiry = chatMutedPeers.get(peerId)
  if (!expiry) return false
  if (Date.now() >= expiry) {
    chatMutedPeers.delete(peerId)
    return false
  }
  return true
}

/**
 * Enable or disable auto-moderation for chat messages.
 */
export function setModerationEnabled(enabled: boolean): void {
  moderationEnabled = enabled
}

/**
 * Set custom blocked words for auto-moderation.
 */
export function setCustomBlockedWords(words: string[]): void {
  customBlockedWords = words
}

/**
 * Check if moderation is enabled.
 */
export function isModerationEnabled(): boolean {
  return moderationEnabled
}

/**
 * Look up a connected peer's info by their peer ID.
 * Returns undefined if the peer is not found.
 */
export function getPeerInfo(peerId: string): PeerInfo | undefined {
  return peerInfoMap.get(peerId)
}

/**
 * Update a connected peer's info in the peerInfoMap.
 * Used to keep the host's authoritative peer state in sync
 * (e.g., when a player changes their color).
 */
export function updatePeerInfo(peerId: string, updates: Partial<PeerInfo>): void {
  const existing = peerInfoMap.get(peerId)
  if (existing) {
    peerInfoMap.set(peerId, { ...existing, ...updates })
  }
}

// --- Internal helpers ---

function persistBans(): void {
  if (!campaignId) return
  window.api
    .saveBans(campaignId, {
      peerIds: Array.from(bannedPeers),
      names: Array.from(bannedNames)
    })
    .catch((e) => {
      console.warn('[HostManager] Failed to persist bans:', e)
    })
}

function isRateLimited(peerId: string): boolean {
  const now = Date.now()
  const timestamps = messageRates.get(peerId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  messageRates.set(peerId, recent)
  return recent.length > MAX_MESSAGES_PER_SECOND
}

function validateMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const msg = raw as Record<string, unknown>
  if (typeof msg.type !== 'string') return false

  const p = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {}) as Record<string, unknown>

  switch (msg.type) {
    case 'player:join':
      if (typeof p.displayName !== 'string') return false
      if (p.displayName.length > 32) return false
      break
    case 'chat:message':
      if (typeof p.message !== 'string') return false
      if (p.message.length > 2000) return false
      break
    case 'chat:file': {
      if (typeof p.fileName !== 'string') return false
      if (typeof p.fileData !== 'string') return false
      if (p.fileData.length > 8 * 1024 * 1024) return false
      if (typeof p.mimeType !== 'string') return false
      // Validate mime type is one of allowed types
      const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/octet-stream']
      if (!allowedMimes.includes(p.mimeType)) return false
      // Block dangerous executable file extensions
      if (p.fileName) {
        const fileName = p.fileName.toLowerCase()
        if (BLOCKED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
          return false
        }
      }
      break
    }
    case 'chat:whisper':
      if (typeof p.targetPeerId !== 'string') return false
      if (typeof p.message !== 'string') return false
      if (p.message.length > 2000) return false
      break
  }
  return true
}

function buildMessage<T>(type: NetworkMessage['type'], payload: T): NetworkMessage<T> {
  return {
    type,
    payload,
    senderId: getPeerId() || '',
    senderName: displayName,
    timestamp: Date.now(),
    sequence: sequenceCounter++
  }
}

function handleNewConnection(conn: DataConnection): void {
  const peerId = conn.peer
  console.log('[HostManager] New connection from:', peerId)

  // Check if this peer is banned by peer ID
  if (bannedPeers.has(peerId)) {
    console.log('[HostManager] Rejected banned peer:', peerId)
    try {
      conn.close()
    } catch (_e) {
      // Ignore close errors
    }
    return
  }

  // Set up a timeout — if we don't get a join message within 10s, drop the connection
  const joinTimeout = setTimeout(() => {
    console.warn('[HostManager] Peer', peerId, 'did not send join message in time')
    conn.close()
  }, 10000)

  conn.on('open', () => {
    console.log('[HostManager] Connection open with:', peerId)
  })

  conn.on('data', (raw) => {
    // 1. Message size limit check
    if (typeof raw === 'string' && raw.length > 65536) {
      // Exception for file messages which can be up to 8MB
      try {
        const peek = JSON.parse(raw)
        if (peek.type !== 'chat:file' || raw.length > 8 * 1024 * 1024) {
          console.warn('[HostManager] Oversized message from', peerId, 'size:', raw.length)
          return
        }
      } catch {
        console.warn('[HostManager] Oversized non-JSON message from', peerId)
        return
      }
    }

    // 2. Rate limit check
    if (isRateLimited(peerId)) {
      console.warn('[HostManager] Rate limited:', peerId)
      return
    }

    // 3. Parse JSON
    let message: NetworkMessage
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : (raw as NetworkMessage)
    } catch (e) {
      console.warn('[HostManager] Invalid message from', peerId, e)
      return
    }

    // 3a. Zod schema validation
    const zodResult = validateNetworkMessage(message)
    if (!zodResult.success) {
      console.warn('[HostManager] Schema validation failed from', peerId, zodResult.error)
      return
    }

    // 4. Validate message shape (legacy checks: length limits, mime types, etc.)
    if (!validateMessage(message)) {
      console.warn('[HostManager] Invalid message from', peerId, (message as unknown as Record<string, unknown>)?.type)
      return
    }

    // 4a. Prevent senderId/senderName spoofing
    message.senderId = peerId
    const knownPeer = peerInfoMap.get(peerId)
    if (knownPeer) {
      message.senderName = knownPeer.displayName
    }

    // 4b. Block dm: prefixed messages from clients — only host can send these
    if (!isClientAllowedMessageType(message.type)) {
      console.warn('[HostManager] Blocked disallowed message type from client', peerId, message.type)
      return
    }

    // 4c. Chat mute check — drop chat messages from muted peers
    if (message.type === 'chat:message') {
      const muteExpiry = chatMutedPeers.get(peerId)
      if (muteExpiry && Date.now() < muteExpiry) {
        console.log('[HostManager] Dropping chat from muted peer:', peerId)
        return
      }
      // Clean up expired mutes
      if (muteExpiry && Date.now() >= muteExpiry) {
        chatMutedPeers.delete(peerId)
      }

      // Auto-moderation: filter blocked words in chat messages
      if (moderationEnabled) {
        const payload = message.payload as { message: string }
        if (payload.message) {
          const wordList = customBlockedWords.length > 0 ? customBlockedWords : DEFAULT_BLOCKED_WORDS
          payload.message = filterMessage(payload.message, wordList)
        }
      }
    }

    // 5. Process message normally
    // If this peer hasn't been registered yet, they must send a join message first
    if (!peerInfoMap.has(peerId)) {
      if (message.type !== 'player:join') {
        console.warn('[HostManager] Peer', peerId, 'sent', message.type, 'before joining')
        return
      }

      clearTimeout(joinTimeout)
      handleJoin(peerId, conn, message as NetworkMessage<JoinPayload>)
      return
    }

    // Route the message to handlers and notify callbacks
    router.handle(message)
    for (const cb of messageCallbacks) {
      try {
        cb(message, peerId)
      } catch (e) {
        console.error('[HostManager] Error in message callback:', e)
      }
    }

    // Handle ping with automatic pong
    if (message.type === 'ping') {
      sendToPeer(peerId, buildMessage('pong', {}))
    }
  })

  conn.on('close', () => {
    clearTimeout(joinTimeout)
    handleDisconnection(peerId)
  })

  conn.on('error', (err) => {
    console.error('[HostManager] Connection error with', peerId, err)
    clearTimeout(joinTimeout)
    handleDisconnection(peerId)
  })
}

function handleJoin(peerId: string, conn: DataConnection, message: NetworkMessage<JoinPayload>): void {
  const { characterId, characterName } = message.payload

  // Sanitize display name
  const playerName =
    String(message.payload.displayName ?? 'Unknown')
      .slice(0, 32)
      .trim() || 'Unknown'

  // Check if this display name is banned (case-insensitive)
  if (bannedNames.has(playerName.toLowerCase())) {
    console.log('[HostManager] Rejected banned name:', playerName, '(peer:', peerId, ')')
    // Also ban the new peer ID so reconnect with same name is still blocked
    bannedPeers.add(peerId)
    persistBans()
    try {
      const banMsg = buildMessage('dm:ban-player', { peerId, reason: 'Banned by DM' })
      conn.send(JSON.stringify(banMsg))
    } catch (_e) {
      // Ignore send errors
    }
    setTimeout(() => {
      try {
        conn.close()
      } catch (_e) {
        // Ignore close errors
      }
    }, 100)
    return
  }

  // Store the connection and peer info
  connections.set(peerId, conn)
  const peerInfo: PeerInfo = {
    peerId,
    displayName: playerName,
    characterId,
    characterName,
    isReady: false,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    isHost: false,
    isForceMuted: false,
    isForceDeafened: false
  }
  peerInfoMap.set(peerId, peerInfo)

  console.log('[HostManager] Player joined:', playerName, '(', peerId, ')')

  // Send the full peer list to the newly joined player (including themselves)
  const allPeers = getConnectedPeers()
  const hostPeer: PeerInfo = {
    peerId: getPeerId() || '',
    displayName,
    characterId: null,
    characterName: null,
    isReady: true,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    isHost: true,
    isForceMuted: false,
    isForceDeafened: false
  }
  sendToPeer(
    peerId,
    buildMessage('game:state-full', {
      peers: [hostPeer, ...allPeers],
      campaignId
    })
  )

  // Broadcast to existing peers that a new player joined
  broadcastMessage(
    buildMessage('player:join', {
      displayName: playerName,
      characterId,
      characterName,
      peerId
    })
  )

  // Notify host callbacks
  for (const cb of joinCallbacks) {
    try {
      cb(peerInfo)
    } catch (e) {
      console.error('[HostManager] Error in join callback:', e)
    }
  }
}

function handleDisconnection(peerId: string): void {
  const peerInfo = peerInfoMap.get(peerId)
  connections.delete(peerId)
  peerInfoMap.delete(peerId)
  messageRates.delete(peerId)

  if (peerInfo) {
    console.log('[HostManager] Player left:', peerInfo.displayName, '(', peerId, ')')

    // Broadcast to remaining peers
    broadcastMessage(buildMessage('player:leave', { displayName: peerInfo.displayName, peerId }))

    // Notify host callbacks
    for (const cb of leaveCallbacks) {
      try {
        cb(peerInfo)
      } catch (e) {
        console.error('[HostManager] Error in leave callback:', e)
      }
    }
  }
}
