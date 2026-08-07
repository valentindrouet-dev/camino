import { quadGrid, tileOfQuad } from './board.ts'
import { cloverQuadIndex, faultAxis, starQuadIndex } from './tiles.ts'
import type { Board, Color, ColorScore, Ruleset, ScoreBreakdown, Side, Zone } from './types.ts'
import { BLACK, COLORS, PATH_COLORS, WHITE } from './types.ts'

/**
 * Règle de comptage (validée sur l'exemple de fin de règle) :
 *
 *  - une « zone » est un groupe de quarts de MÊME COULEUR connectés
 *    orthogonalement, y compris à travers la frontière entre deux tuiles ;
 *  - ce qui rapporte des points, c'est le nombre de TUILES DISTINCTES que la
 *    zone traverse (et non son nombre de quarts) : 3 tuiles = 3 pts, 4 = 5,
 *    5 = 8, 6 = 12, 7 = 17, 8 = 23, 9 et + = 30 ;
 *  - chaque zone noire, quelle que soit sa taille, enlève 2 points.
 */

export function pointsForSpan(span: number, ruleset: Ruleset): number {
  if (span < ruleset.minSpan) return 0
  const table = ruleset.pointsBySpan
  return table[Math.min(span, table.length - 1)] ?? 0
}

/**
 * Points d'un groupe d'étoiles : une étoile seule vaut 1 point, chaque étoile
 * reliée à au moins une autre en vaut 2 — un groupe de N ≥ 2 vaut donc 2×N.
 */
export function starClusterPoints(count: number): number {
  return count <= 1 ? Math.max(0, count) : 2 * count
}

/**
 * Variante Failles : la faille coupe une tuile en deux moitiés qui ne se
 * relient pas entre elles. Seules les arêtes INTERNES à une tuile peuvent être
 * bloquées — la frontière entre deux tuiles n'est jamais concernée.
 */
function faultBlocks(board: Board, a: number, b: number): boolean {
  const tile = tileOfQuad(board.size, a)
  if (tile !== tileOfQuad(board.size, b)) return false
  const placed = board.cells[tile]
  if (!placed) return false
  const axis = faultAxis(placed.tileId, placed.rot, placed.flipped)
  if (axis === null) return false
  const qs = board.size * 2
  // faille verticale (0) : elle sépare la gauche de la droite, donc bloque les
  // voisins horizontaux ; faille horizontale (1) : l'inverse.
  return axis === 0 ? a % qs !== b % qs : Math.floor(a / qs) !== Math.floor(b / qs)
}

/** Cases de bordure adjacentes à un quart donné, avec leur couleur. */
function borderNeighbours(board: Board, qi: number): { id: number; color: Color }[] {
  const spec = board.borders
  if (!spec) return []
  const qs = board.size * 2
  const r = Math.floor(qi / qs)
  const c = qi % qs
  const out: { id: number; color: Color }[] = []
  const touch = (side: Side, index: number) => {
    if (spec.kind === 'uniform') {
      // un bloc par côté : le côté touché compte pour une case, une seule fois
      out.push({ id: -(side + 1), color: spec.color })
    } else {
      const color = spec.squares[side][index]
      if (color !== WHITE) out.push({ id: -(1 + side * 100 + index), color })
    }
  }
  if (r === 0) touch(0, c)
  if (c === qs - 1) touch(1, r)
  if (r === qs - 1) touch(2, c)
  if (c === 0) touch(3, r)
  return out
}

/**
 * Toutes les zones du plateau (couleurs + noir), avec leur valeur.
 *
 * Variantes prises en compte :
 *  - tuiles blanches : un quart blanc appartient aux chemins de TOUTES les
 *    couleurs qui le touchent (il peut relier deux chemins d'une même
 *    couleur) ; il ne rejoint jamais le noir ;
 *  - bordures : une case de bordure reliée à un chemin de sa couleur compte
 *    comme une case de plus, mais ne relie JAMAIS deux chemins entre eux ;
 *  - étoiles magiques : comptées par zone (voir scoreBoard).
 */
