// Lecture d'un plateau photographié : on fabrique la photo, on connaît donc
// la vérité et on peut compter les erreurs au lieu de les deviner.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')
const V = await import('../src/vision/lecture.ts')

const PAS = 120
const JEU = 10

/** Générateur reproductible : un test qui échoue doit pouvoir se rejouer. */
function alea(graine) {
  let s = graine >>> 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** Le damier net, tel qu'il sortirait de l'imprimante. */
function dessiner(taille, verite) {
  const cote = taille * PAS - JEU
  const px = new Uint8ClampedArray(cote * cote * 4)
  const mettre = (x, y, c) => {
    const k = (y * cote + x) * 4
    px[k] = c[0]
    px[k + 1] = c[1]
    px[k + 2] = c[2]
    px[k + 3] = 255
  }
  for (let y = 0; y < cote; y++) for (let x = 0; x < cote; x++) mettre(x, y, [167, 169, 172])
  const demi = (PAS - JEU) / 2
  const coins = [
    [0, 0],
    [demi, 0],
    [demi, demi],
    [0, demi],
  ]
  for (let i = 0; i < verite.length; i++) {
    const ox = (i % taille) * PAS
    const oy = Math.floor(i / taille) * PAS
    const q = E.tileQuads(verite[i].tileId, verite[i].rot)
    for (let k = 0; k < 4; k++) {
      const c = hex(E.COLOR_HEX[q[k]])
      for (let y = 0; y < demi; y++)
        for (let x = 0; x < demi; x++) mettre(ox + coins[k][0] + x, oy + coins[k][1] + y, c)
    }
  }
  return { px, cote }
}

/** La photo : perspective, table en fond, lumière colorée, grain. */
function photographier(net, cote, coins, L, H, dominante, bruit, rnd) {
  const out = new Uint8ClampedArray(L * H * 4)
  const versUnite = V.homographie4(coins, V.CARRE_UNITE)
  const gauss = () => {
    let u = 0
    let v = 0
    while (!u) u = rnd()
    while (!v) v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const p = V.projeter(versUnite, x + 0.5, y + 0.5)
      let r
      let g
      let b
      if (p.x < 0 || p.y < 0 || p.x >= 1 || p.y >= 1) {
        const t = y / H
        r = 226 - 26 * t
        g = 208 - 26 * t
        b = 178 - 24 * t
      } else {
        const sx = Math.min(cote - 1, Math.floor(p.x * cote))
        const sy = Math.min(cote - 1, Math.floor(p.y * cote))
        const k = (sy * cote + sx) * 4
        r = net[k]
        g = net[k + 1]
        b = net[k + 2]
      }
      const dx = (x / L - 0.5) * 2
      const dy = (y / H - 0.5) * 2
      const vg = 1 - 0.16 * (dx * dx + dy * dy)
      const k = (y * L + x) * 4
      out[k] = r * dominante[0] * vg + gauss() * bruit
      out[k + 1] = g * dominante[1] * vg + gauss() * bruit
      out[k + 2] = b * dominante[2] * vg + gauss() * bruit
      out[k + 3] = 255
    }
  }
  return out
}

const IMAGE = (t) => E.tileQuads(t.tileId, t.rot).join('')

/** Une lecture complète : rend les cases lues et la vérité. */
function essai({ graine = 1, taille = 4, dominante = [1, 1, 1], bruit = 4, derive = 0 } = {}) {
  const rnd = alea(graine)
  const dispo = [...Array(E.TILE_COUNT).keys()]
  const verite = []
  for (let i = 0; i < taille * taille; i++)
    verite.push({
      tileId: dispo.splice(Math.floor(rnd() * dispo.length), 1)[0],
      rot: Math.floor(rnd() * 4),
    })
  const { px, cote } = dessiner(taille, verite)
  const L = 900
  const H = 720
  const j = () => (rnd() - 0.5) * 60
  const vrais = [
    { x: 118 + j(), y: 96 + j() },
    { x: 786 + j(), y: 138 + j() },
    { x: 742 + j(), y: 660 + j() },
    { x: 160 + j(), y: 620 + j() },
  ]
  const image = photographier(px, cote, vrais, L, H, dominante, bruit, rnd)
  const lus = vrais.map((c) => ({
    x: c.x + (rnd() - 0.5) * 2 * derive,
    y: c.y + (rnd() - 0.5) * 2 * derive,
  }))
  const lecture = V.lire(image, L, H, lus, taille)
  const justes = lecture.cases.filter((c, i) => !c.vide && IMAGE(c) === IMAGE(verite[i])).length
  return { lecture, verite, justes }
}

