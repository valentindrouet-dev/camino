import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Une erreur d'affichage ne doit jamais laisser une page blanche : on montre
 * ce qui s'est passé et de quoi repartir. Le bouton « Repartir de zéro » efface
 * les données locales, au cas où ce serait une partie ou une configuration
 * enregistrée par une version précédente qui pose problème.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CAMINO — erreur d’affichage', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="sheet">
        <div className="panel stack" style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 22 }}>Aïe, l’interface a planté</h2>
          <p className="note">
            Rien n’est perdu côté code : rechargez la page. Si le problème revient, remettez les
            données locales à zéro — cela n’efface que les réglages et l’historique enregistrés dans
            ce navigateur.
          </p>
          <pre
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--line-soft)',
              borderRadius: 10,
              padding: 12,
              fontSize: 12,
              overflow: 'auto',
              margin: 0,
            }}
          >
            {error.message}
          </pre>
          <div className="row wrap">
            <button className="btn primary" onClick={() => location.reload()}>
              Recharger
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  localStorage.clear()
                } catch {
                  /* rien à faire */
                }
                location.replace(location.pathname)
              }}
            >
              Repartir de zéro
            </button>
          </div>
        </div>
      </div>
    )
  }
}
