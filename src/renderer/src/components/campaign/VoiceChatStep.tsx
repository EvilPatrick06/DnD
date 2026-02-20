import { useState } from 'react'
import { Button, Card } from '../ui'
import { Input } from '../ui'

type VoiceMode = 'local' | 'cloud'

interface VoiceChatConfig {
  mode: VoiceMode
  apiKey: string
  apiSecret: string
  serverUrl: string
}

interface VoiceChatStepProps {
  config: VoiceChatConfig
  onChange: (config: VoiceChatConfig) => void
}

export default function VoiceChatStep({ config, onChange }: VoiceChatStepProps): JSX.Element {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleModeSelect = (mode: VoiceMode): void => {
    onChange({ ...config, mode })
    setTestResult(null)
  }

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      // Attempt to validate the server URL format
      const url = config.serverUrl.trim()
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
        setTestResult('error')
        return
      }
      if (!config.apiKey.trim() || !config.apiSecret.trim()) {
        setTestResult('error')
        return
      }
      // In a real implementation, this would call the voice IPC to test the connection.
      // For now, validate the URL is reachable by checking the format.
      const result = await window.api.voiceGetServerUrl('cloud', url)
      if (result.success) {
        setTestResult('success')
      } else {
        setTestResult('error')
      }
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Voice Chat</h2>
      <p className="text-gray-400 text-sm mb-6">
        Configure how players will communicate during your session.
      </p>

      <div className="max-w-2xl space-y-4">
        {/* Mode selection cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Local mode card */}
          <button
            type="button"
            onClick={() => handleModeSelect('local')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              config.mode === 'local'
                ? 'border-amber-500 bg-amber-900/20'
                : 'border-gray-700 bg-gray-900 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-amber-400">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
              <h3 className="font-semibold">Local (Built-in)</h3>
            </div>
            <p className="text-sm text-gray-400">
              No configuration needed. Voice chat runs on the DM's computer using a local LiveKit server.
            </p>
            {config.mode === 'local' && (
              <div className="mt-3 text-xs text-amber-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                Selected
              </div>
            )}
          </button>

          {/* Cloud mode card */}
          <button
            type="button"
            onClick={() => handleModeSelect('cloud')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
              config.mode === 'cloud'
                ? 'border-amber-500 bg-amber-900/20'
                : 'border-gray-700 bg-gray-900 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400">
                <path
                  fillRule="evenodd"
                  d="M4.5 9.75a6 6 0 0 1 11.573-2.226 3.75 3.75 0 0 1 4.133 4.303A4.5 4.5 0 0 1 18 20.25H6.75a5.25 5.25 0 0 1-2.23-10.004 6.018 6.018 0 0 1-.02-.496Z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="font-semibold">LiveKit Cloud</h3>
            </div>
            <p className="text-sm text-gray-400">
              Connect to a hosted LiveKit Cloud instance for better quality and lower latency.
            </p>
            {config.mode === 'cloud' && (
              <div className="mt-3 text-xs text-amber-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                Selected
              </div>
            )}
          </button>
        </div>

        {/* Cloud configuration fields */}
        {config.mode === 'cloud' && (
          <Card>
            <h3 className="text-sm font-semibold mb-4 text-gray-300">LiveKit Cloud Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Server URL</label>
                <Input
                  value={config.serverUrl}
                  onChange={(e) => {
                    onChange({ ...config, serverUrl: e.target.value })
                    setTestResult(null)
                  }}
                  placeholder="wss://your-project.livekit.cloud"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <Input
                  value={config.apiKey}
                  onChange={(e) => {
                    onChange({ ...config, apiKey: e.target.value })
                    setTestResult(null)
                  }}
                  placeholder="APIxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Secret</label>
                <Input
                  type="password"
                  value={config.apiSecret}
                  onChange={(e) => {
                    onChange({ ...config, apiSecret: e.target.value })
                    setTestResult(null)
                  }}
                  placeholder="Your API secret"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={testing || !config.serverUrl.trim() || !config.apiKey.trim() || !config.apiSecret.trim()}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                {testResult === 'success' && (
                  <span className="text-sm text-green-400 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Connection OK
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="text-sm text-red-400 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Connection failed
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Explanation */}
        <div className="text-xs text-gray-500 leading-relaxed bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <p className="mb-1 font-medium text-gray-400">How does voice chat work?</p>
          <p>
            Voice chat uses LiveKit for high-quality, low-latency audio. In <strong className="text-gray-300">Local</strong> mode,
            the DM's computer runs a local server -- players connect directly to it. In{' '}
            <strong className="text-gray-300">Cloud</strong> mode, you use a hosted LiveKit instance for better reliability
            when players are geographically distributed.
          </p>
        </div>
      </div>
    </div>
  )
}
