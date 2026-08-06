/**
 * CAMINO — types du moteur de jeu.
 *
 * Ce dossier `engine/` est volontairement « pur » : aucune dépendance à React,
 * au DOM ou au navigateur. Il peut donc être exécuté tel quel dans un serveur
 * Node (multijoueur en ligne), dans un worker (simulations) ou dans les tests.
 */

/**
 * Les 6 couleurs qui rapportent des points, le noir qui en enlève, et le
 * blanc des tuiles jokers (variante) qui rejoint toutes les couleurs.
 */
export type Color = 'Y' | 'O' | 'R' | 'G' | 'B' | 'P' | 'K' | 'W'

export const WHITE: Color = 'W'

export const COLORS: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P', 'K']
/** Couleurs « chemin » (le noir est traité à part). */
export const PATH_COLORS: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P']
export const BLACK: Color = 'K'

/**
 * Les 4 quarts d'une tuile, dans l'ordre horaire en partant du haut-gauche :
 * [haut-gauche, haut-droite, bas-droite, bas-gauche].
 * Cet ordre rend la rotation triviale (décalage circulaire).
 */
export type Quads = readonly [Color, Color, Color, Color]

export interface Tile {
  /** Index de la tuile dans la planche officielle (0..96). */
  id: number
  quads: Quads
}

/** 0 = 0°, 1 = 90° horaire, 2 = 180°, 3 = 270°. */
export type Rotation = 0 | 1 | 2 | 3

export interface PlacedTile {
  tileId: number
  rot: Rotation
  /** Face miroir (variante Tuiles miroir). */
  flipped?: boolean
  /** Numéro du tour où la tuile a été posée (pour le rejeu / les stats). */
  round: number
}

/** Côtés d'un plateau, dans l'ordre haut, droite, bas, gauche. */
export type Side = 0 | 1 | 2 | 3

/**
 * Bordure d'un plateau (variantes) :
 *  - `uniform` : tout le bord est de la couleur du joueur ; chaque côté touché
 *    par un chemin de cette couleur compte comme une case de plus ;
 *  - `multi` : 8 petits carrés colorés par côté (coins blancs) ; chaque carré
 *    relié à un chemin de sa couleur compte comme une case de plus.
 */
export type BorderSpec =
  | { kind: 'uniform'; color: Color }
  | { kind: 'multi'; squares: [Color[], Color[], Color[], Color[]] }

/** Plateau : tableau de `size * size` cases, `null` = case vide. */
export interface Board {
  size: number
  cells: (PlacedTile | null)[]
  /** Bordure scorante (variantes Bordures colorées / multicolores). */
  borders?: BorderSpec
}

export interface Zone {
  color: Color
  /** Cases quart-de-tuile (index dans la grille 2N x 2N). */
  cells: number[]
  /** Index des tuiles (case du plateau) traversées par la zone. */
  tiles: number[]
  /** Cases de bordure reliées (variantes) : chacune compte comme une case. */
  borders: number
  /**
   * Identifiants des cases de bordure reliées (variantes) — pour l'affichage.
   * Uniforme : -(côté+1). Multicolore : -(1 + côté*100 + index).
   */
  borderIds?: number[]
  /** Étoiles magiques reliées par cette zone (variante). */
  stars: number
  /** Tuiles distinctes + bordures = ce qui détermine les points. */
  span: number
  points: number
}

export interface ColorScore {
  color: Color
  points: number
  /** Zones qui rapportent (>= minSpan tuiles), pour l'affichage détaillé. */
  scoringZones: Zone[]
  /** Toutes les zones de cette couleur. */
  zones: Zone[]
}

export interface ScoreBreakdown {
  total: number
  /** Points des couleurs uniquement (hors noir et hors cartes). */
  colorPoints: number
  blackZones: number
  blackPoints: number
  /** Points des étoiles magiques (variante). */
  starPoints: number
  cardPoints: number
  cardLabel?: string
  /** La carte modifie le barème au lieu d'ajouter des points (voir cards.ts). */
  cardStructural?: boolean
  byColor: Record<Color, ColorScore>
  zones: Zone[]
}

/** Variantes de la boîte — toutes optionnelles, certaines exclusives. */
export interface Variants {
  /** Le dernier à choisir peut piocher au hasard au lieu de la tuile restante. */
  lastPickRandom?: boolean
  /** Le bord du plateau score dans la couleur du joueur (1 par côté). */
  coloredBorders?: boolean
  /** Plateaux à bordures multicolores (exclusif avec coloredBorders). */
  multiBorders?: boolean
  /** +12 tuiles monochromes dans le sac (2 par couleur). */
  monoTiles?: boolean
  /** +6 tuiles blanches jokers dans le sac. */
  whiteTiles?: boolean
  /** Étoiles sur 30 tuiles ; les relier rapporte des points. */
  magicStars?: boolean
  /** Une tuile personnelle par joueur, jouable à tout moment. */
  personalTile?: boolean
  /** Chaque tuile peut être retournée sur sa face miroir. */
  mirrorTiles?: boolean
}

