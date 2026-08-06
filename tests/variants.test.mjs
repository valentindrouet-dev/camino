// Les 8 variantes : pose, zones, score.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')
const R = E.DEFAULT_RULESET

function withVariants(variants) {
  return { ...R, variants }
}

/** Plateau 4x4 construit à partir d'une grille 8x8 de lettres ('.' = vide). */
function boardFrom(rows, borders) {
  const board = E.createBoard(4)
  if (borders) board.borders = borders
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const quads = [
        rows[r * 2][c * 2],
        rows[r * 2][c * 2 + 1],
        rows[r * 2 + 1][c * 2 + 1],
        rows[r * 2 + 1][c * 2],
      ]
      if (quads.includes('.')) continue
      const id = E.TILES.length
      E.TILES.push({ id, quads })
      board.cells[r * 4 + c] = { tileId: id, rot: 0, round: 0 }
    }
  }
  return board
}

const VIDE = '........'

test('tuiles miroir : le miroir inverse gauche-droite et la pose l’applique', () => {
  const quads = E.tileQuads(21, 0)
  const miroir = E.tileQuads(21, 0, true)
  assert.deepEqual([...miroir], [quads[1], quads[0], quads[3], quads[2]])
  // sans la variante, un coup retourné est illégal
  const cfg = (variants) => ({
    players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
    options: { ...E.defaultOptions('miroir'), ruleset: withVariants(variants) },
  })
  let s1 = E.createGame(cfg(undefined))
  const t1 = s1.pool[0].tileId
  assert.equal(E.isLegalMove(s1, { tileId: t1, cell: 0, rot: 0, flipped: true }), false)
  let s2 = E.createGame(cfg({ mirrorTiles: true }))
  const t2 = s2.pool[0].tileId
  assert.equal(E.isLegalMove(s2, { tileId: t2, cell: 0, rot: 0, flipped: true }), true)
  s2 = E.applyMove(s2, { tileId: t2, cell: 0, rot: 0, flipped: true })
  assert.equal(s2.players[0].board.cells[0].flipped, true)
})

test('tuiles monochromes et blanches : le sac grossit selon les variantes', () => {
  const mk = (variants) =>
    E.createGame({
      players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
      options: { ...E.defaultOptions('sac'), ruleset: withVariants(variants) },
    })
  const base = mk(undefined)
  assert.equal(base.bag.length + base.pool.length, 97)
  const mono = mk({ monoTiles: true })
  assert.equal(mono.bag.length + mono.pool.length, 109)
  const tout = mk({ monoTiles: true, whiteTiles: true })
  assert.equal(tout.bag.length + tout.pool.length, 115)
})

test('tuiles blanches : le blanc prolonge et relie les chemins de toutes les couleurs', () => {
  // deux tuiles rouges séparées par une tuile blanche ; une bleue sous la blanche
  const rows = [
    'RRWWRR..',
    'RRWWRR..',
    '..BB....',
    '..BB....',
    VIDE, VIDE, VIDE, VIDE,
  ]
  const board = boardFrom(rows)
  const zones = E.computeZones(board, R)
  const rouge = zones.find((z) => z.color === 'R')
  const bleu = zones.find((z) => z.color === 'B')
  // rouge : 2 tuiles rouges + la blanche traversée = 3 tuiles -> 3 pts
  assert.equal(rouge.span, 3)
  assert.equal(rouge.points, 3)
  // bleu : sa tuile + la blanche = 2 tuiles, sous le minimum
  assert.equal(bleu.span, 2)
  assert.equal(bleu.points, 0)
  // et une seule zone rouge : le blanc RELIE les deux tuiles rouges
  assert.equal(zones.filter((z) => z.color === 'R').length, 1)
})

test('bordures colorées : un bloc par côté touché, une seule fois', () => {
  // une colonne orange qui longe le bord gauche et touche le bord haut
  const rows = [
    'OO......',
    'OO......',
    'OO......',
    'OO......',
    VIDE, VIDE, VIDE, VIDE,
  ]
  const board = boardFrom(rows, { kind: 'uniform', color: 'O' })
  const zones = E.computeZones(board, R)
  const orange = zones.find((z) => z.color === 'O')
  // 2 tuiles + bloc gauche + bloc haut = 4 -> 5 pts (le côté ne compte qu'une fois,
  // même longé sur toute sa hauteur)
  assert.equal(orange.borders, 2)
  assert.equal(orange.span, 4)
  assert.equal(orange.points, 5)
  assert.equal(new Set(orange.borderIds).size, 2)
  // la même forme en vert ne profite pas du bord orange
  const vert = boardFrom(
    ['GG......', 'GG......', 'GG......', 'GG......', VIDE, VIDE, VIDE, VIDE],
    { kind: 'uniform', color: 'O' },
  )
  const zv = E.computeZones(vert, R).find((z) => z.color === 'G')
  assert.equal(zv.borders, 0)
  assert.equal(zv.span, 2)
})

