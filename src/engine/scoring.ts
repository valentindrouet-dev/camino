import { effectiveRot, faultBlocks, gridEffects, neighbours, quadGrid, tileOfQuad } from './board.ts'
import { cloverQuadIndex, CRYSTALS, starQuadIndex } from './tiles.ts'
import type {
  Board,
  Color,
  ColorScore,
  Ruleset,
  ScoreBreakdown,
  Side,
  StarScoring,
  Zone,
} from './types.ts'
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

/**
 * Scoring inversé (variante) : le signe de TOUT ce qui compte. Les points de
 * départ compensent le fait que les chemins ne rapportent plus rien.
 */
export const REVERSED_BASE = 20

/** −1 quand le scoring est inversé, +1 sinon. */
export function scoreSign(ruleset: Ruleset): -1 | 1 {
  return ruleset.variants?.reverseScoring ? -1 : 1
}

/** Applique le signe du barème — sans jamais produire de « −0 ». */
function flip(sign: -1 | 1, n: number): number {
  return sign * n || 0
}

export function pointsForSpan(span: number, ruleset: Ruleset): number {
  if (span < ruleset.minSpan) return 0
  const table = ruleset.pointsBySpan
  return table[Math.min(span, table.length - 1)] ?? 0
}

/**
 * Points d'un groupe d'étoiles, selon le barème choisi :
 *
 *  - `linked` (par défaut) : une étoile seule vaut 1 point, chaque étoile
 *    reliée à au moins une autre en vaut 2 — un groupe de N ≥ 2 vaut 2×N ;
 *  - `growing` : dans un groupe de N, chaque étoile vaut N — le groupe vaut
 *    donc N², et les grandes constellations s'envolent.
 */
