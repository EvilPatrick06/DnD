/**
 * LiveKit Voice Manager
 *
 * Manages voice chat connections using LiveKit instead of PeerJS media connections.
 * Supports push-to-talk, voice activity detection, per-player volume, and spatial audio.
 *
 * Two connection modes:
 * - Cloud: connects to a LiveKit Cloud instance (DM provides URL + API key)
 * - Local: connects to a locally-running LiveKit server
 */

import {
  type AudioCaptureOptions,
  createLocalAudioTrack,
  type Participant,
  type RemoteParticipant,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  Track
} from 'livekit-client'

// ─── Types ────────────────────────────────────────────────────

export interface LiveKitConfig {
  mode: 'cloud' | 'local'
  serverUrl: string // e.g., "wss://my-app.livekit.cloud" or "ws://localhost:7880"
  token: string // JWT token for auth
  spatialAudio: boolean
  pushToTalk: boolean
  pushToTalkKey: string // default: 'v'
}

export interface SpatialConfig {
  whisperRange: number // in grid cells (e.g., 1 = 5ft)
  normalRange: number // default: 6 (30ft)
  shoutRange: number // default: 24 (120ft)
}

export interface ParticipantInfo {
  peerId: string
  displayName: string
  isSpeaking: boolean
  audioLevel: number
  volume: number
}

type SpeakingCallback = (peerId: string, isSpeaking: boolean) => void

// ─── Module state ─────────────────────────────────────────────

let room: Room | null = null
let config: LiveKitConfig | null = null
let spatialConfig: SpatialConfig = {
  whisperRange: 1,
  normalRange: 6,
  shoutRange: 24
}

let muted = false
let deafened = false
let pushToTalkActive = false
let pushToTalkHeld = false

const speakingCallbacks = new Set<SpeakingCallback>()
const participantVolumes = new Map<string, number>() // peerId -> volume (0-1)
const participantAudioElements = new Map<string, HTMLAudioElement>()

// ─── Connection ───────────────────────────────────────────────

export async function connect(cfg: LiveKitConfig): Promise<void> {
  config = cfg

  room = new Room({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })

  // Event listeners
  room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
  room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
  room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged)
  room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
  room.on(RoomEvent.Disconnected, handleDisconnected)

  await room.connect(cfg.serverUrl, cfg.token)

  // Publish local audio track (unless push-to-talk and key not held)
  if (!cfg.pushToTalk) {
    await publishAudio()
  }

  // Set up push-to-talk key listener
  if (cfg.pushToTalk) {
    window.addEventListener('keydown', handlePTTKeyDown)
    window.addEventListener('keyup', handlePTTKeyUp)
    pushToTalkActive = true
  }
}

export async function disconnect(): Promise<void> {
  if (pushToTalkActive) {
    window.removeEventListener('keydown', handlePTTKeyDown)
    window.removeEventListener('keyup', handlePTTKeyUp)
    pushToTalkActive = false
  }

  participantAudioElements.forEach((el) => {
    el.pause()
    el.srcObject = null
  })
  participantAudioElements.clear()
  participantVolumes.clear()

  if (room) {
    room.disconnect()
    room = null
  }
  config = null
}

// ─── Audio track management ───────────────────────────────────

async function publishAudio(): Promise<void> {
  if (!room) return

  const opts: AudioCaptureOptions = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }

  const track = await createLocalAudioTrack(opts)
  await room.localParticipant.publishTrack(track)

  // Apply mute state
  if (muted) {
    room.localParticipant.setMicrophoneEnabled(false)
  }
}

async function unpublishAudio(): Promise<void> {
  if (!room) return
  const pubs = room.localParticipant.audioTrackPublications
  for (const [, pub] of pubs) {
    if (pub.track) {
      room.localParticipant.unpublishTrack(pub.track)
    }
  }
}

// ─── Push-to-talk ─────────────────────────────────────────────

function handlePTTKeyDown(e: KeyboardEvent): void {
  if (!config?.pushToTalk) return
  if (e.key.toLowerCase() === config.pushToTalkKey.toLowerCase() && !pushToTalkHeld) {
    pushToTalkHeld = true
    publishAudio()
  }
}

function handlePTTKeyUp(e: KeyboardEvent): void {
  if (!config?.pushToTalk) return
  if (e.key.toLowerCase() === config.pushToTalkKey.toLowerCase() && pushToTalkHeld) {
    pushToTalkHeld = false
    unpublishAudio()
  }
}

// ─── Mute/Deafen ──────────────────────────────────────────────

export function setMuted(isMuted: boolean): void {
  muted = isMuted
  if (room) {
    room.localParticipant.setMicrophoneEnabled(!isMuted)
  }
}

export function setDeafened(isDeafened: boolean): void {
  deafened = isDeafened
  // Mute all remote audio elements
  participantAudioElements.forEach((el) => {
    el.muted = isDeafened
  })
  // Also mute local mic when deafened
  if (isDeafened) {
    setMuted(true)
  }
}

export function isMuted(): boolean {
  return muted
}
export function isDeafened(): boolean {
  return deafened
}
export function isConnected(): boolean {
  return room?.state === 'connected'
}

// ─── Per-player volume ────────────────────────────────────────

export function setParticipantVolume(peerId: string, volume: number): void {
  participantVolumes.set(peerId, Math.max(0, Math.min(1, volume)))
  const el = participantAudioElements.get(peerId)
  if (el) {
    el.volume = participantVolumes.get(peerId) ?? 1
  }
}

