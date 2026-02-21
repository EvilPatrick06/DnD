import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getSpellsFromTraits } from '../../../services/auto-populate-5e'
import { load5eSpells, load5eSubclasses } from '../../../services/data-provider'
import {
  getCantripsKnown,
  getPreparedSpellMax,
  getSlotProgression,
  hasAnySpellcasting,
  isWarlockPactMagic
} from '../../../services/spell-data'
import { useBuilderStore } from '../../../stores/useBuilderStore'
import SectionBanner from '../shared/SectionBanner'

interface SpellData {
  id: string
  name: string
  level: number
  school?: string
  castingTime?: string
  castTime?: string
  range?: string
  duration?: string
  concentration?: boolean
  ritual?: boolean
  description: string
  higherLevels?: string
  classes?: string[]
  components?: unknown
}

function SpellRow({
  spell,
  selected,
  onToggle
}: {
  spell: SpellData
  selected: boolean
  onToggle: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-800/30">
        <button
          onClick={onToggle}
          className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
            selected ? 'bg-amber-600 border-amber-500 text-white' : 'border-gray-600 hover:border-gray-400'
          }`}
        >
          {selected && '\u2713'}
        </button>
        <button onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center justify-between text-left">
          <span className={`text-sm ${selected ? 'text-gray-200' : 'text-gray-400'}`}>{spell.name}</span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {spell.concentration && <span className="text-yellow-600">C</span>}
            {spell.ritual && <span className="text-blue-500">R</span>}
            <span>{spell.school}</span>
          </div>
        </button>
      </div>
      {expanded && (
        <div className="px-6 pb-2 text-xs text-gray-400 space-y-1">
          <div className="flex gap-3 text-gray-500">
            <span>{spell.castingTime || spell.castTime}</span>
            <span>{spell.range}</span>
            <span>{spell.duration}</span>
          </div>
          <p className="leading-relaxed">{spell.description}</p>
          {spell.higherLevels && (
            <p className="text-gray-500">
              <span className="font-semibold">At Higher Levels:</span> {spell.higherLevels}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SelectedSpellsSummary({
  selectedSpellIds,
  allSpells,
  onRemove
}: {
  selectedSpellIds: string[]
  allSpells: SpellData[]
  onRemove: (id: string) => void
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<number, SpellData[]>()
    for (const id of selectedSpellIds) {
      const spell = allSpells.find((s) => s.id === id)
      if (spell) {
        const list = map.get(spell.level) ?? []
        list.push(spell)
        map.set(spell.level, list)
      }
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [selectedSpellIds, allSpells])

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-1.5 bg-amber-900/20 flex items-center justify-between cursor-pointer hover:bg-amber-900/30 transition-colors"
      >
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
          Your Selected Spells ({selectedSpellIds.length})
        </span>
        <span className="text-gray-500 text-[10px]">{collapsed ? '\u25B8' : '\u25BE'}</span>
      </button>
      {!collapsed && (
        <div className="px-4 py-2 space-y-2 max-h-48 overflow-y-auto">
          {grouped.map(([level, spells]) => (
            <Fragment key={level}>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">
                {level === 0 ? 'Cantrips' : `${level}${ordinal(level)} Level`}
              </div>
              {spells.map((spell) => (
                <div key={spell.id} className="flex items-center justify-between py-0.5">
                  <span className="text-sm text-gray-300">{spell.name}</span>
                  <button
                    onClick={() => onRemove(spell.id)}
                    className="text-[10px] text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function BlessedWarriorPicker({
  allSpells,
  selectedCantrips,
  onSelect
}: {
  allSpells: SpellData[]
  selectedCantrips: string[]
  onSelect: (ids: string[]) => void
}): JSX.Element {
  const clericCantrips = useMemo(
    () =>
      allSpells
        .filter((s) => s.level === 0 && s.classes?.includes('cleric'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allSpells]
  )

  const toggleCantrip = useCallback(
    (id: string) => {
      if (selectedCantrips.includes(id)) {
        onSelect(selectedCantrips.filter((c) => c !== id))
      } else if (selectedCantrips.length < 2) {
        onSelect([...selectedCantrips, id])
      }
    },
    [selectedCantrips, onSelect]
  )

  return (
    <div className="border border-blue-700/50 rounded-lg bg-blue-900/10 p-3 mb-3">
      <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
        Blessed Warrior Cantrips ({selectedCantrips.length}/2)
      </div>
      <p className="text-xs text-gray-500 mb-2">Choose 2 Cleric cantrips. They count as Paladin spells (CHA-based).</p>
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {clericCantrips.map((spell) => {
          const selected = selectedCantrips.includes(spell.id)
          return (
            <button
              key={spell.id}
              onClick={() => toggleCantrip(spell.id)}
              disabled={!selected && selectedCantrips.length >= 2}
              className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                selected
                  ? 'bg-blue-800/40 text-blue-300'
                  : selectedCantrips.length >= 2
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 cursor-pointer'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                  selected ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600'
                }`}
              >
                {selected && '\u2713'}
              </span>
              {spell.name}
              <span className="ml-auto text-xs text-gray-600">{spell.school}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SpellsTab5e(): JSX.Element {
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const classSlot = buildSlots.find((s) => s.category === 'class')
  const speciesSlot = buildSlots.find((s) => s.category === 'ancestry')
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const speciesTraits = useBuilderStore((s) => s.speciesTraits)

  const [allSpells, setAllSpells] = useState<SpellData[]>([])
  const selectedSpellIds = useBuilderStore((s) => s.selectedSpellIds)
  const setSelectedSpellIds = useBuilderStore((s) => s.setSelectedSpellIds)
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [warning, setWarning] = useState<string | null>(null)

  const subclassSlot = buildSlots.find((s) => s.id.includes('subclass'))
  const subclassId = subclassSlot?.selectedId ?? ''
  const fightingStyleSlot = buildSlots.find((s) => s.category === 'fighting-style')

  const classId = classSlot?.selectedId ?? ''
  const className = classSlot?.selectedName ?? ''
  const speciesName = speciesSlot?.selectedName ?? ''
  const isDruid = classId === 'druid'
  const isBlessedWarrior = fightingStyleSlot?.selectedId === 'fighting-style-blessed-warrior'
  const blessedWarriorCantrips = useBuilderStore((s) => s.blessedWarriorCantrips)
  const setBlessedWarriorCantrips = useBuilderStore((s) => s.setBlessedWarriorCantrips)

  // Load subclass always-prepared spell names
  const [subclassAlwaysPreparedNames, setSubclassAlwaysPreparedNames] = useState<string[]>([])
  useEffect(() => {
    if (!subclassId) {
      setSubclassAlwaysPreparedNames([])
      return
    }
    load5eSubclasses()
      .then((subclasses) => {
        const sc = subclasses.find((s) => s.id === subclassId)
        if (!sc?.alwaysPreparedSpells) {
          setSubclassAlwaysPreparedNames([])
          return
        }
        const names: string[] = []
        for (const [lvlStr, spellNames] of Object.entries(sc.alwaysPreparedSpells)) {
          if (targetLevel >= Number(lvlStr)) names.push(...spellNames)
        }
        setSubclassAlwaysPreparedNames(names)
      })
      .catch(() => setSubclassAlwaysPreparedNames([]))
  }, [subclassId, targetLevel])

  // Detect species spells from traits
  const speciesSpells = useMemo(() => {
    if (!speciesTraits.length) return []
    return getSpellsFromTraits(
      speciesTraits as Array<{
        name: string
        description: string
        spellGranted?: string | { list: string; count: number }
      }>,
      speciesName
    )
  }, [speciesTraits, speciesName])

  // Load spells
  useEffect(() => {
    load5eSpells()
      .then((data) => setAllSpells(data as SpellData[]))
      .catch(() => setAllSpells([]))
  }, [])

  // Compute slot info
  const isCaster = hasAnySpellcasting(classId)
  const slotProgression = getSlotProgression(classId, targetLevel)
  const cantripsMax = getCantripsKnown(classId, targetLevel)
  const preparedMax = getPreparedSpellMax(classId, targetLevel)

  // Filter spells by class
  const availableSpells = useMemo(() => {
    let filtered = allSpells
    if (classId) {
      filtered = filtered.filter((s) => s.classes?.includes(classId))
    }

    // Filter out spells above max castable level
    const maxSpellLevel = Object.keys(slotProgression)
      .map(Number)
      .filter((lvl) => (slotProgression[lvl] ?? 0) > 0)
      .reduce((max, lvl) => Math.max(max, lvl), 0)
    filtered = filtered.filter((s) => s.level === 0 || s.level <= maxSpellLevel)

    if (levelFilter !== 'all') {
      filtered = filtered.filter((s) => s.level === levelFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q))
    }
    return filtered.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }, [allSpells, classId, levelFilter, search, slotProgression])

  // Always-prepared spell IDs (Druids: Speak with Animals, Rangers: Hunter's Mark, subclass spells, etc.)
  const isRanger = classId === 'ranger'
  const alwaysPreparedIds = useMemo(() => {
    const ids = new Set<string>()
    if (isDruid) {
      const spa = allSpells.find((s) => s.name === 'Speak with Animals')
      if (spa) ids.add(spa.id)
    }
    if (isRanger) {
      const hm = allSpells.find((s) => s.name === "Hunter's Mark")
      if (hm) ids.add(hm.id)
    }
    // Add subclass always-prepared spells
    for (const name of subclassAlwaysPreparedNames) {
      const spell = allSpells.find((s) => s.name.toLowerCase() === name.toLowerCase())
      if (spell) ids.add(spell.id)
    }
    return ids
  }, [isDruid, isRanger, allSpells, subclassAlwaysPreparedNames])

  // Count selected cantrips and leveled spells (exclude always-prepared)
  const selectedCantripsCount = useMemo(
    () =>
      selectedSpellIds.filter((id) => !alwaysPreparedIds.has(id) && allSpells.find((s) => s.id === id)?.level === 0)
        .length,
    [selectedSpellIds, allSpells, alwaysPreparedIds]
  )

  const selectedLeveledCount = useMemo(
    () =>
      selectedSpellIds.filter((id) => {
        if (alwaysPreparedIds.has(id)) return false
        const spell = allSpells.find((s) => s.id === id)
        return spell && spell.level > 0
      }).length,
    [selectedSpellIds, allSpells, alwaysPreparedIds]
  )

  const toggleSpell = useCallback(
    (id: string): void => {
      // Prevent toggling always-prepared spells
      if (alwaysPreparedIds.has(id)) return
      if (selectedSpellIds.includes(id)) {
        setSelectedSpellIds(selectedSpellIds.filter((s) => s !== id))
        setWarning(null)
      } else {
        const spell = allSpells.find((s) => s.id === id)
        if (!spell) return

        // Enforce cantrip limit
        if (spell.level === 0 && cantripsMax > 0 && selectedCantripsCount >= cantripsMax) {
          setWarning(`Cantrip limit reached (${cantripsMax}). Deselect one before adding another.`)
          return
        }

        // Enforce prepared spells limit
        if (spell.level > 0 && preparedMax !== null && selectedLeveledCount >= preparedMax) {
          setWarning(`Prepared spells limit reached (${preparedMax}). Deselect one before adding another.`)
          return
        }

        // Enforce spell level validation
        if (spell.level > 0) {
          const maxSpellLevel = Object.keys(slotProgression)
            .map(Number)
            .filter((lvl) => (slotProgression[lvl] ?? 0) > 0)
            .reduce((max, lvl) => Math.max(max, lvl), 0)
          if (spell.level > maxSpellLevel) {
            setWarning(`You can't learn level ${spell.level} spells yet. Max spell level: ${maxSpellLevel || 'none'}.`)
            return
          }
        }

        setWarning(null)
        setSelectedSpellIds([...selectedSpellIds, id])
      }
    },
    [
      selectedSpellIds,
      setSelectedSpellIds,
      allSpells,
      cantripsMax,
      selectedCantripsCount,
      preparedMax,
      selectedLeveledCount,
      slotProgression,
      alwaysPreparedIds
    ]
  )

  // Spell level groups
  const spellLevels = [...new Set(availableSpells.map((s) => s.level))].sort((a, b) => a - b)

  if (!classSlot?.selectedName) {
    return (
      <div>
        <SectionBanner label="SPELLS" />
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-500 italic">Select a class first to see available spell lists.</p>
        </div>
      </div>
    )
  }

  // Non-caster with species spells: show species spells section
  if (!isCaster) {
    if (speciesSpells.length > 0) {
      return (
        <div>
          <SectionBanner label="SPELLS" />
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-sm text-gray-500">
              {className} is not a spellcasting class, but you have spells from your species traits.
            </p>
          </div>
          <div className="px-4 py-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Species Spells ({speciesSpells.length})
            </div>
            {speciesSpells.map((spell) => (
              <SpellRow
                key={spell.id}
                spell={{
                  id: spell.id,
                  name: spell.name,
                  level: spell.level,
                  school: spell.school,
                  castingTime: spell.castingTime,
                  range: spell.range,
                  duration: spell.duration,
                  description: spell.description
                }}
                selected={true}
                onToggle={() => {}}
              />
            ))}
          </div>
        </div>
      )
    }

    return (
      <div>
        <SectionBanner label="SPELLS" />
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-500">{className} is not a spellcasting class.</p>
          <p className="text-xs text-gray-600 mt-1">
            Spellcasting becomes available through subclass features like Eldritch Knight or Arcane Trickster.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionBanner label="SPELLS" />
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-300">
            <span className="text-amber-300 font-medium">{className}</span> spell list
          </p>
          <span className="text-xs text-gray-500">Level {targetLevel}</span>
        </div>

        {/* Spell slot summary */}
        {Object.keys(slotProgression).length > 0 && (
          <div className="mb-2">
            {isWarlockPactMagic(classId) && (
              <div className="text-[10px] text-purple-400 uppercase tracking-wide mb-1">Pact Magic Slots</div>
            )}
            <div className="flex gap-2">
              {Object.entries(slotProgression).map(([lvl, count]) => (
                <div
                  key={lvl}
                  className={`rounded px-2 py-1 text-center ${isWarlockPactMagic(classId) ? 'bg-purple-900/30' : 'bg-gray-800'}`}
                >
                  <div className="text-[10px] text-gray-500">
                    {lvl}
                    {ordinal(Number(lvl))}
                  </div>
                  <div
                    className={`text-sm font-bold ${isWarlockPactMagic(classId) ? 'text-purple-400' : 'text-amber-400'}`}
                  >
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cantripsMax > 0 && (
          <div className="text-xs text-gray-500 mb-1">
            Cantrips known:{' '}
            <span className={selectedCantripsCount >= cantripsMax ? 'text-red-400' : 'text-amber-400'}>
              {selectedCantripsCount}
            </span>{' '}
            / {cantripsMax}
          </div>
        )}

        {preparedMax !== null && (
          <div className="text-xs text-gray-500 mb-1">
            Prepared Spells:{' '}
            <span className={selectedLeveledCount >= preparedMax ? 'text-red-400' : 'text-amber-400'}>
              {selectedLeveledCount}
            </span>{' '}
            / {preparedMax}
          </div>
        )}

        {speciesSpells.length > 0 && (
          <div className="text-xs text-gray-500 mb-1">
            Species spells:<span className="text-amber-400">{speciesSpells.length}</span>
            <span className="text-gray-600 ml-1">(auto-included)</span>
          </div>
        )}

        {alwaysPreparedIds.size > 0 && (
          <div className="text-xs text-gray-500 mb-1">
            Always prepared: <span className="text-green-400">{alwaysPreparedIds.size}</span>
            <span className="text-gray-600 ml-1">(from class features, not counted against limit)</span>
          </div>
        )}

        {warning && <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 mt-1">{warning}</div>}
      </div>

      {/* Blessed Warrior cantrip picker */}
      {isBlessedWarrior && (
        <div className="px-4 py-2 border-b border-gray-800">
          <BlessedWarriorPicker
            allSpells={allSpells}
            selectedCantrips={blessedWarriorCantrips}
            onSelect={setBlessedWarriorCantrips}
          />
        </div>
      )}

      {/* Your Selected Spells summary (exclude always-prepared) */}
      {selectedSpellIds.filter((id) => !alwaysPreparedIds.has(id)).length > 0 && (
        <SelectedSpellsSummary
          selectedSpellIds={selectedSpellIds.filter((id) => !alwaysPreparedIds.has(id))}
          allSpells={allSpells}
          onRemove={(id) => setSelectedSpellIds(selectedSpellIds.filter((s) => s !== id))}
        />
      )}

      {/* Always-prepared spells (Druid: Speak with Animals, etc.) */}
      {alwaysPreparedIds.size > 0 && (
        <div className="border-b border-gray-800">
          <div className="px-4 py-1 bg-gray-900/60">
            <span className="text-xs font-semibold text-green-400 uppercase">
              Always Prepared
              <span className="text-gray-600 ml-1">({alwaysPreparedIds.size})</span>
            </span>
          </div>
          {Array.from(alwaysPreparedIds).map((id) => {
            const spell = allSpells.find((s) => s.id === id)
            if (!spell) return null
            return (
              <SpellRow
                key={spell.id}
                spell={{
                  id: spell.id,
                  name: spell.name,
                  level: spell.level,
                  school: spell.school,
                  castingTime: spell.castingTime || spell.castTime,
                  range: spell.range,
                  duration: spell.duration,
                  description: spell.description
                }}
                selected={true}
                onToggle={() => {}}
              />
            )
          })}
        </div>
      )}

      {/* Species spells (shown separately if present) */}
      {speciesSpells.length > 0 && (
        <div className="border-b border-gray-800">
          <div className="px-4 py-1 bg-gray-900/60">
            <span className="text-xs font-semibold text-purple-400 uppercase">
              Species Spells
              <span className="text-gray-600 ml-1">({speciesSpells.length})</span>
            </span>
          </div>
          {speciesSpells.map((spell) => (
            <SpellRow
              key={spell.id}
              spell={{
                id: spell.id,
                name: spell.name,
                level: spell.level,
                school: spell.school,
                castingTime: spell.castingTime,
                range: spell.range,
                duration: spell.duration,
                description: spell.description
              }}
              selected={true}
              onToggle={() => {}}
            />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-2 border-b border-gray-800 flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search spells..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none"
        >
          <option value="all">All levels</option>
          <option value="0">Cantrips</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
            <option key={l} value={l}>
              {l}
              {ordinal(l)} level
            </option>
          ))}
        </select>
      </div>

      {/* Spell list */}
      {availableSpells.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-500">No spells found. Spell data may not be loaded yet.</p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {spellLevels.map((level) => {
            const spells = availableSpells.filter((s) => s.level === level)
            if (spells.length === 0) return null
            return (
              <div key={level}>
                <div className="px-4 py-1 bg-gray-900/60 sticky top-0">
                  <span className="text-xs font-semibold text-gray-400 uppercase">
                    {level === 0 ? 'Cantrips' : `${level}${ordinal(level)} Level`}
                    <span className="text-gray-600 ml-1">({spells.length})</span>
                  </span>
                </div>
                {spells.map((spell) => (
                  <SpellRow
                    key={spell.id}
                    spell={spell}
                    selected={selectedSpellIds.includes(spell.id)}
                    onToggle={() => toggleSpell(spell.id)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ordinal(n: number): string {
  if (n === 1) return 'st'
  if (n === 2) return 'nd'
  if (n === 3) return 'rd'
  return 'th'
}
