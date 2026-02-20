import Peer from 'peerjs'

// Module-level state (singleton pattern)
let peer: Peer | null = null
let localPeerId: string | null = null

// Default ICE servers — Google STUN + Metered.ca TURN
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:standard.relay.metered.ca:80', username: 'open', credential: 'open' },
  { urls: 'turn:standard.relay.metered.ca:443', username: 'open', credential: 'open' },
  { urls: 'turns:standard.relay.metered.ca:443', username: 'open', credential: 'open' }
]

let iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS

/**
 * Override ICE server configuration (e.g. with user-configured TURN servers).
 * Call before createPeer() to take effect.
 */
export function setIceConfig(servers: RTCIceServer[]): void {
  iceServers = servers.length > 0 ? servers : DEFAULT_ICE_SERVERS
}

/**
 * Get the current ICE server configuration.
 */
export function getIceConfig(): RTCIceServer[] {
  return iceServers
}

/**
 * Reset ICE servers to defaults.
 */
export function resetIceConfig(): void {
  iceServers = DEFAULT_ICE_SERVERS
}

/**
 * Generate a short random invite code (6 chars, uppercase alphanumeric).
 * This code doubles as the PeerJS peer ID for the host.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous: I, O, 0, 1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a new PeerJS instance. If a customId is provided, it will be used
 * as the peer ID (used by the host with the invite code). Otherwise PeerJS
 * assigns a random ID.
 */
export function createPeer(customId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    // Clean up any existing peer
    if (peer) {
      destroyPeer()
    }

    const options = {
      debug: import.meta.env.DEV ? 2 : 0,
      config: { iceServers }
    }

    const newPeer = customId ? new Peer(customId, options) : new Peer(options)

    const timeout = setTimeout(() => {
      newPeer.destroy()
      reject(new Error('Peer creation timed out after 15 seconds'))
    }, 15000)

    newPeer.on('open', (id) => {
      clearTimeout(timeout)
      peer = newPeer
      localPeerId = id
      console.log('[PeerManager] Peer created with ID:', id)
      resolve(newPeer)
    })

    newPeer.on('error', (err) => {
      clearTimeout(timeout)
      console.error('[PeerManager] Peer error:', err)

      // If the peer ID is already taken, the host should retry with a new code
      if (err.type === 'unavailable-id') {
        newPeer.destroy()
        reject(new Error('Invite code already in use. Please try again.'))
        return
      }

      // Network-level errors
      if (err.type === 'network' || err.type === 'server-error') {
        reject(new Error('Could not connect to signaling server. Check your internet connection.'))
        return
      }

      reject(err)
    })
  })
}

/**
 * Destroy the current PeerJS instance and clean up.
 */
export function destroyPeer(): void {
  if (peer) {
    console.log('[PeerManager] Destroying peer:', localPeerId)
    try {
      peer.destroy()
    } catch (e) {
      console.warn('[PeerManager] Error during peer destroy:', e)
    }
    peer = null
    localPeerId = null
  }
}

/**
 * Get the current peer ID, or null if no peer exists.
 */
export function getPeerId(): string | null {
  return localPeerId
}

/**
 * Get the raw Peer instance, or null if not created.
 */
export function getPeer(): Peer | null {
  return peer
}
