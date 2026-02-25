import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import App from './App'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { setIceConfig } from './network/peer-manager'
import { logger } from './utils/logger'
import './styles/globals.css'

// Log unhandled errors to console (ErrorBoundary catches render errors,
// these catch everything else)
window.addEventListener('error', (e) => {
  logger.error('[Global] Uncaught error:', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  logger.error('[Global] Unhandled promise rejection:', e.reason)
})

// Load saved network settings (TURN servers) at startup
window.api
  .loadSettings()
  .then((settings) => {
    if (settings.turnServers && settings.turnServers.length > 0) {
      setIceConfig(settings.turnServers)
      logger.debug('[Settings] Loaded custom ICE servers:', settings.turnServers.length)
    }
  })
  .catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
