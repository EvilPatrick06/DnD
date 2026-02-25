import { useCallback } from 'react'
import {
  isMoveBlockedByFear,
  type MovementType,
  proneStandUpCost,
  triggersOpportunityAttack
} from '../services/combat/combat-rules'
import { useGameStore } from '../stores/use-game-store'
import type { GameMap } from '../types/map'

interface OaPrompt {
  movingTokenLabel: string
  enemyTokenId: string
  enemyTokenLabel: string
  entityId: string
}

interface ConcCheckPrompt {
  entityId: string
  entityName: string
  spellName: string
  dc: number
  damage: number
}

interface UseTokenMovementOptions {
  activeMap: GameMap | null
  teleportMove: boolean
  addChatMessage: (msg: {
    id: string
    senderId: string
    senderName: string
    content: string
    timestamp: number
    isSystem: boolean
  }) => void
  setOaPrompt: (prompt: OaPrompt | null) => void
  setConcCheckPrompt: (prompt: ConcCheckPrompt | null) => void
}

interface UseTokenMovementReturn {
  handleTokenMoveWithOA: (tokenId: string, gridX: number, gridY: number) => void
  handleConcentrationLost: (casterId: string) => void
}

export function useTokenMovement({
  activeMap,
  teleportMove,
  addChatMessage,
  setOaPrompt,
  setConcCheckPrompt
}: UseTokenMovementOptions): UseTokenMovementReturn {
  const gameStore = useGameStore()

  const handleConcentrationLost = useCallback(
    (casterId: string): void => {
      if (!activeMap) return
      const tokensToRemove = activeMap.tokens.filter(
        (t) => t.companionType === 'summoned' && t.ownerEntityId === casterId
      )
      for (const token of tokensToRemove) {
        gameStore.removeToken(activeMap.id, token.id)
        const initState = gameStore.initiative
        if (initState) {
          const entry = initState.entries.find((e) => e.entityId === token.id)
          if (entry) {
            gameStore.removeFromInitiative(entry.id)
          }
        }
      }
      if (tokensToRemove.length > 0) {
        addChatMessage({
          id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          senderId: 'system',
          senderName: 'System',
          content: `Concentration lost! ${tokensToRemove.map((t) => t.label).join(', ')} disappeared.`,
          timestamp: Date.now(),
          isSystem: true
        })
      }
    },
    [activeMap, gameStore, addChatMessage]
  )

  const handleTokenMoveWithOA = useCallback(
    (tokenId: string, gridX: number, gridY: number): void => {
      if (!activeMap) return

      const movingToken = activeMap.tokens.find((t) => t.id === tokenId)
      if (!movingToken) {
        gameStore.moveToken(activeMap.id, tokenId, gridX, gridY)
        return
      }

      const ts = gameStore.turnStates[movingToken.entityId]
      const isDisengaging = ts?.isDisengaging ?? false
      const moveType: MovementType = teleportMove ? 'teleport' : 'walk'

      // Frightened: cannot move closer to fear source
      if (moveType === 'walk') {
        const entityConditions = gameStore.conditions.filter(
          (c) => c.entityId === movingToken.entityId && c.condition === 'Frightened'
        )
        for (const fc of entityConditions) {
          if (fc.sourceEntityId) {
            const sourceToken = activeMap.tokens.find((t) => t.entityId === fc.sourceEntityId)
            if (
              sourceToken &&
              isMoveBlockedByFear(
                movingToken.gridX,
                movingToken.gridY,
                gridX,
                gridY,
                sourceToken.gridX,
                sourceToken.gridY
              )
            ) {
              addChatMessage({
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                senderId: 'system',
                senderName: 'System',
                content: `${movingToken.label} is Frightened and cannot move closer to ${sourceToken.label}!`,
                timestamp: Date.now(),
                isSystem: true
              })
              return
            }
          }
        }
      }

      if (gameStore.initiative && !isDisengaging) {
        const enemies = activeMap.tokens.filter((t) => t.id !== tokenId && t.entityType !== movingToken.entityType)

        for (const enemy of enemies) {
          if (triggersOpportunityAttack(movingToken, enemy, gridX, gridY, moveType)) {
            const enemyTs = gameStore.turnStates[enemy.entityId]
            if (!enemyTs || !enemyTs.reactionUsed) {
              setOaPrompt({
                movingTokenLabel: movingToken.label,
                enemyTokenId: enemy.id,
                enemyTokenLabel: enemy.label,
                entityId: enemy.entityId
              })
            }
            break
          }
        }
      }

      // Deduct movement from turn state
      if (ts && moveType !== 'teleport') {
        const isProne = movingToken.conditions.some((c) => c.toLowerCase() === 'prone')
        if (isProne && ts.movementRemaining === ts.movementMax) {
          const standCost = proneStandUpCost(ts.movementMax)
          gameStore.useMovement(movingToken.entityId, standCost)
          const updatedConditions = movingToken.conditions.filter((c) => c.toLowerCase() !== 'prone')
          gameStore.updateToken(activeMap.id, tokenId, { conditions: updatedConditions })
          addChatMessage({
            id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            senderId: 'system',
            senderName: 'System',
            content: `${movingToken.label} stands up from Prone (costs ${standCost} ft of movement)`,
            timestamp: Date.now(),
            isSystem: true
          })
        }

        const dx = Math.abs(gridX - movingToken.gridX)
        const dy = Math.abs(gridY - movingToken.gridY)
        const dist = Math.max(dx, dy) * 5

        const terrain = activeMap.terrain ?? []
        const destTerrain = terrain.find((t) => t.x === gridX && t.y === gridY)
        const actualCost = destTerrain ? dist * destTerrain.movementCost : dist
        gameStore.useMovement(movingToken.entityId, actualCost)
      }

      gameStore.moveToken(activeMap.id, tokenId, gridX, gridY)

      // Mount/rider sync
      if (activeMap) {
        const movedToken = activeMap.tokens.find((t) => t.id === tokenId)
        if (movedToken?.riderId) {
          const riderToken = activeMap.tokens.find((t) => t.entityId === movedToken.riderId)
          if (riderToken) {
            gameStore.moveToken(activeMap.id, riderToken.id, gridX, gridY)
          }
        }
        const entityTs = gameStore.turnStates[movedToken?.entityId ?? '']
        if (entityTs?.mountedOn) {
          const mountTk = activeMap.tokens.find((t) => t.id === entityTs.mountedOn)
          if (mountTk) {
            gameStore.moveToken(activeMap.id, mountTk.id, gridX, gridY)
          }
        }
      }
    },
    [activeMap, gameStore, teleportMove, addChatMessage, setOaPrompt]
  )

  return { handleTokenMoveWithOA, handleConcentrationLost }
}
