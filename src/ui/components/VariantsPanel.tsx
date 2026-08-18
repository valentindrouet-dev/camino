import type React from "react";
import { createContext, useContext } from "react";
import { CARDS, clearVariants, DEFAULT_RULESET } from "../../engine/index.ts";
import type {
  GameOptions,
  Ruleset,
  StarScoring,
  Variants,
} from "../../engine/index.ts";
import { MissionCardView } from "./MissionCard.tsx";
import { CATALOGUE } from "../reglages.ts";

/**
 * Quelles variantes sont proposées. L'accueil suit les Réglages ; le
 * Laboratoire ne passe rien et voit donc tout, c'est son rôle.
 */
const Visibilite = createContext<(cle: string) => boolean>(() => true);

interface Props {
  options: GameOptions;
  setOptions: React.Dispatch<React.SetStateAction<GameOptions>>;
  /** Filtre d'affichage : une variante masquée n'apparaît pas du tout. */
  visible?: (cle: string) => boolean;
  /** Barème perso déplié : l'état vit chez l'appelant, il le range où il veut. */
  showScale: boolean;
  setShowScale: (v: boolean) => void;
}

/**
 * Le panneau des variantes — partagé par l'écran d'accueil et le Laboratoire,
 * pour qu'une simulation puisse tester exactement ce qui se joue en vrai.
 */
