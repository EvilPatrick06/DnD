// ---------------------------------------------------------------------------
// notification-service.ts — Desktop notification wrapper for D&D VTT game events
// Uses the Web Notification API (available in the Electron renderer process).
// ---------------------------------------------------------------------------

export type NotificationEvent =
  | 'your-turn'
  | 'roll-request'
  | 'whisper'
  | 'ai-response'
  | 'timer-expired'
  | 'combat-start'
  | 'level-up'
  | 'damage-taken'

interface NotificationConfig {
  enabled: boolean
  enabledEvents: Set<NotificationEvent>
  soundEnabled: boolean
  onlyWhenBlurred: boolean
}

// ---- Default content templates per event ----

const DEFAULT_TEMPLATES: Record<NotificationEvent, { title: string; body: string }> = {
  'your-turn': { title: 'Your Turn!', body: "It's your turn in combat" },
  'roll-request': { title: 'Roll Requested', body: '' },
  whisper: { title: 'Whisper', body: '' },
  'ai-response': { title: 'DM Response', body: 'The DM has responded' },
  'timer-expired': { title: "Time's Up!", body: 'Timer expired' },
  'combat-start': { title: 'Roll Initiative!', body: 'Combat has begun' },
  'level-up': { title: 'Level Up!', body: '' },
  'damage-taken': { title: 'Damage!', body: '' }
}

// ---- Persistence helpers ----

const STORAGE_KEY = 'notification-config'

interface SerializedConfig {
  enabled: boolean
  enabledEvents: NotificationEvent[]
  soundEnabled: boolean
  onlyWhenBlurred: boolean
}

function saveConfig(): void {
  try {
    const serialized: SerializedConfig = {
      enabled: config.enabled,
      enabledEvents: Array.from(config.enabledEvents),
      soundEnabled: config.soundEnabled,
      onlyWhenBlurred: config.onlyWhenBlurred
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
  } catch {
    // localStorage may be unavailable; silently ignore
  }
}

function loadConfig(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: SerializedConfig = JSON.parse(raw)
    if (typeof parsed.enabled === 'boolean') config.enabled = parsed.enabled
    if (Array.isArray(parsed.enabledEvents)) {
      config.enabledEvents = new Set(parsed.enabledEvents)
    }
    if (typeof parsed.soundEnabled === 'boolean') config.soundEnabled = parsed.soundEnabled
    if (typeof parsed.onlyWhenBlurred === 'boolean') config.onlyWhenBlurred = parsed.onlyWhenBlurred
  } catch {
    // Corrupt data — keep defaults
  }
}

// ---- Module-level state ----

const config: NotificationConfig = {
  enabled: true,
  enabledEvents: new Set<NotificationEvent>(['your-turn', 'roll-request', 'whisper', 'timer-expired']),
  soundEnabled: false,
  onlyWhenBlurred: true
}

// ---- Public API ----

/** Request notification permission and load persisted config. */
export function init(): void {
  loadConfig()

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {
      // Permission request failed or was dismissed — nothing to do
    })
  }
}

/**
 * Show a desktop notification for a game event.
 *
 * @param event   - The event type that triggered the notification.
 * @param title   - Custom title (overrides the default template title).
 * @param body    - Custom body text. Falls back to the template default if omitted.
 */
export function notify(event: NotificationEvent, title: string, body?: string): void {
  if (!config.enabled) return
  if (!config.enabledEvents.has(event)) return
  if (!isSupported()) return

  // Only fire when the window is blurred (if configured)
  if (config.onlyWhenBlurred && document.hasFocus()) return

  const template = DEFAULT_TEMPLATES[event]
  const finalTitle = title || template.title
  const finalBody = body ?? template.body

  const notification = new Notification(finalTitle, {
    body: finalBody,
    silent: !config.soundEnabled
  })

  // Auto-close after 5 seconds
  const timer = setTimeout(() => {
    notification.close()
  }, 5000)

  // Clear the timer if the user closes or clicks the notification early
  notification.onclose = (): void => {
    clearTimeout(timer)
  }
  notification.onclick = (): void => {
    clearTimeout(timer)
    notification.close()
    // Bring the Electron window to front when clicked
    window.focus()
  }
}

/** Enable or disable notifications for a specific event type. */
export function setEventEnabled(event: NotificationEvent, enabled: boolean): void {
  if (enabled) {
    config.enabledEvents.add(event)
  } else {
    config.enabledEvents.delete(event)
  }
  saveConfig()
}

/** Enable or disable all notifications globally. */
export function setEnabled(enabled: boolean): void {
  config.enabled = enabled
  saveConfig()
}

/** Enable or disable the notification sound. */
export function setSoundEnabled(enabled: boolean): void {
  config.soundEnabled = enabled
  saveConfig()
}

/** Set whether notifications should only appear when the window is not focused. */
export function setOnlyWhenBlurred(only: boolean): void {
  config.onlyWhenBlurred = only
  saveConfig()
}

/** Check if the Notification API is available and permission is granted. */
export function isSupported(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/** Return a shallow copy of the current configuration (for settings UI). */
export function getConfig(): Readonly<NotificationConfig> {
  return {
    enabled: config.enabled,
    enabledEvents: new Set(config.enabledEvents),
    soundEnabled: config.soundEnabled,
    onlyWhenBlurred: config.onlyWhenBlurred
  }
}
