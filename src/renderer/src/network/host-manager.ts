import type { DataConnection } from 'peerjs'
import { pushDmAlert } from '../components/game/overlays/DmAlertTray'
import {
  FILE_SIZE_LIMIT,
  HEARTBEAT_REMOVE_MS,
  HEARTBEAT_TIMEOUT_MS,
  JOIN_TIMEOUT_MS,
  KICK_DELAY_MS,
  MAX_CHAT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_GLOBAL_MESSAGES_PER_SECOND,
  MAX_MESSAGES_PER_WINDOW,
  MAX_RECONNECT_ATTEMPTS,
  MESSAGE_SIZE_LIMIT,
  RATE_LIMIT_WINDOW_MS
} from '../constants/app-constants'
import { DEFAULT_BLOCKED_WORDS, filterMessage } from '../data/moderation'
import { createMessageRouter } from './message-handler'
import { createPeer, destroyPeer, generateInviteCode, getPeer, getPeerId } from './peer-manager'
import { validateNetworkMessage } from './schemas'
import type { JoinPayload, NetworkMessage, PeerInfo } from './types'
import { logger } from '../utils/logger'

// Module-level state
let hosting = false
let inviteCode: string | null = null
let displayName = ''
let sequenceCounter = 0
let campaignId: string | null = null

// Rate limiting
const messageRates = new Map<string, number[]>()
let globalMessageTimestamps: number[] = []

// Connected peers
const connections = new Map<string, DataConnection>()
const peerInfoMap = new Map<string, PeerInfo>()

// Ban system
const bannedPeers = new Set<string>()
const bannedNames = new Set<string>()
let bansLoaded = false

// Chat mute system (peerId -> unmute timestamp)
const chatMutedPeers = new Map<string, number>()

// Heartbeat tracking (peerId -> last heartbeat timestamp)
const lastHeartbeat = new Map<string, number>()
let heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null

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
  '.wsf',
  '.html'
]

// MIME allowlist for file sharing — only these types are permitted
const MIME_ALLOWLIST = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/json'
]

// Magic bytes for file content validation
const MAGIC_BYTES: Record<string, string> = {
  'image/png': '89504e47',
  'image/jpeg': 'ffd8ff',
  'image/gif': '47494638',
  'image/webp': '52494646'
}

function validateMagicBytes(base64Data: string, mimeType: string): boolean {
  const expectedHex = MAGIC_BYTES[mimeType]
  if (!expectedHex) return true
  try {
    const raw = atob(base64Data.slice(0, 16))
    const hex = Array.from(raw, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    return hex.startsWith(expectedHex)
  } catch {
    return false
  }
}

// Game state provider — set by the network store to supply game state for full syncs
type GameStateProvider = () => unknown
let gameStateProvider: GameStateProvider | null = null

// Ping interval for connection quality
let pingInterval: ReturnType<typeof setInterval> | null = null
const PING_INTERVAL_MS = 5000

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

    if (campaignId) {
      await loadPersistedBans(campaignId)
    }

    // Listen for incoming data connections
    peer.on('connection', (conn: DataConnection) => {
      handleNewConnection(conn)
    })

    // Handle peer-level errors while hosting
    peer.on('error', (err) => {
      logger.error('[HostManager] Peer error while hosting:', err)
      pushDmAlert('error', `Network error: ${err.type ?? err.message ?? String(err)}`)
    })

    let reconnectAttempts = 0
    peer.on('disconnected', () => {
      const currentPeer = getPeer()
      if (!currentPeer || currentPeer.destroyed) return
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error('[HostManager] Max reconnect attempts reached, giving up')
        pushDmAlert('error', 'Host reconnection failed after 5 attempts')
        return
      }
      reconnectAttempts++
      const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 30000)
      logger.warn(
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

    // Start ping interval for connection quality monitoring
    pingInterval = setInterval(() => {
      const msg = buildMessage('ping', { timestamp: Date.now() })
      for (const [, conn] of connections) {
        try {
          if (conn.open) conn.send(JSON.stringify(msg))
        } catch (_e) { /* ignore */ }
      }
    }, PING_INTERVAL_MS)

    startHeartbeatCheck()

    logger.debug('[HostManager] Hosting started with invite code:', inviteCode)
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

  logger.debug('[HostManager] Stopping host...')

  // Notify all peers that the game is ending
  broadcastMessage(buildMessage('dm:game-end', {}))

  // Close all connections
  for (const [peerId, conn] of connections) {
    try {
      conn.close()
    } catch (e) {
      logger.warn('[HostManager] Error closing connection to', peerId, e)
    }
  }

  connections.clear()
  peerInfoMap.clear()
  messageRates.clear()
  globalMessageTimestamps = []
  bannedPeers.clear()
  bannedNames.clear()
  chatMutedPeers.clear()
  stopHeartbeatCheck()
  router.clear()
  joinCallbacks.clear()
  leaveCallbacks.clear()
  messageCallbacks.clear()

  moderationEnabled = false
  customBlockedWords = []
  gameStateProvider = null

  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }

  destroyPeer()
  hosting = false
  inviteCode = null
  campaignId = null
  sequenceCounter = 0
  bansLoaded = false
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
      logger.warn('[HostManager] Failed to send to peer', peerId, e)
    }
  }
}