export function computeZones(board: Board, ruleset: Ruleset): Zone[] {
  const grid = quadGrid(board)
  const qs = grid.size
  const zones: Zone[] = []
  const stack: number[] = []
  const faults = Boolean(ruleset.variants?.faultTiles)

  // --- zones noires : inchangées, le blanc et les bordures ne comptent pas
  {
    const seen = new Uint8Array(qs * qs)
    for (let start = 0; start < grid.cells.length; start++) {
      if (grid.cells[start] !== BLACK || seen[start]) continue
      seen[start] = 1
      stack.length = 0
      stack.push(start)
      const cells: number[] = []
      const tiles = new Set<number>()
      while (stack.length) {
        const cur = stack.pop() as number
        cells.push(cur)
        tiles.add(tileOfQuad(board.size, cur))
        const r = Math.floor(cur / qs)
        const c = cur % qs
        for (const n of [r > 0 ? cur - qs : -1, r < qs - 1 ? cur + qs : -1, c > 0 ? cur - 1 : -1, c < qs - 1 ? cur + 1 : -1]) {
          if (n >= 0 && !seen[n] && grid.cells[n] === BLACK && !(faults && faultBlocks(board, cur, n))) {
            seen[n] = 1
            stack.push(n)
          }
        }
      }
      zones.push({
        color: BLACK,
        cells: cells.sort((a, b) => a - b),
        tiles: [...tiles].sort((a, b) => a - b),
        borders: 0,
        stars: 0,
        span: tiles.size,
        points: ruleset.blackPenalty,
      })
    }
  }

  // --- chemins de couleur : le blanc sert de joker, les bordures de rallonge
  for (const color of PATH_COLORS) {
    const seen = new Uint8Array(qs * qs)
    const colorZones: { cells: number[]; tiles: Set<number>; borderIds: Set<number> }[] = []
    for (let start = 0; start < grid.cells.length; start++) {
      // une zone part toujours d'un quart de la couleur elle-même
      if (grid.cells[start] !== color || seen[start]) continue
      seen[start] = 1
      stack.length = 0
      stack.push(start)
      const cells: number[] = []
      const tiles = new Set<number>()
      const borderIds = new Set<number>()
      while (stack.length) {
        const cur = stack.pop() as number
        cells.push(cur)
        tiles.add(tileOfQuad(board.size, cur))
        for (const b of borderNeighbours(board, cur)) {
          if (b.color === color) borderIds.add(b.id)
        }
        const r = Math.floor(cur / qs)
        const c = cur % qs
        for (const n of [r > 0 ? cur - qs : -1, r < qs - 1 ? cur + qs : -1, c > 0 ? cur - 1 : -1, c < qs - 1 ? cur + 1 : -1]) {
          if (n < 0 || seen[n]) continue
          if (faults && faultBlocks(board, cur, n)) continue
          const nc = grid.cells[n]
          if (nc === color || nc === WHITE) {
            seen[n] = 1
            stack.push(n)
          }
        }
      }
      colorZones.push({ cells, tiles, borderIds })
    }

    // Les bordures rallongent le chemin qui les touche mais ne relient jamais
    // deux chemins. Multicolore : chaque carré touché compte une case.
    // Colorée : toucher le bord vaut +1 EN TOUT, qu'on touche un côté, le
    // même plusieurs fois ou plusieurs côtés différents.
    const uniformBorder = board.borders?.kind === 'uniform'
    for (const z of colorZones) {
      const borderCount = uniformBorder
        ? (z.borderIds.size > 0 ? 1 : 0)
        : z.borderIds.size
      const span = z.tiles.size + borderCount
      zones.push({
        color,
        cells: z.cells.sort((a, b) => a - b),
        tiles: [...z.tiles].sort((a, b) => a - b),
        borders: borderCount,
        borderIds: [...z.borderIds].sort((a, b) => b - a),
        stars: 0,
        span,
        points: pointsForSpan(span, ruleset),
      })
    }
  }
  return zones
}

/** Groupe d'étoiles adjacentes sur un plateau. */
export interface StarCluster {
  /** Index des quarts étoilés (grille 2N x 2N). */
  cells: number[]
  count: number
  points: number
}

/**
 * Les étoiles se groupent par simple ADJACENCE de leurs quarts (orthogonale,
 * frontières de tuiles comprises) — pas besoin d'être reliées par un chemin.
 */
