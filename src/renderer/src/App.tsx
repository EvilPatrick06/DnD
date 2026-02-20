import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import { DiceOverlay } from './components/game/dice3d'
import { ErrorBoundary, ShortcutsOverlay, Spinner, ToastContainer } from './components/ui'
import { addToast } from './hooks/useToast'
import MainMenuPage from './pages/MainMenuPage'

const ViewCharactersPage = lazy(() => import('./pages/ViewCharactersPage'))
const JoinGamePage = lazy(() => import('./pages/JoinGamePage'))
const MakeGamePage = lazy(() => import('./pages/MakeGamePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const LobbyPage = lazy(() => import('./pages/LobbyPage'))
const InGamePage = lazy(() => import('./pages/InGamePage'))
const CreateCharacterPage = lazy(() => import('./pages/CreateCharacterPage'))
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const BastionPage = lazy(() => import('./pages/BastionPage'))
const CharacterSheet5ePage = lazy(() => import('./pages/CharacterSheet5ePage'))
const LevelUp5ePage = lazy(() => import('./pages/LevelUp5ePage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App(): JSX.Element {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

      if (e.key === '?' && !isInput) {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
        return
      }

      if (e.key === 'Escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false)
          return
        }
      }
    },
    [shortcutsOpen]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  useEffect(() => {
    const handler = (e: PromiseRejectionEvent): void => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      console.error('[UnhandledRejection]', e.reason)
      addToast(`Unexpected error: ${msg}`, 'error')
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return (
    <div className="relative min-h-screen bg-gray-950 text-gray-100">
      <DiceOverlay />
      <ToastContainer />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen">
              <Spinner size="lg" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<MainMenuPage />} />
            <Route path="/characters" element={<ViewCharactersPage />} />
            <Route path="/characters/create" element={<ErrorBoundary><CreateCharacterPage /></ErrorBoundary>} />
            <Route path="/characters/5e/create" element={<ErrorBoundary><CreateCharacterPage /></ErrorBoundary>} />
            <Route path="/characters/5e/edit/:id" element={<ErrorBoundary><CreateCharacterPage /></ErrorBoundary>} />
            <Route path="/characters/5e/:id" element={<ErrorBoundary><CharacterSheet5ePage /></ErrorBoundary>} />
            <Route path="/characters/5e/:id/levelup" element={<ErrorBoundary><LevelUp5ePage /></ErrorBoundary>} />
            <Route path="/characters/edit/:id" element={<ErrorBoundary><CreateCharacterPage /></ErrorBoundary>} />
            <Route path="/join" element={<JoinGamePage />} />
            <Route path="/make" element={<MakeGamePage />} />
            <Route path="/campaign/:id" element={<ErrorBoundary><CampaignDetailPage /></ErrorBoundary>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/lobby/:campaignId" element={<ErrorBoundary><LobbyPage /></ErrorBoundary>} />
            <Route path="/game/:campaignId" element={<ErrorBoundary><InGamePage /></ErrorBoundary>} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/bastions" element={<BastionPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default App
