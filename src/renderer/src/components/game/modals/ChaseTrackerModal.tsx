import { useEffect, useState } from 'react'

interface ChaseTrackerModalProps {
  onClose: () => void
  onBroadcastResult: (message: string) => void
}

interface Participant {
  id: string
  name: string
  position: number
  speed: number
  dashesUsed: number
  conModifier: number
  isQuarry: boolean
}

type ComplicationType = 'urban' | 'wilderness'

interface ChaseTableData {
  urban?: string[]
  wilderness?: string[]
}

const FALLBACK_URBAN_COMPLICATIONS: string[] = [
  'No complication.',
  'A large cart blocks the way. DC 10 Dexterity (Acrobatics) to get past, or lose 1 zone.',
  'A crowd fills the street. DC 10 Strength (Athletics) to push through, or lose 1 zone.',
  'A dog runs underfoot. DC 12 Dexterity saving throw or fall prone, losing 1 zone.',
  'A low-hanging sign. DC 10 Dexterity (Acrobatics) to duck, or take 1d4 bludgeoning damage.',
  'A crumbling staircase. DC 10 Dexterity (Acrobatics) to navigate, or fall to ground level.',
  'You run through a swarm of insects. DC 12 Constitution saving throw or blinded until end of next turn.',
  'A guard steps in your path. DC 12 Charisma (Persuasion) to talk past, or lose 1 zone.',
  'You run into a dead end and must backtrack. Lose 1 zone.',
  'A window or door blocks the path. DC 10 Strength to bash through, or lose 1 zone.',
  'A bridge or rooftop gap. DC 10 Dexterity (Acrobatics) to leap, or fall 1d6 x 5 feet.',
  'No complication.'
]

const FALLBACK_WILDERNESS_COMPLICATIONS: string[] = [
  'No complication.',
  'Your path takes you through a rough patch. DC 10 Dexterity (Acrobatics) or lose 1 zone.',
  'A stream or ravine blocks your path. DC 10 Strength (Athletics) to cross, or lose 1 zone.',
  'Uneven ground. DC 10 Dexterity saving throw or fall prone, losing 1 zone.',
  'Your path goes through a briar patch. 1d4 piercing damage and DC 10 Dexterity to avoid losing 1 zone.',
  'You run through a swarm of insects. DC 12 Constitution saving throw or blinded until end of next turn.',
  'A root or rock trips you. DC 10 Dexterity saving throw or take 1d4 bludgeoning and fall prone.',
  "You blunder into a hunter's trap. DC 14 Dexterity saving throw or be restrained (DC 12 Strength to escape).",
  'You are caught in a stampede of animals. DC 12 Dexterity saving throw or take 1d6 bludgeoning and be knocked prone.',
  'A low branch blocks your path. DC 10 Dexterity (Acrobatics) to duck, or take 1d6 bludgeoning.',
  'A flock of birds scatters around you. DC 10 Wisdom (Perception) to not lose track; lose 1 zone on failure.',
  'No complication.'
]

const MAX_ZONES = 10
const MAX_ROUNDS = 10
const ESCAPE_DISTANCE = 3

