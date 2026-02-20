/**
 * LightingOverlay — Renders a darkness mask with visibility cutouts.
 *
 * For players: shows only what their token can see (based on walls + light sources).
 * For DM: shows a semi-transparent preview of the lighting state.
 *
 * Uses the raycast-visibility engine to compute visibility polygons,
 * then draws them as PixiJS Graphics (mask approach).
 */

import type { Graphics } from 'pixi.js'
import {
  computeLitAreas,
  computeVisibility,
  type LightSource,
  type Point,
  type Segment,
  wallsToSegments
} from '../../services/raycast-visibility'
import type { GameMap, MapToken } from '../../types/map'

// ─── Types ────────────────────────────────────────────────────

export interface LightingConfig {
  ambientLight: 'bright' | 'dim' | 'darkness'
  darkvisionRange?: number // in grid cells (e.g., 12 for 60ft at 5ft/cell)
}

// ─── Draw lighting overlay ────────────────────────────────────

/**
 * Draws the lighting overlay on the given Graphics object.
 *
 * @param gfx          PixiJS Graphics to draw on
 * @param map          The current game map
 * @param viewerToken  The player's token (null for DM view)
 * @param lightSources Active light sources on the map
 * @param config       Ambient light and darkvision config
 * @param isHost       Whether the viewer is DM
 */
export function drawLightingOverlay(
  gfx: Graphics,
  map: GameMap,
  viewerToken: MapToken | null,
  lightSources: LightSource[],
  config: LightingConfig,
  isHost: boolean
): void {
  gfx.clear()

  const walls = map.wallSegments ?? []
  if (walls.length === 0 && config.ambientLight === 'bright') return

  const cellSize = map.grid.cellSize
  const pixelWidth = map.width * cellSize
  const pixelHeight = map.height * cellSize

  // Convert wall segments to raycast segments
  const segments = wallsToSegments(walls, cellSize)

  // DM preview: very light overlay showing where darkness would be
  if (isHost) {
    drawDMPreview(
      gfx,
      segments,
      lightSources,
      config,
      pixelWidth,
      pixelHeight,
      cellSize,
      map.grid.offsetX,
      map.grid.offsetY
    )
    return
  }

  // Player view: full darkness mask with visibility cutouts
  if (!viewerToken) return

  drawPlayerView(
    gfx,
    segments,
    viewerToken,
    lightSources,
    config,
    pixelWidth,
    pixelHeight,
    cellSize,
    map.grid.offsetX,
    map.grid.offsetY
  )
}

// ─── DM preview ───────────────────────────────────────────────

function drawDMPreview(
  gfx: Graphics,
  _segments: Segment[],
  lightSources: LightSource[],
  config: LightingConfig,
  width: number,
  height: number,
  cellSize: number,
  offsetX: number,
  offsetY: number
): void {
  // Light dim overlay over everything
  const baseAlpha = config.ambientLight === 'darkness' ? 0.15 : config.ambientLight === 'dim' ? 0.08 : 0
  if (baseAlpha === 0 && lightSources.length === 0) return

  gfx.rect(offsetX, offsetY, width, height)
  gfx.fill({ color: 0x000000, alpha: baseAlpha })

  // Draw light source radii as subtle circles
  for (const source of lightSources) {
    const sx = source.x * cellSize + offsetX
    const sy = source.y * cellSize + offsetY
    const brightR = source.brightRadius * cellSize
    const dimR = (source.brightRadius + source.dimRadius) * cellSize

    // Dim radius ring
    gfx.setStrokeStyle({ width: 1, color: 0xf5c542, alpha: 0.15 })
    gfx.circle(sx, sy, dimR)
    gfx.stroke()

    // Bright radius ring
    gfx.setStrokeStyle({ width: 1, color: 0xf5c542, alpha: 0.25 })
    gfx.circle(sx, sy, brightR)
    gfx.stroke()

    // Center dot
    gfx.circle(sx, sy, 3)
    gfx.fill({ color: 0xf5c542, alpha: 0.5 })
  }
}

// ─── Player view ──────────────────────────────────────────────

function drawPlayerView(
  gfx: Graphics,
  segments: Segment[],
  viewerToken: MapToken,
  lightSources: LightSource[],
  config: LightingConfig,
  width: number,
  height: number,
  cellSize: number,
  offsetX: number,
  offsetY: number
): void {
  // Player's position (center of token)
  const playerOrigin: Point = {
    x: (viewerToken.gridX + viewerToken.sizeX / 2) * cellSize,
    y: (viewerToken.gridY + viewerToken.sizeY / 2) * cellSize
  }

  // Compute player's base visibility (line of sight through walls)
  const visibility = computeVisibility(playerOrigin, segments, { width, height })

  // Determine darkness alpha based on ambient light
  const darknessAlpha = config.ambientLight === 'darkness' ? 0.85 : config.ambientLight === 'dim' ? 0.5 : 0.2

  // Draw full darkness covering the entire map
  gfx.rect(offsetX, offsetY, width, height)
  gfx.fill({ color: 0x000000, alpha: darknessAlpha })

  // Cut out the visibility polygon (what the player can see)
  if (visibility.points.length >= 3) {
    gfx.beginPath()
    const first = visibility.points[0]
    gfx.moveTo(first.x + offsetX, first.y + offsetY)
    for (let i = 1; i < visibility.points.length; i++) {
      gfx.lineTo(visibility.points[i].x + offsetX, visibility.points[i].y + offsetY)
    }
    gfx.closePath()
    gfx.cut()
  }

  // If player has darkvision, apply dim-light treatment within range
  if (config.darkvisionRange && config.darkvisionRange > 0) {
    const dvRadius = config.darkvisionRange * cellSize
    // In darkvision range, darkness appears as dim light
    // Draw a slightly lighter circle for darkvision area
    gfx.circle(playerOrigin.x + offsetX, playerOrigin.y + offsetY, dvRadius)
    gfx.fill({ color: 0x000000, alpha: -0.2 }) // negative = lighten (won't work directly, use a cutout)
  }

  // Compute lit areas from light sources
  const litAreas = computeLitAreas(lightSources, segments, { width, height }, cellSize)

  // For each light source, cut out bright areas and dim areas
  for (const area of litAreas) {
    // Bright light area: fully visible
    if (area.brightPoly.points.length >= 3) {
      gfx.beginPath()
      const bp = area.brightPoly.points[0]
      gfx.moveTo(bp.x + offsetX, bp.y + offsetY)
      for (let i = 1; i < area.brightPoly.points.length; i++) {
        gfx.lineTo(area.brightPoly.points[i].x + offsetX, area.brightPoly.points[i].y + offsetY)
      }
      gfx.closePath()
      gfx.cut()
    }

    // Dim light area: partially visible (lighter overlay)
    if (area.dimPoly.points.length >= 3) {
      gfx.beginPath()
      const dp = area.dimPoly.points[0]
      gfx.moveTo(dp.x + offsetX, dp.y + offsetY)
      for (let i = 1; i < area.dimPoly.points.length; i++) {
        gfx.lineTo(area.dimPoly.points[i].x + offsetX, area.dimPoly.points[i].y + offsetY)
      }
      gfx.closePath()
      // Dim area still has some darkness
      gfx.fill({ color: 0x000000, alpha: 0.15 })
    }
  }
}
