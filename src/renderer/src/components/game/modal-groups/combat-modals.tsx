import { lazy, Suspense } from 'react'
import type { MessageType } from '../../../network/types'
import { useGameStore } from '../../../stores/use-game-store'
import type { ChatMessage } from '../../../stores/use-lobby-store'
import type { Character } from '../../../types/character'
import type { GameMap } from '../../../types/map'
import type { ActiveModal } from '../GameModalDispatcher'

const ActionModal = lazy(() => import('../modals/combat/ActionModal'))
const HiddenDiceModal = lazy(() => import('../modals/combat/HiddenDiceModal'))
const AttackModal = lazy(() => import('../modals/combat/AttackModal'))
const JumpModal = lazy(() => import('../modals/combat/JumpModal'))
const FallingDamageModal = lazy(() => import('../modals/combat/FallingDamageModal'))
const QuickConditionModal = lazy(() => import('../modals/combat/QuickConditionModal'))
const CustomEffectModal = lazy(() => import('../modals/combat/CustomEffectModal'))
const ChaseTrackerModal = lazy(() => import('../modals/combat/ChaseTrackerModal'))
const MobCalculatorModal = lazy(() => import('../modals/combat/MobCalculatorModal'))
const GroupRollModal = lazy(() => import('../modals/combat/GroupRollModal'))

interface CombatModalsProps {
  activeModal: ActiveModal
  close: () => void
  effectiveIsDM: boolean
  character: Character | null
  playerName: string
  isMyTurn: boolean
  handleAction: (action: string) => void
  activeMap: GameMap | null
  broadcast: (message: string) => void
  addChatMessage: (msg: ChatMessage) => void
  sendMessage: (type: MessageType, payload: unknown) => void
  setConcCheckPrompt: (
    prompt: {
      entityId: string
      entityName: string
      spellName: string
      dc: number
      damage: number
    } | null
  ) => void
}

export default function CombatModals({
  activeModal,
  close,
  effectiveIsDM,
  character,
  playerName,
  isMyTurn,
  handleAction,
  activeMap,
  broadcast,
  addChatMessage,
  sendMessage,
  setConcCheckPrompt
}: CombatModalsProps): JSX.Element {
  const gameStore = useGameStore()

  return (
    <Suspense fallback={null}>
      {activeModal === 'action' && (
        <ActionModal isMyTurn={isMyTurn} playerName={playerName} onAction={handleAction} onClose={close} />
      )}
      {activeModal === 'hiddenDice' && effectiveIsDM && <HiddenDiceModal onClose={close} />}
      {activeModal === 'quickCondition' && <QuickConditionModal onClose={close} />}
      {activeModal === 'attack' && (
        <AttackModal
          character={character}
          tokens={activeMap?.tokens ?? []}
          attackerToken={character ? (activeMap?.tokens.find((t) => t.entityId === character.id) ?? null) : null}
          onClose={close}
          onApplyDamage={(targetTokenId, damage, _damageType, damageAppResult) => {
            if (!activeMap) return
            const target = activeMap.tokens.find((t) => t.id === targetTokenId)
            if (target && target.currentHP != null) {
              const effectiveDmg = damageAppResult?.effectiveDamage ?? damage
              const newHP = Math.max(0, target.currentHP - effectiveDmg)
              gameStore.updateToken(activeMap.id, targetTokenId, { currentHP: newHP })

              const targetTs = gameStore.turnStates[target.entityId]
              if (targetTs?.concentratingSpell && effectiveDmg > 0) {
                const dc = Math.min(30, Math.max(10, Math.floor(effectiveDmg / 2)))
                setConcCheckPrompt({
                  entityId: target.entityId,
                  entityName: target.label,
                  spellName: targetTs.concentratingSpell,
                  dc,
                  damage: effectiveDmg
                })
              }
            }
          }}
          onBroadcastResult={broadcast}
        />
      )}
      {activeModal === 'jump' && character && (
        <JumpModal
          character={character}
          movementRemaining={character ? (gameStore.turnStates[character.id]?.movementRemaining ?? 30) : 30}
          onClose={close}
          onBroadcastResult={broadcast}
        />
      )}
      {activeModal === 'falling' && (
        <FallingDamageModal
          tokens={activeMap?.tokens ?? []}
          onClose={close}
          onApplyDamage={(targetTokenId, damage) => {
            if (!activeMap) return
            const target = activeMap.tokens.find((t) => t.id === targetTokenId)
            if (target && target.currentHP != null) {
              const newHP = Math.max(0, target.currentHP - damage)
              gameStore.updateToken(activeMap.id, targetTokenId, { currentHP: newHP })
            }
          }}
          onBroadcastResult={broadcast}
        />
      )}
      {activeModal === 'customEffect' && effectiveIsDM && activeMap && (
        <CustomEffectModal
          tokens={activeMap.tokens}
          onClose={close}
          onBroadcast={(msg) => {
            addChatMessage({
              id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
              senderId: 'system',
              senderName: 'System',
              content: msg,
              timestamp: Date.now(),
              isSystem: true
            })
            sendMessage('chat:message', { message: msg, isSystem: true, senderName: 'System' })
          }}
        />
      )}
      {activeModal === 'chaseTracker' && effectiveIsDM && (
        <ChaseTrackerModal onClose={close} onBroadcastResult={broadcast} />
      )}
      {activeModal === 'mobCalculator' && effectiveIsDM && (
        <MobCalculatorModal onClose={close} onBroadcastResult={broadcast} />
      )}
      {activeModal === 'groupRoll' && (
        <GroupRollModal isDM={effectiveIsDM} onClose={close} onBroadcastResult={broadcast} />
      )}
    </Suspense>
  )
}
