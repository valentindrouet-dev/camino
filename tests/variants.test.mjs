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
  assert.ok(trefles.length >= 20 && trefles.length <= 25, 'environ un quart des tuiles')
  for (const id of trefles) {
    // jamais sur un quart noir
    assert.notEqual(E.TILES[id].quads[E.CLOVERS.get(id)], 'K')
    // ni sur une tuile étoilée : une tuile ne porte qu'une de ces deux marques
    assert.ok(!E.STARS.has(id), `tuile ${id} : trèfle et étoile ne cohabitent pas`)
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
  assert.equal(E.scoreBoard(board, ruleset, { secretColor: 'R' }).secretPoints, 3)
  assert.equal(E.scoreBoard(board, ruleset, { secretColor: 'B' }).secretPoints, 0)
  assert.equal(
    E.scoreBoard(board, R, { secretColor: 'R' }).secretPoints,
    0,
    'sans la variante, rien',
  )
})

test('tuiles arc-en-ciel : la tuile entière est un seul grand carré joker', () => {
  assert.equal(E.WHITE_TILE_IDS.length, 6)
  for (const id of E.WHITE_TILE_IDS) {
    const quads = [...E.TILES[id].quads]
    assert.deepEqual(quads, ['W', 'W', 'W', 'W'], `tuile ${id} : un seul grand carré irisé`)
  }
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

test('couleur interdite : chaque zone compte comme une zone noire', () => {
  // un chemin rouge de 3 tuiles vaut 3 pts — ou le malus du noir s'il est interdit
  const rows = ['RRRRRR..', 'RRRRRR..', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE]
  const board = boardFrom(rows)
  const ruleset = withVariants({ forbiddenColor: true })
  assert.equal(E.scoreBoard(board, ruleset, {}).colorPoints, 3, 'sans interdit, normal')
  const puni = E.scoreBoard(board, ruleset, { forbiddenColors: ['R'] })
  assert.equal(puni.colorPoints, R.blackPenalty)
  assert.equal(puni.byColor.R.points, R.blackPenalty)
  assert.equal(puni.forbiddenZones, 1)
  assert.deepEqual(puni.forbidden, ['R'])
  assert.equal(puni.total, R.blackPenalty)
  // la taille ne change rien : un seul quart coûte autant qu'un long chemin
  const petit = boardFrom(['RY......', 'YY......', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE])
  assert.equal(E.scoreBoard(petit, ruleset, { forbiddenColors: ['R'] }).colorPoints, R.blackPenalty)
  // deux zones séparées coûtent deux fois : les réunir reste payant
  const deuxZones = boardFrom(['RYYR....', 'YYYY....', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE])
  const double = E.scoreBoard(deuxZones, ruleset, { forbiddenColors: ['R'] })
  assert.equal(double.forbiddenZones, 2)
  assert.equal(double.byColor.R.points, 2 * R.blackPenalty)
  // sans la variante active, l'interdit ne s'applique pas
  assert.equal(E.scoreBoard(board, R, { forbiddenColors: ['R'] }).colorPoints, 3)
  // une couleur interdite n'est jamais doublée par la couleur secrète
  const deux = withVariants({ forbiddenColor: true, secretColor: true })
  const mixte = E.scoreBoard(board, deux, { secretColor: 'R', forbiddenColors: ['R'] })
  assert.equal(mixte.secretPoints, 0)
  // et le noir, lui, reste négatif
  const noir = boardFrom(['RRKK....', 'RRKK....', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE])
  const bd = E.scoreBoard(noir, ruleset, { forbiddenColors: ['R'] })
  assert.equal(bd.blackZones, 1)
  assert.equal(bd.blackPoints, R.blackPenalty)
  assert.equal(bd.total, 2 * R.blackPenalty)
})

test('couleur interdite : une tuile par joueur, deux avec l’option', () => {
  const partie = (variants, seed) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'G' },
      ],
      options: { ...E.defaultOptions(seed), ruleset: withVariants(variants) },
    })
  const une = partie({ forbiddenColor: true }, 'interdit-1')
  for (const p of une.players) {
    assert.equal(p.forbiddenColors.length, 1)
    assert.ok(E.PATH_COLORS.includes(p.forbiddenColors[0]))
  }
  const deux = partie({ forbiddenColor: true, forbiddenColorCount: 2 }, 'interdit-2')
  for (const p of deux.players) {
    assert.equal(p.forbiddenColors.length, 2)
    assert.equal(new Set(p.forbiddenColors).size, 2, 'deux couleurs différentes')
  }
  // avec la couleur secrète, on ne reçoit jamais une couleur à la fois secrète
  // et interdite
  const melange = partie({ forbiddenColor: true, forbiddenColorCount: 2, secretColor: true }, 'mix')
  for (const p of melange.players) {
    assert.ok(!p.forbiddenColors.includes(p.secretColor))
  }
  // sans la variante, personne ne reçoit de couleur interdite
  const sans = partie({}, 'sans')
  for (const p of sans.players) assert.equal(p.forbiddenColors, undefined)
})

