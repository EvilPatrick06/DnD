/**
 * Vision computation engine — pure functions for computing party vision,
 * token visibility, and lighting conditions.
 *
 * Reuses raycast-visibility for line-of-sight calculations.
 */

import type { GameMap, MapToken } from '../../types/map'
import { DARKVISION_SPECIES } from '../../types/map'
import {
  computeVisibility,
  isPointVisible,
  type LightSource,
  type LitArea,
  type Point,
  type Segment,
  type VisibilityPolygon,
  wallsToSegments
} from './raycast-visibility'

type _LitArea = LitArea

// ─── Types ────────────────────────────────────────────────────

export interface PartyVisionResult {
  /** One visibility polygon per player token */
  partyPolygons: VisibilityPolygon[]
  /** Grid cells currently visible to the party */
  visibleCells: Array<{ x: number; y: number }>
}

// ─── Party vision computation ─────────────────────────────────

/**
 * Compute the union vision of all player tokens on a map.
 * Returns visibility polygons and the set of visible grid cells.
 */
export function computePartyVision(map: GameMap, playerTokens: MapToken[]): PartyVisionResult {
  if (playerTokens.length === 0) {
    return { partyPolygons: [], visibleCells: [] }
  }

  const cellSize = map.grid.cellSize
  const pixelWidth = map.width * cellSize
  const pixelHeight = map.height * cellSize
  const walls = map.wallSegments ?? []
  const segments = wallsToSegments(walls, cellSize)
  const bounds = { width: pixelWidth, height: pixelHeight }

  // Compute visibility polygon for each player token
  const partyPolygons: VisibilityPolygon[] = []
  for (const token of playerTokens) {
    const origin: Point = {
      x: (token.gridX + token.sizeX / 2) * cellSize,
      y: (token.gridY + token.sizeY / 2) * cellSize
    }
    const poly = computeVisibility(origin, segments, bounds)
    partyPolygons.push(poly)
  }

  // Convert polygons to grid cells
  const gridCols = Math.ceil(pixelWidth / cellSize)
  const gridRows = Math.ceil(pixelHeight / cellSize)
  const visibleCells: Array<{ x: number; y: number }> = []

  for (let col = 0; col < gridCols; col++) {
    for (let row = 0; row < gridRows; row++) {
      // Test cell center
      const cellCenter: Point = {
        x: (col + 0.5) * cellSize,
        y: (row + 0.5) * cellSize
      }

      let visible = false
      for (const poly of partyPolygons) {
        if (isPointVisible(cellCenter, poly)) {
          visible = true
          break
        }
      }

      if (visible) {
        visibleCells.push({ x: col, y: row })
      }
    }
  }

  return { partyPolygons, visibleCells }
}

// ─── Token visibility check ──────────────────────────────────

/**
 * Check whether a token is visible to the party based on their vision polygons.
 */
export function isTokenVisibleToParty(token: MapToken, partyPolygons: VisibilityPolygon[], cellSize: number): boolean {
  const tokenCenter: Point = {
    x: (token.gridX + token.sizeX / 2) * cellSize,
    y: (token.gridY + token.sizeY / 2) * cellSize
  }

  for (const poly of partyPolygons) {
    if (isPointVisible(tokenCenter, poly)) {
      return true
    }
  }
  return false
}

// ─── Lighting at a point ─────────────────────────────────────

/**
 * Determine the lighting condition at a given point based on light sources
 * and ambient light level.
 */
export function getLightingAtPoint(
  point: Point,
  lightSources: LightSource[],
  ambientLight: 'bright' | 'dim' | 'darkness',
  cellSize: number
): 'bright' | 'dim' | 'darkness' {
  // Check if any light source illuminates this point
  for (const source of lightSources) {
    const sx = source.x * cellSize
    const sy = source.y * cellSize
    const dx = point.x - sx
    const dy = point.y - sy

    const dist = Math.sqrt(dx * dx + dy * dy)
    const brightDist = source.brightRadius * cellSize
    const dimDist = (source.brightRadius + source.dimRadius) * cellSize

    if (dist <= brightDist) return 'bright'
    if (dist <= dimDist) {
      // At least dim — but continue checking other sources
      if (ambientLight === 'bright') return 'bright'
      return 'dim'
    }
  }

  return ambientLight
}

// ─── Build vision cell set for fast lookup ────────────────────

/**
 * Build a Set of cell keys from an array of cells for O(1) lookup.
 */
export function buildVisionSet(cells: Array<{ x: number; y: number }>): Set<string> {
  const set = new Set<string>()
  for (const cell of cells) {
    set.add(`${cell.x},${cell.y}`)
  }
  return set
}

/**
 * Check if any cell occupied by a token is in the vision set.
 */
export function isTokenInVisionSet(token: MapToken, visionSet: Set<string>): boolean {
  for (let dx = 0; dx < token.sizeX; dx++) {
    for (let dy = 0; dy < token.sizeY; dy++) {
      if (visionSet.has(`${token.gridX + dx},${token.gridY + dy}`)) {
        return true
      }
    }
  }
  return false
}

/**
 * Recompute party vision and return the visible cells.
 * Convenience wrapper that filters player tokens and calls computePartyVision.
 */
export function recomputeVision(map: GameMap, overrideTokens?: MapToken[]): PartyVisionResult {
  const tokens = overrideTokens ?? map.tokens
  const playerTokens = tokens.filter((t) => t.entityType === 'player')
  return computePartyVision(map, playerTokens)
}

/**
 * Check if a token's associated species has darkvision (used for dim-light visibility).
 */
export function hasDarkvision(speciesId: string | undefined): boolean {
  if (!speciesId) return false
  return DARKVISION_SPECIES.includes(speciesId.toLowerCase())
}

// Re-export needed types
export type { LightSource, Point, Segment, VisibilityPolygon }
