import { type Container, Graphics } from 'pixi.js'
import { canMoveToPosition } from '../../../services/combat/combat-rules'
import { useGameStore } from '../../../stores/use-game-store'
import type { TurnState } from '../../../types/game-state'
import type { GameMap, MapToken } from '../../../types/map'
import { drawMeasurement } from './measurement-tool'
import { findNearbyWallEndpoint } from './wall-layer'

// ── Shared ref interfaces ─────────────────────────────────────────────────────

export interface DragState {
  tokenId: string
  startGridX: number
  startGridY: number
  offsetX: number
  offsetY: number
}

export interface MapEventRefs {
  zoom: React.MutableRefObject<number>
  pan: React.MutableRefObject<{ x: number; y: number }>
  isPanning: React.MutableRefObject<boolean>
  panStart: React.MutableRefObject<{ x: number; y: number }>
  spaceHeld: React.MutableRefObject<boolean>
  drag: React.MutableRefObject<DragState | null>
  isFogPainting: React.MutableRefObject<boolean>
  lastFogCell: React.MutableRefObject<{ x: number; y: number } | null>
  measureStart: React.MutableRefObject<{ x: number; y: number } | null>
  wallStart: React.MutableRefObject<{ x: number; y: number } | null>
  ghost: React.MutableRefObject<Graphics | null>
  world: React.MutableRefObject<Container | null>
  tokenContainer: React.MutableRefObject<Container | null>
  measureGraphics: React.MutableRefObject<Graphics | null>
  wallGraphics: React.MutableRefObject<Graphics | null>
}

type ActiveTool = 'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure' | 'terrain' | 'wall' | 'fill'

// ── Wheel zoom ────────────────────────────────────────────────────────────────

export function createWheelHandler(
  refs: Pick<MapEventRefs, 'zoom' | 'pan'>,
  applyTransform: () => void
): (el: HTMLElement) => () => void {
  return (el: HTMLElement) => {
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.25, Math.min(4, refs.zoom.current * zoomFactor))

      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const worldMouseX = (mouseX - refs.pan.current.x) / refs.zoom.current
      const worldMouseY = (mouseY - refs.pan.current.y) / refs.zoom.current

      refs.zoom.current = newZoom
      refs.pan.current.x = mouseX - worldMouseX * newZoom
      refs.pan.current.y = mouseY - worldMouseY * newZoom

      applyTransform()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }
}

// ── Keyboard pan (WASD / Arrow keys) + Space for pan mode ─────────────────────

export function setupKeyboardPan(
  refs: Pick<MapEventRefs, 'spaceHeld' | 'pan'>,
  keysHeld: React.MutableRefObject<Set<string>>,
  panAnimRef: React.MutableRefObject<number>,
  applyTransform: () => void
): () => void {
  const PAN_SPEED = 8
  const PAN_KEYS = new Map([
    ['KeyW', { x: 0, y: PAN_SPEED }],
    ['ArrowUp', { x: 0, y: PAN_SPEED }],
    ['KeyS', { x: 0, y: -PAN_SPEED }],
    ['ArrowDown', { x: 0, y: -PAN_SPEED }],
    ['KeyA', { x: PAN_SPEED, y: 0 }],
    ['ArrowLeft', { x: PAN_SPEED, y: 0 }],
    ['KeyD', { x: -PAN_SPEED, y: 0 }],
    ['ArrowRight', { x: -PAN_SPEED, y: 0 }]
  ])

  const onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (target?.isContentEditable || target?.closest?.('[contenteditable]')) return

    if (e.code === 'Escape') {
      const gs = useGameStore.getState()
      if (gs.pendingPlacement) {
        gs.setPendingPlacement(null)
        return
      }
    }
    if (e.code === 'Space') {
      e.preventDefault()
      refs.spaceHeld.current = true
      return
    }
    if (PAN_KEYS.has(e.code)) {
      e.preventDefault()
      keysHeld.current.add(e.code)
    }
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      refs.spaceHeld.current = false
      return
    }
    keysHeld.current.delete(e.code)
  }

  const animate = (): void => {
    if (keysHeld.current.size > 0) {
      for (const code of keysHeld.current) {
        const delta = PAN_KEYS.get(code)
        if (delta) {
          refs.pan.current.x += delta.x
          refs.pan.current.y += delta.y
        }
      }
      applyTransform()
    }
    panAnimRef.current = requestAnimationFrame(animate)
  }
  panAnimRef.current = requestAnimationFrame(animate)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    cancelAnimationFrame(panAnimRef.current)
  }
}

