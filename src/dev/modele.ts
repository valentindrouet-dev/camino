/**
 * La liste de développement : ce qu'il reste à valider avec les auteurs pour
 * finir le jeu, rangé par catégories et sous-catégories.
 *
 * Ce fichier ne connaît ni React, ni le navigateur : il décrit la liste et
 * les opérations qu'on lui applique — cocher, ajouter, déplacer, compter — et
 * sait la sérialiser pour l'enregistrer, l'exporter, ou la glisser dans un
 * lien. Tout est immuable : chaque opération rend une nouvelle liste.
 */

export type Etat = 'a-faire' | 'en-cours' | 'valide' | 'ecarte'

export const ETATS: Etat[] = ['a-faire', 'en-cours', 'valide', 'ecarte']

export const NOM_ETAT: Record<Etat, string> = {
  'a-faire': 'À faire',
  'en-cours': 'En cours',
  valide: 'Validé',
  ecarte: 'Écarté',
}

/** Un point à valider. */
export interface Element {
  /** Stable : c'est par elle qu'un point garde son état d'une version à l'autre. */
  id: string
  titre: string
  /** Ce qu'il y a à décider ou à vérifier, les chiffres connus, les options. */
  detail?: string
  etat: Etat
  /** La décision prise, les remarques — ce que les auteurs écrivent. */
  note?: string
  /** Qui s'en charge. */
  qui?: string
  /** Date du dernier changement d'état, ISO court (AAAA-MM-JJ). */
  maj?: string
  /**
   * Alerte : un point sur lequel il faut interpeller les auteurs. Indépendant
   * de l'état — un point validé peut rester à soulever, un point à faire ne
   * l'est pas forcément. Absent quand il n'y a rien à dire.
   */
  alerte?: boolean
}

export interface SousCategorie {
  id: string
  titre: string
  elements: Element[]
}

export interface Categorie {
  id: string
  titre: string
  /** Une phrase qui dit ce que la catégorie recouvre. */
  intro?: string
  sousCategories: SousCategorie[]
}

export interface Liste {
  /** Format du fichier : à incrémenter si la forme change. */
  format: 1
  /** Version du contenu d'origine dont cette liste est partie. */
  modele: number
  titre: string
  /** Dernière modification, ISO complet. */
  modifie: string
  categories: Categorie[]
}

// ---------------------------------------------------------------------------
// Compter
// ---------------------------------------------------------------------------

export interface Compte {
  total: number
  aFaire: number
  enCours: number
  valides: number
  ecartes: number
  /** Points marqués d'une alerte, quel que soit leur état. */
  alertes: number
  /**
   * Avancement : la part des points RÉGLÉS — validés ou écartés. Un point
   * écarté est une décision prise, pas un oubli : il compte comme réglé, et
   * la barre le montre d'une autre teinte pour qu'on ne le confonde pas avec
   * un point validé.
   */
  pourcent: number
}

export interface StatsSousCategorie extends Compte {
  id: string
  titre: string
}

export interface StatsCategorie extends Compte {
  id: string
  titre: string
  sousCategories: StatsSousCategorie[]
}

export interface Statistiques extends Compte {
  categories: StatsCategorie[]
  /** Points ouverts par responsable — « (personne) » pour ceux sans nom. */
  parResponsable: { qui: string; ouverts: number; total: number }[]
  /** Les derniers points réglés, les plus récents d'abord. */
  recents: { element: Element; categorie: string; sousCategorie: string }[]
}

function compter(elements: Element[]): Compte {
  const c = { total: elements.length, aFaire: 0, enCours: 0, valides: 0, ecartes: 0, alertes: 0, pourcent: 0 }
  for (const e of elements) {
    if (e.alerte) c.alertes++
    if (e.etat === 'a-faire') c.aFaire++
    else if (e.etat === 'en-cours') c.enCours++
    else if (e.etat === 'valide') c.valides++
    else c.ecartes++
  }
  c.pourcent = c.total ? Math.round((100 * (c.valides + c.ecartes)) / c.total) : 0
  return c
}

