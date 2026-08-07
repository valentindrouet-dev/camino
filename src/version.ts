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
    version: '1.31',
    date: '2026-08-07',
    changes: [
      'Option de partie « 1er Joueur Aléatoire » : le sac ne part plus forcément du joueur en tête de liste.',
      'Nouvelle variante « Couleur interdite » : chaque joueur reçoit une tuile monochrome dont les chemins lui rapportent ses points en négatif.',
      'La variante propose une deuxième couleur interdite par joueur, et les bots savent désormais fuir ces couleurs.',
    ],
  },
  {
    version: '1.30',
    date: '2026-08-07',
    changes: [
      'Le score de la colonne de droite n’affiche que ce qui rapporte : les couleurs apparaissent au fur et à mesure qu’elles marquent, et les points de trèfles y figurent.',
      'Les pastilles de points ne se posent plus jamais sur un trèfle, comme elles évitaient déjà les étoiles.',
      'La tuile arc-en-ciel est un seul grand carré irisé, plateau, pioche et matériel compris.',
      'Les trèfles des vignettes de la colonne de gauche prennent enfin leur vraie couleur : verts quand ils rapportent, rouges sinon.',
    ],
  },
  {
    version: '1.29',
    date: '2026-08-07',
    changes: [
      'La variante Tuile de départ propose deux tuiles au choix : monochrome à la couleur du plateau, ou multicolore à quatre couleurs — la même pour tous.',
      'Les tuiles blanches deviennent les tuiles arc-en-ciel : un seul carré irisé par tuile, joker qui relie les couleurs voisines, les trois autres quarts étant colorés.',
    ],
  },
  {
    version: '1.28',
    date: '2026-08-07',
    changes: [
      'Rapport de fin de partie : un champ libre attaché à la partie, retrouvable dans l’Historique via le nouvel onglet « Rapports de partie ».',
      'Variante Tuile supplémentaire : une tuile de plus au centre chaque manche, la restante est remélangée dans le sac.',
      'Variante Tuiles failles : une faille grise coupe 16 tuiles en deux moitiés qui ne se relient pas.',
      'Variante Trèfles : un quart de tuile sur quatre porte un trèfle — +3 dans un chemin qui marque, −3 sinon.',
      'Variante Tuile de départ : chaque plateau démarre avec une tuile de sa couleur au centre.',
      'Variante Sac antihoraire : le sac revient au dernier servi.',
      'Variante Échange de plateaux : deux cartes face cachée, « Rotation ! » ou « Pas de rotation ! », retournées à mi-partie.',
      'Variante Couleur secrète : une tuile monochrome remise en secret, dont le meilleur chemin est doublé.',
      'Sept cartes missions d’extension, affichées en rose : Plateau immaculé, Le plus long chemin, Spécialiste, Symétrie, Cœur du plateau, Les quatre angles et Économe.',
      'Les cartes « plus grand chemin » et « chemins d’une couleur » visent désormais une couleur tirée au début de chaque partie.',
    ],
  },
  {
    version: '1.27',
    date: '2026-08-07',
    changes: [
      'Le barème reprend la présentation de la feuille de score : « Points des tuiles connectées », 3 = 3 pts … 9+ = 30 pts, Noir = −2 pts.',
      'Les variantes de la partie sont rappelées dans la colonne de droite : le nom seul, la règle se déplie au clic.',
      'Bordures colorées : toucher le bord — une ou plusieurs fois, un ou plusieurs côtés — vaut +1 case en tout pour le chemin.',
      'Les plateaux à bordures multicolores n’ont plus de cadre coloré : seulement leurs carrés et leurs coins blancs, comme le verso imprimé.',
    ],
  },
  {
    version: '1.26',
    date: '2026-08-06',
    changes: [
      'Nouveau barème des étoiles : une étoile seule (blanche) vaut 1 point, chaque étoile reliée (dorée) en vaut 2.',
      'Les pastilles de zones ne recouvrent plus jamais une étoile : elles choisissent une case libre de leur zone (ou une voisine si tout est étoilé).',
      'Les bonus d’étoiles logent entiers dans une case voisine du groupe, sans chevaucher lignes, étoiles ni autres pastilles.',
      'Publication fiabilisée : les fichiers construits accompagnent le code sur la branche, le site se met à jour même quand GitHub Actions est en panne.',
    ],
  },
  {
    version: '1.25',
    date: '2026-08-06',
    changes: [
      'Les réglages d’une variante se déplient sous son propre bouton : le nombre de cartes missions ne s’égare plus en bas du panneau.',
      'Les tuiles blanches deviennent irisées — une nacre arc-en-ciel — au lieu d’un blanc confondu avec un emplacement vide.',
      'Bouton « ↺ » pour décocher toutes les variantes d’un coup.',
      'Le barème modifiable rejoint les variantes sous le nom « Barème perso ».',
      'La ligne « tuiles révélées par manche » disparaît de l’écran de configuration.',
      'Touche S pour refuser la tuile restante et repiocher au hasard.',
    ],
  },
  {
    version: '1.24',
    date: '2026-08-06',
    changes: [
      'Bordures colorées : quatre blocs, un par côté. Un côté touché ajoute une case au chemin et s’entoure entièrement avec lui.',
      'Correction : avec plusieurs cartes missions, l’écran de fin n’affichait qu’une carte et fusionnait leurs détails ; chacune a désormais sa carte et ses points.',
      'Les bots visent les cartes missions en plus de leurs priorités, et suivent leur carte personnelle quand elle change le barème.',
      'Le repère de la dernière tuile posée devient l’option de partie « Dernière tuile posée », désactivée par défaut.',
    ],
  },
  {
    version: '1.23',
    date: '2026-08-06',
    changes: [
      'Bordures colorées : le cadre du plateau est découpé en 8 carrés par côté, coins blancs, comme les bordures multicolores — sans agrandir le plateau.',
      'Chaque carré de bord touché par un chemin de sa couleur lui ajoute une case, et apparaît dans son contour blanc : on voit d’où viennent les points.',
    ],
  },
  {
    version: '1.22',
    date: '2026-08-06',
    changes: [
      'Un fil doré lumineux relie les étoiles adjacentes ; les étoiles reliées deviennent dorées, les isolées restent blanches.',
      'Plus de pointillés autour des étoiles seules.',
      'Les bonus des groupes d’étoiles sont dessinés au-dessus de tout, dans une pastille dorée à liseré blanc, toujours lisibles.',
    ],
  },
  {
    version: '1.21',
    date: '2026-08-06',
    changes: [
      'Bordures colorées : plus de couronne ajoutée — le cadre du plateau est la bordure.',
      'Les bordures ne relient plus jamais deux chemins : chaque côté (ou carré) touché ajoute simplement une case au chemin qui le touche.',
      'Bordures multicolores alignées sur les quarts de tuile, avec les mêmes jeux que la grille.',
      'Les carrés de bordure reliés sont inclus dans le contour blanc du chemin.',
      'Accueil : crédits du jeu — Claude Clément, Marie-Laure Clément, Alexandre Droit, édité par Big Budi Games.',
    ],
  },
  {
    version: '1.20',
    date: '2026-08-05',
    changes: [
      'Les plateaux multicolores retrouvent leur cadre de couleur : les carrés de bordure sont dessinés dessus, comme au verso des plateaux.',
      'Les étoiles magiques n’apparaissent — en pioche comme sur les plateaux — que si la variante est cochée.',
      'Les étoiles comptent par simple adjacence : trois étoiles côte à côte font 6 points, sans besoin d’un chemin commun.',
      'Les groupes d’étoiles sont soulignés discrètement, en pointillés dorés, avec leur bonus.',
      'Le barème (chemins, noir, étoiles) s’affiche dans la colonne de droite au-dessus du journal.',
      'Deux variantes de cartes : « Cartes missions multiples » (2 à 4 cartes cumulées) et « Cartes missions persos » (une carte propre à chaque joueur).',
    ],
  },
  {
    version: '1.19',
    date: '2026-08-05',
    changes: [
      'Huit variantes jouables : Dernier choix aléatoire, Bordures colorées, Bordures multicolores, Tuiles monochromes, Tuiles blanches, Étoiles magiques, Tuile personnelle et Tuiles miroir.',
      'Les bordures prolongent et relient les chemins ; le blanc sert de joker ; les étoiles reliées rapportent 1/3/6/10/20 points.',
      'Les bots jouent toutes les variantes : face miroir, tuile personnelle gardée en réserve, repioche du dernier choix.',
      'Matériel enrichi : les 6 plateaux multicolores, les 18 tuiles de variante et les étoiles sur les 97 tuiles.',
      'Les descriptions des variantes n’apparaissent qu’une fois la variante cochée.',
    ],
  },
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
