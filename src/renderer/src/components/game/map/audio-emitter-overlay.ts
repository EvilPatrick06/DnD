import { Container, Graphics, Text, TextStyle } from 'pixi.js'

export interface AudioEmitter {
  id: string
  x: number // grid cell X
  y: number // grid cell Y
  soundId: string
  displayName: string
  radius: number // in cells
  volume: number // 0-1
  spatial: boolean // whether to use distance-based volume
  playing: boolean
}

export class AudioEmitterLayer {
  private container: Container
  private emitters: Map<string, { data: AudioEmitter; graphic: Graphics; label: Text }> = new Map()
  private cellSize: number = 40

  constructor() {
    this.container = new Container()
    this.container.label = 'audioEmitters'
  }

  getContainer(): Container {
    return this.container
  }

  setCellSize(size: number): void {
    this.cellSize = size
  }

  updateEmitters(emitters: AudioEmitter[]): void {
    // Remove old
    const newIds = new Set(emitters.map((e) => e.id))
    for (const [id, entry] of this.emitters) {
      if (!newIds.has(id)) {
        this.container.removeChild(entry.graphic)
        this.container.removeChild(entry.label)
        entry.graphic.destroy()
        entry.label.destroy()
        this.emitters.delete(id)
      }
    }

    // Add/update
    for (const emitter of emitters) {
      const existing = this.emitters.get(emitter.id)
      if (existing) {
        this.drawEmitter(existing.graphic, emitter)
        existing.label.x = emitter.x * this.cellSize + this.cellSize / 2
        existing.label.y = emitter.y * this.cellSize + this.cellSize / 2
        existing.data = emitter
      } else {
        const graphic = new Graphics()
        this.drawEmitter(graphic, emitter)
        const label = new Text({
          text: '\uD83D\uDD0A',
          style: new TextStyle({ fontSize: 14, fill: '#ffffff' })
        })
        label.anchor.set(0.5)
        label.x = emitter.x * this.cellSize + this.cellSize / 2
        label.y = emitter.y * this.cellSize + this.cellSize / 2
        this.container.addChild(graphic)
        this.container.addChild(label)
        this.emitters.set(emitter.id, { data: emitter, graphic, label })
      }
    }
  }

  private drawEmitter(g: Graphics, emitter: AudioEmitter): void {
    g.clear()
    const cx = emitter.x * this.cellSize + this.cellSize / 2
    const cy = emitter.y * this.cellSize + this.cellSize / 2
    const radiusPx = emitter.radius * this.cellSize

    // Pulsing circle showing radius
    g.circle(cx, cy, radiusPx)
    g.fill({ color: emitter.playing ? 0x3b82f6 : 0x6b7280, alpha: 0.1 })
    g.stroke({ color: emitter.playing ? 0x3b82f6 : 0x6b7280, width: 1, alpha: 0.4 })

    // Center dot
    g.circle(cx, cy, 4)
    g.fill({ color: emitter.playing ? 0x60a5fa : 0x9ca3af, alpha: 0.8 })
  }

  /** Calculate volume for a token at position (tx, ty) based on distance from emitter */
  static calculateSpatialVolume(emitter: AudioEmitter, tx: number, ty: number, _cellSize: number): number {
    if (!emitter.spatial) return emitter.volume
    const dx = emitter.x + 0.5 - (tx + 0.5)
    const dy = emitter.y + 0.5 - (ty + 0.5)
    const distCells = Math.sqrt(dx * dx + dy * dy)
    if (distCells >= emitter.radius) return 0
    const factor = 1 - distCells / emitter.radius
    return emitter.volume * factor
  }

  destroy(): void {
    for (const [, entry] of this.emitters) {
      entry.graphic.destroy()
      entry.label.destroy()
    }
    this.emitters.clear()
    this.container.destroy()
  }
}
