import { useCallback, useRef, useState } from 'react'
import { createGame, randomSeed } from '../engine/index.ts'
import type { GameConfig, GameState } from '../engine/index.ts'
import { archiveGame } from './storage.ts'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { GameScreen } from './screens/GameScreen.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { LabScreen } from './screens/LabScreen.tsx'
import { HistoryScreen } from './screens/HistoryScreen.tsx'
import { VersionsScreen } from './screens/VersionsScreen.tsx'
import { VERSION } from '../version.ts'

type Screen = 'setup' | 'game' | 'results' | 'lab' | 'archive' | 'history' | 'versions'

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [history, setHistory] = useState<GameState[]>([])

  const state = history[history.length - 1] ?? null
  const running = state?.phase === 'playing'
  const finished = state?.phase === 'finished'

  // Une partie terminée n'est archivée qu'une fois, et le passage à l'écran de
  // résultats ne doit pas se redéclencher quand on revient voir les plateaux.
  const settled = useRef(false)
  // Miroir de l'historique : `finish` ne doit pas dépendre d'une valeur figée.
  const historyRef = useRef<GameState[]>(history)
  historyRef.current = history

  /**
   * Lance une partie. Sauf graine manuelle — ou rejeu explicite de la même
   * pioche — chaque nouvelle partie tire une graine neuve.
   */
  const start = (cfg: GameConfig, keepSeed = false) => {
    const options =
      keepSeed || cfg.options.manualSeed
        ? cfg.options
        : { ...cfg.options, seed: randomSeed() }
    const next: GameConfig = { ...cfg, options }
    setConfig(next)
    setHistory([createGame(next)])
    settled.current = false
    setScreen('game')
  }

  const finish = useCallback(() => {
    if (settled.current) return
    settled.current = true
    // L'archivage se fait ici, une seule fois par partie — surtout pas dans un
    // effet d'écran, qui se rejoue à chaque retour sur les résultats.
    const last = historyRef.current[historyRef.current.length - 1]
    if (last?.phase === 'finished') archiveGame(last)
    setScreen('results')
  }, [])

  /** Ferme définitivement la partie : on n'y revient plus par inadvertance. */
  const quitGame = useCallback((to: Screen = 'setup') => {
    setHistory([])
    settled.current = false
    setScreen(to)
  }, [])

  /** Quitter depuis l'écran de jeu : on confirme si la partie est entamée. */
  const quitFromGame = useCallback(() => {
    const cur = historyRef.current[historyRef.current.length - 1]
    if (
      cur?.phase === 'playing' &&
      cur.log.length > 0 &&
      !confirm('Abandonner la partie en cours ? Elle ne sera pas comptée dans les statistiques.')
    ) {
      return
    }
    quitGame('setup')
  }, [quitGame])

  /** Le logo et « Accueil » ramènent à l'accueil sans fermer une partie en
   *  cours ; une partie terminée, déjà archivée, est refermée au passage. */
  const goHome = useCallback(() => {
    const cur = historyRef.current[historyRef.current.length - 1]
    if (cur?.phase === 'finished') quitGame('setup')
    else setScreen('setup')
  }, [quitGame])

  const onHistory = useCallback(
    (updater: (h: GameState[]) => GameState[]) => setHistory((h) => updater(h)),
    [],
  )

  const patchOption = <K extends keyof GameState['options']>(
    key: K,
    value: GameState['options'][K],
  ) => {
    setHistory((h) => h.map((s) => ({ ...s, options: { ...s.options, [key]: value } })))
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="wordmark" onClick={goHome} title="Revenir à l’accueil">
          <span className="mark">
            <i style={{ background: '#F7931D' }} />
            <i style={{ background: '#0095D9' }} />
            <i style={{ background: '#40AE49' }} />
            <i style={{ background: '#D1232A' }} />
          </span>
          Camino
        </button>
        <button
          className="version-tag"
          onClick={() => setScreen('versions')}
          title="Historique des versions"
        >
          v{VERSION}
        </button>

        {state && (screen === 'game' || screen === 'results') && (
          <>
            <span className="tag">
              Manche <strong>{Math.min(state.round + 1, state.totalRounds)}</strong>/
              {state.totalRounds}
            </span>
            <span className="tag">
              Graine <strong>{state.options.seed}</strong>
            </span>
          </>
        )}

        <span className="spacer" />

        {state && screen === 'game' && (
          <>
            <label className={`toggle ${state.options.liveScore ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={state.options.liveScore}
                onChange={(e) => patchOption('liveScore', e.target.checked)}
              />
              Score visible
            </label>
            <label className={`toggle ${state.options.showZones ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={state.options.showZones}
                onChange={(e) => patchOption('showZones', e.target.checked)}
              />
              Points par Zone visible
            </label>
            <label className={`toggle ${state.options.showHints ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={state.options.showHints}
                onChange={(e) => patchOption('showHints', e.target.checked)}
              />
              Indices
            </label>
          </>
        )}

        {running && screen !== 'game' && (
          <button className="btn small primary" onClick={() => setScreen('game')}>
            ⏵ Partie en cours
          </button>
        )}
        {screen !== 'setup' && (
          <button className="btn small ghost" onClick={goHome}>
            Accueil
          </button>
        )}
        {screen !== 'history' && (
          <button className="btn small ghost" onClick={() => setScreen('history')}>
            Historique
          </button>
        )}
        {screen !== 'lab' && screen !== 'archive' && (
          <button className="btn small ghost" onClick={() => setScreen('lab')}>
            Laboratoire
          </button>
        )}
        {screen !== 'versions' && (
          <button className="btn small ghost" onClick={() => setScreen('versions')}>
            Versions
          </button>
        )}
      </header>

      {screen === 'setup' && (
        <SetupScreen
          onStart={start}
          onOpenLab={() => setScreen('lab')}
          resumable={running}
          onResume={() => setScreen('game')}
        />
      )}

      {screen === 'game' && state && (
        <GameScreen
          history={history}
          onHistory={onHistory}
          onFinish={finish}
          onQuit={quitFromGame}
        />
      )}

      {screen === 'results' && state && (
        <ResultsScreen
          state={state}
          onBackToGame={() => setScreen('game')}
          onReplaySameSeed={() => config && start(config, true)}
          onNewGame={() => quitGame('setup')}
          onQuit={() => quitGame('setup')}
          onOpenArchive={() => setScreen('archive')}
        />
      )}

      {screen === 'history' && <HistoryScreen onBack={goHome} />}

      {screen === 'versions' && <VersionsScreen onBack={goHome} />}

      {(screen === 'lab' || screen === 'archive') && (
        <LabScreen
          initialTab={screen === 'archive' ? 'archive' : 'sim'}
          onBack={() => {
            if (running) setScreen('game')
            else if (finished) setScreen('results')
            else setScreen('setup')
          }}
        />
      )}
    </div>
  )
}
