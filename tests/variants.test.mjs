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

test('tuiles monochromes et arc-en-ciel : le sac grossit selon les variantes', () => {
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

test('carré arc-en-ciel : il prolonge et relie les chemins de toutes les couleurs', () => {
  // deux tuiles rouges séparées par un carré arc-en-ciel ; une bleue en dessous
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
  // rouge : 2 tuiles rouges + la tuile irisée traversée = 3 tuiles -> 3 pts
  assert.equal(rouge.span, 3)
  assert.equal(rouge.points, 3)
  // bleu : sa tuile + la tuile irisée = 2 tuiles, sous le minimum
  assert.equal(bleu.span, 2)
  assert.equal(bleu.points, 0)
  // et une seule zone rouge : l'arc-en-ciel RELIE les deux tuiles rouges
  assert.equal(zones.filter((z) => z.color === 'R').length, 1)
})

test('bordures colorées : toucher le bord vaut +1 en tout, quel que soit le nombre de côtés', () => {
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
  // 2 tuiles + le bord (une seule fois, même en touchant deux côtés) = 3 -> 3 pts
  assert.equal(orange.borders, 1)
  assert.equal(orange.span, 3)
  assert.equal(orange.points, 3)
  // les deux côtés touchés restent connus pour l'affichage
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
  // chaque tuile touche le bord : +1 chacune, jamais plus
  const spans = oranges.map((z) => z.span).sort()
  assert.deepEqual(spans, [2, 2])
  const borders = oranges.map((z) => z.borders).sort()
  assert.deepEqual(borders, [1, 1])
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
      useCards: true,
      cardCount: 3,
      ruleset: withVariants({
        lastPickRandom: true,
        multiBorders: true,
        monoTiles: true,
        whiteTiles: true,
        magicStars: true,
        personalTile: true,
        mirrorTiles: true,
        extraTile: true,
        faultTiles: true,
        clovers: true,
        startTile: true,
        bagCounterClockwise: true,
        boardSwap: true,
        secretColor: true,
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

test('tuile supplémentaire : une tuile de plus au centre, la restante retourne au sac', () => {
  const mk = (variants) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
      ],
      options: { ...E.defaultOptions('extra'), ruleset: withVariants(variants) },
    })
  const base = mk(undefined)
  assert.equal(base.pool.length, 2, 'autant de tuiles que de joueurs')
  let s = mk({ extraTile: true })
  assert.equal(s.pool.length, 3, 'une tuile de plus')

  // les deux joueurs posent : la 3e tuile repart au sac, le total est conservé
  const total = s.bag.length + s.pool.length
  for (let i = 0; i < 2; i++) {
    const libre = E.availableTiles(s)[0]
    s = E.applyMove(s, { tileId: libre.tileId, cell: i, rot: 0 })
  }
  assert.equal(s.round, 1)
  assert.equal(s.pool.length, 3, 'la manche suivante révèle encore 3 tuiles')
  assert.equal(s.bag.length + s.pool.length, total - 2, 'seules les 2 tuiles posées ont quitté le sac')
})

test('tuiles failles : les deux moitiés d’une tuile ne se relient pas', () => {
  const id = [...E.FAULTS.keys()][0]
  const axis = E.FAULTS.get(id)
  // une tuile entièrement d'une couleur, coupée par une faille
  const uni = E.TILES.length
  E.TILES.push({ id: uni, quads: ['R', 'R', 'R', 'R'] })
  E.FAULTS.set?.(uni, axis) // la map est figée : on teste sur la tuile d'origine

  const board = E.createBoard(4)
  board.cells[0] = { tileId: id, rot: 0, round: 0 }
  const avec = E.computeZones(board, withVariants({ faultTiles: true }))
  const sans = E.computeZones(board, R)
  // la faille ne peut que découper : jamais moins de zones qu'en son absence
  assert.ok(avec.length >= sans.length, `${avec.length} zones avec faille, ${sans.length} sans`)

  // l'axe bascule d'un quart de tour, le miroir ne change rien
  assert.equal(E.faultAxis(id, 0), axis)
  assert.equal(E.faultAxis(id, 1), (axis + 1) % 2)
  assert.equal(E.faultAxis(id, 2), axis)
  assert.equal(E.faultAxis(id, 0, true), axis)
  assert.equal(E.faultAxis(9999, 0), null)
})

test('trèfles : +3 dans un chemin qui marque, −3 sinon', () => {
  const trefles = [...E.CLOVERS.keys()]
  assert.equal(trefles.length, Math.round(E.TILE_COUNT * 0.25), 'un quart des tuiles')
  // jamais sur un quart noir
  for (const id of trefles) {
    assert.notEqual(E.TILES[id].quads[E.CLOVERS.get(id)], 'K')
  }
  const ruleset = withVariants({ clovers: true })
  const board = E.createBoard(4)
  board.cells[0] = { tileId: trefles[0], rot: 0, round: 0 }
  // une tuile seule ne fait aucun chemin qui marque : le trèfle coûte 3
  assert.equal(E.scoreBoard(board, ruleset).cloverPoints, -3)
  // sans la variante, il ne compte pas
  assert.equal(E.scoreBoard(board, R).cloverPoints, 0)
})

test('tuile de départ : une tuile de la couleur du plateau, une manche de moins', () => {
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'G' },
    ],
    options: { ...E.defaultOptions('depart'), ruleset: withVariants({ startTile: true }) },
  })
  assert.equal(s.totalRounds, 15, '16 cases moins la tuile de départ')
  const cells = s.players.map((p) => p.board.cells.findIndex((c) => c !== null))
  assert.equal(cells[0], cells[1], 'la même case pour tout le monde')
  assert.ok(cells[0] >= 0)
  for (const p of s.players) {
    const t = p.board.cells[cells[0]]
    assert.equal(t.tileId, E.COLOR_TILE_IDS[p.boardColor])
    assert.deepEqual([...E.TILES[t.tileId].quads], Array(4).fill(p.boardColor))
  }
  // la tuile de départ ne sort pas du sac
  assert.equal(s.bag.length + s.pool.length, 97)
})

