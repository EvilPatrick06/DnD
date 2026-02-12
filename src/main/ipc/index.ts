import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { normalize, join } from 'path'
import {
  saveCharacter,
  loadCharacters,
  loadCharacter,
  deleteCharacter
} from '../storage/characterStorage'
import {
  saveCampaign,
  loadCampaigns,
  loadCampaign,
  deleteCampaign
} from '../storage/campaignStorage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

// Tracks paths returned by file dialogs so fs:read-file / fs:write-file
// only operate on user-selected locations or the app's own data directory.
const dialogAllowedPaths = new Set<string>()

function isPathAllowed(targetPath: string): boolean {
  const normalized = normalize(targetPath)
  const userData = normalize(app.getPath('userData'))

  // Allow anything under the app's userData directory
  if (normalized.startsWith(userData + '\\') || normalized.startsWith(userData + '/')) {
    return true
  }

  // Allow paths the user explicitly selected via a file dialog
  if (dialogAllowedPaths.has(normalized)) {
    return true
  }

  return false
}

export function registerIpcHandlers(): void {
  // --- Character storage ---

  ipcMain.handle('storage:save-character', async (_event, character) => {
    const result = await saveCharacter(character)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle('storage:load-characters', async () => {
    const result = await loadCharacters()
    if (result.success) {
      return result.data
    }
    return []
  })

  ipcMain.handle('storage:load-character', async (_event, id: string) => {
    const result = await loadCharacter(id)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle('storage:delete-character', async (_event, id: string) => {
    const result = await deleteCharacter(id)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Campaign storage ---

  ipcMain.handle('storage:save-campaign', async (_event, campaign) => {
    const result = await saveCampaign(campaign)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle('storage:load-campaigns', async () => {
    const result = await loadCampaigns()
    if (result.success) {
      return result.data
    }
    return []
  })

  ipcMain.handle('storage:load-campaign', async (_event, id: string) => {
    const result = await loadCampaign(id)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle('storage:delete-campaign', async (_event, id: string) => {
    const result = await deleteCampaign(id)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Ban storage ---

  ipcMain.handle('storage:load-bans', async (_event, campaignId: string) => {
    if (!isValidUUID(campaignId)) {
      throw new Error('Invalid campaign ID')
    }
    try {
      const bansDir = join(app.getPath('userData'), 'bans')
      const banPath = join(bansDir, `${campaignId}.json`)
      const content = await readFile(banPath, 'utf-8')
      return JSON.parse(content) as string[]
    } catch {
      return []
    }
  })

  ipcMain.handle('storage:save-bans', async (_event, campaignId: string, peerIds: string[]) => {
    if (!isValidUUID(campaignId)) {
      throw new Error('Invalid campaign ID')
    }
    try {
      const bansDir = join(app.getPath('userData'), 'bans')
      await mkdir(bansDir, { recursive: true })
      const banPath = join(bansDir, `${campaignId}.json`)
      await writeFile(banPath, JSON.stringify(peerIds), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // --- File dialogs ---

  ipcMain.handle(
    'dialog:show-save',
    async (
      _event,
      options: { title: string; filters: Array<{ name: string; extensions: string[] }> }
    ) => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(win!, {
        title: options.title,
        filters: options.filters
      })
      if (result.canceled || !result.filePath) {
        return null
      }
      dialogAllowedPaths.add(normalize(result.filePath))
      return result.filePath
    }
  )

  ipcMain.handle(
    'dialog:show-open',
    async (
      _event,
      options: { title: string; filters: Array<{ name: string; extensions: string[] }> }
    ) => {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        title: options.title,
        filters: options.filters,
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      dialogAllowedPaths.add(normalize(result.filePaths[0]))
      return result.filePaths[0]
    }
  )

  // --- File I/O (restricted to dialog-selected paths and userData) ---

  ipcMain.handle('fs:read-file', async (_event, path: string) => {
    if (!isPathAllowed(path)) {
      throw new Error('Access denied: path not allowed')
    }
    try {
      const content = await readFile(path, 'utf-8')
      dialogAllowedPaths.delete(normalize(path))
      return content
    } catch (err) {
      console.error('fs:read-file failed:', err)
      throw err
    }
  })

  ipcMain.handle('fs:write-file', async (_event, path: string, content: string) => {
    if (!isPathAllowed(path)) {
      throw new Error('Access denied: path not allowed')
    }
    try {
      await writeFile(path, content, 'utf-8')
      dialogAllowedPaths.delete(normalize(path))
    } catch (err) {
      console.error('fs:write-file failed:', err)
      throw err
    }
  })
}
