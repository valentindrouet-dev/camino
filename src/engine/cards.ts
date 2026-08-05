/**
 * Les 12 cartes missions de CAMINO (Cartes_CAMINO_OK.pdf).
 *
 * Une seule carte est tirée pour la table : toutes et tous jouent la même
 * mission. C'est ce qu'implique la carte « plus grand chemin violet », dont la
 * clause « si égalité, +5 points par joueur » n'a de sens que si plusieurs
 * joueurs visent le même objectif.
 *
 * Chaque carte est une fonction pure évaluée sur le plateau final.
 */
import { quadGrid } from './board.ts'
import { computeZones } from './scoring.ts'
import type { Board, Ruleset, ScoreBreakdown, Zone } from './types.ts'
import { BLACK } from './types.ts'

export interface CardTableEntry {
  playerId: number
  zones: Zone[]
}

export interface CardContext {
  playerId: number
  board: Board
  /** Décompte de base (zones + points), avant carte. */
  breakdown: ScoreBreakdown
  ruleset: Ruleset
  /** Les zones de tous les joueurs — pour les cartes comparatives. */
  table: CardTableEntry[]
}

export interface CardResult {
  points: number
  /** Explication courte affichée au joueur. */
  detail: string
}

export interface MissionCard {
  id: string
  /** Texte exact de la carte. */
  text: string
  /** Valeur affichée dans la pastille de la carte. */
  badge: string
  /** Nom court pour les listes et les statistiques. */
  name: string
  evaluate(ctx: CardContext): CardResult
}

