import type Peer from 'peerjs'
import type { MediaConnection } from 'peerjs'

// Module-level state
let localStream: MediaStream | null = null
let silentStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let localPeer: Peer | null = null
let muted = false
let deafened = false
let speaking = false
let forceMuted = false
let forceDeafened = false
let listenOnly = false
let vadInterval: ReturnType<typeof setInterval> | null = null

// Per-peer local mute (only affects local audio playback)
const locallyMutedPeers = new Set<string>()

// Active media calls (peerId -> MediaConnection)
const activeCalls = new Map<string, MediaConnection>()

// Pending calls received before localStream was ready
const pendingCalls: MediaConnection[] = []

// Remote audio elements (peerId -> HTMLAudioElement)
const remoteAudioElements = new Map<string, HTMLAudioElement>()

// Speaking change callbacks
type SpeakingCallback = (peerId: string, isSpeaking: boolean) => void
const speakingCallbacks = new Set<SpeakingCallback>()

// VAD (Voice Activity Detection) config
const VAD_THRESHOLD = 30 // Minimum dB level to count as speaking
const VAD_CHECK_INTERVAL_MS = 100

/**
 * Start voice — request microphone access, set up audio context and analyser
 * for voice activity detection. Falls back to listen-only mode if no mic.
 */
export async function startVoice(peer: Peer): Promise<void> {
  localPeer = peer

  // ALWAYS set up the incoming call listener BEFORE trying to get the microphone
  peer.on('call', (call: MediaConnection) => {
    answerCall(call)
  })

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })

    // Set up audio context for voice activity detection
    audioContext = new AudioContext()
    await audioContext.resume()
    const source = audioContext.createMediaStreamSource(localStream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.5
    source.connect(analyser)

    // Apply mute state if already muted
    if (muted) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
    }

    // Start voice activity detection
    startVAD()

    listenOnly = false
    console.log('[VoiceManager] Voice started')
  } catch (_err) {
    // No microphone available — fall back to listen-only mode
    listenOnly = true
    console.warn('[VoiceManager] No microphone - listen-only mode')

    // Create a silent audio stream so we can still establish WebRTC connections.
    // Without a valid MediaStream, PeerJS calls won't complete and we can't
    // receive remote audio either. This silent stream sends silence but allows
    // the full bidirectional WebRTC connection to establish.
    try {
      const silentCtx = new AudioContext()
      await silentCtx.resume()
      const dest = silentCtx.createMediaStreamDestination()
      silentStream = dest.stream
      // Keep the AudioContext reference so we can close it on cleanup
      // (reuse audioContext slot since we didn't set it for listen-only)
      audioContext = silentCtx
      console.log('[VoiceManager] Created silent stream for listen-only WebRTC connections')
    } catch (silentErr) {
      console.error('[VoiceManager] Failed to create silent stream:', silentErr)
    }
  }

  // Process any calls that arrived before we were ready
  while (pendingCalls.length > 0) {
    const pending = pendingCalls.shift()!
    console.log('[VoiceManager] Processing pending call from:', pending.peer)
    answerCall(pending)
  }
}

/**
 * Stop voice — clean up all audio resources.
 */
export function stopVoice(): void {
  console.log('[VoiceManager] Stopping voice...')

  // Stop VAD
  if (vadInterval) {
    clearInterval(vadInterval)
    vadInterval = null
  }

  // Close all active calls
  for (const [peerId, call] of activeCalls) {
    try {
      call.close()
    } catch (e) {
      console.warn('[VoiceManager] Error closing call with', peerId, e)
    }
  }
  activeCalls.clear()

  // Remove remote audio elements
  for (const [peerId, audio] of remoteAudioElements) {
    try {
      audio.srcObject = null
      audio.remove()
    } catch (e) {
      console.warn('[VoiceManager] Error removing audio element for', peerId, e)
    }
  }
  remoteAudioElements.clear()

  // Close audio context
  if (audioContext) {
    try {
      audioContext.close()
    } catch (_e) {
      // Ignore
    }
    audioContext = null
    analyser = null
  }

  // Stop local stream tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
    localStream = null
  }

  // Stop silent stream tracks (used in listen-only mode)
  if (silentStream) {
    silentStream.getTracks().forEach((track) => track.stop())
    silentStream = null
  }

  localPeer = null
  muted = false
  deafened = false
  speaking = false
  forceMuted = false
  forceDeafened = false
  listenOnly = false
  locallyMutedPeers.clear()
  pendingCalls.length = 0

  speakingCallbacks.clear()
}

