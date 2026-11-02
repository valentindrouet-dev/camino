/**
 * Le contenu d'origine de la liste de développement : tout ce qu'il y a à
 * valider pour finir CAMINO, dans le détail.
 *
 * Deux sources. Ce qui existe déjà dans le jeu — les cartes, les variantes —
 * est tiré du moteur et du catalogue, pour que la liste ne se trompe ni dans
 * les comptes ni dans les textes. Le reste est écrit ici : ce sont des
 * questions, avec les chiffres connus et les options possibles, pas des
 * réponses.
 *
 * Chaque point porte un identifiant STABLE : c'est par lui qu'une liste déjà
 * cochée reconnaît ses points quand une mise à jour en ajoute. Ne jamais en
 * changer un ; en ajouter, oui, en montant `MODELE` d'un cran.
 */
import { CARDS, cardText, COLOR_HEX, COLOR_NAMES, PATH_COLORS, TOUTES_LES_CARTES } from '../engine/index.ts'
import { CATALOGUE } from '../ui/reglages.ts'
import type { Categorie, Element, Liste, SousCategorie } from './modele.ts'

/** Version du contenu : à monter quand on ajoute des points. */
export const MODELE = 1

function el(id: string, titre: string, detail?: string): Element {
  const e: Element = { id, titre, etat: 'a-faire' }
  if (detail) e.detail = detail
  return e
}

function sc(id: string, titre: string, elements: Element[]): SousCategorie {
  return { id, titre, elements }
}

// ---------------------------------------------------------------------------
// Mécaniques
// ---------------------------------------------------------------------------

const DETAIL_VARIANTE: Record<string, string> = {
  cards: 'Une carte tirée pour la table, la même mission pour tout le monde. Décider si elle fait partie de la règle de base ou reste une variante.',
  cardsMulti: 'Plusieurs cartes pour la table (2 dans l’application), leurs bonus se cumulent. Garder ? Jusqu’à combien ?',
  cardsPerso: 'Chaque joueur reçoit sa propre carte, qu’il est seul à pouvoir accomplir. Information cachée ou visible ?',
  freePlace: 'Les tuiles n’ont plus besoin de toucher une tuile déjà posée. Dans la boîte ou non ?',
  lastRandom: 'Le dernier à choisir peut échanger la tuile restante contre une pioche au hasard — une fois par partie, sans retour.',
  randomBack: 'À son tour, un joueur peut retourner une tuile du centre : sa nouvelle face sort du sac et il doit la poser. Demande un verso de tuile exploitable.',
  balanced: 'Les douze tuiles en double de la boîte sont remplacées par douze tuiles uniques : autant de quarts par couleur, mais six couples de couleurs au lieu de trois. Décide la composition du sac de base !',
  mono: '+12 tuiles unies dans le sac (2 par couleur). Matériel supplémentaire.',
  personal: 'Chaque joueur reçoit une tuile sans noir, jouable une seule fois à la place d’une tuile du centre.',
  mirror: 'Chaque tuile peut se retourner sur sa face miroir : couleurs inversées gauche-droite. Demande un verso imprimé sur les 97 tuiles.',
  extra: 'Une tuile de plus au centre à chaque manche ; la tuile restante est remélangée dans le sac.',
  start: 'Chaque plateau démarre avec une tuile posée au centre : monochrome de sa couleur, ou la même tuile à quatre couleurs pour tous.',
  borders: 'Le bord du plateau est à la couleur du joueur : un chemin de cette couleur qui le touche gagne une case, une seule. Utilise le cadre imprimé du plateau.',
  quadBorders: 'Chaque côté du plateau a sa propre couleur, avec le pouvoir des Bords Colorés. Six plateaux, six couleurs sur quatre côtés chacune, aucun plateau ne porte la sienne. Impose un verso ou un jeu de plateaux dédié.',
  multiBorders: 'Verso des plateaux : 8 carrés colorés par côté, coins blancs ; chaque carré touché par un chemin de sa couleur ajoute une case. Impose l’impression du verso.',
  shared: 'Un seul grand plateau paysage pour la table, 16 cases par joueur ; à chaque pose, le poseur encaisse les points que sa tuile fait gagner ou perdre. Demande un plateau spécifique.',
  stars: '30 tuiles portent une étoile : 1 pt seule, davantage reliée. Marque à imprimer sur les tuiles ou jetons à poser ?',
  clovers: '24 tuiles portent un trèfle sur un quart : +3 dans un chemin qui marque, −3 sinon. Même question de matériel.',
  secret: 'Chaque joueur reçoit une couleur en secret : son meilleur chemin de cette couleur est doublé. Utilise les 6 tuiles couleur comme cartes secrètes.',
  forbidden: 'Chaque joueur reçoit une (ou deux) couleur interdite : elle se comporte comme le noir, chaque zone coûte 2 points.',
  scale: 'Barème personnalisé : la table règle elle-même la valeur de chaque longueur de chemin. Variante d’application ou aussi dans la boîte ?',
  reverse: 'Chacun part à 20 points, les zones noires rapportent 2 points, les chemins coûtent ce qu’ils rapportaient. Une inversion complète.',
  bagCcw: 'Le sac revient au dernier servi au lieu de tourner dans le sens horaire. Variante non conservée dans l’application.',
  faults: 'Une faille grise coupe 16 tuiles en deux moitiés qui ne se relient pas. Non conservée.',
  crystals: '18 tuiles portent un cristal sur un quart : +4 tant qu’aucun quart de sa couleur ne le touche, −4 sinon. Non conservée.',
  windmills: '15 tuiles à moulin : à la pose, les voisines déjà posées tournent d’un quart de tour. Non conservée.',
  dyes: '18 pots de teinture : posé contre une zone noire, le pot la recolore définitivement. Non conservée.',
  sync: 'Une seule tuile par manche, la même pour tout le monde. Non conservée.',
  rainbow: '+6 tuiles arc-en-ciel : un carré irisé qui prolonge et relie les chemins de toutes les couleurs voisines. Non conservée.',
  swap: 'Deux cartes face cachée : à la moitié de la partie, « Rotation ! » fait passer chaque plateau au voisin de gauche, « Pas de rotation ! » oblige à garder le sien. Non conservée.',
}

