import { Graphics } from 'pixi.js'
import type { GridSettings } from '../../types/map'

/**
 * Draws grid lines onto a PixiJS Graphics object.
 * Supports square grids. Hex grids are stubbed for future implementation.
 */
export function drawGrid(
  graphics: Graphics,
  settings: GridSettings,
  mapWidth: number,
  mapHeight: number
): void {
  graphics.clear()

  if (!settings.enabled) return

  const { cellSize, offsetX, offsetY, color, opacity, type } = settings

  if (type === 'hex') {
    drawHexGrid(graphics, cellSize, offsetX, offsetY, color, opacity, mapWidth, mapHeight)
    return
  }

  // Square grid
  const parsedColor = parseColor(color)

  // Vertical lines
  const startX = offsetX % cellSize
  for (let x = startX; x <= mapWidth; x += cellSize) {
    graphics.moveTo(x, 0)
    graphics.lineTo(x, mapHeight)
  }

  // Horizontal lines
  const startY = offsetY % cellSize
  for (let y = startY; y <= mapHeight; y += cellSize) {
    graphics.moveTo(0, y)
    graphics.lineTo(mapWidth, y)
  }

  graphics.stroke({ width: 1, color: parsedColor, alpha: opacity })
}

/**
 * Stub for hex grid rendering.
 */
function drawHexGrid(
  graphics: Graphics,
  cellSize: number,
  offsetX: number,
  offsetY: number,
  color: string,
  opacity: number,
  mapWidth: number,
  mapHeight: number
): void {
  // Hex grid stub: draw flat-top hexes
  const parsedColor = parseColor(color)
  const hexWidth = cellSize * 2
  const hexHeight = Math.sqrt(3) * cellSize
  const horizSpacing = hexWidth * 0.75
  const vertSpacing = hexHeight

  const cols = Math.ceil(mapWidth / horizSpacing) + 1
  const rows = Math.ceil(mapHeight / vertSpacing) + 1

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cx = offsetX + col * horizSpacing
      const cy = offsetY + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

      if (cx - cellSize > mapWidth || cy - hexHeight / 2 > mapHeight) continue

      drawHexOutline(graphics, cx, cy, cellSize)
    }
  }

  graphics.stroke({ width: 1, color: parsedColor, alpha: opacity })
}

function drawHexOutline(graphics: Graphics, cx: number, cy: number, size: number): void {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    if (i === 0) {
      graphics.moveTo(x, y)
    } else {
      graphics.lineTo(x, y)
    }
  }
  graphics.closePath()
}

function parseColor(color: string): number {
  if (color.startsWith('#')) {
    return parseInt(color.slice(1), 16)
  }
  // Default to white
  return 0xffffff
}
