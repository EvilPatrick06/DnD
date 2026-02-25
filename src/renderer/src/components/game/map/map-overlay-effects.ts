import type { Application, Graphics } from 'pixi.js'
import { useEffect } from 'react'
import { LIGHT_SOURCES } from '../../../data/light-sources'
import { useGameStore } from '../../../stores/use-game-store'
import type { TurnState } from '../../../types/game-state'
import type { GameMap } from '../../../types/map'
import { type AoEConfig, clearAoEOverlay, drawAoEOverlay } from './aoe-overlay'
import { destroyFogAnimation, drawFogOfWar, initFogAnimation } from './fog-overlay'
import { drawGrid } from './grid-layer'
import { drawLightingOverlay, type LightingConfig } from './lighting-overlay'
import { clearMovementOverlay, drawMovementOverlay, drawTerrainOverlay } from './movement-overlay'
import { drawWalls } from './wall-layer'
import { presetToWeatherType, type WeatherOverlayLayer } from './weather-overlay'

/** Refs passed into the overlay effects hook */
export interface OverlayRefs {
  containerRef: React.RefObject<HTMLDivElement | null>
  appRef: React.RefObject<Application | null>
  gridGraphicsRef: React.RefObject<Graphics | null>
  fogGraphicsRef: React.RefObject<Graphics | null>
  wallGraphicsRef: React.RefObject<Graphics | null>
  lightingGraphicsRef: React.RefObject<Graphics | null>
  terrainOverlayRef: React.RefObject<Graphics | null>
  aoeOverlayRef: React.RefObject<Graphics | null>
  moveOverlayRef: React.RefObject<Graphics | null>
  weatherOverlayRef: React.RefObject<WeatherOverlayLayer | null>
  bgSpriteRef: React.RefObject<import('pixi.js').Sprite | null>
  zoomRef: React.MutableRefObject<number>
  panRef: React.MutableRefObject<{ x: number; y: number }>
}

interface OverlayEffectsOptions {
  initialized: boolean
  map: GameMap | null
  isHost: boolean
  selectedTokenId: string | null
  isInitiativeMode?: boolean
  turnState?: TurnState | null
  activeAoE?: AoEConfig | null
  applyTransform: () => void
  refs: OverlayRefs
}

/**
 * Hook that drives all map overlay rendering effects:
 * grid, fog animation, fog draw, walls, lighting, terrain, AoE, movement, weather.
 */
