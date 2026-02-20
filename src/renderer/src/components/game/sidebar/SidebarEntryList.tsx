import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  NPC_BUILDS,
  NPC_CLOTHING_STYLES,
  NPC_DISTINGUISHING_FEATURES,
  NPC_HAIR_COLORS,
  NPC_HAIR_STYLES,
  NPC_HEIGHTS
} from '../../../data/npc-appearance'
import { NPC_MANNERISMS, NPC_VOICE_DESCRIPTIONS } from '../../../data/npc-mannerisms'
import { ALIGNMENT_PERSONALITY } from '../../../data/personality-tables'
import { loadAllStatBlocks, searchMonsters } from '../../../services/data-provider'
import { useGameStore } from '../../../stores/useGameStore'
import type { PlaceType, SidebarCategory, SidebarEntry, SidebarEntryStatBlock } from '../../../types/game-state'
import type { MapToken } from '../../../types/map'
import type { MonsterStatBlock } from '../../../types/monster'
import { monsterToSidebar, sidebarToDisplay } from '../../../utils/stat-block-converter'
import PlacesTree from './PlacesTree'
import StatBlockForm from './StatBlockForm'

const UnifiedStatBlock = lazy(() => import('../shared/UnifiedStatBlock'))

// --- NPC Templates (Part A) ---

interface NpcTemplate {
  name: string
  statBlock: SidebarEntryStatBlock
}

const NPC_TEMPLATES: NpcTemplate[] = [
  {
    name: 'Commoner',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '0',
      ac: 10,
      hpMax: 4,
      hpCurrent: 4,
      speeds: { walk: 30 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    }
  },
  {
    name: 'Guard',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '1/8',
      ac: 16,
      acSource: 'chain shirt, shield',
      hpMax: 11,
      hpCurrent: 11,
      speeds: { walk: 30 },
      abilityScores: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 }
    }
  },
  {
    name: 'Bandit',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '1/8',
      ac: 12,
      acSource: 'leather armor',
      hpMax: 11,
      hpCurrent: 11,
      speeds: { walk: 30 },
      abilityScores: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }
    }
  },
  {
    name: 'Noble',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '1/8',
      ac: 15,
      acSource: 'breastplate',
      hpMax: 9,
      hpCurrent: 9,
      speeds: { walk: 30 },
      abilityScores: { str: 11, dex: 12, con: 11, int: 12, wis: 14, cha: 16 }
    }
  },
  {
    name: 'Merchant',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '0',
      ac: 10,
      hpMax: 4,
      hpCurrent: 4,
      speeds: { walk: 30 },
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    }
  },
  {
    name: 'Priest',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '2',
      ac: 13,
      acSource: 'chain shirt',
      hpMax: 27,
      hpCurrent: 27,
      speeds: { walk: 30 },
      abilityScores: { str: 10, dex: 10, con: 12, int: 13, wis: 16, cha: 13 }
    }
  },
  {
    name: 'Mage',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '6',
      ac: 12,
      acSource: '15 with mage armor',
      hpMax: 40,
      hpCurrent: 40,
      speeds: { walk: 30 },
      abilityScores: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11 }
    }
  },
  {
    name: 'Veteran',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '3',
      ac: 17,
      acSource: 'splint armor',
      hpMax: 58,
      hpCurrent: 58,
      speeds: { walk: 30 },
      abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 }
    }
  },
  {
    name: 'Spy',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '1',
      ac: 12,
      hpMax: 27,
      hpCurrent: 27,
      speeds: { walk: 30 },
      abilityScores: { str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16 }
    }
  },
  {
    name: 'Assassin',
    statBlock: {
      size: 'Medium',
      creatureType: 'Humanoid',
      cr: '8',
      ac: 15,
      acSource: 'studded leather',
      hpMax: 78,
      hpCurrent: 78,
      speeds: { walk: 30 },
      abilityScores: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 }
    }
  }
]

// --- Random NPC Generator data (Part B) ---

const NPC_FIRST_NAMES = [
  'Alaric', 'Brynn', 'Cedric', 'Dara', 'Elara', 'Finn', 'Gwyn', 'Hector',
  'Isolde', 'Jasper', 'Kira', 'Lucian', 'Mira', 'Nolan', 'Orla', 'Pavel',
  'Quinn', 'Rhea', 'Silas', 'Thea', 'Ulric', 'Vera', 'Wren', 'Xander',
  'Yara', 'Zara'
]

