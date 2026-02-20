import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { type Adventure, loadAdventures } from '../../services/adventure-loader'
import { useCampaignStore } from '../../stores/useCampaignStore'
import type { CalendarConfig, CampaignType, CustomRule, TurnMode } from '../../types/campaign'
import type { GameSystem } from '../../types/game-system'
import type { GameMap } from '../../types/map'
import { Button } from '../ui'
import AdventureSelector from './AdventureSelector'
import AiDmStep from './AiDmStep'
import AudioStep, { type CustomAudioEntry } from './AudioStep'
import CalendarStep from './CalendarStep'
import DetailsStep from './DetailsStep'
import MapConfigStep from './MapConfigStep'
import ReviewStep from './ReviewStep'
import RulesStep from './RulesStep'
import StartStep from './StartStep'
import SystemStep from './SystemStep'
import VoiceChatStep from './VoiceChatStep'

const STEPS = ['System', 'Details', 'AI DM', 'Adventure', 'Rules', 'Calendar', 'Maps', 'Voice', 'Audio', 'Review']

export default function CampaignWizard(): JSX.Element {
  const navigate = useNavigate()
  const createCampaign = useCampaignStore((s) => s.createCampaign)

  // Start mode: show campaign browser first, then wizard
  const [startMode, setStartMode] = useState<'start' | 'wizard'>('start')

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
  const [calendar, setCalendar] = useState<CalendarConfig | null>(null)
  const [maps, setMaps] = useState<GameMap[]>([])
  const [customAudio, setCustomAudio] = useState<CustomAudioEntry[]>([])

  // Voice chat config
  const [voiceConfig, setVoiceConfig] = useState<{
    mode: 'local' | 'cloud'
    apiKey: string
    apiSecret: string
    serverUrl: string
  }>({ mode: 'local', apiKey: '', apiSecret: '', serverUrl: 'wss://' })

  // AI DM config
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiProvider, setAiProvider] = useState<'claude' | 'ollama'>('claude')
  const [aiModel, setAiModel] = useState<'opus' | 'sonnet' | 'haiku'>('sonnet')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiOllamaModel, setAiOllamaModel] = useState('llama3.1')
  const [ollamaReady, setOllamaReady] = useState(false)

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
        if (!aiEnabled) return true
        if (aiProvider === 'ollama') return ollamaReady
        return aiApiKey.trim().length > 0
      case 3:
        return campaignType === 'custom' || selectedAdventureId !== null
      case 4:
        return true // Rules are optional
      case 5:
        return true // Calendar is optional
      case 6:
        return true // Maps are optional
      case 7:
        return true // Voice is optional
      case 8:
        return true // Audio is optional
      case 9:
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
      // Build maps list: merge adventure map assignments with user-selected maps
      const campaignMaps = [...maps]
      if (selectedAdventure?.mapAssignments) {
        for (const assignment of selectedAdventure.mapAssignments) {
          // Only add built-in maps not already in the list
          if (!campaignMaps.some((m) => m.id === assignment.builtInMapId)) {
            const chapter = selectedAdventure.chapters[assignment.chapterIndex]
            campaignMaps.push({
              id: assignment.builtInMapId,
              name: chapter?.title ?? assignment.builtInMapId,
              campaignId: 'pending',
              imagePath: `./data/5e/maps/${assignment.builtInMapId}.png`,
              width: 1920,
              height: 1080,
              grid: {
                enabled: true,
                cellSize: 40,
                offsetX: 0,
                offsetY: 0,
                color: '#ffffff',
                opacity: 0.2,
                type: 'square'
              },
              tokens: [],
              fogOfWar: { enabled: false, revealedCells: [] },
              terrain: [],
              createdAt: new Date().toISOString()
            })
          }
        }
      }

      const campaign = await createCampaign({
        name: name.trim(),
        description: description.trim(),
        system,
        type: campaignType,
        presetId: selectedAdventureId ?? undefined,
        dmId: 'local-dm',
        turnMode,
        maps: campaignMaps,
        activeMapId: campaignMaps.length > 0 ? campaignMaps[0].id : undefined,
        npcs:
          selectedAdventure?.npcs?.map((npc) => ({
            id: npc.id,
            name: npc.name,
            description: npc.description ?? '',
            location: npc.location,
            isVisible: npc.role !== 'enemy',
            statBlockId: npc.statBlockId,
            role: npc.role,
            personality: npc.personality,
            motivation: npc.motivation,
            notes: `Role: ${npc.role}`
          })) ?? [],
        encounters: selectedAdventure?.encounters ?? undefined,
        lore:
          selectedAdventure?.lore?.map((l) => ({
            id: l.id,
            title: l.title,
            content: l.content,
            category: l.category,
            isVisibleToPlayers: l.category !== 'faction',
            createdAt: new Date().toISOString()
          })) ?? undefined,
        customRules,
        settings: {
          maxPlayers,
          voiceEnabled: voiceConfig.mode !== undefined,
          lobbyMessage: lobbyMessage.trim(),
          levelRange: selectedAdventure?.levelRange ?? { min: 1, max: 20 },
          allowCharCreationInLobby: true
        },
        voiceChat: {
          mode: voiceConfig.mode,
          ...(voiceConfig.mode === 'cloud'
            ? {
                apiKey: voiceConfig.apiKey,
                apiSecret: voiceConfig.apiSecret,
                serverUrl: voiceConfig.serverUrl
              }
            : {})
        },
        calendar: calendar ?? undefined,
        customAudio:
          customAudio.length > 0
            ? customAudio.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                displayName: a.displayName,
                category: a.category
              }))
            : undefined,
        aiDm: aiEnabled
          ? {
              enabled: true,
              provider: aiProvider,
              model: aiModel,
              ollamaModel: aiProvider === 'ollama' ? aiOllamaModel : undefined
            }
          : undefined
      })

      // If AI DM enabled, configure the provider
      if (aiEnabled) {
        await window.api.ai.configure({
          provider: aiProvider,
          model: aiModel,
          apiKey: aiProvider === 'claude' ? aiApiKey : undefined,
          ollamaModel: aiProvider === 'ollama' ? aiOllamaModel : undefined
        })
      }

      navigate(`/campaign/${campaign.id}`)
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Generate a temporary campaign ID for map entries
  const tempCampaignId = 'pending'

  const reviewStepIndex = STEPS.length - 1

  if (startMode === 'start') {
    return (
      <div>
        <StartStep onNewCampaign={() => setStartMode('wizard')} />
      </div>
    )
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex gap-2 mb-2 max-w-2xl">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-full transition-colors ${i <= step ? 'bg-amber-500' : 'bg-gray-700'}`}
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

      {step === 2 && (
        <AiDmStep
          enabled={aiEnabled}
          provider={aiProvider}
          model={aiModel}
          apiKey={aiApiKey}
          ollamaModel={aiOllamaModel}
          onOllamaReady={setOllamaReady}
          onChange={(data) => {
            setAiEnabled(data.enabled)
            setAiProvider(data.provider)
            setAiModel(data.model)
            setAiApiKey(data.apiKey)
            setAiOllamaModel(data.ollamaModel)
          }}
        />
      )}

      {step === 3 && system && (
        <AdventureSelector
          system={system}
          campaignType={campaignType}
          selectedAdventureId={selectedAdventureId}
          onSelectType={setCampaignType}
          onSelectAdventure={setSelectedAdventureId}
        />
      )}

      {step === 4 && <RulesStep rules={customRules} onChange={setCustomRules} />}

      {step === 5 && <CalendarStep calendar={calendar} onChange={setCalendar} />}

      {step === 6 && <MapConfigStep maps={maps} campaignId={tempCampaignId} onChange={setMaps} />}

      {step === 7 && <VoiceChatStep config={voiceConfig} onChange={setVoiceConfig} />}

      {step === 8 && <AudioStep audioEntries={customAudio} onChange={setCustomAudio} />}

      {step === reviewStepIndex && system && (
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
          customAudioCount={customAudio.length}
          calendar={calendar}
          aiDm={aiEnabled ? { provider: aiProvider, model: aiModel, ollamaModel: aiOllamaModel } : null}
          onSubmit={handleCreate}
          submitting={submitting}
        />
      )}

      {/* Navigation buttons */}
      {step < reviewStepIndex && (
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
