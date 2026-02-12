import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useBuilderStore } from '../../stores/useBuilderStore'
import { useCharacterStore } from '../../stores/useCharacterStore'
import { useNetworkStore } from '../../stores/useNetworkStore'
import { useLobbyStore } from '../../stores/useLobbyStore'
import CharacterSummaryBar from './CharacterSummaryBar'
import BuildSidebar from './BuildSidebar'
import MainContentArea from './MainContentArea'

export default function CharacterBuilder(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string })?.returnTo
  const resetBuilder = useBuilderStore((s) => s.resetBuilder)
  const buildCharacter5e = useBuilderStore((s) => s.buildCharacter5e)
  const buildCharacterPf2e = useBuilderStore((s) => s.buildCharacterPf2e)
  const gameSystem = useBuilderStore((s) => s.gameSystem)
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const editingCharacterId = useBuilderStore((s) => s.editingCharacterId)
  const saveCharacter = useCharacterStore((s) => s.saveCharacter)
  const [saving, setSaving] = useState(false)

  const coreSlotsFilled = buildSlots
    .filter((s) => s.category === 'ancestry' || s.category === 'class' || s.category === 'background')
    .every((s) => s.selectedId !== null)

  const defaultReturn = returnTo || '/characters'

  const handleSave = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const character = gameSystem === 'dnd5e'
        ? await buildCharacter5e()
        : await buildCharacterPf2e()
      await saveCharacter(character)

      // If DM edited a remote player's character, send the update over the network
      const { role, sendMessage } = useNetworkStore.getState()
      if (role === 'host' && character.playerId !== 'local') {
        sendMessage('dm:character-update', {
          characterId: character.id,
          characterData: character
        })
        useLobbyStore.getState().setRemoteCharacter(character.id, character)
      }

      resetBuilder()
      navigate(defaultReturn)
    } catch (err) {
      console.error('Failed to save character:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = (): void => {
    resetBuilder()
    navigate(defaultReturn)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xs text-gray-500">
            {editingCharacterId ? 'Edit Character' : 'Character Builder'}
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !coreSlotsFilled}
          className="px-4 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
        >
          {saving ? 'Saving...' : editingCharacterId ? 'Save Changes' : 'Save Character'}
        </button>
      </div>

      {/* Summary bar */}
      <CharacterSummaryBar />

      {/* Main 2-panel layout */}
      <div className="flex flex-1 min-h-0">
        <BuildSidebar />
        <MainContentArea />
      </div>
    </div>
  )
}