/** Chemins qui marquent : zones de couleur d'au moins `minSpan` tuiles. */
function paths(ctx: CardContext): Zone[] {
  return ctx.breakdown.zones.filter((z) => z.color !== BLACK && z.span >= ctx.ruleset.minSpan)
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`
}

// ---------------------------------------------------------------------------

/** Zones de couleur dont la forme est exactement un carré de 2 x 2 quarts. */
function squareZones(ctx: CardContext): Zone[] {
  const qs = ctx.board.size * 2
  return ctx.breakdown.zones.filter((z) => {
    if (z.color === BLACK || z.cells.length !== 4) return false
    const rows = z.cells.map((c) => Math.floor(c / qs))
    const cols = z.cells.map((c) => c % qs)
    const carre =
      Math.max(...rows) - Math.min(...rows) === 1 && Math.max(...cols) - Math.min(...cols) === 1
    // « au moins 2 tuiles » : un carré aligné sur une seule tuile ne compte pas.
    return carre && z.span >= 2
  })
}

/** Bords touchés par une zone. */
function edges(zone: Zone, boardSize: number) {
  const qs = boardSize * 2
  let top = false
  let bottom = false
  let left = false
  let right = false
  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    if (r === 0) top = true
    if (r === qs - 1) bottom = true
    if (col === 0) left = true
    if (col === qs - 1) right = true
  }
  return { top, bottom, left, right }
}

/** Les 4 quarts situés dans les angles du plateau. */
function cornerQuads(boardSize: number): number[] {
  const qs = boardSize * 2
  return [0, qs - 1, qs * (qs - 1), qs * qs - 1]
}

/**
 * Une zone « enferme » quelque chose si, en la retirant du plateau, il reste un
 * groupe de quarts qui ne touche aucun bord — donc entouré uniquement par elle.
 */
function enclosesSomething(zone: Zone, board: Board): boolean {
  const grid = quadGrid(board)
  const qs = grid.size
  const inZone = new Set(zone.cells)
  const seen = new Uint8Array(qs * qs)
  for (let start = 0; start < qs * qs; start++) {
    if (seen[start] || inZone.has(start)) continue
    // Parcours du groupe contigu hors de la zone.
    const stack = [start]
    seen[start] = 1
    let touchesEdge = false
    let complete = true
    while (stack.length) {
      const cur = stack.pop() as number
      const r = Math.floor(cur / qs)
      const c = cur % qs
      if (grid.cells[cur] === null) complete = false
      if (r === 0 || c === 0 || r === qs - 1 || c === qs - 1) touchesEdge = true
      for (const n of [
        r > 0 ? cur - qs : -1,
        r < qs - 1 ? cur + qs : -1,
        c > 0 ? cur - 1 : -1,
        c < qs - 1 ? cur + 1 : -1,
      ]) {
        if (n >= 0 && !seen[n] && !inZone.has(n)) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (!touchesEdge && complete) return true
  }
  return false
}

// ---------------------------------------------------------------------------

export const CARDS: MissionCard[] = [
  {
    id: 'exact-4',
    name: 'Chemins de 4',
    badge: '+5',
    text: '+5 points pour chaque chemin composé d’exactement 4 tuiles.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => z.span === 4).length
      return { points: n * 5, detail: plural(n, 'chemin') + ' de 4 tuiles' }
    },
  },
  {
    id: 'exact-5',
    name: 'Chemins de 5',
    badge: '+8',
    text: '+8 points pour chaque chemin composé d’exactement 5 tuiles.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => z.span === 5).length
      return { points: n * 8, detail: plural(n, 'chemin') + ' de 5 tuiles' }
    },
  },
  {
    id: 'long-6',
    name: 'Longs chemins',
    badge: '+10',
    text: '+10 points pour chaque chemin composé d’au moins 6 tuiles.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => z.span >= 6).length
      return { points: n * 10, detail: plural(n, 'chemin') + ' de 6 tuiles ou plus' }
    },
  },
  {
    id: 'black-positive',
    name: 'Noir positif',
    badge: '+2',
    text: 'Les zones noires deviennent positives. +2 points pour chaque zone noire !',
    evaluate(ctx) {
      const z = ctx.breakdown.blackZones
      // On annule le malus déjà compté, puis on crédite +2 par zone.
      return {
        points: z * 2 - ctx.breakdown.blackPoints,
        detail: plural(z, 'zone noire') + ' à +2 au lieu du malus',
      }
    },
  },
  {
    id: 'six-colors',
    name: 'Six couleurs',
    badge: '+18',
    text: '+18 points si vous marquez des points dans les 6 couleurs.',
    evaluate(ctx) {
      const colors = new Set(paths(ctx).map((z) => z.color)).size
      return {
        points: colors >= 6 ? 18 : 0,
        detail: `${colors} couleur${colors > 1 ? 's' : ''} qui marquent`,
      }
    },
  },
  {
    id: 'five-colors',
    name: 'Cinq couleurs',
    badge: '+12',
    text: '+12 points si vous marquez des points dans 5 couleurs.',
    evaluate(ctx) {
      const colors = new Set(paths(ctx).map((z) => z.color)).size
      return {
        points: colors >= 5 ? 12 : 0,
        detail: `${colors} couleur${colors > 1 ? 's' : ''} qui marquent`,
      }
    },
  },
  {
    id: 'squares',
    name: 'Les carrés',
    badge: '+6',
    text: '+6 points par carré composé d’au moins 2 tuiles.',
    evaluate(ctx) {
      const n = squareZones(ctx).length
      return { points: n * 6, detail: plural(n, 'carré') }
    },
  },
  {
    id: 'purple-longest',
    name: 'Plus grand violet',
    badge: '+10',
    text: '+10 points pour le plus grand chemin violet. Si égalité, +5 points par joueur.',
    evaluate(ctx) {
      const bestOf = (zones: Zone[]) =>
        zones
          .filter((z) => z.color === 'P' && z.span >= ctx.ruleset.minSpan)
          .reduce((m, z) => Math.max(m, z.span), 0)
      const mine = bestOf(ctx.breakdown.zones)
      if (mine === 0) return { points: 0, detail: 'aucun chemin violet' }
      const all = ctx.table.map((t) => bestOf(t.zones))
      const best = Math.max(...all)
      if (mine < best) return { points: 0, detail: `violet de ${mine} tuiles, battu par ${best}` }
      const exaequo = all.filter((v) => v === best).length
      return {
        points: exaequo > 1 ? 5 : 10,
        detail:
          exaequo > 1
            ? `à égalité (${best} tuiles) avec ${exaequo - 1} autre${exaequo > 2 ? 's' : ''}`
            : `plus grand violet (${best} tuiles)`,
      }
    },
  },
  {
    id: 'orange-paths',
    name: 'Chemins orange',
    badge: '+8',
    text: '+8 points pour chaque chemin orange.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => z.color === 'O').length
      return { points: n * 8, detail: plural(n, 'chemin orange') }
    },
  },
  {
    id: 'crossing',
    name: 'Bords opposés',
    badge: '+12',
    text: '+12 points pour chaque chemin qui relie 2 bords opposés.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => {
        const e = edges(z, ctx.board.size)
        return (e.top && e.bottom) || (e.left && e.right)
      }).length
      return { points: n * 12, detail: plural(n, 'traversée') }
    },
  },
  {
    id: 'corners',
    name: 'Par les angles',
    badge: '+6',
    text: '+6 points pour chaque chemin qui part ou passe par un angle.',
    evaluate(ctx) {
      const corners = cornerQuads(ctx.board.size)
      const n = paths(ctx).filter((z) => corners.some((c) => z.cells.includes(c))).length
      return { points: n * 6, detail: plural(n, 'chemin') + ' par un angle' }
    },
  },
  {
    id: 'enclose',
    name: 'Encerclement',
    badge: '+10',
    text: '+10 points pour chaque chemin qui enferme une couleur ou du noir. Sans l’aide des bords.',
    evaluate(ctx) {
      const n = paths(ctx).filter((z) => enclosesSomething(z, ctx.board)).length
      return { points: n * 10, detail: plural(n, 'chemin') + ' qui enferme' }
    },
  },
]

export function cardById(id: string | undefined): MissionCard | undefined {
  return id ? CARDS.find((c) => c.id === id) : undefined
}

/** Décompte enrichi de la carte mission de la table. */
export function applyCard(
  breakdown: ScoreBreakdown,
  ctx: Omit<CardContext, 'breakdown'>,
  cardId?: string,
): ScoreBreakdown {
  const card = cardById(cardId)
  if (!card) return breakdown
  const { points, detail } = card.evaluate({ ...ctx, breakdown })
  return {
    ...breakdown,
    cardPoints: points,
    cardLabel: detail,
    total: breakdown.total + points,
  }
}

/** Zones de chaque joueur — contexte nécessaire aux cartes comparatives. */
export function cardTable(
  players: { id: number; board: Board }[],
  ruleset: Ruleset,
): CardTableEntry[] {
  return players.map((p) => ({ playerId: p.id, zones: computeZones(p.board, ruleset) }))
}
