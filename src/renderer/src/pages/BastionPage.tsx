import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import Modal from '../components/ui/Modal'
import { load5eBastionFacilities } from '../services/data-provider'
import { useBastionStore } from '../stores/useBastionStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import type {
  BasicFacilityDef,
  BasicFacilityType,
  Bastion,
  BastionOrderType,
  FacilitySpace,
  SpecialFacilityDef,
  SpecialFacilityType
} from '../types/bastion'
import {
  BASIC_FACILITY_COSTS,
  createDefaultBastion,
  getAvailableFacilityLevel,
  getMaxSpecialFacilities,
  SPECIAL_FACILITY_COSTS
} from '../types/bastion'
import { is5eCharacter } from '../types/character'
import type { Character5e } from '../types/character-5e'
import { getFacilityEligibility } from '../utils/bastion-prerequisites'

type TabId = 'overview' | 'basic' | 'special' | 'turns' | 'defenders' | 'events'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'basic', label: 'Basic Facilities' },
  { id: 'special', label: 'Special Facilities' },
  { id: 'turns', label: 'Bastion Turns' },
  { id: 'defenders', label: 'Defenders' },
  { id: 'events', label: 'Events Log' }
]

const ORDER_LABELS: Record<BastionOrderType, string> = {
  craft: 'Craft',
  empower: 'Empower',
  harvest: 'Harvest',
  maintain: 'Maintain',
  recruit: 'Recruit',
  research: 'Research',
  trade: 'Trade'
}

const ORDER_COLORS: Record<BastionOrderType, string> = {
  craft: 'bg-blue-900/40 text-blue-300 border-blue-700',
  empower: 'bg-purple-900/40 text-purple-300 border-purple-700',
  harvest: 'bg-green-900/40 text-green-300 border-green-700',
  maintain: 'bg-gray-800 text-gray-300 border-gray-600',
  recruit: 'bg-red-900/40 text-red-300 border-red-700',
  research: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  trade: 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
}

const SETTING_LABELS: Record<string, string> = {
  core: 'Core',
  fr: 'Forgotten Realms',
  eberron: 'Eberron'
}

