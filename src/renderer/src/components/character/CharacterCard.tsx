import type { Character } from '../../types/character'
import { is5eCharacter } from '../../types/character'
import { abilityModifier, formatMod } from '../../types/character-common'
import { CharacterIcon, getCharacterIconProps } from '../builder/IconPicker'

interface CharacterCardProps {
  character: Character
  onClick: () => void
  onDelete: () => void
  onExport?: () => void
}

export default function CharacterCard({
  character,
  onClick,
  onDelete,
  onExport
}: CharacterCardProps): JSX.Element {
  const status = (character as unknown as Record<string, unknown>).status as string | undefined
  const className = is5eCharacter(character)
    ? character.classes.map((c) => c.name).join(' / ') || 'Unknown Class'
    : character.className

  const raceName = is5eCharacter(character)
    ? character.race
    : character.ancestryName

  const bgName = is5eCharacter(character)
    ? character.background
    : character.backgroundName

  const iconProps = getCharacterIconProps(character)

  return (
    <div
      className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-amber-600/50
                 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <CharacterIcon {...iconProps} size="md" />
          <div>
            <h3 className="text-lg font-semibold group-hover:text-amber-400 transition-colors">
              {character.name}
            </h3>
            <p className="text-gray-400 text-sm">
              Level {character.level} {raceName} {className}
            </p>
            {bgName && (
              <p className="text-gray-500 text-xs mt-1">{bgName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status && status !== 'active' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'retired' ? 'bg-gray-700 text-gray-300' : 'bg-red-900/50 text-red-400'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
          {onExport && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExport()
              }}
              className="text-gray-600 hover:text-amber-400 transition-colors text-sm cursor-pointer px-2 py-1"
              title="Export character"
            >
              &#8663;
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-gray-600 hover:text-red-400 transition-colors text-sm cursor-pointer px-2 py-1"
            title="Delete character"
          >
            &#10005;
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-3">
        <div className="text-xs text-gray-500">
          HP: <span className="text-gray-300">{character.hitPoints.current}/{character.hitPoints.maximum}</span>
        </div>
        <div className="text-xs text-gray-500">
          AC: <span className="text-gray-300">{character.armorClass}</span>
        </div>
        <div className="text-xs text-gray-500">
          STR {formatMod(abilityModifier(character.abilityScores.strength))} &middot;
          DEX {formatMod(abilityModifier(character.abilityScores.dexterity))} &middot;
          CON {formatMod(abilityModifier(character.abilityScores.constitution))}
        </div>
      </div>
    </div>
  )
}
