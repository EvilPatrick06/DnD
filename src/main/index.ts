import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

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
        console.error('[Main] Failed to load app icon from:', iconPath)
      }
      return icon
    })(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
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
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: https://0.peerjs.com; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'"
        ]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
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
  app.setAppUserModelId('com.dndvtt.app')

  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
