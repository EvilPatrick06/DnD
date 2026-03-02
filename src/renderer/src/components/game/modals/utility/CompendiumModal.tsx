import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DAMAGE_TYPES } from '../../../../constants'
import { loadSpells } from '../../../../services/character/spell-data'
import {
  load5eConditions,
  load5eDiseases,
  load5eEquipment,
  load5eFeats,
  load5eInvocations,
  load5eLanguages,
  load5eMagicItems,
  load5eMetamagic,
  load5eMonsters,
  load5ePoisons,
  load5eWeaponMastery
} from '../../../../services/data-provider'

interface CompendiumModalProps {
  onClose: () => void
}

type TabId =
  | 'actions'
  | 'conditions'
  | 'cover'
  | 'damageTypes'
  | 'weapons'
  | 'dcs'
  | 'spells'
  | 'monsters'
  | 'equipment'
  | 'feats'
  | 'magicItems'
  | 'diseasesPoisons'
  | 'languages'
  | 'weaponMastery'
  | 'invocations'
  | 'metamagic'

const TABS: { id: TabId; label: string }[] = [
  { id: 'actions', label: 'Actions' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'cover', label: 'Cover' },
  { id: 'damageTypes', label: 'Damage Types' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'dcs', label: 'DCs' },
  { id: 'spells', label: 'Spells' },
  { id: 'monsters', label: 'Monsters' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'feats', label: 'Feats' },
  { id: 'magicItems', label: 'Magic Items' },
  { id: 'diseasesPoisons', label: 'Diseases/Poisons' },
  { id: 'languages', label: 'Languages' },
  { id: 'weaponMastery', label: 'Weapon Mastery' },
  { id: 'invocations', label: 'Invocations' },
  { id: 'metamagic', label: 'Metamagic' }
]

