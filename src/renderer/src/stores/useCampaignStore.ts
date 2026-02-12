import { create } from 'zustand'
import type { Campaign } from '../types/campaign'

function generateId(): string {
  return crypto.randomUUID()
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

interface CampaignState {
  campaigns: Campaign[]
  activeCampaignId: string | null
  loading: boolean
  loadCampaigns: () => Promise<void>
  saveCampaign: (campaign: Campaign) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  setActiveCampaign: (id: string | null) => void
  getActiveCampaign: () => Campaign | null
  addCampaignToState: (campaign: Campaign) => void
  createCampaign: (
    data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode' | 'players' | 'journal'>
  ) => Promise<Campaign>
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  activeCampaignId: null,
  loading: false,

  loadCampaigns: async () => {
    set({ loading: true })
    try {
      const rawData = await window.api.loadCampaigns()
      const diskCampaigns = rawData as unknown as Campaign[]
      set((state) => {
        const diskIds = new Set(diskCampaigns.map((c) => c.id))
        const inMemoryOnly = state.campaigns.filter((c) => !diskIds.has(c.id))
        return { campaigns: [...diskCampaigns, ...inMemoryOnly], loading: false }
      })
    } catch (error) {
      console.error('Failed to load campaigns:', error)
      set({ loading: false })
    }
  },

  saveCampaign: async (campaign: Campaign) => {
    try {
      await window.api.saveCampaign(campaign as unknown as Record<string, unknown>)
      const { campaigns } = get()
      const index = campaigns.findIndex((c) => c.id === campaign.id)
      if (index >= 0) {
        const updated = [...campaigns]
        updated[index] = campaign
        set({ campaigns: updated })
      } else {
        set({ campaigns: [...campaigns, campaign] })
      }
    } catch (error) {
      console.error('Failed to save campaign:', error)
    }
  },

  deleteCampaign: async (id: string) => {
    try {
      await window.api.deleteCampaign(id)
      const { activeCampaignId } = get()
      set({
        campaigns: get().campaigns.filter((c) => c.id !== id),
        activeCampaignId: activeCampaignId === id ? null : activeCampaignId
      })
    } catch (error) {
      console.error('Failed to delete campaign:', error)
    }
  },

  setActiveCampaign: (id) => set({ activeCampaignId: id }),

  addCampaignToState: (campaign: Campaign) => {
    set((state) => {
      const exists = state.campaigns.some((c) => c.id === campaign.id)
      if (exists) return state
      return { campaigns: [...state.campaigns, campaign] }
    })
  },

  getActiveCampaign: () => {
    const { campaigns, activeCampaignId } = get()
    if (!activeCampaignId) return null
    return campaigns.find((c) => c.id === activeCampaignId) ?? null
  },

  createCampaign: async (data) => {
    const now = new Date().toISOString()
    const campaign: Campaign = {
      ...data,
      id: generateId(),
      inviteCode: generateInviteCode(),
      players: [],
      journal: { entries: [] },
      createdAt: now,
      updatedAt: now
    }

    await get().saveCampaign(campaign)
    return campaign
  }
}))
