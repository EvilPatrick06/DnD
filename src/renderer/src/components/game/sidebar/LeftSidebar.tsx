import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { rollSingle } from '../../../services/dice-service'
import { load5eMonsterById } from '../../../services/data-provider'
import { useBastionStore } from '../../../stores/useBastionStore'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Campaign, NPC } from '../../../types/campaign'
import type { Character } from '../../../types/character'
import type { InitiativeEntry, SidebarEntry, SidebarPanel as SidebarPanelType } from '../../../types/game-state'
import { getSizeTokenDimensions } from '../../../types/monster'
import { getCharacterSheetPath } from '../../../utils/character-routes'
import { NPCManager } from '../dm'
import VoiceAvatar from '../overlays/VoiceAvatar'
import SidebarEntryList from './SidebarEntryList'

type SectionId = 'characters' | 'bastions' | SidebarPanelType

interface LeftSidebarProps {
  campaign: Campaign
  campaignId: string
  isDM: boolean
  character: Character | null
  collapsed: boolean
  onToggleCollapse: () => void
  onReadAloud?: (text: string, style: 'chat' | 'dramatic') => void
}

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'characters', label: 'Characters', icon: '\u{1F464}' },
  { id: 'npcs', label: 'NPCs', icon: '\u{1F9D9}' },
  { id: 'allies', label: 'Allies', icon: '\u{1F6E1}' },
  { id: 'enemies', label: 'Enemies', icon: '\u{2694}' },
  { id: 'places', label: 'Places', icon: '\u{1F3F0}' },
  { id: 'bastions', label: 'Bastions', icon: '\u{1F3D7}' }
]

