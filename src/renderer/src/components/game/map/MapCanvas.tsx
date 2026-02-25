import 'pixi.js/unsafe-eval' // CSP-compatible PixiJS shaders (must be before any pixi usage)
import { Application, Assets, type Container, type Graphics, Sprite } from 'pixi.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../../stores/use-game-store'
import type { TurnState } from '../../../types/game-state'
import type { GameMap, MapToken } from '../../../types/map'
import { logger } from '../../../utils/logger'
import type { AoEConfig } from './aoe-overlay'
import { destroyFogAnimation } from './fog-overlay'
import type { MapEventRefs } from './map-event-handlers'
import { createWheelHandler, setupKeyboardPan, setupMouseHandlers } from './map-event-handlers'
import { useMapOverlayEffects } from './map-overlay-effects'
import {
  checkWebGLSupport,
  createMapLayers,
  initPixiApp,
  type MapLayers,
  waitForContainerDimensions
} from './map-pixi-setup'
import { clearMeasurement } from './measurement-tool'
import { createTokenSprite } from './token-sprite'
import type { WeatherOverlayLayer } from './weather-overlay'

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
  const tokenSpriteMapRef = useRef(new Map<string, { sprite: Container; key: string }>())

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

  // Fog painting state
  const isFogPaintingRef = useRef(false)
  const lastFogCellRef = useRef<{ x: number; y: number } | null>(null)

  // Measurement / Wall / Ghost
  const measureStartRef = useRef<{ x: number; y: number } | null>(null)
  const wallStartRef = useRef<{ x: number; y: number } | null>(null)
  const wallGraphicsRef = useRef<Graphics | null>(null)
  const lightingGraphicsRef = useRef<Graphics | null>(null)
  const ghostRef = useRef<Graphics | null>(null)

  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [_retryCount, setRetryCount] = useState(0)
  const [bgLoadError, setBgLoadError] = useState<string | null>(null)

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
      const webglError = checkWebGLSupport()
      if (webglError) {
        if (!cancelled) setInitError(webglError)
        return
      }
      if (cancelled) return
      const container = containerRef.current!
      const ready = await waitForContainerDimensions(container, () => cancelled)
      if (!ready) {
        if (!cancelled) setInitError('Map container has zero dimensions. Try resizing the window.')
        return
      }
      if (cancelled) return
      logger.debug(`[MapCanvas] Container dimensions: ${container.clientWidth}x${container.clientHeight}`)
      try {
        await initPixiApp(app, container)
      } catch (err) {
        const msg = (err as Error).message || String(err)
        if (!cancelled) setInitError(`PixiJS init failed: ${msg}`)
        logger.error('[MapCanvas] PixiJS init failed:', err)
        return
      }
      if (cancelled) {
        try {
          app.destroy(true, { children: true })
        } catch {
          /* */
        }
        return
      }
      logger.debug('[MapCanvas] PixiJS initialized successfully')
      container.appendChild(app.canvas)
      const layers: MapLayers = createMapLayers(app)
      worldRef.current = layers.world
      gridGraphicsRef.current = layers.gridGraphics
      terrainOverlayRef.current = layers.terrainOverlay
      moveOverlayRef.current = layers.moveOverlay
      aoeOverlayRef.current = layers.aoeOverlay
      tokenContainerRef.current = layers.tokenContainer
      fogGraphicsRef.current = layers.fogGraphics
      lightingGraphicsRef.current = layers.lightingGraphics
      wallGraphicsRef.current = layers.wallGraphics
      measureGraphicsRef.current = layers.measureGraphics
      weatherOverlayRef.current = layers.weatherOverlay
      setInitialized(true)
      setInitError(null)
    }
    initApp()
    return () => {
      cancelled = true
      if (weatherOverlayRef.current) {
        weatherOverlayRef.current.destroy()
        weatherOverlayRef.current = null
      }
      destroyFogAnimation()
      try {
        app.destroy(true, { children: true })
      } catch {
        /* */
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
      if (bgSpriteRef.current) {
        worldRef.current?.removeChild(bgSpriteRef.current)
        bgSpriteRef.current.destroy({ children: true, texture: true })
        bgSpriteRef.current = null
      }
      if (!map?.imagePath) return
      try {
        const resolvedUrl = new URL(map.imagePath, window.location.href).href
        logger.debug('[MapCanvas] Loading background image:', resolvedUrl)
        const texture = await Assets.load(map.imagePath)
        if (texture.source) texture.source.scaleMode = 'nearest'
        const sprite = new Sprite(texture)
        sprite.label = 'bg'
        worldRef.current?.addChildAt(sprite, 0)
        bgSpriteRef.current = sprite
        setBgLoadError(null)
        const container = containerRef.current
        if (container && sprite.texture.width > 0) {
          const cw = container.clientWidth,
            ch = container.clientHeight
          const mw = sprite.texture.width,
            mh = sprite.texture.height
          const scale = Math.min(cw / mw, ch / mh, 1)
          zoomRef.current = scale
          panRef.current = { x: (cw - mw * scale) / 2, y: (ch - mh * scale) / 2 }
          applyTransform()
        }
      } catch (err) {
        const msg = `Failed to load map image: ${map.imagePath}`
        logger.warn('[MapCanvas]', msg, err)
        setBgLoadError(msg)
      }
    }
    loadBg()
  }, [initialized, map?.imagePath, applyTransform])

  // Clear stale drag/measurement state when tool changes
  useEffect(() => {
    dragRef.current = null
    measureStartRef.current = null
    isFogPaintingRef.current = false
    lastFogCellRef.current = null
  }, [activeTool])

  // All overlay rendering effects (grid, fog, walls, lighting, terrain, AoE, movement, weather)
  useMapOverlayEffects({
    initialized,
    map,
    isHost,
    selectedTokenId,
    isInitiativeMode,
    turnState,
    activeAoE,
    applyTransform,
    refs: {
      containerRef,
      appRef,
      gridGraphicsRef,
      fogGraphicsRef,
      wallGraphicsRef,
      lightingGraphicsRef,
      terrainOverlayRef,
      aoeOverlayRef,
      moveOverlayRef,
      weatherOverlayRef,
      bgSpriteRef,
      zoomRef,
      panRef
    }
  })

  // Render tokens (diff-based)
  const hpBarsVisibility = useGameStore((s) => s.hpBarsVisibility)

  const renderTokens = useCallback(() => {
    if (!tokenContainerRef.current || !map) return
    const container = tokenContainerRef.current
    const cache = tokenSpriteMapRef.current
    const showHpBar = hpBarsVisibility === 'all' || (hpBarsVisibility === 'dm-only' && isHost)
    const visibleTokenIds = new Set<string>()

    for (const token of map.tokens) {
      if (!isHost && !token.visibleToPlayers) continue
      visibleTokenIds.add(token.id)
      const isSelected = token.id === selectedTokenId
      const isActive = !!activeEntityId && token.entityId === activeEntityId
      const key = `${token.gridX},${token.gridY},${isSelected},${isActive},${token.label},${token.color ?? ''},${token.currentHP ?? ''},${token.maxHP ?? ''},${showHpBar},${token.sizeX ?? 1},${token.sizeY ?? 1},${(token.conditions ?? []).join(',')}`
      const cached = cache.get(token.id)
      if (cached && cached.key === key) continue
      if (cached) {
        container.removeChild(cached.sprite)
        cached.sprite.destroy({ children: true })
      }
      const sprite = createTokenSprite(token, map.grid.cellSize, isSelected, isActive, showHpBar)
      sprite.label = `token-${token.id}`
      sprite.on('pointerdown', (e) => {
        if (activeTool !== 'select') return
        if (e.button === 2) return
        e.stopPropagation()
        onTokenSelect(token.id)
        if (!isHost && token.entityType !== 'player') return
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
      sprite.on('rightclick', (e) => {
        e.stopPropagation()
        if (!onTokenContextMenu || !map) return
        const canvas = containerRef.current?.querySelector('canvas')
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        onTokenContextMenu(e.global.x + rect.left, e.global.y + rect.top, token, map.id)
      })
      container.addChild(sprite)
      cache.set(token.id, { sprite, key })
    }
    for (const [tokenId, entry] of cache) {
      if (!visibleTokenIds.has(tokenId)) {
        container.removeChild(entry.sprite)
        entry.sprite.destroy({ children: true })
        cache.delete(tokenId)
      }
    }
  }, [map, selectedTokenId, isHost, activeTool, onTokenSelect, activeEntityId, onTokenContextMenu, hpBarsVisibility])

  useEffect(() => {
    if (initialized) renderTokens()
  }, [initialized, renderTokens])

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    return createWheelHandler({ zoom: zoomRef, pan: panRef }, applyTransform)(el)
  }, [applyTransform])

  // Keyboard pan
  const keysHeldRef = useRef(new Set<string>())
  const panAnimRef = useRef<number>(0)
  useEffect(() => {
    return setupKeyboardPan({ spaceHeld: spaceHeldRef, pan: panRef }, keysHeldRef, panAnimRef, applyTransform)
  }, [applyTransform])

  // Mouse events
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const eventRefs: MapEventRefs = {
      zoom: zoomRef,
      pan: panRef,
      isPanning: isPanningRef,
      panStart: panStartRef,
      spaceHeld: spaceHeldRef,
      drag: dragRef,
      isFogPainting: isFogPaintingRef,
      lastFogCell: lastFogCellRef,
      measureStart: measureStartRef,
      wallStart: wallStartRef,
      ghost: ghostRef,
      world: worldRef,
      tokenContainer: tokenContainerRef,
      measureGraphics: measureGraphicsRef,
      wallGraphics: wallGraphicsRef
    }
    return setupMouseHandlers(el, {
      refs: eventRefs,
      map,
      activeTool,
      isInitiativeMode,
      turnState,
      applyTransform,
      onTokenMove,
      onTokenSelect,
      onCellClick,
      onWallPlace,
      renderTokens
    })
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

  // Clear measurement when tool changes
  useEffect(() => {
    if (activeTool !== 'measure' && measureGraphicsRef.current) {
      clearMeasurement(measureGraphicsRef.current)
      measureStartRef.current = null
    }
  }, [activeTool])

  // Center map on entity
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
    const rect = containerRef.current.getBoundingClientRect()
    panRef.current = {
      x: rect.width / 2 - (token.gridX * cellSize + cellSize / 2) * zoomRef.current,
      y: rect.height / 2 - (token.gridY * cellSize + cellSize / 2) * zoomRef.current
    }
    applyTransform()
    clearCenterRequest()
  }, [centerOnEntityId, map, applyTransform, clearCenterRequest])

  const pendingPlacement = useGameStore((s) => s.pendingPlacement)
  const handleResetView = useCallback((): void => {
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    applyTransform()
  }, [applyTransform])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Home') {
        e.preventDefault()
        handleResetView()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleResetView])

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-gray-900 ${pendingPlacement ? 'cursor-crosshair' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={containerRef} className="w-full h-full" />
      {map && (
        <button
          onClick={handleResetView}
          title="Reset View (Home)"
          className="absolute bottom-3 right-3 z-20 px-3 py-1.5 text-xs font-medium
            bg-gray-800/90 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200
            hover:bg-gray-700 transition-colors cursor-pointer backdrop-blur-sm"
        >
          Reset View
        </button>
      )}
      {pendingPlacement && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-cyan-500/60 rounded-lg px-4 py-2 text-xs text-cyan-300 pointer-events-none">
          Click to place <span className="font-semibold">{pendingPlacement.tokenData.label ?? 'token'}</span>. Press{' '}
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200">Esc</kbd> to cancel.
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
