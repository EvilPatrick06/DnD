import type { Character } from '../../types/character'
import SheetHeader from './SheetHeader'
import CombatStatsBar from './CombatStatsBar'
import AbilityScoresGrid from './AbilityScoresGrid'
import SavingThrowsSection from './SavingThrowsSection'
import SkillsSection from './SkillsSection'
import OffenseSection from './OffenseSection'
import DefenseSection from './DefenseSection'
import SpellcastingSection from './SpellcastingSection'
import FeaturesSection from './FeaturesSection'
import EquipmentSection from './EquipmentSection'
import ConditionsSection from './ConditionsSection'
import NotesSection from './NotesSection'

interface CharacterSheetProps {
  character: Character
  onClose: () => void
  onEdit?: () => void
  readonly?: boolean
}

export default function CharacterSheet({
  character,
  onClose,
  onEdit,
  readonly
}: CharacterSheetProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-950 border-l border-gray-700 w-full max-w-2xl ml-auto h-full overflow-y-auto p-6">
        <SheetHeader character={character} onEdit={readonly ? undefined : onEdit} onClose={onClose} readonly={readonly} />
        <CombatStatsBar character={character} readonly={readonly} />
        <AbilityScoresGrid character={character} />
        <SavingThrowsSection character={character} />
        <SkillsSection character={character} />
        <OffenseSection character={character} />
        <DefenseSection character={character} readonly={readonly} />
        <SpellcastingSection character={character} />
        <ConditionsSection character={character} readonly={readonly} />
        <FeaturesSection character={character} />
        <EquipmentSection character={character} readonly={readonly} />
        <NotesSection character={character} />
      </div>
    </div>
  )
}
