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
    version: '1.77',
    date: '2026-08-24',
    changes: [
      'Sur téléphone, le bouton qui déplie les variantes se lit enfin comme un menu déroulant : un cadre sur toute la largeur, 48 pixels de haut, et un gros chevron orange qui bascule à l’ouverture. Il annonce aussi ce qu’il cache — « aucune » ou « 3 cochées » — pour qu’une variante laissée active ne disparaisse jamais des yeux.',
      'Le bouton « tout décocher » ne s’affiche plus quand la liste est repliée : il n’aurait rien à décocher sous les yeux.',
    ],
  },
  {
    version: '1.76',
    date: '2026-08-24',
    changes: [
      '« Dernière Tuile », « Indices » et « Graine » n’apparaissent plus sur la page d’accueil : ce sont des outils de réglage, pas des options de jeu. Les six options de partie rejoignent les Réglages, qui décident déjà de ce que la table voit, et ces trois-là y sont décochées d’origine — un clic suffit à les faire revenir.',
      'Ce nouveau réglage d’origine s’impose à TOUS les navigateurs : ce qui avait été mémorisé auparavant est effacé, chacun repart de la configuration du site.',
      'Sur téléphone, le panneau des variantes se replie : il faisait à lui seul la moitié de la page. Un appui sur son titre le déplie, et il repart replié à chaque arrivée sur l’accueil — rien n’est mémorisé, c’est voulu. La page d’accueil passe de 2 064 à 1 102 pixels de haut depuis la version 1.74.',
    ],
  },
  {
    version: '1.75',
    date: '2026-08-24',
    changes: [
      'Tout ce qui ne concerne que la tablette et le téléphone vit désormais dans un fichier à part, en deux paliers : tablette sous 1024 px — un iPad y tombe, 820 px en portrait — et téléphone sous 700 px. Retoucher le mobile ne peut plus abîmer l’affichage sur ordinateur, et la géométrie du bureau est comparée avant et après à chaque changement pour le prouver.',
      'Sur téléphone, les cinq liens de la barre du haut se replient derrière un bouton ☰ : la barre tenait sur deux lignes, elle n’en occupe plus qu’une — 47 px au lieu de 97. Le menu se referme dès qu’on choisit une destination ou qu’on appuie ailleurs.',
      'Sur téléphone toujours, le sélecteur du nombre de joueurs rejoint le titre « Joueurs » et le rappel « 2 joueurs » disparaît, le champ du nom est plus discret, le bouton de retrait devient un petit carré au lieu d’une barre pleine largeur, et le choix humain/bot partage sa ligne avec les couleurs. La page d’accueil perd 180 pixels de hauteur.',
    ],
  },
  {
    version: '1.74',
    date: '2026-08-21',
    changes: [
      'Un lien ouvert pour la première fois propose désormais une table prête à jouer : deux joueurs, un humain contre le bot Confirmé, Score et Points par Zone visibles, premier joueur tiré au sort, aucune variante.',
      'Ce qu’on règle est mémorisé et rechargé tel quel, variantes comprises. Auparavant les variantes repartaient à zéro à chaque chargement de page, et rien n’était retenu tant qu’une partie n’avait pas été lancée : régler sa table puis recharger perdait tout.',
    ],
  },
  {
    version: '1.73',
    date: '2026-08-21',
    changes: [
      'La carte « Les carrés » ne compte plus un carré de tuiles noires. Avec les Teintures, une zone noire adjacente à un pot prend sa couleur : un carré resté noir à l’œil rapportait les points — ça arrivait dans une partie sur huit avec la variante. Un quart noir sur la tuile ne compose plus rien, et une couleur interdite non plus, puisqu’elle s’affiche et coûte comme le noir.',
      'Les objectifs du mode solo sont désormais des multiples de 5 : 35, 40, 65, jamais 37 ni 46. Deux paliers que l’arrondi collerait l’un sur l’autre restent écartés de cinq points.',
    ],
  },
  {
    version: '1.72',
    date: '2026-08-21',
    changes: [
      'Nouvelle variante « Bords 4 Couleurs » : chaque côté du plateau a sa propre couleur, avec le pouvoir des Bords Colorés. Les six plateaux de la boîte se partagent les six couleurs à parts strictement égales — chacune sur exactement quatre côtés — et aucun plateau ne porte la sienne : personne ne peut s’appuyer sur la couleur qu’il a déjà sous la main.',
      'La carte mission « Bord assorti » suit désormais la couleur du BORD touché et non celle du plateau. Sans variante de bords, c’est le cadre imprimé, donc la couleur du joueur, comme avant ; avec Bords 4 Couleurs ou Bords Multicolores, c’est le côté ou le carré que la tuile touche.',
      'Nouvelle carte mission « Mort subite » : le premier joueur qui compose un chemin de la longueur choisie — 6, 7, 8 ou 9 tuiles — remporte immédiatement la partie, quel que soit le score. La longueur se choisit à la mise en place, sous la carte.',
      'Nouveau mode solo, sans adversaire : on affronte un barème à trois paliers — bronze, argent, or. On y choisit de jouer sans carte, avec une ou avec deux.',
      'Les trois paliers ne sont pas devinés : ils viennent de parties réellement jouées par le bot Expert. Chaque variante et chaque carte a son écart mesuré, et le barème les additionne — Arc-en-Ciel vaut +14,6 points, Couleur interdite −8,9, une carte tirée au hasard +3,2. Sur la partie nue, l’Expert décroche le bronze sept fois sur dix et l’or une fois sur dix.',
    ],
  },
  {
    version: '1.71',
    date: '2026-08-20',
    changes: [
      'La page d’accueil propose « Scanner les Points d’un Plateau », sous le bouton des parties en ligne : la lecture d’un plateau photographié n’est plus réservée à la barre du haut.',
    ],
  },
  {
    version: '1.70',
    date: '2026-08-20',
    changes: [
      'La lecture en direct par la caméra est retirée : elle n’ouvrait pas l’appareil photo et ne montrait qu’une image noire. On revient à la photo — « Scanner » ouvre l’appareil photo du téléphone, comme avant.',
      'La géométrie du plateau imprimé est enfin modélisée pour de vrai : de grosses barres noires séparent les emplacements, et le repère va d’un coin extérieur de la grille noire à l’autre. Sans ça, les mesures des tuiles de bord glissaient d’un huitième de tuile — c’était la principale cause d’erreur. Avec les bons coins, la lecture est désormais parfaite dans toutes les conditions d’éclairage essayées.',
      'L’application cherche le plateau toute seule : elle repère les couleurs vives, puis cale la grille noire sur le profil de saturation — les barres dans les creux, les emplacements sur les bosses. C’est ce calage qui donne la phase de la grille, la seule chose qu’un critère de couleur ne sait pas retrouver seul.',
      'Nouveau bouton « Caler les coins » : posez les quatre pastilles à la louche, à une demi-tuile près, et l’application termine l’ajustement. Mesuré sur des photos fabriquées : une pose à une demi-tuile près passe de 50 % à 100 % de plateaux parfaits.',
      'Le tracé posé sur la photo dessine maintenant les barres du plateau et non les frontières des tuiles : bien cadré, il se confond avec la grille noire — on voit immédiatement si le repère est juste.',
    ],
  },
  {
    version: '1.69',
    date: '2026-08-20',
    changes: [
      'La page Scanner lit désormais en direct : on vise le plateau, la caméra le lit six fois par seconde, et le plateau se reconstruit sous les yeux pendant qu’on cadre — le score, la qualité de l’image et le nombre de cases douteuses bougent en temps réel.',
      'La lecture se fige d’elle-même dès qu’elle ne bouge plus : quatre lectures identiques d’affilée sans aucune case douteuse, et l’image se verrouille pour l’examen. Une pastille verte ou rouge dit à tout moment si ce qui est lu tient debout ; tant qu’elle est rouge, rien ne se verrouille.',
      'Les quatre coins se déplacent aussi pendant le direct, et le repère revient au carré centré : il suffit d’y faire entrer le damier.',
      'Sans caméra — sur ordinateur, ou si l’accès est refusé — le bouton retombe sur le choix d’une photo déjà prise, qui sur téléphone ouvre de toute façon l’appareil photo.',
      'Le bouton « Choisir une photo » devient « Scanner », et le bouton « Plateau d’exemple » disparaît. Le générateur de fausses photos rejoint la suite de tests, où il vérifie la lecture à chaque construction.',
    ],
  },
  {
    version: '1.68',
    date: '2026-08-20',
    changes: [
      'Nouvelle page « Scanner » : on photographie un plateau terminé, on pose les quatre coins du damier, et l’application reconstruit les tuiles puis compte les points. La photo est redressée par homographie, chaque quart est mesuré en son centre, et les mesures sont recalées globalement sur la palette du jeu — c’est ce recalage qui absorbe la dominante d’une lampe chaude.',
      'Chaque case lue affiche sa confiance et se corrige au doigt : on choisit la bonne tuile parmi les plus ressemblantes, on la tourne ou on vide la case. Les cases dont les couleurs collent mal sont entourées de rouge — sur les essais, les 11 % de cases signalées contiennent 92 % des erreurs.',
      'Un bouton « Plateau d’exemple » fabrique une fausse photo — perspective, lampe chaude, grain, compression — et affiche le nombre de tuiles réellement retrouvées. C’est le seul moyen de juger la lecture sans plateau imprimé sous la main.',
    ],
  },
  {
    version: '1.67',
    date: '2026-08-19',
    changes: [
      'La carte mission « Le Vide » (+15 si une couleur est absente du plateau) est mise de côté : elle n’est pas tenable. Le jeu propose donc 19 cartes.',
    ],
  },
  {
    version: '1.66',
    date: '2026-08-18',
    changes: [
      'Nouvelle variante « Couleurs Équilibrées » : les douze tuiles en double de la boîte cèdent la place à douze tuiles uniques. Chaque couleur garde exactement ses 55 quarts et le sac ses 97 tuiles — ce sont les rencontres entre couleurs qui se répartissent mieux : six couples se touchent au lieu de trois.',
      'En ligne, une partie terminée ne referme plus le salon : l’hôte y ramène tout le monde d’un bouton « Rejouer avec les mêmes joueurs », plateaux et couleurs intacts, et relance aussitôt.',
      'Quitter une partie en ligne ne renvoie plus à l’accueil mais à la salle d’attente du salon. Un invité peut y retourner seul, l’hôte y ramène la table entière.',
    ],
  },
  {
    version: '1.65',
    date: '2026-08-18',
    changes: [
      'Quatre profils de bots au lieu de trois : Idiot (au hasard), Novice, Confirmé, Expert. Les parties déjà archivées restent lisibles — le Stratège d’hier est devenu le Confirmé.',
      'L’évaluation des bots a été refaite. Le potentiel d’un chemin est désormais un budget de tuiles à répartir, pas une prime distribuée à chaque bout de couleur : le bot cesse de mener dix chemins de front pour les mener tous à rien. Il sait aussi que le potentiel s’éteint — à la dernière manche, un chemin ne vaut plus que ce qu’il vaut.',
      'Les cartes missions tout-ou-rien ont enfin une pente : le bot voit venir « six couleurs » ou « spécialiste » dès la première manche au lieu de les découvrir accomplies par hasard.',
      'L’Expert regarde un coup plus loin, et regarde ce qu’il LAISSE : à valeur presque égale, il emporte la tuile qui arrangeait le plus son voisin.',
      'Mesuré sur des centaines de parties : l’Expert bat le Confirmé 65 % contre 32 %, le Confirmé bat le Novice 87 % contre 10 %. Le Confirmé marque 22 points de moyenne là où l’ancien Stratège en marquait 17,6.',
    ],
  },
  {
    version: '1.64',
    date: '2026-08-18',
    changes: [
      'Trois nouvelles cartes missions, en bleu ciel : « Bord assorti » (+2 par tuile qui touche le bord du plateau par un quart de sa couleur), « Couleur bannie » (−2 par zone de la couleur tirée, la même pour toute la table) et « Couleur secrète » (chacun reçoit sa couleur, son plus grand chemin de cette couleur compte double).',
      'Sept cartes d’extension sont mises de côté : elles ne sont plus tirées ni proposées. Leur code reste, une partie archivée qui les utilisait se relit toujours. Le jeu propose donc 20 cartes : 12 de la boîte, 5 d’extension, 3 en bleu ciel.',
      'Les deux dernières cartes ciel ont exactement le pouvoir des variantes Couleur interdite et Couleur secrète : le plateau, les pastilles de zone et le score en direct s’y accordent tous, comme pour les variantes.',
    ],
  },
  {
    version: '1.63',
    date: '2026-08-18',
    changes: [
      'Les variantes se déplacent d’une famille à l’autre : un menu à droite de chaque case, dans les Réglages, la range où l’on veut. Le choix est gardé, l’accueil et le Laboratoire suivent.',
      'Le Matériel n’expose plus l’attirail des variantes écartées : les tuiles à faille et les arc-en-ciel disparaissent avec elles. En échange il montre enfin les étoiles, les cristaux, les teintures et les moulins, qui n’y figuraient pas.',
      'L’onglet « 97 tuiles » montre les tuiles nues de la boîte de base : les étoiles, qui appartiennent à une variante, n’y sont plus dessinées.',
      'La publication du site ne se déclare plus en échec : deux mécanismes se disputaient la même file d’attente et l’un annulait l’autre, alors que le site était bien à jour. Il n’en reste qu’un, et le workflow vérifie que la page en ligne sert exactement le fichier qu’il vient de construire.',
    ],
  },
  {
    version: '1.62',
    date: '2026-08-12',
    changes: [
      'Toutes les familles de variantes réapparaissent à l’accueil — Cartes missions, Tuiles, Plateaux, Symboles, Score — seule la famille « Non conservées » reste décochée dans les Réglages.',
      'Ce nouveau réglage s’impose à TOUS les navigateurs : ce qui avait été mémorisé auparavant est effacé, chacun repart du réglage d’origine du site.',
      'Arc-en-Ciel et Échange rejoignent les variantes non conservées : 20 variantes proposées à l’accueil, 8 écartées.',
    ],
  },
  {
    version: '1.61',
    date: '2026-08-12',
    changes: [
      'La courbe d’évolution des scores rejoint enfin les plateaux : elle n’inscrivait un point qu’à la fin de chaque manche, si bien qu’en cours de manche elle affichait le score d’avant pendant que les plateaux affichaient celui du moment — de quoi inverser l’ordre des joueurs sous les yeux du lecteur.',
      'Elle se prolonge maintenant jusqu’au score en cours : son dernier point est toujours celui qui est écrit à côté du nom du joueur.',
    ],
  },
  {
    version: '1.60',
    date: '2026-08-12',
    changes: [
      'Nouveau mot de passe pour la page Réglages. Les onglets déjà ouverts sur cette page le restent jusqu’à leur fermeture.',
    ],
  },
  {
    version: '1.59',
    date: '2026-08-12',
    changes: [
      'Le site a maintenant un réglage d’origine : qui ouvre le lien pour la première fois — sur n’importe quel appareil — ne voit que la famille Cartes missions. Les cinq autres familles restent disponibles, mais masquées par défaut.',
      'La page Réglages gagne un bouton « Réglage d’origine » pour y revenir, et rappelle que ce qu’on y coche ne vaut que pour cet appareil.',
    ],
  },
  {
    version: '1.58',
    date: '2026-08-12',
    changes: [
      'Les Réglages rejoignent la barre du haut, avec l’Historique, le Laboratoire et les Versions : un rouage, à droite. Le bouton quitte le bas de la page d’accueil.',
      'Comme ses voisins, il disparaît en cours de partie.',
    ],
  },
  {
    version: '1.57',
    date: '2026-08-12',
    changes: [
      'Nouvelle page « Réglages », accessible depuis l’accueil et protégée par un mot de passe : on y choisit ce que la page d’accueil propose.',
      'Chaque famille de variantes peut être masquée d’un coup — séparateur compris — et chaque variante indépendamment. Un compteur rappelle combien il en reste.',
      'Le Laboratoire, lui, continue de tout montrer : c’est l’outil d’équilibrage, il doit pouvoir tester ce qui n’est plus proposé à la table.',
      'Le bouton « Laboratoire d’équilibrage » disparaît du bas de l’accueil : il ne figure plus qu’en haut à droite.',
      'La configuration de la prochaine partie ne s’efface plus quand on quitte l’accueil : aller voir les Réglages, l’Historique ou les Versions ne décoche plus ce qu’on venait de régler. Un rechargement de page, lui, remet toujours les variantes à zéro.',
      'Changer les Réglages remet les variantes à zéro : une variante masquée ne peut plus s’appliquer en silence.',
    ],
  },
  {
    version: '1.56',
    date: '2026-08-12',
    changes: [
      'Une tuile ne porte plus jamais une étoile ET un trèfle : les deux marques se retrouvaient parfois sur le même quart, illisibles l’une sur l’autre. Les trèfles sont désormais tirés parmi les tuiles sans étoile — 30 étoiles, 24 trèfles, plus aucun recoupement.',
    ],
  },
  {
    version: '1.55',
    date: '2026-08-12',
    changes: [
      'Le cristal quitte le milieu de la tuile : il orne désormais un quart précis, comme une étoile ou un trèfle, et prend la couleur de ce quart.',
      'Les 18 tuiles à cristal sont retirées : le quart cristallisé est toujours seul de sa couleur sur sa tuile, jamais sur un quart déjà étoilé ou tréflé — 3 cristaux par couleur.',
      'Il brille (+4) tant qu’aucun quart de la même couleur ne le touche, et se brise (−4) dès qu’une voisine colle sa couleur contre lui. Le quart suit la rotation et la face miroir.',
    ],
  },
  {
    version: '1.54',
    date: '2026-08-12',
    changes: [
      'Nouvelle règle des cristaux : +4 si la couleur qui porte le cristal ne déborde pas de sa tuile — aucun quart d’une tuile voisine ne porte la même couleur contre lui — et −4 si elle déborde. Le cristal peut donc coûter des points.',
      'L’ordre des poses n’entre plus dans le calcul : seule compte la position finale, si bien qu’on sait en posant ce que le cristal vaudra.',
      'Le barème en cours de partie affiche les deux cas, et le cristal se dessine brisé dès que sa couleur déborde.',
    ],
  },
  {
    version: '1.53',
    date: '2026-08-12',
    changes: [
      'Le pavé d’explications sous la liste des joueurs disparaît de l’accueil.',
      'Les options de partie sont remises dans l’ordre et raccourcies : Score, Points par Zone, 1er Joueur Aléatoire, Dernière Tuile, Indices, Graine.',
      'La colonne des variantes est rangée en six familles séparées — Cartes missions, Tuiles, Plateaux, Symboles, Score, Non conservées — et chaque variante porte un nom court.',
      'Le bouton « tout décocher » remonte à côté du titre de la colonne, hors des familles.',
      'Les mêmes noms courts servent au rappel des variantes en cours de partie et au Laboratoire.',
    ],
  },
  {
    version: '1.52',
    date: '2026-08-12',
    changes: [
      'Le chrono se déclenche aussi pour les parties en ligne : il restait à zéro, faute de démarrer ailleurs qu’au lancement d’une partie sur cet appareil.',
      'La durée d’une partie en ligne part donc avec elle dans l’archive, et compte enfin dans les statistiques cumulées.',
    ],
  },
  {
    version: '1.51',
    date: '2026-08-12',
    changes: [
      'En ligne, la vue « X plateaux visibles » tient bon : elle ne retombe plus sur la colonne de mini-plateaux dès qu’un joueur pose une tuile.',
      'Même chose pour « Score visible » et « Points par Zone visible » : les réglages d’affichage appartiennent à l’écran, pas à la partie, et survivent donc au rejeu du journal.',
      'Une nouvelle partie en ligne repart bien des réglages d’origine, plateaux côte à côte décochés compris.',
    ],
  },
  {
    version: '1.50',
    date: '2026-08-12',
    changes: [
      'Les teintures s’affichent enfin sur la tuile qu’on tient : le pot apparaît dans l’aperçu, sur la case survolée, avant la pose.',
      'Le pot garde l’orientation qu’il avait dans la main : il tourne avec la tuile au lieu de se redresser tout seul une fois posé — moulins et face miroir compris.',
      'L’aperçu montre aussi le cristal et le moulin de la tuile qu’on s’apprête à poser, qui n’y figuraient pas non plus.',
    ],
  },
  {
    version: '1.49',
    date: '2026-08-12',
    changes: [
      'La tuile d’un joueur automatique traverse enfin l’écran AVANT d’apparaître sur son plateau : c’est le trajet qui pose la tuile, et non la pose qui déclenche le trajet.',
      'Sa place au centre se vide pendant le vol — la tuile n’est plus à deux endroits à la fois.',
      'Le tour d’un bot est aussi rapide qu’avant : il réfléchit moins longtemps, puisque c’est le vol qui montre ce qu’il joue.',
      'Annuler en plein vol ramène la tuile au centre sans la poser.',
    ],
  },
  {
    version: '1.48',
    date: '2026-08-12',
    changes: [
      'Recliquer la tuile déjà choisie la fait tourner — le geste au doigt sur téléphone ; la touche R continue de fonctionner.',
      'La ligne de commandes se réduit à trois boutons : rotation à gauche, rotation à droite, annuler. Les mémos de raccourcis et les « touche 1-9 » sous les tuiles disparaissent.',
      'Le bouton « Annuler » n’apparaît plus qu’une fois, sous les tuiles, et la touche Échap fait enfin ce qu’il annonce : revenir au coup précédent.',
      'Quand c’est à vous de jouer, le bandeau respire et sa pastille clignote ; le joueur dont c’est le tour scintille dans la colonne comme en écran partagé.',
      'La tuile choisie par un joueur automatique traverse l’écran plus lentement et plus franchement, et le plateau qui la reçoit envoie une onde.',
      'La barre du haut s’allège en partie : plus de graine, plus de manche en double, plus d’indices, plus d’Historique ni de Laboratoire — restent les affichages du jeu, Accueil et Quitter la partie.',
      'La manche en cours s’affiche aussi au-dessus des plateaux en vue « X plateaux visibles ».',
      'La mention « a le sac ce tour-ci » ne s’affiche plus.',
    ],
  },
  {
    version: '1.47',
    date: '2026-08-07',
    changes: [
      'Le jeu en ligne est branché : les salons relient désormais des appareils différents, chacun sur son téléphone ou son ordinateur.',
      'L’écran des parties en ligne annonce l’état de la liaison — connexion en cours, ou échec expliqué — au lieu de rester muet si le réseau ne répond pas.',
    ],
  },
  {
    version: '1.46',
    date: '2026-08-07',
    changes: [
      'Le transport hébergé est en place : dès que la clé du projet sera renseignée, les salons relieront des appareils différents au lieu des seuls onglets d’un même navigateur.',
      'Le client temps réel n’est téléchargé que par ceux qui ouvrent l’écran des parties en ligne — le reste de l’application n’en paie que 1,7 Ko.',
      'Tant que le service n’est pas configuré, l’écran des salons le dit franchement et se rabat sur le salon local, qui fonctionne à l’identique.',
    ],
  },
  {
    version: '1.45',
    date: '2026-08-07',
    changes: [
      'Premier jalon du jeu en ligne : « Jouer en ligne » ouvre un salon numéroté (Camino 01, 02…), les autres le voient dans la liste, le rejoignent, choisissent leur plateau, et l’hôte lance la partie — le salon se ferme alors aux nouveaux venus, puis se referme tout seul à la fin.',
      'La partie ne synchronise jamais un état : le moteur étant déterministe, on n’échange que la graine et un journal de coups numérotés — 4 Ko pour une partie complète à six. Se reconnecter, c’est simplement redemander le journal.',
      'Chacun ne voit plus que ses propres secrets : couleur secrète, couleurs interdites, tuile personnelle et carte mission perso des adversaires sont masquées.',
      'À plusieurs, on ne joue que son tour, l’annulation disparaît et le bandeau signale « À vous de jouer ». Pour l’instant le salon relie les onglets d’un même navigateur : le transport hébergé viendra se brancher sans rien changer au reste.',
    ],
  },
  {
    version: '1.44',
    date: '2026-08-07',
    changes: [
      'Ajouté à l’écran d’accueil d’un iPhone, le site affiche enfin son logo — les quatre carrés de l’onglet — au lieu d’une capture de la page, et s’intitule simplement « CAMINO ».',
    ],
  },
  {
    version: '1.43',
    date: '2026-08-07',
    changes: [
      'Le plateau commun s’étend enfin en paysage et non en hauteur : 8×4 à deux joueurs, 8×6 à trois, 8×8 à quatre, puis 10×8 et 12×8. Toujours 16 cases par joueur, et un plateau qui finit plein.',
    ],
  },
  {
    version: '1.42',
    date: '2026-08-07',
    changes: [
      'Chaque chargement de page repart d’une feuille blanche côté variantes : plus aucune variante, carte mission, pose libre ni barème perso ne se rejoue en silence au rechargement. Les options de partie — score visible, indices, dernière tuile, 1er joueur aléatoire, graine — restent, elles, telles que vous les aimez.',
      'Revenir à l’accueil en cours de session ne remet rien à zéro : seul le premier passage après le chargement fait le ménage.',
      'Le bouton ↺ des variantes efface désormais aussi le barème perso, comme son intitulé « tout décocher » le promet.',
    ],
  },
  {
    version: '1.41',
    date: '2026-08-07',
    changes: [
      'Le Laboratoire teste enfin tout : le panneau des variantes de l’accueil y est repris à l’identique, avec les cartes missions, le barème perso, la pose libre et le 1er joueur aléatoire — on coche, on lance, on compare.',
      'Beaucoup plus de statistiques : d’où viennent les points source par source, la courbe de progression du score, le score du vainqueur contre celui du dernier, la part de parties serrées et d’égalités, le potentiel gâché, la distribution complète des rangs par siège, la force comparée des profils de bots et le taux d’accomplissement des cartes.',
      'Les campagnes terminées s’empilent dans un tableau récapitulatif : c’est la comparaison entre réglages qui dit si une variante resserre les scores ou creuse les écarts.',
      'La simulation adapte la taille de ses paquets au coût réel d’une partie : un plateau commun 12×8 ne fige plus l’interface.',
    ],
  },
  {
    version: '1.40',
    date: '2026-08-07',
    changes: [
      'Le Plateau commun change de règle : tching ! — à chaque pose, le poseur encaisse immédiatement les points que sa tuile fait gagner (ou perdre) au plateau, et son total s’incrémente en direct, delta animé sur la case posée.',
      'Le plateau devient rectangulaire : 2 colonnes de 8 par joueur — 4×8 à deux, 6×8 à trois, 8×8 à quatre — si bien que chacun apporte exactement ses 16 tuiles et que le plateau finit plein.',
      'La variante se combine désormais librement avec les autres : étoiles, trèfles, cristaux, teintures, moulins, couleurs secrètes et interdites passent tous par le delta de la pose — briser le cristal d’un autre, c’est le payer soi-même.',
    ],
  },
  {
    version: '1.39',
    date: '2026-08-07',
    changes: [
      'Quatre nouvelles tuiles en variantes : le Verso aléatoire (retourner une tuile du centre, sa nouvelle face sort du sac — sans retour, touche V), les Cristaux (+4 s’il reste intact, sur les 18 tuiles aux 3-4 quarts de même couleur), les Teintures (18 pots, 3 par couleur : adjacent à une zone noire à la pose, la zone prend sa couleur) et les Moulins (15 tuiles : les voisines déjà posées tournent d’un quart vers la gauche).',
      'Deux variantes de structure : la Partie synchrone (une seule tuile par manche, la même pour tous — le duel à armes égales) et le Plateau commun (un seul plateau 6×6 ou 8×8, chacun marque les chemins où il a posé, le noir partagé se paie).',
      'Trois cartes missions de plus : « Cartographe » (+8, chaque colonne — ou ligne, tirée en début de partie — doit marquer), « Les 4 bords » (+8) et « Ceinture noire » (+10 pour une seule zone noire d’au moins 4 tuiles).',
      'Les bots savent tout jouer : ils retournent une tuile quand leur meilleur coup perd, protègent leurs cristaux et ne comptent que leurs propres chemins sur le plateau commun.',
    ],
  },
  {
    version: '1.38',
    date: '2026-08-07',
    changes: [
      'Les Étoiles magiques ont désormais deux barèmes au choix, dans un menu déroulant : l’officiel (une étoile reliée vaut 2 points) ou le croissant, où dans un groupe de N chaque étoile vaut N — 4 étoiles reliées passent de 8 à 16 points.',
      'La page d’accueil est réorganisée : les Options de partie et le bouton « Commencer la partie » passent dans la colonne de gauche, sous les joueurs ; les Variantes occupent seules la colonne de droite.',
      'Deux boutons rejoignent le Laboratoire d’équilibrage : « Règles du jeu » et « Matériel » déplient leur section sur la page d’accueil au lieu de l’occuper en permanence.',
      'Les règles du jeu sont écrites en entier — mise en place, déroulement, ce qu’est un chemin, décompte — au lieu du seul rappel de fin de page.',
    ],
  },
  {
    version: '1.37',
    date: '2026-08-07',
    changes: [
      'La carte « Le plus propre » est retirée : elle faisait double emploi avec « Économe », qui récompense déjà le plateau le moins noir de la table.',
      'Une carte choisie puis retirée du jeu ne reste plus sélectionnée en silence dans la configuration sauvegardée — la partie repart sur un tirage au hasard au lieu de démarrer sans mission.',
    ],
  },
  {
    version: '1.36',
    date: '2026-08-07',
    changes: [
      'Trois cartes missions de plus, dans le rose des cartes d’extension : « Frontière nette » (+6 si aucune zone noire ne touche le bord), « Le vide » (+15 si une couleur est totalement absente du plateau) et « Le plus propre » (+10 si vous avez strictement moins de zones noires que chacun des autres).',
      'Leur valeur a été calée sur 25 parties simulées chacune : Frontière nette rapporte 3,9 points en moyenne, Le plus propre 2,5 et Le vide 1,4 — de quoi tenir la comparaison avec « Économe » (3,4) sans l’écraser.',
    ],
  },
  {
    version: '1.35',
    date: '2026-08-07',
    changes: [
      'Nouvelle variante « Scoring inversé » : chacun part à 20 points, les zones noires en rapportent 2 et les chemins coûtent ce qu’ils rapportaient.',
      'Toutes les autres variantes comptent à l’envers avec elle — étoiles, trèfles, couleur secrète, couleur interdite et cartes missions : ce qui faisait gagner fait perdre.',
      'Le plateau, le barème de la colonne de droite et le détail du score affichent le barème réellement appliqué, et les bots jouent le miroir.',
    ],
  },
  {
    version: '1.34',
    date: '2026-08-07',
    changes: [
      'Un chrono démarre au lancement de chaque partie et s’affiche dans la barre du haut ; il se fige sur son total dès la dernière tuile posée.',
      'La durée totale s’affiche à côté du titre « Fin de partie », part avec la partie dans l’archive et apparaît dans l’historique comme dans l’export CSV.',
      'Les statistiques cumulées gagnent deux mesures : la durée moyenne d’une partie et le temps de jeu total.',
    ],
  },
  {
    version: '1.33',
    date: '2026-08-07',
    changes: [
      'Nouvelle option en cours de partie, « X Plateaux visibles » : tous les plateaux s’affichent côte à côte au centre et la colonne de gauche s’efface — la vue idéale en écran partagé.',
      'La taille des plateaux suit leur nombre, de 2 à 6, pour que tout tienne à l’écran sans défilement ; décocher l’option rend la colonne de gauche, qui reste la vue par défaut au début de chaque partie.',
      'Chaque plateau garde son propre barème : une carte mission personnelle ne déteint plus sur les plateaux voisins.',
    ],
  },
  {
    version: '1.32',
    date: '2026-08-07',
    changes: [
      'Les couleurs interdites se comportent désormais comme le noir : chaque zone de cette couleur coûte 2 points, quelle que soit sa taille — les réunir en une seule reste donc payant.',
      'Sur le plateau, ces zones s’entourent et s’annotent en rouge comme les zones noires, et le noir garde son malus par-dessus.',
      'Les bots l’ont compris : ils rassemblent leurs couleurs interdites au lieu d’en éparpiller les zones.',
    ],
  },
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
