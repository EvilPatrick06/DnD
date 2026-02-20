export {}

interface CharacterAPI {
  saveCharacter: (character: Record<string, unknown>) => Promise<{ success: boolean }>
  loadCharacters: () => Promise<Record<string, unknown>[]>
  loadCharacter: (id: string) => Promise<Record<string, unknown> | null>
  deleteCharacter: (id: string) => Promise<boolean>
}

interface CampaignAPI {
  saveCampaign: (campaign: Record<string, unknown>) => Promise<{ success: boolean }>
  loadCampaigns: () => Promise<Record<string, unknown>[]>
  loadCampaign: (id: string) => Promise<Record<string, unknown> | null>
  deleteCampaign: (id: string) => Promise<boolean>
}

interface BastionAPI {
  saveBastion: (bastion: Record<string, unknown>) => Promise<{ success: boolean }>
  loadBastions: () => Promise<Record<string, unknown>[]>
  loadBastion: (id: string) => Promise<Record<string, unknown> | null>
  deleteBastion: (id: string) => Promise<boolean>
}

interface FileDialogOptions {
  title: string
  filters: Array<{ name: string; extensions: string[] }>
}

interface DialogAPI {
  showSaveDialog: (options: FileDialogOptions) => Promise<string | null>
  showOpenDialog: (options: FileDialogOptions) => Promise<string | null>
}

interface BanData {
  peerIds: string[]
  names: string[]
}

interface BanAPI {
  loadBans: (campaignId: string) => Promise<BanData>
  saveBans: (campaignId: string, banData: BanData) => Promise<{ success: boolean }>
}

interface FileAPI {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
}

// AI DM types for preload bridge
interface AiStreamChunkData {
  streamId: string
  text: string
}

interface AiDmAction {
  action: string
  [key: string]: unknown
}

interface AiStreamDoneData {
  streamId: string
  fullText: string
  displayText: string
  statChanges: AiStatChange[]
  dmActions: AiDmAction[]
}

interface AiStreamErrorData {
  streamId: string
  error: string
}

interface AiIndexProgressData {
  percent: number
  stage: string
}

interface AiProviderStatus {
  claude: boolean
  ollama: boolean
  ollamaModels: string[]
}

interface AiConfigData {
  provider: 'claude' | 'ollama'
  model: 'opus' | 'sonnet' | 'haiku'
  apiKey?: string
  ollamaModel?: string
}

interface AiStatChange {
  type: string
  [key: string]: unknown
}

interface AiMutationResult {
  applied: AiStatChange[]
  rejected: Array<{ change: AiStatChange; reason: string }>
}

interface OllamaStatus {
  installed: boolean
  running: boolean
  path?: string
}

interface VramInfo {
  totalMB: number
}

interface CuratedModel {
  id: string
  name: string
  vramMB: number
  desc: string
}

interface OllamaProgressData {
  type: string
  percent: number
}

