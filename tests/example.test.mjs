// Vérifie le moteur de score contre l'exemple de décompte imprimé dans la règle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
const { computeZones, scoreBoard } = await import('../src/engine/scoring.ts')
const { DEFAULT_RULESET } = await import('../src/engine/types.ts')
const { TILES } = await import('../src/engine/tiles.ts')

// Grille 8x8 de l'exemple (page 2 de la règle), lue quart par quart.
const EXAMPLE = [
  'RYYRKBBB',
  'KYOOBBGR',
  'KPPOOORR',
  'KPPGGGGR',
  'GPPPGPGR',
  'GBBBBKGO',
  'GGGYROOO',
  'PPKKRYBG',
].map((r) => r.split(''))

// On fabrique un plateau 4x4 en inventant des tuiles ad hoc correspondant aux
// quarts de l'exemple (l'exemple de la règle n'utilise pas forcément des tuiles
// réelles du sac : ce qui est testé ici, c'est l'algorithme de comptage).
const board = { size: 4, cells: [] }
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 4; c++) {
    const quads = [
      EXAMPLE[r * 2][c * 2],
      EXAMPLE[r * 2][c * 2 + 1],
      EXAMPLE[r * 2 + 1][c * 2 + 1],
      EXAMPLE[r * 2 + 1][c * 2],
    ]
    const id = TILES.length + r * 4 + c
    TILES[id] = { id, quads }
    board.cells[r * 4 + c] = { tileId: id, rot: 0, round: 0 }
  }
}

test('exemple de la règle : décompte par couleur', () => {
  const s = scoreBoard(board, DEFAULT_RULESET)
  assert.equal(s.byColor.Y.points, 0, 'Jaune : 0 pt')
  assert.equal(s.byColor.O.points, 6, 'Orange : 6 pts (2 x 3 tuiles)')
  assert.equal(s.byColor.R.points, 3, 'Rouge : 3 pts (1 x 3 tuiles)')
  assert.equal(s.byColor.G.points, 11, 'Vert : 11 pts (1 x 3 et 1 x 5 tuiles)')
  assert.equal(s.byColor.B.points, 3, 'Bleu : 3 pts (1 x 3 tuiles)')
  assert.equal(s.byColor.P.points, 5, 'Violet : 5 pts (1 x 4 tuiles)')
  assert.equal(s.blackZones, 4, '4 zones noires')
  assert.equal(s.blackPoints, -8, 'Noir : -8 pts')
  assert.equal(s.total, 20, 'Total : 20 pts')
})

test('spans attendus', () => {
  const z = computeZones(board, DEFAULT_RULESET)
  const spans = (col) => z.filter((x) => x.color === col && x.points > 0).map((x) => x.span).sort()
  assert.deepEqual(spans('O'), [3, 3])
  assert.deepEqual(spans('G'), [3, 5])
  assert.deepEqual(spans('P'), [4])
})
