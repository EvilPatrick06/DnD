import { useState } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter } from '../../types/character'
import { CharacterIcon, getCharacterIconProps } from '../builder/IconPicker'
import { useCharacterStore } from '../../stores/useCharacterStore'

interface SheetHeaderProps {
  character: Character
  onEdit?: () => void
  onClose: () => void
  readonly?: boolean
}

export default function SheetHeader({ character, onEdit, onClose, readonly }: SheetHeaderProps): JSX.Element {
  const saveCharacter = useCharacterStore((s) => s.saveCharacter)
  const [editingLevel, setEditingLevel] = useState(false)
  const [levelValue, setLevelValue] = useState(character.level)

  const className = is5eCharacter(character)
    ? character.classes.map((c) => `${c.name} ${c.level}`).join(' / ')
    : `${character.className} ${character.level}`

  const raceName = is5eCharacter(character) ? character.race : character.ancestryName

  const subtitle = is5eCharacter(character)
    ? `${character.background} \u00B7 ${character.alignment || 'No alignment'}`
    : `${character.backgroundName} \u00B7 ${character.heritageName}`

  const iconProps = getCharacterIconProps(character)

  const saveLevel = (): void => {
    const clamped = Math.max(1, Math.min(20, levelValue))
    const updated = { ...character, level: clamped }
    if (is5eCharacter(updated) && updated.classes.length > 0) {
      updated.classes = [{ ...updated.classes[0], level: clamped }]
    }
    saveCharacter(updated)
    setEditingLevel(false)
  }

  return (
    <div className="flex items-start gap-4 mb-6">
      <CharacterIcon {...iconProps} size="lg" />
      <div className="flex-1 min-w-0">
        <h2 className="text-3xl font-bold text-amber-400 truncate">{character.name}</h2>
        <p className="text-gray-400">
          {!readonly && editingLevel ? (
            <span className="inline-flex items-center gap-1">
              Level{' '}
              <input
                type="number"
                min={1}
                max={20}
                value={levelValue}
                onChange={(e) => setLevelValue(parseInt(e.target.value, 10) || 1)}
                onBlur={saveLevel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLevel()
                  if (e.key === 'Escape') setEditingLevel(false)
                }}
                autoFocus
                className="w-12 bg-gray-800 border border-amber-500 rounded px-1 py-0.5 text-center text-gray-100 focus:outline-none"
              />
              {' '}{raceName} {className}
            </span>
          ) : readonly ? (
            <span>Level {character.level} {raceName} {className}</span>
          ) : (
            <span>
              Level{' '}
              <button
                onClick={() => setEditingLevel(true)}
                className="text-amber-300 hover:text-amber-200 underline decoration-dotted cursor-pointer"
                title="Click to edit level"
              >
                {character.level}
              </button>
              {' '}{raceName} {className}
            </span>
          )}
        </p>
        <p className="text-gray-500 text-sm">{subtitle}</p>
        <p className="text-gray-600 text-xs mt-0.5">
          {is5eCharacter(character) ? 'D&D 5e' : 'Pathfinder 2e'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onEdit && (
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-2xl cursor-pointer w-8 h-8 flex items-center justify-center"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
