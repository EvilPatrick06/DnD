import { useMemo, useState } from 'react'
import Modal from '../../components/ui/Modal'
import type {
  BasicFacilityDef,
  BasicFacilityType,
  Bastion,
  BastionOrderType,
  ConstructionProject,
  FacilitySpace,
  SpecialFacilityDef,
  SpecialFacilityType
} from '../../types/bastion'
import { BASIC_FACILITY_COSTS, createDefaultBastion, SPECIAL_FACILITY_COSTS } from '../../types/bastion'
import type { Character } from '../../types/character'
import type { Character5e } from '../../types/character-5e'
import { getFacilityEligibility } from '../../utils/bastion-prerequisites'
import { ORDER_COLORS, ORDER_LABELS, SETTING_LABELS } from './bastion-constants'

export interface BastionModalsProps {
  // Visibility toggles
  showCreateModal: boolean
  setShowCreateModal: (v: boolean) => void
  showAddBasic: boolean
  setShowAddBasic: (v: boolean) => void
  showAddSpecial: boolean
  setShowAddSpecial: (v: boolean) => void
  showTurnModal: boolean
  setShowTurnModal: (v: boolean) => void
  showRecruitModal: boolean
  setShowRecruitModal: (v: boolean) => void
  showWallsModal: boolean
  setShowWallsModal: (v: boolean) => void
  showTreasuryModal: boolean
  setShowTreasuryModal: (v: boolean) => void
  showAdvanceTime: boolean
  setShowAdvanceTime: (v: boolean) => void
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (v: boolean) => void

  // Data
  selectedBastion: Bastion | undefined
  characters: Character[]
  facilityDefs: SpecialFacilityDef[]
  basicFacilityDefs: BasicFacilityDef[]
  maxSpecial: number
  maxFacilityLevel: number
  owner5e: Character5e | null

  // Store callbacks
  saveBastion: (b: Bastion) => void
  setSelectedBastionId: (id: string | null) => void
  addSpecialFacility: (bastionId: string, type: SpecialFacilityType, name: string, space: FacilitySpace) => void
  startConstruction: (
    bastionId: string,
    project: Omit<ConstructionProject, 'id' | 'startedAt' | 'daysCompleted'>
  ) => void
  startTurn: (bastionId: string) => ReturnType<(id: string) => { turnNumber: number } | null>
  issueOrder: (
    bastionId: string,
    turnNumber: number,
    facilityId: string,
    orderType: BastionOrderType,
    details: string,
    cost: number
  ) => void
  issueMaintainOrder: (bastionId: string, turnNumber: number) => void
  rollAndResolveEvent: (bastionId: string, turnNumber: number) => void
  completeTurn: (bastionId: string, turnNumber: number) => void
  recruitDefenders: (bastionId: string, barrackId: string, names: string[]) => void
  buildDefensiveWalls: (bastionId: string, squares: number) => void
  depositGold: (bastionId: string, amount: number) => void
  withdrawGold: (bastionId: string, amount: number) => void
  advanceTime: (bastionId: string, days: number) => void
  deleteBastion: (bastionId: string) => void
}

// ---- Create Bastion Modal ----

