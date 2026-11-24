import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')
const { Rng } = await import('../src/engine/rng.ts')

/* ------------------------------------------------------------------------- */
/* Outils                                                                    */
/* ------------------------------------------------------------------------- */

const avecVariantes = (options, variants) => ({
  ...options,
  ruleset: { ...options.ruleset, variants: { ...(options.ruleset.variants ?? {}), ...variants } },
})

function options(seed, extra = {}, variants = {}) {
  return avecVariantes({ ...E.clearVariants(E.defaultOptions(seed)), seed, ...extra }, variants)
}

function partie(opts, joueurs = 4) {
  return E.createGame({
    players: E.defaultPlayers(joueurs).map((p, i) => ({ ...p, name: `J${i + 1}`, kind: 'bot-smart' })),
    options: opts,
  })
}

/** Joue la partie jusqu'au bout avec les bots. */
function jouer(s) {
  const rng = new Rng(`${s.options.seed}-ai`)
  let garde = 0
  while (s.phase === 'playing' && garde++ < 5000) {
    const m = E.bestMove(s, 'bot-smart', rng)
    if (!m) break
    s = E.applyMove(s, m)
  }
  return s
}

const V2 = { devV2: true }

/* ------------------------------------------------------------------------- */
/* Décochée : rien ne change                                                 */
/* ------------------------------------------------------------------------- */

test('sans Dév v2, le paquet est celui de la boîte', () => {
  assert.equal(E.paquetDeCartes(E.DEFAULT_RULESET), E.CARDS)
  assert.equal(E.paquetDeCartes({ ...E.DEFAULT_RULESET, variants: { quadBorders: true } }), E.CARDS)
})

test('les cartes v2 restent hors du catalogue de la boîte : les tirages des autres parties ne bougent pas', () => {
  // La mise en place tire une couleur par carte de ce catalogue, dans l'ordre :
  // une carte de plus décalerait tous les tirages de toutes les parties.
  assert.ok(E.TOUTES_LES_CARTES.every((c) => !c.id.startsWith('v2-')))
  assert.ok(E.CARDS.every((c) => !c.id.startsWith('v2-')))
})

test('sans Dév v2, une carte retirée imposée reste jouable et une carte v2 imposée est ignorée', () => {
  const retiree = partie(options('imposee', { useCards: true, cardId: 'heart' }))
  assert.equal(retiree.cardIds[0], 'heart')
  const v2 = partie(options('imposee', { useCards: true, cardId: 'v2-exact-4' }))
  assert.ok(!v2.cardIds[0].startsWith('v2-'))
})

/* ------------------------------------------------------------------------- */
/* Le paquet v2                                                              */
/* ------------------------------------------------------------------------- */

test('le paquet v2 : 18 cartes, sans Par les angles ni Encerclement', () => {
  const p = E.paquetDeCartes({ ...E.DEFAULT_RULESET, variants: V2 })
  assert.equal(p.length, 18)
  assert.ok(p.every((c) => c.id.startsWith('v2-')))
  const bases = p.map((c) => c.base).filter(Boolean)
  assert.ok(!bases.includes('corners'))
  assert.ok(!bases.includes('enclose'))
  assert.ok(!p.some((c) => c.id === 'v2-border-colors'), 'pas de carte des bords sans les Bords 4 Couleurs')
  const avecBords = E.paquetDeCartes({ ...E.DEFAULT_RULESET, variants: { ...V2, quadBorders: true } })
  assert.equal(avecBords.length, 19)
  assert.ok(avecBords.some((c) => c.id === 'v2-border-colors'))
})

test('les cartes v2 portent les noms et les textes de la liste de développement', () => {
  const t = (id) => E.cardById(id)
  assert.equal(t('v2-exact-4').name, 'Chemins de 4 Tuiles')
  assert.match(t('v2-exact-4').text, /\+4 points/)
  assert.match(t('v2-exact-5').text, /\+5 points/)
  assert.match(t('v2-long-6').text, /\+6 points pour chaque chemin composé d’exactement 6 tuiles/)
  assert.equal(t('v2-purple-longest').badge, '+8')
  assert.match(t('v2-purple-longest').text, /\+4 points par joueur/)
  assert.match(t('v2-specialist').text, /2 chemins/)
  assert.equal(t('v2-thrifty').name, 'Le Plus de Zones Noires')
  assert.equal(t('v2-banned-color').name, 'Couleur Interdite')
  assert.match(t('v2-banned-color').text, /ne compte pour aucune autre carte/)
  assert.deepEqual(t('v2-sudden-death').seuils, [9, 10])
  assert.equal(t('v2-clean-edge').name, 'Zones Noires Intérieures')
  assert.equal(t('v2-black-positive').name, 'Zones Noires Positives')
})

