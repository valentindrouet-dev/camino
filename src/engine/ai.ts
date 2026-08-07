import { legalCells, neighbours, placeTile, quadGrid, tileOfQuad } from './board.ts'
import { applyCards, cardTable, playerCardIds, rulesetForPlayer } from './cards.ts'
import { Rng } from './rng.ts'
import { computeZones, pointsForSpan, scoreBoard } from './scoring.ts'
import { distinctOrientations, tileQuads } from './tiles.ts'
import type { Board, Color, GameState, PlayerKind, Rotation, Ruleset } from './types.ts'
import { BLACK, PATH_COLORS } from './types.ts'
import { availableTiles, currentPlayer, type Move } from './game.ts'

export interface ScoredMove extends Move {
  /** Score réel du plateau après le coup. */
  score: number
  /** Points de cartes missions acquis après le coup. */
  missionPoints: number
  /** Score + potentiel (ce que l'IA cherche à maximiser). */
  value: number
  delta: number
}

/**
 * Poids de l'évaluation du Stratège — exposés pour pouvoir régler les bots.
 *
 * La stratégie voulue :
 *  1. maximiser une ou deux couleurs (le barème est convexe : un chemin de
 *     9 tuiles vaut dix fois un chemin de 3) — quitte à poser du noir si cela
 *     fait grandir la meilleure couleur ;
 *  2. regrouper les zones noires (une grande zone coûte autant qu'une petite) ;
 *  3. relier plusieurs couleurs en une seule pose.
 */
export const AI_WEIGHTS = {
  /** Valeur d'un chemin encore trop court mais extensible. */
  seedPotential: 0.9,
  /** Valeur de l'extension possible d'un chemin déjà payant. */
  growthPotential: 0.45,
  /** Prime aux deux couleurs les plus fortes du plateau (concentration). */
  focus: 0.55,
  /** Bonus quand une pose réduit ou évite de multiplier les zones noires. */
  blackMerge: 1.2,
  /** Bonus par couleur supplémentaire raccordée par la pose. */
  multiColor: 1.1,
  /** Préférence pour les poses au centre (plus de voisins = plus d'options). */
  centrality: 0.05,
  /** Décote de la tuile personnelle : on la garde pour un vrai bon coup. */
  personalReserve: 3,
  /** Poids des points de cartes missions déjà acquis par la pose. */
  mission: 1,
  /** Prime au progrès vers une mission encore inachevée. */
  missionProgress: 0.35,
}

interface ColorPotential {
  color: Color
  /** Points actuels + progression encore accessible. */
  potential: number
}

/**
 * Évaluation d'un plateau : points réels + potentiel de progression, avec une
 * prime de concentration sur les deux meilleures couleurs.
 */
export function evaluateBoard(board: Board, ruleset: Ruleset): number {
  const zones = computeZones(board, ruleset)
  const grid = quadGrid(board)
  const qs = grid.size
  let value = 0
  let blackZones = 0
  const perColor = new Map<Color, number>()

  for (const z of zones) {
    if (z.color === BLACK) {
      blackZones++
      continue
    }
    let zoneValue = z.points

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
    if (openings > 0) {
      if (z.span < ruleset.minSpan) {
        const target = pointsForSpan(ruleset.minSpan, ruleset)
        zoneValue += AI_WEIGHTS.seedPotential * target * (z.span / ruleset.minSpan)
      } else {
        // Le barème accélère : viser le palier suivant vaut de plus en plus cher.
        const gain = pointsForSpan(z.span + 1, ruleset) - z.points
        zoneValue += AI_WEIGHTS.growthPotential * gain
      }
    }

    value += zoneValue
    perColor.set(z.color, (perColor.get(z.color) ?? 0) + zoneValue)
  }

  // Concentration : les deux couleurs les plus prometteuses comptent double.
  const potentials: ColorPotential[] = PATH_COLORS.map((c) => ({
    color: c,
    potential: perColor.get(c) ?? 0,
  })).sort((a, b) => b.potential - a.potential)
  value += AI_WEIGHTS.focus * (potentials[0].potential + 0.6 * (potentials[1]?.potential ?? 0))

  value += blackZones * ruleset.blackPenalty
  return value
}

/**
 * Couleurs (hors noir) que la tuile posée raccorde à des quarts déjà en place
 * dans d'autres tuiles : c'est le « réunir plusieurs couleurs en une pose ».
 */
function connectedColors(board: Board, cell: number, tileId: number, rot: Rotation): number {
  const grid = quadGrid(board)
  const qs = grid.size
  const n = board.size
  const r0 = Math.floor(cell / n) * 2
  const c0 = (cell % n) * 2
  const quads = tileQuads(tileId, rot)
  const offsets: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ]
  const colors = new Set<Color>()
  offsets.forEach(([dr, dc], k) => {
    const color = quads[k]
    if (color === BLACK) return
    const qr = r0 + dr
    const qc = c0 + dc
    for (const [nr, nc] of [
      [qr - 1, qc],
      [qr + 1, qc],
      [qr, qc - 1],
      [qr, qc + 1],
    ]) {
      if (nr < 0 || nc < 0 || nr >= qs || nc >= qs) continue
      // uniquement les quarts d'autres tuiles
      if (tileOfQuad(n, nr * qs + nc) === cell) continue
      if (grid.cells[nr * qs + nc] === color) {
        colors.add(color)
        return
      }
    }
  })
  return colors.size
}

