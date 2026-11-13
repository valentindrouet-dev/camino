/**
 * Trouver le plateau tout seul dans une photo.
 *
 * On ne cherche pas un contour : le cadre coloré du plateau ressemble à une
 * tuile, et rien ne garantit un bord franc côté table. Ce qu'on suit, c'est la
 * GRILLE NOIRE — des barres épaisses (un sixième d'emplacement) qui reviennent
 * à intervalle régulier et font le tour du damier. C'est le motif le plus
 * reconnaissable du plateau, et le seul qui donne la PHASE : le critère de
 * lecture, lui, ne sait pas distinguer une grille juste d'une grille décalée
 * d'une demi-tuile, puisque les deux mesurent des couleurs tout aussi propres.
 *
 * Trois temps :
 *   1. un masque de saturation dit grossièrement où est le plateau, cadre
 *      compris ;
 *   2. dans cette boîte, on cale le profil de saturation sur la géométrie
 *      exacte du plateau — creux sur les barres, bosses sur les emplacements —
 *      en x puis en y. Ça donne la position ET l'échelle du damier, cadre
 *      exclu, parce que le cadre n'a aucune structure périodique ;
 *   3. on affine les quatre coins avec le vrai critère de lecture, ce qui
 *      rattrape la perspective.
 *
 * Le calage suppose un plateau à peu près de face. Une photo très inclinée
 * donnera un départ approximatif que l'affinage devra rattraper — et si le
 * résultat reste mauvais, l'écran le dit et laisse poser les coins à la main.
 */
import type { Point } from './lecture.js';
export interface Detection {
    coins: Point[];
    /** Le critère obtenu : c'est la confiance de la détection. */
    qualite: number;
}
/**
 * Au-delà, on ne prétend pas avoir trouvé le plateau : mieux vaut demander à
 * l'utilisateur de poser les coins que lui montrer un cadrage faux.
 */
export declare const QUALITE_MINIMALE = 22;
/**
 * Cale des coins posés à la main sur la grille du plateau. C'est la descente
 * locale seule, sans recherche globale : partie d'un cadrage à peu près juste,
 * elle converge très bien — c'est la recherche du point de départ qui est
 * difficile, pas l'ajustement.
 */
export declare function calerCoins(pixels: Uint8ClampedArray, largeur: number, hauteur: number, coins: readonly Point[], taille: number): Detection;
/**
 * Cherche le plateau dans la photo et rend les quatre coins extérieurs de sa
 * grille noire. `null` si rien ne ressemble à un plateau — l'écran laisse
 * alors poser les coins à la main.
 */
export declare function detecterPlateau(pixels: Uint8ClampedArray, largeur: number, hauteur: number, taille: number): Detection | null;
