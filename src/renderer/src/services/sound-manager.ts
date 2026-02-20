/**
 * Sound effects manager using HTML5 Audio API.
 * Two-tier architecture:
 *   Tier 1 — Bundled defaults in ./sounds/ (shipped with app)
 *   Tier 2 — DM custom audio per campaign (overrides defaults)
 *
 * Module-level state with exported functions.
 */

// -- Combat sounds (10) --
// -- Spell school sounds (10) --
// -- Condition sounds (10) --
// -- Dice sounds (12) --
// -- UI & event sounds (12) --
// -- Ambient loops (9) --

export type SoundEvent =
  // Combat
  | 'attack-hit'
  | 'attack-miss'
  | 'crit-hit'
  | 'crit-miss'
  | 'melee-attack'
  | 'ranged-attack'
  | 'damage'
  | 'death'
  | 'stabilize'
  | 'instant-kill'
  // Spells by school
  | 'spell-abjuration'
  | 'spell-conjuration'
  | 'spell-divination'
  | 'spell-enchantment'
  | 'spell-evocation'
  | 'spell-illusion'
  | 'spell-necromancy'
  | 'spell-transmutation'
  | 'spell-fizzle'
  | 'counterspell'
  // Conditions
  | 'condition-blinded'
  | 'condition-charmed'
  | 'condition-frightened'
  | 'condition-paralyzed'
  | 'condition-poisoned'
  | 'condition-prone'
  | 'condition-restrained'
  | 'condition-stunned'
  | 'condition-unconscious'
  | 'condition-exhaustion'
  // Dice
  | 'dice-d4'
  | 'dice-d6'
  | 'dice-d8'
  | 'dice-d10'
  | 'dice-d12'
  | 'dice-d20'
  | 'dice-d100'
  | 'dice-advantage'
  | 'dice-disadvantage'
  | 'dice-roll'
  | 'nat-20'
  | 'nat-1'
  // UI & Events
  | 'initiative-start'
  | 'turn-notify'
  | 'round-end'
  | 'level-up'
  | 'xp-gain'
  | 'short-rest'
  | 'long-rest'
  | 'shop-open'
  | 'loot-found'
  | 'door-open'
  | 'trap-triggered'
  | 'bastion-event'
  // General
  | 'heal'
  | 'death-save'
  | 'announcement'
  | 'ping'
  | 'condition-apply'

export type AmbientSound =
  | 'ambient-tavern'
  | 'ambient-dungeon'
  | 'ambient-forest'
  | 'ambient-cave'
  | 'ambient-city'
  | 'ambient-battle'
  | 'ambient-tension'
  | 'ambient-victory'
  | 'ambient-defeat'

const SOUND_EVENTS: SoundEvent[] = [
  // Combat
  'attack-hit',
  'attack-miss',
  'crit-hit',
  'crit-miss',
  'melee-attack',
  'ranged-attack',
  'damage',
  'death',
  'stabilize',
  'instant-kill',
  // Spells
  'spell-abjuration',
  'spell-conjuration',
  'spell-divination',
  'spell-enchantment',
  'spell-evocation',
  'spell-illusion',
  'spell-necromancy',
  'spell-transmutation',
  'spell-fizzle',
  'counterspell',
  // Conditions
  'condition-blinded',
  'condition-charmed',
  'condition-frightened',
  'condition-paralyzed',
  'condition-poisoned',
  'condition-prone',
  'condition-restrained',
  'condition-stunned',
  'condition-unconscious',
  'condition-exhaustion',
  // Dice
  'dice-d4',
  'dice-d6',
  'dice-d8',
  'dice-d10',
  'dice-d12',
  'dice-d20',
  'dice-d100',
  'dice-advantage',
  'dice-disadvantage',
  'dice-roll',
  'nat-20',
  'nat-1',
  // UI & Events
  'initiative-start',
  'turn-notify',
  'round-end',
  'level-up',
  'xp-gain',
  'short-rest',
  'long-rest',
  'shop-open',
  'loot-found',
  'door-open',
  'trap-triggered',
  'bastion-event',
  // General
  'heal',
  'death-save',
  'announcement',
  'ping',
  'condition-apply'
]

const POOL_SIZE = 3

const AMBIENT_EVENTS: AmbientSound[] = [
  'ambient-tavern',
  'ambient-dungeon',
  'ambient-forest',
  'ambient-cave',
  'ambient-city',
  'ambient-battle',
  'ambient-tension',
  'ambient-victory',
  'ambient-defeat'
]

// --- Module-level state ---

let initialized = false
let volume = 1
let ambientVolume = 0.3
let muted = false
let enabled = true

/** Map from event name to a pool of Audio elements */
const pools: Map<SoundEvent, HTMLAudioElement[]> = new Map()

/** Tracks which pool index to use next for each event (round-robin) */
const poolIndex: Map<SoundEvent, number> = new Map()

/** Tier 2: DM custom audio overrides (event → custom file path) */
const customOverrides: Map<string, string> = new Map()

