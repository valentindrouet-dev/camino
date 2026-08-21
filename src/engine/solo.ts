/**
 * Mode solo : trois objectifs à atteindre, bronze, argent et or.
 *
 * Il n'y a pas d'adversaire — ce qu'on affronte, c'est un barème. Reste à
 * savoir où le poser, et ça ne se devine pas : une partie avec Arc-en-Ciel et
 * Cristaux marque vingt-cinq points de plus qu'une partie nue, une partie avec
 * Couleur interdite neuf de moins. Un barème fixe serait donné dans un cas et
 * hors de portée dans l'autre.
 *
 * D'où la construction : un socle mesuré sur la partie nue, et un écart mesuré
 * par variante et par carte, qu'on additionne. Tout ce qui suit vient de
 * parties réellement jouées par le bot Expert en solo — jamais d'une intuition.
 *
 * L'approximation assumée : on suppose que chaque variante décale la
 * distribution sans en changer la forme, et que deux variantes ajoutent leurs
 * écarts. C'est faux dans le détail — deux variantes qui poussent la même
 * chose se recouvrent en partie — d'où le tassement appliqué à la fin.
 */

import { CARDS } from './cards.ts'
import type { GameOptions, Variants } from './types.ts'

export interface ObjectifsSolo {
  bronze: number
  argent: number
  or: number
}

/**
 * Le socle : quantiles de ce que l'Expert obtient sur une partie solo nue,
 * plateau 4×4, deux tuiles révélées par manche. Bronze au premier quartile,
 * argent un peu au-dessus de la médiane, or au dernier décile.
 */
const SOCLE: ObjectifsSolo = { bronze: 29, argent: 37, or: 44 }

/**
 * Écart de score moyen apporté par chaque variante, mesuré sur 90 parties
 * chacune. Les variantes absentes de cette table ne changent rien en solo —
 * Dernière Aléatoire et Sac Antihoraire n'ont aucun sens sans voisin, la
 * Partie synchrone non plus.
 */
const VARIANTES: Partial<Record<keyof Variants, number>> = {
  balancedColors: 0,
  monoTiles: -0.3,
  personalTile: 4.6,
  mirrorTiles: 2.5,
  extraTile: 9,
  startTile: -0.2,
  coloredBorders: 3.3,
  quadBorders: 7.6,
  multiBorders: 16.7,
  magicStars: 3.7,
  clovers: 3.2,
  crystals: 10.7,
  windmills: -3.3,
  dyes: 6.5,
  faultTiles: -0.3,
  whiteTiles: 14.6,
  secretColor: 7.3,
  forbiddenColor: -8.9,
  reverseScoring: 5.5,
}

/** Pose Libre ne vit pas dans les variantes mais dans le barème. */
const POSE_LIBRE = 0.4

/**
 * Écart apporté par chaque carte mission, mesuré carte par carte. Une carte
 * inconnue de cette table — une carte mise de côté, rejouée depuis une
 * archive — prend l'écart moyen.
 */
const CARTES: Record<string, number> = {
  'exact-4': 5.8,
  'exact-5': 8.7,
  'long-6': 15.8,
  'black-positive': 18.8,
  'six-colors': 1.6,
  'five-colors': 6.6,
  squares: 2.9,
  'purple-longest': 7.7,
  'orange-paths': 7.2,
  crossing: 2.7,
  corners: 10.3,
  enclose: 5.7,
  specialist: 0.3,
  symmetry: -1.8,
  thrifty: 10.4,
  'clean-edge': 4,
  'matching-edge': 10.4,
  'banned-color': -9.9,
  'secret-color': 8.4,
  // « Mort subite » ne déplace pas le barème : elle le rend sans objet, la
  // partie s'arrête dès que le chemin est composé. Le solo la traite à part.
  'sudden-death': 0,
}

/**
 * Écart apporté par des cartes TIRÉES AU HASARD, mesuré directement — une
 * carte, puis deux. Ce n'est pas la moyenne des écarts individuels : le tirage
 * peut sortir « Couleur bannie » ou « Mort subite », qui coûtent cher, et la
 * moyenne des cas favorables surestimerait le barème de six points.
 */
const CARTES_AU_HASARD = [0, 3.2, 8.8]