export function statistiques(liste: Liste): Statistiques {
  const tous: Element[] = []
  const recents: Statistiques['recents'] = []
  const categories = liste.categories.map((cat) => {
    const elementsCat: Element[] = []
    const sousCategories = cat.sousCategories.map((sc) => {
      elementsCat.push(...sc.elements)
      for (const e of sc.elements) {
        if ((e.etat === 'valide' || e.etat === 'ecarte') && e.maj) {
          recents.push({ element: e, categorie: cat.titre, sousCategorie: sc.titre })
        }
      }
      return { id: sc.id, titre: sc.titre, ...compter(sc.elements) }
    })
    tous.push(...elementsCat)
    return { id: cat.id, titre: cat.titre, sousCategories, ...compter(elementsCat) }
  })

  const parQui = new Map<string, { ouverts: number; total: number }>()
  for (const e of tous) {
    const qui = e.qui?.trim() || '(personne)'
    const v = parQui.get(qui) ?? { ouverts: 0, total: 0 }
    v.total++
    if (e.etat === 'a-faire' || e.etat === 'en-cours') v.ouverts++
    parQui.set(qui, v)
  }
  const parResponsable = [...parQui.entries()]
    .map(([qui, v]) => ({ qui, ...v }))
    .sort((a, b) => b.ouverts - a.ouverts || a.qui.localeCompare(b.qui, 'fr'))

  recents.sort((a, b) => (b.element.maj ?? '').localeCompare(a.element.maj ?? ''))

  return { ...compter(tous), categories, parResponsable, recents: recents.slice(0, 12) }
}

// ---------------------------------------------------------------------------
// Modifier — chaque fonction rend une nouvelle liste, l'ancienne est intacte.
// ---------------------------------------------------------------------------

/** Horloge remplaçable : les tests n'ont pas à dépendre de l'heure qu'il est. */
let horloge: () => Date = () => new Date()
export function reglerHorloge(h: (() => Date) | null): void {
  horloge = h ?? (() => new Date())
}

function aujourdhui(): string {
  return horloge().toISOString().slice(0, 10)
}

function touchee(liste: Liste, categories: Categorie[]): Liste {
  return { ...liste, modifie: horloge().toISOString(), categories }
}

let compteur = 0
/** Un identifiant pour ce qu'on ajoute à la main : unique, et lisible dans un export. */
export function nouvelId(prefixe = 'u'): string {
  compteur = (compteur + 1) % 1296
  return `${prefixe}-${Date.now().toString(36)}${compteur.toString(36).padStart(2, '0')}`
}

function surElement(
  liste: Liste,
  id: string,
  f: (e: Element) => Element | null,
): Liste {
  let trouve = false
  const categories = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => ({
      ...sc,
      elements: sc.elements.flatMap((e) => {
        if (e.id !== id) return [e]
        trouve = true
        const r = f(e)
        return r ? [r] : []
      }),
    })),
  }))
  return trouve ? touchee(liste, categories) : liste
}

export function modifierElement(
  liste: Liste,
  id: string,
  patch: Partial<Omit<Element, 'id'>>,
): Liste {
  return surElement(liste, id, (e) => {
    const changeEtat = patch.etat !== undefined && patch.etat !== e.etat
    return { ...e, ...patch, ...(changeEtat ? { maj: aujourdhui() } : {}) }
  })
}

/** Le cycle du bouton d'état : à faire → en cours → validé → à faire. */
export function etatSuivant(etat: Etat): Etat {
  if (etat === 'a-faire') return 'en-cours'
  if (etat === 'en-cours') return 'valide'
  return 'a-faire'
}

export function basculerEtat(liste: Liste, id: string): Liste {
  return surElement(liste, id, (e) => ({ ...e, etat: etatSuivant(e.etat), maj: aujourdhui() }))
}

/** Pose ou retire l'alerte d'un point. L'état et sa date ne bougent pas. */
export function basculerAlerte(liste: Liste, id: string): Liste {
  return surElement(liste, id, (e) => {
    const { alerte, ...reste } = e
    return alerte ? reste : { ...e, alerte: true }
  })
}

export function supprimerElement(liste: Liste, id: string): Liste {
  return surElement(liste, id, () => null)
}