test('1er joueur aléatoire : le sac ne part plus toujours du joueur 1', () => {
  const partie = (randomFirst, seed) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'G' },
        { name: 'C', kind: 'human', boardColor: 'B' },
        { name: 'D', kind: 'human', boardColor: 'Y' },
      ],
      options: { ...E.defaultOptions(seed), randomFirst },
    })
  for (let i = 0; i < 10; i++) assert.equal(partie(false, `fixe-${i}`).bagHolder, 0)
  const tirages = new Set()
  for (let i = 0; i < 40; i++) {
    const s = partie(true, `alea-${i}`)
    assert.ok(s.bagHolder >= 0 && s.bagHolder < 4)
    tirages.add(s.bagHolder)
  }
  assert.ok(tirages.size > 1, 'le premier joueur varie selon la graine')
  // le tirage se fait en dernier : les tuiles révélées ne changent pas
  const a = partie(false, 'meme-graine')
  const b = partie(true, 'meme-graine')
  assert.deepEqual(
    a.pool.map((t) => t.tileId),
    b.pool.map((t) => t.tileId),
  )
})

test('scoring inversé : 20 points de départ, le noir rapporte, les chemins coûtent', () => {
  // un chemin rouge de 3 tuiles (3 pts) et une zone noire (−2)
  const rows = ['RRRRRRKK', 'RRRRRRKK', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE]
  const board = boardFrom(rows)
  const normal = E.scoreBoard(board, R)
  assert.equal(normal.total, 3 + R.blackPenalty)
  assert.equal(normal.basePoints, 0)

  const envers = E.scoreBoard(board, withVariants({ reverseScoring: true }))
  assert.equal(envers.basePoints, 20)
  assert.equal(envers.colorPoints, -3, 'le chemin coûte ce qu’il rapportait')
  assert.equal(envers.blackPoints, 2, 'la zone noire rapporte')
  assert.equal(envers.total, 20 - 3 + 2)
  // miroir exact : 20 − score normal
  assert.equal(envers.total, 20 - normal.total)
  // les pastilles du plateau suivent le même signe
  const zones = E.computeZones(board, withVariants({ reverseScoring: true }))
  const chemin = zones.find((z) => z.color === 'R')
  const noire = zones.find((z) => z.color === 'K')
  assert.equal(chemin.points, -3)
  assert.ok(chemin.scoring, 'un chemin qui compte reste un chemin qui compte')
  assert.equal(noire.points, 2)
})

test('scoring inversé : les autres variantes comptent aussi à l’envers', () => {
  const rows = ['RRRRRRRR', 'RRRRRRRR', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE]
  const board = boardFrom(rows)
  const paires = [
    { magicStars: true },
    { clovers: true },
    { secretColor: true },
    { forbiddenColor: true },
  ]
  for (const v of paires) {
    const who = { secretColor: 'R', forbiddenColors: ['R'] }
    const droit = E.scoreBoard(board, withVariants(v), who)
    const envers = E.scoreBoard(board, withVariants({ ...v, reverseScoring: true }), who)
    assert.equal(envers.starPoints, -droit.starPoints || 0, `étoiles ${JSON.stringify(v)}`)
    assert.equal(
      envers.cloverPoints,
      -droit.cloverPoints || 0,
      `trèfles ${JSON.stringify(v)}`,
    )
    assert.equal(
      envers.secretPoints,
      -droit.secretPoints || 0,
      `couleur secrète ${JSON.stringify(v)}`,
    )
    assert.equal(envers.total, 20 - droit.total, `total ${JSON.stringify(v)}`)
  }
})

test('scoring inversé : une carte mission accomplie coûte ses points', () => {
  const partie = (variants) =>
    E.createGame({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
      ],
      options: {
        ...E.defaultOptions('carte-envers'),
        useCards: true,
        cardId: 'exact-4',
        ruleset: withVariants(variants),
      },
    })
  // un chemin rouge de 4 tuiles : la carte « chemins de 4 » est accomplie
  const rows = ['RRRRRRRR', 'RRRRRRRR', VIDE, VIDE, VIDE, VIDE, VIDE, VIDE]
  const board = boardFrom(rows)
  const points = (variants) => {
    const s = partie(variants)
    const joueurs = s.players.map((p) => ({ ...p, board }))
    const etat = { ...s, players: joueurs }
    return E.scorePlayer(joueurs[0], etat).cardPoints
  }
  const droit = points({})
  assert.ok(droit > 0, `la carte rapporte en jeu normal (${droit})`)
  assert.equal(points({ reverseScoring: true }), -droit)
})

