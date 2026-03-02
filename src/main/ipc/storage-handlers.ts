import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { deleteBastion, loadBastion, loadBastions, saveBastion } from '../storage/bastion-storage'
import { deleteCampaign, loadCampaign, loadCampaigns, saveCampaign } from '../storage/campaign-storage'
import {
  type CharacterVersion,
  deleteCharacter,
  listCharacterVersions,
  loadCharacter,
  loadCharacters,
  restoreCharacterVersion,
  saveCharacter
} from '../storage/character-storage'
import { type BackupEntry, CloudSync, type CloudSyncConfig, type SyncResult } from '../storage/cloud-sync'
import {
  deleteCustomCreature,
  loadCustomCreature,
  loadCustomCreatures,
  saveCustomCreature
} from '../storage/custom-creature-storage'
import {
  deleteGameState,
  loadGameState as loadGameStateStorage,
  saveGameState as saveGameStateStorage
} from '../storage/game-state-storage'
import {
  deleteHomebrewEntry,
  loadAllHomebrew,
  loadHomebrewEntries,
  saveHomebrewEntry
} from '../storage/homebrew-storage'
import { type AppSettings, loadSettings, saveSettings } from '../storage/settings-storage'

// Ensure imported types are used for type-safety
type _CharacterVersion = CharacterVersion
type _BackupEntry = BackupEntry
type _SyncResult = SyncResult

export function registerStorageHandlers(): void {
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
    return { success: false, error: result.error ?? 'Failed to load characters' }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CHARACTER, async (_event, id: string) => {
    const result = await loadCharacter(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to load character' }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CHARACTER, async (_event, id: string) => {
    const result = await deleteCharacter(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to delete character' }
  })

  ipcMain.handle(IPC_CHANNELS.CHARACTER_VERSIONS, async (_event, id: string) => {
    return listCharacterVersions(id)
  })

  ipcMain.handle(IPC_CHANNELS.CHARACTER_RESTORE_VERSION, async (_event, id: string, fileName: string) => {
    return restoreCharacterVersion(id, fileName)
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
    return { success: false, error: result.error ?? 'Failed to load campaigns' }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CAMPAIGN, async (_event, id: string) => {
    const result = await loadCampaign(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to load campaign' }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CAMPAIGN, async (_event, id: string) => {
    const result = await deleteCampaign(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to delete campaign' }
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
    return { success: false, error: result.error ?? 'Failed to load bastions' }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_BASTION, async (_event, id: string) => {
    const result = await loadBastion(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to load bastion' }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_BASTION, async (_event, id: string) => {
    const result = await deleteBastion(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to delete bastion' }
  })

  // --- Custom creature storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_CUSTOM_CREATURE, async (_event, creature) => {
    const result = await saveCustomCreature(creature)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CUSTOM_CREATURES, async () => {
    const result = await loadCustomCreatures()
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to load custom creatures' }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_CUSTOM_CREATURE, async (_event, id: string) => {
    const result = await loadCustomCreature(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to load custom creature' }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_CREATURE, async (_event, id: string) => {
    const result = await deleteCustomCreature(id)
    if (result.success) {
      return result.data
    }
    return { success: false, error: result.error ?? 'Failed to delete custom creature' }
  })

  // --- Game state storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_GAME_STATE, async (_event, campaignId: string, state: Record<string, unknown>) => {
    const result = await saveGameStateStorage(campaignId, state)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_GAME_STATE, async (_event, campaignId: string) => {
    const result = await loadGameStateStorage(campaignId)
    if (result.success) {
      return result.data
    }
    return null
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_GAME_STATE, async (_event, campaignId: string) => {
    const result = await deleteGameState(campaignId)
    if (result.success) {
      return result.data
    }
    return false
  })

  // --- Homebrew storage ---

  ipcMain.handle(IPC_CHANNELS.SAVE_HOMEBREW, async (_event, entry) => {
    const result = await saveHomebrewEntry(entry)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_HOMEBREW_BY_CATEGORY, async (_event, category: string) => {
    const result = await loadHomebrewEntries(category)
    if (result.success) return result.data
    return { success: false, error: result.error ?? 'Failed to load homebrew entries' }
  })

  ipcMain.handle(IPC_CHANNELS.LOAD_ALL_HOMEBREW, async () => {
    const result = await loadAllHomebrew()
    if (result.success) return result.data
    return { success: false, error: result.error ?? 'Failed to load all homebrew' }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_HOMEBREW, async (_event, category: string, id: string) => {
    const result = await deleteHomebrewEntry(category, id)
    if (result.success) return result.data
    return { success: false, error: result.error ?? 'Failed to delete homebrew entry' }
  })

  // --- Settings storage ---

  ipcMain.handle(IPC_CHANNELS.LOAD_SETTINGS, async () => {
    return loadSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, settings: AppSettings) => {
    await saveSettings(settings)
    return { success: true }
  })

  // --- Cloud Sync ---

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_SYNC_UPLOAD,
    async (
      _event,
      config: CloudSyncConfig,
      type: 'character' | 'campaign',
      data: Record<string, unknown>,
      deviceKey: string
    ) => {
      try {
        const sync = new CloudSync(config)
        if (type === 'character') {
          await sync.uploadCharacter(data as { id: string; [key: string]: unknown }, deviceKey)
        } else {
          await sync.uploadCampaign(data as { id: string; [key: string]: unknown }, deviceKey)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_SYNC_DOWNLOAD,
    async (_event, config: CloudSyncConfig, type: 'character' | 'campaign', id: string, deviceKey: string) => {
      try {
        const sync = new CloudSync(config)
        const data =
          type === 'character'
            ? await sync.downloadCharacter(id, deviceKey)
            : await sync.downloadCampaign(id, deviceKey)
        return { success: true, data }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.CLOUD_SYNC_LIST, async (_event, config: CloudSyncConfig, deviceKey: string) => {
    try {
      const sync = new CloudSync(config)
      const entries = await sync.listBackups(deviceKey)
      return { success: true, data: entries }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
