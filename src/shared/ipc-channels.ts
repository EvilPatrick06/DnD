// ============================================================================
// Centralized IPC Channel Definitions
// Shared between main, preload, and renderer processes.
// All IPC channel strings are defined here as constants to prevent typos
// and enable type-safe channel references across the Electron boundary.
// ============================================================================

export const IPC_CHANNELS = {
  // === Storage: Characters ===
  SAVE_CHARACTER: 'storage:save-character',
  LOAD_CHARACTER: 'storage:load-character',
  LOAD_CHARACTERS: 'storage:load-characters',
  DELETE_CHARACTER: 'storage:delete-character',

  // === Storage: Campaigns ===
  SAVE_CAMPAIGN: 'storage:save-campaign',
  LOAD_CAMPAIGN: 'storage:load-campaign',
  LOAD_CAMPAIGNS: 'storage:load-campaigns',
  DELETE_CAMPAIGN: 'storage:delete-campaign',

  // === Storage: Bastions ===
  SAVE_BASTION: 'storage:save-bastion',
  LOAD_BASTION: 'storage:load-bastion',
  LOAD_BASTIONS: 'storage:load-bastions',
  DELETE_BASTION: 'storage:delete-bastion',

  // === Storage: Bans ===
  LOAD_BANS: 'storage:load-bans',
  SAVE_BANS: 'storage:save-bans',

  // === Storage: Game State ===
  SAVE_GAME_STATE: 'storage:save-game-state',
  LOAD_GAME_STATE: 'storage:load-game-state',
  DELETE_GAME_STATE: 'storage:delete-game-state',

  // === File Dialogs ===
  DIALOG_SAVE: 'dialog:show-save',
  DIALOG_OPEN: 'dialog:show-open',

  // === File I/O ===
  FS_READ: 'fs:read-file',
  FS_WRITE: 'fs:write-file',

  // === Window Control ===
  TOGGLE_FULLSCREEN: 'window:toggle-fullscreen',
  IS_FULLSCREEN: 'window:is-fullscreen',
  OPEN_DEVTOOLS: 'window:open-devtools',

  // === AI DM: Configuration ===
  AI_CONFIGURE: 'ai:configure',
  AI_GET_CONFIG: 'ai:get-config',
  AI_CHECK_PROVIDERS: 'ai:check-providers',

  // === AI DM: Index Building ===
  AI_BUILD_INDEX: 'ai:build-index',
  AI_LOAD_INDEX: 'ai:load-index',
  AI_GET_CHUNK_COUNT: 'ai:get-chunk-count',

  // === AI DM: Streaming Chat ===
  AI_CHAT_STREAM: 'ai:chat-stream',
  AI_CANCEL_STREAM: 'ai:cancel-stream',
  AI_APPLY_MUTATIONS: 'ai:apply-mutations',

  // === AI DM: Scene ===
  AI_PREPARE_SCENE: 'ai:prepare-scene',
  AI_GET_SCENE_STATUS: 'ai:get-scene-status',

  // === AI DM: Conversation Persistence ===
  AI_SAVE_CONVERSATION: 'ai:save-conversation',
  AI_LOAD_CONVERSATION: 'ai:load-conversation',
  AI_DELETE_CONVERSATION: 'ai:delete-conversation',

  // === AI DM: Ollama Management ===
  AI_DETECT_OLLAMA: 'ai:detect-ollama',
  AI_GET_VRAM: 'ai:get-vram',
  AI_DOWNLOAD_OLLAMA: 'ai:download-ollama',
  AI_INSTALL_OLLAMA: 'ai:install-ollama',
  AI_START_OLLAMA: 'ai:start-ollama',
  AI_PULL_MODEL: 'ai:pull-model',
  AI_GET_CURATED_MODELS: 'ai:get-curated-models',
  AI_LIST_INSTALLED_MODELS: 'ai:list-installed-models',

  // === AI DM: Memory Files ===
  AI_LIST_MEMORY_FILES: 'ai:list-memory-files',
  AI_READ_MEMORY_FILE: 'ai:read-memory-file',
  AI_CLEAR_MEMORY: 'ai:clear-memory',

  // === AI DM: Connection Status ===
  AI_CONNECTION_STATUS: 'ai:connection-status',
  AI_TOKEN_BUDGET: 'ai:token-budget',
  AI_TOKEN_BUDGET_PREVIEW: 'ai:token-budget-preview',

  // === AI DM: Events (main → renderer) ===
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_STREAM_DONE: 'ai:stream-done',
  AI_STREAM_ERROR: 'ai:stream-error',
  AI_INDEX_PROGRESS: 'ai:index-progress',
  AI_OLLAMA_PROGRESS: 'ai:ollama-progress',

  // === Voice Chat ===
  VOICE_GENERATE_TOKEN: 'voice:generate-token',
  VOICE_GET_SERVER_URL: 'voice:get-server-url',

  // === App Updates ===
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',

  // === Settings ===
  SAVE_SETTINGS: 'storage:save-settings',
  LOAD_SETTINGS: 'storage:load-settings',

  // === App Info ===
  APP_VERSION: 'app:version'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
