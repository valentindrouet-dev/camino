import { createBoard, isFull, legalCells, placeTile } from './board.ts'
import { activeRuleset, applyCards, cardTable, CARDS, playerCardIds, rulesetForPlayer } from './cards.ts'
import { Rng } from './rng.ts'
import { scoreBoard, scoreOf } from './scoring.ts'
import { MONO_TILE_IDS, TILE_COUNT, TILES, WHITE_TILE_IDS } from './tiles.ts'
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
import { DEFAULT_RULESET } from './types.ts'

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

/** Nombre de tuiles révélées au centre à chaque tour. */
export function tilesPerRound(ruleset: Ruleset, playerCount: number): number {
  if (ruleset.tilesPerRound > 0) return ruleset.tilesPerRound
  // Règle officielle : autant de tuiles que de joueurs.
  // En solo on en propose 2 pour qu'il reste un choix à faire.
  return playerCount === 1 ? 2 : playerCount
}

/** Nombre de tuiles nécessaires pour aller au bout de la partie. */
export function tilesNeeded(ruleset: Ruleset, playerCount: number): number {
  const reserve = ruleset.variants?.personalTile ? playerCount : 0
  return ruleset.boardSize * ruleset.boardSize * tilesPerRound(ruleset, playerCount) + reserve
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
  const size = config.options.ruleset.boardSize
  const ruleset = config.options.ruleset
  const players: Player[] = config.players.map((p, i) => ({
    id: i,
    name: p.name.trim() || `Joueur ${i + 1}`,
    kind: p.kind,
    boardColor: p.boardColor,
    color: BOARD_COLOR_HEX[p.boardColor],
    board: { ...createBoard(size), borders: bordersFor(ruleset, p.boardColor) },
  }))

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
    players,
    bag,
    pool: [],
    round: 0,
    totalRounds: size * size,
    bagHolder: 0,
    turnIndex: 0,
    log: [],
    scoreHistory: players.map(() => []),
  }
  return drawPool(state)
}

function drawPool(state: GameState): GameState {
  const count = tilesPerRound(state.options.ruleset, state.players.length)
  // Les tuiles restées au centre (tuile personnelle jouée à la place)
  // retournent au fond du sac.
  const leftovers = state.pool.filter((p) => p.takenBy === null).map((p) => p.tileId)
  const bag = [...leftovers, ...state.bag]
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

  const before = scoreOf(player.board, ruleset)
  const board = placeTile(
    player.board,
    move.cell,
    move.tileId,
    move.rot,
    state.round,
    move.flipped,
  )
  const after = scoreOf(board, ruleset)

  const players = state.players.slice()
  players[playerId] = move.personal
    ? { ...player, board, personalUsed: true }
    : { ...player, board }

  const pool = move.personal
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
    scoreAfter: after,
    delta: after - before,
  })

  let next: GameState = { ...state, players, pool, log, turnIndex: state.turnIndex + 1 }

  // Fin du tour : tous les joueurs ont choisi une tuile.
  if (next.turnIndex >= next.players.length) {
    // La courbe doit raconter la même histoire que le classement final :
    // on y met le score complet, carte mission comprise.
    const totals = roundTotals(next, ruleset)
    const scoreHistory = next.scoreHistory.map((h, i) => h.concat(totals[i]))
    const round = next.round + 1
    const finished = round >= next.totalRounds || next.players.every((p) => isFull(p.board))
    next = {
      ...next,
      scoreHistory,
      round,
      turnIndex: 0,
      bagHolder: (next.bagHolder + 1) % next.players.length,
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
    return state.players.map((p) => scoreOf(p.board, baseRuleset))
  }
  return state.players.map((p) => {
    const ruleset = rulesetForPlayer(state, p.id)
    const table = cardTable(state.players, ruleset)
    return applyCards(
      scoreBoard(p.board, ruleset),
      { playerId: p.id, board: p.board, ruleset, table },
      playerCardIds(state, p.id),
    ).total
  })
}

export function isBot(player: Player): boolean {
  return player.kind !== 'human'
}
