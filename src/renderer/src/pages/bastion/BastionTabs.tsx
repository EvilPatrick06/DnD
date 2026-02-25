import { useState } from 'react'
import { useBastionStore } from '../../stores/use-bastion-store'
import type { BasicFacilityDef, Bastion, SpecialFacilityDef } from '../../types/bastion'
import type { Character5e } from '../../types/character-5e'
import { ORDER_COLORS, ORDER_LABELS } from './bastion-constants'

export function SummaryCard({
  label,
  value,
  accent
}: {
  label: string
  value: string | number
  accent?: boolean
}): JSX.Element {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent ? 'text-yellow-400' : 'text-gray-100'}`}>{value}</div>
    </div>
  )
}

export function OverviewTab({
  bastion,
  ownerLevel: _ownerLevel,
  maxSpecial,
  onStartTurn
}: {
  bastion: Bastion
  ownerLevel: number
  maxSpecial: number
  onStartTurn: () => void
}): JSX.Element {
  const daysSinceTurn = bastion.inGameTime.currentDay - bastion.inGameTime.lastBastionTurnDay
  const daysUntilTurn = Math.max(0, bastion.inGameTime.turnFrequencyDays - daysSinceTurn)
  const turnReady = daysUntilTurn === 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Basic Facilities" value={bastion.basicFacilities.length} />
        <SummaryCard label="Special Facilities" value={`${bastion.specialFacilities.length}/${maxSpecial}`} />
        <SummaryCard label="Defenders" value={bastion.defenders.length} />
        <SummaryCard label="Treasury" value={`${bastion.treasury} GP`} accent />
      </div>

      {/* Turn status */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Bastion Turn Status</h3>
            <p className="text-xs text-gray-500 mt-1">
              {turnReady
                ? 'A bastion turn is ready! Assign orders and roll for events.'
                : `Next turn in ${daysUntilTurn} day${daysUntilTurn !== 1 ? 's' : ''} (every ${bastion.inGameTime.turnFrequencyDays} days)`}
            </p>
          </div>
          <button
            onClick={onStartTurn}
            className={`px-4 py-2 text-sm rounded font-semibold transition-colors ${
              turnReady ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {turnReady ? 'Start Turn' : 'Force Turn'}
          </button>
        </div>
      </div>

      {/* Construction queue */}
      {bastion.construction.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Construction Queue</h3>
          <div className="space-y-2">
            {bastion.construction.map((p) => {
              const pct = p.daysRequired > 0 ? Math.round((p.daysCompleted / p.daysRequired) * 100) : 100
              return (
                <div key={p.id} className="bg-gray-800 rounded p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 capitalize">
                      {p.projectType === 'add-special' && p.specialFacilityName
                        ? `Building: ${p.specialFacilityName}`
                        : `${p.projectType.replace(/-/g, ' ')}${p.facilityType ? `: ${p.facilityType}` : ''}`}
                    </span>
                    <span className="text-gray-500">
                      {p.daysCompleted}/{p.daysRequired} days ({p.cost} GP)
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active orders */}
      {bastion.specialFacilities.some((f) => f.currentOrder) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Active Orders</h3>
          {bastion.specialFacilities
            .filter((f) => f.currentOrder)
            .map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs mb-1">
                <span className="text-gray-300">{f.name}:</span>
                <span className={`px-1.5 py-0.5 rounded border ${ORDER_COLORS[f.currentOrder!]}`}>
                  {ORDER_LABELS[f.currentOrder!]}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Notes */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-2">Notes</h3>
        <textarea
          value={bastion.notes}
          onChange={(e) => useBastionStore.getState().updateNotes(bastion.id, e.target.value)}
          placeholder="Bastion notes..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
        />
      </div>
    </div>
  )
}

export function BasicTab({
  bastion,
  basicDefs,
  onAdd,
  onRemove
}: {
  bastion: Bastion
  basicDefs: BasicFacilityDef[]
  onAdd: () => void
  onRemove: (id: string) => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Basic Facilities ({bastion.basicFacilities.length})</h2>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
        >
          + Add Basic Facility
        </button>
      </div>
      {bastion.basicFacilities.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No basic facilities.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bastion.basicFacilities.map((f) => {
            const def = basicDefs.find((d) => d.type === f.type)
            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-100">{f.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                      {f.space}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemove(f.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {def && <p className="text-xs text-gray-500">{def.description}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SpecialTab({
  bastion,
  facilityDefs,
  owner5e: _owner5e,
  maxSpecial,
  onAdd,
  onRemove,
  onConfigure
}: {
  bastion: Bastion
  facilityDefs: SpecialFacilityDef[]
  owner5e: Character5e | null
  maxSpecial: number
  onAdd: () => void
  onRemove: (id: string) => void
  onConfigure: (id: string, config: Record<string, unknown>) => void
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">
          Special Facilities ({bastion.specialFacilities.length}/{maxSpecial})
        </h2>
        <button
          onClick={onAdd}
          disabled={bastion.specialFacilities.length >= maxSpecial}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
        >
          + Add Special Facility
        </button>
      </div>
      {bastion.specialFacilities.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">
          No special facilities. Add one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {bastion.specialFacilities.map((f) => {
            const def = facilityDefs.find((d) => d.type === f.type)
            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-100">{f.name}</span>
                    {def && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          def.setting === 'core'
                            ? 'bg-gray-800 text-gray-400 border-gray-700'
                            : def.setting === 'fr'
                              ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700'
                              : 'bg-orange-900/30 text-orange-400 border-orange-700'
                        }`}
                      >
                        Lv {def.level}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                      {f.space}
                    </span>
                    {f.enlarged && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700">
                        Enlarged
                      </span>
                    )}
                    {f.currentOrder && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${ORDER_COLORS[f.currentOrder]}`}>
                        {ORDER_LABELS[f.currentOrder]}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(f.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {def && <p className="text-xs text-gray-500 mb-2">{def.description}</p>}
                {def?.charm && (
                  <div className="text-xs text-purple-300 mb-2">
                    Charm: {def.charm.description} ({def.charm.duration})
                  </div>
                )}
                {def?.permanentBenefit && (
                  <div className="text-xs text-amber-300 mb-2">Benefit: {def.permanentBenefit}</div>
                )}
                {/* Order types */}
                {def && def.orders.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    {def.orders.map((o) => (
                      <span key={o} className={`text-xs px-1.5 py-0.5 rounded border ${ORDER_COLORS[o]}`}>
                        {ORDER_LABELS[o]}
                      </span>
                    ))}
                  </div>
                )}
                {/* Hirelings */}
                {def && def.hirelingCount > 0 && (
                  <div className="text-xs text-gray-500">
                    Hirelings:{' '}
                    {f.hirelingNames.length > 0 ? f.hirelingNames.join(', ') : `0/${def.hirelingCount} assigned`}
                  </div>
                )}
                {/* Type-specific config */}
                {f.type === 'garden' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Type:</span>
                    <select
                      value={f.gardenType || 'herb'}
                      onChange={(e) => onConfigure(f.id, { gardenType: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="decorative">Decorative</option>
                      <option value="food">Food</option>
                      <option value="herb">Herb</option>
                      <option value="poison">Poison</option>
                    </select>
                  </div>
                )}
                {f.type === 'training-area' && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Trainer:</span>
                    <select
                      value={f.trainerType || 'battle'}
                      onChange={(e) => onConfigure(f.id, { trainerType: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="battle">Battle</option>
                      <option value="skills">Skills</option>
                      <option value="tools">Tools</option>
                      <option value="unarmed-combat">Unarmed Combat</option>
                      <option value="weapon">Weapon</option>
                    </select>
                  </div>
                )}
                {/* Creatures (menagerie) */}
                {(f.type === 'menagerie' || f.type === 'emerald-enclave-grove') &&
                  f.creatures &&
                  f.creatures.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Creatures: </span>
                      {f.creatures.map((c, i) => (
                        <span key={i} className="text-xs text-gray-300">
                          {c.name} ({c.size}){i < (f.creatures?.length ?? 0) - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TurnsTab({ bastion, onStartTurn }: { bastion: Bastion; onStartTurn: () => void }): JSX.Element {
  const sortedTurns = [...bastion.turns].sort((a, b) => b.turnNumber - a.turnNumber)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Bastion Turns ({bastion.turns.length})</h2>
        <button
          onClick={onStartTurn}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
        >
          + New Turn
        </button>
      </div>
      {sortedTurns.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No turns recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {sortedTurns.map((turn) => (
            <div key={turn.turnNumber} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                    Turn {turn.turnNumber}
                  </span>
                  <span className="text-xs text-gray-500">{turn.inGameDate}</span>
                </div>
                {turn.resolvedAt ? (
                  <span className="text-xs text-green-400">Completed</span>
                ) : (
                  <span className="text-xs text-amber-400">In Progress</span>
                )}
              </div>
              {/* Orders */}
              {turn.orders.length > 0 && (
                <div className="space-y-1 mb-2">
                  {turn.orders.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded border ${ORDER_COLORS[o.orderType]}`}>
                        {ORDER_LABELS[o.orderType]}
                      </span>
                      <span className="text-gray-300">
                        {o.facilityName}: {o.details || 'No details'}
                      </span>
                      {(o.goldCost ?? 0) > 0 && <span className="text-red-400">-{o.goldCost} GP</span>}
                      {(o.goldGained ?? 0) > 0 && <span className="text-green-400">+{o.goldGained} GP</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Event */}
              {turn.eventOutcome && (
                <div className="bg-gray-800/50 rounded p-2 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                      d100: {turn.eventRoll}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{turn.eventType?.replace(/-/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-300">{turn.eventOutcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DefendersTab({
  bastion,
  onRecruit,
  onRemove,
  onBuildWalls
}: {
  bastion: Bastion
  onRecruit: () => void
  onRemove: (ids: string[]) => void
  onBuildWalls: () => void
}): JSX.Element {
  const barracks = bastion.specialFacilities.filter((f) => f.type === 'barrack')
  const hasArmory = bastion.specialFacilities.some((f) => f.type === 'armory')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Defenders" value={bastion.defenders.length} />
        <SummaryCard label="Barracks" value={barracks.length} />
        <SummaryCard label="Armory" value={hasArmory ? 'Stocked' : 'None'} />
      </div>

      {/* Defender roster by barrack */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Defender Roster</h3>
          <button
            onClick={onRecruit}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            + Recruit
          </button>
        </div>
        {barracks.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">
            Build a Barrack special facility to recruit defenders.
          </div>
        ) : (
          barracks.map((barrack) => {
            const defenders = bastion.defenders.filter((d) => d.barrackId === barrack.id)
            const max = barrack.space === 'vast' ? 25 : 12
            return (
              <div key={barrack.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-100">
                    {barrack.name} ({defenders.length}/{max})
                  </span>
                </div>
                {defenders.length === 0 ? (
                  <p className="text-xs text-gray-500">No defenders assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {defenders.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-1 text-xs bg-gray-800 rounded px-2 py-1 border border-gray-700"
                      >
                        <span className="text-gray-200">{d.name}</span>
                        {d.isUndead && <span className="text-purple-400">(Undead)</span>}
                        {d.isConstruct && <span className="text-orange-400">(Construct)</span>}
                        <button onClick={() => onRemove([d.id])} className="text-red-400 hover:text-red-300 ml-1">
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
        {/* Unassigned defenders */}
        {bastion.defenders.filter((d) => !d.barrackId).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <span className="font-medium text-sm text-gray-100 mb-2 block">Unassigned Defenders</span>
            <div className="flex flex-wrap gap-2">
              {bastion.defenders
                .filter((d) => !d.barrackId)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-1 text-xs bg-gray-800 rounded px-2 py-1 border border-gray-700"
                  >
                    <span className="text-gray-200">{d.name}</span>
                    <button onClick={() => onRemove([d.id])} className="text-red-400 hover:text-red-300 ml-1">
                      x
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Defensive Walls */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">Defensive Walls</h3>
          <button
            onClick={onBuildWalls}
            className="px-3 py-1.5 text-sm border border-gray-600 hover:border-amber-600 text-gray-300 hover:text-amber-400 rounded transition-colors"
          >
            + Build Walls
          </button>
        </div>
        {bastion.defensiveWalls ? (
          <div className="text-xs text-gray-400">
            {bastion.defensiveWalls.squaresBuilt} squares built
            {bastion.defensiveWalls.fullyEnclosed && (
              <span className="text-green-400 ml-2">(Fully enclosed: -2 attack losses)</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No defensive walls. Each 5-ft square costs 250 GP and 10 days.</p>
        )}
      </div>
    </div>
  )
}

export function EventsTab({ bastion }: { bastion: Bastion }): JSX.Element {
  const [filterType, setFilterType] = useState<string>('all')
  const events = bastion.turns.filter((t) => t.eventOutcome).sort((a, b) => b.turnNumber - a.turnNumber)

  const filteredEvents = filterType === 'all' ? events : events.filter((t) => t.eventType === filterType)

  const eventTypes = Array.from(new Set(events.map((t) => t.eventType).filter(Boolean))) as string[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Events Log ({filteredEvents.length})</h2>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Events</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      {filteredEvents.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-900 rounded-lg p-4">No events recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((turn) => (
            <div key={turn.turnNumber} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                  Turn {turn.turnNumber}
                </span>
                <span className="text-xs text-gray-500">{turn.inGameDate}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700">
                  d100: {turn.eventRoll}
                </span>
                <span className="text-xs text-gray-400 capitalize">{turn.eventType?.replace(/-/g, ' ')}</span>
              </div>
              <p className="text-sm text-gray-200">{turn.eventOutcome}</p>
              {turn.eventDetails && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(turn.eventDetails as Record<string, unknown>).goldGained != null && (
                    <span className="text-xs text-green-400">
                      +{String((turn.eventDetails as Record<string, unknown>).goldGained)} GP
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
