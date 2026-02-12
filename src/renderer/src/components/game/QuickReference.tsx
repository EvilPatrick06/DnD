import { useState, useMemo } from 'react'
import type { GameSystem } from '../../types/game-system'
import { getConditionsForSystem, type ConditionDef } from '../../data/conditions'

type Tab = 'conditions' | 'actions' | 'dcs' | 'spells'

interface QuickReferenceProps {
  system: GameSystem
}

interface ActionDef {
  name: string
  description: string
  system: 'dnd5e' | 'pf2e' | 'both'
}

interface DCEntry {
  label: string
  dc: number
}

const ACTIONS_5E: ActionDef[] = [
  {
    name: 'Attack',
    description:
      'Make a melee or ranged attack. You can substitute one attack for a grapple or shove when you have Extra Attack.',
    system: 'dnd5e'
  },
  {
    name: 'Cast a Spell',
    description:
      'Cast a spell with a casting time of 1 action. Some spells use a bonus action or reaction instead.',
    system: 'dnd5e'
  },
  {
    name: 'Dash',
    description:
      'Gain extra movement equal to your speed (after modifiers) for the current turn.',
    system: 'dnd5e'
  },
  {
    name: 'Disengage',
    description:
      'Your movement does not provoke opportunity attacks for the rest of the turn.',
    system: 'dnd5e'
  },
  {
    name: 'Dodge',
    description:
      'Until your next turn, attacks against you have disadvantage (if you can see the attacker), and you make DEX saves with advantage.',
    system: 'dnd5e'
  },
  {
    name: 'Help',
    description:
      'Give an ally advantage on their next ability check or attack roll against a target within 5 ft of you.',
    system: 'dnd5e'
  },
  {
    name: 'Hide',
    description:
      'Make a Dexterity (Stealth) check to become hidden. Must be unseen and have cover/concealment.',
    system: 'dnd5e'
  },
  {
    name: 'Ready',
    description:
      'Prepare an action to trigger on a specified condition. Uses your reaction when triggered. Readied spells require concentration.',
    system: 'dnd5e'
  },
  {
    name: 'Search',
    description:
      'Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.',
    system: 'dnd5e'
  },
  {
    name: 'Use an Object',
    description:
      'Interact with a second object on your turn (first interaction is free), such as drinking a potion.',
    system: 'dnd5e'
  }
]

const ACTIONS_PF2E: ActionDef[] = [
  {
    name: 'Strike',
    description:
      'Make a melee or ranged attack against a target. Each additional Strike in a turn takes a cumulative -5 penalty (-4 with agile weapons).',
    system: 'pf2e'
  },
  {
    name: 'Cast a Spell',
    description:
      'Cast a spell. Most spells cost 2 actions. Some are 1 action, 3 actions, or free actions.',
    system: 'pf2e'
  },
  {
    name: 'Stride',
    description: 'Move up to your Speed. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Step',
    description:
      'Move 5 feet without triggering reactions. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Interact',
    description:
      'Grab an object, open a door, draw a weapon, or otherwise use your hands. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Raise a Shield',
    description:
      'Gain the shield\'s circumstance bonus to AC until your next turn. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Seek',
    description:
      'Make a Perception check to locate an undetected or hidden creature, or to find details. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Hide',
    description:
      'Make a Stealth check to become hidden from selected creatures. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Recall Knowledge',
    description:
      'Attempt a skill check to recall useful information about a subject. Costs 1 action.',
    system: 'pf2e'
  },
  {
    name: 'Ready',
    description:
      'Prepare an action with a trigger. Costs 2 actions. Uses your reaction when triggered.',
    system: 'pf2e'
  },
  {
    name: 'Delay',
    description:
      'Wait to act later in the initiative order. You drop out of initiative until you choose to return.',
    system: 'pf2e'
  }
]

const COMMON_DCS: DCEntry[] = [
  { label: 'Easy', dc: 10 },
  { label: 'Medium', dc: 15 },
  { label: 'Hard', dc: 20 },
  { label: 'Very Hard', dc: 25 },
  { label: 'Nearly Impossible', dc: 30 }
]

function CollapsibleEntry({
  name,
  description,
  suffix
}: {
  name: string
  description: string
  suffix?: string
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/50 cursor-pointer transition-colors"
      >
        <span className="text-sm font-medium text-gray-200">
          {name}
          {suffix && (
            <span className="ml-2 text-xs text-gray-500">{suffix}</span>
          )}
        </span>
        <span className="text-gray-500 text-xs">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-sm text-gray-400 leading-relaxed border-t border-gray-800/50">
          {description}
        </div>
      )}
    </div>
  )
}

export default function QuickReference({
  system
}: QuickReferenceProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('conditions')
  const [search, setSearch] = useState('')

  const conditions = useMemo(() => getConditionsForSystem(system), [system])
  const actions = useMemo(
    () => (system === 'dnd5e' ? ACTIONS_5E : ACTIONS_PF2E),
    [system]
  )

  const lowerSearch = search.toLowerCase()

  const filteredConditions = useMemo(
    () =>
      conditions.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerSearch) ||
          c.description.toLowerCase().includes(lowerSearch)
      ),
    [conditions, lowerSearch]
  )

  const filteredActions = useMemo(
    () =>
      actions.filter(
        (a) =>
          a.name.toLowerCase().includes(lowerSearch) ||
          a.description.toLowerCase().includes(lowerSearch)
      ),
    [actions, lowerSearch]
  )

  const filteredDCs = useMemo(
    () =>
      COMMON_DCS.filter(
        (d) =>
          d.label.toLowerCase().includes(lowerSearch) ||
          String(d.dc).includes(lowerSearch)
      ),
    [lowerSearch]
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'conditions', label: 'Conditions' },
    { id: 'actions', label: 'Actions' },
    { id: 'dcs', label: 'Common DCs' },
    { id: 'spells', label: 'Spells' }
  ]

  function formatConditionSuffix(c: ConditionDef): string | undefined {
    if (c.hasValue && c.maxValue) {
      return `1\u2013${c.maxValue}`
    }
    return undefined
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSearch('')
            }}
            className={`
              flex-1 px-3 py-2 text-xs font-medium cursor-pointer transition-colors
              ${activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-500 hover:text-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {activeTab === 'conditions' && (
          <>
            {filteredConditions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No conditions match your search.
              </p>
            ) : (
              filteredConditions.map((c) => (
                <CollapsibleEntry
                  key={c.name}
                  name={c.name}
                  description={c.description}
                  suffix={formatConditionSuffix(c)}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'actions' && (
          <>
            {filteredActions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No actions match your search.
              </p>
            ) : (
              filteredActions.map((a) => (
                <CollapsibleEntry
                  key={a.name}
                  name={a.name}
                  description={a.description}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'dcs' && (
          <>
            {filteredDCs.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No DCs match your search.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredDCs.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-800"
                  >
                    <span className="text-sm text-gray-300">{d.label}</span>
                    <span className="text-lg font-bold text-amber-400">
                      DC {d.dc}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'spells' && (
          <div className="text-sm text-gray-500 py-8 text-center">
            Spell reference coming soon. Use the character sheet for your
            prepared spells.
          </div>
        )}
      </div>
    </div>
  )
}
