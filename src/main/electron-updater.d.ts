declare module 'electron-updater' {
  interface UpdateInfo {
    version: string
    [key: string]: unknown
  }

  interface UpdateCheckResult {
    updateInfo: UpdateInfo
    [key: string]: unknown
  }

  interface ProgressInfo {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
  }

  interface AutoUpdater {
    currentVersion: { version: string }
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    checkForUpdates(): Promise<UpdateCheckResult | null>
    downloadUpdate(): Promise<void>
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
    on(event: 'download-progress', handler: (progress: ProgressInfo) => void): void
  }

  export const autoUpdater: AutoUpdater
}