/**
 * Send a message to all connected peers EXCEPT the specified one.
 * Used when rebroadcasting a message from a client to avoid sending it back to the original sender.
 */
export function broadcastExcluding(msg: NetworkMessage, excludePeerId: string): void {
  const serialized = JSON.stringify(msg)
  for (const [peerId, conn] of connections) {
    if (peerId === excludePeerId) continue
    try {
      if (conn.open) {
        conn.send(serialized)
      }
    } catch (e) {
      logger.warn('[HostManager] Failed to send to peer', peerId, e)
    }
  }
}

/**
 * Send a message to a specific peer.
 */
export function sendToPeer(peerId: string, msg: NetworkMessage): void {
  const conn = connections.get(peerId)
  if (!conn) {
    logger.warn('[HostManager] No connection found for peer:', peerId)
    return
  }
  try {
    if (conn.open) {
      conn.send(JSON.stringify(msg))
    }
  } catch (e) {
    logger.warn('[HostManager] Failed to send to peer', peerId, e)
  }
}

function disconnectPeer(peerId: string, message: NetworkMessage): void {
  const conn = connections.get(peerId)
  if (conn) {
    try {
      conn.send(JSON.stringify(message))
    } catch (_e) {
      // Ignore send errors during disconnect
    }
    setTimeout(() => {
      try {
        conn.close()
      } catch (_e) {
        // Ignore close errors
      }
    }, KICK_DELAY_MS)
  }

  const peerInfo = peerInfoMap.get(peerId)
  connections.delete(peerId)
  peerInfoMap.delete(peerId)

  if (peerInfo) {
    broadcastMessage(buildMessage('player:leave', { displayName: peerInfo.displayName }))
    for (const cb of leaveCallbacks) {
      try {
        cb(peerInfo)
      } catch (e) {
        logger.error('[HostManager] Error in leave callback:', e)
      }
    }
  }
}

/**
 * Kick a peer from the game.
 */
