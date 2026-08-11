import { applyCards, cardById, cardTable, playerCardIds, rulesetForPlayer } from './cards.ts'
import type { MissionCard } from './cards.ts'
import { scoreBoard, scoreSign } from './scoring.ts'
import type { Color, GameState, Player, ScoreBreakdown } from './types.ts'

export * from './types.ts'
export * from './tiles.ts'
export * from './board.ts'
export * from './scoring.ts'
export * from './game.ts'
export * from './ai.ts'
export * from './stats.ts'
export * from './cards.ts'
export * from './rng.ts'
export * from './view.ts'

/**
 * Décompte complet d'un joueur : zones + carte mission de la table.
 * La carte a besoin des plateaux des autres joueurs (carte « plus grand
 * chemin violet »), d'où le passage de l'état complet.
 */
export function scorePlayer(player: Player, state: GameState): ScoreBreakdown {
  const ruleset = rulesetForPlayer(state, player.id)
  const breakdown = scoreBoard(player.board, ruleset, player)
  const cards = playerCardIds(state, player.id)
  if (!cards.length) return breakdown
  return applyCards(
    breakdown,
    {
      playerId: player.id,
      board: player.board,
      ruleset,
      table: cardTable(state.players, ruleset),
    },
    cards,
    state.cardColors,
    state.cardAxes,
  )
}

/** Décompte de tous les joueurs. */
export function scoreAll(state: GameState): ScoreBreakdown[] {
  return state.players.map((player) => scorePlayer(player, state))
}

/** Résultat détaillé de chaque carte mission d'un joueur (pour l'affichage). */
export function cardResults(
  state: GameState,
  playerId: number,
): {
  card: MissionCard
  points: number
  detail: string
  structural?: boolean
  /** Couleur tirée pour cette carte, si elle en dépend. */
  color?: Color
  /** Axe tiré pour cette carte, si elle en dépend. */
  axis?: 'col' | 'row'
}[] {
  const ids = playerCardIds(state, playerId)
  if (!ids.length) return []
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return []
  const ruleset = rulesetForPlayer(state, playerId)
  const breakdown = scoreBoard(player.board, ruleset, player)
  const table = cardTable(state.players, ruleset)
  return ids.flatMap((id) => {
    const card = cardById(id)
    if (!card) return []
    const color = state.cardColors?.[id]
    const axis = state.cardAxes?.[id]
    const brut = card.evaluate({ playerId, board: player.board, breakdown, ruleset, table, color, axis })
    // Scoring inversé : une mission accomplie coûte ce qu'elle rapportait.
    const points = scoreSign(ruleset) * brut.points || 0
    return [{ card, points, detail: brut.detail, structural: brut.structural, color, axis }]
  })
}