test('l’homographie envoie bien le carré unité sur les quatre coins', () => {
  const coins = [
    { x: 118, y: 96 },
    { x: 786, y: 138 },
    { x: 742, y: 660 },
    { x: 160, y: 620 },
  ]
  const h = V.homographie(coins)
  assert.ok(h, 'quatre coins en position générale doivent donner une solution')
  V.CARRE_UNITE.forEach((u, i) => {
    const p = V.projeter(h, u.x, u.y)
    assert.ok(Math.hypot(p.x - coins[i].x, p.y - coins[i].y) < 1e-6, `coin ${i} mal envoyé`)
  })
  // Et l'aller-retour redonne le carré unité.
  const retour = V.homographie4(coins, V.CARRE_UNITE)
  const q = V.projeter(retour, coins[2].x, coins[2].y)
  assert.ok(Math.hypot(q.x - 1, q.y - 1) < 1e-6)
})

test('quatre points alignés ne donnent pas d’homographie', () => {
  const plats = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ]
  assert.equal(V.homographie(plats), null)
})

test('la palette du jeu reste lisible par une machine', () => {
  // Deux couleurs trop proches rendraient toute lecture illusoire.
  let mini = Infinity
  for (const a of V.PALETTE)
    for (const b of V.PALETTE)
      if (a !== b) mini = Math.min(mini, V.deltaE(V.LAB_PALETTE[a], V.LAB_PALETTE[b]))
  assert.ok(mini > 30, `la paire la plus proche est à ΔE ${mini.toFixed(1)}`)
})

test('une photo propre se lit intégralement', () => {
  const { justes, lecture } = essai({ graine: 7, bruit: 3 })
  assert.equal(justes, 16, 'les seize tuiles doivent être retrouvées')
  assert.ok(lecture.residu < 8, `résidu ${lecture.residu.toFixed(1)} ΔE`)
  assert.equal(lecture.cases.filter(V.douteuse).length, 0, 'rien ne devrait être signalé')
})

test('le recalage absorbe la dominante d’une lampe chaude', () => {
  const chaud = { graine: 11, dominante: [1.2, 1, 0.68], bruit: 8 }
  const { justes, lecture } = essai(chaud)
  assert.ok(lecture.recale, 'le recalage doit s’être appliqué')
  assert.equal(justes, 16, 'une dominante est systématique, donc rattrapable')
})

test('un décalage des coins d’un quart de tuile reste sans conséquence', () => {
  // Un quart fait 55 px dans cette photo : 12 px, c'est un cinquième de quart.
  const { justes } = essai({ graine: 3, bruit: 8, derive: 12 })
  assert.equal(justes, 16)
})

test('une case mal lue est signalée', () => {
  // Conditions volontairement mauvaises : on n'exige pas une lecture juste,
  // on exige que l'écran sache dire ce qui est douteux.
  let erreurs = 0
  let erreursSignalees = 0
  for (let g = 0; g < 12; g++) {
    const { lecture, verite } = essai({
      graine: 100 + g,
      dominante: [1.35, 0.98, 0.55],
      bruit: 34,
      derive: 18,
    })
    lecture.cases.forEach((c, i) => {
      if (c.vide || IMAGE(c) !== IMAGE(verite[i])) {
        erreurs++
        if (V.douteuse(c)) erreursSignalees++
      }
    })
  }
  assert.ok(erreurs > 20, `il faut de vraies erreurs à attraper (${erreurs})`)
  assert.ok(
    erreursSignalees / erreurs > 0.8,
    `${erreursSignalees}/${erreurs} erreurs signalées — le signal de confiance doit rester fiable`,
  )
})

test('un emplacement vide est vu comme vide, pas comme une tuile', () => {
  const rnd = alea(42)
  const taille = 4
  const dispo = [...Array(E.TILE_COUNT).keys()]
  const verite = []
  for (let i = 0; i < 16; i++)
    verite.push({
      tileId: dispo.splice(Math.floor(rnd() * dispo.length), 1)[0],
      rot: Math.floor(rnd() * 4),
    })
  const { px, cote } = dessiner(taille, verite)
  // On efface deux tuiles : sur le plateau, un emplacement libre est blanc.
  const demi = (PAS - JEU) / 2
  for (const cell of [5, 10]) {
    const ox = (cell % taille) * PAS
    const oy = Math.floor(cell / taille) * PAS
    for (let y = 0; y < 2 * demi; y++)
      for (let x = 0; x < 2 * demi; x++) {
        const k = ((oy + y) * cote + ox + x) * 4
        px[k] = 255
        px[k + 1] = 255
        px[k + 2] = 255
      }
  }
  const L = 900
  const H = 720
  const coins = [
    { x: 120, y: 100 },
    { x: 780, y: 140 },
    { x: 740, y: 655 },
    { x: 165, y: 615 },
  ]
  const image = photographier(px, cote, coins, L, H, [1.05, 1, 0.9], 5, rnd)
  const lecture = V.lire(image, L, H, coins, taille)
  const vides = lecture.cases.map((c, i) => (c.vide ? i : -1)).filter((i) => i >= 0)
  assert.deepEqual(vides, [5, 10], 'exactement les deux emplacements effacés')
})
