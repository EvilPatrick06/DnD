import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Character storage
  saveCharacter: (character: Record<string, unknown>) =>
    ipcRenderer.invoke('storage:save-character', character),
  loadCharacters: () => ipcRenderer.invoke('storage:load-characters'),
  loadCharacter: (id: string) => ipcRenderer.invoke('storage:load-character', id),
  deleteCharacter: (id: string) => ipcRenderer.invoke('storage:delete-character', id),

  // Campaign storage
  saveCampaign: (campaign: Record<string, unknown>) =>
    ipcRenderer.invoke('storage:save-campaign', campaign),
  loadCampaigns: () => ipcRenderer.invoke('storage:load-campaigns'),
  loadCampaign: (id: string) => ipcRenderer.invoke('storage:load-campaign', id),
  deleteCampaign: (id: string) => ipcRenderer.invoke('storage:delete-campaign', id),

  // File dialogs
  showSaveDialog: (options: {
    title: string
    filters: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('dialog:show-save', options),
  showOpenDialog: (options: {
    title: string
    filters: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('dialog:show-open', options),

  // Ban storage
  loadBans: (campaignId: string) => ipcRenderer.invoke('storage:load-bans', campaignId),
  saveBans: (campaignId: string, peerIds: string[]) =>
    ipcRenderer.invoke('storage:save-bans', campaignId, peerIds),

  // File I/O
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
