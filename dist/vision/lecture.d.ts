/**
 * Lecture d'un plateau photographié.
 *
 * Rien ici ne touche au navigateur : on reçoit des pixels bruts et on rend des
 * tuiles. C'est ce qui permet de mesurer la chaîne entière hors de l'écran,
 * sur des images fabriquées exprès.
 *
 * La chaîne, dans l'ordre :
 *   1. une homographie redresse la photo à partir des quatre coins du plateau ;
 *   2. chaque quart est échantillonné en son centre (médiane d'un petit carré,
 *      pour ignorer les interstices de la grille et les poussières) ;
 *   3. les 4N² mesures sont recalées globalement sur la palette connue —
 *      c'est cette étape qui absorbe la dominante d'une lampe jaune ;
 *   4. chaque carré de quatre quarts est comparé aux 388 motifs réellement
 *      imprimés (97 tuiles × 4 rotations) ;
 *   5. une passe globale impose que les tuiles soient toutes différentes.
 *
 * Une précision honnête sur l'étape 4 : le catalogue n'est PAS un code
 * correcteur. Sur les 340 motifs distincts, 332 ont un sosie à un seul quart
 * près. La reconnaissance ne rattrape donc presque rien — la précision vient
 * de l'optique et du recalage couleur, pas d'ici. D'où la marge de confiance
 * rendue avec chaque case : c'est elle qui dit à l'écran quoi faire vérifier.
 */
import type { Color, Rotation } from '../engine/index.js';
export type Lab = readonly [number, number, number];
export interface Point {
    x: number;
    y: number;
}
/** Les huit couleurs imprimables d'un quart. */
export declare const PALETTE: Color[];
/** sRGB (0-255) vers CIE Lab, illuminant D65. */
export declare function rgbVersLab(r: number, g: number, b: number): Lab;
/** La palette du jeu, en Lab. Sa paire la plus proche est à ΔE 41,7. */
export declare const LAB_PALETTE: Record<Color, Lab>;
/** Distance perceptuelle (CIE76) : en dessous de ~20, deux couleurs se confondent. */
export declare function deltaE(a: Lab, b: Lab): number;
/** Couleur de la palette la plus proche, et sa distance. */
export declare function plusProche(l: Lab): {
    couleur: Color;
    distance: number;
};
/** Les quatre coins du carré unité, dans l'ordre horaire depuis le haut-gauche. */
export declare const CARRE_UNITE: Point[];
/**
 * Transformation projective qui envoie quatre points sur quatre autres.
 * Rend les huit coefficients [a…h] de
 *   x' = (a·x + b·y + c) / (g·x + h·y + 1)
 *   y' = (d·x + e·y + f) / (g·x + h·y + 1)
 * ou `null` si les quatre points sont alignés (système dégénéré).
 */
export declare function homographie4(source: readonly Point[], cible: readonly Point[]): number[] | null;
/** L'homographie qui envoie le carré unité sur les quatre coins donnés. */
export declare function homographie(coins: readonly Point[]): number[] | null;
/** Applique une homographie à un point. */
export declare function projeter(h: readonly number[], x: number, y: number): Point;
/**
 * Le plateau n'est pas un damier plein : de grosses barres noires séparent les
 * emplacements, et un liseré noir en fait le tour. Rapport relevé sur le
 * plateau imprimé — barre ≈ 40, emplacement ≈ 230.
 *
 * En tenir compte n'est pas un détail : sans lui, les mesures des tuiles de
 * bord glissent d'un huitième de tuile vers l'extérieur.
 */
export declare const JEU_PLATEAU = 0.174;
/**
 * Géométrie d'un axe du plateau, en coordonnées du repère (0 à 1). Le repère
 * va d'un coin EXTÉRIEUR de la grille noire à l'autre : c'est le point de
 * reconnaissance le plus net du plateau, là où le noir rencontre le cadre.
 * Il y a donc `taille` emplacements et `taille + 1` barres.
 */
export declare function geometrie(taille: number, jeu?: number): {
    quarts: number[];
    barres: number[];
    largeurQuart: number;
};
/**
 * Mesure la couleur de chaque quart. Les coins sont donnés en pixels de
 * l'image, dans l'ordre horaire depuis le coin extérieur haut-gauche de la
 * grille noire — le cadre coloré du plateau reste dehors.
 *
 * Rend (2·taille)² couleurs, rangées ligne par ligne dans la grille de quarts.
 */