/**
 * Initiate a voice call to a specific peer.
 */
export function callPeer(peerId: string): void {
  if (!localPeer) {
    console.warn('[VoiceManager] Cannot call peer — voice not started')
    return
  }

  // Use the real local stream, or the silent stream for listen-only mode
  const streamToSend = localStream || silentStream
  if (!streamToSend) {
    console.warn('[VoiceManager] No stream available — cannot call peer', peerId)
    return
  }

  if (activeCalls.has(peerId)) {
    console.warn('[VoiceManager] Already in a call with', peerId)
    return
  }

  console.log('[VoiceManager] Calling peer:', peerId, listenOnly ? '(listen-only, sending silence)' : '')
  const call = localPeer.call(peerId, streamToSend)
  setupCall(peerId, call)
}

/**
 * Answer an incoming media call.
 */
export function answerCall(call: MediaConnection): void {
  // If we're not yet in listen-only mode and have no stream (and no silent stream), queue the call
  if (!localStream && !silentStream && !listenOnly) {
    console.warn('[VoiceManager] Cannot answer call yet — queuing pending call from:', call.peer)
    pendingCalls.push(call)
    return
  }

  const peerId = call.peer
  console.log('[VoiceManager] Answering call from:', peerId, listenOnly ? '(listen-only)' : '')

  // Use the real local stream, or the silent stream for listen-only mode.
  // Answering with a valid MediaStream (even silent) ensures the full WebRTC
  // connection completes so we can receive the remote peer's audio.
  const streamToAnswer = localStream || silentStream
  if (streamToAnswer) {
    call.answer(streamToAnswer)
  } else {
    // Last resort: answer with no stream (may not receive audio on some browsers)
    call.answer()
  }
  setupCall(peerId, call)
}

/**
 * Set the local microphone muted state.
 * Rejects unmute if force-muted by DM.
 */
export function setMuted(isMuted: boolean): void {
  // Reject unmute if force-muted
  if (!isMuted && forceMuted) return

  muted = isMuted
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }
  if (muted && speaking) {
    speaking = false
    notifySpeakingChange(localPeer?.id || '', false)
  }
}

/**
 * Set the deafened state (mutes incoming audio).
 * Rejects undeafen if force-deafened by DM.
 */
export function setDeafened(isDeafened: boolean): void {
  // Reject undeafen if force-deafened
  if (!isDeafened && forceDeafened) return

  deafened = isDeafened
  // When deafened, also mute outgoing
  if (deafened) {
    setMuted(true)
  }
  // Mute/unmute all remote audio elements, respecting per-peer local mute
  for (const [peerId, audio] of remoteAudioElements) {
    audio.muted = deafened || locallyMutedPeers.has(peerId)
  }
}

/**
 * Check if the local user is currently speaking (based on VAD).
 */
export function isSpeaking(): boolean {
  return speaking
}

/**
 * Check if the local user is muted.
 */
export function isMuted(): boolean {
  return muted
}

/**
 * Check if the local user is deafened.
 */
export function isDeafened(): boolean {
  return deafened
}

/**
 * Mute/unmute a specific peer's audio element locally.
 * This only affects local playback — the remote peer's mic is not affected.
 */