export function ajouterElement(
  liste: Liste,
  sousCategorieId: string,
  titre: string,
  detail?: string,
): Liste {
  const propre = titre.trim()
  if (!propre) return liste
  const element: Element = { id: nouvelId(), titre: propre, etat: 'a-faire' }
  if (detail?.trim()) element.detail = detail.trim()
  let trouve = false
  const categories = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => {
      if (sc.id !== sousCategorieId) return sc
      trouve = true
      return { ...sc, elements: [...sc.elements, element] }
    }),
  }))
  return trouve ? touchee(liste, categories) : liste
}

/** Décale un élément d'une place vers le haut (-1) ou le bas (+1), dans sa sous-catégorie. */
export function deplacerElement(liste: Liste, id: string, delta: -1 | 1): Liste {
  let bouge = false
  const categories = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => {
      const i = sc.elements.findIndex((e) => e.id === id)
      if (i < 0) return sc
      const j = i + delta
      if (j < 0 || j >= sc.elements.length) return sc
      const elements = [...sc.elements]
      ;[elements[i], elements[j]] = [elements[j], elements[i]]
      bouge = true
      return { ...sc, elements }
    }),
  }))
  return bouge ? touchee(liste, categories) : liste
}

/** Fait passer un élément dans une autre sous-catégorie, en fin de liste. */
export function transfererElement(liste: Liste, id: string, versSousCategorieId: string): Liste {
  let element: Element | null = null
  const sans = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => {
      if (sc.id === versSousCategorieId && sc.elements.some((e) => e.id === id)) {
        // déjà là : rien à faire
        element = null
        return sc
      }
      const e = sc.elements.find((x) => x.id === id)
      if (!e) return sc
      element = e
      return { ...sc, elements: sc.elements.filter((x) => x.id !== id) }
    }),
  }))
  const pris = element as Element | null
  if (!pris) return liste
  let pose = false
  const categories = sans.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => {
      if (sc.id !== versSousCategorieId) return sc
      pose = true
      return { ...sc, elements: [...sc.elements, pris] }
    }),
  }))
  return pose ? touchee(liste, categories) : liste
}

export function ajouterSousCategorie(liste: Liste, categorieId: string, titre: string): Liste {
  const propre = titre.trim()
  if (!propre) return liste
  let trouve = false
  const categories = liste.categories.map((cat) => {
    if (cat.id !== categorieId) return cat
    trouve = true
    return {
      ...cat,
      sousCategories: [...cat.sousCategories, { id: nouvelId('sc'), titre: propre, elements: [] }],
    }
  })
  return trouve ? touchee(liste, categories) : liste
}

export function renommerSousCategorie(liste: Liste, id: string, titre: string): Liste {
  const propre = titre.trim()
  if (!propre) return liste
  let trouve = false
  const categories = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.map((sc) => {
      if (sc.id !== id) return sc
      trouve = true
      return { ...sc, titre: propre }
    }),
  }))
  return trouve ? touchee(liste, categories) : liste
}

export function supprimerSousCategorie(liste: Liste, id: string): Liste {
  let trouve = false
  const categories = liste.categories.map((cat) => ({
    ...cat,
    sousCategories: cat.sousCategories.filter((sc) => {
      if (sc.id === id) trouve = true
      return sc.id !== id
    }),
  }))
  return trouve ? touchee(liste, categories) : liste
}

export function deplacerSousCategorie(liste: Liste, id: string, delta: -1 | 1): Liste {
  let bouge = false
  const categories = liste.categories.map((cat) => {
    const i = cat.sousCategories.findIndex((sc) => sc.id === id)
    if (i < 0) return cat
    const j = i + delta
    if (j < 0 || j >= cat.sousCategories.length) return cat
    const sousCategories = [...cat.sousCategories]
    ;[sousCategories[i], sousCategories[j]] = [sousCategories[j], sousCategories[i]]
    bouge = true
    return { ...cat, sousCategories }
  })
  return bouge ? touchee(liste, categories) : liste
}

