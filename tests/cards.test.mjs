// Vérifie chacune des 12 cartes missions sur un plateau construit à la main.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')
const { TILES, DEFAULT_RULESET: R } = E

/** Construit un plateau 4x4 à partir d'une grille 8x8 de lettres. */
function boardFrom(rows) {
  const board = E.createBoard(4)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const quads = [
        rows[r * 2][c * 2],
        rows[r * 2][c * 2 + 1],
        rows[r * 2 + 1][c * 2 + 1],
        rows[r * 2 + 1][c * 2],
      ]
      const id = TILES.length
      TILES.push({ id, quads })
      board.cells[r * 4 + c] = { tileId: id, rot: 0, round: 0 }
    }
  }
  return board
}

function evalCard(id, rows, extraBoards = []) {
  const board = boardFrom(rows.map((s) => s.split('')))
  const breakdown = E.scoreBoard(board, R)
  const table = [
    { playerId: 0, zones: E.computeZones(board, R) },
    ...extraBoards.map((b, i) => ({
      playerId: i + 1,
      zones: E.computeZones(boardFrom(b.map((s) => s.split(''))), R),
    })),
  ]
  const card = E.cardById(id)
  assert.ok(card, `carte ${id} inconnue`)
  return { ...card.evaluate({ playerId: 0, board, breakdown, ruleset: R, table }), breakdown }
}

// Grille de référence : l'exemple de la règle (jaune 0, orange 6, rouge 3,
// vert 11, bleu 3, violet 5, 4 zones noires).
const EXAMPLE = [
  'RYYRKBBB',
  'KYOOBBGR',
  'KPPOOORR',
  'KPPGGGGR',
  'GPPPGPGR',
  'GBBBBKGO',
  'GGGYROOO',
  'PPKKRYBG',
]

test('12 cartes de la boîte + 9 cartes d’extension, toutes distinctes', () => {
  assert.equal(E.CARDS.length, 21)
  assert.equal(new Set(E.CARDS.map((c) => c.id)).size, 21)
  assert.equal(E.CARDS.filter((c) => c.extra).length, 9)
  // les deux cartes à couleur variable annoncent leur couleur dans leur texte
  const colorees = E.CARDS.filter((c) => c.colorized)
  assert.equal(colorees.length, 2)
  for (const c of colorees) {
    assert.match(c.text, /\{couleur\}/)
    assert.match(E.cardText(c, 'G'), /vert/)
    assert.doesNotMatch(E.cardText(c, 'G'), /\{couleur\}/)
  }
})

test('chemins d’exactement 4 tuiles (+5)', () => {
  // L'exemple contient un seul chemin de 4 tuiles : le violet.
  const r = evalCard('exact-4', EXAMPLE)
  assert.equal(r.points, 5)
})

test('chemins d’exactement 5 tuiles (+8)', () => {
  // Un seul : le grand chemin vert (5 tuiles).
  assert.equal(evalCard('exact-5', EXAMPLE).points, 8)
})

test('chemins d’au moins 6 tuiles (+10)', () => {
  assert.equal(evalCard('long-6', EXAMPLE).points, 0)
  // Une ligne verte complète traverse 4 tuiles ; deux lignes en font 8.
  const wide = [
    'GGGGGGGG',
    'GGGGGGGG',
    'RRRRRRRR',
    'YYYYYYYY',
    'BBBBBBBB',
    'PPPPPPPP',
    'OOOOOOOO',
    'KKKKKKKK',
  ]
  assert.equal(evalCard('long-6', wide).points, 0, '4 tuiles seulement par bande')
})

