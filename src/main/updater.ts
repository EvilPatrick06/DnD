/**
 * Auto-update module using electron-updater.
 *
 * Behavior:
 * - Checks for updates on demand (user clicks "Check for Updates")
 * - Downloads updates in the background
 * - Prompts user to restart — never forces mid-session
 * - DM is notified of available updates; players are not interrupted
 *
 * When electron-updater is not configured (no publish config / no GH releases),
 * all operations gracefully return "no-update" status.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

let currentStatus: UpdateStatus = { state: 'idle' }

function sendStatus(win: BrowserWindow | null): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, currentStatus)
  }
}

/**
 * Register update-related IPC handlers.
 * Call once during app initialization.
 */
export function registerUpdateHandlers(): void {
  // Return app version
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json') as { version: string }
    return pkg.version
  })

  // Check for updates
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    try {
      // Dynamically import electron-updater (may not be installed in dev)
      const { autoUpdater } = await import('electron-updater')
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = false

      currentStatus = { state: 'checking' }
      const win = BrowserWindow.getFocusedWindow()
      sendStatus(win)

      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo.version !== autoUpdater.currentVersion.version) {
        currentStatus = { state: 'available', version: result.updateInfo.version }
      } else {
        currentStatus = { state: 'not-available' }
      }
      sendStatus(win)
      return currentStatus
    } catch (err) {
      // electron-updater not configured or network error
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Cannot find module') || msg.includes('ERR_UPDATER_')) {
        currentStatus = { state: 'not-available' }
      } else {
        currentStatus = { state: 'error', message: msg }
      }
      const win = BrowserWindow.getFocusedWindow()
      sendStatus(win)
      return currentStatus
    }
  })

  // Download available update
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    try {
      const { autoUpdater } = await import('electron-updater')
      const win = BrowserWindow.getFocusedWindow()

      // Capture the pending version before downloading (currentStatus.version has the update version)
      const pendingVersion = currentStatus.state === 'available' ? currentStatus.version : ''

      autoUpdater.on('download-progress', (progress) => {
        currentStatus = { state: 'downloading', percent: Math.round(progress.percent) }
        sendStatus(win)
      })

      await autoUpdater.downloadUpdate()

      currentStatus = { state: 'downloaded', version: pendingVersion }
      sendStatus(win)
      return currentStatus
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      currentStatus = { state: 'error', message: msg }
      return currentStatus
    }
  })

  // Install update and restart
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    try {
      const { autoUpdater } = await import('electron-updater')
      autoUpdater.quitAndInstall(false, true)
    } catch {
      // Fallback: just quit
    }
  })
}
