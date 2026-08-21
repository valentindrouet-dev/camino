// Les quatre ajouts de la 1.72 : Bords 4 Couleurs, la carte « Bord assorti »
// qui suit vraiment le bord, la mort subite, et le barème solo.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')

const withVariants = (variants) => ({ ...E.DEFAULT_RULESET, variants })

/** Une partie prête à examiner, avec un plateau qu'on garnit à la main. */
function table(boardColor, variants = {}, options = {}) {
  const state = E.createGame({
    players: [{ name: 'A', kind: 'human', boardColor }],
    options: { ...E.defaultOptions('t'), ...options, ruleset: withVariants(variants) },
  })
  return state
}

const uni = (couleur) => E.TILES.findIndex((t) => t.quads.every((q) => q === couleur))

// ------------------------------------------------------------ Bords 4 Couleurs

test('les six plateaux se partagent les six couleurs à parts égales', () => {
  const compte = {}
  for (const c of E.BOARD_COLORS) {
    const spec = E.quadBorderFor(c)
    assert.equal(spec.kind, 'quad')
    assert.equal(new Set(spec.sides).size, 4, `le plateau ${c} doit avoir quatre couleurs`)
    assert.ok(!spec.sides.includes(c), `le plateau ${c} ne porte pas sa propre couleur`)
    for (const s of spec.sides) compte[s] = (compte[s] ?? 0) + 1
  }
  assert.equal(Object.keys(compte).length, 6, 'les six couleurs sont utilisées')
  for (const [couleur, n] of Object.entries(compte)) {
    assert.equal(n, 4, `${couleur} doit apparaître sur exactement quatre côtés`)
  }
})

test('un bord à 4 couleurs ajoute une case au chemin de SA couleur', () => {
  const spec = E.quadBorderFor('O')
  const haut = spec.sides[0]
  const s = table('O', { quadBorders: true })
  const p = s.players[0]
  // Trois tuiles de la couleur du bord haut, en ligne contre ce bord.
  for (let i = 0; i < 3; i++) p.board.cells[i] = { tileId: uni(haut), rot: 0, round: i }
  const zones = E.computeZones(p.board, s.options.ruleset)
  const zone = zones.find((z) => z.color === haut)
  assert.ok(zone, 'le chemin existe')
  assert.equal(zone.borders, 1, 'le bloc du côté touché compte pour une case, une seule')

  // La même chose contre un côté d'une AUTRE couleur : rien à gagner.
  const gauche = spec.sides[3]
  assert.notEqual(gauche, haut)
  const t = table('O', { quadBorders: true })
  const q = t.players[0]
  const n = q.board.size
  for (let i = 0; i < 3; i++) q.board.cells[i * n] = { tileId: uni(haut), rot: 0, round: i }
  const zone2 = E.computeZones(q.board, t.options.ruleset).find((z) => z.color === haut)
  // La première tuile touche quand même le bord du haut : une case, pas deux.
  assert.equal(zone2.borders, 1)
})

test('deux variantes de bords ne s’activent pas ensemble', () => {
  const err = E.configError({
    players: [{ name: 'A', kind: 'human', boardColor: 'O' }],
    options: {
      ...E.defaultOptions('x'),
      ruleset: withVariants({ quadBorders: true, coloredBorders: true }),
    },
  })
  assert.match(err ?? '', /même contour/)
})

// ------------------------------------------------------------- Bord assorti

test('« Bord assorti » suit la couleur du bord, pas celle du plateau', () => {
  const spec = E.quadBorderFor('O')
  const haut = spec.sides[0]
  const points = (variants, couleurTuile) => {
    const s = table('O', variants, { useCards: true, cardId: 'matching-edge' })
    s.players[0].board.cells[0] = { tileId: uni(couleurTuile), rot: 0, round: 0 }
    return E.cardResults(s, 0)[0].points
  }
  // Sans variante de bords, le cadre imprimé est à la couleur du joueur.
  assert.equal(points({}, 'O'), 2, 'plateau orange, tuile orange contre le bord')
  assert.equal(points({}, 'B'), 0, 'une autre couleur ne compte pas')
  // Bords Colorés : même chose, le bord EST la couleur du joueur.
  assert.equal(points({ coloredBorders: true }, 'O'), 2)
  // Bords 4 Couleurs : c'est la couleur du côté touché qui décide.
  assert.equal(points({ quadBorders: true }, haut), 2, 'assortie au côté du haut')
  assert.equal(points({ quadBorders: true }, 'O'), 0, 'la couleur du plateau ne compte plus')
})

// -------------------------------------------------------------- Mort subite

test('la mort subite arrête la partie et donne la victoire', () => {
  for (const seuil of [6, 7, 8, 9]) {
    const s = table('O', {}, {
      useCards: true,
      cardId: 'sudden-death',
      cardSeuils: { 'sudden-death': seuil },
    })
    const carte = E.cardById('sudden-death')
    const p = s.players[0]
    let pose = 0
    for (let i = 0; i < 16; i++) {
      p.board.cells[i] = { tileId: uni('R'), rot: 0, round: i }
      pose++
      const breakdown = E.scoreBoard(p.board, s.options.ruleset, p)
      if (
        carte.atteint({
          playerId: 0,
          board: p.board,
          boardColor: 'O',
          breakdown,
          ruleset: s.options.ruleset,
          table: [],
          seuil,
        })
      ) {
        break
      }
    }
    assert.equal(pose, seuil, `le seuil ${seuil} se déclenche à ${seuil} tuiles`)
  }
})

