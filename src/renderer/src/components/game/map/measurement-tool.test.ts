import { describe, expect, it, vi } from 'vitest'
import { clearMeasurement, drawMeasurement } from './measurement-tool'

// ─── PixiJS mock ───────────────────────────────────────────────

const mockLabel = { anchor: { set: vi.fn() }, x: 0, y: 0 }

vi.mock('pixi.js', () => ({
  Text: vi.fn(function () {
    return mockLabel
  }),
  TextStyle: vi.fn(function () {
    return {}
  })
}))

// ─── Graphics mock factory ─────────────────────────────────────

function makeGraphics() {
  const children: unknown[] = []
  return {
    clear: vi.fn(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
    circle: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    addChild: vi.fn((child: unknown) => {
      children.push(child)
    }),
    removeChildAt: vi.fn(() => {
      children.shift()
    }),
    get children() {
      return children
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe('drawMeasurement', () => {
  it('clears the graphics before drawing', () => {
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 70, y: 0 }, 70)
    expect(gfx.clear).toHaveBeenCalled()
  })

  it('draws moveTo and lineTo for the measurement line', () => {
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 10, y: 20 }, { x: 80, y: 20 }, 70)
    expect(gfx.moveTo).toHaveBeenCalledWith(10, 20)
    expect(gfx.lineTo).toHaveBeenCalledWith(80, 20)
  })

  it('draws endpoint circles', () => {
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 70, y: 0 }, 70)
    // Two endpoint circles + any other circle calls
    const circleCalls = gfx.circle.mock.calls
    expect(circleCalls.some(([x, y, r]: number[]) => x === 0 && y === 0 && r === 4)).toBe(true)
    expect(circleCalls.some(([x, y, r]: number[]) => x === 70 && y === 0 && r === 4)).toBe(true)
  })

  it('adds a text label child at the midpoint', () => {
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 140, y: 0 }, 70)
    expect(gfx.addChild).toHaveBeenCalled()
  })

  it('positions the label at the midpoint of the line', () => {
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 140, y: 0 }, 70)
    // midX = 70, midY = 0 → label.x = 70
    expect(mockLabel.x).toBe(70)
  })

  it('calculates feet correctly: 1 cell = 5 ft', async () => {
    // 70px / 70 cellSize = 1 cell = 5 ft
    const { Text } = await import('pixi.js')
    const gfx = makeGraphics()
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 70, y: 0 }, 70)
    const callArgs = vi.mocked(Text).mock.calls.at(-1)?.[0] as { text: string } | undefined
    expect(callArgs?.text).toMatch(/5 ft/)
  })

  it('removes old children before adding new label', () => {
    const gfx = makeGraphics()
    // Pre-populate children
    ;(gfx.children as unknown[]).push('old-label')
    drawMeasurement(gfx as never, { x: 0, y: 0 }, { x: 70, y: 0 }, 70)
    expect(gfx.removeChildAt).toHaveBeenCalledWith(0)
  })
})

describe('clearMeasurement', () => {
  it('calls clear on the graphics object', () => {
    const gfx = makeGraphics()
    clearMeasurement(gfx as never)
    expect(gfx.clear).toHaveBeenCalled()
  })

  it('removes all children', () => {
    const gfx = makeGraphics()
    ;(gfx.children as unknown[]).push('child1', 'child2')
    clearMeasurement(gfx as never)
    expect(gfx.removeChildAt).toHaveBeenCalled()
  })

  it('does not throw when children is empty', () => {
    const gfx = makeGraphics()
    expect(() => clearMeasurement(gfx as never)).not.toThrow()
  })
})
