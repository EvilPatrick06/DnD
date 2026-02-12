import { Routes, Route } from 'react-router'
import MainMenuPage from './pages/MainMenuPage'
import ViewCharactersPage from './pages/ViewCharactersPage'
import JoinGamePage from './pages/JoinGamePage'
import MakeGamePage from './pages/MakeGamePage'
import AboutPage from './pages/AboutPage'
import LobbyPage from './pages/LobbyPage'
import InGamePage from './pages/InGamePage'
import CreateCharacterPage from './pages/CreateCharacterPage'
import CampaignDetailPage from './pages/CampaignDetailPage'
import CalendarPage from './pages/CalendarPage'

function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/characters" element={<ViewCharactersPage />} />
        <Route path="/characters/create" element={<CreateCharacterPage />} />
        <Route path="/characters/edit/:id" element={<CreateCharacterPage />} />
        <Route path="/join" element={<JoinGamePage />} />
        <Route path="/make" element={<MakeGamePage />} />
        <Route path="/campaign/:id" element={<CampaignDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/lobby/:campaignId" element={<LobbyPage />} />
        <Route path="/game/:campaignId" element={<InGamePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
    </div>
  )
}

export default App
