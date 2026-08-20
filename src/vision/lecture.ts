/**
 * Lecture d'un plateau photographié.
 *
 * Rien ici ne touche au navigateur : on reçoit des pixels bruts et on rend des
 * tuiles. C'est ce qui permet de mesurer la chaîne entière hors de l'écran,
 * sur des images fabriquées exprès.
 *
 * La chaîne, dans l'ordre :
 *   1. une homographie redresse la photo à partir des quatre coins du plateau ;
 *   2. chaque quart est échantillonné en son centre (médiane d'un petit carré,
 *      pour ignorer les interstices de la grille et les poussières) ;
 *   3. les 4N² mesures sont recalées globalement sur la palette connue —
 *      c'est cette étape qui absorbe la dominante d'une lampe jaune ;
 *   4. chaque carré de quatre quarts est comparé aux 388 motifs réellement
 *      imprimés (97 tuiles × 4 rotations) ;
 *   5. une passe globale impose que les tuiles soient toutes différentes.
 *
 * Une précision honnête sur l'étape 4 : le catalogue n'est PAS un code
 * correcteur. Sur les 340 motifs distincts, 332 ont un sosie à un seul quart
 * près. La reconnaissance ne rattrape donc presque rien — la précision vient
 * de l'optique et du recalage couleur, pas d'ici. D'où la marge de confiance
 * rendue avec chaque case : c'est elle qui dit à l'écran quoi faire vérifier.
 */

import { COLOR_HEX, TILE_COUNT, tileQuads } from '../engine/index.ts'
import type { Color, Rotation } from '../engine/index.ts'

export type Lab = readonly [number, number, number]

export interface Point {
  x: number
  y: number
}

/** Les huit couleurs imprimables d'un quart. */
export const PALETTE: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P', 'K', 'W']

// --------------------------------------------------------------------- couleur

function versLineaire(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** sRGB (0-255) vers CIE Lab, illuminant D65. */
export function rgbVersLab(r: number, g: number, b: number): Lab {
  const rl = versLineaire(r / 255)
  const gl = versLineaire(g / 255)
  const bl = versLineaire(b / 255)
  const X = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) / 0.95047
  const Y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
  const Z = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(X)
  const fy = f(Y)
  const fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexVersLab(hex: string): Lab {
  return rgbVersLab(
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  )
}

/** La palette du jeu, en Lab. Sa paire la plus proche est à ΔE 41,7. */
export const LAB_PALETTE: Record<Color, Lab> = Object.fromEntries(
  PALETTE.map((c) => [c, hexVersLab(COLOR_HEX[c])]),
) as Record<Color, Lab>

/** Distance perceptuelle (CIE76) : en dessous de ~20, deux couleurs se confondent. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Couleur de la palette la plus proche, et sa distance. */
export function plusProche(l: Lab): { couleur: Color; distance: number } {
  let couleur: Color = 'K'
  let distance = Infinity
  for (const c of PALETTE) {
    const d = deltaE(l, LAB_PALETTE[c])
    if (d < distance) {
      distance = d
      couleur = c
    }
  }
  return { couleur, distance }
}

// ----------------------------------------------------------------- homographie

/** Les quatre coins du carré unité, dans l'ordre horaire depuis le haut-gauche. */
export const CARRE_UNITE: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

/**
 * Transformation projective qui envoie quatre points sur quatre autres.
 * Rend les huit coefficients [a…h] de
 *   x' = (a·x + b·y + c) / (g·x + h·y + 1)
 *   y' = (d·x + e·y + f) / (g·x + h·y + 1)
 * ou `null` si les quatre points sont alignés (système dégénéré).
 */
export function homographie4(source: readonly Point[], cible: readonly Point[]): number[] | null {
  const M: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = source[i]
    const { x: X, y: Y } = cible[i]
    M.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X])
    M.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y])
  }
  // Élimination de Gauss avec pivot partiel.
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let r = col + 1; r < 8; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    if (Math.abs(M[pivot][col]) < 1e-9) return null
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    const p = M[col][col]
    for (let c = col; c < 9; c++) M[col][c] /= p
    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (!f) continue
      for (let c = col; c < 9; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((ligne) => ligne[8])
}

