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
import { computeZones, scoreSign } from './scoring.ts'
import type { Board, Color, Ruleset, ScoreBreakdown, Zone } from './types.ts'
import { BLACK, PATH_COLORS } from './types.ts'
import { COLOR_NAMES } from './scoring.ts'

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
  /** Couleur tirée pour cette carte, quand elle en dépend (`colorized`). */
  color?: Color
  /** Axe tiré pour cette carte, quand elle en dépend (`randomAxis`). */
  axis?: 'col' | 'row'
}

export interface CardResult {
  points: number
  /** Explication courte affichée au joueur. */
  detail: string
  /**
   * La carte ne s'ajoute pas au décompte : elle en modifie la règle, et son
   * effet est déjà compris dans le score (voir `effectiveRuleset`).
   */
  structural?: boolean
}

export interface MissionCard {
  id: string
  /**
   * Texte exact de la carte. `{couleur}` est remplacé par la couleur tirée en
   * début de partie pour les cartes `colorized`.
   */
  text: string
  /** Valeur affichée dans la pastille de la carte. */
  badge: string
  /** Nom court pour les listes et les statistiques. */
  name: string
  /** La couleur visée est tirée au hasard au début de chaque partie. */
  colorized?: boolean
  /** L'axe visé (colonne ou ligne) est tiré au hasard au début de chaque partie. */
  randomAxis?: boolean
  /** Carte d'extension (affichée dans une autre couleur que celles de la boîte). */
  extra?: boolean
  evaluate(ctx: CardContext): CardResult
}

/** Texte d'une carte, couleur et axe tirés compris. */
export function cardText(card: MissionCard, color?: Color, axis?: 'col' | 'row'): string {
  let text = card.text
  if (card.colorized) {
    const nom = color ? COLOR_NAMES[color].toLowerCase() : 'de la couleur tirée'
    text = text.replace('{couleur}', nom)
  }
  if (card.randomAxis) {
    text = text.replace('{axe}', axis === 'row' ? 'ligne' : 'colonne')
  }
  return text
}