test('Dév v2 met les Couleurs Équilibrées dans le sac', () => {
  const s = partie(options('sac', {}, V2))
  const sac = new Set([...s.bag, ...s.pool.map((p) => p.tileId)])
  for (const id of E.DOUBLED_TILE_IDS) assert.ok(!sac.has(id), `la tuile en double ${id} est retirée`)
  for (const id of E.BALANCED_TILE_IDS) assert.ok(sac.has(id), `la tuile ${id} est dans le sac`)
  assert.equal(sac.size, 97)
})

test('Dév v2 tire dans son paquet, et deux cartes à couleur ne visent jamais la même couleur', () => {
  let paires = 0
  for (let g = 0; g < 300; g++) {
    const s = partie(options(`tirage-${g}`, { useCards: true, cardCount: 3 }, V2))
    assert.equal(s.cardIds.length, 3)
    for (const id of s.cardIds) assert.ok(id.startsWith('v2-') && id !== 'v2-border-colors', id)
    const colorees = s.cardIds.filter((id) => E.cardById(id).colorized)
    const couleurs = colorees.map((id) => s.cardColors[id])
    assert.equal(new Set(couleurs).size, couleurs.length, `${colorees} : ${couleurs}`)
    if (colorees.length > 1) paires++
  }
  assert.ok(paires > 10, `assez de parties avec deux cartes à couleur (${paires})`)
})

test('Dév v2 ignore une carte de la boîte imposée, mais garde une carte v2 imposée', () => {
  assert.ok(partie(options('imp', { useCards: true, cardId: 'exact-4' }, V2)).cardIds[0].startsWith('v2-'))
  assert.equal(partie(options('imp', { useCards: true, cardId: 'v2-exact-4' }, V2)).cardIds[0], 'v2-exact-4')
})

/* ------------------------------------------------------------------------- */
/* Les barèmes, sur des parties jouées jusqu'au bout                         */
/* ------------------------------------------------------------------------- */

function finale(cardId, seed, variants = {}) {
  const s = jouer(partie(options(seed, { useCards: true, cardId }, { ...V2, ...variants })))
  assert.equal(s.cardIds[0], cardId)
  return { s, stats: E.playerStats(s) }
}

const chemins = (b) => b.zones.filter((z) => z.scoring)

test('Chemins de 4, 5, 6 Tuiles : +4, +5, +6 par chemin d’exactement 4, 5, 6 tuiles', () => {
  for (const [id, n, pts] of [['v2-exact-4', 4, 4], ['v2-exact-5', 5, 5], ['v2-long-6', 6, 6]]) {
    let vus = 0
    for (let g = 0; g < 6; g++) {
      for (const st of finale(id, `bareme-${id}-${g}`).stats) {
        const attendu = pts * chemins(st.breakdown).filter((z) => z.span === n).length
        assert.equal(st.breakdown.cardPoints, attendu, `${id}`)
        if (attendu) vus++
      }
    }
    assert.ok(vus > 0, `${id} rapporte au moins une fois`)
  }
})

test('2 Chemins d’une même Couleur : +10 dès deux chemins d’une couleur', () => {
  for (let g = 0; g < 6; g++) {
    for (const st of finale('v2-specialist', `spe-${g}`).stats) {
      const parCouleur = {}
      for (const z of chemins(st.breakdown)) parCouleur[z.color] = (parCouleur[z.color] ?? 0) + 1
      const ok = Object.values(parCouleur).some((n) => n >= 2)
      assert.equal(st.breakdown.cardPoints, ok ? 10 : 0)
    }
  }
})

test('Plus Grand Chemin : 8 points, 4 en cas d’égalité', () => {
  const vus = new Set()
  for (let g = 0; g < 10; g++) {
    for (const st of finale('v2-purple-longest', `pgc-${g}`).stats) {
      assert.ok([0, 4, 8].includes(st.breakdown.cardPoints))
      vus.add(st.breakdown.cardPoints)
    }
  }
  assert.ok(vus.has(8))
})

test('Le Plus de Zones Noires : le bonus va à qui en a le plus, partagé en cas d’égalité', () => {
  for (let g = 0; g < 8; g++) {
    const { stats } = finale('v2-thrifty', `noir-${g}`)
    const noires = stats.map((st) => st.breakdown.blackZones)
    const max = Math.max(...noires)
    const ex = noires.filter((n) => n === max).length
    stats.forEach((st, i) => {
      const attendu = max === 0 || noires[i] < max ? 0 : ex > 1 ? 5 : 10
      assert.equal(st.breakdown.cardPoints, attendu)
    })
  }
})