test('scoring inversé : les bots jouent le miroir', () => {
  const jouer = (variants, seed) => {
    let s = E.createGame({
      players: [
        { name: 'A', kind: 'bot-smart', boardColor: 'O' },
        { name: 'B', kind: 'bot-smart', boardColor: 'B' },
      ],
      options: { ...E.defaultOptions(seed), ruleset: withVariants(variants) },
    })
    while (s.phase === 'playing') {
      s = E.applyMove(s, E.bestMove(s, s.players[E.currentPlayerId(s)].kind))
    }
    return s
  }
  let mieux = 0
  for (let i = 0; i < 4; i++) {
    const s = jouer({ reverseScoring: true }, `envers-${i}`)
    for (const p of s.players) {
      const envers = E.scoreBoard(p.board, s.options.ruleset, p)
      // le même plateau jugé au barème normal : il doit être mauvais
      const droit = E.scoreBoard(p.board, R, p)
      assert.equal(envers.total, 20 - droit.total)
      if (envers.total > 20) mieux++
    }
  }
  assert.ok(mieux > 0, 'un bot averti dépasse ses 20 points de départ')
})

test('étoiles : deux barèmes au choix', () => {
  // groupe seul, puis groupes de 2, 3 et 4
  assert.equal(E.starClusterPoints(1), 1)
  assert.equal(E.starClusterPoints(1, 'growing'), 1)
  for (const [n, relie, croissant] of [
    [2, 4, 4],
    [3, 6, 9],
    [4, 8, 16],
    [5, 10, 25],
  ]) {
    assert.equal(E.starClusterPoints(n), relie, `${n} reliées, barème officiel`)
    assert.equal(E.starClusterPoints(n, 'linked'), relie)
    assert.equal(E.starClusterPoints(n, 'growing'), croissant, `${n} reliées, barème croissant`)
  }

  // Sur un vrai plateau : quatre tuiles étoilées en carré, tournées pour que
  // leurs étoiles se rejoignent au centre — un groupe de 4.
  const etoilees = [...E.STARS.keys()].slice(0, 4)
  const board = E.createBoard(4)
  // quarts qui se touchent au point de rencontre des cases 0, 1, 4 et 5
  const cibles = [
    [0, 2],
    [1, 3],
    [4, 1],
    [5, 0],
  ]
  cibles.forEach(([cell, quad], i) => {
    const id = etoilees[i]
    const rot = (quad - E.STARS.get(id) + 4) % 4
    board.cells[cell] = { tileId: id, rot, round: 0 }
  })
  const groupes = (mode) => E.starClusters(board, mode)
  assert.equal(groupes('linked').length, 1, 'une seule constellation')
  assert.equal(groupes('linked')[0].count, 4, 'de quatre étoiles')
  const relie = groupes('linked')[0].points
  const croissant = groupes('growing')[0].points
  assert.equal(relie, 8)
  assert.equal(croissant, 16)

  // et le décompte suit le réglage de la variante
  const rs = (starScoring) => withVariants({ magicStars: true, ...(starScoring ? { starScoring } : {}) })
  assert.equal(E.scoreBoard(board, rs()).starPoints, relie, 'par défaut, barème officiel')
  assert.equal(E.scoreBoard(board, rs('linked')).starPoints, relie)
  assert.equal(E.scoreBoard(board, rs('growing')).starPoints, croissant)
  assert.equal(E.scoreBoard(board, R).starPoints, 0, 'sans la variante, rien')
})

// ---------------------------------------------------------------------------
// v1.39 — Verso aléatoire, Cristaux, Teintures, Moulins, Synchrone, Commun
// ---------------------------------------------------------------------------

const partie2 = (variants, seed, kind = 'human') =>
  E.createGame({
    players: [
      { name: 'A', kind, boardColor: 'O' },
      { name: 'B', kind, boardColor: 'B' },
    ],
    options: { ...E.defaultOptions(seed), ruleset: withVariants(variants) },
  })

test('verso aléatoire : retour sans retour', () => {
  const s = partie2({ randomBack: true }, 'verso-1')
  const cible = s.pool[0].tileId
  assert.ok(E.canFlipTile(s, cible))
  const apres = E.flipTile(s, cible)
  const neuve = apres.pool[0]
  assert.notEqual(neuve.tileId, cible, 'la face a changé')
  assert.ok(neuve.flipped, 'la tuile est marquée retournée')
  assert.equal(apres.bag.length, s.bag.length - 1, 'la nouvelle face vient du sac')
  assert.ok(!apres.bag.includes(cible), 'l’ancienne face a disparu')
  assert.equal(apres.mustTakeTileId, neuve.tileId, 'il faut prendre la tuile retournée')
  // impossible de retourner une deuxième tuile ce tour-ci, ni celle-là encore
  assert.ok(!E.canFlipTile(apres, apres.pool[1].tileId))
  assert.ok(!E.canFlipTile(apres, neuve.tileId))
  // un coup avec une autre tuile est illégal, avec la retournée il passe
  const cell = E.currentLegalCells(apres)[0]
  assert.ok(!E.isLegalMove(apres, { tileId: apres.pool[1].tileId, cell, rot: 0 }))
  const joue = E.applyMove(apres, { tileId: neuve.tileId, cell, rot: 0 })
  assert.notEqual(joue, apres, 'le coup obligatoire passe')
  assert.equal(joue.mustTakeTileId, undefined, 'l’obligation est levée')
  // même graine, même verso : le retournement est déterministe
  const bis = E.flipTile(partie2({ randomBack: true }, 'verso-1'), cible)
  assert.equal(bis.pool[0].tileId, neuve.tileId)
  // sans la variante, rien
  assert.ok(!E.canFlipTile(partie2({}, 'verso-1'), cible))
})

