/**
 * Fabrique une fausse photo de plateau.
 *
 * Elle sert à deux choses : essayer la lecture sans avoir de plateau imprimé
 * sous la main, et surtout vérifier la chaîne complète — on connaît la vérité,
 * on peut donc compter les erreurs au lieu de les deviner.
 *
 * La déformation, la dominante chaude et le bruit sont volontaires : une photo
 * propre ne prouve rien.
 */

import { TILE_COUNT, tileQuads, COLOR_HEX } from '../engine/index.ts'
import type { Rotation } from '../engine/index.ts'
import { CARRE_UNITE, homographie4, projeter } from './lecture.ts'
import type { Point } from './lecture.ts'

/** Pas d'une case à l'autre sur le plateau dessiné, en pixels. */
const PAS = 120
/** Jeu gris entre deux tuiles. */
const JEU = 10

export interface PoseVraie {
  tileId: number
  rot: Rotation
}

export interface Exemple {
  url: string
  largeur: number
  hauteur: number
  /** Les quatre coins du damier dans l'image, prêts à être proposés à l'écran. */
  coins: Point[]
  /** Ce qui a réellement été posé : de quoi compter les erreurs de lecture. */
  verite: PoseVraie[]
}

export interface OptionsExemple {
  taille?: number
  graine?: number
  /** Dominante de la lumière, en gains R/V/B. Par défaut : lampe chaude. */
  dominante?: [number, number, number]
  /** Bruit ajouté par canal, en niveaux (0-255). */
  bruit?: number
  /** Force de la perspective, de 0 (plateau bien à plat) à 1. */
  biais?: number
}

/** Générateur reproductible : une même graine donne toujours la même photo. */
function alea(graine: number): () => number {
  let s = graine >>> 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/** Le damier net, sans photo ni déformation. */
function dessinerPlateau(taille: number, verite: PoseVraie[]): HTMLCanvasElement {
  const cote = taille * PAS - JEU
  const c = document.createElement('canvas')
  c.width = cote
  c.height = cote
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.fillStyle = '#A7A9AC'
  ctx.fillRect(0, 0, cote, cote)
  const largeurTuile = PAS - JEU
  for (let i = 0; i < verite.length; i++) {
    const x = (i % taille) * PAS
    const y = Math.floor(i / taille) * PAS
    const quarts = tileQuads(verite[i].tileId, verite[i].rot)
    const demi = largeurTuile / 2
    // Ordre horaire depuis le haut-gauche.
    const coins = [
      [0, 0],
      [demi, 0],
      [demi, demi],
      [0, demi],
    ]
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = COLOR_HEX[quarts[k]]
      ctx.fillRect(x + coins[k][0], y + coins[k][1], demi, demi)
    }
  }
  return c
}

/**
 * Photographie le damier : perspective, table en fond, lumière chaude, bruit.
 * Le tirage se fait pixel par pixel — c'est le seul moyen d'avoir une vraie
 * homographie, `drawImage` ne sait faire que de l'affine.
 */
export function plateauExemple(options: OptionsExemple = {}): Exemple {
  const taille = options.taille ?? 4
  const rnd = alea(options.graine ?? 20260820)
  const dominante = options.dominante ?? [1.09, 1.0, 0.8]
  const bruit = options.bruit ?? 6
  const biais = options.biais ?? 0.6

  // Un plateau plausible : des tuiles toutes différentes, orientées au hasard.
  const dispo = Array.from({ length: TILE_COUNT }, (_, i) => i)
  const verite: PoseVraie[] = []
  for (let i = 0; i < taille * taille; i++) {
    const k = Math.floor(rnd() * dispo.length)
    verite.push({ tileId: dispo.splice(k, 1)[0], rot: Math.floor(rnd() * 4) as Rotation })
  }

  const net = dessinerPlateau(taille, verite)
  const largeur = 900
  const hauteur = 720
  const photo = document.createElement('canvas')
  photo.width = largeur
  photo.height = hauteur
  const ctx = photo.getContext('2d')
  if (!ctx) return { url: '', largeur, hauteur, coins: [], verite }

  // Où atterrissent les quatre coins du damier : un plateau vu de trois quarts.
  const g = (amplitude: number) => (rnd() - 0.5) * 2 * amplitude * biais
  const coins: Point[] = [
    { x: 118 + g(40), y: 96 + g(30) },
    { x: 786 + g(40), y: 138 + g(30) },
    { x: 742 + g(40), y: 660 + g(30) },
    { x: 160 + g(40), y: 620 + g(30) },
  ]

  const source = net.getContext('2d')?.getImageData(0, 0, net.width, net.height)
  const sortie = ctx.createImageData(largeur, hauteur)
  const versUnite = homographie4(coins, CARRE_UNITE)
  if (!source || !versUnite) return { url: '', largeur, hauteur, coins, verite }

  const gauss = () => {
    let u = 0
    let v = 0
    while (!u) u = rnd()
    while (!v) v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const p = projeter(versUnite, x + 0.5, y + 0.5)
      let r: number
      let vt: number
      let b: number
      if (p.x < 0 || p.y < 0 || p.x >= 1 || p.y >= 1) {
        // La table autour du plateau : un bois clair, légèrement dégradé.
        const t = y / hauteur
        r = 226 - 26 * t
        vt = 208 - 26 * t
        b = 178 - 24 * t
      } else {
        const sx = Math.min(source.width - 1, Math.floor(p.x * source.width))
        const sy = Math.min(source.height - 1, Math.floor(p.y * source.height))
        const k = (sy * source.width + sx) * 4
        r = source.data[k]
        vt = source.data[k + 1]
        b = source.data[k + 2]
      }
      // Lumière chaude, léger assombrissement des bords, grain du capteur.
      const dx = (x / largeur - 0.5) * 2
      const dy = (y / hauteur - 0.5) * 2
      const vignette = 1 - 0.16 * (dx * dx + dy * dy)
      const k = (y * largeur + x) * 4
      sortie.data[k] = Math.max(0, Math.min(255, r * dominante[0] * vignette + gauss() * bruit))
      sortie.data[k + 1] = Math.max(0, Math.min(255, vt * dominante[1] * vignette + gauss() * bruit))
      sortie.data[k + 2] = Math.max(0, Math.min(255, b * dominante[2] * vignette + gauss() * bruit))
      sortie.data[k + 3] = 255
    }
  }
  ctx.putImageData(sortie, 0, 0)
  // On rend l'image compressée, pas les pixels d'origine : la lecture doit
  // affronter le même JPEG qu'une vraie photo, sinon la démonstration triche.
  return { url: photo.toDataURL('image/jpeg', 0.88), largeur, hauteur, coins, verite }
}
