import { applyCard, cardTable } from './cards.ts'
import { scoreBoard } from './scoring.ts'
import type { GameState, Player, ScoreBreakdown } from './types.ts'

export * from './types.ts'
export * from './tiles.ts'
export * from './board.ts'
export * from './scoring.ts'
export * from './game.ts'
export * from './ai.ts'
export * from './stats.ts'
export * from './cards.ts'
export * from './rng.ts'

/**
 * Décompte complet d'un joueur : zones + carte mission de la table.
 * La carte a besoin des plateaux des autres joueurs (carte « plus grand
 * chemin violet »), d'où le passage de l'état complet.
 */
export function scorePlayer(player: Player, state: GameState): ScoreBreakdown {
  const ruleset = state.options.ruleset
  const breakdown = scoreBoard(player.board, ruleset)
  if (!state.options.useCards || !state.cardId) return breakdown
  return applyCard(
    breakdown,
    {
      playerId: player.id,
      board: player.board,
      ruleset,
      table: cardTable(state.players, ruleset),
    },
    state.cardId,
  )
}

/** Décompte de tous les joueurs (le contexte des cartes n'est calculé qu'une fois). */
export function scoreAll(state: GameState): ScoreBreakdown[] {
  const ruleset = state.options.ruleset
  const table = state.options.useCards && state.cardId ? cardTable(state.players, ruleset) : []
  return state.players.map((player) => {
    const breakdown = scoreBoard(player.board, ruleset)
    if (!table.length) return breakdown
    return applyCard(
      breakdown,
      { playerId: player.id, board: player.board, ruleset, table },
      state.cardId,
    )
  })
}