export function starClusters(board: Board): StarCluster[] {
  const qs = board.size * 2
  const starred = new Set<number>()
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i]
    if (!placed) continue
    const starQuad = starQuadIndex(placed.tileId, placed.rot, placed.flipped)
    if (starQuad === null) continue
    const r = Math.floor(i / board.size) * 2 + (starQuad >= 2 ? 1 : 0)
    const c = (i % board.size) * 2 + (starQuad === 1 || starQuad === 2 ? 1 : 0)
    starred.add(r * qs + c)
  }
  const seen = new Set<number>()
  const clusters: StarCluster[] = []
  for (const start of starred) {
    if (seen.has(start)) continue
    const cells: number[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const cur = stack.pop() as number
      cells.push(cur)
      const r = Math.floor(cur / qs)
      const c = cur % qs
      for (const n of [r > 0 ? cur - qs : -1, r < qs - 1 ? cur + qs : -1, c > 0 ? cur - 1 : -1, c < qs - 1 ? cur + 1 : -1]) {
        if (n >= 0 && starred.has(n) && !seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
    clusters.push({
      cells: cells.sort((a, b) => a - b),
      count: cells.length,
      points: starClusterPoints(cells.length),
    })
  }
  return clusters
}

function countStars(board: Board): number {
  let total = 0
  for (const c of starClusters(board)) total += c.points
  return total
}

export function scoreBoard(
  board: Board,
  ruleset: Ruleset,
  /** Couleur secrète du joueur (variante) : son meilleur chemin est doublé. */
  secretColor?: Color,
): ScoreBreakdown {
  const zones = computeZones(board, ruleset)
  const byColor = {} as Record<Color, ColorScore>
  for (const c of COLORS) byColor[c] = { color: c, points: 0, scoringZones: [], zones: [] }

  let colorPoints = 0
  let blackZones = 0

  for (const z of zones) {
    byColor[z.color].zones.push(z)
    if (z.color === BLACK) {
      blackZones++
      byColor[BLACK].points += ruleset.blackPenalty
      byColor[BLACK].scoringZones.push(z)
    } else if (z.points > 0) {
      colorPoints += z.points
      byColor[z.color].points += z.points
      byColor[z.color].scoringZones.push(z)
    }
  }

  const starPoints = ruleset.variants?.magicStars ? countStars(board) : 0
  const cloverPoints = ruleset.variants?.clovers ? countClovers(board, zones) : 0
  const secretPoints = ruleset.variants?.secretColor ? secretBonus(zones, secretColor) : 0
  const blackPoints = blackZones * ruleset.blackPenalty
  return {
    total: colorPoints + blackPoints + starPoints + cloverPoints + secretPoints,
    colorPoints,
    blackZones,
    blackPoints,
    starPoints,
    cloverPoints,
    secretPoints,
    cardPoints: 0,
    byColor,
    zones,
  }
}

/**
 * Trèfles (variante) : un trèfle posé dans un chemin qui marque rapporte +3,
 * sinon il coûte 3 points. Un trèfle sur un quart blanc profite de n'importe
 * quel chemin qui marque et le traverse.
 */
export function countClovers(board: Board, zones: Zone[]): number {
  const qs = board.size * 2
  const scoring = new Set<number>()
  for (const z of zones) {
    if (z.color === BLACK || z.points <= 0) continue
    for (const c of z.cells) scoring.add(c)
  }
  let total = 0
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i]
    if (!placed) continue
    const cq = cloverQuadIndex(placed.tileId, placed.rot, placed.flipped)
    if (cq === null) continue
    const r = Math.floor(i / board.size) * 2 + (cq >= 2 ? 1 : 0)
    const c = (i % board.size) * 2 + (cq === 1 || cq === 2 ? 1 : 0)
    total += scoring.has(r * qs + c) ? 3 : -3
  }
  return total
}

/** Couleur secrète (variante) : le meilleur chemin de cette couleur est doublé. */
export function secretBonus(zones: Zone[], color: Color | undefined): number {
  if (!color) return 0
  let best = 0
  for (const z of zones) {
    if (z.color === color && z.points > best) best = z.points
  }
  return best
}

/** Score total uniquement — chemin rapide utilisé par l'IA et les simulations. */
export function scoreOf(board: Board, ruleset: Ruleset, secretColor?: Color): number {
  const zones = computeZones(board, ruleset)
  let total = 0
  for (const z of zones) total += z.points
  if (ruleset.variants?.magicStars) total += countStars(board)
  if (ruleset.variants?.clovers) total += countClovers(board, zones)
  if (ruleset.variants?.secretColor) total += secretBonus(zones, secretColor)
  return total
}

/** Zone (index dans le tableau) à laquelle appartient chaque quart, ou -1. */
export function zoneMap(zones: Zone[], quadCount: number): Int16Array {
  const map = new Int16Array(quadCount).fill(-1)
  zones.forEach((z, i) => {
    for (const c of z.cells) map[c] = i
  })
  return map
}

/** Libellé lisible d'une zone, pour les infobulles. */
/** Nombre signé, pour ne jamais laisser planer de doute sur un bonus. */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

export function zoneLabel(zone: Zone, ruleset: Ruleset): string {
  if (zone.color === BLACK) {
    return `Zone noire — ${signed(ruleset.blackPenalty)} pt${
      Math.abs(ruleset.blackPenalty) > 1 ? 's' : ''
    }`
  }
  const suffix = zone.borders
    ? ` (dont ${zone.borders} bordure${zone.borders > 1 ? 's' : ''})`
    : ''
  const t = `${zone.span} tuile${zone.span > 1 ? 's' : ''}`
  return zone.points > 0
    ? `${t} — ${signed(zone.points)} pts${suffix}`
    : `${t} — 0 pt (minimum ${ruleset.minSpan})${suffix}`
}

export const COLOR_NAMES: Record<Color, string> = {
  Y: 'Jaune',
  O: 'Orange',
  R: 'Rouge',
  G: 'Vert',
  B: 'Bleu',
  P: 'Violet',
  K: 'Noir',
  W: 'Blanc',
}

export const COLOR_HEX: Record<Color, string> = {
  Y: '#FFF101',
  O: '#F7931D',
  R: '#D1232A',
  G: '#40AE49',
  B: '#0095D9',
  P: '#6850A1',
  K: '#231F20',
  W: '#FFFFFF',
}

export { PATH_COLORS, BLACK }
