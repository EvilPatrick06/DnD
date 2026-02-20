import { useEffect, useState } from 'react'
import { getBonusFeatCount } from '../../../data/xp-thresholds'
import { load5eFeats, load5eInvocations, load5eMetamagic } from '../../../services/data-provider'
import { useCharacterStore } from '../../../stores/useCharacterStore'
import { useLobbyStore } from '../../../stores/useLobbyStore'
import { useNetworkStore } from '../../../stores/useNetworkStore'
import type { Character5e } from '../../../types/character-5e'
import type { FeatData5e, InvocationData, MetamagicData } from '../../../types/data'
import { meetsFeatPrerequisites } from '../../../utils/feat-prerequisites'
import SheetSectionWrapper from '../shared/SheetSectionWrapper'

interface FeaturesSection5eProps {
  character: Character5e
  readonly?: boolean
}

function FeatureRow({
  feature,
  onRemove
}: {
  feature: { name: string; source?: string; description: string; level?: number }
  onRemove?: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200 font-medium">{feature.name}</span>
          {feature.source && <span className="text-xs text-gray-500">({feature.source})</span>}
        </div>
        <div className="flex items-center gap-2">
          {feature.level != null && <span className="text-xs text-gray-600 font-mono">Lv {feature.level}</span>}
          {onRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onRemove()
                }
              }}
              className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer ml-1"
              title="Remove feat"
            >
              &times;
            </span>
          )}
        </div>
      </button>
      {expanded && feature.description && (
        <p className="px-3 pb-2 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{feature.description}</p>
      )}
    </div>
  )
}