test('les zones noires deviennent positives (+2)', () => {
  // Cette carte ne s'ajoute pas au total : elle change le barème. Le moteur
  // l'applique partout via effectiveRuleset, donc la carte elle-même ne
  // rapporte rien de plus — sinon les points seraient comptés deux fois.
  const r = evalCard('black-positive', EXAMPLE)
  assert.equal(r.breakdown.blackZones, 4)
  assert.equal(r.points, 0)
  assert.equal(r.structural, true)

  const positif = E.effectiveRuleset(R, 'black-positive')
  assert.equal(positif.blackPenalty, 2, 'une zone noire vaut +2')

  const board = boardFrom(EXAMPLE.map((x) => x.split('')))
  const normal = E.scoreBoard(board, R)
  const avecCarte = E.scoreBoard(board, positif)
  assert.equal(normal.total, 20, 'décompte officiel')
  assert.equal(avecCarte.blackZones, 4)
  assert.equal(avecCarte.blackPoints, 8, 'le noir rapporte au lieu de coûter')
  assert.equal(avecCarte.total, normal.colorPoints + 8)

  // Les pastilles du plateau affichent bien +2 sur chaque zone noire.
  const noires = E.computeZones(board, positif).filter((z) => z.color === 'K')
  assert.equal(noires.length, 4)
  for (const z of noires) assert.equal(z.points, 2)
  assert.match(E.zoneLabel(noires[0], positif), /\+2/)
})

test('5 et 6 couleurs', () => {
  // L'exemple marque dans 5 couleurs (pas de jaune).
  assert.equal(evalCard('five-colors', EXAMPLE).points, 12)
  assert.equal(evalCard('six-colors', EXAMPLE).points, 0)
})

test('les carrés de 2 tuiles ou plus (+6)', () => {
  // Un carré jaune à cheval sur deux tuiles, et rien d'autre de carré.
  const rows = [
    'RGRGRGRG',
    'GRYYGRGR',
    'RGYYRGRG',
    'GRGRGRGR',
    'RGRGRGRG',
    'GRGRGRGR',
    'RGRGRGRG',
    'GRGRGRGR',
  ]
  assert.equal(evalCard('squares', rows).points, 6)
  // Le même carré aligné sur une seule tuile ne compte pas.
  const single = [
    'RGRGRGRG',
    'GRGRGRGR',
    'RGYYRGRG',
    'GRYYGRGR',
    'RGRGRGRG',
    'GRGRGRGR',
    'RGRGRGRG',
    'GRGRGRGR',
  ]
  assert.equal(evalCard('squares', single).points, 0)
})

test('le plus grand chemin violet (+10, +5 en cas d’égalité)', () => {
  const rival = EXAMPLE.slice()
  // Adversaire sans violet du tout : le joueur est seul en tête.
  const noPurple = EXAMPLE.map((r) => r.replaceAll('P', 'R'))
  assert.equal(evalCard('purple-longest', EXAMPLE, [noPurple]).points, 10)
  // Adversaire au plateau identique : égalité.
  assert.equal(evalCard('purple-longest', EXAMPLE, [rival]).points, 5)
  // Le joueur sans violet ne marque rien.
  assert.equal(evalCard('purple-longest', noPurple, [EXAMPLE]).points, 0)
})

test('chemins orange (+8)', () => {
  // Deux chemins orange qui marquent dans l'exemple.
  assert.equal(evalCard('orange-paths', EXAMPLE).points, 16)
})

test('relier deux bords opposés (+12)', () => {
  assert.equal(evalCard('crossing', EXAMPLE).points, 0)
  const across = [
    'RRRRRRRR',
    'GBGBGBGB',
    'BGBGBGBG',
    'GBGBGBGB',
    'BGBGBGBG',
    'GBGBGBGB',
    'BGBGBGBG',
    'GBGBGBGB',
  ]
  assert.equal(evalCard('crossing', across).points, 12, 'une bande rouge de bord à bord')
})

test('chemins passant par un angle (+6)', () => {
  // Dans l'exemple, le chemin vert du bas-gauche part du coin ? On teste un cas net.
  const corner = [
    'RRRGGGGG',
    'RGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
  ]
  // Le rouge occupe le coin haut-gauche mais ne traverse que 2 tuiles : il ne
  // marque pas. Le vert, lui, couvre les trois autres angles : un seul chemin
  // compte, donc +6.
  assert.equal(evalCard('corners', corner).points, 6)
  const long = [
    'RRRRRRRR',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
  ]
  // Rouge : 4 tuiles et deux angles ; vert : 16 tuiles, deux angles du bas.
  assert.equal(evalCard('corners', long).points, 12, 'deux chemins passent par un angle')
})

