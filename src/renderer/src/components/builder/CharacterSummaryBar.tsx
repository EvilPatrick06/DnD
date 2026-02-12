import { useMemo, useRef, useState } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { ABILITY_NAMES, abilityModifier, formatMod } from '../../types/character-common'
import { calculate5eStats } from '../../services/stat-calculator-5e'
import { calculatePf2eStats } from '../../services/stat-calculator-pf2e'
import { CharacterIcon } from './IconPicker'

function EditableHP({
  currentHP,
  maxHP,
  tempHP,
  onChangeHP,
  onChangeTempHP
}: {
  currentHP: number | null
  maxHP: number
  tempHP: number
  onChangeHP: (hp: number | null) => void
  onChangeTempHP: (hp: number) => void
}): JSX.Element {
  const [editingHP, setEditingHP] = useState(false)
  const [editingTemp, setEditingTemp] = useState(false)
  const [draftHP, setDraftHP] = useState('')
  const [draftTemp, setDraftTemp] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)
  const tempRef = useRef<HTMLInputElement>(null)

  const displayHP = currentHP ?? maxHP

  function startEditHP(): void {
    setDraftHP(String(displayHP))
    setEditingHP(true)
    setTimeout(() => hpRef.current?.focus(), 0)
  }

  function commitHP(): void {
    const parsed = parseInt(draftHP, 10)
    if (!isNaN(parsed)) {
      onChangeHP(parsed === maxHP ? null : parsed)
    }
    setEditingHP(false)
  }

  function startEditTemp(): void {
    setDraftTemp(String(tempHP))
    setEditingTemp(true)
    setTimeout(() => tempRef.current?.focus(), 0)
  }

  function commitTemp(): void {
    const parsed = parseInt(draftTemp, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChangeTempHP(parsed)
    }
    setEditingTemp(false)
  }

  function handleKeyDown(commit: () => void, cancel: () => void) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commit()
      else if (e.key === 'Escape') cancel()
    }
  }

  const hpColor = displayHP >= maxHP ? 'text-green-400' : displayHP > maxHP / 2 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="text-center cursor-pointer" onClick={() => !editingHP && startEditHP()}>
      <div className="text-xs text-gray-500">HP</div>
      {editingHP ? (
        <input
          ref={hpRef}
          type="number"
          value={draftHP}
          onChange={(e) => setDraftHP(e.target.value)}
          onBlur={commitHP}
          onKeyDown={handleKeyDown(commitHP, () => setEditingHP(false))}
          className="w-12 text-center font-bold bg-transparent border-b border-green-400 outline-none text-green-400 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
      ) : (
        <div className="flex items-center gap-0.5">
          <span className={`font-bold ${hpColor}`}>{displayHP}</span>
          <span className="text-gray-600 text-xs">/{maxHP}</span>
          {tempHP > 0 && (
            <span
              className="text-blue-400 text-xs font-medium ml-0.5 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); startEditTemp() }}
              title="Temp HP"
            >
              +{editingTemp ? (
                <input
                  ref={tempRef}
                  type="number"
                  min={0}
                  value={draftTemp}
                  onChange={(e) => setDraftTemp(e.target.value)}
                  onBlur={commitTemp}
                  onKeyDown={handleKeyDown(commitTemp, () => setEditingTemp(false))}
                  className="w-6 text-center bg-transparent border-b border-blue-400 outline-none text-blue-400 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
              ) : tempHP}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function CharacterSummaryBar(): JSX.Element {
  const { gameSystem, buildSlots, characterName, abilityScores, targetLevel, iconType, iconPreset, iconCustom } =
    useBuilderStore()
  const currentHP = useBuilderStore((s) => s.currentHP)
  const tempHP = useBuilderStore((s) => s.tempHP)
  const setCurrentHP = useBuilderStore((s) => s.setCurrentHP)
  const setTempHP = useBuilderStore((s) => s.setTempHP)
  const pf2eAncestryHP = useBuilderStore((s) => s.pf2eAncestryHP)
  const pf2eClassHP = useBuilderStore((s) => s.pf2eClassHP)
  const pf2ePerceptionRank = useBuilderStore((s) => s.pf2ePerceptionRank)
  const pf2eSaveRanks = useBuilderStore((s) => s.pf2eSaveRanks)
  const pf2eKeyAbility = useBuilderStore((s) => s.pf2eKeyAbility)
  const pf2eUnarmoredRank = useBuilderStore((s) => s.pf2eUnarmoredRank)
  const raceSpeed = useBuilderStore((s) => s.raceSpeed)

  const raceSlot = buildSlots.find((s) => s.category === 'ancestry')
  const classSlot = buildSlots.find((s) => s.category === 'class')

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

  const maxHP = stats5e?.maxHP ?? statsPf2e?.maxHP ?? 0
  const ac = stats5e?.armorClass ?? statsPf2e?.armorClass ?? '--'
  const speed = stats5e?.speed ?? (statsPf2e ? raceSpeed : '--')

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-700 text-sm shrink-0">
      {/* Name & Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <CharacterIcon
          iconType={iconType}
          iconPreset={iconPreset}
          iconCustom={iconCustom}
          name={characterName}
          size="md"
        />
        <div className="min-w-0">
          <div className="font-semibold truncate text-gray-100">
            {characterName || 'Unnamed Character'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            Lv {targetLevel} {raceSlot?.selectedName ?? '???'} {classSlot?.selectedName ?? '???'}
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-gray-700" />

      {/* HP - Editable */}
      <EditableHP
        currentHP={currentHP}
        maxHP={maxHP}
        tempHP={tempHP}
        onChangeHP={setCurrentHP}
        onChangeTempHP={setTempHP}
      />

      <div className="w-px h-8 bg-gray-700" />

      {/* Ability Scores */}
      <div className="flex gap-3">
        {ABILITY_NAMES.map((ab) => {
          const score = stats5e?.abilityScores[ab] ?? abilityScores[ab]
          const mod = abilityModifier(score)
          return (
            <div key={ab} className="text-center min-w-[40px]">
              <div className="text-xs text-gray-500 uppercase">{ab.slice(0, 3)}</div>
              <div className="font-bold text-amber-400">{formatMod(mod)}</div>
            </div>
          )
        })}
      </div>

      <div className="w-px h-8 bg-gray-700" />

      {/* Saves - 5e */}
      {gameSystem === 'dnd5e' && stats5e && (
        <div className="flex gap-3">
          {['fortitude', 'reflex', 'will'].map((save, i) => {
            const abilities = ['constitution', 'dexterity', 'wisdom']
            const val = stats5e.savingThrows[abilities[i]] ?? 0
            const labels = ['Fort', 'Ref', 'Will']
            return (
              <div key={save} className="text-center min-w-[36px]">
                <div className="text-xs text-gray-500">{labels[i]}</div>
                <div className="font-semibold">{formatMod(val)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Saves - PF2e */}
      {gameSystem === 'pf2e' && statsPf2e && (
        <div className="flex gap-3">
          {(['fortitude', 'reflex', 'will'] as const).map((save) => {
            const val = statsPf2e.savingThrows[save]
            const labels = { fortitude: 'Fort', reflex: 'Ref', will: 'Will' }
            return (
              <div key={save} className="text-center min-w-[36px]">
                <div className="text-xs text-gray-500">{labels[save]}</div>
                <div className="font-semibold">{formatMod(val)}</div>
              </div>
            )
          })}
          {/* Perception for PF2e */}
          <div className="text-center min-w-[36px]">
            <div className="text-xs text-gray-500">Perc</div>
            <div className="font-semibold">{formatMod(statsPf2e.perception)}</div>
          </div>
        </div>
      )}

      <div className="w-px h-8 bg-gray-700" />

      {/* AC */}
      <div className="text-center">
        <div className="text-xs text-gray-500">AC</div>
        <div className="font-bold">{ac}</div>
      </div>

      {/* Speed */}
      <div className="text-center">
        <div className="text-xs text-gray-500">Speed</div>
        <div className="font-semibold">{speed} ft</div>
      </div>
    </div>
  )
}
