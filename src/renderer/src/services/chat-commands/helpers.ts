import { trigger3dDice } from '../../components/game/dice3d'
import {
  parseFormula as parseFormulaSvc,
  rollMultiple,
  rollSingle as rollSingleSvc
} from '../dice/dice-service'
import { useCharacterStore } from '../../stores/useCharacterStore'
import { useGameStore } from '../../stores/useGameStore'
import { useLobbyStore } from '../../stores/useLobbyStore'
import { useNetworkStore } from '../../stores/useNetworkStore'
import { is5eCharacter } from '../../types/character'
import type { Character5e } from '../../types/character-5e'

// ─── Dice helpers (delegate to dice-service) ──────────────────

export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } | null {
  return parseFormulaSvc(formula)
}

export function rollDice(count: number, sides: number): number[] {
  return rollMultiple(count, sides)
}

/** Roll dice from a parsed formula object, returns rolls array and total */
export function rollDiceFormula(formula: { count: number; sides: number; modifier: number }): {
  rolls: number[]
  total: number
} {
  const rolls = rollMultiple(formula.count, formula.sides)
  const total = rolls.reduce((sum, r) => sum + r, 0) + formula.modifier
  return { rolls, total }
}

export function rollSingle(sides: number): number {
  return rollSingleSvc(sides)
}

/** Track the last roll result for /reroll */
let _lastRoll: { formula: string; rolls: number[]; total: number; rollerName: string } | null = null

export function getLastRoll() {
  return _lastRoll
}
export function setLastRoll(roll: typeof _lastRoll) {
  _lastRoll = roll
}

export function broadcastDiceResult(formula: string, rolls: number[], total: number, rollerName: string): void {
  const { sendMessage } = useNetworkStore.getState()
  const { addChatMessage } = useLobbyStore.getState()
  const localPeerId = useNetworkStore.getState().localPeerId

  _lastRoll = { formula, rolls, total, rollerName }

  addChatMessage({
    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    senderId: localPeerId || 'local',
    senderName: rollerName,
    content: `rolled ${formula}`,
    timestamp: Date.now(),
    isSystem: false,
    isDiceRoll: true,
    diceResult: { formula, rolls, total }
  })

  sendMessage('game:dice-result', {
    formula,
    rolls,
    total,
    isCritical: false,
    isFumble: false,
    rollerName
  })

  // Trigger 3D dice animation
  trigger3dDice({ formula, rolls, total, rollerName })
}

// ─── Character helpers ────────────────────────────────────────

export function saveAndBroadcastCharacter(updated: Character5e): void {
  useCharacterStore.getState().saveCharacter(updated)
  const activeMapId = useGameStore.getState().activeMapId
  const maps = useGameStore.getState().maps
  const activeMap = maps.find((m) => m.id === activeMapId)
  if (activeMap) {
    const token = activeMap.tokens.find((t) => t.entityId === updated.id)
    if (token) {
      useGameStore.getState().updateToken(activeMap.id, token.id, {
        currentHP: updated.hitPoints.current
      })
    }
  }
  const { role, sendMessage } = useNetworkStore.getState()
  if (role !== 'host') {
    sendMessage('dm:character-update', {
      characterId: updated.id,
      characterData: updated,
      targetPeerId: 'host'
    })
  }
}

export function getLatestCharacter(id: string): Character5e | undefined {
  const char = useCharacterStore.getState().characters.find((c) => c.id === id)
  return char && is5eCharacter(char) ? (char as Character5e) : undefined
}

export function findTokenByName(targetName: string) {
  const { maps, activeMapId } = useGameStore.getState()
  const activeMap = maps.find((m) => m.id === activeMapId)
  return activeMap?.tokens.find((t) => t.label.toLowerCase().startsWith(targetName.toLowerCase()))
}

export function generateMessageId(): string {
  return `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}