test('enfermer une couleur ou du noir (+10)', () => {
  const ring = [
    'RRRRRRRR',
    'RRRRRRRR',
    'RRRKKRRR',
    'RRRKKRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    'GGGGGGGG',
    'GGGGGGGG',
  ]
  assert.equal(evalCard('enclose', ring).points, 10, 'le rouge enferme le noir')
  const open = [
    'KKRRRRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    'GGGGGGGG',
    'GGGGGGGG',
  ]
  assert.equal(evalCard('enclose', open).points, 0, 'le noir touche un bord')
})

test('cartes missions multiples : x cartes tirées, cumulées pour tout le monde', () => {
  const mkGame = (options) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
      ],
      options: { ...E.defaultOptions('multi-cartes'), ...options },
    })
  const s = mkGame({ useCards: true, cardCount: 3 })
  assert.equal(s.cardIds.length, 3)
  assert.equal(new Set(s.cardIds).size, 3, 'trois cartes distinctes')
  // Les mêmes cartes s'appliquent à tous les joueurs.
  assert.deepEqual(E.playerCardIds(s, 0), s.cardIds)
  assert.deepEqual(E.playerCardIds(s, 1), s.cardIds)

  // Le cumul : la somme des cartes prises une à une = le total des cartes.
  const board = boardFrom(EXAMPLE.map((x) => x.split('')))
  const state = { ...s, players: s.players.map((p) => ({ ...p, board })) }
  const ids = ['exact-4', 'exact-5', 'orange-paths'] // +5, +8, +16 sur l'exemple
  // « chemins d'une couleur » vise la couleur tirée : on la fixe sur l'orange
  const withCards = { ...state, cardId: ids[0], cardIds: ids, cardColors: { 'orange-paths': 'O' } }
  const total = E.scorePlayer(withCards.players[0], withCards)
  assert.equal(total.cardPoints, 5 + 8 + 16, 'les bonus se cumulent')
  const sans = E.scoreBoard(board, R)
  assert.equal(total.total, sans.total + 29)
  // Le détail nomme chaque carte.
  for (const id of ids) assert.match(total.cardLabel, new RegExp(E.cardById(id).name))
  assert.equal(E.cardResults(withCards, 0).length, 3)
})

test('cartes missions persos : chacun la sienne, jamais celle du voisin', () => {
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
      { name: 'C', kind: 'human', boardColor: 'G' },
    ],
    options: { ...E.defaultOptions('persos'), useCards: false, personalCards: true },
  })
  const own = s.players.map((p) => p.cardId)
  assert.ok(own.every(Boolean), 'chaque joueur a une carte')
  assert.equal(new Set(own).size, 3, 'trois cartes différentes')
  assert.equal(s.cardIds, undefined, 'pas de cartes de table')
  for (const p of s.players) {
    assert.deepEqual(E.playerCardIds(s, p.id), [p.cardId])
  }

  // Un joueur qui tient « zones noires positives » a son propre barème.
  const board = boardFrom(EXAMPLE.map((x) => x.split('')))
  const state = {
    ...s,
    players: s.players.map((p, i) => ({
      ...p,
      board,
      cardId: i === 0 ? 'black-positive' : 'exact-4',
    })),
  }
  assert.equal(E.rulesetForPlayer(state, 0).blackPenalty, 2)
  assert.equal(E.rulesetForPlayer(state, 1).blackPenalty, R.blackPenalty)
  const [a, b] = [E.scorePlayer(state.players[0], state), E.scorePlayer(state.players[1], state)]
  assert.equal(a.blackPoints, 8, 'le noir rapporte pour lui seul')
  assert.equal(b.blackPoints, 4 * R.blackPenalty)
  assert.equal(b.cardPoints, 5, 'l’autre marque sa propre carte')
})

test('cartes persos et cartes de table sont exclusives', () => {
  const cfg = {
    players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
    options: { ...E.defaultOptions('exclu'), useCards: true, personalCards: true },
  }
  assert.match(E.configError(cfg), /persos/)
})

