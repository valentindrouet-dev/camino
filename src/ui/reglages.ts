/**
 * Réglages de l'accueil : quelles familles de variantes, et quelles variantes,
 * apparaissent dans la colonne de droite de la page d'accueil.
 *
 * C'est une préférence d'affichage, pas une règle du jeu : rien ici n'entre
 * dans le moteur. Le Laboratoire, lui, continue de tout montrer — c'est l'outil
 * d'équilibrage, il doit pouvoir tester ce qui n'est plus proposé à la table.
 *
 * Le catalogue ci-dessous est la SOURCE des deux écrans : la page Réglages
 * l'affiche, le panneau des variantes s'y réfère par la même clé. Ajouter une
 * variante, c'est l'ajouter ici et poser la même clé sur son interrupteur.
 */

export interface VarianteCatalogue {
  /** Clé stable — elle sert de mémoire, elle ne doit jamais changer. */
  cle: string
  label: string
}

export interface GroupeCatalogue {
  titre: string
  variantes: VarianteCatalogue[]
}

export const CATALOGUE: GroupeCatalogue[] = [
  {
    // Ce ne sont pas des variantes mais des conforts d'affichage. Ils vivent
    // ici pour la même raison : c'est l'organisateur qui décide de ce que la
    // table voit, et trois d'entre eux n'ont rien à faire sous les yeux d'un
    // joueur qui découvre le jeu.
    titre: 'OPTIONS DE PARTIE',
    variantes: [
      { cle: 'optScore', label: 'Score' },
      { cle: 'optZones', label: 'Points par Zone' },
      { cle: 'optPremier', label: '1er Joueur Aléatoire' },
      { cle: 'optDerniere', label: 'Dernière Tuile' },
      { cle: 'optIndices', label: 'Indices' },
      { cle: 'optGraine', label: 'Graine' },
    ],
  },
  {
    titre: 'CARTES MISSIONS',
    variantes: [
      { cle: 'cards', label: 'Cartes missions' },
      { cle: 'cardsMulti', label: 'Missions Multiples' },
      { cle: 'cardsPerso', label: 'Missions Persos' },
    ],
  },
  {
    titre: 'TUILES',
    variantes: [
      { cle: 'freePlace', label: 'Pose Libre' },
      { cle: 'lastRandom', label: 'Dernière Aléatoire' },
      { cle: 'randomBack', label: 'Verso Aléatoire' },
      { cle: 'balanced', label: 'Couleurs Équilibrées' },
      { cle: 'mono', label: 'Monochromes' },
      { cle: 'personal', label: 'Personnelle' },
      { cle: 'mirror', label: 'Miroir' },
      { cle: 'extra', label: 'Supplémentaire' },
      { cle: 'start', label: 'Départ' },
    ],
  },
  {
    titre: 'PLATEAUX',
    variantes: [
      { cle: 'borders', label: 'Bords Colorés' },
      { cle: 'quadBorders', label: 'Bords 4 Couleurs' },
      { cle: 'multiBorders', label: 'Bords Multicolores' },
      { cle: 'shared', label: 'Commun' },
    ],
  },
  {
    titre: 'SYMBOLES',
    variantes: [
      { cle: 'stars', label: 'Étoiles' },
      { cle: 'clovers', label: 'Trèfles' },
    ],
  },
  {
    titre: 'SCORE',
    variantes: [
      { cle: 'secret', label: 'Couleur Secrète' },
      { cle: 'forbidden', label: 'Couleur Interdite' },
      { cle: 'scale', label: 'Barème Perso' },
      { cle: 'reverse', label: 'Inversé' },
    ],
  },
  {
    titre: 'NON CONSERVÉES',
    variantes: [
      { cle: 'bagCcw', label: 'Sac Antihoraire' },
      { cle: 'faults', label: 'Failles' },
      { cle: 'crystals', label: 'Cristaux' },
      { cle: 'windmills', label: 'Moulins' },
      { cle: 'dyes', label: 'Teintures' },
      { cle: 'sync', label: 'Synchrone' },
      { cle: 'rainbow', label: 'Arc-en-Ciel' },
      { cle: 'swap', label: 'Échange' },
    ],
  },
]

/**
 * Ce qui est masqué. On ne retient QUE les cases décochées : une variante
 * ajoutée plus tard apparaît donc d'office, sans que personne ait à y penser.
 */
export interface Reglages {
  groupesMasques: string[]
  variantesMasquees: string[]
  /**
   * Variantes déménagées d'une famille à l'autre : clé → titre de la famille
   * d'accueil. Ce qui n'y figure pas reste là où le catalogue l'a mis.
   */
  deplacees?: Record<string, string>
}

/** Toutes les variantes, dans l'ordre du catalogue. */
export const TOUTES: VarianteCatalogue[] = CATALOGUE.flatMap((g) => g.variantes)

