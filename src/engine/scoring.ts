import { quadGrid, tileOfQuad } from './board.ts'
import { starQuadIndex } from './tiles.ts'
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

/** Points d'un groupe d'étoiles reliées : 1, 3, 6, 10, puis 20 dès 5. */
export const STAR_POINTS = [0, 1, 3, 6, 10, 20]

export function starClusterPoints(count: number): number {
  return STAR_POINTS[Math.min(count, STAR_POINTS.length - 1)]
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
      // un seul « nœud » par côté : tout le bord est de la couleur du joueur
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
 *    comme une case de plus et peut relier deux chemins entre eux ;
 *  - étoiles magiques : comptées par zone (voir scoreBoard).
 */
export function computeZones(board: Board, ruleset: Ruleset): Zone[] {
  const grid = quadGrid(board)
  const qs = grid.size
  const zones: Zone[] = []
  const stack: number[] = []

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
          if (n >= 0 && !seen[n] && grid.cells[n] === BLACK) {
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
          const nc = grid.cells[n]
          if (nc === color || nc === WHITE) {
            seen[n] = 1
            stack.push(n)
          }
        }
      }
      colorZones.push({ cells, tiles, borderIds })
    }

    // Une case de bordure est un vrai morceau de chemin : deux zones de la
    // même couleur qui touchent la même case de bordure ne font qu'une.
    let merged = true
    while (merged) {
      merged = false
      outer: for (let i = 0; i < colorZones.length; i++) {
        for (let j = i + 1; j < colorZones.length; j++) {
          const shared = [...colorZones[i].borderIds].some((id) => colorZones[j].borderIds.has(id))
          if (!shared) continue
          const a = colorZones[i]
          const b = colorZones.splice(j, 1)[0]
          a.cells.push(...b.cells)
          for (const t of b.tiles) a.tiles.add(t)
          for (const id of b.borderIds) a.borderIds.add(id)
          merged = true
          break outer
        }
      }
    }

    for (const z of colorZones) {
      const span = z.tiles.size + z.borderIds.size
      zones.push({
        color,
        cells: z.cells.sort((a, b) => a - b),
        tiles: [...z.tiles].sort((a, b) => a - b),
        borders: z.borderIds.size,
        stars: 0,
        span,
        points: pointsForSpan(span, ruleset),
      })
    }
  }
  return zones
}

/**
 * Groupes d'étoiles par zone : chaque quart étoilé est rattaché à la zone de
 * SA couleur qui le contient. Les compteurs sont écrits dans zone.stars.
 */
function countStars(board: Board, zones: Zone[]): number {
  if (!board.borders && !zones.length) return 0
  const qs = board.size * 2
  let total = 0
  const perZone = new Map<Zone, number>()
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i]
    if (!placed) continue
    const starQuad = starQuadIndex(placed.tileId, placed.rot, placed.flipped)
    if (starQuad === null) continue
    // index du quart étoilé dans la grille 2N x 2N
    const r = Math.floor(i / board.size) * 2 + (starQuad >= 2 ? 1 : 0)
    const c = (i % board.size) * 2 + (starQuad === 1 || starQuad === 2 ? 1 : 0)
    const qi = r * qs + c
    const zone = zones.find((z) => z.color !== BLACK && z.cells.includes(qi))
    if (!zone) continue
    perZone.set(zone, (perZone.get(zone) ?? 0) + 1)
  }
  for (const [zone, n] of perZone) {
    zone.stars = n
    total += starClusterPoints(n)
  }
  return total
}

export function scoreBoard(board: Board, ruleset: Ruleset): ScoreBreakdown {
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

  const starPoints = ruleset.variants?.magicStars ? countStars(board, zones) : 0
  const blackPoints = blackZones * ruleset.blackPenalty
  return {
    total: colorPoints + blackPoints + starPoints,
    colorPoints,
    blackZones,
    blackPoints,
    starPoints,
    cardPoints: 0,
    byColor,
    zones,
  }
}

/** Score total uniquement — chemin rapide utilisé par l'IA et les simulations. */
export function scoreOf(board: Board, ruleset: Ruleset): number {
  const zones = computeZones(board, ruleset)
  let total = 0
  for (const z of zones) total += z.points
  if (ruleset.variants?.magicStars) total += countStars(board, zones)
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
  const extras: string[] = []
  if (zone.borders) extras.push(`dont ${zone.borders} bordure${zone.borders > 1 ? 's' : ''}`)
  if (zone.stars) extras.push(`${zone.stars} étoile${zone.stars > 1 ? 's' : ''} ${signed(starClusterPoints(zone.stars))}`)
  const suffix = extras.length ? ` (${extras.join(', ')})` : ''
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
