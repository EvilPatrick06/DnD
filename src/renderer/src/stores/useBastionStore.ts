import { create } from 'zustand'
import { resolveAttackEvent, rollBastionEvent } from '../data/bastion-events'
import { logger } from '../utils/logger'
import type {
  BasicFacility,
  BasicFacilityType,
  Bastion,
  BastionDefender,
  BastionOrderType,
  BastionTurn,
  ConstructionProject,
  FacilitySpace,
  MenagerieCreature,
  SpecialFacility,
  SpecialFacilityDef,
  SpecialFacilityType,
  TurnOrder
} from '../types/bastion'
import { migrateBastion, SPECIAL_FACILITY_COSTS } from '../types/bastion'

interface BastionState {
  bastions: Bastion[]
  loading: boolean
  hasLoaded: boolean
  facilityDefs: SpecialFacilityDef[]

  // CRUD
  loadBastions: () => Promise<void>
  saveBastion: (bastion: Bastion) => Promise<void>
  deleteBastion: (id: string) => Promise<void>
  deleteAllBastions: () => Promise<void>
  setFacilityDefs: (defs: SpecialFacilityDef[]) => void

  // Basic Facilities
  addBasicFacility: (bastionId: string, type: BasicFacilityType, name: string, space: FacilitySpace) => void
  removeBasicFacility: (bastionId: string, facilityId: string) => void

  // Special Facilities
  addSpecialFacility: (bastionId: string, type: SpecialFacilityType, name: string, space: FacilitySpace) => void
  removeSpecialFacility: (bastionId: string, facilityId: string) => void
  swapSpecialFacility: (
    bastionId: string,
    oldId: string,
    newType: SpecialFacilityType,
    newName: string,
    newSpace: FacilitySpace
  ) => void
  enlargeSpecialFacility: (bastionId: string, facilityId: string) => void
  configureFacility: (bastionId: string, facilityId: string, config: Partial<SpecialFacility>) => void

  // Bastion Turns
  advanceTime: (bastionId: string, days: number) => void
  checkAndTriggerTurn: (bastionId: string) => boolean
  startTurn: (bastionId: string) => BastionTurn | null
  issueOrder: (
    bastionId: string,
    turnNumber: number,
    facilityId: string,
    orderType: BastionOrderType,
    details: string,
    goldCost?: number
  ) => void
  issueMaintainOrder: (bastionId: string, turnNumber: number) => void
  rollAndResolveEvent: (bastionId: string, turnNumber: number) => void
  completeTurn: (bastionId: string, turnNumber: number) => void

  // Defenders
  recruitDefenders: (bastionId: string, barrackId: string, names: string[]) => void
  removeDefenders: (bastionId: string, defenderIds: string[]) => void

  // Construction
  startConstruction: (
    bastionId: string,
    project: Omit<ConstructionProject, 'id' | 'startedAt' | 'daysCompleted'>
  ) => void
  completeConstruction: (bastionId: string, projectId: string) => void

  // Defensive Walls
  buildDefensiveWalls: (bastionId: string, squares: number) => void

  // Treasury
  depositGold: (bastionId: string, amount: number) => void
  withdrawGold: (bastionId: string, amount: number) => void

  // Menagerie/Creatures
  addCreature: (bastionId: string, facilityId: string, creature: MenagerieCreature) => void
  removeCreature: (bastionId: string, facilityId: string, creatureName: string) => void

  // Notes
  updateNotes: (bastionId: string, notes: string) => void
}

function getBastion(bastions: Bastion[], id: string): Bastion | undefined {
  return bastions.find((b) => b.id === id)
}

function updateBastion(bastions: Bastion[], id: string, updates: Partial<Bastion>): Bastion[] {
  return bastions.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b))
}

