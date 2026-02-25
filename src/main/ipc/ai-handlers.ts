import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { AiChatRequestSchema, AiConfigSchema } from '../../shared/ipc-schemas'
import * as aiService from '../ai/ai-service'
import { buildContext, getLastTokenBreakdown } from '../ai/context-builder'
import {
  CURATED_MODELS,
  checkOllamaUpdate,
  deleteModel,
  detectOllama,
  downloadOllama,
  getSystemVram,
  installOllama,
  listInstalledModels,
  listInstalledModelsDetailed,
  pullModel,
  startOllama,
  updateOllama
} from '../ai/ollama-manager'
import type { AiChatRequest, AiConfig, StatChange } from '../ai/types'
import { deleteConversation, loadConversation, saveConversation } from '../storage/ai-conversation-storage'

export function registerAiHandlers(): void {
  // ── Configuration ──

  ipcMain.handle(IPC_CHANNELS.AI_CONFIGURE, async (_event, config: AiConfig) => {
    const parsed = AiConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: `Invalid config: ${parsed.error.issues[0]?.message}` }
    }
    aiService.configure(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_CONFIG, async () => {
    return aiService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHECK_PROVIDERS, async () => {
    return await aiService.checkProviders()
  })

  // ── Index Building ──

  ipcMain.handle(IPC_CHANNELS.AI_BUILD_INDEX, async (event) => {
    if (app.isPackaged) {
      return {
        success: false,
        error:
          'Rebuilding the rulebook index is disabled in packaged builds. The bundled index is loaded automatically.'
      }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      const result = aiService.buildIndex((percent, stage) => {
        win?.webContents.send(IPC_CHANNELS.AI_INDEX_PROGRESS, { percent, stage })
      })
      return { success: true, chunkCount: result.chunkCount }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LOAD_INDEX, async () => {
    return aiService.loadIndex()
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_CHUNK_COUNT, async () => {
    return aiService.getChunkCount()
  })

  // ── Streaming Chat ──

  ipcMain.handle(IPC_CHANNELS.AI_CHAT_STREAM, async (event, request: AiChatRequest) => {
    const parsed = AiChatRequestSchema.safeParse(request)
    if (!parsed.success) {
      return { success: false, error: `Invalid request: ${parsed.error.issues[0]?.message}` }
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'No window found' }

    const streamId = aiService.startChat(
      request,
      // onChunk
      (text) => {
        win.webContents.send(IPC_CHANNELS.AI_STREAM_CHUNK, { streamId, text })
      },
      // onDone
      (fullText, displayText, statChanges, dmActions) => {
        win.webContents.send(IPC_CHANNELS.AI_STREAM_DONE, { streamId, fullText, displayText, statChanges, dmActions })
      },
      // onError
      (error) => {
        win.webContents.send(IPC_CHANNELS.AI_STREAM_ERROR, { streamId, error })
      }
    )

    return { success: true, streamId }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CANCEL_STREAM, async (_event, streamId: string) => {
    aiService.cancelChat(streamId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_WEB_SEARCH_APPROVE, async (_event, streamId: string, approved: boolean) => {
    if (typeof streamId !== 'string') {
      return { success: false, error: 'Invalid streamId' }
    }
    if (typeof approved !== 'boolean') {
      return { success: false, error: 'Invalid approval value' }
    }
    return aiService.approveWebSearch(streamId, approved)
  })

  // ── Stat Mutations ──

  ipcMain.handle(IPC_CHANNELS.AI_APPLY_MUTATIONS, async (_event, characterId: string, changes: StatChange[]) => {
    return await aiService.applyMutations(characterId, changes)
  })

  // ── Scene Preparation ──

  ipcMain.handle(IPC_CHANNELS.AI_PREPARE_SCENE, async (_event, campaignId: string, characterIds: string[]) => {
    const streamId = aiService.prepareScene(campaignId, characterIds)
    return { success: true, streamId }
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_SCENE_STATUS, async (_event, campaignId: string) => {
    return aiService.getSceneStatus(campaignId)
  })

  ipcMain.handle(IPC_CHANNELS.AI_CONNECTION_STATUS, async () => {
    return {
      status: aiService.getConnectionStatus(),
      consecutiveFailures: aiService.getConsecutiveFailures()
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_TOKEN_BUDGET, async () => {
    return getLastTokenBreakdown()
  })

  ipcMain.handle(IPC_CHANNELS.AI_TOKEN_BUDGET_PREVIEW, async (_event, campaignId: string, characterIds: string[]) => {
    // Build context without sending a message — just to populate the token breakdown
    try {
      await buildContext('preview query for token budget', characterIds, campaignId)
      return getLastTokenBreakdown()
    } catch {
      return null
    }
  })

  // ── Conversation Persistence ──

  ipcMain.handle(IPC_CHANNELS.AI_SAVE_CONVERSATION, async (_event, campaignId: string) => {
    const conv = aiService.getConversationManager(campaignId)
    const data = conv.serialize()
    await saveConversation(campaignId, data)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LOAD_CONVERSATION, async (_event, campaignId: string) => {
    const data = await loadConversation(campaignId)
    if (data) {
      const conv = aiService.getConversationManager(campaignId)
      conv.restore(data)
      return { success: true, data }
    }
    return { success: false }
  })

  ipcMain.handle(IPC_CHANNELS.AI_DELETE_CONVERSATION, async (_event, campaignId: string) => {
    await deleteConversation(campaignId)
    return { success: true }
  })

  // ── Memory Files ──

  ipcMain.handle(IPC_CHANNELS.AI_LIST_MEMORY_FILES, async (_event, campaignId: string) => {
    const memoryDir = path.join(app.getPath('userData'), 'campaigns', campaignId, 'ai-context')
    const results: Array<{ name: string; size: number }> = []

    async function walk(dir: string, prefix: string): Promise<void> {
      let entries: { name: string; isDirectory(): boolean }[]
      try {
        const raw = await fs.readdir(dir, { withFileTypes: true })
        entries = raw.map((e) => ({ name: String(e.name), isDirectory: () => e.isDirectory() }))
      } catch {
        return
      }
      for (const entry of entries) {
        const name = String(entry.name)
        const relative = prefix ? `${prefix}/${name}` : name
        const fullPath = path.join(dir, name)
        if (entry.isDirectory()) {
          await walk(fullPath, relative)
        } else {
          try {
            const stat = await fs.stat(fullPath)
            results.push({ name: relative, size: stat.size })
          } catch {
            // Skip unreadable files
          }
        }
      }
    }

    await walk(memoryDir, '')
    return results
  })

  ipcMain.handle(IPC_CHANNELS.AI_READ_MEMORY_FILE, async (_event, campaignId: string, fileName: string) => {
    // Prevent directory traversal
    const normalized = path.normalize(fileName)
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid file name')
    }
    const filePath = path.join(app.getPath('userData'), 'campaigns', campaignId, 'ai-context', normalized)
    return await fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.AI_CLEAR_MEMORY, async (_event, campaignId: string) => {
    const memoryDir = path.join(app.getPath('userData'), 'campaigns', campaignId, 'ai-context')
    try {
      await fs.rm(memoryDir, { recursive: true, force: true })
    } catch {
      // Directory may not exist — that's fine
    }
  })

  // ── Ollama Management ──

  ipcMain.handle(IPC_CHANNELS.AI_DETECT_OLLAMA, async () => {
    return await detectOllama()
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_VRAM, async () => {
    return await getSystemVram()
  })

  ipcMain.handle(IPC_CHANNELS.AI_DOWNLOAD_OLLAMA, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      const path = await downloadOllama((percent) => {
        win?.webContents.send(IPC_CHANNELS.AI_OLLAMA_PROGRESS, { type: 'download', percent })
      })
      return { success: true, path }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_INSTALL_OLLAMA, async (_event, installerPath: string) => {
    try {
      await installOllama(installerPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_START_OLLAMA, async () => {
    try {
      await startOllama()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_PULL_MODEL, async (event, model: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      await pullModel(model, (percent) => {
        win?.webContents.send(IPC_CHANNELS.AI_OLLAMA_PROGRESS, { type: 'pull', percent })
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_GET_CURATED_MODELS, async () => {
    return CURATED_MODELS
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_INSTALLED_MODELS, async () => {
    return await listInstalledModels()
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_INSTALLED_MODELS_DETAILED, async () => {
    return await listInstalledModelsDetailed()
  })

  ipcMain.handle(IPC_CHANNELS.AI_OLLAMA_CHECK_UPDATE, async () => {
    try {
      return { success: true, data: await checkOllamaUpdate() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_OLLAMA_UPDATE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      await updateOllama((percent) => {
        win?.webContents.send(IPC_CHANNELS.AI_OLLAMA_PROGRESS, {
          type: 'ollama-update',
          percent
        })
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_DELETE_MODEL, async (_event, model: string) => {
    try {
      await deleteModel(model)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
