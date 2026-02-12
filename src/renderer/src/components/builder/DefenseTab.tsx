import { useMemo, useState, useRef, useEffect } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { calculate5eStats } from '../../services/stat-calculator-5e'
import { calculatePf2eStats } from '../../services/stat-calculator-pf2e'
import { formatMod } from '../../types/character-common'

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

function TEMLBubbles({ rank }: { rank: 0 | 1 | 2 | 3 | 4 }): JSX.Element {
  const labels = ['T', 'E', 'M', 'L']
  return (
    <div className="flex gap-0.5">
      {labels.map((l, i) => (
        <div key={l} className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${
          i < rank ? 'bg-gray-300 border-gray-300 text-gray-900' : 'border-gray-600 text-gray-600'
        }`}>
          {i < rank ? 'X' : l}
        </div>
      ))}
    </div>
  )
}

const SAVE_DEFS_5E = [
  { key: 'constitution', label: 'Fortitude', abbr: 'CON' },
  { key: 'dexterity', label: 'Reflex', abbr: 'DEX' },
  { key: 'wisdom', label: 'Will', abbr: 'WIS' }
] as const

const SAVE_DEFS_PF2E = [
  { key: 'fortitude', label: 'Fortitude', ability: 'CON' },
  { key: 'reflex', label: 'Reflex', ability: 'DEX' },
  { key: 'will', label: 'Will', ability: 'WIS' }
] as const

const STANDARD_CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
] as const

const PF2E_CONDITIONS = [
  'Blinded',
  'Clumsy',
  'Concealed',
  'Confused',
  'Controlled',
  'Dazzled',
  'Deafened',
  'Doomed',
  'Drained',
  'Dying',
  'Encumbered',
  'Enfeebled',
  'Fascinated',
  'Fatigued',
  'Flat-Footed',
  'Fleeing',
  'Frightened',
  'Grabbed',
  'Hidden',
  'Immobilized',
  'Invisible',
  'Paralyzed',
  'Persistent Damage',
  'Petrified',
  'Prone',
  'Quickened',
  'Restrained',
  'Sickened',
  'Slowed',
  'Stunned',
  'Stupefied',
  'Unconscious',
  'Wounded'
] as const

const PROF_RANK_TO_NUM: Record<string, 0 | 1 | 2 | 3 | 4> = {
  untrained: 0,
  trained: 1,
  expert: 2,
  master: 3,
  legendary: 4
}

export default function DefenseTab(): JSX.Element {
  const { abilityScores, targetLevel, gameSystem } = useBuilderStore()
  const currentHP = useBuilderStore((s) => s.currentHP)
  const tempHP = useBuilderStore((s) => s.tempHP)
  const setCurrentHP = useBuilderStore((s) => s.setCurrentHP)
  const setTempHP = useBuilderStore((s) => s.setTempHP)
  const conditions = useBuilderStore((s) => s.conditions)
  const addCondition = useBuilderStore((s) => s.addCondition)
  const removeCondition = useBuilderStore((s) => s.removeCondition)

  // PF2e-specific state
  const pf2eAncestryHP = useBuilderStore((s) => s.pf2eAncestryHP)
  const pf2eClassHP = useBuilderStore((s) => s.pf2eClassHP)
  const pf2ePerceptionRank = useBuilderStore((s) => s.pf2ePerceptionRank)
  const pf2eSaveRanks = useBuilderStore((s) => s.pf2eSaveRanks)
  const pf2eKeyAbility = useBuilderStore((s) => s.pf2eKeyAbility)
  const pf2eUnarmoredRank = useBuilderStore((s) => s.pf2eUnarmoredRank)

  const [editingHP, setEditingHP] = useState(false)
  const [hpDraft, setHpDraft] = useState('')
  const hpInputRef = useRef<HTMLInputElement>(null)

  const [editingTempHP, setEditingTempHP] = useState(false)
  const [tempHpDraft, setTempHpDraft] = useState('')
  const tempHpInputRef = useRef<HTMLInputElement>(null)

  const [showConditionPicker, setShowConditionPicker] = useState(false)
  const [showBuffInput, setShowBuffInput] = useState(false)
  const [buffDraft, setBuffDraft] = useState('')
  const buffInputRef = useRef<HTMLInputElement>(null)

  const stats5e = useMemo(() => {
    if (gameSystem === 'dnd5e') {
      return calculate5eStats(abilityScores, null, null, targetLevel)
    }
    return null
  }, [gameSystem, abilityScores, targetLevel])

  const statsPf2e = useMemo(() => {
    if (gameSystem === 'pf2e') {
      return calculatePf2eStats(
        abilityScores,
        targetLevel,
        pf2eAncestryHP,
        pf2eClassHP,
        pf2ePerceptionRank,
        pf2eSaveRanks,
        pf2eKeyAbility,
        pf2eUnarmoredRank
      )
    }
    return null
  }, [gameSystem, abilityScores, targetLevel, pf2eAncestryHP, pf2eClassHP, pf2ePerceptionRank, pf2eSaveRanks, pf2eKeyAbility, pf2eUnarmoredRank])

  const maxHP = stats5e?.maxHP ?? statsPf2e?.maxHP ?? 1
  const armorClass = stats5e?.armorClass ?? statsPf2e?.armorClass ?? 10
  const profBonus = stats5e?.proficiencyBonus ?? statsPf2e?.proficiencyBonus ?? 0
  const dexMod = stats5e?.abilityModifiers.dexterity ?? statsPf2e?.abilityModifiers.dexterity ?? 0

  useEffect(() => {
    if (editingHP && hpInputRef.current) {
      hpInputRef.current.focus()
      hpInputRef.current.select()
    }
  }, [editingHP])

  useEffect(() => {
    if (editingTempHP && tempHpInputRef.current) {
      tempHpInputRef.current.focus()
      tempHpInputRef.current.select()
    }
  }, [editingTempHP])

  useEffect(() => {
    if (showBuffInput && buffInputRef.current) {
      buffInputRef.current.focus()
    }
  }, [showBuffInput])

  const displayCurrentHP = currentHP ?? maxHP

  const handleHPClick = (): void => {
    setHpDraft(String(displayCurrentHP))
    setEditingHP(true)
  }

  const commitHP = (): void => {
    const parsed = parseInt(hpDraft, 10)
    if (!isNaN(parsed)) {
      if (parsed === maxHP) {
        setCurrentHP(null)
      } else {
        setCurrentHP(parsed)
      }
    }
    setEditingHP(false)
  }

  const handleHPKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') commitHP()
    else if (e.key === 'Escape') setEditingHP(false)
  }

  const handleTempHPClick = (): void => {
    setTempHpDraft(String(tempHP))
    setEditingTempHP(true)
  }

  const commitTempHP = (): void => {
    const parsed = parseInt(tempHpDraft, 10)
    if (!isNaN(parsed) && parsed >= 0) setTempHP(parsed)
    setEditingTempHP(false)
  }

  const handleTempHPKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') commitTempHP()
    else if (e.key === 'Escape') setEditingTempHP(false)
  }

  const handleAddCondition = (name: string): void => {
    const alreadyExists = conditions.some((c) => c.name === name && c.type === 'condition')
    if (!alreadyExists) addCondition(name, 'condition', false)
    setShowConditionPicker(false)
  }

  const handleAddBuff = (): void => {
    const trimmed = buffDraft.trim()
    if (trimmed) {
      addCondition(trimmed, 'buff', true)
      setBuffDraft('')
      setShowBuffInput(false)
    }
  }

  const handleBuffKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAddBuff()
    else if (e.key === 'Escape') { setBuffDraft(''); setShowBuffInput(false) }
  }

  const conditionList = gameSystem === 'pf2e' ? PF2E_CONDITIONS : STANDARD_CONDITIONS
  const activeConditionNames = new Set(conditions.filter((c) => c.type === 'condition').map((c) => c.name))
  const availableConditions = conditionList.filter((c) => !activeConditionNames.has(c))

  return (
    <div>
      {/* AC + HP row */}
      <div className="flex items-stretch border-b border-gray-800">
        {/* AC Shield */}
        <div className="flex flex-col items-center justify-center px-6 py-4 border-r border-gray-800">
          <div className="relative w-16 h-18 flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-16 h-16 text-gray-600" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-gray-400 font-semibold leading-none mt-1">AC</span>
              <span className="text-2xl font-bold text-amber-400 leading-none">{armorClass}</span>
            </div>
          </div>
        </div>

        {/* HP Bar */}
        <div className="flex-1 flex flex-col justify-center px-4 py-4">
          <div className="bg-green-800/40 rounded-lg px-4 py-3 border border-green-700/30">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-green-300 font-semibold">HIT POINTS</span>
              {editingTempHP ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-300 font-semibold">TEMP</span>
                  <input
                    ref={tempHpInputRef}
                    type="number"
                    className="w-12 bg-blue-900/60 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-blue-200 font-bold text-center outline-none"
                    value={tempHpDraft}
                    onChange={(e) => setTempHpDraft(e.target.value)}
                    onBlur={commitTempHP}
                    onKeyDown={handleTempHPKeyDown}
                    min={0}
                  />
                </div>
              ) : tempHP > 0 ? (
                <button
                  onClick={handleTempHPClick}
                  className="flex items-center gap-1 bg-blue-600/30 border border-blue-500/40 rounded-full px-2.5 py-0.5 hover:bg-blue-600/50 transition-colors cursor-pointer"
                  title="Click to edit temp HP"
                >
                  <span className="text-[10px] text-blue-300 font-semibold">TEMP</span>
                  <span className="text-sm font-bold text-blue-300">+{tempHP}</span>
                </button>
              ) : (
                <button
                  onClick={handleTempHPClick}
                  className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors cursor-pointer"
                  title="Click to add temp HP"
                >
                  +TEMP HP
                </button>
              )}
            </div>
            <div className="flex items-baseline gap-0.5">
              {editingHP ? (
                <>
                  <input
                    ref={hpInputRef}
                    type="number"
                    className="w-16 bg-green-900/60 border border-green-500 rounded px-2 py-0.5 text-2xl font-bold text-green-400 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={hpDraft}
                    onChange={(e) => setHpDraft(e.target.value)}
                    onBlur={commitHP}
                    onKeyDown={handleHPKeyDown}
                  />
                  <span className="text-2xl font-bold text-green-700">/</span>
                  <span className="text-2xl font-bold text-green-400">{maxHP}</span>
                </>
              ) : (
                <>
                  <span
                    onClick={handleHPClick}
                    className={`text-2xl font-bold cursor-pointer hover:underline decoration-green-500 decoration-2 underline-offset-2 transition-colors ${
                      displayCurrentHP < maxHP ? 'text-red-400' : 'text-green-400'
                    }`}
                    title="Click to edit current HP"
                  >
                    {displayCurrentHP}
                  </span>
                  <span className="text-2xl font-bold text-green-700">/</span>
                  <span className="text-2xl font-bold text-green-400">{maxHP}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Perception (PF2e) */}
      {gameSystem === 'pf2e' && statsPf2e && (
        <>
          <SectionBanner label="PERCEPTION" />
          <div className="flex items-center px-4 py-2.5 border-b border-gray-800 gap-3">
            <span className="text-sm font-medium text-gray-200 flex-1">
              Perception <span className="font-bold text-amber-400">{formatMod(statsPf2e.perception)}</span>
            </span>
            <TEMLBubbles rank={PROF_RANK_TO_NUM[pf2ePerceptionRank] ?? 0} />
          </div>
        </>
      )}

      {/* Saving Throws */}
      <SectionBanner label="SAVING THROWS" />
      <div className="border-b border-gray-800">
        {gameSystem === 'pf2e' && statsPf2e ? (
          SAVE_DEFS_PF2E.map((save) => {
            const totalVal = statsPf2e.savingThrows[save.key]
            const rank = PROF_RANK_TO_NUM[pf2eSaveRanks[save.key]] ?? 0
            return (
              <div key={save.key} className="flex items-center px-4 py-2.5 border-b border-gray-800/50 last:border-b-0 gap-3">
                <span className="text-sm font-medium text-gray-200 flex-1">
                  {save.label} <span className="font-bold text-amber-400">{formatMod(totalVal)}</span>
                </span>
                <TEMLBubbles rank={rank} />
                <span className="text-xs text-gray-400">{save.ability}</span>
              </div>
            )
          })
        ) : stats5e ? (
          SAVE_DEFS_5E.map((save) => {
            const totalVal = stats5e.savingThrows[save.key] ?? 0
            const mod = stats5e.abilityModifiers[save.key as keyof typeof stats5e.abilityModifiers]
            const isProficient = totalVal !== mod
            const profVal = isProficient ? profBonus : 0
            const rank: 0 | 1 = isProficient ? 1 : 0

            return (
              <div key={save.key} className="flex items-center px-4 py-2.5 border-b border-gray-800/50 last:border-b-0 gap-3">
                <span className="text-sm font-medium text-gray-200 flex-1">
                  {save.label} <span className="font-bold text-amber-400">{formatMod(totalVal)}</span>
                </span>
                <TEMLBubbles rank={rank} />
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400 w-12 text-right">{save.abbr} {formatMod(mod)}</span>
                  <span className="text-gray-500 w-14 text-right">Prof {formatMod(profVal)}</span>
                  <span className="text-gray-600 w-12 text-right">Item +0</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-4 py-3 text-sm text-gray-500">No save data available</div>
        )}
      </div>

      {/* Class DC (PF2e) */}
      {gameSystem === 'pf2e' && statsPf2e && (
        <>
          <SectionBanner label="CLASS DC" />
          <div className="flex items-center px-4 py-2.5 border-b border-gray-800 gap-3">
            <span className="text-sm font-medium text-gray-200 flex-1">
              Class DC <span className="font-bold text-amber-400">{statsPf2e.classDC}</span>
            </span>
            <TEMLBubbles rank={1} />
          </div>
        </>
      )}

      {/* Conditions & Effects */}
      <SectionBanner label="CONDITIONS & EFFECTS" />
      <div className="px-4 py-3 border-b border-gray-800">
        {conditions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {conditions.map((cond, index) => (
              <span
                key={`${cond.name}-${index}`}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  cond.type === 'condition'
                    ? 'bg-red-900/40 text-red-300 border border-red-700/40'
                    : 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                }`}
              >
                {cond.name}
                <button
                  onClick={() => removeCondition(index)}
                  className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] leading-none hover:bg-opacity-50 transition-colors ${
                    cond.type === 'condition'
                      ? 'hover:bg-red-700 text-red-400 hover:text-red-200'
                      : 'hover:bg-blue-700 text-blue-400 hover:text-blue-200'
                  }`}
                  title={`Remove ${cond.name}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        {showConditionPicker && (
          <div className="mb-3 bg-gray-800 border border-gray-700 rounded-lg p-2 max-h-48 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {availableConditions.map((cond) => (
                <button
                  key={cond}
                  onClick={() => handleAddCondition(cond)}
                  className="text-xs bg-red-900/30 text-red-300 border border-red-700/30 rounded-full px-2.5 py-1 hover:bg-red-900/60 hover:border-red-600/50 transition-colors"
                >
                  {cond}
                </button>
              ))}
              {availableConditions.length === 0 && (
                <span className="text-xs text-gray-500 px-2 py-1">All conditions are active</span>
              )}
            </div>
          </div>
        )}

        {showBuffInput && (
          <div className="mb-3 flex gap-2">
            <input
              ref={buffInputRef}
              type="text"
              placeholder="Enter buff name..."
              className="flex-1 bg-gray-800 border border-blue-700/50 rounded px-3 py-1.5 text-xs text-blue-200 placeholder-gray-500 outline-none focus:border-blue-500"
              value={buffDraft}
              onChange={(e) => setBuffDraft(e.target.value)}
              onKeyDown={handleBuffKeyDown}
            />
            <button
              onClick={handleAddBuff}
              className="text-xs text-blue-300 bg-blue-900/40 border border-blue-700/40 rounded px-3 py-1.5 hover:bg-blue-900/60 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setBuffDraft(''); setShowBuffInput(false) }}
              className="text-xs text-gray-400 border border-gray-700 rounded px-3 py-1.5 hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => { setShowConditionPicker(!showConditionPicker); setShowBuffInput(false) }}
            className={`flex-1 text-xs border rounded px-3 py-1.5 transition-colors ${
              showConditionPicker
                ? 'text-red-300 border-red-700/50 bg-red-900/20'
                : 'text-gray-400 border-gray-700 hover:border-gray-500'
            }`}
          >
            {showConditionPicker ? 'Close Conditions' : 'Add Condition'}
          </button>
          <button
            onClick={() => { setShowBuffInput(!showBuffInput); setShowConditionPicker(false) }}
            className={`flex-1 text-xs border rounded px-3 py-1.5 transition-colors ${
              showBuffInput
                ? 'text-blue-300 border-blue-700/50 bg-blue-900/20'
                : 'text-gray-400 border-gray-700 hover:border-gray-500'
            }`}
          >
            {showBuffInput ? 'Close' : 'Add Buff'}
          </button>
        </div>
      </div>

      {/* Armor Section */}
      <SectionBanner label="ARMOR" />
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-gray-200">Unarmored</div>
              <div className="text-xs text-gray-500 mt-0.5">Wearing no armor.</div>
            </div>
            <div className="text-xl font-bold text-amber-400">AC {armorClass}</div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <TEMLBubbles rank={gameSystem === 'pf2e' ? (PROF_RANK_TO_NUM[pf2eUnarmoredRank] ?? 1) : 1} />
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Dex {formatMod(dexMod)}</span>
              <span>Prof {formatMod(profBonus)}</span>
              <span>Item +0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shield Section */}
      <SectionBanner label="SHIELD" />
      <div className="px-4 py-3">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3">
          <div className="text-sm font-semibold text-gray-200 mb-3">No Shield</div>
        </div>
      </div>
    </div>
  )
}