/** Tous les coups possibles pour le joueur courant, évalués. */
export function enumerateMoves(state: GameState): ScoredMove[] {
  const player = currentPlayer(state)
  // Barème du joueur : une carte structurelle (zones noires positives) change
  // ce qu'il a intérêt à faire, y compris quand elle est personnelle.
  const ruleset = rulesetForPlayer(state, player.id)
  const cells = legalCells(player.board, ruleset.requireAdjacency)
  const before = scoreBoard(player.board, ruleset, player.secretColor)
  const base = before.total
  const blackBefore = before.blackZones
  const out: ScoredMove[] = []

  // Cartes missions du joueur : les bots essaient de les accomplir. Les
  // plateaux des autres (cartes comparatives) ne bougent pas pendant son tour.
  const cards = playerCardIds(state, player.id)
  const others = cards.length
    ? cardTable(
        state.players.filter((p) => p.id !== player.id),
        ruleset,
      )
    : []
  const missionBefore = cards.length
    ? applyCards(
        before,
        {
          playerId: player.id,
          board: player.board,
          ruleset,
          table: [
            { playerId: player.id, zones: computeZones(player.board, ruleset) },
            ...others,
          ],
        },
        cards,
        state.cardColors,
      ).cardPoints
    : 0

  const allowFlip = Boolean(ruleset.variants?.mirrorTiles)
  const candidates: { tileId: number; personal: boolean }[] = availableTiles(state).map((p) => ({
    tileId: p.tileId,
    personal: false,
  }))
  // Tuile personnelle : jouable à tout moment, mais elle a une valeur de
  // réserve — on la décote pour que les bots ne la brûlent pas trop tôt.
  if (
    ruleset.variants?.personalTile &&
    player.personalTileId !== undefined &&
    !player.personalUsed
  ) {
    candidates.push({ tileId: player.personalTileId, personal: true })
  }

  for (const cand of candidates) {
    for (const { rot, flipped } of distinctOrientations(cand.tileId, allowFlip)) {
      for (const cell of cells) {
        const board = placeTile(player.board, cell, cand.tileId, rot, state.round, flipped)
        const breakdown = scoreBoard(board, ruleset, player.secretColor)
        const score = breakdown.total
        let value = evaluateBoard(board, ruleset)
        value += AI_WEIGHTS.centrality * neighbours(player.board.size, cell).length

        // Missions : ce que la pose rapporte déjà, plus une prime au progrès
        // (une carte qui reste à 0 mais dont on se rapproche vaut mieux que rien).
        let missionPoints = 0
        if (cards.length) {
          const table = [
            { playerId: player.id, zones: computeZones(board, ruleset) },
            ...others,
          ]
          missionPoints = applyCards(
            breakdown,
            { playerId: player.id, board, ruleset, table },
            cards,
            state.cardColors,
          ).cardPoints
          value += AI_WEIGHTS.mission * missionPoints
          if (missionPoints > missionBefore) {
            value += AI_WEIGHTS.missionProgress * (missionPoints - missionBefore)
          }
        }

        // Regrouper le noir : pénalise chaque zone noire créée en plus,
        // récompense les fusions.
        const blackAfter = breakdown.blackZones
        value -= AI_WEIGHTS.blackMerge * Math.max(0, blackAfter - blackBefore)
        if (blackAfter < blackBefore + countBlackQuads(cand.tileId) && blackAfter <= blackBefore) {
          value += AI_WEIGHTS.blackMerge
        }

        // Relier plusieurs couleurs d'un coup.
        const linked = connectedColors(player.board, cell, cand.tileId, rot)
        if (linked > 1) value += AI_WEIGHTS.multiColor * (linked - 1)

        if (cand.personal) value -= AI_WEIGHTS.personalReserve

        out.push({
          tileId: cand.tileId,
          cell,
          rot,
          ...(flipped ? { flipped } : {}),
          ...(cand.personal ? { personal: true } : {}),
          score,
          missionPoints,
          value,
          delta: score - base,
        })
      }
    }
  }
  return out
}

/**
 * Politique de repioche des bots (variante Dernier choix aléatoire) : on
 * échange la tuile restante quand le meilleur coup qu'elle permet reste
 * clairement perdant.
 */
export function botWantsRedraw(state: GameState): boolean {
  const moves = enumerateMoves(state)
  if (!moves.length) return false
  const best = moves.reduce((m, x) => (x.delta > m.delta ? x : m))
  return best.delta <= -2
}

function countBlackQuads(tileId: number): number {
  return tileQuads(tileId, 0).filter((q) => q === BLACK).length
}

export function bestMove(state: GameState, kind: PlayerKind = 'bot-smart', rng?: Rng): Move | null {
  const moves = enumerateMoves(state)
  if (!moves.length) return null
  const r = rng ?? new Rng(`${state.options.seed}-${state.round}-${state.turnIndex}`)

  if (kind === 'bot-random') return r.pick(moves)

  // Novice : le meilleur coup immédiat, sans anticipation.
  const key = (m: ScoredMove) => (kind === 'bot-greedy' ? m.score + m.missionPoints : m.value)
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