test('bordures colorées : le bord rallonge chaque chemin sans jamais les relier', () => {
  // deux tuiles oranges séparées, toutes deux au bord haut
  const rows = [
    'OO..OO..',
    'OO..OO..',
    VIDE, VIDE, VIDE, VIDE, VIDE, VIDE,
  ]
  const board = boardFrom(rows, { kind: 'uniform', color: 'O' })
  const oranges = E.computeZones(board, R).filter((z) => z.color === 'O')
  assert.equal(oranges.length, 2, 'le bord ne fusionne pas les deux chemins')
  // tuile de gauche : 1 tuile + bloc haut + bloc gauche = 3 ;
  // tuile de droite : 1 tuile + bloc haut = 2
  const spans = oranges.map((z) => z.span).sort()
  assert.deepEqual(spans, [2, 3])
  const borders = oranges.map((z) => z.borders).sort()
  assert.deepEqual(borders, [1, 2])
})

test('bordures multicolores : fixes par plateau, coins isolants, jamais deux identiques côte à côte', () => {
  for (const color of E.BOARD_COLORS) {
    const a = E.multiBorderFor(color)
    const b = E.multiBorderFor(color)
    assert.deepEqual(a, b, 'plateau imprimé : toujours identique')
    for (const side of a.squares) {
      assert.equal(side.length, 8)
      for (let i = 1; i < side.length; i++) {
        assert.notEqual(side[i], side[i - 1], 'pas deux carrés identiques adjacents')
      }
    }
  }
})

test('bordures multicolores : un carré relié compte comme une case de plus', () => {
  const spec = E.multiBorderFor('O')
  const c = spec.squares[0][0] // couleur du premier carré du bord haut
  const rows = [
    `${c}${c}......`,
    `${c}${c}......`,
    VIDE, VIDE, VIDE, VIDE, VIDE, VIDE,
  ]
  const board = boardFrom(rows, spec)
  const zone = E.computeZones(board, R).find((z) => z.color === c)
  // 1 tuile + au moins le carré (0,0) du bord haut + peut-être (3,0) à gauche
  assert.ok(zone.borders >= 1, `au moins un carré de bord relié (${zone.borders})`)
  assert.equal(zone.span, 1 + zone.borders)
})

test('étoiles magiques : barème des groupes et comptage sur le plateau', () => {
  // une étoile seule vaut 1 ; chaque étoile reliée en vaut 2 (groupe = 2×N)
  assert.equal(E.starClusterPoints(0), 0)
  assert.equal(E.starClusterPoints(1), 1)
  assert.equal(E.starClusterPoints(2), 4)
  assert.equal(E.starClusterPoints(3), 6)
  assert.equal(E.starClusterPoints(4), 8)
  assert.equal(E.starClusterPoints(5), 10)
  assert.equal(E.starClusterPoints(7), 14)

  // deux tuiles étoilées dont les quarts étoilés se touchent en une même couleur
  const starred = [...E.STARS.keys()]
  const ruleset = withVariants({ magicStars: true })
  const board = E.createBoard(4)
  const id = starred[0]
  board.cells[0] = { tileId: id, rot: 0, round: 0 }
  const solo = E.scoreBoard(board, ruleset)
  assert.equal(solo.starPoints, 1, 'une étoile isolée vaut 1 point')

  // sans la variante : aucun point d'étoile
  const sans = E.scoreBoard(board, R)
  assert.equal(sans.starPoints, 0)
})

test('tuile personnelle : sans noir, jouable une seule fois, la tuile du centre retourne au sac', () => {
  const cfg = {
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
    ],
    options: { ...E.defaultOptions('perso'), ruleset: withVariants({ personalTile: true }) },
  }
  let s = E.createGame(cfg)
  for (const p of s.players) {
    assert.ok(p.personalTileId !== undefined)
    assert.ok(!E.TILES[p.personalTileId].quads.includes('K'), 'jamais de noir')
    assert.equal(p.personalUsed, false)
  }
  const total = s.bag.length + s.pool.length
  assert.equal(total, 97 - 2, 'les tuiles personnelles sortent du sac')

  const perso = s.players[0].personalTileId
  assert.equal(E.isLegalMove(s, { tileId: perso, cell: 0, rot: 0, personal: true }), true)
  s = E.applyMove(s, { tileId: perso, cell: 0, rot: 0, personal: true })
  assert.equal(s.players[0].personalUsed, true)
  assert.equal(s.players[0].board.cells[0].tileId, perso)
  // plus jouable une seconde fois
  assert.equal(E.isLegalMove(s, { tileId: perso, cell: 1, rot: 0, personal: true }), false)
  // le second joueur joue du centre ; au tour suivant, la tuile non prise revient au sac
  const bagAvant = s.bag.length
  const libre = E.availableTiles(s)[0]
  s = E.applyMove(s, { tileId: libre.tileId, cell: 0, rot: 0 })
  assert.equal(s.round, 1)
  // 1 tuile restée au centre, retournée au sac, puis 2 nouvelles tirées
  assert.equal(s.bag.length, bagAvant + 1 - 2)
})

