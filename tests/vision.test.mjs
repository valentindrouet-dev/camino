// Lecture d'un plateau photographié : on fabrique la photo, on connaît donc
// la vérité et on peut compter les erreurs au lieu de les deviner.
//
// Le plateau dessiné ici reproduit le plateau IMPRIMÉ : cadre plein de la
// couleur du joueur, grille noire épaisse, emplacements blancs. Les
// proportions viennent d'une photo du vrai matériel — emplacement 230,
// barre 40, cadre 55. Ce n'est pas un détail décoratif : c'est le modèle de
// géométrie que la lecture applique, et s'en écarter fait glisser les mesures
// des tuiles de bord d'un huitième de tuile.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const E = await import('../src/engine/index.ts')
const V = await import('../src/vision/lecture.ts')
const D = await import('../src/vision/detection.ts')

const EMPLACEMENT = 230
const BARRE = 40
const CADRE = 55
const NOIR = [26, 26, 26]
const BLANC = [252, 252, 252]
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** Générateur reproductible : un test qui échoue doit pouvoir se rejouer. */
function alea(graine) {
  let s = graine >>> 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Le plateau tel qu'il sort de l'imprimerie. Rend aussi `u0`/`u1`, les bords
 * de la GRILLE NOIRE : c'est le repère qu'attend la lecture.
 */
function plateau(taille, poses, { cadre = 'O', vides = [] } = {}) {
  const grille = taille * EMPLACEMENT + (taille + 1) * BARRE
  const cote = grille + 2 * CADRE
  const px = new Uint8ClampedArray(cote * cote * 4)
  const rect = (x0, y0, w, h, c) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px0 = x0 + x
        const py0 = y0 + y
        if (px0 < 0 || py0 < 0 || px0 >= cote || py0 >= cote) continue
        const k = (py0 * cote + px0) * 4
        px[k] = c[0]
        px[k + 1] = c[1]
        px[k + 2] = c[2]
        px[k + 3] = 255
      }
  }
  rect(0, 0, cote, cote, hex(E.COLOR_HEX[cadre]))
  rect(CADRE, CADRE, grille, grille, NOIR)
  for (let i = 0; i < taille * taille; i++) {
    const ox = CADRE + BARRE + (i % taille) * (EMPLACEMENT + BARRE)
    const oy = CADRE + BARRE + Math.floor(i / taille) * (EMPLACEMENT + BARRE)
    if (vides.includes(i)) {
      rect(ox, oy, EMPLACEMENT, EMPLACEMENT, BLANC)
      continue
    }
    const q = E.tileQuads(poses[i].tileId, poses[i].rot)
    const d = EMPLACEMENT / 2
    const coins = [
      [0, 0],
      [d, 0],
      [d, d],
      [0, d],
    ]
    for (let k = 0; k < 4; k++) rect(ox + coins[k][0], oy + coins[k][1], d, d, hex(E.COLOR_HEX[q[k]]))
  }
  return { px, cote, u0: CADRE / cote, u1: (CADRE + grille) / cote }
}