export declare function echantillonner(pixels: Uint8ClampedArray, largeur: number, hauteur: number, coins: readonly Point[], taille: number, 
/** Points de mesure par quart et par axe. La détection en prend moins. */
grain?: number, jeu?: number): Lab[] | null;
/**
 * Recale les mesures sur la palette connue. Une dominante de couleur est
 * SYSTÉMATIQUE — une lampe chaude décale tout dans le même sens — donc elle
 * s'enlève. Le bruit aléatoire, lui, ne s'enlève pas : c'est là que la lecture
 * se joue.
 *
 * On alterne « à quelle couleur ressemble chaque mesure » et « quel gain
 * rapproche le plus les mesures de ces couleurs », en jetant à chaque tour les
 * 15 % de mesures les plus rétives (reflets, ombres portées).
 */
export declare function recaler(labs: readonly Lab[]): {
    labs: Lab[];
    residu: number;
    applique: boolean;
};
/**
 * Ce que vaudrait une lecture avec ce repère, SANS reconnaître les tuiles.
 * C'est le juge de la détection automatique, et il est bon marché — pas de
 * comparaison aux 388 motifs.
 *
 * Deux termes, et le second est le plus important :
 *
 *  - l'écart moyen à la palette une fois les couleurs recalées. Il dit si les
 *    mesures ressemblent à des couleurs du jeu ;
 *  - la SATURATION SUR LES SÉPARATEURS. Le premier terme, seul, ne sait pas
 *    reconnaître une grille décalée d'une demi-tuile : les mesures tombent
 *    alors dans des quarts voisins, et elles sont tout aussi propres. Ce qui
 *    trahit le décalage, c'est que les frontières entre tuiles ne tombent plus
 *    sur la grille grise du plateau mais en plein dans les couleurs. On compare
 *    donc la saturation relevée sur les frontières à celle des quarts : proche
 *    de zéro quand le repère est juste, proche de un quand il a glissé.
 *
 * Le rapport rend le critère insensible à la lumière : une dominante gonfle les
 * deux saturations de la même façon.
 */
export declare function qualiteDuRepere(pixels: Uint8ClampedArray, largeur: number, hauteur: number, coins: readonly Point[], taille: number, grain?: number): number;
export interface Candidat {
    tileId: number;
    rot: Rotation;
    /** Somme des quatre distances de couleur : plus c'est bas, mieux ça colle. */
    cout: number;
}
export interface CaseLue {
    /** Emplacement resté vide sur le plateau (les quatre quarts sont blancs). */
    vide: boolean;
    tileId: number;
    rot: Rotation;
    /**
     * Somme des quatre écarts de couleur de la tuile retenue. C'est LE signal de
     * confiance : mesuré sur 4 000 cases, signaler les cases au-dessus de 60
     * revient à en montrer 11 % et à attraper 92 % des erreurs.
     */
    cout: number;
    /**
     * Écart au meilleur concurrent d'une AUTRE tuile. Utile à afficher, mais
     * mauvais détecteur d'erreur : il mesure surtout le nombre de sosies de la
     * tuile dans le catalogue, pas la qualité de la photo.
     */
    marge: number;
    /** Les meilleurs candidats, du plus probable au moins probable. */
    candidats: Candidat[];
    /** Les quatre couleurs lues, telles quelles. */
    lues: Color[];
}
/**
 * Retrouve les tuiles à partir des couleurs lues. `taille` est le côté du
 * plateau en tuiles ; `labs` en contient (2·taille)².
 */
export declare function reconnaitre(labs: readonly Lab[], taille: number): CaseLue[];
export interface Lecture {
    cases: CaseLue[];
    /** Écart moyen à la palette après recalage : la qualité de la photo, en ΔE. */
    residu: number;
    recale: boolean;
}
/**
 * Au-dessus de ce coût — soit 15 ΔE d'écart moyen par quart — la case mérite
 * un coup d'œil. Seuil calibré sur 4 000 cases photographiées dans cinq
 * conditions de lumière : 11 % des cases signalées, 92 % des erreurs dedans.
 */
export declare const COUT_DOUTEUX = 60;
/** Cette case demande-t-elle une vérification à l'œil ? */
export declare function douteuse(c: CaseLue): boolean;
/** La chaîne complète, des pixels aux tuiles. */
export declare function lire(pixels: Uint8ClampedArray, largeur: number, hauteur: number, coins: readonly Point[], taille: number): Lecture | null;
