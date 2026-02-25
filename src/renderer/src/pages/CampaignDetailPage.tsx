import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { CustomAudioEntry } from '../components/campaign/AudioStep'
import AudioStep from '../components/campaign/AudioStep'
import CalendarStep from '../components/campaign/CalendarStep'
import OllamaSetupStep from '../components/campaign/OllamaSetupStep'
import type { SessionZeroData } from '../components/campaign/SessionZeroStep'
import SessionZeroStep from '../components/campaign/SessionZeroStep'
import { BackButton, Button, Card, ConfirmDialog, Modal } from '../components/ui'
import { addToast } from '../hooks/use-toast'
import { exportCampaignToFile } from '../services/io/campaign-io'
import { exportEntities, importEntities, reIdItems } from '../services/io/entity-io'
import { useCampaignStore } from '../stores/use-campaign-store'
import { useNetworkStore } from '../stores/use-network-store'
import type { CalendarConfig, Campaign, CustomRule, TurnMode } from '../types/campaign'
import { GAME_SYSTEMS } from '../types/game-system'
import type { GameMap } from '../types/map'
import { logger } from '../utils/logger'
import AdventureManager from './campaign-detail/AdventureManager'
import LoreManager from './campaign-detail/LoreManager'
import NPCManager from './campaign-detail/NPCManager'
import RuleManager from './campaign-detail/RuleManager'

