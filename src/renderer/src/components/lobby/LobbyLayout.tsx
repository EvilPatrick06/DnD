import { setCharacterInfo } from '../../network/client-manager'
import { useCharacterStore } from '../../stores/use-character-store'
import { useLobbyStore } from '../../stores/use-lobby-store'
import { useNetworkStore } from '../../stores/use-network-store'
import CharacterSelector from './CharacterSelector'
import ChatPanel from './ChatPanel'
import PlayerList from './PlayerList'
import ReadyButton from './ReadyButton'

export default function LobbyLayout(): JSX.Element {
  const updatePlayer = useLobbyStore((s) => s.updatePlayer)
  const localPeerId = useNetworkStore((s) => s.localPeerId)
  const characters = useCharacterStore((s) => s.characters)

  const sendMessage = useNetworkStore((s) => s.sendMessage)

  const handleCharacterSelect = (characterId: string, characterName: string): void => {
    if (localPeerId) {
      updatePlayer(localPeerId, { characterId, characterName })
      setCharacterInfo(characterId || null, characterName || null)
      const characterData = characterId ? (characters.find((c) => c.id === characterId) ?? null) : null
      sendMessage('player:character-select', {
        characterId: characterId || null,
        characterName: characterName || null,
        characterData
      })
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Left panel: Player list */}
      <div className="w-64 flex-shrink-0 bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <PlayerList />
      </div>

      {/* Center panel: Chat */}
      <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <ChatPanel />
      </div>

      {/* Right panel: Character selector + ready */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        {/* Character selector */}
        <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-lg p-4 overflow-y-auto">
          <CharacterSelector onSelect={handleCharacterSelect} />
        </div>

        {/* Ready button */}
        <ReadyButton />
      </div>
    </div>
  )
}