/* ------------------------------------------------------------------------- */
/* Couleur Interdite : elle ne compte pour aucune autre carte                 */
/* ------------------------------------------------------------------------- */

test('Couleur Interdite + Zones Noires Positives : la couleur interdite coûte toujours 2 points', () => {
  const s = jouer(partie(options('interdite-noir', {}, {})))
  const board = s.players[0].board
  const couleur = 'R'
  const v2 = E.effectiveRuleset(E.DEFAULT_RULESET, 'v2-black-positive')
  const zonesV2 = E.computeZones(board, v2, [couleur]).filter((z) => z.color === couleur)
  assert.ok(zonesV2.length > 0)
  for (const z of zonesV2) assert.equal(z.points, -2)
  for (const z of E.computeZones(board, v2, [couleur]).filter((z) => z.color === 'K')) assert.equal(z.points, 2)
  // La carte de la boîte, elle, n'a pas changé : la couleur bannie suit le noir.
  const boite = E.effectiveRuleset(E.DEFAULT_RULESET, 'black-positive')
  for (const z of E.computeZones(board, boite, [couleur]).filter((z) => z.color === couleur)) assert.equal(z.points, 2)
})

test('Couleur Interdite : elle ne déclenche pas la Mort Subite', () => {
  const carte = E.cardById('v2-sudden-death')
  const zone = (color, span) => ({ color, span, scoring: false, cells: [], tiles: [], borders: 0, borderIds: [], stars: 0, points: 0 })
  const ctx = (zones, forbidden) => ({ breakdown: { zones, forbidden }, seuil: 9 })
  assert.equal(carte.atteint(ctx([zone('R', 10)], ['R'])), false, 'chemin interdit de 10 tuiles')
  assert.equal(carte.atteint(ctx([zone('R', 10)], [])), true)
  assert.equal(carte.atteint(ctx([zone('G', 8)], [])), false, 'sous le seuil de 9')
  assert.equal(carte.atteint(ctx([zone('K', 12)], [])), false, 'le noir n’est pas un chemin')
  // La carte de la boîte compte toujours la zone bannie : rien n'a changé pour elle.
  assert.equal(E.cardById('sudden-death').atteint({ ...ctx([zone('R', 10)], ['R']), seuil: 7 }), true)
})

test('Couleur Interdite : elle ne compte ni pour Plus Grand Chemin ni pour Bord de Couleur Identique', () => {
  const s = jouer(partie(options('interdite-bords', {}, { ...V2, quadBorders: true })))
  const p = s.players[0]
  let moins = false
  for (const couleur of E.PATH_COLORS) {
    const sans = E.scoreBoard(p.board, s.options.ruleset, {})
    const avec = E.scoreBoard(p.board, s.options.ruleset, { forbiddenColors: [couleur] })
    const ctx = (b) => ({ playerId: 0, board: p.board, boardColor: p.boardColor, breakdown: b, ruleset: s.options.ruleset, table: [{ playerId: 0, zones: b.zones }], color: couleur })
    const bord = E.cardById('v2-matching-edge')
    const a = bord.evaluate(ctx(sans)).points, b = bord.evaluate(ctx(avec)).points
    assert.ok(b <= a)
    if (b < a) moins = true
    assert.equal(E.cardById('v2-purple-longest').evaluate(ctx(avec)).points, 0, `plus grand chemin ${couleur} interdit`)
  }
  assert.ok(moins, 'au moins une couleur interdite retire des tuiles assorties')
})

/* ------------------------------------------------------------------------- */
/* 4 Couleurs du Plateau                                                     */
/* ------------------------------------------------------------------------- */

test('4 Couleurs du Plateau : +8 si les quatre couleurs des bords marquent', () => {
  let huit = 0
  for (let g = 0; g < 8; g++) {
    const { s, stats } = finale('v2-border-colors', `b02-${g}`, { quadBorders: true })
    stats.forEach((st, i) => {
      const cotes = s.players[i].board.borders.sides
      const marquees = new Set(chemins(st.breakdown).map((z) => z.color))
      const attendu = cotes.every((c) => marquees.has(c)) ? 8 : 0
      assert.equal(st.breakdown.cardPoints, attendu)
      if (attendu) huit++
    })
  }
  assert.ok(huit > 0)
})
