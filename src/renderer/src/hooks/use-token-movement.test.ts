import { describe, expect, it, vi } from 'vitest'

vi.mock('react', () => ({
  useState: vi.fn(() => [null, vi.fn()]),
  useEffect: vi.fn(),
  useCallback: vi.fn((fn) => fn),
  useMemo: vi.fn((fn) => fn()),
  useRef: vi.fn(() => ({ current: null }))
}))

vi.mock('../stores/use-game-store', () => ({
  useGameStore: Object.assign(
    vi.fn(() => ({
      initiative: null,
      turnStates: {},
      conditions: [],
      weatherOverride: null,
      moveToken: vi.fn(),
      useMovement: vi.fn(),
      updateToken: vi.fn(),
      removeToken: vi.fn(),
      removeFromInitiative: vi.fn(),
      setPartyVisionCells: vi.fn(),
      addExploredCells: vi.fn()
    })),
    {
      getState: vi.fn(() => ({}))
    }
  )
}))

vi.mock('../services/combat/combat-rules', () => ({
  isMoveBlockedByFear: vi.fn(() => false),
  proneStandUpCost: vi.fn(() => 15),
  triggersOpportunityAttack: vi.fn(() => false)
}))

vi.mock('../services/combat/reaction-tracker', () => ({
  checkOpportunityAttack: vi.fn(() => [])
}))

vi.mock('../services/map/vision-computation', () => ({
  recomputeVision: vi.fn(() => ({ visibleCells: [] }))
}))

vi.mock('../services/weather-mechanics', () => ({
  getWeatherEffects: vi.fn(() => ({ speedModifier: 1 }))
}))

describe('useTokenMovement', () => {
  it('can be imported', async () => {
    const mod = await import('./use-token-movement')
    expect(mod).toBeDefined()
  })

  it('exports useTokenMovement as a named function', async () => {
    const mod = await import('./use-token-movement')
    expect(typeof mod.useTokenMovement).toBe('function')
  })

  it('returns handleTokenMoveWithOA and handleConcentrationLost functions', async () => {
    const mod = await import('./use-token-movement')
    const result = mod.useTokenMovement({
      activeMap: null,
      teleportMove: false,
      addChatMessage: vi.fn(),
      setOaPrompt: vi.fn(),
      setConcCheckPrompt: vi.fn()
    })
    expect(typeof result.handleTokenMoveWithOA).toBe('function')
    expect(typeof result.handleConcentrationLost).toBe('function')
  })
})
