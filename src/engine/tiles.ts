/**
 * Les 97 tuiles officielles de CAMINO, extraites de la planche d'impression
 * (Les_tuiles_CAMINO.pdf) puis vérifiées : 55 quarts de chaque couleur et
 * 58 quarts noirs, soit 97 x 4 = 388 quarts.
 *
 * Notation : 4 lettres dans l'ordre HORAIRE en partant du haut-gauche
 * (haut-gauche, haut-droite, bas-droite, bas-gauche).
 * Y=jaune O=orange R=rouge G=vert B=bleu P=violet K=noir
 */
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

export const TILES: Tile[] = RAW.map((s, id) => ({
  id,
  quads: s.split('') as unknown as Quads,
}))

export const TILE_COUNT = TILES.length

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

export function tileQuads(tileId: number, rot: Rotation): Quads {
  return rotatedQuads(TILES[tileId].quads, rot)
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
