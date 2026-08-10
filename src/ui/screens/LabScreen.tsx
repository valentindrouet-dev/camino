import { useEffect, useMemo, useRef, useState } from 'react'
import {
  aggregate,
  COLOR_HEX,
  COLOR_NAMES,
  configError,
  defaultOptions,
  defaultPlayers,
  histogram,
  PATH_COLORS,
  playOneGame,
  randomSeed,
} from '../../engine/index.ts'
import type {
  Color,
  GameConfig,
  GameOptions,
  PlayerKind,
  SimGameRecord,
  SimResult,
} from '../../engine/index.ts'
import { Bars, Histogram, ScoreLines } from '../components/Charts.tsx'
import { Toggle, VariantsPanel } from '../components/VariantsPanel.tsx'
import { activeVariantInfos } from '../variantInfo.ts'
import {
  clearArchive,
  exportArchiveCsv,
  loadArchive,
  summarize,
  type ArchivedGame,
} from '../storage.ts'
import { formatDuration } from '../duration.ts'

const KINDS: PlayerKind[] = ['bot-smart', 'bot-greedy', 'bot-random']
const KIND_LABEL: Record<string, string> = {
  human: 'humain',
  'bot-random': 'hasard',
  'bot-greedy': 'novice',
  'bot-smart': 'stratège',
}
/** Temps de calcul maximal par image, pour garder l'interface réactive. */
const FRAME_MS = 28

interface Props {
  onBack: () => void
  initialTab?: 'sim' | 'archive'
}

export function LabScreen({ onBack, initialTab = 'sim' }: Props) {
  const [tab, setTab] = useState<'sim' | 'archive'>(initialTab)
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Laboratoire d’équilibrage</h2>
        <button className="btn small" onClick={onBack}>
          ← Retour
        </button>
      </div>
      <div className="tabs">
        <button className={tab === 'sim' ? 'on' : ''} onClick={() => setTab('sim')}>
          Simulation
        </button>
        <button className={tab === 'archive' ? 'on' : ''} onClick={() => setTab('archive')}>
          Parties jouées
        </button>
      </div>
      {tab === 'sim' ? <SimPanel /> : <ArchivePanel />}
    </div>
  )
}

// ---------------------------------------------------------------- simulation

/** Une campagne terminée, gardée pour comparer les réglages entre eux. */
interface Campagne {
  id: number
  label: string
  games: number
  mean: number
  stdev: number
  spread: number
  winJ1: number
  closeRate: number
}