export default function BastionPage(): JSX.Element {
  const navigate = useNavigate()

  // Store bindings
  const bastions = useBastionStore((s) => s.bastions)
  const loading = useBastionStore((s) => s.loading)
  const loadBastions = useBastionStore((s) => s.loadBastions)
  const saveBastion = useBastionStore((s) => s.saveBastion)
  const deleteBastion = useBastionStore((s) => s.deleteBastion)
  const setFacilityDefs = useBastionStore((s) => s.setFacilityDefs)
  const facilityDefs = useBastionStore((s) => s.facilityDefs)

  const _addBasicFacility = useBastionStore((s) => s.addBasicFacility)
  const removeBasicFacility = useBastionStore((s) => s.removeBasicFacility)
  const addSpecialFacility = useBastionStore((s) => s.addSpecialFacility)
  const removeSpecialFacility = useBastionStore((s) => s.removeSpecialFacility)
  const _enlargeSpecialFacility = useBastionStore((s) => s.enlargeSpecialFacility)
  const configureFacility = useBastionStore((s) => s.configureFacility)

  const advanceTime = useBastionStore((s) => s.advanceTime)
  const startTurn = useBastionStore((s) => s.startTurn)
  const issueOrder = useBastionStore((s) => s.issueOrder)
  const issueMaintainOrder = useBastionStore((s) => s.issueMaintainOrder)
  const rollAndResolveEvent = useBastionStore((s) => s.rollAndResolveEvent)
  const completeTurn = useBastionStore((s) => s.completeTurn)

  const recruitDefenders = useBastionStore((s) => s.recruitDefenders)
  const removeDefenders = useBastionStore((s) => s.removeDefenders)
  const buildDefensiveWalls = useBastionStore((s) => s.buildDefensiveWalls)
  const depositGold = useBastionStore((s) => s.depositGold)
  const withdrawGold = useBastionStore((s) => s.withdrawGold)
  const _updateNotes = useBastionStore((s) => s.updateNotes)
  const startConstruction = useBastionStore((s) => s.startConstruction)

  const characters = useCharacterStore((s) => s.characters)
  const loadCharacters = useCharacterStore((s) => s.loadCharacters)

  // Local state
  const [selectedBastionId, setSelectedBastionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Modal visibility
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddBasic, setShowAddBasic] = useState(false)
  const [showAddSpecial, setShowAddSpecial] = useState(false)
  const [showTurnModal, setShowTurnModal] = useState(false)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [showWallsModal, setShowWallsModal] = useState(false)
  const [showTreasuryModal, setShowTreasuryModal] = useState(false)
  const [showAdvanceTime, setShowAdvanceTime] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newOwnerId, setNewOwnerId] = useState('')

  // Add basic form
  const [basicType, setBasicType] = useState<BasicFacilityType>('bedroom')
  const [basicSpace, setBasicSpace] = useState<FacilitySpace>('roomy')

  // Add special form
  const [settingFilter, setSettingFilter] = useState<'all' | 'core' | 'fr' | 'eberron'>('all')
  const [selectedSpecialType, setSelectedSpecialType] = useState<SpecialFacilityType | null>(null)
  const [factionOverride, setFactionOverride] = useState(false)

  // Turn form
  const [turnOrders, setTurnOrders] = useState<
    Record<string, { orderType: BastionOrderType; details: string; cost: number }>
  >({})
  const [turnMaintain, setTurnMaintain] = useState(false)
  const [turnStep, setTurnStep] = useState<'orders' | 'event' | 'summary'>('orders')
  const [activeTurnNumber, setActiveTurnNumber] = useState<number | null>(null)

  // Recruit form
  const [recruitBarrackId, setRecruitBarrackId] = useState('')
  const [recruitNames, setRecruitNames] = useState('')

  // Walls form
  const [wallSquares, setWallSquares] = useState(1)

  // Treasury form
  const [treasuryAmount, setTreasuryAmount] = useState(0)
  const [treasuryMode, setTreasuryMode] = useState<'deposit' | 'withdraw'>('deposit')

  // Advance time
  const [advanceDays, setAdvanceDays] = useState(7)

  // Basic facility defs from JSON
  const [basicFacilityDefs, setBasicFacilityDefs] = useState<BasicFacilityDef[]>([])

  // Load data on mount
  useEffect(() => {
    loadBastions()
    loadCharacters()
    load5eBastionFacilities().then((data) => {
      setFacilityDefs(data.specialFacilities as SpecialFacilityDef[])
      setBasicFacilityDefs(data.basicFacilities)
    })
  }, [loadBastions, loadCharacters, setFacilityDefs]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBastion = bastions.find((b) => b.id === selectedBastionId)
  const ownerCharacter = selectedBastion ? characters.find((c) => c.id === selectedBastion.ownerId) : null
  const ownerLevel = ownerCharacter?.level ?? 5
  const owner5e = ownerCharacter && is5eCharacter(ownerCharacter) ? (ownerCharacter as Character5e) : null

  const maxSpecial = getMaxSpecialFacilities(ownerLevel)
  const maxFacilityLevel = getAvailableFacilityLevel(ownerLevel)

  // Filtered special facilities for the add modal
  const filteredFacilities = useMemo(() => {
    let list = facilityDefs.filter((f) => f.level <= maxFacilityLevel)
    if (settingFilter !== 'all') {
      list = list.filter((f) => f.setting === settingFilter)
    }
    return list
  }, [facilityDefs, maxFacilityLevel, settingFilter])

  const selectedSpecialDef = selectedSpecialType
    ? (facilityDefs.find((f) => f.type === selectedSpecialType) ?? null)
    : null

  // ---- Handlers ----

  const handleCreate = (): void => {
    if (!newName.trim() || !newOwnerId) return
    const bastion = createDefaultBastion(newOwnerId, newName.trim())
    saveBastion(bastion)
    setSelectedBastionId(bastion.id)
    setShowCreateModal(false)
    setNewName('')
    setNewOwnerId('')
  }

  const handleAddBasic = (): void => {
    if (!selectedBastion) return
    const def = basicFacilityDefs.find((d) => d.type === basicType)
    const _name =
      def?.name ||
      basicType
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    const cost = BASIC_FACILITY_COSTS[basicSpace]
    startConstruction(selectedBastion.id, {
      projectType: 'add-basic',
      facilityType: basicType,
      targetSpace: basicSpace,
      cost: cost.gp,
      daysRequired: cost.days
    })
    setShowAddBasic(false)
  }

  const handleAddSpecial = (): void => {
    if (!selectedBastion || !selectedSpecialDef) return
    addSpecialFacility(
      selectedBastion.id,
      selectedSpecialDef.type,
      selectedSpecialDef.name,
      selectedSpecialDef.defaultSpace
    )
    setShowAddSpecial(false)
    setSelectedSpecialType(null)
    setFactionOverride(false)
  }

  const handleStartTurn = (): void => {
    if (!selectedBastion) return
    const turn = startTurn(selectedBastion.id)
    if (turn) {
      setActiveTurnNumber(turn.turnNumber)
      setTurnOrders({})
      setTurnMaintain(false)
      setTurnStep('orders')
      setShowTurnModal(true)
    }
  }

  const handleExecuteTurn = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return

    // Issue all orders
    for (const [facilityId, order] of Object.entries(turnOrders)) {
      issueOrder(selectedBastion.id, activeTurnNumber, facilityId, order.orderType, order.details, order.cost)
    }

    // Issue maintain
    if (turnMaintain) {
      issueMaintainOrder(selectedBastion.id, activeTurnNumber)
    }

    setTurnStep('event')
  }

  const handleRollEvent = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return
    // Maintain must be issued first for event to happen
    if (!turnMaintain) {
      issueMaintainOrder(selectedBastion.id, activeTurnNumber)
    }
    rollAndResolveEvent(selectedBastion.id, activeTurnNumber)
    setTurnStep('summary')
  }

  const handleCompleteTurn = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return
    completeTurn(selectedBastion.id, activeTurnNumber)
    setShowTurnModal(false)
    setActiveTurnNumber(null)
  }

  const handleRecruit = (): void => {
    if (!selectedBastion || !recruitBarrackId || !recruitNames.trim()) return
    const names = recruitNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    recruitDefenders(selectedBastion.id, recruitBarrackId, names)
    setShowRecruitModal(false)
    setRecruitNames('')
  }

  const handleBuildWalls = (): void => {
    if (!selectedBastion || wallSquares <= 0) return
    buildDefensiveWalls(selectedBastion.id, wallSquares)
    setShowWallsModal(false)
    setWallSquares(1)
  }

  const handleTreasury = (): void => {
    if (!selectedBastion || treasuryAmount <= 0) return
    if (treasuryMode === 'deposit') {
      depositGold(selectedBastion.id, treasuryAmount)
    } else {
      withdrawGold(selectedBastion.id, treasuryAmount)
    }
    setShowTreasuryModal(false)
    setTreasuryAmount(0)
  }

  const handleAdvanceTime = (): void => {
    if (!selectedBastion || advanceDays <= 0) return
    advanceTime(selectedBastion.id, advanceDays)
    setShowAdvanceTime(false)
  }

  // Get the active turn data for the turn modal
  const activeTurn = selectedBastion?.turns.find((t) => t.turnNumber === activeTurnNumber) ?? null

  // Barrack list for recruit modal
  const barracks = selectedBastion?.specialFacilities.filter((f) => f.type === 'barrack') ?? []

  if (loading) {
    return (
      <div className="p-8 h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-500">Loading bastions...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1 transition-colors"
          >
            &larr; Main Menu
          </button>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xs text-gray-500">Bastions (2024 DMG)</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
        >
          + New Bastion
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-800 overflow-y-auto bg-gray-900/50">
          {bastions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No bastions yet. Create one to get started.</div>
          ) : (
            bastions.map((bastion) => {
              const owner = characters.find((c) => c.id === bastion.ownerId)
              return (
                <button
                  key={bastion.id}
                  onClick={() => {
                    setSelectedBastionId(bastion.id)
                    setActiveTab('overview')
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-colors ${
                    selectedBastionId === bastion.id
                      ? 'bg-gray-800 border-l-2 border-l-amber-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-100">{bastion.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {owner?.name ?? 'Unknown'} (Lv {owner?.level ?? '?'})
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {bastion.basicFacilities.length + bastion.specialFacilities.length} facilities &middot;{' '}
                    {bastion.defenders.length} defenders &middot; {bastion.treasury} GP
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedBastion ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a bastion from the sidebar or create a new one
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="px-6 pt-4 pb-3 border-b border-gray-800 bg-gray-900/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-100">{selectedBastion.name}</h1>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-400">
                        {ownerCharacter?.name ?? 'Unknown'} (Lv {ownerLevel})
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                        Day {selectedBastion.inGameTime.currentDay}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                        Treasury: {selectedBastion.treasury} GP
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        {selectedBastion.specialFacilities.length +
                          selectedBastion.construction.filter((p) => p.projectType === 'add-special').length}
                        /{maxSpecial} special
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAdvanceTime(true)}
                      className="px-3 py-1.5 text-sm border border-gray-600 hover:border-amber-600 text-gray-300 hover:text-amber-400 rounded transition-colors"
                    >
                      Advance Time
                    </button>
                    <button
                      onClick={() => setShowTreasuryModal(true)}
                      className="px-3 py-1.5 text-sm border border-gray-600 hover:border-yellow-600 text-gray-300 hover:text-yellow-400 rounded transition-colors"
                    >
                      Treasury
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 text-sm border border-red-800 hover:border-red-600 text-red-400 hover:text-red-300 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-3">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-sm rounded-t transition-colors ${
                        activeTab === tab.id
                          ? 'bg-gray-800 text-amber-400 border border-gray-700 border-b-gray-800'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto">
                  {activeTab === 'overview' && (
                    <OverviewTab
                      bastion={selectedBastion}
                      ownerLevel={ownerLevel}
                      maxSpecial={maxSpecial}
                      onStartTurn={handleStartTurn}
                    />
                  )}
                  {activeTab === 'basic' && (
                    <BasicTab
                      bastion={selectedBastion}
                      basicDefs={basicFacilityDefs}
                      onAdd={() => setShowAddBasic(true)}
                      onRemove={(id) => removeBasicFacility(selectedBastion.id, id)}
                    />
                  )}
                  {activeTab === 'special' && (
                    <SpecialTab
                      bastion={selectedBastion}
                      facilityDefs={facilityDefs}
                      owner5e={owner5e}
                      maxSpecial={maxSpecial}
                      onAdd={() => setShowAddSpecial(true)}
                      onRemove={(id) => removeSpecialFacility(selectedBastion.id, id)}
                      onConfigure={(id, config) => configureFacility(selectedBastion.id, id, config)}
                    />
                  )}
                  {activeTab === 'turns' && <TurnsTab bastion={selectedBastion} onStartTurn={handleStartTurn} />}
                  {activeTab === 'defenders' && (
                    <DefendersTab
                      bastion={selectedBastion}
                      onRecruit={() => setShowRecruitModal(true)}
                      onRemove={(ids) => removeDefenders(selectedBastion.id, ids)}
                      onBuildWalls={() => setShowWallsModal(true)}
                    />
                  )}
                  {activeTab === 'events' && <EventsTab bastion={selectedBastion} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- MODALS ---- */}

      {/* Create Bastion */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Bastion">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Bastion Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Thornwall Keep"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Owner (Character)</label>
            <select
              value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">Select a character...</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Lv {c.level})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Starts with 2 basic facilities (Bedroom + Storage). Add special facilities after creation.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newOwnerId}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Basic Facility */}
      <Modal open={showAddBasic} onClose={() => setShowAddBasic(false)} title="Add Basic Facility">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={basicType}
              onChange={(e) => setBasicType(e.target.value as BasicFacilityType)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              {basicFacilityDefs.map((d) => (
                <option key={d.type} value={d.type}>
                  {d.name}
                </option>
              ))}
            </select>
            {basicFacilityDefs.find((d) => d.type === basicType) && (
              <p className="text-xs text-gray-500 mt-1">
                {basicFacilityDefs.find((d) => d.type === basicType)?.description}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Size</label>
            <select
              value={basicSpace}
              onChange={(e) => setBasicSpace(e.target.value as FacilitySpace)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            >
              <option value="cramped">
                Cramped ({BASIC_FACILITY_COSTS.cramped.gp} GP, {BASIC_FACILITY_COSTS.cramped.days} days)
              </option>
              <option value="roomy">
                Roomy ({BASIC_FACILITY_COSTS.roomy.gp} GP, {BASIC_FACILITY_COSTS.roomy.days} days)
              </option>
              <option value="vast">
                Vast ({BASIC_FACILITY_COSTS.vast.gp} GP, {BASIC_FACILITY_COSTS.vast.days} days)
              </option>
            </select>
          </div>
          <div className="text-xs text-gray-400">
            Cost: {BASIC_FACILITY_COSTS[basicSpace].gp} GP &middot; Construction:{' '}
            {BASIC_FACILITY_COSTS[basicSpace].days} days
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddBasic(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddBasic}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
            >
              Build ({BASIC_FACILITY_COSTS[basicSpace].gp} GP)
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Special Facility */}
      <Modal
        open={showAddSpecial}
        onClose={() => {
          setShowAddSpecial(false)
          setSelectedSpecialType(null)
          setFactionOverride(false)
        }}
        title="Add Special Facility"
      >
        <div className="space-y-4">
          {selectedBastion &&
            selectedBastion.specialFacilities.length +
              selectedBastion.construction.filter((p) => p.projectType === 'add-special').length >=
              maxSpecial && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                Maximum special facilities reached ({maxSpecial}). Remove or swap one first.
              </div>
            )}
          {/* Setting filter */}
          <div className="flex gap-1">
            {(['all', 'core', 'fr', 'eberron'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSettingFilter(s)}
                className={`px-2 py-1 text-xs rounded transition-colors ${settingFilter === s ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
              >
                {s === 'all' ? 'All' : SETTING_LABELS[s]}
              </button>
            ))}
          </div>
          {/* Facility list */}
          <div className="max-h-72 overflow-y-auto space-y-2">
            {filteredFacilities.map((def) => {
              const eligibility = owner5e ? getFacilityEligibility(owner5e, def) : { eligible: true }
              const isFaction = def.prerequisite.type === 'faction-renown'
              const canSelect = eligibility.eligible || (isFaction && factionOverride)
              const isSelected = selectedSpecialType === def.type
              return (
                <button
                  key={def.type}
                  onClick={() => canSelect && setSelectedSpecialType(def.type)}
                  disabled={!canSelect}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-amber-900/30 border-amber-700'
                      : canSelect
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        : 'bg-gray-900/50 border-gray-800 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-100">{def.name}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          def.setting === 'core'
                            ? 'bg-gray-800 text-gray-400 border-gray-700'
                            : def.setting === 'fr'
                              ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700'
                              : 'bg-orange-900/30 text-orange-400 border-orange-700'
                        }`}
                      >
                        {SETTING_LABELS[def.setting]}
                      </span>
                      <span className="text-xs text-gray-600">Lv {def.level}</span>
                    </div>
                    {eligibility.eligible ? (
                      <span className="text-xs text-green-400">Eligible</span>
                    ) : isFaction ? (
                      <span className="text-xs text-yellow-400">Faction</span>
                    ) : (
                      <span className="text-xs text-red-400">Ineligible</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{def.description}</p>
                  {!eligibility.eligible && eligibility.reason && (
                    <p className="text-xs text-red-400 mt-1">Requires: {eligibility.reason}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {def.orders.map((o) => (
                      <span key={o} className={`text-xs px-1.5 py-0.5 rounded border ${ORDER_COLORS[o]}`}>
                        {ORDER_LABELS[o]}
                      </span>
                    ))}
                    {def.charm && (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-purple-900/30 text-purple-300 border-purple-700">
                        Charm
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {/* Faction override */}
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={factionOverride}
              onChange={(e) => setFactionOverride(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600"
            />
            Override faction requirement (I meet this faction prerequisite)
          </label>
          {/* Selected facility detail */}
          {selectedSpecialDef &&
            (() => {
              const costs = SPECIAL_FACILITY_COSTS[selectedSpecialDef.level] ?? SPECIAL_FACILITY_COSTS[5]
              const canAfford = selectedBastion ? selectedBastion.treasury >= costs.gp : false
              return (
                <div className="bg-gray-800/50 rounded p-3 border border-gray-700">
                  <h4 className="font-medium text-sm text-gray-100">{selectedSpecialDef.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{selectedSpecialDef.description}</p>
                  {selectedSpecialDef.charm && (
                    <div className="mt-2 text-xs text-purple-300">
                      Charm: {selectedSpecialDef.charm.description} ({selectedSpecialDef.charm.duration})
                    </div>
                  )}
                  {selectedSpecialDef.permanentBenefit && (
                    <div className="mt-1 text-xs text-amber-300">Benefit: {selectedSpecialDef.permanentBenefit}</div>
                  )}
                  <div className="mt-2 text-xs text-gray-400">
                    Cost: <span className={canAfford ? 'text-yellow-400' : 'text-red-400'}>{costs.gp} GP</span> &middot;
                    Construction: {costs.days} days
                  </div>
                  {!canAfford && (
                    <div className="mt-1 text-xs text-red-400">
                      Not enough gold (have {selectedBastion?.treasury ?? 0} GP, need {costs.gp} GP)
                    </div>
                  )}
                </div>
              )
            })()}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddSpecial(false)
                setSelectedSpecialType(null)
              }}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSpecial}
              disabled={
                !selectedSpecialType ||
                (selectedBastion && selectedBastion.specialFacilities.length >= maxSpecial) ||
                (selectedSpecialDef != null &&
                  selectedBastion != null &&
                  selectedBastion.treasury <
                    (SPECIAL_FACILITY_COSTS[selectedSpecialDef.level]?.gp ?? SPECIAL_FACILITY_COSTS[5].gp))
              }
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold transition-colors"
            >
              Build Facility
              {selectedSpecialDef
                ? ` (${(SPECIAL_FACILITY_COSTS[selectedSpecialDef.level] ?? SPECIAL_FACILITY_COSTS[5]).gp} GP)`
                : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bastion Turn Modal */}
      <Modal
        open={showTurnModal}
        onClose={() => setShowTurnModal(false)}
        title={`Bastion Turn ${activeTurnNumber ?? ''}`}
      >
        <div className="space-y-4">
          {turnStep === 'orders' && selectedBastion && (
            <>
              <p className="text-sm text-gray-400">Assign orders to your special facilities, then execute the turn.</p>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={turnMaintain}
                  onChange={(e) => setTurnMaintain(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-600"
                />
                Issue Maintain order (triggers d100 event)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedBastion.specialFacilities.map((facility) => {
                  const def = facilityDefs.find((d) => d.type === facility.type)
                  const currentOrder = turnOrders[facility.id]
                  return (
                    <div key={facility.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-100">{facility.name}</span>
                        {def && def.orders.length > 0 && (
                          <select
                            value={currentOrder?.orderType ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              if (!val) {
                                const next = { ...turnOrders }
                                delete next[facility.id]
                                setTurnOrders(next)
                              } else {
                                setTurnOrders({
                                  ...turnOrders,
                                  [facility.id]: { orderType: val as BastionOrderType, details: '', cost: 0 }
                                })
                              }
                            }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                          >
                            <option value="">Idle</option>
                            {def.orders.map((o) => (
                              <option key={o} value={o}>
                                {ORDER_LABELS[o]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      {currentOrder && def && (
                        <select
                          value={currentOrder.details}
                          onChange={(e) =>
                            setTurnOrders({
                              ...turnOrders,
                              [facility.id]: { ...currentOrder, details: e.target.value }
                            })
                          }
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Select action...</option>
                          {def.orderOptions
                            .filter((o) => o.order === currentOrder.orderType)
                            .map((o) => (
                              <option key={o.name} value={o.name}>
                                {o.name} {o.cost > 0 ? `(${o.cost} GP)` : ''}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowTurnModal(false)}
                  className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteTurn}
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
                >
                  Execute Turn
                </button>
              </div>
            </>
          )}
          {turnStep === 'event' && (
            <>
              <p className="text-sm text-gray-400">Orders issued. Roll for a bastion event?</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setTurnStep('summary')
                  }}
                  className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
                >
                  Skip Event
                </button>
                <button
                  onClick={handleRollEvent}
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
                >
                  Roll d100 Event
                </button>
              </div>
            </>
          )}
          {turnStep === 'summary' && activeTurn && (
            <>
              <h3 className="text-sm font-semibold text-gray-200">Turn Summary</h3>
              {activeTurn.orders.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Orders:</p>
                  {activeTurn.orders.map((o, i) => (
                    <div key={i} className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1">
                      {o.facilityName}: {o.details || ORDER_LABELS[o.orderType]}
                      {o.goldCost ? ` (-${o.goldCost} GP)` : ''}
                    </div>
                  ))}
                </div>
              )}
              {activeTurn.eventOutcome && (
                <div className="bg-gray-800 rounded p-3 border border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                      d100: {activeTurn.eventRoll}
                    </span>
                    <span className="text-xs text-gray-400">{activeTurn.eventType}</span>
                  </div>
                  <p className="text-sm text-gray-200">{activeTurn.eventOutcome}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCompleteTurn}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded font-semibold transition-colors"
                >
                  Complete Turn
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Recruit Defenders */}
      <Modal open={showRecruitModal} onClose={() => setShowRecruitModal(false)} title="Recruit Defenders">
        <div className="space-y-4">
          {barracks.length === 0 ? (
            <p className="text-sm text-gray-400">You need a Barrack facility to recruit defenders.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Barrack</label>
                <select
                  value={recruitBarrackId}
                  onChange={(e) => setRecruitBarrackId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select barrack...</option>
                  {barracks.map((b) => {
                    const count = selectedBastion?.defenders.filter((d) => d.barrackId === b.id).length ?? 0
                    const max = b.space === 'vast' ? 25 : 12
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({count}/{max})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Names (comma-separated, max 4)</label>
                <input
                  type="text"
                  value={recruitNames}
                  onChange={(e) => setRecruitNames(e.target.value)}
                  placeholder="e.g. Brynn, Torval, Elda, Garth"
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="text-xs text-gray-500">Cost: 50 GP per defender</p>
            </>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowRecruitModal(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRecruit}
              disabled={!recruitBarrackId || !recruitNames.trim()}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold transition-colors"
            >
              Recruit
            </button>
          </div>
        </div>
      </Modal>

      {/* Build Defensive Walls */}
      <Modal open={showWallsModal} onClose={() => setShowWallsModal(false)} title="Build Defensive Walls">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Each 5-ft square costs 250 GP and takes 10 days to build.</p>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Squares to build</label>
            <input
              type="number"
              min={1}
              max={20}
              value={wallSquares}
              onChange={(e) => setWallSquares(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="text-xs text-gray-400">
            Cost: {wallSquares * 250} GP &middot; Time: {wallSquares * 10} days
            {selectedBastion?.defensiveWalls && (
              <> &middot; Current: {selectedBastion.defensiveWalls.squaresBuilt} squares</>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowWallsModal(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBuildWalls}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
            >
              Build ({wallSquares * 250} GP)
            </button>
          </div>
        </div>
      </Modal>

      {/* Treasury */}
      <Modal open={showTreasuryModal} onClose={() => setShowTreasuryModal(false)} title="Bastion Treasury">
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Current treasury: <span className="text-yellow-400 font-medium">{selectedBastion?.treasury ?? 0} GP</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTreasuryMode('deposit')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${treasuryMode === 'deposit' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Deposit
            </button>
            <button
              onClick={() => setTreasuryMode('withdraw')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${treasuryMode === 'withdraw' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Withdraw
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Amount (GP)</label>
            <input
              type="number"
              min={0}
              value={treasuryAmount}
              onChange={(e) => setTreasuryAmount(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowTreasuryModal(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTreasury}
              disabled={treasuryAmount <= 0}
              className={`px-4 py-2 text-sm text-white rounded font-semibold transition-colors ${treasuryMode === 'deposit' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} disabled:bg-gray-700 disabled:text-gray-500`}
            >
              {treasuryMode === 'deposit' ? 'Deposit' : 'Withdraw'} {treasuryAmount} GP
            </button>
          </div>
        </div>
      </Modal>

      {/* Advance Time */}
      <Modal open={showAdvanceTime} onClose={() => setShowAdvanceTime(false)} title="Advance In-Game Time">
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Current day:{' '}
            <span className="text-amber-400 font-medium">{selectedBastion?.inGameTime.currentDay ?? 1}</span>
            &middot; Last turn: Day {selectedBastion?.inGameTime.lastBastionTurnDay ?? 0}
            &middot; Next turn in:{' '}
            {Math.max(
              0,
              (selectedBastion?.inGameTime.turnFrequencyDays ?? 7) -
                ((selectedBastion?.inGameTime.currentDay ?? 0) - (selectedBastion?.inGameTime.lastBastionTurnDay ?? 0))
            )}{' '}
            days
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Days to advance</label>
            <input
              type="number"
              min={1}
              max={365}
              value={advanceDays}
              onChange={(e) => setAdvanceDays(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          {selectedBastion && selectedBastion.construction.length > 0 && (
            <div className="text-xs text-gray-400">
              {selectedBastion.construction.length} construction project(s) will advance by {advanceDays} days.
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdvanceTime(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdvanceTime}
              disabled={advanceDays <= 0}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold transition-colors"
            >
              Advance {advanceDays} Day{advanceDays !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Bastion">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Are you sure you want to delete <span className="text-gray-200 font-medium">{selectedBastion?.name}</span>?
            This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedBastion) {
                  deleteBastion(selectedBastion.id)
                  setSelectedBastionId(null)
                  setShowDeleteConfirm(false)
                }
              }}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded font-semibold transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({
  bastion,
  ownerLevel,
  maxSpecial,
  onStartTurn
}: {
  bastion: Bastion
  ownerLevel: number
  maxSpecial: number
  onStartTurn: () => void
}): JSX.Element {
  const daysSinceTurn = bastion.inGameTime.currentDay - bastion.inGameTime.lastBastionTurnDay
  const daysUntilTurn = Math.max(0, bastion.inGameTime.turnFrequencyDays - daysSinceTurn)
  const turnReady = daysUntilTurn === 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Basic Facilities" value={bastion.basicFacilities.length} />
        <SummaryCard label="Special Facilities" value={`${bastion.specialFacilities.length}/${maxSpecial}`} />
        <SummaryCard label="Defenders" value={bastion.defenders.length} />
        <SummaryCard label="Treasury" value={`${bastion.treasury} GP`} accent />
      </div>

      {/* Turn status */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Bastion Turn Status</h3>
            <p className="text-xs text-gray-500 mt-1">
              {turnReady
                ? 'A bastion turn is ready! Assign orders and roll for events.'
                : `Next turn in ${daysUntilTurn} day${daysUntilTurn !== 1 ? 's' : ''} (every ${bastion.inGameTime.turnFrequencyDays} days)`}
            </p>
          </div>
          <button
            onClick={onStartTurn}
            className={`px-4 py-2 text-sm rounded font-semibold transition-colors ${
              turnReady ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {turnReady ? 'Start Turn' : 'Force Turn'}
          </button>
        </div>
      </div>

      {/* Construction queue */}
      {bastion.construction.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Construction Queue</h3>
          <div className="space-y-2">
            {bastion.construction.map((p) => {
              const pct = p.daysRequired > 0 ? Math.round((p.daysCompleted / p.daysRequired) * 100) : 100
              return (
                <div key={p.id} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 capitalize">
                      {p.projectType === 'add-special' && p.specialFacilityName
                        ? `Building: ${p.specialFacilityName}`
                        : `${p.projectType.replace(/-/g, ' ')}${p.facilityType ? `: ${p.facilityType}` : ''}`}
                    </span>
                    <span className="text-gray-500">
                      {p.daysCompleted}/{p.daysRequired} days ({p.cost} GP)
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active orders */}
      {bastion.specialFacilities.some((f) => f.currentOrder) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Active Orders</h3>
          {bastion.specialFacilities
            .filter((f) => f.currentOrder)
            .map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs mb-1">
                <span className="text-gray-300">{f.name}:</span>
                <span className={`px-1.5 py-0.5 rounded border ${ORDER_COLORS[f.currentOrder!]}`}>
                  {ORDER_LABELS[f.currentOrder!]}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-2">Notes</h3>
        <textarea
          value={bastion.notes}
          onChange={(e) => useBastionStore.getState().updateNotes(bastion.id, e.target.value)}
          placeholder="Bastion notes..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
        />
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent
}: {
  label: string
  value: string | number
  accent?: boolean
}): JSX.Element {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent ? 'text-yellow-400' : 'text-gray-100'}`}>{value}</div>
    </div>
  )
}

function BasicTab({
  bastion,
  basicDefs,
  onAdd,
  onRemove
}: {
  bastion: Bastion
  basicDefs: BasicFacilityDef[]
  onAdd: () => void
  onRemove: (id: string) => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Basic Facilities ({bastion.basicFacilities.length})</h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
        >
          + Add Basic Facility
        </button>
      </div>
      {bastion.basicFacilities.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No basic facilities.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bastion.basicFacilities.map((f) => {
            const def = basicDefs.find((d) => d.type === f.type)
            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-100">{f.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                      {f.space}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemove(f.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {def && <p className="text-xs text-gray-500">{def.description}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SpecialTab({
  bastion,
  facilityDefs,
  owner5e,
  maxSpecial,
  onAdd,
  onRemove,
  onConfigure
}: {
  bastion: Bastion
  facilityDefs: SpecialFacilityDef[]
  owner5e: Character5e | null
  maxSpecial: number
  onAdd: () => void
  onRemove: (id: string) => void
  onConfigure: (id: string, config: Record<string, unknown>) => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">
          Special Facilities ({bastion.specialFacilities.length}/{maxSpecial})
        </h2>
        <button
          onClick={onAdd}
          disabled={bastion.specialFacilities.length >= maxSpecial}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
        >
          + Add Special Facility
        </button>
      </div>
      {bastion.specialFacilities.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">
          No special facilities. Add one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {bastion.specialFacilities.map((f) => {
            const def = facilityDefs.find((d) => d.type === f.type)
            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-100">{f.name}</span>
                    {def && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          def.setting === 'core'
                            ? 'bg-gray-800 text-gray-400 border-gray-700'
                            : def.setting === 'fr'
                              ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700'
                              : 'bg-orange-900/30 text-orange-400 border-orange-700'
                        }`}
                      >
                        Lv {def.level}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                      {f.space}
                    </span>
                    {f.enlarged && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700">
                        Enlarged
                      </span>
                    )}
                    {f.currentOrder && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${ORDER_COLORS[f.currentOrder]}`}>
                        {ORDER_LABELS[f.currentOrder]}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(f.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {def && <p className="text-xs text-gray-500 mb-2">{def.description}</p>}
                {def?.charm && (
                  <div className="text-xs text-purple-300 mb-2">
                    Charm: {def.charm.description} ({def.charm.duration})
                  </div>
                )}
                {def?.permanentBenefit && (
                  <div className="text-xs text-amber-300 mb-2">Benefit: {def.permanentBenefit}</div>
                )}
                {/* Order types */}
                {def && def.orders.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    {def.orders.map((o) => (
                      <span key={o} className={`text-xs px-1.5 py-0.5 rounded border ${ORDER_COLORS[o]}`}>
                        {ORDER_LABELS[o]}
                      </span>
                    ))}
                  </div>
                )}
                {/* Hirelings */}
                {def && def.hirelingCount > 0 && (
                  <div className="text-xs text-gray-500">
                    Hirelings:{' '}
                    {f.hirelingNames.length > 0 ? f.hirelingNames.join(', ') : `0/${def.hirelingCount} assigned`}
                  </div>
                )}
                {/* Type-specific config */}
                {f.type === 'garden' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Type:</span>
                    <select
                      value={f.gardenType || 'herb'}
                      onChange={(e) => onConfigure(f.id, { gardenType: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="decorative">Decorative</option>
                      <option value="food">Food</option>
                      <option value="herb">Herb</option>
                      <option value="poison">Poison</option>
                    </select>
                  </div>
                )}
                {f.type === 'training-area' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Trainer:</span>
                    <select
                      value={f.trainerType || 'battle'}
                      onChange={(e) => onConfigure(f.id, { trainerType: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="battle">Battle</option>
                      <option value="skills">Skills</option>
                      <option value="tools">Tools</option>
                      <option value="unarmed-combat">Unarmed Combat</option>
                      <option value="weapon">Weapon</option>
                    </select>
                  </div>
                )}
                {/* Creatures (menagerie) */}
                {(f.type === 'menagerie' || f.type === 'emerald-enclave-grove') &&
                  f.creatures &&
                  f.creatures.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Creatures: </span>
                      {f.creatures.map((c, i) => (
                        <span key={i} className="text-xs text-gray-300">
                          {c.name} ({c.size}){i < (f.creatures?.length ?? 0) - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TurnsTab({ bastion, onStartTurn }: { bastion: Bastion; onStartTurn: () => void }): JSX.Element {
  const sortedTurns = [...bastion.turns].sort((a, b) => b.turnNumber - a.turnNumber)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Bastion Turns ({bastion.turns.length})</h2>
        <button
          onClick={onStartTurn}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
        >
          + New Turn
        </button>
      </div>
      {sortedTurns.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No turns recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {sortedTurns.map((turn) => (
            <div key={turn.turnNumber} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                    Turn {turn.turnNumber}
                  </span>
                  <span className="text-xs text-gray-500">{turn.inGameDate}</span>
                </div>
                {turn.resolvedAt ? (
                  <span className="text-xs text-green-400">Completed</span>
                ) : (
                  <span className="text-xs text-amber-400">In Progress</span>
                )}
              </div>
              {/* Orders */}
              {turn.orders.length > 0 && (
                <div className="space-y-1 mb-2">
                  {turn.orders.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded border ${ORDER_COLORS[o.orderType]}`}>
                        {ORDER_LABELS[o.orderType]}
                      </span>
                      <span className="text-gray-300">
                        {o.facilityName}: {o.details || 'No details'}
                      </span>
                      {(o.goldCost ?? 0) > 0 && <span className="text-red-400">-{o.goldCost} GP</span>}
                      {(o.goldGained ?? 0) > 0 && <span className="text-green-400">+{o.goldGained} GP</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Event */}
              {turn.eventOutcome && (
                <div className="bg-gray-800/50 rounded p-2 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                      d100: {turn.eventRoll}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{turn.eventType?.replace(/-/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-300">{turn.eventOutcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DefendersTab({
  bastion,
  onRecruit,
  onRemove,
  onBuildWalls
}: {
  bastion: Bastion
  onRecruit: () => void
  onRemove: (ids: string[]) => void
  onBuildWalls: () => void
}): JSX.Element {
  const barracks = bastion.specialFacilities.filter((f) => f.type === 'barrack')
  const hasArmory = bastion.specialFacilities.some((f) => f.type === 'armory')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Defenders" value={bastion.defenders.length} />
        <SummaryCard label="Barracks" value={barracks.length} />
        <SummaryCard label="Armory" value={hasArmory ? 'Stocked' : 'None'} />
      </div>

      {/* Defender roster by barrack */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Defender Roster</h3>
          <button
            onClick={onRecruit}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            + Recruit
          </button>
        </div>
        {barracks.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">
            Build a Barrack special facility to recruit defenders.
          </div>
        ) : (
          barracks.map((barrack) => {
            const defenders = bastion.defenders.filter((d) => d.barrackId === barrack.id)
            const max = barrack.space === 'vast' ? 25 : 12
            return (
              <div key={barrack.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-100">
                    {barrack.name} ({defenders.length}/{max})
                  </span>
                </div>
                {defenders.length === 0 ? (
                  <p className="text-xs text-gray-500">No defenders assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {defenders.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-1 text-xs bg-gray-800 rounded px-2 py-1 border border-gray-700"
                      >
                        <span className="text-gray-200">{d.name}</span>
                        {d.isUndead && <span className="text-purple-400">(Undead)</span>}
                        {d.isConstruct && <span className="text-orange-400">(Construct)</span>}
                        <button onClick={() => onRemove([d.id])} className="text-red-400 hover:text-red-300 ml-1">
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
        {/* Unassigned defenders */}
        {bastion.defenders.filter((d) => !d.barrackId).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <span className="font-medium text-sm text-gray-100 mb-2 block">Unassigned Defenders</span>
            <div className="flex flex-wrap gap-2">
              {bastion.defenders
                .filter((d) => !d.barrackId)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-1 text-xs bg-gray-800 rounded px-2 py-1 border border-gray-700"
                  >
                    <span className="text-gray-200">{d.name}</span>
                    <button onClick={() => onRemove([d.id])} className="text-red-400 hover:text-red-300 ml-1">
                      x
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Defensive Walls */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">Defensive Walls</h3>
          <button
            onClick={onBuildWalls}
            className="px-3 py-1.5 text-sm border border-gray-600 hover:border-amber-600 text-gray-300 hover:text-amber-400 rounded transition-colors"
          >
            + Build Walls
          </button>
        </div>
        {bastion.defensiveWalls ? (
          <div className="text-xs text-gray-400">
            {bastion.defensiveWalls.squaresBuilt} squares built
            {bastion.defensiveWalls.fullyEnclosed && (
              <span className="text-green-400 ml-2">(Fully enclosed: -2 attack losses)</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No defensive walls. Each 5-ft square costs 250 GP and 10 days.</p>
        )}
      </div>
    </div>
  )
}

function EventsTab({ bastion }: { bastion: Bastion }): JSX.Element {
  const [filterType, setFilterType] = useState<string>('all')
  const events = bastion.turns.filter((t) => t.eventOutcome).sort((a, b) => b.turnNumber - a.turnNumber)

  const filteredEvents = filterType === 'all' ? events : events.filter((t) => t.eventType === filterType)

  const eventTypes = Array.from(new Set(events.map((t) => t.eventType).filter(Boolean))) as string[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Events Log ({filteredEvents.length})</h2>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Events</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      {filteredEvents.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No events recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((turn) => (
            <div key={turn.turnNumber} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                  Turn {turn.turnNumber}
                </span>
                <span className="text-xs text-gray-500">{turn.inGameDate}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                  d100: {turn.eventRoll}
                </span>
                <span className="text-xs text-gray-400 capitalize">{turn.eventType?.replace(/-/g, ' ')}</span>
              </div>
              <p className="text-sm text-gray-200">{turn.eventOutcome}</p>
              {turn.eventDetails && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(turn.eventDetails as Record<string, unknown>).goldGained != null && (
                    <span className="text-xs text-green-400">
                      +{String((turn.eventDetails as Record<string, unknown>).goldGained)} GP
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
