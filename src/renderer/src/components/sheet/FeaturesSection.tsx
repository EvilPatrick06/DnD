import { useState } from 'react'
import type { Character } from '../../types/character'
import { is5eCharacter, isPf2eCharacter } from '../../types/character'
import SheetSectionWrapper from './SheetSectionWrapper'

interface FeaturesSectionProps {
  character: Character
}

function FeatureRow({ feature }: { feature: { name: string; source?: string; description: string; level?: number } }): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200 font-medium">{feature.name}</span>
          {feature.source && (
            <span className="text-xs text-gray-500">({feature.source})</span>
          )}
        </div>
        {feature.level != null && (
          <span className="text-xs text-gray-600 font-mono">Lv {feature.level}</span>
        )}
      </button>
      {expanded && feature.description && (
        <p className="px-3 pb-2 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
          {feature.description}
        </p>
      )}
    </div>
  )
}

function FeatRow({ feat }: { feat: { featName: string; level: number } }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1 px-2 text-sm border-b border-gray-800 last:border-0">
      <span className="text-gray-200">{feat.featName}</span>
      <span className="text-xs text-gray-600 font-mono">Lv {feat.level}</span>
    </div>
  )
}

export default function FeaturesSection({ character }: FeaturesSectionProps): JSX.Element {
  if (is5eCharacter(character)) {
    const classFeatures = character.classFeatures ?? []
    const feats = character.feats ?? []

    const hasFeatures = character.features.length > 0 || classFeatures.length > 0 || feats.length > 0
    if (!hasFeatures) return <></>

    return (
      <SheetSectionWrapper title="Features & Feats">
        {/* Class features */}
        {classFeatures.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class Features</div>
            {classFeatures.map((f, i) => (
              <FeatureRow key={`cf-${i}`} feature={f} />
            ))}
          </div>
        )}

        {/* Racial traits (show when no new classFeatures) */}
        {character.features.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Racial Traits & Features</div>
            {character.features.map((f, i) => (
              <FeatureRow key={`feat-${i}`} feature={f} />
            ))}
          </div>
        )}

        {/* 5e feats */}
        {feats.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Feats</div>
            {feats.map((f) => (
              <FeatureRow key={f.id} feature={{ name: f.name, description: f.description }} />
            ))}
          </div>
        )}
      </SheetSectionWrapper>
    )
  }

  if (isPf2eCharacter(character)) {
    const hasFeatures = character.classFeatures.length > 0 || character.ancestryFeats.length > 0 ||
      character.classFeats.length > 0 || character.skillFeats.length > 0 ||
      character.generalFeats.length > 0
    if (!hasFeatures) return <></>

    return (
      <SheetSectionWrapper title="Features & Feats">
        {character.classFeatures.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class Features</div>
            {character.classFeatures.map((f, i) => (
              <FeatureRow key={`pcf-${i}`} feature={{ name: f.name, description: f.description, level: f.level }} />
            ))}
          </div>
        )}
        {character.ancestryFeats.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ancestry Feats</div>
            {character.ancestryFeats.map((f, i) => (
              <FeatRow key={`af-${i}`} feat={f} />
            ))}
          </div>
        )}
        {character.classFeats.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class Feats</div>
            {character.classFeats.map((f, i) => (
              <FeatRow key={`clf-${i}`} feat={f} />
            ))}
          </div>
        )}
        {character.skillFeats.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Skill Feats</div>
            {character.skillFeats.map((f, i) => (
              <FeatRow key={`sf-${i}`} feat={f} />
            ))}
          </div>
        )}
        {character.generalFeats.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">General Feats</div>
            {character.generalFeats.map((f, i) => (
              <FeatRow key={`gf-${i}`} feat={f} />
            ))}
          </div>
        )}
      </SheetSectionWrapper>
    )
  }

  return <></>
}
