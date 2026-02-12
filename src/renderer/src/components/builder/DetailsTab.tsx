import { useMemo, useState } from 'react'
import { useBuilderStore } from '../../stores/useBuilderStore'
import {
  ABILITY_NAMES,
  abilityModifier,
  formatMod,
  ALL_LANGUAGES_5E,
  STANDARD_LANGUAGES_5E
} from '../../types/character-common'
import type { AbilityName } from '../../types/character-common'

function SectionBanner({ label }: { label: string }): JSX.Element {
  return (
    <div className="bg-gray-800/80 px-4 py-1.5">
      <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">{label}</span>
    </div>
  )
}

const ABILITY_LABELS: Record<AbilityName, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA'
}

export default function DetailsTab(): JSX.Element {
  const abilityScores = useBuilderStore((s) => s.abilityScores)
  const buildSlots = useBuilderStore((s) => s.buildSlots)
  const targetLevel = useBuilderStore((s) => s.targetLevel)
  const abilityScoreMethod = useBuilderStore((s) => s.abilityScoreMethod)
  const openCustomModal = useBuilderStore((s) => s.openCustomModal)
  const characterGender = useBuilderStore((s) => s.characterGender)
  const characterDeity = useBuilderStore((s) => s.characterDeity)
  const characterAge = useBuilderStore((s) => s.characterAge)
  const characterNotes = useBuilderStore((s) => s.characterNotes)
  const heroPoints = useBuilderStore((s) => s.heroPoints)
  const gameSystem = useBuilderStore((s) => s.gameSystem)

  const raceSize = useBuilderStore((s) => s.raceSize)
  const raceSpeed = useBuilderStore((s) => s.raceSpeed)
  const raceLanguages = useBuilderStore((s) => s.raceLanguages)
  const raceExtraLangCount = useBuilderStore((s) => s.raceExtraLangCount)
  const bgLanguageCount = useBuilderStore((s) => s.bgLanguageCount)
  const chosenLanguages = useBuilderStore((s) => s.chosenLanguages)
  const setChosenLanguages = useBuilderStore((s) => s.setChosenLanguages)
  const pf2eAdditionalLanguages = useBuilderStore((s) => s.pf2eAdditionalLanguages)
  const pets = useBuilderStore((s) => s.pets)
  const addPet = useBuilderStore((s) => s.addPet)
  const removePet = useBuilderStore((s) => s.removePet)

  const speciesAbilityBonuses = useBuilderStore((s) => s.speciesAbilityBonuses)
  const setSpeciesAbilityBonuses = useBuilderStore((s) => s.setSpeciesAbilityBonuses)

  const [petInput, setPetInput] = useState('')

  // Check if selected race has flexible ability bonuses (2024 species)
  const raceSlot = buildSlots.find((s) => s.category === 'ancestry')
  const hasFlexibleBonuses = gameSystem === 'dnd5e' && raceSlot?.selectedId != null

  // Determine bonus mode: +2/+1 vs +1/+1/+1
  const totalBonusPoints = Object.values(speciesAbilityBonuses).reduce((a, b) => a + b, 0)
  const [bonusMode, setBonusMode] = useState<'2-1' | '1-1-1'>(
    totalBonusPoints === 3 && Object.keys(speciesAbilityBonuses).length === 3 ? '1-1-1' : '2-1'
  )

  const asiSlots = buildSlots.filter((s) => s.category === 'ability-boost')

  const profBonus = useMemo(() => Math.ceil(targetLevel / 4) + 1, [targetLevel])

  // Class DC = 10 + prof bonus + key ability mod (use highest ability mod as proxy)
  const keyAbilityMod = useMemo(() => {
    const mods = ABILITY_NAMES.map((ab) => abilityModifier(abilityScores[ab]))
    return Math.max(...mods)
  }, [abilityScores])
  const classDC = 10 + profBonus + keyAbilityMod

  const methodLabel =
    abilityScoreMethod === 'standard' ? 'Standard Array'
    : abilityScoreMethod === 'pointBuy' ? 'Point Buy'
    : abilityScoreMethod === 'roll' ? 'Rolled'
    : 'Custom'

  // ── Language logic ──
  const allKnownLanguages = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const lang of raceLanguages) {
      if (!seen.has(lang)) {
        seen.add(lang)
        result.push(lang)
      }
    }
    for (const lang of chosenLanguages) {
      if (!seen.has(lang)) {
        seen.add(lang)
        result.push(lang)
      }
    }
    return result
  }, [raceLanguages, chosenLanguages])

  const totalBonusSlots = gameSystem === 'pf2e'
    ? Math.max(0, abilityModifier(abilityScores.intelligence)) // PF2e: INT mod bonus languages
    : raceExtraLangCount + bgLanguageCount // 5e: race + background bonus
  const remainingSlots = Math.max(0, totalBonusSlots - chosenLanguages.length)

  const availableLanguages = useMemo(() => {
    const knownSet = new Set(allKnownLanguages)
    const pool = gameSystem === 'pf2e' ? pf2eAdditionalLanguages : ALL_LANGUAGES_5E
    return pool.filter((lang) => !knownSet.has(lang))
  }, [allKnownLanguages, gameSystem, pf2eAdditionalLanguages, chosenLanguages])

  const handleAddLanguage = (lang: string): void => {
    if (remainingSlots > 0 && !allKnownLanguages.includes(lang)) {
      const current = useBuilderStore.getState().chosenLanguages
      setChosenLanguages([...current, lang])
    }
  }

  const handleRemoveChosenLanguage = (lang: string): void => {
    // Read current state to avoid stale closure issues
    const current = useBuilderStore.getState().chosenLanguages
    setChosenLanguages(current.filter((l) => l !== lang))
  }

  // ── Species Ability Bonus handlers ──
  const handleBonusModeChange = (mode: '2-1' | '1-1-1'): void => {
    setBonusMode(mode)
    setSpeciesAbilityBonuses({})
  }

  const handleSetBonus = (ability: AbilityName, value: number): void => {
    const current = { ...speciesAbilityBonuses }

    if (bonusMode === '2-1') {
      // In +2/+1 mode: clear any existing entry with the same value, set new
      if (value === 2) {
        // Remove existing +2
        for (const key of Object.keys(current)) {
          if (current[key] === 2) delete current[key]
        }
        current[ability] = 2
      } else if (value === 1) {
        // Remove existing +1
        for (const key of Object.keys(current)) {
          if (current[key] === 1) delete current[key]
        }
        current[ability] = 1
      }
      // Don't allow same ability for +2 and +1
      if (current[ability] === 2) {
        for (const key of Object.keys(current)) {
          if (key !== ability && current[key] === 2) delete current[key]
        }
      }
    } else {
      // In +1/+1/+1 mode: toggle ability
      if (current[ability]) {
        delete current[ability]
      } else if (Object.keys(current).length < 3) {
        current[ability] = 1
      }
    }
    setSpeciesAbilityBonuses(current)
  }

  // ── Pet logic ──
  const handleAddPet = (): void => {
    const name = petInput.trim()
    if (name) {
      addPet(name)
      setPetInput('')
    }
  }

  return (
    <div>
      {/* ───────── CHARACTER ───────── */}
      <SectionBanner label="CHARACTER" />
      <div className="px-4 py-3 space-y-2 border-b border-gray-800">
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Class DC</span>
            <span className="text-gray-100 font-bold text-lg">{classDC}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Size</span>
            <span className="text-gray-100 font-bold text-lg">{raceSize || 'Medium'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 text-xs">Speed</span>
            <span className="text-gray-100 font-bold text-lg">{raceSpeed || 30} ft</span>
          </div>
        </div>
      </div>

      {/* ───────── ABILITY SCORES ───────── */}
      <SectionBanner label="ABILITY SCORES" />
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">{methodLabel}</span>
          <button
            onClick={() => openCustomModal('ability-scores')}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_NAMES.map((ab) => {
            const score = abilityScores[ab]
            const mod = abilityModifier(score)
            return (
              <div key={ab} className="flex items-center gap-3">
                <div className="w-12 py-1 bg-amber-900/60 rounded text-center">
                  <span className="text-xs font-bold text-amber-300 uppercase">
                    {ab.slice(0, 3)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-gray-100">{score}</span>
                  <span className="text-sm text-amber-400 font-semibold">{formatMod(mod)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ───────── SPECIES ABILITY BONUSES (2024) ───────── */}
      {hasFlexibleBonuses && (
        <>
          <SectionBanner label="SPECIES ABILITY BONUSES" />
          <div className="px-4 py-3 space-y-3 border-b border-gray-800">
            <div className="flex gap-2">
              <button
                onClick={() => handleBonusModeChange('2-1')}
                className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
                  bonusMode === '2-1'
                    ? 'bg-amber-900/50 border-amber-600 text-amber-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                +2 / +1
              </button>
              <button
                onClick={() => handleBonusModeChange('1-1-1')}
                className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
                  bonusMode === '1-1-1'
                    ? 'bg-amber-900/50 border-amber-600 text-amber-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                +1 / +1 / +1
              </button>
            </div>

            {bonusMode === '2-1' ? (
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500">+2 Bonus</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ABILITY_NAMES.map((ab) => {
                      const is2 = speciesAbilityBonuses[ab] === 2
                      const is1 = speciesAbilityBonuses[ab] === 1
                      return (
                        <button
                          key={ab}
                          onClick={() => handleSetBonus(ab, 2)}
                          disabled={is1}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                            is2
                              ? 'bg-amber-600 border-amber-500 text-gray-900 font-bold'
                              : is1
                                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                                : 'border-gray-600 text-gray-300 hover:border-amber-500'
                          }`}
                        >
                          {ABILITY_LABELS[ab]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">+1 Bonus</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ABILITY_NAMES.map((ab) => {
                      const is1 = speciesAbilityBonuses[ab] === 1
                      const is2 = speciesAbilityBonuses[ab] === 2
                      return (
                        <button
                          key={ab}
                          onClick={() => handleSetBonus(ab, 1)}
                          disabled={is2}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                            is1
                              ? 'bg-amber-600 border-amber-500 text-gray-900 font-bold'
                              : is2
                                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                                : 'border-gray-600 text-gray-300 hover:border-amber-500'
                          }`}
                        >
                          {ABILITY_LABELS[ab]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-xs text-gray-500">Choose 3 abilities for +1 each ({Object.keys(speciesAbilityBonuses).length}/3)</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ABILITY_NAMES.map((ab) => {
                    const selected = !!speciesAbilityBonuses[ab]
                    const maxed = Object.keys(speciesAbilityBonuses).length >= 3 && !selected
                    return (
                      <button
                        key={ab}
                        onClick={() => handleSetBonus(ab, 1)}
                        disabled={maxed}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-amber-600 border-amber-500 text-gray-900 font-bold'
                            : maxed
                              ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                              : 'border-gray-600 text-gray-300 hover:border-amber-500'
                        }`}
                      >
                        {ABILITY_LABELS[ab]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ───────── CHARACTER DETAILS ───────── */}
      <SectionBanner label="CHARACTER DETAILS" />
      <div className="px-4 py-3 space-y-3 border-b border-gray-800">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Gender</label>
            <input
              type="text"
              value={characterGender}
              onChange={(e) => useBuilderStore.setState({ characterGender: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Deity</label>
            <input
              type="text"
              value={characterDeity}
              onChange={(e) => useBuilderStore.setState({ characterDeity: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Age</label>
            <input
              type="text"
              value={characterAge}
              onChange={(e) => useBuilderStore.setState({ characterAge: e.target.value })}
              placeholder="Not set"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ───────── LANGUAGES ───────── */}
      <SectionBanner label="LANGUAGES" />
      <div className="px-4 py-3 space-y-3 border-b border-gray-800">
        {/* Known languages displayed as green pills */}
        {allKnownLanguages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allKnownLanguages.map((lang) => {
              const isChosen = chosenLanguages.includes(lang)
              return (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1 bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full border border-green-700/50"
                >
                  {lang}
                  {isChosen && (
                    <button
                      onClick={() => handleRemoveChosenLanguage(lang)}
                      className="ml-0.5 text-green-400 hover:text-red-400 transition-colors"
                      title={`Remove ${lang}`}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">No languages known</span>
        )}

        {/* Language chooser when bonus slots are available */}
        {remainingSlots > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-amber-400 font-semibold">
              {remainingSlots} language{remainingSlots !== 1 ? 's' : ''} remaining
            </span>

            <div className="flex flex-wrap gap-1.5">
              {availableLanguages.map((lang) => {
                const isStandard = gameSystem === 'pf2e' || STANDARD_LANGUAGES_5E.includes(lang)
                return (
                  <button
                    key={lang}
                    onClick={() => handleAddLanguage(lang)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      isStandard
                        ? 'bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-500 hover:text-amber-300'
                        : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-amber-500 hover:text-amber-300'
                    }`}
                    title={isStandard ? (gameSystem === 'pf2e' ? 'Additional language' : 'Standard language') : 'Exotic language'}
                  >
                    {lang}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ───────── NOTES ───────── */}
      <SectionBanner label="NOTES" />
      <div className="px-4 py-3 border-b border-gray-800">
        <textarea
          value={characterNotes}
          onChange={(e) => useBuilderStore.setState({ characterNotes: e.target.value })}
          placeholder="Write character notes here..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
        />
      </div>

      {/* ───────── HERO POINTS ───────── */}
      <SectionBanner label="HERO POINTS" />
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Hero Points:</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => {
                  const current = heroPoints
                  if (current > i) {
                    useBuilderStore.setState({ heroPoints: i })
                  } else {
                    useBuilderStore.setState({ heroPoints: i + 1 })
                  }
                }}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                title={`Set hero points to ${i + 1}`}
              >
                {heroPoints > i ? (
                  <svg
                    className="w-5 h-5 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <span className="text-sm text-amber-400 font-bold">{heroPoints} / 3</span>
        </div>
      </div>

      {/* ───────── PETS & COMPANIONS ───────── */}
      <SectionBanner label="PETS & COMPANIONS" />
      <div className="px-4 py-3 space-y-3 border-b border-gray-800">
        {pets.length > 0 ? (
          <div className="space-y-1.5">
            {pets.map((pet, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5"
              >
                <span className="text-sm text-gray-200">{pet.name}</span>
                <button
                  onClick={() => removePet(index)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                  title={`Remove ${pet.name}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">No companions yet.</span>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={petInput}
            onChange={(e) => setPetInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPet()
            }}
            placeholder="Companion name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleAddPet}
            disabled={!petInput.trim()}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 disabled:cursor-not-allowed text-sm font-semibold rounded transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* ───────── ASI HISTORY ───────── */}
      {asiSlots.length > 0 && (
        <>
          <SectionBanner label="ASI HISTORY" />
          <div className="border-b border-gray-800">
            {asiSlots.map((slot) => {
              const isConfirmed = slot.selectedId === 'confirmed'
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-mono">
                      Lv {slot.level}
                    </span>
                    {isConfirmed ? (
                      <span className="text-sm text-green-400">{slot.selectedName}</span>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Not chosen</span>
                    )}
                  </div>
                  {isConfirmed ? (
                    <button
                      onClick={() => useBuilderStore.getState().resetAsi(slot.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        useBuilderStore.setState({
                          customModal: 'asi',
                          activeAsiSlotId: slot.id
                        })
                      }
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Choose
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