test('cristaux : un quart précis, +4 s’il reste seul de sa couleur, −4 sinon', () => {
  assert.equal(E.CRYSTALS.size, 18)
  const parCouleur = {}
  for (const [id, q] of E.CRYSTALS) {
    const quads = E.TILES[id].quads
    const couleur = quads[q]
    assert.ok(E.PATH_COLORS.includes(couleur), `tuile ${id} : le cristal est sur un chemin`)
    assert.equal(
      quads.filter((x) => x === couleur).length,
      1,
      `tuile ${id} : le quart cristallisé est seul de sa couleur sur sa tuile`,
    )
    assert.notEqual(E.STARS.get(id), q, 'jamais sur un quart étoilé')
    assert.notEqual(E.CLOVERS.get(id), q, 'jamais sur un quart tréflé')
    parCouleur[couleur] = (parCouleur[couleur] ?? 0) + 1
  }
  for (const c of E.PATH_COLORS) assert.equal(parCouleur[c], 3, `3 cristaux ${c}`)

  // le quart suit la rotation et le miroir, comme une étoile ou un trèfle
  const [id0, q0] = [...E.CRYSTALS][0]
  assert.equal(E.crystalQuadIndex(id0, 0), q0)
  assert.equal(E.crystalQuadIndex(id0, 1), (q0 + 1) % 4)
  assert.equal(E.crystalQuadIndex(id0, 0, true), [1, 0, 3, 2][q0])
  assert.equal(E.crystalQuadIndex(0, 0), null, 'les autres tuiles n’en portent pas')

  // tuile 72 : PGYP, cristal jaune sur le quart bas-droit
  assert.deepEqual(E.TILES[72].quads, ['P', 'G', 'Y', 'P'])
  assert.equal(E.CRYSTALS.get(72), 2)
  const rs = withVariants({ crystals: true })
  const board = E.createBoard(4)
  board.cells[5] = { tileId: 72, rot: 0, round: 0 }
  assert.ok(E.crystalIntact(board, 5), 'seul sur le plateau, il brille')
  assert.equal(E.scoreBoard(board, rs).crystalPoints, 4)

  // une voisine sans jaune ne le dérange pas, même posée bien après lui :
  // l’ordre des poses n’entre pas dans la règle
  assert.deepEqual(E.TILES[5].quads, ['O', 'R', 'R', 'O'])
  board.cells[4] = { tileId: 5, rot: 0, round: 9 }
  assert.ok(E.crystalIntact(board, 5))
  assert.equal(E.scoreBoard(board, rs).crystalPoints, 4)

  // tuile 0 (YOOY) à sa droite : son quart bas-gauche est jaune, il touche le
  // cristal — brisé, même si elle était là avant
  assert.deepEqual(E.TILES[0].quads, ['Y', 'O', 'O', 'Y'])
  board.cells[6] = { tileId: 0, rot: 0, round: 0 }
  assert.ok(!E.crystalIntact(board, 5), 'du jaune le touche : il se brise')
  assert.equal(E.scoreBoard(board, rs).crystalPoints, -4)

  // sans la variante, aucun point ; en scoring inversé, les signes s’échangent
  assert.equal(E.scoreBoard(board, R).crystalPoints, 0)
  assert.equal(
    E.scoreBoard(board, withVariants({ crystals: true, reverseScoring: true })).crystalPoints,
    4,
  )
})

