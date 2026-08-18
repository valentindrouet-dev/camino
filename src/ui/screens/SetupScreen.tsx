import { useState } from "react";
import type React from "react";
import {
  BOARD_COLOR_HEX,
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
  configError,
  freeBoardColor,
  randomSeed,
} from "../../engine/index.ts";
import type {
  BoardColor,
  GameConfig,
  GameOptions,
  PlayerConfig,
  PlayerKind,
} from "../../engine/index.ts";
import { saveLastConfig } from "../storage.ts";
import { varianteVisible } from "../reglages.ts";
import type { Reglages } from "../reglages.ts";
import { MaterialSection } from "../components/MaterialSection.tsx";
import { Toggle, VariantsPanel } from "../components/VariantsPanel.tsx";
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
  /* La configuration vit dans App : sortir de l'accueil ne l'efface pas. */
  players: PlayerConfig[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerConfig[]>>;
  options: GameOptions;
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>;
  showScale: boolean;
  setShowScale: (v: boolean) => void;
  /** Ouvre l'écran des parties en ligne. */
  onOpenSalons: () => void;
  /** Ouvre la page Réglages (protégée par mot de passe). */
  onOpenReglages: () => void;
  /** Ce qui doit apparaître dans la colonne des variantes. */
  reglages: Reglages;
  /** Une partie est en cours : proposer de la reprendre. */
  resumable?: boolean;
  onResume?: () => void;
}

export function SetupScreen({
  onStart,
  players,
  setPlayers,
  options,
  setOptions,
  showScale,
  setShowScale,
  onOpenSalons,
  onOpenReglages,
  reglages,
  resumable,
  onResume,
}: Props) {
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
        </div>

        <div className="panel stack">
          <h3>Options de partie</h3>
          <div className="row wrap">
            <Toggle
              label="Score"
              on={options.liveScore}
              onChange={(v) => setOptions((o) => ({ ...o, liveScore: v }))}
            />
            <Toggle
              label="Points par Zone"
              on={options.showZones}
              onChange={(v) => setOptions((o) => ({ ...o, showZones: v }))}
            />
            <Toggle
              label="1er Joueur Aléatoire"
              on={!!options.randomFirst}
              onChange={(v) => setOptions((o) => ({ ...o, randomFirst: v }))}
            />
            <Toggle
              label="Dernière Tuile"
              on={!!options.showLastPlaced}
              onChange={(v) => setOptions((o) => ({ ...o, showLastPlaced: v }))}
            />
            <Toggle
              label="Indices"
              on={options.showHints}
              onChange={(v) => setOptions((o) => ({ ...o, showHints: v }))}
            />
            <Toggle
              label="Graine"
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
          <button
            className="btn"
            style={{ padding: "10px 24px", alignSelf: "stretch" }}
            onClick={onOpenSalons}
          >
            🌐 Jouer en ligne, chacun sur son appareil
          </button>
        </div>

        {/* ---- variantes : le même panneau qu'au Laboratoire ---- */}
        <VariantsPanel
          options={options}
          setOptions={setOptions}
          visible={(cle) => varianteVisible(reglages, cle)}
          showScale={showScale}
          setShowScale={setShowScale}
        />
      </div>

      <div
        className="row wrap"
        style={{ marginTop: 18, justifyContent: "center", gap: 12 }}
      >
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
        <button className="btn" onClick={onOpenReglages}>
          Réglages
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
