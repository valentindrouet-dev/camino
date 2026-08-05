import { placedCount } from './board.ts'
import { applyCard } from './cards.ts'
import { Rng } from './rng.ts'
import { scoreBoard } from './scoring.ts'
import type { Color, GameState, Player, PlayerKind, ScoreBreakdown } from './types.ts'
import { BLACK, PATH_COLORS } from './types.ts'
import { bestMove } from './ai.ts'
import { applyMove, createGame, currentPlayer, type GameConfig, type Move } from './game.ts'

export interface PlayerStats {
  player: Player
  breakdown: ScoreBreakdown
  rank: number
  tilesPlaced: number
  /** Nombre de chemins qui rapportent. */
  scoringPaths: number
  /** Plus long chemin (en tuiles). */
  longestPath: number
  /** Couleur la plus rentable. */
  bestColor: Color | null
  /** Somme des points perdus par les chemins trop courts (< minSpan). */
  wastedPotential: number
  /** Rang moyen de choix dans le tour (0 = a choisi en premier). */
  avgPickOrder: number
}

export function playerStats(state: GameState): PlayerStats[] {
  const ruleset = state.options.ruleset
  const raw = state.players.map((player) => {
    const base = scoreBoard(player.board, ruleset)
    const breakdown = state.options.useCards
      ? applyCard(base, player.board, ruleset, player.cardId)
      : base
    const scoring = breakdown.zones.filter((z) => z.color !== BLACK && z.points > 0)
    const wasted = breakdown.zones
      .filter((z) => z.color !== BLACK && z.points === 0)
      .reduce((n, z) => n + z.span, 0)
    const picks = state.log.filter((l) => l.playerId === player.id)
    let bestColor: Color | null = null
    let bestPts = 0
    for (const c of PATH_COLORS) {
      if (breakdown.byColor[c].points > bestPts) {
        bestPts = breakdown.byColor[c].points
        bestColor = c
      }
    }
    return {
      player,
      breakdown,
      rank: 0,
      tilesPlaced: placedCount(player.board),
      scoringPaths: scoring.length,
      longestPath: scoring.reduce((m, z) => Math.max(m, z.span), 0),
      bestColor,
      wastedPotential: wasted,
      avgPickOrder: picks.length
        ? picks.reduce((n, p) => n + p.pickOrder, 0) / picks.length
        : 0,
    }
  })

  const order = raw.slice().sort((a, b) => b.breakdown.total - a.breakdown.total)
  order.forEach((s, i) => {
    s.rank = i > 0 && order[i - 1].breakdown.total === s.breakdown.total ? order[i - 1].rank : i + 1
  })
  return raw
}

export function ranking(stats: PlayerStats[]): PlayerStats[] {
  return stats.slice().sort((a, b) => a.rank - b.rank || b.breakdown.total - a.breakdown.total)
}

// ---------------------------------------------------------------------------
// Simulation en masse : c'est l'outil d'équilibrage.
// ---------------------------------------------------------------------------

export interface SimPlayerRecord {
  seat: number
  kind: PlayerKind
  total: number
  colorPoints: number
  blackZones: number
  blackPoints: number
  scoringPaths: number
  longestPath: number
  byColor: Record<Color, number>
  /** Longueurs (en tuiles) des chemins qui marquent. */
  spans: number[]
  /** 1 pour le vainqueur, partagé en cas d'égalité. */
  win: number
}

export interface SimGameRecord {
  seed: string
  results: SimPlayerRecord[]
}

/** Joue une partie entière avec des bots et renvoie ses résultats bruts. */
export function playOneGame(config: GameConfig, seed: string): SimGameRecord {
  let state = createGame({ ...config, options: { ...config.options, seed } })
  const rng = new Rng(`${seed}-ai`)
  let guard = 0
  while (state.phase === 'playing' && guard++ < 10000) {
    const kind = currentPlayer(state).kind
    const move: Move | null = bestMove(state, kind === 'human' ? 'bot-smart' : kind, rng)
    if (!move) break
    state = applyMove(state, move)
  }

  const stats = playerStats(state)
  const totals = stats.map((s) => s.breakdown.total)
  const best = Math.max(...totals)
  const winners = totals.filter((t) => t === best).length

  return {
    seed,
    results: stats.map((s) => ({
      seat: s.player.id,
      kind: s.player.kind,
      total: s.breakdown.total,
      colorPoints: s.breakdown.colorPoints,
      blackZones: s.breakdown.blackZones,
      blackPoints: s.breakdown.blackPoints,
      scoringPaths: s.scoringPaths,
      longestPath: s.longestPath,
      byColor: Object.fromEntries(
        PATH_COLORS.map((c) => [c, s.breakdown.byColor[c].points]),
      ) as Record<Color, number>,
      spans: s.breakdown.zones.filter((z) => z.color !== BLACK && z.points > 0).map((z) => z.span),
      win: s.breakdown.total === best ? 1 / winners : 0,
    })),
  }
}

