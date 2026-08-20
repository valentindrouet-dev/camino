/**
 * Trouver le plateau tout seul dans une photo.
 *
 * On ne cherche pas un contour : le cadre coloré du plateau ressemble à une
 * tuile, et rien ne garantit un bord franc côté table. Ce qu'on suit, c'est la
 * GRILLE NOIRE — des barres épaisses (un sixième d'emplacement) qui reviennent
 * à intervalle régulier et font le tour du damier. C'est le motif le plus
 * reconnaissable du plateau, et le seul qui donne la PHASE : le critère de
 * lecture, lui, ne sait pas distinguer une grille juste d'une grille décalée
 * d'une demi-tuile, puisque les deux mesurent des couleurs tout aussi propres.
 *
 * Trois temps :
 *   1. un masque de saturation dit grossièrement où est le plateau, cadre
 *      compris ;
 *   2. dans cette boîte, on cale le profil de saturation sur la géométrie
 *      exacte du plateau — creux sur les barres, bosses sur les emplacements —
 *      en x puis en y. Ça donne la position ET l'échelle du damier, cadre
 *      exclu, parce que le cadre n'a aucune structure périodique ;
 *   3. on affine les quatre coins avec le vrai critère de lecture, ce qui
 *      rattrape la perspective.
 *
 * Le calage suppose un plateau à peu près de face. Une photo très inclinée
 * donnera un départ approximatif que l'affinage devra rattraper — et si le
 * résultat reste mauvais, l'écran le dit et laisse poser les coins à la main.
 */

import { geometrie, qualiteDuRepere } from './lecture.ts'
import type { Point } from './lecture.ts'

export interface Detection {
  coins: Point[]
  /** Le critère obtenu : c'est la confiance de la détection. */
  qualite: number
}

/**
 * Au-delà, on ne prétend pas avoir trouvé le plateau : mieux vaut demander à
 * l'utilisateur de poser les coins que lui montrer un cadrage faux.
 */
export const QUALITE_MINIMALE = 22

/** Saturation (max − min des canaux) au-dessus de laquelle un pixel est coloré. */
const SATURE = 42
/** Côté de la grille d'échantillonnage du masque. */
const MASQUE = 150
/** Part des pixels colorés ignorée de chaque côté (reflets, objets isolés). */
const MARGE = 0.02
/** Sous-échantillonnage des profils de saturation. */
const PAS_PROFIL = 2

/**
 * Gains qui ramènent les trois canaux à la même moyenne. Sans ça, une lampe
 * chaude rend le bois de la table aussi « coloré » qu'une tuile et le masque
 * avale la moitié de la pièce — c'est exactement ce qui faisait dérailler la
 * détection.
 */
function egaliser(pixels: Uint8ClampedArray, largeur: number, hauteur: number): [number, number, number] {
  let sr = 0
  let sg = 0
  let sb = 0
  let n = 0
  const pas = Math.max(1, Math.floor(Math.min(largeur, hauteur) / MASQUE)) * 4
  for (let k = 0; k < pixels.length; k += pas) {
    sr += pixels[k]
    sg += pixels[k + 1]
    sb += pixels[k + 2]
    n++
  }
  if (!n) return [1, 1, 1]
  const moy = (sr + sg + sb) / (3 * n)
  const g = (somme: number) => (somme > n ? Math.min(2, Math.max(0.5, (moy * n) / somme)) : 1)
  return [g(sr), g(sg), g(sb)]
}

