import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import {
  FULL_CASTERS_5E, HALF_CASTERS_5E,
  getCantripsKnown, getSlotProgression,
  getSpellsKnownMax, SPELLS_KNOWN_CLASSES
} from '../../services/spell-data'
import { getSpellsFromTraits } from '../../services/auto-populate-5e'

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

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
  heightened?: Record<string, string>
  classes?: string[]
  traditions?: string[]
  components?: unknown
  traits?: string[]
}


function SpellRow({ spell, selected, onToggle }: { spell: SpellData; selected: boolean; onToggle: () => void }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-2 px-4 py-1.5 hover:bg-gray-800/30">
        <button
          onClick={onToggle}
          className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
            selected
              ? 'bg-amber-600 border-amber-500 text-white'
              : 'border-gray-600 hover:border-gray-400'
          }`}
        >
          {selected && '\u2713'}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between text-left"
        >
          <span className={`text-sm ${selected ? 'text-gray-200' : 'text-gray-400'}`}>
            {spell.name}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {spell.concentration && <span className="text-yellow-600">C</span>}
            {spell.ritual && <span className="text-blue-500">R</span>}
            <span>{spell.school || (spell.traits ?? []).join(', ')}</span>
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
            <p className="text-gray-500"><span className="font-semibold">At Higher Levels:</span> {spell.higherLevels}</p>
          )}
          {spell.heightened && Object.entries(spell.heightened).map(([k, v]) => (
            <p key={k} className="text-gray-500"><span className="font-semibold">Heightened {k}:</span> {v}</p>
          ))}
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

export default function SpellsTab(): JSX.Element {
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const classSlot = buildSlots.find((s) => s.category === 'class')
  const raceSlot = buildSlots.find((s) => s.category === 'ancestry')
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const gameSystem = useBuilderStore((s) => s.gameSystem)
  const raceTraits = useBuilderStore((s) => s.raceTraits)

  const [allSpells, setAllSpells] = useState<SpellData[]>([])
  const selectedSpellIds = useBuilderStore((s) => s.selectedSpellIds)
  const setSelectedSpellIds = useBuilderStore((s) => s.setSelectedSpellIds)
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [warning, setWarning] = useState<string | null>(null)

  const classId = classSlot?.selectedId ?? ''
  const className = classSlot?.selectedName ?? ''
  const raceName = raceSlot?.selectedName ?? ''

  // Detect racial spells from traits
  const racialSpells = useMemo(() => {
    if (gameSystem !== 'dnd5e' || !raceTraits.length) return []
    return getSpellsFromTraits(
      raceTraits as Array<{ name: string; description: string; spellGranted?: string | { list: string; count: number } }>,
      raceName
    )
  }, [gameSystem, raceTraits, raceName])

  // Load spells
  useEffect(() => {
    const path = gameSystem === 'pf2e' ? './data/pf2e/spells.json' : './data/5e/spells.json'
    fetch(path)
      .then((r) => r.json())
      .then((data) => setAllSpells(data))
      .catch(() => setAllSpells([]))
  }, [gameSystem])

  // Compute slot info (must be before availableSpells useMemo which depends on slotProgression)
  const isCaster = FULL_CASTERS_5E.includes(classId) || HALF_CASTERS_5E.includes(classId)
  const slotProgression = gameSystem === 'dnd5e' ? getSlotProgression(classId, targetLevel) : {}
  const cantripsMax = gameSystem === 'dnd5e' ? getCantripsKnown(classId, targetLevel) : 5
  const spellsKnownMax = gameSystem === 'dnd5e' ? getSpellsKnownMax(classId, targetLevel) : null
  const isSpellsKnownClass = SPELLS_KNOWN_CLASSES.includes(classId)

  // Filter spells by class/tradition
  const availableSpells = useMemo(() => {
    let filtered = allSpells
    if (gameSystem === 'dnd5e' && classId) {
      filtered = filtered.filter((s) => s.classes?.includes(classId))
    }
    // For PF2e, filter by tradition (we'd need to know the class's tradition)

    // Filter out spells above max castable level
    if (gameSystem === 'dnd5e') {
      const maxSpellLevel = Object.keys(slotProgression)
        .map(Number)
        .filter(lvl => (slotProgression[lvl] ?? 0) > 0)
        .reduce((max, lvl) => Math.max(max, lvl), 0)
      filtered = filtered.filter(s => s.level === 0 || s.level <= maxSpellLevel)
    }
    if (gameSystem === 'pf2e') {
      const maxPf2eSpellLevel = Math.ceil(targetLevel / 2)
      filtered = filtered.filter(s => s.level === 0 || s.level <= maxPf2eSpellLevel)
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter((s) => s.level === levelFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q))
    }
    return filtered.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }, [allSpells, gameSystem, classId, levelFilter, search, slotProgression, targetLevel])

  // Count selected cantrips and leveled spells
  const selectedCantripsCount = useMemo(() =>
    selectedSpellIds.filter((id) => allSpells.find((s) => s.id === id)?.level === 0).length
  , [selectedSpellIds, allSpells])

  const selectedLeveledCount = useMemo(() =>
    selectedSpellIds.filter((id) => {
      const spell = allSpells.find((s) => s.id === id)
      return spell && spell.level > 0
    }).length
  , [selectedSpellIds, allSpells])

  const toggleSpell = useCallback((id: string): void => {
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

      // Enforce spells-known limit for spells-known classes
      if (spell.level > 0 && spellsKnownMax !== null && selectedLeveledCount >= spellsKnownMax) {
        setWarning(`Spells known limit reached (${spellsKnownMax}). Deselect one before adding another.`)
        return
      }

      // Enforce spell level validation for 5e
      if (gameSystem === 'dnd5e' && spell.level > 0) {
        const maxSpellLevel = Object.keys(slotProgression)
          .map(Number)
          .filter(lvl => (slotProgression[lvl] ?? 0) > 0)
          .reduce((max, lvl) => Math.max(max, lvl), 0)
        if (spell.level > maxSpellLevel) {
          setWarning(`You can't learn level ${spell.level} spells yet. Max spell level: ${maxSpellLevel || 'none'}.`)
          return
        }
      }

      // Enforce spell level validation for PF2e
      if (gameSystem === 'pf2e' && spell.level > 0) {
        const maxPf2eSpellLevel = Math.ceil(targetLevel / 2)
        if (spell.level > maxPf2eSpellLevel) {
          setWarning(`You can't learn level ${spell.level} spells yet. Max: ${maxPf2eSpellLevel}.`)
          return
        }
      }

      setWarning(null)
      setSelectedSpellIds([...selectedSpellIds, id])
    }
  }, [selectedSpellIds, setSelectedSpellIds, allSpells, cantripsMax, selectedCantripsCount, spellsKnownMax, selectedLeveledCount, gameSystem, slotProgression, targetLevel])

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

  // Non-caster with racial spells: show racial spells section
  if (gameSystem === 'dnd5e' && !isCaster) {
    if (racialSpells.length > 0) {
      return (
        <div>
          <SectionBanner label="SPELLS" />
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-sm text-gray-500">{className} is not a spellcasting class, but you have spells from your species traits.</p>
          </div>
          <div className="px-4 py-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Racial Spells ({racialSpells.length})
            </div>
            {racialSpells.map((spell) => (
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
          <div className="flex gap-2 mb-2">
            {Object.entries(slotProgression).map(([lvl, count]) => (
              <div key={lvl} className="bg-gray-800 rounded px-2 py-1 text-center">
                <div className="text-[10px] text-gray-500">{lvl}{ordinal(Number(lvl))}</div>
                <div className="text-sm font-bold text-amber-400">{count}</div>
              </div>
            ))}
          </div>
        )}

        {cantripsMax > 0 && (
          <div className="text-xs text-gray-500 mb-1">
            Cantrips known: <span className={selectedCantripsCount >= cantripsMax ? 'text-red-400' : 'text-amber-400'}>{selectedCantripsCount}</span> / {cantripsMax}
          </div>
        )}

        {isSpellsKnownClass && spellsKnownMax !== null && (
          <div className="text-xs text-gray-500 mb-1">
            Spells known: <span className={selectedLeveledCount >= spellsKnownMax ? 'text-red-400' : 'text-amber-400'}>{selectedLeveledCount}</span> / {spellsKnownMax}
          </div>
        )}

        {!isSpellsKnownClass && isCaster && (
          <div className="text-xs text-gray-500 mb-1">
            Spells selected: <span className="text-amber-400">{selectedLeveledCount}</span>
            <span className="text-gray-600 ml-1">(prepared caster)</span>
          </div>
        )}

        {racialSpells.length > 0 && (
          <div className="text-xs text-gray-500 mb-1">
            Racial spells: <span className="text-amber-400">{racialSpells.length}</span>
            <span className="text-gray-600 ml-1">(auto-included)</span>
          </div>
        )}

        {warning && (
          <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 mt-1">
            {warning}
          </div>
        )}
      </div>

      {/* Your Selected Spells summary */}
      {selectedSpellIds.length > 0 && (
        <SelectedSpellsSummary
          selectedSpellIds={selectedSpellIds}
          allSpells={allSpells}
          onRemove={(id) => setSelectedSpellIds(selectedSpellIds.filter((s) => s !== id))}
        />
      )}

      {/* Racial spells (shown separately if present) */}
      {racialSpells.length > 0 && (
        <div className="border-b border-gray-800">
          <div className="px-4 py-1 bg-gray-900/60">
            <span className="text-xs font-semibold text-purple-400 uppercase">
              Racial Spells
              <span className="text-gray-600 ml-1">({racialSpells.length})</span>
            </span>
          </div>
          {racialSpells.map((spell) => (
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
            <option key={l} value={l}>{l}{ordinal(l)} level</option>
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
