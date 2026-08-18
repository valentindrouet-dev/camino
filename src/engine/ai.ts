import { legalCells, neighbours, placeTile, quadGrid, tileOfQuad } from './board.ts'
import { applyCards, cardsOutlook, cardTable, playerCardIds, rulesetForPlayer } from './cards.ts'
import { Rng } from './rng.ts'
import { computeZones, pointsForSpan, scoreBoard, scoreSign } from './scoring.ts'
import { distinctOrientations, tileQuads } from './tiles.ts'
import type { Board, Color, GameState, PlayerKind, Rotation, Ruleset, Zone } from './types.ts'
import { BLACK } from './types.ts'
import { availableTiles, canFlipTile, currentPlayer, type Move } from './game.ts'

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
/**
 * Poids de l'évaluation — exposés pour pouvoir régler les bots.
 *
 * Ce que le barème impose comme stratégie, et que les bots doivent comprendre :
 *
 *  1. Il est CONVEXE. Un chemin de 9 tuiles vaut 30 points, trois chemins de 3
 *     en valent 9. Éparpiller est la pire erreur ; il faut une couleur reine,
 *     une seconde, et tant pis pour le reste.
 *  2. Une zone noire coûte 2 points, quelle que soit sa taille. Tout le noir
 *     doit finir dans UNE seule tache, qu'il faut garder ouverte pour accueillir
 *     le noir à venir.
 *  3. Le potentiel s'éteint. À deux manches de la fin, un chemin « qui pourrait
 *     grandir » ne grandira plus : il ne vaut que ce qu'il vaut.
 *  4. Les cartes tout-ou-rien n'offrent aucune pente à un bot qui ne regarde
 *     que le score : il leur faut une espérance (voir `outlook` des cartes).
 */
export const AI_WEIGHTS = {
  /** Poids du potentiel de croissance d'un chemin. */
  growth: 0.2,
  /**
   * Part du budget de tuiles restantes qu'on suppose pouvoir consacrer à la
   * couleur reine, à sa dauphine, à la troisième. Au-delà : rien.
   *
   * Mesuré : viser une seule couleur (1/0/0) coûte 9 points de moyenne, trois
   * couleurs de front en coûtent 3. Le tirage étant subi, il faut mener deux
   * chemins et demi — pas un, pas six.
   */
  focusRates: [0.5, 0.4, 0.2],
  /** Pression contre l'éparpillement : chaque bout de couleur qui ne mènera
   *  nulle part est autant de tuiles perdues pour le grand chemin. */
  fragment: 0.6,
  /** Bonus par couleur supplémentaire raccordée par la pose. */
  multiColor: 1.2,
  /** Préférence pour les poses au centre (plus de voisins = plus d'options). */
  centrality: 0.08,
  /** Décote de la tuile personnelle : on la garde pour un vrai bon coup. */
  personalReserve: 3,
  /** Poids des points de cartes missions déjà acquis par la pose. */
  mission: 1,
  /** Poids de l'espérance de mission — la pente des cartes tout-ou-rien. */
  missionOutlook: 0.8,
  /** Expert : poids du coup d'après, estimé sur des tuiles tirées du sac. */
  lookahead: 0.5,
  /** Expert : valeur de priver le joueur suivant de la tuile qui l'arrangeait. */
  denial: 1.5,
  /** Expert : combien de coups on approfondit, et sur combien de tuiles. */
  beam: 6,
  samples: 2,
  /** Poids des points de cristaux (variante) : préserver les siens. */
  crystal: 1,
}

export interface EvalOpts {
  /** Couleurs interdites du joueur : leurs zones coûtent le malus. */
  forbidden?: Color[]
  /** Plateau commun : seules les zones où le joueur a une tuile comptent. */
  ownTiles?: Set<number> | null
  /** Tuiles que ce joueur posera ENCORE. 0 = le plateau ne bougera plus. */
  roundsLeft?: number
}

/**
 * Évaluation d'un plateau : points réels + ce qu'il reste raisonnablement à
 * en tirer. Tout le jeu du bot tient dans cette fonction.
 */