/** L'homographie qui envoie le carré unité sur les quatre coins donnés. */
export function homographie(coins: readonly Point[]): number[] | null {
  return homographie4(CARRE_UNITE, coins)
}

/** Applique une homographie à un point. */
export function projeter(h: readonly number[], x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + 1
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }
}

// -------------------------------------------------------------- échantillonnage

/** Nombre de points de mesure par quart, sur chaque axe. */
const GRAIN = 5
/** Part de la largeur d'un quart réellement mesurée (le reste évite les bords). */
const FENETRE = 0.44

function mediane(v: number[]): number {
  const t = [...v].sort((a, b) => a - b)
  const m = t.length >> 1
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

/**
 * Mesure la couleur de chaque quart. Les coins sont donnés en pixels de
 * l'image, dans l'ordre horaire depuis le haut-gauche du damier de tuiles
 * (le cadre du plateau reste dehors).
 *
 * Rend (2·taille)² couleurs, rangées ligne par ligne dans la grille de quarts.
 */
export function echantillonner(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  coins: readonly Point[],
  taille: number,
): Lab[] | null {
  const h = homographie(coins)
  if (!h) return null
  const Q = taille * 2
  const pas = 1 / Q
  const out: Lab[] = []
  for (let qr = 0; qr < Q; qr++) {
    for (let qc = 0; qc < Q; qc++) {
      const rs: number[] = []
      const gs: number[] = []
      const bs: number[] = []
      for (let i = 0; i < GRAIN; i++) {
        for (let j = 0; j < GRAIN; j++) {
          // Point de mesure dans le carré unité, au centre du quart.
          const u = (qc + 0.5 + ((j / (GRAIN - 1)) - 0.5) * FENETRE) * pas
          const v = (qr + 0.5 + ((i / (GRAIN - 1)) - 0.5) * FENETRE) * pas
          const p = projeter(h, u, v)
          const px = Math.round(p.x)
          const py = Math.round(p.y)
          if (px < 0 || py < 0 || px >= largeur || py >= hauteur) continue
          const k = (py * largeur + px) * 4
          rs.push(pixels[k])
          gs.push(pixels[k + 1])
          bs.push(pixels[k + 2])
        }
      }
      // Un quart entièrement hors cadre : on le déclare blanc, la suite
      // le traitera comme un emplacement vide.
      if (!rs.length) out.push(LAB_PALETTE.W)
      else out.push(rgbVersLab(mediane(rs), mediane(gs), mediane(bs)))
    }
  }
  return out
}

// ------------------------------------------------------------- recalage couleur

/** Bornes du gain admissible : au-delà, c'est que le recalage part en vrille. */
const GAIN_MIN = 0.4
const GAIN_MAX = 2.5
/** Part des mesures gardées pour l'ajustement (les pires sont des reflets). */
const PART_GARDEE = 0.85

function ajuster(mesures: number[], cibles: number[]): [number, number] {
  const n = mesures.length
  if (n < 2) return [1, 0]
  const mm = mesures.reduce((s, v) => s + v, 0) / n
  const mc = cibles.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (mesures[i] - mm) * (cibles[i] - mc)
    den += (mesures[i] - mm) ** 2
  }
  if (den < 1e-6) return [1, mc - mm]
  const gain = Math.min(GAIN_MAX, Math.max(GAIN_MIN, num / den))
  return [gain, mc - gain * mm]
}

/**
 * Recale les mesures sur la palette connue. Une dominante de couleur est
 * SYSTÉMATIQUE — une lampe chaude décale tout dans le même sens — donc elle
 * s'enlève. Le bruit aléatoire, lui, ne s'enlève pas : c'est là que la lecture
 * se joue.
 *
 * On alterne « à quelle couleur ressemble chaque mesure » et « quel gain
 * rapproche le plus les mesures de ces couleurs », en jetant à chaque tour les
 * 15 % de mesures les plus rétives (reflets, ombres portées).
 */