/** Chemins qui marquent : zones de couleur d'au moins `minSpan` tuiles. */
function paths(ctx: CardContext): Zone[] {
  return ctx.breakdown.zones.filter((z) => z.scoring)
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`
}

/** Nombre de zones noires d'un plateau. */
function blackZones(zones: Zone[]): number {
  return zones.filter((z) => z.color === BLACK).length
}

/** Quarts du pourtour du plateau (la couronne extérieure de la grille). */
function edgeQuads(boardSize: number): Set<number> {
  const qs = boardSize * 2
  const out = new Set<number>()
  for (let i = 0; i < qs; i++) {
    out.add(i)
    out.add(qs * (qs - 1) + i)
    out.add(i * qs)
    out.add(i * qs + qs - 1)
  }
  return out
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

/** Les 4 quarts du centre du plateau. */
function centreQuads(boardSize: number): number[] {
  const qs = boardSize * 2
  const a = qs / 2 - 1
  const b = qs / 2
  return [a * qs + a, a * qs + b, b * qs + a, b * qs + b]
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
      // Cette carte ne s'ajoute pas au total : elle inverse la valeur des zones
      // noires, déjà appliquée par `effectiveRuleset` partout — plateau,
      // pastilles de points, score en direct et décompte final.
      const z = ctx.breakdown.blackZones
      return {
        points: 0,
        structural: true,
        detail: z
          ? `${plural(z, 'zone noire', 'zones noires')} à +2 : ${z * 2} pts déjà comptés`
          : 'aucune zone noire pour l’instant',
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
    name: 'Plus grand chemin d’une couleur',
    badge: '+10',
    colorized: true,
    text: '+10 points pour le plus grand chemin {couleur}. Si égalité, +5 points par joueur.',
    evaluate(ctx) {
      const cible = ctx.color ?? 'P'
      const nom = COLOR_NAMES[cible].toLowerCase()
      const bestOf = (zones: Zone[]) =>
        zones
          .filter((z) => z.color === cible && z.span >= ctx.ruleset.minSpan)
          .reduce((m, z) => Math.max(m, z.span), 0)
      const mine = bestOf(ctx.breakdown.zones)
      if (mine === 0) return { points: 0, detail: `aucun chemin ${nom}` }
      const all = ctx.table.map((t) => bestOf(t.zones))
      const best = Math.max(...all)
      if (mine < best) return { points: 0, detail: `${nom} de ${mine} tuiles, battu par ${best}` }
      const exaequo = all.filter((v) => v === best).length
      return {
        points: exaequo > 1 ? 5 : 10,
        detail:
          exaequo > 1
            ? `à égalité (${best} tuiles) avec ${exaequo - 1} autre${exaequo > 2 ? 's' : ''}`
            : `plus grand ${nom} (${best} tuiles)`,
      }
    },
  },
  {
    id: 'orange-paths',
    name: 'Chemins d’une couleur',
    badge: '+8',
    colorized: true,
    text: '+8 points pour chaque chemin {couleur}.',
    evaluate(ctx) {
      const cible = ctx.color ?? 'O'
      const nom = COLOR_NAMES[cible].toLowerCase()
      const n = paths(ctx).filter((z) => z.color === cible).length
      return { points: n * 8, detail: plural(n, `chemin ${nom}`) }
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
  // ------------------------------------------------------- cartes d'extension
  {
    id: 'immaculate',
    name: 'Plateau immaculé',
    badge: '+12',
    extra: true,
    text: '+12 points si votre plateau ne compte aucune zone noire.',
    evaluate(ctx) {
      const n = ctx.breakdown.blackZones
      return n === 0
        ? { points: 12, detail: 'aucune zone noire' }
        : { points: 0, detail: plural(n, 'zone noire', 'zones noires') }
    },
  },
  {
    id: 'longest-table',
    name: 'Le plus long chemin',
    badge: '+10',
    extra: true,
    text:
      '+10 points pour le plus long chemin de la table, toutes couleurs confondues. Si égalité, +5 points par joueur.',
    evaluate(ctx) {
      const bestOf = (zones: Zone[]) =>
        zones
          .filter((z) => z.color !== BLACK && z.span >= ctx.ruleset.minSpan)
          .reduce((m, z) => Math.max(m, z.span), 0)
      const mine = bestOf(ctx.breakdown.zones)
      if (mine === 0) return { points: 0, detail: 'aucun chemin qui marque' }
      const all = ctx.table.map((t) => bestOf(t.zones))
      const best = Math.max(...all)
      if (mine < best) return { points: 0, detail: `${mine} tuiles, battu par ${best}` }
      const exaequo = all.filter((v) => v === best).length
      return {
        points: exaequo > 1 ? 5 : 10,
        detail:
          exaequo > 1
            ? `à égalité (${best} tuiles) avec ${exaequo - 1} autre${exaequo > 2 ? 's' : ''}`
            : `plus long chemin de la table (${best} tuiles)`,
      }
    },
  },
  {
    id: 'specialist',
    name: 'Spécialiste',
    badge: '+12',
    extra: true,
    text: '+12 points si une même couleur vous donne 3 chemins qui marquent ou plus.',
    evaluate(ctx) {
      const parCouleur = new Map<Color, number>()
      for (const z of paths(ctx)) parCouleur.set(z.color, (parCouleur.get(z.color) ?? 0) + 1)
      const best = Math.max(0, ...parCouleur.values())
      return best >= 3
        ? { points: 12, detail: `${best} chemins d’une même couleur` }
        : { points: 0, detail: `${best} chemin${best > 1 ? 's' : ''} au mieux dans une couleur` }
    },
  },
  {
    id: 'symmetry',
    name: 'Symétrie',
    badge: '+10',
    extra: true,
    text: '+10 points si vos deux plus longs chemins font exactement la même longueur.',
    evaluate(ctx) {
      const spans = paths(ctx)
        .map((z) => z.span)
        .sort((a, b) => b - a)
      if (spans.length < 2) return { points: 0, detail: 'moins de deux chemins qui marquent' }
      return spans[0] === spans[1]
        ? { points: 10, detail: `deux chemins de ${spans[0]} tuiles` }
        : { points: 0, detail: `${spans[0]} et ${spans[1]} tuiles` }
    },
  },
  {
    id: 'heart',
    name: 'Cœur du plateau',
    badge: '+6',
    extra: true,
    text: '+6 points pour chaque chemin qui marque et occupe le centre du plateau.',
    evaluate(ctx) {
      const centre = centreQuads(ctx.board.size)
      const n = paths(ctx).filter((z) => centre.some((c) => z.cells.includes(c))).length
      return { points: n * 6, detail: plural(n, 'chemin') + ' par le centre' }
    },
  },
  {
    id: 'four-corners',
    name: 'Les quatre angles',
    badge: '+12',
    extra: true,
    text: '+12 points si les 4 angles du plateau appartiennent à des chemins qui marquent.',
    evaluate(ctx) {
      const corners = cornerQuads(ctx.board.size)
      const pris = corners.filter((c) => paths(ctx).some((z) => z.cells.includes(c))).length
      return pris === 4
        ? { points: 12, detail: 'les 4 angles marquent' }
        : { points: 0, detail: `${pris} angle${pris > 1 ? 's' : ''} sur 4` }
    },
  },
  {
    id: 'thrifty',
    name: 'Économe',
    badge: '+10',
    extra: true,
    text: '+10 points si vous avez le moins de zones noires de la table. Si égalité, +5 points par joueur.',
    evaluate(ctx) {
      const mine = blackZones(ctx.breakdown.zones)
      const all = ctx.table.map((t) => blackZones(t.zones))
      const best = Math.min(...all)
      if (mine > best) return { points: 0, detail: `${mine} zones noires, le meilleur en a ${best}` }
      const exaequo = all.filter((v) => v === best).length
      return {
        points: exaequo > 1 ? 5 : 10,
        detail:
          exaequo > 1
            ? `à égalité (${best}) avec ${exaequo - 1} autre${exaequo > 2 ? 's' : ''}`
            : `le moins de zones noires (${best})`,
      }
    },
  },
  {
    id: 'clean-edge',
    name: 'Frontière nette',
    badge: '+6',
    extra: true,
    text: '+6 points si aucune de vos zones noires ne touche le bord du plateau.',
    evaluate(ctx) {
      const bord = edgeQuads(ctx.board.size)
      const sales = ctx.breakdown.zones.filter(
        (z) => z.color === BLACK && z.cells.some((c) => bord.has(c)),
      ).length
      if (sales > 0) {
        return { points: 0, detail: `${plural(sales, 'zone noire', 'zones noires')} sur le bord` }
      }
      const noires = blackZones(ctx.breakdown.zones)
      return {
        points: 6,
        // Un plateau sans noir remplit la condition sans avoir rien à éviter :
        // c'est le cas le plus propre qui soit, on ne va pas le lui reprocher.
        detail: noires ? `${plural(noires, 'zone noire', 'zones noires')} loin du bord` : 'aucune zone noire',
      }
    },
  },
  {
    id: 'missing-color',
    name: 'Le vide',
    badge: '+15',
    extra: true,
    text: '+15 points si une des six couleurs est totalement absente de votre plateau.',
    evaluate(ctx) {
      // Sur les quarts posés, et rien d'autre : un carré arc-en-ciel est un
      // joker, pas une couleur — il ne « remplit » aucune des six.
      const vus = new Set(quadGrid(ctx.board).cells.filter((c): c is Color => c !== null))
      const absentes = PATH_COLORS.filter((c) => !vus.has(c))
      return absentes.length
        ? {
            points: 15,
            detail: `${absentes.map((c) => COLOR_NAMES[c].toLowerCase()).join(', ')} absent${
              absentes.length > 1 ? 'es' : 'e'
            }`,
          }
        : { points: 0, detail: 'les 6 couleurs sont là' }
    },
  },
  {
    id: 'mapper',
    name: 'Cartographe',
    badge: '+8',
    extra: true,
    randomAxis: true,
    text: '+8 points si chaque {axe} du plateau contient au moins 4 quarts appartenant à des chemins qui marquent.',
    evaluate(ctx) {
      const n = ctx.board.size
      const qs = n * 2
      const axis = ctx.axis ?? 'col'
      const parLigne = new Array(n).fill(0)
      for (const z of ctx.breakdown.zones) {
        if (!z.scoring) continue
        for (const c of z.cells) {
          parLigne[axis === 'row' ? Math.floor(Math.floor(c / qs) / 2) : Math.floor((c % qs) / 2)]++
        }
      }
      const pleines = parLigne.filter((x) => x >= 4).length
      const nom = axis === 'row' ? 'ligne' : 'colonne'
      return pleines >= n
        ? { points: 8, detail: `les ${n} ${nom}s marquent` }
        : { points: 0, detail: `${pleines} ${nom}${pleines > 1 ? 's' : ''} sur ${n}` }
    },
  },
  {
    id: 'four-sides',
    name: 'Les 4 bords',
    badge: '+8',
    extra: true,
    text: '+8 points si chaque bord du plateau est touché par un chemin qui marque.',
    evaluate(ctx) {
      const qs = ctx.board.size * 2
      const touches = new Set<number>()
      for (const z of ctx.breakdown.zones) {
        if (!z.scoring) continue
        for (const c of z.cells) {
          const r = Math.floor(c / qs)
          const col = c % qs
          if (r === 0) touches.add(0)
          if (col === qs - 1) touches.add(1)
          if (r === qs - 1) touches.add(2)
          if (col === 0) touches.add(3)
        }
      }
      return touches.size === 4
        ? { points: 8, detail: 'les 4 bords sont touchés' }
        : { points: 0, detail: `${touches.size} bord${touches.size > 1 ? 's' : ''} sur 4` }
    },
  },
  {
    id: 'black-belt',
    name: 'Ceinture noire',
    badge: '+12',
    extra: true,
    text: '+12 points si vous avez une seule zone noire — et qu’elle traverse au moins 4 tuiles.',
    evaluate(ctx) {
      const noires = ctx.breakdown.zones.filter((z) => z.color === BLACK)
      if (noires.length === 1 && noires[0].span >= 4) {
        return { points: 12, detail: `une seule zone noire, ${noires[0].span} tuiles` }
      }
      if (noires.length === 0) return { points: 0, detail: 'aucune zone noire' }
      if (noires.length > 1) {
        return { points: 0, detail: `${noires.length} zones noires au lieu d’une` }
      }
      return { points: 0, detail: `une zone noire de ${noires[0].span} tuile${noires[0].span > 1 ? 's' : ''} (minimum 4)` }
    },
  },
]
export function cardById(id: string | undefined): MissionCard | undefined {
  return id ? CARDS.find((c) => c.id === id) : undefined
}

/**
 * Barème réellement appliqué compte tenu de la carte de la table.
 *
 * La carte « Les zones noires deviennent positives » ne se contente pas
 * d'ajouter des points : elle change la valeur d'une zone noire. On la traduit
 * donc en barème, ce qui garantit que le plateau, les pastilles, le score en
 * direct, la courbe et le décompte final racontent tous la même chose.
 */
export function effectiveRuleset(ruleset: Ruleset, cardId?: string): Ruleset {
  if (cardId !== 'black-positive') return ruleset
  return { ...ruleset, blackPenalty: Math.abs(ruleset.blackPenalty) }
}

/** Cartes qui s'appliquent à un joueur donné (table ou perso). */
export function playerCardIds(
  state: {
    options: { useCards: boolean; personalCards?: boolean }
    cardId?: string
    cardIds?: string[]
    players: { id: number; cardId?: string }[]
  },
  playerId: number,
): string[] {
  if (state.options.personalCards) {
    const own = state.players.find((p) => p.id === playerId)?.cardId
    return own ? [own] : []
  }
  if (!state.options.useCards) return []
  if (state.cardIds?.length) return state.cardIds
  return state.cardId ? [state.cardId] : []
}

/** Barème en vigueur pour UN joueur, cartes structurelles comprises. */
export function rulesetForPlayer(
  state: {
    options: { ruleset: Ruleset; useCards: boolean; personalCards?: boolean }
    cardId?: string
    cardIds?: string[]
    players: { id: number; cardId?: string }[]
  },
  playerId: number,
): Ruleset {
  let r = state.options.ruleset
  for (const id of playerCardIds(state, playerId)) r = effectiveRuleset(r, id)
  return r
}

/** Barème en vigueur du point de vue général (cartes de la table). */
export function activeRuleset(state: {
  options: { ruleset: Ruleset; useCards: boolean; personalCards?: boolean }
  cardId?: string
  cardIds?: string[]
  players?: { id: number; cardId?: string }[]
}): Ruleset {
  if (state.options.personalCards) return state.options.ruleset
  if (!state.options.useCards) return state.options.ruleset
  let r = state.options.ruleset
  for (const id of state.cardIds?.length ? state.cardIds : state.cardId ? [state.cardId] : []) {
    r = effectiveRuleset(r, id)
  }
  return r
}

/** Applique une LISTE de cartes : les bonus se cumulent. */
export function applyCards(
  breakdown: ScoreBreakdown,
  ctx: Omit<CardContext, 'breakdown' | 'color' | 'axis'>,
  cardIds: string[],
  /** Couleurs tirées en début de partie pour les cartes qui en dépendent. */
  colors?: Record<string, Color>,
  /** Axes (colonne/ligne) tirés en début de partie, même principe. */
  axes?: Record<string, 'col' | 'row'>,
): ScoreBreakdown {
  let out = breakdown
  let points = 0
  const labels: string[] = []
  let structural: boolean | undefined
  // Scoring inversé : une mission accomplie coûte ce qu'elle rapportait. Les
  // cartes structurelles n'ajoutent rien ici — leur effet passe par le barème,
  // qui est déjà retourné.
  const sign = scoreSign(ctx.ruleset)
  for (const id of cardIds) {
    const card = cardById(id)
    if (!card) continue
    const brut = card.evaluate({ ...ctx, breakdown: out, color: colors?.[id], axis: axes?.[id] })
    const r = sign === 1 ? brut : { ...brut, points: -brut.points || 0 }
    points += r.points
    labels.push(cardIds.length > 1 ? `${card.name} : ${r.detail}` : r.detail)
    if (r.structural) structural = true
    out = { ...out, total: out.total + r.points }
  }
  return {
    ...out,
    cardPoints: points,
    cardLabel: labels.length ? labels.join(' · ') : undefined,
    cardStructural: structural,
  }
}

/** Décompte enrichi de la carte mission de la table. */
export function applyCard(
  breakdown: ScoreBreakdown,
  ctx: Omit<CardContext, 'breakdown'>,
  cardId?: string,
): ScoreBreakdown {
  const card = cardById(cardId)
  if (!card) return breakdown
  const brut = card.evaluate({ ...ctx, breakdown })
  const { detail, structural } = brut
  const points = scoreSign(ctx.ruleset) * brut.points || 0
  return {
    ...breakdown,
    cardPoints: points,
    cardLabel: detail,
    cardStructural: structural,
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