// Static data for Actions tab
const ACTIONS_DATA = [
  { name: 'Attack', description: 'Attack with a weapon or Unarmed Strike.' },
  { name: 'Dash', description: 'Extra movement equal to your Speed for the rest of the turn.' },
  { name: 'Disengage', description: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn." },
  {
    name: 'Dodge',
    description:
      'Attack rolls against you have Disadvantage; you have Advantage on DEX saves. Lost if Incapacitated or Speed is 0.'
  },
  {
    name: 'Help',
    description:
      'Give an ally Advantage on their next ability check (within 10 ft) or attack roll (within 5 ft) before your next turn.'
  },
  { name: 'Hide', description: 'Make a Stealth check to become Hidden. DC = passive Perception of observers.' },
  {
    name: 'Influence',
    description:
      "Make a CHA check to alter a creature's attitude: Persuasion (Indifferent/Friendly), Deception, or Intimidation (Hostile)."
  },
  { name: 'Magic', description: 'Cast a spell, use a magic item, or use a magical feature.' },
  { name: 'Ready', description: 'Choose a trigger and an action to take as a Reaction when that trigger occurs.' },
  { name: 'Search', description: 'Make a Perception or Investigation check to notice or find something.' },
  {
    name: 'Study',
    description: 'Make an Arcana, History, Investigation, Nature, or Religion check to recall or analyze information.'
  },
  {
    name: 'Utilize',
    description: 'Use a non-magical object or tool, or interact with an object that requires an action.'
  }
]

// Static data for Cover tab
const COVER_DATA = [
  {
    name: 'Half Cover',
    description: 'Target has +2 to AC and DEX saves. Blocked by obstacle covering at least half the target.'
  },
  {
    name: 'Three-Quarters Cover',
    description: 'Target has +5 to AC and DEX saves. Blocked by obstacle covering about three-quarters of the target.'
  },
  {
    name: 'Total Cover',
    description: "Target can't be targeted directly by attacks or spells. Completely concealed by an obstacle."
  }
]

// Static DC reference table
const DC_DATA = [
  { name: 'Very Easy (DC 5)', description: 'A trivial task that almost anyone can accomplish.' },
  { name: 'Easy (DC 10)', description: 'A task that most people can manage with little effort.' },
  { name: 'Medium (DC 15)', description: 'A task requiring focused effort; adventurers succeed about half the time.' },
  { name: 'Hard (DC 20)', description: 'A task demanding significant skill or luck.' },
  { name: 'Very Hard (DC 25)', description: 'A task achievable only by highly skilled or lucky individuals.' },
  { name: 'Nearly Impossible (DC 30)', description: 'An extraordinary task at the limit of mortal ability.' }
]

interface DisplayItem {
  name: string
  description: string
}

export default function CompendiumModal({ onClose }: CompendiumModalProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('actions')
  const [search, setSearch] = useState('')
  const [tabData, setTabData] = useState<DisplayItem[]>([])
  const [loading, setLoading] = useState(false)
  const cache = useRef(new Map<TabId, DisplayItem[]>())

  // Load data for active tab
  useEffect(() => {
    const loadTabData = async (): Promise<void> => {
      // Check cache
      if (cache.current.has(activeTab)) {
        setTabData(cache.current.get(activeTab)!)
        return
      }

      // Static tabs
      if (activeTab === 'actions') {
        cache.current.set(activeTab, ACTIONS_DATA)
        setTabData(ACTIONS_DATA)
        return
      }
      if (activeTab === 'cover') {
        cache.current.set(activeTab, COVER_DATA)
        setTabData(COVER_DATA)
        return
      }
      if (activeTab === 'dcs') {
        cache.current.set(activeTab, DC_DATA)
        setTabData(DC_DATA)
        return
      }
      if (activeTab === 'damageTypes') {
        const items = DAMAGE_TYPES.map((d) => ({ name: d.charAt(0).toUpperCase() + d.slice(1), description: '' }))
        cache.current.set(activeTab, items)
        setTabData(items)
        return
      }

      setLoading(true)
      try {
        let items: DisplayItem[] = []
        switch (activeTab) {
          case 'conditions': {
            const data = await load5eConditions()
            items = data.map((c) => ({ name: c.name, description: c.description ?? '' }))
            break
          }
          case 'weapons': {
            const data = await load5eEquipment()
            const weapons = data.weapons ?? []
            items = weapons.map((w) => ({
              name: w.name ?? '',
              description: `${w.damage ?? ''} ${w.properties ? `(${w.properties.join(', ')})` : ''}`
            }))
            break
          }
          case 'spells': {
            const data = await loadSpells()
            items = data.map((s) => ({
              name: s.name,
              description: `Level ${s.level} ${s.school}${s.classes ? ` — ${s.classes.join(', ')}` : ''}`
            }))
            break
          }
          case 'monsters': {
            const data = await load5eMonsters()
            items = data.map((m) => ({
              name: m.name,
              description: `CR ${m.cr ?? '?'} ${m.type ?? ''} — ${m.size ?? ''}`
            }))
            break
          }
          case 'equipment': {
            const data = await load5eEquipment()
            const allItems = [...(data.armor ?? []), ...(data.gear ?? [])]
            items = allItems.map((e) => ({
              name: e.name ?? '',
              description: e.description ?? (e.cost ? `Cost: ${e.cost}` : '')
            }))
            break
          }
          case 'feats': {
            const data = await load5eFeats()
            items = data.map((f) => ({
              name: f.name,
              description: f.description?.slice(0, 120) ?? f.prerequisites?.join(', ') ?? ''
            }))
            break
          }
          case 'magicItems': {
            const data = await load5eMagicItems()
            items = data.map((m) => ({
              name: m.name,
              description: `${m.rarity ?? ''} ${m.type ?? ''}${m.attunement ? ' (attunement)' : ''}`
            }))
            break
          }
          case 'diseasesPoisons': {
            const [diseases, poisons] = await Promise.all([load5eDiseases(), load5ePoisons()])
            items = [
              ...diseases.map((d) => ({
                name: `[Disease] ${d.name}`,
                description: d.description?.slice(0, 120) ?? ''
              })),
              ...poisons.map((p) => ({ name: `[Poison] ${p.name}`, description: p.description?.slice(0, 120) ?? '' }))
            ]
            break
          }
          case 'languages': {
            const data = await load5eLanguages()
            items = data.map((l) => ({
              name: l.name,
              description: l.script ? `Script: ${l.script}` : (l.typicalSpeakers ?? '')
            }))
            break
          }
          case 'weaponMastery': {
            const data = await load5eWeaponMastery()
            items = data.map((w) => ({
              name: w.name,
              description: w.description ?? ''
            }))
            break
          }
          case 'invocations': {
            const data = await load5eInvocations()
            items = data.map((i) => ({
              name: i.name,
              description: i.prerequisites ? `Level ${i.levelRequirement}+` : (i.description?.slice(0, 120) ?? '')
            }))
            break
          }
          case 'metamagic': {
            const data = await load5eMetamagic()
            items = data.map((m) => ({
              name: m.name,
              description: `${m.sorceryPointCost ?? ''} SP — ${m.description?.slice(0, 100) ?? ''}`
            }))
            break
          }
        }
        cache.current.set(activeTab, items)
        setTabData(items)
      } catch {
        setTabData([])
      } finally {
        setLoading(false)
      }
    }
    loadTabData()
  }, [activeTab])

  // Filtered items
  const filtered = useMemo(() => {
    if (!search.trim()) return tabData
    const q = search.toLowerCase()
    return tabData.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
  }, [tabData, search])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    setSearch('')
  }, [])

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 max-w-5xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-semibold text-gray-200">Rules Compendium</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 outline-none focus:border-amber-500/50 shrink-0"
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-0.5 mb-3 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-600/25 border border-amber-500/50 text-amber-300'
                  : 'bg-gray-800/40 border border-gray-700/30 text-gray-400 hover:bg-gray-700/40 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-gray-500 text-xs">Loading...</div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              {search ? 'No results found.' : 'No data available.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {filtered.map((item) => (
                <div key={item.name} className="bg-gray-800/60 border border-gray-700/40 rounded-lg p-2">
                  <h4 className="text-xs font-semibold text-gray-200 mb-0.5">{item.name}</h4>
                  {item.description && <p className="text-[10px] text-gray-400 leading-relaxed">{item.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
