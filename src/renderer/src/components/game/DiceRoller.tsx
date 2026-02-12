import { useState } from 'react'
import DiceResult from './DiceResult'
import type { GameSystem } from '../../types/game-system'

interface DiceRollerProps {
  system: GameSystem
  rollerName: string
  onRoll?: (result: { formula: string; total: number; rolls: number[] }) => void
}

interface RollResult {
  id: string
  formula: string
  total: number
  rolls: number[]
  rollerName: string
  dieSides: number
  timestamp: number
}

const DICE = [
  { sides: 4, label: 'd4' },
  { sides: 6, label: 'd6' },
  { sides: 8, label: 'd8' },
  { sides: 10, label: 'd10' },
  { sides: 12, label: 'd12' },
  { sides: 20, label: 'd20' },
  { sides: 100, label: 'd100' }
]

function parseDiceFormula(
  formula: string
): { count: number; sides: number; modifier: number } | null {
  const match = formula.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/)
  if (!match) return null
  return {
    count: match[1] ? parseInt(match[1], 10) : 1,
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0
  }
}

function rollDice(count: number, sides: number): number[] {
  const results: number[] = []
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1)
  }
  return results
}

export default function DiceRoller({
  system,
  rollerName,
  onRoll
}: DiceRollerProps): JSX.Element {
  const [modifier, setModifier] = useState(0)
  const [customFormula, setCustomFormula] = useState('')
  const [advantage, setAdvantage] = useState<'normal' | 'advantage' | 'disadvantage'>(
    'normal'
  )
  const [results, setResults] = useState<RollResult[]>([])
  const [animatingId, setAnimatingId] = useState<string | null>(null)

  const addResult = (formula: string, rolls: number[], total: number, sides: number): void => {
    const id = `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const result: RollResult = {
      id,
      formula,
      total,
      rolls,
      rollerName,
      dieSides: sides,
      timestamp: Date.now()
    }
    setResults((prev) => [result, ...prev].slice(0, 20))
    setAnimatingId(id)
    setTimeout(() => setAnimatingId(null), 500)
    onRoll?.({ formula, total, rolls })
  }

  const handleQuickRoll = (sides: number): void => {
    if (sides === 20 && system === 'dnd5e' && advantage !== 'normal') {
      // Roll with advantage/disadvantage
      const roll1 = rollDice(1, 20)
      const roll2 = rollDice(1, 20)
      const allRolls = [...roll1, ...roll2]
      const chosen =
        advantage === 'advantage'
          ? Math.max(roll1[0], roll2[0])
          : Math.min(roll1[0], roll2[0])
      const total = chosen + modifier
      const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : ''
      const advLabel = advantage === 'advantage' ? ' (Adv)' : ' (Dis)'
      addResult(`1d20${modStr}${advLabel}`, allRolls, total, sides)
      return
    }

    const rolls = rollDice(1, sides)
    const total = rolls[0] + modifier
    const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : ''
    addResult(`1d${sides}${modStr}`, rolls, total, sides)
  }

  const handleCustomRoll = (): void => {
    const parsed = parseDiceFormula(customFormula)
    if (!parsed) return

    const rolls = rollDice(parsed.count, parsed.sides)
    const total = rolls.reduce((sum, r) => sum + r, 0) + parsed.modifier + modifier
    const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : ''
    addResult(`${customFormula}${modStr}`, rolls, total, parsed.sides)
    setCustomFormula('')
  }

  return (
    <div className="space-y-3">
      {/* Quick roll buttons */}
      <div className="flex gap-1 flex-wrap">
        {DICE.map((die) => (
          <button
            key={die.sides}
            onClick={() => handleQuickRoll(die.sides)}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 border border-gray-700
              text-gray-300 hover:bg-amber-600 hover:text-white hover:border-amber-500
              transition-colors cursor-pointer font-mono font-semibold"
          >
            {die.label}
          </button>
        ))}
      </div>

      {/* Modifier and advantage */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Mod</span>
          <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
            <button
              onClick={() => setModifier((m) => m - 1)}
              className="px-2 py-1 text-gray-400 hover:text-gray-200 cursor-pointer text-sm"
            >
              -
            </button>
            <span className="w-8 text-center text-sm text-gray-200 font-mono">
              {modifier >= 0 ? `+${modifier}` : modifier}
            </span>
            <button
              onClick={() => setModifier((m) => m + 1)}
              className="px-2 py-1 text-gray-400 hover:text-gray-200 cursor-pointer text-sm"
            >
              +
            </button>
          </div>
        </div>

        {system === 'dnd5e' && (
          <div className="flex gap-1 ml-2">
            {(['normal', 'advantage', 'disadvantage'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAdvantage(mode)}
                className={`px-2 py-1 text-[10px] rounded transition-colors cursor-pointer
                  ${
                    advantage === mode
                      ? mode === 'advantage'
                        ? 'bg-green-600 text-white'
                        : mode === 'disadvantage'
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
              >
                {mode === 'normal' ? 'Norm' : mode === 'advantage' ? 'Adv' : 'Dis'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom formula */}
      <div className="flex gap-1">
        <input
          type="text"
          value={customFormula}
          onChange={(e) => setCustomFormula(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCustomRoll()
          }}
          placeholder="2d6+3"
          className="flex-1 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100
            placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm font-mono"
        />
        <button
          onClick={handleCustomRoll}
          disabled={!parseDiceFormula(customFormula)}
          className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white
            font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Roll
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {results.map((result) => (
            <div
              key={result.id}
              className={`transition-transform ${
                animatingId === result.id
                  ? 'animate-[scaleIn_0.3s_ease-out]'
                  : ''
              }`}
            >
              <DiceResult
                formula={result.formula}
                rolls={result.rolls}
                total={result.total}
                rollerName={result.rollerName}
                dieSides={result.dieSides}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
