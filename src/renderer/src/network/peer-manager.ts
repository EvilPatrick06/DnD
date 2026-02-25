import Peer from 'peerjs'
import { PEER_CREATION_TIMEOUT_MS } from '../constants/app-constants'
import { logger } from '../utils/logger'

export { generateInviteCode } from '../utils/invite-code'

// Module-level state (singleton pattern)
let peer: Peer | null = null
let localPeerId: string | null = null

// Default ICE servers — Cloudflare TURN + Google STUN
// Cloudflare Calls provides free TURN relay for NAT traversal
// Configure TURN credentials in Cloudflare dashboard → Calls → TURN Keys
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.cloudflare.com:3478?transport=udp',
    username: '', // Set via setIceConfig() with Cloudflare Calls TURN credentials
    credential: ''
  },
  {
    urls: 'turns:turn.cloudflare.com:5349?transport=tcp',
    username: '',
    credential: ''
  }
]

// Custom PeerJS signaling server (Pi via Cloudflare Tunnel)
let customSignalingHost: string | null = null
let customSignalingPort: number | null = null
let customSignalingPath: string = '/'
let customSignalingSecure: boolean = true

/**
 * Configure a custom PeerJS signaling server (e.g. Pi via Cloudflare Tunnel).
 * Call before createPeer() to take effect.
 */
export function setSignalingServer(host: string, port?: number, path?: string, secure?: boolean): void {
  customSignalingHost = host
  customSignalingPort = port ?? (secure !== false ? 443 : 80)
  customSignalingPath = path ?? '/'
  customSignalingSecure = secure !== false
}

/**
 * Reset signaling server to PeerJS cloud default.
 */
export function resetSignalingServer(): void {
  customSignalingHost = null
  customSignalingPort = null
  customSignalingPath = '/'
  customSignalingSecure = true
}

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

    const options: Record<string, unknown> = {
      debug: import.meta.env.DEV ? 2 : 0,
      config: { iceServers }
    }

    // Use custom signaling server if configured (Pi via Cloudflare Tunnel)
    if (customSignalingHost) {
      options.host = customSignalingHost
      options.port = customSignalingPort ?? 443
      options.path = customSignalingPath
      options.secure = customSignalingSecure
    }

    const newPeer = customId ? new Peer(customId, options) : new Peer(options)

    const timeout = setTimeout(() => {
      newPeer.destroy()
      reject(new Error('Peer creation timed out after 15 seconds'))
    }, PEER_CREATION_TIMEOUT_MS)

    newPeer.on('open', (id) => {
      clearTimeout(timeout)
      peer = newPeer
      localPeerId = id
      logger.debug('[PeerManager] Peer created with ID:', id)
      resolve(newPeer)
    })

    newPeer.on('error', (err) => {
      clearTimeout(timeout)
      logger.error('[PeerManager] Peer error:', err)

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
    logger.debug('[PeerManager] Destroying peer:', localPeerId)
    try {
      peer.destroy()
    } catch (e) {
      logger.warn('[PeerManager] Error during peer destroy:', e)
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