export const useBastionStore = create<BastionState>((set, get) => ({
  bastions: [],
  loading: false,
  facilityDefs: [],
  hasLoaded: false,

  loadBastions: async () => {
    if (get().hasLoaded) return
    set({ loading: true })
    try {
      const rawData = await window.api.loadBastions()
      const rawArray = rawData as unknown as Record<string, unknown>[]
      const bastions = rawArray.map((raw) => migrateBastion(raw))

      // Auto-save any bastions that were migrated from old format
      for (let i = 0; i < bastions.length; i++) {
        const raw = rawArray[i]
        if (!('basicFacilities' in raw && 'specialFacilities' in raw)) {
          await window.api.saveBastion(bastions[i] as unknown as Record<string, unknown>)
        }
      }

      set({ bastions, loading: false, hasLoaded: true })
    } catch (error) {
      console.error('Failed to load bastions:', error)
      set({ loading: false })
    }
  },

  saveBastion: async (bastion: Bastion) => {
    try {
      await window.api.saveBastion(bastion as unknown as Record<string, unknown>)
      const { bastions } = get()
      const index = bastions.findIndex((b) => b.id === bastion.id)
      if (index >= 0) {
        const updated = [...bastions]
        updated[index] = bastion
        set({ bastions: updated })
      } else {
        set({ bastions: [...bastions, bastion] })
      }
    } catch (error) {
      console.error('Failed to save bastion:', error)
    }
  },

  deleteBastion: async (id: string) => {
    try {
      await window.api.deleteBastion(id)
      set({ bastions: get().bastions.filter((b) => b.id !== id) })
    } catch (error) {
      console.error('Failed to delete bastion:', error)
    }
  },

  deleteAllBastions: async () => {
    const { bastions } = get()
    for (const b of bastions) {
      try {
        await window.api.deleteBastion(b.id)
      } catch (error) {
        console.error('Failed to delete bastion:', b.id, error)
      }
    }
    set({ bastions: [] })
  },

  setFacilityDefs: (defs) => set({ facilityDefs: defs }),

  // ---- Basic Facilities ----

  addBasicFacility: (bastionId, type, name, space) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const facility: BasicFacility = {
      id: crypto.randomUUID(),
      type,
      name,
      space,
      order: bastion.basicFacilities.length
    }
    const updated: Bastion = {
      ...bastion,
      basicFacilities: [...bastion.basicFacilities, facility],
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  removeBasicFacility: (bastionId, facilityId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      basicFacilities: bastion.basicFacilities.filter((f) => f.id !== facilityId),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Special Facilities ----

  addSpecialFacility: (bastionId, type, name, space) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    // Look up facility def to get level for cost calculation
    const def = get().facilityDefs.find((d) => d.type === type)
    const facilityLevel = def?.level ?? 5
    const costs = SPECIAL_FACILITY_COSTS[facilityLevel] ?? SPECIAL_FACILITY_COSTS[5]

    // Check treasury
    if (bastion.treasury < costs.gp) {
      logger.warn(`[Bastion] Not enough gold to build ${name}. Need ${costs.gp} gp, have ${bastion.treasury} gp`)
      return
    }

    // Create construction project instead of instant build
    const project: ConstructionProject = {
      id: crypto.randomUUID(),
      projectType: 'add-special',
      specialFacilityType: type,
      specialFacilityName: name,
      specialFacilitySpace: space,
      cost: costs.gp,
      daysRequired: costs.days,
      daysCompleted: 0,
      startedAt: new Date().toISOString()
    }

    const updated: Bastion = {
      ...bastion,
      construction: [...bastion.construction, project],
      treasury: bastion.treasury - costs.gp,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  removeSpecialFacility: (bastionId, facilityId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.filter((f) => f.id !== facilityId),
      defenders: bastion.defenders.filter((d) => d.barrackId !== facilityId),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  swapSpecialFacility: (bastionId, oldId, newType, newName, newSpace) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const oldFacility = bastion.specialFacilities.find((f) => f.id === oldId)
    if (!oldFacility) return
    const newFacility: SpecialFacility = {
      id: crypto.randomUUID(),
      type: newType,
      name: newName,
      space: newSpace,
      enlarged: false,
      currentOrder: null,
      orderStartedAt: null,
      hirelingNames: [],
      order: oldFacility.order
    }
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.map((f) => (f.id === oldId ? newFacility : f)),
      defenders: bastion.defenders.filter((d) => d.barrackId !== oldId),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  enlargeSpecialFacility: (bastionId, facilityId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.map((f) => (f.id === facilityId ? { ...f, enlarged: true } : f)),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  configureFacility: (bastionId, facilityId, config) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.map((f) => (f.id === facilityId ? { ...f, ...config } : f)),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Bastion Turns ----

  advanceTime: (bastionId, days) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    const newDay = bastion.inGameTime.currentDay + days

    // Advance construction projects
    const updatedConstruction = bastion.construction.map((p) => ({
      ...p,
      daysCompleted: Math.min(p.daysCompleted + days, p.daysRequired)
    }))

    // Complete finished projects
    const completed = updatedConstruction.filter((p) => p.daysCompleted >= p.daysRequired)
    const remaining = updatedConstruction.filter((p) => p.daysCompleted < p.daysRequired)

    const basicFacilities = [...bastion.basicFacilities]
    const specialFacilities = [...bastion.specialFacilities]
    for (const project of completed) {
      if (project.projectType === 'add-basic' && project.facilityType) {
        basicFacilities.push({
          id: crypto.randomUUID(),
          type: project.facilityType,
          name: project.facilityType
            .split('-')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' '),
          space: project.targetSpace || 'roomy',
          order: basicFacilities.length
        })
      } else if (project.projectType === 'add-special' && project.specialFacilityType) {
        specialFacilities.push({
          id: crypto.randomUUID(),
          type: project.specialFacilityType,
          name:
            project.specialFacilityName ||
            project.specialFacilityType
              .split('-')
              .map((w) => w[0].toUpperCase() + w.slice(1))
              .join(' '),
          space: project.specialFacilitySpace || 'roomy',
          enlarged: false,
          currentOrder: null,
          orderStartedAt: null,
          hirelingNames: [],
          order: specialFacilities.length
        })
      }
    }

    const updated: Bastion = {
      ...bastion,
      inGameTime: { ...bastion.inGameTime, currentDay: newDay },
      construction: remaining,
      basicFacilities,
      specialFacilities,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)

    // Check if turn is due
    if (newDay - bastion.inGameTime.lastBastionTurnDay >= bastion.inGameTime.turnFrequencyDays) {
      get().checkAndTriggerTurn(bastionId)
    }
  },

  checkAndTriggerTurn: (bastionId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return false
    const daysSinceLast = bastion.inGameTime.currentDay - bastion.inGameTime.lastBastionTurnDay
    return daysSinceLast >= bastion.inGameTime.turnFrequencyDays
  },

  startTurn: (bastionId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return null
    const nextTurnNumber = bastion.turns.length > 0 ? Math.max(...bastion.turns.map((t) => t.turnNumber)) + 1 : 1

    const turn: BastionTurn = {
      turnNumber: nextTurnNumber,
      inGameDate: `Day ${bastion.inGameTime.currentDay}`,
      orders: [],
      maintainIssued: false,
      eventRoll: null,
      eventType: null,
      eventOutcome: null,
      resolvedAt: null
    }

    const updated: Bastion = {
      ...bastion,
      turns: [...bastion.turns, turn],
      inGameTime: {
        ...bastion.inGameTime,
        lastBastionTurnDay: bastion.inGameTime.currentDay
      },
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
    return turn
  },

  issueOrder: (bastionId, turnNumber, facilityId, orderType, details, goldCost) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    const facility = bastion.specialFacilities.find((f) => f.id === facilityId)
    if (!facility) return

    const order: TurnOrder = {
      facilityId,
      facilityName: facility.name,
      orderType,
      details,
      goldCost: goldCost || 0
    }

    let treasury = bastion.treasury
    if (goldCost && goldCost > 0) {
      treasury = Math.max(0, treasury - goldCost)
    }

    const updated: Bastion = {
      ...bastion,
      turns: bastion.turns.map((t) => (t.turnNumber === turnNumber ? { ...t, orders: [...t.orders, order] } : t)),
      specialFacilities: bastion.specialFacilities.map((f) =>
        f.id === facilityId ? { ...f, currentOrder: orderType, orderStartedAt: new Date().toISOString() } : f
      ),
      treasury,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  issueMaintainOrder: (bastionId, turnNumber) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    const updated: Bastion = {
      ...bastion,
      turns: bastion.turns.map((t) => (t.turnNumber === turnNumber ? { ...t, maintainIssued: true } : t)),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  rollAndResolveEvent: (bastionId, turnNumber) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    const turn = bastion.turns.find((t) => t.turnNumber === turnNumber)
    if (!turn || !turn.maintainIssued) return

    const eventResult = rollBastionEvent()
    let treasury = bastion.treasury
    let defenders = [...bastion.defenders]
    const eventDetails: Record<string, unknown> = { ...eventResult.subRolls }

    // Auto-resolve certain events
    if (eventResult.eventType === 'attack') {
      const hasArmory = bastion.specialFacilities.some((f) => f.type === 'armory')
      const hasWalls = bastion.defensiveWalls?.fullyEnclosed || false
      const attackResult = resolveAttackEvent(defenders.length, hasArmory, hasWalls)
      eventDetails.attackResult = attackResult

      // Remove killed defenders (from the end of the list)
      if (attackResult.defendersLost > 0) {
        defenders = defenders.slice(0, defenders.length - attackResult.defendersLost)
      }
    } else if (eventResult.eventType === 'friendly-visitors') {
      const income = (eventResult.subRolls['d6-income'] || 1) * 100
      treasury += income
      eventDetails.goldGained = income
    } else if (eventResult.eventType === 'refugees') {
      const income = (eventResult.subRolls['d6-refugee-income'] || 1) * 100
      treasury += income
      eventDetails.goldGained = income
    }

    const updated: Bastion = {
      ...bastion,
      turns: bastion.turns.map((t) =>
        t.turnNumber === turnNumber
          ? {
              ...t,
              eventRoll: eventResult.roll,
              eventType: eventResult.eventType,
              eventOutcome: eventResult.description,
              eventDetails
            }
          : t
      ),
      treasury,
      defenders,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  completeTurn: (bastionId, turnNumber) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return

    const updated: Bastion = {
      ...bastion,
      turns: bastion.turns.map((t) =>
        t.turnNumber === turnNumber ? { ...t, resolvedAt: new Date().toISOString() } : t
      ),
      specialFacilities: bastion.specialFacilities.map((f) => ({
        ...f,
        currentOrder: null,
        orderStartedAt: null
      })),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Defenders ----

  recruitDefenders: (bastionId, barrackId, names) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const newDefenders: BastionDefender[] = names.map((name) => ({
      id: crypto.randomUUID(),
      name,
      barrackId
    }))
    const updated: Bastion = {
      ...bastion,
      defenders: [...bastion.defenders, ...newDefenders],
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  removeDefenders: (bastionId, defenderIds) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const idSet = new Set(defenderIds)
    const updated: Bastion = {
      ...bastion,
      defenders: bastion.defenders.filter((d) => !idSet.has(d.id)),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Construction ----

  startConstruction: (bastionId, project) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const fullProject: ConstructionProject = {
      ...project,
      id: crypto.randomUUID(),
      daysCompleted: 0,
      startedAt: new Date().toISOString()
    }
    const updated: Bastion = {
      ...bastion,
      construction: [...bastion.construction, fullProject],
      treasury: Math.max(0, bastion.treasury - project.cost),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  completeConstruction: (bastionId, projectId) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const project = bastion.construction.find((p) => p.id === projectId)
    if (!project) return

    const basicFacilities = [...bastion.basicFacilities]
    const specialFacilities = [...bastion.specialFacilities]

    if (project.projectType === 'add-basic' && project.facilityType) {
      basicFacilities.push({
        id: crypto.randomUUID(),
        type: project.facilityType,
        name: project.facilityType
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' '),
        space: project.targetSpace || 'roomy',
        order: basicFacilities.length
      })
    } else if (project.projectType === 'add-special' && project.specialFacilityType) {
      specialFacilities.push({
        id: crypto.randomUUID(),
        type: project.specialFacilityType,
        name:
          project.specialFacilityName ||
          project.specialFacilityType
            .split('-')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' '),
        space: project.specialFacilitySpace || 'roomy',
        enlarged: false,
        currentOrder: null,
        orderStartedAt: null,
        hirelingNames: [],
        order: specialFacilities.length
      })
    }

    const updated: Bastion = {
      ...bastion,
      construction: bastion.construction.filter((p) => p.id !== projectId),
      basicFacilities,
      specialFacilities,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Defensive Walls ----

  buildDefensiveWalls: (bastionId, squares) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const cost = squares * 250
    const days = squares * 10
    const currentWalls = bastion.defensiveWalls || { squaresBuilt: 0, fullyEnclosed: false }
    // Add as construction project
    const project: ConstructionProject = {
      id: crypto.randomUUID(),
      projectType: 'defensive-wall',
      cost,
      daysRequired: days,
      daysCompleted: 0,
      startedAt: new Date().toISOString()
    }
    const updated: Bastion = {
      ...bastion,
      construction: [...bastion.construction, project],
      defensiveWalls: {
        ...currentWalls,
        squaresBuilt: currentWalls.squaresBuilt + squares
      },
      treasury: Math.max(0, bastion.treasury - cost),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Treasury ----

  depositGold: (bastionId, amount) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion || amount <= 0) return
    const bastions = updateBastion(get().bastions, bastionId, {
      treasury: bastion.treasury + amount
    })
    const updated = bastions.find((b) => b.id === bastionId)
    if (updated) get().saveBastion(updated)
  },

  withdrawGold: (bastionId, amount) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion || amount <= 0) return
    const bastions = updateBastion(get().bastions, bastionId, {
      treasury: Math.max(0, bastion.treasury - amount)
    })
    const updated = bastions.find((b) => b.id === bastionId)
    if (updated) get().saveBastion(updated)
  },

  // ---- Menagerie/Creatures ----

  addCreature: (bastionId, facilityId, creature) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.map((f) =>
        f.id === facilityId ? { ...f, creatures: [...(f.creatures || []), creature] } : f
      ),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  removeCreature: (bastionId, facilityId, creatureName) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      specialFacilities: bastion.specialFacilities.map((f) => {
        if (f.id !== facilityId) return f
        const creatures = [...(f.creatures || [])]
        const idx = creatures.findIndex((c) => c.name === creatureName)
        if (idx >= 0) creatures.splice(idx, 1)
        return { ...f, creatures }
      }),
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  },

  // ---- Notes ----

  updateNotes: (bastionId, notes) => {
    const bastion = getBastion(get().bastions, bastionId)
    if (!bastion) return
    const updated: Bastion = {
      ...bastion,
      notes,
      updatedAt: new Date().toISOString()
    }
    get().saveBastion(updated)
  }
}))