export function starClusterPoints(count: number, mode: StarScoring = 'linked'): number {
  if (count <= 1) return Math.max(0, count)
  return mode === 'growing' ? count * count : 2 * count
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
 *  - tuiles arc-en-ciel : le quart irisé appartient aux chemins de TOUTES les
 *    couleurs qui le touchent (il peut relier deux chemins d'une même
 *    couleur) ; il ne rejoint jamais le noir ;
 *  - bordures : une case de bordure reliée à un chemin de sa couleur compte
 *    comme une case de plus, mais ne relie JAMAIS deux chemins entre eux ;
 *  - étoiles magiques : comptées par zone (voir scoreBoard) ;
 *  - couleurs interdites : elles se comportent comme le noir, chaque zone
 *    coûte le malus quelle que soit sa taille — les réunir reste payant.
 */
export function computeZones(
  board: Board,
  ruleset: Ruleset,
  /** Couleurs interdites du joueur (variante) : leurs zones coûtent le malus. */
  forbidden: Color[] = [],
): Zone[] {
  // La grille porte déjà les effets de variantes : rotations de moulins et
  // zones noires teintées. Zones, score et IA les voient sans code particulier.
  const fx = gridEffects(ruleset)
  const grid = quadGrid(board, fx)
  const qs = grid.size
  const zones: Zone[] = []
  const stack: number[] = []
  const faults = Boolean(fx?.faults)
  const wind = Boolean(fx?.windmills)
  // Scoring inversé : les valeurs sont retournées ici, une bonne fois — le
  // plateau, le décompte et l'IA lisent tous `points` et suivent donc.
  const sign = scoreSign(ruleset)

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
          if (n >= 0 && !seen[n] && grid.cells[n] === BLACK && !(faults && faultBlocks(board, cur, n, wind))) {
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
        scoring: false,
        points: flip(sign, ruleset.blackPenalty),
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
          if (faults && faultBlocks(board, cur, n, wind)) continue
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
      const banni = forbidden.includes(color)
      const gain = pointsForSpan(span, ruleset)
      zones.push({
        color,
        cells: z.cells.sort((a, b) => a - b),
        tiles: [...z.tiles].sort((a, b) => a - b),
        borders: borderCount,
        borderIds: [...z.borderIds].sort((a, b) => b - a),
        stars: 0,
        span,
        // Une couleur interdite ne « marque » pas : elle se compte comme une
        // zone noire, et ne fait donc pas fleurir les trèfles.
        scoring: !banni && gain > 0,
        // Couleur interdite : la zone se compte comme une zone noire.
        points: flip(sign, banni ? ruleset.blackPenalty : gain),
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
export function starClusters(
  board: Board,
  mode: StarScoring = 'linked',
  /** Variante Moulins : les étoiles tournent avec leur tuile. */
  windmills = false,
): StarCluster[] {
  const qs = board.size * 2
  const starred = new Set<number>()
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i]
    if (!placed) continue
    const starQuad = starQuadIndex(placed.tileId, effectiveRot(board, i, windmills), placed.flipped)
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
      points: starClusterPoints(cells.length, mode),
    })
  }
  return clusters
}

/**
 * Points d'étoiles d'un joueur. En Plateau commun, chaque étoile va au joueur
 * qui a posé sa tuile : dans un groupe de N, chacune vaut sa part du groupe.
 */
function countStars(
  board: Board,
  mode: StarScoring,
  windmills: boolean,
  ownTiles: Set<number> | null,
): number {
  let total = 0
  for (const c of starClusters(board, mode, windmills)) {
    if (!ownTiles) {
      total += c.points
      continue
    }
    const perStar = c.points / c.count
    for (const cell of c.cells) {
      if (ownTiles.has(tileOfQuad(board.size, cell))) total += perStar
    }
  }
  return total
}

/**
 * Cristaux (variante) : +4 par cristal resté « intact » — aucune tuile n'est
 * venue se coller à la sienne après sa pose. Les voisines déjà en place au
 * moment de la pose ne le dérangent pas.
 */
export function crystalIntact(board: Board, cell: number): boolean {
  const placed = board.cells[cell]
  if (!placed || !CRYSTALS.has(placed.tileId)) return false
  return neighbours(board.size, cell).every((n) => {
    const p = board.cells[n]
    return !p || p.round <= placed.round
  })
}

function countCrystals(board: Board, ownTiles: Set<number> | null): number {
  let total = 0
  for (let i = 0; i < board.cells.length; i++) {
    if (ownTiles && !ownTiles.has(i)) continue
    if (crystalIntact(board, i)) total += 4
  }
  return total
}

export function scoreBoard(
  board: Board,
  ruleset: Ruleset,
  /** Variantes propres au joueur : couleur secrète, couleurs interdites. */
  who: PlayerScoring = {},
): ScoreBreakdown {
  const { secretColor } = who
  const forbidden = ruleset.variants?.forbiddenColor ? (who.forbiddenColors ?? []) : []
  const zones = computeZones(board, ruleset, forbidden)
  const byColor = {} as Record<Color, ColorScore>
  for (const c of COLORS) byColor[c] = { color: c, points: 0, scoringZones: [], zones: [] }

  // Plateau commun : chacun ne marque que les zones contenant au moins une
  // tuile qu'il a posée — bonnes comme mauvaises, le noir partagé se paie.
  const ownTiles =
    ruleset.variants?.sharedBoard && who.id !== undefined
      ? new Set(
          board.cells.map((p, i) => (p && p.by === who.id ? i : -1)).filter((i) => i >= 0),
        )
      : null
  const mine = (z: Zone) => !ownTiles || z.tiles.some((t) => ownTiles.has(t))

  let colorPoints = 0
  let blackZones = 0
  let blackPoints = 0
  let forbiddenZones = 0

  // `z.points` porte déjà le signe du barème en vigueur (scoring inversé
  // compris) : il n'y a plus qu'à additionner.
  for (const z of zones) {
    byColor[z.color].zones.push(z)
    if (!mine(z)) continue
    if (z.color === BLACK) {
      blackZones++
      blackPoints += z.points
      byColor[BLACK].points += z.points
      byColor[BLACK].scoringZones.push(z)
    } else if (forbidden.includes(z.color)) {
      // Couleur interdite : la zone se compte comme une zone noire, quelle que
      // soit sa taille — d'où l'intérêt de tout réunir en une seule.
      forbiddenZones++
      colorPoints += z.points
      byColor[z.color].points += z.points
      byColor[z.color].scoringZones.push(z)
    } else if (z.points !== 0) {
      colorPoints += z.points
      byColor[z.color].points += z.points
      byColor[z.color].scoringZones.push(z)
    }
  }

  // Les variantes suivent le même signe : ce qui rapportait coûte, et
  // réciproquement (c'est la règle du scoring inversé).
  const sign = scoreSign(ruleset)
  const wind = Boolean(ruleset.variants?.windmills)
  const starPoints = ruleset.variants?.magicStars
    ? flip(sign, countStars(board, ruleset.variants.starScoring ?? 'linked', wind, ownTiles))
    : 0
  const cloverPoints = ruleset.variants?.clovers
    ? flip(sign, countClovers(board, zones, wind, ownTiles))
    : 0
  const crystalPoints = ruleset.variants?.crystals
    ? flip(sign, countCrystals(board, ownTiles))
    : 0
  // Une couleur secrète interdite ne doublerait qu'un malus : on n'y touche pas.
  const secretPoints =
    ruleset.variants?.secretColor && secretColor && !forbidden.includes(secretColor)
      ? secretBonus(zones.filter(mine), secretColor)
      : 0
  const basePoints = ruleset.variants?.reverseScoring ? REVERSED_BASE : 0
  return {
    total:
      basePoints +
      colorPoints +
      blackPoints +
      starPoints +
      cloverPoints +
      crystalPoints +
      secretPoints,
    basePoints,
    colorPoints,
    blackZones,
    blackPoints,
    starPoints,
    cloverPoints,
    crystalPoints,
    secretPoints,
    ...(forbidden.length ? { forbidden, forbiddenZones } : {}),
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
export function countClovers(
  board: Board,
  zones: Zone[],
  /** Variante Moulins : les trèfles tournent avec leur tuile. */
  windmills = false,
  /** Plateau commun : seuls les trèfles des tuiles de ce joueur comptent. */
  ownTiles: Set<number> | null = null,
): number {
  const qs = board.size * 2
  const scoring = new Set<number>()
  for (const z of zones) {
    if (!z.scoring) continue
    for (const c of z.cells) scoring.add(c)
  }
  let total = 0
  for (let i = 0; i < board.cells.length; i++) {
    const placed = board.cells[i]
    if (!placed) continue
    if (ownTiles && !ownTiles.has(i)) continue
    const cq = cloverQuadIndex(placed.tileId, effectiveRot(board, i, windmills), placed.flipped)
    if (cq === null) continue
    const r = Math.floor(i / board.size) * 2 + (cq >= 2 ? 1 : 0)
    const c = (i % board.size) * 2 + (cq === 1 || cq === 2 ? 1 : 0)
    total += scoring.has(r * qs + c) ? 3 : -3
  }
  return total
}

/**
 * Ce qu'un joueur apporte au décompte de son propre plateau : les variantes
 * qui dépendent de lui et non du plateau seul.
 */
export interface PlayerScoring {
  /** Identité du joueur — en Plateau commun, seuls ses chemins comptent. */
  id?: number
  /** Son meilleur chemin de cette couleur est doublé (variante). */
  secretColor?: Color
  /** Les points de ses chemins de ces couleurs lui sont infligés en négatif. */
  forbiddenColors?: Color[]
}

/** Couleur secrète (variante) : le meilleur chemin de cette couleur est doublé. */
export function secretBonus(zones: Zone[], color: Color | undefined): number {
  if (!color) return 0
  // Le meilleur chemin de la couleur — c'est-à-dire le plus gros en valeur
  // absolue, puisqu'en scoring inversé « le meilleur » est le plus coûteux.
  let best = 0
  for (const z of zones) {
    if (z.color === color && z.scoring && Math.abs(z.points) > Math.abs(best)) best = z.points
  }
  return best
}

/** Score total uniquement — chemin rapide utilisé par l'IA et les simulations. */
export function scoreOf(board: Board, ruleset: Ruleset, who: PlayerScoring = {}): number {
  return scoreBoard(board, ruleset, who).total
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
  const pts = (n: number) => `${signed(n)} pt${Math.abs(n) > 1 ? 's' : ''}`
  if (zone.color === BLACK) return `Zone noire — ${pts(zone.points)}`
  // Une couleur interdite se compte comme le noir : le malus est déjà dans
  // `points`, il n'y a pas de barème de taille à rappeler.
  if (!zone.scoring && zone.points !== 0) {
    return `Zone interdite (${COLOR_NAMES[zone.color].toLowerCase()}) — ${pts(zone.points)}`
  }
  const suffix = zone.borders
    ? ` (dont ${zone.borders} bordure${zone.borders > 1 ? 's' : ''})`
    : ''
  const t = `${zone.span} tuile${zone.span > 1 ? 's' : ''}`
  return zone.scoring
    ? `${t} — ${pts(zone.points)}${suffix}`
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
  W: 'Arc-en-ciel',
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