/** Toutes les variantes du catalogue, hors options d'affichage. */
function variantes(): Element[] {
  return CATALOGUE.filter((g) => g.titre !== 'OPTIONS DE PARTIE').flatMap((g) =>
    g.variantes.map((v) =>
      el(
        `mec-var-${v.cle}`,
        `Variante « ${v.label} » — conserver, écarter, ou règle de base ?`,
        [
          DETAIL_VARIANTE[v.cle],
          g.titre === 'NON CONSERVÉES'
            ? 'Rangée dans la famille « non conservées » de l’application : à confirmer.'
            : `Famille « ${g.titre.toLowerCase()} ».`,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    ),
  )
}

/** Une entrée mécanique et une entrée texte par carte en jeu. */
function cartesEnJeu(): Element[] {
  return CARDS.flatMap((c) => {
    const serie = c.extra ? 'extension' : c.ciel ? 'troisième série' : 'base'
    const complements = [
      c.colorized ? 'la couleur visée est tirée en début de partie' : '',
      c.randomAxis ? 'l’axe visé est tiré en début de partie' : '',
      c.seuils ? `seuil au choix : ${[...c.seuils].sort((a, b) => a - b).join(', ')} tuiles` : '',
      c.sudden ? 'met fin à la partie, ne rapporte pas de points' : '',
    ].filter(Boolean)
    return [
      el(
        `mec-carte-${c.id}`,
        `Carte « ${c.name} » (${c.badge}) — mécanique validée`,
        `Série ${serie}.${complements.length ? ' ' + complements.join(' ; ') + '.' : ''} Vérifier que la règle est juste, jouable, et que sa valeur en points est équilibrée par rapport aux autres cartes.`,
      ),
      el(
        `mec-wording-${c.id}`,
        `Carte « ${c.name} » — texte définitif`,
        `Texte actuel : « ${cardText(c)} ». Valider la formulation, la longueur (elle doit tenir sur la carte), et le vocabulaire — les mêmes mots que la règle.`,
      ),
    ]
  })
}

/** Les cartes écartées de l'application : les auteurs confirment ou reprennent. */
function cartesEcartees(): Element[] {
  return TOUTES_LES_CARTES.filter((c) => !CARDS.includes(c)).map((c) =>
    el(
      `mec-carte-ecartee-${c.id}`,
      `Carte « ${c.name} » (${c.badge}) — retirée : confirmer`,
      `Retirée de l’application. Texte : « ${cardText(c)} ». Confirmer son abandon, ou la reprendre.`,
    ),
  )
}

const MECANIQUES: Categorie = {
  id: 'mecaniques',
  titre: 'Mécaniques',
  intro:
    'Ce que le jeu fait jouer : le matériel en nombre, le déroulement, le décompte, les cartes, les variantes, le solo. Les chiffres sont ceux de l’application au moment où cette liste a été écrite.',
  sousCategories: [
    sc('mec-contenu', 'Composition du jeu', [
      el('mec-tuiles-nombre', 'Nombre de tuiles : 97', '97 tuiles dans le sac de base. Chacune est un carré divisé en 4 quarts de couleur. Confirmer le nombre — il fixe le sac, le nombre de manches et le remplissage des plateaux (6 joueurs × 16 = 96 tuiles posées).'),
      el('mec-tuiles-motifs', '85 motifs distincts, 12 tuiles en double', 'Six motifs existent en deux exemplaires. La variante « Couleurs Équilibrées » les remplace par douze tuiles uniques. Décider une fois pour toutes la composition du sac de base.'),
      el('mec-couleurs-nombre', 'Six couleurs de chemin + le noir', `${PATH_COLORS.map((c) => COLOR_NAMES[c]).join(', ')}, et le noir. Pas de septième couleur, pas de blanc dans la boîte de base (l’arc-en-ciel est une variante).`),
      el('mec-quarts-repartition', 'Répartition des quarts : 55 par couleur, 58 noirs', '6 × 55 = 330 quarts colorés + 58 quarts noirs = 388 quarts. Les couleurs sont strictement équilibrées entre elles. Valider la part du noir (15 % des quarts).'),
      el('mec-noir-repartition', 'Le noir : 40 tuiles sur 97', '57 tuiles sans noir, 22 avec un quart noir, 18 avec deux quarts noirs. Aucune tuile n’a trois quarts noirs ou plus. Confirmer.'),
      el('mec-plateaux-nombre', 'Six plateaux de 4 × 4', 'Un par joueur, identifiés par la couleur de leur cadre : orange, rouge, violet, vert, jaune, bleu. 16 emplacements chacun. Confirmer la taille 4 × 4 (l’application sait aussi jouer en 3 × 3, 5 × 5 et 6 × 6).'),
      el('mec-joueurs', 'De 1 à 6 joueurs', 'Six plateaux, donc six joueurs au plus. Le solo existe (barème de médailles). Confirmer la fourchette à imprimer sur la boîte, et l’âge conseillé.'),
      el('mec-cartes-nombre', `${CARDS.length} cartes missions`, `12 cartes de base, 4 d’extension, 4 de la troisième série. Décider ce qui va dans la boîte : les 12 ? les 20 ? Les 8 cartes retirées de l’application sont listées plus bas.`),
      el('mec-duree', 'Durée d’une partie', '16 manches. Mesurer la durée réelle à 2, 4 et 6 joueurs avec le matériel physique, pour l’afficher sur la boîte.'),
    ]),

    sc('mec-deroulement', 'Déroulement', [
      el('mec-mise-en-place', 'Mise en place', 'Chaque joueur prend un plateau. Les 97 tuiles vont dans le sac. Le premier porteur du sac : joueur 1, ou tiré au sort. Valider la méthode de désignation du premier joueur dans la règle papier.'),
      el('mec-revelation', 'Révélation : autant de tuiles que de joueurs', 'À chaque manche, le porteur du sac révèle autant de tuiles que de joueurs (deux en solo). Confirmer, y compris le cas solo.'),
      el('mec-ordre-choix', 'Ordre de choix : porteur du sac puis sens horaire', 'Le porteur choisit en premier, puis les autres dans le sens horaire ; le dernier prend la tuile restante. Valider.'),
      el('mec-passage-sac', 'Le sac passe au voisin de gauche', 'Après la manche, le sac change de main dans le sens horaire. L’ordre de choix tourne donc à chaque manche. Une variante propose l’inverse (sac antihoraire).'),
      el('mec-manches', '16 manches, jusqu’aux plateaux pleins', 'La partie s’arrête quand les plateaux sont pleins, au bout de 16 manches. Confirmer qu’il n’y a pas de fin anticipée possible (hors carte « Mort subite »).'),
      el('mec-pose-adjacence', 'Pose : toucher une tuile déjà posée, par un côté', 'Toute tuile sauf la première doit toucher une tuile déjà posée par un côté, jamais par un coin seulement. Première tuile libre. Valider — et illustrer dans la règle.'),
      el('mec-pose-orientation', 'Pose : orientation libre', 'La tuile se pose dans l’orientation de son choix (quatre rotations). Pas de retournement dans la règle de base.'),
      el('mec-pose-obligatoire', 'Pose obligatoire', 'Peut-on refuser de poser ? L’application impose la pose. Trancher et l’écrire.'),
    ]),

    sc('mec-decompte', 'Chemins et décompte', [
      el('mec-chemin-definition', 'Définition d’un chemin', 'Un groupe de quarts de même couleur qui se touchent par un côté, y compris à travers la frontière entre deux tuiles. Valider la définition et le mot « chemin » (plutôt que « zone », « région », « route »).'),
      el('mec-chemin-compte', 'Un chemin compte en tuiles distinctes', 'Ce qui rapporte, c’est le nombre de tuiles différentes traversées, pas le nombre de quarts : repasser deux fois par la même tuile ne compte qu’une fois. Point délicat de la règle — à illustrer.'),
      el('mec-bareme', 'Barème : 3 → 3, 4 → 5, 5 → 8, 6 → 12, 7 → 17, 8 → 23, 9 et + → 30', 'Progression convexe. Un chemin de moins de 3 tuiles ne rapporte rien. Confirmer chaque valeur et le plafond à 9.'),
      el('mec-noir', 'Chaque zone noire coûte 2 points, quelle que soit sa taille', 'Une tache noire de 1 quart coûte autant qu’une de 10 : la règle pousse à réunir son noir. Confirmer le malus (−2) et le principe.'),
      el('mec-egalite', 'Départage en cas d’égalité', 'Rien n’est prévu aujourd’hui : l’application affiche les ex æquo. Décider une règle (le moins de zones noires ? le plus long chemin ? égalité partagée ?) et l’écrire.'),
      el('mec-decompte-methode', 'Méthode de décompte à la main', 'Comment compte-t-on sans l’application ? Couleur par couleur, chemin par chemin, sur la fiche de score. Valider une procédure simple et la tester avec des joueurs qui ne connaissent pas le jeu.'),
      el('mec-decompte-fiche', 'Ce que la fiche de score doit permettre', 'Colonnes par couleur, ligne noire, cartes, total — voir Matériel. Décider si la fiche détaille chaque chemin ou seulement le total par couleur.'),
    ]),

    sc('mec-cartes-regles', 'Cartes missions — règles générales', [
      el('mec-cartes-tirage', 'Tirage : une carte pour la table, révélée au départ', 'La règle actuelle : une carte commune, la même mission pour tous. Confirmer le moment du tirage et qu’elle est visible de tous.'),
      el('mec-cartes-deux', 'Jouer avec deux cartes', 'L’application permet 2 cartes dont les bonus se cumulent. Dans la règle imprimée : variante ou interdit ?'),
      el('mec-cartes-persos', 'Missions personnelles', 'Chaque joueur sa carte, secrète ou visible. Décider si cette variante entre dans la boîte.'),
      el('mec-cartes-couleur', 'Cartes à couleur tirée', 'Trois cartes visent une couleur tirée au hasard au début de la partie (« Plus grand chemin », « Chemins d’une couleur », « Couleur bannie »). Comment tire-t-on la couleur physiquement ? Avec les 6 tuiles couleur ? Un dé ?'),
      el('mec-cartes-comparatives', 'Cartes comparatives', '« Plus grand chemin d’une couleur » et « Économe » se jugent en comparant les plateaux de la table, avec +5 par joueur en cas d’égalité. Valider la règle d’égalité.'),
      el('mec-cartes-structurelles', 'Cartes qui changent le décompte', '« Noir positif », « Couleur bannie » et « Couleur secrète » n’ajoutent pas de points : elles changent la façon de compter. La règle doit le dire clairement.'),
      el('mec-cartes-mort-subite', 'Mort subite : seuil au choix', 'Le premier qui compose un chemin de 7 tuiles ou plus gagne (6, 8 ou 9 au choix). Décider si le seuil est fixe sur la carte ou laissé au choix de la table.'),
    ]),

    sc('mec-cartes', 'Cartes missions — une par une', cartesEnJeu()),

    sc('mec-cartes-ecartees', 'Cartes retirées — à confirmer', cartesEcartees()),

    sc('mec-variantes', 'Variantes — une par une', variantes()),

    sc('mec-solo', 'Mode solo', [
      el('mec-solo-principe', 'Principe : un barème à trois médailles', 'Pas d’adversaire ; on vise bronze, argent ou or. Deux tuiles révélées par manche. Confirmer que le solo entre dans la règle imprimée.'),
      el('mec-solo-bareme', 'Barème de base : bronze 30, argent 35, or 45', 'Mesuré sur des parties jouées par le bot Expert : bronze au premier quartile, argent au-dessus de la médiane, or au dernier décile. Les seuils sont arrondis à 5. Valider ces trois nombres avec de vrais joueurs.'),
      el('mec-solo-variantes', 'Le barème suit les variantes et les cartes', 'Chaque variante et chaque carte déplace les seuils (Arc-en-Ciel et Cristaux : +25 points, Couleur interdite : −9). Sur papier, imprimer une table ? Ou un barème unique pour la règle de base seulement ?'),
      el('mec-solo-cartes', 'Solo avec 1 ou 2 cartes', 'L’application propose 0, 1 ou 2 cartes en solo. Décider ce que la règle papier retient.'),
    ]),

    sc('mec-equilibrage', 'Équilibrage et tests', [
      el('mec-eq-premier-joueur', 'Avantage du premier joueur', 'Le porteur du sac choisit en premier, mais le sac tourne : sur 16 manches, chacun choisit en premier le même nombre de fois à 2, 4 et 8 joueurs, pas à 3, 5 et 6. Mesurer si cela se voit dans les scores.'),
      el('mec-eq-scores', 'Fourchette de scores', 'Relever les scores typiques à 2, 4 et 6 joueurs avec le matériel physique, pour calibrer le barème solo et la fiche de score (combien de place pour les chiffres).'),
      el('mec-eq-cartes-valeur', 'Valeur relative des cartes', 'Les écarts mesurés dans l’application vont de +0,3 (Spécialiste) à +18,8 (Noir positif) points en moyenne. Décider si des cartes doivent être revalorisées ou retirées.'),
      el('mec-eq-tests-aveugle', 'Tests à l’aveugle', 'Faire jouer des tables sans aucun auteur présent, règle papier seule. Noter chaque question posée : c’est la liste des points flous de la règle.'),
      el('mec-eq-enfants', 'Âge minimum', 'Le décompte en tuiles distinctes et le noir négatif demandent de l’attention. Tester avec des enfants pour fixer l’âge de la boîte.'),
    ]),
  ],
}

// ---------------------------------------------------------------------------
// Illustrations
// ---------------------------------------------------------------------------

const ILLUSTRATIONS: Categorie = {
  id: 'illustrations',
  titre: 'Illustrations',
  intro:
    'Tout ce qui se voit : les couleurs, le dessin des tuiles et des plateaux, les cartes, la boîte, le thème. Les codes couleur sont ceux de l’application, à convertir pour l’impression.',
  sousCategories: [
    sc('ill-palette', 'Palette', [
      el('ill-couleurs-six', 'Les six couleurs : teintes définitives', PATH_COLORS.map((c) => `${COLOR_NAMES[c]} ${COLOR_HEX[c]}`).join(', ') + `. Noir ${COLOR_HEX.K}. Valider chaque teinte, puis fixer les références d’impression (Pantone ou CMJN) — un écran et une encre ne donnent pas le même rendu.`),
      el('ill-couleurs-contraste', 'Lisibilité des couleurs entre elles', 'Jaune et orange, rouge et orange, bleu et violet sont voisins. Vérifier qu’on les distingue à un mètre, sous une lumière chaude, sur des tuiles de la taille retenue.'),
      el('ill-daltonisme', 'Daltonisme', 'Rouge/vert et bleu/violet sont les confusions les plus fréquentes. Décider d’une aide : symbole discret par couleur, trame, ou rien. Tester avec un simulateur et avec des joueurs concernés.'),
      el('ill-noir', 'Le noir : vraiment noir, ou gris très foncé ?', `${COLOR_HEX.K} dans l’application. Un noir pur sur carton montre les traces de doigts et les rayures. Choisir la teinte et la finition.`),
      el('ill-blanc', 'Le blanc des plateaux', 'Les emplacements du plateau sont blancs, le cadre coloré, la grille noire. Valider un blanc légèrement cassé ou un blanc pur.'),
    ]),

    sc('ill-tuiles', 'Tuiles', [
      el('ill-tuile-agencement', 'Agencement des quatre quarts', 'Quatre carrés pleins qui se touchent, sans liseré ? Un trait fin entre les quarts ? Les quarts arrivent jusqu’au bord de la tuile pour que les chemins se lisent d’une tuile à l’autre : valider.'),
      el('ill-tuile-coins', 'Coins des tuiles', 'Coins vifs ou arrondis. Les coins arrondis cassent moins et se manipulent mieux ; ils laissent un creux aux intersections de quatre tuiles. Décider.'),
      el('ill-tuile-verso', 'Verso des tuiles', 'Uniforme (logo, motif) ou exploitable (face miroir pour la variante du même nom) ? Le verso se voit dans le sac et pendant le tirage : il ne doit pas trahir la face.'),
      el('ill-tuile-marques', 'Marques des variantes : imprimées ou non ?', 'Étoiles (30 tuiles), trèfles (24), cristaux (18), teintures (18), moulins (15), failles (16). Si elles sont imprimées sur les tuiles de base, elles sont là même quand on ne joue pas la variante. Sinon : jetons, ou tuiles séparées. Décision structurante.'),
      el('ill-tuile-etoile', 'Dessin de l’étoile', 'Une étoile par tuile concernée, au centre ou sur un quart ? Lisible sans gêner la lecture des couleurs.'),
      el('ill-tuile-trefle', 'Dessin du trèfle', 'Sur un quart précis : il doit dire clairement à quel quart il appartient.'),
      el('ill-tuile-cristal', 'Dessin du cristal', 'Sur un quart précis, comme le trèfle. Distinguable du trèfle d’un coup d’œil.'),
      el('ill-tuile-teinture', 'Dessin du pot de teinture', 'Un pot renversé qui déteint. Pictogramme.'),
      el('ill-tuile-moulin', 'Dessin du moulin', 'Quatre ailes qui tournent : doit évoquer la rotation des voisines.'),
      el('ill-tuile-faille', 'Dessin de la faille', 'Un trait gris qui coupe la tuile en deux moitiés. Doit se lire comme une coupure, pas comme une couleur.'),
      el('ill-tuile-arc-en-ciel', 'Tuile arc-en-ciel', 'Un seul grand carré irisé. Rendu à l’impression : dégradé, vernis, dorure ? Six exemplaires.'),
      el('ill-tuile-mono', 'Tuiles monochromes et tuiles couleur', '12 monochromes (2 par couleur) et 6 tuiles couleur (départ, couleur secrète). Se distinguent-elles d’un quart entier de la même couleur ? Un logo au centre ?'),
      el('ill-tuile-depart', 'Tuile de départ multicolore', 'Six exemplaires d’une même tuile à quatre couleurs. Laquelle ? Marquée « départ » ?'),
    ]),

    sc('ill-plateaux', 'Plateaux', [
      el('ill-plateau-cadre', 'Cadre de couleur plein', 'Le cadre fait toute la couleur du joueur : large, uni. Épaisseur relative relevée sur le prototype : cadre ≈ 55, barre ≈ 40, emplacement ≈ 230. Valider les proportions.'),
      el('ill-plateau-grille', 'Grille noire épaisse', 'Les barres noires séparent les emplacements et ferment la grille (cinq barres pour quatre emplacements). Elles servent aussi au Scanner de l’application pour se repérer : garder un contraste fort et des barres droites.'),
      el('ill-plateau-fond', 'Fond des emplacements', 'Blanc. Décider s’il porte un repère discret (numéro de case ? rien ?).'),
      el('ill-plateau-verso', 'Verso multicolore', '8 carrés colorés par côté, coins blancs, sans cadre de couleur. Ordre des couleurs par côté à fixer (il décide de la variante « Bords 4 Couleurs » aussi). Six versos différents.'),
      el('ill-plateau-identite', 'Identité de chaque plateau', 'La couleur suffit-elle ? Un nom, un symbole ? Six plateaux, six couleurs, reconnaissables de l’autre côté de la table.'),
      el('ill-plateau-commun', 'Plateau commun (variante)', 'Un grand plateau paysage, 16 cases par joueur. Dessin dédié s’il entre dans la boîte.'),
    ]),

    sc('ill-cartes', 'Cartes missions', [
      el('ill-carte-recto', 'Composition du recto', 'Pastille de points en haut, texte au centre, nom court. L’application affiche badge + texte ; la carte imprimée peut ajouter un schéma. Fixer la grille.'),
      el('ill-carte-series', 'Trois séries, trois couleurs', 'Base, extension, troisième série (« ciel ») ont chacune leur fond dans l’application. Garder un code couleur par série, ou unifier ?'),
      el('ill-carte-schemas', 'Un schéma par carte', 'Un petit plateau d’exemple qui montre la mission réussie. Vingt dessins. Décider lesquels en ont vraiment besoin (« Encerclement », « Bords opposés », « Les carrés », « Symétrie » au moins).'),
      el('ill-carte-couleur-tiree', 'Cartes à couleur tirée', 'Comment représenter « {couleur} » sur une carte imprimée : un emplacement vide, un dé, les six pastilles ?'),
      el('ill-carte-verso', 'Verso des cartes', 'Uniforme, logo. Ne doit pas trahir la série.'),
      el('ill-carte-echange', 'Les deux cartes « Échange »', '« Rotation ! » et « Pas de rotation ! », face cachée, retournées à la moitié de la partie. À dessiner si la variante est conservée.'),
    ]),

    sc('ill-boite', 'Boîte et identité', [
      el('ill-theme', 'Thème et direction artistique', 'CAMINO : le chemin. Abstrait et graphique (comme l’application) ou illustré (paysage, voyage) ? C’est la décision qui conditionne tout le reste.'),
      el('ill-logo', 'Logo', 'L’application utilise un carré de quatre couleurs (orange, bleu, vert, rouge) et le mot en capitales espacées. Logo définitif, déclinaisons, noir et blanc.'),
      el('ill-boite-couverture', 'Couverture', 'Titre, illustration, auteurs, éditeur Big Budi Games, pictos joueurs / âge / durée. Valider la hiérarchie.'),
      el('ill-boite-dos', 'Dos de la boîte', 'Résumé du jeu en quelques lignes, photo du matériel, contenu de la boîte, pictos. Texte à écrire (voir Règles).'),
      el('ill-boite-cotes', 'Côtés de la boîte', 'Titre lisible en rayon, debout et couché.'),
      el('ill-sachet', 'Sac de tirage', 'Couleur, logo brodé ou imprimé. Doit s’accorder avec la boîte.'),
      el('ill-fiche-score', 'Fiche de score', 'Mise en page : six colonnes de couleur, le noir, les cartes, le total. Lisible, à remplir au crayon.'),
      el('ill-regles-illustrations', 'Illustrations de la règle', 'Schémas d’adjacence, de chemin, de décompte, mise en place. Voir la catégorie Règles pour la liste.'),
    ]),
  ],
}

// ---------------------------------------------------------------------------
// Matériel
// ---------------------------------------------------------------------------

const MATERIEL: Categorie = {
  id: 'materiel',
  titre: 'Matériel',
  intro:
    'Ce qu’il y a dans la boîte, en quantité, en dimensions et en matière. Les quantités viennent de l’application ; les dimensions sont à décider.',
  sousCategories: [
    sc('mat-tuiles', 'Tuiles', [
      el('mat-tuile-nombre', '97 tuiles de base', 'Plus les tuiles de variantes si elles entrent dans la boîte : 12 équilibrées, 12 monochromes, 6 arc-en-ciel, 6 tuiles couleur, 6 de départ multicolore — jusqu’à 139 tuiles. Décider le contenu exact.'),
      el('mat-tuile-taille', 'Taille des tuiles', 'À décider. Repères : 40 × 40 mm tient dans la main et donne un plateau de 4 × 4 d’environ 23 cm ; 50 × 50 mm est plus confortable mais le plateau passe 28 cm. La taille des tuiles commande celle des plateaux et de la boîte.'),
      el('mat-tuile-epaisseur', 'Épaisseur et matière', 'Carton gris 2 mm contrecollé (standard), carton 3 mm, bois ? Le poids total du sac en dépend : 97 tuiles de 40 mm en carton 2 mm pèsent environ 350 g.'),
      el('mat-tuile-finition', 'Finition', 'Mate ou satinée. Vernis anti-rayures ? La finition change la lecture des couleurs sous une lampe.'),
      el('mat-tuile-verso-impression', 'Impression du verso', 'Si la variante « Miroir » entre dans la boîte, les 97 versos sont imprimés et différents. Sinon un verso unique. Coût sensiblement différent.'),
      el('mat-tuile-marques-jetons', 'Marques de variantes : jetons séparés ?', 'Si les étoiles, trèfles, cristaux ne sont pas imprimés : des jetons à poser (30 + 24 + 18…), un sachet de plus, des règles de placement. Voir la décision correspondante dans Illustrations.'),
    ]),

    sc('mat-plateaux', 'Plateaux', [
      el('mat-plateau-nombre', 'Six plateaux', 'Un par couleur. Recto cadre de couleur, verso multicolore si la variante est retenue.'),
      el('mat-plateau-taille', 'Dimensions', 'Dépend de la taille des tuiles : 4 emplacements + 5 barres + 2 cadres. Avec des tuiles de 40 mm et les proportions du prototype (barre 7 mm, cadre 10 mm) : environ 215 mm de côté. Fixer après la taille des tuiles.'),
      el('mat-plateau-jeu', 'Jeu entre la tuile et son emplacement', 'Un emplacement légèrement plus grand que la tuile (0,5 à 1 mm) pour poser sans forcer et retirer sans arracher. Tester sur prototype.'),
      el('mat-plateau-epaisseur', 'Épaisseur et matière', 'Carton 2 mm plat, ou plateau à alvéoles (emplacements en creux) qui tient les tuiles en place ? Le creux est plus cher mais empêche les tuiles de glisser.'),
      el('mat-plateau-recto-verso', 'Impression recto-verso', 'Le verso multicolore impose l’impression des deux faces de six plateaux différents.'),
      el('mat-plateau-commun', 'Plateau commun', 'Un grand plateau paysage de plus si la variante est retenue : 8 × 4 à deux, jusqu’à 8 × 8 à quatre. Encombrement dans la boîte.'),
    ]),

    sc('mat-cartes', 'Cartes', [
      el('mat-carte-nombre', 'Nombre de cartes', `${CARDS.length} cartes missions dans l’application (12 de base, 4 d’extension, 4 de la troisième série), 2 cartes « Échange », éventuellement une carte résumé ou aide de jeu. Fixer le total.`),
      el('mat-carte-format', 'Format des cartes', 'Poker 63 × 88 mm, bridge 57 × 88, mini 44 × 67 ? Le texte de certaines cartes est long (« Bord assorti » : trois lignes) : un petit format impose une petite typographie.'),
      el('mat-carte-papier', 'Papier et finition', '300 g toilé, vernis, coins arrondis. Standard des cartes à jouer.'),
      el('mat-carte-protection', 'Protège-cartes', 'Format compatible avec des protège-cartes du commerce si le format est standard.'),
    ]),

    sc('mat-sac', 'Sac', [
      el('mat-sac-taille', 'Taille du sac', 'Doit contenir 97 tuiles (ou jusqu’à 139) et laisser la main piocher sans voir. Dimensions à fixer après la taille des tuiles.'),
      el('mat-sac-matiere', 'Matière et fermeture', 'Tissu opaque, cordon. Opacité à vérifier : on ne doit pas deviner les couleurs à travers.'),
      el('mat-sac-role', 'Le sac comme marqueur de premier joueur', 'Le porteur du sac choisit en premier : le sac tient lieu de marqueur. Pas de jeton supplémentaire — confirmer.'),
    ]),

    sc('mat-fiche', 'Fiche de score', [
      el('mat-fiche-contenu', 'Colonnes et lignes', 'Par joueur : six couleurs, noir, cartes, total. Décider si chaque chemin a sa ligne ou seulement le total par couleur. Prévoir les variantes qui ajoutent des lignes (étoiles, trèfles).'),
      el('mat-fiche-format', 'Format et nombre de feuilles', 'Bloc de 50 ? 100 ? Format A6 ? Ou une fiche effaçable ? L’application remplace la fiche : le bloc papier doit rester simple.'),
      el('mat-fiche-crayon', 'Crayon', 'Fournir un crayon dans la boîte, ou non.'),
    ]),

    sc('mat-boite', 'Boîte et rangement', [
      el('mat-boite-dimensions', 'Dimensions de la boîte', 'Doivent accueillir six plateaux à plat (le plateau fixe la base), le sac, les cartes, la règle. Format carré. Fixer après plateaux.'),
      el('mat-boite-insert', 'Insert ou thermoformage', 'Rangement des plateaux, du sac, des cartes. Un insert carton suffit-il ? Les tuiles vivent dans le sac.'),
      el('mat-boite-poids', 'Poids total', 'Estimer : six plateaux, 97 tuiles, cartes, sac, règle, boîte. Compte pour le transport et le prix.'),
      el('mat-boite-mentions', 'Mentions légales', 'Marquage CE, avertissement d’âge, fabricant, pays de fabrication, référence, code-barres. À réunir avant l’impression.'),
      el('mat-boite-langues', 'Langues', 'Boîte et règle en français seulement, ou multilingue (FR/EN/DE/NL…) ? Les cartes portent du texte : une version par langue, ou des cartes sans texte avec un livret ?'),
    ]),

    sc('mat-fabrication', 'Fabrication', [
      el('mat-fab-fabricant', 'Fabricant', 'Choisir le fabricant, demander un prototype industriel (blanc puis couleur).'),
      el('mat-fab-tirage', 'Quantité du premier tirage', 'Décide le coût unitaire. À arrêter avec l’éditeur.'),
      el('mat-fab-cout', 'Coût de revient et prix de vente', 'Estimer le coût unitaire par poste (tuiles, plateaux, cartes, sac, boîte, règle) et le prix public cible.'),
      el('mat-fab-normes', 'Normes jouets', 'EN 71 (sécurité des jouets) si le jeu est destiné à des enfants ; encres et vernis conformes. Vérifier avec le fabricant.'),
      el('mat-fab-prototype', 'Prototype final validé', 'Un exemplaire complet, fabriqué, joué : la validation de tout ce qui précède.'),
    ]),
  ],
}

// ---------------------------------------------------------------------------
// Règles
// ---------------------------------------------------------------------------

const REGLES: Categorie = {
  id: 'regles',
  titre: 'Règles',
  intro:
    'Le livret : ce qu’il dit, comment il le dit, combien de pages, quels dessins, et ce qu’on en met au dos de la boîte.',
  sousCategories: [
    sc('reg-redaction', 'Rédaction', [
      el('reg-structure', 'Plan du livret', 'Ordre retenu dans l’application : mise en place, déroulement d’une manche, ce qu’est un chemin, décompte, variantes, solo. Ajouter : matériel, fin de partie, égalités, exemple complet. Valider le plan.'),
      el('reg-ton', 'Tutoiement ou vouvoiement', 'L’application tutoie en partie (« choisis une tuile », « pose-la ») et vouvoie dans ses règles (« cochez »). Le livret doit choisir une fois.'),
      el('reg-genre', 'Écriture inclusive et genre des mots', 'Décider : « le joueur », « la joueuse », « le ou la joueur·euse », formulations neutres (« chacun », « qui »). S’y tenir de la première à la dernière page, et sur les cartes.'),
      el('reg-vocabulaire', 'Vocabulaire fixé', 'Tuile, quart, chemin, zone (noire), manche, porteur du sac, plateau, emplacement, révéler, poser. Un mot pour une chose, le même dans la règle, sur les cartes et dans l’application. Établir le lexique.'),
      el('reg-pages', 'Nombre de pages', 'Cible à fixer : 4 pages (dépliant) pour la règle de base, 8 à 12 avec les variantes et le solo ? Le nombre de variantes retenues décide.'),
      el('reg-format', 'Format du livret', 'A5, carré au format de la boîte, dépliant ? Doit entrer dans la boîte à plat.'),
      el('reg-niveau-langue', 'Niveau de langue', 'Phrases courtes, une idée par phrase, le mot-clé en gras. Cible : un enfant de l’âge conseillé peut suivre en lisant.'),
    ]),

    sc('reg-contenu', 'Contenu : chaque règle écrite', [
      el('reg-materiel-liste', 'Liste du matériel', 'Avec les quantités définitives et une photo ou un dessin de chaque élément.'),
      el('reg-mise-en-place-texte', 'Mise en place', 'Qui prend quoi, le sac, le premier porteur. Un schéma de table à quatre.'),
      el('reg-manche-texte', 'Déroulement d’une manche', 'Révéler, choisir dans l’ordre, poser, passer le sac. Numéroter les étapes.'),
      el('reg-pose-texte', 'Règle de pose', 'Toucher par un côté, première tuile libre, orientation libre. Le cas du coin seul : interdit, à dessiner.'),
      el('reg-chemin-texte', 'Définition du chemin', 'Le point le plus difficile : quarts de même couleur, adjacents par un côté, à travers les tuiles, comptés en tuiles distinctes. Un exemple où un chemin repasse par la même tuile.'),
      el('reg-decompte-texte', 'Décompte', 'Le barème en tableau, le noir, un exemple complet de plateau décompté ligne par ligne.'),
      el('reg-fin-texte', 'Fin de partie et vainqueur', 'Après 16 manches, plateaux pleins, le total le plus élevé gagne. Règle d’égalité (à décider dans Mécaniques).'),
      el('reg-cartes-texte', 'Cartes missions', 'Quand on les tire, qui les voit, comment on les compte, et le cas des cartes qui changent le décompte. Puis chaque carte expliquée si son texte ne suffit pas.'),
      el('reg-variantes-texte', 'Variantes', 'Une entrée par variante retenue : titre, matériel, règle en trois phrases. Dans l’ordre du catalogue.'),
      el('reg-solo-texte', 'Solo', 'Mise en place à un, les trois médailles, le barème (et son ajustement si variantes).'),
      el('reg-faq', 'Questions fréquentes et cas limites', 'Ce qui remonte des tests à l’aveugle : coin contre côté, chemin qui repasse, zone noire d’un seul quart, deux chemins de même couleur sur une tuile, tuile impossible à poser.'),
    ]),

    sc('reg-illustrations', 'Illustrations du livret', [
      el('reg-ill-mise-en-place', 'Schéma de mise en place', 'La table vue de dessus, quatre plateaux, le sac, les tuiles révélées au centre.'),
      el('reg-ill-adjacence', 'Schéma : pose autorisée / interdite', 'Trois cas : côté (oui), coin seul (non), isolée (non).'),
      el('reg-ill-chemin', 'Schéma : qu’est-ce qu’un chemin', 'Un chemin surligné sur trois tuiles, avec le compte en tuiles.'),
      el('reg-ill-decompte', 'Exemple de décompte complet', 'Un plateau 4 × 4 plein, chaque chemin entouré, le total par couleur, le noir, la somme. L’application peut le générer.'),
      el('reg-ill-cartes', 'Exemples pour les cartes', 'Au moins pour les cartes géométriques : carrés, bords opposés, angles, encerclement, symétrie.'),
      el('reg-ill-pictos', 'Pictogrammes', 'Joueurs, âge, durée, et un picto par variante si la règle en compte beaucoup.'),
    ]),

    sc('reg-resume', 'Résumés et aides', [
      el('reg-resume-dos', 'Texte du dos de boîte', 'Quatre à six lignes : la promesse du jeu, la règle en une phrase, la variété des variantes. Puis contenu et pictos.'),
      el('reg-aide-jeu', 'Aide de jeu', 'Une carte ou le dernier volet du livret : barème, ordre d’une manche, rappel du noir. Une par joueur ?'),
      el('reg-resume-cartes', 'Rappel du barème sur les plateaux ?', 'Imprimer le barème sur le cadre ou au dos de chaque plateau évite la fiche. À décider avec Illustrations.'),
    ]),

    sc('reg-relecture', 'Relecture et validation', [
      el('reg-relecture-ortho', 'Relecture orthographique et typographique', 'Par une personne extérieure. Apostrophes, espaces insécables, tirets, guillemets français.'),
      el('reg-coherence-app', 'Cohérence règle / cartes / application', 'Les mêmes mots, les mêmes nombres, les mêmes textes de cartes aux trois endroits. L’application fait foi pour les textes de cartes tant que la liste ci-dessus n’a pas tranché.'),
      el('reg-test-aveugle-regles', 'Test de lecture à l’aveugle', 'Trois tables qui n’ont jamais vu le jeu, la règle papier seule, un observateur silencieux. Chaque question notée devient une correction.'),
      el('reg-traduction', 'Traduction', 'Si d’autres langues : traducteur spécialisé jeux, relecture par un joueur natif, cohérence des cartes.'),
      el('reg-bat', 'Bon à tirer', 'Dernière lecture sur l’épreuve du fabricant, avant impression.'),
    ]),
  ],
}

// ---------------------------------------------------------------------------

/** La liste telle qu'elle est proposée à qui ne l'a jamais ouverte. */
export function listeDOrigine(): Liste {
  return {
    format: 1,
    modele: MODELE,
    titre: 'Développement de CAMINO',
    modifie: new Date().toISOString(),
    categories: [MECANIQUES, ILLUSTRATIONS, MATERIEL, REGLES].map((c) => ({
      ...c,
      sousCategories: c.sousCategories.map((s) => ({
        ...s,
        elements: s.elements.map((e) => ({ ...e })),
      })),
    })),
  }
}
