import type { DataConnection } from 'peerjs'
import { createPeer, destroyPeer, getPeerId } from './peer-manager'
import type { NetworkMessage } from './types'

const KNOWN_MESSAGE_TYPES: Set<string> = new Set<string>([
  'player:join', 'player:ready', 'player:leave', 'player:character-select',
  'player:buy-item', 'player:sell-item', 'game:state-update', 'game:state-full',
  'game:dice-roll', 'game:dice-result', 'game:turn-advance', 'dm:map-change',
  'dm:fog-reveal', 'dm:token-move', 'dm:initiative-update', 'dm:condition-update',
  'dm:kick-player', 'dm:ban-player', 'dm:unban-player', 'dm:force-mute',
  'dm:force-deafen', 'dm:chat-timeout', 'dm:promote-codm', 'dm:demote-codm',
  'dm:game-start', 'dm:game-end', 'dm:character-update', 'dm:shop-update',
  'dm:slow-mode', 'dm:file-sharing', 'chat:message', 'chat:file', 'chat:whisper',
  'player:color-change', 'voice:mute-toggle', 'ping', 'pong'
])

function validateIncomingMessage(msg: any): msg is NetworkMessage {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return false
  if (typeof msg.type !== 'string' || !KNOWN_MESSAGE_TYPES.has(msg.type)) return false
  if (msg.payload !== undefined && msg.payload !== null && typeof msg.payload !== 'object') return false
  if (typeof msg.senderId === 'string' && msg.senderId.length > 100) return false
  if (typeof msg.senderName === 'string' && msg.senderName.length > 100) return false

  const payload = msg.payload
  if (payload && typeof payload === 'object') {
    if (typeof payload.displayName === 'string' && payload.displayName.length > 100) return false
    if (typeof payload.message === 'string' && payload.message.length > 5000) return false
  }

  return true
}

// Module-level state
let connection: DataConnection | null = null
let connected = false
let displayName = ''
let sequenceCounter = 0

// Reconnection state
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
let retryCount = 0
let retryTimeout: ReturnType<typeof setTimeout> | null = null
let lastInviteCode: string | null = null

// Event callbacks
type MessageCallback = (message: NetworkMessage) => void
type DisconnectedCallback = (reason: string) => void

const messageCallbacks = new Set<MessageCallback>()
const disconnectedCallbacks = new Set<DisconnectedCallback>()

/**
 * Connect to a host using an invite code.
 * Creates a PeerJS peer, connects to the host peer ID (the invite code),
 * and automatically sends a join message.
 */
export async function connectToHost(
  inviteCode: string,
  playerDisplayName: string,
  characterId: string | null = null,
  characterName: string | null = null
): Promise<void> {
  if (connected) {
    throw new Error('Already connected to a game')
  }

  displayName = playerDisplayName
  lastInviteCode = inviteCode.toUpperCase().trim()
  retryCount = 0
  sequenceCounter = 0

  await attemptConnection(lastInviteCode, characterId, characterName)
}

/**
 * Disconnect from the host and clean up.
 */
export function disconnect(): void {
  console.log('[ClientManager] Disconnecting...')

  // Cancel any pending retry
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }

  if (connection) {
    // Send a leave message before closing
    try {
      sendMessage({ type: 'player:leave', payload: { displayName } })
    } catch (_e) {
      // Ignore errors during disconnect
    }

    try {
      connection.close()
    } catch (_e) {
      // Ignore close errors
    }
    connection = null
  }

  connected = false
  lastInviteCode = null
  retryCount = 0

  destroyPeer()

  // Clear callbacks
  messageCallbacks.clear()
  disconnectedCallbacks.clear()
}

/**
 * Send a message to the host. Automatically fills in senderId,
 * senderName, timestamp, and sequence number.
 */
export function sendMessage(
  msg: Omit<NetworkMessage, 'senderId' | 'senderName' | 'timestamp' | 'sequence'>
): void {
  if (!connection || !connection.open) {
    console.warn('[ClientManager] Cannot send message — not connected')
    return
  }

  const fullMessage: NetworkMessage = {
    ...msg,
    senderId: getPeerId() || '',
    senderName: displayName,
    timestamp: Date.now(),
    sequence: sequenceCounter++
  }

  try {
    connection.send(JSON.stringify(fullMessage))
  } catch (e) {
    console.error('[ClientManager] Failed to send message:', e)
  }
}

/**
 * Register a callback for incoming messages from the host.
 * Returns an unsubscribe function.
 */
export function onMessage(callback: MessageCallback): () => void {
  messageCallbacks.add(callback)
  return () => {
    messageCallbacks.delete(callback)
  }
}

/**
 * Register a callback for when the connection is lost.
 * Returns an unsubscribe function.
 */
export function onDisconnected(callback: DisconnectedCallback): () => void {
  disconnectedCallbacks.add(callback)
  return () => {
    disconnectedCallbacks.delete(callback)
  }
}

