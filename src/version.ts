/**
 * Historique des versions de CAMINO.
 *
 * Une entrée par mise à jour, une ligne par changement — c'est la source
 * unique : le numéro affiché dans la barre du haut et l'écran « Versions »
 * sortent d'ici. À chaque nouvelle demande, on ajoute une entrée en tête.
 */
export interface Release {
  version: string
  /** Date de la mise à jour, au format ISO court. */
  date: string
  /** Résumé d'une ligne par changement. */
  changes: string[]
}

export const RELEASES: Release[] = [
  {
    version: '1.18',
    date: '2026-08-05',
    changes: [
      'Contours de zones à angles arrondis et d’épaisseur constante, tracés par décalage vers l’intérieur.',
      'Les pastilles redeviennent rondes ; la police se réduit au-delà de 9 pour que « +23 » tienne dedans.',
      'La dernière tuile posée est signalée par des équerres orange dans la grille, au lieu d’un cadre blanc confondu avec les contours de zones.',
    ],
  },
  {
    version: '1.17',
    date: '2026-08-05',
    changes: [
      'Contours des zones redessinés à l’intérieur de la zone : plus de trait qui bave sur la grille grise ni de double liseré mal placé.',
      'Les pastilles de points s’élargissent selon le nombre affiché : « +23 » ne déborde plus.',
      'Zones noires en rouge clair — contour et pastille — au lieu de l’orange.',
    ],
  },
  {
    version: '1.16',
    date: '2026-08-05',
    changes: [
      'Numéro de version affiché dans la barre du haut et écran « Versions » retraçant toutes les mises à jour.',
      'La graine manuelle passe des Variantes aux Options de partie.',
    ],
  },
  {
    version: '1.15',
    date: '2026-08-05',
    changes: [
      'La carte « zones noires positives » modifie le barème : les zones noires affichent +2 sur le plateau au lieu de −2.',
      'La courbe des scores inclut les cartes missions : elle atteint enfin les totaux du podium et respecte le classement.',
      'Chaque nouvelle partie tire une graine neuve ; la graine ne s’affiche que si on la demande.',
      'Le plateau central ne bascule plus sur les bots : leur tuile s’envole de la pioche vers leur plateau.',
    ],
  },
  {
    version: '1.14',
    date: '2026-08-05',
    changes: [
      'Le site démarre quel que soit le mécanisme de publication de GitHub Pages.',
      'Le déploiement relit le site en ligne et échoue s’il ne sert pas l’application.',
    ],
  },
  {
    version: '1.13',
    date: '2026-08-05',
    changes: [
      'Écran d’attente et reprise automatique en cas d’échec de chargement, au lieu d’une page blanche.',
      'Une erreur d’affichage est interceptée et présentée avec un bouton pour repartir de zéro.',
    ],
  },
  {
    version: '1.12',
    date: '2026-08-05',
    changes: [
      'Quitter une partie la ferme vraiment : Accueil, Nouvelle partie et Quitter n’y ramènent plus.',
      'Nouvel écran « Historique » pour revoir les plateaux et les scores des parties terminées.',
      'Le logo ramène à l’accueil, qui propose de reprendre la partie en cours.',
      'IA revues : Hasard, Novice et Stratège, ce dernier concentrant ses couleurs et regroupant ses noirs.',
    ],
  },
  {
    version: '1.11',
    date: '2026-08-05',
    changes: [
      'Les 12 cartes missions de la boîte sont codées, testées et visibles en direct pendant la partie.',
      'Chaque joueur choisit son plateau parmi les six couleurs, sans doublon possible.',
      'Le plateau reprend le modèle imprimé : contour de couleur, grille grise, emplacements blancs.',
      'Section « Matériel » sur l’accueil : les 6 plateaux, les 97 tuiles et les 12 cartes.',
      'Pastilles de points discrètes et libellés d’options clarifiés.',
      'Correction : « Revoir les plateaux » ne renvoyait plus aussitôt aux résultats.',
      'Correction : une partie terminée n’est plus comptée plusieurs fois dans les statistiques.',
    ],
  },
  {
    version: '1.10',
    date: '2026-08-05',
    changes: [
      'Thème clair : fond crème, panneaux blancs et accents pastel.',
      'Plateau éclairci et écran de fin de partie rééquilibré.',
    ],
  },
  {
    version: '1.00',
    date: '2026-08-05',
    changes: [
      'Table de jeu de 1 à 6 joueurs sur le même écran, avec rotation des tuiles à 360°.',
      'Décompte automatique des zones, vérifié sur l’exemple de la règle.',
      'Statistiques en cours et en fin de partie, archivage local et export CSV.',
      'Laboratoire d’équilibrage : barème modifiable et simulation jusqu’à 2 000 parties.',
    ],
  },
]

export const VERSION = RELEASES[0].version

/** Date de compilation, injectée par Vite — repère utile en cas de cache. */
declare const __BUILD__: string
export const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'développement'
