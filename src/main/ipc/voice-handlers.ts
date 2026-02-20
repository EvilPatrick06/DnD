import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

export function registerVoiceHandlers(): void {
  // Generate a LiveKit participant token
  // In local mode: generates token using ephemeral keys
  // In cloud mode: uses campaign's API key/secret
  ipcMain.handle(
    IPC_CHANNELS.VOICE_GENERATE_TOKEN,
    async (
      _event,
      options: {
        roomName: string
        participantName: string
        participantId: string
        mode: 'local' | 'cloud'
        apiKey?: string
        apiSecret?: string
      }
    ) => {
      try {
        // For now, return a stub -- actual token generation requires livekit-server-sdk
        // which would be installed as a dependency when a real LiveKit server is available.
        const serverUrl =
          options.mode === 'local' ? 'ws://localhost:7880' : 'wss://cloud.livekit.io'

        return {
          success: true,
          data: {
            token: `stub-token-${options.participantId}-${Date.now()}`,
            serverUrl
          }
        }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // Get the voice server URL based on campaign config
  ipcMain.handle(
    IPC_CHANNELS.VOICE_GET_SERVER_URL,
    async (_event, mode: 'local' | 'cloud', serverUrl?: string) => {
      if (mode === 'cloud' && serverUrl) {
        return { success: true, data: serverUrl }
      }
      return { success: true, data: 'ws://localhost:7880' }
    }
  )
}
