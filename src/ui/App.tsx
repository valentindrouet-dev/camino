import { useCallback, useState } from 'react'
import { createGame } from '../engine/index.ts'
import type { GameConfig, GameState } from '../engine/index.ts'
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

  const start = (cfg: GameConfig) => {
    setConfig(cfg)
    setHistory([createGame(cfg)])
    setScreen('game')
  }

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
              Score en direct
            </label>
            <label className={`toggle ${state.options.showZones ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={state.options.showZones}
                onChange={(e) => patchOption('showZones', e.target.checked)}
              />
              Zones
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
          onFinish={() => setScreen('results')}
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
