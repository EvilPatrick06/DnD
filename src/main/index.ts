import { join } from 'node:path'
import { is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { initFromSavedConfig } from './ai/ai-service'
import { registerIpcHandlers } from './ipc'
import { logToFile } from './log'
import { registerUpdateHandlers } from './updater'

// ── Unhandled Error Handlers ──

process.on('uncaughtException', (error) => {
  logToFile('FATAL', `Uncaught exception: ${error.message}`, error.stack)
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  logToFile('ERROR', `Unhandled rejection: ${msg}`, stack)
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'D&D Virtual Tabletop',
    backgroundColor: '#030712',
    show: false,
    autoHideMenuBar: true,
    icon: (() => {
      const iconPath = app.isPackaged
        ? join(process.resourcesPath, 'icon.ico')
        : join(__dirname, '../../resources/icon.ico')
      const icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty()) {
        logToFile('WARN', `Failed to load app icon from: ${iconPath}`)
      }
      return icon
    })(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Explicitly set taskbar icon
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../resources/icon.ico')
  const appIcon = nativeImage.createFromPath(iconPath)
  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  // Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self'; connect-src 'self' data: wss://0.peerjs.com https://0.peerjs.com; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'"
        ]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // DevTools shortcut (development only)
  if (is.dev) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools()
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL, ignore
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.dnd-vtt.app')

  registerIpcHandlers()
  registerUpdateHandlers()
  initFromSavedConfig()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  // Release the single-instance lock so the NSIS installer doesn't think the app is still running
  app.releaseSingleInstanceLock()
})
