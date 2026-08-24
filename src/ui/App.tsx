import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { cardById, clearVariants, createGame, randomSeed } from '../engine/index.ts'
import type { GameConfig, GameOptions, GameState, PlayerConfig } from '../engine/index.ts'
import { archiveGame, loadLastConfig, saveLastConfig } from './storage.ts'
import { SetupScreen } from './screens/SetupScreen.tsx'
import { GameScreen } from './screens/GameScreen.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { LabScreen } from './screens/LabScreen.tsx'
import { HistoryScreen } from './screens/HistoryScreen.tsx'
import { VersionsScreen } from './screens/VersionsScreen.tsx'
import { SalonScreen } from './screens/SalonScreen.tsx'
import { ReglagesScreen } from './screens/ReglagesScreen.tsx'
import { ScanScreen } from './screens/ScanScreen.tsx'
import { catalogueEffectif, chargerReglages, enregistrerReglages, signature } from './reglages.ts'
import { optionsDepart, tableDepart } from './depart.ts'
import type { Reglages } from './reglages.ts'
import { TransportLocal } from '../net/local.ts'
import { TransportSupabase } from '../net/supabase.ts'
import { enLigneDisponible } from '../net/config.ts'
import type { Transport } from '../net/salon.ts'
import { useSalon } from '../net/useSalon.ts'
import { viewFor } from '../engine/index.ts'
import { VERSION } from '../version.ts'
import { formatDuration } from './duration.ts'