function CreateBastionModal({
  open,
  onClose,
  characters,
  saveBastion,
  setSelectedBastionId
}: {
  open: boolean
  onClose: () => void
  characters: Character[]
  saveBastion: (b: Bastion) => void
  setSelectedBastionId: (id: string | null) => void
}): JSX.Element {
  const [newName, setNewName] = useState('')
  const [newOwnerId, setNewOwnerId] = useState('')

  const handleCreate = (): void => {
    if (!newName.trim() || !newOwnerId) return
    const bastion = createDefaultBastion(newOwnerId, newName.trim())
    saveBastion(bastion)
    setSelectedBastionId(bastion.id)
    onClose()
    setNewName('')
    setNewOwnerId('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Bastion">
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
            onClick={onClose}
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
  )
}

// ---- Add Basic Facility Modal ----

function AddBasicFacilityModal({
  open,
  onClose,
  selectedBastion,
  basicFacilityDefs,
  startConstruction
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  basicFacilityDefs: BasicFacilityDef[]
  startConstruction: BastionModalsProps['startConstruction']
}): JSX.Element {
  const [basicType, setBasicType] = useState<BasicFacilityType>('bedroom')
  const [basicSpace, setBasicSpace] = useState<FacilitySpace>('roomy')

  const handleAddBasic = (): void => {
    if (!selectedBastion) return
    const cost = BASIC_FACILITY_COSTS[basicSpace]
    startConstruction(selectedBastion.id, {
      projectType: 'add-basic',
      facilityType: basicType,
      targetSpace: basicSpace,
      cost: cost.gp,
      daysRequired: cost.days
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Basic Facility">
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
          Cost: {BASIC_FACILITY_COSTS[basicSpace].gp} GP &middot; Construction: {BASIC_FACILITY_COSTS[basicSpace].days}{' '}
          days
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
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
  )
}

// ---- Add Special Facility Modal ----

function AddSpecialFacilityModal({
  open,
  onClose,
  selectedBastion,
  facilityDefs,
  maxSpecial,
  maxFacilityLevel,
  owner5e,
  addSpecialFacility
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  facilityDefs: SpecialFacilityDef[]
  maxSpecial: number
  maxFacilityLevel: number
  owner5e: Character5e | null
  addSpecialFacility: BastionModalsProps['addSpecialFacility']
}): JSX.Element {
  const [settingFilter, setSettingFilter] = useState<'all' | 'core' | 'fr' | 'eberron'>('all')
  const [selectedSpecialType, setSelectedSpecialType] = useState<SpecialFacilityType | null>(null)
  const [factionOverride, setFactionOverride] = useState(false)

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

  const handleClose = (): void => {
    onClose()
    setSelectedSpecialType(null)
    setFactionOverride(false)
  }

  const handleAddSpecial = (): void => {
    if (!selectedBastion || !selectedSpecialDef) return
    addSpecialFacility(
      selectedBastion.id,
      selectedSpecialDef.type,
      selectedSpecialDef.name,
      selectedSpecialDef.defaultSpace
    )
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Special Facility">
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
            const isFaction = def.prerequisite?.type === 'faction-renown'
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
              handleClose()
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
  )
}

// ---- Bastion Turn Modal ----

function BastionTurnModal({
  open,
  onClose,
  selectedBastion,
  facilityDefs,
  activeTurnNumber,
  setActiveTurnNumber,
  startTurn,
  issueOrder,
  issueMaintainOrder,
  rollAndResolveEvent,
  completeTurn
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  facilityDefs: SpecialFacilityDef[]
  activeTurnNumber: number | null
  setActiveTurnNumber: (n: number | null) => void
  startTurn: BastionModalsProps['startTurn']
  issueOrder: BastionModalsProps['issueOrder']
  issueMaintainOrder: BastionModalsProps['issueMaintainOrder']
  rollAndResolveEvent: BastionModalsProps['rollAndResolveEvent']
  completeTurn: BastionModalsProps['completeTurn']
}): JSX.Element {
  const [turnOrders, setTurnOrders] = useState<
    Record<string, { orderType: BastionOrderType; details: string; cost: number }>
  >({})
  const [turnMaintain, setTurnMaintain] = useState(false)
  const [turnStep, setTurnStep] = useState<'orders' | 'event' | 'summary'>('orders')

  const activeTurn = selectedBastion?.turns.find((t) => t.turnNumber === activeTurnNumber) ?? null

  const handleExecuteTurn = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return
    for (const [facilityId, order] of Object.entries(turnOrders)) {
      issueOrder(selectedBastion.id, activeTurnNumber, facilityId, order.orderType, order.details, order.cost)
    }
    if (turnMaintain) {
      issueMaintainOrder(selectedBastion.id, activeTurnNumber)
    }
    setTurnStep('event')
  }

  const handleRollEvent = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return
    if (!turnMaintain) {
      issueMaintainOrder(selectedBastion.id, activeTurnNumber)
    }
    rollAndResolveEvent(selectedBastion.id, activeTurnNumber)
    setTurnStep('summary')
  }

  const handleCompleteTurn = (): void => {
    if (!selectedBastion || activeTurnNumber === null) return
    completeTurn(selectedBastion.id, activeTurnNumber)
    onClose()
    setActiveTurnNumber(null)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Bastion Turn ${activeTurnNumber ?? ''}`}>
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
                onClick={onClose}
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
  )
}

// ---- Recruit Defenders Modal ----

function RecruitDefendersModal({
  open,
  onClose,
  selectedBastion,
  recruitDefenders
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  recruitDefenders: BastionModalsProps['recruitDefenders']
}): JSX.Element {
  const [recruitBarrackId, setRecruitBarrackId] = useState('')
  const [recruitNames, setRecruitNames] = useState('')

  const barracks = selectedBastion?.specialFacilities.filter((f) => f.type === 'barrack') ?? []

  const handleRecruit = (): void => {
    if (!selectedBastion || !recruitBarrackId || !recruitNames.trim()) return
    const names = recruitNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    recruitDefenders(selectedBastion.id, recruitBarrackId, names)
    onClose()
    setRecruitNames('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Recruit Defenders">
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
            onClick={onClose}
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
  )
}

// ---- Build Walls Modal ----

function BuildWallsModal({
  open,
  onClose,
  selectedBastion,
  buildDefensiveWalls
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  buildDefensiveWalls: BastionModalsProps['buildDefensiveWalls']
}): JSX.Element {
  const [wallSquares, setWallSquares] = useState(1)

  const handleBuildWalls = (): void => {
    if (!selectedBastion || wallSquares <= 0) return
    buildDefensiveWalls(selectedBastion.id, wallSquares)
    onClose()
    setWallSquares(1)
  }

  return (
    <Modal open={open} onClose={onClose} title="Build Defensive Walls">
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
            onClick={onClose}
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
  )
}

// ---- Treasury Modal ----

function TreasuryModal({
  open,
  onClose,
  selectedBastion,
  depositGold,
  withdrawGold
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  depositGold: BastionModalsProps['depositGold']
  withdrawGold: BastionModalsProps['withdrawGold']
}): JSX.Element {
  const [treasuryAmount, setTreasuryAmount] = useState(0)
  const [treasuryMode, setTreasuryMode] = useState<'deposit' | 'withdraw'>('deposit')

  const handleTreasury = (): void => {
    if (!selectedBastion || treasuryAmount <= 0) return
    if (treasuryMode === 'deposit') {
      depositGold(selectedBastion.id, treasuryAmount)
    } else {
      withdrawGold(selectedBastion.id, treasuryAmount)
    }
    onClose()
    setTreasuryAmount(0)
  }

  return (
    <Modal open={open} onClose={onClose} title="Bastion Treasury">
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
            onClick={onClose}
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
  )
}

// ---- Advance Time Modal ----

function AdvanceTimeModal({
  open,
  onClose,
  selectedBastion,
  advanceTime
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  advanceTime: BastionModalsProps['advanceTime']
}): JSX.Element {
  const [advanceDays, setAdvanceDays] = useState(7)

  const handleAdvanceTime = (): void => {
    if (!selectedBastion || advanceDays <= 0) return
    advanceTime(selectedBastion.id, advanceDays)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Advance In-Game Time">
      <div className="space-y-4">
        <div className="text-sm text-gray-400">
          Current day: <span className="text-amber-400 font-medium">{selectedBastion?.inGameTime.currentDay ?? 1}</span>
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
            onClick={onClose}
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
  )
}

// ---- Delete Bastion Modal ----

function DeleteBastionModal({
  open,
  onClose,
  selectedBastion,
  deleteBastion,
  setSelectedBastionId
}: {
  open: boolean
  onClose: () => void
  selectedBastion: Bastion | undefined
  deleteBastion: BastionModalsProps['deleteBastion']
  setSelectedBastionId: (id: string | null) => void
}): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title="Delete Bastion">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Are you sure you want to delete <span className="text-gray-200 font-medium">{selectedBastion?.name}</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedBastion) {
                deleteBastion(selectedBastion.id)
                setSelectedBastionId(null)
                onClose()
              }
            }}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---- Composite export ----

export default function BastionModals(props: BastionModalsProps): JSX.Element {
  const [activeTurnNumber, setActiveTurnNumber] = useState<number | null>(null)

  const handleStartTurnAndOpen = (): void => {
    if (!props.selectedBastion) return
    const turn = props.startTurn(props.selectedBastion.id)
    if (turn) {
      setActiveTurnNumber(turn.turnNumber)
    }
  }

  // Auto-start turn when showTurnModal becomes true
  // The parent calls handleStartTurn which opens the modal
  // We need to initialize turn when modal opens
  if (props.showTurnModal && activeTurnNumber === null && props.selectedBastion) {
    handleStartTurnAndOpen()
  }

  return (
    <>
      <CreateBastionModal
        open={props.showCreateModal}
        onClose={() => props.setShowCreateModal(false)}
        characters={props.characters}
        saveBastion={props.saveBastion}
        setSelectedBastionId={props.setSelectedBastionId}
      />
      <AddBasicFacilityModal
        open={props.showAddBasic}
        onClose={() => props.setShowAddBasic(false)}
        selectedBastion={props.selectedBastion}
        basicFacilityDefs={props.basicFacilityDefs}
        startConstruction={props.startConstruction}
      />
      <AddSpecialFacilityModal
        open={props.showAddSpecial}
        onClose={() => props.setShowAddSpecial(false)}
        selectedBastion={props.selectedBastion}
        facilityDefs={props.facilityDefs}
        maxSpecial={props.maxSpecial}
        maxFacilityLevel={props.maxFacilityLevel}
        owner5e={props.owner5e}
        addSpecialFacility={props.addSpecialFacility}
      />
      <BastionTurnModal
        open={props.showTurnModal}
        onClose={() => {
          props.setShowTurnModal(false)
          setActiveTurnNumber(null)
        }}
        selectedBastion={props.selectedBastion}
        facilityDefs={props.facilityDefs}
        activeTurnNumber={activeTurnNumber}
        setActiveTurnNumber={setActiveTurnNumber}
        startTurn={props.startTurn}
        issueOrder={props.issueOrder}
        issueMaintainOrder={props.issueMaintainOrder}
        rollAndResolveEvent={props.rollAndResolveEvent}
        completeTurn={props.completeTurn}
      />
      <RecruitDefendersModal
        open={props.showRecruitModal}
        onClose={() => props.setShowRecruitModal(false)}
        selectedBastion={props.selectedBastion}
        recruitDefenders={props.recruitDefenders}
      />
      <BuildWallsModal
        open={props.showWallsModal}
        onClose={() => props.setShowWallsModal(false)}
        selectedBastion={props.selectedBastion}
        buildDefensiveWalls={props.buildDefensiveWalls}
      />
      <TreasuryModal
        open={props.showTreasuryModal}
        onClose={() => props.setShowTreasuryModal(false)}
        selectedBastion={props.selectedBastion}
        depositGold={props.depositGold}
        withdrawGold={props.withdrawGold}
      />
      <AdvanceTimeModal
        open={props.showAdvanceTime}
        onClose={() => props.setShowAdvanceTime(false)}
        selectedBastion={props.selectedBastion}
        advanceTime={props.advanceTime}
      />
      <DeleteBastionModal
        open={props.showDeleteConfirm}
        onClose={() => props.setShowDeleteConfirm(false)}
        selectedBastion={props.selectedBastion}
        deleteBastion={props.deleteBastion}
        setSelectedBastionId={props.setSelectedBastionId}
      />
    </>
  )
}