/** Saturation d'un pixel, sans passer par Lab : c'est appelé des millions de fois. */
function saturation(pixels: Uint8ClampedArray, k: number, gains: [number, number, number]): number {
  const r = pixels[k] * gains[0]
  const g = pixels[k + 1] * gains[1]
  const b = pixels[k + 2] * gains[2]
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function percentile(tri: number[], p: number): number {
  if (!tri.length) return 0
  const i = Math.min(tri.length - 1, Math.max(0, Math.round(p * (tri.length - 1))))
  return tri[i]
}

interface Boite {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** La boîte où se concentrent les couleurs vives : le plateau, cadre compris. */
function boiteColoree(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  gains: [number, number, number],
): Boite | null {
  const xs: number[] = []
  const ys: number[] = []
  const pasX = Math.max(1, Math.floor(largeur / MASQUE))
  const pasY = Math.max(1, Math.floor(hauteur / MASQUE))
  let total = 0
  for (let y = 0; y < hauteur; y += pasY) {
    for (let x = 0; x < largeur; x += pasX) {
      total++
      if (saturation(pixels, (y * largeur + x) * 4, gains) < SATURE) continue
      xs.push(x)
      ys.push(y)
    }
  }
  // Trop peu de couleur : ce n'est probablement pas un plateau.
  if (xs.length < total * 0.04) return null
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  return {
    x0: percentile(xs, MARGE),
    y0: percentile(ys, MARGE),
    x1: percentile(xs, 1 - MARGE),
    y1: percentile(ys, 1 - MARGE),
  }
}

/**
 * Saturation moyenne le long d'un axe, dans la boîte. Les creux de ce profil
 * sont les barres noires de la grille — le noir n'a aucune saturation, et les
 * emplacements vides, blancs, non plus : ce sont les tuiles qui font les
 * bosses.
 */
function profil(
  pixels: Uint8ClampedArray,
  largeur: number,
  boite: Boite,
  vertical: boolean,
  gains: [number, number, number],
): number[] {
  const debut = vertical ? boite.y0 : boite.x0
  const fin = vertical ? boite.y1 : boite.x1
  const autre0 = vertical ? boite.x0 : boite.y0
  const autre1 = vertical ? boite.x1 : boite.y1
  const out: number[] = []
  for (let i = debut; i <= fin; i++) {
    let somme = 0
    let n = 0
    for (let j = autre0; j <= autre1; j += PAS_PROFIL) {
      const x = vertical ? j : i
      const y = vertical ? i : j
      somme += saturation(pixels, (y * largeur + x) * 4, gains)
      n++
    }
    out.push(n ? somme / n : 0)
  }
  return out
}

interface Calage {
  debut: number
  longueur: number
  /** Écart entre les bosses et les creux : la netteté du calage. */
  contraste: number
}

/**
 * Cale la géométrie du plateau sur le profil : les barres doivent tomber dans
 * les creux, les emplacements sur les bosses. On cherche le début et la
 * longueur de la GRILLE NOIRE — pas de la boîte, qui contient le cadre.
 *
 * C'est le cadre, justement, qui rend le calage sûr : plein et sans structure,
 * il ne peut pas imiter une alternance régulière.
 */
function caler(prof: number[], taille: number): Calage | null {
  const n = prof.length
  if (n < taille * 10) return null
  const { quarts, barres } = geometrie(taille)
  let meilleur: Calage | null = null
  for (let longueur = n * 0.55; longueur <= n * 1.02; longueur += Math.max(1, n / 220)) {
    for (let debut = -0.02 * n; debut + longueur <= n * 1.02; debut += Math.max(1, n / 260)) {
      let creux = 0
      let nCreux = 0
      let bosses = 0
      let nBosses = 0
      for (const b of barres) {
        const i = Math.round(debut + b * longueur)
        if (i < 0 || i >= n) continue
        creux += prof[i]
        nCreux++
      }
      for (const q of quarts) {
        const i = Math.round(debut + q * longueur)
        if (i < 0 || i >= n) continue
        bosses += prof[i]
        nBosses++
      }
      if (nCreux < barres.length || nBosses < quarts.length) continue
      const contraste = bosses / nBosses - creux / nCreux
      if (!meilleur || contraste > meilleur.contraste) meilleur = { debut, longueur, contraste }
    }
  }
  return meilleur
}

/** Pas de l'affinage, en part du côté du damier. */
const PAS_AFFINAGE = [0.03, 0.015, 0.007, 0.0035]
/** Les huit directions d'un coin. */
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Descente locale : d'abord le repère entier, puis chaque coin séparément. */
function affiner(
  depart: Point[],
  unite: number,
  juger: (c: Point[]) => number,
): Detection {
  let coins = depart
  let score = juger(coins)
  for (const part of PAS_AFFINAGE) {
    const d = part * unite
    let bouge = true
    let tours = 0
    while (bouge && tours++ < 4) {
      bouge = false
      // Déplacer et redimensionner le repère entier : ça rattrape en un coup
      // une erreur commune aux quatre coins.
      const cx = coins.reduce((s, p) => s + p.x, 0) / 4
      const cy = coins.reduce((s, p) => s + p.y, 0) / 4
      const globaux: Point[][] = []
      for (const [ux, uy] of DIRECTIONS)
        globaux.push(coins.map((p) => ({ x: p.x + ux * d, y: p.y + uy * d })))
      for (const f of [1 - part, 1 + part])
        globaux.push(coins.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })))
      for (const essai of globaux) {
        const q = juger(essai)
        if (q < score - 0.01) {
          score = q
          coins = essai
          bouge = true
        }
      }
      for (let i = 0; i < 4; i++) {
        for (const [ux, uy] of DIRECTIONS) {
          const essai = coins.map((p, k) => (k === i ? { x: p.x + ux * d, y: p.y + uy * d } : p))
          const q = juger(essai)
          if (q < score - 0.01) {
            score = q
            coins = essai
            bouge = true
          }
        }
      }
    }
  }
  return { coins, qualite: score }
}

