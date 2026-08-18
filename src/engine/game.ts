import { createBoard, createBoardRect, isFull, legalCells, placeTile } from './board.ts'
import {
  activeRuleset,
  applyCards,
  cardTable,
  CARDS,
  playerCardIds,
  rulesetForPlayer,
  TOUTES_LES_CARTES,
} from './cards.ts'
import { Rng } from './rng.ts'
import { scoreBoard, scoreOf } from './scoring.ts'
import {
  COLOR_TILE_IDS,
  MONO_TILE_IDS,
  MULTI_START_TILE_IDS,
  TILE_COUNT,
  TILES,
  WHITE_TILE_IDS,
} from './tiles.ts'
import type {
  BoardColor,
  BorderSpec,
  Color,
  GameOptions,
  GameState,
  Player,
  PlayerKind,
  PoolTile,
  Rotation,
  Ruleset,
} from './types.ts'
import { DEFAULT_RULESET, PATH_COLORS } from './types.ts'

/** Couleurs exactes des six plateaux de la boîte. */
export const BOARD_COLOR_HEX: Record<BoardColor, string> = {
  O: '#F7931D',
  R: '#D1232A',
  P: '#6850A1',
  G: '#40AE49',
  Y: '#FFF101',
  B: '#0095D9',
}

export const BOARD_COLOR_NAMES: Record<BoardColor, string> = {
  O: 'Orange',
  R: 'Rouge',
  P: 'Violet',
  G: 'Vert',
  Y: 'Jaune',
  B: 'Bleu',
}

/** Ordre d'attribution par défaut des plateaux. */
export const DEFAULT_BOARD_ORDER: BoardColor[] = ['O', 'B', 'G', 'R', 'P', 'Y']

export interface PlayerConfig {
  name: string
  kind: PlayerKind
  boardColor: BoardColor
}

/** Première couleur de plateau encore libre. */
export function freeBoardColor(taken: BoardColor[]): BoardColor {
  return DEFAULT_BOARD_ORDER.find((c) => !taken.includes(c)) ?? DEFAULT_BOARD_ORDER[0]
}

export interface GameConfig {
  players: PlayerConfig[]
  options: GameOptions
}

