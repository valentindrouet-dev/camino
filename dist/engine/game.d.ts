import type { Board, BoardColor, BorderSpec, GameOptions, GameState, Player, PlayerKind, PoolTile, Rotation, Ruleset } from './types.js';
/** Couleurs exactes des six plateaux de la boîte. */
export declare const BOARD_COLOR_HEX: Record<BoardColor, string>;
export declare const BOARD_COLOR_NAMES: Record<BoardColor, string>;
/** Ordre d'attribution par défaut des plateaux. */
export declare const DEFAULT_BOARD_ORDER: BoardColor[];
export interface PlayerConfig {
    name: string;
    kind: PlayerKind;
    boardColor: BoardColor;
}
/** Première couleur de plateau encore libre. */
export declare function freeBoardColor(taken: BoardColor[]): BoardColor;
export interface GameConfig {
    players: PlayerConfig[];
    options: GameOptions;
}
export declare function defaultPlayers(count: number): PlayerConfig[];
export declare function defaultOptions(seed: string): GameOptions;
/**
 * Options débarrassées de tout ce qui relève des variantes : les variantes
 * elles-mêmes, les cartes missions, la pose libre et le barème perso — ces
 * trois derniers vivant dans le même panneau. Ce qui relève de l'affichage
 * et du confort (score visible, indices, dernière tuile, 1er joueur
 * aléatoire, graine) est conservé tel quel.
 */
export declare function clearVariants(options: GameOptions): GameOptions;
/** Nombre de tuiles révélées au centre à chaque tour. */
export declare function tilesPerRound(ruleset: Ruleset, playerCount: number): number;
/**
 * Dimensions du plateau partagé (variante Plateau commun) : 16 cases par
 * joueur, disposées en PAYSAGE — le plateau ne dépasse jamais 8 tuiles de
 * haut et s'allonge vers la droite. 8×4 à deux, 8×6 à trois, 8×8 à quatre,
 * puis 10×8 et 12×8. Chaque joueur apporte exactement ses 16 tuiles et le
 * plateau finit plein.
 */
export declare function sharedBoardDims(playerCount: number): {
    w: number;
    h: number;
};
/**
 * Nombre de manches d'une partie : une par case du plateau, moins la tuile de
 * départ déjà posée (variante). En Plateau commun, chaque manche remplit une
 * case PAR JOUEUR : on joue tant qu'il reste une case pour chacun.
 */
export declare function roundsFor(ruleset: Ruleset, playerCount?: number): number;
/** Manche où les cartes Rotation sont retournées (variante Échange de plateaux). */
export declare function swapRound(ruleset: Ruleset): number;
/** Nombre de tuiles nécessaires pour aller au bout de la partie. */
export declare function tilesNeeded(ruleset: Ruleset, playerCount: number): number;
/** Taille du sac selon les variantes actives. */
export declare function bagSize(ruleset: Ruleset): number;
export declare function configError(config: GameConfig): string | null;
/**
 * Bordure multicolore d'un plateau : 8 carrés par côté, coins blancs, jamais
 * deux carrés identiques adjacents. Fixe par couleur de plateau — ce sont des
 * plateaux imprimés, identiques d'une partie à l'autre.
 */
export declare function multiBorderFor(boardColor: BoardColor, size?: number): BorderSpec;
/**
 * Bordure à quatre couleurs : un côté, une couleur.
 *
 * Les six plateaux de la boîte se partagent les six couleurs à parts strictement
 * égales — chaque couleur apparaît sur quatre côtés au total, jamais deux fois
 * sur le même plateau. Un plateau ne porte JAMAIS sa propre couleur : c'est ce
 * qui donne son intérêt à la variante, personne ne peut s'appuyer sur la
 * couleur qu'il a déjà sous la main.
 *
 * La règle tient en une phrase : les quatre couleurs qui suivent la vôtre dans
 * l'ordre Jaune, Orange, Rouge, Vert, Bleu, Violet.
 */
export declare function quadBorderFor(boardColor: BoardColor): BorderSpec;
/** Bordure du plateau d'un joueur selon les variantes actives. */
export declare function bordersFor(ruleset: Ruleset, boardColor: BoardColor): BorderSpec | undefined;
export declare function createGame(config: GameConfig): GameState;
export declare function currentPlayerId(state: GameState): number;
export declare function currentPlayer(state: GameState): Player;
export declare function availableTiles(state: GameState): PoolTile[];
/** Cases jouables par le joueur courant. */
export declare function currentLegalCells(state: GameState): number[];
export interface Move {
    tileId: number;
    cell: number;
    rot: Rotation;
    /** Face miroir (variante Tuiles miroir). */
    flipped?: boolean;
    /** Tuile jouée depuis la réserve personnelle plutôt que du centre. */
    personal?: boolean;
}
export declare function isLegalMove(state: GameState, move: Move): boolean;
/**
 * Variante « Dernier choix aléatoire » : le dernier joueur du tour peut
 * échanger la tuile restante contre une pioche au hasard — une seule fois,
 * sans retour possible.
 */
export declare function canRedrawLastTile(state: GameState): boolean;
export declare function redrawLastTile(state: GameState): GameState;
/**
 * Variante Verso aléatoire : à son tour, un joueur peut retourner une tuile du
 * centre encore libre. Sa nouvelle face est tirée du sac — l'ancienne
 * disparaît, c'est la même tuile physique — et il doit la prendre : on ne
 * revient jamais en arrière. Une tuile ne se retourne qu'une fois.
 */
export declare function canFlipTile(state: GameState, tileId: number): boolean;
export declare function flipTile(state: GameState, tileId: number): GameState;
/**
 * Applique un coup : le joueur courant prend une tuile du centre et la pose.
 * Retourne un NOUVEL état (les états sont immuables : l'annulation côté UI se
 * contente d'empiler les états successifs, et un serveur peut rejouer la
 * partie à partir de la graine + la liste des coups).
 */
/**
 * Score total d'un joueur — zones ET missions — si son plateau était celui-ci.
 *
 * C'est le seul chiffre qui dise ce qu'un coup rapporte VRAIMENT. Le score des
 * zones se lit sur le plateau ; une mission, elle, se gagne ou se perd d'un
 * coup, et pèse souvent plus lourd que la tuile qu'on vient de poser.
 *
 * Les missions comparatives — le plus long chemin violet de la table — se
 * jugent sur tous les plateaux à la fois : on reconstruit donc la table, pas
 * seulement le joueur.
 */
export declare function totalAvecMissions(state: GameState, playerId: number, board: Board): number;
export declare function applyMove(state: GameState, move: Move): GameState;
export declare function isBot(player: Player): boolean;
