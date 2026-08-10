import { useMemo, useState } from "react";
import {
  BOARD_COLOR_HEX,
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
  CARDS,
  cardById,
  configError,
  defaultOptions,
  defaultPlayers,
  DEFAULT_RULESET,
  freeBoardColor,
  randomSeed,
} from "../../engine/index.ts";
import type {
  BoardColor,
  GameConfig,
  PlayerConfig,
  PlayerKind,
  Ruleset,
  StarScoring,
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
  const [options, setOptions] = useState(() => {
    const o = saved?.options ?? defaultOptions(randomSeed());
    // Une carte retirée du jeu depuis la dernière partie ne doit pas rester
    // choisie en silence : sans ça, la partie démarrerait sans mission.
    return o.cardId && !cardById(o.cardId) ? { ...o, cardId: undefined } : o;
  });
  const [showScale, setShowScale] = useState(false);
  // Règles et matériel : deux dépliants de la page d'accueil, fermés au départ.
  const [showRules, setShowRules] = useState(false);
  const [showMaterial, setShowMaterial] = useState(false);

  const config: GameConfig = { players, options };
  const error = configError(config);

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

  /** Tout décocher : variantes, cartes, pose libre et barème perso. */
  const resetVariants = () => {
    setShowScale(false);
    setOptions((o) => ({
      ...o,
      useCards: false,
      cardCount: 1,
      cardId: undefined,
      personalCards: false,
      ruleset: { ...o.ruleset, requireAdjacency: true, variants: {} },
    }));
  };

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
          Un jeu de <strong>Claude Clément</strong>,{" "}
          <strong>Marie-Laure Clément</strong> et{" "}
          <strong>Alexandre Droit</strong>
          <br />
          Édité par <strong>Big Budi Games</strong>
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
        <div className="stack">
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
              label="Dernière tuile posée"
              on={!!options.showLastPlaced}
              onChange={(v) => setOptions((o) => ({ ...o, showLastPlaced: v }))}
            />
            <Toggle
              label="1er Joueur Aléatoire"
              on={!!options.randomFirst}
              onChange={(v) => setOptions((o) => ({ ...o, randomFirst: v }))}
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

        </div>

          {error && <div className="warn">{error}</div>}

          <button
            className="btn primary"
            style={{ padding: "12px 30px", alignSelf: "stretch" }}
            disabled={!!error}
            onClick={start}
          >
            Commencer la partie
          </button>
        </div>

        {/* ---------------------------------------------------------- variantes */}
        <div className="panel stack">
          <h3>Variantes</h3>
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
            >
              <label className="field variant-field">
                <span>Nombre de cartes</span>
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
            </VariantToggle>
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
              description="Le bord du plateau est à la couleur du joueur. Un chemin de cette couleur qui touche le bord — une ou plusieurs fois, un ou plusieurs côtés — gagne une case, une seule. Les bords ne relient jamais deux chemins. Exclusif avec Bordures multicolores."
            />
            <VariantToggle
              label="Bordures multicolores"
              on={!!variants.multiBorders}
              onChange={(v) =>
                patchVariants({ multiBorders: v, ...(v ? { coloredBorders: false } : {}) })
              }
              description="Plateaux au verso sans cadre de couleur, bordés de 8 carrés colorés par côté (coins blancs) : chaque carré touché par un chemin de sa couleur ajoute une case, sans relier les chemins entre eux. Exclusif avec Bordures colorées."
            />
            <VariantToggle
              label="Tuiles monochromes"
              on={!!variants.monoTiles}
              onChange={(v) => patchVariants({ monoTiles: v })}
              description="+12 tuiles unies dans le sac (2 par couleur)."
            />
            <VariantToggle
              label="Tuiles arc-en-ciel"
              on={!!variants.whiteTiles}
              onChange={(v) => patchVariants({ whiteTiles: v })}
              description="+6 tuiles arc-en-ciel : un seul grand carré irisé qui prolonge et relie les chemins de toutes les couleurs voisines."
            />
            <VariantToggle
              label="Étoiles magiques"
              on={!!variants.magicStars}
              onChange={(v) => patchVariants({ magicStars: v })}
              description={
                variants.starScoring === "growing"
                  ? "30 tuiles portent une étoile. Dans un groupe de N étoiles reliées, chacune vaut N points : 2 reliées = 4 pts, 3 = 9 pts, 4 = 16 pts."
                  : "30 tuiles portent une étoile. Une étoile seule vaut 1 pt ; chaque étoile reliée à une autre en vaut 2 (3 reliées = 6 pts)."
              }
            >
              <label className="field variant-field">
                <span>Barème des étoiles</span>
                <select
                  value={variants.starScoring ?? "linked"}
                  onChange={(e) =>
                    patchVariants({ starScoring: e.target.value as StarScoring })
                  }
                >
                  <option value="linked">Reliée = 2 pts (officiel)</option>
                  <option value="growing">Groupe de N = N pts chacune</option>
                </select>
              </label>
            </VariantToggle>
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
            <VariantToggle
              label="Tuile supplémentaire"
              on={!!variants.extraTile}
              onChange={(v) => patchVariants({ extraTile: v })}
              description="Une tuile de plus au centre à chaque manche : plus de choix, et la tuile restante est remélangée dans le sac."
            />
            <VariantToggle
              label="Tuiles failles"
              on={!!variants.faultTiles}
              onChange={(v) => patchVariants({ faultTiles: v })}
              description="Une faille grise coupe 16 tuiles en deux moitiés : elles ne se relient pas entre elles, mais chacune se relie normalement aux tuiles voisines."
            />
            <VariantToggle
              label="Trèfles"
              on={!!variants.clovers}
              onChange={(v) => patchVariants({ clovers: v })}
              description="Un quart de tuile sur quatre porte un trèfle : +3 points s’il se trouve dans un chemin qui marque, −3 sinon."
            />
            <VariantToggle
              label="Tuile de départ"
              on={!!variants.startTile}
              onChange={(v) => patchVariants({ startTile: v })}
              description={
                variants.startTileMulti
                  ? "Tous les plateaux démarrent avec la même tuile à quatre couleurs, posée au centre — une manche de moins à jouer."
                  : "Chaque plateau démarre avec une tuile monochrome de sa propre couleur, posée au centre — une manche de moins à jouer."
              }
            >
              <label className="field variant-field">
                <span>Type de tuile</span>
                <select
                  value={variants.startTileMulti ? "multi" : "mono"}
                  onChange={(e) =>
                    patchVariants({ startTileMulti: e.target.value === "multi" })
                  }
                >
                  <option value="mono">Monochrome (couleur du plateau)</option>
                  <option value="multi">Multicolore (4 couleurs)</option>
                </select>
              </label>
            </VariantToggle>
            <VariantToggle
              label="Sac antihoraire"
              on={!!variants.bagCounterClockwise}
              onChange={(v) => patchVariants({ bagCounterClockwise: v })}
              description="Le sac revient au dernier servi — le voisin de droite — au lieu de tourner dans le sens horaire : le premier choix ne va plus toujours au même."
            />
            <VariantToggle
              label="Échange de plateaux"
              on={!!variants.boardSwap}
              onChange={(v) => patchVariants({ boardSwap: v })}
              description="Deux cartes face cachée dès le début : à la moitié de la partie on en retourne une. « Rotation ! » fait passer chaque plateau au voisin de gauche, « Pas de rotation ! » oblige à garder le sien."
            />
            <VariantToggle
              label="Couleur secrète"
              on={!!variants.secretColor}
              onChange={(v) => patchVariants({ secretColor: v })}
              description="Chaque joueur reçoit en secret une tuile monochrome — sa couleur. À la fin, son meilleur chemin de cette couleur est doublé. Cette tuile ne se joue pas."
            />
            <VariantToggle
              label="Couleur interdite"
              on={!!variants.forbiddenColor}
              onChange={(v) => patchVariants({ forbiddenColor: v })}
              description={
                (variants.forbiddenColorCount ?? 1) > 1
                  ? "Chaque joueur reçoit deux tuiles monochromes interdites. Ces deux couleurs se comportent alors comme le noir : chaque zone coûte 2 points, quelle que soit sa taille — les réunir reste payant. Ces tuiles ne se jouent pas."
                  : "Chaque joueur reçoit une tuile monochrome interdite. Cette couleur se comporte alors comme le noir : chaque zone coûte 2 points, quelle que soit sa taille — les réunir reste payant. Cette tuile ne se joue pas."
              }
            >
              <label className="field variant-field">
                <span>Couleurs interdites</span>
                <select
                  value={(variants.forbiddenColorCount ?? 1) > 1 ? "2" : "1"}
                  onChange={(e) =>
                    patchVariants({ forbiddenColorCount: Number(e.target.value) })
                  }
                >
                  <option value="1">1 couleur</option>
                  <option value="2">2 couleurs</option>
                </select>
              </label>
            </VariantToggle>
            <VariantToggle
              label="Verso aléatoire"
              on={!!variants.randomBack}
              onChange={(v) => patchVariants({ randomBack: v })}
              description="À son tour, un joueur peut retourner une tuile du centre : sa nouvelle face sort du sac, l’ancienne disparaît — et il doit la poser. On ne revient jamais en arrière (touche V)."
            />
            <VariantToggle
              label="Cristaux"
              on={!!variants.crystals}
              onChange={(v) => patchVariants({ crystals: v })}
              description="18 tuiles aux 3 ou 4 quarts de même couleur portent un cristal : +4 points si aucune tuile n’est venue se coller à la sienne après sa pose. Les voisines déjà en place ne le dérangent pas."
            />
            <VariantToggle
              label="Teintures"
              on={!!variants.dyes}
              onChange={(v) => patchVariants({ dyes: v })}
              description="18 tuiles portent un pot de couleur (3 par couleur). Posé adjacent à une zone noire, le pot déteint : toute la zone prend sa couleur, définitivement. Le noir arrivé plus tard reste noir."
            />
            <VariantToggle
              label="Moulins"
              on={!!variants.windmills}
              onChange={(v) => patchVariants({ windmills: v })}
              description="15 tuiles portent un moulin : à la pose, toutes les tuiles adjacentes déjà posées tournent d’un quart de tour vers la gauche. Les tuiles posées ensuite ne bougent plus."
            />
            <VariantToggle
              label="Partie synchrone"
              on={!!variants.syncDraw}
              onChange={(v) => patchVariants({ syncDraw: v })}
              description="Une seule tuile est révélée par manche, la même pour tout le monde : chacun la pose sur son plateau. Plus de choix au centre, plus d’ordre de pioche — un duel à armes strictement égales."
            />
            <VariantToggle
              label="Plateau commun"
              on={!!variants.sharedBoard}
              onChange={(v) => patchVariants({ sharedBoard: v })}
              description="Un seul grand plateau pour toute la table — 2 colonnes de 8 par joueur : 4×8 à deux, 6×8 à trois, 8×8 à quatre… À chaque pose, tching ! : le poseur encaisse immédiatement les points que sa tuile fait gagner (ou perdre) au plateau."
            />
            <VariantToggle
              label="Scoring inversé"
              on={!!variants.reverseScoring}
              onChange={(v) => patchVariants({ reverseScoring: v })}
              description="Tout le monde part à 20 points. Les zones noires en rapportent 2, les chemins coûtent ce qu’ils rapportaient. Les autres variantes suivent : ce qui faisait gagner fait perdre, et inversement."
            />
            <VariantToggle
              label="Barème perso"
              on={showScale}
              onChange={setShowScale}
              description="Taille du plateau, tuiles par manche, malus des zones noires et points par chemin, à votre main."
            />
            <button
              className="btn icon ghost variant-reset"
              title="Tout décocher"
              aria-label="Réinitialiser les variantes"
              onClick={resetVariants}
            >
              ↺
            </button>
          </div>

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

        </div>
      </div>

      <div
        className="row wrap"
        style={{ marginTop: 18, justifyContent: "center", gap: 12 }}
      >
        <button className="btn" onClick={onOpenLab}>
          Laboratoire d’équilibrage
        </button>
        <button
          className={`btn ${showRules ? "primary" : ""}`}
          onClick={() => setShowRules((v) => !v)}
        >
          Règles du jeu
        </button>
        <button
          className={`btn ${showMaterial ? "primary" : ""}`}
          onClick={() => setShowMaterial((v) => !v)}
        >
          Matériel
        </button>
      </div>

      {showRules && <RulesSection />}

      {showMaterial && <MaterialSection />}

      <p className="note" style={{ textAlign: "center", marginTop: 18 }}>
        Version {VERSION} — compilée le {BUILD}
      </p>
    </div>
  );
}



