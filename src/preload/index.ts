import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const api = {
  // Character storage
  saveCharacter: (character: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CHARACTER, character),
  loadCharacters: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CHARACTERS),
  loadCharacter: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CHARACTER, id),
  deleteCharacter: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CHARACTER, id),
  listCharacterVersions: (id: string) => ipcRenderer.invoke('storage:character-versions', id),
  restoreCharacterVersion: (id: string, fileName: string) =>
    ipcRenderer.invoke('storage:character-restore-version', id, fileName),

  // Campaign storage
  saveCampaign: (campaign: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_CAMPAIGN, campaign),
  loadCampaigns: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CAMPAIGNS),
  loadCampaign: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CAMPAIGN, id),
  deleteCampaign: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CAMPAIGN, id),

  // Bastion storage
  saveBastion: (bastion: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_BASTION, bastion),
  loadBastions: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_BASTIONS),
  loadBastion: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_BASTION, id),
  deleteBastion: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_BASTION, id),

  // Custom creature storage
  saveCustomCreature: (creature: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CUSTOM_CREATURE, creature),
  loadCustomCreatures: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CUSTOM_CREATURES),
  loadCustomCreature: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CUSTOM_CREATURE, id),
  deleteCustomCreature: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOM_CREATURE, id),

  // Homebrew storage
  saveHomebrew: (entry: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_HOMEBREW, entry),
  loadHomebrewByCategory: (category: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_HOMEBREW_BY_CATEGORY, category),
  loadAllHomebrew: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_ALL_HOMEBREW),
  deleteHomebrew: (category: string, id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_HOMEBREW, category, id),

  // File dialogs
  showSaveDialog: (options: { title: string; filters: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE, options),
  showOpenDialog: (options: { title: string; filters: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN, options),

  // Game state storage
  saveGameState: (campaignId: string, state: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_GAME_STATE, campaignId, state),
  loadGameState: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_GAME_STATE, campaignId),
  deleteGameState: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_GAME_STATE, campaignId),

  // Ban storage
  loadBans: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_BANS, campaignId),
  saveBans: (campaignId: string, banData: { peerIds: string[]; names: string[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_BANS, campaignId, banData),

  // File I/O
  readFile: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ, path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE, path, content),

  // Window controls
  toggleFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FULLSCREEN),
  isFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.IS_FULLSCREEN),
  openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DEVTOOLS),

  // AI DM
  ai: {
    configure: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.AI_CONFIGURE, config),
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONFIG),
    checkProviders: () => ipcRenderer.invoke(IPC_CHANNELS.AI_CHECK_PROVIDERS),
    buildIndex: () => ipcRenderer.invoke(IPC_CHANNELS.AI_BUILD_INDEX),
    loadIndex: () => ipcRenderer.invoke(IPC_CHANNELS.AI_LOAD_INDEX),
    getChunkCount: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CHUNK_COUNT),
    prepareScene: (campaignId: string, characterIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_PREPARE_SCENE, campaignId, characterIds),
    getSceneStatus: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_SCENE_STATUS, campaignId),
    chatStream: (request: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_STREAM, request),
    cancelStream: (streamId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_STREAM, streamId),
    applyMutations: (characterId: string, changes: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_APPLY_MUTATIONS, characterId, changes),
    saveConversation: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_CONVERSATION, campaignId),
    loadConversation: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_LOAD_CONVERSATION, campaignId),
    deleteConversation: (campaignId: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_DELETE_CONVERSATION, campaignId),
    // Ollama management
    detectOllama: () => ipcRenderer.invoke(IPC_CHANNELS.AI_DETECT_OLLAMA),
    getVram: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_VRAM),
    downloadOllama: () => ipcRenderer.invoke(IPC_CHANNELS.AI_DOWNLOAD_OLLAMA),
    installOllama: (installerPath: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_INSTALL_OLLAMA, installerPath),
    startOllama: () => ipcRenderer.invoke(IPC_CHANNELS.AI_START_OLLAMA),
    pullModel: (model: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_PULL_MODEL, model),
    getCuratedModels: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CURATED_MODELS),
    listInstalledModels: () => ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_INSTALLED_MODELS),
    listInstalledModelsDetailed: () => ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_INSTALLED_MODELS_DETAILED),
    checkOllamaUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.AI_OLLAMA_CHECK_UPDATE),
    updateOllama: () => ipcRenderer.invoke(IPC_CHANNELS.AI_OLLAMA_UPDATE),
    deleteModel: (model: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_DELETE_MODEL, model),
    getTokenBudget: () => ipcRenderer.invoke(IPC_CHANNELS.AI_TOKEN_BUDGET),
    previewTokenBudget: (campaignId: string, characterIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_TOKEN_BUDGET_PREVIEW, campaignId, characterIds),
    // Memory files
    listMemoryFiles: (campaignId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_MEMORY_FILES, campaignId),
    readMemoryFile: (campaignId: string, fileName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_READ_MEMORY_FILE, campaignId, fileName),
    clearMemory: (campaignId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CLEAR_MEMORY, campaignId),
    // Event listeners (main → renderer)
    onStreamChunk: (cb: (data: { streamId: string; text: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, (_e, data) => cb(data))
    },
    onStreamDone: (
      cb: (data: {
        streamId: string
        fullText: string
        displayText: string
        statChanges: unknown[]
        dmActions: unknown[]
      }) => void
    ) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_DONE, (_e, data) => cb(data))
    },
    onStreamError: (cb: (data: { streamId: string; error: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_ERROR, (_e, data) => cb(data))
    },
    onIndexProgress: (cb: (data: { percent: number; stage: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_INDEX_PROGRESS, (_e, data) => cb(data))
    },
    onOllamaProgress: (cb: (data: { type: string; percent: number }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_OLLAMA_PROGRESS, (_e, data) => cb(data))
    },
    onStreamFileRead: (cb: (data: { streamId: string; path: string; status: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_FILE_READ, (_e, data) => cb(data))
    },
    onStreamWebSearch: (cb: (data: { streamId: string; query: string; status: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_WEB_SEARCH, (_e, data) => cb(data))
    },
    approveWebSearch: (streamId: string, approved: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_WEB_SEARCH_APPROVE, streamId, approved),
    removeAllAiListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_CHUNK)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_DONE)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_ERROR)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_INDEX_PROGRESS)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_OLLAMA_PROGRESS)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_FILE_READ)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_WEB_SEARCH)
    }
  },

  // App updates
  update: {
    checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
    onStatus: (cb: (status: { state: string; version?: string; percent?: number; message?: string }) => void) => {
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, (_e, status) => cb(status))
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_STATUS)
    }
  },

  // Auto-update

  // Settings
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SETTINGS),

  // Audio
  audioUploadCustom: (
    campaignId: string,
    fileName: string,
    buffer: ArrayBuffer,
    displayName: string,
    category: string
  ) => ipcRenderer.invoke('audio:upload-custom', campaignId, fileName, buffer, displayName, category),
  audioListCustom: (campaignId: string) => ipcRenderer.invoke('audio:list-custom', campaignId),
  audioDeleteCustom: (campaignId: string, fileName: string) =>
    ipcRenderer.invoke('audio:delete-custom', campaignId, fileName),
  audioGetCustomPath: (campaignId: string, fileName: string) =>
    ipcRenderer.invoke('audio:get-custom-path', campaignId, fileName),
  audioPickFile: () => ipcRenderer.invoke('audio:pick-file'),

  // Voice chat
  voiceGenerateToken: (options: {
    roomName: string
    participantName: string
    participantId: string
    mode: 'local' | 'cloud'
    apiKey?: string
    apiSecret?: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.VOICE_GENERATE_TOKEN, options),
  voiceGetServerUrl: (mode: 'local' | 'cloud', serverUrl?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_GET_SERVER_URL, mode, serverUrl),

  // App info
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as unknown as Record<string, unknown>).api = api
}