/**
 * Cale des coins posés à la main sur la grille du plateau. C'est la descente
 * locale seule, sans recherche globale : partie d'un cadrage à peu près juste,
 * elle converge très bien — c'est la recherche du point de départ qui est
 * difficile, pas l'ajustement.
 */
export function calerCoins(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  coins: readonly Point[],
  taille: number,
): Detection {
  const cote = Math.max(
    Math.hypot(coins[1].x - coins[0].x, coins[1].y - coins[0].y),
    Math.hypot(coins[3].x - coins[0].x, coins[3].y - coins[0].y),
  )
  return affiner([...coins], cote, (c) => qualiteDuRepere(pixels, largeur, hauteur, c, taille))
}

/**
 * Cherche le plateau dans la photo et rend les quatre coins extérieurs de sa
 * grille noire. `null` si rien ne ressemble à un plateau — l'écran laisse
 * alors poser les coins à la main.
 */
export function detecterPlateau(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  taille: number,
): Detection | null {
  const gains = egaliser(pixels, largeur, hauteur)
  const boite = boiteColoree(pixels, largeur, hauteur, gains)
  if (!boite) return null
  if (boite.x1 - boite.x0 < largeur * 0.08 || boite.y1 - boite.y0 < hauteur * 0.08) return null

  const cx = caler(profil(pixels, largeur, boite, false, gains), taille)
  const cy = caler(profil(pixels, largeur, boite, true, gains), taille)

  const departs: Point[][] = []
  if (cx && cy) {
    const x0 = boite.x0 + cx.debut
    const y0 = boite.y0 + cy.debut
    departs.push([
      { x: x0, y: y0 },
      { x: x0 + cx.longueur, y: y0 },
      { x: x0 + cx.longueur, y: y0 + cy.longueur },
      { x: x0, y: y0 + cy.longueur },
    ])
  }
  // Secours : la boîte elle-même. Utile si le calage n'a rien trouvé.
  departs.push([
    { x: boite.x0, y: boite.y0 },
    { x: boite.x1, y: boite.y0 },
    { x: boite.x1, y: boite.y1 },
    { x: boite.x0, y: boite.y1 },
  ])

  const unite = Math.max(boite.x1 - boite.x0, boite.y1 - boite.y0)
  const juger = (coins: Point[]) => qualiteDuRepere(pixels, largeur, hauteur, coins, taille)
  let meilleur: Detection | null = null
  for (const depart of departs) {
    const r = affiner(depart, unite, juger)
    if (!meilleur || r.qualite < meilleur.qualite) meilleur = r
  }
  return meilleur
}
