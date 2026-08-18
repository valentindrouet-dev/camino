// Les quatre profils de bots : chacun doit battre le précédent.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')

/** Fait jouer une partie entière entre deux profils et rend les deux scores. */
function partie(a, b, graine) {
  let state = E.createGame({
    players: [
      { name: 'A', kind: a, boardColor: 'O' },
      { name: 'B', kind: b, boardColor: 'B' },
    ],
    options: { ...E.defaultOptions(graine), ruleset: E.DEFAULT_RULESET },
  })
  const rng = new E.Rng(`${graine}-ia`)
  let garde = 0
  while (state.phase === 'playing' && garde++ < 5000) {
    const move = E.bestMove(state, E.currentPlayer(state).kind, rng)
    if (!move) break
    state = E.applyMove(state, move)
  }
  return E.playerStats(state).map((s) => s.breakdown.total)
}

/** Moyenne des deux scores sur quelques parties, sièges alternés. */
function duel(a, b, n = 8) {
  let sa = 0
  let sb = 0
  for (let g = 0; g < n; g++) {
    // On alterne les sièges : le premier à choisir a un avantage réel.
    const [x, y] = g % 2 === 0 ? partie(a, b, `duel-${g}`) : partie(b, a, `duel-${g}`).reverse()
    sa += x
    sb += y
  }
  return [sa / n, sb / n]
}

test('les profils de bots se classent : Expert > Confirmé > Novice > Idiot', () => {
  const [expert, confirme] = duel('bot-expert', 'bot-smart')
  assert.ok(expert > confirme, `Expert ${expert.toFixed(1)} doit dépasser Confirmé ${confirme.toFixed(1)}`)

  const [conf2, novice] = duel('bot-smart', 'bot-greedy')
  assert.ok(conf2 > novice + 5, `Confirmé ${conf2.toFixed(1)} doit dominer Novice ${novice.toFixed(1)}`)

  const [nov2, idiot] = duel('bot-greedy', 'bot-random')
  assert.ok(nov2 > idiot + 10, `Novice ${nov2.toFixed(1)} doit écraser Idiot ${idiot.toFixed(1)}`)
})

test('l’Idiot joue vraiment n’importe quoi, mais légalement', () => {
  let state = E.createGame({
    players: [{ name: 'A', kind: 'bot-random', boardColor: 'O' }],
    options: { ...E.defaultOptions('idiot'), ruleset: E.DEFAULT_RULESET },
  })
  const rng = new E.Rng('idiot')
  let garde = 0
  while (state.phase === 'playing' && garde++ < 100) {
    const move = E.bestMove(state, 'bot-random', rng)
    if (!move) break
    assert.ok(E.isLegalMove(state, move), 'un coup illégal ne doit jamais sortir')
    state = E.applyMove(state, move)
  }
  assert.equal(state.phase, 'finished')
})

test('le potentiel s’éteint quand il ne reste plus de manches', () => {
  // Un chemin rouge de 2 tuiles ne marque pas encore. Tant qu'il reste des
  // manches, il vaut quelque chose ; à la dernière, il ne vaut plus rien.
  const board = E.createBoard(4)
  const rouge = E.TILES.findIndex((t) => t.quads.every((q) => q === 'R'))
  board.cells[5] = { tileId: rouge, rot: 0, round: 0 }
  board.cells[6] = { tileId: rouge, rot: 0, round: 1 }
  const avecAvenir = E.evaluateBoard(board, E.DEFAULT_RULESET, { roundsLeft: 8 })
  const sansAvenir = E.evaluateBoard(board, E.DEFAULT_RULESET, { roundsLeft: 0 })
  assert.ok(avecAvenir > sansAvenir, 'un chemin qui peut encore grandir vaut plus')
  assert.ok(sansAvenir <= 0, 'un chemin trop court, à la fin, ne vaut rien')
})

test('l’Expert prend en compte les cartes missions', () => {
  // Avec « Six couleurs », le bot doit finir avec plus de couleurs qui marquent
  // que sans carte du tout : c'est tout l'intérêt de la pente des missions.
  const jouer = (opts) => {
    let state = E.createGame({
      players: [
        { name: 'A', kind: 'bot-expert', boardColor: 'O' },
        { name: 'B', kind: 'bot-expert', boardColor: 'B' },
      ],
      options: { ...E.defaultOptions('mission'), ...opts, ruleset: E.DEFAULT_RULESET },
    })
    const rng = new E.Rng('mission-ia')
    let garde = 0
    while (state.phase === 'playing' && garde++ < 5000) {
      const move = E.bestMove(state, 'bot-expert', rng)
      if (!move) break
      state = E.applyMove(state, move)
    }
    const couleurs = E.playerStats(state).map(
      (s) => new Set(s.breakdown.zones.filter((z) => z.scoring).map((z) => z.color)).size,
    )
    return couleurs.reduce((a, b) => a + b, 0) / couleurs.length
  }
  const avec = jouer({ useCards: true, cardId: 'six-colors' })
  const sans = jouer({})
  assert.ok(avec >= sans, `avec la carte : ${avec} couleurs, sans : ${sans}`)
})
