import type { Board, Color, PlacedTile, Rotation } from './types.ts'
import { tileQuads } from './tiles.ts'

export function createBoard(size: number): Board {
  return { size, cells: new Array(size * size).fill(null) }
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: board.cells.slice() }
}

export function idx(size: number, row: number, col: number): number {
  return row * size + col
}

export function rowOf(size: number, i: number): number {
  return Math.floor(i / size)
}

export function colOf(size: number, i: number): number {
  return i % size
}

export function isEmpty(board: Board): boolean {
  return board.cells.every((c) => c === null)
}

export function isFull(board: Board): boolean {
  return board.cells.every((c) => c !== null)
}

export function placedCount(board: Board): number {
  return board.cells.reduce((n, c) => n + (c ? 1 : 0), 0)
}

/** Voisins orthogonaux d'une case du plateau. */
export function neighbours(size: number, i: number): number[] {
  const r = rowOf(size, i)
  const c = colOf(size, i)
  const out: number[] = []
  if (r > 0) out.push(i - size)
  if (r < size - 1) out.push(i + size)
  if (c > 0) out.push(i - 1)
  if (c < size - 1) out.push(i + 1)
  return out
}

/**
 * Cases où l'on peut poser une tuile : vides et adjacentes à une tuile déjà
 * en place (toutes les cases si le plateau est vide).
 */
export function legalCells(board: Board, requireAdjacency = true): number[] {
  const empty = board.cells.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0)
  if (!requireAdjacency || isEmpty(board)) return empty
  return empty.filter((i) => neighbours(board.size, i).some((n) => board.cells[n] !== null))
}

export function placeTile(
  board: Board,
  cell: number,
  tileId: number,
  rot: Rotation,
  round: number,
): Board {
  const next = cloneBoard(board)
  next.cells[cell] = { tileId, rot, round }
  return next
}

/**
 * Grille des quarts de tuile : 2N x 2N. C'est sur cette grille que sont
 * calculées les zones de couleur. `null` = quart non posé.
 */
export type QuadGrid = {
  size: number // 2 * board.size
  cells: (Color | null)[]
}

export function quadGrid(board: Board): QuadGrid {
  const qs = board.size * 2
  const cells: (Color | null)[] = new Array(qs * qs).fill(null)
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i] as PlacedTile | null
    if (!placed) continue
    const r = rowOf(board.size, i) * 2
    const c = colOf(board.size, i) * 2
    const q = tileQuads(placed.tileId, placed.rot)
    cells[r * qs + c] = q[0] // haut-gauche
    cells[r * qs + c + 1] = q[1] // haut-droite
    cells[(r + 1) * qs + c + 1] = q[2] // bas-droite
    cells[(r + 1) * qs + c] = q[3] // bas-gauche
  }
  return { size: qs, cells }
}

/** Case du plateau (tuile) à laquelle appartient un quart. */
export function tileOfQuad(boardSize: number, qi: number): number {
  const qs = boardSize * 2
  const qr = Math.floor(qi / qs)
  const qc = qi % qs
  return Math.floor(qr / 2) * boardSize + Math.floor(qc / 2)
}
