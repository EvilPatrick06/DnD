import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import { DiceOverlay } from './components/game/dice3d'
import { ErrorBoundary, ShortcutsOverlay, Spinner, ToastContainer } from './components/ui'
import ColorblindFilters from './components/ui/ColorblindFilters'
import ScreenReaderAnnouncer from './components/ui/ScreenReaderAnnouncer'
import { addToast } from './hooks/use-toast'
import MainMenuPage from './pages/MainMenuPage'
import { cdnProvider, preloadAllData } from './services/data-provider'
import { loadShortcutDefinitions } from './services/keyboard-shortcuts'
import * as NotificationService from './services/notification-service'
import { loadTemplates as loadNotificationTemplates } from './services/notification-service'
import { init as initSoundManager, preloadEssential } from './services/sound-manager'
import { applyColorblindFilter, loadSavedTheme, loadThemeDefinitions } from './services/theme-manager'
import { useAccessibilityStore } from './stores/use-accessibility-store'
import { initGameSystems } from './systems/init'
import { logger } from './utils/logger'

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
  const uiScale = useAccessibilityStore((s) => s.uiScale)
  const colorblindMode = useAccessibilityStore((s) => s.colorblindMode)

  // Initialize game system registry and notification service
  useEffect(() => {
    initGameSystems()
    NotificationService.init()
    loadSavedTheme()
    initSoundManager()
    preloadEssential()
    preloadAllData()

    // Probe CDN availability for optional remote asset fallback
    cdnProvider.isAvailable()

    // Warm caches for module-level data loaders so they are referenced as used exports.
    // These are fire-and-forget; errors are non-fatal (data-provider caches handle fallback).
    loadShortcutDefinitions()
    loadThemeDefinitions()
    loadNotificationTemplates()

    // Dynamic imports for component/store-level cache loaders
    import('./services/character/auto-populate-5e').then((m) => m.loadSpeciesSpellData())
    import('./components/builder/5e/gear-tab-types').then((m) => m.loadCurrencyConfigData())
    import('./components/builder/5e/LanguagesTab5e').then((m) => m.loadLanguageD12Data())
    import('./components/builder/shared/SelectionFilterBar').then((m) => m.loadRarityOptionData())
    import('./components/game/bottom/DMTabPanel').then((m) => m.loadDmTabData())
    import('./components/game/dice3d/dice-meshes').then((m) => m.loadDiceColorData())
    import('./components/game/dm/StatBlockEditor').then((m) => m.loadCreatureTypeData())
    import('./stores/builder/types').then((m) => {
      m.loadAbilityScoreConfigData()
      m.loadPresetIconData()
    })
    import('./components/campaign/AdventureWizard').then((m) => m.loadAdventureSeedData())
    import('./components/campaign/SessionZeroStep').then((m) => m.loadSessionZeroConfigData())
    import('./components/campaign/MapConfigStep').then((m) => m.loadBuiltInMapData())
  }, [])

  // Apply UI scale to root font-size (rem-based Tailwind scales with this)
  useEffect(() => {
    document.documentElement.style.fontSize = `${uiScale}%`
  }, [uiScale])

  // Apply colorblind filter
  useEffect(() => {
    applyColorblindFilter(colorblindMode)
  }, [colorblindMode])

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
      logger.error('[UnhandledRejection]', e.reason)
      addToast(`Unexpected error: ${msg}`, 'error')
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return (
    <div className="relative min-h-screen bg-gray-950 text-gray-100">
      <ColorblindFilters />
      <ScreenReaderAnnouncer />
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
            <Route
              path="/characters/create"
              element={
                <ErrorBoundary>
                  <CreateCharacterPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/characters/5e/create"
              element={
                <ErrorBoundary>
                  <CreateCharacterPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/characters/5e/edit/:id"
              element={
                <ErrorBoundary>
                  <CreateCharacterPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/characters/5e/:id"
              element={
                <ErrorBoundary>
                  <CharacterSheet5ePage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/characters/5e/:id/levelup"
              element={
                <ErrorBoundary>
                  <LevelUp5ePage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/characters/edit/:id"
              element={
                <ErrorBoundary>
                  <CreateCharacterPage />
                </ErrorBoundary>
              }
            />
            <Route path="/join" element={<JoinGamePage />} />
            <Route path="/make" element={<MakeGamePage />} />
            <Route
              path="/campaign/:id"
              element={
                <ErrorBoundary>
                  <CampaignDetailPage />
                </ErrorBoundary>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/lobby/:campaignId"
              element={
                <ErrorBoundary>
                  <LobbyPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/game/:campaignId"
              element={
                <ErrorBoundary>
                  <InGamePage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/library"
              element={
                <ErrorBoundary>
                  <LibraryPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/bastions"
              element={
                <ErrorBoundary>
                  <BastionPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/calendar"
              element={
                <ErrorBoundary>
                  <CalendarPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default App
