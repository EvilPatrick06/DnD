import { describe, expect, it } from 'vitest'
import type { GameMap, MapToken, WallSegment } from '../../types/map'
import {
  buildVisionSet,
  computePartyVision,
  getLightingAtPoint,
  isTokenInVisionSet,
  isTokenVisibleToParty,
  type LightSource,
  recomputeVision
} from './vision-computation'

// ─── Helpers ────────────────────────────────────────────────────

function makeToken(overrides: Partial<MapToken> & { gridX: number; gridY: number }): MapToken {
  return {
    id: `token-${overrides.gridX}-${overrides.gridY}`,
    entityId: `entity-${overrides.gridX}-${overrides.gridY}`,
    entityType: 'player' as const,
    label: 'Token',
    sizeX: 1,
    sizeY: 1,
    visibleToPlayers: true,
    conditions: [],
    ...overrides
  } as MapToken
}

function makeMap(overrides?: Partial<GameMap>): GameMap {
  return {
    id: 'map-1',
    name: 'Test Map',
    campaignId: 'campaign-1',
    imagePath: '',
    width: 10,
    height: 10,
    grid: { enabled: true, cellSize: 50, offsetX: 0, offsetY: 0, color: '#fff', opacity: 0.5, type: 'square' },
    tokens: [],
    fogOfWar: { enabled: true, revealedCells: [] },
    terrain: [],
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function makeWall(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: WallSegment['type'] = 'solid',
  isOpen = false
): WallSegment {
  return { id: `wall-${x1}-${y1}-${x2}-${y2}`, x1, y1, x2, y2, type, isOpen }
}

// ─── Tests ──────────────────────────────────────────────────────

describe('computePartyVision', () => {
  it('returns empty results when no player tokens', () => {
    const map = makeMap()
    const result = computePartyVision(map, [])
    expect(result.partyPolygons).toHaveLength(0)
    expect(result.visibleCells).toHaveLength(0)
  })

  it('returns all cells as visible on open map with single player', () => {
    const token = makeToken({ gridX: 5, gridY: 5 })
    const map = makeMap({ tokens: [token] })
    const result = computePartyVision(map, [token])

    // On a 10x10 map with no walls, all cells should be visible
    expect(result.partyPolygons).toHaveLength(1)
    expect(result.visibleCells.length).toBe(100) // 10 * 10
  })

  it('wall blocks visibility beyond it', () => {
    // Token at (2, 5), wall at x=5 from y=0 to y=10
    const token = makeToken({ gridX: 2, gridY: 5 })
    const walls: WallSegment[] = [makeWall(5, 0, 5, 10)]
    const map = makeMap({ tokens: [token], wallSegments: walls })

    const result = computePartyVision(map, [token])

    // Cells beyond x=5 should not all be visible
    const visibleBeyondWall = result.visibleCells.filter((c) => c.x >= 5)
    const visibleBeforeWall = result.visibleCells.filter((c) => c.x < 5)

    // All cells before the wall should be visible
    expect(visibleBeforeWall.length).toBe(50) // 5 cols * 10 rows
    // Most cells beyond the wall should be hidden
    expect(visibleBeyondWall.length).toBeLessThan(50)
  })

  it('open door does not block visibility', () => {
    const token = makeToken({ gridX: 2, gridY: 5 })
    const walls: WallSegment[] = [makeWall(5, 0, 5, 10, 'door', true)]
    const map = makeMap({ tokens: [token], wallSegments: walls })

    const result = computePartyVision(map, [token])
    // Open door should allow full visibility
    expect(result.visibleCells.length).toBe(100)
  })

  it('union vision from multiple players covers more area', () => {
    // Two players on opposite sides of a wall
    const token1 = makeToken({ id: 't1', entityId: 'e1', gridX: 2, gridY: 5 })
    const token2 = makeToken({ id: 't2', entityId: 'e2', gridX: 7, gridY: 5 })
    const walls: WallSegment[] = [makeWall(5, 0, 5, 10)]
    const map = makeMap({ tokens: [token1, token2], wallSegments: walls })

    const singleResult = computePartyVision(map, [token1])
    const unionResult = computePartyVision(map, [token1, token2])

    // Union should see more than single
    expect(unionResult.visibleCells.length).toBeGreaterThan(singleResult.visibleCells.length)
  })
})

describe('isTokenVisibleToParty', () => {
  it('returns true for token within line of sight', () => {
    const player = makeToken({ gridX: 0, gridY: 0 })
    const enemy = makeToken({ gridX: 3, gridY: 3, entityType: 'enemy' })
    const map = makeMap({ tokens: [player, enemy] })
    const { partyPolygons } = computePartyVision(map, [player])

    expect(isTokenVisibleToParty(enemy, partyPolygons, map.grid.cellSize)).toBe(true)
  })

  it('returns false for token behind a wall', () => {
    const player = makeToken({ gridX: 2, gridY: 5 })
    const enemy = makeToken({ gridX: 8, gridY: 5, entityType: 'enemy' })
    const walls: WallSegment[] = [makeWall(5, 0, 5, 10)]
    const map = makeMap({ tokens: [player, enemy], wallSegments: walls })
    const { partyPolygons } = computePartyVision(map, [player])

    expect(isTokenVisibleToParty(enemy, partyPolygons, map.grid.cellSize)).toBe(false)
  })
})

describe('getLightingAtPoint', () => {
  it('returns ambient light when no light sources', () => {
    expect(getLightingAtPoint({ x: 100, y: 100 }, [], 'bright', 50)).toBe('bright')
    expect(getLightingAtPoint({ x: 100, y: 100 }, [], 'dim', 50)).toBe('dim')
    expect(getLightingAtPoint({ x: 100, y: 100 }, [], 'darkness', 50)).toBe('darkness')
  })

  it('returns bright when point is within bright radius of light source', () => {
    const source: LightSource = { x: 2, y: 2, brightRadius: 4, dimRadius: 4 }
    // Point at (125, 125) is 25 pixels from light center at (100, 100), brightRadius = 200px
    expect(getLightingAtPoint({ x: 125, y: 125 }, [source], 'darkness', 50)).toBe('bright')
  })

  it('returns dim when point is within dim radius but outside bright', () => {
    const source: LightSource = { x: 2, y: 2, brightRadius: 1, dimRadius: 2 }
    // Light at (100, 100), bright=50px, dim extends to 150px
    // Point at (220, 100) = 120px away, beyond bright (50) but within dim (150)
    expect(getLightingAtPoint({ x: 220, y: 100 }, [source], 'darkness', 50)).toBe('dim')
  })

  it('returns darkness when point is outside all light radii', () => {
    const source: LightSource = { x: 0, y: 0, brightRadius: 1, dimRadius: 1 }
    // Point far away from the source
    expect(getLightingAtPoint({ x: 500, y: 500 }, [source], 'darkness', 50)).toBe('darkness')
  })
})

describe('buildVisionSet', () => {
  it('creates a set from cells', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 3, y: 4 }
    ]
    const set = buildVisionSet(cells)
    expect(set.has('0,0')).toBe(true)
    expect(set.has('1,2')).toBe(true)
    expect(set.has('3,4')).toBe(true)
    expect(set.has('2,2')).toBe(false)
  })
})

