import { useEffect, useMemo, useRef, useState } from 'react'
import {
  aggregate,
  COLOR_HEX,
  COLOR_NAMES,
  configError,
  defaultOptions,
  DEFAULT_RULESET,
  histogram,
  PATH_COLORS,
  playOneGame,
  randomSeed,
  tilesPerRound,
} from '../../engine/index.ts'
import type {
  Color,
  GameConfig,
  PlayerKind,
  Ruleset,
  SimGameRecord,
  SimResult,
} from '../../engine/index.ts'
import { Bars, Histogram } from '../components/Charts.tsx'
import {
  clearArchive,
  exportArchiveCsv,
  loadArchive,
  summarize,
  type ArchivedGame,
} from '../storage.ts'

const KINDS: PlayerKind[] = ['bot-smart', 'bot-greedy', 'bot-random']
const KIND_LABEL: Record<string, string> = {
  human: 'humain',
  'bot-random': 'hasard',
  'bot-greedy': 'glouton',
  'bot-smart': 'stratège',
}
/** Nombre de parties jouées entre deux rafraîchissements de l'écran. */
const BATCH = 12

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

function SimPanel() {
  const [playerCount, setPlayerCount] = useState(4)
  const [kinds, setKinds] = useState<PlayerKind[]>(Array(6).fill('bot-smart'))
  const [ruleset, setRuleset] = useState<Ruleset>({ ...DEFAULT_RULESET })
  const [target, setTarget] = useState(200)
  const [seed, setSeed] = useState(randomSeed())
  const [records, setRecords] = useState<SimGameRecord[]>([])
  const [running, setRunning] = useState(false)
  const cancel = useRef(false)

  const config: GameConfig = useMemo(
    () => ({
      players: Array.from({ length: playerCount }, (_, i) => ({
        name: `J${i + 1}`,
        kind: kinds[i],
      })),
      options: { ...defaultOptions(seed), ruleset },
    }),
    [playerCount, kinds, ruleset, seed],
  )
  const error = configError(config)
  const result: SimResult | null = useMemo(
    () => (records.length ? aggregate(records, playerCount) : null),
    [records, playerCount],
  )

  // On joue par petits paquets pour ne pas figer l'interface.
  useEffect(() => {
    if (!running) return
    let stop = false
    const step = () => {
      if (stop || cancel.current) return
      setRecords((prev) => {
        if (prev.length >= target) {
          setRunning(false)
          return prev
        }
        const next = prev.slice()
        const n = Math.min(BATCH, target - prev.length)
        for (let i = 0; i < n; i++) {
          next.push(playOneGame(config, `${seed}#${prev.length + i}`))
        }
        return next
      })
      requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => {
      stop = true
      cancelAnimationFrame(id)
    }
  }, [running, target, config, seed])

  const run = () => {
    cancel.current = false
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

          <RulesetEditor ruleset={ruleset} onChange={setRuleset} playerCount={playerCount} />

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
            Les bots jouent le barème actuel : modifie-le puis relance pour comparer. La graine rend
            chaque campagne reproductible.
          </p>
        </div>
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
              <div className="kpi-grid">
                <Kpi k="Moyenne" v={result.mean.toFixed(1)} s="points" />
                <Kpi k="Médiane" v={result.median.toFixed(0)} s="points" />
                <Kpi k="Écart-type" v={result.stdev.toFixed(1)} s="dispersion" />
                <Kpi k="Min / Max" v={`${result.min} / ${result.max}`} s="observés" />
                <Kpi k="Écart moyen" v={result.avgSpread.toFixed(1)} s="1er vs dernier" />
                <Kpi
                  k="Zones noires"
                  v={result.avgBlackZones.toFixed(2)}
                  s={`${result.avgBlackPoints.toFixed(1)} pts perdus`}
                />
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
                  </tr>
                </thead>
                <tbody>
                  {result.meanBySeat.map((m, i) => (
                    <tr key={i}>
                      <td>J{i + 1}</td>
                      <td>{KIND_LABEL[kinds[i]]}</td>
                      <td>{m.toFixed(1)}</td>
                      <td>{((result.winsBySeat[i] / result.games) * 100).toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">
                Le joueur J1 commence avec le sac à la première manche. Un taux de victoire très
                supérieur à {(100 / playerCount).toFixed(0)} % traduit un avantage de position.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RulesetEditor({
  ruleset,
  onChange,
  playerCount,
}: {
  ruleset: Ruleset
  onChange: (r: Ruleset) => void
  playerCount: number
}) {
  const patch = (p: Partial<Ruleset>) => onChange({ ...ruleset, ...p })
  return (
    <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div className="row wrap">
        <label className="field" style={{ width: 110 }}>
          <span>Plateau</span>
          <select value={ruleset.boardSize} onChange={(e) => patch({ boardSize: Number(e.target.value) })}>
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} × {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 130 }}>
          <span>Tuiles / manche</span>
          <select
            value={ruleset.tilesPerRound}
            onChange={(e) => patch({ tilesPerRound: Number(e.target.value) })}
          >
            <option value={0}>Auto ({tilesPerRound(ruleset, playerCount)})</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 110 }}>
          <span>Malus noir</span>
          <input
            type="number"
            max={0}
            value={ruleset.blackPenalty}
            onChange={(e) => patch({ blackPenalty: Number(e.target.value) })}
          />
        </label>
        <label className="field" style={{ width: 110 }}>
          <span>Chemin min.</span>
          <input
            type="number"
            min={2}
            max={6}
            value={ruleset.minSpan}
            onChange={(e) => patch({ minSpan: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="row wrap">
        {[3, 4, 5, 6, 7, 8, 9].map((span) => (
          <label className="field" key={span} style={{ width: 66 }}>
            <span>{span === 9 ? '9+' : span}</span>
            <input
              type="number"
              value={ruleset.pointsBySpan[span] ?? 0}
              onChange={(e) => {
                const t = ruleset.pointsBySpan.slice()
                t[span] = Number(e.target.value)
                patch({ pointsBySpan: t })
              }}
            />
          </label>
        ))}
        <button
          className="btn small ghost"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => onChange({ ...DEFAULT_RULESET })}
        >
          Barème officiel
        </button>
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
