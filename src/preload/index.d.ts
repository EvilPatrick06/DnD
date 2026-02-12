import { ElectronAPI } from '@electron-toolkit/preload'

interface CharacterAPI {
  saveCharacter: (character: Record<string, unknown>) => Promise<{ success: boolean }>
  loadCharacters: () => Promise<Record<string, unknown>[]>
  loadCharacter: (id: string) => Promise<Record<string, unknown> | null>
  deleteCharacter: (id: string) => Promise<boolean>
}

interface CampaignAPI {
  saveCampaign: (campaign: Record<string, unknown>) => Promise<{ success: boolean }>
  loadCampaigns: () => Promise<Record<string, unknown>[]>
  loadCampaign: (id: string) => Promise<Record<string, unknown> | null>
  deleteCampaign: (id: string) => Promise<boolean>
}

interface FileDialogOptions {
  title: string
  filters: Array<{ name: string; extensions: string[] }>
}

interface DialogAPI {
  showSaveDialog: (options: FileDialogOptions) => Promise<string | null>
  showOpenDialog: (options: FileDialogOptions) => Promise<string | null>
}

interface BanAPI {
  loadBans: (campaignId: string) => Promise<string[]>
  saveBans: (campaignId: string, peerIds: string[]) => Promise<{ success: boolean }>
}

interface FileAPI {
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CharacterAPI & CampaignAPI & DialogAPI & BanAPI & FileAPI
  }
}