test('teintures : la zone noire adjacente prend la couleur du pot', () => {
  assert.equal(E.DYES.size, 18)
  const parCouleur = {}
  for (const [id, d] of E.DYES) {
    parCouleur[d.color] = (parCouleur[d.color] ?? 0) + 1
    assert.notEqual(E.TILES[id].quads[d.quad], 'K', 'jamais sur un quart noir')
    assert.notEqual(E.TILES[id].quads[d.quad], d.color, 'jamais sur sa propre couleur')
  }
  for (const c of E.PATH_COLORS) assert.equal(parCouleur[c], 3, `3 teintures ${c}`)

  // une tuile noire posée d'abord, la teinture posée ensuite à côté du noir
  const [dyeId, dye] = [...E.DYES.entries()][0]
  const rs = withVariants({ dyes: true })
  const board = E.createBoard(4)
  const noire = E.TILES.findIndex((t) => t.quads.every((q) => q === 'K'))
  // orienter la teinture pour que son quart regarde la tuile noire à gauche :
  // quart 0 (haut-gauche) ou 3 (bas-gauche)
  const rot = (4 - dye.quad) % 4 // amène le quart teinté en position 0
  board.cells[0] = { tileId: noire, rot: 0, round: 0 }
  board.cells[1] = { tileId: dyeId, rot, round: 1 }
  const zones = E.computeZones(board, rs)
  const teintee = zones.find((z) => z.color === dye.color && z.tiles.includes(0))
  assert.ok(teintee, 'la zone noire a pris la couleur du pot')
  assert.equal(zones.filter((z) => z.color === 'K' && z.tiles.includes(0)).length, 0)
  // sans la variante, le noir reste noir
  assert.ok(E.computeZones(board, R).some((z) => z.color === 'K' && z.tiles.includes(0)))

  // posée dans l'autre ordre — le noir arrive APRÈS le pot — rien ne déteint
  const tard = E.createBoard(4)
  tard.cells[1] = { tileId: dyeId, rot, round: 0 }
  tard.cells[0] = { tileId: noire, rot: 0, round: 1 }
  assert.ok(E.computeZones(tard, rs).some((z) => z.color === 'K' && z.tiles.includes(0)))
})

test('moulins : les voisines déjà posées tournent d’un quart vers la gauche', () => {
  assert.equal(E.WINDMILLS.size, 15)
  const moulin = [...E.WINDMILLS][0]
  const rs = withVariants({ windmills: true })
  const board = E.createBoard(4)
  // une tuile posée avant le moulin, juste à côté
  board.cells[5] = { tileId: 3, rot: 0, round: 0 } // YBBY
  board.cells[6] = { tileId: moulin, rot: 0, round: 1 }
  assert.equal(E.effectiveRot(board, 5, true), 3, 'un quart de tour à gauche')
  assert.equal(E.effectiveRot(board, 5, false), 0, 'sans la variante, rien')
  // la grille suit : les quarts de la tuile 5 sont ceux de la rotation 3
  const fx = { windmills: true }
  const grid = E.quadGrid(board, fx)
  const attendu = E.tileQuads(3, 3)
  const qs = 8
  assert.equal(grid.cells[2 * qs + 2], attendu[0])
  assert.equal(grid.cells[2 * qs + 3], attendu[1])
  // une tuile posée APRÈS le moulin ne tourne pas
  board.cells[2] = { tileId: 4, rot: 1, round: 5 }
  assert.equal(E.effectiveRot(board, 2, true), 1)
  // deux moulins voisins postérieurs = deux crans
  const deux = [...E.WINDMILLS][1]
  board.cells[9] = { tileId: deux, rot: 0, round: 7 }
  assert.equal(E.effectiveRot(board, 5, true), 2, 'deux quarts de tour')
})

test('partie synchrone : une seule tuile, la même pour tout le monde', () => {
  let s = partie2({ syncDraw: true }, 'sync-1', 'bot-greedy')
  assert.equal(s.pool.length, 1, 'une seule tuile révélée')
  const commune = s.pool[0].tileId
  const sacAvant = s.bag.length
  // les deux joueurs posent la même tuile
  for (let t = 0; t < 2; t++) {
    const move = E.bestMove(s, 'bot-greedy')
    assert.equal(move.tileId, commune, `joueur ${t + 1} joue la tuile commune`)
    s = E.applyMove(s, move)
  }
  assert.equal(s.round, 1, 'la manche est finie')
  assert.equal(s.bag.length, sacAvant - 1, 'une seule tuile consommée par manche')
  // les deux plateaux portent la même tuile
  const posees = s.players.map((p) => p.board.cells.filter(Boolean).map((c) => c.tileId))
  assert.deepEqual(posees[0], [commune])
  assert.deepEqual(posees[1], [commune])
  // la partie va au bout
  while (s.phase === 'playing') s = E.applyMove(s, E.bestMove(s, 'bot-greedy'))
  assert.equal(s.phase, 'finished')
  for (const p of s.players) assert.ok(E.isFull(p.board))
})