// ── Mouse down / move / up handlers ──────────────────────────────────────────

interface MouseHandlerOptions {
  refs: MapEventRefs
  map: GameMap | null
  activeTool: ActiveTool
  isInitiativeMode: boolean | undefined
  turnState: TurnState | null | undefined
  applyTransform: () => void
  onTokenMove: (tokenId: string, gridX: number, gridY: number) => void
  onTokenSelect: (tokenId: string | null) => void
  onCellClick: (gridX: number, gridY: number) => void
  onWallPlace?: (x1: number, y1: number, x2: number, y2: number) => void
  renderTokens: () => void
}

export function setupMouseHandlers(el: HTMLElement, opts: MouseHandlerOptions): () => void {
  const { refs, map, activeTool, isInitiativeMode, turnState, applyTransform } = opts
  const { onTokenMove, onTokenSelect, onCellClick, onWallPlace, renderTokens } = opts

  const onMouseDown = (e: MouseEvent): void => {
    // Middle button or space+left for panning
    if (e.button === 1 || (e.button === 0 && refs.spaceHeld.current)) {
      refs.isPanning.current = true
      refs.panStart.current = { x: e.clientX - refs.pan.current.x, y: e.clientY - refs.pan.current.y }
      e.preventDefault()
      return
    }

    if (e.button === 0 && !refs.spaceHeld.current && map) {
      const rect = el.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
      const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current
      const gridX = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
      const gridY = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)

      if (activeTool === 'measure') {
        if (!refs.measureStart.current) {
          refs.measureStart.current = { x: worldX, y: worldY }
        }
        return
      }

      if (activeTool === 'fog-reveal' || activeTool === 'fog-hide') {
        refs.isFogPainting.current = true
        refs.lastFogCell.current = { x: gridX, y: gridY }
        onCellClick(gridX, gridY)
        return
      }

      if (activeTool === 'wall') {
        let snapX = Math.round((worldX - map.grid.offsetX) / map.grid.cellSize)
        let snapY = Math.round((worldY - map.grid.offsetY) / map.grid.cellSize)
        const existingWalls = map.wallSegments ?? []
        const nearby = findNearbyWallEndpoint(snapX, snapY, existingWalls)
        if (nearby) {
          snapX = nearby.x
          snapY = nearby.y
        }

        if (!refs.wallStart.current) {
          refs.wallStart.current = { x: snapX, y: snapY }
        } else {
          const start = refs.wallStart.current
          if (start.x !== snapX || start.y !== snapY) {
            onWallPlace?.(start.x, start.y, snapX, snapY)
          }
          refs.wallStart.current = null
          if (refs.wallGraphics.current) refs.wallGraphics.current.clear()
        }
        return
      }

      // Click-to-place token
      const pending = useGameStore.getState().pendingPlacement
      if (pending && map) {
        useGameStore.getState().commitPlacement(map.id, gridX, gridY)
        return
      }

      if (activeTool === 'token' || activeTool === 'terrain') {
        onCellClick(gridX, gridY)
        return
      }

      if (activeTool === 'select' && !refs.drag.current) {
        onTokenSelect(null)
      }
    }
  }

  const onMouseMove = (e: MouseEvent): void => {
    if (refs.isPanning.current) {
      refs.pan.current.x = e.clientX - refs.panStart.current.x
      refs.pan.current.y = e.clientY - refs.panStart.current.y
      applyTransform()
      return
    }

    // Fog painting (click-and-drag)
    if (refs.isFogPainting.current && map) {
      const rect = el.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
      const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current
      const gx = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
      const gy = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)
      if (!refs.lastFogCell.current || refs.lastFogCell.current.x !== gx || refs.lastFogCell.current.y !== gy) {
        refs.lastFogCell.current = { x: gx, y: gy }
        onCellClick(gx, gy)
      }
      return
    }

    // Token dragging
    if (refs.drag.current && map && refs.world.current) {
      const rect = el.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
      const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current

      const tokenSprite = refs.tokenContainer.current?.children.find(
        (c) => c.label === `token-${refs.drag.current?.tokenId}`
      )
      if (tokenSprite) {
        tokenSprite.x = worldX - refs.drag.current.offsetX
        tokenSprite.y = worldY - refs.drag.current.offsetY
      }
    }

    // Ghost token for click-to-place
    handleGhostToken(e, el, refs, map)

    // Measurement tool
    if (refs.measureStart.current && refs.measureGraphics.current && map) {
      const rect = el.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
      const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current

      drawMeasurement(
        refs.measureGraphics.current,
        refs.measureStart.current,
        { x: worldX, y: worldY },
        map.grid.cellSize
      )
    }
  }

  const onMouseUp = (e: MouseEvent): void => {
    if (refs.isFogPainting.current) {
      refs.isFogPainting.current = false
      refs.lastFogCell.current = null
      return
    }

    if (refs.isPanning.current) {
      refs.isPanning.current = false
      return
    }

    // Finish token drag - snap to grid
    if (refs.drag.current && map) {
      const rect = el.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
      const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current

      const newGridX = Math.round((worldX - refs.drag.current.offsetX) / map.grid.cellSize)
      const newGridY = Math.round((worldY - refs.drag.current.offsetY) / map.grid.cellSize)

      if (newGridX !== refs.drag.current.startGridX || newGridY !== refs.drag.current.startGridY) {
        if (isInitiativeMode && turnState) {
          const moveCheck = canMoveToPosition(
            refs.drag.current.startGridX,
            refs.drag.current.startGridY,
            newGridX,
            newGridY,
            turnState,
            map.terrain ?? []
          )
          if (moveCheck.allowed) {
            onTokenMove(refs.drag.current.tokenId, newGridX, newGridY)
          } else {
            renderTokens()
          }
        } else {
          onTokenMove(refs.drag.current.tokenId, newGridX, newGridY)
        }
      } else {
        renderTokens()
      }

      refs.drag.current = null
    }

    // Finish measurement
    if (refs.measureStart.current && activeTool === 'measure') {
      refs.measureStart.current = null
    }
  }

  el.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  return () => {
    el.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
}