describe('isTokenInVisionSet', () => {
  it('returns true when token cell is in vision set', () => {
    const token = makeToken({ gridX: 3, gridY: 4 })
    const set = buildVisionSet([{ x: 3, y: 4 }])
    expect(isTokenInVisionSet(token, set)).toBe(true)
  })

  it('returns false when token cell is not in vision set', () => {
    const token = makeToken({ gridX: 3, gridY: 4 })
    const set = buildVisionSet([{ x: 0, y: 0 }])
    expect(isTokenInVisionSet(token, set)).toBe(false)
  })

  it('checks all cells for large tokens', () => {
    const token = makeToken({ gridX: 2, gridY: 2, sizeX: 2, sizeY: 2 })
    // Only one corner cell is visible
    const set = buildVisionSet([{ x: 3, y: 3 }])
    expect(isTokenInVisionSet(token, set)).toBe(true)
  })
})

describe('recomputeVision', () => {
  it('filters to player tokens and computes vision', () => {
    const player = makeToken({ gridX: 5, gridY: 5, entityType: 'player' })
    const enemy = makeToken({ gridX: 2, gridY: 2, entityType: 'enemy' })
    const map = makeMap({ tokens: [player, enemy] })

    const result = recomputeVision(map)
    // Only 1 polygon (player only, not enemy)
    expect(result.partyPolygons).toHaveLength(1)
  })

  it('uses override tokens when provided', () => {
    const player1 = makeToken({ id: 'p1', entityId: 'e1', gridX: 5, gridY: 5 })
    const player2 = makeToken({ id: 'p2', entityId: 'e2', gridX: 2, gridY: 2 })
    const map = makeMap({ tokens: [player1] })

    // Override with both players
    const result = recomputeVision(map, [player1, player2])
    expect(result.partyPolygons).toHaveLength(2)
  })
})