const NPC_LAST_NAMES = [
  'Ashford', 'Blackwood', 'Copperfield', 'Dunmore', 'Evergreen', 'Fairwind',
  'Greystone', 'Hawthorne', 'Ironforge', 'Jadewater', 'Kingsley', 'Lightfoot',
  'Moorland', 'Nightingale', 'Oakheart', 'Proudfoot', 'Quicksilver',
  'Ravencroft', 'Stormwind', 'Thornwood'
]

const NPC_SPECIES = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Orc', 'Tiefling', 'Dragonborn'
]

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickRandomPersonalityTrait(): string {
  const allTraits: string[] = []
  for (const traitList of Object.values(ALIGNMENT_PERSONALITY)) {
    allTraits.push(...traitList)
  }
  return pickRandom(allTraits)
}

interface GeneratedNpc {
  name: string
  species: string
  height: string
  build: string
  hairColor: string
  hairStyle: string
  distinguishingFeature: string
  clothingStyle: string
  voice: string
  mannerism: string
  personalityTrait: string
}

interface GeneratedNpcLocks {
  name: boolean
  species: boolean
  height: boolean
  build: boolean
  hairColor: boolean
  hairStyle: boolean
  distinguishingFeature: boolean
  clothingStyle: boolean
  voice: boolean
  mannerism: boolean
  personalityTrait: boolean
}

function generateRandomNpc(locks?: GeneratedNpcLocks, current?: GeneratedNpc): GeneratedNpc {
  return {
    name: locks?.name && current ? current.name : `${pickRandom(NPC_FIRST_NAMES)} ${pickRandom(NPC_LAST_NAMES)}`,
    species: locks?.species && current ? current.species : pickRandom(NPC_SPECIES),
    height: locks?.height && current ? current.height : pickRandom(NPC_HEIGHTS),
    build: locks?.build && current ? current.build : pickRandom(NPC_BUILDS),
    hairColor: locks?.hairColor && current ? current.hairColor : pickRandom(NPC_HAIR_COLORS),
    hairStyle: locks?.hairStyle && current ? current.hairStyle : pickRandom(NPC_HAIR_STYLES),
    distinguishingFeature:
      locks?.distinguishingFeature && current
        ? current.distinguishingFeature
        : pickRandom(NPC_DISTINGUISHING_FEATURES),
    clothingStyle: locks?.clothingStyle && current ? current.clothingStyle : pickRandom(NPC_CLOTHING_STYLES),
    voice: locks?.voice && current ? current.voice : pickRandom(NPC_VOICE_DESCRIPTIONS),
    mannerism: locks?.mannerism && current ? current.mannerism : pickRandom(NPC_MANNERISMS),
    personalityTrait:
      locks?.personalityTrait && current ? current.personalityTrait : pickRandomPersonalityTrait()
  }
}

const DEFAULT_LOCKS: GeneratedNpcLocks = {
  name: false,
  species: false,
  height: false,
  build: false,
  hairColor: false,
  hairStyle: false,
  distinguishingFeature: false,
  clothingStyle: false,
  voice: false,
  mannerism: false,
  personalityTrait: false
}

const PLACE_TYPES: PlaceType[] = [
  'world', 'continent', 'kingdom', 'province', 'city',
  'district', 'building', 'room', 'dungeon', 'landmark'
]

const CATEGORY_LABELS: Record<SidebarCategory, string> = {
  allies: 'Allies',
  enemies: 'Enemies',
  places: 'Places'
}

interface SidebarEntryListProps {
  category: SidebarCategory
  entries: SidebarEntry[]
  isDM: boolean
  onAddToInitiative?: (entry: SidebarEntry) => void
  onReadAloud?: (text: string, style: 'chat' | 'dramatic') => void
}

