import type { GridEffects } from './board.js';
import type { Board, Color, Ruleset, ScoreBreakdown, StarScoring, Zone } from './types.js';
import { BLACK, PATH_COLORS } from './types.js';
/**
 * Règle de comptage (validée sur l'exemple de fin de règle) :
 *
 *  - une « zone » est un groupe de quarts de MÊME COULEUR connectés
 *    orthogonalement, y compris à travers la frontière entre deux tuiles ;
 *  - ce qui rapporte des points, c'est le nombre de TUILES DISTINCTES que la
 *    zone traverse (et non son nombre de quarts) : 3 tuiles = 3 pts, 4 = 5,
 *    5 = 8, 6 = 12, 7 = 17, 8 = 23, 9 et + = 30 ;
 *  - chaque zone noire, quelle que soit sa taille, enlève 2 points.
 */
/**
 * Scoring inversé (variante) : le signe de TOUT ce qui compte. Les points de
 * départ compensent le fait que les chemins ne rapportent plus rien.
 */
export declare const REVERSED_BASE = 20;
/** −1 quand le scoring est inversé, +1 sinon. */
export declare function scoreSign(ruleset: Ruleset): -1 | 1;
export declare function pointsForSpan(span: number, ruleset: Ruleset): number;
/**
 * Points d'un groupe d'étoiles, selon le barème choisi :
 *
 *  - `linked` (par défaut) : une étoile seule vaut 1 point, chaque étoile
 *    reliée à au moins une autre en vaut 2 — un groupe de N ≥ 2 vaut 2×N ;
 *  - `growing` : dans un groupe de N, chaque étoile vaut N — le groupe vaut
 *    donc N², et les grandes constellations s'envolent.
 */
export declare function starClusterPoints(count: number, mode?: StarScoring): number;
/**
 * Cases de bordure adjacentes à un quart donné, avec leur couleur. Exporté :
 * la carte « Bord assorti » a besoin de savoir de quelle couleur est le bord
 * qu'une tuile touche.
 */
export declare function borderNeighbours(board: Board, qi: number): {
    id: number;
    color: Color;
}[];
/**
 * Toutes les zones du plateau (couleurs + noir), avec leur valeur.
 *
 * Variantes prises en compte :
 *  - tuiles arc-en-ciel : le quart irisé appartient aux chemins de TOUTES les
 *    couleurs qui le touchent (il peut relier deux chemins d'une même
 *    couleur) ; il ne rejoint jamais le noir ;
 *  - bordures : une case de bordure reliée à un chemin de sa couleur compte
 *    comme une case de plus, mais ne relie JAMAIS deux chemins entre eux ;
 *  - étoiles magiques : comptées par zone (voir scoreBoard) ;
 *  - couleurs interdites : elles se comportent comme le noir, chaque zone
 *    coûte le malus quelle que soit sa taille — les réunir reste payant.
 */
export declare function computeZones(board: Board, ruleset: Ruleset, 
/** Couleurs interdites du joueur (variante) : leurs zones coûtent le malus. */
forbidden?: Color[]): Zone[];
/** Groupe d'étoiles adjacentes sur un plateau. */
export interface StarCluster {
    /** Index des quarts étoilés (grille 2N x 2N). */
    cells: number[];
    count: number;
    points: number;
}
/**
 * Les étoiles se groupent par simple ADJACENCE de leurs quarts (orthogonale,
 * frontières de tuiles comprises) — pas besoin d'être reliées par un chemin.
 */
export declare function starClusters(board: Board, mode?: StarScoring, 
/** Variante Moulins : les étoiles tournent avec leur tuile. */
windmills?: boolean): StarCluster[];
/** Le cristal de cette case brille-t-il ? (pour l'affichage du plateau) */
export declare function crystalIntact(board: Board, cell: number, fx?: GridEffects): boolean;
export declare function scoreBoard(board: Board, ruleset: Ruleset, 
/** Variantes propres au joueur : couleur secrète, couleurs interdites. */
who?: PlayerScoring): ScoreBreakdown;
/**
 * Trèfles (variante) : un trèfle posé dans un chemin qui marque rapporte +3,
 * sinon il coûte 3 points. Un trèfle sur un quart blanc profite de n'importe
 * quel chemin qui marque et le traverse.
 */
export declare function countClovers(board: Board, zones: Zone[], 
/** Variante Moulins : les trèfles tournent avec leur tuile. */
windmills?: boolean, 
/** Plateau commun : seuls les trèfles des tuiles de ce joueur comptent. */
ownTiles?: Set<number> | null): number;
/**
 * Ce qu'un joueur apporte au décompte de son propre plateau : les variantes
 * qui dépendent de lui et non du plateau seul.
 */
export interface PlayerScoring {
    /** Identité du joueur (renseignée quand on passe le joueur entier). */
    id?: number;
    /**
     * Plateau commun : points engrangés au fil des poses. Si présent, le total
     * du décompte est cette cagnotte — le plateau, lui, reste décrit en entier.
     */
    banked?: number;
    /** Son meilleur chemin de cette couleur est doublé (variante). */
    secretColor?: Color;
    /** Les points de ses chemins de ces couleurs lui sont infligés en négatif. */
    forbiddenColors?: Color[];
}
/** Couleur secrète (variante) : le meilleur chemin de cette couleur est doublé. */
export declare function secretBonus(zones: Zone[], color: Color | undefined): number;
/** Score total uniquement — chemin rapide utilisé par l'IA et les simulations. */
export declare function scoreOf(board: Board, ruleset: Ruleset, who?: PlayerScoring): number;
/** Zone (index dans le tableau) à laquelle appartient chaque quart, ou -1. */
export declare function zoneMap(zones: Zone[], quadCount: number): Int16Array;
/** Libellé lisible d'une zone, pour les infobulles. */
/** Nombre signé, pour ne jamais laisser planer de doute sur un bonus. */
export declare function signed(n: number): string;
export declare function zoneLabel(zone: Zone, ruleset: Ruleset): string;
export declare const COLOR_NAMES: Record<Color, string>;
export declare const COLOR_HEX: Record<Color, string>;
export { PATH_COLORS, BLACK };