export function getParticipantVolume(peerId: string): number {
  return participantVolumes.get(peerId) ?? 1
}

// ─── Spatial audio ────────────────────────────────────────────

export function setSpatialConfig(cfg: SpatialConfig): void {
  spatialConfig = cfg
}

/**
 * Update spatial audio volumes based on token positions.
 * Called from the game loop whenever tokens move.
 */
export function updateSpatialAudio(
  listenerPos: { x: number; y: number },
  participantPositions: Map<string, { x: number; y: number }>,
  isDM: boolean
): void {
  if (!config?.spatialAudio) return

  for (const [peerId, pos] of participantPositions) {
    // DM always hears full volume
    if (isDM) {
      setParticipantVolume(peerId, 1)
      continue
    }

    const dx = pos.x - listenerPos.x
    const dy = pos.y - listenerPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    let volume: number
    if (distance <= spatialConfig.whisperRange) {
      volume = 1.0
    } else if (distance <= spatialConfig.normalRange) {
      // Linear falloff from whisper to normal range
      const t = (distance - spatialConfig.whisperRange) / (spatialConfig.normalRange - spatialConfig.whisperRange)
      volume = 1.0 - t * 0.3 // 100% to 70%
    } else if (distance <= spatialConfig.shoutRange) {
      // Linear falloff from normal to shout range
      const t = (distance - spatialConfig.normalRange) / (spatialConfig.shoutRange - spatialConfig.normalRange)
      volume = 0.7 - t * 0.65 // 70% to 5%
    } else {
      volume = 0.05 // barely audible beyond shout range
    }

    setParticipantVolume(peerId, volume)

    // Pan audio based on relative position (left/right)
    // Note: HTMLAudioElement doesn't support panning directly,
    // would need Web Audio API for proper stereo panning
    // For now, just volume-based spatial audio
  }
}

// ─── Speaking callbacks ───────────────────────────────────────

export function onSpeakingChanged(cb: SpeakingCallback): () => void {
  speakingCallbacks.add(cb)
  return () => speakingCallbacks.delete(cb)
}

// ─── LiveKit event handlers ───────────────────────────────────

function handleTrackSubscribed(
  track: Track,
  _publication: RemoteTrackPublication,
  participant: RemoteParticipant
): void {
  if (track.kind !== Track.Kind.Audio) return

  const mediaStream = new MediaStream([track.mediaStreamTrack])
  const el = new Audio()
  el.srcObject = mediaStream
  el.autoplay = true
  el.muted = deafened
  el.volume = participantVolumes.get(participant.identity) ?? 1

  participantAudioElements.set(participant.identity, el)
  el.play().catch(() => {})
}

function handleTrackUnsubscribed(
  track: Track,
  _publication: RemoteTrackPublication,
  participant: RemoteParticipant
): void {
  if (track.kind !== Track.Kind.Audio) return

  const el = participantAudioElements.get(participant.identity)
  if (el) {
    el.pause()
    el.srcObject = null
    participantAudioElements.delete(participant.identity)
  }
}

function handleActiveSpeakersChanged(speakers: Participant[]): void {
  const speakingIds = new Set(speakers.map((s) => s.identity))

  // Notify all callbacks about speaker changes
  for (const [peerId] of participantAudioElements) {
    const _wasSpeaking = speakingCallbacks.size > 0 // approximation
    const isSpeaking = speakingIds.has(peerId)
    speakingCallbacks.forEach((cb) => cb(peerId, isSpeaking))
  }

  // Also notify about local participant
  if (room) {
    const localSpeaking = speakingIds.has(room.localParticipant.identity)
    speakingCallbacks.forEach((cb) => cb(room!.localParticipant.identity ?? '', localSpeaking))
  }
}

function handleParticipantDisconnected(participant: RemoteParticipant): void {
  const el = participantAudioElements.get(participant.identity)
  if (el) {
    el.pause()
    el.srcObject = null
    participantAudioElements.delete(participant.identity)
  }
  participantVolumes.delete(participant.identity)
}

function handleDisconnected(): void {
  participantAudioElements.forEach((el) => {
    el.pause()
    el.srcObject = null
  })
  participantAudioElements.clear()
}

// ─── Get participants info ────────────────────────────────────

export function getParticipants(): ParticipantInfo[] {
  if (!room) return []

  const result: ParticipantInfo[] = []
  for (const [, participant] of room.remoteParticipants) {
    result.push({
      peerId: participant.identity,
      displayName: participant.name ?? participant.identity,
      isSpeaking: participant.isSpeaking,
      audioLevel: participant.audioLevel,
      volume: participantVolumes.get(participant.identity) ?? 1
    })
  }
  return result
}

// ─── Push-to-talk config ──────────────────────────────────────

export function setPushToTalk(enabled: boolean, key?: string): void {
  if (!config) return

  if (pushToTalkActive) {
    window.removeEventListener('keydown', handlePTTKeyDown)
    window.removeEventListener('keyup', handlePTTKeyUp)
    pushToTalkActive = false
  }

  config.pushToTalk = enabled
  if (key) config.pushToTalkKey = key

  if (enabled) {
    window.addEventListener('keydown', handlePTTKeyDown)
    window.addEventListener('keyup', handlePTTKeyUp)
    pushToTalkActive = true
    // Unpublish audio when switching to PTT
    unpublishAudio()
  } else {
    // Publish audio when switching away from PTT
    publishAudio()
  }
}
