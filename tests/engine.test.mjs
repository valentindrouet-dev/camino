import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')

test('le sac contient bien les 97 tuiles officielles', () => {
  assert.equal(E.TILE_COUNT, 97)
  const count = {}
  for (const t of E.TILES) for (const q of t.quads) count[q] = (count[q] ?? 0) + 1
  // Planche officielle : 55 quarts de chaque couleur, 58 quarts noirs.
  for (const c of ['Y', 'O', 'R', 'G', 'B', 'P']) assert.equal(count[c], 55, `couleur ${c}`)
  assert.equal(count.K, 58)
  assert.equal(Object.values(count).reduce((a, b) => a + b, 0), 97 * 4)
})

test('la rotation est un décalage circulaire réversible', () => {
  for (const t of E.TILES.slice(0, 20)) {
    assert.deepEqual(E.rotatedQuads(t.quads, 0), t.quads)
    const r4 = [1, 2, 3].reduce((q) => q, t.quads)
    assert.deepEqual(r4, t.quads)
    const once = E.rotatedQuads(t.quads, 1)
    assert.equal(once[1], t.quads[0], 'le haut-gauche passe en haut-droite')
    assert.deepEqual(E.rotatedQuads(E.rotatedQuads(once, 1), 2), t.quads)
  }
})

test('une tuile unie n’a qu’une seule orientation utile', () => {
  const uni = E.TILES.findIndex((t) => new Set(t.quads).size === 1)
  if (uni >= 0) assert.equal(E.distinctRotations(uni).length, 1)
  const varied = E.TILES.findIndex((t) => new Set(t.quads).size === 4)
  if (varied >= 0) assert.equal(E.distinctRotations(varied).length, 4)
})

test('une partie complète se déroule jusqu’au bout', () => {
  const config = {
    players: [
      { name: 'A', kind: 'bot-smart' },
      { name: 'B', kind: 'bot-greedy' },
      { name: 'C', kind: 'bot-random' },
    ],
    options: E.defaultOptions('test-partie'),
  }
  let state = E.createGame(config)
  const used = new Set()
  let guard = 0
  while (state.phase === 'playing' && guard++ < 500) {
    const move = E.bestMove(state, E.currentPlayer(state).kind)
    assert.ok(move, 'un coup légal existe toujours tant que le plateau n’est pas plein')
    assert.ok(!used.has(move.tileId), 'aucune tuile n’est jouée deux fois')
    used.add(move.tileId)
    state = E.applyMove(state, move)
  }
  assert.equal(state.phase, 'finished')
  assert.equal(state.round, 16)
  for (const p of state.players) {
    assert.equal(E.placedCount(p.board), 16, 'plateau plein')
  }
  assert.equal(state.log.length, 16 * 3)
})

test('la pose doit toucher une tuile déjà en place', () => {
  const config = {
    players: [{ name: 'A', kind: 'human' }],
    options: E.defaultOptions('adjacence'),
  }
  let state = E.createGame(config)
  // Première tuile : n'importe où.
  assert.equal(E.currentLegalCells(state).length, 16)
  state = E.applyMove(state, { tileId: state.pool[0].tileId, cell: 0, rot: 0 })
  // Ensuite : uniquement les voisines orthogonales.
  assert.deepEqual(E.currentLegalCells(state).sort((a, b) => a - b), [1, 4])
})

test('le barème est modifiable et recalcule les scores', () => {
  const board = E.createBoard(4)
  // Une tuile à dominante verte, posée trois fois de suite : chemin de 3 tuiles.
  const green = E.TILES.findIndex(
    (t) => t.quads.filter((q) => q === 'G').length === 3 && t.quads[0] === 'G' && t.quads[1] === 'G',
  )
  assert.ok(green >= 0, 'il existe une tuile avec 3 quarts verts adjacents')
  let b = board
  for (const cell of [0, 1, 2]) b = E.placeTile(b, cell, green, 0, 0)
  assert.equal(E.scoreOf(b, E.DEFAULT_RULESET), 3)
  const doubled = { ...E.DEFAULT_RULESET, pointsBySpan: [0, 0, 0, 6, 10, 16, 24, 34, 46, 60] }
  assert.equal(E.scoreOf(b, doubled), 6)
})