export function ajouterCategorie(liste: Liste, titre: string, intro?: string): Liste {
  const propre = titre.trim()
  if (!propre) return liste
  const cat: Categorie = { id: nouvelId('cat'), titre: propre, sousCategories: [] }
  if (intro?.trim()) cat.intro = intro.trim()
  return touchee(liste, [...liste.categories, cat])
}

export function renommerCategorie(liste: Liste, id: string, titre: string, intro?: string): Liste {
  const propre = titre.trim()
  if (!propre) return liste
  let trouve = false
  const categories = liste.categories.map((cat) => {
    if (cat.id !== id) return cat
    trouve = true
    const maj = { ...cat, titre: propre }
    if (intro !== undefined) {
      if (intro.trim()) maj.intro = intro.trim()
      else delete maj.intro
    }
    return maj
  })
  return trouve ? touchee(liste, categories) : liste
}

export function supprimerCategorie(liste: Liste, id: string): Liste {
  if (!liste.categories.some((c) => c.id === id)) return liste
  return touchee(
    liste,
    liste.categories.filter((c) => c.id !== id),
  )
}

export function deplacerCategorie(liste: Liste, id: string, delta: -1 | 1): Liste {
  const i = liste.categories.findIndex((c) => c.id === id)
  if (i < 0) return liste
  const j = i + delta
  if (j < 0 || j >= liste.categories.length) return liste
  const categories = [...liste.categories]
  ;[categories[i], categories[j]] = [categories[j], categories[i]]
  return touchee(liste, categories)
}

/** Toutes les sous-catégories, avec le nom de leur catégorie — pour « déplacer vers ». */
export function toutesLesSousCategories(
  liste: Liste,
): { id: string; titre: string; categorie: string }[] {
  return liste.categories.flatMap((cat) =>
    cat.sousCategories.map((sc) => ({ id: sc.id, titre: sc.titre, categorie: cat.titre })),
  )
}

// ---------------------------------------------------------------------------
// Mettre à jour une liste modifiée avec un contenu d'origine plus récent
// ---------------------------------------------------------------------------

/**
 * L'application évolue : une mise à jour peut apporter de nouveaux points à
 * valider. Ils sont AJOUTÉS à la liste de chacun — jamais rien n'est retiré ni
 * remis à zéro : ce qui a été coché ou écrit reste. Un point nouveau rejoint
 * sa sous-catégorie d'origine (créée si elle manque, catégorie comprise), à la
 * fin, pour ne pas bousculer l'ordre qu'on a pu donner à la main.
 *
 * Rend aussi le nombre de points ajoutés, pour le dire à l'écran.
 */
export function fusionnerNouveautes(
  liste: Liste,
  origine: Liste,
): { liste: Liste; ajoutes: number } {
  if (liste.modele >= origine.modele) return { liste, ajoutes: 0 }
  const connus = new Set<string>()
  for (const cat of liste.categories) {
    connus.add(cat.id)
    for (const sc of cat.sousCategories) {
      connus.add(sc.id)
      for (const e of sc.elements) connus.add(e.id)
    }
  }
  let ajoutes = 0
  let categories = liste.categories.map((c) => ({
    ...c,
    sousCategories: c.sousCategories.map((sc) => ({ ...sc, elements: [...sc.elements] })),
  }))
  for (const catO of origine.categories) {
    let cat = categories.find((c) => c.id === catO.id)
    if (!cat) {
      cat = { id: catO.id, titre: catO.titre, intro: catO.intro, sousCategories: [] }
      categories = [...categories, cat]
    }
    for (const scO of catO.sousCategories) {
      // La sous-catégorie peut avoir été déplacée dans une autre catégorie :
      // on la cherche partout avant de la créer.
      let sc = categories.flatMap((c) => c.sousCategories).find((s) => s.id === scO.id)
      if (!sc) {
        sc = { id: scO.id, titre: scO.titre, elements: [] }
        cat.sousCategories = [...cat.sousCategories, sc]
      }
      for (const eO of scO.elements) {
        if (connus.has(eO.id)) continue
        sc.elements.push({ ...eO })
        connus.add(eO.id)
        ajoutes++
      }
    }
  }
  return {
    liste: { ...touchee(liste, categories), modele: origine.modele },
    ajoutes,
  }
}