export function evaluateBoard(
  board: Board,
  ruleset: Ruleset,
  opts: EvalOpts = {},
): number {
  const { forbidden = [], ownTiles = null, roundsLeft = 0 } = opts
  const zones = computeZones(board, ruleset, forbidden)
  const grid = quadGrid(board)
  const qs = grid.size
  const qh = grid.cells.length / qs
  /*
   * Scoring inversé : la partie est le miroir exact de la partie normale —
   * maximiser 20 − S revient à minimiser S. On raisonne donc tout du long sur
   * le barème à l'endroit, et on retourne l'évaluation d'un seul coup à la fin.
   */
  const sign = scoreSign(ruleset)
  const libres = board.cells.reduce((n, c) => n + (c ? 0 : 1), 0)

  /** Cases VIDES que touche une zone : une zone enfermée ne grandira plus. */
  const ouvertures = (z: Zone): number => {
    const vues = new Set<number>()
    for (const q of z.cells) {
      const r = Math.floor(q / qs)
      const c = q % qs
      for (const v of [
        r > 0 ? q - qs : -1,
        r < qh - 1 ? q + qs : -1,
        c > 0 ? q - 1 : -1,
        c < qs - 1 ? q + 1 : -1,
      ]) {
        if (v < 0 || grid.cells[v] !== null) continue
        vues.add(tileOfQuad(board.size, v))
      }
    }
    return vues.size
  }

  let value = 0
  let noires = 0
  const chemins: { z: Zone; ouvre: number }[] = []

  for (const z of zones) {
    // Plateau commun : un chemin sans aucune de ses tuiles ne lui doit rien.
    if (ownTiles && !z.tiles.some((t) => ownTiles.has(t))) continue
    if (z.color === BLACK) {
      noires++
      continue
    }
    // Couleur interdite : la zone coûte le malus quelle que soit sa taille —
    // l'agrandir ne coûte rien, en ouvrir une deuxième coûte cher.
    if (forbidden.includes(z.color)) {
      value += sign * z.points
      continue
    }
    chemins.push({ z, ouvre: ouvertures(z) })
  }

  // Les points acquis, d'abord : ils ne se discutent pas.
  for (const { z } of chemins) value += sign * z.points

  /*
   * Le potentiel, ensuite — et c'est là que tout se joue. Deux pièges :
   *
   *  - on ne peut poser que `roundsLeft` tuiles EN TOUT : le potentiel est un
   *    budget à répartir, pas une prime à distribuer à chaque zone. Sans cela
   *    le bot croit pouvoir mener dix chemins de front, et les mène tous à
   *    trois tuiles — c'est-à-dire à rien ;
   *  - dans une couleur, seul le plus grand chemin mérite l'investissement.
   *    Les miettes ne rapporteront rien : les compter reviendrait à récompenser
   *    l'éparpillement, exactement ce que le barème convexe punit.
   *
   * On ne parie donc que sur la couleur reine et sa dauphine, chacune par son
   * plus grand chemin, avec un budget de tuiles décroissant.
   */
  const meilleurParCouleur = new Map<Color, { z: Zone; ouvre: number }>()
  for (const c of chemins) {
    const dejaVu = meilleurParCouleur.get(c.z.color)
    if (!dejaVu || c.z.span > dejaVu.z.span) meilleurParCouleur.set(c.z.color, c)
  }
  const classement = [...meilleurParCouleur.values()].sort((a, b) => b.z.span - a.z.span)
  const budget = Math.min(roundsLeft, libres)
  classement.forEach((c, i) => {
    if (budget <= 0 || c.ouvre === 0 || i >= AI_WEIGHTS.focusRates.length) return
    const alloue = Math.round(budget * AI_WEIGHTS.focusRates[i])
    const cible = Math.min(9, c.z.span + Math.min(alloue, c.ouvre + roundsLeft))
    const reel = sign * c.z.points
    if (cible > c.z.span) value += AI_WEIGHTS.growth * (pointsForSpan(cible, ruleset) - reel)
  })

  // Éparpiller, c'est perdre : chaque quart bloqué dans un chemin trop court
  // est un quart qui manquera au grand. Le score réel ne le dit pas — il vaut
  // zéro, ni plus ni moins — mais le bot doit le sentir.
  let miettes = 0
  for (const { z, ouvre } of chemins) {
    if (z.scoring) continue
    if (ouvre === 0 || roundsLeft === 0) miettes += z.span
    else miettes += z.span * 0.4
  }
  value -= AI_WEIGHTS.fragment * miettes

  /*
   * Le noir : rien de plus que son coût réel. J'ai essayé d'appuyer — prime à
   * la tache unique, prime à la tache encore ouverte pour accueillir le noir à
   * venir — et les deux FONT PERDRE des points (mesuré : −1,3 et −1,5 de
   * moyenne). La raison est que le bot se met alors à sacrifier des chemins
   * pour ranger son noir, alors qu'une zone noire de plus ne coûte que 2
   * points. Le barème disait déjà le juste prix ; il fallait l'écouter.
   */
  value += noires * ruleset.blackPenalty

  return sign * value
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
  // Couleurs interdites du joueur (variante) : les bots les évitent.
  const forbidden = ruleset.variants?.forbiddenColor ? (player.forbiddenColors ?? []) : []
  // Plateau commun : « tching ! » — ce qui compte, c'est le delta du score du
  // plateau au moment de la pose, lu à travers la loupe du joueur (couleur
  // secrète, couleurs interdites) mais sans sa cagnotte.
  const shared = Boolean(ruleset.variants?.sharedBoard)
  const lens = shared
    ? { secretColor: player.secretColor, forbiddenColors: player.forbiddenColors }
    : player
  const before = scoreBoard(player.board, ruleset, player)
  const base = before.total
  const boardBefore = shared ? scoreBoard(player.board, ruleset, lens).total : 0
  /*
   * Tuiles que ce joueur posera ENCORE après celle-ci. C'est ce qui éteint le
   * potentiel à l'approche de la fin : à la dernière manche, un chemin ne vaut
   * plus que ce qu'il vaut, et le bot arrête de rêver.
   */
  const roundsLeft = Math.max(0, state.totalRounds - state.round - 1)
  const evalOpts: EvalOpts = { forbidden, roundsLeft }
  const evalBefore = shared ? evaluateBoard(player.board, ruleset, evalOpts) : 0
  // Scoring inversé : regrouper le noir, relier les couleurs, accomplir une
  // mission — tout ce qui était payant se retourne.
  const sign = scoreSign(ruleset)
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
        const board = placeTile(
          player.board,
          cell,
          cand.tileId,
          rot,
          shared ? state.round * state.players.length + state.turnIndex : state.round,
          flipped,
          shared ? player.id : undefined,
        )
        const breakdown = scoreBoard(board, ruleset, lens)
        // Plateau commun : le coup vaut son delta encaissé, plus un peu du
        // potentiel qu'il crée — potentiel que les autres peuvent voler.
        const deltaLens = shared ? breakdown.total - boardBefore : 0
        const score = shared ? base + deltaLens : breakdown.total
        let value = shared
          ? 2 * deltaLens + 0.4 * (evaluateBoard(board, ruleset, evalOpts) - evalBefore)
          : evaluateBoard(board, ruleset, evalOpts)
        value += AI_WEIGHTS.centrality * neighbours(player.board.size, cell, player.board.cells.length).length

        /*
         * Missions. Deux termes bien distincts : ce que la pose rapporte DÉJÀ,
         * et ce que la carte rapportera probablement si l'on continue ainsi.
         * Le second est indispensable — sans lui, une carte tout-ou-rien reste
         * à zéro jusqu'au dernier instant et le bot ne la joue jamais.
         */
        let missionPoints = 0
        if (cards.length) {
          const ctxCarte = {
            playerId: player.id,
            board,
            boardColor: player.boardColor,
            ruleset,
            table: [{ playerId: player.id, zones: computeZones(board, ruleset) }, ...others],
          }
          missionPoints = applyCards(
            breakdown,
            ctxCarte,
            cards,
            state.cardColors,
            state.cardAxes,
          ).cardPoints
          value += AI_WEIGHTS.mission * missionPoints
          // La pente ne vaut qu'à l'endroit : en scoring inversé, accomplir une
          // mission coûte, et le bot s'en détourne de lui-même.
          if (sign === 1 && roundsLeft > 0) {
            const espere = cardsOutlook(
              { ...ctxCarte, breakdown },
              cards,
              state.cardColors,
              state.cardAxes,
            )
            value += AI_WEIGHTS.missionOutlook * Math.max(0, espere - missionPoints)
          }
        }

        // Relier les couleurs, préserver les cristaux : sur le plateau commun,
        // tout est déjà chiffré dans le delta encaissé.
        if (!shared) {
          const linked = connectedColors(player.board, cell, cand.tileId, rot)
          if (linked > 1) value += sign * AI_WEIGHTS.multiColor * (linked - 1)

          if (ruleset.variants?.crystals) {
            value += AI_WEIGHTS.crystal * (breakdown.crystalPoints - before.crystalPoints)
          }
        }

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
/**
 * Politique de verso des bots (variante Verso aléatoire) : on retourne la
 * tuile du meilleur coup quand même lui reste clairement perdant.
 */
export function botWantsFlip(state: GameState): number | null {
  const moves = enumerateMoves(state)
  if (!moves.length) return null
  const best = moves.reduce((m, x) => (x.value > m.value ? x : m))
  if (best.delta > -2 || best.personal) return null
  return canFlipTile(state, best.tileId) ? best.tileId : null
}

export function botWantsRedraw(state: GameState): boolean {
  const moves = enumerateMoves(state)
  if (!moves.length) return false
  const best = moves.reduce((m, x) => (x.delta > m.delta ? x : m))
  return best.delta <= -2
}

/** Le meilleur au sens de `key`, au hasard entre ex æquo. */
function meilleur(moves: ScoredMove[], key: (m: ScoredMove) => number, r: Rng): ScoredMove {
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

/**
 * Expert — ce qu'il a de plus que le Confirmé.
 *
 * 1. Il regarde un coup plus loin : pour chacun de ses meilleurs coups, il
 *    tire quelques tuiles du sac et mesure ce que son plateau vaudrait après
 *    la meilleure suite. Un coup qui marque aujourd'hui mais qui referme le
 *    plateau perd contre un coup qui laisse la place à un long chemin.
 * 2. Il regarde ce qu'il LAISSE : la tuile qu'il prend est une tuile de moins
 *    pour le joueur suivant. À valeur presque égale, il emporte celle qui
 *    arrangeait le plus son voisin.
 */
function affinerExpert(state: GameState, moves: ScoredMove[]): ScoredMove[] {
  const player = currentPlayer(state)
  const ruleset = rulesetForPlayer(state, player.id)
  if (ruleset.variants?.sharedBoard || ruleset.variants?.syncDraw) return moves
  const forbidden = player.forbiddenColors ?? []
  const roundsLeft = Math.max(0, state.totalRounds - state.round - 1)

  const tete = [...moves].sort((a, b) => b.value - a.value).slice(0, AI_WEIGHTS.beam)
  if (tete.length < 2 || roundsLeft === 0) return moves

  // --- ce que la tuile aurait fait dans les mains du joueur suivant
  const menaces = new Map<number, number>()
  const suivantId = (state.bagHolder + state.turnIndex + 1) % state.players.length
  const suivant = state.turnIndex + 1 < state.players.length ? state.players[suivantId] : null
  const menaceDe = (tileId: number): number => {
    if (!suivant) return 0
    const connue = menaces.get(tileId)
    if (connue !== undefined) return connue
    const cells = legalCells(suivant.board, ruleset.requireAdjacency)
    const avant = scoreBoard(suivant.board, ruleset, suivant).total
    let best = 0
    for (const { rot, flipped } of distinctOrientations(tileId, false)) {
      for (const cell of cells) {
        const b = placeTile(suivant.board, cell, tileId, rot, state.round, flipped)
        const gain = scoreBoard(b, ruleset, suivant).total - avant
        if (gain > best) best = gain
      }
    }
    menaces.set(tileId, best)
    return best
  }

  // --- quelques tuiles du sac, pour juger de la suite
  const echantillon: number[] = []
  for (let i = 0; i < AI_WEIGHTS.samples && i < state.bag.length; i++) {
    echantillon.push(state.bag[Math.floor((state.bag.length * (i + 1)) / (AI_WEIGHTS.samples + 1))])
  }

  const suite = (board: Board, tileId: number): number => {
    const cells = legalCells(board, ruleset.requireAdjacency)
    let best = -Infinity
    for (const { rot, flipped } of distinctOrientations(tileId, false)) {
      for (const cell of cells) {
        const b = placeTile(board, cell, tileId, rot, state.round + 1, flipped)
        const v = evaluateBoard(b, ruleset, { forbidden, roundsLeft: roundsLeft - 1 })
        if (v > best) best = v
      }
    }
    return best === -Infinity ? 0 : best
  }

  const vus = new Set(tete)
  return moves.map((m) => {
    if (!vus.has(m)) return m
    let bonus = AI_WEIGHTS.denial * (m.personal ? 0 : menaceDe(m.tileId))
    if (echantillon.length) {
      const board = placeTile(
        player.board,
        m.cell,
        m.tileId,
        m.rot,
        state.round,
        m.flipped,
      )
      const moyenne =
        echantillon.reduce((n, t) => n + suite(board, t), 0) / echantillon.length
      bonus += AI_WEIGHTS.lookahead * moyenne
    }
    return { ...m, value: m.value + bonus }
  })
}

export function bestMove(state: GameState, kind: PlayerKind = 'bot-smart', rng?: Rng): Move | null {
  const moves = enumerateMoves(state)
  if (!moves.length) return null
  const r = rng ?? new Rng(`${state.options.seed}-${state.round}-${state.turnIndex}`)

  // Idiot : n'importe quel coup légal.
  if (kind === 'bot-random') return r.pick(moves)
  // Novice : le meilleur coup immédiat, sans anticipation ni potentiel.
  if (kind === 'bot-greedy') return meilleur(moves, (m) => m.score + m.missionPoints, r)
  // Confirmé : l'évaluation complète, un coup à la fois.
  if (kind !== 'bot-expert') return meilleur(moves, (m) => m.value, r)
  // Expert : la même, plus le coup d'après et ce qu'il laisse à son voisin.
  return meilleur(affinerExpert(state, moves), (m) => m.value, r)
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