export function setRemotePeerMuted(peerId: string, muted: boolean): void {
  if (muted) {
    locallyMutedPeers.add(peerId)
  } else {
    locallyMutedPeers.delete(peerId)
  }
  const audio = remoteAudioElements.get(peerId)
  if (audio) {
    audio.muted = deafened || muted
  }
}

/**
 * Check if a specific peer is locally muted.
 */
export function isRemotePeerMuted(peerId: string): boolean {
  return locallyMutedPeers.has(peerId)
}

/**
 * Set force-muted state (DM moderation).
 * When true, disables mic. When false, does NOT auto-unmute.
 */
export function setForceMuted(isForceMuted: boolean): void {
  forceMuted = isForceMuted
  if (forceMuted) {
    setMuted(true)
  }
  // When removing force-mute, player stays muted — they must manually unmute
}

/**
 * Set force-deafened state (DM moderation).
 * When true, deafens + force-mutes. When false, does NOT auto-undeafen.
 */
export function setForceDeafened(isForceDeafened: boolean): void {
  forceDeafened = isForceDeafened
  if (forceDeafened) {
    setDeafened(true)
    // Force-deafen implies force-mute
    forceMuted = true
  } else {
    // Removing force-deafen also removes force-mute
    forceMuted = false
  }
  // Player stays deafened/muted — they must manually toggle
}

/**
 * Check if the local user is force-muted by the DM.
 */
export function isForceMutedByDM(): boolean {
  return forceMuted
}

/**
 * Check if the local user is force-deafened by the DM.
 */
export function isForceDeafenedByDM(): boolean {
  return forceDeafened
}

/**
 * Check if voice is in listen-only mode (no microphone available).
 */
export function isListenOnly(): boolean {
  return listenOnly
}

/**
 * Register a callback for speaking state changes.
 * Returns an unsubscribe function.
 */
export function onSpeakingChange(callback: (peerId: string, isSpeaking: boolean) => void): () => void {
  speakingCallbacks.add(callback)
  return () => {
    speakingCallbacks.delete(callback)
  }
}

/**
 * Resume all remote audio elements. Call this from a user gesture (click)
 * to unblock autoplay policy in Electron / Chromium.
 */
export function resumeAllAudio(): void {
  for (const [peerId, audio] of remoteAudioElements) {
    audio.volume = 1.0
    audio.play().catch((e) => {
      console.warn('[VoiceManager] Failed to resume audio for', peerId, e)
    })
  }
  // Also resume the AudioContext if it was suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch((e) => {
      console.warn('[VoiceManager] Failed to resume AudioContext:', e)
    })
  }
}

/**
 * Remove a specific peer's call (e.g., when they leave).
 */
export function removePeer(peerId: string): void {
  const call = activeCalls.get(peerId)
  if (call) {
    try {
      call.close()
    } catch (_e) {
      // Ignore
    }
    activeCalls.delete(peerId)
  }

  const audio = remoteAudioElements.get(peerId)
  if (audio) {
    audio.srcObject = null
    audio.remove()
    remoteAudioElements.delete(peerId)
  }
}

// --- Internal helpers ---

function setupCall(peerId: string, call: MediaConnection): void {
  activeCalls.set(peerId, call)

  call.on('stream', (remoteStream: MediaStream) => {
    const tracks = remoteStream.getAudioTracks()
    console.log(
      '[VoiceManager] Received stream from:',
      peerId,
      'audioTracks:',
      tracks.length,
      'enabled:',
      tracks.map((t) => t.enabled),
      'readyState:',
      tracks.map((t) => t.readyState)
    )
    playRemoteStream(peerId, remoteStream)

    // Monitor track ending
    for (const track of tracks) {
      track.onended = () => {
        console.warn('[VoiceManager] Audio track ended for peer:', peerId)
      }
    }
  })

  call.on('close', () => {
    console.log('[VoiceManager] Call closed with:', peerId)
    removePeer(peerId)
  })

  call.on('error', (err) => {
    console.error(
      '[VoiceManager] Call error with',
      peerId,
      '- type:',
      (err as Error & { type?: string }).type,
      '- message:',
      err.message || err
    )
    removePeer(peerId)
  })
}

