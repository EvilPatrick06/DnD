import { app, dialog, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

export function registerAudioHandlers(): void {
  // Upload custom audio file for a campaign
  ipcMain.handle(
    'audio:upload-custom',
    async (
      _event,
      campaignId: string,
      fileName: string,
      buffer: ArrayBuffer,
      displayName: string,
      category: string
    ) => {
      try {
        const campaignDir = path.join(
          app.getPath('userData'),
          'campaigns',
          campaignId,
          'custom-audio'
        )
        await fs.mkdir(campaignDir, { recursive: true })
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = path.join(campaignDir, sanitizedFileName)
        await fs.writeFile(filePath, Buffer.from(buffer))
        return { success: true, data: { fileName: sanitizedFileName, displayName, category } }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // List custom audio files for a campaign
  ipcMain.handle('audio:list-custom', async (_event, campaignId: string) => {
    try {
      const campaignDir = path.join(
        app.getPath('userData'),
        'campaigns',
        campaignId,
        'custom-audio'
      )
      try {
        const files = await fs.readdir(campaignDir)
        return { success: true, data: files }
      } catch {
        return { success: true, data: [] }
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Delete a custom audio file
  ipcMain.handle('audio:delete-custom', async (_event, campaignId: string, fileName: string) => {
    try {
      const campaignDir = path.join(
        app.getPath('userData'),
        'campaigns',
        campaignId,
        'custom-audio'
      )
      await fs.unlink(path.join(campaignDir, fileName))
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Get the full path to a custom audio file (for playback)
  ipcMain.handle(
    'audio:get-custom-path',
    async (_event, campaignId: string, fileName: string) => {
      try {
        const filePath = path.join(
          app.getPath('userData'),
          'campaigns',
          campaignId,
          'custom-audio',
          fileName
        )
        await fs.access(filePath)
        return { success: true, data: filePath }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // Open file dialog for audio selection
  ipcMain.handle('audio:pick-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'webm', 'm4a'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'cancelled' }
    }
    const filePath = result.filePaths[0]
    const buffer = await fs.readFile(filePath)
    const fileName = path.basename(filePath)
    return { success: true, data: { fileName, buffer: buffer.buffer } }
  })
}
