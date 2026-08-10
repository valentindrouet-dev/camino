import type { Board, Color, PlacedTile, Rotation, Ruleset } from './types.ts'
import { dyeAt, faultAxis, tileQuads, WINDMILLS } from './tiles.ts'

export function createBoard(size: number): Board {
  return { size, cells: new Array(size * size).fill(null) }
}

/**
 * Plateau rectangulaire (variante Plateau commun) : `size` reste la LARGEUR —
 * c'est le pas d'indexation — et la hauteur se déduit du nombre de cases.
 */
export function createBoardRect(width: number, height: number): Board {
  return { size: width, cells: new Array(width * height).fill(null) }
}

/** Hauteur d'un plateau en tuiles (= sa largeur, sauf plateau commun). */
export function boardRows(board: Board): number {
  return board.cells.length / board.size
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: board.cells.slice(), borders: board.borders }
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

/**
 * Voisins orthogonaux d'une case du plateau. `size` est la largeur ;
 * `cellCount` permet les plateaux rectangulaires (hauteur = cases / largeur).
 */
export function neighbours(size: number, i: number, cellCount = size * size): number[] {
  const rows = cellCount / size
  const r = rowOf(size, i)
  const c = colOf(size, i)
  const out: number[] = []
  if (r > 0) out.push(i - size)
  if (r < rows - 1) out.push(i + size)
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
  return empty.filter((i) =>
    neighbours(board.size, i, board.cells.length).some((n) => board.cells[n] !== null),
  )
}

export function placeTile(
  board: Board,
  cell: number,
  tileId: number,
  rot: Rotation,
  round: number,
  flipped = false,
  /** Joueur qui pose — renseigné en Plateau commun, pour l'attribution. */
  by?: number,
): Board {
  const next = cloneBoard(board)
  next.cells[cell] = {
    tileId,
    rot,
    round,
    ...(flipped ? { flipped } : {}),
    ...(by !== undefined ? { by } : {}),
  }
  return next
}

/**
 * Effets qui changent la lecture du plateau (variantes). Ils sont appliqués au
 * moment de construire la grille des quarts : tout ce qui lit la grille —
 * zones, score, IA, affichage — les voit donc sans code particulier.
 */
export interface GridEffects {
  /** Moulins : les tuiles voisines d'un moulin posé après elles ont tourné. */
  windmills?: boolean
  /** Teintures : les zones noires touchées par un pot ont pris sa couleur. */
  dyes?: boolean
  /** Failles : une faille bloque les liens internes d'une tuile. */
  faults?: boolean
}

/** Effets de grille induits par les variantes d'un barème. */
export function gridEffects(ruleset: Ruleset): GridEffects | undefined {
  const v = ruleset.variants
  if (!v?.windmills && !v?.dyes) return v?.faultTiles ? { faults: true } : undefined
  return { windmills: !!v.windmills, dyes: !!v.dyes, faults: !!v.faultTiles }
}

/**
 * Rotation effective d'une tuile : celle de sa pose, plus un quart de tour à
 * gauche par moulin voisin posé APRÈS elle (variante Moulins). Les tuiles
 * posées après un moulin ne sont pas affectées — l'effet n'a lieu qu'à la pose.
 */
export function effectiveRot(board: Board, cell: number, windmills = false): Rotation {
  const placed = board.cells[cell] as PlacedTile
  if (!windmills) return placed.rot
  let turns = 0
  for (const n of neighbours(board.size, cell, board.cells.length)) {
    const p = board.cells[n]
    if (p && WINDMILLS.has(p.tileId) && p.round > placed.round) turns++
  }
  // « vers la gauche » = antihoraire = un cran de rotation en moins
  return ((placed.rot + 3 * turns) % 4) as Rotation
}

/**
 * Variante Failles : la faille coupe une tuile en deux moitiés qui ne se
 * relient pas entre elles. Seules les arêtes INTERNES à une tuile peuvent être
 * bloquées — la frontière entre deux tuiles n'est jamais concernée.
 */
export function faultBlocks(board: Board, a: number, b: number, windmills = false): boolean {
  const tile = tileOfQuad(board.size, a)
  if (tile !== tileOfQuad(board.size, b)) return false
  const placed = board.cells[tile]
  if (!placed) return false
  const axis = faultAxis(placed.tileId, effectiveRot(board, tile, windmills), placed.flipped)
  if (axis === null) return false
  const qs = board.size * 2
  // faille verticale (0) : elle sépare la gauche de la droite, donc bloque les
  // voisins horizontaux ; faille horizontale (1) : l'inverse.
  return axis === 0 ? a % qs !== b % qs : Math.floor(a / qs) !== Math.floor(b / qs)
}

