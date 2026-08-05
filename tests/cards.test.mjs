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

test('il y a bien 12 cartes', () => {
  assert.equal(E.CARDS.length, 12)
  assert.equal(new Set(E.CARDS.map((c) => c.id)).size, 12)
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
