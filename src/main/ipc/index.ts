import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { deleteBastion, loadBastion, loadBastions, saveBastion } from '../storage/bastionStorage'
import { deleteCampaign, loadCampaign, loadCampaigns, saveCampaign } from '../storage/campaignStorage'
import { deleteCharacter, loadCharacter, loadCharacters, saveCharacter } from '../storage/characterStorage'
import type { AppSettings } from '../storage/settingsStorage'
import { loadSettings, saveSettings } from '../storage/settingsStorage'
import { registerAiHandlers } from './ai-handlers'
import { registerAudioHandlers } from './audio-handlers'
import { registerVoiceHandlers } from './voice-handlers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

// Tracks paths returned by file dialogs so fs:read-file / fs:write-file
// only operate on user-selected locations or the app's own data directory.
// Values are timestamps for TTL expiry.
const dialogAllowedPaths = new Map<string, number>()
const DIALOG_PATH_TTL = 60_000 // 60 seconds

function addDialogPath(p: string): void {
  dialogAllowedPaths.set(resolve(p), Date.now())
}

function isDialogPathValid(p: string): boolean {
  const resolved = resolve(p)
  const timestamp = dialogAllowedPaths.get(resolved)
  if (timestamp === undefined) return false
  if (Date.now() - timestamp >= DIALOG_PATH_TTL) {
    dialogAllowedPaths.delete(resolved)
    return false
  }
  return true
}

function isPathAllowed(targetPath: string): boolean {
  const resolved = resolve(targetPath)
  const userData = resolve(app.getPath('userData'))

  // Allow anything under the app's userData directory
  // Use path.relative() to prevent traversal attacks (e.g., "userData/../../../etc/passwd")
  const rel = relative(userData, resolved)
  if (rel && !rel.startsWith('..') && !resolve(userData, rel).startsWith('..')) {
    return true
  }

  // Allow paths the user explicitly selected via a file dialog (with TTL check)
  if (isDialogPathValid(resolved)) {
    return true
  }

  return false
}

export function registerIpcHandlers(): void {
  // --- Character storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_CHARACTER, async (_event, character) => {
    const result = await saveCharacter(character)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CHARACTERS, async () => {
    const result = await loadCharacters()
    if (result.success) {
      return result.data
    }
    return []
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CHARACTER, async (_event, id: string) => {
    const result = await loadCharacter(id)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CHARACTER, async (_event, id: string) => {
    const result = await deleteCharacter(id)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Campaign storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_CAMPAIGN, async (_event, campaign) => {
    const result = await saveCampaign(campaign)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CAMPAIGNS, async () => {
    const result = await loadCampaigns()
    if (result.success) {
      return result.data
    }
    return []
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CAMPAIGN, async (_event, id: string) => {
    const result = await loadCampaign(id)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CAMPAIGN, async (_event, id: string) => {
    const result = await deleteCampaign(id)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Bastion storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_BASTION, async (_event, bastion) => {
    const result = await saveBastion(bastion)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_BASTIONS, async () => {
    const result = await loadBastions()
    if (result.success) {
      return result.data
    }
    return []
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_BASTION, async (_event, id: string) => {
    const result = await loadBastion(id)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_BASTION, async (_event, id: string) => {
    const result = await deleteBastion(id)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Ban storage ---

  ipcMain.handle(IPC_CHANNELS.LOAD_BANS, async (_event, campaignId: string) => {
    if (!isValidUUID(campaignId)) {
      throw new Error('Invalid campaign ID')
    }
    try {
      const bansDir = join(app.getPath('userData'), 'bans')
      const banPath = join(bansDir, `${campaignId}.json`)
      const content = await readFile(banPath, 'utf-8')
      const parsed = JSON.parse(content)
      // Support both old format (string[]) and new format ({ peerIds, names })
      if (Array.isArray(parsed)) {
        return { peerIds: parsed as string[], names: [] as string[] }
      }
      return {
        peerIds: Array.isArray(parsed.peerIds) ? (parsed.peerIds as string[]) : [],
        names: Array.isArray(parsed.names) ? (parsed.names as string[]) : []
      }
    } catch {
      return { peerIds: [] as string[], names: [] as string[] }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.SAVE_BANS,
    async (_event, campaignId: string, banData: { peerIds: string[]; names: string[] }) => {
      if (!isValidUUID(campaignId)) {
        throw new Error('Invalid campaign ID')
      }
      if (!banData || typeof banData !== 'object') {
        throw new Error('Invalid ban data: expected object')
      }
      const { peerIds, names } = banData
      if (!Array.isArray(peerIds)) {
        throw new Error('Invalid peer IDs: expected array')
      }
      if (!Array.isArray(names)) {
        throw new Error('Invalid names: expected array')
      }
      if (peerIds.length > 1000 || names.length > 1000) {
        throw new Error('Invalid ban data: too many entries')
      }
      for (const id of peerIds) {
        if (typeof id !== 'string' || id.length > 64) {
          throw new Error('Invalid peer ID in list')
        }
      }
      for (const name of names) {
        if (typeof name !== 'string' || name.length > 64) {
          throw new Error('Invalid name in list')
        }
      }
      try {
        const bansDir = join(app.getPath('userData'), 'bans')
        await mkdir(bansDir, { recursive: true })
        const banPath = join(bansDir, `${campaignId}.json`)
        await writeFile(banPath, JSON.stringify({ peerIds, names }), 'utf-8')
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // --- File dialogs ---

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE,
    async (_event, options: { title: string; filters: Array<{ name: string; extensions: string[] }> }) => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(win!, {
        title: options.title,
        filters: options.filters
      })
      if (result.canceled || !result.filePath) {
        return null
      }
      addDialogPath(result.filePath)
      return result.filePath
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN,
    async (_event, options: { title: string; filters: Array<{ name: string; extensions: string[] }> }) => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        title: options.title,
        filters: options.filters,
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      addDialogPath(result.filePaths[0])
      return result.filePaths[0]
    }
  )

  // --- File I/O (restricted to dialog-selected paths and userData) ---

  ipcMain.handle(IPC_CHANNELS.FS_READ, async (_event, filePath: string) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: path not allowed')
    }
    const resolvedPath = resolve(filePath)
    try {
      const content = await readFile(resolvedPath, 'utf-8')
      return content
    } catch (err) {
      console.error('fs:read-file failed:', err)
      throw err
    } finally {
      dialogAllowedPaths.delete(resolvedPath)
    }
  })

  ipcMain.handle(IPC_CHANNELS.FS_WRITE, async (_event, filePath: string, content: string) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: path not allowed')
    }
    const resolvedPath = resolve(filePath)
    try {
      await writeFile(resolvedPath, content, 'utf-8')
    } catch (err) {
      console.error('fs:write-file failed:', err)
      throw err
    } finally {
      dialogAllowedPaths.delete(resolvedPath)
    }
  })

  // --- Window controls ---

  ipcMain.handle(IPC_CHANNELS.TOGGLE_FULLSCREEN, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(!win.isFullScreen())
      return win.isFullScreen()
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.IS_FULLSCREEN, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isFullScreen() ?? false
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_DEVTOOLS, async (event) => {
    if (!is.dev) return // Only allow DevTools in development
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.webContents.openDevTools()
    }
  })

  // --- Settings storage ---

  ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, async () => {
    return loadSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: AppSettings) => {
    await saveSettings(settings)
    return { success: true }
  })

  // --- AI DM handlers ---
  registerAiHandlers()

  // --- Audio handlers ---
  registerAudioHandlers()

  // --- Voice handlers ---
  registerVoiceHandlers()
}