/** Currently playing ambient loop */
let currentAmbient: HTMLAudioElement | null = null
let currentAmbientName: AmbientSound | null = null

/** Custom audio tracks (file path -> Audio element) */
const customAudioTracks: Map<string, HTMLAudioElement> = new Map()

// --- Exported functions ---

/**
 * Preloads audio files for all sound events.
 * Custom overrides take priority over bundled defaults (Tier 2 > Tier 1).
 * No-op if already initialized.
 */
export function init(): void {
  if (initialized) return

  for (const event of SOUND_EVENTS) {
    const customPath = customOverrides.get(event)
    const path = customPath ?? `./sounds/${event}.mp3`
    const pool: HTMLAudioElement[] = []

    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = muted ? 0 : volume
      pool.push(audio)
    }

    pools.set(event, pool)
    poolIndex.set(event, 0)
  }

  initialized = true
}

/**
 * Register a DM custom audio override for an event.
 * Custom files take priority over bundled defaults (Tier 2).
 * Must be called before init() for the override to take effect,
 * or call reinit() after registering overrides.
 */
export function registerCustomSound(event: SoundEvent | AmbientSound, filePath: string): void {
  customOverrides.set(event, filePath)
}

/**
 * Remove a custom audio override, reverting to the bundled default.
 */
export function removeCustomSound(event: SoundEvent | AmbientSound): void {
  customOverrides.delete(event)
}

/**
 * Get all registered custom sound overrides.
 */
export function getCustomSounds(): Map<string, string> {
  return new Map(customOverrides)
}

/**
 * Reinitialize the sound system (e.g., after registering custom sounds).
 */
export function reinit(): void {
  initialized = false
  pools.clear()
  poolIndex.clear()
  init()
}

/**
 * Plays the sound associated with the given event.
 * Uses round-robin across the pool to allow overlapping plays.
 * Does nothing if the system is disabled or not initialized.
 */
export function play(event: SoundEvent): void {
  if (!enabled || !initialized) return

  const pool = pools.get(event)
  if (!pool) return

  const idx = poolIndex.get(event) ?? 0
  const audio = pool[idx]

  // Reset to the start so it can replay even if still playing
  audio.currentTime = 0
  audio.volume = muted ? 0 : volume
  audio.play().catch(() => {
    // Ignore play errors (e.g. file not found, user interaction required)
  })

  poolIndex.set(event, (idx + 1) % POOL_SIZE)
}

/**
 * Play a specific sound event for a condition name.
 * Maps condition names to their sound events.
 */
export function playConditionSound(conditionName: string): void {
  const conditionMap: Record<string, SoundEvent> = {
    blinded: 'condition-blinded',
    charmed: 'condition-charmed',
    frightened: 'condition-frightened',
    paralyzed: 'condition-paralyzed',
    poisoned: 'condition-poisoned',
    prone: 'condition-prone',
    restrained: 'condition-restrained',
    stunned: 'condition-stunned',
    unconscious: 'condition-unconscious',
    exhaustion: 'condition-exhaustion'
  }
  const event = conditionMap[conditionName.toLowerCase()] ?? 'condition-apply'
  play(event)
}

/**
 * Play a spell school sound based on the school name.
 */
export function playSpellSound(school: string): void {
  const schoolMap: Record<string, SoundEvent> = {
    abjuration: 'spell-abjuration',
    conjuration: 'spell-conjuration',
    divination: 'spell-divination',
    enchantment: 'spell-enchantment',
    evocation: 'spell-evocation',
    illusion: 'spell-illusion',
    necromancy: 'spell-necromancy',
    transmutation: 'spell-transmutation'
  }
  const event = schoolMap[school.toLowerCase()]
  if (event) play(event)
}

/**
 * Play a dice sound for a specific die type.
 */
export function playDiceSound(sides: number): void {
  const diceMap: Record<number, SoundEvent> = {
    4: 'dice-d4',
    6: 'dice-d6',
    8: 'dice-d8',
    10: 'dice-d10',
    12: 'dice-d12',
    20: 'dice-d20',
    100: 'dice-d100'
  }
  const event = diceMap[sides] ?? 'dice-roll'
  play(event)
}

/**
 * Start playing an ambient sound loop.
 * Stops any currently playing ambient sound.
 */
export function playAmbient(ambient: AmbientSound): void {
  stopAmbient()

  const customPath = customOverrides.get(ambient)
  const path = customPath ?? `./sounds/${ambient}.mp3`
  const audio = new Audio(path)
  audio.loop = true
  audio.volume = muted ? 0 : ambientVolume
  audio.play().catch(() => {})

  currentAmbient = audio
  currentAmbientName = ambient
}

/**
 * Stop the currently playing ambient sound.
 */
export function stopAmbient(): void {
  if (currentAmbient) {
    currentAmbient.pause()
    currentAmbient.currentTime = 0
    currentAmbient = null
    currentAmbientName = null
  }
}

