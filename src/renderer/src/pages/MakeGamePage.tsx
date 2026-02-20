import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CampaignWizard } from '../components/campaign'
import { BackButton, Button } from '../components/ui'
import { importCampaignFromFile } from '../services/campaign-io'
import { useCampaignStore } from '../stores/useCampaignStore'

export default function MakeGamePage(): JSX.Element {
  const navigate = useNavigate()
  const saveCampaign = useCampaignStore((s) => s.saveCampaign)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    setImportError(null)
    try {
      const campaign = await importCampaignFromFile()
      if (campaign) {
        await saveCampaign(campaign)
        navigate(`/campaign/${campaign.id}`)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import campaign')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <BackButton to="/" />

      <div className="flex items-center justify-between mb-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Create a Campaign</h1>
        <Button variant="secondary" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing...' : 'Import .dndcamp'}
        </Button>
      </div>

      {importError && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/30 text-sm text-red-300 max-w-2xl">
          {importError}
        </div>
      )}

      <CampaignWizard />
    </div>
  )
}
