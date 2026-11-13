import type { MissionCard } from './cards.js';
import type { Board, BoardColor, Color, GameState, Player, Ruleset, ScoreBreakdown } from './types.js';
export * from './types.js';
export * from './tiles.js';
export * from './board.js';
export * from './scoring.js';
export * from './game.js';
export * from './ai.js';
export * from './stats.js';
export * from './solo.js';
export * from './cards.js';
export * from './rng.js';
export * from './view.js';
/**
 * Décompte complet d'un joueur : zones + carte mission de la table.
 * La carte a besoin des plateaux des autres joueurs (carte « plus grand
 * chemin violet »), d'où le passage de l'état complet.
 */
export declare function scorePlayer(player: Player, state: GameState): ScoreBreakdown;
/** Une mission choisie à la main, avec ce qu'elle demande de préciser. */
export interface MissionChoisie {
    cardId: string;
    /** Couleur visée, pour les cartes qui en dépendent. */
    color?: Color;
    /** Axe visé (colonne ou ligne), pour les cartes qui en dépendent. */
    axis?: 'col' | 'row';
    /** Seuil retenu, pour les cartes qui en demandent un. */
    seuil?: number;
}
export interface DecompteLibre {
    bilan: ScoreBreakdown;
    /** Barème réellement appliqué : une carte peut le retourner. */
    ruleset: Ruleset;
    /** Couleurs traitées comme du noir (« Couleur bannie »), pour l'affichage. */
    forbidden: Color[];
    /** Une entrée par mission, dans l'ordre choisi. */
    missions: {
        card: MissionCard;
        points: number;
        detail: string;
        structural?: boolean;
        color?: Color;
        axis?: 'col' | 'row';
        seuil?: number;
    }[];
}
/**
 * Décompte d'un plateau SEUL, missions comprises — c'est ce dont le scanner a
 * besoin : il n'y a pas de partie, pas de joueurs, juste un plateau lu sur une
 * photo et les cartes que la table avait devant elle.
 *
 * Trois cartes ne s'ajoutent pas au total : elles changent la façon de compter,
 * et leur effet doit donc entrer AVANT le décompte des zones — « Noir positif »
 * retourne le barème, « Couleur secrète » double un chemin, « Couleur bannie »
 * traite une couleur comme du noir. C'est pour cela qu'on ne peut pas se
 * contenter d'additionner des points de carte au score du plateau.
 *
 * Deux cartes se jugent en comparant les plateaux de la table (« le plus grand
 * chemin », « le moins de zones noires »). Sur un plateau isolé, elles sont
 * donc toujours accomplies : c'est exact, mais ça n'a de sens qu'en solo.
 * `missionComparative()` permet de le dire à qui lit le résultat.
 */
export declare function scoreLibre(board: Board, missions: MissionChoisie[], 
/** Couleur du cadre imprimé : « Bord assorti » en a besoin. */
boardColor?: BoardColor, base?: Ruleset): DecompteLibre;
/**
 * Cette mission se juge-t-elle en comparant les plateaux de la table ? Sur un
 * plateau isolé, elle est toujours accomplie — il faut le dire.
 */
export declare function missionComparative(cardId: string): boolean;
/**
 * Cette mission a-t-elle besoin de savoir de quelle couleur est le cadre du
 * plateau ? Sans elle, « Bord assorti » ne rapporte jamais rien — mesuré : de
 * 0 à 12 points selon la couleur, 0 quand on ne la donne pas.
 */
export declare function missionDemandeBord(cardId: string): boolean;
/**
 * Cette mission demande-t-elle de préciser une couleur ? Soit qu'elle soit
 * tirée en début de partie (`colorized`), soit qu'elle soit propre au joueur
 * (« Couleur secrète »).
 */
export declare function missionDemandeCouleur(card: MissionCard): boolean;
/** Les cartes qu'on peut juger sur une simple photo de plateau. */
export declare function missionsScannables(): MissionCard[];
/** Décompte de tous les joueurs. */
export declare function scoreAll(state: GameState): ScoreBreakdown[];
/** Résultat détaillé de chaque carte mission d'un joueur (pour l'affichage). */
export declare function cardResults(state: GameState, playerId: number): {
    card: MissionCard;
    points: number;
    detail: string;
    structural?: boolean;
    /** Couleur tirée pour cette carte, si elle en dépend. */
    color?: Color;
    /** Axe tiré pour cette carte, si elle en dépend. */
    axis?: 'col' | 'row';
    /** Seuil retenu pour cette carte, si elle en demande un. */
    seuil?: number;
}[];
