import { useBuilderStore } from '../../stores/useBuilderStore'
import ContentTabs from './ContentTabs'
import SelectionModal from './SelectionModal'
import AbilityScoreModal from './AbilityScoreModal'
import SkillsModal from './SkillsModal'
import AsiModal from './AsiModal'
import SkillsTab from './SkillsTab'
import FeatsTab from './FeatsTab'
import DetailsTab from './DetailsTab'
import DefenseTab from './DefenseTab'
import GearTab from './GearTab'
import SpellsTab from './SpellsTab'
import OffenseTab from './OffenseTab'

function ActiveTabContent(): JSX.Element {
  const activeTab = useBuilderStore((s) => s.activeTab)

  switch (activeTab) {
    case 'skills':
      return <SkillsTab />
    case 'feats':
      return <FeatsTab />
    case 'details':
      return <DetailsTab />
    case 'defense':
      return <DefenseTab />
    case 'gear':
      return <GearTab />
    case 'spells':
      return <SpellsTab />
    case 'offense':
      return <OffenseTab />
    default:
      return <div className="p-4 text-gray-500">Select a tab</div>
  }
}

export default function MainContentArea(): JSX.Element {
  const selectionModal = useBuilderStore((s) => s.selectionModal)
  const customModal = useBuilderStore((s) => s.customModal)

  return (
    <div className="flex-1 flex flex-col relative min-w-0">
      <ContentTabs />
      <div className="flex-1 overflow-y-auto">
        <ActiveTabContent />
      </div>

      {/* Selection modal overlays the content area */}
      {selectionModal && <SelectionModal />}

      {/* Custom modals for ability scores, skills, ASI */}
      {customModal === 'ability-scores' && <AbilityScoreModal />}
      {customModal === 'skills' && <SkillsModal />}
      {customModal === 'asi' && <AsiModal />}
    </div>
  )
}
