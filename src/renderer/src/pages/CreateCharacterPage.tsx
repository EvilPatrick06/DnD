import CharacterBuilder5e from '../components/builder/5e/CharacterBuilder5e'
import { useBuilderStore } from '../stores/useBuilderStore'

export default function CreateCharacterPage(): JSX.Element {
  const phase = useBuilderStore((s) => s.phase)
  const selectGameSystem = useBuilderStore((s) => s.selectGameSystem)

  // Auto-select 5e if still on system-select phase
  if (phase === 'system-select') {
    selectGameSystem('dnd5e')
  }

  return <CharacterBuilder5e />
}