/** Famille où vit une variante, déménagements compris. */
export function familleDe(r: Reglages, cle: string): string {
  const voulue = r.deplacees?.[cle]
  if (voulue && CATALOGUE.some((g) => g.titre === voulue)) return voulue
  return CATALOGUE.find((g) => g.variantes.some((v) => v.cle === cle))?.titre ?? ''
}

/**
 * Le catalogue tel qu'il s'affiche : mêmes familles, dans le même ordre, mais
 * chaque variante rangée là où on l'a mise. À l'intérieur d'une famille,
 * l'ordre reste celui du catalogue d'origine — il ne dépend donc pas de
 * l'ordre des déménagements.
 */
export function catalogueEffectif(r: Reglages): GroupeCatalogue[] {
  return CATALOGUE.map((g) => ({
    titre: g.titre,
    variantes: TOUTES.filter((v) => familleDe(r, v.cle) === g.titre),
  }))
}

/** Rien de masqué : le catalogue au complet. */
export const REGLAGES_VIDES: Reglages = { groupesMasques: [], variantesMasquees: [] }

/**
 * Ce que voit quelqu'un qui ouvre le lien pour la première fois — sur son
 * ordinateur, son téléphone, n'importe où. Les réglages étant gardés dans le
 * navigateur de chacun, c'est le SEUL moyen d'agir sur la table entière : les
 * cases cochées ici, dans le code, partent avec la version publiée.
 *
 * Aujourd'hui : tout le jeu, sauf la famille des variantes écartées et trois
 * options d'affichage qui ne servent qu'au réglage — la dernière tuile, les
 * indices et la graine. Elles restent à un clic d'ici pour qui en a besoin.
 */
export const REGLAGES_DEFAUT: Reglages = {
  groupesMasques: ['NON CONSERVÉES'],
  variantesMasquees: ['optDerniere', 'optIndices', 'optGraine'],
}

/*
 * Le numéro de la clé sert à imposer un nouveau réglage d'origine à TOUS les
 * navigateurs : ce qui était mémorisé sous l'ancienne clé n'est plus lu, et
 * chacun repart de REGLAGES_DEFAUT. On le change donc quand — et seulement
 * quand — le réglage d'origine doit primer sur les choix déjà faits.
 */
const CLE_STOCKAGE = 'camino.reglages.v3'
const CLES_ANCIENNES = ['camino.reglages.v1', 'camino.reglages.v2']

export function chargerReglages(): Reglages {
  try {
    // Les réglages d'une version précédente ne valent plus : on fait le ménage.
    for (const vieille of CLES_ANCIENNES) localStorage.removeItem(vieille)
    const brut = localStorage.getItem(CLE_STOCKAGE)
    // Rien de mémorisé : c'est un nouveau venu, il voit ce que le site propose.
    if (!brut) return REGLAGES_DEFAUT
    const r = JSON.parse(brut) as Partial<Reglages>
    return {
      groupesMasques: Array.isArray(r.groupesMasques) ? r.groupesMasques : [],
      variantesMasquees: Array.isArray(r.variantesMasquees) ? r.variantesMasquees : [],
      deplacees: r.deplacees && typeof r.deplacees === 'object' ? r.deplacees : {},
    }
  } catch {
    return REGLAGES_DEFAUT
  }
}

export function enregistrerReglages(r: Reglages): void {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(r))
  } catch {
    /* navigation privée, quota… : tant pis, on garde les réglages en mémoire */
  }
}

export function groupeVisible(r: Reglages, titre: string): boolean {
  return !r.groupesMasques.includes(titre)
}

/** Une variante s'affiche si elle est cochée ET que sa famille l'est aussi. */
export function varianteVisible(r: Reglages, cle: string): boolean {
  if (!groupeVisible(r, familleDe(r, cle))) return false
  return !r.variantesMasquees.includes(cle)
}

/** Signature courte : sert à repérer un changement de réglages. */
export function signature(r: Reglages): string {
  const dep = Object.entries(r.deplacees ?? {})
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([c, g]) => `${c}>${g}`)
    .join(',')
  return [
    [...r.groupesMasques].sort().join(','),
    [...r.variantesMasquees].sort().join(','),
    dep,
  ].join('|')
}

/**
 * Le mot de passe de la page Réglages.
 *
 * Ce n'est PAS un secret : l'application est un site statique, cette chaîne
 * part dans le fichier téléchargé par le navigateur et le dépôt est public.
 * C'est un loquet — de quoi éviter qu'un joueur curieux déplace les réglages
 * de la table pendant une partie, rien de plus.
 */
export const MOT_DE_PASSE = 'montaud'

export function motDePasseValide(saisi: string): boolean {
  return saisi.trim().toLowerCase() === MOT_DE_PASSE.toLowerCase()
}
