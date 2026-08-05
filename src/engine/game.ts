import { createBoard, isFull, legalCells, placeTile } from './board.ts'
import { CARDS } from './cards.ts'
import { Rng } from './rng.ts'
import { scoreOf } from './scoring.ts'
import { TILE_COUNT } from './tiles.ts'
import type {
  BoardColor,
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
  return ruleset.boardSize * ruleset.boardSize * tilesPerRound(ruleset, playerCount)
}

export function configError(config: GameConfig): string | null {
  const n = config.players.length
  if (n < 1 || n > 6) return 'Il faut entre 1 et 6 joueurs.'
  const colors = config.players.map((p) => p.boardColor)
  if (new Set(colors).size !== colors.length) {
    return 'Deux joueurs ne peuvent pas prendre le même plateau : choisissez des couleurs différentes.'
  }
  const needed = tilesNeeded(config.options.ruleset, n)
  if (needed > TILE_COUNT) {
    return `Il faudrait ${needed} tuiles pour cette configuration, le sac n'en contient que ${TILE_COUNT}. Réduisez la taille du plateau, le nombre de tuiles par tour ou le nombre de joueurs.`
  }
  return null
}

export function createGame(config: GameConfig): GameState {
  const rng = new Rng(config.options.seed)
  const size = config.options.ruleset.boardSize
  const players: Player[] = config.players.map((p, i) => ({
    id: i,
    name: p.name.trim() || `Joueur ${i + 1}`,
    kind: p.kind,
    boardColor: p.boardColor,
    color: BOARD_COLOR_HEX[p.boardColor],
    board: createBoard(size),
  }))

  // Une seule carte mission pour toute la table.
  const cardId = config.options.useCards
    ? (config.options.cardId ?? rng.pick(CARDS).id)
    : undefined

  const bag = rng.shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i))
  const state: GameState = {
    phase: 'playing',
    options: config.options,
    cardId,
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
  const bag = state.bag.slice()
  const pool: PoolTile[] = []
  for (let i = 0; i < count && bag.length; i++) {
    pool.push({ tileId: bag.pop() as number, takenBy: null })
  }
  return { ...state, bag, pool }
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
}

export function isLegalMove(state: GameState, move: Move): boolean {
  if (state.phase !== 'playing') return false
  const pool = state.pool.find((p) => p.tileId === move.tileId && p.takenBy === null)
  if (!pool) return false
  const player = currentPlayer(state)
  if (player.board.cells[move.cell] !== null) return false
  return currentLegalCells(state).includes(move.cell)
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
  const ruleset = state.options.ruleset

  const before = scoreOf(player.board, ruleset)
  const board = placeTile(player.board, move.cell, move.tileId, move.rot, state.round)
  const after = scoreOf(board, ruleset)

  const players = state.players.slice()
  players[playerId] = { ...player, board }

  const pool = state.pool.map((p) =>
    p.tileId === move.tileId ? { ...p, takenBy: playerId } : p,
  )

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
    const scoreHistory = next.scoreHistory.map((h, i) =>
      h.concat(scoreOf(next.players[i].board, ruleset)),
    )
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

export function isBot(player: Player): boolean {
  return player.kind !== 'human'
}
