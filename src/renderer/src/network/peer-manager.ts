import Peer from 'peerjs'
import { PEER_CREATION_TIMEOUT_MS } from '../constants'
import { logger } from '../utils/logger'

export { generateInviteCode } from '../utils/invite-code'

// Module-level state (singleton pattern)
let peer: Peer | null = null
let localPeerId: string | null = null

// Pi relay server — all multiplayer traffic routes through the Pi
const PI_HOST = '10.10.20.242'

// ICE servers — Pi coturn TURN relay (forces all traffic through Pi)
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: `turn:${PI_HOST}:3478?transport=udp`,
    username: 'dndvtt',
    credential: 'dndvtt-relay'
  },
  {
    urls: `turn:${PI_HOST}:3478?transport=tcp`,
    username: 'dndvtt',
    credential: 'dndvtt-relay'
  }
]

// PeerJS signaling server on the Pi (Docker container, port 9000)
let customSignalingHost: string | null = PI_HOST
let customSignalingPort: number | null = 9000
let customSignalingPath: string = '/myapp'
let customSignalingSecure: boolean = false

/**
 * Configure a custom PeerJS signaling server (e.g. Pi via Cloudflare Tunnel).
 * Call before createPeer() to take effect.
 * @throws {Error} If the host does not use a secure (wss/https) scheme implicitly
 */
export function setSignalingServer(host: string, port?: number, path?: string, secure?: boolean): void {
  // Reject plaintext ws:// or http:// URLs passed as the host value
  if (/^https?:\/\//i.test(host) || /^wss?:\/\//i.test(host)) {
    const scheme = host.match(/^[a-z]+:\/\//i)?.[0] ?? ''
    const isInsecure = /^(http|ws):\/\//i.test(scheme)
    if (isInsecure) {
      logger.warn('setSignalingServer: insecure scheme rejected, use wss:// or https://')
      return
    }
    // Strip any scheme prefix — PeerJS expects a bare hostname
    host = host.replace(/^[a-z]+:\/\//i, '')
  }
  customSignalingHost = host
  customSignalingPort = port ?? (secure !== false ? 443 : 80)
  customSignalingPath = path ?? '/'
  customSignalingSecure = secure !== false
}

/**
 * Reset signaling server to Pi default.
 */
export function resetSignalingServer(): void {
  customSignalingHost = PI_HOST
  customSignalingPort = 9000
  customSignalingPath = '/myapp'
  customSignalingSecure = false
}

let iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS
let forceRelay = true

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
 * Force all WebRTC traffic through TURN relay (no direct P2P).
 * When true, sets iceTransportPolicy to 'relay' so all data routes through
 * the configured TURN server (e.g. coturn on the Pi).
 */
export function setForceRelay(relay: boolean): void {
  forceRelay = relay
}

/**
 * Get the current force-relay setting.
 */
export function getForceRelay(): boolean {
  return forceRelay
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
      config: {
        iceServers,
        ...(forceRelay && { iceTransportPolicy: 'relay' })
      }
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