export default function SidebarEntryList({
  category,
  entries,
  isDM,
  onAddToInitiative,
  onReadAloud
}: SidebarEntryListProps): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatBlock, setEditStatBlock] = useState<SidebarEntryStatBlock | undefined>(undefined)
  const [showStatBlock, setShowStatBlock] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newVisible, setNewVisible] = useState(false)
  const [newStatBlock, setNewStatBlock] = useState<SidebarEntryStatBlock | undefined>(undefined)
  const [showNewStatBlock, setShowNewStatBlock] = useState(false)
  const [addCreatureSearchOpen, setAddCreatureSearchOpen] = useState(false)
  // Unified stat block view state
  const [viewStatBlockId, setViewStatBlockId] = useState<string | null>(null)
  // Creature DB search modal state
  const [creatureSearchOpen, setCreatureSearchOpen] = useState(false)
  const [creatureSearchTarget, setCreatureSearchTarget] = useState<string | null>(null)
  const [creatureSearchQuery, setCreatureSearchQuery] = useState('')
  const [creatureSearchResults, setCreatureSearchResults] = useState<MonsterStatBlock[]>([])
  const [allCreatures, setAllCreatures] = useState<MonsterStatBlock[]>([])
  const [creaturesLoaded, setCreaturesLoaded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entryId: string } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [readAloudMenuId, setReadAloudMenuId] = useState<string | null>(null)
  const readAloudMenuRef = useRef<HTMLDivElement>(null)

  // Random NPC generator state
  const [showNpcGenerator, setShowNpcGenerator] = useState(false)
  const [generatedNpc, setGeneratedNpc] = useState<GeneratedNpc | null>(null)
  const [npcLocks, setNpcLocks] = useState<GeneratedNpcLocks>({ ...DEFAULT_LOCKS })

  // Places-specific state for add form
  const [newPlaceType, setNewPlaceType] = useState<PlaceType | ''>('')
  const [newParentId, setNewParentId] = useState<string>('')
  const [newLinkedMapId, setNewLinkedMapId] = useState<string>('')
  // Places-specific state for edit form
  const [editPlaceType, setEditPlaceType] = useState<PlaceType | ''>('')
  const [editParentId, setEditParentId] = useState<string>('')
  const [editLinkedMapId, setEditLinkedMapId] = useState<string>('')

  const isPlaces = category === 'places'

  const addSidebarEntry = useGameStore((s) => s.addSidebarEntry)
  const updateSidebarEntry = useGameStore((s) => s.updateSidebarEntry)
  const removeSidebarEntry = useGameStore((s) => s.removeSidebarEntry)
  const moveSidebarEntry = useGameStore((s) => s.moveSidebarEntry)
  const toggleEntryVisibility = useGameStore((s) => s.toggleEntryVisibility)
  const reparentPlace = useGameStore((s) => s.reparentPlace)
  const setActiveMap = useGameStore((s) => s.setActiveMap)
  const activeMapId = useGameStore((s) => s.activeMapId)
  const maps = useGameStore((s) => s.maps)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent): void => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [contextMenu])

  // Close read-aloud menu on click outside
  useEffect(() => {
    if (!readAloudMenuId) return
    const handleClick = (e: MouseEvent): void => {
      if (readAloudMenuRef.current && !readAloudMenuRef.current.contains(e.target as Node)) {
        setReadAloudMenuId(null)
      }
    }
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setReadAloudMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [readAloudMenuId])

  // Load creatures for search modal
  const loadCreatures = useCallback(async (): Promise<void> => {
    if (creaturesLoaded) return
    try {
      const all = await loadAllStatBlocks()
      setAllCreatures(all)
      setCreaturesLoaded(true)
    } catch {
      // silently fail
    }
  }, [creaturesLoaded])

  useEffect(() => {
    if ((creatureSearchOpen || addCreatureSearchOpen) && !creaturesLoaded) {
      void loadCreatures()
    }
  }, [creatureSearchOpen, addCreatureSearchOpen, creaturesLoaded, loadCreatures])

  useEffect(() => {
    if (!creatureSearchOpen && !addCreatureSearchOpen) return
    const results = searchMonsters(allCreatures, creatureSearchQuery)
    setCreatureSearchResults(results.slice(0, 50))
  }, [creatureSearchQuery, allCreatures, creatureSearchOpen, addCreatureSearchOpen])

  const openCreatureSearch = (entryId: string): void => {
    setCreatureSearchTarget(entryId)
    setCreatureSearchQuery('')
    setCreatureSearchResults([])
    setCreatureSearchOpen(true)
  }

  const linkCreatureToEntry = (entryId: string, monster: MonsterStatBlock): void => {
    const sidebarSB = monsterToSidebar(monster)
    updateSidebarEntry(category, entryId, {
      statBlock: sidebarSB,
      monsterStatBlockId: monster.id
    })
    setCreatureSearchOpen(false)
    setCreatureSearchTarget(null)
  }

  const importCreatureToAddForm = (monster: MonsterStatBlock): void => {
    const sidebarSB = monsterToSidebar(monster)
    setNewName(monster.name)
    setNewDesc(`${monster.size} ${monster.type} | CR ${monster.cr}`)
    setNewStatBlock(sidebarSB)
    setShowNewStatBlock(true)
    setAddCreatureSearchOpen(false)
  }

  const handleContextMenu = (e: React.MouseEvent, entryId: string): void => {
    if (!isDM) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, entryId })
  }

  const moveTargets = (['allies', 'enemies', 'places'] as SidebarCategory[]).filter((c) => c !== category)

  const visibleEntries = isDM ? entries : entries.filter((e) => e.visibleToPlayers)

  const startEdit = (entry: SidebarEntry): void => {
    setEditingId(entry.id)
    setEditName(entry.name)
    setEditDesc(entry.description || '')
    setEditNotes(entry.notes || '')
    setEditStatBlock(entry.statBlock)
    setShowStatBlock(!!entry.statBlock)
    if (isPlaces) {
      setEditPlaceType(entry.placeType || '')
      setEditParentId(entry.parentId || '')
      setEditLinkedMapId(entry.linkedMapId || '')
    }
  }

  const saveEdit = (): void => {
    if (!editingId || !editName.trim()) return
    const updates: Partial<SidebarEntry> = {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      notes: editNotes.trim() || undefined,
      statBlock: showStatBlock ? editStatBlock : undefined
    }
    if (isPlaces) {
      updates.placeType = editPlaceType || undefined
      updates.parentId = editParentId || undefined
      updates.linkedMapId = editLinkedMapId || undefined
    }
    updateSidebarEntry(category, editingId, updates)
    setEditingId(null)
    setShowStatBlock(false)
    setEditStatBlock(undefined)
  }

  const handleAdd = (): void => {
    if (!newName.trim()) return
    const newEntry: SidebarEntry = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      visibleToPlayers: newVisible,
      isAutoPopulated: false,
      statBlock: showNewStatBlock ? newStatBlock : undefined
    }
    if (isPlaces) {
      if (newPlaceType) newEntry.placeType = newPlaceType
      if (newParentId) newEntry.parentId = newParentId
      if (newLinkedMapId) newEntry.linkedMapId = newLinkedMapId
    }
    addSidebarEntry(category, newEntry)
    setNewName('')
    setNewDesc('')
    setNewVisible(false)
    setNewStatBlock(undefined)
    setShowNewStatBlock(false)
    setNewPlaceType('')
    setNewParentId('')
    setNewLinkedMapId('')
    setShowAdd(false)
  }

  // Get tokens from active map for Quick Add
  const activeMap = activeMapId ? maps.find((m) => m.id === activeMapId) : null
  const boardTokens: MapToken[] = activeMap?.tokens ?? []
  // Filter out tokens that already have a sidebar entry with the same entityId
  const existingEntityIds = new Set(entries.map((e) => e.sourceId).filter(Boolean))
  const availableBoardTokens = boardTokens.filter((t) => !existingEntityIds.has(t.id))

  const handleQuickAddFromToken = (token: MapToken): void => {
    const desc = [
      token.entityType ? `Type: ${token.entityType}` : '',
      token.ac ? `AC ${token.ac}` : '',
      token.maxHP ? `HP ${token.currentHP ?? token.maxHP}/${token.maxHP}` : '',
      token.walkSpeed ? `Speed ${token.walkSpeed} ft` : ''
    ]
      .filter(Boolean)
      .join(' | ')
    setNewName(token.label)
    setNewDesc(desc)
  }

  // Places-specific: edit form rendered inline (outside tree)
  const placesEditForm = isPlaces && editingId ? (
    <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-2.5 space-y-2">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
        Editing Place
      </span>
      <input
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
        placeholder="Name"
      />
      <select
        value={editPlaceType}
        onChange={(e) => setEditPlaceType(e.target.value as PlaceType | '')}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">No type</option>
        {PLACE_TYPES.map((pt) => (
          <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
        ))}
      </select>
      <select
        value={editParentId}
        onChange={(e) => setEditParentId(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">(Root level)</option>
        {entries.filter((e) => e.id !== editingId).map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <select
        value={editLinkedMapId}
        onChange={(e) => setEditLinkedMapId(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">No linked map</option>
        {maps.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <textarea
        value={editDesc}
        onChange={(e) => setEditDesc(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 resize-none"
        rows={2}
        placeholder="Description"
      />
      <textarea
        value={editNotes}
        onChange={(e) => setEditNotes(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 resize-none"
        rows={2}
        placeholder="DM Notes (hidden from players)"
      />
      <div className="flex gap-1">
        <button
          onClick={saveEdit}
          className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
        >
          Save
        </button>
        <button
          onClick={() => setEditingId(null)}
          className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null

  // Places-specific: add form fields
  const placesAddFields = isPlaces ? (
    <>
      <select
        value={newPlaceType}
        onChange={(e) => setNewPlaceType(e.target.value as PlaceType | '')}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">Place type (optional)</option>
        {PLACE_TYPES.map((pt) => (
          <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
        ))}
      </select>
      <select
        value={newParentId}
        onChange={(e) => setNewParentId(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">Parent (root level)</option>
        {entries.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <select
        value={newLinkedMapId}
        onChange={(e) => setNewLinkedMapId(e.target.value)}
        className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
      >
        <option value="">Linked map (optional)</option>
        {maps.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </>
  ) : null

  return (
    <div className="space-y-2">
      {/* Places tree view */}
      {isPlaces ? (
        <>
          <PlacesTree
            entries={entries}
            isDM={isDM}
            onEdit={startEdit}
            onToggleVisibility={(id) => toggleEntryVisibility('places', id)}
            onRemove={(id) => removeSidebarEntry('places', id)}
            onReparent={reparentPlace}
            onGoToMap={setActiveMap}
            onReadAloud={onReadAloud}
          />
          {placesEditForm}
        </>
      ) : (
        <>
          {visibleEntries.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No entries</p>}

          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              onContextMenu={(e) => handleContextMenu(e, entry.id)}
              className={`bg-gray-800/50 border rounded-lg p-2.5 ${
                !entry.visibleToPlayers && isDM ? 'border-gray-700/50 opacity-60' : 'border-gray-700/30'
              }`}
            >
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
                    placeholder="Name"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 resize-none"
                    rows={2}
                    placeholder="Description"
                  />
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 resize-none"
                    rows={2}
                    placeholder="DM Notes (hidden from players)"
                  />
                  {/* Stat Block section */}
                  <div className="border border-gray-700/40 rounded">
                    <button
                      type="button"
                      onClick={() => setShowStatBlock(!showStatBlock)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span>Stat Block {editStatBlock ? '(configured)' : ''}</span>
                      <span className="text-gray-500 text-[10px]">{showStatBlock ? '\u25B2' : '\u25BC'}</span>
                    </button>
                    {showStatBlock && (
                      <div className="px-2 pb-2">
                        <StatBlockForm statBlock={editStatBlock} onChange={setEditStatBlock} />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={saveEdit}
                      className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null)
                        setShowStatBlock(false)
                        setEditStatBlock(undefined)
                      }}
                      className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-200 truncate">{entry.name}</span>
                        {/* Category badge with click-to-cycle (DM only, allies/enemies only) */}
                        {isDM && (category === 'allies' || category === 'enemies') && (
                          <button
                            onClick={() => {
                              const target: SidebarCategory = category === 'allies' ? 'enemies' : 'allies'
                              moveSidebarEntry(category, target, entry.id)
                            }}
                            title={`Move to ${category === 'allies' ? 'Enemies' : 'Allies'}`}
                            className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
                              category === 'allies'
                                ? 'text-green-400 bg-green-400/10 hover:bg-red-400/10 hover:text-red-400'
                                : 'text-red-400 bg-red-400/10 hover:bg-green-400/10 hover:text-green-400'
                            }`}
                          >
                            {CATEGORY_LABELS[category]}
                          </button>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{entry.description}</p>
                      )}
                      {isDM && entry.notes && <p className="text-[10px] text-amber-400/70 mt-1 italic">{entry.notes}</p>}
                    </div>

                    {isDM && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onAddToInitiative && (
                          <button
                            onClick={() => onAddToInitiative(entry)}
                            title="Add to initiative"
                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-amber-400 cursor-pointer text-xs font-bold"
                          >
                            +
                          </button>
                        )}
                        {entry.description && onReadAloud && (
                          <div className="relative">
                            <button
                              onClick={() => setReadAloudMenuId(readAloudMenuId === entry.id ? null : entry.id)}
                              title="Read Aloud"
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-amber-400 cursor-pointer text-[10px]"
                            >
                              &#x1F4D6;
                            </button>
                            {readAloudMenuId === entry.id && (
                              <div
                                ref={readAloudMenuRef}
                                className="absolute right-0 top-7 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]"
                              >
                                <button
                                  onClick={() => {
                                    onReadAloud(entry.description!, 'chat')
                                    setReadAloudMenuId(null)
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 cursor-pointer"
                                >
                                  Send to Chat
                                </button>
                                <button
                                  onClick={() => {
                                    onReadAloud(entry.description!, 'dramatic')
                                    setReadAloudMenuId(null)
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-gray-800 hover:text-amber-300 cursor-pointer"
                                >
                                  Dramatic Reveal
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => toggleEntryVisibility(category, entry.id)}
                          title={entry.visibleToPlayers ? 'Hide from players' : 'Show to players'}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300 cursor-pointer text-xs"
                        >
                          {entry.visibleToPlayers ? '\u{1F441}' : '\u{1F441}\u{200D}\u{1F5E8}'}
                        </button>
                        <button
                          onClick={() => startEdit(entry)}
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-amber-400 cursor-pointer text-xs"
                          title="Edit"
                        >
                          &#9998;
                        </button>
                        {!entry.isAutoPopulated && (
                          <button
                            onClick={() => removeSidebarEntry(category, entry.id)}
                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 cursor-pointer text-xs"
                            title="Delete"
                          >
                            &#10005;
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {entry.isAutoPopulated && isDM && (
                    <span className="text-[9px] text-gray-600 mt-1 block">Auto-populated</span>
                  )}
                  {/* Stat block quick actions (DM only, allies/enemies) */}
                  {isDM && !isPlaces && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {entry.statBlock && (
                        <button
                          onClick={() => setViewStatBlockId(viewStatBlockId === entry.id ? null : entry.id)}
                          className="text-[10px] text-gray-500 hover:text-amber-400 cursor-pointer"
                        >
                          {viewStatBlockId === entry.id ? 'Hide Stat Block' : 'View Stat Block'}
                        </button>
                      )}
                      <button
                        onClick={() => openCreatureSearch(entry.id)}
                        className="text-[10px] text-gray-500 hover:text-amber-400 cursor-pointer"
                      >
                        Link from Creature DB
                      </button>
                      {entry.monsterStatBlockId && (
                        <span className="text-[9px] text-gray-600">
                          Linked: {entry.monsterStatBlockId}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Inline unified stat block view */}
                  {viewStatBlockId === entry.id && entry.statBlock && (
                    <div className="mt-2">
                      <Suspense fallback={<div className="text-[10px] text-gray-500">Loading...</div>}>
                        <UnifiedStatBlock statBlock={sidebarToDisplay(entry.statBlock, entry.name)} />
                      </Suspense>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Right-click context menu */}
          {contextMenu && (
            <div
              ref={contextMenuRef}
              className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {moveTargets.map((target) => (
                <button
                  key={target}
                  onClick={() => {
                    moveSidebarEntry(category, target, contextMenu.entryId)
                    setContextMenu(null)
                  }}
                  className="w-full px-4 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 cursor-pointer"
                >
                  Move to {CATEGORY_LABELS[target]}
                </button>
              ))}
              <div className="border-t border-gray-700/50 my-0.5" />
              <button
                onClick={() => {
                  toggleEntryVisibility(category, contextMenu.entryId)
                  setContextMenu(null)
                }}
                className="w-full px-4 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100 cursor-pointer"
              >
                Toggle Visibility
              </button>
              <button
                onClick={() => {
                  removeSidebarEntry(category, contextMenu.entryId)
                  setContextMenu(null)
                }}
                className="w-full px-4 py-1.5 text-left text-xs text-red-400 hover:bg-gray-800 hover:text-red-300 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}

      {/* Add new entry (DM only) */}
      {isDM &&
        (showAdd ? (
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-2.5 space-y-2">
            {/* Quick Add from Board Tokens (not for places) */}
            {!isPlaces && availableBoardTokens.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                  Quick Add from Board
                </span>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {availableBoardTokens.map((token) => (
                    <button
                      key={token.id}
                      onClick={() => handleQuickAddFromToken(token)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-gray-900/50 hover:bg-gray-800 text-left transition-colors cursor-pointer"
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border border-gray-600 flex items-center justify-center text-[8px] text-white font-bold"
                        style={{ backgroundColor: token.color || (token.entityType === 'enemy' ? '#dc2626' : '#2563eb') }}
                      >
                        {token.label.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-300 truncate">{token.label}</span>
                      {token.ac && <span className="text-[9px] text-gray-500 shrink-0 ml-auto">AC {token.ac}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Import from Creature DB (allies/enemies only) */}
            {!isPlaces && (
              <button
                onClick={() => {
                  setAddCreatureSearchOpen(true)
                  setCreatureSearchQuery('')
                  setCreatureSearchResults([])
                }}
                className="w-full py-1.5 text-[10px] text-center text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 border border-purple-500/30 rounded cursor-pointer transition-colors"
              >
                Import from Creature DB
              </button>
            )}

            {/* Use Template dropdown (allies/enemies only) */}
            {!isPlaces && (
              <select
                value=""
                onChange={(e) => {
                  const template = NPC_TEMPLATES.find((t) => t.name === e.target.value)
                  if (template) {
                    setNewName(template.name)
                    setNewStatBlock({ ...template.statBlock })
                    setShowNewStatBlock(true)
                  }
                }}
                className="w-full px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-[10px] text-gray-400 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">Use Template...</option>
                {NPC_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} (CR {t.statBlock.cr})
                  </option>
                ))}
              </select>
            )}

            {/* Generate Random NPC (allies/enemies only) */}
            {!isPlaces && (
              <button
                onClick={() => {
                  const npc = generateRandomNpc()
                  setGeneratedNpc(npc)
                  setNpcLocks({ ...DEFAULT_LOCKS })
                  setShowNpcGenerator(true)
                }}
                className="w-full py-1.5 text-[10px] text-center text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-500/30 rounded cursor-pointer transition-colors"
              >
                Generate Random NPC
              </button>
            )}

            {/* Random NPC Generator inline section */}
            {!isPlaces && showNpcGenerator && generatedNpc && (
              <div className="bg-gray-900/60 border border-emerald-500/30 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                    Generated NPC
                  </span>
                  <button
                    onClick={() => {
                      setGeneratedNpc(generateRandomNpc(npcLocks, generatedNpc))
                    }}
                    className="text-[10px] text-gray-400 hover:text-emerald-400 cursor-pointer"
                    title="Re-roll all unlocked fields"
                  >
                    Re-roll All
                  </button>
                </div>

                {/* Generator fields */}
                {(
                  [
                    ['name', 'Name', generatedNpc.name],
                    ['species', 'Species', generatedNpc.species],
                    ['height', 'Height', generatedNpc.height],
                    ['build', 'Build', generatedNpc.build],
                    ['hairColor', 'Hair Color', generatedNpc.hairColor],
                    ['hairStyle', 'Hair Style', generatedNpc.hairStyle],
                    ['distinguishingFeature', 'Feature', generatedNpc.distinguishingFeature],
                    ['clothingStyle', 'Clothing', generatedNpc.clothingStyle],
                    ['voice', 'Voice', generatedNpc.voice],
                    ['mannerism', 'Mannerism', generatedNpc.mannerism],
                    ['personalityTrait', 'Personality', generatedNpc.personalityTrait]
                  ] as [keyof GeneratedNpcLocks, string, string][]
                ).map(([field, label, value]) => (
                  <div key={field} className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setNpcLocks((prev) => ({ ...prev, [field]: !prev[field] }))
                      }
                      className={`w-5 h-5 flex items-center justify-center text-[10px] shrink-0 cursor-pointer rounded ${
                        npcLocks[field]
                          ? 'text-amber-400 bg-amber-400/20'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                      title={npcLocks[field] ? 'Unlock field' : 'Lock field'}
                    >
                      {npcLocks[field] ? '\u{1F512}' : '\u{1F513}'}
                    </button>
                    <span className="text-[9px] text-gray-500 w-16 shrink-0">{label}</span>
                    <span className="text-[10px] text-gray-200 flex-1 truncate">{value}</span>
                    <button
                      onClick={() => {
                        const singleLock = { ...DEFAULT_LOCKS }
                        // Lock everything except this field
                        for (const k of Object.keys(singleLock) as (keyof GeneratedNpcLocks)[]) {
                          singleLock[k] = k !== field
                        }
                        setGeneratedNpc(generateRandomNpc(singleLock, generatedNpc))
                      }}
                      className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-600 hover:text-emerald-400 cursor-pointer shrink-0"
                      title={`Re-roll ${label}`}
                    >
                      &#8635;
                    </button>
                  </div>
                ))}

                <div className="flex gap-1 pt-1">
                  <button
                    onClick={() => {
                      const npc = generatedNpc
                      setNewName(npc.name)
                      const appearance = [
                        `${npc.species}`,
                        `${npc.height}, ${npc.build} build`,
                        `${npc.hairColor} ${npc.hairStyle.toLowerCase()} hair`,
                        npc.distinguishingFeature,
                        `${npc.clothingStyle} clothing`
                      ].join('. ')
                      const desc = `${appearance}. Voice: ${npc.voice}. ${npc.mannerism}. Personality: ${npc.personalityTrait}.`
                      setNewDesc(desc)
                      setShowNpcGenerator(false)
                    }}
                    className="px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setShowNpcGenerator(false)}
                    className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="Name"
            />
            {placesAddFields}
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 resize-none"
              rows={2}
              placeholder="Description (optional)"
            />

            {/* Visibility toggle */}
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={newVisible}
                onChange={(e) => setNewVisible(e.target.checked)}
                className="accent-amber-500"
              />
              Visible to players
            </label>

            {/* Stat Block section (allies/enemies only) */}
            {!isPlaces && (
              <div className="border border-gray-700/40 rounded">
                <button
                  type="button"
                  onClick={() => setShowNewStatBlock(!showNewStatBlock)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <span>Stat Block {newStatBlock ? '(configured)' : ''}</span>
                  <span className="text-gray-500 text-[10px]">{showNewStatBlock ? '\u25B2' : '\u25BC'}</span>
                </button>
                {showNewStatBlock && (
                  <div className="px-2 pb-2">
                    <StatBlockForm statBlock={newStatBlock} onChange={setNewStatBlock} />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-1">
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAdd(false)
                  setNewName('')
                  setNewDesc('')
                  setNewVisible(false)
                  setNewStatBlock(undefined)
                  setShowNewStatBlock(false)
                  setNewPlaceType('')
                  setNewParentId('')
                  setNewLinkedMapId('')
                }}
                className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full py-2 text-xs text-gray-500 hover:text-amber-400 border border-dashed border-gray-700 hover:border-amber-600/50 rounded-lg transition-colors cursor-pointer"
          >
            + Add {isPlaces ? 'Place' : 'Entry'}
          </button>
        ))}

      {/* Creature DB Search Modal — Add flow (import into new entry form) */}
      {addCreatureSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddCreatureSearchOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-4 w-96 max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Import from Creature DB</h3>
              <button
                onClick={() => setAddCreatureSearchOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            <input
              type="text"
              value={creatureSearchQuery}
              onChange={(e) => setCreatureSearchQuery(e.target.value)}
              placeholder="Search creatures by name, type, or tag..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 mb-2"
              autoFocus
            />
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-80">
              {!creaturesLoaded && (
                <p className="text-xs text-gray-500 text-center py-4">Loading creatures...</p>
              )}
              {creaturesLoaded && creatureSearchResults.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  {creatureSearchQuery ? 'No creatures found' : 'Type to search'}
                </p>
              )}
              {creatureSearchResults.map((monster) => (
                <button
                  key={monster.id}
                  onClick={() => importCreatureToAddForm(monster)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 text-left transition-colors cursor-pointer border border-gray-700/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">{monster.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {monster.size} {monster.type} | CR {monster.cr}
                    </div>
                  </div>
                  <span className="text-[10px] text-purple-400 shrink-0 ml-2">Import</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Creature DB Search Modal — Edit flow (link to existing entry) */}
      {creatureSearchOpen && creatureSearchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreatureSearchOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-4 w-96 max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Link from Creature DB</h3>
              <button
                onClick={() => setCreatureSearchOpen(false)}
                className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>
            <input
              type="text"
              value={creatureSearchQuery}
              onChange={(e) => setCreatureSearchQuery(e.target.value)}
              placeholder="Search creatures by name, type, or tag..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-100 focus:outline-none focus:border-amber-500 mb-2"
              autoFocus
            />
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-80">
              {!creaturesLoaded && (
                <p className="text-xs text-gray-500 text-center py-4">Loading creatures...</p>
              )}
              {creaturesLoaded && creatureSearchResults.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  {creatureSearchQuery ? 'No creatures found' : 'Type to search'}
                </p>
              )}
              {creatureSearchResults.map((monster) => (
                <button
                  key={monster.id}
                  onClick={() => linkCreatureToEntry(creatureSearchTarget, monster)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 text-left transition-colors cursor-pointer border border-gray-700/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-200 truncate">{monster.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {monster.size} {monster.type} | CR {monster.cr}
                    </div>
                  </div>
                  <span className="text-[10px] text-amber-400 shrink-0 ml-2">Select</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
