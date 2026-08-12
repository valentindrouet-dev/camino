import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, randomSeed } from '../engine/index.ts'
import type { GameConfig, GameState } from '../engine/index.ts'
import { archiveGame } from './storage.ts'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { GameScreen } from './screens/GameScreen.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { LabScreen } from './screens/LabScreen.tsx'
import { HistoryScreen } from './screens/HistoryScreen.tsx'
import { VersionsScreen } from './screens/VersionsScreen.tsx'
import { SalonScreen } from './screens/SalonScreen.tsx'
import { TransportLocal } from '../net/local.ts'
import { TransportSupabase } from '../net/supabase.ts'
import { enLigneDisponible } from '../net/config.ts'
import type { Transport } from '../net/salon.ts'
import { useSalon } from '../net/useSalon.ts'
import { viewFor } from '../engine/index.ts'
import { VERSION } from '../version.ts'
import { formatDuration } from './duration.ts'

type Screen = 'setup' | 'game' | 'results' | 'lab' | 'archive' | 'history' | 'versions' | 'salon'

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup')
  /*
   * Jeu en ligne. Le transport est local pour l'instant — les onglets d'un
   * même navigateur — mais l'interface de salon ne connaît que `Transport` :
   * brancher un service hébergé ne changera rien à ce qui suit.
   */
  const [transport] = useState<Transport>(() =>
    enLigneDisponible() ? new TransportSupabase() : new TransportLocal(),
  )
  // Le réseau ne s'éveille qu'une fois l'écran des salons ouvert : personne ne
  // télécharge le client temps réel pour une partie sur cet appareil.
  const [salonsOuverts, setSalonsOuverts] = useState(false)
  const salon = useSalon(transport, salonsOuverts)
  /** Identifiant de la partie qu'on vient d'archiver : sert au rapport de fin. */
  const [archivedId, setArchivedId] = useState<string | null>(null)
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [history, setHistory] = useState<GameState[]>([])

  // La partie en ligne alimente le même historique que la partie locale : le
  // chrono, l'archivage et l'écran de résultats n'ont rien à savoir du réseau.
  const enLigne = salon.salon !== null && salon.monSiege !== null && salon.partie !== null
  useEffect(() => {
    if (!salon.partie) return
    setHistory([salon.partie])
  }, [salon.partie])

  useEffect(() => {
    if (enLigne && screen === 'salon') setScreen('game')
  }, [enLigne, screen])

  const state = history[history.length - 1] ?? null
  const running = state?.phase === 'playing'
  const finished = state?.phase === 'finished'

  /*
   * Chrono de la partie : il démarre au lancement, s'arrête quand la dernière
   * tuile est posée, et la durée obtenue part avec la partie dans l'archive.
   * Il vit ici, hors du moteur : celui-ci doit rester déterministe, une même
   * graine rejouée ne doit pas dépendre de l'heure qu'il est.
   */
  const startedAt = useRef<number | null>(null)
  const endedAt = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

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
    startedAt.current = Date.now()
    endedAt.current = null
    setElapsed(0)
    setScreen('game')
  }

  // Le chrono ne bat que tant qu'on joue ; une fois la partie finie il reste
  // figé sur son total, y compris quand on retourne voir les plateaux.
  useEffect(() => {
    if (!running) return
    const battre = () =>
      setElapsed(startedAt.current === null ? 0 : Date.now() - startedAt.current)
    battre()
    const id = window.setInterval(battre, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const finish = useCallback(() => {
    if (settled.current) return
    settled.current = true
    // L'archivage se fait ici, une seule fois par partie — surtout pas dans un
    // effet d'écran, qui se rejoue à chaque retour sur les résultats.
    endedAt.current = Date.now()
    const duree =
      startedAt.current === null ? undefined : endedAt.current - startedAt.current
    if (duree !== undefined) setElapsed(duree)
    const last = historyRef.current[historyRef.current.length - 1]
    if (last?.phase === 'finished') setArchivedId(archiveGame(last, duree).id)
    setScreen('results')
  }, [])

  /** Ferme définitivement la partie : on n'y revient plus par inadvertance. */
  const quitGame = useCallback((to: Screen = 'setup') => {
    setHistory([])
    settled.current = false
    startedAt.current = null
    endedAt.current = null
    setElapsed(0)
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

  /**
   * Quitter la partie depuis la barre du haut, en ligne comme autour d'une
   * table : c'est le même bouton, il ferme le salon quand il y en a un.
   */
  const quitterPartie = () => {
    if (enLigne) {
      salon.quitter()
      quitGame('setup')
    } else quitFromGame()
  }

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

        {state && screen === 'results' && (
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

        {state && (screen === 'game' || screen === 'results') && (
          <span
              className={`tag chrono ${state.phase === 'finished' ? 'done' : ''}`}
              title={
                state.phase === 'finished'
                  ? 'Durée totale de la partie'
                  : 'Temps écoulé depuis le début de la partie'
              }
            >
            ⏱ <strong>{formatDuration(elapsed)}</strong>
          </span>
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
            {state.players.length > 1 && !state.options.ruleset.variants?.sharedBoard && (
              <label className={`toggle ${state.options.allBoards ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!state.options.allBoards}
                  onChange={(e) => patchOption('allBoards', e.target.checked)}
                />
                {state.players.length} Plateaux visibles
              </label>
            )}
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
        {screen === 'game' && (
          <button className="btn small ghost" onClick={quitterPartie}>
            Quitter la partie
          </button>
        )}
        {screen !== 'game' && screen !== 'history' && (
          <button className="btn small ghost" onClick={() => setScreen('history')}>
            Historique
          </button>
        )}
        {screen !== 'game' && screen !== 'lab' && screen !== 'archive' && (
          <button className="btn small ghost" onClick={() => setScreen('lab')}>
            Laboratoire
          </button>
        )}
        {screen !== 'game' && screen !== 'versions' && (
          <button className="btn small ghost" onClick={() => setScreen('versions')}>
            Versions
          </button>
        )}
      </header>

      {screen === 'setup' && (
        <SetupScreen
          onStart={start}
          onOpenLab={() => setScreen('lab')}
          onOpenSalons={() => {
            setSalonsOuverts(true)
            setScreen('salon')
          }}
          resumable={running}
          onResume={() => setScreen('game')}
        />
      )}

      {screen === 'salon' && !enLigne && (
        <SalonScreen salon={salon} onBack={() => setScreen('setup')} />
      )}

      {screen === 'game' && state && enLigne && salon.salon && (
        <GameScreen
          history={[viewFor(state, salon.monSiege as number)]}
          onHistory={() => {}}
          onFinish={finish}
          online={{
            monSiege: salon.monSiege as number,
            salonNom: salon.salon.nom,
            jouer: salon.jouer,
          }}
        />
      )}

      {screen === 'game' && state && !enLigne && (
        <GameScreen
          history={history}
          onHistory={onHistory}
          onFinish={finish}
        />
      )}

      {screen === 'results' && state && (
        <ResultsScreen
          state={state}
          archivedId={archivedId}
          durationMs={elapsed || undefined}
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
