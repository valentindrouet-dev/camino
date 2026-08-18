/**
 * CAMINO — types du moteur de jeu.
 *
 * Ce dossier `engine/` est volontairement « pur » : aucune dépendance à React,
 * au DOM ou au navigateur. Il peut donc être exécuté tel quel dans un serveur
 * Node (multijoueur en ligne), dans un worker (simulations) ou dans les tests.
 */

/**
 * Les 6 couleurs qui rapportent des points, le noir qui en enlève, et le carré
 * arc-en-ciel des tuiles jokers (variante) qui rejoint toutes les couleurs.
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
  /** Joueur qui l'a posée — renseigné en Plateau commun, pour l'attribution. */
  by?: number
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
  /**
   * Chemin qui marque : zone de couleur (ni noire ni interdite) qui atteint le
   * minimum de tuiles. C'est ce que regardent les trèfles et les cartes — et
   * ça reste vrai en scoring inversé, où `points` devient négatif.
   */
  scoring: boolean
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
  /** Points de départ (variante Scoring inversé : 20, sinon 0). */
  basePoints: number
  /** Points des couleurs uniquement (hors noir et hors cartes). */
  colorPoints: number
  blackZones: number
  blackPoints: number
  /** Points des étoiles magiques (variante). */
  starPoints: number
  /** Trèfles (variante) : +3 dans un chemin qui marque, −3 sinon. */
  cloverPoints: number
  /** Cristaux (variante) : +4 par cristal resté intact. */
  crystalPoints: number
  /** Couleur secrète (variante) : le meilleur chemin de cette couleur double. */
  secretPoints: number
  /** Couleurs interdites (variante) : leurs zones se comptent comme le noir. */
  forbidden?: Color[]
  /** Nombre de zones d'une couleur interdite (chacune coûte le malus du noir). */
  forbiddenZones?: number
  cardPoints: number
  cardLabel?: string
  /** La carte modifie le barème au lieu d'ajouter des points (voir cards.ts). */
  cardStructural?: boolean
  byColor: Record<Color, ColorScore>
  zones: Zone[]
}

/** Les deux barèmes possibles des étoiles magiques. */
export type StarScoring = 'linked' | 'growing'

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
  /**
   * +6 tuiles arc-en-ciel dans le sac : un grand carré irisé joker qui rejoint
   * les chemins de toutes les couleurs voisines. (Nom historique du drapeau.)
   */
  whiteTiles?: boolean
  /** Étoiles sur 30 tuiles ; les relier rapporte des points. */
  magicStars?: boolean
  /**
   * Barème des étoiles (variante Étoiles magiques) :
   *  - `linked` : une étoile seule vaut 1, une étoile reliée vaut 2 ;
   *  - `growing` : dans un groupe de N, chaque étoile vaut N.
   */
  starScoring?: StarScoring
  /** Une tuile personnelle par joueur, jouable à tout moment. */
  personalTile?: boolean
  /** Chaque tuile peut être retournée sur sa face miroir. */
  mirrorTiles?: boolean
  /** Une tuile de plus au centre à chaque manche ; la restante retourne au sac. */
  extraTile?: boolean
  /** Une faille grise coupe 16 tuiles en deux moitiés qui ne se relient pas. */
  faultTiles?: boolean
  /** Un trèfle sur un quart de tuile : +3 dans un chemin qui marque, −3 sinon. */
  clovers?: boolean
  /** Chaque plateau démarre avec une tuile posée au centre. */
  startTile?: boolean
  /**
   * Tuile de départ multicolore (4 couleurs différentes, la même pour tous)
   * au lieu de la tuile monochrome à la couleur du plateau.
   */
  startTileMulti?: boolean
  /** Le sac revient au dernier servi : il tourne dans le sens antihoraire. */
  bagCounterClockwise?: boolean
  /** Deux cartes face cachée : à mi-partie, les plateaux tournent — ou non. */
  boardSwap?: boolean
  /** Chaque joueur reçoit une couleur secrète ; son meilleur chemin double. */
  secretColor?: boolean
  /**
   * Chaque joueur reçoit une (ou deux) couleurs interdites : les points de ses
   * chemins de cette couleur lui sont infligés en négatif.
   */
  forbiddenColor?: boolean
  /** Nombre de couleurs interdites par joueur (1 par défaut, 2 au plus). */
  forbiddenColorCount?: number
  /**
   * Scoring inversé : on part de 20 points, les zones noires en rapportent et
   * les chemins en coûtent. Tout ce que les autres variantes font gagner, elles
   * le font perdre — et inversement.
   */
  reverseScoring?: boolean
  /**
   * Verso aléatoire : à son tour, un joueur peut retourner une tuile du centre.
   * Sa nouvelle face est tirée du sac — et on ne revient jamais en arrière.
   */
  randomBack?: boolean
  /** Cristaux : +4 si aucune tuile n'est venue se coller à la sienne après sa pose. */
  crystals?: boolean
  /** Teintures : posée adjacente à une zone noire, la zone prend la couleur du pot. */
  dyes?: boolean
  /** Moulins : à la pose, les tuiles adjacentes tournent d'un quart vers la gauche. */
  windmills?: boolean
  /** Partie synchrone : une seule tuile par manche, la même pour tout le monde. */
  syncDraw?: boolean
  /** Plateau commun : un seul grand plateau partagé, chacun marque ses chemins. */
  sharedBoard?: boolean
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

/*
 * Les quatre profils de bots. Les identifiants historiques sont conservés pour
 * que les parties archivées et les configurations enregistrées restent lisibles :
 *   bot-random → Idiot, bot-greedy → Novice, bot-smart → Confirmé.
 */
export type PlayerKind = 'human' | 'bot-random' | 'bot-greedy' | 'bot-smart' | 'bot-expert'

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
  /** Couleur secrète (variante) : son meilleur chemin de cette couleur double. */
  secretColor?: Color
  /** Couleurs interdites (variante) : leurs chemins comptent en négatif. */
  forbiddenColors?: Color[]
  /** Plateau commun : points engrangés au moment de chaque pose. */
  banked?: number
}

export interface PoolTile {
  tileId: number
  /** id du joueur qui l'a prise, sinon null. */
  takenBy: number | null
  /** Déjà retournée sur son verso (variante Verso aléatoire) : plus jamais. */
  flipped?: boolean
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
  /** Le premier porteur du sac est tiré au sort au lieu d'être le joueur 1. */
  randomFirst?: boolean
  /**
   * Écran partagé : tous les plateaux côte à côte au centre, la colonne de
   * gauche disparaît. Toujours décoché au début d'une partie.
   */
  allBoards?: boolean
  /** Signale la dernière tuile posée par des équerres sur le plateau. */
  showLastPlaced?: boolean
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
  /** Couleur tirée pour les cartes qui en dépendent (id de carte → couleur). */
  cardColors?: Record<string, Color>
  /**
   * Variante Échange de plateaux : la carte tirée face cachée en début de
   * partie, révélée à mi-parcours.
   */
  swapCard?: 'rotate' | 'stay'
  /** Le dernier joueur du tour a déjà repioché (variante Dernier choix). */
  redrawUsed?: boolean
  /**
   * Variante Verso aléatoire : le joueur courant vient de retourner cette
   * tuile — il doit la prendre, et ne peut plus rien retourner ce tour-ci.
   */
  mustTakeTileId?: number
  /** Axe tiré pour les cartes qui en dépendent (id de carte → colonne/ligne). */
  cardAxes?: Record<string, 'col' | 'row'>
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