export function defaultPlayers(count: number): PlayerConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Joueur ${i + 1}`,
    kind: 'human' as PlayerKind,
    boardColor: DEFAULT_BOARD_ORDER[i % DEFAULT_BOARD_ORDER.length],
  }))
}

export function defaultOptions(seed: string): GameOptions {
  return {
    ruleset: { ...DEFAULT_RULESET },
    liveScore: true,
    showZones: true,
    showHints: false,
    useCards: false,
    seed,
  }
}

/**
 * Options débarrassées de tout ce qui relève des variantes : les variantes
 * elles-mêmes, les cartes missions, la pose libre et le barème perso — ces
 * trois derniers vivant dans le même panneau. Ce qui relève de l'affichage
 * et du confort (score visible, indices, dernière tuile, 1er joueur
 * aléatoire, graine) est conservé tel quel.
 */
export function clearVariants(options: GameOptions): GameOptions {
  return {
    ...options,
    useCards: false,
    cardCount: 1,
    cardId: undefined,
    personalCards: false,
    // DEFAULT_RULESET ne porte aucune variante : le barème repart officiel,
    // pose libre comprise.
    ruleset: { ...DEFAULT_RULESET },
  }
}

/** Nombre de tuiles révélées au centre à chaque tour. */
export function tilesPerRound(ruleset: Ruleset, playerCount: number): number {
  // Partie synchrone : une seule tuile, la même pour tout le monde.
  if (ruleset.variants?.syncDraw) return 1
  const extra = ruleset.variants?.extraTile ? 1 : 0
  if (ruleset.tilesPerRound > 0) return ruleset.tilesPerRound + extra
  // Règle officielle : autant de tuiles que de joueurs.
  // En solo on en propose 2 pour qu'il reste un choix à faire.
  return (playerCount === 1 ? 2 : playerCount) + extra
}

/**
 * Dimensions du plateau partagé (variante Plateau commun) : 16 cases par
 * joueur, disposées en PAYSAGE — le plateau ne dépasse jamais 8 tuiles de
 * haut et s'allonge vers la droite. 8×4 à deux, 8×6 à trois, 8×8 à quatre,
 * puis 10×8 et 12×8. Chaque joueur apporte exactement ses 16 tuiles et le
 * plateau finit plein.
 */
export function sharedBoardDims(playerCount: number): { w: number; h: number } {
  // Solo : le plateau habituel, il n'y a personne avec qui partager.
  if (playerCount <= 1) return { w: 4, h: 4 }
  const h = Math.min(8, 2 * playerCount)
  return { w: (16 * playerCount) / h, h }
}

/**
 * Nombre de manches d'une partie : une par case du plateau, moins la tuile de
 * départ déjà posée (variante). En Plateau commun, chaque manche remplit une
 * case PAR JOUEUR : on joue tant qu'il reste une case pour chacun.
 */
export function roundsFor(ruleset: Ruleset, playerCount = 0): number {
  const start = ruleset.variants?.startTile ? 1 : 0
  if (ruleset.variants?.sharedBoard && playerCount > 0) {
    const { w, h } = sharedBoardDims(playerCount)
    return Math.floor((w * h - start) / playerCount)
  }
  return ruleset.boardSize * ruleset.boardSize - start
}

/** Manche où les cartes Rotation sont retournées (variante Échange de plateaux). */
export function swapRound(ruleset: Ruleset): number {
  return Math.floor(roundsFor(ruleset) / 2)
}

/** Nombre de tuiles nécessaires pour aller au bout de la partie. */
export function tilesNeeded(ruleset: Ruleset, playerCount: number): number {
  const reserve = ruleset.variants?.personalTile ? playerCount : 0
  // Chaque manche consomme une tuile par joueur — une seule en Partie
  // synchrone ; celles qui restent au centre repartent au sac. Il faut
  // simplement de quoi garnir la dernière manche.
  const perRound = ruleset.variants?.syncDraw ? 1 : playerCount === 1 ? 1 : playerCount
  return (
    roundsFor(ruleset, playerCount) * perRound +
    (tilesPerRound(ruleset, playerCount) - perRound) +
    reserve
  )
}

/** Taille du sac selon les variantes actives. */
export function bagSize(ruleset: Ruleset): number {
  let n = TILE_COUNT
  if (ruleset.variants?.monoTiles) n += MONO_TILE_IDS.length
  if (ruleset.variants?.whiteTiles) n += WHITE_TILE_IDS.length
  return n
}

export function configError(config: GameConfig): string | null {
  const n = config.players.length
  if (n < 1 || n > 6) return 'Il faut entre 1 et 6 joueurs.'
  const colors = config.players.map((p) => p.boardColor)
  if (new Set(colors).size !== colors.length) {
    return 'Deux joueurs ne peuvent pas prendre le même plateau : choisissez des couleurs différentes.'
  }
  const v = config.options.ruleset.variants
  if (v?.coloredBorders && v?.multiBorders) {
    return 'Bordures colorées et Bordures multicolores ne peuvent pas être activées en même temps.'
  }
  if (config.options.personalCards && config.options.useCards) {
    return 'Cartes missions persos et cartes de la table ne peuvent pas être activées en même temps.'
  }
  if (v?.sharedBoard && (v?.coloredBorders || v?.multiBorders)) {
    return 'Le Plateau commun n’a pas de bordures : décochez les Bordures colorées ou multicolores.'
  }
  if (v?.syncDraw && (v?.extraTile || v?.lastPickRandom || v?.randomBack)) {
    return 'La Partie synchrone révèle une seule tuile, la même pour tous : Tuile supplémentaire, Dernier choix aléatoire et Verso aléatoire n’ont plus de sens avec elle.'
  }
  const needed = tilesNeeded(config.options.ruleset, n)
  const available = bagSize(config.options.ruleset)
  if (needed > available) {
    return `Il faudrait ${needed} tuiles pour cette configuration, le sac n'en contient que ${available}. Réduisez le nombre de joueurs ou ajoutez des tuiles de variante.`
  }
  return null
}

