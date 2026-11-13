/**
 * CAMINO — types du moteur de jeu.
 *
 * Ce dossier `engine/` est volontairement « pur » : aucune dépendance à React,
 * au DOM ou au navigateur. Il peut donc être exécuté tel quel dans un serveur
 * Node (multijoueur en ligne), dans un worker (simulations) ou dans les tests.
 */
export const WHITE = 'W';
export const COLORS = ['Y', 'O', 'R', 'G', 'B', 'P', 'K'];
/** Couleurs « chemin » (le noir est traité à part). */
export const PATH_COLORS = ['Y', 'O', 'R', 'G', 'B', 'P'];
export const BLACK = 'K';
export const DEFAULT_RULESET = {
    // 0,1,2 tuiles => 0 pt ; 3 => 3 ; 4 => 5 ; 5 => 8 ; 6 => 12 ; 7 => 17 ; 8 => 23 ; 9+ => 30
    pointsBySpan: [0, 0, 0, 3, 5, 8, 12, 17, 23, 30],
    minSpan: 3,
    blackPenalty: -2,
    boardSize: 4,
    tilesPerRound: 0, // 0 = « autant de tuiles que de joueurs » (règle officielle)
    requireAdjacency: true,
};
export const BOARD_COLORS = ['O', 'R', 'P', 'G', 'Y', 'B'];