/**
 * Grille des quarts de tuile : 2N x 2N. C'est sur cette grille que sont
 * calculées les zones de couleur. `null` = quart non posé.
 */
export type QuadGrid = {
  size: number // 2 * board.size
  cells: (Color | null)[]
}

export function quadGrid(board: Board, fx?: GridEffects): QuadGrid {
  const qs = board.size * 2
  const cells: (Color | null)[] = new Array(board.cells.length * 4).fill(null)
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i] as PlacedTile | null
    if (!placed) continue
    const r = rowOf(board.size, i) * 2
    const c = colOf(board.size, i) * 2
    const q = tileQuads(placed.tileId, effectiveRot(board, i, fx?.windmills), placed.flipped)
    cells[r * qs + c] = q[0] // haut-gauche
    cells[r * qs + c + 1] = q[1] // haut-droite
    cells[(r + 1) * qs + c + 1] = q[2] // bas-droite
    cells[(r + 1) * qs + c] = q[3] // bas-gauche
  }
  if (fx?.dyes) applyDyes(board, cells, fx)
  return { size: qs, cells }
}

/** Les quatre quarts d'une case du plateau, en indices de la grille 2N x 2N. */
function quadIndicesOf(boardSize: number, cell: number): [number, number, number, number] {
  const qs = boardSize * 2
  const r = rowOf(boardSize, cell) * 2
  const c = colOf(boardSize, cell) * 2
  return [r * qs + c, r * qs + c + 1, (r + 1) * qs + c + 1, (r + 1) * qs + c]
}

/**
 * Teintures : on rejoue la partie dans l'ordre de pose. Quand une tuile à
 * teinture arrive, toute zone noire alors adjacente au pot prend sa couleur —
 * définitivement. Le noir posé PLUS TARD contre un pot, lui, reste noir.
 * (Avec les Moulins, les orientations utilisées sont les orientations finales.)
 */
function applyDyes(board: Board, cells: (Color | null)[], fx: GridEffects): void {
  const qs = board.size * 2
  const qh = cells.length / qs
  const order = board.cells
    .map((p, i) => (p ? { p: p as PlacedTile, i } : null))
    .filter((x): x is { p: PlacedTile; i: number } => x !== null)
    .sort((a, b) => a.p.round - b.p.round)
  const revealed = new Uint8Array(cells.length)
  for (const { p, i } of order) {
    for (const qi of quadIndicesOf(board.size, i)) revealed[qi] = 1
    const dye = dyeAt(p.tileId, effectiveRot(board, i, fx.windmills), p.flipped)
    if (!dye) continue
    // position du quart teinté dans la grille
    const [tl, tr, br, bl] = quadIndicesOf(board.size, i)
    const dq = [tl, tr, br, bl][dye.quad]
    const r = Math.floor(dq / qs)
    const c = dq % qs
    const voisins = [r > 0 ? dq - qs : -1, r < qh - 1 ? dq + qs : -1, c > 0 ? dq - 1 : -1, c < qs - 1 ? dq + 1 : -1]
    for (const start of voisins) {
      if (start < 0 || !revealed[start] || cells[start] !== 'K') continue
      if (fx.faults && faultBlocks(board, dq, start, fx.windmills)) continue
      // toute la zone noire adjacente prend la couleur du pot
      const stack = [start]
      cells[start] = dye.color
      while (stack.length) {
        const cur = stack.pop() as number
        const cr = Math.floor(cur / qs)
        const cc = cur % qs
        for (const n of [cr > 0 ? cur - qs : -1, cr < qh - 1 ? cur + qs : -1, cc > 0 ? cur - 1 : -1, cc < qs - 1 ? cur + 1 : -1]) {
          if (n < 0 || !revealed[n] || cells[n] !== 'K') continue
          if (fx.faults && faultBlocks(board, cur, n, fx.windmills)) continue
          cells[n] = dye.color
          stack.push(n)
        }
      }
    }
  }
}

/** Case du plateau (tuile) à laquelle appartient un quart. */
export function tileOfQuad(boardSize: number, qi: number): number {
  const qs = boardSize * 2
  const qr = Math.floor(qi / qs)
  const qc = qi % qs
  return Math.floor(qr / 2) * boardSize + Math.floor(qc / 2)
}