/**
 * Bordure multicolore d'un plateau : 8 carrés par côté, coins blancs, jamais
 * deux carrés identiques adjacents. Fixe par couleur de plateau — ce sont des
 * plateaux imprimés, identiques d'une partie à l'autre.
 */
export function multiBorderFor(boardColor: BoardColor, size = 4): BorderSpec {
  const rng = new Rng(`camino-bordure-${boardColor}`)
  const per = size * 2
  const squares: [Color[], Color[], Color[], Color[]] = [[], [], [], []]
  const PALETTE: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P']
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < per; k++) {
      // voisin précédent sur le même côté ; aux jonctions, les coins blancs isolent
      const prev = k > 0 ? squares[side][k - 1] : null
      let c: Color
      do {
        c = PALETTE[rng.int(PALETTE.length)]
      } while (c === prev)
      squares[side].push(c)
    }
  }
  return { kind: 'multi', squares }
}

/** Bordure du plateau d'un joueur selon les variantes actives. */
export function bordersFor(ruleset: Ruleset, boardColor: BoardColor): BorderSpec | undefined {
  if (ruleset.variants?.coloredBorders) return { kind: 'uniform', color: boardColor }
  if (ruleset.variants?.multiBorders) return multiBorderFor(boardColor, ruleset.boardSize)
  return undefined
}