export default function LeftSidebar({
  campaign,
  campaignId,
  isDM,
  character,
  collapsed,
  onToggleCollapse,
  onReadAloud
}: LeftSidebarProps): JSX.Element {
  const navigate = useNavigate()
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null)

  const allies = useGameStore((s) => s.allies)
  const enemies = useGameStore((s) => s.enemies)
  const places = useGameStore((s) => s.places)
  const addToInitiative = useGameStore((s) => s.addToInitiative)
  const activeMapId = useGameStore((s) => s.activeMapId)

  // Voice state
  const players = useLobbyStore((s) => s.players)
  const remoteCharacters = useLobbyStore((s) => s.remoteCharacters)
  const localMuted = useLobbyStore((s) => s.localMuted)
  const localDeafened = useLobbyStore((s) => s.localDeafened)
  const toggleMute = useLobbyStore((s) => s.toggleMute)
  const toggleDeafen = useLobbyStore((s) => s.toggleDeafen)
  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const sendMessage = useNetworkStore((s) => s.sendMessage)
  const characters = useCharacterStore((s) => s.characters)
  const bastions = useBastionStore((s) => s.bastions)
  const loadBastions = useBastionStore((s) => s.loadBastions)

  const localPlayer = players.find((p) => p.peerId === localPeerId)
  const isForceMuted = localPlayer?.isForceMuted ?? false
  const isForceDeafened = localPlayer?.isForceDeafened ?? false
  const muteDisabled = isForceMuted || isForceDeafened
  const deafenDisabled = isForceDeafened

  const returnTo = `/game/${campaignId}`

  // Load bastions on mount
  useEffect(() => {
    loadBastions()
  }, [loadBastions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Collect character IDs from lobby players to filter bastions
  const playerCharacterIds = new Set(players.map((p) => p.characterId).filter(Boolean) as string[])
  const gameBastions = bastions.filter((b) => playerCharacterIds.has(b.ownerId))

  const handleToggleMute = (): void => {
    if (muteDisabled) return
    const wasMuted = localMuted
    toggleMute()
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: !wasMuted })
  }

  const handleToggleDeafen = (): void => {
    if (deafenDisabled) return
    const wasDeafened = localDeafened
    toggleDeafen()
    const newDeafened = !wasDeafened
    const newMuted = newDeafened ? true : localMuted
    sendMessage('voice:mute-toggle', { peerId: localPeerId, isMuted: newMuted })
    sendMessage('voice:deafen-toggle', { peerId: localPeerId, isDeafened: newDeafened })
    if (localPeerId) {
      useLobbyStore.getState().updatePlayer(localPeerId, { isDeafened: newDeafened })
    }
  }

  const toggleSection = (id: SectionId): void => {
    setExpandedSection(expandedSection === id ? null : id)
  }

  // Create an initiative entry from an NPC
  const handleNpcToInitiative = (npc: NPC): void => {
    const roll = rollSingle(20)
    const dexScore = npc.customStats?.abilityScores?.dex
    const modifier = dexScore != null ? Math.floor((dexScore - 10) / 2) : 0
    const entry: InitiativeEntry = {
      id: crypto.randomUUID(),
      entityId: npc.id,
      entityName: npc.name,
      entityType: 'npc',
      roll,
      modifier,
      total: roll + modifier,
      isActive: false
    }
    addToInitiative(entry)
  }

  // Create an initiative entry from a sidebar entry
  const handleSidebarEntryToInitiative = (entry: SidebarEntry, entityType: 'player' | 'enemy'): void => {
    const roll = rollSingle(20)
    const modifier = 0
    const initEntry: InitiativeEntry = {
      id: crypto.randomUUID(),
      entityId: entry.id,
      entityName: entry.name,
      entityType,
      roll,
      modifier,
      total: roll + modifier,
      isActive: false
    }
    addToInitiative(initEntry)
  }

  // Find character for a player
  const findCharacterForPlayer = (characterId: string | null): Character | null => {
    if (!characterId) return null
    return characters.find((c) => c.id === characterId) ?? remoteCharacters[characterId] ?? null
  }

  // Place NPC on map as a token
  const handlePlaceOnMap = async (npc: NPC): Promise<void> => {
    if (!activeMapId) return
    let statBlock = null
    if (npc.statBlockId) {
      statBlock = await load5eMonsterById(npc.statBlockId)
    }
    // Merge customStats over linked statBlock
    const merged = npc.customStats ? (statBlock ? { ...statBlock, ...npc.customStats } : npc.customStats) : statBlock

    const hp = merged?.hp ?? 10
    const ac = merged?.ac ?? 10
    const size = merged?.size ?? 'Medium'
    const tokenDims = getSizeTokenDimensions(size)
    const walkSpeed = merged?.speed?.walk ?? 30
    const dexMod = merged?.abilityScores ? Math.floor((merged.abilityScores.dex - 10) / 2) : 0

    // Use click-to-place instead of placing at (0,0)
    useGameStore.getState().setPendingPlacement({
      entityId: npc.id,
      entityType: npc.role === 'enemy' ? 'enemy' : 'npc',
      label: npc.name,
      sizeX: tokenDims.x,
      sizeY: tokenDims.y,
      visibleToPlayers: false,
      conditions: [],
      currentHP: hp,
      maxHP: hp,
      ac,
      monsterStatBlockId: npc.statBlockId,
      walkSpeed,
      initiativeModifier: dexMod
    })
  }

  const renderSectionContent = (id: SectionId): JSX.Element => {
    switch (id) {
      case 'characters':
        return (
          <div className="space-y-1.5">
            {players.map((player) => {
              const char = findCharacterForPlayer(player.characterId)
              const canEdit = isDM || player.peerId === localPeerId
              return (
                <div key={player.peerId} className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">{player.displayName}</div>
                  {char ? (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-sm text-gray-200 truncate">{char.name}</span>
                      <button
                        onClick={() => {
                          const path = getCharacterSheetPath(char)
                          navigate(path, { state: { returnTo } })
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                      >
                        {canEdit ? 'Edit' : 'View'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-0.5">No character</div>
                  )}
                </div>
              )
            })}
            {players.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No players connected</p>}
          </div>
        )
      case 'npcs':
        return (
          <NPCManager
            npcs={campaign.npcs}
            onAddToInitiative={handleNpcToInitiative}
            onPlaceOnMap={handlePlaceOnMap}
            isDM={isDM}
          />
        )
      case 'allies':
        return (
          <SidebarEntryList
            category="allies"
            entries={allies}
            isDM={isDM}
            onAddToInitiative={isDM ? (e) => handleSidebarEntryToInitiative(e, 'player') : undefined}
            onReadAloud={isDM ? onReadAloud : undefined}
          />
        )
      case 'enemies':
        return (
          <SidebarEntryList
            category="enemies"
            entries={enemies}
            isDM={isDM}
            onAddToInitiative={isDM ? (e) => handleSidebarEntryToInitiative(e, 'enemy') : undefined}
            onReadAloud={isDM ? onReadAloud : undefined}
          />
        )
      case 'places':
        return <SidebarEntryList category="places" entries={places} isDM={isDM} onReadAloud={isDM ? onReadAloud : undefined} />
      case 'bastions':
        return (
          <div className="space-y-1.5">
            {gameBastions.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">No bastions</p>
            ) : (
              gameBastions.map((bastion) => {
                const owner = characters.find((c) => c.id === bastion.ownerId)
                const facilityCount = bastion.basicFacilities.length + bastion.specialFacilities.length
                return (
                  <div key={bastion.id} className="bg-gray-800/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-200 truncate">{bastion.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{owner?.name ?? 'Unknown'}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                      <span>{facilityCount} facilities</span>
                      <span>{bastion.defenders.length} defenders</span>
                      <span className="text-yellow-400/70">{bastion.treasury} GP</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )
    }
  }

  // Collapsed state: thin strip with expand button
  if (collapsed) {
    return (
      <div className="w-3 h-full bg-gray-900/85 backdrop-blur-sm border-r border-gray-700/50 flex flex-col items-center">
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="mt-2 w-3 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="w-56 h-full bg-gray-900/85 backdrop-blur-sm border-r border-gray-700/50 flex flex-col min-h-0">
      {/* Voice section */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Voice</span>
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300 cursor-pointer rounded hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="space-y-1.5">
          {players.map((player) => (
            <VoiceAvatar
              key={player.peerId}
              name={player.displayName}
              color={player.color}
              isSpeaking={player.isSpeaking}
              isMuted={player.isMuted || player.isForceMuted}
              isDeafened={player.isDeafened || player.isForceDeafened}
            />
          ))}
        </div>

        {/* Mute/Deafen controls */}
        <div className="flex items-center gap-1 pt-2 mt-2 border-t border-gray-700/50">
          <button
            onClick={handleToggleMute}
            disabled={muteDisabled}
            title={localMuted ? 'Unmute' : 'Mute'}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer
              ${
                muteDisabled
                  ? 'bg-red-900/20 text-red-400/60 cursor-not-allowed'
                  : localMuted
                    ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                    : 'bg-gray-800/60 text-green-400 hover:bg-gray-700/60'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              {(localMuted || isForceMuted) && (
                <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
              )}
            </svg>
          </button>
          <button
            onClick={handleToggleDeafen}
            disabled={deafenDisabled}
            title={localDeafened ? 'Undeafen' : 'Deafen'}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer
              ${
                deafenDisabled
                  ? 'bg-red-900/20 text-red-400/60 cursor-not-allowed'
                  : localDeafened
                    ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                    : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 3a9 9 0 0 0-9 9v3.75A2.25 2.25 0 0 0 5.25 18h.75a1.5 1.5 0 0 0 1.5-1.5v-4.5a1.5 1.5 0 0 0-1.5-1.5h-.75C5.25 7.31 8.31 4.25 12 4.25S18.75 7.31 18.75 10.5h-.75a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h.75A2.25 2.25 0 0 0 21 15.75V12a9 9 0 0 0-9-9Z" />
              {(localDeafened || isForceDeafened) && (
                <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* My Character button (non-DM players with a character) */}
      {!isDM && character && (
        <div className="shrink-0 px-3 py-2 border-b border-gray-700/50">
          <button
            onClick={() => navigate(getCharacterSheetPath(character), { state: { returnTo } })}
            className="w-full py-1.5 text-xs font-semibold text-amber-400 bg-amber-900/20 hover:bg-amber-900/40 border border-amber-700/50 rounded-lg transition-colors cursor-pointer"
          >
            My Character
          </button>
        </div>
      )}

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {SECTIONS.map((section) => (
          <div key={section.id} className="border-b border-gray-800/50">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-800/50 transition-colors cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3 h-3 text-gray-500 transition-transform shrink-0 ${
                  expandedSection === section.id ? 'rotate-90' : ''
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm shrink-0">{section.icon}</span>
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{section.label}</span>
            </button>

            {expandedSection === section.id && <div className="px-3 pb-3">{renderSectionContent(section.id)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