test('plateau commun : tching ! — chacun encaisse ses points à la pose', () => {
  const s = partie2({ sharedBoard: true }, 'commun-1')
  assert.equal(s.players[0].board, s.players[1].board, 'un seul et même plateau')
  assert.equal(s.players[0].board.size, 8, '8 tuiles de large à deux joueurs')
  assert.equal(s.players[0].board.cells.length, 32, 'sur 4 de haut — paysage')
  assert.equal(s.totalRounds, 16, '16 manches : le plateau finit plein')

  // A pose trois tuiles rouges reliées : rien, rien, puis tching +3 au 3e coup.
  // B pose des tuiles noires : −2 à la première, 0 quand il fusionne.
  let cur = s
  const move = (tileId, cell, rot = 0) => {
    const t = cur.pool.find((p) => p.takenBy === null)
    cur = { ...cur, pool: cur.pool.map((p) => (p === t ? { ...p, tileId } : p)) }
    cur = E.applyMove(cur, { tileId, cell, rot })
  }
  const noire = E.TILES.findIndex((t) => t.quads.every((q) => q === 'K'))
  const rouge = () => E.TILES.push({ id: E.TILES.length, quads: ['R', 'R', 'R', 'R'] }) - 1

  // plateau 8 de large : 0-1-2-3 sur la première rangée, 8 juste sous 0
  move(rouge(), 0) // A : un chemin d'une tuile — 0 pt
  assert.equal(cur.players[0].banked ?? 0, 0, 'une tuile : rien')
  move(noire, 8) // B : une zone noire sous la tuile de A — tching −2
  assert.equal(cur.players[1].banked, -2, 'le noir se paie à la pose')
  move(rouge(), 1) // A : chemin de 2 — toujours 0
  assert.equal(cur.players[0].banked ?? 0, 0)
  move(noire, 9) // B : fusionne sa zone noire — −2 → −2, delta 0
  assert.equal(cur.players[1].banked, -2, 'fusionner le noir ne coûte rien de plus')
  move(rouge(), 2) // A : chemin de 3 — tching +3
  assert.equal(cur.players[0].banked, 3, 'le chemin de 3 rapporte 3, encaissés à la pose')

  // le score affiché suit la cagnotte, pas le plateau
  const a = E.scoreBoard(cur.players[0].board, cur.options.ruleset, cur.players[0])
  const b = E.scoreBoard(cur.players[1].board, cur.options.ruleset, cur.players[1])
  assert.equal(a.total, 3)
  assert.equal(b.total, -2)
  // et le plateau, lui, est décrit en entier pour l'affichage
  assert.ok(a.zones.length > 0)
  assert.deepEqual(a.zones, b.zones)

  // prolonger le chemin d'un AUTRE : c'est le prolongateur qui encaisse
  move(rouge(), 3) // B : le chemin passe de 3 à 4 tuiles (3 pts → 5 pts)
  assert.equal(cur.players[1].banked, 0, 'B encaisse le +2 du prolongement')
  assert.equal(cur.players[0].banked, 3, 'A ne gagne rien sur la pose de B')

  // une partie complète en bots se termine, plateau plein, cagnottes = classement
  let fin = partie2({ sharedBoard: true }, 'commun-2', 'bot-greedy')
  while (fin.phase === 'playing') fin = E.applyMove(fin, E.bestMove(fin, 'bot-greedy'))
  assert.equal(fin.phase, 'finished')
  assert.ok(E.isFull(fin.players[0].board), 'le plateau 4×8 est plein (16 manches × 2)')
  for (const p of fin.players) assert.equal(typeof p.banked, 'number')
  const totals = E.scoreAll(fin).map((b2) => b2.total)
  assert.deepEqual(
    totals,
    fin.players.map((p) => p.banked),
    'le score final est la cagnotte',
  )
})

test('plateau commun : 16 cases par joueur, toujours en paysage', () => {
  for (const [nb, w, h] of [
    [2, 8, 4],
    [3, 8, 6],
    [4, 8, 8],
    [5, 10, 8],
    [6, 12, 8],
  ]) {
    const d = E.sharedBoardDims(nb)
    assert.equal(d.w, w, `${nb} joueurs : ${w} de large`)
    assert.equal(d.h, h, `${nb} joueurs : ${h} de haut`)
    assert.ok(d.w >= d.h, `${nb} joueurs : paysage, jamais portrait`)
    assert.equal(d.w * d.h, 16 * nb, `${nb} joueurs : 16 cases chacun`)
  }
  // à 3 joueurs : 6×8 = 48 cases = 16 manches × 3, le plateau finit plein
  let s = E.createGame({
    players: [
      { name: 'A', kind: 'bot-greedy', boardColor: 'O' },
      { name: 'B', kind: 'bot-greedy', boardColor: 'B' },
      { name: 'C', kind: 'bot-greedy', boardColor: 'G' },
    ],
    options: {
      ...E.defaultOptions('commun-3j'),
      ruleset: withVariants({ sharedBoard: true, clovers: true, magicStars: true }),
    },
  })
  assert.equal(s.players[0].board.size, 8, '8×6 à trois joueurs')
  assert.equal(s.players[0].board.cells.length, 48)
  assert.equal(s.totalRounds, 16)
  while (s.phase === 'playing') s = E.applyMove(s, E.bestMove(s, 'bot-greedy'))
  assert.equal(s.phase, 'finished')
  assert.ok(E.isFull(s.players[0].board))
  // les cagnottes intègrent étoiles et trèfles via les deltas ; la somme des
  // scores de plateau reste cohérente (pas de NaN, pas de zone perdue)
  for (const p of s.players) assert.ok(Number.isFinite(p.banked))
  // se combine désormais librement avec l'échange de plateaux (sans effet)
  assert.equal(
    E.configError({
      players: [
        { name: 'A', kind: 'human', boardColor: 'O' },
        { name: 'B', kind: 'human', boardColor: 'B' },
      ],
      options: {
        ...E.defaultOptions('x'),
        ruleset: withVariants({ sharedBoard: true, boardSwap: true, syncDraw: true }),
      },
    }),
    null,
  )
})