function SimPanel() {
  const [playerCount, setPlayerCount] = useState(4)
  const [kinds, setKinds] = useState<PlayerKind[]>(Array(6).fill('bot-smart'))
  // Les mêmes options qu'une vraie partie : variantes, cartes, barème.
  const [options, setOptions] = useState<GameOptions>(() => defaultOptions(randomSeed()))
  const [showScale, setShowScale] = useState(false)
  const [target, setTarget] = useState(200)
  const [seed, setSeed] = useState(randomSeed())
  const [records, setRecords] = useState<SimGameRecord[]>([])
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<Campagne[]>([])
  const cancel = useRef(false)
  const t0 = useRef(0)
  const [elapsed, setElapsed] = useState(0)

  const config: GameConfig = useMemo(
    () => ({
      players: defaultPlayers(playerCount).map((p, i) => ({
        ...p,
        name: `J${i + 1}`,
        kind: kinds[i],
      })),
      options: { ...options, seed },
    }),
    [playerCount, kinds, options, seed],
  )
  const error = configError(config)
  const result: SimResult | null = useMemo(
    () => (records.length ? aggregate(records, playerCount, elapsed) : null),
    [records, playerCount, elapsed],
  )
  /** Résumé lisible du réglage testé — sert d'étiquette aux campagnes. */
  const label = useMemo(() => {
    const infos = activeVariantInfos(options).map((v) => v.label)
    const r = options.ruleset
    if (r.boardSize !== 4) infos.unshift(`Plateau ${r.boardSize}×${r.boardSize}`)
    if (r.blackPenalty !== -2) infos.unshift(`Noir ${r.blackPenalty}`)
    if (r.minSpan !== 3) infos.unshift(`Min ${r.minSpan}`)
    return infos.length ? infos.join(' · ') : 'Règles officielles'
  }, [options])

  // On joue par paquets pour ne pas figer l'interface. Le paquet s'adapte :
  // une partie sur plateau commun 12×8 coûte bien plus qu'un 4×4.
  useEffect(() => {
    if (!running) return
    let stop = false
    const step = () => {
      if (stop || cancel.current) return
      setRecords((prev) => {
        if (prev.length >= target) {
          setRunning(false)
          setElapsed(Date.now() - t0.current)
          return prev
        }
        const next = prev.slice()
        const debut = Date.now()
        // au moins une partie, puis on continue tant qu'on tient dans la frame
        for (let i = 0; next.length < target && (i === 0 || Date.now() - debut < FRAME_MS); i++) {
          next.push(playOneGame(config, `${seed}#${next.length}`))
        }
        return next
      })
      setElapsed(Date.now() - t0.current)
      requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => {
      stop = true
      cancelAnimationFrame(id)
    }
  }, [running, target, config, seed])

  // Campagne terminée : on la range dans l'historique pour comparer.
  const done = !running && records.length >= target && records.length > 0
  useEffect(() => {
    if (!done || !result) return
    setHistory((h) =>
      h.some((c) => c.id === records.length && c.label === label && c.mean === result.mean)
        ? h
        : [
            {
              id: Date.now(),
              label,
              games: result.games,
              mean: result.mean,
              stdev: result.stdev,
              spread: result.avgSpread,
              winJ1: result.winsBySeat[0] / result.games,
              closeRate: result.closeRate,
            },
            ...h,
          ].slice(0, 8),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois par campagne
  }, [done])

  const run = () => {
    cancel.current = false
    t0.current = Date.now()
    setElapsed(0)
    setRecords([])
    setRunning(true)
  }

  const spans = result
    ? Object.keys(result.spanHistogram)
        .map(Number)
        .sort((a, b) => a - b)
        .map((s) => ({ x: s, n: result.spanHistogram[s] }))
    : []

  return (
    <div className="grid-2">
      <div className="stack">
        <div className="panel stack">
          <h3>Configuration testée</h3>
          <div className="row wrap">
            <label className="field" style={{ width: 120 }}>
              <span>Joueurs</span>
              <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ width: 140 }}>
              <span>Parties</span>
              <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                {[50, 200, 500, 1000, 2000].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ width: 160 }}>
              <span>Graine</span>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
            </label>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            {Array.from({ length: playerCount }, (_, i) => (
              <div className="row" key={i}>
                <span className="note" style={{ width: 34 }}>
                  J{i + 1}
                </span>
                <div className="seg">
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      className={kinds[i] === k ? 'on' : ''}
                      onClick={() => setKinds((prev) => prev.map((x, j) => (j === i ? k : x)))}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Les options de partie qui changent le jeu — les autres ne sont
              qu'affichage et n'ont aucun effet sur une simulation. */}
          <div className="row wrap" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <Toggle
              label="1er joueur aléatoire"
              on={!!options.randomFirst}
              onChange={(v) => setOptions((o) => ({ ...o, randomFirst: v }))}
            />
            <Toggle
              label="Pose libre"
              on={!options.ruleset.requireAdjacency}
              onChange={(v) =>
                setOptions((o) => ({
                  ...o,
                  ruleset: { ...o.ruleset, requireAdjacency: !v },
                }))
              }
            />
          </div>

          {error && <div className="warn">{error}</div>}

          <div className="row">
            <button className="btn primary" onClick={run} disabled={running || !!error}>
              {running ? 'Simulation…' : 'Lancer la simulation'}
            </button>
            {running && (
              <button
                className="btn"
                onClick={() => {
                  cancel.current = true
                  setRunning(false)
                }}
              >
                Arrêter
              </button>
            )}
          </div>
          {(running || records.length > 0) && (
            <div>
              <div className="progress">
                <i style={{ width: `${(records.length / target) * 100}%` }} />
              </div>
              <span className="note">
                {records.length} / {target} parties
              </span>
            </div>
          )}
          <p className="note">
            Les bots jouent exactement la configuration ci-dessous, variantes comprises. Modifie,
            relance, compare : la graine rend chaque campagne reproductible.
          </p>
        </div>

        {/* le même panneau qu'à l'accueil : on teste ce qui se joue vraiment */}
        <VariantsPanel
          options={options}
          setOptions={setOptions}
          showScale={showScale}
          setShowScale={setShowScale}
        />

        {history.length > 0 && (
          <div className="panel">
            <h3>Campagnes de cette session</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>Réglage</th>
                  <th>Parties</th>
                  <th>Moyenne</th>
                  <th>Écart-type</th>
                  <th>1er vs dernier</th>
                  <th>Serrées</th>
                  <th>J1 gagne</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id}>
                    <td title={c.label} style={{ maxWidth: 220 }}>
                      <span className="ellipsis">{c.label}</span>
                    </td>
                    <td>{c.games}</td>
                    <td>{c.mean.toFixed(1)}</td>
                    <td>{c.stdev.toFixed(1)}</td>
                    <td>{c.spread.toFixed(1)}</td>
                    <td>{(c.closeRate * 100).toFixed(0)} %</td>
                    <td>{(c.winJ1 * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Chaque campagne terminée s'ajoute ici : c'est la comparaison qui dit si une variante
              resserre les scores ou creuse les écarts.
            </p>
          </div>
        )}
      </div>

      <div className="stack">
        {!result && (
          <div className="panel">
            <p className="note">
              Lance une simulation pour obtenir la distribution des scores, le poids de chaque
              couleur, l’impact des zones noires et l’avantage éventuel de la place à table.
            </p>
          </div>
        )}
        {result && (
          <>
            <div className="panel">
              <h3>Scores ({result.games} parties)</h3>
              <p className="note" style={{ margin: '-4px 0 10px' }}>{label}</p>
              <div className="kpi-grid">
                <Kpi k="Moyenne" v={result.mean.toFixed(1)} s="points" />
                <Kpi k="Médiane" v={result.median.toFixed(0)} s="points" />
                <Kpi k="Écart-type" v={result.stdev.toFixed(1)} s="dispersion" />
                <Kpi k="Min / Max" v={`${result.min} / ${result.max}`} s="observés" />
                <Kpi
                  k="Vainqueur"
                  v={result.winnerMean.toFixed(1)}
                  s={`dernier ${result.lastMean.toFixed(1)}`}
                />
                <Kpi k="Écart moyen" v={result.avgSpread.toFixed(1)} s="1er vs dernier" />
                <Kpi
                  k="Parties serrées"
                  v={`${(result.closeRate * 100).toFixed(0)} %`}
                  s={`décidées à ≤ 5 pts · ${(result.tieRate * 100).toFixed(0)} % à égalité`}
                />
                <Kpi
                  k="Zones noires"
                  v={result.avgBlackZones.toFixed(2)}
                  s={`${result.avgBlackPoints.toFixed(1)} pts`}
                />
                <Kpi
                  k="Potentiel gâché"
                  v={result.avgWasted.toFixed(1)}
                  s="tuiles hors chemin"
                />
                <Kpi
                  k="Manches"
                  v={result.avgRounds.toFixed(0)}
                  s={`${(result.durationMs / (result.games || 1)).toFixed(0)} ms / partie`}
                />
                {result.avgCardPoints !== 0 && (
                  <Kpi
                    k="Cartes missions"
                    v={`${(result.cardRate * 100).toFixed(0)} %`}
                    s={`accomplies · ${result.avgCardPoints.toFixed(1)} pts`}
                  />
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <Histogram buckets={histogram(result.scores, 5)} />
                <span className="note">Distribution des scores individuels (paliers de 5 pts)</span>
              </div>
            </div>

            <div className="panel">
              <h3>Poids de chaque couleur</h3>
              <Bars
                items={PATH_COLORS.map((c) => ({
                  label: COLOR_NAMES[c],
                  value: result.byColor[c as Color],
                  color: COLOR_HEX[c],
                }))}
                format={(v) => `${v.toFixed(1)} pts`}
              />
              <p className="note">
                Points moyens rapportés par couleur et par joueur. Un écart marqué entre couleurs
                signale un déséquilibre dans la répartition des tuiles.
              </p>
            </div>

            {result.sources.length > 1 && (
              <div className="panel">
                <h3>D’où viennent les points</h3>
                <Bars
                  items={result.sources.map((x) => ({
                    label: x.label,
                    value: x.value,
                    color: x.color,
                  }))}
                  format={(v) => `${v.toFixed(1)} pts`}
                />
                <p className="note">
                  Points moyens par joueur et par source. C’est ici qu’on voit si une variante pèse
                  trop lourd — ou ne sert à rien.
                </p>
              </div>
            )}

            {result.curve.length > 1 && (
              <div className="panel">
                <h3>Progression du score</h3>
                <ScoreLines
                  length={result.curve.length}
                  series={[{ label: 'Score moyen', color: '#F7931D', values: result.curve }]}
                />
                <p className="note">
                  Score moyen de la table après chaque manche : une courbe qui décolle tard signale
                  une partie qui se joue dans les dernières poses.
                </p>
              </div>
            )}

            <div className="panel">
              <h3>Longueur des chemins qui marquent</h3>
              <Histogram buckets={spans} color="#40AE49" suffix=" tuiles" />
              <span className="note">
                {result.avgScoringPaths.toFixed(1)} chemins par joueur · plus long{' '}
                {result.avgLongestPath.toFixed(1)} tuiles en moyenne
              </span>
            </div>

            <div className="panel">
              <h3>Place à table &amp; profils</h3>
              <table className="data">
                <thead>
                  <tr>
                    <th>Siège</th>
                    <th>Profil</th>
                    <th>Score moyen</th>
                    <th>Victoires</th>
                    {playerCount > 1 &&
                      result.rankBySeat[0].map((_, r) => <th key={r}>{r + 1}ᵉ</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.meanBySeat.map((m, i) => (
                    <tr key={i}>
                      <td>J{i + 1}</td>
                      <td>{KIND_LABEL[kinds[i]]}</td>
                      <td>{m.toFixed(1)}</td>
                      <td>{((result.winsBySeat[i] / result.games) * 100).toFixed(1)} %</td>
                      {playerCount > 1 &&
                        result.rankBySeat[i].map((v, r) => (
                          <td key={r} className="note">
                            {(v * 100).toFixed(0)} %
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">
                Le joueur J1 commence avec le sac à la première manche. Un taux de victoire très
                supérieur à {(100 / playerCount).toFixed(0)} % traduit un avantage de position ; les
                colonnes de droite donnent la distribution complète des rangs.
              </p>

              {Object.keys(result.meanByKind).length > 1 && (
                <>
                  <h3 style={{ marginTop: 14 }}>Force des profils</h3>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Profil</th>
                        <th>Joueurs</th>
                        <th>Score moyen</th>
                        <th>Victoires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(result.meanByKind).map((k) => (
                        <tr key={k}>
                          <td>{KIND_LABEL[k] ?? k}</td>
                          <td>{result.countByKind[k]}</td>
                          <td>{result.meanByKind[k].toFixed(1)}</td>
                          <td>
                            {((result.winsByKind[k] / result.games) * 100).toFixed(1)} %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="note">
                    Faites s’affronter des profils différents pour mesurer ce que vaut vraiment une
                    stratégie sous ce réglage.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ archives

function ArchivePanel() {
  const [archive, setArchive] = useState<ArchivedGame[]>(() => loadArchive())
  const summary = useMemo(() => summarize(archive), [archive])

  const download = () => {
    const blob = new Blob([exportArchiveCsv(archive)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'camino-parties.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!archive.length) {
    return (
      <div className="panel">
        <p className="note">
          Aucune partie enregistrée pour l’instant. Chaque partie terminée sur cette machine est
          archivée automatiquement et alimente ces statistiques.
        </p>
      </div>
    )
  }

  return (
    <div className="grid-2">
      <div className="stack">
        <div className="panel">
          <h3>Cumul des parties jouées</h3>
          <div className="kpi-grid">
            <Kpi k="Parties" v={`${summary.games}`} s={`${summary.players} scores`} />
            <Kpi k="Moyenne" v={summary.mean.toFixed(1)} s="points" />
            <Kpi k="Médiane" v={summary.median.toFixed(0)} s="points" />
            <Kpi k="Min / Max" v={`${summary.min} / ${summary.max}`} s="observés" />
            <Kpi k="Zones noires" v={summary.avgBlackZones.toFixed(2)} s="par joueur" />
            <Kpi k="Chemins" v={summary.avgPaths.toFixed(1)} s="qui marquent" />
            {summary.timedGames > 0 && (
              <>
                <Kpi
                  k="Durée moyenne"
                  v={formatDuration(summary.avgDuration)}
                  s={`sur ${summary.timedGames} partie${summary.timedGames > 1 ? 's' : ''}`}
                />
                <Kpi
                  k="Temps de jeu"
                  v={formatDuration(summary.totalDuration)}
                  s="au total"
                />
              </>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <Histogram buckets={histogram(summary.scores, 5)} />
          </div>
        </div>
        <div className="panel">
          <h3>Poids des couleurs</h3>
          <Bars
            items={PATH_COLORS.map((c) => ({
              label: COLOR_NAMES[c],
              value: summary.byColor[c] ?? 0,
              color: COLOR_HEX[c],
            }))}
            format={(v) => `${v.toFixed(1)} pts`}
          />
        </div>
      </div>

      <div className="stack">
        <div className="panel">
          <h3>Joueurs</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Parties</th>
                <th>Victoires</th>
                <th>Moyenne</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {summary.byPlayerName.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.games}</td>
                  <td>{p.wins}</td>
                  <td>{p.mean.toFixed(1)}</td>
                  <td>{p.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Dernières parties</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Joueurs</th>
                <th>Durée</th>
                <th>Vainqueur</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {archive
                .slice(-12)
                .reverse()
                .map((g) => {
                  const w = g.results.reduce((a, b) => (b.total > a.total ? b : a), g.results[0])
                  return (
                    <tr key={g.id}>
                      <td>{new Date(g.date).toLocaleDateString('fr-FR')}</td>
                      <td>{g.playerCount}</td>
                      <td>{g.durationMs === undefined ? '—' : formatDuration(g.durationMs)}</td>
                      <td>{w?.name}</td>
                      <td>{w?.total}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <div className="row wrap">
          <button className="btn small" onClick={download}>
            Exporter en CSV
          </button>
          <button
            className="btn small ghost"
            onClick={() => {
              if (confirm('Effacer toutes les parties archivées ?')) {
                clearArchive()
                setArchive([])
              }
            }}
          >
            Vider l’archive
          </button>
        </div>
      </div>
    </div>
  )
}

function Kpi({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  )
}
