import type { Application, Graphics } from 'pixi.js'
import type { FogOfWarData, GridSettings } from '../../../types/map'

// ─── Fog Animation State ─────────────────────────────────────

/** Tracks per-cell alpha for animated fog reveal/hide transitions. */
interface FogAnimState {
  /** Set of cell keys that were unrevealed last frame */
  prevUnrevealed: Set<string>
  /** Per-cell alpha values (key → current alpha, 0 = fully revealed, 0.75 = fully hidden) */
  cellAlphas: Map<string, number>
  /** Ticker cleanup function */
  cleanup: (() => void) | null
}

const FOG_TARGET_ALPHA = 0.75
/** Duration in ms for fog to fade out (reveal) */
const REVEAL_DURATION_MS = 500
/** Duration in ms for fog to fade in (hide) */
const HIDE_DURATION_MS = 1500

// Module-level animation state (one per app lifetime)
let fogAnimState: FogAnimState | null = null

/**
 * Initializes the fog animation ticker. Call once when the PixiJS app is ready.
 * The ticker smoothly interpolates per-cell fog alpha values each frame.
 */
export function initFogAnimation(app: Application, graphics: Graphics, gridSettings: GridSettings, mapWidth: number, mapHeight: number): void {
  // Clean up any previous animation
  destroyFogAnimation()

  fogAnimState = {
    prevUnrevealed: new Set<string>(),
    cellAlphas: new Map<string, number>(),
    cleanup: null
  }

  const tickFn = (): void => {
    if (!fogAnimState) return

    const { cellAlphas } = fogAnimState
    const dt = app.ticker.deltaMS
    let needsRedraw = false

    for (const [key, alpha] of cellAlphas.entries()) {
      // Target depends on whether cell is in current unrevealed set
      const target = fogAnimState.prevUnrevealed.has(key) ? FOG_TARGET_ALPHA : 0

      if (Math.abs(alpha - target) < 0.005) {
        // Close enough — snap to target
        if (target === 0) {
          cellAlphas.delete(key)
        } else {
          cellAlphas.set(key, target)
        }
        needsRedraw = true
        continue
      }

      // Compute interpolation rate from duration
      const duration = target > alpha ? HIDE_DURATION_MS : REVEAL_DURATION_MS
      const rate = (FOG_TARGET_ALPHA / duration) * dt
      const newAlpha = target > alpha
        ? Math.min(alpha + rate, target)
        : Math.max(alpha - rate, target)

      cellAlphas.set(key, newAlpha)
      needsRedraw = true
    }

    if (needsRedraw) {
      redrawFogFromAlphas(graphics, cellAlphas, gridSettings, mapWidth, mapHeight)
    }
  }

  app.ticker.add(tickFn)
  fogAnimState.cleanup = () => {
    app.ticker.remove(tickFn)
  }
}

/** Cleanup fog animation ticker. */
export function destroyFogAnimation(): void {
  if (fogAnimState?.cleanup) {
    fogAnimState.cleanup()
  }
  fogAnimState = null
}

/**
 * Draws fog of war as a semi-transparent overlay.
 * Revealed cells are clear; unrevealed cells are dark.
 * When fog animation is initialized, alpha transitions are animated smoothly.
 */