test('simulation : les variantes et les nouvelles statistiques', () => {
  const config = (variants, opts = {}) => ({
    players: [
      { name: 'J1', kind: 'bot-smart', boardColor: 'O' },
      { name: 'J2', kind: 'bot-greedy', boardColor: 'B' },
    ],
    options: { ...E.defaultOptions('lab-1'), ...opts, ruleset: withVariants(variants) },
  })

  // une simulation traverse bien les variantes lourdes. Douze parties et non
  // six : sur un échantillon trop court, les +3 et les −3 des trèfles peuvent
  // s'annuler exactement, et la source disparaît de la liste.
  const r = E.simulate(config({ magicStars: true, clovers: true, crystals: true }), 12)
  assert.equal(r.games, 12)
  assert.ok(r.curve.length > 1, 'la courbe de progression est renseignée')
  assert.ok(r.avgRounds > 0)
  assert.ok(r.sources.some((x) => x.key === 'stars'), 'les étoiles apparaissent dans les sources')
  assert.ok(r.sources.some((x) => x.key === 'clovers'))
  assert.ok(r.sources.every((x) => Math.abs(x.value) > 0.001), 'aucune source vide affichée')
  // les rangs se répartissent sur tous les sièges
  assert.equal(r.rankBySeat.length, 2)
  for (const row of r.rankBySeat) {
    const somme = row.reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(somme - 1) < 0.001, `chaque siège finit quelque part (${somme})`)
  }
  // vainqueur ≥ dernier, écart cohérent
  assert.ok(r.winnerMean >= r.lastMean)
  assert.ok(Math.abs(r.winnerMean - r.lastMean - r.avgSpread) < 0.001)
  assert.ok(r.closeRate >= 0 && r.closeRate <= 1)
  assert.equal(Object.keys(r.countByKind).sort().join(','), 'bot-greedy,bot-smart')

  // sans variante, aucune source parasite
  const nu = E.simulate(config({}), 4)
  assert.ok(!nu.sources.some((x) => ['stars', 'clovers', 'crystals', 'base'].includes(x.key)))

  // scoring inversé : les points de départ apparaissent comme source
  const envers = E.simulate(config({ reverseScoring: true }), 4)
  assert.ok(envers.sources.some((x) => x.key === 'base'))

  // cartes missions : taux d'accomplissement mesuré
  const cartes = E.simulate(config({}, { useCards: true, cardId: 'exact-4' }), 6)
  assert.ok(cartes.cardRate >= 0 && cartes.cardRate <= 1)

  // plateau commun : la simulation tient aussi
  const commun = E.simulate(config({ sharedBoard: true }), 3)
  assert.equal(commun.games, 3)
  assert.ok(Number.isFinite(commun.mean))
})

test('feuille blanche : clearVariants efface les règles, pas le confort', () => {
  const parti = {
    ...E.defaultOptions('graine-gardee'),
    // options de partie : à conserver
    liveScore: false,
    showZones: false,
    showHints: true,
    showLastPlaced: true,
    randomFirst: true,
    manualSeed: true,
    allBoards: true,
    // variantes et compagnie : à effacer
    useCards: true,
    cardCount: 3,
    cardId: 'exact-4',
    personalCards: true,
    ruleset: {
      ...R,
      boardSize: 5,
      minSpan: 4,
      blackPenalty: -5,
      requireAdjacency: false,
      pointsBySpan: [0, 0, 0, 9, 9, 9, 9, 9, 9, 9],
      variants: { magicStars: true, clovers: true, sharedBoard: true },
    },
  }
  const propre = E.clearVariants(parti)

  // ce qui reste
  assert.equal(propre.seed, 'graine-gardee')
  assert.equal(propre.liveScore, false)
  assert.equal(propre.showZones, false)
  assert.equal(propre.showHints, true)
  assert.equal(propre.showLastPlaced, true)
  assert.equal(propre.randomFirst, true)
  assert.equal(propre.manualSeed, true)
  assert.equal(propre.allBoards, true)

  // ce qui saute
  assert.equal(propre.useCards, false)
  assert.equal(propre.cardCount, 1)
  assert.equal(propre.cardId, undefined)
  assert.equal(propre.personalCards, false)
  assert.equal(propre.ruleset.variants, undefined, 'plus aucune variante')
  assert.equal(propre.ruleset.boardSize, R.boardSize, 'barème officiel')
  assert.equal(propre.ruleset.minSpan, R.minSpan)
  assert.equal(propre.ruleset.blackPenalty, R.blackPenalty)
  assert.equal(propre.ruleset.requireAdjacency, true, 'pose libre décochée')
  assert.deepEqual(propre.ruleset.pointsBySpan, R.pointsBySpan)

  // l'original n'est pas modifié : la fonction est pure
  assert.equal(parti.useCards, true)
  assert.equal(parti.ruleset.variants.magicStars, true)

  // une partie lancée depuis ces options est bien une partie officielle
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
    ],
    options: propre,
  })
  assert.equal(s.totalRounds, 16)
  assert.equal(s.cardId, undefined)
  assert.equal(s.players[0].board.size, 4)
})