export function VariantsPanel({
  options,
  setOptions,
  visible,
  showScale,
  setShowScale,
}: Props) {
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
    setOptions(clearVariants);
  };

  return (
    <Visibilite.Provider value={visible ?? (() => true)}>
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Variantes</h3>
        <button
          className="btn icon ghost variant-reset"
          title="Tout décocher"
          aria-label="Réinitialiser les variantes"
          onClick={resetVariants}
        >
          ↺
        </button>
      </div>
      <Groupe titre="CARTES MISSIONS">
        <VariantToggle
          cle="cards"
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
          cle="cardsMulti"
          label="Missions Multiples"
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
          cle="cardsPerso"
          label="Missions Persos"
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
      </Groupe>
      <Groupe titre="TUILES">
        <VariantToggle
          cle="freePlace"
          label="Pose Libre"
          on={!options.ruleset.requireAdjacency}
          onChange={(v) => patchRuleset({ requireAdjacency: !v })}
          description="Les tuiles n’ont plus besoin de toucher une tuile déjà posée."
        />
        <VariantToggle
          cle="lastRandom"
          label="Dernière Aléatoire"
          on={!!variants.lastPickRandom}
          onChange={(v) => patchVariants({ lastPickRandom: v })}
          description="Le dernier à choisir peut échanger la tuile restante contre une pioche au hasard — une fois, sans retour."
        />
        <VariantToggle
          cle="randomBack"
          label="Verso Aléatoire"
          on={!!variants.randomBack}
          onChange={(v) => patchVariants({ randomBack: v })}
          description="À son tour, un joueur peut retourner une tuile du centre : sa nouvelle face sort du sac, l’ancienne disparaît — et il doit la poser. On ne revient jamais en arrière (touche V)."
        />
        <VariantToggle
          cle="mono"
          label="Monochromes"
          on={!!variants.monoTiles}
          onChange={(v) => patchVariants({ monoTiles: v })}
          description="+12 tuiles unies dans le sac (2 par couleur)."
        />
        <VariantToggle
          cle="personal"
          label="Personnelle"
          on={!!variants.personalTile}
          onChange={(v) => patchVariants({ personalTile: v })}
          description="Chaque joueur reçoit une tuile sans noir, jouable une seule fois à la place d’une tuile du centre."
        />
        <VariantToggle
          cle="mirror"
          label="Miroir"
          on={!!variants.mirrorTiles}
          onChange={(v) => patchVariants({ mirrorTiles: v })}
          description="Chaque tuile peut se retourner sur sa face miroir (touche F) : couleurs inversées gauche-droite."
        />
        <VariantToggle
          cle="extra"
          label="Supplémentaire"
          on={!!variants.extraTile}
          onChange={(v) => patchVariants({ extraTile: v })}
          description="Une tuile de plus au centre à chaque manche : plus de choix, et la tuile restante est remélangée dans le sac."
        />
        <VariantToggle
          cle="start"
          label="Départ"
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
      </Groupe>
      <Groupe titre="PLATEAUX">
        <VariantToggle
          cle="borders"
          label="Bords Colorés"
          on={!!variants.coloredBorders}
          onChange={(v) =>
            patchVariants({
              coloredBorders: v,
              ...(v ? { multiBorders: false } : {}),
            })
          }
          description="Le bord du plateau est à la couleur du joueur. Un chemin de cette couleur qui touche le bord — une ou plusieurs fois, un ou plusieurs côtés — gagne une case, une seule. Les bords ne relient jamais deux chemins. Exclusif avec Bordures multicolores."
        />
        <VariantToggle
          cle="multiBorders"
          label="Bords Multicolores"
          on={!!variants.multiBorders}
          onChange={(v) =>
            patchVariants({
              multiBorders: v,
              ...(v ? { coloredBorders: false } : {}),
            })
          }
          description="Plateaux au verso sans cadre de couleur, bordés de 8 carrés colorés par côté (coins blancs) : chaque carré touché par un chemin de sa couleur ajoute une case, sans relier les chemins entre eux. Exclusif avec Bordures colorées."
        />
        <VariantToggle
          cle="shared"
          label="Commun"
          on={!!variants.sharedBoard}
          onChange={(v) => patchVariants({ sharedBoard: v })}
          description="Un seul grand plateau paysage pour toute la table, 16 cases par joueur : 8×4 à deux, 8×6 à trois, 8×8 à quatre, puis 10×8 et 12×8. À chaque pose, tching ! : le poseur encaisse immédiatement les points que sa tuile fait gagner (ou perdre) au plateau."
        />
      </Groupe>
      <Groupe titre="SYMBOLES">
        <VariantToggle
          cle="stars"
          label="Étoiles"
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
          cle="clovers"
          label="Trèfles"
          on={!!variants.clovers}
          onChange={(v) => patchVariants({ clovers: v })}
          description="Un quart de tuile sur quatre porte un trèfle : +3 points s’il se trouve dans un chemin qui marque, −3 sinon."
        />
      </Groupe>
      <Groupe titre="SCORE">
        <VariantToggle
          cle="secret"
          label="Couleur Secrète"
          on={!!variants.secretColor}
          onChange={(v) => patchVariants({ secretColor: v })}
          description="Chaque joueur reçoit en secret une tuile monochrome — sa couleur. À la fin, son meilleur chemin de cette couleur est doublé. Cette tuile ne se joue pas."
        />
        <VariantToggle
          cle="forbidden"
          label="Couleur Interdite"
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
          cle="scale"
          label="Barème Perso"
          on={showScale}
          onChange={setShowScale}
          description="Taille du plateau, tuiles par manche, malus des zones noires et points par chemin, à votre main."
        />
        <VariantToggle
          cle="reverse"
          label="Inversé"
          on={!!variants.reverseScoring}
          onChange={(v) => patchVariants({ reverseScoring: v })}
          description="Tout le monde part à 20 points. Les zones noires en rapportent 2, les chemins coûtent ce qu’ils rapportaient. Les autres variantes suivent : ce qui faisait gagner fait perdre, et inversement."
        />
      </Groupe>
      <Groupe titre="NON CONSERVÉES">
        <VariantToggle
          cle="bagCcw"
          label="Sac Antihoraire"
          on={!!variants.bagCounterClockwise}
          onChange={(v) => patchVariants({ bagCounterClockwise: v })}
          description="Le sac revient au dernier servi — le voisin de droite — au lieu de tourner dans le sens horaire : le premier choix ne va plus toujours au même."
        />
        <VariantToggle
          cle="faults"
          label="Failles"
          on={!!variants.faultTiles}
          onChange={(v) => patchVariants({ faultTiles: v })}
          description="Une faille grise coupe 16 tuiles en deux moitiés : elles ne se relient pas entre elles, mais chacune se relie normalement aux tuiles voisines."
        />
        <VariantToggle
          cle="crystals"
          label="Cristaux"
          on={!!variants.crystals}
          onChange={(v) => patchVariants({ crystals: v })}
          description="18 tuiles portent un cristal sur un quart précis (3 par couleur), toujours seul de sa couleur sur sa tuile. Il brille — +4 points — tant qu’aucun quart de la même couleur ne le touche ; dès qu’une voisine vient coller sa couleur contre lui, il se brise et coûte 4 points."
        />
        <VariantToggle
          cle="windmills"
          label="Moulins"
          on={!!variants.windmills}
          onChange={(v) => patchVariants({ windmills: v })}
          description="15 tuiles portent un moulin : à la pose, toutes les tuiles adjacentes déjà posées tournent d’un quart de tour vers la gauche. Les tuiles posées ensuite ne bougent plus."
        />
        <VariantToggle
          cle="dyes"
          label="Teintures"
          on={!!variants.dyes}
          onChange={(v) => patchVariants({ dyes: v })}
          description="18 tuiles portent un pot de couleur (3 par couleur). Posé adjacent à une zone noire, le pot déteint : toute la zone prend sa couleur, définitivement. Le noir arrivé plus tard reste noir."
        />
        <VariantToggle
          cle="sync"
          label="Synchrone"
          on={!!variants.syncDraw}
          onChange={(v) => patchVariants({ syncDraw: v })}
          description="Une seule tuile est révélée par manche, la même pour tout le monde : chacun la pose sur son plateau. Plus de choix au centre, plus d’ordre de pioche — un duel à armes strictement égales."
        />
        <VariantToggle
          cle="rainbow"
          label="Arc-en-Ciel"
          on={!!variants.whiteTiles}
          onChange={(v) => patchVariants({ whiteTiles: v })}
          description="+6 tuiles arc-en-ciel : un seul grand carré irisé qui prolonge et relie les chemins de toutes les couleurs voisines."
        />
        <VariantToggle
          cle="swap"
          label="Échange"
          on={!!variants.boardSwap}
          onChange={(v) => patchVariants({ boardSwap: v })}
          description="Deux cartes face cachée dès le début : à la moitié de la partie on en retourne une. « Rotation ! » fait passer chaque plateau au voisin de gauche, « Pas de rotation ! » oblige à garder le sien."
        />
      </Groupe>

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
    </Visibilite.Provider>
  );
}

/**
 * Une famille de variantes : son titre et sa rangée. Si tout ce qu'elle
 * contient est masqué, elle disparaît, séparateur compris.
 */
function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  const visible = useContext(Visibilite);
  const groupe = CATALOGUE.find((g) => g.titre === titre);
  if (groupe && !groupe.variantes.some((v) => visible(v.cle))) return null;
  return (
    <>
      <h4 className="variant-group">{titre}</h4>
      <div className="row wrap">{children}</div>
    </>
  );
}

export function Toggle({
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
  cle,
  label,
  on,
  onChange,
  description,
  children,
}: {
  /** Clé du catalogue : c'est par elle que les Réglages la masquent. */
  cle: string;
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  description: string;
  /** Réglages propres à la variante, dépliés juste sous le bouton. */
  children?: React.ReactNode;
}) {
  const visible = useContext(Visibilite);
  if (!visible(cle)) return null;
  return (
    <div className={`variant ${on ? "on" : ""}`}>
      <Toggle label={label} on={on} onChange={onChange} />
      {on && <p className="variant-desc">{description}</p>}
      {on && children}
    </div>
  );
}
