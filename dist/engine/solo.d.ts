/**
 * Mode solo : trois objectifs à atteindre, bronze, argent et or.
 *
 * Il n'y a pas d'adversaire — ce qu'on affronte, c'est un barème. Reste à
 * savoir où le poser, et ça ne se devine pas : une partie avec Arc-en-Ciel et
 * Cristaux marque vingt-cinq points de plus qu'une partie nue, une partie avec
 * Couleur interdite neuf de moins. Un barème fixe serait donné dans un cas et
 * hors de portée dans l'autre.
 *
 * D'où la construction : un socle mesuré sur la partie nue, et un écart mesuré
 * par variante et par carte, qu'on additionne. Tout ce qui suit vient de
 * parties réellement jouées par le bot Expert en solo — jamais d'une intuition.
 *
 * L'approximation assumée : on suppose que chaque variante décale la
 * distribution sans en changer la forme, et que deux variantes ajoutent leurs
 * écarts. C'est faux dans le détail — deux variantes qui poussent la même
 * chose se recouvrent en partie — d'où le tassement appliqué à la fin.
 */
import type { GameOptions } from './types.js';
export interface ObjectifsSolo {
    bronze: number;
    argent: number;
    or: number;
}
/** Les trois objectifs d'une partie solo, selon ce qui est coché. */
export declare function objectifsSolo(options: GameOptions): ObjectifsSolo;
export type Medaille = 'or' | 'argent' | 'bronze' | null;
/** Médaille obtenue avec ce score. */
export declare function medaille(score: number, o: ObjectifsSolo): Medaille;
export declare const NOM_MEDAILLE: Record<Exclude<Medaille, null>, string>;
/** Toutes les cartes dont l'écart solo est connu (pour les tests). */
export declare function cartesMesurees(): number;