/** Barème modifiable — c'est le cœur de l'outil d'équilibrage. */
export interface Ruleset {
  /** Points en fonction du nombre de tuiles traversées. index 0 => 0 tuile. */
  pointsBySpan: number[]
  /** Taille minimale (en tuiles) d'un chemin pour marquer. */
  minSpan: number
  /** Malus par zone noire (valeur négative). */
  blackPenalty: number
  /** Côté du plateau (4 = plateau officiel 4x4, donc 16 tours). */
  boardSize: number
  /** Nombre de tuiles révélées au centre de la table à chaque tour. */
  tilesPerRound: number
  /** Une tuile (sauf la première) doit toucher une tuile déjà posée. */
  requireAdjacency: boolean
  /** Variantes actives. */
  variants?: Variants
}

export const DEFAULT_RULESET: Ruleset = {
  // 0,1,2 tuiles => 0 pt ; 3 => 3 ; 4 => 5 ; 5 => 8 ; 6 => 12 ; 7 => 17 ; 8 => 23 ; 9+ => 30
  pointsBySpan: [0, 0, 0, 3, 5, 8, 12, 17, 23, 30],
  minSpan: 3,
  blackPenalty: -2,
  boardSize: 4,
  tilesPerRound: 0, // 0 = « autant de tuiles que de joueurs » (règle officielle)
  requireAdjacency: true,
}

export type PlayerKind = 'human' | 'bot-random' | 'bot-greedy' | 'bot-smart'

/**
 * Les six plateaux de la boîte se distinguent par la couleur de leur contour.
 * Deux joueurs ne peuvent pas prendre le même plateau.
 */
export type BoardColor = 'O' | 'R' | 'P' | 'G' | 'Y' | 'B'

export const BOARD_COLORS: BoardColor[] = ['O', 'R', 'P', 'G', 'Y', 'B']

export interface Player {
  id: number
  name: string
  kind: PlayerKind
  /** Couleur du contour de son plateau. */
  boardColor: BoardColor
  /** Code hexadécimal correspondant, pour l'affichage. */
  color: string
  board: Board
  /** Tuile personnelle (variante) : jouable une fois, à tout moment. */
  personalTileId?: number
  personalUsed?: boolean
  /** Carte mission personnelle (variante Cartes missions persos). */
  cardId?: string
}

export interface PoolTile {
  tileId: number
  /** id du joueur qui l'a prise, sinon null. */
  takenBy: number | null
}

export type Phase = 'setup' | 'playing' | 'finished'

export interface GameOptions {
  ruleset: Ruleset
  /** Score affiché en direct pendant la partie. */
  liveScore: boolean
  /** Contours des zones affichés sur les plateaux. */
  showZones: boolean
  /** Affiche le meilleur coup possible (aide au playtest). */
  showHints: boolean
  /** Une (ou plusieurs) carte mission est tirée pour la table. */
  useCards: boolean
  /** Variante Cartes missions multiples : nombre de cartes de la table. */
  cardCount?: number
  /** Variante Cartes missions persos : une carte propre à chaque joueur. */
  personalCards?: boolean
  /** Première carte imposée ; sinon tirage au hasard selon la graine. */
  cardId?: string
  /**
   * La graine est saisie à la main : elle est conservée d'une partie à
   * l'autre. Sinon chaque nouvelle partie en tire une nouvelle.
   */
  manualSeed?: boolean
  seed: string
}

export interface RoundLogEntry {
  round: number
  playerId: number
  tileId: number
  rot: Rotation
  cell: number
  /** Rang de choix dans le tour (0 = premier à choisir). */
  pickOrder: number
  /** Nombre de tuiles encore disponibles au moment du choix. */
  choicesAvailable: number
  scoreAfter: number
  delta: number
}

export interface GameState {
  phase: Phase
  options: GameOptions
  /** Carte mission de la table (identique pour tout le monde). */
  cardId?: string
  /** Cartes de la table (variante Cartes missions multiples : plusieurs). */
  cardIds?: string[]
  /** Le dernier joueur du tour a déjà repioché (variante Dernier choix). */
  redrawUsed?: boolean
  players: Player[]
  /** Pioche restante (ids de tuiles), mélangée. */
  bag: number[]
  /** Tuiles révélées au centre pour le tour courant. */
  pool: PoolTile[]
  round: number
  totalRounds: number
  /** Joueur qui détient le sac ce tour-ci (choisit en premier). */
  bagHolder: number
  /** Index dans l'ordre de choix du tour (0..nbPlayers-1). */
  turnIndex: number
  log: RoundLogEntry[]
  /** Historique des scores par joueur et par tour, pour les graphiques. */
  scoreHistory: number[][]
}