/** Les règles du jeu, dépliées depuis la page d'accueil. */
function RulesSection() {
  return (
    <div className="panel stack" style={{ marginTop: 22 }}>
      <h3>Règles du jeu</h3>

      <div className="rules">
        <section>
          <h4>Mise en place</h4>
          <p>
            Chaque joueur prend un plateau 4 × 4 — les plateaux se distinguent
            par la couleur de leur contour. Les 97 tuiles vont dans le sac. Le
            premier porteur du sac est le joueur 1, ou un joueur tiré au sort si
            l’option est cochée.
          </p>
        </section>

        <section>
          <h4>Déroulement d’une manche</h4>
          <p>
            On révèle au centre <strong>autant de tuiles que de joueurs</strong>.
            Le porteur du sac choisit en premier, puis les autres dans le sens
            horaire ; le dernier prend la tuile restante. Chacun pose la sienne
            sur son plateau, dans l’orientation de son choix.
          </p>
          <p>
            Toute tuile, sauf la première, doit <strong>toucher une tuile déjà
            posée</strong> — par un côté, jamais par un coin. Le sac passe
            ensuite au voisin de gauche, et une nouvelle manche commence. La
            partie s’arrête quand les plateaux sont pleins, au bout de 16
            manches.
          </p>
        </section>

        <section>
          <h4>Ce qu’est un chemin</h4>
          <p>
            Chaque tuile porte quatre quarts de couleur. Un <strong>chemin</strong>{" "}
            est un groupe de quarts de <strong>même couleur</strong> qui se
            touchent par un côté — y compris à travers la frontière entre deux
            tuiles. Ce qui rapporte des points, ce n’est pas le nombre de quarts
            mais le nombre de <strong>tuiles différentes</strong> que le chemin
            traverse : repasser deux fois par la même tuile ne compte qu’une
            fois.
          </p>
        </section>

        <section>
          <h4>Décompte</h4>
          <div className="rules-scale">
            {[
              ["3 tuiles", "3 pts"],
              ["4 tuiles", "5 pts"],
              ["5 tuiles", "8 pts"],
              ["6 tuiles", "12 pts"],
              ["7 tuiles", "17 pts"],
              ["8 tuiles", "23 pts"],
              ["9 et +", "30 pts"],
            ].map(([k, v]) => (
              <span key={k}>
                {k} <strong>{v}</strong>
              </span>
            ))}
          </div>
          <p>
            Un chemin de <strong>moins de 3 tuiles ne rapporte rien</strong>.
            Chaque <strong>zone noire</strong> coûte 2 points, quelle que soit sa
            taille : mieux vaut réunir son noir en une seule tache que
            l’éparpiller. Le total le plus élevé l’emporte.
          </p>
        </section>

        <section>
          <h4>Variantes</h4>
          <p>
            Toutes les variantes de la boîte se cochent dans la colonne de
            droite, et se combinent librement. Cochez-en une : sa règle exacte
            s’affiche juste en dessous, et elle vous sera rappelée en cours de
            partie.
          </p>
        </section>
      </div>
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
  children,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  description: string;
  /** Réglages propres à la variante, dépliés juste sous le bouton. */
  children?: React.ReactNode;
}) {
  return (
    <div className={`variant ${on ? "on" : ""}`}>
      <Toggle label={label} on={on} onChange={onChange} />
      {on && <p className="variant-desc">{description}</p>}
      {on && children}
    </div>
  );
}