test('dernier choix aléatoire : une repioche, sans retour', () => {
  const cfg = {
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
    ],
    options: { ...E.defaultOptions('repioche'), ruleset: withVariants({ lastPickRandom: true }) },
  }
  let s = E.createGame(cfg)
  assert.equal(E.canRedrawLastTile(s), false, 'pas pour le premier joueur')
  s = E.applyMove(s, { tileId: s.pool[0].tileId, cell: 0, rot: 0 })
  assert.equal(E.canRedrawLastTile(s), true, 'le dernier peut repiocher')
  const restante = E.availableTiles(s)[0].tileId
  const s2 = E.redrawLastTile(s)
  const nouvelle = E.availableTiles(s2)[0].tileId
  assert.notEqual(nouvelle, restante)
  assert.equal(s2.bag[0], restante, 'la tuile refusée part au fond du sac')
  assert.equal(E.canRedrawLastTile(s2), false, 'une seule fois')
  // sans la variante : jamais
  let s3 = E.createGame({ ...cfg, options: { ...cfg.options, ruleset: R } })
  s3 = E.applyMove(s3, { tileId: s3.pool[0].tileId, cell: 0, rot: 0 })
  assert.equal(E.canRedrawLastTile(s3), false)
})

test('exclusivité : bordures colorées + multicolores refusées ensemble', () => {
  const err = E.configError({
    players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
    options: {
      ...E.defaultOptions('x'),
      ruleset: withVariants({ coloredBorders: true, multiBorders: true }),
    },
  })
  assert.match(err ?? '', /en même temps/)
})

test('une partie complète se joue avec toutes les variantes cumulables', () => {
  const cfg = {
    players: [
      { name: 'A', kind: 'bot-smart', boardColor: 'O' },
      { name: 'B', kind: 'bot-greedy', boardColor: 'B' },
      { name: 'C', kind: 'bot-random', boardColor: 'G' },
    ],
    options: {
      ...E.defaultOptions('integrale'),
      ruleset: withVariants({
        lastPickRandom: true,
        multiBorders: true,
        monoTiles: true,
        whiteTiles: true,
        magicStars: true,
        personalTile: true,
        mirrorTiles: true,
      }),
    },
  }
  let s = E.createGame(cfg)
  let guard = 0
  while (s.phase === 'playing' && guard++ < 600) {
    if (E.canRedrawLastTile(s) && E.botWantsRedraw(s)) s = E.redrawLastTile(s)
    const mv = E.bestMove(s, E.currentPlayer(s).kind)
    assert.ok(mv, 'toujours un coup légal')
    s = E.applyMove(s, mv)
  }
  assert.equal(s.phase, 'finished')
  for (const p of s.players) assert.equal(E.placedCount(p.board), 16)
  const stats = E.playerStats(s)
  for (const st of stats) {
    assert.ok(Number.isFinite(st.breakdown.total))
    assert.ok(st.breakdown.starPoints >= 0)
  }
})

test('étoiles magiques : groupées par simple adjacence, pas par chemin', () => {
  // Trois tuiles factices de couleurs différentes : leurs quarts étoilés se
  // touchent, mais aucun chemin ne les relie — l'adjacence doit suffire.
  const mk = (quads, star) => {
    const id = E.TILES.length
    E.TILES.push({ id, quads })
    E.STARS.set(id, star)
    return id
  }
  const a = mk(['R', 'R', 'R', 'R'], 2) // bas-droite de la case 0 → quart (1,1)
  const b = mk(['B', 'B', 'B', 'B'], 3) // bas-gauche de la case 1 → quart (1,2)
  const c = mk(['G', 'G', 'G', 'G'], 0) // haut-gauche de la case 5 → quart (2,2)
  const board = E.createBoard(4)
  board.cells[0] = { tileId: a, rot: 0, round: 0 }
  board.cells[1] = { tileId: b, rot: 0, round: 0 }
  board.cells[5] = { tileId: c, rot: 0, round: 0 }
  const clusters = E.starClusters(board)
  assert.equal(clusters.length, 1, 'un seul groupe de 3 étoiles adjacentes')
  assert.equal(clusters[0].count, 3)
  assert.equal(clusters[0].points, 6, '3 étoiles côte à côte = 6 points')
  assert.equal(E.scoreBoard(board, withVariants({ magicStars: true })).starPoints, 6)

  // Une étoile isolée sur le même plateau reste un groupe à part : 6 + 1.
  const d = mk(['Y', 'Y', 'Y', 'Y'], 1) // haut-droite de la case 3 → quart (0,7)
  board.cells[3] = { tileId: d, rot: 0, round: 0 }
  assert.equal(E.starClusters(board).length, 2)
  assert.equal(E.scoreBoard(board, withVariants({ magicStars: true })).starPoints, 7)
})
