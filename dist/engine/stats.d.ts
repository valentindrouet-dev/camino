import type { Color, GameState, Player, PlayerKind, ScoreBreakdown } from './types.js';
import { type GameConfig } from './game.js';
export interface PlayerStats {
    player: Player;
    breakdown: ScoreBreakdown;
    rank: number;
    tilesPlaced: number;
    /** Nombre de chemins qui rapportent. */
    scoringPaths: number;
    /** Plus long chemin (en tuiles). */
    longestPath: number;
    /** Couleur la plus rentable. */
    bestColor: Color | null;
    /** Somme des points perdus par les chemins trop courts (< minSpan). */
    wastedPotential: number;
    /** Rang moyen de choix dans le tour (0 = a choisi en premier). */
    avgPickOrder: number;
}
export declare function playerStats(state: GameState): PlayerStats[];
export declare function ranking(stats: PlayerStats[]): PlayerStats[];
export interface SimPlayerRecord {
    seat: number;
    kind: PlayerKind;
    total: number;
    colorPoints: number;
    blackZones: number;
    blackPoints: number;
    scoringPaths: number;
    longestPath: number;
    byColor: Record<Color, number>;
    /** Longueurs (en tuiles) des chemins qui marquent. */
    spans: number[];
    /** 1 pour le vainqueur, partagé en cas d'égalité. */
    win: number;
    /** Rang final (1 = premier), partagé en cas d'égalité. */
    rank: number;
    /** Points apportés par chaque variante — ce qui fait le score, source par source. */
    starPoints: number;
    cloverPoints: number;
    crystalPoints: number;
    secretPoints: number;
    cardPoints: number;
    basePoints: number;
    /** Carte mission accomplie (points strictement positifs). */
    cardDone: number;
    /** Tuiles des chemins trop courts pour marquer : le potentiel gâché. */
    wasted: number;
    /** Rang de choix moyen dans la manche (0 = sert en premier). */
    pickOrder: number;
}
export interface SimGameRecord {
    seed: string;
    results: SimPlayerRecord[];
    /** Nombre de manches effectivement jouées. */
    rounds: number;
    /** Score moyen de la table à la fin de chaque manche. */
    curve: number[];
}
/** Joue une partie entière avec des bots et renvoie ses résultats bruts. */
export declare function playOneGame(config: GameConfig, seed: string): SimGameRecord;
export interface SimResult {
    games: number;
    /** Tous les scores individuels obtenus. */
    scores: number[];
    min: number;
    max: number;
    mean: number;
    median: number;
    stdev: number;
    /** Points moyens par couleur et par joueur. */
    byColor: Record<Color, number>;
    avgBlackZones: number;
    avgBlackPoints: number;
    /** Distribution du nombre de tuiles des chemins qui marquent. */
    spanHistogram: Record<number, number>;
    avgScoringPaths: number;
    avgLongestPath: number;
    winsBySeat: number[];
    meanBySeat: number[];
    winsByKind: Record<string, number>;
    meanByKind: Record<string, number>;
    /** Nombre de joueurs observés pour chaque profil. */
    countByKind: Record<string, number>;
    /** Écart moyen entre le meilleur et le pire score d'une partie. */
    avgSpread: number;
    durationMs: number;
    /** Points moyens par source : couleurs, noir, étoiles, trèfles… */
    sources: {
        key: string;
        label: string;
        value: number;
        color: string;
    }[];
    /** Score moyen du vainqueur, et du dernier. */
    winnerMean: number;
    lastMean: number;
    /** Part des parties décidées à 5 points ou moins. */
    closeRate: number;
    /** Part des parties à égalité au sommet. */
    tieRate: number;
    /** Tuiles gâchées : chemins trop courts pour marquer. */
    avgWasted: number;
    /** Nombre moyen de manches d'une partie. */
    avgRounds: number;
    /** Score moyen de la table après chaque manche. */
    curve: number[];
    /** Part des joueurs qui accomplissent leur carte (0 si pas de carte). */
    cardRate: number;
    avgCardPoints: number;
    /** Matrice sièges × rangs : part des parties où le siège finit à ce rang. */
    rankBySeat: number[][];
}
/** Agrège des parties déjà jouées — sert à la simulation incrémentale de l'UI. */
export declare function aggregate(records: SimGameRecord[], seats: number, durationMs?: number): SimResult;
export declare function simulate(config: GameConfig, games: number, onProgress?: (done: number, total: number) => void): SimResult;
/** Histogramme des scores, prêt à être tracé. */
export declare function histogram(values: number[], bucket?: number): {
    x: number;
    n: number;
}[];
