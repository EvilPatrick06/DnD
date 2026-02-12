import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useCampaignStore } from '../stores/useCampaignStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import { exportCampaignToFile } from '../services/campaign-io'
import { GAME_SYSTEMS } from '../types/game-system'
import type { Campaign, NPC, CustomRule, LoreEntry } from '../types/campaign'
import type { GameMap } from '../types/map'
import { BackButton, Button, Card, Modal } from '../components/ui'

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

  // NPC state
  const [showNPCModal, setShowNPCModal] = useState(false)
  const [editingNPC, setEditingNPC] = useState<NPC | null>(null)
  const [npcForm, setNpcForm] = useState({ name: '', description: '', location: '', isVisible: true, notes: '' })

  // Rule state
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  const [ruleForm, setRuleForm] = useState({ name: '', description: '', category: 'other' as CustomRule['category'] })

  // Lore state
  const [showLoreModal, setShowLoreModal] = useState(false)
  const [editingLore, setEditingLore] = useState<LoreEntry | null>(null)
  const [loreForm, setLoreForm] = useState({ title: '', content: '', category: 'world' as LoreEntry['category'], isVisibleToPlayers: false })

  // Map state
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapForm, setMapForm] = useState({ name: '', gridType: 'square' as 'square' | 'hex', cellSize: 40 })

  useEffect(() => {
    if (campaigns.length === 0) {
      loadCampaigns()
    }
  }, [campaigns.length, loadCampaigns])

  const campaign: Campaign | undefined = campaigns.find((c) => c.id === id)

  const handleDelete = async (): Promise<void> => {
    if (!id) return
    await deleteCampaign(id)
    navigate('/')
  }

  const handleStartGame = async (): Promise<void> => {
    if (!campaign) return
    setStarting(true)
    try {
      await hostGame('Dungeon Master', campaign.inviteCode)
      navigate(`/lobby/${campaign.id}`)
    } catch (error) {
      console.error('Failed to start game:', error)
      setStarting(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!campaign) return
    setExporting(true)
    try {
      await exportCampaignToFile(campaign)
    } catch (error) {
      console.error('Failed to export campaign:', error)
    } finally {
      setExporting(false)
    }
  }

  // --- NPC handlers ---
  const openAddNPC = (): void => {
    setEditingNPC(null)
    setNpcForm({ name: '', description: '', location: '', isVisible: true, notes: '' })
    setShowNPCModal(true)
  }
  const openEditNPC = (npc: NPC): void => {
    setEditingNPC(npc)
    setNpcForm({ name: npc.name, description: npc.description, location: npc.location ?? '', isVisible: npc.isVisible, notes: npc.notes })
    setShowNPCModal(true)
  }
  const handleSaveNPC = async (): Promise<void> => {
    if (!campaign || !npcForm.name.trim()) return
    let npcs: NPC[]
    if (editingNPC) {
      npcs = campaign.npcs.map((n) => n.id === editingNPC.id ? { ...n, ...npcForm, name: npcForm.name.trim() } : n)
    } else {
      npcs = [...campaign.npcs, { id: crypto.randomUUID(), ...npcForm, name: npcForm.name.trim() }]
    }
    await saveCampaign({ ...campaign, npcs, updatedAt: new Date().toISOString() })
    setShowNPCModal(false)
  }
  const handleDeleteNPC = async (npcId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({ ...campaign, npcs: campaign.npcs.filter((n) => n.id !== npcId), updatedAt: new Date().toISOString() })
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
      customRules = campaign.customRules.map((r) => r.id === editingRule.id ? { ...r, ...ruleForm, name: ruleForm.name.trim() } : r)
    } else {
      customRules = [...campaign.customRules, { id: crypto.randomUUID(), ...ruleForm, name: ruleForm.name.trim() }]
    }
    await saveCampaign({ ...campaign, customRules, updatedAt: new Date().toISOString() })
    setShowRuleModal(false)
  }
  const handleDeleteRule = async (ruleId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({ ...campaign, customRules: campaign.customRules.filter((r) => r.id !== ruleId), updatedAt: new Date().toISOString() })
  }

  // --- Lore handlers ---
  const openAddLore = (): void => {
    setEditingLore(null)
    setLoreForm({ title: '', content: '', category: 'world', isVisibleToPlayers: false })
    setShowLoreModal(true)
  }
  const openEditLore = (entry: LoreEntry): void => {
    setEditingLore(entry)
    setLoreForm({ title: entry.title, content: entry.content, category: entry.category, isVisibleToPlayers: entry.isVisibleToPlayers })
    setShowLoreModal(true)
  }
  const handleSaveLore = async (): Promise<void> => {
    if (!campaign || !loreForm.title.trim()) return
    const lore = campaign.lore ?? []
    let newLore: LoreEntry[]
    if (editingLore) {
      newLore = lore.map((l) => l.id === editingLore.id ? { ...l, ...loreForm, title: loreForm.title.trim() } : l)
    } else {
      newLore = [...lore, { id: crypto.randomUUID(), ...loreForm, title: loreForm.title.trim(), createdAt: new Date().toISOString() }]
    }
    await saveCampaign({ ...campaign, lore: newLore, updatedAt: new Date().toISOString() })
    setShowLoreModal(false)
  }
  const handleDeleteLore = async (loreId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({ ...campaign, lore: (campaign.lore ?? []).filter((l) => l.id !== loreId), updatedAt: new Date().toISOString() })
  }
  const handleToggleLoreVisibility = async (loreId: string): Promise<void> => {
    if (!campaign) return
    const lore = (campaign.lore ?? []).map((l) => l.id === loreId ? { ...l, isVisibleToPlayers: !l.isVisibleToPlayers } : l)
    await saveCampaign({ ...campaign, lore, updatedAt: new Date().toISOString() })
  }

  // --- Map handlers ---
  const handleDeleteMap = async (mapId: string): Promise<void> => {
    if (!campaign) return
    const maps = campaign.maps.filter((m) => m.id !== mapId)
    const activeMapId = campaign.activeMapId === mapId
      ? (maps.length > 0 ? maps[0].id : undefined)
      : campaign.activeMapId
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
      createdAt: new Date().toISOString()
    }
    const maps = [...campaign.maps, newMap]
    await saveCampaign({ ...campaign, maps, activeMapId: campaign.activeMapId ?? newMap.id, updatedAt: new Date().toISOString() })
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
            <span>Invite: <span className="text-amber-400 font-mono">{campaign.inviteCode}</span></span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </Button>
          <Button onClick={handleStartGame} disabled={starting}>
            {starting ? 'Starting...' : 'Start Game'}
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
            <span>{campaign.settings.levelRange.min} - {campaign.settings.levelRange.max}</span>
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
              {campaign.maps.map((map) => (
                <div
                  key={map.id}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div>
                    <span className="font-semibold text-sm">{map.name}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      {map.grid.type} grid, {map.grid.cellSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {campaign.activeMapId === map.id && (
                      <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                    <button onClick={() => handleDeleteMap(map.id)} className="text-xs text-gray-400 hover:text-red-400 cursor-pointer">Del</button>
                  </div>
                </div>
              ))}
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
              {campaign.npcs.map((npc) => (
                <div
                  key={npc.id}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{npc.name}</span>
                    {npc.location && (
                      <span className="text-gray-500 text-xs ml-2">{npc.location}</span>
                    )}
                    {npc.description && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{npc.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        npc.isVisible
                          ? 'bg-green-900/40 text-green-300'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {npc.isVisible ? 'Visible' : 'Hidden'}
                    </span>
                    <button onClick={() => openEditNPC(npc)} className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer">Edit</button>
                    <button onClick={() => handleDeleteNPC(npc.id)} className="text-xs text-gray-400 hover:text-red-400 cursor-pointer">Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={openAddNPC}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
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
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rule.category]}`}
                      >
                        {rule.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditRule(rule)} className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer">Edit</button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="text-xs text-gray-400 hover:text-red-400 cursor-pointer">Del</button>
                    </div>
                  </div>
                  {rule.description && (
                    <p className="text-gray-400 text-xs">{rule.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={openAddRule}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
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
                      <button onClick={() => openEditLore(entry)} className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer">Edit</button>
                      <button onClick={() => handleDeleteLore(entry.id)} className="text-xs text-gray-400 hover:text-red-400 cursor-pointer">Del</button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs line-clamp-2">{entry.content}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={openAddLore}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Add Lore
          </button>
        </Card>

        {/* Players */}
        <Card title={`Players (${campaign.players.length})`}>
          {campaign.players.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No players have joined yet. Share the invite code <span className="text-amber-400 font-mono">{campaign.inviteCode}</span> to invite players.
            </p>
          ) : (
            <div className="space-y-2">
              {campaign.players.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div>
                    <span className="font-semibold text-sm">{player.displayName}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      Joined {new Date(player.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.isReady && (
                      <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        player.isActive ? 'bg-green-400' : 'bg-gray-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Journal */}
        <Card title={`Session Journal (${campaign.journal.entries.length})`}>
          {campaign.journal.entries.length === 0 ? (
            <p className="text-gray-500 text-sm">No journal entries yet. Entries are created after game sessions.</p>
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
                      <span className="text-gray-500 text-xs">
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2">{entry.content}</p>
                    {entry.isPrivate && (
                      <span className="text-xs text-yellow-400 mt-1 inline-block">DM Only</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Campaign?"
      >
        <p className="text-gray-400 text-sm mb-4">
          This action cannot be undone. The campaign &ldquo;{campaign.name}&rdquo; and all its data will be permanently deleted.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* NPC Modal */}
      <Modal
        open={showNPCModal}
        onClose={() => setShowNPCModal(false)}
        title={editingNPC ? 'Edit NPC' : 'Add NPC'}
      >
        <div className="space-y-3">
          <div>
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
            <label className="block text-gray-400 text-xs mb-1">Description</label>
            <textarea
              value={npcForm.description}
              onChange={(e) => setNpcForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-20 resize-none"
              placeholder="Brief description"
            />
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
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowNPCModal(false)}>Cancel</Button>
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
          <Button variant="secondary" onClick={() => setShowRuleModal(false)}>Cancel</Button>
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
          <Button variant="secondary" onClick={() => setShowLoreModal(false)}>Cancel</Button>
          <Button onClick={handleSaveLore} disabled={!loreForm.title.trim()}>
            {editingLore ? 'Save' : 'Add'}
          </Button>
        </div>
      </Modal>

      {/* Map Modal */}
      <Modal
        open={showMapModal}
        onClose={() => setShowMapModal(false)}
        title="Add Map"
      >
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
            <label className="block text-gray-400 text-xs mb-1">Cell Size (px)</label>
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
          <Button variant="secondary" onClick={() => setShowMapModal(false)}>Cancel</Button>
          <Button onClick={handleAddMap} disabled={!mapForm.name.trim()}>Add Map</Button>
        </div>
      </Modal>
    </div>
  )
}