/**
 * Get the name of the currently playing ambient sound, if any.
 */
export function getCurrentAmbient(): AmbientSound | null {
  return currentAmbientName
}

/**
 * Get the current ambient volume level (0-1).
 */
export function getAmbientVolume(): number {
  return ambientVolume
}

/**
 * Get the current master volume level (0-1).
 */
export function getVolume(): number {
  return volume
}

/**
 * Smoothly fade the ambient volume to a target level over a duration.
 * Uses requestAnimationFrame for smooth interpolation.
 * @param targetVolume Target volume level (0-1).
 * @param durationMs Duration of the fade in milliseconds.
 * @returns A promise that resolves when the fade is complete.
 */
export function fadeAmbient(targetVolume: number, durationMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const target = Math.max(0, Math.min(1, targetVolume))
    const startVolume = ambientVolume
    const delta = target - startVolume

    if (durationMs <= 0 || Math.abs(delta) < 0.001) {
      setAmbientVolume(target)
      resolve()
      return
    }

    const startTime = performance.now()

    function step(now: number): void {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      // Ease-in-out for smoother perception
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2

      setAmbientVolume(startVolume + delta * eased)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setAmbientVolume(target)
        resolve()
      }
    }

    requestAnimationFrame(step)
  })
}

/**
 * Sets the master volume for all sound effects.
 * @param v Volume level from 0 (silent) to 1 (full).
 */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v))

  if (!muted) {
    applyVolumeToAll(volume)
  }
}

/**
 * Sets the ambient music volume.
 * @param v Volume level from 0 (silent) to 1 (full).
 */
export function setAmbientVolume(v: number): void {
  ambientVolume = Math.max(0, Math.min(1, v))
  if (currentAmbient && !muted) {
    currentAmbient.volume = ambientVolume
  }
}

/**
 * Mutes or unmutes all sounds (effects + ambient).
 */
export function setMuted(m: boolean): void {
  muted = m
  applyVolumeToAll(muted ? 0 : volume)
  if (currentAmbient) {
    currentAmbient.volume = muted ? 0 : ambientVolume
  }
}

/**
 * Enables or disables the sound system entirely.
 * When disabled, play() calls are ignored.
 */
export function setEnabled(e: boolean): void {
  enabled = e
  if (!e) stopAmbient()
}

/**
 * Returns the list of all available sound events.
 */
export function getAllSoundEvents(): SoundEvent[] {
  return [...SOUND_EVENTS]
}

/**
 * Returns the list of all ambient sound names.
 */
export function getAllAmbientSounds(): AmbientSound[] {
  return [...AMBIENT_EVENTS]
}

/**
 * Preloads essential sounds (dice and UI) to ensure instant playback.
 * These are the most time-critical sounds that players expect to hear immediately.
 * Call this early in app initialization.
 */
export function preloadEssential(): void {
  const essentialEvents: SoundEvent[] = [
    'dice-d4',
    'dice-d6',
    'dice-d8',
    'dice-d10',
    'dice-d12',
    'dice-d20',
    'dice-d100',
    'dice-roll',
    'nat-20',
    'nat-1',
    'turn-notify',
    'initiative-start'
  ]

  for (const event of essentialEvents) {
    const pool = pools.get(event)
    if (pool) {
      for (const audio of pool) {
        // Trigger a preload by loading metadata
        audio.load()
      }
    }
  }
}

/**
 * Play a custom audio file from an absolute file path.
 * Supports loop and volume options. Tracks the audio element for later stopping.
 * @param filePath Absolute path to the audio file on disk.
 * @param options Playback options (loop, volume).
 */
export function playCustomAudio(
  filePath: string,
  options?: { loop?: boolean; volume?: number }
): void {
  if (!enabled) return

  // Stop any existing playback of this file
  stopCustomAudio(filePath)

  // Convert file path to file:// URL for Audio element
  const fileUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`
  const audio = new Audio(fileUrl)
  audio.loop = options?.loop ?? false
  audio.volume = muted ? 0 : Math.max(0, Math.min(1, options?.volume ?? 1))
  audio.play().catch((err) => {
    console.warn('[SoundManager] Failed to play custom audio:', filePath, err)
  })

  customAudioTracks.set(filePath, audio)
}

/**
 * Stop a custom audio file that is currently playing.
 * @param filePath The file path used when starting playback.
 */
export function stopCustomAudio(filePath: string): void {
  const audio = customAudioTracks.get(filePath)
  if (audio) {
    audio.pause()
    audio.currentTime = 0
    customAudioTracks.delete(filePath)
  }
}

/**
 * Stop all currently playing custom audio tracks.
 */
export function stopAllCustomAudio(): void {
  for (const [key, audio] of customAudioTracks) {
    audio.pause()
    audio.currentTime = 0
    customAudioTracks.delete(key)
  }
}

// --- Internal helpers ---

function applyVolumeToAll(v: number): void {
  for (const pool of pools.values()) {
    for (const audio of pool) {
      audio.volume = v
    }
  }
}
