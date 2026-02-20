import 'pixi.js/unsafe-eval' // CSP-compatible PixiJS shaders (must be before any pixi usage)
import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { canMoveToPosition } from '../../services/combat-rules'
import { useGameStore } from '../../stores/useGameStore'
import type { TurnState } from '../../types/game-state'
import type { GameMap, MapToken } from '../../types/map'
import { type AoEConfig, clearAoEOverlay, drawAoEOverlay } from './AoEOverlay'
import { destroyFogAnimation, drawFogOfWar, initFogAnimation } from './FogOverlay'
import { drawGrid } from './GridLayer'
import { clearMeasurement, drawMeasurement } from './MeasurementTool'
import { clearMovementOverlay, drawMovementOverlay, drawTerrainOverlay } from './MovementOverlay'
import { createTokenSprite } from './TokenSprite'
import { LIGHT_SOURCES } from '../../data/light-sources'
import { drawLightingOverlay, type LightingConfig } from './LightingOverlay'
import { drawWalls, findNearbyWallEndpoint } from './WallLayer'
import { WeatherOverlayLayer, presetToWeatherType } from './WeatherOverlay'

interface MapCanvasProps {
  map: GameMap | null
  isHost: boolean
  selectedTokenId: string | null
  activeTool: 'select' | 'token' | 'fog-reveal' | 'fog-hide' | 'measure' | 'terrain' | 'wall' | 'fill'
  fogBrushSize: number
  onTokenMove: (tokenId: string, gridX: number, gridY: number) => void
  onTokenSelect: (tokenId: string | null) => void
  onCellClick: (gridX: number, gridY: number) => void
  onWallPlace?: (x1: number, y1: number, x2: number, y2: number) => void
  onDoorToggle?: (wallId: string) => void
  turnState?: TurnState | null
  isInitiativeMode?: boolean
  activeAoE?: AoEConfig | null
  /** Entity ID of the creature whose turn it is (for active turn glow) */
  activeEntityId?: string | null
  /** Callback for right-click on a token (context menu) */
  onTokenContextMenu?: (x: number, y: number, token: MapToken, mapId: string) => void
}

