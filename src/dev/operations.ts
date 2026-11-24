/**
 * Les opérations : ce qu'on FAIT à la liste de développement, sous une forme
 * qui voyage.
 *
 * La liste est partagée entre les auteurs. Plutôt que d'envoyer la liste
 * entière à chaque coche — et de devoir réconcilier deux listes modifiées
 * chacune de son côté —, chaque geste devient une opération : « passer ce
 * point à validé », « ajouter ce point ici », « renommer cette catégorie ».
 * Le serveur les numérote dans l'ordre où elles arrivent, chacun les rejoue
 * dans cet ordre, et tout le monde voit la même liste. Une opération rejouée
 * sur un autre appareil, un autre jour, doit donner exactement le même
 * résultat : tout ce qui pourrait varier (identifiant, date) est tiré une
 * fois, à la source, et voyage avec elle.
 *
 * Ce fichier ne connaît ni le réseau ni l'écran : il décrit les opérations,
 * les applique à une liste, les relit quand elles arrivent du serveur, et les
 * raconte pour le journal.
 */
import {
  deplacerCategorie,
  deplacerElement,
  deplacerSousCategorie,
  elementDepuis,
  ETATS,
  insererCategorie,
  insererElement,
  insererSousCategorie,
  maintenant,
  modifierElement,
  renommerCategorie,
  renommerSousCategorie,
  supprimerCategorie,
  supprimerElement,
  supprimerSousCategorie,
  transfererElement,
  valider,
} from './modele.ts'
import type { Element, Etat, Liste } from './modele.ts'

/** Les champs d'un point qu'une opération peut changer. */
export type Correctif = Partial<Pick<Element, 'titre' | 'detail' | 'note' | 'qui' | 'etat' | 'maj' | 'alerte'>>

/** Pourquoi la liste entière a été remplacée. */
export type Motif = 'fichier' | 'lien' | 'origine' | 'retour' | 'appareil'

export type Operation =
  /** Modifier un point. `titre` est celui du point, pour le journal. */
  | { k: 'el-modifier'; id: string; patch: Correctif; titre: string }
  | { k: 'el-ajouter'; sc: string; element: Element }
  | { k: 'el-supprimer'; id: string; titre: string }
  | { k: 'el-deplacer'; id: string; delta: -1 | 1; titre: string }
  | { k: 'el-transferer'; id: string; vers: string; titre: string }
  | { k: 'sc-ajouter'; cat: string; id: string; titre: string }
  | { k: 'sc-renommer'; id: string; titre: string }
  | { k: 'sc-supprimer'; id: string; titre: string }
  | { k: 'sc-deplacer'; id: string; delta: -1 | 1; titre: string }
  | { k: 'cat-ajouter'; id: string; titre: string; intro?: string }
  | { k: 'cat-renommer'; id: string; titre: string; intro?: string }
  | { k: 'cat-supprimer'; id: string; titre: string }
  | { k: 'cat-deplacer'; id: string; delta: -1 | 1; titre: string }
  /** Remplacer toute la liste : import, lien reçu, retour à l'origine ou à un état antérieur. */
  | { k: 'remplacer'; liste: Liste; motif: Motif }

/**
 * Une opération prête à partir : avec son identifiant unique `u` — c'est par
 * lui qu'on reconnaît, quand le serveur nous la renvoie, qu'elle est de nous —
 * et sa date `d`, ISO complet.
 */
export type OperationDatee = Operation & { u: string; d: string }

