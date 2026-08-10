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
    'Tuiles arc-en-ciel',
    '+6 tuiles arc-en-ciel : un seul grand carré irisé qui prolonge et relie les chemins de toutes les couleurs voisines.',
  )
  add(
    v.magicStars,
    'Étoiles magiques',
    v.starScoring === 'growing'
      ? '30 tuiles portent une étoile. Dans un groupe de N étoiles reliées, chacune vaut N points : 2 reliées = 4 pts, 3 = 9 pts, 4 = 16 pts.'
      : '30 tuiles portent une étoile. Une étoile seule vaut 1 pt ; chaque étoile reliée à une autre en vaut 2 (3 reliées = 6 pts).',
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
  add(
    v.extraTile,
    'Tuile supplémentaire',
    'Une tuile de plus au centre à chaque manche ; la tuile restante est remélangée dans le sac.',
  )
  add(
    v.faultTiles,
    'Tuiles failles',
    'Une faille grise coupe 16 tuiles en deux moitiés qui ne se relient pas entre elles ; chaque moitié se relie normalement aux tuiles voisines.',
  )
  add(
    v.clovers,
    'Trèfles',
    'Un quart de tuile sur quatre porte un trèfle : +3 points dans un chemin qui marque, −3 sinon.',
  )
  add(
    v.startTile,
    v.startTileMulti ? 'Tuile de départ multicolore' : 'Tuile de départ',
    v.startTileMulti
      ? 'Tous les plateaux ont démarré avec la même tuile à quatre couleurs, posée au centre.'
      : 'Chaque plateau a démarré avec une tuile monochrome de sa couleur, posée au centre.',
  )
  add(
    v.bagCounterClockwise,
    'Sac antihoraire',
    'Le sac revient au dernier servi — le voisin de droite — au lieu de tourner dans le sens horaire.',
  )
  add(
    v.boardSwap,
    'Échange de plateaux',
    'Deux cartes face cachée : à la moitié de la partie, « Rotation ! » fait passer chaque plateau au voisin de gauche, « Pas de rotation ! » oblige à garder le sien.',
  )
  add(
    v.secretColor,
    'Couleur secrète',
    'Chaque joueur a reçu une couleur en secret : à la fin, son meilleur chemin de cette couleur est doublé.',
  )
  add(
    v.randomBack,
    'Verso aléatoire',
    'À son tour, un joueur peut retourner une tuile du centre : sa nouvelle face sort du sac, et il doit la poser — sans retour possible (touche V).',
  )
  add(
    v.crystals,
    'Cristaux',
    '18 tuiles portent un cristal : +4 points s’il reste intact, c’est-à-dire si aucune tuile n’est venue se coller à la sienne après sa pose.',
  )
  add(
    v.dyes,
    'Teintures',
    '18 pots de couleur : posé adjacent à une zone noire, le pot déteint et la zone prend sa couleur — définitivement. Le noir arrivé plus tard reste noir.',
  )
  add(
    v.windmills,
    'Moulins',
    '15 tuiles à moulin : à la pose, les tuiles adjacentes déjà posées tournent d’un quart de tour vers la gauche.',
  )
  add(
    v.syncDraw,
    'Partie synchrone',
    'Une seule tuile par manche, la même pour tout le monde — plus de choix au centre, plus d’ordre de pioche.',
  )
  add(
    v.sharedBoard,
    'Plateau commun',
    'Un seul grand plateau pour la table (2 colonnes de 8 par joueur). À chaque pose, le poseur encaisse immédiatement les points que sa tuile fait gagner — ou perdre — au plateau.',
  )
  add(
    v.reverseScoring,
    'Scoring inversé',
    'Chacun part à 20 points : les zones noires rapportent 2 points, les chemins coûtent ce qu’ils rapportaient, et toutes les autres variantes comptent à l’envers.',
  )
  add(
    v.forbiddenColor,
    (v.forbiddenColorCount ?? 1) > 1 ? 'Couleur interdite (2)' : 'Couleur interdite',
    (v.forbiddenColorCount ?? 1) > 1
      ? 'Chaque joueur a reçu deux couleurs interdites : elles se comportent comme le noir, chaque zone de ces couleurs coûte 2 points — quelle que soit sa taille, alors autant les réunir.'
      : 'Chaque joueur a reçu une couleur interdite : elle se comporte comme le noir, chaque zone de cette couleur coûte 2 points — quelle que soit sa taille, alors autant les réunir.',
  )
  return out
}