export function createGame(config: GameConfig): GameState {
  const rng = new Rng(config.options.seed)
  const ruleset = config.options.ruleset
  // Plateau commun : un seul grand plateau, sa taille suit le nombre de joueurs.
  const shared = Boolean(ruleset.variants?.sharedBoard)
  const size = ruleset.boardSize
  const players: Player[] = config.players.map((p, i) => ({
    id: i,
    name: p.name.trim() || `Joueur ${i + 1}`,
    kind: p.kind,
    boardColor: p.boardColor,
    color: BOARD_COLOR_HEX[p.boardColor],
    board: { ...createBoard(size), borders: bordersFor(ruleset, p.boardColor) },
  }))

  // Plateau commun : tout le monde regarde — et remplit — le même plateau,
  // rectangulaire et en paysage : 16 cases par joueur.
  if (shared) {
    const dims = sharedBoardDims(players.length)
    const commun = createBoardRect(dims.w, dims.h)
    for (const p of players) p.board = commun
  }

  // Cartes missions : une ou plusieurs pour la table, ou une par joueur.
  let cardId: string | undefined
  let cardIds: string[] | undefined
  if (config.options.personalCards) {
    const deck = rng.shuffle(CARDS.map((c) => c.id))
    players.forEach((p, i) => {
      p.cardId = deck[i % deck.length]
    })
  } else if (config.options.useCards) {
    const count = Math.max(1, Math.min(config.options.cardCount ?? 1, CARDS.length))
    const rest = rng.shuffle(
      CARDS.map((c) => c.id).filter((id) => id !== config.options.cardId),
    )
    cardIds = [...(config.options.cardId ? [config.options.cardId] : []), ...rest].slice(0, count)
    cardId = cardIds[0]
  }

  // Couleur imposée aux cartes qui en dépendent (plus grand chemin, chemins
  // d'une couleur, couleur bannie) : tirée en début de partie, la même pour
  // toute la table. Elle est tirée AVANT la distribution des couleurs des
  // joueurs, qui peut en dépendre.
  // On tire pour le catalogue COMPLET, cartes retirées comprises : une carte
  // mise de côté reste jouable si on l'impose par son identifiant.
  const cardColors: Record<string, Color> = {}
  for (const card of TOUTES_LES_CARTES) {
    if (card.colorized) cardColors[card.id] = PATH_COLORS[rng.int(PATH_COLORS.length)]
  }
  // Axe (colonne ou ligne) des cartes qui en dépendent — même principe.
  const cardAxes: Record<string, 'col' | 'row'> = {}
  for (const card of TOUTES_LES_CARTES) {
    if (card.randomAxis) cardAxes[card.id] = rng.int(2) === 0 ? 'col' : 'row'
  }

  /** Cartes en jeu pour un joueur : celles de la table, ou la sienne. */
  const cartesDe = (p: (typeof players)[number]): string[] =>
    config.options.personalCards ? (p.cardId ? [p.cardId] : []) : (cardIds ?? [])

  // Tuile de départ : une tuile monochrome à la couleur du plateau, posée au
  // centre. La même case pour tout le monde, tirée avec la graine.
  if (ruleset.variants?.startTile) {
    const w = players[0].board.size
    const h = players[0].board.cells.length / w
    const mids = (n: number) => (n % 2 === 1 ? [(n - 1) / 2] : [n / 2 - 1, n / 2])
    const centres = mids(h).flatMap((r) => mids(w).map((c) => r * w + c))
    const cell = centres[rng.int(centres.length)]
    // Multicolore : une seule tuile à quatre couleurs, la même pour tous, pour
    // que personne ne démarre avec un avantage. Monochrome : la couleur du
    // plateau de chacun.
    const multi =
      ruleset.variants.startTileMulti || shared
        ? MULTI_START_TILE_IDS[rng.int(MULTI_START_TILE_IDS.length)]
        : null
    if (shared) {
      // une seule tuile de départ, neutre : la multicolore, la même pour tous
      const commun = { ...players[0].board, cells: players[0].board.cells.slice() }
      commun.cells[cell] = { tileId: multi as number, rot: 0, round: -1 }
      for (const p of players) p.board = commun
    } else {
      for (const p of players) {
        p.board = {
          ...p.board,
          cells: p.board.cells.slice(),
        }
        p.board.cells[cell] = {
          tileId: multi ?? COLOR_TILE_IDS[p.boardColor],
          rot: 0,
          round: -1,
        }
      }
    }
  }

  // Couleurs interdites : une (ou deux) par joueur, matérialisées par des
  // tuiles monochromes qu'on ne joue pas. Les points de ses chemins de ces
  // couleurs lui sont infligés en négatif.
  if (ruleset.variants?.forbiddenColor) {
    const count = Math.max(1, Math.min(ruleset.variants.forbiddenColorCount ?? 1, 2))
    for (const p of players) {
      p.forbiddenColors = rng.shuffle([...PATH_COLORS]).slice(0, count)
    }
  }

  // La carte « Couleur bannie » a le même pouvoir, mais la couleur est la même
  // pour toute la table : on l'ajoute simplement aux couleurs interdites.
  const bannie = cardColors['banned-color']
  if (bannie) {
    for (const p of players) {
      if (!cartesDe(p).includes('banned-color')) continue
      p.forbiddenColors = [...new Set([...(p.forbiddenColors ?? []), bannie])]
    }
  }

  // Couleur secrète : une par joueur, tirée sans doublon tant que possible —
  // et jamais une couleur qui lui est déjà interdite.
  const secretPour = (concernes: typeof players) => {
    const deck = rng.shuffle([...PATH_COLORS])
    concernes.forEach((p, i) => {
      const banned = p.forbiddenColors ?? []
      const start = i % deck.length
      let pick = deck[start]
      for (let k = 0; k < deck.length && banned.includes(pick); k++) {
        pick = deck[(start + k + 1) % deck.length]
      }
      p.secretColor = pick
    })
  }
  if (ruleset.variants?.secretColor) secretPour(players)
  // Même pouvoir par la carte « Couleur secrète » : chacun tire la sienne.
  const avecCarteSecrete = players.filter((p) => cartesDe(p).includes('secret-color'))
  if (avecCarteSecrete.length) secretPour(avecCarteSecrete)

  const ids = Array.from({ length: TILE_COUNT }, (_, i) => i)
  if (ruleset.variants?.monoTiles) ids.push(...MONO_TILE_IDS)
  if (ruleset.variants?.whiteTiles) ids.push(...WHITE_TILE_IDS)
  const bag = rng.shuffle(ids)

  // Tuile personnelle : une tuile sans noir tirée du sac pour chaque joueur.
  if (ruleset.variants?.personalTile) {
    for (const p of players) {
      const idx = bag.findIndex((id) => !TILES[id].quads.includes('K'))
      if (idx >= 0) {
        p.personalTileId = bag.splice(idx, 1)[0]
        p.personalUsed = false
      }
    }
  }
  const state: GameState = {
    phase: 'playing',
    options: config.options,
    cardId,
    cardIds,
    cardColors,
    cardAxes,
    swapCard: ruleset.variants?.boardSwap
      ? rng.int(2) === 0
        ? 'rotate'
        : 'stay'
      : undefined,
    players,
    bag,
    pool: [],
    round: 0,
    totalRounds: roundsFor(ruleset, players.length),
    // Premier porteur du sac : le joueur 1, ou un joueur au hasard (option).
    // Le tirage est fait en dernier pour ne pas décaler le mélange du sac.
    bagHolder: config.options.randomFirst ? rng.int(players.length) : 0,
    turnIndex: 0,
    log: [],
    scoreHistory: players.map(() => []),
  }
  return drawPool(state)
}

