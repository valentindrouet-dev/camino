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
      { cle: 'mono', label: 'Monochromes' },
      { cle: 'rainbow', label: 'Arc-en-Ciel' },
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
      { cle: 'multiBorders', label: 'Bords Multicolores' },
      { cle: 'swap', label: 'Échange' },
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
}

export const REGLAGES_VIDES: Reglages = { groupesMasques: [], variantesMasquees: [] }

const CLE_STOCKAGE = 'camino.reglages.v1'

export function chargerReglages(): Reglages {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return REGLAGES_VIDES
    const r = JSON.parse(brut) as Partial<Reglages>
    return {
      groupesMasques: Array.isArray(r.groupesMasques) ? r.groupesMasques : [],
      variantesMasquees: Array.isArray(r.variantesMasquees) ? r.variantesMasquees : [],
    }
  } catch {
    return REGLAGES_VIDES
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
  const groupe = CATALOGUE.find((g) => g.variantes.some((v) => v.cle === cle))
  if (groupe && !groupeVisible(r, groupe.titre)) return false
  return !r.variantesMasquees.includes(cle)
}

/** Signature courte : sert à repérer un changement de réglages. */
export function signature(r: Reglages): string {
  return `${[...r.groupesMasques].sort().join(',')}|${[...r.variantesMasquees].sort().join(',')}`
}

/**
 * Le mot de passe de la page Réglages.
 *
 * Ce n'est PAS un secret : l'application est un site statique, cette chaîne
 * part dans le fichier téléchargé par le navigateur et le dépôt est public.
 * C'est un loquet — de quoi éviter qu'un joueur curieux déplace les réglages
 * de la table pendant une partie, rien de plus.
 */
export const MOT_DE_PASSE = 'Justine'

export function motDePasseValide(saisi: string): boolean {
  return saisi.trim().toLowerCase() === MOT_DE_PASSE.toLowerCase()
}
