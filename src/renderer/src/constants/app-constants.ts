// Network: client-manager
export const CONNECTION_TIMEOUT_MS = 15000
export const RECONNECT_DELAY_MS = 2000
export const MAX_RECONNECT_RETRIES = 5
export const BASE_RETRY_MS = 1000
export const MAX_RETRY_MS = 30_000

// Network: host-manager
export const MESSAGE_SIZE_LIMIT = 65536
export const FILE_SIZE_LIMIT = 8 * 1024 * 1024
export const MAX_DISPLAY_NAME_LENGTH = 32
export const RATE_LIMIT_WINDOW_MS = 1000
export const MAX_MESSAGES_PER_WINDOW = 10
export const MAX_RECONNECT_ATTEMPTS = 5
export const JOIN_TIMEOUT_MS = 10_000
export const KICK_DELAY_MS = 100

// Global rate limiting
export const MAX_GLOBAL_MESSAGES_PER_SECOND = 200

// Chat
export const MAX_CHAT_LENGTH = 2000

// IPC file size limits
export const MAX_READ_FILE_SIZE = 50 * 1024 * 1024 // 50 MB (maps)
export const MAX_WRITE_CONTENT_SIZE = 10 * 1024 * 1024 // 10 MB (data files)

// Voice: voice-manager
export const VAD_THRESHOLD = 30
export const VAD_CHECK_INTERVAL_MS = 100
export const VOICE_RETRY_COUNT = 10
export const VOICE_RETRY_INTERVAL_MS = 1000

// UI: pages
export const LOADING_GRACE_PERIOD_MS = 4000
export const LOBBY_COPY_TIMEOUT_MS = 2000

// Peer: peer-manager
export const PEER_CREATION_TIMEOUT_MS = 15000
export const INVITE_CODE_LENGTH = 6

// Session persistence (player rejoin)
export const LAST_SESSION_KEY = 'dnd-vtt-last-session'
export const JOINED_SESSIONS_KEY = 'dnd-vtt-joined-sessions'
export const AUTO_REJOIN_KEY = 'dnd-vtt-auto-rejoin'

// Heartbeat
export const HEARTBEAT_INTERVAL_MS = 15_000
export const HEARTBEAT_TIMEOUT_MS = 45_000
export const HEARTBEAT_REMOVE_MS = 120_000