export default function CampaignDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaigns, loading, loadCampaigns, deleteCampaign, saveCampaign } = useCampaignStore()
  const { hostGame } = useNetworkStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [starting, setStarting] = useState(false)

  // AI DM config state
  const [showAiDmModal, setShowAiDmModal] = useState(false)
  const [aiDmConfig, setAiDmConfig] = useState<{
    enabled: boolean
    ollamaModel: string
    ollamaUrl: string
  }>({ enabled: false, ollamaModel: 'llama3.1', ollamaUrl: 'http://localhost:11434' })

  // Map state
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapForm, setMapForm] = useState({ name: '', gridType: 'square' as 'square' | 'hex', cellSize: 40 })

  // Overview edit state
  const [showOverviewEdit, setShowOverviewEdit] = useState(false)
  const [overviewForm, setOverviewForm] = useState({
    name: '',
    description: '',
    maxPlayers: 4,
    turnMode: 'initiative' as TurnMode,
    levelMin: 1,
    levelMax: 20,
    lobbyMessage: ''
  })

  // Session Zero edit state
  const [showSessionZeroEdit, setShowSessionZeroEdit] = useState(false)
  const [editSessionZero, setEditSessionZero] = useState<SessionZeroData>({
    contentLimits: [],
    tone: 'heroic',
    pvpAllowed: false,
    characterDeathExpectation: 'possible',
    playSchedule: '',
    additionalNotes: ''
  })
  const [editSessionZeroRules, setEditSessionZeroRules] = useState<CustomRule[]>([])

  // Calendar edit state
  const [showCalendarEdit, setShowCalendarEdit] = useState(false)
  const [editCalendar, setEditCalendar] = useState<CalendarConfig | null>(null)

  // Audio edit state
  const [showAudioAdd, setShowAudioAdd] = useState(false)
  const [newAudioEntries, setNewAudioEntries] = useState<CustomAudioEntry[]>([])
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null)
  const [audioEntryForm, setAudioEntryForm] = useState({
    displayName: '',
    category: 'effect' as 'ambient' | 'effect' | 'music'
  })

  // Map edit state
  const [editingMapId, setEditingMapId] = useState<string | null>(null)
  const [mapEditForm, setMapEditForm] = useState({
    name: '',
    gridType: 'square' as 'square' | 'hex',
    cellSize: 40,
    gridColor: '#4b5563',
    gridOpacity: 0.4
  })

  const campaign: Campaign | undefined = campaigns.find((c) => c.id === id)

  useEffect(() => {
    if (campaigns.length === 0) {
      loadCampaigns()
    }
  }, [campaigns.length, loadCampaigns])

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
      logger.error('Failed to start game:', error)
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
      logger.error('Failed to export campaign:', error)
      addToast('Failed to export campaign', 'error')
    } finally {
      setExporting(false)
    }
  }

  // --- Map import/export ---
  const handleExportMaps = async (mapsToExport: GameMap[]): Promise<void> => {
    if (!mapsToExport.length) return
    try {
      const ok = await exportEntities('map', mapsToExport)
      if (ok) addToast(`Exported ${mapsToExport.length} map(s)`, 'success')
    } catch {
      addToast('Map export failed', 'error')
    }
  }
  const handleImportMaps = async (): Promise<void> => {
    if (!campaign) return
    try {
      const result = await importEntities<GameMap>('map')
      if (!result) return
      const items = reIdItems(result.items).map((m) => ({ ...m, campaignId: campaign.id }))
      const maps = [...campaign.maps, ...items]
      await saveCampaign({ ...campaign, maps, updatedAt: new Date().toISOString() })
      addToast(`Imported ${items.length} map(s)`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Map import failed', 'error')
    }
  }

  // --- Journal import/export ---
  const handleExportJournal = async (entries: import('../types/campaign').JournalEntry[]): Promise<void> => {
    if (!entries.length) return
    try {
      const ok = await exportEntities('journal', entries)
      if (ok) addToast(`Exported ${entries.length} journal entry(ies)`, 'success')
    } catch {
      addToast('Journal export failed', 'error')
    }
  }
  const handleImportJournal = async (): Promise<void> => {
    if (!campaign) return
    try {
      const result = await importEntities<import('../types/campaign').JournalEntry>('journal')
      if (!result) return
      const items = reIdItems(result.items)
      const entries = [...campaign.journal.entries, ...items]
      await saveCampaign({ ...campaign, journal: { entries }, updatedAt: new Date().toISOString() })
      addToast(`Imported ${items.length} journal entry(ies)`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Journal import failed', 'error')
    }
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

  // --- Overview edit handlers ---
  const openOverviewEdit = (): void => {
    if (!campaign) return
    setOverviewForm({
      name: campaign.name,
      description: campaign.description,
      maxPlayers: campaign.settings.maxPlayers,
      turnMode: campaign.turnMode,
      levelMin: campaign.settings.levelRange.min,
      levelMax: campaign.settings.levelRange.max,
      lobbyMessage: campaign.settings.lobbyMessage
    })
    setShowOverviewEdit(true)
  }
  const handleSaveOverview = async (): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      name: overviewForm.name.trim() || campaign.name,
      description: overviewForm.description,
      turnMode: overviewForm.turnMode,
      settings: {
        ...campaign.settings,
        maxPlayers: overviewForm.maxPlayers,
        levelRange: { min: overviewForm.levelMin, max: overviewForm.levelMax },
        lobbyMessage: overviewForm.lobbyMessage
      },
      updatedAt: new Date().toISOString()
    })
    setShowOverviewEdit(false)
  }

  // --- Session Zero edit handlers ---
  const openSessionZeroEdit = (): void => {
    if (!campaign) return
    const sz = campaign.sessionZero
    setEditSessionZero(
      sz
        ? { ...sz }
        : {
            contentLimits: [],
            tone: 'heroic',
            pvpAllowed: false,
            characterDeathExpectation: 'possible',
            playSchedule: '',
            additionalNotes: ''
          }
    )
    setEditSessionZeroRules([...campaign.customRules])
    setShowSessionZeroEdit(true)
  }
  const handleSaveSessionZero = async (): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      sessionZero: editSessionZero,
      customRules: editSessionZeroRules,
      updatedAt: new Date().toISOString()
    })
    setShowSessionZeroEdit(false)
  }

  // --- Calendar edit handlers ---
  const openCalendarEdit = (): void => {
    if (!campaign) return
    setEditCalendar(campaign.calendar ?? null)
    setShowCalendarEdit(true)
  }
  const handleSaveCalendar = async (): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      calendar: editCalendar ?? undefined,
      updatedAt: new Date().toISOString()
    })
    setShowCalendarEdit(false)
  }

  // --- Audio handlers ---
  const openEditAudioEntry = (audio: {
    id: string
    displayName: string
    category: 'ambient' | 'effect' | 'music'
  }): void => {
    setEditingAudioId(audio.id)
    setAudioEntryForm({ displayName: audio.displayName, category: audio.category })
  }
  const handleSaveAudioEntry = async (): Promise<void> => {
    if (!campaign || !editingAudioId) return
    const customAudio = (campaign.customAudio ?? []).map((a) =>
      a.id === editingAudioId
        ? { ...a, displayName: audioEntryForm.displayName.trim() || a.displayName, category: audioEntryForm.category }
        : a
    )
    await saveCampaign({ ...campaign, customAudio, updatedAt: new Date().toISOString() })
    setEditingAudioId(null)
  }
  const handleDeleteAudioEntry = async (audioId: string): Promise<void> => {
    if (!campaign) return
    await saveCampaign({
      ...campaign,
      customAudio: (campaign.customAudio ?? []).filter((a) => a.id !== audioId),
      updatedAt: new Date().toISOString()
    })
  }
  const handleAddAudio = async (): Promise<void> => {
    if (!campaign || newAudioEntries.length === 0) return
    await saveCampaign({
      ...campaign,
      customAudio: [...(campaign.customAudio ?? []), ...newAudioEntries],
      updatedAt: new Date().toISOString()
    })
    setShowAudioAdd(false)
    setNewAudioEntries([])
  }

  // --- Map edit handlers ---
  const openEditMap = (map: GameMap): void => {
    setEditingMapId(map.id)
    setMapEditForm({
      name: map.name,
      gridType: map.grid.type,
      cellSize: map.grid.cellSize,
      gridColor: map.grid.color,
      gridOpacity: map.grid.opacity
    })
  }
  const handleSaveMapEdit = async (): Promise<void> => {
    if (!campaign || !editingMapId) return
    const maps = campaign.maps.map((m) =>
      m.id === editingMapId
        ? {
            ...m,
            name: mapEditForm.name.trim() || m.name,
            grid: {
              ...m.grid,
              type: mapEditForm.gridType,
              cellSize: mapEditForm.cellSize,
              color: mapEditForm.gridColor,
              opacity: mapEditForm.gridOpacity
            }
          }
        : m
    )
    await saveCampaign({ ...campaign, maps, updatedAt: new Date().toISOString() })
    setEditingMapId(null)
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
          <Button variant="secondary" onClick={() => navigate(`/library?from=/campaign/${id}`)}>
            Library
          </Button>
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
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Overview</h3>
            <button onClick={openOverviewEdit} className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer">
              Edit
            </button>
          </div>
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
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Maps ({campaign.maps.length})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportMaps}
                className="text-[10px] text-gray-400 hover:text-amber-400 cursor-pointer"
              >
                Import
              </button>
              {campaign.maps.length > 0 && (
                <button
                  onClick={() => handleExportMaps(campaign.maps)}
                  className="text-[10px] text-gray-400 hover:text-amber-400 cursor-pointer"
                >
                  Export All
                </button>
              )}
            </div>
          </div>
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
                          onClick={() => openEditMap(map)}
                          className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
                        >
                          Edit
                        </button>
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

        <NPCManager campaign={campaign} saveCampaign={saveCampaign} />

        <RuleManager campaign={campaign} saveCampaign={saveCampaign} />

        <LoreManager campaign={campaign} saveCampaign={saveCampaign} />

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
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Session Zero</h3>
              <button
                onClick={openSessionZeroEdit}
                className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
              >
                Edit
              </button>
            </div>
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

        <AdventureManager campaign={campaign} saveCampaign={saveCampaign} />

        {/* AI Dungeon Master */}
        <Card title="AI Dungeon Master">
          {campaign.aiDm?.enabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Enabled</span>
                <span className="text-xs text-gray-400">Ollama</span>
                <span className="text-xs text-gray-500">{campaign.aiDm.ollamaModel ?? 'default'}</span>
              </div>
              <button
                onClick={() => {
                  setAiDmConfig({
                    enabled: campaign.aiDm?.enabled ?? false,
                    ollamaModel: campaign.aiDm?.ollamaModel ?? 'llama3.1',
                    ollamaUrl: campaign.aiDm?.ollamaUrl ?? 'http://localhost:11434'
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
                    ollamaModel: 'llama3.1',
                    ollamaUrl: 'http://localhost:11434'
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
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Calendar</h3>
            <button onClick={openCalendarEdit} className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer">
              Edit
            </button>
          </div>
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
                <span className="text-gray-200">
                  {campaign.calendar.startingYear} {campaign.calendar.yearLabel}
                </span>
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

        {/* Custom Audio */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Custom Audio ({(campaign.customAudio ?? []).length})</h3>
          </div>
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        audio.category === 'music'
                          ? 'bg-purple-900/40 text-purple-300'
                          : audio.category === 'ambient'
                            ? 'bg-blue-900/40 text-blue-300'
                            : 'bg-amber-900/40 text-amber-300'
                      }`}
                    >
                      {audio.category}
                    </span>
                    <button
                      onClick={() => openEditAudioEntry(audio)}
                      className="text-xs text-gray-400 hover:text-amber-400 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAudioEntry(audio.id)}
                      className="text-xs text-gray-400 hover:text-red-400 cursor-pointer"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              setNewAudioEntries([])
              setShowAudioAdd(true)
            }}
            className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            + Add Audio
          </button>
        </Card>

        {/* Journal */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Session Journal ({campaign.journal.entries.length})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportJournal}
                className="text-[10px] text-gray-400 hover:text-amber-400 cursor-pointer"
              >
                Import
              </button>
              {campaign.journal.entries.length > 0 && (
                <button
                  onClick={() => handleExportJournal(campaign.journal.entries)}
                  className="text-[10px] text-gray-400 hover:text-amber-400 cursor-pointer"
                >
                  Export All
                </button>
              )}
            </div>
          </div>
          {campaign.journal.entries.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No journal entries yet. Entries are created during and after game sessions.
            </p>
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

      {/* AI DM Config Modal */}
      <Modal open={showAiDmModal} onClose={() => setShowAiDmModal(false)} title="Configure AI Dungeon Master">
        <div className="max-h-[60vh] overflow-y-auto">
          <OllamaSetupStep
            enabled={aiDmConfig.enabled}
            ollamaModel={aiDmConfig.ollamaModel}
            ollamaUrl={aiDmConfig.ollamaUrl}
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
                ollamaModel: aiDmConfig.ollamaModel,
                ollamaUrl: aiDmConfig.ollamaUrl
              }
              await saveCampaign({ ...campaign, aiDm, updatedAt: new Date().toISOString() })
              if (aiDmConfig.enabled) {
                try {
                  await window.api.ai.configure({
                    ollamaModel: aiDmConfig.ollamaModel,
                    ollamaUrl: aiDmConfig.ollamaUrl
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

      {/* Overview Edit Modal */}
      <Modal open={showOverviewEdit} onClose={() => setShowOverviewEdit(false)} title="Edit Overview">
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Campaign Name *</label>
            <input
              type="text"
              value={overviewForm.name}
              onChange={(e) => setOverviewForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Description</label>
            <textarea
              value={overviewForm.description}
              onChange={(e) => setOverviewForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Max Players</label>
              <input
                type="number"
                value={overviewForm.maxPlayers}
                onChange={(e) =>
                  setOverviewForm((f) => ({
                    ...f,
                    maxPlayers: Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1))
                  }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                min={1}
                max={8}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Turn Mode</label>
              <select
                value={overviewForm.turnMode}
                onChange={(e) => setOverviewForm((f) => ({ ...f, turnMode: e.target.value as TurnMode }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              >
                <option value="initiative">Initiative</option>
                <option value="free">Free</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Level Min</label>
              <input
                type="number"
                value={overviewForm.levelMin}
                onChange={(e) =>
                  setOverviewForm((f) => ({ ...f, levelMin: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                min={1}
                max={20}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Level Max</label>
              <input
                type="number"
                value={overviewForm.levelMax}
                onChange={(e) =>
                  setOverviewForm((f) => ({ ...f, levelMax: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                min={1}
                max={20}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Lobby Message</label>
            <textarea
              value={overviewForm.lobbyMessage}
              onChange={(e) => setOverviewForm((f) => ({ ...f, lobbyMessage: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500 h-16 resize-none"
              placeholder="Message shown to players in the lobby"
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowOverviewEdit(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveOverview} disabled={!overviewForm.name.trim()}>
            Save
          </Button>
        </div>
      </Modal>

      {/* Session Zero Edit Modal */}
      <Modal open={showSessionZeroEdit} onClose={() => setShowSessionZeroEdit(false)} title="Edit Session Zero">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <SessionZeroStep
            data={editSessionZero}
            onChange={setEditSessionZero}
            customRules={editSessionZeroRules}
            onRulesChange={setEditSessionZeroRules}
          />
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowSessionZeroEdit(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveSessionZero}>Save</Button>
        </div>
      </Modal>

      {/* Calendar Edit Modal */}
      <Modal open={showCalendarEdit} onClose={() => setShowCalendarEdit(false)} title="Edit Calendar">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <CalendarStep calendar={editCalendar} onChange={setEditCalendar} />
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowCalendarEdit(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveCalendar}>Save</Button>
        </div>
      </Modal>

      {/* Add Audio Modal */}
      <Modal open={showAudioAdd} onClose={() => setShowAudioAdd(false)} title="Add Custom Audio">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <AudioStep audioEntries={newAudioEntries} onChange={setNewAudioEntries} />
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowAudioAdd(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddAudio} disabled={newAudioEntries.length === 0}>
            Add
          </Button>
        </div>
      </Modal>

      {/* Audio Entry Edit Modal */}
      <Modal open={editingAudioId !== null} onClose={() => setEditingAudioId(null)} title="Edit Audio Entry">
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Display Name</label>
            <input
              type="text"
              value={audioEntryForm.displayName}
              onChange={(e) => setAudioEntryForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Category</label>
            <select
              value={audioEntryForm.category}
              onChange={(e) =>
                setAudioEntryForm((f) => ({ ...f, category: e.target.value as 'ambient' | 'effect' | 'music' }))
              }
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="music">Music</option>
              <option value="ambient">Ambient</option>
              <option value="effect">Effect</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setEditingAudioId(null)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAudioEntry}>Save</Button>
        </div>
      </Modal>

      {/* Map Edit Modal */}
      <Modal open={editingMapId !== null} onClose={() => setEditingMapId(null)} title="Edit Map">
        <div className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Map Name *</label>
            <input
              type="text"
              value={mapEditForm.name}
              onChange={(e) => setMapEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Grid Type</label>
            <select
              value={mapEditForm.gridType}
              onChange={(e) => setMapEditForm((f) => ({ ...f, gridType: e.target.value as 'square' | 'hex' }))}
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
              value={mapEditForm.cellSize}
              onChange={(e) => setMapEditForm((f) => ({ ...f, cellSize: parseInt(e.target.value, 10) || 40 }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
              min={10}
              max={200}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Grid Color</label>
            <input
              type="color"
              value={mapEditForm.gridColor}
              onChange={(e) => setMapEditForm((f) => ({ ...f, gridColor: e.target.value }))}
              className="w-12 h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Grid Opacity</label>
            <input
              type="range"
              value={mapEditForm.gridOpacity}
              onChange={(e) => setMapEditForm((f) => ({ ...f, gridOpacity: parseFloat(e.target.value) }))}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
            <span className="text-xs text-gray-500">{Math.round(mapEditForm.gridOpacity * 100)}%</span>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setEditingMapId(null)}>
            Cancel
          </Button>
          <Button onClick={handleSaveMapEdit} disabled={!mapEditForm.name.trim()}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  )
}
