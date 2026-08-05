import { useMemo, useState } from "react";
import {
  BOARD_COLOR_HEX,
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
  CARDS,
  bagSize,
  configError,
  defaultOptions,
  defaultPlayers,
  DEFAULT_RULESET,
  freeBoardColor,
  randomSeed,
  tilesNeeded,
  tilesPerRound,
} from "../../engine/index.ts";
import type {
  BoardColor,
  GameConfig,
  PlayerConfig,
  PlayerKind,
  Ruleset,
  Variants,
} from "../../engine/index.ts";
import { loadLastConfig, saveLastConfig } from "../storage.ts";
import { MaterialSection } from "../components/MaterialSection.tsx";
import { MissionCardView } from "../components/MissionCard.tsx";
import { BUILD, VERSION } from "../../version.ts";

const KIND_LABELS: Record<PlayerKind, string> = {
  human: "Humain",
  "bot-random": "Bot — Hasard",
  "bot-greedy": "Bot — Novice",
  "bot-smart": "Bot — Stratège",
};

/** Les six couleurs du jeu, assombries juste ce qu'il faut pour rester lisibles
 *  sur le fond crème. */
const HERO_COLORS = [
  "#E0A200",
  "#F0801F",
  "#D1232A",
  "#2E9B45",
  "#0083C4",
  "#6850A1",
];

interface Props {
  onStart: (config: GameConfig) => void;
  onOpenLab: () => void;
  /** Une partie est en cours : proposer de la reprendre. */
  resumable?: boolean;
  onResume?: () => void;
}

