import { useCallback, useRef, useState } from 'react'
import { createGame } from '../engine/index.ts'
import type { GameConfig, GameState } from '../engine/index.ts'
import { archiveGame } from './storage.ts'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { GameScreen } from './screens/GameScreen.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { LabScreen } from './screens/LabScreen.tsx'

type Screen = 'setup' | 'game' | 'results' | 'lab' | 'archive'

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [history, setHistory] = useState<GameState[]>([])

  const state = history[history.length - 1] ?? null

  // Une partie terminée n'est archivée qu'une fois, et le passage à l'écran de
  // résultats ne doit pas se redéclencher quand on revient voir les plateaux.
  const settled = useRef(false)
  // Miroir de l'historique : `finish` ne doit pas dépendre d'une valeur figée.
  const historyRef = useRef<GameState[]>(history)
  historyRef.current = history

  const start = (cfg: GameConfig) => {
    setConfig(cfg)
    setHistory([createGame(cfg)])
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

  const onHistory = useCallback(
    (updater: (h: GameState[]) => GameState[]) => setHistory((h) => updater(h)),
    [],
  )

  const patchOption = <K extends keyof GameState['options']>(
    key: K,
    value: GameState['options'][K],
  ) => {
    setHistory((h) =>
      h.map((s) => ({ ...s, options: { ...s.options, [key]: value } })),
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <span className="mark">
            <i style={{ background: '#F7931D' }} />
            <i style={{ background: '#0095D9' }} />
            <i style={{ background: '#40AE49' }} />
            <i style={{ background: '#D1232A' }} />
          </span>
          Camino
        </div>

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

        {screen !== 'setup' && (
          <button className="btn small ghost" onClick={() => setScreen('setup')}>
            Accueil
          </button>
        )}
        {screen !== 'lab' && screen !== 'archive' && (
          <button className="btn small ghost" onClick={() => setScreen('lab')}>
            Laboratoire
          </button>
        )}
      </header>

      {screen === 'setup' && <SetupScreen onStart={start} onOpenLab={() => setScreen('lab')} />}

      {screen === 'game' && state && (
        <GameScreen
          history={history}
          onHistory={onHistory}
          onFinish={finish}
          onQuit={() => setScreen('setup')}
        />
      )}

      {screen === 'results' && state && (
        <ResultsScreen
          state={state}
          onBackToGame={() => setScreen('game')}
          onReplaySameSeed={() => config && start(config)}
          onNewGame={() => setScreen('setup')}
          onOpenArchive={() => setScreen('archive')}
        />
      )}

      {(screen === 'lab' || screen === 'archive') && (
        <LabScreen
          initialTab={screen === 'archive' ? 'archive' : 'sim'}
          onBack={() => setScreen(state ? 'game' : 'setup')}
        />
      )}
    </div>
  )
}
