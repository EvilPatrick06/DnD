import { useState } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import type { DetailField } from '../../types/character-common'

const FEAT_CATEGORIES = ['ancestry-feat', 'class-feat', 'skill-feat', 'general-feat'] as const
const CATEGORY_LABELS: Record<string, string> = {
  'ancestry-feat': 'ANCESTRY FEATS',
  'class-feat': 'CLASS FEATS',
  'skill-feat': 'SKILL FEATS',
  'general-feat': 'GENERAL FEATS'
}

/** Labels treated as metadata -- these are NOT shown as feature cards in the expanded view. */
const METADATA_LABELS = new Set([
  'Class',
  'Level',
  'Hit Die',
  'Primary Ability',
  'Saving Throws',
  'Armor Proficiencies',
  'Weapon Proficiencies',
  'Skills',
  'Starting Equipment',
  'Ability Score Increase',
  'Speed',
  'Size',
  'Languages',
  'Skill Proficiencies',
  'Tool Proficiencies',
  'Feature',
  'Equipment',
  'Ability Boosts',
  'Ability Flaws',
  'Heritages',
  'Hit Points',
  'Perception',
  'Fortitude Save',
  'Reflex Save',
  'Will Save',
  'Class DC',
  'Attacks',
  'Defenses',
  'Key Ability',
  'Skill Training',
  'Skill Feat',
  'Traits',
  'Prerequisites',
  'Ancestry'
])

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }): JSX.Element {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function FeatureCard({ field }: { field: DetailField }): JSX.Element {
  return (
    <div className="border border-gray-700 rounded-md bg-gray-800/40 overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-700/50 border-b border-gray-700">
        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
          {field.label}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{field.value}</p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Racial Trait Row                                                          */
/* -------------------------------------------------------------------------- */

function RacialTraitRow({
  trait
}: {
  trait: { name: string; description: string }
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-sm text-gray-100 font-medium">{trait.name}</span>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          {trait.description ? (
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
              {trait.description}
            </p>
          ) : (
            <p className="text-xs text-gray-600 italic">No description available.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Feat / Subclass Row                                                       */
/* -------------------------------------------------------------------------- */

function FeatRow({
  slot,
  onReselect
}: {
  slot: {
    id: string
    label: string
    level: number
    selectedName: string | null
    selectedDescription?: string | null
    selectedDetailFields?: DetailField[] | null
    selectedId: string | null
  }
  onReselect: (slotId: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  /* ---- Empty slot ---- */
  if (!slot.selectedId) {
    return (
      <button
        onClick={() => onReselect(slot.id)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-800 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-sm text-gray-500 italic">Empty - {slot.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-mono">
            {slot.level}
          </span>
          <span className="text-xs text-amber-400">Choose</span>
        </div>
      </button>
    )
  }

  /* Split detail fields into the "Description" field and the mechanical features. */
  const allFields = slot.selectedDetailFields ?? []

  const descriptionField = allFields.find(
    (f) => f.label === 'Description' && f.value.trim().length > 0
  )

  const featureFields = allFields.filter(
    (f) => !METADATA_LABELS.has(f.label) && f.value.trim().length > 0
  )

  const hasExpandedContent = !!descriptionField || featureFields.length > 0

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-left"
      >
        <span className="text-sm text-gray-100 font-medium">{slot.selectedName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded font-mono">
            {slot.level}
          </span>
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Description blurb (general overview text) */}
          {descriptionField ? (
            <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
              {descriptionField.value}
            </p>
          ) : !hasExpandedContent ? (
            <p className="text-xs text-gray-600 italic">No description available.</p>
          ) : null}

          {/* Mechanical feature cards (Frenzy, Mindless Rage, etc.) */}
          {featureFields.length > 0 && (
            <div className="space-y-2 pt-1">
              {featureFields.map((field, idx) => (
                <FeatureCard key={`${field.label}-${idx}`} field={field} />
              ))}
            </div>
          )}

          <button
            onClick={() => onReselect(slot.id)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Change Selection
          </button>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export default function FeatsTab(): JSX.Element {
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const openSelectionModal = useBuilderStore((s) => s.openSelectionModal)
  const raceTraits = useBuilderStore((s) => s.raceTraits)
  const pf2eSpecialAbilities = useBuilderStore((s) => s.pf2eSpecialAbilities)
  const gameSystem = useBuilderStore((s) => s.gameSystem)

  const allRaceTraits = [
    ...raceTraits,
    ...pf2eSpecialAbilities
  ]

  /* Group feat slots by category */
  const featSlotsByCategory = FEAT_CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    slots: buildSlots.filter((s) => s.category === cat).sort((a, b) => a.level - b.level)
  })).filter((g) => g.slots.length > 0)

  /* Class features / subclass slots that have a selection */
  const specialSlots = buildSlots.filter(
    (s) => s.category === 'class-feature' && s.selectedId !== null
  )

  const hasRaceTraits = allRaceTraits.length > 0
  const hasFeats = featSlotsByCategory.length > 0
  const hasSpecials = specialSlots.length > 0

  if (!hasRaceTraits && !hasFeats && !hasSpecials) {
    return (
      <div>
        <SectionBanner label="FEATS" />
        <p className="text-sm text-gray-500 px-4 py-6 text-center">
          No feat slots available at your current level. Increase your target level to unlock feat
          choices.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ---- Racial Traits ---- */}
      {hasRaceTraits && (
        <>
          <SectionBanner label={gameSystem === 'pf2e' ? 'ANCESTRY TRAITS & ABILITIES' : 'RACIAL TRAITS'} />
          {allRaceTraits.map((trait, idx) => (
            <RacialTraitRow key={`${trait.name}-${idx}`} trait={trait} />
          ))}
        </>
      )}

      {/* ---- Feat categories ---- */}
      {hasFeats && (
        <>
          <SectionBanner label="FEATS" />
          {featSlotsByCategory.map((group) => (
            <div key={group.category}>
              <div className="px-4 py-1.5 bg-gray-900/60">
                <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  {group.label}
                </span>
              </div>
              {group.slots.map((slot) => (
                <FeatRow key={slot.id} slot={slot} onReselect={openSelectionModal} />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ---- Specials (class features, subclass, etc.) ---- */}
      {hasSpecials && (
        <>
          <SectionBanner label="SPECIALS" />
          {specialSlots.map((slot) => (
            <FeatRow key={slot.id} slot={slot} onReselect={openSelectionModal} />
          ))}
        </>
      )}
    </div>
  )
}