export default function MapCanvas({
  map,
  isHost,
  selectedTokenId,
  activeTool,
  fogBrushSize,
  onTokenMove,
  onTokenSelect,
  onCellClick,
  onWallPlace,
  onDoorToggle,
  turnState,
  isInitiativeMode,
  activeAoE,
  activeEntityId,
  onTokenContextMenu
}: MapCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const gridGraphicsRef = useRef<Graphics | null>(null)
  const fogGraphicsRef = useRef<Graphics | null>(null)
  const tokenContainerRef = useRef<Container | null>(null)
  const measureGraphicsRef = useRef<Graphics | null>(null)
  const moveOverlayRef = useRef<Graphics | null>(null)
  const terrainOverlayRef = useRef<Graphics | null>(null)
  const aoeOverlayRef = useRef<Graphics | null>(null)
  const bgSpriteRef = useRef<Sprite | null>(null)
  const weatherOverlayRef = useRef<WeatherOverlayLayer | null>(null)

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

  // Fog painting state (click-and-drag)
  const isFogPaintingRef = useRef(false)
  const lastFogCellRef = useRef<{ x: number; y: number } | null>(null)

  // Measurement state
  const measureStartRef = useRef<{ x: number; y: number } | null>(null)

  // Wall placement state
  const wallStartRef = useRef<{ x: number; y: number } | null>(null)
  const wallGraphicsRef = useRef<Graphics | null>(null)
  const lightingGraphicsRef = useRef<Graphics | null>(null)

  // Ghost token for click-to-place
  const ghostRef = useRef<Graphics | null>(null)

  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [_retryCount, setRetryCount] = useState(0)
  const [bgLoadError, setBgLoadError] = useState<string | null>(null)

  // Apply zoom and pan (declared early so effects below can reference it)
  const applyTransform = useCallback(() => {
    if (!worldRef.current) return
    worldRef.current.scale.set(zoomRef.current)
    worldRef.current.x = panRef.current.x
    worldRef.current.y = panRef.current.y
  }, [])

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    const app = new Application()
    appRef.current = app

    const initApp = async (): Promise<void> => {
      // Check WebGL support before attempting PixiJS init
      try {
        const testCanvas = document.createElement('canvas')
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
        if (!gl) {
          if (!cancelled) setInitError('WebGL is not available. Check your GPU drivers.')
          console.error('[MapCanvas] WebGL not available')
          return
        }
        const ext = gl.getExtension('WEBGL_lose_context')
        ext?.loseContext()
      } catch (err) {
        if (!cancelled) setInitError(`WebGL check failed: ${(err as Error).message}`)
        console.error('[MapCanvas] WebGL check failed:', err)
        return
      }

      if (cancelled) return

      // Wait for container to have non-zero dimensions
      const container = containerRef.current!
      let attempts = 0
      while ((container.clientWidth === 0 || container.clientHeight === 0) && attempts < 10) {
        console.log(`[MapCanvas] Container has zero dimensions, waiting... (attempt ${attempts + 1})`)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        attempts++
        if (cancelled) return
      }

      if (container.clientWidth === 0 || container.clientHeight === 0) {
        if (!cancelled) setInitError('Map container has zero dimensions. Try resizing the window.')
        console.error('[MapCanvas] Container still has zero dimensions after waiting')
        return
      }

      if (cancelled) return

      console.log(`[MapCanvas] Container dimensions: ${container.clientWidth}x${container.clientHeight}`)

      try {
        await app.init({
          resizeTo: container,
          background: 0x111827,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          preference: 'webgl'
        })
      } catch (err) {
        const msg = (err as Error).message || String(err)
        if (!cancelled) setInitError(`PixiJS init failed: ${msg}`)
        console.error('[MapCanvas] PixiJS init failed:', err)
        return
      }

      // StrictMode cleanup may have run while init was in progress
      if (cancelled) {
        try {
          app.destroy(true, { children: true })
        } catch {
          /* already torn down */
        }
        return
      }

      console.log('[MapCanvas] PixiJS initialized successfully')

      container.appendChild(app.canvas)

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

      // Terrain overlay layer (above grid, below tokens)
      const terrainGfx = new Graphics()
      terrainGfx.label = 'terrain'
      world.addChild(terrainGfx)
      terrainOverlayRef.current = terrainGfx

      // Movement overlay layer (above terrain, below tokens)
      const moveGfx = new Graphics()
      moveGfx.label = 'movement'
      world.addChild(moveGfx)
      moveOverlayRef.current = moveGfx

      // AoE overlay layer (above movement, below tokens)
      const aoeGfx = new Graphics()
      aoeGfx.label = 'aoe'
      world.addChild(aoeGfx)
      aoeOverlayRef.current = aoeGfx

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

      // Lighting overlay (above fog, below walls)
      const lightGfx = new Graphics()
      lightGfx.label = 'lighting'
      world.addChild(lightGfx)
      lightingGraphicsRef.current = lightGfx

      // Wall overlay (above lighting, below measure)
      const wallGfx = new Graphics()
      wallGfx.label = 'walls'
      world.addChild(wallGfx)
      wallGraphicsRef.current = wallGfx

      // Measurement overlay
      const measureGfx = new Graphics()
      measureGfx.label = 'measure'
      world.addChild(measureGfx)
      measureGraphicsRef.current = measureGfx

      // Weather overlay (screen-space, added to stage above world)
      const weatherLayer = new WeatherOverlayLayer(app)
      weatherLayer.getContainer().label = 'weather'
      weatherOverlayRef.current = weatherLayer

      setInitialized(true)
      setInitError(null)
      console.log('[MapCanvas] All layers created, ready to render')
    }

    initApp()

    return () => {
      cancelled = true
      // Destroy weather overlay before app
      if (weatherOverlayRef.current) {
        weatherOverlayRef.current.destroy()
        weatherOverlayRef.current = null
      }
      // Destroy fog animation ticker
      destroyFogAnimation()
      try {
        app.destroy(true, { children: true })
      } catch {
        /* may already be destroyed */
      }
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
        const resolvedUrl = new URL(map.imagePath, window.location.href).href
        console.log('[MapCanvas] Loading background image:', resolvedUrl)
        const texture = await Assets.load(map.imagePath)
        // Set nearest-neighbor scaling for crisp pixels when zoomed
        if (texture.source) {
          texture.source.scaleMode = 'nearest'
        }
        const sprite = new Sprite(texture)
        sprite.label = 'bg'
        // Insert at index 0 so it's behind everything
        worldRef.current?.addChildAt(sprite, 0)
        bgSpriteRef.current = sprite
        setBgLoadError(null)
        console.log('[MapCanvas] Background image loaded successfully')

        // Auto-center: fit map to viewport
        const container = containerRef.current
        if (container && sprite.texture.width > 0) {
          const cw = container.clientWidth
          const ch = container.clientHeight
          const mw = sprite.texture.width
          const mh = sprite.texture.height
          const scale = Math.min(cw / mw, ch / mh, 1)
          zoomRef.current = scale
          panRef.current = {
            x: (cw - mw * scale) / 2,
            y: (ch - mh * scale) / 2
          }
          applyTransform()
        }
      } catch (err) {
        const msg = `Failed to load map image: ${map.imagePath}`
        console.warn('[MapCanvas]', msg, err)
        setBgLoadError(msg)
      }
    }

    loadBg()
  }, [initialized, map?.imagePath, applyTransform])

  // Draw grid
  useEffect(() => {
    if (!initialized || !gridGraphicsRef.current || !map) return
    drawGrid(gridGraphicsRef.current, map.grid, map.width, map.height)

    // Auto-center grid-only maps (no background image)
    if (!map.imagePath && !bgSpriteRef.current) {
      const container = containerRef.current
      if (container) {
        const cw = container.clientWidth
        const ch = container.clientHeight
        const scale = Math.min(cw / map.width, ch / map.height, 1)
        zoomRef.current = scale
        panRef.current = {
          x: (cw - map.width * scale) / 2,
          y: (ch - map.height * scale) / 2
        }
        applyTransform()
      }
    }
  }, [initialized, map?.grid, map?.width, map?.height, map?.imagePath, applyTransform, map])

  // Initialize fog animation ticker (once when app is ready)
  useEffect(() => {
    if (!initialized || !appRef.current || !fogGraphicsRef.current || !map) return
    initFogAnimation(appRef.current, fogGraphicsRef.current, map.grid, map.width, map.height)
    return () => {
      destroyFogAnimation()
    }
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
  }, [initialized, map?.fogOfWar, map?.grid, map?.width, map?.height, isHost, map])

  // Draw walls (DM only)
  useEffect(() => {
    if (!initialized || !wallGraphicsRef.current || !map) return
    const walls = map.wallSegments ?? []
    if (isHost && walls.length > 0) {
      drawWalls(wallGraphicsRef.current, walls, map.grid, isHost)
    } else {
      wallGraphicsRef.current.clear()
    }
  }, [initialized, map?.wallSegments, map?.grid, isHost, map])

  // Draw lighting overlay
  useEffect(() => {
    if (!initialized || !lightingGraphicsRef.current || !map) return
    const ambientLight = useGameStore.getState().ambientLight
    const activeLightSources = useGameStore.getState().activeLightSources
    const walls = map.wallSegments ?? []

    // Only draw lighting when there are walls or non-bright ambient light
    if (walls.length === 0 && ambientLight === 'bright') {
      lightingGraphicsRef.current.clear()
      return
    }

    // Convert active light sources to the format LightingOverlay expects
    // Resolve position from the token carrying the light, and radii from light-sources data
    const tokens = map.tokens ?? []
    const lightSources = activeLightSources.map((ls) => {
      const token = tokens.find((t) => t.id === ls.entityId)
      const def = LIGHT_SOURCES[ls.sourceName]
      return {
        x: token?.gridX ?? 0,
        y: token?.gridY ?? 0,
        brightRadius: def ? Math.ceil(def.brightRadius / 5) : 4,
        dimRadius: def ? Math.ceil(def.dimRadius / 5) : 4
      }
    })

    // Find viewer token (first player character token for player view)
    const viewerToken = !isHost ? tokens.find((t) => t.entityType === 'player') ?? null : null

    const config: LightingConfig = {
      ambientLight,
      darkvisionRange: viewerToken?.darkvision ? 12 : undefined // 60ft / 5ft per cell = 12 cells
    }

    drawLightingOverlay(lightingGraphicsRef.current, map, viewerToken, lightSources, config, isHost)
  }, [initialized, map, isHost])

  // Draw terrain overlay
  useEffect(() => {
    if (!initialized || !terrainOverlayRef.current || !map) return
    const terrain = map.terrain ?? []
    if (terrain.length > 0) {
      drawTerrainOverlay(terrainOverlayRef.current, terrain, map.grid.cellSize)
    } else {
      terrainOverlayRef.current.clear()
    }
  }, [initialized, map?.terrain, map?.grid.cellSize, map])

  // Draw AoE overlay
  useEffect(() => {
    if (!initialized || !aoeOverlayRef.current || !map) return
    if (activeAoE) {
      drawAoEOverlay(aoeOverlayRef.current, activeAoE, map.grid.cellSize)
    } else {
      clearAoEOverlay(aoeOverlayRef.current)
    }
  }, [initialized, activeAoE, map?.grid.cellSize, map])

  // Draw movement overlay when a token is selected during initiative
  useEffect(() => {
    if (!initialized || !moveOverlayRef.current || !map) return
    if (!isInitiativeMode || !selectedTokenId || !turnState) {
      clearMovementOverlay(moveOverlayRef.current)
      return
    }

    const token = map.tokens.find((t) => t.id === selectedTokenId)
    if (!token) {
      clearMovementOverlay(moveOverlayRef.current)
      return
    }

    const gridWidth = Math.ceil(map.width / map.grid.cellSize)
    const gridHeight = Math.ceil(map.height / map.grid.cellSize)

    drawMovementOverlay(
      moveOverlayRef.current,
      token.gridX,
      token.gridY,
      turnState.movementRemaining,
      turnState.movementMax,
      map.grid.cellSize,
      map.terrain ?? [],
      gridWidth,
      gridHeight,
      map.wallSegments
    )
  }, [
    initialized,
    isInitiativeMode,
    selectedTokenId,
    turnState?.movementRemaining,
    map?.tokens,
    map?.grid.cellSize,
    map?.width,
    map?.height,
    map?.terrain,
    map?.wallSegments,
    map,
    turnState
  ])

  // Weather overlay — reacts to weatherOverride.preset and showWeatherOverlay
  const weatherOverride = useGameStore((s) => s.weatherOverride)
  const showWeatherOverlay = useGameStore((s) => s.showWeatherOverlay)

  useEffect(() => {
    if (!initialized || !weatherOverlayRef.current) return

    if (!showWeatherOverlay) {
      weatherOverlayRef.current.setWeather(null)
      return
    }

    const weatherType = presetToWeatherType(weatherOverride?.preset)
    weatherOverlayRef.current.setWeather(weatherType)
  }, [initialized, weatherOverride?.preset, showWeatherOverlay])

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
        token.id === selectedTokenId,
        !!activeEntityId && token.entityId === activeEntityId
      )
      sprite.label = `token-${token.id}`

      // Click handler for selection
      sprite.on('pointerdown', (e) => {
        if (activeTool !== 'select') return
        // Ignore right-click for drag/select — handled by rightclick event
        if (e.button === 2) return
        e.stopPropagation()

        onTokenSelect(token.id)

        // Start drag
        const worldPos = worldRef.current?.toLocal(e.global)
        if (!worldPos) return
        dragRef.current = {
          tokenId: token.id,
          startGridX: token.gridX,
          startGridY: token.gridY,
          offsetX: worldPos.x - token.gridX * map.grid.cellSize,
          offsetY: worldPos.y - token.gridY * map.grid.cellSize
        }
      })

      // Right-click handler for context menu
      sprite.on('rightclick', (e) => {
        e.stopPropagation()
        if (!onTokenContextMenu || !map) return
        // Convert PixiJS global coords to screen coords
        const canvas = containerRef.current?.querySelector('canvas')
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const screenX = e.global.x + rect.left
        const screenY = e.global.y + rect.top
        onTokenContextMenu(screenX, screenY, token, map.id)
      })

      tokenContainerRef.current?.addChild(sprite)
    })
  }, [map, selectedTokenId, isHost, activeTool, onTokenSelect, activeEntityId, onTokenContextMenu])

  useEffect(() => {
    if (!initialized) return
    renderTokens()
  }, [initialized, renderTokens])

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

  // Keyboard events for space key + WASD/Arrow panning
  const keysHeldRef = useRef(new Set<string>())
  const panAnimRef = useRef<number>(0)

  useEffect(() => {
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
      // Escape cancels pending placement
      if (e.code === 'Escape') {
        const gs = useGameStore.getState()
        if (gs.pendingPlacement) {
          gs.setPendingPlacement(null)
          return
        }
      }
      if (e.code === 'Space') {
        e.preventDefault()
        spaceHeldRef.current = true
        return
      }
      if (PAN_KEYS.has(e.code)) {
        e.preventDefault()
        keysHeldRef.current.add(e.code)
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        return
      }
      keysHeldRef.current.delete(e.code)
    }

    const animate = (): void => {
      if (keysHeldRef.current.size > 0) {
        for (const code of keysHeldRef.current) {
          const delta = PAN_KEYS.get(code)
          if (delta) {
            panRef.current.x += delta.x
            panRef.current.y += delta.y
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
  }, [applyTransform])

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
          // Start fog painting
          isFogPaintingRef.current = true
          lastFogCellRef.current = { x: gridX, y: gridY }
          onCellClick(gridX, gridY)
          return
        }

        if (activeTool === 'wall') {
          // Snap to grid intersection (nearest corner)
          let snapX = Math.round((worldX - map.grid.offsetX) / map.grid.cellSize)
          let snapY = Math.round((worldY - map.grid.offsetY) / map.grid.cellSize)

          // Auto-close: snap to nearby existing wall endpoint
          const existingWalls = map.wallSegments ?? []
          const nearby = findNearbyWallEndpoint(snapX, snapY, existingWalls)
          if (nearby) {
            snapX = nearby.x
            snapY = nearby.y
          }

          if (!wallStartRef.current) {
            // First click: set start point
            wallStartRef.current = { x: snapX, y: snapY }
          } else {
            // Second click: place wall
            const start = wallStartRef.current
            if (start.x !== snapX || start.y !== snapY) {
              onWallPlace?.(start.x, start.y, snapX, snapY)
            }
            wallStartRef.current = null
            // Clear preview
            if (wallGraphicsRef.current) wallGraphicsRef.current.clear()
          }
          return
        }

        // Click-to-place token (from pending placement)
        const pending = useGameStore.getState().pendingPlacement
        if (pending && map) {
          useGameStore.getState().commitPlacement(map.id, gridX, gridY)
          return
        }

        if (activeTool === 'token' || activeTool === 'terrain') {
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

      // Fog painting (click-and-drag)
      if (isFogPaintingRef.current && map) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current
        const gx = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
        const gy = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)
        if (!lastFogCellRef.current || lastFogCellRef.current.x !== gx || lastFogCellRef.current.y !== gy) {
          lastFogCellRef.current = { x: gx, y: gy }
          onCellClick(gx, gy)
        }
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
          (c) => c.label === `token-${dragRef.current?.tokenId}`
        )
        if (tokenSprite) {
          tokenSprite.x = worldX - dragRef.current.offsetX
          tokenSprite.y = worldY - dragRef.current.offsetY
        }
      }

      // Ghost token for click-to-place (follows cursor snapped to grid)
      const pending = useGameStore.getState().pendingPlacement
      if (pending && map && worldRef.current) {
        const rect = el.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const worldX = (canvasX - panRef.current.x) / zoomRef.current
        const worldY = (canvasY - panRef.current.y) / zoomRef.current
        const gx = Math.floor((worldX - (map.grid.offsetX % map.grid.cellSize)) / map.grid.cellSize)
        const gy = Math.floor((worldY - (map.grid.offsetY % map.grid.cellSize)) / map.grid.cellSize)

        if (!ghostRef.current) {
          ghostRef.current = new Graphics()
          ghostRef.current.alpha = 0.5
          worldRef.current.addChild(ghostRef.current)
        }
        const g = ghostRef.current
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
      } else if (ghostRef.current) {
        ghostRef.current.clear()
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
      // Stop fog painting
      if (isFogPaintingRef.current) {
        isFogPaintingRef.current = false
        lastFogCellRef.current = null
        return
      }

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

        const newGridX = Math.round((worldX - dragRef.current.offsetX) / map.grid.cellSize)
        const newGridY = Math.round((worldY - dragRef.current.offsetY) / map.grid.cellSize)

        if (newGridX !== dragRef.current.startGridX || newGridY !== dragRef.current.startGridY) {
          // Validate movement during initiative mode
          if (isInitiativeMode && turnState) {
            const moveCheck = canMoveToPosition(
              dragRef.current.startGridX,
              dragRef.current.startGridY,
              newGridX,
              newGridY,
              turnState,
              map.terrain ?? []
            )
            if (moveCheck.allowed) {
              onTokenMove(dragRef.current.tokenId, newGridX, newGridY)
            } else {
              // Not enough movement - snap back
              renderTokens()
            }
          } else {
            onTokenMove(dragRef.current.tokenId, newGridX, newGridY)
          }
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
  }, [
    map,
    activeTool,
    applyTransform,
    onTokenMove,
    onTokenSelect,
    onCellClick,
    renderTokens,
    isInitiativeMode,
    onWallPlace,
    turnState
  ])

  // Clear measurement when tool changes away from measure
  useEffect(() => {
    if (activeTool !== 'measure' && measureGraphicsRef.current) {
      clearMeasurement(measureGraphicsRef.current)
      measureStartRef.current = null
    }
  }, [activeTool])

  // Center map on entity when requested from initiative tracker
  const centerOnEntityId = useGameStore((s) => s.centerOnEntityId)
  const clearCenterRequest = useGameStore((s) => s.clearCenterRequest)

  useEffect(() => {
    if (!centerOnEntityId || !map || !containerRef.current) return
    const token = map.tokens.find((t) => t.entityId === centerOnEntityId)
    if (!token) {
      clearCenterRequest()
      return
    }
    const cellSize = map.grid.cellSize
    const tokenWorldX = token.gridX * cellSize + cellSize / 2
    const tokenWorldY = token.gridY * cellSize + cellSize / 2
    const rect = containerRef.current.getBoundingClientRect()
    panRef.current = {
      x: rect.width / 2 - tokenWorldX * zoomRef.current,
      y: rect.height / 2 - tokenWorldY * zoomRef.current
    }
    applyTransform()
    clearCenterRequest()
  }, [centerOnEntityId, map, applyTransform, clearCenterRequest])

  const pendingPlacement = useGameStore((s) => s.pendingPlacement)

  return (
    <div className={`relative w-full h-full overflow-hidden bg-gray-900 ${pendingPlacement ? 'cursor-crosshair' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <div ref={containerRef} className="w-full h-full" />
      {pendingPlacement && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-cyan-500/60 rounded-lg px-4 py-2 text-xs text-cyan-300 pointer-events-none">
          Click to place <span className="font-semibold">{pendingPlacement.tokenData.label ?? 'token'}</span>. Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200">Esc</kbd> to cancel.
        </div>
      )}
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-gray-800 border border-red-500 rounded-lg p-6 max-w-md text-center">
            <p className="text-red-400 font-semibold text-lg mb-2">Map Renderer Error</p>
            <p className="text-gray-300 text-sm mb-4">{initError}</p>
            <p className="text-gray-500 text-xs mb-4">
              Try updating your GPU drivers or check the console (Ctrl+Shift+I) for details.
            </p>
            <button
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm"
              onClick={() => {
                setInitError(null)
                setRetryCount((c) => c + 1)
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {bgLoadError && !initError && (
        <div className="absolute top-2 left-2 z-20 bg-yellow-900/90 border border-yellow-600 rounded px-3 py-2 text-yellow-200 text-xs max-w-xs">
          {bgLoadError}
        </div>
      )}
      {!map && !initError && (
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
