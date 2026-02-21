import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, safeStorage } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { saveConversation } from '../storage/aiConversationStorage'
import { buildChunkIndex, loadChunkIndex } from './chunk-builder'
import {
  claudeChatOnce,
  claudeStreamChat,
  initClaudeClient,
  isClaudeConfigured,
  testClaudeConnection
} from './claude-client'
import { buildContext, setSearchEngine } from './context-builder'
import { getMemoryManager } from './memory-manager'
import { ConversationManager } from './conversation-manager'
import { parseDmActions, stripDmActions } from './dm-actions'
import {
  FILE_READ_MAX_DEPTH,
  formatFileContent,
  hasFileReadTag,
  parseFileRead,
  readRequestedFile,
  stripFileRead
} from './file-reader'
import { hasWebSearchTag, parseWebSearch, performWebSearch, formatSearchResults, stripWebSearch } from './web-search'
import { isOllamaRunning, listOllamaModels, ollamaChatOnce, ollamaStreamChat } from './ollama-client'
import { SearchEngine } from './search-engine'
import { applyMutations, describeChange, isNegativeChange, parseStatChanges, stripStatChanges } from './stat-mutations'
import { cleanNarrativeText, hasViolations } from './tone-validator'
import type {
  AiChatRequest,
  AiConfig,
  DmActionData,
  ModelChoice,
  ProviderChoice,
  ProviderStatus,
  StatChange
} from './types'

// Per-campaign conversation managers
const conversations = new Map<string, ConversationManager>()

// Active stream abort controllers
const activeStreams = new Map<string, AbortController>()

// Scene preparation status per campaign
const scenePrepStatus = new Map<string, { status: 'preparing' | 'ready' | 'error'; streamId: string | null }>()

// ── AI Retry & Connection Status ──

let consecutiveFailures = 0
const MAX_RETRY_DELAY_MS = 30_000
const FALLBACK_THRESHOLD = 3 // Auto-switch to Ollama after N Claude failures

export type AiConnectionStatus = 'connected' | 'degraded' | 'disconnected'

export function getConnectionStatus(): AiConnectionStatus {
  if (consecutiveFailures === 0) return 'connected'
  if (consecutiveFailures < FALLBACK_THRESHOLD) return 'degraded'
  return 'disconnected'
}

export function getConsecutiveFailures(): number {
  return consecutiveFailures
}

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
  return Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamWithRetry(
  streamFn: (signal: AbortSignal) => Promise<void>,
  abortController: AbortController,
  onError: (error: string) => void
): Promise<void> {
  const maxRetries = 2 // Total 3 attempts (1 initial + 2 retries)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortController.signal.aborted) return
    try {
      await streamFn(abortController.signal)
      consecutiveFailures = 0 // Success resets counter
      return
    } catch (error) {
      consecutiveFailures++
      const msg = error instanceof Error ? error.message : String(error)

      // Don't retry on abort or auth errors
      if (abortController.signal.aborted) return
      if (msg.includes('401') || msg.includes('403') || msg.includes('API key')) {
        onError(msg)
        return
      }

      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt)
        await sleep(delay)
      } else {
        // Auto-fallback: if Claude fails N times, suggest Ollama
        if (currentConfig.provider === 'claude' && consecutiveFailures >= FALLBACK_THRESHOLD) {
          onError(`Claude API failed after ${consecutiveFailures} attempts. Consider switching to Ollama.`)
        } else {
          onError(msg)
        }
      }
    }
  }
}

// Current config
let currentConfig: {
  provider: ProviderChoice
  model: ModelChoice
  ollamaModel: string
} = {
  provider: 'ollama',
  model: 'sonnet',
  ollamaModel: 'llama3.1'
}

let searchEngine: SearchEngine | null = null
let streamCounter = 0

function getConfigPath(): string {
  return join(app.getPath('userData'), 'ai-config.json')
}

function getApiKeyPath(): string {
  return join(app.getPath('userData'), 'ai-api-key.bin')
}

// ── Config Management ──

export function configure(config: AiConfig): void {
  currentConfig = {
    provider: config.provider,
    model: config.model,
    ollamaModel: config.ollamaModel || 'llama3.1'
  }

  // Save non-sensitive config
  const configPath = getConfigPath()
  writeFileSync(
    configPath,
    JSON.stringify({
      provider: currentConfig.provider,
      model: currentConfig.model,
      ollamaModel: currentConfig.ollamaModel
    })
  )

  // Save API key encrypted
  if (config.apiKey) {
    saveApiKey(config.apiKey)
    initClaudeClient(config.apiKey)
  }
}

