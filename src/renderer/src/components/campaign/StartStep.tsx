import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { exportCampaignToFile } from '../../services/campaign-io'
import { useCampaignStore } from '../../stores/useCampaignStore'
import type { Campaign } from '../../types/campaign'

interface StartStepProps {
  onNewCampaign: () => void
}

export default function StartStep({ onNewCampaign }: StartStepProps): JSX.Element {
  const navigate = useNavigate()
  const campaigns = useCampaignStore((s) => s.campaigns)
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns)
  const deleteCampaign = useCampaignStore((s) => s.deleteCampaign)

  const [showExisting, setShowExisting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  const handleExport = async (campaign: Campaign): Promise<void> => {
    await exportCampaignToFile(campaign)
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteCampaign(id)
    setConfirmDelete(null)
  }

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-100 mb-2">Campaign Setup</h2>
      <p className="text-gray-400 text-sm mb-8">Create a new campaign or load an existing one.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* New Campaign */}
        <button
          onClick={onNewCampaign}
          className="group p-6 rounded-xl border-2 border-gray-700 hover:border-amber-500
            bg-gray-800/50 hover:bg-amber-600/10 transition-all cursor-pointer text-left"
        >
          <div className="text-3xl mb-3">&#10010;</div>
          <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
            New Campaign
          </h3>
          <p className="text-xs text-gray-500 mt-1">Create a fresh campaign with the step-by-step wizard.</p>
        </button>

        {/* Load Existing */}
        <button
          onClick={() => setShowExisting(!showExisting)}
          className={`group p-6 rounded-xl border-2 transition-all cursor-pointer text-left ${
            showExisting
              ? 'border-amber-500 bg-amber-600/10'
              : 'border-gray-700 hover:border-amber-500 bg-gray-800/50 hover:bg-amber-600/10'
          }`}
        >
          <div className="text-3xl mb-3">&#128193;</div>
          <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
            Load Existing
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {campaigns.length > 0
              ? `${campaigns.length} saved campaign${campaigns.length !== 1 ? 's' : ''} found.`
              : 'No saved campaigns yet.'}
          </p>
        </button>
      </div>

      {/* Campaign list */}
      {showExisting && (
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">No saved campaigns. Create one first!</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
              {campaigns.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100 truncate">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-red-900/40 text-red-400">
                        5e
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Updated {formatDate(c.updatedAt)}
                      {c.maps?.length > 0 && (
                        <>
                          {' '}
                          &middot; {c.maps.length} map{c.maps.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => navigate(`/campaign/${c.id}`)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500
                        text-white transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleExport(c)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 hover:bg-gray-600
                        text-gray-300 transition-colors cursor-pointer"
                      title="Export to file"
                    >
                      Export
                    </button>
                    {confirmDelete === c.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500
                            text-white transition-colors cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600
                            text-gray-300 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(c.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 hover:bg-red-600/30
                          text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete campaign"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