test('les bots visent les cartes missions', () => {
  // Carte « chemins orange » : à situation égale, le Stratège doit préférer
  // le coup qui sert la mission.
  const mk = (useCards) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'bot-smart', boardColor: 'O' },
        { name: 'B', kind: 'bot-smart', boardColor: 'B' },
      ],
      options: {
        ...E.defaultOptions('missions-bots'),
        useCards,
        ...(useCards ? { cardId: 'orange-paths' } : {}),
      },
    })

  // Les coups sont bien notés avec les points de mission.
  const s = mk(true)
  const moves = E.enumerateMoves(s)
  assert.ok(moves.length > 0)
  assert.ok(
    moves.every((m) => typeof m.missionPoints === 'number'),
    'chaque coup connaît ses points de mission',
  )

  // Sur une partie complète, la carte rapporte plus quand les bots la voient.
  const play = (state) => {
    let cur = state
    while (cur.phase === 'playing') {
      const mv = E.bestMove(cur, 'bot-smart')
      if (!mv) break
      cur = E.applyMove(cur, mv)
    }
    return cur
  }
  const avec = play(mk(true))
  const cartes = E.scoreAll(avec).reduce((n, b) => n + b.cardPoints, 0)
  assert.ok(cartes > 0, `les bots accomplissent la mission (${cartes} pts)`)
})

test('frontière nette : aucune zone noire ne touche le bord (+6)', () => {
  // une zone noire bien au centre, loin du pourtour
  const centre = [
    'RRYYOOGG',
    'RRYYOOGG',
    'BBRRYYOO',
    'BBKKYYOO',
    'GGKKRRBB',
    'GGPPRRBB',
    'YYOOGGRR',
    'YYOOGGRR',
  ]
  const r = evalCard('clean-edge', centre)
  assert.equal(r.points, 6, r.detail)
  assert.equal(r.breakdown.blackZones, 1, 'il y a bien du noir à éviter')

  // la même zone noire posée sur le bord : plus rien
  const bord = [
    'KKYYOOGG',
    'KKYYOOGG',
    'BBRRYYOO',
    'BBRRYYOO',
    'GGPPRRBB',
    'GGPPRRBB',
    'YYOOGGRR',
    'YYOOGGRR',
  ]
  assert.equal(evalCard('clean-edge', bord).points, 0)

  // l'exemple de la règle a 4 zones noires, dont sur le bord
  assert.equal(evalCard('clean-edge', EXAMPLE).points, 0)
})

test('le vide : une couleur absente du plateau (+15)', () => {
  // pas un seul quart bleu
  const sansBleu = [
    'RRYYOOGG',
    'RRYYOOGG',
    'PPRRYYOO',
    'PPRRYYOO',
    'GGPPRRYY',
    'GGPPRRYY',
    'YYOOGGRR',
    'YYOOGGRR',
  ]
  const r = evalCard('missing-color', sansBleu)
  assert.equal(r.points, 15)
  assert.match(r.detail, /bleu/)

  // l'exemple de la règle porte les six couleurs
  assert.equal(evalCard('missing-color', EXAMPLE).points, 0)

  // le noir ne compte pas comme une couleur, et un carré arc-en-ciel ne
  // remplace aucune des six
  const avecJoker = sansBleu.map((l, i) => (i < 2 ? 'WW' + l.slice(2) : l))
  assert.equal(evalCard('missing-color', avecJoker).points, 15, 'le joker ne fait pas le bleu')
})

test('les détails des cartes accordent leurs pluriels', () => {
  const centre = [
    'RRYYOOGG',
    'RRYYOOGG',
    'BBRRYYOO',
    'BBKKYYOO',
    'GGKKRRBB',
    'GGPPRRBB',
    'YYOOGGRR',
    'YYOOGGRR',
  ]
  assert.match(evalCard('clean-edge', centre).detail, /^1 zone noire loin du bord$/)
  // l'exemple de la règle a 4 zones noires, dont 3 touchent le pourtour
  assert.match(evalCard('clean-edge', EXAMPLE).detail, /^3 zones noires sur le bord$/)
})