function drawPool(state: GameState): GameState {
  const count = tilesPerRound(state.options.ruleset, state.players.length)
  // Les tuiles restées au centre (tuile supplémentaire non prise, ou tuile
  // personnelle jouée à la place) sont REMÉLANGÉES dans le sac. Pas en Partie
  // synchrone : la tuile commune a été jouée par tout le monde.
  const leftovers = state.options.ruleset.variants?.syncDraw
    ? []
    : state.pool.filter((p) => p.takenBy === null).map((p) => p.tileId)
  const bag = leftovers.length
    ? new Rng(`${state.options.seed}-melange-${state.round}`).shuffle([...leftovers, ...state.bag])
    : state.bag
  const pool: PoolTile[] = []
  for (let i = 0; i < count && bag.length; i++) {
    pool.push({ tileId: bag.pop() as number, takenBy: null })
  }
  return { ...state, bag, pool, redrawUsed: false }
}

export function currentPlayerId(state: GameState): number {
  return (state.bagHolder + state.turnIndex) % state.players.length
}

export function currentPlayer(state: GameState): Player {
  return state.players[currentPlayerId(state)]
}

export function availableTiles(state: GameState): PoolTile[] {
  return state.pool.filter((p) => p.takenBy === null)
}

/** Cases jouables par le joueur courant. */
export function currentLegalCells(state: GameState): number[] {
  const player = currentPlayer(state)
  return legalCells(player.board, state.options.ruleset.requireAdjacency)
}

export interface Move {
  tileId: number
  cell: number
  rot: Rotation
  /** Face miroir (variante Tuiles miroir). */
  flipped?: boolean
  /** Tuile jouée depuis la réserve personnelle plutôt que du centre. */
  personal?: boolean
}

export function isLegalMove(state: GameState, move: Move): boolean {
  if (state.phase !== 'playing') return false
  const player = currentPlayer(state)
  const variants = state.options.ruleset.variants
  if (move.flipped && !variants?.mirrorTiles) return false
  // Verso aléatoire : après avoir retourné une tuile, on doit la prendre.
  if (state.mustTakeTileId !== undefined && move.tileId !== state.mustTakeTileId) return false
  if (move.personal) {
    if (!variants?.personalTile) return false
    if (player.personalTileId !== move.tileId || player.personalUsed) return false
  } else {
    const pool = state.pool.find((p) => p.tileId === move.tileId && p.takenBy === null)
    if (!pool) return false
  }
  if (player.board.cells[move.cell] !== null) return false
  return currentLegalCells(state).includes(move.cell)
}

