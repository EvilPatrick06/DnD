import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import AdventureWizard from '../components/campaign/AdventureWizard'
import type { AdventureData } from '../components/campaign/AdventureWizard'
import AiDmStep from '../components/campaign/AiDmStep'
import MagicItemTracker from '../components/campaign/MagicItemTracker'
import MonsterStatBlockView from '../components/game/dm/MonsterStatBlockView'
import StatBlockEditor from '../components/game/dm/StatBlockEditor'
import { BackButton, Button, Card, ConfirmDialog, Modal } from '../components/ui'
import { addToast } from '../hooks/useToast'
import { exportCampaignToFile } from '../services/campaign-io'
import { load5eMonsterById, loadAllStatBlocks, searchMonsters } from '../services/data-provider'
import { useCampaignStore } from '../stores/useCampaignStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import type { Campaign, CustomRule, LoreEntry, NPC } from '../types/campaign'
import { GAME_SYSTEMS } from '../types/game-system'
import type { GameMap } from '../types/map'
import type { MonsterStatBlock } from '../types/monster'

const CATEGORY_COLORS: Record<string, string> = {
  combat: 'bg-red-900/40 text-red-300',
  exploration: 'bg-green-900/40 text-green-300',
  social: 'bg-blue-900/40 text-blue-300',
  rest: 'bg-purple-900/40 text-purple-300',
  other: 'bg-gray-800 text-gray-300'
}

const LORE_CATEGORY_COLORS: Record<string, string> = {
  world: 'bg-blue-900/40 text-blue-300',
  faction: 'bg-purple-900/40 text-purple-300',
  location: 'bg-green-900/40 text-green-300',
  item: 'bg-amber-900/40 text-amber-300',
  other: 'bg-gray-800 text-gray-300'
}