interface AiAPI {
  configure: (config: AiConfigData) => Promise<{ success: boolean }>
  getConfig: () => Promise<AiConfigData>
  checkProviders: () => Promise<AiProviderStatus>
  buildIndex: () => Promise<{ success: boolean; chunkCount?: number; error?: string }>
  loadIndex: () => Promise<boolean>
  getChunkCount: () => Promise<number>
  prepareScene: (campaignId: string, characterIds: string[]) => Promise<{ success: boolean; streamId?: string | null }>
  getSceneStatus: (
    campaignId: string
  ) => Promise<{ status: 'idle' | 'preparing' | 'ready' | 'error'; streamId: string | null }>
  chatStream: (request: {
    campaignId: string
    message: string
    characterIds: string[]
    senderName?: string
    activeCreatures?: Array<{
      label: string
      currentHP: number
      maxHP: number
      ac: number
      conditions: string[]
      monsterStatBlockId?: string
    }>
    gameState?: string
  }) => Promise<{ success: boolean; streamId?: string; error?: string }>
  cancelStream: (streamId: string) => Promise<{ success: boolean }>
  applyMutations: (characterId: string, changes: AiStatChange[]) => Promise<AiMutationResult>
  saveConversation: (campaignId: string) => Promise<{ success: boolean }>
  loadConversation: (campaignId: string) => Promise<{ success: boolean; data?: unknown }>
  deleteConversation: (campaignId: string) => Promise<{ success: boolean }>
  // Ollama management
  detectOllama: () => Promise<OllamaStatus>
  getVram: () => Promise<VramInfo>
  downloadOllama: () => Promise<{ success: boolean; path?: string; error?: string }>
  installOllama: (installerPath: string) => Promise<{ success: boolean; error?: string }>
  startOllama: () => Promise<{ success: boolean; error?: string }>
  pullModel: (model: string) => Promise<{ success: boolean; error?: string }>
  getCuratedModels: () => Promise<CuratedModel[]>
  listInstalledModels: () => Promise<string[]>
  getTokenBudget: () => Promise<{
    rulebookChunks: number
    srdData: number
    characterData: number
    campaignData: number
    creatures: number
    gameState: number
    memory: number
    total: number
  } | null>
  previewTokenBudget: (
    campaignId: string,
    characterIds: string[]
  ) => Promise<{
    rulebookChunks: number
    srdData: number
    characterData: number
    campaignData: number
    creatures: number
    gameState: number
    memory: number
    total: number
  } | null>
  // Memory files
  listMemoryFiles: (campaignId: string) => Promise<Array<{ name: string; size: number }>>
  readMemoryFile: (campaignId: string, fileName: string) => Promise<string>
  clearMemory: (campaignId: string) => Promise<void>
  // Event listeners
  onStreamChunk: (cb: (data: AiStreamChunkData) => void) => void
  onStreamDone: (cb: (data: AiStreamDoneData) => void) => void
  onStreamError: (cb: (data: AiStreamErrorData) => void) => void
  onIndexProgress: (cb: (data: AiIndexProgressData) => void) => void
  onOllamaProgress: (cb: (data: OllamaProgressData) => void) => void
  removeAllAiListeners: () => void
}

interface WindowAPI {
  toggleFullscreen: () => Promise<boolean>
  isFullscreen: () => Promise<boolean>
  openDevTools: () => Promise<void>
}

interface UpdateStatusData {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

interface UpdateAPI {
  checkForUpdates: () => Promise<UpdateStatusData>
  downloadUpdate: () => Promise<UpdateStatusData>
  installUpdate: () => Promise<void>
  onStatus: (cb: (status: UpdateStatusData) => void) => void
  removeStatusListener: () => void
}

interface RTCIceServerConfig {
  urls: string | string[]
  username?: string
  credential?: string
}

interface AppSettingsData {
  turnServers?: RTCIceServerConfig[]
}

interface SettingsAPI {
  saveSettings: (settings: AppSettingsData) => Promise<{ success: boolean }>
  loadSettings: () => Promise<AppSettingsData>
}

interface AudioUploadResult {
  fileName: string
  displayName: string
  category: string
}

interface AudioPickResult {
  fileName: string
  buffer: ArrayBuffer
}

interface AudioAPI {
  audioUploadCustom: (
    campaignId: string,
    fileName: string,
    buffer: ArrayBuffer,
    displayName: string,
    category: string
  ) => Promise<{ success: boolean; data?: AudioUploadResult; error?: string }>
  audioListCustom: (campaignId: string) => Promise<{ success: boolean; data?: string[]; error?: string }>
  audioDeleteCustom: (
    campaignId: string,
    fileName: string
  ) => Promise<{ success: boolean; error?: string }>
  audioGetCustomPath: (
    campaignId: string,
    fileName: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>
  audioPickFile: () => Promise<{ success: boolean; data?: AudioPickResult; error?: string }>
}

interface VoiceTokenOptions {
  roomName: string
  participantName: string
  participantId: string
  mode: 'local' | 'cloud'
  apiKey?: string
  apiSecret?: string
}

interface VoiceTokenResult {
  token: string
  serverUrl: string
}

interface VoiceChatAPI {
  voiceGenerateToken: (options: VoiceTokenOptions) => Promise<{
    success: boolean
    data?: VoiceTokenResult
    error?: string
  }>
  voiceGetServerUrl: (mode: 'local' | 'cloud', serverUrl?: string) => Promise<{
    success: boolean
    data?: string
  }>
}

declare global {
  interface Window {
    api: CharacterAPI &
      CampaignAPI &
      BastionAPI &
      DialogAPI &
      BanAPI &
      FileAPI &
      WindowAPI &
      SettingsAPI &
      AudioAPI &
      VoiceChatAPI & {
        ai: AiAPI
        update: UpdateAPI
        getVersion: () => Promise<string>
      }
  }
}
