import { Graphics, Text, TextStyle } from 'pixi.js'

/**
 * Draws a measurement line between two points with distance annotation.
 * Displays distance in both grid cells and feet (1 cell = 5 ft).
 */
export function drawMeasurement(
  graphics: Graphics,
  start: { x: number; y: number },
  end: { x: number; y: number },
  cellSize: number
): void {
  graphics.clear()

  // Draw the measurement line
  graphics.moveTo(start.x, start.y)
  graphics.lineTo(end.x, end.y)
  graphics.stroke({ width: 2, color: 0xf59e0b, alpha: 0.9 })

  // Start and end dots
  graphics.circle(start.x, start.y, 4)
  graphics.fill({ color: 0xf59e0b, alpha: 1 })
  graphics.circle(end.x, end.y, 4)
  graphics.fill({ color: 0xf59e0b, alpha: 1 })

  // Calculate distance in pixels, then in cells
  const dx = end.x - start.x
  const dy = end.y - start.y
  const pixelDist = Math.sqrt(dx * dx + dy * dy)
  const cellDist = pixelDist / cellSize
  const feetDist = Math.round(cellDist * 5)

  // Label at midpoint
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2

  const style = new TextStyle({
    fontFamily: 'Arial, sans-serif',
    fontSize: 14,
    fontWeight: 'bold',
    fill: 0xfbbf24,
    stroke: { color: 0x000000, width: 3 },
    align: 'center'
  })

  // Remove old children (text labels from previous draws)
  while (graphics.children.length > 0) {
    graphics.removeChildAt(0)
  }

  const label = new Text({
    text: `${cellDist.toFixed(1)} cells / ${feetDist} ft`,
    style
  })
  label.anchor.set(0.5, 1)
  label.x = midX
  label.y = midY - 8

  graphics.addChild(label)
}

/**
 * Clears the measurement overlay.
 */
export function clearMeasurement(graphics: Graphics): void {
  graphics.clear()
  while (graphics.children.length > 0) {
    graphics.removeChildAt(0)
  }
}
