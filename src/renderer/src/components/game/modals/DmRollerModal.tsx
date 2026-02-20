import { useCallback, useState } from 'react'
import { trigger3dDice } from '../../../components/game/dice3d'
import { rollMultiple, rollSingle } from '../../../services/dice-service'
import { load5eMonsterById } from '../../../services/data-provider'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import { is5eCharacter } from '../../../types/character'
import type { Character5e } from '../../../types/character-5e'
import { type AbilityName, abilityModifier as charAbilityMod, formatMod } from '../../../types/character-common'
import type { MonsterAction, MonsterStatBlock } from '../../../types/monster'
import { abilityModifier as monsterAbilityMod } from '../../../types/monster'
import { rollDice } from '../../../utils/dice-utils'

interface DmRollerModalProps {
  onClose: () => void
  onMinimize?: () => void
  onRestore?: () => void
}

interface RollResult {
  id: string
  entityName: string
  label: string
  roll: number
  modifier: number
  total: number
  formula: string
  timestamp: number
}

type EntityType = 'pc' | 'enemy' | 'ally'

interface EntityOption {
  id: string
  name: string
  type: EntityType
  characterData?: Character5e
  monsterData?: MonsterStatBlock
}

const _ABILITY_SHORT: Record<string, AbilityName> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma'
}