/** La photo : perspective, table en fond, lumière colorée, grain du capteur. */
function photographier(net, cote, planche, L, H, dominante, bruit, rnd) {
  const out = new Uint8ClampedArray(L * H * 4)
  const versUnite = V.homographie4(planche, V.CARRE_UNITE)
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

const LARGEUR = 900
const HAUTEUR = 720
const IMAGE = (t) => E.tileQuads(t.tileId, t.rot).join('')

/** Une scène complète : la photo, la vérité, et les vrais coins de la grille. */
function scene({ graine = 1, taille = 4, dominante = [1.08, 1, 0.84], bruit = 6, vides = [] } = {}) {
  const rnd = alea(graine)
  const dispo = [...Array(E.TILE_COUNT).keys()]
  const poses = []
  for (let i = 0; i < taille * taille; i++)
    poses.push({
      tileId: dispo.splice(Math.floor(rnd() * dispo.length), 1)[0],
      rot: Math.floor(rnd() * 4),
    })
  const net = plateau(taille, poses, { vides })
  const j = () => (rnd() - 0.5) * 70
  const planche = [
    { x: 110 + j(), y: 80 + j() },
    { x: 800 + j(), y: 130 + j() },
    { x: 760 + j(), y: 670 + j() },
    { x: 150 + j(), y: 625 + j() },
  ]
  const image = photographier(net.px, net.cote, planche, LARGEUR, HAUTEUR, dominante, bruit, rnd)
  const h = V.homographie4(V.CARRE_UNITE, planche)
  const coins = [
    [net.u0, net.u0],
    [net.u1, net.u0],
    [net.u1, net.u1],
    [net.u0, net.u1],
  ].map(([u, v]) => V.projeter(h, u, v))
  return { image, poses, coins, taille, rnd, vides }
}

/** Nombre de tuiles correctement retrouvées avec ce repère. */
function justes(s, coins) {
  const l = V.lire(s.image, LARGEUR, HAUTEUR, coins, s.taille)
  return {
    lecture: l,
    n: l.cases.filter(
      (c, i) => (s.vides.includes(i) ? c.vide : !c.vide && IMAGE(c) === IMAGE(s.poses[i])),
    ).length,
  }
}

// ------------------------------------------------------------------ géométrie

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

test('la géométrie du plateau place les mesures dans les emplacements', () => {
  // Le repère va d'un bord extérieur de la grille noire à l'autre : les barres
  // doivent tomber entre les emplacements, jamais dessus.
  const { quarts, barres, largeurQuart } = V.geometrie(4)
  assert.equal(quarts.length, 8)
  assert.equal(barres.length, 5)
  assert.ok(barres[0] > 0 && barres[4] < 1, 'les barres du bord sont dans le repère')
  for (const q of quarts)
    for (const b of barres)
      assert.ok(
        Math.abs(q - b) > largeurQuart * 0.5,
        'une mesure ne doit jamais tomber sur une barre noire',
      )
  // Et les proportions correspondent au plateau imprimé.
  const emplacement = quarts[1] - quarts[0] + largeurQuart
  const barre = barres[1] - barres[0] - emplacement
  assert.ok(Math.abs(barre / emplacement - V.JEU_PLATEAU) < 1e-9)
})

test('la palette du jeu reste lisible par une machine', () => {
  let mini = Infinity
  for (const a of V.PALETTE)
    for (const b of V.PALETTE)
      if (a !== b) mini = Math.min(mini, V.deltaE(V.LAB_PALETTE[a], V.LAB_PALETTE[b]))
  assert.ok(mini > 30, `la paire la plus proche est à ΔE ${mini.toFixed(1)}`)
})

// --------------------------------------------------------------------- lecture

test('une photo bien cadrée se lit intégralement', () => {
  const s = scene({ graine: 7, bruit: 3 })
  const { n, lecture } = justes(s, s.coins)
  assert.equal(n, 16, 'les seize tuiles doivent être retrouvées')
  assert.ok(lecture.residu < 9, `résidu ${lecture.residu.toFixed(1)} ΔE`)
  assert.equal(lecture.cases.filter(V.douteuse).length, 0, 'rien ne devrait être signalé')
})

test('le recalage absorbe la dominante d’une lampe chaude', () => {
  const s = scene({ graine: 11, dominante: [1.14, 1, 0.74], bruit: 8 })
  const { n, lecture } = justes(s, s.coins)
  assert.ok(lecture.recale, 'le recalage doit s’être appliqué')
  assert.equal(n, 16, 'une dominante est systématique, donc rattrapable')
})

test('une dominante extrême abîme la lecture, mais elle le dit', () => {
  // Le recalage est un gain affine ; une lampe très colorée déforme davantage
  // que ça et quelques cases finissent par tomber. Ce qu'on exige alors, ce
  // n'est pas la perfection, c'est l'honnêteté : chaque erreur doit être
  // signalée pour que l'écran la donne à vérifier.
  const s = scene({ graine: 13, dominante: [1.3, 1, 0.56], bruit: 8 })
  const { n, lecture } = justes(s, s.coins)
  assert.ok(n >= 13, `${n}/16 tuiles retrouvées malgré la dominante`)
  const ratees = lecture.cases.filter((c, i) => c.vide || IMAGE(c) !== IMAGE(s.poses[i]))
  assert.ok(
    ratees.every(V.douteuse),
    `${ratees.filter(V.douteuse).length}/${ratees.length} erreurs signalées`,
  )
})

test('une dominante froide ne gêne pas davantage', () => {
  const s = scene({ graine: 12, dominante: [0.84, 0.97, 1.2], bruit: 8 })
  assert.equal(justes(s, s.coins).n, 16)
})

test('un emplacement vide est vu comme vide, pas comme une tuile', () => {
  const s = scene({ graine: 42, bruit: 5, vides: [5, 10] })
  const l = V.lire(s.image, LARGEUR, HAUTEUR, s.coins, s.taille)
  const vus = l.cases.map((c, i) => (c.vide ? i : -1)).filter((i) => i >= 0)
  assert.deepEqual(vus, [5, 10], 'exactement les deux emplacements laissés libres')
})

test('une case mal lue est signalée', () => {
  // Conditions volontairement mauvaises : on n'exige pas une lecture juste,
  // on exige que l'écran sache dire ce qui est douteux.
  let erreurs = 0
  let signalees = 0
  for (let g = 0; g < 10; g++) {
    const s = scene({ graine: 100 + g, dominante: [1.4, 0.95, 0.5], bruit: 46 })
    const derive = 26
    const poses = s.coins.map((c) => ({
      x: c.x + (s.rnd() - 0.5) * 2 * derive,
      y: c.y + (s.rnd() - 0.5) * 2 * derive,
    }))
    const l = V.lire(s.image, LARGEUR, HAUTEUR, poses, s.taille)
    l.cases.forEach((c, i) => {
      if (c.vide || IMAGE(c) !== IMAGE(s.poses[i])) {
        erreurs++
        if (V.douteuse(c)) signalees++
      }
    })
  }
  assert.ok(erreurs > 15, `il faut de vraies erreurs à attraper (${erreurs})`)
  assert.ok(
    signalees / erreurs > 0.75,
    `${signalees}/${erreurs} erreurs signalées — le signal de confiance doit rester fiable`,
  )
})

// --------------------------------------------------------------------- calage

test('le calage rattrape des coins posés à la louche', () => {
  // C'est la promesse faite à l'écran : poser les quatre coins à peu près, et
  // laisser l'application les ajuster. « À peu près » vaut ici une demi-tuile.
  let avant = 0
  let apres = 0
  const n = 8
  for (let g = 0; g < n; g++) {
    const s = scene({ graine: 300 + g })
    const derive = 30
    const poses = s.coins.map((c) => ({
      x: c.x + (s.rnd() - 0.5) * 2 * derive,
      y: c.y + (s.rnd() - 0.5) * 2 * derive,
    }))
    if (justes(s, poses).n === 16) avant++
    const cale = D.calerCoins(s.image, LARGEUR, HAUTEUR, poses, s.taille)
    if (justes(s, cale.coins).n === 16) apres++
  }
  assert.ok(apres >= n - 1, `${apres}/${n} plateaux parfaits après calage`)
  assert.ok(apres > avant, `le calage doit améliorer les choses (${avant} → ${apres})`)
})

test('le calage ne dégrade pas un cadrage déjà juste', () => {
  const s = scene({ graine: 400 })
  const cale = D.calerCoins(s.image, LARGEUR, HAUTEUR, s.coins, s.taille)
  assert.equal(justes(s, cale.coins).n, 16)
})

test('la détection propose un cadrage utilisable ou se tait', () => {
  // La détection automatique n'est pas garantie — on exige seulement qu'elle
  // ne mente pas : ce qu'elle annonce comme bon doit l'être.
  let annonces = 0
  let tenues = 0
  for (let g = 0; g < 8; g++) {
    const s = scene({ graine: 500 + g })
    const det = D.detecterPlateau(s.image, LARGEUR, HAUTEUR, s.taille)
    if (!det || det.qualite > D.QUALITE_MINIMALE) continue
    annonces++
    if (justes(s, det.coins).n >= s.taille * s.taille - 1) tenues++
  }
  assert.ok(annonces > 0, 'la détection doit réussir au moins parfois')
  assert.ok(
    tenues / annonces >= 0.75,
    `${tenues}/${annonces} détections annoncées sûres et réellement justes`,
  )
})
