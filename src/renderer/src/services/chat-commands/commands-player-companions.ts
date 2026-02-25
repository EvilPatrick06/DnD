import { useGameStore } from '../../stores/use-game-store'
import type { MapToken } from '../../types/map'
import { getLatestCharacter } from './helpers'
import type { ChatCommand } from './types'

export const commands: ChatCommand[] = [
  {
    name: 'wildshape',
    aliases: ['ws'],
    category: 'player',
    dmOnly: false,
    description: 'Transform into beast form or revert',
    usage: '/wildshape <beast-name> or /wildshape off',
    execute: (_args, context) => {
      if (!context.character) return { type: 'error', content: 'No active character.' }
      const char = getLatestCharacter(context.character.id)
      if (!char) return { type: 'error', content: 'No active character.' }

      const rawArgs = _args.trim()
      if (!rawArgs) {
        return { type: 'error', content: 'Usage: /wildshape <beast-name> or /wildshape off' }
      }

      const gameState = useGameStore.getState()

      if (rawArgs.toLowerCase() === 'off' || rawArgs.toLowerCase() === 'revert') {
        const existing = (gameState.conditions ?? []).find(
          (c) => c.entityId === char.id && c.condition.toLowerCase().startsWith('wild shape')
        )
        if (existing) {
          gameState.removeCondition(existing.id)
          return { type: 'broadcast', content: `${char.name} reverts from wild shape.` }
        }
        return { type: 'system', content: 'Not currently in wild shape.' }
      }

      // Drop existing wild shape first
      const existing = (gameState.conditions ?? []).find(
        (c) => c.entityId === char.id && c.condition.toLowerCase().startsWith('wild shape')
      )
      if (existing) {
        gameState.removeCondition(existing.id)
      }

      const conditionName = `Wild Shape: ${rawArgs}`
      gameState.addCondition({
        id: crypto.randomUUID(),
        entityId: char.id,
        entityName: char.name,
        condition: conditionName,
        duration: 'permanent',
        source: 'command',
        appliedRound: gameState.round
      })

      return { type: 'broadcast', content: `${char.name} wild shapes into a ${rawArgs}!` }
    }
  },
  {
    name: 'familiar',
    aliases: [],
    category: 'player',
    dmOnly: false,
    description: 'Summon or dismiss a familiar',
    usage: '/familiar <type> or /familiar dismiss',
    execute: (_args, context) => {
      if (!context.character) return { type: 'error', content: 'No active character.' }
      const char = getLatestCharacter(context.character.id)
      if (!char) return { type: 'error', content: 'No active character.' }

      const rawArgs = _args.trim()
      if (!rawArgs) {
        return { type: 'error', content: 'Usage: /familiar <type> or /familiar dismiss' }
      }

      const gameState = useGameStore.getState()

      if (rawArgs.toLowerCase() === 'dismiss') {
        const existing = (gameState.conditions ?? []).find(
          (c) => c.entityId === char.id && c.condition.toLowerCase().startsWith('familiar')
        )
        if (existing) {
          gameState.removeCondition(existing.id)
          return { type: 'broadcast', content: `${char.name} dismisses their familiar.` }
        }
        return { type: 'system', content: 'No familiar to dismiss.' }
      }

      // Drop existing familiar first
      const existing = (gameState.conditions ?? []).find(
        (c) => c.entityId === char.id && c.condition.toLowerCase().startsWith('familiar')
      )
      if (existing) {
        gameState.removeCondition(existing.id)
      }

      const conditionName = `Familiar: ${rawArgs}`
      gameState.addCondition({
        id: crypto.randomUUID(),
        entityId: char.id,
        entityName: char.name,
        condition: conditionName,
        duration: 'permanent',
        source: 'command',
        appliedRound: gameState.round
      })

      return { type: 'broadcast', content: `${char.name} summons a ${rawArgs} familiar!` }
    }
  },
  {
    name: 'steed',
    aliases: [],
    category: 'player',
    dmOnly: false,
    description: 'Summon or dismiss a phantom steed',
    usage: '/steed or /steed dismiss',
    execute: (_args, context) => {
      if (!context.character) return { type: 'error', content: 'No active character.' }
      const char = getLatestCharacter(context.character.id)
      if (!char) return { type: 'error', content: 'No active character.' }

      const rawArgs = _args.trim()
      const gameState = useGameStore.getState()

      if (rawArgs.toLowerCase() === 'dismiss') {
        const existing = (gameState.conditions ?? []).find(
          (c) => c.entityId === char.id && c.condition.toLowerCase().includes('steed')
        )
        if (existing) {
          gameState.removeCondition(existing.id)
          return { type: 'broadcast', content: `${char.name} dismisses their steed.` }
        }
        return { type: 'system', content: 'No steed to dismiss.' }
      }

      // Drop existing steed first
      const existing = (gameState.conditions ?? []).find(
        (c) => c.entityId === char.id && c.condition.toLowerCase().includes('steed')
      )
      if (existing) {
        gameState.removeCondition(existing.id)
      }

      const conditionName = 'Phantom Steed'
      gameState.addCondition({
        id: crypto.randomUUID(),
        entityId: char.id,
        entityName: char.name,
        condition: conditionName,
        duration: 'permanent',
        source: 'command',
        appliedRound: gameState.round
      })

      return { type: 'broadcast', content: `${char.name} summons a spectral steed!` }
    }
  },
  {
    name: 'companions',
    aliases: ['comp'],
    category: 'player',
    dmOnly: false,
    description: 'List active companions',
    usage: '/companions',
    execute: (_args, context) => {
      if (!context.character) return { type: 'error', content: 'No active character.' }
      const char = getLatestCharacter(context.character.id)
      if (!char) return { type: 'error', content: 'No active companions on the map.' }

      const gameState = useGameStore.getState()
      const activeMap = gameState.maps.find((m) => m.id === gameState.activeMapId)
      const tokens: MapToken[] = activeMap?.tokens ?? []

      const companionTokens = tokens.filter((t: MapToken) => t.ownerEntityId === char.id && t.id !== char.id)

      if (companionTokens.length === 0) {
        return { type: 'system', content: 'No active companions on the map.' }
      }

      const lines = ['**Active Companions**']
      for (const token of companionTokens) {
        const name = token.label ?? token.id
        const hp = token.currentHP ?? '?'
        const maxHp = token.maxHP ?? '?'
        const type = token.companionType ?? 'companion'
        const pos = `(${token.gridX}, ${token.gridY})`
        lines.push(`- **${name}** [${type}] — HP: ${hp}/${maxHp} — Position: ${pos}`)
      }

      return { type: 'system', content: lines.join('\n') }
    }
  }
]
