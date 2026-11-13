import type { Board, Color, Rotation, Ruleset } from './types.js';
export declare function createBoard(size: number): Board;
/**
 * Plateau rectangulaire (variante Plateau commun) : `size` reste la LARGEUR —
 * c'est le pas d'indexation — et la hauteur se déduit du nombre de cases.
 */
export declare function createBoardRect(width: number, height: number): Board;
/** Hauteur d'un plateau en tuiles (= sa largeur, sauf plateau commun). */
export declare function boardRows(board: Board): number;
export declare function cloneBoard(board: Board): Board;
export declare function idx(size: number, row: number, col: number): number;
export declare function rowOf(size: number, i: number): number;
export declare function colOf(size: number, i: number): number;
export declare function isEmpty(board: Board): boolean;
export declare function isFull(board: Board): boolean;
export declare function placedCount(board: Board): number;
/**
 * Voisins orthogonaux d'une case du plateau. `size` est la largeur ;
 * `cellCount` permet les plateaux rectangulaires (hauteur = cases / largeur).
 */
export declare function neighbours(size: number, i: number, cellCount?: number): number[];
/**
 * Cases où l'on peut poser une tuile : vides et adjacentes à une tuile déjà
 * en place (toutes les cases si le plateau est vide).
 */
export declare function legalCells(board: Board, requireAdjacency?: boolean): number[];
export declare function placeTile(board: Board, cell: number, tileId: number, rot: Rotation, round: number, flipped?: boolean, 
/** Joueur qui pose — renseigné en Plateau commun, pour l'attribution. */
by?: number): Board;
/**
 * Effets qui changent la lecture du plateau (variantes). Ils sont appliqués au
 * moment de construire la grille des quarts : tout ce qui lit la grille —
 * zones, score, IA, affichage — les voit donc sans code particulier.
 */
export interface GridEffects {
    /** Moulins : les tuiles voisines d'un moulin posé après elles ont tourné. */
    windmills?: boolean;
    /** Teintures : les zones noires touchées par un pot ont pris sa couleur. */
    dyes?: boolean;
    /** Failles : une faille bloque les liens internes d'une tuile. */
    faults?: boolean;
}
/** Effets de grille induits par les variantes d'un barème. */
export declare function gridEffects(ruleset: Ruleset): GridEffects | undefined;
/**
 * Rotation effective d'une tuile : celle de sa pose, plus un quart de tour à
 * gauche par moulin voisin posé APRÈS elle (variante Moulins). Les tuiles
 * posées après un moulin ne sont pas affectées — l'effet n'a lieu qu'à la pose.
 */
export declare function effectiveRot(board: Board, cell: number, windmills?: boolean): Rotation;
/**
 * Variante Failles : la faille coupe une tuile en deux moitiés qui ne se
 * relient pas entre elles. Seules les arêtes INTERNES à une tuile peuvent être
 * bloquées — la frontière entre deux tuiles n'est jamais concernée.
 */
export declare function faultBlocks(board: Board, a: number, b: number, windmills?: boolean): boolean;
/**
 * Grille des quarts de tuile : 2N x 2N. C'est sur cette grille que sont
 * calculées les zones de couleur. `null` = quart non posé.
 */
export type QuadGrid = {
    size: number;
    cells: (Color | null)[];
};
export declare function quadGrid(board: Board, fx?: GridEffects): QuadGrid;
/** Les quatre quarts d'une case du plateau, en indices de la grille 2N x 2N. */
export declare function quadIndicesOf(boardSize: number, cell: number): [number, number, number, number];
/** Case du plateau (tuile) à laquelle appartient un quart. */
export declare function tileOfQuad(boardSize: number, qi: number): number;