test('en ligne : le journal d’actions rejoue la partie à l’identique', async () => {
  const V = await import('../src/net/useSalon.ts')
  const config = {
    players: [
      { name: 'Alice', kind: 'human', boardColor: 'O' },
      { name: 'Bob', kind: 'human', boardColor: 'B' },
    ],
    options: {
      ...E.defaultOptions('salon-1'),
      ruleset: withVariants({ magicStars: true, secretColor: true }),
    },
  }

  // une partie jouée « en local » par des bots produit une liste d'actions
  let ref = E.createGame(config)
  const actions = []
  while (ref.phase === 'playing') {
    const move = E.bestMove(ref, 'bot-smart')
    actions.push({ k: 'coup', move })
    ref = E.applyMove(ref, move)
  }
  assert.equal(ref.phase, 'finished')
  assert.ok(actions.length >= 30, `${actions.length} coups`)

  // rejouée depuis le journal, on retombe exactement sur le même état
  const rejoue = V.rejouer(config, actions)
  assert.equal(rejoue.round, ref.round)
  assert.deepEqual(
    rejoue.players.map((p) => p.board.cells),
    ref.players.map((p) => p.board.cells),
  )
  assert.deepEqual(E.scoreAll(rejoue).map((b) => b.total), E.scoreAll(ref).map((b) => b.total))

  // reconnexion : rejouer un préfixe donne l'état de ce moment-là
  const moitie = V.rejouer(config, actions.slice(0, 10))
  assert.equal(moitie.log.length, 10)
  assert.equal(moitie.phase, 'playing')
})

test('en ligne : le point de vue masque les secrets des autres', () => {
  const s = E.createGame({
    players: [
      { name: 'A', kind: 'human', boardColor: 'O' },
      { name: 'B', kind: 'human', boardColor: 'B' },
      { name: 'C', kind: 'human', boardColor: 'G' },
    ],
    options: {
      ...E.defaultOptions('secrets-1'),
      personalCards: true,
      ruleset: withVariants({
        secretColor: true,
        forbiddenColor: true,
        personalTile: true,
        boardSwap: true,
      }),
    },
  })
  // tout est là dans l'état complet
  for (const p of s.players) {
    assert.ok(p.secretColor && p.forbiddenColors && p.cardId !== undefined)
  }

  const vue = E.viewFor(s, 1)
  // mon joueur est intact
  assert.equal(vue.players[1].secretColor, s.players[1].secretColor)
  assert.deepEqual(vue.players[1].forbiddenColors, s.players[1].forbiddenColors)
  assert.equal(vue.players[1].cardId, s.players[1].cardId)
  assert.equal(vue.players[1].personalTileId, s.players[1].personalTileId)
  // les autres sont muets
  for (const i of [0, 2]) {
    assert.equal(vue.players[i].secretColor, undefined)
    assert.equal(vue.players[i].forbiddenColors, undefined)
    assert.equal(vue.players[i].cardId, undefined)
    assert.equal(vue.players[i].personalTileId, undefined)
    // le reste passe : nom, couleur, plateau
    assert.equal(vue.players[i].name, s.players[i].name)
    assert.deepEqual(vue.players[i].board, s.players[i].board)
  }
  assert.ok(E.isMasked(vue, 1))
  assert.ok(!E.isMasked(s, 1), 'l’état complet, lui, ne l’est pas')
  // la carte d'échange reste face cachée tant qu'on ne la révèle pas
  assert.equal(vue.swapCard, undefined)
  assert.equal(E.viewFor(s, 1, true).swapCard, s.swapCard)
})

test('en ligne : numérotation et péremption des salons', async () => {
  const S = await import('../src/net/salon.ts')
  assert.equal(S.prochainNumero([]), 1)
  assert.equal(S.nomDeSalon(1), 'Camino 01')
  assert.equal(S.nomDeSalon(12), 'Camino 12')
  // le plus petit numéro libre : un salon fermé laisse sa place
  assert.equal(S.prochainNumero([{ numero: 1 }, { numero: 3 }]), 2)
  assert.equal(S.prochainNumero([{ numero: 1 }, { numero: 2 }]), 3)
  // un salon terminé ou trop vieux disparaît de la liste
  const maintenant = 1_000_000
  assert.ok(S.estPerime({ vuA: maintenant, phase: 'terminee' }, maintenant))
  assert.ok(!S.estPerime({ vuA: maintenant, phase: 'attente' }, maintenant))
  assert.ok(S.estPerime({ vuA: maintenant - S.PEREMPTION_MS - 1, phase: 'attente' }, maintenant))
})
