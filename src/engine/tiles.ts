/**
 * Les 97 tuiles officielles de CAMINO, extraites de la planche d'impression
 * (Les_tuiles_CAMINO.pdf) puis vérifiées : 55 quarts de chaque couleur et
 * 58 quarts noirs, soit 97 x 4 = 388 quarts.
 *
 * Notation : 4 lettres dans l'ordre HORAIRE en partant du haut-gauche
 * (haut-gauche, haut-droite, bas-droite, bas-gauche).
 * Y=jaune O=orange R=rouge G=vert B=bleu P=violet K=noir
 */
import { Rng } from './rng.ts'
import type { Color, Quads, Rotation, Tile } from './types.ts'

const RAW: string[] = [
  'YOOY', 'YRRY', 'YGGY', 'YBBY', 'YPPY', // 0
  'ORRO', 'OGGO', 'OBBO', 'OPPO', 'RGGR', // 5
  'RBBR', 'RPPR', 'GBBG', 'GPPG', 'BPPB', // 10
  'YKKY', 'OKKO', 'RKKR', 'GKKG', 'BKKB', // 15
  'PKKP', 'KRPK', 'KRPK', 'KGYK', 'KGYK', // 20
  'KBOK', 'KBOK', 'KYGK', 'KYGK', 'KOBK', // 25
  'KOBK', 'KPRK', 'KPRK', 'RKRR', 'RKRR', // 30
  'PKPP', 'PKPP', 'OKOO', 'OKOO', 'BKBB', // 35
  'BKBB', 'GKGG', 'GKGG', 'YKYY', 'YKYY', // 40
  'YROY', 'YGRY', 'YBGY', 'YPBY', 'YOPY', // 45
  'OGBO', 'OBPO', 'OPYO', 'OYRO', 'ORGO', // 50
  'RYPR', 'ROYR', 'RGOR', 'RBGR', 'RPBR', // 55
  'BPYB', 'BYOB', 'BORB', 'BRGB', 'BGPB', // 60
  'GOYG', 'GBRG', 'GROG', 'GPBG', 'GYPG', // 65
  'POGP', 'PRBP', 'PGYP', 'PYRP', 'PBOP', // 70
  'YYPY', 'PPOP', 'OOBO', 'BBRB', 'RRGR', // 75
  'GGYG', 'RKYR', 'YKRY', 'YRKO', 'RBKG', // 80
  'GKOG', 'BKPB', 'PKBP', 'GPKB', 'POKY', // 85
  'OKGO', 'OROG', 'RGRY', 'GYGP', 'YPYB', // 90
  'PBPO', 'BOBR', // 95
]

/**
 * Tuiles de variantes, à la suite des 97 de base :
 *  - 97..108 : 12 tuiles monochromes (2 par couleur) ;
 *  - 109..114 : 6 tuiles blanches jokers.
 * Elles n'entrent dans le sac que si la variante correspondante est active.
 */
const MONO: string[] = ['Y', 'O', 'R', 'G', 'B', 'P'].flatMap((c) => [c.repeat(4), c.repeat(4)])
/**
 * Tuiles arc-en-ciel (variante) : la tuile entière est UN SEUL grand carré
 * irisé — un joker qui rejoint les chemins de toutes les couleurs voisines.
 * Ses quatre quarts sont irisés, mais l'affichage les dessine d'un seul tenant.
 */
const WHITES: string[] = Array.from({ length: 6 }, () => 'WWWW')

/**
 * Tuiles de départ multicolores (variante) : quatre couleurs différentes sur
 * une même tuile. La partie en tire une, la même pour tous les joueurs.
 */
const MULTI_STARTS: string[] = (() => {
  const rng = new Rng('camino-departs-multicolores')
  const palette = ['Y', 'O', 'R', 'G', 'B', 'P']
  return Array.from({ length: 6 }, () => rng.shuffle([...palette]).slice(0, 4).join(''))
})()
/**
 * Six tuiles monochromes hors sac : elles servent de tuile de départ (à la
 * couleur du plateau) et de marqueur de couleur secrète. Elles ne sont jamais
 * mélangées à la pioche.
 */
const COLOR_MARKERS: string[] = ['Y', 'O', 'R', 'G', 'B', 'P'].map((c) => c.repeat(4))

export const TILES: Tile[] = [
  ...RAW,
  ...MONO,
  ...WHITES,
  ...COLOR_MARKERS,
  ...MULTI_STARTS,
].map((s, id) => ({
  id,
  quads: s.split('') as unknown as Quads,
}))