// ---------------------------------------------------------------------------
// Sérialiser : fichier, lien
// ---------------------------------------------------------------------------

export function serialiser(liste: Liste): string {
  return JSON.stringify(liste, null, 1)
}

/** Relit une liste et la valide ; `null` si ce n'est pas une liste. */
export function analyser(texte: string): Liste | null {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return null
  }
  return valider(brut)
}

function chaine(v: unknown): v is string {
  return typeof v === 'string'
}

export function valider(brut: unknown): Liste | null {
  if (!brut || typeof brut !== 'object') return null
  const l = brut as Record<string, unknown>
  if (l.format !== 1 || !Array.isArray(l.categories) || !chaine(l.titre)) return null
  const ids = new Set<string>()
  const unique = (id: unknown): id is string => {
    if (!chaine(id) || !id || ids.has(id)) return false
    ids.add(id)
    return true
  }
  const categories: Categorie[] = []
  for (const c of l.categories as unknown[]) {
    if (!c || typeof c !== 'object') return null
    const cat = c as Record<string, unknown>
    if (!unique(cat.id) || !chaine(cat.titre) || !Array.isArray(cat.sousCategories)) return null
    const sousCategories: SousCategorie[] = []
    for (const s of cat.sousCategories as unknown[]) {
      if (!s || typeof s !== 'object') return null
      const sc = s as Record<string, unknown>
      if (!unique(sc.id) || !chaine(sc.titre) || !Array.isArray(sc.elements)) return null
      const elements: Element[] = []
      for (const x of sc.elements as unknown[]) {
        if (!x || typeof x !== 'object') return null
        const e = x as Record<string, unknown>
        if (!unique(e.id) || !chaine(e.titre)) return null
        if (!chaine(e.etat) || !ETATS.includes(e.etat as Etat)) return null
        const el: Element = { id: e.id, titre: e.titre, etat: e.etat as Etat }
        if (chaine(e.detail) && e.detail) el.detail = e.detail
        if (chaine(e.note) && e.note) el.note = e.note
        if (chaine(e.qui) && e.qui) el.qui = e.qui
        if (chaine(e.maj) && e.maj) el.maj = e.maj
        if (e.alerte === true) el.alerte = true
        elements.push(el)
      }
      sousCategories.push({ id: sc.id, titre: sc.titre, elements })
    }
    const categorie: Categorie = { id: cat.id, titre: cat.titre, sousCategories }
    if (chaine(cat.intro) && cat.intro) categorie.intro = cat.intro
    categories.push(categorie)
  }
  return {
    format: 1,
    modele: typeof l.modele === 'number' ? l.modele : 0,
    titre: l.titre,
    modifie: chaine(l.modifie) ? l.modifie : new Date(0).toISOString(),
    categories,
  }
}

// ---------------------------------------------------------------------------
// L'écart à l'origine : ce qu'une liste a de propre
// ---------------------------------------------------------------------------

/**
 * Tout le monde a le contenu d'origine : il est dans l'application. Ce qui
 * vaut la peine d'être transmis, c'est ce qu'on y a FAIT — les états, les
 * décisions, les points ajoutés, l'ordre si on l'a changé. Une liste entière
 * compressée pèse 19 Ko ; son écart, quelques centaines d'octets tant qu'on
 * n'a pas tout réordonné.
 *
 * `s` (la structure : ordre des catégories, des sous-catégories et des points)
 * n'est écrite que si elle diffère de l'origine. `e` porte les champs modifiés
 * des points d'origine, `n` les points ajoutés en entier.
 */
export interface Ecart {
  v: 1
  m: number
  t: string
  d: string
  s?: { i: string; t?: string; in?: string; sc: { i: string; t?: string; e: string[] }[] }[]
  e: Record<string, Partial<Omit<Element, 'id'>>>
  n: Record<string, Element>
}

function indexElements(liste: Liste): Map<string, Element> {
  const m = new Map<string, Element>()
  for (const c of liste.categories) for (const sc of c.sousCategories) for (const e of sc.elements) m.set(e.id, e)
  return m
}