/**
 * Variante « Dernier choix aléatoire » : le dernier joueur du tour peut
 * échanger la tuile restante contre une pioche au hasard — une seule fois,
 * sans retour possible.
 */
export function canRedrawLastTile(state: GameState): boolean {
  return Boolean(
    state.phase === 'playing' &&
      state.options.ruleset.variants?.lastPickRandom &&
      state.mustTakeTileId === undefined &&
      !state.redrawUsed &&
      state.turnIndex === state.players.length - 1 &&
      availableTiles(state).length === 1 &&
      state.bag.length > 0,
  )
}

export function redrawLastTile(state: GameState): GameState {
  if (!canRedrawLastTile(state)) return state
  const remaining = availableTiles(state)[0]
  const bag = state.bag.slice()
  const drawn = bag.pop() as number
  // la tuile refusée part au fond du sac : impossible d'y revenir
  bag.unshift(remaining.tileId)
  const pool = state.pool.map((p) =>
    p.tileId === remaining.tileId ? { tileId: drawn, takenBy: null } : p,
  )
  return { ...state, bag, pool, redrawUsed: true }
}

/**
 * Variante Verso aléatoire : à son tour, un joueur peut retourner une tuile du
 * centre encore libre. Sa nouvelle face est tirée du sac — l'ancienne
 * disparaît, c'est la même tuile physique — et il doit la prendre : on ne
 * revient jamais en arrière. Une tuile ne se retourne qu'une fois.
 */
export function canFlipTile(state: GameState, tileId: number): boolean {
  const v = state.options.ruleset.variants
  if (!v?.randomBack || state.phase !== 'playing') return false
  if (state.mustTakeTileId !== undefined) return false
  const pool = state.pool.find((p) => p.tileId === tileId)
  if (!pool || pool.takenBy !== null || pool.flipped) return false
  // L'ancienne face ne revient pas au sac : il faut garder de quoi finir la
  // partie. On exige une tuile d'avance sur les manches restantes.
  const perRound = tilesPerRound(state.options.ruleset, state.players.length)
  const futures = Math.max(0, state.totalRounds - state.round - 1) * perRound
  return state.bag.length >= futures + 1
}

export function flipTile(state: GameState, tileId: number): GameState {
  if (!canFlipTile(state, tileId)) return state
  const rng = new Rng(`${state.options.seed}-verso-${state.round}-${state.turnIndex}`)
  const bag = state.bag.slice()
  const drawn = bag.splice(rng.int(bag.length), 1)[0]
  const pool = state.pool.map((p) =>
    p.tileId === tileId ? { tileId: drawn, takenBy: null, flipped: true } : p,
  )
  return { ...state, bag, pool, mustTakeTileId: drawn }
}

/**
 * Prochain porteur du sac. Sens horaire par défaut ; avec la variante Sac
 * antihoraire il revient au dernier servi, c'est-à-dire au voisin de droite.
 */
function nextBagHolder(state: GameState): number {
  const n = state.players.length
  const step = state.options.ruleset.variants?.bagCounterClockwise ? -1 : 1
  return (state.bagHolder + step + n) % n
}

/**
 * Variante Échange de plateaux : à mi-partie on retourne les deux cartes. Si
 * c'est « Rotation ! », chaque joueur passe son plateau à son voisin de gauche.
 */
function rotateBoards(players: Player[]): Player[] {
  const n = players.length
  return players.map((p, i) => ({ ...p, board: players[(i - 1 + n) % n].board }))
}

