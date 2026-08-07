import type { GameOptions } from '../engine/index.ts'

export interface VariantInfo {
  label: string
  description: string
}

/**
 * Variantes actives d'une partie, avec leur description — pour le rappel dans
 * la colonne de droite en cours de jeu. Les textes sont ceux de l'écran de
 * configuration (SetupScreen) : toute reformulation doit être faite aux deux
 * endroits.
 */
export function activeVariantInfos(options: GameOptions): VariantInfo[] {
  const v = options.ruleset.variants ?? {}
  const out: VariantInfo[] = []
  const add = (cond: boolean | undefined, label: string, description: string) => {
    if (cond) out.push({ label, description })
  }
  add(
    options.useCards && (options.cardCount ?? 1) <= 1,
    'Cartes missions',
    'Une carte tirée pour la table, la même mission pour tout le monde.',
  )
  add(
    options.useCards && (options.cardCount ?? 1) > 1,
    `Cartes missions multiples (${options.cardCount ?? 2})`,
    'Plusieurs cartes pour la table, leurs bonus se cumulent.',
  )
  add(
    !!options.personalCards,
    'Cartes missions persos',
    'Chaque joueur reçoit sa propre carte, qu’il est seul à pouvoir accomplir.',
  )
  add(
    !options.ruleset.requireAdjacency,
    'Pose libre',
    'Les tuiles n’ont plus besoin de toucher une tuile déjà posée.',
  )
  add(
    v.lastPickRandom,
    'Dernier choix aléatoire',
    'Le dernier à choisir peut échanger la tuile restante contre une pioche au hasard — une fois, sans retour (touche S).',
  )
  add(
    v.coloredBorders,
    'Bordures colorées',
    'Le bord du plateau est à la couleur du joueur. Un chemin de cette couleur qui touche le bord — une ou plusieurs fois, un ou plusieurs côtés — gagne une case, une seule. Les bords ne relient jamais deux chemins.',
  )
  add(
    v.multiBorders,
    'Bordures multicolores',
    'Plateaux au verso sans cadre de couleur, bordés de 8 carrés colorés par côté (coins blancs) : chaque carré touché par un chemin de sa couleur ajoute une case, sans relier les chemins entre eux.',
  )
  add(v.monoTiles, 'Tuiles monochromes', '+12 tuiles unies dans le sac (2 par couleur).')
  add(
    v.whiteTiles,
    'Tuiles blanches',
    '+6 tuiles blanches jokers : elles prolongent et relient les chemins de toutes les couleurs voisines.',
  )
  add(
    v.magicStars,
    'Étoiles magiques',
    '30 tuiles portent une étoile. Une étoile seule vaut 1 pt ; chaque étoile reliée à une autre en vaut 2 (3 reliées = 6 pts).',
  )
  add(
    v.personalTile,
    'Tuile personnelle',
    'Chaque joueur reçoit une tuile sans noir, jouable une seule fois à la place d’une tuile du centre.',
  )
  add(
    v.mirrorTiles,
    'Tuiles miroir',
    'Chaque tuile peut se retourner sur sa face miroir (touche F) : couleurs inversées gauche-droite.',
  )
  return out
}
