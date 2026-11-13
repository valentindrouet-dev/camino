# @bbg/camino-scoring

Le cœur de l’application CAMINO, sans son interface : la **lecture d’un
plateau photographié** et le **décompte des points**, cartes missions
comprises. Du TypeScript pur — aucune dépendance, aucun accès au navigateur.

## Installation

Le paquet est publié, compilé, sur la branche `camino-scoring-dist` du dépôt,
avec une étiquette Git par version :

```
npm install github:valentindrouet-dev/camino#camino-scoring-v1.0.0
```

Une nouvelle version, c’est une nouvelle étiquette : on monte le numéro.

## Deux entrées

### `@bbg/camino-scoring/decompte`

Le moteur de jeu. Pour compter un plateau seul, avec ses missions :

```ts
import { scoreLibre, missionsScannables } from '@bbg/camino-scoring/decompte'
import type { Board, Color, DecompteLibre } from '@bbg/camino-scoring/decompte'

const d = scoreLibre(board, [{ cardId: 'exact-4' }, { cardId: 'banned-color', color: 'P' }], 'O')
d.bilan.total        // le score
d.bilan.byColor.Y    // { points, zones, … } pour le jaune — clés Y O R G B P
d.bilan.blackPoints  // le noir
d.bilan.cardPoints   // les cartes
d.missions           // une ligne par carte : { card, points, detail, structural, color }
```

Le troisième argument est la couleur du cadre du plateau (`'O' 'R' 'P' 'G'
'Y' 'B'`) : la carte « Bord assorti » en a besoin, sans elle elle ne compte
rien. `missionsScannables()` donne les cartes qu’on peut juger sur une photo.

#### Les huit lignes d’une feuille de score

Jaune, Orange, Rouge, Vert, Bleu, Violet, Noir, Missions — dont la somme est le
total. Trois cartes ne rapportent pas de points mais changent la façon de
compter ; leur effet est **déjà** dans les lignes de couleur et de noir :
« Noir positif » rend le noir positif, « Couleur bannie » rend sa couleur
négative, « Couleur secrète » double un chemin — ce dernier bonus est compté à
part (`secretPoints`) et se rend à la ligne de sa couleur.

```ts
const ORDRE: Color[] = ['Y', 'O', 'R', 'G', 'B', 'P']

function lignesFeuille(d: DecompteLibre): number[] {
  const b = d.bilan
  const lignes = ORDRE.map((c) => b.byColor[c]?.points ?? 0)
  const secrete = d.missions.find((m) => m.card.id === 'secret-color')?.color
  if (secrete) lignes[ORDRE.indexOf(secrete)] += b.secretPoints
  return [...lignes, b.blackPoints, b.cardPoints]
}
// lignesFeuille(d).reduce((a, x) => a + x, 0) === d.bilan.total — toujours.
```

### `@bbg/camino-scoring/vision`

Lire une photo. On lui donne des pixels RGBA (ce que rend
`canvas.getImageData().data`), la largeur, la hauteur, et la taille du
plateau (4 pour un 4 × 4) :

```ts
import { detecterPlateau, calerCoins, lire, douteuse } from '@bbg/camino-scoring/vision'

// 1. Trouver la grille noire tout seul (ou partir de quatre coins posés à la main).
const auto = detecterPlateau(pixels, largeur, hauteur, 4)
let coins = auto?.coins ?? coinsPosesALaMain

// 2. Affiner des coins approximatifs — à une demi-tuile près suffit.
coins = calerCoins(pixels, largeur, hauteur, coins, 4).coins

// 3. Lire.
const { cases, residu } = lire(pixels, largeur, hauteur, coins, 4)
// cases[i] : { vide, tileId, rot, cout, marge, candidats }
// residu    : écart moyen à la palette — sous 8 la lecture est sûre, au-delà de 15 hasardeuse
// douteuse(case) : vrai pour les cases à faire vérifier par le joueur

// 4. En faire un plateau pour le décompte.
const board: Board = {
  size: 4,
  cells: cases.map((c, i) => (c.vide ? null : { tileId: c.tileId, rot: c.rot, round: i })),
}
```

Réduisez la photo à 1 000 px de côté avant de la lire : lire douze mégapixels
ne sert à rien, et c’est sous les limites de canvas d’iOS.

## Ce que le paquet ne contient pas

L’écran : le choix de la photo, les coins déplaçables, la grille de
vérification, l’affichage du plateau. Il vit dans l’application CAMINO
(`src/ui/screens/ScanScreen.tsx`, `src/ui/components/BoardView.tsx`) et se
reprend tel quel dans une application React.

## Mise à jour du paquet

Dans le dépôt CAMINO, après avoir monté `version` dans
`packages/camino-scoring/package.json` :

```
npm run release:scoring
```

Le script passe les tests, compile, et pousse le résultat sur la branche
`camino-scoring-dist` avec l’étiquette `camino-scoring-v<version>`.