function structureDe(liste: Liste, origine?: Liste): NonNullable<Ecart['s']> {
  const catsO = new Map(origine?.categories.map((c) => [c.id, c]) ?? [])
  const scsO = new Map(origine?.categories.flatMap((c) => c.sousCategories.map((s) => [s.id, s] as const)) ?? [])
  return liste.categories.map((c) => {
    const o = catsO.get(c.id)
    const cat: NonNullable<Ecart['s']>[number] = { i: c.id, sc: [] }
    if (!o || o.titre !== c.titre) cat.t = c.titre
    if (!o || (o.intro ?? '') !== (c.intro ?? '')) cat.in = c.intro ?? ''
    cat.sc = c.sousCategories.map((sc) => {
      const so = scsO.get(sc.id)
      const r: { i: string; t?: string; e: string[] } = { i: sc.id, e: sc.elements.map((e) => e.id) }
      if (!so || so.titre !== sc.titre) r.t = sc.titre
      return r
    })
    return cat
  })
}

export function ecartDepuisOrigine(liste: Liste, origine: Liste): Ecart {
  const idxO = indexElements(origine)
  const e: Ecart['e'] = {}
  const n: Ecart['n'] = {}
  for (const el of indexElements(liste).values()) {
    const o = idxO.get(el.id)
    if (!o) {
      n[el.id] = el
      continue
    }
    // Un champ qui diffère est transmis ; vidé, il est transmis vide — c'est
    // ainsi qu'un effacement voyage.
    const patch: Partial<Omit<Element, 'id'>> = {}
    let change = false
    if (el.titre !== o.titre) { patch.titre = el.titre; change = true }
    if (el.etat !== o.etat) { patch.etat = el.etat; change = true }
    if (Boolean(el.alerte) !== Boolean(o.alerte)) { patch.alerte = Boolean(el.alerte); change = true }
    for (const k of ['detail', 'note', 'qui', 'maj'] as const) {
      if ((el[k] ?? '') !== (o[k] ?? '')) { patch[k] = el[k] ?? ''; change = true }
    }
    if (change) e[el.id] = patch
  }
  const ecart: Ecart = { v: 1, m: liste.modele, t: liste.titre, d: liste.modifie, e, n }
  // La structure n'est portée que si elle diffère : c'est elle qui coûte.
  if (JSON.stringify(structureDe(liste, origine)) !== JSON.stringify(structureDe(origine, origine))) {
    ecart.s = structureDe(liste, origine)
  }
  return ecart
}

/**
 * Reconstruit une liste à partir de son écart et du contenu d'origine. Un
 * point que l'origine du destinataire ne connaît pas — l'expéditeur avait une
 * version plus ancienne, ou plus récente — est ignoré s'il n'est pas transmis
 * en entier ; les points que seul le destinataire possède sont ensuite
 * rajoutés par `fusionnerNouveautes`, pour que rien ne se perde.
 */
