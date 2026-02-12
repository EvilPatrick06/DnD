import { useEffect, useRef, useCallback, useState } from 'react'
import { Application, Container, Graphics, Sprite, Assets } from 'pixi.js'
import type { GameMap, MapToken } from '../../types/map'
import { drawGrid } from './GridLayer'
import { createTokenSprite } from './TokenSprite'
import { drawFogOfWar } from './FogOverlay'
import { drawMeasurement, clearMeasurement } from './MeasurementTool'

interface MapCanvasProps {
  map: GameMap | null
  isHost: boolean
  selectedTokenId: string | null
  activeTool: 'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure'
  fogBrushSize: number
  onTokenMove: (tokenId: string, gridX: number, gridY: number) => void
  onTokenSelect: (tokenId: string | null) => void
  onCellClick: (gridX: number, gridY: number) => void
}

export default function MapCanvas({
  map,
  isHost,
  selectedTokenId,
  activeTool,
  fogBrushSize,
  onTokenMove,
  onTokenSelect,
  onCellClick
}: MapCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const gridGraphicsRef = useRef<Graphics | null>(null)
  const fogGraphicsRef = useRef<Graphics | null>(null)
  const tokenContainerRef = useRef<Container | null>(null)
  const measureGraphicsRef = useRef<Graphics | null>(null)
  const bgSpriteRef = useRef<Sprite | null>(null)

  // Pan and zoom state
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const spaceHeldRef = useRef(false)

  // Dragging tokens
  const dragRef = useRef<{
    tokenId: string
    startGridX: number
    startGridY: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Measurement state
  const measureStartRef = useRef<{ x: number; y: number } | null>(null)

  const [initialized, setInitialized] = useState(false)

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return

    const app = new Application()
    appRef.current = app

    const initApp = async (): Promise<void> => {
      await app.init({
        resizeTo: containerRef.current!,
        background: 0x111827,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      })

      containerRef.current!.appendChild(app.canvas)

      // World container for pan/zoom
      const world = new Container()
      world.label = 'world'
      app.stage.addChild(world)
      worldRef.current = world

      // Grid layer
      const gridGfx = new Graphics()
      gridGfx.label = 'grid'
      world.addChild(gridGfx)
      gridGraphicsRef.current = gridGfx

      // Token layer
      const tokenLayer = new Container()
      tokenLayer.label = 'tokens'
      world.addChild(tokenLayer)
      tokenContainerRef.current = tokenLayer

      // Fog layer (above tokens for players, but DM can see through)
      const fogGfx = new Graphics()
      fogGfx.label = 'fog'
      world.addChild(fogGfx)
      fogGraphicsRef.current = fogGfx

      // Measurement overlay
      const measureGfx = new Graphics()
      measureGfx.label = 'measure'
      world.addChild(measureGfx)
      measureGraphicsRef.current = measureGfx

      setInitialized(true)
    }

    initApp()

    return () => {
      app.destroy(true, { children: true })
      appRef.current = null
      worldRef.current = null
      setInitialized(false)
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = (): void => {
      appRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load and display map background
  useEffect(() => {
    if (!initialized || !worldRef.current) return

    const loadBg = async (): Promise<void> => {
      // Remove old background
      if (bgSpriteRef.current) {
        worldRef.current?.removeChild(bgSpriteRef.current)
        bgSpriteRef.current.destroy()
        bgSpriteRef.current = null
      }

      if (!map?.imagePath) return

      try {
        const texture = await Assets.load(map.imagePath)
        const sprite = new Sprite(texture)
        sprite.label = 'bg'
        // Insert at index 0 so it's behind everything
        worldRef.current?.addChildAt(sprite, 0)
        bgSpriteRef.current = sprite
      } catch (err) {
        console.warn('Failed to load map background:', err)
      }
    }

    loadBg()
  }, [initialized, map?.imagePath])

  // Draw grid
  useEffect(() => {
    if (!initialized || !gridGraphicsRef.current || !map) return
    drawGrid(gridGraphicsRef.current, map.grid, map.width, map.height)
  }, [initialized, map?.grid, map?.width, map?.height])

  // Draw fog of war
  useEffect(() => {
    if (!initialized || !fogGraphicsRef.current || !map) return

    // DM sees fog as semi-transparent; hide fog layer for hosts so they can see tokens
    if (isHost) {
      fogGraphicsRef.current.alpha = 0.3
    } else {
      fogGraphicsRef.current.alpha = 1
    }

    drawFogOfWar(fogGraphicsRef.current, map.fogOfWar, map.grid, map.width, map.height)
  }, [initialized, map?.fogOfWar, map?.grid, map?.width, map?.height, isHost])

  // Render tokens
  const renderTokens = useCallback(() => {
    if (!tokenContainerRef.current || !map) return

    // Clear existing tokens
    tokenContainerRef.current.removeChildren()

    map.tokens.forEach((token) => {
      // Players can only see visible tokens
      if (!isHost && !token.visibleToPlayers) return

      const sprite = createTokenSprite(
        token,
        map.grid.cellSize,
        token.id === selectedTokenId
      )
      sprite.label = `token-${token.id}`

      // Click handler for selection
      sprite.on('pointerdown', (e) => {
        if (activeTool !== 'select') return
        e.stopPropagation()

        onTokenSelect(token.id)

        // Start drag
        const worldPos = worldRef.current!.toLocal(e.global)
        dragRef.current = {
          tokenId: token.id,
          startGridX: token.gridX,
          startGridY: token.gridY,
          offsetX: worldPos.x - token.gridX * map.grid.cellSize,
          offsetY: worldPos.y - token.gridY * map.grid.cellSize
        }
      })

      tokenContainerRef.current!.addChild(sprite)
    })
  }, [map, selectedTokenId, isHost, activeTool, onTokenSelect])

  useEffect(() => {
    if (!initialized) return
    renderTokens()
  }, [initialized, renderTokens])

  // Apply zoom and pan
  const applyTransform = useCallback(() => {
    if (!worldRef.current) return
    worldRef.current.scale.set(zoomRef.current)
    worldRef.current.x = panRef.current.x
    worldRef.current.y = panRef.current.y
  }, [])

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.25, Math.min(4, zoomRef.current * zoomFactor))

      // Zoom toward cursor position
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const worldMouseX = (mouseX - panRef.current.x) / zoomRef.current
      const worldMouseY = (mouseY - panRef.current.y) / zoomRef.current

      zoomRef.current = newZoom
      panRef.current.x = mouseX - worldMouseX * newZoom
      panRef.current.y = mouseY - worldMouseY * newZoom

      applyTransform()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyTransform])

  // Keyboard events for space key panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        e.preventDefault()
        spaceHeldRef.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Mouse events for panning and dragging
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent): void => {
      // Middle button or space+left for panning
      if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y }
        e.preventDefault()
        return
      }

      // Left click on canvas (not on a token)
      if (e.button === 0 && !spaceHeldRef.current && map) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top

        // Convert to world coordinates
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current

        const gridX = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
        const gridY = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)

        if (activeTool === 'measure') {
          if (!measureStartRef.current) {
            measureStartRef.current = { x: worldX, y: worldY }
          }
          return
        }

        if (activeTool === 'fog-reveal' || activeTool === 'fog-hide') {
          // Apply fog brush
          const halfBrush = Math.floor(fogBrushSize / 2)
          const cells: Array<{ x: number; y: number }> = []
          for (let dx = -halfBrush; dx <= halfBrush; dx++) {
            for (let dy = -halfBrush; dy <= halfBrush; dy++) {
              cells.push({ x: gridX + dx, y: gridY + dy })
            }
          }
          onCellClick(gridX, gridY)
          return
        }

        if (activeTool === 'token') {
          onCellClick(gridX, gridY)
          return
        }

        // Select tool - clicking empty space deselects
        if (activeTool === 'select' && !dragRef.current) {
          onTokenSelect(null)
        }
      }
    }

    const onMouseMove = (e: MouseEvent): void => {
      if (isPanningRef.current) {
        panRef.current.x = e.clientX - panStartRef.current.x
        panRef.current.y = e.clientY - panStartRef.current.y
        applyTransform()
        return
      }

      // Token dragging
      if (dragRef.current && map && worldRef.current) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current

        // Move the token sprite directly for smooth dragging
        const tokenSprite = tokenContainerRef.current?.children.find(
          (c) => c.label === `token-${dragRef.current!.tokenId}`
        )
        if (tokenSprite) {
          tokenSprite.x = worldX - dragRef.current.offsetX
          tokenSprite.y = worldY - dragRef.current.offsetY
        }
      }

      // Measurement tool
      if (measureStartRef.current && measureGraphicsRef.current && map) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current

        drawMeasurement(
          measureGraphicsRef.current,
          measureStartRef.current,
          { x: worldX, y: worldY },
          map.grid.cellSize
        )
      }
    }

    const onMouseUp = (e: MouseEvent): void => {
      if (isPanningRef.current) {
        isPanningRef.current = false
        return
      }

      // Finish token drag - snap to grid
      if (dragRef.current && map) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current

        const newGridX = Math.round(
          (worldX - dragRef.current.offsetX) / map.grid.cellSize
        )
        const newGridY = Math.round(
          (worldY - dragRef.current.offsetY) / map.grid.cellSize
        )

        if (
          newGridX !== dragRef.current.startGridX ||
          newGridY !== dragRef.current.startGridY
        ) {
          onTokenMove(dragRef.current.tokenId, newGridX, newGridY)
        } else {
          // No movement, re-render tokens to snap back
          renderTokens()
        }

        dragRef.current = null
      }

      // Finish measurement
      if (measureStartRef.current && activeTool === 'measure') {
        // Keep measurement displayed until next click or tool change
        measureStartRef.current = null
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
  }, [map, activeTool, fogBrushSize, applyTransform, onTokenMove, onTokenSelect, onCellClick, renderTokens])

  // Clear measurement when tool changes away from measure
  useEffect(() => {
    if (activeTool !== 'measure' && measureGraphicsRef.current) {
      clearMeasurement(measureGraphicsRef.current)
      measureStartRef.current = null
    }
  }, [activeTool])

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900">
      <div ref={containerRef} className="w-full h-full" />
      {!map && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-5xl mb-4">&#9635;</div>
            <p className="text-lg">No map loaded</p>
            <p className="text-sm mt-1">
              {isHost ? 'Use the Map Selector to add a map' : 'Waiting for the DM to load a map'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
