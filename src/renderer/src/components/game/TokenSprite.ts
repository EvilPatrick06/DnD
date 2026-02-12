import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { MapToken } from '../../types/map'

const ENTITY_COLORS: Record<string, number> = {
  player: 0x3b82f6, // blue
  enemy: 0xef4444, // red
  npc: 0xeab308 // yellow
}

const CONDITION_DOT_COLORS = [
  0xa855f7, // purple
  0x22c55e, // green
  0xf97316, // orange
  0x06b6d4, // cyan
  0xec4899, // pink
  0x64748b // slate
]

/**
 * Creates a PixiJS Container representing a map token.
 *
 * Structure:
 * - Colored circle (by entity type)
 * - First letter label centered
 * - HP bar below (if applicable)
 * - Selection ring (if selected)
 * - Condition dots along the bottom edge
 */
export function createTokenSprite(
  token: MapToken,
  cellSize: number,
  isSelected: boolean
): Container {
  const container = new Container()
  container.label = `token-${token.id}`

  const tokenSize = cellSize * Math.max(token.sizeX, token.sizeY)
  const radius = (tokenSize - 4) / 2
  const cx = tokenSize / 2
  const cy = tokenSize / 2

  // Selection ring (drawn behind the token)
  if (isSelected) {
    const selRing = new Graphics()
    selRing.circle(cx, cy, radius + 4)
    selRing.fill({ color: 0xf59e0b, alpha: 0.4 })
    selRing.circle(cx, cy, radius + 2)
    selRing.stroke({ width: 2, color: 0xf59e0b, alpha: 1 })
    container.addChild(selRing)
  }

  // Main circle
  const circle = new Graphics()
  const color = ENTITY_COLORS[token.entityType] ?? 0x6b7280
  circle.circle(cx, cy, radius)
  circle.fill({ color, alpha: 0.85 })
  circle.circle(cx, cy, radius)
  circle.stroke({ width: 2, color: 0x1f2937, alpha: 1 })
  container.addChild(circle)

  // Label (first letter of name)
  const letter = token.label.charAt(0).toUpperCase()
  const style = new TextStyle({
    fontFamily: 'Arial, sans-serif',
    fontSize: Math.max(12, radius * 0.9),
    fontWeight: 'bold',
    fill: 0xffffff,
    align: 'center'
  })
  const text = new Text({ text: letter, style })
  text.anchor.set(0.5, 0.5)
  text.x = cx
  text.y = cy
  container.addChild(text)

  // HP bar below the token
  if (token.maxHP !== undefined && token.maxHP > 0 && token.currentHP !== undefined) {
    const barWidth = tokenSize - 8
    const barHeight = 4
    const barX = 4
    const barY = tokenSize + 2

    const bgBar = new Graphics()
    bgBar.roundRect(barX, barY, barWidth, barHeight, 2)
    bgBar.fill({ color: 0x374151, alpha: 0.8 })
    container.addChild(bgBar)

    const hpPercent = Math.max(0, Math.min(1, token.currentHP / token.maxHP))
    if (hpPercent > 0) {
      const hpBar = new Graphics()
      const hpColor = hpPercent > 0.5 ? 0x22c55e : hpPercent > 0.25 ? 0xeab308 : 0xef4444
      hpBar.roundRect(barX, barY, barWidth * hpPercent, barHeight, 2)
      hpBar.fill({ color: hpColor, alpha: 0.9 })
      container.addChild(hpBar)
    }
  }

  // Condition indicator dots
  if (token.conditions.length > 0) {
    const dotRadius = 3
    const dotSpacing = 8
    const startX = cx - ((token.conditions.length - 1) * dotSpacing) / 2
    const dotY = -dotRadius - 2

    token.conditions.forEach((_, i) => {
      const dot = new Graphics()
      const dotColor = CONDITION_DOT_COLORS[i % CONDITION_DOT_COLORS.length]
      dot.circle(startX + i * dotSpacing, dotY, dotRadius)
      dot.fill({ color: dotColor, alpha: 1 })
      container.addChild(dot)
    })
  }

  // Position on grid
  container.x = token.gridX * cellSize
  container.y = token.gridY * cellSize

  // Store token metadata for hit testing
  container.eventMode = 'static'
  container.cursor = 'pointer'
  container.hitArea = {
    contains: (x: number, y: number) => {
      const dx = x - cx
      const dy = y - cy
      return dx * dx + dy * dy <= radius * radius
    }
  }

  return container
}
