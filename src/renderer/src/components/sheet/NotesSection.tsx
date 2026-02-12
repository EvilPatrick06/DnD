import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import SheetSectionWrapper from './SheetSectionWrapper'

interface NotesSectionProps {
  character: Character
}

export default function NotesSection({ character }: NotesSectionProps): JSX.Element {
  const backstory = is5eCharacter(character)
    ? character.backstory
    : isPf2eCharacter(character)
      ? character.details.backstory
      : ''

  const personality = is5eCharacter(character)
    ? character.details.personality
    : isPf2eCharacter(character)
      ? character.details.personality
      : ''

  const notes = character.notes

  const hasContent = backstory || personality || notes

  if (!hasContent) return <></>

  return (
    <SheetSectionWrapper title="Notes & Backstory" defaultOpen={false}>
      {personality && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Personality</div>
          <p className="text-sm text-gray-400">{personality}</p>
        </div>
      )}

      {is5eCharacter(character) && (
        <>
          {character.details.ideals && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Ideals: </span>
              <span className="text-sm text-gray-400">{character.details.ideals}</span>
            </div>
          )}
          {character.details.bonds && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Bonds: </span>
              <span className="text-sm text-gray-400">{character.details.bonds}</span>
            </div>
          )}
          {character.details.flaws && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Flaws: </span>
              <span className="text-sm text-gray-400">{character.details.flaws}</span>
            </div>
          )}
        </>
      )}

      {backstory && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Backstory</div>
          <p className="text-sm text-gray-400 bg-gray-900/50 border border-gray-700 rounded-lg p-3 whitespace-pre-wrap">
            {backstory}
          </p>
        </div>
      )}

      {notes && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
          <p className="text-sm text-gray-400 whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </SheetSectionWrapper>
  )
}
