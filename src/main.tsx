import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'
import { ErrorBoundary } from './ui/components/ErrorBoundary.tsx'
import './ui/styles.css'

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

// Signale au filet de sécurité d'index.html que l'application a démarré.
document.documentElement.setAttribute('data-app', 'ready')