/** Nombre de tuiles de la boîte de base (hors variantes). */
export const TILE_COUNT = RAW.length
export const MONO_TILE_IDS = MONO.map((_, i) => RAW.length + i)
export const WHITE_TILE_IDS = WHITES.map((_, i) => RAW.length + MONO.length + i)
/** Tuile monochrome de chaque couleur (départ, couleur secrète). Hors sac. */
export const COLOR_TILE_IDS: Record<string, number> = Object.fromEntries(
  ['Y', 'O', 'R', 'G', 'B', 'P'].map((c, i) => [
    c,
    RAW.length + MONO.length + WHITES.length + i,
  ]),
)
/** Les six tuiles de départ multicolores. Hors sac elles aussi. */
export const MULTI_START_TILE_IDS = MULTI_STARTS.map(
  (_, i) => RAW.length + MONO.length + WHITES.length + COLOR_MARKERS.length + i,
)

/** Quarts d'une tuile après rotation horaire de `rot` x 90°. */
export function rotatedQuads(quads: Quads, rot: Rotation): Quads {
  if (rot === 0) return quads
  const r = rot & 3
  return [
    quads[(0 - r + 4) % 4],
    quads[(1 - r + 4) % 4],
    quads[(2 - r + 4) % 4],
    quads[(3 - r + 4) % 4],
  ] as unknown as Quads
}

/** Face miroir : inversion gauche-droite (HG↔HD, BG↔BD). */
export function mirroredQuads(quads: Quads): Quads {
  return [quads[1], quads[0], quads[3], quads[2]] as unknown as Quads
}

export function tileQuads(tileId: number, rot: Rotation, flipped = false): Quads {
  const base = flipped ? mirroredQuads(TILES[tileId].quads) : TILES[tileId].quads
  return rotatedQuads(base, rot)
}

export interface Orientation {
  rot: Rotation
  flipped: boolean
}

/** Orientations réellement distinctes, faces miroir comprises si permises. */
export function distinctOrientations(tileId: number, allowFlip: boolean): Orientation[] {
  const seen = new Set<string>()
  const out: Orientation[] = []
  for (const flipped of allowFlip ? [false, true] : [false]) {
    for (const rot of [0, 1, 2, 3] as Rotation[]) {
      const key = tileQuads(tileId, rot, flipped).join('')
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ rot, flipped })
      }
    }
  }
  return out
}

/** Orientations réellement distinctes (une tuile unie n'en a qu'une). */
export function distinctRotations(tileId: number): Rotation[] {
  const base = TILES[tileId].quads
  const seen = new Set<string>()
  const out: Rotation[] = []
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const key = rotatedQuads(base, rot).join('')
    if (!seen.has(key)) {
      seen.add(key)
      out.push(rot)
    }
  }
  return out
}

/** Répartition des couleurs dans une tuile (utile pour les stats). */
export function tileColorCount(tileId: number): Partial<Record<Color, number>> {
  const out: Partial<Record<Color, number>> = {}
  for (const q of TILES[tileId].quads) out[q] = (out[q] ?? 0) + 1
  return out
}

// ---------------------------------------------------------------------------
// Étoiles magiques (variante) : 30 tuiles de la boîte portent une étoile dans
// un de leurs quarts — jamais un quart noir, et 75 % d'entre elles sur des
// tuiles qui contiennent du noir. L'attribution est fixe (tuiles imprimées).
// ---------------------------------------------------------------------------

/** quart étoilé (0..3, avant rotation) par id de tuile. */
export const STARS: ReadonlyMap<number, number> = (() => {
  const rng = new Rng('camino-etoiles-magiques')
  const withBlack: number[] = []
  const without: number[] = []
  for (let id = 0; id < TILE_COUNT; id++) {
    const quads = TILES[id].quads
    if (quads.every((q) => q === 'K')) continue // aucune case possible
    ;(quads.includes('K') ? withBlack : without).push(id)
  }
  const target = 30
  const nBlack = Math.min(withBlack.length, Math.round(target * 0.75))
  const picked = [
    ...rng.shuffle(withBlack).slice(0, nBlack),
    ...rng.shuffle(without).slice(0, target - nBlack),
  ]
  const map = new Map<number, number>()
  for (const id of picked) {
    const options = [0, 1, 2, 3].filter((q) => TILES[id].quads[q] !== 'K')
    map.set(id, options[rng.int(options.length)])
  }
  return map
})()

