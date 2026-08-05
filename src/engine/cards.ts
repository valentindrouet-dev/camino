/**
 * Cartes missions (les 12 cartes de la boîte).
 *
 * PHASE 2 — le contenu exact des cartes n'était pas fourni : les cartes
 * ci-dessous sont des PROPOSITIONS (`draft: true`) qui servent à valider la
 * mécanique. Chaque carte est une fonction pure `evaluate()` : pour brancher
 * les vraies cartes, il suffit de remplacer le tableau `CARDS`, rien d'autre
 * dans le moteur ni dans l'interface n'a besoin de changer.
 */
import { colOf, quadGrid, rowOf } from './board.ts'
import type { Board, Color, Ruleset, ScoreBreakdown } from './types.ts'
import { BLACK, PATH_COLORS } from './types.ts'
import { COLOR_NAMES } from './scoring.ts'

export interface CardContext {
  board: Board
  breakdown: ScoreBreakdown
  ruleset: Ruleset
}

export interface MissionCard {
  id: string
  name: string
  description: string
  /** Proposition à valider avec l'auteur du jeu. */
  draft: boolean
  evaluate(ctx: CardContext): { points: number; detail: string }
}

function scoringZones(ctx: CardContext, color?: Color) {
  return ctx.breakdown.zones.filter(
    (z) => z.color !== BLACK && z.points > 0 && (!color || z.color === color),
  )
}

const colorCard = (color: Color, bonus: number): MissionCard => ({
  id: `color-${color}`,
  name: `Spécialiste ${COLOR_NAMES[color].toLowerCase()}`,
  description: `+${bonus} pts si votre chemin le plus long est ${COLOR_NAMES[color].toLowerCase()}.`,
  draft: true,
  evaluate(ctx) {
    const zones = scoringZones(ctx)
    if (!zones.length) return { points: 0, detail: 'aucun chemin qui marque' }
    const longest = Math.max(...zones.map((z) => z.span))
    const ok = zones.some((z) => z.color === color && z.span === longest)
    return {
      points: ok ? bonus : 0,
      detail: ok
        ? `chemin ${COLOR_NAMES[color].toLowerCase()} de ${longest} tuiles`
        : 'chemin le plus long d’une autre couleur',
    }
  },
})

export const CARDS: MissionCard[] = [
  ...PATH_COLORS.map((c) => colorCard(c, 6)),
  {
    id: 'rainbow',
    name: 'Arc-en-ciel',
    description: '+2 pts par couleur ayant au moins un chemin qui marque.',
    draft: true,
    evaluate(ctx) {
      const colors = new Set(scoringZones(ctx).map((z) => z.color))
      return { points: colors.size * 2, detail: `${colors.size} couleurs qui marquent` }
    },
  },
  {
    id: 'clean',
    name: 'Terrain propre',
    description: '+8 pts si vous avez au plus 2 zones noires.',
    draft: true,
    evaluate(ctx) {
      const n = ctx.breakdown.blackZones
      return { points: n <= 2 ? 8 : 0, detail: `${n} zone(s) noire(s)` }
    },
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: '+10 pts si un de vos chemins traverse 6 tuiles ou plus.',
    draft: true,
    evaluate(ctx) {
      const zones = scoringZones(ctx)
      const longest = zones.length ? Math.max(...zones.map((z) => z.span)) : 0
      return { points: longest >= 6 ? 10 : 0, detail: `plus long chemin : ${longest} tuiles` }
    },
  },
  {
    id: 'crossing',
    name: 'La traversée',
    description: '+10 pts si un chemin relie deux bords opposés du plateau.',
    draft: true,
    evaluate(ctx) {
      const qs = ctx.board.size * 2
      const ok = scoringZones(ctx).some((z) => {
        let top = false
        let bottom = false
        let left = false
        let right = false
        for (const c of z.cells) {
          const r = Math.floor(c / qs)
          const col = c % qs
          if (r === 0) top = true
          if (r === qs - 1) bottom = true
          if (col === 0) left = true
          if (col === qs - 1) right = true
        }
        return (top && bottom) || (left && right)
      })
      return { points: ok ? 10 : 0, detail: ok ? 'traversée réussie' : 'aucune traversée' }
    },
  },
  {
    id: 'corners',
    name: 'Les quatre coins',
    description: '+3 pts par coin du plateau sans aucun quart noir.',
    draft: true,
    evaluate(ctx) {
      const grid = quadGrid(ctx.board)
      const qs = grid.size
      const corners = [
        [0, 0],
        [0, qs - 1],
        [qs - 1, 0],
        [qs - 1, qs - 1],
      ]
      const clean = corners.filter(([r, c]) => grid.cells[r * qs + c] !== BLACK).length
      return { points: clean * 3, detail: `${clean} coin(s) sans noir` }
    },
  },
  {
    id: 'core',
    name: 'Le cœur du camino',
    description: '+8 pts si les tuiles centrales ne contiennent aucun noir.',
    draft: true,
    evaluate(ctx) {
      const n = ctx.board.size
      const mid = Math.floor((n - 1) / 2)
      const grid = quadGrid(ctx.board)
      const qs = grid.size
      let clean = true
      for (let r = mid; r <= mid + (n % 2 === 0 ? 1 : 0); r++) {
        for (let c = mid; c <= mid + (n % 2 === 0 ? 1 : 0); c++) {
          for (const [dr, dc] of [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ]) {
            if (grid.cells[(r * 2 + dr) * qs + (c * 2 + dc)] === BLACK) clean = false
          }
        }
      }
      return { points: clean ? 8 : 0, detail: clean ? 'centre immaculé' : 'du noir au centre' }
    },
  },
  {
    id: 'twins',
    name: 'Les jumelles',
    description: '+8 pts si deux couleurs différentes marquent exactement le même total (non nul).',
    draft: true,
    evaluate(ctx) {
      const totals = PATH_COLORS.map((c) => ctx.breakdown.byColor[c].points).filter((p) => p > 0)
      const ok = new Set(totals).size < totals.length
      return { points: ok ? 8 : 0, detail: ok ? 'deux couleurs à égalité' : 'aucune égalité' }
    },
  },
  {
    id: 'frontier',
    name: 'La frontière',
    description: '+1 pt par tuile de bord sans aucun quart noir.',
    draft: true,
    evaluate(ctx) {
      const n = ctx.board.size
      const grid = quadGrid(ctx.board)
      const qs = grid.size
      let count = 0
      for (let i = 0; i < n * n; i++) {
        const r = rowOf(n, i)
        const c = colOf(n, i)
        const edge = r === 0 || c === 0 || r === n - 1 || c === n - 1
        if (!edge || !ctx.board.cells[i]) continue
        const black = [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ].some(([dr, dc]) => grid.cells[(r * 2 + dr) * qs + (c * 2 + dc)] === BLACK)
        if (!black) count++
      }
      return { points: count, detail: `${count} tuile(s) de bord propres` }
    },
  },
]

export function cardById(id: string | undefined): MissionCard | undefined {
  return id ? CARDS.find((c) => c.id === id) : undefined
}

/** Applique la carte du joueur à un décompte déjà calculé. */
export function applyCard(
  breakdown: ScoreBreakdown,
  board: Board,
  ruleset: Ruleset,
  cardId?: string,
): ScoreBreakdown {
  const card = cardById(cardId)
  if (!card) return breakdown
  const { points, detail } = card.evaluate({ board, breakdown, ruleset })
  return {
    ...breakdown,
    cardPoints: points,
    cardLabel: `${card.name} — ${detail}`,
    total: breakdown.total + points,
  }
}