export interface SimResult {
  games: number
  /** Tous les scores individuels obtenus. */
  scores: number[]
  min: number
  max: number
  mean: number
  median: number
  stdev: number
  /** Points moyens par couleur et par joueur. */
  byColor: Record<Color, number>
  avgBlackZones: number
  avgBlackPoints: number
  /** Distribution du nombre de tuiles des chemins qui marquent. */
  spanHistogram: Record<number, number>
  avgScoringPaths: number
  avgLongestPath: number
  winsBySeat: number[]
  meanBySeat: number[]
  winsByKind: Record<string, number>
  meanByKind: Record<string, number>
  /** Écart moyen entre le meilleur et le pire score d'une partie. */
  avgSpread: number
  durationMs: number
}

/** Agrège des parties déjà jouées — sert à la simulation incrémentale de l'UI. */
export function aggregate(records: SimGameRecord[], seats: number, durationMs = 0): SimResult {
  const scores: number[] = []
  const byColor = {} as Record<Color, number>
  for (const c of PATH_COLORS) byColor[c] = 0
  byColor[BLACK] = 0
  const spanHistogram: Record<number, number> = {}
  const winsBySeat = new Array(seats).fill(0)
  const sumBySeat = new Array(seats).fill(0)
  const winsByKind: Record<string, number> = {}
  const sumByKind: Record<string, number> = {}
  const countByKind: Record<string, number> = {}
  let blackZones = 0
  let blackPoints = 0
  let paths = 0
  let longest = 0
  let spreadSum = 0
  let players = 0

  for (const g of records) {
    const totals = g.results.map((r) => r.total)
    spreadSum += Math.max(...totals) - Math.min(...totals)
    for (const r of g.results) {
      players++
      scores.push(r.total)
      sumBySeat[r.seat] += r.total
      winsBySeat[r.seat] += r.win
      countByKind[r.kind] = (countByKind[r.kind] ?? 0) + 1
      sumByKind[r.kind] = (sumByKind[r.kind] ?? 0) + r.total
      winsByKind[r.kind] = (winsByKind[r.kind] ?? 0) + r.win
      for (const c of PATH_COLORS) byColor[c] += r.byColor[c]
      byColor[BLACK] += r.blackPoints
      blackZones += r.blackZones
      blackPoints += r.blackPoints
      paths += r.scoringPaths
      longest += r.longestPath
      for (const s of r.spans) spanHistogram[s] = (spanHistogram[s] ?? 0) + 1
    }
  }

  const div = players || 1
  const sorted = scores.slice().sort((a, b) => a - b)
  const mean = scores.reduce((a, b) => a + b, 0) / div
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / div

  return {
    games: records.length,
    scores,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean,
    median: sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : 0,
    stdev: Math.sqrt(variance),
    byColor: Object.fromEntries(
      Object.entries(byColor).map(([k, v]) => [k, v / div]),
    ) as Record<Color, number>,
    avgBlackZones: blackZones / div,
    avgBlackPoints: blackPoints / div,
    spanHistogram,
    avgScoringPaths: paths / div,
    avgLongestPath: longest / div,
    winsBySeat,
    meanBySeat: sumBySeat.map((s) => s / (records.length || 1)),
    winsByKind,
    meanByKind: Object.fromEntries(
      Object.keys(sumByKind).map((k) => [k, sumByKind[k] / (countByKind[k] || 1)]),
    ),
    avgSpread: spreadSum / (records.length || 1),
    durationMs,
  }
}

export function simulate(
  config: GameConfig,
  games: number,
  onProgress?: (done: number, total: number) => void,
): SimResult {
  const t0 = Date.now()
  const records: SimGameRecord[] = []
  for (let g = 0; g < games; g++) {
    records.push(playOneGame(config, `${config.options.seed}#${g}`))
    onProgress?.(g + 1, games)
  }
  return aggregate(records, config.players.length, Date.now() - t0)
}

/** Histogramme des scores, prêt à être tracé. */
export function histogram(values: number[], bucket = 5): { x: number; n: number }[] {
  if (!values.length) return []
  const min = Math.floor(Math.min(...values) / bucket) * bucket
  const max = Math.ceil(Math.max(...values) / bucket) * bucket
  const buckets: { x: number; n: number }[] = []
  for (let x = min; x <= max; x += bucket) buckets.push({ x, n: 0 })
  for (const v of values) {
    const i = Math.min(buckets.length - 1, Math.floor((v - min) / bucket))
    buckets[i].n++
  }
  return buckets
}
