import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import type { GameSystem } from '../../types/game-system'
import type { CampaignType, TurnMode, CustomRule } from '../../types/campaign'
import type { GameMap } from '../../types/map'
import { useCampaignStore } from '../../stores/useCampaignStore'
import { loadAdventures, type Adventure } from '../../services/adventure-loader'
import { Button } from '../ui'
import SystemStep from './SystemStep'
import DetailsStep from './DetailsStep'
import AdventureSelector from './AdventureSelector'
import RulesStep from './RulesStep'
import MapConfigStep from './MapConfigStep'
import ReviewStep from './ReviewStep'

const STEPS = ['System', 'Details', 'Adventure', 'Rules', 'Maps', 'Review']

export default function CampaignWizard(): JSX.Element {
  const navigate = useNavigate()
  const createCampaign = useCampaignStore((s) => s.createCampaign)

  // Step state
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Wizard data
  const [system, setSystem] = useState<GameSystem | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [turnMode, setTurnMode] = useState<TurnMode>('initiative')
  const [lobbyMessage, setLobbyMessage] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('custom')
  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null)
  const [customRules, setCustomRules] = useState<CustomRule[]>([])
  const [maps, setMaps] = useState<GameMap[]>([])

  // For review step: resolve adventure name
  const [adventures, setAdventures] = useState<Adventure[]>([])
  useEffect(() => {
    loadAdventures().then(setAdventures)
  }, [])

  const selectedAdventure = adventures.find((a) => a.id === selectedAdventureId) ?? null

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return system !== null
      case 1:
        return name.trim().length > 0
      case 2:
        return campaignType === 'custom' || selectedAdventureId !== null
      case 3:
        return true // Rules are optional
      case 4:
        return true // Maps are optional
      case 5:
        return true // Review
      default:
        return false
    }
  }

  const handleNext = (): void => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    }
  }

  const handleBack = (): void => {
    if (step > 0) {
      setStep((s) => s - 1)
    }
  }

  const handleCreate = async (): Promise<void> => {
    if (!system || !name.trim()) return

    setSubmitting(true)
    try {
      const campaign = await createCampaign({
        name: name.trim(),
        description: description.trim(),
        system,
        type: campaignType,
        presetId: selectedAdventureId ?? undefined,
        dmId: 'local-dm',
        turnMode,
        maps,
        activeMapId: maps.length > 0 ? maps[0].id : undefined,
        npcs: selectedAdventure?.npcs?.map(npc => ({
          id: npc.id,
          name: npc.name,
          description: npc.description ?? '',
          location: npc.location,
          isVisible: npc.role !== 'enemy',
          notes: `Role: ${npc.role}`
        })) ?? [],
        customRules,
        settings: {
          maxPlayers,
          voiceEnabled: false,
          lobbyMessage: lobbyMessage.trim(),
          levelRange: { min: 1, max: 20 },
          allowCharCreationInLobby: true
        }
      })

      navigate(`/campaign/${campaign.id}`)
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Generate a temporary campaign ID for map entries
  const tempCampaignId = 'pending'

  return (
    <div>
      {/* Step indicator */}
      <div className="flex gap-2 mb-2 max-w-2xl">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full transition-colors ${
              i <= step ? 'bg-amber-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
      <p className="text-gray-400 text-sm mb-8">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {/* Step content */}
      {step === 0 && <SystemStep selected={system} onSelect={setSystem} />}

      {step === 1 && (
        <DetailsStep
          data={{ name, description, maxPlayers, turnMode, lobbyMessage }}
          onChange={(data) => {
            setName(data.name)
            setDescription(data.description)
            setMaxPlayers(data.maxPlayers)
            setTurnMode(data.turnMode)
            setLobbyMessage(data.lobbyMessage)
          }}
        />
      )}

      {step === 2 && system && (
        <AdventureSelector
          system={system}
          campaignType={campaignType}
          selectedAdventureId={selectedAdventureId}
          onSelectType={setCampaignType}
          onSelectAdventure={setSelectedAdventureId}
        />
      )}

      {step === 3 && <RulesStep rules={customRules} onChange={setCustomRules} />}

      {step === 4 && (
        <MapConfigStep maps={maps} campaignId={tempCampaignId} onChange={setMaps} />
      )}

      {step === 5 && system && (
        <ReviewStep
          system={system}
          name={name}
          description={description}
          maxPlayers={maxPlayers}
          turnMode={turnMode}
          lobbyMessage={lobbyMessage}
          campaignType={campaignType}
          adventureName={selectedAdventure?.name ?? null}
          customRules={customRules}
          maps={maps}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      )}

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex gap-4 mt-8 max-w-2xl">
          {step > 0 && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button onClick={handleNext} disabled={!canAdvance()}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