export function kickPeer(peerId: string): void {
  const kickMsg = buildMessage('dm:kick-player', { peerId, reason: 'Kicked by DM' })
  disconnectPeer(peerId, kickMsg)
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
export async function setCampaignId(id: string): Promise<void> {
  campaignId = id
  await loadPersistedBans(id)
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
  if (peerInfo) {
    bannedNames.add(peerInfo.displayName.toLowerCase())
  }
  const banMsg = buildMessage('dm:ban-player', { peerId, reason: 'Banned by DM' })
  disconnectPeer(peerId, banMsg)
  logger.debug('[HostManager] Banned peer:', peerId, peerInfo ? `(name: ${peerInfo.displayName})` : '')
  persistBans()
}

/**
 * Unban a peer — allows them to reconnect.
 */
export function unbanPeer(peerId: string): void {
  bannedPeers.delete(peerId)
  logger.debug('[HostManager] Unbanned peer:', peerId)
  persistBans()
}

/**
 * Unban a display name — allows users with that name to reconnect.
 */
export function unbanName(name: string): void {
  bannedNames.delete(name.toLowerCase())
  logger.debug('[HostManager] Unbanned name:', name)
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
  logger.debug('[HostManager] Chat-muted peer:', peerId, 'for', durationMs, 'ms')

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
 * Set a callback that provides the current game state for full syncs.
 * Called when a new peer connects to include game state in the initial handshake.
 */
export function setGameStateProvider(provider: GameStateProvider | null): void {
  gameStateProvider = provider
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

// --- Heartbeat ---

function startHeartbeatCheck(): void {
  stopHeartbeatCheck()
  heartbeatCheckInterval = setInterval(() => {
    const now = Date.now()
    for (const [peerId, lastTime] of lastHeartbeat) {
      const elapsed = now - lastTime
      if (elapsed >= HEARTBEAT_REMOVE_MS) {
        logger.debug('[HostManager] Removing stale peer (no heartbeat for 2min):', peerId)
        const conn = connections.get(peerId)
        if (conn) {
          try { conn.close() } catch { /* ignore */ }
        }
        handleDisconnection(peerId)
        lastHeartbeat.delete(peerId)
      } else if (elapsed >= HEARTBEAT_TIMEOUT_MS) {
        const peerInfo = peerInfoMap.get(peerId)
        if (peerInfo && !(peerInfo as PeerInfo & { isDisconnected?: boolean }).isDisconnected) {
          logger.debug('[HostManager] Peer heartbeat timeout:', peerId)
          // Mark as disconnected but keep in the list
          const updated = { ...peerInfo, isDisconnected: true } as PeerInfo & { isDisconnected?: boolean }
          peerInfoMap.set(peerId, updated as PeerInfo)
          for (const cb of messageCallbacks) {
            try {
              cb(buildMessage('player:leave', { peerId, displayName: peerInfo.displayName, disconnected: true }), peerId)
            } catch { /* ignore */ }
          }
        }
      }
    }
  }, 10_000)
}

function stopHeartbeatCheck(): void {
  if (heartbeatCheckInterval) {
    clearInterval(heartbeatCheckInterval)
    heartbeatCheckInterval = null
  }
  lastHeartbeat.clear()
}

// --- Internal helpers ---

async function loadPersistedBans(id: string): Promise<void> {
  if (bansLoaded) return
  try {
    const bans = await window.api.loadBans(id)
    for (const peerId of bans.peerIds) {
      bannedPeers.add(peerId)
    }
    for (const name of bans.names) {
      bannedNames.add(name.toLowerCase())
    }
    if (bans.peerIds.length > 0 || bans.names.length > 0) {
      logger.debug(
        '[HostManager] Restored',
        bans.peerIds.length,
        'banned peers and',
        bans.names.length,
        'banned names for campaign'
      )
    }
    bansLoaded = true
  } catch (e) {
    logger.warn('[HostManager] Failed to load persisted bans:', e)
  }
}

function persistBans(): void {
  if (!campaignId) return
  window.api
    .saveBans(campaignId, {
      peerIds: Array.from(bannedPeers),
      names: Array.from(bannedNames)
    })
    .catch((e) => {
      logger.warn('[HostManager] Failed to persist bans:', e)
    })
}


function isRateLimited(peerId: string): boolean {
  const now = Date.now()
  const timestamps = messageRates.get(peerId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  messageRates.set(peerId, recent)
  return recent.length > MAX_MESSAGES_PER_WINDOW
}

function isGlobalRateLimited(): boolean {
  const now = Date.now()
  globalMessageTimestamps = globalMessageTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  globalMessageTimestamps.push(now)
  return globalMessageTimestamps.length > MAX_GLOBAL_MESSAGES_PER_SECOND
}

function validateMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const msg = raw as Record<string, unknown>
  if (typeof msg.type !== 'string') return false

  const p = (msg.payload && typeof msg.payload === 'object' ? msg.payload : {}) as Record<string, unknown>

  switch (msg.type) {
    case 'player:join':
      if (typeof p.displayName !== 'string') return false
      if ((p.displayName as string).trim().length < 1) return false
      if (p.displayName.length > MAX_DISPLAY_NAME_LENGTH) return false
      break
    case 'chat:message':
      if (typeof p.message !== 'string') return false
      if (p.message.length > MAX_CHAT_LENGTH) return false
      break
    case 'chat:file': {
      if (typeof p.fileName !== 'string') return false
      if (typeof p.fileData !== 'string') return false
      if (p.fileData.length > FILE_SIZE_LIMIT) return false
      if (typeof p.mimeType !== 'string') return false
      if (!MIME_ALLOWLIST.includes(p.mimeType as string)) return false
      const fileName = (p.fileName as string).toLowerCase()
      if (BLOCKED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) return false
      if (!validateMagicBytes(p.fileData as string, p.mimeType as string)) return false
      break
    }
    case 'chat:whisper':
      if (typeof p.targetPeerId !== 'string') return false
      if (typeof p.message !== 'string') return false
      if (p.message.length > MAX_CHAT_LENGTH) return false
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
  logger.debug('[HostManager] New connection from:', peerId)

  if (bannedPeers.has(peerId)) {
    logger.debug('[HostManager] Rejected banned peer:', peerId)
    try {
      conn.close()
    } catch (_e) {
      // Ignore close errors
    }
    return
  }

  const joinTimeout = setTimeout(() => {
    logger.warn('[HostManager] Peer', peerId, 'did not send join message in time')
    conn.close()
  }, JOIN_TIMEOUT_MS)

  conn.on('open', () => {
    logger.debug('[HostManager] Connection open with:', peerId)
  })

  conn.on('data', (raw) => {
    // Check raw string size BEFORE parsing JSON
    if (typeof raw === 'string') {
      if (raw.length > FILE_SIZE_LIMIT) {
        logger.warn('[HostManager] Oversized message from', peerId, 'size:', raw.length)
        return
      }
      if (raw.length > MESSAGE_SIZE_LIMIT) {
        const typeMatch = raw.slice(0, 200).match(/"type"\s*:\s*"([^"]+)"/)
        if (!typeMatch || typeMatch[1] !== 'chat:file') {
          logger.warn('[HostManager] Oversized non-file message from', peerId, 'size:', raw.length)
          return
        }
      }
    }

    if (isRateLimited(peerId)) {
      logger.warn('[HostManager] Rate limited:', peerId)
      return
    }

    if (isGlobalRateLimited()) {
      logger.warn('[HostManager] Global rate limit exceeded, dropping message from', peerId)
      return
    }

    let message: NetworkMessage
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : (raw as NetworkMessage)
    } catch (e) {
      logger.warn('[HostManager] Invalid message from', peerId, e)
      return
    }

    // Prevent senderId/senderName spoofing before validation
    message.senderId = peerId
    const knownPeer = peerInfoMap.get(peerId)
    if (knownPeer) {
      message.senderName = knownPeer.displayName
    }

    const zodResult = validateNetworkMessage(message)
    if (!zodResult.success) {
      logger.warn('[HostManager] Schema validation failed from', peerId, zodResult.error)
      return
    }

    if (!validateMessage(message)) {
      logger.warn('[HostManager] Invalid message from', peerId, (message as unknown as Record<string, unknown>)?.type)
      return
    }

    if (!isClientAllowedMessageType(message.type)) {
      logger.warn('[HostManager] Blocked disallowed message type from client', peerId, message.type)
      return
    }

    if (message.type === 'chat:message') {
      const muteExpiry = chatMutedPeers.get(peerId)
      if (muteExpiry && Date.now() < muteExpiry) {
        logger.debug('[HostManager] Dropping chat from muted peer:', peerId)
        return
      }
      if (muteExpiry && Date.now() >= muteExpiry) {
        chatMutedPeers.delete(peerId)
      }

      if (moderationEnabled) {
        const payload = message.payload as { message: string }
        if (payload.message) {
          const wordList = customBlockedWords.length > 0 ? customBlockedWords : DEFAULT_BLOCKED_WORDS
          payload.message = filterMessage(payload.message, wordList)
        }
      }
    }

    if (!peerInfoMap.has(peerId)) {
      if (message.type !== 'player:join') {
        logger.warn('[HostManager] Peer', peerId, 'sent', message.type, 'before joining')
        return
      }

      clearTimeout(joinTimeout)
      handleJoin(peerId, conn, message as NetworkMessage<JoinPayload>)
      return
    }

    router.handle(message)
    for (const cb of messageCallbacks) {
      try {
        cb(message, peerId)
      } catch (e) {
        logger.error('[HostManager] Error in message callback:', e)
      }
    }

    if (message.type === 'ping') {
      lastHeartbeat.set(peerId, Date.now())
      sendToPeer(peerId, buildMessage('pong', {}))
    }
  })

  conn.on('close', () => {
    clearTimeout(joinTimeout)
    handleDisconnection(peerId)
  })

  conn.on('error', (err) => {
    logger.error('[HostManager] Connection error with', peerId, err)
    clearTimeout(joinTimeout)
    handleDisconnection(peerId)
  })
}

function handleJoin(peerId: string, conn: DataConnection, message: NetworkMessage<JoinPayload>): void {
  const { characterId, characterName } = message.payload

  const playerName =
    String(message.payload.displayName ?? 'Unknown')
      .slice(0, MAX_DISPLAY_NAME_LENGTH)
      .trim() || 'Unknown'

  if (bannedNames.has(playerName.toLowerCase())) {
    logger.debug('[HostManager] Rejected banned name:', playerName, '(peer:', peerId, ')')
    bannedPeers.add(peerId)
    persistBans()
    const banMsg = buildMessage('dm:ban-player', { peerId, reason: 'Banned by DM' })
    disconnectPeer(peerId, banMsg)
    return
  }

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
  lastHeartbeat.set(peerId, Date.now())

  logger.debug('[HostManager] Player joined:', playerName, '(', peerId, ')')

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
  const fullPayload: Record<string, unknown> = {
    peers: [hostPeer, ...allPeers],
    campaignId
  }
  if (gameStateProvider) {
    try {
      fullPayload.gameState = gameStateProvider()
    } catch (e) {
      logger.warn('[HostManager] Failed to get game state for sync:', e)
    }
  }
  sendToPeer(peerId, buildMessage('game:state-full', fullPayload))

  broadcastMessage(
    buildMessage('player:join', {
      displayName: playerName,
      characterId,
      characterName,
      peerId
    })
  )

  for (const cb of joinCallbacks) {
    try {
      cb(peerInfo)
    } catch (e) {
      logger.error('[HostManager] Error in join callback:', e)
    }
  }
}

function handleDisconnection(peerId: string): void {
  const peerInfo = peerInfoMap.get(peerId)
  connections.delete(peerId)
  peerInfoMap.delete(peerId)
  messageRates.delete(peerId)
  lastHeartbeat.delete(peerId)

  if (peerInfo) {
    logger.debug('[HostManager] Player left:', peerInfo.displayName, '(', peerId, ')')

    broadcastMessage(buildMessage('player:leave', { displayName: peerInfo.displayName, peerId }))

    for (const cb of leaveCallbacks) {
      try {
        cb(peerInfo)
      } catch (e) {
        logger.error('[HostManager] Error in leave callback:', e)
      }
    }
  }
}
