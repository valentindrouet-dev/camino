import { Rng } from './rng.js';
import type { Board, Color, GameState, PlayerKind, Ruleset } from './types.js';
import { type Move } from './game.js';
export interface ScoredMove extends Move {
    /** Score réel du plateau après le coup. */
    score: number;
    /** Points de cartes missions acquis après le coup. */
    missionPoints: number;
    /** Score + potentiel (ce que l'IA cherche à maximiser). */
    value: number;
    delta: number;
}
/**
 * Poids de l'évaluation du Stratège — exposés pour pouvoir régler les bots.
 *
 * La stratégie voulue :
 *  1. maximiser une ou deux couleurs (le barème est convexe : un chemin de
 *     9 tuiles vaut dix fois un chemin de 3) — quitte à poser du noir si cela
 *     fait grandir la meilleure couleur ;
 *  2. regrouper les zones noires (une grande zone coûte autant qu'une petite) ;
 *  3. relier plusieurs couleurs en une seule pose.
 */
/**
 * Poids de l'évaluation — exposés pour pouvoir régler les bots.
 *
 * Ce que le barème impose comme stratégie, et que les bots doivent comprendre :
 *
 *  1. Il est CONVEXE. Un chemin de 9 tuiles vaut 30 points, trois chemins de 3
 *     en valent 9. Éparpiller est la pire erreur ; il faut une couleur reine,
 *     une seconde, et tant pis pour le reste.
 *  2. Une zone noire coûte 2 points, quelle que soit sa taille. Tout le noir
 *     doit finir dans UNE seule tache, qu'il faut garder ouverte pour accueillir
 *     le noir à venir.
 *  3. Le potentiel s'éteint. À deux manches de la fin, un chemin « qui pourrait
 *     grandir » ne grandira plus : il ne vaut que ce qu'il vaut.
 *  4. Les cartes tout-ou-rien n'offrent aucune pente à un bot qui ne regarde
 *     que le score : il leur faut une espérance (voir `outlook` des cartes).
 */
export declare const AI_WEIGHTS: {
    /** Poids du potentiel de croissance d'un chemin. */
    growth: number;
    /**
     * Part du budget de tuiles restantes qu'on suppose pouvoir consacrer à la
     * couleur reine, à sa dauphine, à la troisième. Au-delà : rien.
     *
     * Mesuré : viser une seule couleur (1/0/0) coûte 9 points de moyenne, trois
     * couleurs de front en coûtent 3. Le tirage étant subi, il faut mener deux
     * chemins et demi — pas un, pas six.
     */
    focusRates: number[];
    /** Pression contre l'éparpillement : chaque bout de couleur qui ne mènera
     *  nulle part est autant de tuiles perdues pour le grand chemin. */
    fragment: number;
    /** Bonus par couleur supplémentaire raccordée par la pose. */
    multiColor: number;
    /** Préférence pour les poses au centre (plus de voisins = plus d'options). */
    centrality: number;
    /** Décote de la tuile personnelle : on la garde pour un vrai bon coup. */
    personalReserve: number;
    /** Poids des points de cartes missions déjà acquis par la pose. */
    mission: number;
    /** Poids de l'espérance de mission — la pente des cartes tout-ou-rien. */
    missionOutlook: number;
    /** Expert : poids du coup d'après, estimé sur des tuiles tirées du sac. */
    lookahead: number;
    /** Expert : valeur de priver le joueur suivant de la tuile qui l'arrangeait. */
    denial: number;
    /** Expert : combien de coups on approfondit, et sur combien de tuiles. */
    beam: number;
    samples: number;
    /** Poids des points de cristaux (variante) : préserver les siens. */
    crystal: number;
};
export interface EvalOpts {
    /** Couleurs interdites du joueur : leurs zones coûtent le malus. */
    forbidden?: Color[];
    /** Plateau commun : seules les zones où le joueur a une tuile comptent. */
    ownTiles?: Set<number> | null;
    /** Tuiles que ce joueur posera ENCORE. 0 = le plateau ne bougera plus. */
    roundsLeft?: number;
}
/**
 * Évaluation d'un plateau : points réels + ce qu'il reste raisonnablement à
 * en tirer. Tout le jeu du bot tient dans cette fonction.
 */
export declare function evaluateBoard(board: Board, ruleset: Ruleset, opts?: EvalOpts): number;
/** Tous les coups possibles pour le joueur courant, évalués. */
export declare function enumerateMoves(state: GameState): ScoredMove[];
/**
 * Politique de repioche des bots (variante Dernier choix aléatoire) : on
 * échange la tuile restante quand le meilleur coup qu'elle permet reste
 * clairement perdant.
 */
/**
 * Politique de verso des bots (variante Verso aléatoire) : on retourne la
 * tuile du meilleur coup quand même lui reste clairement perdant.
 */
export declare function botWantsFlip(state: GameState): number | null;
export declare function botWantsRedraw(state: GameState): boolean;
export declare function bestMove(state: GameState, kind?: PlayerKind, rng?: Rng): Move | null;
/** Les N meilleurs coups, pour l'affichage de l'aide au joueur humain. */
export declare function topMoves(state: GameState, n?: number): ScoredMove[];
export declare function moveKey(m: Move): string;
