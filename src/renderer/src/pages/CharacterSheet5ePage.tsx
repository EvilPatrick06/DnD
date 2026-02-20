import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import AbilityScoresGrid5e from '../components/sheet/5e/AbilityScoresGrid5e'
import ClassResourcesSection5e from '../components/sheet/5e/ClassResourcesSection5e'
import CombatStatsBar5e from '../components/sheet/5e/CombatStatsBar5e'
import CompanionsSection5e from '../components/sheet/5e/CompanionsSection5e'
import ConditionsSection5e from '../components/sheet/5e/ConditionsSection5e'
import CraftingSection5e from '../components/sheet/5e/CraftingSection5e'
import DefenseSection5e from '../components/sheet/5e/DefenseSection5e'
import EquipmentSection5e from '../components/sheet/5e/EquipmentSection5e'
import FeaturesSection5e from '../components/sheet/5e/FeaturesSection5e'
import HighElfCantripSwapDialog5e from '../components/sheet/5e/HighElfCantripSwapDialog5e'
import NotesSection5e from '../components/sheet/5e/NotesSection5e'
import OffenseSection5e from '../components/sheet/5e/OffenseSection5e'
import SavingThrowsSection5e from '../components/sheet/5e/SavingThrowsSection5e'
import SheetHeader5e from '../components/sheet/5e/SheetHeader5e'
import ShortRestDialog5e from '../components/sheet/5e/ShortRestDialog5e'
import SkillsSection5e from '../components/sheet/5e/SkillsSection5e'
import SpellcastingSection5e from '../components/sheet/5e/SpellcastingSection5e'
import Modal from '../components/ui/Modal'
import { shouldLevelUp } from '../data/xp-thresholds'
import { applyLongRest } from '../services/rest-service-5e'
import { useBuilderStore } from '../stores/useBuilderStore'
import { useCharacterStore } from '../stores/useCharacterStore'
import { useLobbyStore } from '../stores/useLobbyStore'
import { useNetworkStore } from '../stores/useNetworkStore'
import type { Character } from '../types/character'
import { is5eCharacter } from '../types/character'
import type { Character5e } from '../types/character-5e'

