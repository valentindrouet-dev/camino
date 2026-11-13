import type { Color, Quads, Rotation, Tile } from './types.js';
/** Les douze tuiles de la boîte que la variante remplace. */
export declare const DOUBLED_TILE_IDS: number[];
export declare const TILES: Tile[];
/** Nombre de tuiles de la boîte de base (hors variantes). */
export declare const TILE_COUNT: number;
export declare const MONO_TILE_IDS: number[];
export declare const WHITE_TILE_IDS: number[];
/** Tuile monochrome de chaque couleur (départ, couleur secrète). Hors sac. */
export declare const COLOR_TILE_IDS: Record<string, number>;
/** Les six tuiles de départ multicolores. Hors sac elles aussi. */
export declare const MULTI_START_TILE_IDS: number[];
/** Les douze tuiles de la variante Couleurs équilibrées. */
export declare const BALANCED_TILE_IDS: number[];
/** Quarts d'une tuile après rotation horaire de `rot` x 90°. */
export declare function rotatedQuads(quads: Quads, rot: Rotation): Quads;
/** Face miroir : inversion gauche-droite (HG↔HD, BG↔BD). */
export declare function mirroredQuads(quads: Quads): Quads;
export declare function tileQuads(tileId: number, rot: Rotation, flipped?: boolean): Quads;
export interface Orientation {
    rot: Rotation;
    flipped: boolean;
}
/** Orientations réellement distinctes, faces miroir comprises si permises. */
export declare function distinctOrientations(tileId: number, allowFlip: boolean): Orientation[];
/** Orientations réellement distinctes (une tuile unie n'en a qu'une). */
export declare function distinctRotations(tileId: number): Rotation[];
/** Répartition des couleurs dans une tuile (utile pour les stats). */
export declare function tileColorCount(tileId: number): Partial<Record<Color, number>>;
/** quart étoilé (0..3, avant rotation) par id de tuile. */
export declare const STARS: ReadonlyMap<number, number>;
/** Position du quart étoilé après orientation (0..3 dans la tuile posée). */
export declare function starQuadIndex(tileId: number, rot: Rotation, flipped?: boolean): number | null;
/** Axe de la faille : 0 = verticale (sépare gauche/droite), 1 = horizontale. */
export declare const FAULTS: ReadonlyMap<number, 0 | 1>;
/**
 * Axe de la faille après orientation. Une rotation d'un quart de tour bascule
 * la verticale en horizontale ; le miroir (gauche-droite) ne change rien.
 */
export declare function faultAxis(tileId: number, rot: Rotation, _flipped?: boolean): 0 | 1 | null;
/** quart trèflé (0..3, avant rotation) par id de tuile. */
export declare const CLOVERS: ReadonlyMap<number, number>;
/** Position du quart trèflé après orientation (0..3 dans la tuile posée). */
export declare function cloverQuadIndex(tileId: number, rot: Rotation, flipped?: boolean): number | null;
/** quart cristallisé (0..3, avant rotation) par id de tuile. */
export declare const CRYSTALS: ReadonlyMap<number, number>;
/** Quart cristallisé après orientation (0..3 dans la tuile posée). */
export declare function crystalQuadIndex(tileId: number, rot: Rotation, flipped?: boolean): number | null;
export interface Dye {
    /** Quart qui porte le pot (0..3, avant rotation). */
    quad: number;
    /** Couleur du pigment — jamais celle du quart qui le porte. */
    color: Color;
}
export declare const DYES: ReadonlyMap<number, Dye>;
/** Teinture d'une tuile après orientation (quart 0..3 dans la tuile posée). */
export declare function dyeAt(tileId: number, rot: Rotation, flipped?: boolean): Dye | null;
export declare const WINDMILLS: ReadonlySet<number>;