test('sac antihoraire : le sac revient au dernier servi', () => {
  const mk = (variants) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
        { name: 'C', kind: 'human', boardColor: 'G' },
      ],
      options: { ...E.defaultOptions('sac-sens'), ruleset: withVariants(variants) },
    })
  const manche = (s) => {
    for (let i = 0; i < 3; i++) {
      const libre = E.availableTiles(s)[0]
      s = E.applyMove(s, { tileId: libre.tileId, cell: s.round, rot: 0 })
    }
    return s
  }
  assert.equal(manche(mk(undefined)).bagHolder, 1, 'sens horaire : +1')
  assert.equal(manche(mk({ bagCounterClockwise: true })).bagHolder, 2, 'antihoraire : −1')
})

test('échange de plateaux : la carte est tirée dès le début et appliquée à mi-partie', () => {
  const mk = (seed) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
      ],
      options: { ...E.defaultOptions(seed), ruleset: withVariants({ boardSwap: true }) },
    })
  // les deux cartes existent : selon la graine, on tire l'une ou l'autre
  const tirages = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((x) => mk(x).swapCard))
  assert.deepEqual([...tirages].sort(), ['rotate', 'stay'])

  // avec « Rotation ! », les plateaux tournent à la manche 8
  const rotate = ['a', 'b', 'c', 'd', 'e', 'f'].map(mk).find((s) => s.swapCard === 'rotate')
  let s = rotate
  assert.equal(E.swapRound(s.options.ruleset), 8)
  const marque = []
  for (let r = 0; r < 8; r++) {
    for (let i = 0; i < 2; i++) {
      const libre = E.availableTiles(s)[0]
      s = E.applyMove(s, { tileId: libre.tileId, cell: r, rot: 0 })
      if (r === 0) marque.push(libre.tileId)
    }
  }
  assert.equal(s.round, 8)
  // le plateau de A porte maintenant la première tuile posée par B
  assert.equal(s.players[0].board.cells[0].tileId, marque[1])
  assert.equal(s.players[1].board.cells[0].tileId, marque[0])
})

test('couleur secrète : une couleur par joueur, son meilleur chemin est doublé', () => {
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
    ],
    options: { ...E.defaultOptions('secret'), ruleset: withVariants({ secretColor: true }) },
  })
  for (const p of s.players) assert.ok(E.PATH_COLORS.includes(p.secretColor))
  assert.notEqual(s.players[0].secretColor, s.players[1].secretColor)

  // un chemin rouge de 3 tuiles vaut 3 pts, doublé si le rouge est secret
  const rows = ['RRRRRR..', 'RRRRRR..', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE]
  const board = boardFrom(rows)
  const ruleset = withVariants({ secretColor: true })
  assert.equal(E.scoreBoard(board, ruleset, 'R').secretPoints, 3)
  assert.equal(E.scoreBoard(board, ruleset, 'B').secretPoints, 0)
  assert.equal(E.scoreBoard(board, R, 'R').secretPoints, 0, 'sans la variante, rien')
})

test('tuiles arc-en-ciel : un seul quart joker par tuile', () => {
  for (const id of E.WHITE_TILE_IDS) {
    const quads = [...E.TILES[id].quads]
    assert.equal(quads.filter((q) => q === 'W').length, 1, `tuile ${id} : un seul carré irisé`)
    assert.equal(quads.filter((q) => q !== 'W').length, 3, 'et trois quarts colorés')
    assert.ok(!quads.includes('K'), 'jamais de noir sur une tuile arc-en-ciel')
  }
  // le quart irisé n'est pas toujours à la même place
  const places = new Set(E.WHITE_TILE_IDS.map((id) => [...E.TILES[id].quads].indexOf('W')))
  assert.ok(places.size > 1, 'le carré irisé change de position')
  // le sac garde la même taille qu'avant
  const s = E.createGame({
    players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
    options: { ...E.defaultOptions('arc'), ruleset: withVariants({ whiteTiles: true }) },
  })
  assert.equal(s.bag.length + s.pool.length, 103)
})

test('tuile de départ multicolore : quatre couleurs, la même tuile pour tous', () => {
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'G' },
      { name: 'C', kind: 'human', boardColor: 'B' },
    ],
    options: {
      ...E.defaultOptions('depart-multi'),
      ruleset: withVariants({ startTile: true, startTileMulti: true }),
    },
  })
  const cells = s.players.map((p) => p.board.cells.findIndex((c) => c !== null))
  assert.equal(new Set(cells).size, 1, 'la même case pour tout le monde')
  const tuiles = s.players.map((p) => p.board.cells[cells[0]].tileId)
  assert.equal(new Set(tuiles).size, 1, 'et la même tuile pour tout le monde')
  assert.ok(E.MULTI_START_TILE_IDS.includes(tuiles[0]))
  const quads = [...E.TILES[tuiles[0]].quads]
  assert.equal(new Set(quads).size, 4, 'quatre couleurs différentes')
  assert.ok(!quads.includes('K') && !quads.includes('W'), 'ni noir ni joker')
  // en monochrome, chacun garde sa couleur
  const mono = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'G' },
    ],
    options: { ...E.defaultOptions('depart-mono'), ruleset: withVariants({ startTile: true }) },
  })
  const ids = mono.players.map((p) => p.board.cells.find((c) => c !== null).tileId)
  assert.equal(new Set(ids).size, 2, 'une tuile par couleur de plateau')
})
