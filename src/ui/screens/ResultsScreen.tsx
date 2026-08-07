import { useMemo, useState } from "react";
import {
  activeRuleset,
  cardResults,
  COLOR_HEX,
  COLOR_NAMES,
  PATH_COLORS,
  playerStats,
  signed,
  ranking,
} from "../../engine/index.ts";
import type { Color, GameState } from "../../engine/index.ts";
import { BoardView } from "../components/BoardView.tsx";
import { ScoreDetail } from "../components/ScoreDetail.tsx";
import { Bars, ScoreLines } from "../components/Charts.tsx";
import { MissionCardView } from "../components/MissionCard.tsx";
import { GameReport } from "../components/GameReport.tsx";
import { spellDuration } from "../duration.ts";

interface Props {
  state: GameState;
  /** Partie archivée correspondante : le rapport s'y attache. */
  archivedId?: string | null;
  /** Durée totale de la partie, au chrono. */
  durationMs?: number;
  onReplaySameSeed: () => void;
  onNewGame: () => void;
  onBackToGame: () => void;
  onQuit: () => void;
  onOpenArchive: () => void;
}

export function ResultsScreen({
  state,
  archivedId,
  durationMs,
  onReplaySameSeed,
  onNewGame,
  onBackToGame,
  onQuit,
  onOpenArchive,
}: Props) {
  const stats = useMemo(() => playerStats(state), [state]);
  const ranked = useMemo(() => ranking(stats), [stats]);
  const [focus, setFocus] = useState(ranked[0]?.player.id ?? 0);

  const focused = stats[focus];
  // Toutes les cartes du joueur affiché : chacune avec ses propres points.
  const missions = useMemo(() => cardResults(state, focus), [state, focus]);
  const colorTotals = PATH_COLORS.map((c) => ({
    label: COLOR_NAMES[c],
    value:
      stats.reduce((n, s) => n + s.breakdown.byColor[c as Color].points, 0) /
      stats.length,
    color: COLOR_HEX[c],
  }));

  return (
    <div className="sheet">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 16 }}
      >
        <div className="row" style={{ gap: 12, flex: "none" }}>
          <h2 style={{ fontSize: 26, whiteSpace: "nowrap" }}>Fin de partie</h2>
          {durationMs !== undefined && (
            <span className="tag chrono done" title="Durée totale de la partie">
              ⏱ <strong>{spellDuration(durationMs)}</strong>
            </span>
          )}
        </div>
        <div className="row wrap">
          <button className="btn small" onClick={onBackToGame}>
            Revoir les plateaux
          </button>
          <button className="btn small" onClick={onOpenArchive}>
            Statistiques cumulées
          </button>
          <button className="btn small" onClick={onReplaySameSeed}>
            Rejouer cette pioche
          </button>
          <button className="btn small" onClick={onQuit}>
            Quitter la partie
          </button>
          <button className="btn primary small" onClick={onNewGame}>
            Nouvelle partie
          </button>
        </div>
      </div>

      <div className="podium" style={{ marginBottom: 18 }}>
        {ranked.map((s) => (
          <div
            key={s.player.id}
            className={`podium-row ${s.rank === 1 ? "win" : ""}`}
          >
            <span className="rank">{s.rank === 1 ? "🏆" : s.rank}</span>
            <div>
              <div className="row">
                <span className="dot" style={{ background: s.player.color }} />
                <strong>{s.player.name}</strong>
                {s.player.kind !== "human" && <span className="tag">bot</span>}
              </div>
              <div className="note">
                {s.scoringPaths} chemin{s.scoringPaths > 1 ? "s" : ""} · plus
                long {s.longestPath || "—"} tuiles · {s.breakdown.blackZones}{" "}
                zone
                {s.breakdown.blackZones > 1 ? "s" : ""} noire
                {s.breakdown.blackZones > 1 ? "s" : ""}
                {s.breakdown.cardLabel
                  ? ` · missions ${
                      s.breakdown.cardPoints > 0
                        ? `+${s.breakdown.cardPoints}`
                        : "+0"
                    }`
                  : ""}
              </div>
            </div>
            <span className="score-big" style={{ fontSize: 28 }}>
              {s.breakdown.total}
            </span>
          </div>
        ))}
      </div>

      {archivedId && <GameReport gameId={archivedId} />}

      <div className="grid-2">
        <div className="stack">
          <div className="panel">
            <h3>Détail par joueur</h3>
            <div className="tabs">
              {stats.map((s) => (
                <button
                  key={s.player.id}
                  className={focus === s.player.id ? "on" : ""}
                  onClick={() => setFocus(s.player.id)}
                >
                  {s.player.name}
                </button>
              ))}
            </div>
            <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
              <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                <BoardView
                  board={focused.player.board}
                  ruleset={activeRuleset(state)}
                  frameColor={focused.player.color}
                  showZones
                  forbidden={focused.player.forbiddenColors}
                />
              </div>
              <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                <ScoreDetail breakdown={focused.breakdown} />
                {missions.length > 0 && (
                  <div className="stack" style={{ marginTop: 10, gap: 8 }}>
                    {missions.map((m) => (
                      <MissionCardView
                        key={m.card.id}
                        card={m.card}
                        compact
                        points={m.points}
                        detail={m.detail}
                        structural={m.structural}
                        color={m.color}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Survole une zone du plateau pour voir sa valeur ; les pastilles
              indiquent les points de chaque chemin qui marque et de chaque zone
              noire.
            </p>
          </div>

          <div className="panel">
            <h3>Comparatif</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>Joueur</th>
                  {PATH_COLORS.map((c) => (
                    <th key={c} title={COLOR_NAMES[c]}>
                      <span
                        className="swatch"
                        style={{
                          background: COLOR_HEX[c],
                          display: "inline-block",
                        }}
                      />
                    </th>
                  ))}
                  <th>Noir</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.player.id}>
                    <td>{s.player.name}</td>
                    {PATH_COLORS.map((c) => (
                      <td
                        key={c}
                        style={{
                          opacity: s.breakdown.byColor[c].points ? 1 : 0.35,
                        }}
                      >
                        {s.breakdown.byColor[c].points || "·"}
                      </td>
                    ))}
                    <td
                      style={{
                        color:
                          s.breakdown.blackPoints < 0
                            ? "var(--bad)"
                            : s.breakdown.blackPoints > 0
                              ? "var(--good)"
                              : undefined,
                      }}
                    >
                      {s.breakdown.blackPoints ? signed(s.breakdown.blackPoints) : "·"}
                    </td>
                    <td>
                      <strong>{s.breakdown.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h3>Évolution des scores</h3>
            <ScoreLines
              length={state.totalRounds}
              series={state.players.map((p, i) => ({
                label: p.name,
                color: p.color,
                values: state.scoreHistory[i],
              }))}
            />
          </div>

          <div className="panel">
            <h3>Rendement moyen par couleur (cette partie)</h3>
            <Bars items={colorTotals} format={(v) => `${v.toFixed(1)} pts`} />
          </div>

          <div className="panel">
            <h3>Indicateurs d’équilibrage</h3>
            <div className="kpi-grid">
              <Kpi
                k="Écart"
                v={`${Math.max(...stats.map((s) => s.breakdown.total)) - Math.min(...stats.map((s) => s.breakdown.total))}`}
                s="entre 1er et dernier"
              />
              <Kpi
                k="Moyenne"
                v={(
                  stats.reduce((n, s) => n + s.breakdown.total, 0) /
                  stats.length
                ).toFixed(1)}
                s="points par joueur"
              />
              <Kpi
                k="Noir"
                v={(
                  stats.reduce((n, s) => n + s.breakdown.blackZones, 0) /
                  stats.length
                ).toFixed(1)}
                s="zones par joueur"
              />
              <Kpi
                k="Gâchis"
                v={(
                  stats.reduce((n, s) => n + s.wastedPotential, 0) /
                  stats.length
                ).toFixed(1)}
                s="tuiles en chemins trop courts"
              />
            </div>
            <p className="note" style={{ marginTop: 8 }}>
              Graine : <code>{state.options.seed}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="kpi">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}