type Screen =
  | 'setup'
  | 'game'
  | 'results'
  | 'lab'
  | 'archive'
  | 'history'
  | 'versions'
  | 'salon'
  | 'reglages'
  | 'scan'

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
  /*
   * Réglages de la table : ce que la page d'accueil propose. Ils survivent aux
   * rechargements — c'est un choix d'organisateur, pas un réglage de partie.
   */
  const [reglages, setReglagesEtat] = useState<Reglages>(chargerReglages)
  const setReglages = (r: Reglages) => {
    setReglagesEtat(r)
    enregistrerReglages(r)
  }

  /*
   * La configuration de la prochaine partie vit ici, et non dans l'écran
   * d'accueil : passer par les Réglages, l'Historique ou les Versions ne doit
   * pas effacer ce qu'on vient de cocher.
   *
   * Elle est mémorisée dans le navigateur et rechargée telle quelle, variantes
   * comprises : ce qu'on coche reste coché au rechargement. Faute de mémoire —
   * un lien qu'on ouvre pour la première fois — on démarre sur ce que décrit
   * `depart.ts`.
   */
  const [players, setPlayers] = useState<PlayerConfig[]>(() => {
    const sauves = loadLastConfig<GameConfig>()?.players
    return sauves?.every((p) => p.boardColor) ? sauves : tableDepart()
  })
  const [options, setOptions] = useState<GameOptions>(() => {
    const base = loadLastConfig<GameConfig>()?.options ?? optionsDepart()
    // Une carte retirée du jeu depuis la dernière partie ne doit pas rester
    // choisie en silence : sans ça, la partie démarrerait sans mission.
    return base.cardId && !cardById(base.cardId) ? { ...base, cardId: undefined } : base
  })
  const [showScale, setShowScale] = useState(false)
  /**
   * Menu replié de la barre du haut — n'existe que sur téléphone. Il se
   * referme dès qu'on choisit une destination, et dès qu'on change d'écran :
   * un menu resté ouvert par-dessus la page suivante serait pénible.
   */
  const [menuOuvert, setMenuOuvert] = useState(false)
  const fermerMenu = () => setMenuOuvert(false)
  /**
   * Choisir une destination referme le menu — mais cocher un interrupteur,
   * non : on vient souvent en changer deux d'affilée, et refermer à chaque
   * fois obligerait à rouvrir entre chaque.
   */
  const clicDansLeMenu = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.toggle')) fermerMenu()
  }
  useEffect(() => setMenuOuvert(false), [screen])
  // Un appui n'importe où ailleurs referme le menu — c'est ce qu'on attend
  // d'un panneau posé par-dessus la page.
  useEffect(() => {
    if (!menuOuvert) return
    const ailleurs = (e: PointerEvent) => {
      const cible = e.target as HTMLElement | null
      if (cible?.closest('.topbar-liens, .topbar-menu')) return
      setMenuOuvert(false)
    }
    document.addEventListener('pointerdown', ailleurs)
    return () => document.removeEventListener('pointerdown', ailleurs)
  }, [menuOuvert])

  /*
   * On enregistre à chaque changement, pas seulement au lancement d'une
   * partie : quelqu'un qui règle sa table puis recharge la page doit la
   * retrouver telle qu'il l'a laissée.
   */
  useEffect(() => {
    saveLastConfig({ players, options })
  }, [players, options])

  /*
   * Masquer une variante alors qu'elle est cochée la laisserait s'appliquer en
   * silence, invisible. Changer les Réglages remet donc les variantes à zéro ;
   * les options de partie ne bougent pas.
   */
  const groupesVariantes = useMemo(() => catalogueEffectif(reglages), [reglages])
  const sigReglages = signature(reglages)
  const sigVue = useRef(sigReglages)
  useEffect(() => {
    if (sigVue.current === sigReglages) return
    sigVue.current = sigReglages
    setShowScale(false)
    setOptions(clearVariants)
  }, [sigReglages])
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [history, setHistory] = useState<GameState[]>([])

  /*
   * Réglages d'affichage changés en cours de partie : score visible, contours
   * de zones, plateaux côte à côte… Ils appartiennent à l'écran, pas à la
   * partie. En ligne, chaque coup reconstruit l'état depuis la graine et le
   * journal : sans les garder ici, la vue choisie retomberait à chaque tuile
   * posée.
   */
  const affichage = useRef<Partial<GameState['options']>>({})

  // La partie en ligne alimente le même historique que la partie locale : le
  // chrono, l'archivage et l'écran de résultats n'ont rien à savoir du réseau.
  const enLigne = salon.salon !== null && salon.monSiege !== null && salon.partie !== null
  useEffect(() => {
    if (!salon.partie) return
    const vue = affichage.current
    setHistory([
      Object.keys(vue).length === 0
        ? salon.partie
        : { ...salon.partie, options: { ...salon.partie.options, ...vue } },
    ])
  }, [salon.partie])

  // Un nouveau salon, c'est une nouvelle partie : elle repart des réglages
  // de l'hôte, plateaux côte à côte décochés compris.
  const salonId = salon.salon?.id ?? null
  useEffect(() => {
    affichage.current = {}
  }, [salonId])

  /*
   * Le va-et-vient salon ↔ partie suit la PHASE du salon, et seulement ses
   * changements. Forcer l'écran de jeu tant qu'une partie existe empêcherait
   * de revenir dans la salle d'attente pour en relancer une.
   */
  const phaseSalon = salon.salon?.phase ?? null
  const phaseVue = useRef(phaseSalon)
  useEffect(() => {
    if (phaseSalon === phaseVue.current) return
    const avant = phaseVue.current
    phaseVue.current = phaseSalon
    if (phaseSalon === 'en-cours') {
      // Nouvelle partie en ligne : chrono à zéro et tout le monde à table.
      settled.current = false
      startedAt.current = Date.now()
      endedAt.current = null
      setElapsed(0)
      setArchivedId(null)
      setScreen('game')
    } else if (avant === 'en-cours' && phaseSalon === 'attente') {
      // L'hôte relance : retour à la salle d'attente, joueurs intacts.
      setHistory([])
      setScreen('salon')
    }
  }, [phaseSalon])

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
    affichage.current = {}
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
  /**
   * Quitter la partie. En ligne, on ne rentre pas chez soi : on revient au
   * salon, où les joueurs sont toujours là. L'hôte y ramène tout le monde ;
   * un invité s'y rend seul, et attendra que l'hôte relance.
   */
  const quitterPartie = () => {
    if (!enLigne) {
      quitFromGame()
      return
    }
    if (salon.suisHote) salon.relancer()
    else {
      setHistory([])
      setScreen('salon')
    }
  }

  const onHistory = useCallback(
    (updater: (h: GameState[]) => GameState[]) => setHistory((h) => updater(h)),
    [],
  )

  const patchOption = <K extends keyof GameState['options']>(
    key: K,
    value: GameState['options'][K],
  ) => {
    // On retient le choix : il doit survivre au rejeu du journal en ligne.
    affichage.current = { ...affichage.current, [key]: value }
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

        {/*
          Sur téléphone, la barre du haut débordait sur deux lignes : TOUT ce
          qui suit — les interrupteurs de la partie comme les liens — se replie
          derrière ce bouton. Il est masqué partout ailleurs, et
          `.topbar-liens` vaut `display: contents` au-dessus du téléphone —
          les boutons restent donc exactement où ils étaient.
        */}
        <button
          className={`btn small ghost topbar-menu ${menuOuvert ? 'ouvert' : ''}`}
          aria-expanded={menuOuvert}
          aria-label="Menu"
          title="Menu"
          onClick={() => setMenuOuvert((v) => !v)}
        >
          ☰
        </button>
        <nav className={`topbar-liens ${menuOuvert ? 'ouvert' : ''}`} onClick={clicDansLeMenu}>
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
        {screen === 'game' && (
          <button className="btn small ghost" onClick={quitterPartie}>
            Quitter la partie
          </button>
        )}

        {screen !== 'setup' && (
          <button className="btn small ghost" onClick={goHome}>
            Accueil
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
        {screen !== 'game' && screen !== 'scan' && (
          <button
            className="btn small ghost"
            onClick={() => setScreen('scan')}
            title="Lire un plateau photographié"
          >
            Scanner
          </button>
        )}
        {screen !== 'game' && screen !== 'reglages' && (
          <button
            className="btn small ghost icon"
            onClick={() => setScreen('reglages')}
            title="Réglages"
            aria-label="Réglages"
          >
            ⚙
          </button>
        )}
        </nav>
      </header>

      {screen === 'setup' && (
        <SetupScreen
          onStart={start}
          players={players}
          setPlayers={setPlayers}
          options={options}
          setOptions={setOptions}
          showScale={showScale}
          setShowScale={setShowScale}
          groupesVariantes={groupesVariantes}
          onOpenSalons={() => {
            setSalonsOuverts(true)
            setScreen('salon')
          }}
          onOpenScan={() => setScreen('scan')}
          reglages={reglages}
          resumable={running}
          onResume={() => setScreen('game')}
        />
      )}

      {screen === 'salon' && !enLigne && (
        <SalonScreen salon={salon} onBack={() => setScreen('setup')} />
      )}

      {screen === 'reglages' && (
        <ReglagesScreen
          reglages={reglages}
          setReglages={setReglages}
          onBack={() => setScreen('setup')}
        />
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
          enLigne={enLigne}
          suisHote={salon.suisHote}
          onSalon={() => {
            if (salon.suisHote) salon.relancer()
            else {
              setHistory([])
              setScreen('salon')
            }
          }}
          onQuit={() => quitGame('setup')}
          onOpenArchive={() => setScreen('archive')}
        />
      )}

      {screen === 'scan' && <ScanScreen onBack={goHome} />}

      {screen === 'history' && <HistoryScreen onBack={goHome} />}

      {screen === 'versions' && <VersionsScreen onBack={goHome} />}

      {(screen === 'lab' || screen === 'archive') && (
        <LabScreen
          groupesVariantes={groupesVariantes}
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
