import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '../ui'

type SetupPhase = 'idle' | 'detecting' | 'downloading' | 'installing' | 'starting' | 'pulling' | 'ready' | 'error'

interface CuratedModel {
  id: string
  name: string
  vramMB: number
  desc: string
}

interface AiDmStepProps {
  enabled: boolean
  provider: 'claude' | 'ollama'
  model: 'opus' | 'sonnet' | 'haiku'
  apiKey: string
  ollamaModel: string
  onOllamaReady: (ready: boolean) => void
  onChange: (data: {
    enabled: boolean
    provider: 'claude' | 'ollama'
    model: 'opus' | 'sonnet' | 'haiku'
    apiKey: string
    ollamaModel: string
  }) => void
}

export default function AiDmStep({
  enabled,
  provider,
  model,
  apiKey,
  ollamaModel,
  onOllamaReady,
  onChange
}: AiDmStepProps): JSX.Element {
  // Claude state
  const [testing, setTesting] = useState(false)
  const [claudeOk, setClaudeOk] = useState<boolean | null>(null)

  // Ollama state
  const [setupPhase, setSetupPhase] = useState<SetupPhase>('idle')
  const [ollamaInstalled, setOllamaInstalled] = useState(false)
  const [ollamaRunning, setOllamaRunning] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [vramMB, setVramMB] = useState(0)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [pullProgress, setPullProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [curatedModels, setCuratedModels] = useState<CuratedModel[]>([])
  const [installedModels, setInstalledModels] = useState<string[]>([])

  // Detect Ollama status when provider is ollama
  const detectStatus = useCallback(async () => {
    setSetupPhase('detecting')
    setErrorMessage(null)
    try {
      const [status, vram, models, installed] = await Promise.all([
        window.api.ai.detectOllama(),
        window.api.ai.getVram(),
        window.api.ai.getCuratedModels(),
        window.api.ai.listInstalledModels()
      ])
      setOllamaInstalled(status.installed)
      setOllamaRunning(status.running)
      setVramMB(vram.totalMB)
      setCuratedModels(models)
      setInstalledModels(installed)

      // Check if selected model is already installed
      const isModelReady = installed.some((m) => m.startsWith(ollamaModel.split(':')[0]))
      setModelReady(isModelReady)

      if (status.installed && status.running && isModelReady) {
        setSetupPhase('ready')
        onOllamaReady(true)
      } else {
        setSetupPhase('idle')
        onOllamaReady(false)
      }
    } catch {
      setSetupPhase('idle')
      onOllamaReady(false)
    }
  }, [ollamaModel, onOllamaReady])

  useEffect(() => {
    if (enabled && provider === 'ollama') {
      detectStatus()

      // Listen for progress events
      window.api.ai.onOllamaProgress((data) => {
        if (data.type === 'download') setDownloadProgress(data.percent)
        if (data.type === 'pull') setPullProgress(data.percent)
      })
    }

    return () => {
      // Cleanup handled by removeAllAiListeners on unmount
    }
  }, [enabled, provider, detectStatus])

  // Auto-setup flow
  const handleAutoSetup = async (): Promise<void> => {
    setErrorMessage(null)
    try {
      // Step 1: Download (if not installed)
      if (!ollamaInstalled) {
        setSetupPhase('downloading')
        setDownloadProgress(0)
        const dlResult = await window.api.ai.downloadOllama()
        if (!dlResult.success) {
          throw new Error(dlResult.error || 'Download failed')
        }

        // Step 2: Install
        setSetupPhase('installing')
        const installResult = await window.api.ai.installOllama(dlResult.path!)
        if (!installResult.success) {
          throw new Error(installResult.error || 'Installation failed')
        }
        setOllamaInstalled(true)
      }

      // Step 3: Start (if not running)
      if (!ollamaRunning) {
        setSetupPhase('starting')
        const startResult = await window.api.ai.startOllama()
        if (!startResult.success) {
          throw new Error(startResult.error || 'Failed to start Ollama')
        }
        setOllamaRunning(true)
      }

      // Step 4: Pull model (if not ready)
      if (!modelReady) {
        setSetupPhase('pulling')
        setPullProgress(0)
        const pullResult = await window.api.ai.pullModel(ollamaModel)
        if (!pullResult.success) {
          throw new Error(pullResult.error || 'Failed to pull model')
        }
        setModelReady(true)

        // Refresh installed models list
        const installed = await window.api.ai.listInstalledModels()
        setInstalledModels(installed)
      }

      setSetupPhase('ready')
      onOllamaReady(true)
    } catch (err) {
      setSetupPhase('error')
      setErrorMessage(err instanceof Error ? err.message : String(err))
      onOllamaReady(false)
    }
  }

  // Claude test connection
  const handleTestConnection = async (): Promise<void> => {
    if (!apiKey.trim()) return
    setTesting(true)
    setClaudeOk(null)
    try {
      await window.api.ai.configure({
        provider: 'claude',
        model,
        apiKey: apiKey.trim()
      })
      const result = await window.api.ai.checkProviders()
      setClaudeOk(result.claude)
    } catch {
      setClaudeOk(false)
    } finally {
      setTesting(false)
    }
  }

  // GPU description
  const gpuDesc =
    vramMB > 0 ? `NVIDIA GPU detected (${Math.round(vramMB / 1024)} GB VRAM)` : 'No NVIDIA GPU detected (CPU mode)'

  // Which curated models can this GPU run
  const modelFitsGpu = (m: CuratedModel): boolean => vramMB === 0 || m.vramMB <= vramMB

  const isSetupBusy = ['downloading', 'installing', 'starting', 'pulling'].includes(setupPhase)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">AI Dungeon Master</h2>
      <p className="text-gray-400 text-sm mb-6">Optionally enable an AI-powered Dungeon Master for your campaign.</p>

      <div className="max-w-2xl space-y-4">
        {/* Enable toggle */}
        <Card>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) =>
                onChange({
                  enabled: e.target.checked,
                  provider,
                  model,
                  apiKey,
                  ollamaModel
                })
              }
              className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-amber-500 focus:ring-amber-500"
            />
            <div>
              <span className="font-medium">Enable AI Dungeon Master</span>
              <p className="text-gray-400 text-sm mt-0.5">
                The AI will narrate scenes, run combat, manage NPCs, and track character stats. You keep full DM
                controls and can override at any time.
              </p>
            </div>
          </label>
        </Card>

        {enabled && (
          <>
            {/* Provider selection cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onChange({ enabled, provider: 'ollama', model, apiKey, ollamaModel })}
                className={`text-left p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                  provider === 'ollama'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="font-medium mb-1">Free (Ollama)</div>
                <p className="text-gray-400 text-xs">
                  Runs locally on your computer. Free, private, no API key needed.
                </p>
              </button>

              <button
                onClick={() => onChange({ enabled, provider: 'claude', model, apiKey, ollamaModel })}
                className={`text-left p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                  provider === 'claude'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="font-medium mb-1">Claude API</div>
                <p className="text-gray-400 text-xs">Best quality responses. Requires an Anthropic API key ($).</p>
              </button>
            </div>

            {/* Ollama path */}
            {provider === 'ollama' && (
              <Card>
                <h3 className="font-medium mb-3">Ollama Setup</h3>

                {/* Status checklist */}
                <div className="space-y-2 mb-4">
                  <StatusItem
                    label="Ollama installed"
                    done={ollamaInstalled}
                    active={setupPhase === 'downloading' || setupPhase === 'installing'}
                    progress={setupPhase === 'downloading' ? downloadProgress : undefined}
                    phaseLabel={
                      setupPhase === 'downloading'
                        ? `Downloading... ${downloadProgress}%`
                        : setupPhase === 'installing'
                          ? 'Installing...'
                          : undefined
                    }
                  />
                  <StatusItem
                    label="Ollama running"
                    done={ollamaRunning}
                    active={setupPhase === 'starting'}
                    phaseLabel={setupPhase === 'starting' ? 'Starting server...' : undefined}
                  />
                  <StatusItem
                    label="Model ready"
                    done={modelReady}
                    active={setupPhase === 'pulling'}
                    progress={setupPhase === 'pulling' ? pullProgress : undefined}
                    phaseLabel={setupPhase === 'pulling' ? `Pulling model... ${pullProgress}%` : undefined}
                  />
                </div>

                {/* Setup / Retry button */}
                {setupPhase !== 'ready' && (
                  <div className="mb-4">
                    {errorMessage && <p className="text-red-400 text-sm mb-2">{errorMessage}</p>}
                    <Button onClick={handleAutoSetup} disabled={isSetupBusy || setupPhase === 'detecting'}>
                      {isSetupBusy
                        ? 'Setting up...'
                        : setupPhase === 'error'
                          ? 'Retry Setup'
                          : setupPhase === 'detecting'
                            ? 'Detecting...'
                            : !ollamaInstalled
                              ? 'Install & Setup'
                              : !ollamaRunning
                                ? 'Start & Setup'
                                : 'Pull Model'}
                    </Button>
                  </div>
                )}

                {setupPhase === 'ready' && <p className="text-green-400 text-sm mb-4">Ready to go!</p>}

                {/* Model selector */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <select
                    value={ollamaModel}
                    onChange={(e) => {
                      onChange({ enabled, provider, model, apiKey, ollamaModel: e.target.value })
                      // Check if newly selected model is already installed
                      const isReady = installedModels.some((m) => m.startsWith(e.target.value.split(':')[0]))
                      setModelReady(isReady)
                      if (!isReady) {
                        setSetupPhase('idle')
                        onOllamaReady(false)
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  >
                    {curatedModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.desc}
                        {!modelFitsGpu(m) ? ' (may be slow)' : ''}
                        {installedModels.some((i) => i.startsWith(m.id.split(':')[0])) ? ' (installed)' : ''}
                      </option>
                    ))}
                    {/* Show installed models not in curated list */}
                    {installedModels
                      .filter((m) => !curatedModels.some((c) => m.startsWith(c.id.split(':')[0])))
                      .map((m) => (
                        <option key={m} value={m}>
                          {m} (installed)
                        </option>
                      ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-1">{gpuDesc}</p>
                </div>
              </Card>
            )}

            {/* Claude path */}
            {provider === 'claude' && (
              <Card>
                <h3 className="font-medium mb-3">Claude Configuration</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) =>
                          onChange({
                            enabled,
                            provider,
                            model,
                            apiKey: e.target.value,
                            ollamaModel
                          })
                        }
                        placeholder="sk-ant-..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <Button variant="secondary" onClick={handleTestConnection} disabled={testing || !apiKey.trim()}>
                        {testing ? 'Testing...' : 'Test'}
                      </Button>
                    </div>
                    {claudeOk !== null && (
                      <p className={`text-sm mt-1 ${claudeOk ? 'text-green-400' : 'text-red-400'}`}>
                        {claudeOk ? 'Connection successful' : 'Connection failed — check your API key'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Model</label>
                    <select
                      value={model}
                      onChange={(e) =>
                        onChange({
                          enabled,
                          provider,
                          model: e.target.value as 'opus' | 'sonnet' | 'haiku',
                          apiKey,
                          ollamaModel
                        })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="opus">Opus 4 (Most capable, highest cost)</option>
                      <option value="sonnet">Sonnet 4 (Recommended)</option>
                      <option value="haiku">Haiku 4 (Fastest, lowest cost)</option>
                    </select>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Status checklist item */
function StatusItem({
  label,
  done,
  active,
  progress,
  phaseLabel
}: {
  label: string
  done: boolean
  active?: boolean
  progress?: number
  phaseLabel?: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
          done
            ? 'border-green-500 bg-green-500/20 text-green-400'
            : active
              ? 'border-amber-500 bg-amber-500/20 text-amber-400 animate-pulse'
              : 'border-gray-600 text-gray-600'
        }`}
      >
        {done ? '\u2713' : active ? '\u2022' : ''}
      </span>
      <span className={`text-sm ${done ? 'text-green-400' : active ? 'text-amber-400' : 'text-gray-400'}`}>
        {phaseLabel || label}
      </span>
      {active && progress !== undefined && (
        <div className="flex-1 max-w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden ml-2">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