function playRemoteStream(peerId: string, stream: MediaStream): void {
  // Remove any existing audio element for this peer
  const existing = remoteAudioElements.get(peerId)
  if (existing) {
    existing.srcObject = null
    existing.remove()
  }

  const audioTracks = stream.getAudioTracks()
  console.log(
    '[VoiceManager] Playing remote stream from:',
    peerId,
    'tracks:',
    audioTracks.length,
    'enabled:',
    audioTracks.map((t) => t.enabled),
    'readyState:',
    audioTracks.map((t) => t.readyState)
  )

  // Create an audio element to play the remote stream
  const audio = document.createElement('audio')
  audio.srcObject = stream
  audio.autoplay = true
  audio.volume = 1.0
  // Explicitly unmuted first — deafen/per-peer mute applied after
  audio.muted = false
  audio.style.display = 'none'
  document.body.appendChild(audio)

  // Now apply deafen/per-peer mute state
  audio.muted = deafened || locallyMutedPeers.has(peerId)

  remoteAudioElements.set(peerId, audio)

  // Resume AudioContext if suspended (needed for Chromium autoplay policy)
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch((e) => {
      console.warn('[VoiceManager] Failed to resume AudioContext on new stream:', e)
    })
  }

  // Play (handle autoplay policy) with retry logic
  const playPromise = audio.play()
  if (playPromise) {
    playPromise
      .then(() => {
        console.log('[VoiceManager] Audio playing for', peerId)
      })
      .catch((e) => {
        console.warn('[VoiceManager] Audio autoplay blocked for', peerId, e)
        // Retry periodically (every 1s for 10 attempts)
        let retryCount = 0
        const retryInterval = setInterval(() => {
          retryCount++
          if (retryCount >= 10 || !remoteAudioElements.has(peerId)) {
            clearInterval(retryInterval)
            return
          }
          audio
            .play()
            .then(() => {
              console.log('[VoiceManager] Audio retry succeeded for', peerId)
              clearInterval(retryInterval)
            })
            .catch(() => {})
        }, 1000)
        // Also retry on next user interaction
        const retryPlay = (): void => {
          audio
            .play()
            .then(() => {
              console.log('[VoiceManager] Audio play resumed via user gesture for', peerId)
            })
            .catch(() => {})
          clearInterval(retryInterval)
          document.removeEventListener('click', retryPlay)
          document.removeEventListener('keydown', retryPlay)
        }
        document.addEventListener('click', retryPlay, { once: true })
        document.addEventListener('keydown', retryPlay, { once: true })
      })
  }
}

function startVAD(): void {
  if (vadInterval) {
    clearInterval(vadInterval)
  }

  const dataArray = new Uint8Array(analyser?.frequencyBinCount ?? 0)

  vadInterval = setInterval(() => {
    if (!analyser || muted) {
      if (speaking) {
        speaking = false
        notifySpeakingChange(localPeer?.id || '', false)
      }
      return
    }

    analyser.getByteFrequencyData(dataArray)

    // Calculate average volume level
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const average = sum / dataArray.length

    const wasSpeaking = speaking
    speaking = average > VAD_THRESHOLD

    if (speaking !== wasSpeaking) {
      notifySpeakingChange(localPeer?.id || '', speaking)
    }
  }, VAD_CHECK_INTERVAL_MS)
}

function notifySpeakingChange(peerId: string, isSpeaking: boolean): void {
  for (const cb of speakingCallbacks) {
    try {
      cb(peerId, isSpeaking)
    } catch (e) {
      console.error('[VoiceManager] Error in speaking callback:', e)
    }
  }
}