/** Position du quart étoilé après orientation (0..3 dans la tuile posée). */
export function starQuadIndex(tileId: number, rot: Rotation, flipped = false): number | null {
  const base = STARS.get(tileId)
  if (base === undefined) return null
  const FLIP: number[] = [1, 0, 3, 2]
  const afterFlip = flipped ? FLIP[base] : base
  return (afterFlip + rot) % 4
}

// ---------------------------------------------------------------------------
// Failles (variante) : 16 tuiles portent une faille grise en leur milieu. Les
// deux moitiés qu'elle sépare ne se relient PAS entre elles ; chacune se relie
// normalement aux tuiles voisines. L'attribution est fixe (tuiles imprimées).
// ---------------------------------------------------------------------------

/** Axe de la faille : 0 = verticale (sépare gauche/droite), 1 = horizontale. */
export const FAULTS: ReadonlyMap<number, 0 | 1> = (() => {
  const rng = new Rng('camino-failles')
  const map = new Map<number, 0 | 1>()
  // Une faille n'a d'intérêt que si les deux moitiés portent de la couleur.
  const candidates: number[] = []
  for (let id = 0; id < TILE_COUNT; id++) {
    if (TILES[id].quads.every((q) => q === 'K')) continue
    candidates.push(id)
  }
  for (const id of rng.shuffle(candidates).slice(0, 16)) {
    map.set(id, rng.int(2) as 0 | 1)
  }
  return map
})()

/**
 * Axe de la faille après orientation. Une rotation d'un quart de tour bascule
 * la verticale en horizontale ; le miroir (gauche-droite) ne change rien.
 */
export function faultAxis(tileId: number, rot: Rotation, _flipped = false): 0 | 1 | null {
  const base = FAULTS.get(tileId)
  if (base === undefined) return null
  return ((base + rot) % 2) as 0 | 1
}

// ---------------------------------------------------------------------------
// Trèfles (variante) : un quart sur quatre des tuiles porte un trèfle, jamais
// sur un quart noir, et jamais sur une tuile déjà étoilée : une tuile ne porte
// qu'une seule de ces deux marques.
// Dans un chemin qui marque le trèfle rapporte +3, sinon il coûte 3.
// ---------------------------------------------------------------------------

/** quart trèflé (0..3, avant rotation) par id de tuile. */
export const CLOVERS: ReadonlyMap<number, number> = (() => {
  const rng = new Rng('camino-trefles')
  const candidates: number[] = []
  for (let id = 0; id < TILE_COUNT; id++) {
    if (TILES[id].quads.every((q) => q === 'K')) continue
    // Jamais sur une tuile étoilée : deux marques sur une même tuile se
    // marcheraient dessus, et sur un même quart c'est illisible.
    if (STARS.has(id)) continue
    candidates.push(id)
  }
  const map = new Map<number, number>()
  for (const id of rng.shuffle(candidates).slice(0, Math.round(TILE_COUNT * 0.25))) {
    const options = [0, 1, 2, 3].filter((q) => TILES[id].quads[q] !== 'K')
    map.set(id, options[rng.int(options.length)])
  }
  return map
})()

/** Position du quart trèflé après orientation (0..3 dans la tuile posée). */
export function cloverQuadIndex(tileId: number, rot: Rotation, flipped = false): number | null {
  const base = CLOVERS.get(tileId)
  if (base === undefined) return null
  const FLIP: number[] = [1, 0, 3, 2]
  const afterFlip = flipped ? FLIP[base] : base
  return (afterFlip + rot) % 4
}

// ---------------------------------------------------------------------------
// Cristaux (variante) : un cristal orne UN quart précis d'une tuile — comme
// une étoile ou un trèfle — et prend la couleur de ce quart. Ce quart est
// toujours SEUL de sa couleur sur sa tuile : le cristal ne peut donc se briser
// que par une tuile voisine. Il vaut +4 points s'il reste seul de sa couleur,
// −4 dès qu'un quart de la même couleur le touche. L'attribution est fixe
// (tuiles imprimées) : 18 tuiles, 3 par couleur.
// ---------------------------------------------------------------------------