/** Une carte au hasard de plus, au-delà de la deuxième. */
const CARTE_SUPPLEMENTAIRE = 5.6

/**
 * Empilées, les variantes se recouvrent un peu : deux façons de gagner des
 * points se disputent les mêmes tuiles. Mesuré, ce recouvrement est FAIBLE —
 * Arc-en-Ciel et Cristaux ensemble rapportent 25 points quand la somme de
 * leurs écarts en annonce 25,3 — mais il grandit avec le nombre de variantes :
 * à cinq, la somme brute surestime de sept points. D'où ce tassement doux,
 * calé sur ces deux repères.
 */
function tasser(ecarts: number[]): number {
  const positifs = ecarts.filter((e) => e > 0).sort((a, b) => b - a)
  const negatifs = ecarts.filter((e) => e <= 0)
  // Les malus, eux, ne se tassent pas : perdre des points reste perdre des
  // points, et un barème trop haut décourage bien plus que l'inverse.
  const somme = negatifs.reduce((n, e) => n + e, 0)
  return somme + positifs.reduce((n, e, i) => n + e / (1 + i * 0.15), 0)
}

/** Les trois objectifs d'une partie solo, selon ce qui est coché. */
export function objectifsSolo(options: GameOptions): ObjectifsSolo {
  const v = options.ruleset.variants ?? {}
  const ecarts: number[] = []
  for (const [cle, ecart] of Object.entries(VARIANTES)) {
    if (v[cle as keyof Variants] && ecart) ecarts.push(ecart)
  }
  if (!options.ruleset.requireAdjacency) ecarts.push(POSE_LIBRE)

  // Les cartes ne passent PAS par le tassement : leurs écarts sont mesurés
  // cumulés, pas un par un, ils ne se recouvrent donc pas deux fois.
  let cartes = 0
  if (options.useCards || options.personalCards) {
    const n = options.personalCards ? 1 : Math.max(1, options.cardCount ?? 1)
    if (options.cardId) {
      // Carte imposée : son écart propre, puis des tirages au hasard.
      cartes = CARTES[options.cardId] ?? CARTES_AU_HASARD[1]
      for (let i = 1; i < n; i++) cartes += CARTE_SUPPLEMENTAIRE
    } else {
      cartes = CARTES_AU_HASARD[Math.min(n, 2)]
      for (let i = 2; i < n; i++) cartes += CARTE_SUPPLEMENTAIRE
    }
  }

  // Un plateau plus grand change tout : le barème suit le nombre de cases.
  const cases = options.ruleset.boardSize * options.ruleset.boardSize
  const facteur = cases / 16

  const decale = tasser(ecarts) + cartes
  const bronze = SOCLE.bronze + decale
  /*
   * Une variante qui rapporte des points en rapporte AUSSI de façon plus
   * irrégulière : la distribution ne se contente pas de glisser, elle
   * s'élargit. Sans en tenir compte, l'or d'une partie chargée tombait trois
   * fois trop souvent — 29 % au lieu de 10 %. On étire donc l'écart entre les
   * médailles dans la même proportion que le barème lui-même.
   */
  const etirement = Math.sqrt(Math.max(0.35, bronze / SOCLE.bronze))
  const seuil = (base: number) =>
    Math.max(3, Math.round((bronze + (base - SOCLE.bronze) * etirement) * facteur))
  return { bronze: seuil(SOCLE.bronze), argent: seuil(SOCLE.argent), or: seuil(SOCLE.or) }
}

export type Medaille = 'or' | 'argent' | 'bronze' | null

/** Médaille obtenue avec ce score. */
export function medaille(score: number, o: ObjectifsSolo): Medaille {
  if (score >= o.or) return 'or'
  if (score >= o.argent) return 'argent'
  if (score >= o.bronze) return 'bronze'
  return null
}

export const NOM_MEDAILLE: Record<Exclude<Medaille, null>, string> = {
  or: 'Or',
  argent: 'Argent',
  bronze: 'Bronze',
}

/** Toutes les cartes dont l'écart solo est connu (pour les tests). */
export function cartesMesurees(): number {
  return CARDS.filter((c) => c.id in CARTES).length
}