// ── Ghost token helper ───────────────────────────────────────────────────────

function handleGhostToken(
  e: MouseEvent,
  el: HTMLElement,
  refs: Pick<MapEventRefs, 'pan' | 'zoom' | 'ghost' | 'world'>,
  map: GameMap | null
): void {
  const pending = useGameStore.getState().pendingPlacement
  if (pending && map && refs.world.current) {
    const rect = el.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top
    const worldX = (canvasX - refs.pan.current.x) / refs.zoom.current
    const worldY = (canvasY - refs.pan.current.y) / refs.zoom.current
    const gx = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
    const gy = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)

    if (!refs.ghost.current) {
      refs.ghost.current = new Graphics()
      refs.ghost.current.alpha = 0.5
      refs.world.current.addChild(refs.ghost.current)
    }
    const g = refs.ghost.current
    g.clear()
    const sizeX = pending.tokenData.sizeX ?? 1
    const sizeY = pending.tokenData.sizeY ?? 1
    const px = (gx + map.grid.offsetX / map.grid.cellSize) * map.grid.cellSize
    const py = (gy + map.grid.offsetY / map.grid.cellSize) * map.grid.cellSize
    g.circle(
      px + (sizeX * map.grid.cellSize) / 2,
      py + (sizeY * map.grid.cellSize) / 2,
      (Math.min(sizeX, sizeY) * map.grid.cellSize) / 2 - 2
    )
    g.fill({ color: 0x22d3ee, alpha: 0.4 })
    g.stroke({ color: 0x22d3ee, width: 2, alpha: 0.8 })
  } else if (refs.ghost.current) {
    refs.ghost.current.clear()
  }
}

// ── Token context menu helper ────────────────────────────────────────────────

export function handleTokenRightClick(
  e: { stopPropagation: () => void; global: { x: number; y: number } },
  token: MapToken,
  mapId: string,
  containerEl: HTMLElement | null,
  onTokenContextMenu?: (x: number, y: number, token: MapToken, mapId: string) => void
): void {
  e.stopPropagation()
  if (!onTokenContextMenu) return
  const canvas = containerEl?.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const screenX = e.global.x + rect.left
  const screenY = e.global.y + rect.top
  onTokenContextMenu(screenX, screenY, token, mapId)
}