/** quart cristallisé (0..3, avant rotation) par id de tuile. */
export const CRYSTALS: ReadonlyMap<number, number> = (() => {
  const rng = new Rng('camino-cristaux')
  const map = new Map<number, number>()
  const used = new Set<number>()
  const PATHS: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P']
  for (const color of PATHS) {
    // Le quart doit être seul de sa couleur sur la tuile — sinon le cristal
    // naîtrait brisé — et libre de toute autre marque, pour rester lisible.
    const quartDe = (id: number): number | null => {
      const quads = TILES[id].quads
      if (quads.filter((q) => q === color).length !== 1) return null
      const q = quads.indexOf(color)
      return STARS.get(id) === q || CLOVERS.get(id) === q ? null : q
    }
    const candidates = [...Array(TILE_COUNT).keys()].filter(
      (id) => !used.has(id) && quartDe(id) !== null,
    )
    for (const id of rng.shuffle(candidates).slice(0, 3)) {
      used.add(id)
      map.set(id, quartDe(id) as number)
    }
  }
  return map
})()

/** Quart cristallisé après orientation (0..3 dans la tuile posée). */
export function crystalQuadIndex(tileId: number, rot: Rotation, flipped = false): number | null {
  const base = CRYSTALS.get(tileId)
  if (base === undefined) return null
  const FLIP: number[] = [1, 0, 3, 2]
  return ((flipped ? FLIP[base] : base) + rot) % 4
}

// ---------------------------------------------------------------------------
// Teintures (variante) : un pot de couleur sur ~20 % des tuiles, 3 par couleur,
// toujours posé sur un quart d'une AUTRE couleur que la sienne. Si la tuile est
// posée avec la teinture adjacente à une zone noire, la zone prend la couleur
// de la teinture. L'attribution est fixe (tuiles imprimées).
// ---------------------------------------------------------------------------

export interface Dye {
  /** Quart qui porte le pot (0..3, avant rotation). */
  quad: number
  /** Couleur du pigment — jamais celle du quart qui le porte. */
  color: Color
}

export const DYES: ReadonlyMap<number, Dye> = (() => {
  const rng = new Rng('camino-teintures')
  const map = new Map<number, Dye>()
  const used = new Set<number>()
  const PATHS: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P']
  for (const color of PATHS) {
    // ni sur une tuile à cristal, ni sur un quart noir ou de la couleur du pot ;
    // on évite aussi les quarts déjà étoilés ou trèflés pour rester lisible.
    const candidates: number[] = []
    for (let id = 0; id < TILE_COUNT; id++) {
      if (used.has(id) || CRYSTALS.has(id)) continue
      const quads = TILES[id].quads
      if ([0, 1, 2, 3].some((q) => quads[q] !== 'K' && quads[q] !== color)) candidates.push(id)
    }
    for (const id of rng.shuffle(candidates).slice(0, 3)) {
      used.add(id)
      const quads = TILES[id].quads
      const libres = [0, 1, 2, 3].filter(
        (q) =>
          quads[q] !== 'K' && quads[q] !== color && STARS.get(id) !== q && CLOVERS.get(id) !== q,
      )
      const options = libres.length
        ? libres
        : [0, 1, 2, 3].filter((q) => quads[q] !== 'K' && quads[q] !== color)
      map.set(id, { quad: options[rng.int(options.length)], color })
    }
  }
  return map
})()

/** Teinture d'une tuile après orientation (quart 0..3 dans la tuile posée). */
export function dyeAt(tileId: number, rot: Rotation, flipped = false): Dye | null {
  const base = DYES.get(tileId)
  if (base === undefined) return null
  const FLIP: number[] = [1, 0, 3, 2]
  const afterFlip = flipped ? FLIP[base.quad] : base.quad
  return { quad: (afterFlip + rot) % 4, color: base.color }
}

// ---------------------------------------------------------------------------
// Moulins (variante) : 15 % des tuiles portent un moulin. À la pose, toutes
// les tuiles orthogonalement adjacentes DÉJÀ posées tournent d'un quart de
// tour vers la gauche. L'attribution est fixe (tuiles imprimées).
// ---------------------------------------------------------------------------

export const WINDMILLS: ReadonlySet<number> = (() => {
  const rng = new Rng('camino-moulins')
  // jamais sur une tuile à cristal ou à teinture : une seule mécanique par tuile
  const candidates: number[] = []
  for (let id = 0; id < TILE_COUNT; id++) {
    if (!CRYSTALS.has(id) && !DYES.has(id)) candidates.push(id)
  }
  return new Set(rng.shuffle(candidates).slice(0, 15))
})()