export default function FeaturesSection5e({ character, readonly }: FeaturesSection5eProps): JSX.Element {
  const rawClassFeatures = character.classFeatures ?? []
  // Annotate Elemental Fury with the chosen option
  const elementalFuryChoice = character.buildChoices?.elementalFuryChoice
  const classFeatures = rawClassFeatures.map((f) => {
    if (f.name === 'Elemental Fury' && elementalFuryChoice) {
      const choiceName = elementalFuryChoice === 'potent-spellcasting' ? 'Potent Spellcasting' : 'Primal Strike'
      return { ...f, name: `${f.name} (${choiceName})` }
    }
    if (f.name === 'Improved Elemental Fury' && elementalFuryChoice) {
      const choiceName = elementalFuryChoice === 'potent-spellcasting' ? 'Potent Spellcasting' : 'Primal Strike'
      return { ...f, name: `${f.name} (${choiceName})` }
    }
    return f
  })
  const feats = character.feats ?? []

  const [showPicker, setShowPicker] = useState(false)
  const [allFeats, setAllFeats] = useState<FeatData5e[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (showPicker && allFeats.length === 0) {
      load5eFeats()
        .then(setAllFeats)
        .catch(() => setAllFeats([]))
    }
  }, [showPicker, allFeats.length])

  // Load invocation and metamagic data for display
  const [invocationData, setInvocationData] = useState<InvocationData[]>([])
  const [metamagicData, setMetamagicData] = useState<MetamagicData[]>([])
  const invocationsKnown = character.invocationsKnown ?? []
  const metamagicKnown = character.metamagicKnown ?? []

  useEffect(() => {
    if (invocationsKnown.length > 0) {
      load5eInvocations()
        .then(setInvocationData)
        .catch(() => setInvocationData([]))
    }
  }, [invocationsKnown.length])

  useEffect(() => {
    if (metamagicKnown.length > 0) {
      load5eMetamagic()
        .then(setMetamagicData)
        .catch(() => setMetamagicData([]))
    }
  }, [metamagicKnown.length])

  // Bonus feats after level 20 (PHB 2024 p.43)
  const bonusFeats = character.bonusFeats ?? []
  const bonusFeatSlots = character.levelingMode === 'xp' ? getBonusFeatCount(character.xp) : 0
  const bonusFeatsAvailable = bonusFeatSlots - bonusFeats.length
  const [showBonusFeatPicker, setShowBonusFeatPicker] = useState(false)
  const [bonusFeatSearch, setBonusFeatSearch] = useState('')
  const [bonusFeatCategory, setBonusFeatCategory] = useState<string>('all')

  // Load feats for bonus feat picker
  useEffect(() => {
    if (showBonusFeatPicker && allFeats.length === 0) {
      load5eFeats()
        .then(setAllFeats)
        .catch(() => setAllFeats([]))
    }
  }, [showBonusFeatPicker, allFeats.length])

  const hasFeatures =
    character.features.length > 0 ||
    classFeatures.length > 0 ||
    feats.length > 0 ||
    invocationsKnown.length > 0 ||
    metamagicKnown.length > 0 ||
    bonusFeats.length > 0 ||
    bonusFeatsAvailable > 0

  const saveBonusFeatChange = (updatedBonusFeats: Array<{ id: string; name: string; description: string }>): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    const updated: Character5e = {
      ...(latest as Character5e),
      bonusFeats: updatedBonusFeats,
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)

    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated)
    }
  }

  const saveFeatChange = (
    updatedFeats: Array<{ id: string; name: string; description: string; choices?: Record<string, string | string[]> }>
  ): void => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === character.id) || character
    const updated: Character5e = {
      ...(latest as Character5e),
      feats: updatedFeats,
      updatedAt: new Date().toISOString()
    }
    useCharacterStore.getState().saveCharacter(updated)

    // DM broadcast pattern
    const { role, sendMessage } = useNetworkStore.getState()
    if (role === 'host' && updated.playerId !== 'local') {
      sendMessage('dm:character-update', {
        characterId: updated.id,
        characterData: updated,
        targetPeerId: updated.playerId
      })
      useLobbyStore.getState().setRemoteCharacter(updated.id, updated)
    }
  }

  const handleRemoveFeat = (featId: string): void => {
    saveFeatChange(feats.filter((f) => f.id !== featId))
  }

  const handleAddFeat = (feat: FeatData5e): void => {
    const newFeat = { id: feat.id, name: feat.name, description: feat.description }
    saveFeatChange([...feats, newFeat])
    setShowPicker(false)
    setSearch('')
    setCategoryFilter('all')
  }

  // Filter feats for picker: exclude already-taken (unless repeatable), check prerequisites
  const takenFeatIds = new Set(feats.map((f) => f.id))
  const filteredFeats = allFeats.filter((f) => {
    if (takenFeatIds.has(f.id) && !f.repeatable) return false
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false
    if (!meetsFeatPrerequisites(character, f.prerequisites)) return false
    return true
  })

  if (!hasFeatures && readonly) return <></>

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

      {/* Species traits */}
      {character.features.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Species Traits</div>
          {character.features.map((f, i) => (
            <FeatureRow key={`feat-${i}`} feature={f} />
          ))}
        </div>
      )}

      {/* 5e feats */}
      {(feats.length > 0 || !readonly) && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Feats</div>
          {feats.map((f) => (
            <FeatureRow
              key={f.id}
              feature={{ name: f.name, description: f.description }}
              onRemove={!readonly ? () => handleRemoveFeat(f.id) : undefined}
            />
          ))}

          {!readonly && !showPicker && (
            <button
              onClick={() => setShowPicker(true)}
              className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              + Add Feat
            </button>
          )}

          {/* Eldritch Invocations */}
          {invocationsKnown.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-purple-400 uppercase tracking-wide mb-1">Eldritch Invocations</div>
              {(() => {
                // Group duplicate invocation IDs with counts
                const counts = new Map<string, number>()
                const order: string[] = []
                for (const invId of invocationsKnown) {
                  if (!counts.has(invId)) order.push(invId)
                  counts.set(invId, (counts.get(invId) ?? 0) + 1)
                }
                return order.map((invId) => {
                  const inv = invocationData.find((d) => d.id === invId)
                  const count = counts.get(invId) ?? 1
                  const label = inv ? (count > 1 ? `${inv.name} (x${count})` : inv.name) : invId
                  return inv ? (
                    <FeatureRow key={invId} feature={{ name: label, description: inv.description }} />
                  ) : (
                    <div key={invId} className="text-xs text-gray-500 px-2 py-1">
                      {label}
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* Metamagic Options */}
          {metamagicKnown.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-red-400 uppercase tracking-wide mb-1">Metamagic</div>
              {metamagicKnown.map((mmId) => {
                const mm = metamagicData.find((d) => d.id === mmId)
                return mm ? (
                  <FeatureRow
                    key={mmId}
                    feature={{ name: `${mm.name} (${mm.sorceryPointCost} SP)`, description: mm.description }}
                  />
                ) : (
                  <div key={mmId} className="text-xs text-gray-500 px-2 py-1">
                    {mmId}
                  </div>
                )
              })}
            </div>
          )}

          {!readonly && showPicker && (
            <div className="mt-2 border border-gray-700 rounded-lg p-3 bg-gray-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold">Select a Feat</span>
                <button
                  onClick={() => {
                    setShowPicker(false)
                    setSearch('')
                    setCategoryFilter('all')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Category filter */}
              <div className="flex gap-1 mb-2 flex-wrap">
                {['all', 'Origin', 'General', 'Fighting Style', 'Epic Boon'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      categoryFilter === cat
                        ? 'bg-amber-600 text-white'
                        : 'border border-gray-600 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search feats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 mb-2"
              />

              {/* Feat list */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredFeats.map((feat) => (
                  <FeatPickerRow key={feat.id} feat={feat} character={character} onSelect={handleAddFeat} />
                ))}
                {filteredFeats.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">No matching feats found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bonus Feats (post-level 20, PHB 2024 p.43) */}
      {(bonusFeats.length > 0 || bonusFeatsAvailable > 0) && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs text-amber-400 uppercase tracking-wide">Bonus Feats</div>
            <span className="text-[10px] text-gray-500">(Post-Level 20)</span>
          </div>

          {bonusFeats.map((f) => (
            <FeatureRow
              key={`bonus-${f.id}`}
              feature={{ name: f.name, description: f.description }}
              onRemove={!readonly ? () => saveBonusFeatChange(bonusFeats.filter((bf) => bf.id !== f.id)) : undefined}
            />
          ))}

          {bonusFeatsAvailable > 0 && !readonly && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-amber-300 font-semibold">
                {bonusFeatsAvailable} Bonus Feat{bonusFeatsAvailable > 1 ? 's' : ''} Available
              </span>
              {!showBonusFeatPicker && (
                <button
                  onClick={() => setShowBonusFeatPicker(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  + Select Feat
                </button>
              )}
            </div>
          )}

          {!readonly && showBonusFeatPicker && (
            <div className="mt-2 border border-amber-700/50 rounded-lg p-3 bg-gray-900/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-amber-300 font-semibold">Select Bonus Feat</span>
                <button
                  onClick={() => {
                    setShowBonusFeatPicker(false)
                    setBonusFeatSearch('')
                    setBonusFeatCategory('all')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="flex gap-1 mb-2 flex-wrap">
                {['all', 'General', 'Epic Boon'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBonusFeatCategory(cat)}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      bonusFeatCategory === cat
                        ? 'bg-amber-600 text-white'
                        : 'border border-gray-600 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Search feats..."
                value={bonusFeatSearch}
                onChange={(e) => setBonusFeatSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 mb-2"
              />

              <div className="max-h-48 overflow-y-auto space-y-1">
                {allFeats
                  .filter((f) => {
                    const takenBonusIds = new Set(bonusFeats.map((bf) => bf.id))
                    if (takenBonusIds.has(f.id) && !f.repeatable) return false
                    if (bonusFeatCategory !== 'all' && f.category !== bonusFeatCategory) return false
                    if (bonusFeatSearch && !f.name.toLowerCase().includes(bonusFeatSearch.toLowerCase())) return false
                    if (!meetsFeatPrerequisites(character, f.prerequisites)) return false
                    return true
                  })
                  .map((feat) => (
                    <FeatPickerRow
                      key={feat.id}
                      feat={feat}
                      character={character}
                      onSelect={(f) => {
                        saveBonusFeatChange([...bonusFeats, { id: f.id, name: f.name, description: f.description }])
                        setShowBonusFeatPicker(false)
                        setBonusFeatSearch('')
                        setBonusFeatCategory('all')
                      }}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SheetSectionWrapper>
  )
}

function FeatPickerRow({
  feat,
  character,
  onSelect
}: {
  feat: FeatData5e
  character: Character5e
  onSelect: (feat: FeatData5e) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const meetsPrereqs = feat.prerequisites.length === 0 || meetsFeatPrerequisites(character, feat.prerequisites)
  return (
    <div
      className={`border rounded ${meetsPrereqs ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-50'}`}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 text-left cursor-pointer">
          <span className="text-sm text-amber-300 font-medium">{feat.name}</span>
          <span className="text-xs text-gray-500 ml-2">({feat.category})</span>
          {feat.repeatable && <span className="text-xs text-purple-400 ml-1">*</span>}
        </button>
        <button
          onClick={() => meetsPrereqs && onSelect(feat)}
          disabled={!meetsPrereqs}
          className={`px-2 py-0.5 text-xs rounded transition-colors ml-2 ${
            meetsPrereqs
              ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Add
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2">
          {feat.prerequisites.length > 0 && (
            <p className={`text-xs mb-1 ${meetsPrereqs ? 'text-yellow-500' : 'text-red-400'}`}>
              Requires: {feat.prerequisites.join(', ')}
            </p>
          )}
          <p className="text-xs text-gray-400 whitespace-pre-wrap">{feat.description}</p>
        </div>
      )}
    </div>
  )
}