export function SetupScreen({
  onStart,
  onOpenLab,
  resumable,
  onResume,
}: Props) {
  const saved = useMemo(() => loadLastConfig<GameConfig>(), []);
  const [players, setPlayers] = useState<PlayerConfig[]>(
    saved?.players?.every((p) => p.boardColor)
      ? saved.players
      : defaultPlayers(2),
  );
  const [options, setOptions] = useState(
    saved?.options ?? defaultOptions(randomSeed()),
  );
  const [showScale, setShowScale] = useState(false);

  const config: GameConfig = { players, options };
  const error = configError(config);
  const perRound = tilesPerRound(options.ruleset, players.length);
  const needed = tilesNeeded(options.ruleset, players.length);

  const setCount = (n: number) => {
    setPlayers((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) {
        next.push({
          name: `Joueur ${next.length + 1}`,
          kind: "human",
          boardColor: freeBoardColor(next.map((p) => p.boardColor)),
        });
      }
      return next;
    });
  };

  /** Choisir une couleur déjà prise l'échange avec l'autre joueur. */
  const pickColor = (index: number, color: BoardColor) =>
    setPlayers((prev) => {
      const owner = prev.findIndex((p) => p.boardColor === color);
      return prev.map((p, i) => {
        if (i === index) return { ...p, boardColor: color };
        if (i === owner) return { ...p, boardColor: prev[index].boardColor };
        return p;
      });
    });

  const patchRuleset = (patch: Partial<Ruleset>) =>
    setOptions((o) => ({ ...o, ruleset: { ...o.ruleset, ...patch } }));

  const variants = options.ruleset.variants ?? {};
  const patchVariants = (patch: Partial<Variants>) =>
    setOptions((o) => ({
      ...o,
      ruleset: { ...o.ruleset, variants: { ...o.ruleset.variants, ...patch } },
    }));

  const start = () => {
    saveLastConfig(config);
    onStart(config);
  };

  return (
    <div className="sheet">
      <div className="hero">
        <h1 aria-label="Camino">
          {[..."CAMINO"].map((c, i) => (
            <span key={i} style={{ color: HERO_COLORS[i] }} aria-hidden>
              {c}
            </span>
          ))}
        </h1>
        <p>
          Table de jeu, playtest et équilibrage — 1 à 6 joueurs sur le même
          écran.
          <br />
          97 tuiles, plateaux {options.ruleset.boardSize}×
          {options.ruleset.boardSize},{" "}
          {options.ruleset.boardSize * options.ruleset.boardSize} manches.
        </p>
        {resumable && (
          <p style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={onResume}>
              ⏵ Reprendre la partie en cours
            </button>
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h3>Joueurs</h3>
          <div className="row wrap">
            <div className="seg">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  className={players.length === n ? "on" : ""}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="note">
              {players.length === 1 ? "solo" : `${players.length} joueurs`}
            </span>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {players.map((p, i) => (
              <div className="player-row" key={i}>
                <input
                  type="text"
                  value={p.name}
                  maxLength={18}
                  placeholder={`Joueur ${i + 1}`}
                  onChange={(e) =>
                    setPlayers((prev) =>
                      prev.map((q, k) =>
                        k === i ? { ...q, name: e.target.value } : q,
                      ),
                    )
                  }
                />
                <div className="color-picker">
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`chip ${p.boardColor === c ? "on" : ""}`}
                      style={{ background: BOARD_COLOR_HEX[c] }}
                      title={`Plateau ${BOARD_COLOR_NAMES[c].toLowerCase()}`}
                      onClick={() => pickColor(i, c)}
                    />
                  ))}
                </div>
                <select
                  value={p.kind}
                  onChange={(e) =>
                    setPlayers((prev) =>
                      prev.map((q, k) =>
                        k === i
                          ? { ...q, kind: e.target.value as PlayerKind }
                          : q,
                      ),
                    )
                  }
                >
                  {(Object.keys(KIND_LABELS) as PlayerKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  className="btn small ghost"
                  disabled={players.length <= 1}
                  title="Retirer"
                  onClick={() =>
                    setPlayers((prev) => prev.filter((_, k) => k !== i))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="note">
            Chaque joueur prend un plateau : cliquez sur une pastille pour
            changer de couleur, deux joueurs ne peuvent pas avoir la même. Les
            bots jouent tout seuls — le Novice joue le meilleur coup immédiat,
            le Stratège construit ses couleurs sur la durée.
          </p>
        </div>

        <div className="panel stack">
          <h3>Options de partie</h3>
          <div className="row wrap">
            <Toggle
              label="Score visible"
              on={options.liveScore}
              onChange={(v) => setOptions((o) => ({ ...o, liveScore: v }))}
            />
            <Toggle
              label="Points par Zone visible"
              on={options.showZones}
              onChange={(v) => setOptions((o) => ({ ...o, showZones: v }))}
            />
            <Toggle
              label="Indices"
              on={options.showHints}
              onChange={(v) => setOptions((o) => ({ ...o, showHints: v }))}
            />
            <Toggle
              label="Graine manuelle"
              on={!!options.manualSeed}
              onChange={(v) =>
                setOptions((o) => ({
                  ...o,
                  manualSeed: v,
                  seed: v ? o.seed : randomSeed(),
                }))
              }
            />
          </div>

          {options.manualSeed && (
            <div className="field">
              <span>Graine de la partie (même graine = même pioche)</span>
              <div className="row">
                <input
                  type="text"
                  value={options.seed}
                  placeholder="ex. oro-9594"
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, seed: e.target.value }))
                  }
                />
                <button
                  className="btn icon"
                  title="Tirer une graine au hasard"
                  onClick={() =>
                    setOptions((o) => ({ ...o, seed: randomSeed() }))
                  }
                >
                  🎲
                </button>
              </div>
              <span className="note">
                Reprenez la graine affichée à la fin d’une partie pour rejouer
                exactement la même pioche.
              </span>
            </div>
          )}

          {/* ------------------------------------------------------ variantes */}
          <div className="section-head">Variantes</div>
          <div className="row wrap">
            <VariantToggle
              label="Cartes missions"
              on={options.useCards && (options.cardCount ?? 1) <= 1}
              onChange={(v) =>
                setOptions((o) => ({
                  ...o,
                  useCards: v,
                  cardCount: 1,
                  ...(v ? { personalCards: false } : {}),
                }))
              }
              description="Une carte tirée pour la table, la même mission pour tout le monde."
            />
            <VariantToggle
              label="Cartes missions multiples"
              on={options.useCards && (options.cardCount ?? 1) > 1}
              onChange={(v) =>
                setOptions((o) => ({
                  ...o,
                  useCards: v,
                  cardCount: v ? Math.max(2, o.cardCount ?? 2) : 1,
                  ...(v ? { personalCards: false } : {}),
                }))
              }
              description="Plusieurs cartes pour la table, leurs bonus se cumulent."
            />
            <VariantToggle
              label="Cartes missions persos"
              on={!!options.personalCards}
              onChange={(v) =>
                setOptions((o) => ({
                  ...o,
                  personalCards: v,
                  ...(v ? { useCards: false, cardCount: 1 } : {}),
                }))
              }
              description="Chaque joueur reçoit sa propre carte, qu’il est seul à pouvoir accomplir. Exclusif avec les cartes de la table."
            />
            <VariantToggle
              label="Pose libre"
              on={!options.ruleset.requireAdjacency}
              onChange={(v) => patchRuleset({ requireAdjacency: !v })}
              description="Les tuiles n’ont plus besoin de toucher une tuile déjà posée."
            />
            <VariantToggle
              label="Dernier choix aléatoire"
              on={!!variants.lastPickRandom}
              onChange={(v) => patchVariants({ lastPickRandom: v })}
              description="Le dernier à choisir peut échanger la tuile restante contre une pioche au hasard — une fois, sans retour."
            />
            <VariantToggle
              label="Bordures colorées"
              on={!!variants.coloredBorders}
              onChange={(v) =>
                patchVariants({ coloredBorders: v, ...(v ? { multiBorders: false } : {}) })
              }
              description="Le bord du plateau score dans la couleur du joueur : chaque côté relié compte comme une case (max 4). Exclusif avec Bordures multicolores."
            />
            <VariantToggle
              label="Bordures multicolores"
              on={!!variants.multiBorders}
              onChange={(v) =>
                patchVariants({ multiBorders: v, ...(v ? { coloredBorders: false } : {}) })
              }
              description="Plateaux bordés de 8 carrés colorés par côté (coins blancs) : chaque carré relié à sa couleur compte comme une case. Exclusif avec Bordures colorées."
            />
            <VariantToggle
              label="Tuiles monochromes"
              on={!!variants.monoTiles}
              onChange={(v) => patchVariants({ monoTiles: v })}
              description="+12 tuiles unies dans le sac (2 par couleur)."
            />
            <VariantToggle
              label="Tuiles blanches"
              on={!!variants.whiteTiles}
              onChange={(v) => patchVariants({ whiteTiles: v })}
              description="+6 tuiles blanches jokers : elles prolongent et relient les chemins de toutes les couleurs voisines."
            />
            <VariantToggle
              label="Étoiles magiques"
              on={!!variants.magicStars}
              onChange={(v) => patchVariants({ magicStars: v })}
              description="30 tuiles portent une étoile. 1 étoile = 1 pt ; reliées : 2 = 3, 3 = 6, 4 = 10, 5 = 20 pts."
            />
            <VariantToggle
              label="Tuile personnelle"
              on={!!variants.personalTile}
              onChange={(v) => patchVariants({ personalTile: v })}
              description="Chaque joueur reçoit une tuile sans noir, jouable une seule fois à la place d’une tuile du centre."
            />
            <VariantToggle
              label="Tuiles miroir"
              on={!!variants.mirrorTiles}
              onChange={(v) => patchVariants({ mirrorTiles: v })}
              description="Chaque tuile peut se retourner sur sa face miroir (touche F) : couleurs inversées gauche-droite."
            />
          </div>

          {options.useCards && (options.cardCount ?? 1) > 1 && (
            <label className="field" style={{ maxWidth: 220 }}>
              <span>Nombre de cartes de la table</span>
              <select
                value={options.cardCount ?? 2}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, cardCount: Number(e.target.value) }))
                }
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} cartes
                  </option>
                ))}
              </select>
            </label>
          )}

          {options.useCards && (options.cardCount ?? 1) <= 1 && (
            <div className="field">
              <span>Carte de la partie</span>
              <select
                value={options.cardId ?? ""}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    cardId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Tirée au hasard</option>
                {CARDS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.badge} — {c.name}
                  </option>
                ))}
              </select>
              {options.cardId && (
                <div style={{ marginTop: 8 }}>
                  <MissionCardView
                    card={CARDS.find((c) => c.id === options.cardId)!}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="note">
              {perRound} tuile{perRound > 1 ? "s" : ""} révélée
              {perRound > 1 ? "s" : ""} par manche · {needed}/
              {bagSize(options.ruleset)} tuiles utilisées
            </span>
            <button
              className="btn small ghost"
              onClick={() => setShowScale((v) => !v)}
            >
              {showScale ? "Masquer le barème" : "Barème"}
            </button>
          </div>

          {showScale && (
            <div
              className="stack"
              style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}
            >
              <div className="row wrap">
                <label className="field" style={{ width: 130 }}>
                  <span>Côté du plateau</span>
                  <select
                    value={options.ruleset.boardSize}
                    onChange={(e) =>
                      patchRuleset({ boardSize: Number(e.target.value) })
                    }
                  >
                    {[3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} × {n} ({n * n} manches)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 150 }}>
                  <span>Tuiles par manche</span>
                  <select
                    value={options.ruleset.tilesPerRound}
                    onChange={(e) =>
                      patchRuleset({ tilesPerRound: Number(e.target.value) })
                    }
                  >
                    <option value={0}>Auto (règle)</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 120 }}>
                  <span>Malus zone noire</span>
                  <input
                    type="number"
                    value={options.ruleset.blackPenalty}
                    max={0}
                    onChange={(e) =>
                      patchRuleset({ blackPenalty: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field" style={{ width: 130 }}>
                  <span>Chemin minimum</span>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={options.ruleset.minSpan}
                    onChange={(e) =>
                      patchRuleset({ minSpan: Number(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div>
                <span className="note">
                  Points selon le nombre de tuiles traversées
                </span>
                <div className="row wrap" style={{ marginTop: 6 }}>
                  {[3, 4, 5, 6, 7, 8, 9].map((span) => (
                    <label className="field" key={span} style={{ width: 74 }}>
                      <span>{span === 9 ? "9 et +" : `${span} tuiles`}</span>
                      <input
                        type="number"
                        value={options.ruleset.pointsBySpan[span] ?? 0}
                        onChange={(e) => {
                          const table = options.ruleset.pointsBySpan.slice();
                          table[span] = Number(e.target.value);
                          patchRuleset({ pointsBySpan: table });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="btn small ghost"
                style={{ alignSelf: "flex-start" }}
                onClick={() => patchRuleset({ ...DEFAULT_RULESET })}
              >
                Revenir au barème officiel
              </button>
            </div>
          )}

          {error && <div className="warn">{error}</div>}
        </div>
      </div>

      <div
        className="row"
        style={{ marginTop: 18, justifyContent: "center", gap: 12 }}
      >
        <button
          className="btn primary"
          style={{ padding: "12px 30px" }}
          disabled={!!error}
          onClick={start}
        >
          Commencer la partie
        </button>
        <button className="btn" onClick={onOpenLab}>
          Laboratoire d’équilibrage
        </button>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <h3>Rappel des règles</h3>
        <p className="note" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          Chaque manche, on révèle autant de tuiles que de joueurs. Le porteur
          du sac choisit en premier, puis les autres dans le sens horaire ;
          chacun pose sa tuile sur son plateau dans l’orientation de son choix.
          Toute tuile (sauf la première) doit toucher une tuile déjà posée. Le
          sac passe ensuite au voisin de gauche. La partie s’arrête quand les
          plateaux sont pleins.
          <br />
          <br />
          <strong>Décompte :</strong> un chemin est un groupe de quarts de même
          couleur reliés orthogonalement — même à travers la frontière de deux
          tuiles. Ce qui compte, c’est le nombre de{" "}
          <strong>tuiles différentes</strong> qu’il traverse : 3 → 3 pts, 4 → 5,
          5 → 8, 6 → 12, 7 → 17, 8 → 23, 9 et + → 30. Chaque{" "}
          <strong>zone noire</strong>, quelle que soit sa taille, coûte 2
          points.
        </p>
      </div>

      <MaterialSection />

      <p className="note" style={{ textAlign: "center", marginTop: 18 }}>
        Version {VERSION} — compilée le {BUILD}
      </p>
    </div>
  );
}



function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`toggle ${on ? "on" : ""}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Interrupteur de variante : sa description n'apparaît qu'une fois coché. */
function VariantToggle({
  label,
  on,
  onChange,
  description,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  description: string;
}) {
  return (
    <div className={`variant ${on ? "on" : ""}`}>
      <Toggle label={label} on={on} onChange={onChange} />
      {on && <p className="variant-desc">{description}</p>}
    </div>
  );
}