export function useMapOverlayEffects(opts: OverlayEffectsOptions): void {
  const { initialized, map, isHost, selectedTokenId, isInitiativeMode, turnState, activeAoE, applyTransform, refs } =
    opts

  // Draw grid
  useEffect(() => {
    if (!initialized || !refs.gridGraphicsRef.current || !map) return
    drawGrid(refs.gridGraphicsRef.current, map.grid, map.width, map.height)

    if (!map.imagePath && !refs.bgSpriteRef.current) {
      const container = refs.containerRef.current
      if (container) {
        const cw = container.clientWidth
        const ch = container.clientHeight
        const scale = Math.min(cw / map.width, ch / map.height, 1)
        refs.zoomRef.current = scale
        refs.panRef.current = {
          x: (cw - map.width * scale) / 2,
          y: (ch - map.height * scale) / 2
        }
        applyTransform()
      }
    }
  }, [initialized, map?.grid, map?.width, map?.height, map?.imagePath, applyTransform, map, refs])

  // Initialize fog animation ticker
  useEffect(() => {
    if (!initialized || !refs.appRef.current || !refs.fogGraphicsRef.current || !map) return
    initFogAnimation(refs.appRef.current, refs.fogGraphicsRef.current, map.grid, map.width, map.height)
    return () => {
      destroyFogAnimation()
    }
  }, [initialized, map?.grid, map?.width, map?.height, refs])

  // Draw fog of war
  useEffect(() => {
    if (!initialized || !refs.fogGraphicsRef.current || !map) return
    refs.fogGraphicsRef.current.alpha = isHost ? 0.3 : 1
    drawFogOfWar(refs.fogGraphicsRef.current, map.fogOfWar, map.grid, map.width, map.height)
  }, [initialized, map?.fogOfWar, map?.grid, map?.width, map?.height, isHost, map, refs])

  // Draw walls (DM only)
  useEffect(() => {
    if (!initialized || !refs.wallGraphicsRef.current || !map) return
    const walls = map.wallSegments ?? []
    if (isHost && walls.length > 0) {
      drawWalls(refs.wallGraphicsRef.current, walls, map.grid, isHost)
    } else {
      refs.wallGraphicsRef.current.clear()
    }
  }, [initialized, map?.wallSegments, map?.grid, isHost, map, refs])

  // Draw lighting overlay
  useEffect(() => {
    if (!initialized || !refs.lightingGraphicsRef.current || !map) return
    const ambientLight = useGameStore.getState().ambientLight
    const activeLightSources = useGameStore.getState().activeLightSources
    const walls = map.wallSegments ?? []

    if (walls.length === 0 && ambientLight === 'bright') {
      refs.lightingGraphicsRef.current.clear()
      return
    }

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

    const viewerToken = !isHost ? (tokens.find((t) => t.entityType === 'player') ?? null) : null
    const config: LightingConfig = {
      ambientLight,
      darkvisionRange: viewerToken?.darkvision ? 12 : undefined
    }
    drawLightingOverlay(refs.lightingGraphicsRef.current, map, viewerToken, lightSources, config, isHost)
  }, [initialized, map, isHost, refs])

  // Draw terrain overlay
  useEffect(() => {
    if (!initialized || !refs.terrainOverlayRef.current || !map) return
    const terrain = map.terrain ?? []
    if (terrain.length > 0) {
      drawTerrainOverlay(refs.terrainOverlayRef.current, terrain, map.grid.cellSize)
    } else {
      refs.terrainOverlayRef.current.clear()
    }
  }, [initialized, map?.terrain, map?.grid.cellSize, map, refs])

  // Draw AoE overlay
  useEffect(() => {
    if (!initialized || !refs.aoeOverlayRef.current || !map) return
    if (activeAoE) {
      drawAoEOverlay(refs.aoeOverlayRef.current, activeAoE, map.grid.cellSize)
    } else {
      clearAoEOverlay(refs.aoeOverlayRef.current)
    }
  }, [initialized, activeAoE, map?.grid.cellSize, map, refs])

  // Draw movement overlay when a token is selected during initiative
  useEffect(() => {
    if (!initialized || !refs.moveOverlayRef.current || !map) return
    if (!isInitiativeMode || !selectedTokenId || !turnState) {
      clearMovementOverlay(refs.moveOverlayRef.current)
      return
    }
    const token = map.tokens.find((t) => t.id === selectedTokenId)
    if (!token) {
      clearMovementOverlay(refs.moveOverlayRef.current)
      return
    }
    const gridWidth = Math.ceil(map.width / map.grid.cellSize)
    const gridHeight = Math.ceil(map.height / map.grid.cellSize)
    drawMovementOverlay(
      refs.moveOverlayRef.current,
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
    turnState,
    refs
  ])

  // Weather overlay
  const weatherOverride = useGameStore((s) => s.weatherOverride)
  const showWeatherOverlay = useGameStore((s) => s.showWeatherOverlay)

  useEffect(() => {
    if (!initialized || !refs.weatherOverlayRef.current) return
    if (!showWeatherOverlay) {
      refs.weatherOverlayRef.current.setWeather(null)
      return
    }
    const weatherType = presetToWeatherType(weatherOverride?.preset)
    refs.weatherOverlayRef.current.setWeather(weatherType)
  }, [initialized, weatherOverride?.preset, showWeatherOverlay, refs])
}
