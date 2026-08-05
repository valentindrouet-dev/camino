import { legalCells, neighbours, placeTile, quadGrid, tileOfQuad } from './board.ts'
import { Rng } from './rng.ts'
import { computeZones, pointsForSpan, scoreOf } from './scoring.ts'
import { distinctRotations } from './tiles.ts'
import type { Board, GameState, PlayerKind, Rotation, Ruleset } from './types.ts'
import { BLACK } from './types.ts'
import { availableTiles, currentPlayer, type Move } from './game.ts'

export interface ScoredMove extends Move {
  /** Score réel du plateau après le coup. */
  score: number
  /** Score + potentiel (ce que l'IA cherche à maximiser). */
  value: number
  delta: number
}

/** Poids de l'évaluation — exposés pour pouvoir régler les bots au playtest. */
export const AI_WEIGHTS = {
  /** Valeur d'un chemin encore trop court mais extensible. */
  seedPotential: 0.9,
  /** Valeur de l'extension possible d'un chemin déjà payant. */
  growthPotential: 0.45,
  /** Bonus quand un quart noir touche une zone noire existante (fusion). */
  blackMerge: 0.8,
  /** Préférence pour les poses au centre (plus de voisins = plus d'options). */
  centrality: 0.05,
}

/**
 * Évaluation heuristique d'un plateau : score réel + potentiel de progression.
 * Sert au bot « malin » et au bouton « indice » de l'interface.
 */
export function evaluateBoard(board: Board, ruleset: Ruleset): number {
  const zones = computeZones(board, ruleset)
  const grid = quadGrid(board)
  const qs = grid.size
  let value = 0
  let blackZones = 0

  for (const z of zones) {
    if (z.color === BLACK) {
      blackZones++
      continue
    }
    value += z.points

    // Une zone ne peut grandir que si elle touche un quart encore vide.
    let openings = 0
    for (const c of z.cells) {
      const r = Math.floor(c / qs)
      const col = c % qs
      if (r > 0 && grid.cells[c - qs] === null) openings++
      if (r < qs - 1 && grid.cells[c + qs] === null) openings++
      if (col > 0 && grid.cells[c - 1] === null) openings++
      if (col < qs - 1 && grid.cells[c + 1] === null) openings++
    }
    if (openings === 0) continue

    if (z.span < ruleset.minSpan) {
      const target = pointsForSpan(ruleset.minSpan, ruleset)
      value += AI_WEIGHTS.seedPotential * target * (z.span / ruleset.minSpan)
    } else {
      const gain = pointsForSpan(z.span + 1, ruleset) - z.points
      value += AI_WEIGHTS.growthPotential * gain
    }
  }

  value += blackZones * ruleset.blackPenalty
  return value
}

/** Tous les coups possibles pour le joueur courant, évalués. */
export function enumerateMoves(state: GameState): ScoredMove[] {
  const player = currentPlayer(state)
  const ruleset = state.options.ruleset
  const cells = legalCells(player.board, ruleset.requireAdjacency)
  const base = scoreOf(player.board, ruleset)
  const out: ScoredMove[] = []

  for (const pool of availableTiles(state)) {
    for (const rot of distinctRotations(pool.tileId)) {
      for (const cell of cells) {
        const board = placeTile(player.board, cell, pool.tileId, rot, state.round)
        const score = scoreOf(board, ruleset)
        let value = evaluateBoard(board, ruleset)
        value += AI_WEIGHTS.centrality * neighbours(player.board.size, cell).length
        value += blackMergeBonus(player.board, board, cell, ruleset)
        out.push({ tileId: pool.tileId, cell, rot, score, value, delta: score - base })
      }
    }
  }
  return out
}

/**
 * Fusionner ses zones noires est payant (une grande zone noire coûte autant
 * qu'une petite). On récompense donc explicitement les poses qui réduisent le
 * nombre de zones noires par rapport à une pose « isolée ».
 */
function blackMergeBonus(before: Board, after: Board, cell: number, ruleset: Ruleset): number {
  const zonesBefore = computeZones(before, ruleset).filter((z) => z.color === BLACK).length
  const zonesAfter = computeZones(after, ruleset).filter((z) => z.color === BLACK)
  const touching = zonesAfter.filter((z) => z.tiles.includes(cell)).length
  const created = zonesAfter.length - zonesBefore
  if (touching > 0 && created <= 0) return AI_WEIGHTS.blackMerge * Math.abs(ruleset.blackPenalty)
  return 0
}

export function bestMove(state: GameState, kind: PlayerKind = 'bot-smart', rng?: Rng): Move | null {
  const moves = enumerateMoves(state)
  if (!moves.length) return null
  const r = rng ?? new Rng(`${state.options.seed}-${state.round}-${state.turnIndex}`)

  if (kind === 'bot-random') return r.pick(moves)

  const key = (m: ScoredMove) => (kind === 'bot-greedy' ? m.score : m.value)
  let best = -Infinity
  let bests: ScoredMove[] = []
  for (const m of moves) {
    const k = key(m)
    if (k > best + 1e-9) {
      best = k
      bests = [m]
    } else if (Math.abs(k - best) <= 1e-9) {
      bests.push(m)
    }
  }
  return r.pick(bests)
}

/** Les N meilleurs coups, pour l'affichage de l'aide au joueur humain. */
export function topMoves(state: GameState, n = 3): ScoredMove[] {
  return enumerateMoves(state)
    .sort((a, b) => b.value - a.value || b.score - a.score)
    .slice(0, n)
}

export function moveKey(m: Move): string {
  return `${m.tileId}:${m.cell}:${m.rot as Rotation}`
}

/** Ordre de préférence du bot pour choisir sa tuile dans le centre. */
export function tilePreference(state: GameState, kind: PlayerKind): Map<number, number> {
  const moves = enumerateMoves(state)
  const best = new Map<number, number>()
  for (const m of moves) {
    const v = kind === 'bot-greedy' ? m.score : m.value
    if (!best.has(m.tileId) || (best.get(m.tileId) as number) < v) best.set(m.tileId, v)
  }
  return best
}

export function tileOfCell(boardSize: number, quadIndex: number): number {
  return tileOfQuad(boardSize, quadIndex)
}