export function getConfig(): AiConfig {
  // Load from disk if not yet loaded
  const configPath = getConfigPath()
  if (existsSync(configPath)) {
    try {
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
      currentConfig = {
        provider: saved.provider || 'ollama',
        model: saved.model || 'sonnet',
        ollamaModel: saved.ollamaModel || 'llama3.1'
      }
    } catch {
      // Use defaults
    }
  }

  return {
    provider: currentConfig.provider,
    model: currentConfig.model,
    ollamaModel: currentConfig.ollamaModel
  }
}

function saveApiKey(key: string): void {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key)
      writeFileSync(getApiKeyPath(), encrypted)
    } else {
      // Fallback: store plaintext (dev mode)
      writeFileSync(getApiKeyPath(), key, 'utf-8')
    }
  } catch (err) {
    console.error('Failed to save API key:', err)
  }
}

function loadApiKey(): string | null {
  const keyPath = getApiKeyPath()
  if (!existsSync(keyPath)) return null

  try {
    const raw = readFileSync(keyPath)
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(raw)
    }
    return raw.toString('utf-8')
  } catch {
    return null
  }
}

/** Initialize the Claude client from saved API key and auto-load chunk index. */
export function initFromSavedConfig(): void {
  getConfig() // Load config from disk
  const apiKey = loadApiKey()
  if (apiKey && currentConfig.provider === 'claude') {
    initClaudeClient(apiKey)
  }

  // Auto-load pre-built chunk index so it's ready when any campaign starts
  loadIndex()
}

// ── Provider Status ──

export async function checkProviders(): Promise<ProviderStatus> {
  const apiKey = loadApiKey()
  const claudeOk = apiKey ? await testClaudeConnection(apiKey) : false
  const ollamaOk = await isOllamaRunning()
  const ollamaModels = ollamaOk ? await listOllamaModels() : []

  return { claude: claudeOk, ollama: ollamaOk, ollamaModels }
}

// ── Index Management ──

export function buildIndex(onProgress?: (percent: number, stage: string) => void): { chunkCount: number } {
  const index = buildChunkIndex(onProgress)
  searchEngine = new SearchEngine()
  searchEngine.load(index)
  setSearchEngine(searchEngine)
  return { chunkCount: index.chunks.length }
}

export function loadIndex(): boolean {
  const index = loadChunkIndex()
  if (!index) return false

  searchEngine = new SearchEngine()
  searchEngine.load(index)
  setSearchEngine(searchEngine)
  return true
}

export function getChunkCount(): number {
  return searchEngine?.getChunkCount() ?? 0
}

// ── Conversation Management ──

function getConversation(campaignId: string): ConversationManager {
  let conv = conversations.get(campaignId)
  if (!conv) {
    conv = new ConversationManager()
    conv.setSummarizeCallback(async (text) => {
      return await chatOnce(
        'You are a conversation summarizer. Summarize the following D&D conversation concisely, preserving key facts, decisions, NPC names, locations, and combat outcomes. Keep it under 200 words.',
        text
      )
    })
    conversations.set(campaignId, conv)
  }
  return conv
}

export function getConversationManager(campaignId: string): ConversationManager {
  return getConversation(campaignId)
}

// ── Chat ──

export interface StreamResult {
  streamId: string
  promise: Promise<{
    fullText: string
    displayText: string
    statChanges: StatChange[]
    dmActions: DmActionData[]
  }>
}