test('le seuil choisi apparaît dans le texte de la carte', () => {
  const carte = E.cardById('sudden-death')
  assert.match(E.cardText(carte, undefined, undefined, 9), /9 tuiles/)
  assert.match(E.cardText(carte, undefined, undefined, 6), /6 tuiles/)
  // Un seuil qu'elle ne propose pas retombe sur le premier.
  assert.match(E.cardText(carte, undefined, undefined, 42), /7 tuiles/)
})

test('en vraie partie, la mort subite couronne celui qui a fait le chemin', () => {
  // Deux bots avec un seuil bas : la partie doit s'arrêter avant la fin.
  let s = E.createGame({
    players: [
      { name: 'A', kind: 'bot-expert', boardColor: 'O' },
      { name: 'B', kind: 'bot-expert', boardColor: 'B' },
    ],
    options: {
      ...E.defaultOptions('mort'),
      useCards: true,
      cardId: 'sudden-death',
      cardSeuils: { 'sudden-death': 6 },
      ruleset: E.DEFAULT_RULESET,
    },
  })
  const rng = new E.Rng('mort')
  let garde = 0
  while (s.phase === 'playing' && garde++ < 200) {
    const m = E.bestMove(s, E.currentPlayer(s).kind, rng)
    if (!m) break
    s = E.applyMove(s, m)
  }
  assert.equal(s.phase, 'finished')
  if (s.suddenWinner != null) {
    const stats = E.playerStats(s)
    const gagnant = stats.find((st) => st.player.id === s.suddenWinner)
    assert.equal(gagnant.rank, 1, 'le vainqueur par mort subite est premier')
    assert.ok(
      gagnant.breakdown.zones.some((z) => z.color !== 'K' && z.span >= 6),
      'et il a bien le chemin',
    )
    for (const st of stats) {
      if (st.player.id !== s.suddenWinner) assert.ok(st.rank > 1)
    }
  }
})

// ------------------------------------------------------------------- Solo

test('le barème solo suit les variantes cochées', () => {
  const opts = (variants, extra = {}) => ({
    ...E.defaultOptions('s'),
    ...extra,
    ruleset: withVariants(variants),
  })
  const nu = E.objectifsSolo(opts({}))
  assert.ok(nu.bronze < nu.argent && nu.argent < nu.or, 'les trois seuils sont ordonnés')

  // Une variante généreuse relève la barre, une variante punitive l'abaisse.
  const arc = E.objectifsSolo(opts({ whiteTiles: true }))
  assert.ok(arc.or > nu.or + 8, `Arc-en-Ciel doit relever l’or (${nu.or} → ${arc.or})`)
  const interdite = E.objectifsSolo(opts({ forbiddenColor: true }))
  assert.ok(interdite.or < nu.or - 5, `Couleur interdite doit l’abaisser (${nu.or} → ${interdite.or})`)

  // Les cartes aussi, et deux cartes plus qu'une.
  const une = E.objectifsSolo(opts({}, { useCards: true }))
  const deux = E.objectifsSolo(opts({}, { useCards: true, cardCount: 2 }))
  assert.ok(une.bronze > nu.bronze)
  assert.ok(deux.bronze > une.bronze)

  // Le bronze suit le décalage mesuré et ne le dépasse jamais : c'est la
  // somme brute des écarts, tassée. L'or, lui, monte plus vite — il inclut
  // l'étirement, puisqu'une partie chargée est aussi plus irrégulière.
  const empile = E.objectifsSolo(opts({ whiteTiles: true, crystals: true, dyes: true }))
  assert.ok(empile.bronze <= nu.bronze + 14.6 + 10.7 + 6.5 + 1)
  assert.ok(empile.bronze > arc.bronze, 'chaque variante de plus relève la barre')
  assert.ok(
    empile.or - empile.bronze > nu.or - nu.bronze,
    'et l’écart entre médailles s’étire avec le barème',
  )
})

test('les médailles se décernent dans le bon ordre', () => {
  const o = { bronze: 29, argent: 37, or: 44 }
  assert.equal(E.medaille(28, o), null)
  assert.equal(E.medaille(29, o), 'bronze')
  assert.equal(E.medaille(36, o), 'bronze')
  assert.equal(E.medaille(37, o), 'argent')
  assert.equal(E.medaille(44, o), 'or')
  assert.equal(E.medaille(200, o), 'or')
})

test('toutes les cartes en jeu ont un écart solo mesuré', () => {
  // Sinon le barème d'une carte imposée serait deviné, pas mesuré.
  assert.equal(E.cartesMesurees(), E.CARDS.length)
})

test('le barème solo est atteignable et ne se donne pas', () => {
  // La vérification qui compte : on fait jouer l'Expert et on regarde s'il
  // décroche les médailles à peu près à la fréquence visée.
  const options = {
    ...E.defaultOptions('bareme'),
    ruleset: withVariants({}),
  }
  const objectifs = E.objectifsSolo(options)
  let bronze = 0
  let or = 0
  const n = 40
  for (let g = 0; g < n; g++) {
    let s = E.createGame({
      players: [{ name: 'Solo', kind: 'bot-expert', boardColor: 'O' }],
      options: { ...options, seed: `solo-${g}` },
    })
    const rng = new E.Rng(`solo-${g}`)
    let garde = 0
    while (s.phase === 'playing' && garde++ < 100) {
      const m = E.bestMove(s, 'bot-expert', rng)
      if (!m) break
      s = E.applyMove(s, m)
    }
    const m = E.medaille(E.playerStats(s)[0].breakdown.total, objectifs)
    if (m) bronze++
    if (m === 'or') or++
  }
  assert.ok(bronze / n > 0.5, `le bronze doit rester courant (${bronze}/${n})`)
  assert.ok(bronze / n < 0.95, `mais pas automatique (${bronze}/${n})`)
  assert.ok(or / n < 0.35, `l’or doit rester rare (${or}/${n})`)
})