export function drawFogOfWar(
  graphics: Graphics,
  fog: FogOfWarData,
  gridSettings: GridSettings,
  mapWidth: number,
  mapHeight: number
): void {
  graphics.clear()

  if (!fog.enabled) return

  const { cellSize, offsetX, offsetY } = gridSettings

  // Build a set of revealed cell keys for fast lookup
  const revealedSet = new Set<string>(fog.revealedCells.map((c) => `${c.x},${c.y}`))

  // Calculate grid bounds
  const cols = Math.ceil((mapWidth - (offsetX % cellSize)) / cellSize) + 1
  const rows = Math.ceil((mapHeight - (offsetY % cellSize)) / cellSize) + 1
  const startCol = -Math.ceil((offsetX % cellSize) / cellSize)
  const startRow = -Math.ceil((offsetY % cellSize) / cellSize)

  // Build current unrevealed set
  const currentUnrevealed = new Set<string>()
  for (let col = startCol; col < cols; col++) {
    for (let row = startRow; row < rows; row++) {
      const key = `${col},${row}`
      if (revealedSet.has(key)) continue

      const x = (offsetX % cellSize) + col * cellSize
      const y = (offsetY % cellSize) + row * cellSize
      if (x + cellSize < 0 || y + cellSize < 0) continue
      if (x > mapWidth || y > mapHeight) continue

      currentUnrevealed.add(key)
    }
  }

  // If animation is active, update alpha targets and let ticker handle rendering
  if (fogAnimState) {
    const { prevUnrevealed, cellAlphas } = fogAnimState

    // Cells that were unrevealed but are now revealed — start fade out
    for (const key of prevUnrevealed) {
      if (!currentUnrevealed.has(key)) {
        // Start fading out (if not already tracked, start at full)
        if (!cellAlphas.has(key)) {
          cellAlphas.set(key, FOG_TARGET_ALPHA)
        }
      }
    }

    // Cells that are newly unrevealed — start fade in
    for (const key of currentUnrevealed) {
      if (!prevUnrevealed.has(key)) {
        // New fog cell — start fading in from 0
        cellAlphas.set(key, 0)
      } else if (!cellAlphas.has(key)) {
        // Already unrevealed and at full alpha
        cellAlphas.set(key, FOG_TARGET_ALPHA)
      }
    }

    // Ensure all current unrevealed cells have entries
    for (const key of currentUnrevealed) {
      if (!cellAlphas.has(key)) {
        cellAlphas.set(key, FOG_TARGET_ALPHA)
      }
    }

    // Update the previous set
    fogAnimState.prevUnrevealed = currentUnrevealed

    // Do an immediate draw with current alphas
    redrawFogFromAlphas(graphics, cellAlphas, gridSettings, mapWidth, mapHeight)
    return
  }

  // No animation — static draw (fallback)
  for (let col = startCol; col < cols; col++) {
    for (let row = startRow; row < rows; row++) {
      if (revealedSet.has(`${col},${row}`)) continue

      const x = (offsetX % cellSize) + col * cellSize
      const y = (offsetY % cellSize) + row * cellSize

      if (x + cellSize < 0 || y + cellSize < 0) continue
      if (x > mapWidth || y > mapHeight) continue

      graphics.rect(x, y, cellSize, cellSize)
    }
  }

  graphics.fill({ color: 0x000000, alpha: FOG_TARGET_ALPHA })
}

/**
 * Redraws fog cells from the per-cell alpha map.
 * Groups cells by alpha value (bucketed to avoid excessive draw calls).
 */
function redrawFogFromAlphas(
  graphics: Graphics,
  cellAlphas: Map<string, number>,
  gridSettings: GridSettings,
  mapWidth: number,
  mapHeight: number
): void {
  graphics.clear()

  const { cellSize, offsetX, offsetY } = gridSettings

  // Bucket alphas to reduce draw calls (10 buckets)
  const BUCKET_COUNT = 10
  const buckets: Array<Array<{ col: number; row: number }>> = Array.from({ length: BUCKET_COUNT + 1 }, () => [])

  for (const [key, alpha] of cellAlphas.entries()) {
    if (alpha <= 0.005) continue // skip fully transparent
    const parts = key.split(',')
    const col = parseInt(parts[0], 10)
    const row = parseInt(parts[1], 10)
    const bucketIndex = Math.round(alpha / FOG_TARGET_ALPHA * BUCKET_COUNT)
    buckets[Math.min(bucketIndex, BUCKET_COUNT)].push({ col, row })
  }

  for (let b = 1; b <= BUCKET_COUNT; b++) {
    const cells = buckets[b]
    if (cells.length === 0) continue
    const bucketAlpha = (b / BUCKET_COUNT) * FOG_TARGET_ALPHA

    for (const { col, row } of cells) {
      const x = (offsetX % cellSize) + col * cellSize
      const y = (offsetY % cellSize) + row * cellSize

      if (x + cellSize < 0 || y + cellSize < 0) continue
      if (x > mapWidth || y > mapHeight) continue

      graphics.rect(x, y, cellSize, cellSize)
    }
    graphics.fill({ color: 0x000000, alpha: bucketAlpha })
  }
}
