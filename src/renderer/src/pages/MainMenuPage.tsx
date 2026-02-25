import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router'
import { useNetworkStore } from '../stores/use-network-store'

const NetworkSettingsModal = lazy(() => import('../components/game/modals/utility/NetworkSettingsModal'))

const menuItems = [
  {
    label: 'Your Characters',
    path: '/characters',
    description: 'Browse your heroes from past and present campaigns'
  },
  {
    label: 'My Campaigns',
    path: '/make',
    description: 'View, create, and manage your campaigns'
  },
  {
    label: 'Library',
    path: '/library',
    description: 'Browse, import, and export monsters, creatures, NPCs, and more'
  },
  {
    label: 'Join Game',
    path: '/join',
    description: 'Connect to a game hosted by your Dungeon Master'
  },
  {
    label: 'Bastions',
    path: '/bastions',
    description: 'Manage your strongholds, rooms, and hirelings'
  },
  {
    label: 'About & Data',
    path: '/about',
    description: 'App info, updates, and backup/restore your data'
  }
]

export default function MainMenuPage(): JSX.Element {
  const navigate = useNavigate()
  const disconnectReason = useNetworkStore((s) => s.disconnectReason)
  const clearDisconnectReason = useNetworkStore((s) => s.clearDisconnectReason)
  const [showNetworkSettings, setShowNetworkSettings] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      {/* Kick/Ban notification banner */}
      {disconnectReason && (
        <div
          className={`w-full max-w-md flex items-center justify-between px-4 py-3 rounded-lg border ${
            disconnectReason === 'banned' ? 'bg-red-900/30 border-red-700/50' : 'bg-amber-900/30 border-amber-700/50'
          }`}
        >
          <span className={`text-sm ${disconnectReason === 'banned' ? 'text-red-300' : 'text-amber-300'}`}>
            {disconnectReason === 'kicked'
              ? 'You were kicked from the game by the DM.'
              : 'You were banned from the game by the DM.'}
          </span>
          <button
            onClick={clearDisconnectReason}
            className={`ml-4 cursor-pointer ${
              disconnectReason === 'banned' ? 'text-red-400 hover:text-red-200' : 'text-amber-400 hover:text-amber-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-wider text-amber-400 mb-2">D&D Virtual Tabletop</h1>
        <p className="text-gray-400 text-lg">Your adventure awaits</p>
      </div>

      <nav className="flex flex-col gap-4 w-full max-w-md mt-8">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="group flex items-center gap-4 p-5 rounded-lg border border-gray-800
                       bg-gray-900/50 hover:bg-gray-800/80 hover:border-amber-600/50
                       transition-all duration-200 text-left cursor-pointer"
          >
            <div>
              <div className="text-xl font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {item.label}
              </div>
              <div className="text-sm text-gray-500 mt-1">{item.description}</div>
            </div>
          </button>
        ))}
      </nav>

      <button
        onClick={() => setShowNetworkSettings(true)}
        className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer underline"
      >
        Network Settings
      </button>

      <p className="text-gray-600 text-sm mt-4">
        Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
      </p>

      {showNetworkSettings && (
        <Suspense fallback={null}>
          <NetworkSettingsModal onClose={() => setShowNetworkSettings(false)} />
        </Suspense>
      )}
    </div>
  )
}
