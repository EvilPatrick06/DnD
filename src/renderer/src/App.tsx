import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { DiceOverlay } from './components/game/dice3d'
import MainMenuPage from './pages/MainMenuPage'

// Lazy-loaded pages — only fetched when navigated to
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

function App(): JSX.Element {
  return (
    <div className="relative min-h-screen bg-gray-950 text-gray-100">
      {/* Global 3D dice overlay — available on all pages (character sheet death saves, etc.) */}
      <DiceOverlay />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="text-gray-500 text-sm">Loading...</div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/characters" element={<ViewCharactersPage />} />
          <Route path="/characters/create" element={<CreateCharacterPage />} />
          {/* System-prefixed builder routes */}
          <Route path="/characters/5e/create" element={<CreateCharacterPage />} />
          <Route path="/characters/5e/edit/:id" element={<CreateCharacterPage />} />
          {/* System-prefixed sheet routes */}
          <Route path="/characters/5e/:id" element={<CharacterSheet5ePage />} />
          {/* System-prefixed level-up routes */}
          <Route path="/characters/5e/:id/levelup" element={<LevelUp5ePage />} />
          {/* Redirect route for backward compatibility */}
          <Route path="/characters/edit/:id" element={<CreateCharacterPage />} />
          <Route path="/join" element={<JoinGamePage />} />
          <Route path="/make" element={<MakeGamePage />} />
          <Route path="/campaign/:id" element={<CampaignDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/lobby/:campaignId" element={<LobbyPage />} />
          <Route path="/game/:campaignId" element={<InGamePage />} />
          <Route path="/bastions" element={<BastionPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
