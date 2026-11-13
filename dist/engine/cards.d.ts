import type { Board, BoardColor, Color, Ruleset, ScoreBreakdown, Zone } from './types.js';
export interface CardTableEntry {
    playerId: number;
    zones: Zone[];
}
export interface CardContext {
    playerId: number;
    board: Board;
    /** Décompte de base (zones + points), avant carte. */
    breakdown: ScoreBreakdown;
    ruleset: Ruleset;
    /** Les zones de tous les joueurs — pour les cartes comparatives. */
    table: CardTableEntry[];
    /** Couleur tirée pour cette carte, quand elle en dépend (`colorized`). */
    color?: Color;
    /** Axe tiré pour cette carte, quand elle en dépend (`randomAxis`). */
    axis?: 'col' | 'row';
    /** Couleur du contour du plateau de ce joueur. */
    boardColor?: BoardColor;
    /** Seuil choisi pour cette carte, quand elle en demande un (`seuils`). */
    seuil?: number;
}
export interface CardResult {
    points: number;
    /** Explication courte affichée au joueur. */
    detail: string;
    /**
     * La carte ne s'ajoute pas au décompte : elle en modifie la règle, et son
     * effet est déjà compris dans le score (voir `effectiveRuleset`).
     */
    structural?: boolean;
}
export interface MissionCard {
    id: string;
    /**
     * Texte exact de la carte. `{couleur}` est remplacé par la couleur tirée en
     * début de partie pour les cartes `colorized`.
     */
    text: string;
    /** Valeur affichée dans la pastille de la carte. */
    badge: string;
    /** Nom court pour les listes et les statistiques. */
    name: string;
    /**
     * Espérance de points sur un plateau ENCORE EN COURS — pour les bots.
     *
     * `evaluate` répond « accompli ou non » ; sur une carte tout-ou-rien, un bot
     * qui ne regarde que ça ne voit aucune pente à remonter et ne joue jamais la
     * mission. `outlook` donne cette pente : ce que la carte rapportera
     * probablement si l'on continue ainsi. Elle n'entre JAMAIS dans le score.
     */
    outlook?(ctx: CardContext): number;
    /** La couleur visée est tirée au hasard au début de chaque partie. */
    colorized?: boolean;
    /** L'axe visé (colonne ou ligne) est tiré au hasard au début de chaque partie. */
    randomAxis?: boolean;
    /** Carte d'extension (affichée dans une autre couleur que celles de la boîte). */
    extra?: boolean;
    /** Troisième série, en bleu ciel. */
    ciel?: boolean;
    /**
     * Sa couleur secrète est tirée pour CHAQUE joueur, comme la variante du
     * même nom : ce n'est pas une couleur de table.
     */
    colorParJoueur?: boolean;
    /**
     * Seuils proposés au choix à la mise en place ; `{seuil}` est remplacé par
     * celui qui a été retenu. Le premier est la valeur par défaut.
     */
    seuils?: number[];
    /**
     * Carte à mort subite : elle n'ajoute pas de points, elle met fin à la
     * partie dès qu'un joueur remplit sa condition. `atteint` dit si c'est fait
     * — c'est la partie, pas le décompte, qui s'en sert.
     */
    sudden?: boolean;
    atteint?(ctx: CardContext): boolean;
    evaluate(ctx: CardContext): CardResult;
}
/** Seuil retenu pour une carte qui en demande un. */
export declare function cardSeuil(card: MissionCard, seuil?: number): number;
/** Texte d'une carte, couleur, axe et seuil compris. */
export declare function cardText(card: MissionCard, color?: Color, axis?: 'col' | 'row', seuil?: number): string;
/** Le catalogue complet, cartes retirées comprises : sert à relire une archive. */
export declare const TOUTES_LES_CARTES: MissionCard[];
/**
 * Espérance totale des cartes d'un joueur — pour les bots uniquement.
 * Une carte sans `outlook` rend ce qu'elle vaut déjà : son barème est
 * linéaire, la pente y est naturelle.
 */
export declare function cardsOutlook(ctx: Omit<CardContext, 'color' | 'axis'>, cardIds: string[], colors?: Record<string, Color>, axes?: Record<string, 'col' | 'row'>): number;
/** Les cartes réellement en jeu. */
export declare const CARDS: MissionCard[];
/**
 * On cherche dans le catalogue complet : une partie archivée avec une carte
 * depuis retirée doit continuer de s'afficher correctement.
 */
export declare function cardById(id: string | undefined): MissionCard | undefined;
/**
 * Barème réellement appliqué compte tenu de la carte de la table.
 *
 * La carte « Les zones noires deviennent positives » ne se contente pas
 * d'ajouter des points : elle change la valeur d'une zone noire. On la traduit
 * donc en barème, ce qui garantit que le plateau, les pastilles, le score en
 * direct, la courbe et le décompte final racontent tous la même chose.
 */
export declare function effectiveRuleset(ruleset: Ruleset, cardId?: string): Ruleset;
/** Cartes qui s'appliquent à un joueur donné (table ou perso). */
export declare function playerCardIds(state: {
    options: {
        useCards: boolean;
        personalCards?: boolean;
    };
    cardId?: string;
    cardIds?: string[];
    players: {
        id: number;
        cardId?: string;
    }[];
}, playerId: number): string[];
/** Barème en vigueur pour UN joueur, cartes structurelles comprises. */
export declare function rulesetForPlayer(state: {
    options: {
        ruleset: Ruleset;
        useCards: boolean;
        personalCards?: boolean;
    };
    cardId?: string;
    cardIds?: string[];
    players: {
        id: number;
        cardId?: string;
    }[];
}, playerId: number): Ruleset;
/** Barème en vigueur du point de vue général (cartes de la table). */
export declare function activeRuleset(state: {
    options: {
        ruleset: Ruleset;
        useCards: boolean;
        personalCards?: boolean;
    };
    cardId?: string;
    cardIds?: string[];
    players?: {
        id: number;
        cardId?: string;
    }[];
}): Ruleset;
/** Applique une LISTE de cartes : les bonus se cumulent. */
export declare function applyCards(breakdown: ScoreBreakdown, ctx: Omit<CardContext, 'breakdown' | 'color' | 'axis'>, cardIds: string[], 
/** Couleurs tirées en début de partie pour les cartes qui en dépendent. */
colors?: Record<string, Color>, 
/** Axes (colonne/ligne) tirés en début de partie, même principe. */
axes?: Record<string, 'col' | 'row'>, 
/** Seuils choisis à la mise en place pour les cartes qui en demandent un. */
seuils?: Record<string, number>): ScoreBreakdown;
/** Décompte enrichi de la carte mission de la table. */
export declare function applyCard(breakdown: ScoreBreakdown, ctx: Omit<CardContext, 'breakdown'>, cardId?: string): ScoreBreakdown;
/** Zones de chaque joueur — contexte nécessaire aux cartes comparatives. */
export declare function cardTable(players: {
    id: number;
    board: Board;
}[], ruleset: Ruleset): CardTableEntry[];