/**
 * Check if currently connected.
 */
export function isConnected(): boolean {
  return connected
}

// --- Internal helpers ---

async function attemptConnection(
  inviteCode: string,
  characterId: string | null = null,
  characterName: string | null = null
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    createPeer()
      .then((peer) => {
        console.log('[ClientManager] Connecting to host:', inviteCode)

        const conn = peer.connect(inviteCode, {
          reliable: true,
          serialization: 'raw'
        })

        // Connection timeout
        const timeout = setTimeout(() => {
          conn.close()
          reject(new Error('Connection to host timed out'))
        }, 15000)

        conn.on('open', () => {
          clearTimeout(timeout)
          connection = conn
          connected = true
          retryCount = 0

          console.log('[ClientManager] Connected to host')

          // Send join message immediately
          sendMessage({
            type: 'player:join',
            payload: {
              displayName,
              characterId,
              characterName
            }
          })

          resolve()
        })

        conn.on('data', (raw) => {
          let message: NetworkMessage
          try {
            message = typeof raw === 'string' ? JSON.parse(raw) : (raw as NetworkMessage)
          } catch (e) {
            console.warn('[ClientManager] Invalid message from host:', e)
            return
          }

          if (!validateIncomingMessage(message)) {
            console.warn('[ClientManager] Message failed validation:', (message as any)?.type)
            return
          }

          // Handle kick — do NOT retry reconnection
          if (message.type === 'dm:kick-player') {
            console.log('[ClientManager] Kicked from game')
            handleForcedDisconnection('You were kicked from the game')
            return
          }

          // Handle ban — do NOT retry reconnection
          if (message.type === 'dm:ban-player') {
            console.log('[ClientManager] Banned from game')
            handleForcedDisconnection('You were banned from the game')
            return
          }

          // Handle game end — do NOT retry reconnection
          if (message.type === 'dm:game-end') {
            console.log('[ClientManager] Game ended by host')
            handleForcedDisconnection('The game session has ended')
            return
          }

          // Handle pong (keep-alive response)
          if (message.type === 'pong') {
            return
          }

          // Dispatch to callbacks
          for (const cb of messageCallbacks) {
            try {
              cb(message)
            } catch (e) {
              console.error('[ClientManager] Error in message callback:', e)
            }
          }
        })

        conn.on('close', () => {
          clearTimeout(timeout)
          if (connected) {
            handleDisconnection('Connection closed')
          }
        })

        conn.on('error', (err) => {
          clearTimeout(timeout)
          console.error('[ClientManager] Connection error:', err)
          if (!connected) {
            reject(new Error('Failed to connect to host: ' + err.message))
          } else {
            handleDisconnection('Connection error: ' + err.message)
          }
        })

        // Handle peer-level errors (e.g., peer-unavailable means wrong invite code)
        peer.on('error', (err) => {
          clearTimeout(timeout)
          if (err.type === 'peer-unavailable') {
            reject(new Error('Invalid invite code. No game found with that code.'))
          } else if (!connected) {
            reject(new Error('Connection failed: ' + err.message))
          }
        })
      })
      .catch(reject)
  })
}

function handleDisconnection(reason: string): void {
  const wasConnected = connected
  connected = false
  connection = null

  if (wasConnected && retryCount < MAX_RETRIES && lastInviteCode) {
    retryCount++
    console.log(
      `[ClientManager] Connection lost. Retrying (${retryCount}/${MAX_RETRIES}) in ${RETRY_DELAY_MS}ms...`
    )

    // Destroy the old peer before retrying
    destroyPeer()

    retryTimeout = setTimeout(async () => {
      try {
        await attemptConnection(lastInviteCode!)
        console.log('[ClientManager] Reconnected successfully')
        // Re-send join message on reconnect
        sendMessage({
          type: 'player:join',
          payload: {
            displayName,
            characterId: null,
            characterName: null
          }
        })
      } catch (e) {
        console.error('[ClientManager] Reconnection attempt failed:', e)
        if (retryCount >= MAX_RETRIES) {
          notifyDisconnected('Failed to reconnect after ' + MAX_RETRIES + ' attempts')
        } else {
          handleDisconnection(reason)
        }
      }
    }, RETRY_DELAY_MS)
  } else {
    destroyPeer()
    notifyDisconnected(reason)
  }
}

function handleForcedDisconnection(reason: string): void {
  connected = false
  connection = null
  lastInviteCode = null
  retryCount = MAX_RETRIES // Prevent retries
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }
  destroyPeer()
  notifyDisconnected(reason)
}

function notifyDisconnected(reason: string): void {
  lastInviteCode = null
  retryCount = 0
  for (const cb of disconnectedCallbacks) {
    try {
      cb(reason)
    } catch (e) {
      console.error('[ClientManager] Error in disconnected callback:', e)
    }
  }
}