interface QuickRollResult {
  id: string
  formula: string
  rolls: number[]
  total: number
  label: string
  hidden: boolean
  timestamp: number
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

export default function DmRollerModal({ onClose, onMinimize, onRestore }: DmRollerModalProps): JSX.Element {
  const [minimized, setMinimized] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [rollResults, setRollResults] = useState<RollResult[]>([])
  const [loadedMonsters, setLoadedMonsters] = useState<Record<string, MonsterStatBlock>>({})
  const [quickExpression, setQuickExpression] = useState('')
  const [quickCount, setQuickCount] = useState(1)
  const [quickHiddenDefault, setQuickHiddenDefault] = useState(true)
  const [quickResults, setQuickResults] = useState<QuickRollResult[]>([])
  const [quickLabel, setQuickLabel] = useState('')

  const activeMapId = useGameStore((s) => s.activeMapId)
  const maps = useGameStore((s) => s.maps)
  const activeMap = maps.find((m) => m.id === activeMapId)
  const characters = useCharacterStore((s) => s.characters)
  const remoteCharacters = useLobbyStore((s) => s.remoteCharacters)
  const addChatMessage = useLobbyStore((s) => s.addChatMessage)

  // Build entity list
  const entities: EntityOption[] = []

  // PCs from characters in current campaign
  for (const c of characters) {
    if (is5eCharacter(c)) {
      entities.push({ id: c.id, name: c.name, type: 'pc', characterData: c })
    }
  }
  for (const [id, c] of Object.entries(remoteCharacters)) {
    if (is5eCharacter(c) && !entities.find((e) => e.id === id)) {
      entities.push({ id, name: c.name, type: 'pc', characterData: c as Character5e })
    }
  }

  // Tokens from the map
  if (activeMap) {
    for (const token of activeMap.tokens) {
      if (entities.find((e) => e.id === token.entityId)) continue
      const type: EntityType = token.entityType === 'enemy' ? 'enemy' : 'ally'
      entities.push({ id: token.entityId, name: token.label, type, monsterData: undefined })
    }
  }

  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null

  // Load monster stat block on demand
  const loadMonster = useCallback(
    async (entityId: string) => {
      if (loadedMonsters[entityId]) return
      const token = activeMap?.tokens.find((t) => t.entityId === entityId)
      if (!token?.monsterStatBlockId) return
      const monster = await load5eMonsterById(token.monsterStatBlockId)
      if (monster) {
        setLoadedMonsters((prev) => ({ ...prev, [entityId]: monster }))
      }
    },
    [activeMap, loadedMonsters]
  )

  const handleSelectEntity = (id: string): void => {
    setSelectedEntityId(id)
    const entity = entities.find((e) => e.id === id)
    if (entity && !entity.characterData && !loadedMonsters[id]) {
      loadMonster(id)
    }
  }

  // Temporarily minimize modal so 3D dice are visible, then restore
  const autoMinimize = useCallback(() => {
    setMinimized(true)
    onMinimize?.()
    setTimeout(() => {
      setMinimized(false)
      onRestore?.()
    }, 3000) // restore after dice animation (~1.5s settle + 1.5s display)
  }, [onMinimize, onRestore])

  // Roll helper
  const doRoll = useCallback((entityName: string, label: string, modifier: number): void => {
    const roll = rollSingle(20)
    const total = roll + modifier
    const formula = `1d20${modifier >= 0 ? '+' : ''}${modifier}`

    // Minimize modal, trigger 3D dice, then restore
    autoMinimize()
    trigger3dDice({ formula, rolls: [roll], total, rollerName: 'DM' })

    setRollResults((prev) =>
      [
        {
          id: `roll-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
          entityName,
          label,
          roll,
          modifier,
          total,
          formula,
          timestamp: Date.now()
        },
        ...prev
      ].slice(0, 50)
    )
  }, [autoMinimize])

  // Roll damage
  const doDamageRoll = useCallback((entityName: string, action: MonsterAction): void => {
    if (!action.damageDice) return
    const match = action.damageDice.match(/^(\d+)d(\d+)([+-]\d+)?$/)
    if (!match) return
    const count = parseInt(match[1], 10)
    const sides = parseInt(match[2], 10)
    const mod = match[3] ? parseInt(match[3], 10) : 0
    const rolls = rollMultiple(count, sides)
    const total = rolls.reduce((s, r) => s + r, 0) + mod

    autoMinimize()
    trigger3dDice({ formula: action.damageDice, rolls, total, rollerName: 'DM' })

    setRollResults((prev) =>
      [
        {
          id: `roll-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
          entityName,
          label: `${action.name} Damage`,
          roll: total,
          modifier: 0,
          total,
          formula: `${action.damageDice} [${rolls.join(',')}]${mod ? ` ${mod >= 0 ? '+' : ''}${mod}` : ''} = ${total} ${action.damageType ?? ''}`,
          timestamp: Date.now()
        },
        ...prev
      ].slice(0, 50)
    )
  }, [autoMinimize])

  const sendMessage = useNetworkStore((s) => s.sendMessage)

  // Reveal to chat + network
  const revealResult = useCallback(
    (result: RollResult) => {
      addChatMessage({
        id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'dm',
        senderName: 'DM',
        content: `${result.entityName} ${result.label}: ${result.formula} = ${result.total}`,
        timestamp: Date.now(),
        isSystem: false,
        isDiceRoll: true,
        diceResult: { formula: result.formula, rolls: [result.roll], total: result.total }
      })

      // Broadcast to players via network
      sendMessage('game:dice-reveal', {
        formula: result.formula,
        rolls: [result.roll],
        total: result.total,
        rollerName: 'DM',
        label: `${result.entityName} ${result.label}`
      })
    },
    [addChatMessage, sendMessage]
  )

  // Quick dice roll
  const handleQuickDie = useCallback(
    (die: string) => {
      const results: QuickRollResult[] = []
      for (let i = 0; i < quickCount; i++) {
        const result = rollDice(`1${die}`)
        if (result) {
          const qrFormula = quickCount > 1 ? `1${die} (#${i + 1})` : `1${die}`
          results.push({
            id: `qr-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
            formula: qrFormula,
            rolls: result.rolls,
            total: result.total,
            label: quickLabel || die,
            hidden: quickHiddenDefault,
            timestamp: Date.now()
          })
          // Always show 3D dice to DM; if hidden, send hidden animation to players
          autoMinimize()
          trigger3dDice({ formula: `1${die}`, rolls: result.rolls, total: result.total, rollerName: 'DM' })
          if (quickHiddenDefault) {
            sendMessage('game:dice-roll-hidden', {
              formula: `1${die}`,
              diceCount: 1,
              dieSides: [parseInt(die.slice(1), 10)],
              rollerName: 'DM'
            })
          }
        }
      }
      setQuickResults((prev) => [...results, ...prev].slice(0, 50))
    },
    [quickCount, quickHiddenDefault, quickLabel, autoMinimize, sendMessage]
  )

  const handleQuickExpression = useCallback(() => {
    const expr = quickExpression.trim()
    if (!expr) return
    const results: QuickRollResult[] = []
    for (let i = 0; i < quickCount; i++) {
      const result = rollDice(expr)
      if (result) {
        results.push({
          id: `qr-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
          formula: quickCount > 1 ? `${expr} (#${i + 1})` : expr,
          rolls: result.rolls,
          total: result.total,
          label: quickLabel || expr,
          hidden: quickHiddenDefault,
          timestamp: Date.now()
        })
        autoMinimize()
        trigger3dDice({ formula: expr, rolls: result.rolls, total: result.total, rollerName: 'DM' })
        if (quickHiddenDefault) {
          // Parse dice sides from expression
          const diceMatch = expr.match(/(\d*)d(\d+)/)
          const sides = diceMatch ? [parseInt(diceMatch[2], 10)] : [20]
          sendMessage('game:dice-roll-hidden', {
            formula: expr,
            diceCount: result.rolls.length,
            dieSides: sides,
            rollerName: 'DM'
          })
        }
      }
    }
    if (results.length > 0) {
      setQuickResults((prev) => [...results, ...prev].slice(0, 50))
    }
  }, [quickExpression, quickCount, quickHiddenDefault, quickLabel, autoMinimize, sendMessage])

  const revealQuickResult = useCallback(
    (qr: QuickRollResult) => {
      addChatMessage({
        id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        senderId: 'dm',
        senderName: 'DM',
        content: `${qr.label}: [${qr.rolls.join(', ')}] = ${qr.total}`,
        timestamp: Date.now(),
        isSystem: false,
        isDiceRoll: true,
        diceResult: { formula: qr.formula, rolls: qr.rolls, total: qr.total }
      })

      // Broadcast to players via network
      sendMessage('game:dice-reveal', {
        formula: qr.formula,
        rolls: qr.rolls,
        total: qr.total,
        rollerName: 'DM',
        label: qr.label
      })
    },
    [addChatMessage, sendMessage]
  )

  // Render stat block for a PC
  const renderPCBlock = (char: Character5e): JSX.Element => {
    const profBonus = Math.floor((char.level - 1) / 4) + 2
    return (
      <div className="space-y-3">
        <div className="text-xs text-gray-400">
          Level {char.level} {char.classes.map((c) => c.name).join('/')} | HP: {char.hitPoints.current}/
          {char.hitPoints.maximum} | AC: {char.armorClass}
        </div>

        {/* Ability Scores */}
        <div className="grid grid-cols-6 gap-1 text-center">
          {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as AbilityName[]).map(
            (ab) => {
              const score = char.abilityScores[ab]
              const mod = charAbilityMod(score)
              return (
                <div key={ab} className="bg-gray-800/50 rounded p-1">
                  <div className="text-[9px] text-gray-500 uppercase">{ab.slice(0, 3)}</div>
                  <div className="text-xs text-gray-200 font-semibold">{score}</div>
                  <button
                    onClick={() => doRoll(char.name, `${ab.slice(0, 3).toUpperCase()} Check`, mod)}
                    className="text-[9px] text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    {formatMod(mod)}
                  </button>
                </div>
              )
            }
          )}
        </div>

        {/* Saves */}
        <div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Saving Throws</div>
          <div className="flex flex-wrap gap-1">
            {(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as AbilityName[]).map(
              (ab) => {
                const mod = charAbilityMod(char.abilityScores[ab])
                const isProficient = char.proficiencies?.savingThrows?.includes(ab) ?? false
                const totalMod = mod + (isProficient ? profBonus : 0)
                return (
                  <button
                    key={ab}
                    onClick={() => doRoll(char.name, `${ab.slice(0, 3).toUpperCase()} Save`, totalMod)}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                      isProficient ? 'bg-amber-600/30 text-amber-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {ab.slice(0, 3).toUpperCase()} {formatMod(totalMod)}
                  </button>
                )
              }
            )}
          </div>
        </div>

        {/* Skills */}
        <div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Skills</div>
          <div className="flex flex-wrap gap-1">
            {(char.skills ?? [])
              .filter((s) => s.proficient || s.expertise)
              .map((skill) => {
                const ab = skill.ability
                const mod = charAbilityMod(char.abilityScores[ab])
                const totalMod = mod + profBonus + (skill.expertise ? profBonus : 0)
                return (
                  <button
                    key={skill.name}
                    onClick={() => doRoll(char.name, `${skill.name}`, totalMod)}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                      skill.expertise ? 'bg-purple-600/30 text-purple-300' : 'bg-amber-600/30 text-amber-300'
                    }`}
                  >
                    {skill.name} {formatMod(totalMod)}
                  </button>
                )
              })}
          </div>
        </div>

        {/* Weapons */}
        {char.weapons.length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Attacks</div>
            <div className="space-y-1">
              {char.weapons.map((w) => (
                <div key={w.id} className="flex items-center gap-2 bg-gray-800/30 rounded px-2 py-1">
                  <span className="text-xs text-gray-200 flex-1">
                    {w.name}: {formatMod(w.attackBonus)} to hit, {w.damage} {w.damageType}
                  </span>
                  <button
                    onClick={() => doRoll(char.name, `${w.name} Attack`, w.attackBonus)}
                    className="text-[9px] px-1.5 py-0.5 bg-red-600/30 text-red-300 rounded cursor-pointer hover:bg-red-600/50"
                  >
                    Attack
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render stat block for a monster
  const renderMonsterBlock = (monster: MonsterStatBlock): JSX.Element => {
    return (
      <div className="space-y-3">
        <div className="text-xs text-gray-400">
          {monster.size} {monster.type}
          {monster.subtype ? ` (${monster.subtype})` : ''} | CR {monster.cr} | HP: {monster.hp} | AC: {monster.ac}
          {monster.acType ? ` (${monster.acType})` : ''}
        </div>

        {/* Ability Scores */}
        <div className="grid grid-cols-6 gap-1 text-center">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ab) => {
            const score = monster.abilityScores[ab]
            const mod = monsterAbilityMod(score)
            return (
              <div key={ab} className="bg-gray-800/50 rounded p-1">
                <div className="text-[9px] text-gray-500 uppercase">{ab}</div>
                <div className="text-xs text-gray-200 font-semibold">{score}</div>
                <button
                  onClick={() => doRoll(monster.name, `${ab.toUpperCase()} Check`, mod)}
                  className="text-[9px] text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  {formatMod(mod)}
                </button>
              </div>
            )
          })}
        </div>

        {/* Saves */}
        {monster.savingThrows && Object.keys(monster.savingThrows).length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Saving Throws</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(monster.savingThrows).map(([ab, mod]) => (
                <button
                  key={ab}
                  onClick={() => doRoll(monster.name, `${ab.toUpperCase()} Save`, mod as number)}
                  className="px-1.5 py-0.5 text-[10px] bg-amber-600/30 text-amber-300 rounded cursor-pointer"
                >
                  {ab.toUpperCase()} {formatMod(mod as number)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {monster.skills && Object.keys(monster.skills).length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Skills</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(monster.skills).map(([skill, mod]) => (
                <button
                  key={skill}
                  onClick={() => doRoll(monster.name, skill, mod)}
                  className="px-1.5 py-0.5 text-[10px] bg-amber-600/30 text-amber-300 rounded cursor-pointer"
                >
                  {skill} {formatMod(mod)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Traits */}
        {monster.traits && monster.traits.length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Traits</div>
            {monster.traits.map((t, i) => (
              <div key={i} className="text-[10px] text-gray-400 mb-1">
                <span className="text-gray-200 font-semibold">{t.name}.</span> {t.description}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Actions</div>
          <div className="space-y-1">
            {monster.actions.map((action, i) => (
              <div key={i} className="bg-gray-800/30 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-200 font-semibold">{action.name}</span>
                  {action.toHit != null && (
                    <>
                      <span className="text-[10px] text-gray-500">{formatMod(action.toHit)} to hit</span>
                      <button
                        onClick={() => doRoll(monster.name, `${action.name} Attack`, action.toHit!)}
                        className="text-[9px] px-1.5 py-0.5 bg-red-600/30 text-red-300 rounded cursor-pointer hover:bg-red-600/50"
                      >
                        Roll Attack
                      </button>
                    </>
                  )}
                  {action.damageDice && (
                    <button
                      onClick={() => doDamageRoll(monster.name, action)}
                      className="text-[9px] px-1.5 py-0.5 bg-orange-600/30 text-orange-300 rounded cursor-pointer hover:bg-orange-600/50"
                    >
                      Roll Damage
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {action.damageDice && `${action.damageDice} ${action.damageType ?? ''}`}
                  {action.reach && ` | Reach ${action.reach}ft`}
                  {action.rangeNormal &&
                    ` | Range ${action.rangeNormal}${action.rangeLong ? `/${action.rangeLong}` : ''}ft`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Actions */}
        {monster.bonusActions && monster.bonusActions.length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Bonus Actions</div>
            {monster.bonusActions.map((ba, i) => (
              <div key={i} className="text-[10px] text-gray-400 mb-1">
                <span className="text-gray-200 font-semibold">{ba.name}.</span> {ba.description}
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {monster.reactions && monster.reactions.length > 0 && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Reactions</div>
            {monster.reactions.map((r, i) => (
              <div key={i} className="text-[10px] text-gray-400 mb-1">
                <span className="text-gray-200 font-semibold">{r.name}.</span> {r.description}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const monsterData = selectedEntity?.monsterData ?? (selectedEntityId ? loadedMonsters[selectedEntityId] : null)

  if (minimized) {
    return <></>
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 max-w-3xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-purple-300">DM Roller</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer" aria-label="Close">
            &times;
          </button>
        </div>

        {/* Quick Roll Section */}
        <div className="border-b border-gray-700/50 pb-3 mb-3 space-y-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider">Quick Roll</div>
          {/* Dice buttons row */}
          <div className="flex items-center gap-1 flex-wrap">
            {QUICK_DICE.map((die) => (
              <button
                key={die}
                onClick={() => handleQuickDie(die)}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-amber-600/40 hover:text-amber-300 transition-colors cursor-pointer border border-gray-700"
              >
                {die}
              </button>
            ))}
          </div>
          {/* Custom expression + count + label */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={quickExpression}
              onChange={(e) => setQuickExpression(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickExpression()
              }}
              placeholder="2d6+3"
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <label className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
              <span>x</span>
              <input
                type="number"
                min={1}
                max={10}
                value={quickCount}
                onChange={(e) => setQuickCount(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                className="w-10 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 text-center focus:outline-none focus:border-amber-500"
              />
            </label>
            <input
              type="text"
              value={quickLabel}
              onChange={(e) => setQuickLabel(e.target.value)}
              placeholder="Label"
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleQuickExpression}
              disabled={!quickExpression.trim()}
              className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Roll
            </button>
          </div>
          {/* Hidden toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={quickHiddenDefault}
                onChange={(e) => setQuickHiddenDefault(e.target.checked)}
                className="rounded accent-purple-500"
              />
              Hidden by default
            </label>
          </div>
          {/* Quick roll results */}
          {quickResults.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {quickResults.map((qr) => (
                <div key={qr.id} className="flex items-center gap-2 bg-gray-800/50 rounded px-2 py-1">
                  <span className="text-[10px] text-gray-400">{qr.formula}:</span>
                  <span className="text-xs text-gray-300">[{qr.rolls.join(', ')}]</span>
                  <span className="text-xs text-amber-300 font-bold">= {qr.total}</span>
                  {qr.label && qr.label !== qr.formula.replace(/ \(#\d+\)$/, '') && (
                    <span className="text-[9px] text-gray-500">({qr.label})</span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <button
                      onClick={() => revealQuickResult(qr)}
                      className="text-[8px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded cursor-pointer hover:bg-green-600/50"
                    >
                      Reveal
                    </button>
                    {qr.hidden && (
                      <span className="text-[8px] px-1 py-0.5 bg-gray-700/50 text-gray-500 rounded">
                        Hidden
                      </span>
                    )}
                  </span>
                </div>
              ))}
              <button
                onClick={() => setQuickResults([])}
                className="text-[9px] text-gray-600 hover:text-red-400 cursor-pointer"
              >
                Clear Quick Rolls
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left: Entity selector + stat block */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Entity dropdown */}
            <select
              value={selectedEntityId ?? ''}
              onChange={(e) => handleSelectEntity(e.target.value)}
              className="w-full mb-3 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="">Select an entity...</option>
              {entities.filter((e) => e.type === 'pc').length > 0 && (
                <optgroup label="PCs">
                  {entities
                    .filter((e) => e.type === 'pc')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {entities.filter((e) => e.type === 'enemy').length > 0 && (
                <optgroup label="Enemies">
                  {entities
                    .filter((e) => e.type === 'enemy')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {entities.filter((e) => e.type === 'ally').length > 0 && (
                <optgroup label="Allies/NPCs">
                  {entities
                    .filter((e) => e.type === 'ally')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            {/* Stat block */}
            <div className="flex-1 overflow-y-auto">
              {!selectedEntity && (
                <p className="text-xs text-gray-500 text-center py-8">
                  Select an entity to view its stat block and roll dice.
                </p>
              )}
              {selectedEntity?.characterData && renderPCBlock(selectedEntity.characterData)}
              {selectedEntity && !selectedEntity.characterData && monsterData && renderMonsterBlock(monsterData)}
              {selectedEntity && !selectedEntity.characterData && !monsterData && (
                <p className="text-xs text-gray-500 text-center py-4">No stat block available for this entity.</p>
              )}
            </div>
          </div>

          {/* Right: Roll results */}
          <div className="w-64 shrink-0 flex flex-col min-h-0 border-l border-gray-700/50 pl-3">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Roll History</div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {rollResults.length === 0 ? (
                <p className="text-[10px] text-gray-600 text-center py-4">No rolls yet</p>
              ) : (
                rollResults.map((r) => (
                  <div key={r.id} className="bg-gray-800/50 rounded p-1.5">
                    <div className="text-[10px] text-gray-300">
                      <span className="text-purple-300 font-semibold">{r.entityName}</span> {r.label}:{' '}
                      <span className="text-amber-300 font-bold">{r.total}</span>
                    </div>
                    <div className="text-[9px] text-gray-500">{r.formula}</div>
                    <div className="flex gap-1 mt-0.5">
                      <button
                        onClick={() => revealResult(r)}
                        className="text-[8px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded cursor-pointer hover:bg-green-600/50"
                      >
                        Reveal
                      </button>
                      <button
                        onClick={() => {
                          // Keep hidden — just acknowledge
                        }}
                        className="text-[8px] px-1 py-0.5 bg-gray-700/50 text-gray-500 rounded cursor-pointer"
                      >
                        Hidden
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {rollResults.length > 0 && (
              <button
                onClick={() => setRollResults([])}
                className="mt-1 text-[9px] text-gray-600 hover:text-red-400 cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