export function startChat(
  request: AiChatRequest,
  onChunk: (text: string) => void,
  onDone: (fullText: string, displayText: string, statChanges: StatChange[], dmActions: DmActionData[]) => void,
  onError: (error: string) => void
): string {
  const streamId = `stream-${++streamCounter}`
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  const conv = getConversation(request.campaignId)
  conv.setActiveCharacterIds(request.characterIds)

  // Add user message
  const userContent = request.senderName ? `[${request.senderName}]: ${request.message}` : request.message
  conv.addMessage('user', userContent)

  // Run async
  ;(async () => {
    try {
      // Build context (includes campaign data + active creatures + game state)
      const context = await buildContext(
        request.message,
        request.characterIds,
        request.campaignId,
        request.activeCreatures,
        request.gameState
      )
      const providerContext =
        currentConfig.provider === 'ollama'
          ? '\n\n[PROVIDER CONTEXT]\nYou are running 100% locally on the user\'s computer via Ollama. All processing happens on their hardware — no data is sent to any remote server. You are NOT a cloud-based AI. If asked, confirm you run locally. You have no internet access unless you use the [WEB_SEARCH] action.\n[/PROVIDER CONTEXT]'
          : ''
      const { systemPrompt, messages } = await conv.getMessagesForApi(context + providerContext)

      // Stream response
      let fullText = ''

      const callbacks = {
        onText: (text: string) => {
          fullText += text
          onChunk(text)
        },
        onDone: (text: string) => {
          fullText = text
          activeStreams.delete(streamId)

          // Handle file read recursion
          handleStreamCompletion(
            fullText,
            request,
            conv,
            streamId,
            abortController,
            onChunk,
            onDone,
            onError,
            0
          )
        },
        onError: (error: Error) => {
          activeStreams.delete(streamId)
          onError(error.message)
        }
      }

      if (currentConfig.provider === 'claude') {
        if (!isClaudeConfigured()) {
          const apiKey = loadApiKey()
          if (apiKey) initClaudeClient(apiKey)
          else {
            onError('Claude API key not configured')
            return
          }
        }
        await streamWithRetry(
          (signal) => claudeStreamChat(systemPrompt, messages, callbacks, currentConfig.model, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      } else {
        await streamWithRetry(
          (signal) => ollamaStreamChat(systemPrompt, messages, callbacks, currentConfig.ollamaModel, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      }
    } catch (error) {
      activeStreams.delete(streamId)
      onError(error instanceof Error ? error.message : String(error))
    }
  })()

  return streamId
}

/**
 * Handle AI stream completion — checks for [FILE_READ] and [WEB_SEARCH] tags,
 * processes them recursively, then finalizes the response.
 */
async function handleStreamCompletion(
  fullText: string,
  request: AiChatRequest,
  conv: ConversationManager,
  streamId: string,
  abortController: AbortController,
  onChunk: (text: string) => void,
  onDone: (fullText: string, displayText: string, statChanges: StatChange[], dmActions: DmActionData[]) => void,
  onError: (error: string) => void,
  fileReadDepth: number
): Promise<void> {
  // Check for file read tag
  if (hasFileReadTag(fullText) && fileReadDepth < FILE_READ_MAX_DEPTH) {
    const fileReq = parseFileRead(fullText)
    if (fileReq) {
      // Notify renderer of file read status
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send(IPC_CHANNELS.AI_STREAM_FILE_READ, {
          streamId,
          path: fileReq.path,
          status: 'reading'
        })
      }

      const result = await readRequestedFile(fileReq.path)
      const fileContent = formatFileContent(result)

      // Strip the FILE_READ tag from display text
      const strippedText = stripFileRead(fullText)

      // Inject file content as a synthetic user message and continue conversation
      conv.addMessage('assistant', strippedText)
      conv.addMessage('user', fileContent)

      // Re-stream with the file content injected
      activeStreams.set(streamId, abortController)
      let nextFullText = ''
      const { systemPrompt: sp, messages: msgs } = await conv.getMessagesForApi('')

      const nextCallbacks = {
        onText: (text: string) => {
          nextFullText += text
          onChunk(text)
        },
        onDone: (text: string) => {
          nextFullText = text
          activeStreams.delete(streamId)
          handleStreamCompletion(
            nextFullText,
            request,
            conv,
            streamId,
            abortController,
            onChunk,
            onDone,
            onError,
            fileReadDepth + 1
          )
        },
        onError: (error: Error) => {
          activeStreams.delete(streamId)
          onError(error.message)
        }
      }

      if (currentConfig.provider === 'claude') {
        await streamWithRetry(
          (signal) => claudeStreamChat(sp, msgs, nextCallbacks, currentConfig.model, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      } else {
        await streamWithRetry(
          (signal) => ollamaStreamChat(sp, msgs, nextCallbacks, currentConfig.ollamaModel, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      }
      return
    }
  }

  // Check for web search tag
  if (hasWebSearchTag(fullText) && fileReadDepth < FILE_READ_MAX_DEPTH) {
    const searchReq = parseWebSearch(fullText)
    if (searchReq) {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send(IPC_CHANNELS.AI_STREAM_WEB_SEARCH, {
          streamId,
          query: searchReq.query,
          status: 'searching'
        })
      }

      const results = await performWebSearch(searchReq.query)
      const searchContent = formatSearchResults(searchReq.query, results)

      // Strip the WEB_SEARCH tag from display text
      const strippedText = stripWebSearch(fullText)

      // Inject search results and continue
      conv.addMessage('assistant', strippedText)
      conv.addMessage('user', searchContent)

      activeStreams.set(streamId, abortController)
      let nextFullText = ''
      const { systemPrompt: sp, messages: msgs } = await conv.getMessagesForApi('')

      const nextCallbacks = {
        onText: (text: string) => {
          nextFullText += text
          onChunk(text)
        },
        onDone: (text: string) => {
          nextFullText = text
          activeStreams.delete(streamId)
          handleStreamCompletion(
            nextFullText,
            request,
            conv,
            streamId,
            abortController,
            onChunk,
            onDone,
            onError,
            fileReadDepth + 1
          )
        },
        onError: (error: Error) => {
          activeStreams.delete(streamId)
          onError(error.message)
        }
      }

      if (currentConfig.provider === 'claude') {
        await streamWithRetry(
          (signal) => claudeStreamChat(sp, msgs, nextCallbacks, currentConfig.model, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      } else {
        await streamWithRetry(
          (signal) => ollamaStreamChat(sp, msgs, nextCallbacks, currentConfig.ollamaModel, signal),
          abortController,
          (errMsg) => {
            activeStreams.delete(streamId)
            onError(errMsg)
          }
        )
      }
      return
    }
  }

  // No special tags — finalize response
  try {
    let cleaned = fullText
    if (hasViolations(cleaned)) {
      cleaned = cleanNarrativeText(cleaned)
    }

    const statChanges = parseStatChanges(cleaned)
    const dmActions = parseDmActions(cleaned)
    const displayText = stripDmActions(stripStatChanges(cleaned))

    conv.addMessage('assistant', displayText)

    saveConversation(request.campaignId, conv.serialize()).catch((err) =>
      console.error('[AI] Failed to auto-save conversation:', err)
    )

    try {
      const memMgr = getMemoryManager(request.campaignId)
      const sessionId = new Date().toISOString().slice(0, 10)
      const logEntry = `[${request.senderName ?? 'Player'}]: ${request.message}\n[AI DM]: ${displayText.slice(0, 500)}`
      memMgr.appendSessionLog(sessionId, logEntry).catch(() => {})
    } catch {
      // Non-fatal
    }

    onDone(cleaned, displayText, statChanges, dmActions)
  } catch (err) {
    console.error('[AI] Error parsing AI response, delivering raw text:', err)
    conv.addMessage('assistant', fullText)
    onDone(fullText, fullText, [], [])
  }
}

export function cancelChat(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}

/** Non-streaming chat for summarization and world state extraction. */
async function chatOnce(systemPrompt: string, userMessage: string): Promise<string> {
  const messages = [{ role: 'user' as const, content: userMessage }]

  if (currentConfig.provider === 'claude') {
    if (!isClaudeConfigured()) {
      const apiKey = loadApiKey()
      if (apiKey) initClaudeClient(apiKey)
      else throw new Error('Claude API key not configured')
    }
    return await claudeChatOnce(systemPrompt, messages, 'haiku')
  } else {
    return await ollamaChatOnce(systemPrompt, messages, currentConfig.ollamaModel)
  }
}

// ── Scene Preparation ──

export function prepareScene(campaignId: string, characterIds: string[]): string | null {
  // Don't re-prepare if already done or in progress
  const existing = scenePrepStatus.get(campaignId)
  if (existing && (existing.status === 'preparing' || existing.status === 'ready')) return existing.streamId

  // Also skip if conversation already has messages (returning game)
  const conv = getConversation(campaignId)
  if (conv.getMessageCount() > 0) {
    scenePrepStatus.set(campaignId, { status: 'ready', streamId: null })
    return null
  }

  // Use existing startChat with scene prompt
  const request: AiChatRequest = {
    campaignId,
    message: 'The adventure begins. Set the scene for the party. Describe the opening location and atmosphere.',
    characterIds
  }

  const streamId = startChat(
    request,
    () => {}, // onChunk — no renderer listener during lobby prep
    (_fullText, _displayText, _statChanges, _dmActions) => {
      scenePrepStatus.set(campaignId, { status: 'ready', streamId: null })
    },
    (_error) => {
      scenePrepStatus.set(campaignId, { status: 'error', streamId: null })
    }
  )

  scenePrepStatus.set(campaignId, { status: 'preparing', streamId })
  return streamId
}

export function getSceneStatus(campaignId: string): {
  status: 'idle' | 'preparing' | 'ready' | 'error'
  streamId: string | null
} {
  return scenePrepStatus.get(campaignId) ?? { status: 'idle', streamId: null }
}

// ── Session Summary ──

/**
 * Generate an end-of-session summary for a campaign.
 * Uses the conversation manager's summarize callback.
 */
export async function generateSessionSummary(campaignId: string): Promise<string | null> {
  const conv = getConversation(campaignId)
  const summary = await conv.generateSessionSummary()

  // Also save to memory manager
  if (summary) {
    try {
      const memMgr = getMemoryManager(campaignId)
      const sessionId = new Date().toISOString().slice(0, 10)
      await memMgr.appendSessionLog(sessionId, `\n--- SESSION SUMMARY ---\n${summary}\n`)
    } catch {
      // Non-fatal
    }
  }

  return summary
}

/**
 * Check if the AI context was truncated in the last call.
 * Returns true if the DM should be alerted that context was compressed.
 */
export function wasContextTruncated(campaignId: string): boolean {
  const conv = conversations.get(campaignId)
  return conv?.contextWasTruncated ?? false
}

/**
 * Get estimated token usage for the last AI call.
 */
export function getLastTokenEstimate(campaignId: string): number {
  const conv = conversations.get(campaignId)
  return conv?.lastTokenEstimate ?? 0
}

// Re-export mutation functions
export { applyMutations, describeChange, isNegativeChange }
