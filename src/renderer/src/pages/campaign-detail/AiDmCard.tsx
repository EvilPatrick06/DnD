import { useState } from 'react'
import OllamaSetupStep from '../../components/campaign/OllamaSetupStep'
import { Button, Card, Modal } from '../../components/ui'
import { DEFAULT_OLLAMA_URL } from '../../constants/app-constants'
import type { Campaign } from '../../types/campaign'

interface AiDmCardProps {
  campaign: Campaign
  saveCampaign: (c: Campaign) => Promise<void>
}

export default function AiDmCard({ campaign, saveCampaign }: AiDmCardProps): JSX.Element {
  const [showAiDmModal, setShowAiDmModal] = useState(false)
  const [aiDmConfig, setAiDmConfig] = useState<{
    enabled: boolean
    ollamaModel: string
    ollamaUrl: string
  }>({ enabled: false, ollamaModel: 'llama3.1', ollamaUrl: DEFAULT_OLLAMA_URL })

  const openConfigure = (): void => {
    setAiDmConfig({
      enabled: campaign.aiDm?.enabled ?? false,
      ollamaModel: campaign.aiDm?.ollamaModel ?? 'llama3.1',
      ollamaUrl: campaign.aiDm?.ollamaUrl ?? DEFAULT_OLLAMA_URL
    })
    setShowAiDmModal(true)
  }

  const openEnable = (): void => {
    setAiDmConfig({
      enabled: true,
      ollamaModel: 'llama3.1',
      ollamaUrl: DEFAULT_OLLAMA_URL
    })
    setShowAiDmModal(true)
  }

  return (
    <>
      <Card title="AI Dungeon Master">
        {campaign.aiDm?.enabled ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Enabled</span>
              <span className="text-xs text-gray-400">Ollama</span>
              <span className="text-xs text-gray-500">{campaign.aiDm.ollamaModel ?? 'default'}</span>
            </div>
            <button onClick={openConfigure} className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
              Configure
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-2">AI DM is not enabled for this campaign.</p>
            <button onClick={openEnable} className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer">
              Enable AI DM
            </button>
          </div>
        )}
      </Card>

      {/* AI DM Config Modal */}
      <Modal open={showAiDmModal} onClose={() => setShowAiDmModal(false)} title="Configure AI Dungeon Master">
        <div className="max-h-[60vh] overflow-y-auto">
          <OllamaSetupStep
            enabled={aiDmConfig.enabled}
            ollamaModel={aiDmConfig.ollamaModel}
            ollamaUrl={aiDmConfig.ollamaUrl}
            onOllamaReady={() => {}}
            onChange={(data) => setAiDmConfig(data)}
          />
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setShowAiDmModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const aiDm = {
                enabled: aiDmConfig.enabled,
                ollamaModel: aiDmConfig.ollamaModel,
                ollamaUrl: aiDmConfig.ollamaUrl
              }
              await saveCampaign({ ...campaign, aiDm, updatedAt: new Date().toISOString() })
              if (aiDmConfig.enabled) {
                try {
                  await window.api.ai.configure({
                    ollamaModel: aiDmConfig.ollamaModel,
                    ollamaUrl: aiDmConfig.ollamaUrl
                  })
                } catch {
                  /* ignore configure errors */
                }
              }
              setShowAiDmModal(false)
            }}
          >
            Save
          </Button>
        </div>
      </Modal>
    </>
  )
}