let compteur = 0
/** Horodate une opération et lui donne son identifiant unique. */
export function dater(op: Operation): OperationDatee {
  compteur = (compteur + 1) % 1296
  const u = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${compteur.toString(36).padStart(2, '0')}`
  return { ...op, u, d: maintenant() }
}

// ---------------------------------------------------------------------------
// Appliquer
// ---------------------------------------------------------------------------

/**
 * Applique une opération ; rend la même liste si elle ne change rien (un
 * point déjà supprimé, une sous-catégorie disparue…). La date de la liste
 * devient celle de l'opération : tous les appareils affichent la même.
 */
export function appliquerOperation(liste: Liste, op: OperationDatee): Liste {
  let r: Liste
  switch (op.k) {
    case 'el-modifier':
      r = modifierElement(liste, op.id, op.patch)
      break
    case 'el-ajouter':
      r = insererElement(liste, op.sc, op.element)
      break
    case 'el-supprimer':
      r = supprimerElement(liste, op.id)
      break
    case 'el-deplacer':
      r = deplacerElement(liste, op.id, op.delta)
      break
    case 'el-transferer':
      r = transfererElement(liste, op.id, op.vers)
      break
    case 'sc-ajouter':
      r = insererSousCategorie(liste, op.cat, op.id, op.titre)
      break
    case 'sc-renommer':
      r = renommerSousCategorie(liste, op.id, op.titre)
      break
    case 'sc-supprimer':
      r = supprimerSousCategorie(liste, op.id)
      break
    case 'sc-deplacer':
      r = deplacerSousCategorie(liste, op.id, op.delta)
      break
    case 'cat-ajouter':
      r = insererCategorie(liste, op.id, op.titre, op.intro)
      break
    case 'cat-renommer':
      r = renommerCategorie(liste, op.id, op.titre, op.intro)
      break
    case 'cat-supprimer':
      r = supprimerCategorie(liste, op.id)
      break
    case 'cat-deplacer':
      r = deplacerCategorie(liste, op.id, op.delta)
      break
    case 'remplacer':
      r = op.liste
      break
  }
  if (r === liste) return liste
  return { ...r, modifie: op.d }
}

/** Rejoue des opérations dans l'ordre. */
export function rejouer(liste: Liste, ops: OperationDatee[]): Liste {
  let l = liste
  for (const op of ops) l = appliquerOperation(l, op)
  return l
}

/**
 * Deux modifications successives du même point, sur le même appareil, n'en
 * font qu'une tant qu'elles ne sont pas parties : taper une note lettre à
 * lettre ne doit pas produire une opération par lettre. Rend l'opération
 * fusionnée, ou `null` si les deux ne se fusionnent pas.
 */
export function fusionnerCorrectifs(a: OperationDatee, b: OperationDatee): OperationDatee | null {
  if (a.k !== 'el-modifier' || b.k !== 'el-modifier' || a.id !== b.id) return null
  return { ...a, patch: { ...a.patch, ...b.patch }, titre: b.titre, d: b.d }
}

// ---------------------------------------------------------------------------
// Relire ce qui vient du serveur
// ---------------------------------------------------------------------------

function chaine(v: unknown): v is string {
  return typeof v === 'string'
}

function delta(v: unknown): v is -1 | 1 {
  return v === -1 || v === 1
}

function correctifDepuis(x: unknown): Correctif | null {
  if (!x || typeof x !== 'object') return null
  const p = x as Record<string, unknown>
  const c: Correctif = {}
  if ('titre' in p) {
    if (!chaine(p.titre) || !p.titre) return null
    c.titre = p.titre
  }
  for (const k of ['detail', 'note', 'qui', 'maj'] as const) {
    if (!(k in p)) continue
    if (p[k] === undefined || p[k] === null || p[k] === '') c[k] = undefined
    else if (chaine(p[k])) c[k] = p[k] as string
    else return null
  }
  if ('etat' in p) {
    if (!chaine(p.etat) || !ETATS.includes(p.etat as Etat)) return null
    c.etat = p.etat as Etat
  }
  if ('alerte' in p) {
    if (typeof p.alerte !== 'boolean') return null
    c.alerte = p.alerte
  }
  return c
}

/**
 * Relit une opération venue du serveur. Tout ce qui y est écrit l'a été par
 * cette application, mais la base est publique en écriture : une ligne mal
 * formée ne doit rien casser — elle est ignorée.
 */
export function operationDepuis(brut: unknown): OperationDatee | null {
  if (!brut || typeof brut !== 'object') return null
  const o = brut as Record<string, unknown>
  if (!chaine(o.u) || !o.u || !chaine(o.d) || Number.isNaN(Date.parse(o.d))) return null
  const base = { u: o.u, d: o.d }
  const titre = chaine(o.titre) ? o.titre : ''
  switch (o.k) {
    case 'el-modifier': {
      const patch = correctifDepuis(o.patch)
      if (!chaine(o.id) || !patch) return null
      return { k: 'el-modifier', id: o.id, patch, titre, ...base }
    }
    case 'el-ajouter': {
      const element = elementDepuis(o.element)
      if (!chaine(o.sc) || !element) return null
      return { k: 'el-ajouter', sc: o.sc, element, ...base }
    }
    case 'el-supprimer':
      return chaine(o.id) ? { k: 'el-supprimer', id: o.id, titre, ...base } : null
    case 'el-deplacer':
      return chaine(o.id) && delta(o.delta) ? { k: 'el-deplacer', id: o.id, delta: o.delta, titre, ...base } : null
    case 'el-transferer':
      return chaine(o.id) && chaine(o.vers) ? { k: 'el-transferer', id: o.id, vers: o.vers, titre, ...base } : null
    case 'sc-ajouter':
      return chaine(o.cat) && chaine(o.id) && chaine(o.titre)
        ? { k: 'sc-ajouter', cat: o.cat, id: o.id, titre: o.titre, ...base }
        : null
    case 'sc-renommer':
      return chaine(o.id) && chaine(o.titre) ? { k: 'sc-renommer', id: o.id, titre: o.titre, ...base } : null
    case 'sc-supprimer':
      return chaine(o.id) ? { k: 'sc-supprimer', id: o.id, titre, ...base } : null
    case 'sc-deplacer':
      return chaine(o.id) && delta(o.delta) ? { k: 'sc-deplacer', id: o.id, delta: o.delta, titre, ...base } : null
    case 'cat-ajouter':
    case 'cat-renommer': {
      if (!chaine(o.id) || !chaine(o.titre)) return null
      const intro = chaine(o.intro) ? { intro: o.intro } : {}
      return { k: o.k, id: o.id, titre: o.titre, ...intro, ...base }
    }
    case 'cat-supprimer':
      return chaine(o.id) ? { k: 'cat-supprimer', id: o.id, titre, ...base } : null
    case 'cat-deplacer':
      return chaine(o.id) && delta(o.delta) ? { k: 'cat-deplacer', id: o.id, delta: o.delta, titre, ...base } : null
    case 'remplacer': {
      const liste = valider(o.liste)
      const motif = MOTIFS.includes(o.motif as Motif) ? (o.motif as Motif) : 'fichier'
      return liste ? { k: 'remplacer', liste, motif, ...base } : null
    }
    default:
      return null
  }
}

const MOTIFS: Motif[] = ['fichier', 'lien', 'origine', 'retour', 'appareil']

// ---------------------------------------------------------------------------
// Raconter — le journal
// ---------------------------------------------------------------------------

const VERBE_ETAT: Record<Etat, string> = {
  'a-faire': 'a remis à faire',
  'en-cours': 'a mis en cours',
  valide: 'a validé',
  ecarte: 'a écarté',
}

const MOTIF_TEXTE: Record<Motif, string> = {
  fichier: 'depuis un fichier importé',
  lien: 'depuis un lien reçu',
  origine: 'par la liste d’origine',
  retour: 'par un état antérieur',
  appareil: 'par la liste gardée sur un appareil',
}

function guillemets(t: string): string {
  return t ? `« ${t} »` : 'un point'
}

/**
 * Une phrase, sans le sujet : « a validé « Durée d’une partie » ». L'écran
 * met le prénom devant.
 */
export function decrire(op: Operation): string {
  switch (op.k) {
    case 'el-modifier': {
      const p = op.patch
      const t = guillemets(op.titre)
      if (p.etat !== undefined) return `${VERBE_ETAT[p.etat]} ${t}`
      if (p.alerte !== undefined) return p.alerte ? `a signalé ${t} ⚠` : `a retiré l’alerte sur ${t}`
      if (p.qui !== undefined) return p.qui ? `a confié ${t} à ${p.qui}` : `a retiré le responsable de ${t}`
      if (p.note !== undefined) return p.note ? `a écrit une décision sur ${t}` : `a effacé la décision de ${t}`
      return `a modifié ${t}`
    }
    case 'el-ajouter':
      return `a ajouté ${guillemets(op.element.titre)}`
    case 'el-supprimer':
      return `a supprimé ${guillemets(op.titre)}`
    case 'el-deplacer':
      return `a ${op.delta < 0 ? 'monté' : 'descendu'} ${guillemets(op.titre)}`
    case 'el-transferer':
      return `a déplacé ${guillemets(op.titre)} dans une autre sous-catégorie`
    case 'sc-ajouter':
      return `a ajouté la sous-catégorie ${guillemets(op.titre)}`
    case 'sc-renommer':
      return `a renommé une sous-catégorie en ${guillemets(op.titre)}`
    case 'sc-supprimer':
      return `a supprimé la sous-catégorie ${guillemets(op.titre)} et ses points`
    case 'sc-deplacer':
      return `a ${op.delta < 0 ? 'monté' : 'descendu'} la sous-catégorie ${guillemets(op.titre)}`
    case 'cat-ajouter':
      return `a ajouté la catégorie ${guillemets(op.titre)}`
    case 'cat-renommer':
      return `a renommé une catégorie en ${guillemets(op.titre)}`
    case 'cat-supprimer':
      return `a supprimé la catégorie ${guillemets(op.titre)} et ses points`
    case 'cat-deplacer':
      return `a ${op.delta < 0 ? 'monté' : 'descendu'} la catégorie ${guillemets(op.titre)}`
    case 'remplacer':
      return `a remplacé toute la liste ${MOTIF_TEXTE[op.motif]}`
  }
}

/** « 24 nov., 14:02 » — pour le journal. */
export function quandLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
