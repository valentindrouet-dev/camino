import { quadGrid, tileOfQuad } from './board.ts'
import type { Board, Color, ColorScore, Ruleset, ScoreBreakdown, Zone } from './types.ts'
import { BLACK, COLORS, PATH_COLORS } from './types.ts'

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

/** Toutes les zones du plateau (couleurs + noir), avec leur valeur. */
export function computeZones(board: Board, ruleset: Ruleset): Zone[] {
  const grid = quadGrid(board)
  const qs = grid.size
  const seen = new Uint8Array(qs * qs)
  const zones: Zone[] = []
  const stack: number[] = []

  for (let start = 0; start < grid.cells.length; start++) {
    const color = grid.cells[start]
    if (color === null || seen[start]) continue
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
      if (r > 0) push(cur - qs)
      if (r < qs - 1) push(cur + qs)
      if (c > 0) push(cur - 1)
      if (c < qs - 1) push(cur + 1)
    }

    function push(n: number) {
      if (!seen[n] && grid.cells[n] === color) {
        seen[n] = 1
        stack.push(n)
      }
    }

    const span = tiles.size
    zones.push({
      color,
      cells: cells.sort((a, b) => a - b),
      tiles: [...tiles].sort((a, b) => a - b),
      span,
      points: color === BLACK ? ruleset.blackPenalty : pointsForSpan(span, ruleset),
    })
  }
  return zones
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

  const blackPoints = blackZones * ruleset.blackPenalty
  return {
    total: colorPoints + blackPoints,
    colorPoints,
    blackZones,
    blackPoints,
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
  const t = `${zone.span} tuile${zone.span > 1 ? 's' : ''}`
  return zone.points > 0
    ? `${t} — ${signed(zone.points)} pts`
    : `${t} — 0 pt (minimum ${ruleset.minSpan})`
}

export const COLOR_NAMES: Record<Color, string> = {
  Y: 'Jaune',
  O: 'Orange',
  R: 'Rouge',
  G: 'Vert',
  B: 'Bleu',
  P: 'Violet',
  K: 'Noir',
}

export const COLOR_HEX: Record<Color, string> = {
  Y: '#FFF101',
  O: '#F7931D',
  R: '#D1232A',
  G: '#40AE49',
  B: '#0095D9',
  P: '#6850A1',
  K: '#231F20',
}

export { PATH_COLORS, BLACK }