export default function ChaseTrackerModal({ onClose, onBroadcastResult }: ChaseTrackerModalProps): JSX.Element {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: crypto.randomUUID(), name: 'Quarry', position: 3, speed: 30, dashesUsed: 0, conModifier: 1, isQuarry: true },
    { id: crypto.randomUUID(), name: 'Pursuer 1', position: 0, speed: 30, dashesUsed: 0, conModifier: 1, isQuarry: false }
  ])
  const [currentRound, setCurrentRound] = useState(1)
  const [activeIndex, setActiveIndex] = useState(0)
  const [complicationType, setComplicationType] = useState<ComplicationType>('urban')
  const [currentComplication, setCurrentComplication] = useState<string | null>(null)
  const [chaseTables, setChaseTables] = useState<ChaseTableData | null>(null)
  const [chaseEnded, setChaseEnded] = useState(false)
  const [endMessage, setEndMessage] = useState('')
  const [newName, setNewName] = useState('')
  const [newIsQuarry, setNewIsQuarry] = useState(false)

  useEffect(() => {
    fetch('./data/5e/chase-tables.json')
      .then((res) => res.json())
      .then((data: ChaseTableData) => setChaseTables(data))
      .catch(() => {})
  }, [])

  const getComplications = (): string[] => {
    if (chaseTables?.[complicationType]) {
      return chaseTables[complicationType]!
    }
    return complicationType === 'urban' ? FALLBACK_URBAN_COMPLICATIONS : FALLBACK_WILDERNESS_COMPLICATIONS
  }

  const rollComplication = (): string => {
    const table = getComplications()
    const roll = Math.floor(Math.random() * table.length)
    return table[roll]
  }

  const [newConMod, setNewConMod] = useState(1)

  const getFreeDashes = (conMod: number): number => Math.max(1, 3 + conMod)

  const addParticipant = (): void => {
    if (!newName.trim()) return
    setParticipants((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newName.trim(),
        position: newIsQuarry ? 3 : 0,
        speed: 30,
        dashesUsed: 0,
        conModifier: newConMod,
        isQuarry: newIsQuarry
      }
    ])
    setNewName('')
    setNewIsQuarry(false)
    setNewConMod(1)
  }

  const removeParticipant = (id: string): void => {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
    if (activeIndex >= participants.length - 1) {
      setActiveIndex(Math.max(0, participants.length - 2))
    }
  }

  const moveParticipant = (id: string, zones: number): void => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, position: Math.max(0, Math.min(MAX_ZONES, p.position + zones)) } : p))
    )
  }

  const handleDash = (id: string): void => {
    const p = participants.find((p) => p.id === id)
    if (!p) return
    const freeDashes = getFreeDashes(p.conModifier)
    const newDashCount = p.dashesUsed + 1

    setParticipants((prev) => prev.map((pp) => (pp.id === id ? { ...pp, dashesUsed: newDashCount } : pp)))

    if (newDashCount > freeDashes) {
      onBroadcastResult(
        `${p.name} Dashes (${newDashCount}/${freeDashes} free)! DC 10 CON save required or gain 1 Exhaustion.`
      )
    } else {
      onBroadcastResult(`${p.name} Dashes (${newDashCount}/${freeDashes} free).`)
    }
    moveParticipant(id, 1)
  }

  const handleMove = (id: string): void => {
    const p = participants.find((p) => p.id === id)
    if (!p) return
    const zones = Math.max(1, Math.floor(p.speed / 30))
    moveParticipant(id, zones)

    // Roll complication
    const comp = rollComplication()
    setCurrentComplication(comp)
    onBroadcastResult(`${p.name} moves ${zones} zone(s). Complication: ${comp}`)
  }

  const nextTurn = (): void => {
    // Check for escape or capture
    const quarries = participants.filter((p) => p.isQuarry)
    const pursuers = participants.filter((p) => !p.isQuarry)

    for (const quarry of quarries) {
      const closestPursuer = pursuers.reduce(
        (min, p) => Math.min(min, Math.abs(quarry.position - p.position)),
        Infinity
      )
      if (closestPursuer >= ESCAPE_DISTANCE) {
        setChaseEnded(true)
        setEndMessage(`${quarry.name} escaped! The quarry got ${closestPursuer} zones ahead.`)
        onBroadcastResult(`Chase ended: ${quarry.name} escaped!`)
        return
      }
      if (closestPursuer === 0) {
        setChaseEnded(true)
        setEndMessage(`${quarry.name} was caught!`)
        onBroadcastResult(`Chase ended: ${quarry.name} was caught!`)
        return
      }
    }

    // Advance turn
    const nextIdx = activeIndex + 1
    if (nextIdx >= participants.length) {
      const nextRound = currentRound + 1
      if (nextRound > MAX_ROUNDS) {
        setChaseEnded(true)
        setEndMessage('Chase ended after 10 rounds. The quarry escaped!')
        onBroadcastResult('Chase ended after 10 rounds. The quarry escaped!')
        return
      }
      setCurrentRound(nextRound)
      setActiveIndex(0)
    } else {
      setActiveIndex(nextIdx)
    }
    setCurrentComplication(null)
  }

  const updateConModifier = (id: string, conMod: number): void => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, conModifier: conMod } : p)))
  }

  const updateSpeed = (id: string, speed: number): void => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, speed: Math.max(0, speed) } : p)))
  }

  const resetChase = (): void => {
    setChaseEnded(false)
    setEndMessage('')
    setCurrentRound(1)
    setActiveIndex(0)
    setCurrentComplication(null)
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        position: p.isQuarry ? 3 : 0,
        dashesUsed: 0
      }))
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-amber-400">Chase Tracker</h2>
            <span className="text-xs text-gray-400">
              Round {currentRound}/{MAX_ROUNDS}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-1" aria-label="Close">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Complication Type */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">Setting:</label>
            <button
              onClick={() => setComplicationType('urban')}
              className={`px-3 py-1 text-xs rounded border ${
                complicationType === 'urban'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              Urban
            </button>
            <button
              onClick={() => setComplicationType('wilderness')}
              className={`px-3 py-1 text-xs rounded border ${
                complicationType === 'wilderness'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              Wilderness
            </button>
          </div>

          {/* Distance Track */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Distance Track (Zones)</label>
            <div className="relative bg-gray-800 rounded-lg border border-gray-700 p-3">
              {/* Zone markers */}
              <div className="flex">
                {Array.from({ length: MAX_ZONES + 1 }, (_, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-[10px] text-gray-500 mb-1">{i}</div>
                    <div className="h-4 border-l border-gray-600 mx-auto w-0" />
                  </div>
                ))}
              </div>
              {/* Participant markers */}
              <div className="relative h-8 mt-1">
                {participants.map((p, idx) => {
                  const leftPct = (p.position / MAX_ZONES) * 100
                  return (
                    <div
                      key={p.id}
                      className="absolute -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${leftPct}%`, top: `${idx % 2 === 0 ? 0 : 14}px` }}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                          p.isQuarry ? 'bg-red-600 border-red-400 text-white' : 'bg-blue-600 border-blue-400 text-white'
                        }`}
                        title={p.name}
                      >
                        {p.name[0]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Chase Ended */}
          {chaseEnded && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 text-center">
              <div className="text-amber-400 font-bold text-sm">{endMessage}</div>
              <button
                onClick={resetChase}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded"
              >
                Reset Chase
              </button>
            </div>
          )}

          {/* Current Complication */}
          {currentComplication && !chaseEnded && (
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
              <div className="text-xs text-purple-400 font-semibold mb-1">Complication</div>
              <div className="text-sm text-purple-200">{currentComplication}</div>
            </div>
          )}

          {/* Participant List */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">Participants</label>
            {participants.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  idx === activeIndex && !chaseEnded ? 'bg-gray-800 border-amber-600' : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                {/* Active indicator */}
                <div className="w-2">
                  {idx === activeIndex && !chaseEnded && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                </div>

                {/* Name & role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{p.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        p.isQuarry ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
                      }`}
                    >
                      {p.isQuarry ? 'Quarry' : 'Pursuer'}
                    </span>
                  </div>
                </div>

                {/* Zone */}
                <div className="text-xs text-gray-400">
                  Zone <span className="text-white font-medium">{p.position}</span>
                </div>

                {/* Speed */}
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-gray-500">Spd:</label>
                  <input
                    type="number"
                    value={p.speed}
                    onChange={(e) => updateSpeed(p.id, Number(e.target.value))}
                    className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white text-center"
                    step={5}
                  />
                </div>

                {/* CON Mod */}
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-gray-500">CON:</label>
                  <input
                    type="number"
                    value={p.conModifier}
                    onChange={(e) =>
                      setParticipants((prev) =>
                        prev.map((pp) => (pp.id === p.id ? { ...pp, conModifier: Number(e.target.value) } : pp))
                      )
                    }
                    className="w-10 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white text-center"
                  />
                </div>

                {/* Dashes */}
                <div className="text-[10px] text-gray-500">
                  Dashes: <span className={p.dashesUsed > getFreeDashes(p.conModifier) ? 'text-red-400' : 'text-amber-400'}>{p.dashesUsed}</span>
                  <span className="text-gray-600">/{getFreeDashes(p.conModifier)}</span>
                </div>

                {/* Actions */}
                {idx === activeIndex && !chaseEnded && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMove(p.id)}
                      className="px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => handleDash(p.id)}
                      className="px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded"
                    >
                      Dash
                    </button>
                  </div>
                )}

                {/* Remove */}
                <button
                  onClick={() => removeParticipant(p.id)}
                  className="text-red-500 hover:text-red-400 text-xs px-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Add Participant */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Participant name..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addParticipant()
              }}
            />
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">CON:</label>
              <input
                type="number"
                value={newConMod}
                onChange={(e) => setNewConMod(Number(e.target.value))}
                className="w-10 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-white text-center"
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={newIsQuarry}
                onChange={(e) => setNewIsQuarry(e.target.checked)}
                className="rounded"
              />
              Quarry
            </label>
            <button
              onClick={addParticipant}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
            >
              Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
          <div className="text-xs text-gray-500">
            Escape at {ESCAPE_DISTANCE}+ zones apart. Chase ends after {MAX_ROUNDS} rounds.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded"
            >
              Close
            </button>
            {!chaseEnded && (
              <button
                onClick={nextTurn}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded font-medium"
              >
                Next Turn
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
