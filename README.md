# CAMINO — table de jeu, playtest & équilibrage

Interface web pour jouer, playtester et équilibrer **CAMINO** (Marie-Laure Clément, Claude Clément
et Alexandre Droit). 1 à 6 joueurs sur le même ordinateur, calcul automatique des zones et des
scores, statistiques pendant et après la partie, et un laboratoire de simulation pour régler le
barème.

**En ligne :** https://valentindrouet-dev.github.io/camino/ — chaque push sur la branche
reconstruit et republie le site via l'action `.github/workflows/deploy.yml` (tests inclus).

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # vérifie le moteur, dont l'exemple de décompte de la règle
npm run build     # bundle statique dans dist/
```

## Ce que fait l'application

**Table de jeu.** Chaque manche, autant de tuiles que de joueurs sont révélées au centre. Le
porteur du sac choisit en premier, les autres suivent dans le sens horaire, puis le sac passe à
gauche — 16 manches jusqu'à ce que les plateaux 4×4 soient pleins.

- tuiles sélectionnables au clic ou aux touches `1`–`9` ;
- rotation à 360° par pas de 90° : bouton, touche `R` (`Maj+R` en sens inverse) ou molette
  au-dessus du plateau, avec animation continue ;
- aperçu fantôme de la tuile sur la case survolée **et gain immédiat annoncé** (`+8`, `−2`…) ;
- cases légales mises en évidence (pose obligatoirement adjacente) ;
- tous les plateaux sont visibles, cliquables pour être inspectés en grand ;
- annulation illimitée (`Ctrl/Cmd+Z`) — indispensable en playtest ;
- bots (hasard / glouton / stratège) pour compléter une table ou tester une configuration seul ;
- indices optionnels : le meilleur coup est entouré en vert.

Chaque joueur choisit son plateau parmi les six de la boîte (orange, rouge, violet, vert, jaune,
bleu) — deux joueurs ne peuvent pas prendre le même. Le plateau affiché reprend le modèle imprimé :
contour de couleur, grille grise, emplacements blancs.

**Décompte.** Les zones sont recalculées à chaque pose. Contours blancs sur les chemins qui
marquent, contours orange sur les zones noires, pastille de points sur chaque zone, et infobulle
au survol. Le score et les points par zone s'affichent ou se masquent depuis la barre du haut.

**Cartes missions.** Les 12 cartes de la boîte sont implémentées. Une seule carte est tirée pour la
table — tout le monde joue la même mission — et son bonus est calculé en direct, visible pendant la
partie comme en fin de partie. En setup, on peut imposer une carte précise pour la tester.

**Statistiques.** Pendant la partie : score détaillé par couleur, courbe d'évolution manche par
manche, journal des coups avec le delta de chaque pose. En fin de partie : podium, comparatif
couleur par couleur, rendement moyen de chaque couleur, écart entre premier et dernier, gâchis
(tuiles bloquées dans des chemins trop courts). Chaque partie terminée est archivée localement et
alimente des statistiques cumulées, exportables en CSV.

**Matériel.** La page d'accueil montre tout le matériel : les 6 plateaux, les 97 tuiles et les
12 cartes.

**Laboratoire d'équilibrage.** Simulation de 50 à 2 000 parties entre bots, avec barème modifiable
(points par palier, malus des zones noires, longueur minimale d'un chemin, taille du plateau,
nombre de tuiles par manche). En sortie : distribution des scores, poids de chaque couleur,
longueur des chemins, avantage éventuel de la place à table. Chaque campagne est reproductible via
sa graine.

## Le décompte, tel qu'il est implémenté

La règle a été traduite ainsi, puis **vérifiée sur l'exemple de fin de règle** (le test
`tests/example.test.mjs` rejoue exactement ce plateau et retrouve 0/6/3/11/3/5 et −8, total 20) :

- chaque tuile est un carré de 4 quarts de couleur ; un plateau 4×4 forme donc une grille 8×8 ;
- un **chemin** est un groupe de quarts de même couleur reliés orthogonalement, y compris à
  travers la frontière entre deux tuiles ;
- ce qui rapporte, c'est le nombre de **tuiles distinctes** que le chemin traverse (et non son
  nombre de quarts) : 3 → 3 pts, 4 → 5, 5 → 8, 6 → 12, 7 → 17, 8 → 23, 9 et plus → 30 ;
- chaque **zone noire** coûte 2 points, quelle que soit sa taille — regrouper son noir est donc
  payant.

Les 97 tuiles ont été extraites de la planche d'impression fournie : 55 quarts de chaque couleur
et 58 quarts noirs (388 quarts au total), ce que le test `engine.test.mjs` vérifie.

## Organisation du code

```
src/engine/     moteur pur (aucune dépendance à React ni au DOM)
  types.ts      types + barème par défaut (Ruleset modifiable)
  tiles.ts      les 97 tuiles + rotations
  board.ts      plateau, poses légales, grille des quarts
  scoring.ts    zones connexes et calcul des points
  game.ts       machine à états : pioche, ordre du tour, application d'un coup
  ai.ts         évaluation heuristique, bots, indices
  stats.ts      statistiques de partie et simulation en masse
  cards.ts      cartes missions (voir ci-dessous)
src/ui/         interface React (écrans, plateau SVG, graphiques maison)
tests/          tests du moteur exécutés par node --test
```

Le moteur est volontairement **pur et déterministe** : `createGame(config)` puis `applyMove()`
renvoient des états immuables, et une partie est entièrement rejouable à partir de sa graine et de
la liste des coups. C'est ce qui permettra de le faire tourner tel quel dans un serveur Node pour
le jeu à distance, sans réécrire la logique.

## Lecture des cartes missions

Trois cartes demandaient une interprétation ; elles sont implémentées ainsi (`src/engine/cards.ts`,
tests dans `tests/cards.test.mjs`) :

- **« +6 points par carré composé d'au moins 2 tuiles »** — un carré est une zone de couleur dont la
  forme est *exactement* un bloc de 2 × 2 quarts, à cheval sur au moins 2 tuiles. C'est ce
  qu'illustre la carte : les carrés valides sont entourés, et un bloc vert prolongé par d'autres
  quarts verts est barré d'une croix.
- **« chaque chemin qui… »** (orange, angles, bords opposés, encerclement) — « chemin » désigne un
  chemin qui marque, donc d'au moins 3 tuiles, comme dans la règle de base. Un quart isolé dans un
  angle ne rapporte rien.
- **« Les zones noires deviennent positives »** — le malus est annulé puis chaque zone noire
  rapporte +2 (soit +4 par zone par rapport au décompte normal).

## Suite prévue

- **Jeu en ligne.** Prochaine étape : un petit serveur Node qui importe `src/engine` tel quel,
  garde l'état d'une table, valide les coups reçus et diffuse les états aux clients connectés
  (WebSocket). Le client n'a alors qu'à remplacer l'appel local à `applyMove` par un envoi réseau.