export default function CampaignDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaigns, loading, loadCampaigns, deleteCampaign, saveCampaign } = useCampaignStore()
  const { hostGame } = useNetworkStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showAdventureWizard, setShowAdventureWizard] = useState(false)

  // NPC state
  const [showNPCModal, setShowNPCModal] = useState(false)
  const [editingNPC, setEditingNPC] = useState<NPC | null>(null)
  const [npcForm, setNpcForm] = useState<{
    name: string
    description: string
    location: string
    isVisible: boolean
    notes: string
    role: NPC['role']
    personality: string
    motivation: string
    statBlockId: string
    customStats: Partial<MonsterStatBlock> | undefined
    statBlockMode: 'none' | 'link' | 'custom'
  }>({
    name: '',
    description: '',
    location: '',
    isVisible: true,
    notes: '',
    role: undefined,
    personality: '',
    motivation: '',
    statBlockId: '',
    customStats: undefined,
    statBlockMode: 'none'
  })
  const [monsterSearchQuery, setMonsterSearchQuery] = useState('')
  const [monsterSearchResults, setMonsterSearchResults] = useState<MonsterStatBlock[]>([])
  const [linkedMonsterPreview, setLinkedMonsterPreview] = useState<MonsterStatBlock | null>(null)
  const [allMonsters, setAllMonsters] = useState<MonsterStatBlock[]>([])
  const [npcStatBlocks, setNpcStatBlocks] = useState<Record<string, MonsterStatBlock>>({})
  const [expandedNpcStatBlock, setExpandedNpcStatBlock] = useState<string | null>(null)

  // Rule state
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  const [ruleForm, setRuleForm] = useState({ name: '', description: '', category: 'other' as CustomRule['category'] })

  // Lore state
  const [showLoreModal, setShowLoreModal] = useState(false)
  const [editingLore, setEditingLore] = useState<LoreEntry | null>(null)
  const [loreForm, setLoreForm] = useState({
    title: '',
    content: '',
    category: 'world' as LoreEntry['category'],
    isVisibleToPlayers: false
  })

  // AI DM config state
  const [showAiDmModal, setShowAiDmModal] = useState(false)
  const [aiDmConfig, setAiDmConfig] = useState<{
    enabled: boolean
    provider: 'claude' | 'ollama'
    model: 'opus' | 'sonnet' | 'haiku'
    apiKey: string
    ollamaModel: string
  }>({ enabled: false, provider: 'claude', model: 'sonnet', apiKey: '', ollamaModel: 'mistral' })

  // Map state
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapForm, setMapForm] = useState({ name: '', gridType: 'square' as 'square' | 'hex', cellSize: 40 })

  const campaign: Campaign | undefined = campaigns.find((c) => c.id === id)

  useEffect(() => {
    if (campaigns.length === 0) {
      loadCampaigns()
    }
  }, [campaigns.length, loadCampaigns])

  // Load stat blocks for NPCs that have statBlockId
  useEffect(() => {
    if (!campaign) return
    const loadNpcStatBlocks = async (): Promise<void> => {
      const loaded: Record<string, MonsterStatBlock> = {}
      for (const npc of campaign.npcs) {
        if (npc.statBlockId && !npcStatBlocks[npc.statBlockId]) {
          const block = await load5eMonsterById(npc.statBlockId)
          if (block) loaded[npc.statBlockId] = block
        }
      }
      if (Object.keys(loaded).length > 0) {
        setNpcStatBlocks((prev) => ({ ...prev, ...loaded }))
      }
    }
    loadNpcStatBlocks()
  }, [campaign?.npcs, campaign, npcStatBlocks]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (): Promise<void> => {
    if (!id) return
    await deleteCampaign(id)
    addToast('Campaign deleted', 'success')
    navigate('/')
  }

  const handleStartGame = async (): Promise<void> => {
    if (!campaign) return
    setStarting(true)
    try {
      const networkState = useNetworkStore.getState()
      if (networkState.role !== 'none') {
        networkState.disconnect()
      }
      await hostGame('Dungeon Master', campaign.inviteCode)
      navigate(`/lobby/${campaign.id}`)
    } catch (error) {
      console.error('Failed to start game:', error)
      setStarting(false)
    }
  }

  const handleStartSolo = (): void => {
    if (!campaign) return
    const networkState = useNetworkStore.getState()
    if (networkState.role !== 'none') {
      networkState.disconnect()
    }
    navigate(`/game/${campaign.id}`)
  }

  const handleExport = async (): Promise<void> => {
    if (!campaign) return
    setExporting(true)
    try {
      await exportCampaignToFile(campaign)
      addToast('Campaign exported', 'success')
    } catch (error) {
      console.error('Failed to export campaign:', error)
      addToast('Failed to export campaign', 'error')
    } finally {
      setExporting(false)
    }
  }

  // --- NPC handlers ---
  const openAddNPC = (): void => {
    setEditingNPC(null)
    setNpcForm({
      name: '',
      description: '',
      location: '',
      isVisible: true,
      notes: '',
      role: undefined,
      personality: '',
      motivation: '',
      statBlockId: '',
      customStats: undefined,
      statBlockMode: 'none'
    })
    setLinkedMonsterPreview(null)
    setMonsterSearchQuery('')
    setMonsterSearchResults([])
    setShowNPCModal(true)
  }
  const openEditNPC = (npc: NPC): void => {
    setEditingNPC(npc)
    const mode = npc.customStats ? 'custom' : npc.statBlockId ? 'link' : 'none'
    setNpcForm({
      name: npc.name,
      description: npc.description,
      location: npc.location ?? '',
      isVisible: npc.isVisible,
      notes: npc.notes,
      role: npc.role,
      personality: npc.personality ?? '',
      motivation: npc.motivation ?? '',
      statBlockId: npc.statBlockId ?? '',
      customStats: npc.customStats,
      statBlockMode: mode
    })
    setLinkedMonsterPreview(null)
    if (npc.statBlockId) {
      load5eMonsterById(npc.statBlockId).then((m) => {
        if (m) setLinkedMonsterPreview(m)
      })
    }
    setShowNPCModal(true)
  }
  const handleSaveNPC = async (): Promise<void> => {
    if (!campaign || !npcForm.name.trim()) return
    const npcData: Omit<NPC, 'id'> = {
      name: npcForm.name.trim(),
      description: npcForm.description,
      location: npcForm.location || undefined,
      isVisible: npcForm.isVisible,
      notes: npcForm.notes,
      role: npcForm.role,
      personality: npcForm.personality || undefined,
      motivation: npcForm.motivation || undefined,
      statBlockId: npcForm.statBlockMode === 'link' && npcForm.statBlockId ? npcForm.statBlockId : undefined,
      customStats: npcForm.statBlockMode === 'custom' ? npcForm.customStats : undefined
    }
    let npcs: NPC[]
    if (editingNPC) {
      npcs = campaign.npcs.map((n) => (n.id === editingNPC.id ? { ...n, ...npcData } : n))
    } else {
      npcs = [...campaign.npcs, { id: crypto.randomUUID(), ...npcData }]
    }
    await saveCampaign({ ...campaign, npcs, updatedAt: new Date().toISOString() })
    setShowNPCModal(false)
  }
  const handleMonsterSearch = (query: string): void => {
    setMonsterSearchQuery(query)
    if (query.length < 2) {
      setMonsterSearchResults([])
      return
    }
    if (allMonsters.length === 0) {
      loadAllStatBlocks().then((all) => {
        setAllMonsters(all)
        setMonsterSearchResults(searchMonsters(all, query).slice(0, 10))
      })
    } else {
      setMonsterSearchResults(searchMonsters(allMonsters, query).slice(0, 10))
    }
  }
  const handleDeleteNPC = async (npcId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      npcs: campaign.npcs.filter((n) => n.id !== npcId),
      updatedAt: new Date().toISOString()
    })
  }

  // --- Rule handlers ---
  const openAddRule = (): void => {
    setEditingRule(null)
    setRuleForm({ name: '', description: '', category: 'other' })
    setShowRuleModal(true)
  }
  const openEditRule = (rule: CustomRule): void => {
    setEditingRule(rule)
    setRuleForm({ name: rule.name, description: rule.description, category: rule.category })
    setShowRuleModal(true)
  }
  const handleSaveRule = async (): Promise<void> => {
    if (!campaign || !ruleForm.name.trim()) return
    let customRules: CustomRule[]
    if (editingRule) {
      customRules = campaign.customRules.map((r) =>
        r.id === editingRule.id ? { ...r, ...ruleForm, name: ruleForm.name.trim() } : r
      )
    } else {
      customRules = [...campaign.customRules, { id: crypto.randomUUID(), ...ruleForm, name: ruleForm.name.trim() }]
    }
    await saveCampaign({ ...campaign, customRules, updatedAt: new Date().toISOString() })
    setShowRuleModal(false)
  }
  const handleDeleteRule = async (ruleId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      customRules: campaign.customRules.filter((r) => r.id !== ruleId),
      updatedAt: new Date().toISOString()
    })
  }

  // --- Lore handlers ---
  const openAddLore = (): void => {
    setEditingLore(null)
    setLoreForm({ title: '', content: '', category: 'world', isVisibleToPlayers: false })
    setShowLoreModal(true)
  }
  const openEditLore = (entry: LoreEntry): void => {
    setEditingLore(entry)
    setLoreForm({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      isVisibleToPlayers: entry.isVisibleToPlayers
    })
    setShowLoreModal(true)
  }
  const handleSaveLore = async (): Promise<void> => {
    if (!campaign || !loreForm.title.trim()) return
    const lore = campaign.lore ?? []
    let newLore: LoreEntry[]
    if (editingLore) {
      newLore = lore.map((l) => (l.id === editingLore.id ? { ...l, ...loreForm, title: loreForm.title.trim() } : l))
    } else {
      newLore = [
        ...lore,
        { id: crypto.randomUUID(), ...loreForm, title: loreForm.title.trim(), createdAt: new Date().toISOString() }
      ]
    }
    await saveCampaign({ ...campaign, lore: newLore, updatedAt: new Date().toISOString() })
    setShowLoreModal(false)
  }
  const handleDeleteLore = async (loreId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      lore: (campaign.lore ?? []).filter((l) => l.id !== loreId),
      updatedAt: new Date().toISOString()
    })
  }
  const handleToggleLoreVisibility = async (loreId: string): Promise<void> => {
    if (!campaign) return
    const lore = (campaign.lore ?? []).map((l) =>
      l.id === loreId ? { ...l, isVisibleToPlayers: !l.isVisibleToPlayers } : l
    )
    await saveCampaign({ ...campaign, lore, updatedAt: new Date().toISOString() })
  }

  // --- Map handlers ---
  const handleDeleteMap = async (mapId: string): Promise<void> => {
    if (!campaign) return
    const maps = campaign.maps.filter((m) => m.id !== mapId)
    const activeMapId =
      campaign.activeMapId === mapId ? (maps.length > 0 ? maps[0].id : undefined) : campaign.activeMapId
    await saveCampaign({ ...campaign, maps, activeMapId, updatedAt: new Date().toISOString() })
  }

  const handleAddMap = async (): Promise<void> => {
    if (!campaign || !mapForm.name.trim()) return
    const newMap: GameMap = {
      id: crypto.randomUUID(),
      name: mapForm.name.trim(),
      campaignId: campaign.id,
      imagePath: '',
      width: 1600,
      height: 1200,
      grid: {
        enabled: true,
        cellSize: mapForm.cellSize,
        offsetX: 0,
        offsetY: 0,
        color: '#4b5563',
        opacity: 0.4,
        type: mapForm.gridType
      },
      tokens: [],
      fogOfWar: { enabled: false, revealedCells: [] },
      terrain: [],
      createdAt: new Date().toISOString()
    }
    const maps = [...campaign.maps, newMap]
    await saveCampaign({
      ...campaign,
      maps,
      activeMapId: campaign.activeMapId ?? newMap.id,
      updatedAt: new Date().toISOString()
    })
    setShowMapModal(false)
    setMapForm({ name: '', gridType: 'square', cellSize: 40 })
  }

  if (loading) {
    return (
      <div className="p-8 h-screen overflow-y-auto">
        <BackButton to="/" />
        <div className="text-center text-gray-500 py-12">Loading campaign...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-8 h-screen overflow-y-auto">
        <BackButton to="/" />
        <div className="text-center text-gray-500 py-12">
          <p className="text-xl mb-2">Campaign not found</p>
          <p className="text-sm">This campaign may have been deleted.</p>
        </div>
      </div>
    )
  }

  const systemConfig = GAME_SYSTEMS[campaign.system]
  const lore = campaign.lore ?? []

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <BackButton to="/" />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">{campaign.name}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{systemConfig.name}</span>
            <span className="text-gray-600">|</span>
            <span className="capitalize">{campaign.type} campaign</span>
            <span className="text-gray-600">|</span>
            <span>
              Invite: <span className="text-amber-400 font-mono">{campaign.inviteCode}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </Button>
          <Button variant="secondary" onClick={handleStartSolo}>
            Solo Play
          </Button>
          <Button onClick={handleStartGame} disabled={starting}>
            {starting ? 'Starting...' : 'Host Game'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Overview */}
        <Card title="Overview">
          {campaign.description ? (
            <p className="text-gray-300 text-sm mb-4">{campaign.description}</p>
          ) : (
            <p className="text-gray-500 text-sm italic mb-4">No description</p>
          )}
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-400">Turn Mode</span>
            <span className="capitalize">{campaign.turnMode}</span>
            <span className="text-gray-400">Max Players</span>
            <span>{campaign.settings.maxPlayers}</span>
            <span className="text-gray-400">Level Range</span>
            <span>
              {campaign.settings.levelRange.min} - {campaign.settings.levelRange.max}
            </span>
            <span className="text-gray-400">Created</span>
            <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
          {campaign.settings.lobbyMessage && (
            <div className="mt-4 pt-3 border-t border-gray-800">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Lobby Message</span>
              <p className="text-gray-300 text-sm mt-1">{campaign.settings.lobbyMessage}</p>
            </div>
          )}
        </Card>

        {/* Maps */}
        <Card title={`Maps (${campaign.maps.length})`}>
          {campaign.maps.length === 0 ? (
            <p className="text-gray-500 text-sm">No maps configured yet.</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                // Compute name counts for disambiguation
                const nameCounts: Record<string, number> = {}
                const nameIndex: Record<string, number> = {}
                for (const m of campaign.maps) {
                  nameCounts[m.name] = (nameCounts[m.name] || 0) + 1
                }
                return campaign.maps.map((map) => {
                  let displayName = map.name
                  if (nameCounts[map.name] > 1) {
                    nameIndex[map.name] = (nameIndex[map.name] || 0) + 1
                    displayName = `${map.name} (${nameIndex[map.name]})`
                  }
                  return (
                    <div key={map.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                      <div>
                        <span className="font-semibold text-sm">{displayName}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {map.grid.type} grid, {map.grid.cellSize}px
                        </span>
                        <span className="text-gray-600 text-xs ml-1">
                          {map.width}x{map.height}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {campaign.activeMapId === map.id && (
                          <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteMap(map.id)}
                          className="text-xs text-gray-400 hover:text-red-400 cursor-pointer"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
          <button
            onClick={() => setShowMapModal(true)}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Add Map
          </button>
        </Card>

        {/* NPCs */}
        <Card title={`NPCs (${campaign.npcs.length})`}>
          {campaign.npcs.length === 0 ? (
            <p className="text-gray-500 text-sm">No NPCs added yet.</p>
          ) : (
            <div className="space-y-2">
              {campaign.npcs.map((npc) => {
                const npcLinkedBlock = npc.statBlockId ? npcStatBlocks[npc.statBlockId] : undefined
                const npcBlock = npc.customStats ?? npcLinkedBlock
                const isStatExpanded = expandedNpcStatBlock === npc.id
                return (
                  <div key={npc.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm">{npc.name}</span>
                        {npc.role && <span className="text-[10px] text-gray-400 ml-2 capitalize">{npc.role}</span>}
                        {npc.location && <span className="text-gray-500 text-xs ml-2">{npc.location}</span>}
                        {npc.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{npc.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            npc.isVisible ? 'bg-green-900/40 text-green-300' : 'bg-gray-800 text-gray-500'
                          }`}
                        >
                          {npc.isVisible ? 'Visible' : 'Hidden'}
                        </span>
                        <button
                          onClick={() => openEditNPC(npc)}
                          className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNPC(npc.id)}
                          className="text-xs text-gray-400 hover:text-red-400 cursor-pointer"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                    {/* Expandable stat block */}
                    {npcBlock ? (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedNpcStatBlock(isStatExpanded ? null : npc.id)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                        >
                          {isStatExpanded ? 'Hide Stat Block' : `Show Stat Block (${npcBlock.name ?? npc.name})`}
                        </button>
                        {isStatExpanded && (
                          <div className="mt-1 max-h-80 overflow-y-auto">
                            <MonsterStatBlockView monster={npcBlock as MonsterStatBlock} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1">
                        <button
                          onClick={() => openEditNPC(npc)}
                          className="text-[10px] text-gray-500 hover:text-amber-400 cursor-pointer"
                        >
                          No stat block — click Edit to assign
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={openAddNPC} className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
            + Add NPC
          </button>
        </Card>

        {/* Custom Rules */}
        <Card title={`Custom Rules (${campaign.customRules.length})`}>
          {campaign.customRules.length === 0 ? (
            <p className="text-gray-500 text-sm">No house rules configured.</p>
          ) : (
            <div className="space-y-2">
              {campaign.customRules.map((rule) => (
                <div key={rule.id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{rule.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rule.category]}`}>
                        {rule.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditRule(rule)}
                        className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-xs text-gray-400 hover:text-red-400 cursor-pointer"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                  {rule.description && <p className="text-gray-400 text-xs">{rule.description}</p>}
                </div>
              ))}
            </div>
          )}
          <button onClick={openAddRule} className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
            + Add Rule
          </button>
        </Card>

        {/* Lore */}
        <Card title={`Lore (${lore.length})`}>
          {lore.length === 0 ? (
            <p className="text-gray-500 text-sm">No lore entries yet. Add world details, factions, and locations.</p>
          ) : (
            <div className="space-y-2">
              {lore.map((entry) => (
                <div key={entry.id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{entry.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${LORE_CATEGORY_COLORS[entry.category]}`}>
                        {entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleLoreVisibility(entry.id)}
                        className={`text-xs cursor-pointer ${entry.isVisibleToPlayers ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}`}
                        title={entry.isVisibleToPlayers ? 'Visible to players' : 'DM only'}
                      >
                        {entry.isVisibleToPlayers ? '\u{1F441}' : '\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}\u{FE0F}'}
                      </button>
                      <button
                        onClick={() => openEditLore(entry)}
                        className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLore(entry.id)}
                        className="text-xs text-gray-400 hover:text-red-400 cursor-pointer"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs line-clamp-2">{entry.content}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={openAddLore} className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
            + Add Lore
          </button>
        </Card>

        {/* Players */}
        <Card title={`Previous Players (${campaign.players.length})`}>
          <p className="text-gray-500 text-sm mb-3">
            Players join your campaign through the lobby when you host a game.
          </p>
          {campaign.players.length > 0 && (
            <div className="space-y-2">
              {campaign.players.map((player) => (
                <div key={player.userId} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <div>
                    <span className="font-semibold text-sm">{player.displayName}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      Joined {new Date(player.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Session Zero */}
        {campaign.sessionZero && (
          <Card title="Session Zero">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Tone:</span>
                <span className="text-gray-200 capitalize">{campaign.sessionZero.tone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">PvP:</span>
                <span className={campaign.sessionZero.pvpAllowed ? 'text-red-400' : 'text-green-400'}>
                  {campaign.sessionZero.pvpAllowed ? 'Allowed' : 'Not Allowed'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Character Death:</span>
                <span className="text-gray-200 capitalize">{campaign.sessionZero.characterDeathExpectation}</span>
              </div>
              {campaign.sessionZero.contentLimits.length > 0 && (
                <div>
                  <span className="text-gray-500">Content Limits:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {campaign.sessionZero.contentLimits.map((l) => (
                      <span key={l} className="text-[10px] bg-red-900/30 text-red-300 px-2 py-0.5 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.sessionZero.playSchedule && (
                <div>
                  <span className="text-gray-500">Schedule:</span>{' '}
                  <span className="text-gray-200">{campaign.sessionZero.playSchedule}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Magic Item Tracker */}
        <Card title="Magic Items Distributed">
          <MagicItemTracker campaign={campaign} />
        </Card>

        {/* Adventures */}
        <Card title={`Adventures (${(campaign.adventures ?? []).length})`}>
          {showAdventureWizard ? (
            <AdventureWizard
              onSave={(adventureData: AdventureData) => {
                const entry = {
                  id: crypto.randomUUID(),
                  ...adventureData,
                  createdAt: new Date().toISOString()
                }
                saveCampaign({
                  ...campaign,
                  adventures: [...(campaign.adventures ?? []), entry],
                  updatedAt: new Date().toISOString()
                })
                setShowAdventureWizard(false)
              }}
              onCancel={() => setShowAdventureWizard(false)}
            />
          ) : (
            <>
              {(campaign.adventures ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm mb-3">
                  No adventures planned yet. Use the DMG 4-step process to create one.
                </p>
              ) : (
                <div className="space-y-2 mb-3">
                  {(campaign.adventures ?? []).map((adv) => (
                    <div key={adv.id} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-200">{adv.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                            Lvl {adv.levelTier}
                          </span>
                          <button
                            onClick={() => {
                              saveCampaign({
                                ...campaign,
                                adventures: (campaign.adventures ?? []).filter((a) => a.id !== adv.id),
                                updatedAt: new Date().toISOString()
                              })
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-2">{adv.premise}</div>
                      {adv.villain && (
                        <div className="text-[10px] text-gray-500 mt-1">Antagonist: {adv.villain}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowAdventureWizard(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                + Create Adventure
              </button>
            </>
          )}
        </Card>

        {/* AI Dungeon Master */}
        <Card title="AI Dungeon Master">
          {campaign.aiDm?.enabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Enabled</span>
                <span className="text-xs text-gray-400 capitalize">{campaign.aiDm.provider}</span>
                <span className="text-xs text-gray-500">
                  {campaign.aiDm.provider === 'claude' ? campaign.aiDm.model : (campaign.aiDm.ollamaModel ?? 'default')}
                </span>
              </div>
              <button
                onClick={() => {
                  setAiDmConfig({
                    enabled: campaign.aiDm?.enabled ?? false,
                    provider: campaign.aiDm?.provider ?? 'claude',
                    model: campaign.aiDm?.model ?? 'sonnet',
                    apiKey: '',
                    ollamaModel: campaign.aiDm?.ollamaModel ?? 'mistral'
                  })
                  setShowAiDmModal(true)
                }}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Configure
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-500 text-sm mb-2">AI DM is not enabled for this campaign.</p>
              <button
                onClick={() => {
                  setAiDmConfig({
                    enabled: true,
                    provider: 'claude',
                    model: 'sonnet',
                    apiKey: '',
                    ollamaModel: 'mistral'
                  })
                  setShowAiDmModal(true)
                }}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Enable AI DM
              </button>
            </div>
          )}
        </Card>

        {/* Calendar */}
        <Card title="Calendar">
          {campaign.calendar ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Preset:</span>
                <span className="text-gray-200 capitalize">{campaign.calendar.preset.replace(/-/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Months:</span>
                <span className="text-gray-200">{campaign.calendar.months.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Days per Year:</span>
                <span className="text-gray-200">{campaign.calendar.daysPerYear}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Starting Year:</span>
                <span className="text-gray-200">{campaign.calendar.startingYear} {campaign.calendar.yearLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Hours per Day:</span>
                <span className="text-gray-200">{campaign.calendar.hoursPerDay}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Exact Time:</span>
                <span className="text-gray-200 capitalize">{campaign.calendar.exactTimeDefault}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No calendar configured.</p>
          )}
        </Card>

        {/* Voice Chat */}
        <Card title="Voice Chat">
          {campaign.voiceChat ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Configured</span>
                <span className="text-gray-200 capitalize">{campaign.voiceChat.mode}</span>
              </div>
              {campaign.voiceChat.serverUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Server:</span>
                  <span className="text-gray-200 text-xs truncate">{campaign.voiceChat.serverUrl}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Voice chat not configured.</p>
          )}
        </Card>

        {/* Custom Audio */}
        <Card title={`Custom Audio (${(campaign.customAudio ?? []).length})`}>
          {(campaign.customAudio ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">No custom audio files added.</p>
          ) : (
            <div className="space-y-2">
              {(campaign.customAudio ?? []).map((audio) => (
                <div key={audio.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <div>
                    <span className="font-semibold text-sm">{audio.displayName}</span>
                    <span className="text-gray-500 text-xs ml-2">{audio.fileName}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    audio.category === 'music' ? 'bg-purple-900/40 text-purple-300' :
                    audio.category === 'ambient' ? 'bg-blue-900/40 text-blue-300' :
                    'bg-amber-900/40 text-amber-300'
                  }`}>
                    {audio.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Journal */}
        <Card title={`Session Journal (${campaign.journal.entries.length})`}>
          {campaign.journal.entries.length === 0 ? (
            <p className="text-gray-500 text-sm">No journal entries yet. Entries are created during and after game sessions.</p>
          ) : (
            <div className="space-y-2">
              {campaign.journal.entries
                .slice()
                .sort((a, b) => b.sessionNumber - a.sessionNumber)
                .map((entry) => (
                  <div key={entry.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        Session {entry.sessionNumber}: {entry.title}
                      </span>
                      <span className="text-gray-500 text-xs">{new Date(entry.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2">{entry.content}</p>
                    {entry.isPrivate && <span className="text-xs text-yellow-400 mt-1 inline-block">DM Only</span>}
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Campaign?"
        message={`This action cannot be undone. The campaign "${campaign.name}" and all its data will be permanently deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* NPC Modal */}
      <Modal open={showNPCModal} onClose={() => setShowNPCModal(false)} title={editingNPC ? 'Edit NPC' : 'Add NPC'}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Quick Add from Bestiary */}
          <div className="border border-amber-800/30 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-amber-900/20">
              <label className="block text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Quick Add from Bestiary
              </label>
              <input
                type="text"
                value={monsterSearchQuery}
                onChange={(e) => handleMonsterSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                placeholder="Search monsters by name, type, or tag..."
              />
            </div>
            {monsterSearchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border-t border-gray-700">
                {monsterSearchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setNpcForm((f) => ({
                        ...f,
                        name: m.name,
                        role: 'enemy',
                        description: `${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ''}, CR ${m.cr}`,
                        statBlockId: m.id,
                        statBlockMode: 'link'
                      }))
                      setLinkedMonsterPreview(m)
                      setMonsterSearchQuery(m.name)
                      setMonsterSearchResults([])
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700/50 cursor-pointer flex items-center justify-between border-b border-gray-700/30 last:border-b-0"
                  >
                    <span className="text-gray-200 font-medium">{m.name}</span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-gray-500">{m.size} {m.type}</span>
                      <span className="text-amber-400 font-mono">CR {m.cr}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {linkedMonsterPreview && npcForm.statBlockMode === 'link' && monsterSearchResults.length === 0 && (
              <div className="border-t border-gray-700/50 p-2">
                <MonsterStatBlockView monster={linkedMonsterPreview} compact />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">Name *</label>
              <input
                type="text"
                value={npcForm.name}
                onChange={(e) => setNpcForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                placeholder="NPC name"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Role</label>
              <select
                value={npcForm.role ?? ''}
                onChange={(e) =>
                  setNpcForm((f) => ({ ...f, role: e.target.value ? (e.target.value as NPC['role']) : undefined }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">None</option>
                <option value="ally">Ally</option>
                <option value="enemy">Enemy</option>
                <option value="neutral">Neutral</option>
                <option value="patron">Patron</option>
                <option value="shopkeeper">Shopkeeper</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Location</label>
              <input
                type="text"
                value={npcForm.location}
                onChange={(e) => setNpcForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                placeholder="Where they can be found"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Description</label>
            <textarea
              value={npcForm.description}
              onChange={(e) => setNpcForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-16 resize-none"
              placeholder="Brief description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Personality</label>
              <input
                type="text"
                value={npcForm.personality}
                onChange={(e) => setNpcForm((f) => ({ ...f, personality: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                placeholder="Gruff but kind-hearted"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Motivation</label>
              <input
                type="text"
                value={npcForm.motivation}
                onChange={(e) => setNpcForm((f) => ({ ...f, motivation: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                placeholder="Protect the village"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Notes</label>
            <textarea
              value={npcForm.notes}
              onChange={(e) => setNpcForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-16 resize-none"
              placeholder="DM notes"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={npcForm.isVisible}
              onChange={(e) => setNpcForm((f) => ({ ...f, isVisible: e.target.checked }))}
              className="rounded"
            />
            Visible to players
          </label>

          {/* Stat Block Section */}
          <div className="border-t border-gray-700 pt-3">
            <label className="block text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wider">
              Stat Block
            </label>
            <div className="flex gap-2 mb-2">
              {(['none', 'link', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setNpcForm((f) => ({ ...f, statBlockMode: mode }))}
                  className={`px-3 py-1 text-xs rounded-lg cursor-pointer ${
                    npcForm.statBlockMode === mode
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {mode === 'none' ? 'None' : mode === 'link' ? 'Link to Monster' : 'Custom'}
                </button>
              ))}
            </div>

            {npcForm.statBlockMode === 'link' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={monsterSearchQuery}
                  onChange={(e) => handleMonsterSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                  placeholder="Search monsters..."
                />
                {monsterSearchResults.length > 0 && (
                  <div className="bg-gray-800 border border-gray-700 rounded max-h-40 overflow-y-auto">
                    {monsterSearchResults.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setNpcForm((f) => ({ ...f, statBlockId: m.id }))
                          setLinkedMonsterPreview(m)
                          setMonsterSearchQuery(m.name)
                          setMonsterSearchResults([])
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 cursor-pointer flex items-center justify-between ${
                          npcForm.statBlockId === m.id ? 'text-amber-400' : 'text-gray-300'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span className="text-gray-500">{m.type} &middot; CR {m.cr}</span>
                      </button>
                    ))}
                  </div>
                )}
                {linkedMonsterPreview && (
                  <div className="mt-2">
                    <MonsterStatBlockView monster={linkedMonsterPreview} compact />
                  </div>
                )}
              </div>
            )}

            {npcForm.statBlockMode === 'custom' && (
              <StatBlockEditor
                value={npcForm.customStats ?? { name: npcForm.name }}
                onChange={(stats) => setNpcForm((f) => ({ ...f, customStats: stats }))}
              />
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowNPCModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveNPC} disabled={!npcForm.name.trim()}>
            {editingNPC ? 'Save' : 'Add'}
          </Button>
        </div>
      </Modal>

      {/* Rule Modal */}
      <Modal
        open={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? 'Edit Rule' : 'Add Rule'}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Rule Name *</label>
            <input
              type="text"
              value={ruleForm.name}
              onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="Rule name"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Category</label>
            <select
              value={ruleForm.category}
              onChange={(e) => setRuleForm((f) => ({ ...f, category: e.target.value as CustomRule['category'] }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="combat">Combat</option>
              <option value="exploration">Exploration</option>
              <option value="social">Social</option>
              <option value="rest">Rest</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Description</label>
            <textarea
              value={ruleForm.description}
              onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-20 resize-none"
              placeholder="Rule description"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowRuleModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveRule} disabled={!ruleForm.name.trim()}>
            {editingRule ? 'Save' : 'Add'}
          </Button>
        </div>
      </Modal>

      {/* Lore Modal */}
      <Modal
        open={showLoreModal}
        onClose={() => setShowLoreModal(false)}
        title={editingLore ? 'Edit Lore' : 'Add Lore'}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Title *</label>
            <input
              type="text"
              value={loreForm.title}
              onChange={(e) => setLoreForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="Lore title"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Category</label>
            <select
              value={loreForm.category}
              onChange={(e) => setLoreForm((f) => ({ ...f, category: e.target.value as LoreEntry['category'] }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="world">World</option>
              <option value="faction">Faction</option>
              <option value="location">Location</option>
              <option value="item">Item</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Content</label>
            <textarea
              value={loreForm.content}
              onChange={(e) => setLoreForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-32 resize-none"
              placeholder="Lore content"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={loreForm.isVisibleToPlayers}
              onChange={(e) => setLoreForm((f) => ({ ...f, isVisibleToPlayers: e.target.checked }))}
              className="rounded"
            />
            Visible to players
          </label>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowLoreModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveLore} disabled={!loreForm.title.trim()}>
            {editingLore ? 'Save' : 'Add'}
          </Button>
        </div>
      </Modal>

      {/* AI DM Config Modal */}
      <Modal open={showAiDmModal} onClose={() => setShowAiDmModal(false)} title="Configure AI Dungeon Master">
        <div className="max-h-[60vh] overflow-y-auto">
          <AiDmStep
            enabled={aiDmConfig.enabled}
            provider={aiDmConfig.provider}
            model={aiDmConfig.model}
            apiKey={aiDmConfig.apiKey}
            ollamaModel={aiDmConfig.ollamaModel}
            onOllamaReady={() => {}}
            onChange={(data) => setAiDmConfig(data)}
          />
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowAiDmModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!campaign) return
              const aiDm = {
                enabled: aiDmConfig.enabled,
                provider: aiDmConfig.provider,
                model: aiDmConfig.model,
                ollamaModel: aiDmConfig.provider === 'ollama' ? aiDmConfig.ollamaModel : undefined
              }
              await saveCampaign({ ...campaign, aiDm, updatedAt: new Date().toISOString() })
              if (aiDmConfig.provider === 'claude' && aiDmConfig.apiKey) {
                try {
                  await window.api.ai.configure({
                    provider: 'claude',
                    model: aiDmConfig.model,
                    apiKey: aiDmConfig.apiKey
                  })
                } catch {
                  /* ignore configure errors */
                }
              }
              setShowAiDmModal(false)
            }}
          >
            Save
          </Button>
        </div>
      </Modal>

      {/* Map Modal */}
      <Modal open={showMapModal} onClose={() => setShowMapModal(false)} title="Add Map">
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Map Name *</label>
            <input
              type="text"
              value={mapForm.name}
              onChange={(e) => setMapForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="Map name"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Grid Type</label>
            <select
              value={mapForm.gridType}
              onChange={(e) => setMapForm((f) => ({ ...f, gridType: e.target.value as 'square' | 'hex' }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="square">Square</option>
              <option value="hex">Hex</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 text-xs">Cell Size (px)</label>
              <button
                onClick={() => setMapForm((f) => ({ ...f, cellSize: 40 }))}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                  mapForm.cellSize === 40
                    ? 'border-amber-500/50 text-amber-300 bg-amber-900/10'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                Reset to Default (40px)
              </button>
            </div>
            <input
              type="number"
              value={mapForm.cellSize}
              onChange={(e) => setMapForm((f) => ({ ...f, cellSize: parseInt(e.target.value, 10) || 40 }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              min={10}
              max={200}
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowMapModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddMap} disabled={!mapForm.name.trim()}>
            Add Map
          </Button>
        </div>
      </Modal>
    </div>
  )
}