export default function CharacterSheet5ePage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string })?.returnTo

  const storeCharacter = useCharacterStore((s) => s.characters.find((c) => c.id === id))
  const remoteCharacters = useLobbyStore((s) => s.remoteCharacters)
  const rawCharacter = storeCharacter ?? (id ? remoteCharacters[id] : undefined)
  const character: Character5e | undefined = rawCharacter && is5eCharacter(rawCharacter) ? rawCharacter : undefined

  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const role = useNetworkStore((s) => s.role)
  const players = useLobbyStore((s) => s.players)

  const loadCharacterForEdit = useBuilderStore((s) => s.loadCharacterForEdit)

  const [isEditing, setIsEditing] = useState(false)
  const [showShortRest, setShowShortRest] = useState(false)
  const [showLongRestConfirm, setShowLongRestConfirm] = useState(false)
  const [showLevelUpBanner, setShowLevelUpBanner] = useState(false)
  const [showCantripSwap, setShowCantripSwap] = useState(false)

  if (!character) {
    return (
      <div className="p-8 h-screen flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-xl mb-2">Character not found</p>
          <button
            onClick={() => navigate(returnTo || '/characters')}
            className="text-amber-400 hover:text-amber-300 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  // Permission logic
  const canEdit = (() => {
    if (character.playerId === 'local') return true
    if (role === 'host') return true
    const localPlayer = players.find((p) => p.peerId === localPeerId)
    if (localPlayer?.isCoDM) return true
    if (character.playerId === localPeerId) return true
    return false
  })()

  const readonly = !canEdit || !isEditing

  const handleBack = (): void => {
    navigate(returnTo || '/characters')
  }

  const handleMakeCharacter = (): void => {
    const ownerPlayer = players.find((p) => p.characterId === character.id)
    const editChar =
      ownerPlayer && ownerPlayer.peerId !== localPeerId ? { ...character, playerId: ownerPlayer.peerId } : character
    loadCharacterForEdit(editChar)
    navigate(`/characters/5e/edit/${character.id}`, { state: { returnTo: `/characters/5e/${character.id}` } })
  }

  const handleLevelUp = (): void => {
    navigate(`/characters/5e/${character.id}/levelup`, { state: { returnTo: `/characters/5e/${character.id}` } })
  }

  // --- Long Rest logic (5e only) ---

  const handleLongRest = (): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    if (!is5eCharacter(latest)) return

    const result = applyLongRest(latest)
    useCharacterStore.getState().saveCharacter(result.character)
    broadcastIfDM(result.character)

    setShowLongRestConfirm(false)

    // High Elf: offer cantrip swap after Long Rest
    if (result.highElfCantripSwap) {
      setShowCantripSwap(true)
    }
  }

  const broadcastIfDM = (updated: Character): void => {
    const { role: r, sendMessage } = useNetworkStore.getState()
    if (r === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated)
    }
  }

  // 5e hit dice info for short rest button tooltip
  const hitDiceInfo =
    character.classes.length > 1
      ? `${character.hitDiceRemaining}/${character.level} (${character.classes.map((c) => `${c.level}d${c.hitDie}`).join(' + ')}) remaining`
      : `${character.hitDiceRemaining}d${character.classes[0]?.hitDie ?? 8} remaining`

  const isMaxLevel = character.level >= 20

  // XP-based level-up notification
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (character.levelingMode === 'xp' && shouldLevelUp(character.level, character.xp)) {
      setShowLevelUpBanner(true)
    } else {
      setShowLevelUpBanner(false)
    }
  }, [character.levelingMode, character.xp, character.level])

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1 transition-colors"
          >
            &larr; Back
          </button>
          {returnTo?.startsWith('/game/') && (
            <button
              onClick={() => navigate(returnTo)}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold transition-colors"
            >
              Return to Game
            </button>
          )}
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xs text-gray-500">Character Sheet</span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                isEditing
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'border border-gray-600 hover:border-amber-600 text-gray-300 hover:text-amber-400'
              }`}
            >
              {isEditing ? 'Save' : 'Edit'}
            </button>
            <button
              onClick={() => setShowShortRest(true)}
              className="px-3 py-1.5 text-sm border border-gray-600 hover:border-blue-600 text-gray-300 hover:text-blue-400 rounded transition-colors"
              title={hitDiceInfo}
            >
              Short Rest
            </button>
            <button
              onClick={() => setShowLongRestConfirm(true)}
              className="px-3 py-1.5 text-sm border border-gray-600 hover:border-purple-600 text-gray-300 hover:text-purple-400 rounded transition-colors"
            >
              Long Rest
            </button>
            <button
              onClick={handleMakeCharacter}
              className="px-3 py-1.5 text-sm border border-gray-600 hover:border-green-600 text-gray-300 hover:text-green-400 rounded transition-colors"
            >
              Re-Make Character
            </button>
            <button
              onClick={handleLevelUp}
              disabled={isMaxLevel}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold transition-colors"
            >
              Level Up
            </button>
          </div>
        )}
      </div>

      {/* Level Up Banner */}
      {showLevelUpBanner && canEdit && (
        <div className="flex items-center justify-between px-4 py-2 bg-green-900/30 border-b border-green-700">
          <span className="text-sm text-green-400 font-semibold">You have enough XP to level up!</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLevelUp}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-white rounded font-semibold transition-colors"
            >
              Level Up Now
            </button>
            <button
              onClick={() => setShowLevelUpBanner(false)}
              className="px-3 py-1 text-sm border border-gray-600 text-gray-300 hover:bg-gray-800 rounded transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Sheet content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <SheetHeader5e character={character} readonly={readonly} />
          <CombatStatsBar5e character={character} readonly={readonly} />
          <AbilityScoresGrid5e character={character} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <ClassResourcesSection5e character={character} readonly={readonly} />
              <SavingThrowsSection5e character={character} />
              <SkillsSection5e character={character} readonly={readonly} />
              <ConditionsSection5e character={character} readonly={readonly} />
              <FeaturesSection5e character={character} readonly={readonly} />
            </div>
            <div className="space-y-6">
              <OffenseSection5e character={character} readonly={readonly} />
              <DefenseSection5e character={character} readonly={readonly} />
              <SpellcastingSection5e character={character} readonly={readonly} />
              <EquipmentSection5e character={character} readonly={readonly} />
              <CompanionsSection5e character={character} readonly={readonly} />
              <CraftingSection5e character={character} readonly={readonly} />
            </div>
          </div>

          <div className="mt-6">
            <NotesSection5e character={character} readonly={readonly} />
          </div>
        </div>
      </div>

      {/* Short Rest Dialog */}
      <ShortRestDialog5e character={character} open={showShortRest} onClose={() => setShowShortRest(false)} />

      {/* Long Rest Confirmation */}
      <Modal open={showLongRestConfirm} onClose={() => setShowLongRestConfirm(false)} title="Long Rest">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Taking a long rest will:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Restore HP to maximum</li>
              <li>Recover all Hit Point Dice</li>
              <li>Restore all spell slots</li>
              <li>Clear death saves</li>
              <li>Clear temporary HP</li>
              <li>Reduce Exhaustion by 1 level</li>
              {(character.knownSpells ?? []).some((s) => s.innateUses) && <li>Restore innate spell uses</li>}
              {character.wildShapeUses && character.wildShapeUses.max > 0 && <li>Restore all Wild Shape uses</li>}
              {character.species?.toLowerCase() === 'human' && <li>Grant Heroic Inspiration (Human trait)</li>}
            </ul>
          </p>
          <div className="text-xs text-gray-500">
            Hit Point Dice: {character.hitDiceRemaining}/{character.level}
            {character.classes.length > 1 && (
              <span> ({character.classes.map((c) => `${c.level}d${c.hitDie}`).join(' + ')})</span>
            )}{' '}
            &rarr; {character.level}/{character.level}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowLongRestConfirm(false)}
              className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLongRest}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold transition-colors"
            >
              Take Long Rest
            </button>
          </div>
        </div>
      </Modal>

      {/* High Elf Cantrip Swap Dialog (after Long Rest) */}
      <HighElfCantripSwapDialog5e
        character={character}
        open={showCantripSwap}
        onClose={() => setShowCantripSwap(false)}
      />
    </div>
  )
}