export function recaler(labs: readonly Lab[]): { labs: Lab[]; residu: number; applique: boolean } {
  const brut = labs.map((l) => l)
  const residuDe = (v: readonly Lab[]) =>
    v.reduce((s, l) => s + plusProche(l).distance, 0) / Math.max(1, v.length)
  const depart = residuDe(brut)

  let gain: [number, number, number] = [1, 1, 1]
  let biais: [number, number, number] = [0, 0, 0]
  let meilleur = { gain, biais, residu: depart }

  for (let tour = 0; tour < 12; tour++) {
    const corrige = brut.map(
      (l): Lab => [
        gain[0] * l[0] + biais[0],
        gain[1] * l[1] + biais[1],
        gain[2] * l[2] + biais[2],
      ],
    )
    const paires = corrige
      .map((l, i) => ({ i, cible: LAB_PALETTE[plusProche(l).couleur], d: plusProche(l).distance }))
      .sort((a, b) => a.d - b.d)
    const gardees = paires.slice(0, Math.max(4, Math.round(paires.length * PART_GARDEE)))

    const suivantG: [number, number, number] = [1, 1, 1]
    const suivantB: [number, number, number] = [0, 0, 0]
    for (const canal of [0, 1, 2] as const) {
      const [g, b] = ajuster(
        gardees.map((p) => brut[p.i][canal]),
        gardees.map((p) => p.cible[canal]),
      )
      suivantG[canal] = g
      suivantB[canal] = b
    }
    gain = suivantG
    biais = suivantB
    const residu = residuDe(
      brut.map((l): Lab => [
        gain[0] * l[0] + biais[0],
        gain[1] * l[1] + biais[1],
        gain[2] * l[2] + biais[2],
      ]),
    )
    if (residu < meilleur.residu - 1e-6) meilleur = { gain, biais, residu }
    else break
  }

  // Le recalage doit AMÉLIORER la lecture, sinon on garde la photo telle quelle.
  if (meilleur.residu >= depart) return { labs: brut, residu: depart, applique: false }
  const { gain: g, biais: b } = meilleur
  return {
    labs: brut.map((l): Lab => [g[0] * l[0] + b[0], g[1] * l[1] + b[1], g[2] * l[2] + b[2]]),
    residu: meilleur.residu,
    applique: true,
  }
}

// ------------------------------------------------------------- reconnaissance

export interface Candidat {
  tileId: number
  rot: Rotation
  /** Somme des quatre distances de couleur : plus c'est bas, mieux ça colle. */
  cout: number
}

export interface CaseLue {
  /** Emplacement resté vide sur le plateau (les quatre quarts sont blancs). */
  vide: boolean
  tileId: number
  rot: Rotation
  /**
   * Somme des quatre écarts de couleur de la tuile retenue. C'est LE signal de
   * confiance : mesuré sur 4 000 cases, signaler les cases au-dessus de 60
   * revient à en montrer 11 % et à attraper 92 % des erreurs.
   */
  cout: number
  /**
   * Écart au meilleur concurrent d'une AUTRE tuile. Utile à afficher, mais
   * mauvais détecteur d'erreur : il mesure surtout le nombre de sosies de la
   * tuile dans le catalogue, pas la qualité de la photo.
   */
  marge: number
  /** Les meilleurs candidats, du plus probable au moins probable. */
  candidats: Candidat[]
  /** Les quatre couleurs lues, telles quelles. */
  lues: Color[]
}

interface Motif {
  tileId: number
  rot: Rotation
  labs: Lab[]
}

let MOTIFS: Motif[] | null = null

/** Les 388 motifs réellement imprimés : 97 tuiles de la boîte × 4 rotations. */
function motifs(): Motif[] {
  if (MOTIFS) return MOTIFS
  const out: Motif[] = []
  for (let id = 0; id < TILE_COUNT; id++) {
    for (let r = 0; r < 4; r++) {
      const rot = r as Rotation
      out.push({
        tileId: id,
        rot,
        labs: [...tileQuads(id, rot)].map((c) => LAB_PALETTE[c]),
      })
    }
  }
  MOTIFS = out
  return out
}

/** Nombre de candidats gardés par case, pour la correction à la main. */
const CANDIDATS_GARDES = 8

/**
 * Retrouve les tuiles à partir des couleurs lues. `taille` est le côté du
 * plateau en tuiles ; `labs` en contient (2·taille)².
 */
