import { Graphics } from 'pixi.js'
import type { FogOfWarData, GridSettings } from '../../types/map'

/**
 * Draws fog of war as a semi-transparent overlay.
 * Revealed cells are clear; unrevealed cells are dark.
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
  const revealedSet = new Set<string>(
    fog.revealedCells.map((c) => `${c.x},${c.y}`)
  )

  // Calculate grid bounds
  const cols = Math.ceil((mapWidth - (offsetX % cellSize)) / cellSize) + 1
  const rows = Math.ceil((mapHeight - (offsetY % cellSize)) / cellSize) + 1
  const startCol = -Math.ceil((offsetX % cellSize) / cellSize)
  const startRow = -Math.ceil((offsetY % cellSize) / cellSize)

  // Draw dark rectangles for each unrevealed cell
  for (let col = startCol; col < cols; col++) {
    for (let row = startRow; row < rows; row++) {
      if (revealedSet.has(`${col},${row}`)) continue

      const x = (offsetX % cellSize) + col * cellSize
      const y = (offsetY % cellSize) + row * cellSize

      // Only draw if within map bounds
      if (x + cellSize < 0 || y + cellSize < 0) continue
      if (x > mapWidth || y > mapHeight) continue

      graphics.rect(x, y, cellSize, cellSize)
    }
  }

  graphics.fill({ color: 0x000000, alpha: 0.75 })
}
