import { applyCard } from './cards.ts'
import { scoreBoard } from './scoring.ts'
import type { GameOptions, Player, ScoreBreakdown } from './types.ts'

export * from './types.ts'
export * from './tiles.ts'
export * from './board.ts'
export * from './scoring.ts'
export * from './game.ts'
export * from './ai.ts'
export * from './stats.ts'
export * from './cards.ts'
export * from './rng.ts'

/** Décompte complet d'un joueur : zones + carte mission éventuelle. */
export function scorePlayer(player: Player, options: GameOptions): ScoreBreakdown {
  const breakdown = scoreBoard(player.board, options.ruleset)
  if (!options.useCards) return breakdown
  return applyCard(breakdown, player.board, options.ruleset, player.cardId)
}