/**
 * Applique un coup : le joueur courant prend une tuile du centre et la pose.
 * Retourne un NOUVEL état (les états sont immuables : l'annulation côté UI se
 * contente d'empiler les états successifs, et un serveur peut rejouer la
 * partie à partir de la graine + la liste des coups).
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) return state
  const playerId = currentPlayerId(state)
  const player = state.players[playerId]
  // Barème en vigueur : la carte « zones noires positives » en fait partie.
  const ruleset = activeRuleset(state)

  const variants = state.options.ruleset.variants
  const shared = Boolean(variants?.sharedBoard)
  const sync = Boolean(variants?.syncDraw)

  // Plateau commun : « tching ! » — le delta se mesure sur le PLATEAU entier,
  // à travers la couleur secrète et les couleurs interdites du poseur, mais
  // sans sa cagnotte (c'est elle qu'on alimente).
  const lens = shared
    ? { secretColor: player.secretColor, forbiddenColors: player.forbiddenColors }
    : player
  const before = scoreOf(player.board, ruleset, lens)
  // En Plateau commun, chaque manche pose un rang de plus : le numéro de tour
  // doit rester unique par tuile pour l'ordre de pose (teintures, cristaux…).
  const roundStamp = shared ? state.round * state.players.length + state.turnIndex : state.round
  const board = placeTile(
    player.board,
    move.cell,
    move.tileId,
    move.rot,
    roundStamp,
    move.flipped,
    shared ? playerId : undefined,
  )
  const after = scoreOf(board, ruleset, lens)

  // Plateau commun : tout le monde regarde le même plateau, il change pour
  // tous — et le poseur encaisse son delta immédiatement.
  const players = state.players.map((q, i) => {
    if (i === playerId) {
      const banked = shared ? { banked: (q.banked ?? 0) + (after - before) } : {}
      return move.personal
        ? { ...q, board, personalUsed: true, ...banked }
        : { ...q, board, ...banked }
    }
    return shared ? { ...q, board } : q
  })

  // Partie synchrone : la tuile commune reste disponible pour les suivants.
  const pool =
    move.personal || sync
      ? state.pool
      : state.pool.map((p) => (p.tileId === move.tileId ? { ...p, takenBy: playerId } : p))

  const log = state.log.concat({
    round: state.round,
    playerId,
    tileId: move.tileId,
    rot: move.rot,
    cell: move.cell,
    pickOrder: state.turnIndex,
    choicesAvailable: availableTiles(state).length,
    scoreAfter: shared ? (players[playerId].banked ?? 0) : after,
    delta: after - before,
  })

  let next: GameState = {
    ...state,
    players,
    pool,
    log,
    turnIndex: state.turnIndex + 1,
    mustTakeTileId: undefined,
  }

  // Fin du tour : tous les joueurs ont choisi une tuile.
  if (next.turnIndex >= next.players.length) {
    // La courbe doit raconter la même histoire que le classement final :
    // on y met le score complet, carte mission comprise.
    const totals = roundTotals(next, ruleset)
    const scoreHistory = next.scoreHistory.map((h, i) => h.concat(totals[i]))
    const round = next.round + 1
    const finished = round >= next.totalRounds || next.players.every((p) => isFull(p.board))
    const swap =
      next.options.ruleset.variants?.boardSwap &&
      next.swapCard === 'rotate' &&
      round === swapRound(next.options.ruleset) &&
      next.players.length > 1
    next = {
      ...next,
      players: swap ? rotateBoards(next.players) : next.players,
      scoreHistory,
      round,
      turnIndex: 0,
      bagHolder: nextBagHolder(next),
      phase: finished ? 'finished' : 'playing',
    }
    if (!finished) next = drawPool(next)
    else next = { ...next, pool: [] }
  }

  return next
}

/** Score complet de chaque joueur à cet instant, cartes missions comprises. */
function roundTotals(state: GameState, baseRuleset: Ruleset): number[] {
  if (!state.options.useCards && !state.options.personalCards) {
    return state.players.map((p) => scoreOf(p.board, baseRuleset, p))
  }
  return state.players.map((p) => {
    const ruleset = rulesetForPlayer(state, p.id)
    const table = cardTable(state.players, ruleset)
    return applyCards(
      scoreBoard(p.board, ruleset, p),
      { playerId: p.id, board: p.board, boardColor: p.boardColor, ruleset, table },
      playerCardIds(state, p.id),
      state.cardColors,
      state.cardAxes,
    ).total
  })
}

export function isBot(player: Player): boolean {
  return player.kind !== 'human'
}
