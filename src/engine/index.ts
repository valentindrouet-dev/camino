import {
  applyCards,
  cardById,
  CARDS,
  cardTable,
  effectiveRuleset,
  playerCardIds,
  rulesetForPlayer,
} from './cards.ts'
import type { MissionCard } from './cards.ts'
import { scoreBoard, scoreSign } from './scoring.ts'
import type { PlayerScoring } from './scoring.ts'
import type {
  Board,
  BoardColor,
  Color,
  GameState,
  Player,
  Ruleset,
  ScoreBreakdown,
} from './types.ts'
import { DEFAULT_RULESET } from './types.ts'

export * from './types.ts'
export * from './tiles.ts'
export * from './board.ts'
export * from './scoring.ts'
export * from './game.ts'
export * from './ai.ts'
export * from './stats.ts'
export * from './solo.ts'
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
      boardColor: player.boardColor,
      ruleset,
      table: cardTable(state.players, ruleset),
    },
    cards,
    state.cardColors,
    state.cardAxes,
    state.cardSeuils,
  )
}

/** Une mission choisie à la main, avec ce qu'elle demande de préciser. */
export interface MissionChoisie {
  cardId: string
  /** Couleur visée, pour les cartes qui en dépendent. */
  color?: Color
  /** Axe visé (colonne ou ligne), pour les cartes qui en dépendent. */
  axis?: 'col' | 'row'
  /** Seuil retenu, pour les cartes qui en demandent un. */
  seuil?: number
}

export interface DecompteLibre {
  bilan: ScoreBreakdown
  /** Barème réellement appliqué : une carte peut le retourner. */
  ruleset: Ruleset
  /** Couleurs traitées comme du noir (« Couleur bannie »), pour l'affichage. */
  forbidden: Color[]
  /** Une entrée par mission, dans l'ordre choisi. */
  missions: {
    card: MissionCard
    points: number
    detail: string
    structural?: boolean
    color?: Color
    axis?: 'col' | 'row'
    seuil?: number
  }[]
}

/**
 * Décompte d'un plateau SEUL, missions comprises — c'est ce dont le scanner a
 * besoin : il n'y a pas de partie, pas de joueurs, juste un plateau lu sur une
 * photo et les cartes que la table avait devant elle.
 *
 * Trois cartes ne s'ajoutent pas au total : elles changent la façon de compter,
 * et leur effet doit donc entrer AVANT le décompte des zones — « Noir positif »
 * retourne le barème, « Couleur secrète » double un chemin, « Couleur bannie »
 * traite une couleur comme du noir. C'est pour cela qu'on ne peut pas se
 * contenter d'additionner des points de carte au score du plateau.
 *
 * Deux cartes se jugent en comparant les plateaux de la table (« le plus grand
 * chemin », « le moins de zones noires »). Sur un plateau isolé, elles sont
 * donc toujours accomplies : c'est exact, mais ça n'a de sens qu'en solo.
 * `missionComparative()` permet de le dire à qui lit le résultat.
 */
export function scoreLibre(
  board: Board,
  missions: MissionChoisie[],
  /** Couleur du cadre imprimé : « Bord assorti » en a besoin. */
  boardColor?: BoardColor,
  base: Ruleset = DEFAULT_RULESET,
): DecompteLibre {
  const ids = missions.map((m) => m.cardId)
  // Une carte structurelle change le barème : c'est le premier effet à poser.
  let ruleset = base
  for (const id of ids) ruleset = effectiveRuleset(ruleset, id)

  // Couleur secrète et couleur bannie ne rapportent pas de points : elles
  // modifient le décompte des zones lui-même.
  const who: PlayerScoring = {}
  for (const m of missions) {
    if (!m.color) continue
    if (m.cardId === 'secret-color') who.secretColor = m.color
    if (m.cardId === 'banned-color') {
      who.forbiddenColors = [...(who.forbiddenColors ?? []), m.color]
    }
  }

  const socle = scoreBoard(board, ruleset, who)
  const forbidden = who.forbiddenColors ?? []
  if (!ids.length) return { bilan: socle, ruleset, forbidden, missions: [] }

  const table = cardTable([{ id: 0, board }], ruleset)
  const colors: Record<string, Color> = {}
  const axes: Record<string, 'col' | 'row'> = {}
  const seuils: Record<string, number> = {}
  for (const m of missions) {
    if (m.color) colors[m.cardId] = m.color
    if (m.axis) axes[m.cardId] = m.axis
    if (m.seuil !== undefined) seuils[m.cardId] = m.seuil
  }

  const ctx = { playerId: 0, board, boardColor, ruleset, table }
  const bilan = applyCards(socle, ctx, ids, colors, axes, seuils)

  // Le détail carte par carte, pour l'affichage. Aucune carte ne lit le total
  // du décompte : les évaluer toutes sur le même socle donne le même résultat
  // que la boucle d'`applyCards`, et permet de les présenter séparément.
  const sign = scoreSign(ruleset)
  const detail = missions.flatMap((m) => {
    const card = cardById(m.cardId)
    if (!card) return []
    const brut = card.evaluate({
      ...ctx,
      breakdown: socle,
      color: m.color,
      axis: m.axis,
      seuil: m.seuil,
    })
    return [
      {
        card,
        points: sign * brut.points || 0,
        detail: brut.detail,
        structural: brut.structural,
        color: m.color,
        axis: m.axis,
        seuil: m.seuil,
      },
    ]
  })
  return { bilan, ruleset, forbidden, missions: detail }
}

/**
 * Cette mission se juge-t-elle en comparant les plateaux de la table ? Sur un
 * plateau isolé, elle est toujours accomplie — il faut le dire.
 */
export function missionComparative(cardId: string): boolean {
  return cardId === 'purple-longest' || cardId === 'thrifty'
}

/**
 * Cette mission a-t-elle besoin de savoir de quelle couleur est le cadre du
 * plateau ? Sans elle, « Bord assorti » ne rapporte jamais rien — mesuré : de
 * 0 à 12 points selon la couleur, 0 quand on ne la donne pas.
 */
export function missionDemandeBord(cardId: string): boolean {
  return cardId === 'matching-edge'
}

/**
 * Cette mission demande-t-elle de préciser une couleur ? Soit qu'elle soit
 * tirée en début de partie (`colorized`), soit qu'elle soit propre au joueur
 * (« Couleur secrète »).
 */
export function missionDemandeCouleur(card: MissionCard): boolean {
  return Boolean(card.colorized || card.colorParJoueur)
}

/** Les cartes qu'on peut juger sur une simple photo de plateau. */
export function missionsScannables(): MissionCard[] {
  // « Mort subite » ne compte aucun point : elle met fin à la partie. Elle n'a
  // rien à faire dans un décompte.
  return CARDS.filter((c) => !c.sudden)
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
  /** Seuil retenu pour cette carte, si elle en demande un. */
  seuil?: number
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
    const seuil = state.cardSeuils?.[id]
    const brut = card.evaluate({
      playerId,
      board: player.board,
      boardColor: player.boardColor,
      breakdown,
      ruleset,
      table,
      color,
      axis,
      seuil,
    })
    // Scoring inversé : une mission accomplie coûte ce qu'elle rapportait.
    const points = scoreSign(ruleset) * brut.points || 0
    return [{ card, points, detail: brut.detail, structural: brut.structural, color, axis, seuil }]
  })
}