export function appliquerEcart(ecart: Ecart, origine: Liste): Liste | null {
  if (!ecart || ecart.v !== 1 || typeof ecart.t !== 'string') return null
  const idxO = indexElements(origine)
  const resoudre = (id: string): Element | null => {
    const n = ecart.n?.[id]
    if (n) return { ...n, id }
    const o = idxO.get(id)
    if (!o) return null
    const patch = ecart.e?.[id]
    if (!patch) return { ...o }
    const el: Element = { ...o }
    if (patch.titre) el.titre = patch.titre
    if (patch.etat && ETATS.includes(patch.etat)) el.etat = patch.etat
    if ('alerte' in patch) {
      if (patch.alerte) el.alerte = true
      else delete el.alerte
    }
    for (const k of ['detail', 'note', 'qui', 'maj'] as const) {
      if (!(k in patch)) continue
      const v = patch[k]
      if (v) el[k] = v
      else delete el[k]
    }
    return el
  }
  let categories: Categorie[]
  if (ecart.s) {
    const catsO = new Map(origine.categories.map((c) => [c.id, c]))
    const scsO = new Map(origine.categories.flatMap((c) => c.sousCategories.map((s) => [s.id, s] as const)))
    categories = ecart.s.map((c) => {
      const o = catsO.get(c.i)
      const cat: Categorie = { id: c.i, titre: c.t ?? o?.titre ?? 'Sans titre', sousCategories: [] }
      const intro = c.in ?? o?.intro
      if (intro) cat.intro = intro
      cat.sousCategories = c.sc.map((sc) => ({
        id: sc.i,
        titre: sc.t ?? scsO.get(sc.i)?.titre ?? 'Sans titre',
        elements: sc.e.map(resoudre).filter((x): x is Element => x !== null),
      }))
      return cat
    })
  } else {
    categories = origine.categories.map((c) => ({
      ...c,
      sousCategories: c.sousCategories.map((sc) => ({
        ...sc,
        elements: sc.elements.map((e) => resoudre(e.id)).filter((x): x is Element => x !== null),
      })),
    }))
    // Des points ajoutés sans structure : ils rejoignent la fin de la
    // première sous-catégorie — le cas ne se présente pas, la structure est
    // toujours écrite dès qu'un point est ajouté, mais on ne perd rien.
    const places = new Set(categories.flatMap((c) => c.sousCategories.flatMap((s) => s.elements.map((e) => e.id))))
    for (const [id, el] of Object.entries(ecart.n ?? {})) {
      if (!places.has(id)) categories[0]?.sousCategories[0]?.elements.push({ ...el, id })
    }
  }
  const brute: Liste = {
    format: 1,
    modele: typeof ecart.m === 'number' ? ecart.m : 0,
    titre: ecart.t,
    modifie: typeof ecart.d === 'string' ? ecart.d : new Date(0).toISOString(),
    categories,
  }
  const validee = valider(brute)
  if (!validee) return null
  return fusionnerNouveautes(validee, origine).liste
}

/*
 * Le lien de partage porte l'ÉCART de la liste à l'origine, compressé, dans le
 * fragment de l'adresse (après le #). Le fragment ne quitte jamais le
 * navigateur — le serveur ne le voit pas — et les messageries le transmettent
 * tant qu'il reste court : quelques centaines de caractères pour une liste
 * cochée et annotée, quelques milliers si on a tout réordonné.
 *
 * Préfixes : « p. » pour un écart compressé, « d. » pour une liste entière
 * compressée, « u. » pour une liste en clair quand le navigateur ne sait pas
 * compresser (rare). Les trois se relisent.
 */

function versBase64Url(octets: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < octets.length; i += 0x8000) {
    bin += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function depuisBase64Url(texte: string): Uint8Array | null {
  try {
    const b64 = texte.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function comprimer(octets: Uint8Array, format: 'deflate-raw'): Promise<Uint8Array> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new CompressionStream(format))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

async function decomprimer(octets: Uint8Array, format: 'deflate-raw'): Promise<Uint8Array> {
  const flux = new Blob([octets as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

export async function versLien(liste: Liste, origine: Liste): Promise<string> {
  const texte = JSON.stringify(ecartDepuisOrigine(liste, origine))
  const json = new TextEncoder().encode(texte)
  if (typeof CompressionStream === 'undefined') {
    return 'u.' + versBase64Url(new TextEncoder().encode(JSON.stringify(liste)))
  }
  return 'p.' + versBase64Url(await comprimer(json, 'deflate-raw'))
}

export async function depuisLien(code: string, origine: Liste): Promise<Liste | null> {
  const prefixe = code.slice(0, 2)
  const corps = depuisBase64Url(code.slice(2))
  if (!corps) return null
  try {
    if (prefixe === 'p.') {
      const texte = new TextDecoder().decode(await decomprimer(corps, 'deflate-raw'))
      return appliquerEcart(JSON.parse(texte) as Ecart, origine)
    }
    const octets =
      prefixe === 'd.'
        ? await decomprimer(corps, 'deflate-raw')
        : prefixe === 'u.'
          ? corps
          : null
    if (!octets) return null
    const liste = analyser(new TextDecoder().decode(octets))
    return liste ? fusionnerNouveautes(liste, origine).liste : null
  } catch {
    return null
  }
}

/** Date lisible, pour l'écran et le PDF : « 2 novembre 2026 ». */
export function dateLisible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
