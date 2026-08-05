import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'
import { ErrorBoundary } from './ui/components/ErrorBoundary.tsx'
import './ui/styles.css'

// Le filet de sécurité d'index.html peut charger ce module une seconde fois
// (script principal lent + secours) : on ne monte l'application qu'une fois.
if (document.documentElement.getAttribute('data-app') !== 'ready') {
  // Signale au filet de sécurité que l'application a démarré.
  document.documentElement.setAttribute('data-app', 'ready')
  try {
    sessionStorage.removeItem('camino.boot-retry')
  } catch {
    /* navigation privée : sans importance */
  }

  const root = document.getElementById('root') as HTMLElement
  // L'écran d'attente d'index.html laisse la place à l'application.
  root.innerHTML = ''

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