export function reconnaitre(labs: readonly Lab[], taille: number): CaseLue[] {
  const Q = taille * 2
  const cases: CaseLue[] = []
  for (let cell = 0; cell < taille * taille; cell++) {
    const ligne = Math.floor(cell / taille)
    const col = cell % taille
    // Les quarts d'une tuile, dans l'ordre horaire depuis le haut-gauche.
    const q = [
      labs[2 * ligne * Q + 2 * col],
      labs[2 * ligne * Q + 2 * col + 1],
      labs[(2 * ligne + 1) * Q + 2 * col + 1],
      labs[(2 * ligne + 1) * Q + 2 * col],
    ]
    const classes = motifs()
      .map((m) => ({
        tileId: m.tileId,
        rot: m.rot,
        cout: q.reduce((s, l, k) => s + deltaE(l, m.labs[k]), 0),
      }))
      .sort((a, b) => a.cout - b.cout)
    const meilleur = classes[0]
    const concurrent = classes.find((c) => c.tileId !== meilleur.tileId)
    // Un emplacement vide est blanc : si le blanc explique mieux les quatre
    // quarts que la meilleure tuile, c'est qu'il n'y a pas de tuile.
    const coutVide = q.reduce((s, l) => s + deltaE(l, LAB_PALETTE.W), 0)
    cases.push({
      vide: coutVide < meilleur.cout,
      tileId: meilleur.tileId,
      rot: meilleur.rot,
      cout: meilleur.cout,
      marge: (concurrent ? concurrent.cout : meilleur.cout + 999) - meilleur.cout,
      candidats: classes.slice(0, CANDIDATS_GARDES),
      lues: q.map((l) => plusProche(l).couleur),
    })
  }
  return departager(cases)
}

/**
 * Passe globale : les tuiles d'un plateau viennent toutes du même sac, elles
 * sont donc toutes différentes. On sert d'abord les cases les mieux ajustées ;
 * celles qui collent mal se contentent de ce qui reste.
 *
 * Le gain est modeste — le catalogue offre trop de sosies pour que ça sauve
 * une lecture. C'est une consolidation, pas un filet.
 */
function departager(cases: CaseLue[]): CaseLue[] {
  const pris = new Set<number>()
  const ordre = cases
    .map((c, i) => ({ i, cout: c.vide ? Infinity : c.cout }))
    .sort((a, b) => a.cout - b.cout)
  const out = cases.map((c) => ({ ...c }))
  for (const { i } of ordre) {
    if (out[i].vide) continue
    const libre = out[i].candidats.find((c) => !pris.has(c.tileId))
    if (!libre) continue
    pris.add(libre.tileId)
    const concurrent = out[i].candidats.find((c) => c.tileId !== libre.tileId)
    out[i].tileId = libre.tileId
    out[i].rot = libre.rot
    out[i].cout = libre.cout
    out[i].marge = (concurrent ? concurrent.cout : libre.cout + 999) - libre.cout
  }
  return out
}

// -------------------------------------------------------------------- lecture

export interface Lecture {
  cases: CaseLue[]
  /** Écart moyen à la palette après recalage : la qualité de la photo, en ΔE. */
  residu: number
  recale: boolean
}

/**
 * Au-dessus de ce coût — soit 15 ΔE d'écart moyen par quart — la case mérite
 * un coup d'œil. Seuil calibré sur 4 000 cases photographiées dans cinq
 * conditions de lumière : 11 % des cases signalées, 92 % des erreurs dedans.
 */
export const COUT_DOUTEUX = 60

/** Cette case demande-t-elle une vérification à l'œil ? */
export function douteuse(c: CaseLue): boolean {
  return !c.vide && c.cout > COUT_DOUTEUX
}

/** La chaîne complète, des pixels aux tuiles. */
export function lire(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
  coins: readonly Point[],
  taille: number,
): Lecture | null {
  const mesures = echantillonner(pixels, largeur, hauteur, coins, taille)
  if (!mesures) return null
  const { labs, residu, applique } = recaler(mesures)
  return { cases: reconnaitre(labs, taille), residu, recale: applique }
}
