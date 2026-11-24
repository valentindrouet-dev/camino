/**
 * La synchronisation de la liste de développement entre les appareils.
 *
 * Le principe : la liste partagée n'est rien d'autre que la liste d'origine
 * suivie de toutes les opérations qu'on lui a faites, dans l'ordre où le
 * serveur les a reçues. Le serveur garde ces opérations dans une table où
 * rien ne s'efface jamais — on y ajoute, c'est tout. Chaque appareil :
 *
 *  1. rejoue ce qu'il n'a pas encore vu (les lignes au-delà de la dernière
 *     qu'il connaît) ;
 *  2. applique ses propres gestes tout de suite, à l'écran, et les range dans
 *     une file de sortie qu'il envoie dès qu'il peut — hors ligne, la file
 *     attend dans la mémoire du navigateur ;
 *  3. de temps en temps, dépose un instantané de la liste pour que le
 *     prochain à arriver n'ait pas tout à rejouer depuis le début.
 *
 * Deux appareils qui modifient en même temps ne se gênent pas : leurs
 * opérations se suivent simplement dans la table. Et comme rien ne s'efface,
 * le journal permet de revenir à l'état d'avant n'importe quelle action.
 *
 * Ce fichier ne connaît ni React ni le navigateur : le serveur et la mémoire
 * lui sont fournis, ce qui permet de le tester de bout en bout sans réseau.
 */
import { listeDOrigine } from './contenu.ts'
import { ecartDepuisOrigine, fusionnerNouveautes, valider } from './modele.ts'
import type { Liste } from './modele.ts'
import { appliquerOperation, dater, fusionnerCorrectifs, operationDepuis, rejouer } from './operations.ts'
import type { Operation, OperationDatee } from './operations.ts'

// ---------------------------------------------------------------------------
// Ce que le serveur sait faire
// ---------------------------------------------------------------------------

/** Une ligne de la table : une opération, ou un instantané de la liste. */
export interface Ligne {
  id: number
  /** Date d'arrivée au serveur, ISO. */
  cree: string
  genre: 'op' | 'instantane'
  auteur: string
  /** Pour un instantané : la dernière ligne qu'il intègre. */
  jusqua: number | null
  contenu: unknown
}

export interface NouvelleLigne {
  genre: 'op' | 'instantane'
  auteur: string
  appareil: string
  jusqua?: number
  contenu: unknown
}

/** La table manque, ou refuse l'accès : la sauvegarde partagée n'est pas activée. */
export class ServeurNonConfigure extends Error {}

/** Une opération que le serveur a déjà (même identifiant) : c'est qu'elle est passée. */
export class Doublon extends Error {}

export interface Serveur {
  /** Les lignes d'identifiant > `depuis` (et < `avant` si donné), par identifiant croissant, au plus `limite`. */
  lire(depuis: number, limite: number, avant?: number): Promise<Ligne[]>
  /** Le dernier instantané dont `jusqua` ≤ `jusquaMax` (ou le dernier tout court). */
  dernierInstantane(jusquaMax?: number): Promise<Ligne | null>
  /** Les dernières opérations, les plus récentes d'abord. */
  dernieresOperations(limite: number): Promise<Ligne[]>
  /** Ajoute des lignes ; rend celles créées, avec leur identifiant. */
  ecrire(lignes: NouvelleLigne[]): Promise<Ligne[]>
  /** Prévient quand quelqu'un d'autre a écrit. */
  ecouter(cb: () => void): () => void
  /** Signale aux autres qu'on vient d'écrire. */
  signaler(): void
}

/** La mémoire de l'appareil (localStorage, ou autre chose dans les tests). */
export interface Memoire {
  lire(cle: string): string | null
  ecrire(cle: string, valeur: string): void
  effacer(cle: string): void
}

// ---------------------------------------------------------------------------
// L'état vu de l'écran
// ---------------------------------------------------------------------------

export type Mode =
  /** Pas de serveur du tout : la liste vit sur cet appareil, comme avant. */
  | 'local'
  /** Premier contact en cours. */
  | 'connexion'
  /** Tout est envoyé, tout est reçu. */
  | 'a-jour'
  /** Des opérations partent. */
  | 'envoi'
  /** Le réseau manque : on travaille, la file attend. */
  | 'hors-ligne'
  /** Le projet Supabase n'a pas (encore) la table : la liste reste sur cet appareil. */
  | 'non-configure'

/** Une ligne du journal : qui a fait quoi, quand. */
export interface Entree {
  id: number
  quand: string
  auteur: string
  op: OperationDatee
}

export interface EtatSynchro {
  mode: Mode
  liste: Liste
  /** Opérations qui attendent de partir. */
  enAttente: number
  /** Points apportés par la mise à jour de l'application. */
  nouveaux: number
  /** Une liste trouvée sur cet appareil, différente de la partagée : à proposer. */
  proposition: Liste | null
  /** Le journal connu — se complète avec `chargerJournal`. */
  journal: Entree[]
  /** Un mot sur ce qui ne va pas, en mode non configuré ou hors ligne. */
  detail?: string
}

// ---------------------------------------------------------------------------
// Clés de la mémoire
// ---------------------------------------------------------------------------

/** La liste telle qu'on la connaissait avant la sauvegarde partagée — et en mode local. */
export const CLE_LOCALE = 'camino.developpement.v1'
/** L'état du serveur tel qu'on l'a vu en dernier : { id, jusqua, liste }. */
export const CLE_CACHE = 'camino.developpement.serveur'
/** Les opérations qui n'ont pas encore été envoyées. */
export const CLE_SORTIE = 'camino.developpement.sortie'
export const CLE_AUTEUR = 'camino.developpement.auteur'
export const CLE_APPAREIL = 'camino.developpement.appareil'

interface Cache {
  id: number
  jusqua: number
  liste: Liste
}

/** Une liste a-t-elle quelque chose de propre, ou n'est-ce que l'origine ? */
export function differeDeLOrigine(liste: Liste, origine: Liste = listeDOrigine()): boolean {
  const e = ecartDepuisOrigine(liste, origine)
  return Boolean(e.s) || Object.keys(e.e).length > 0 || Object.keys(e.n).length > 0
}

/** Deux listes disent-elles la même chose (dates mises à part) ? */
export function memeContenu(a: Liste, b: Liste, origine: Liste = listeDOrigine()): boolean {
  const sansDate = (l: Liste) => {
    const { d: _d, ...reste } = ecartDepuisOrigine(l, origine)
    void _d
    return JSON.stringify(reste)
  }
  return sansDate(a) === sansDate(b)
}

export interface Options {
  /** Combien de temps on laisse les gestes s'accumuler avant d'envoyer. */
  delaiEnvoiMs?: number
  /** Au-delà de ce nombre de lignes depuis le dernier instantané, on en dépose un. */
  lignesParInstantane?: number
  /** Nombre d'entrées du journal qu'on garde en mémoire. */
  tailleJournal?: number
}

// ---------------------------------------------------------------------------
// La synchronisation
// ---------------------------------------------------------------------------

export class Synchro {
  private readonly serveur: Serveur | null
  private readonly memoire: Memoire
  private readonly delaiEnvoiMs: number
  private readonly lignesParInstantane: number
  private readonly tailleJournal: number

  /** La liste telle que le serveur la connaît, jusqu'à `dernierId`. */
  private etatServeur: Liste
  private dernierId = 0
  private jusquaInstantane = 0
  /** Nos opérations pas encore confirmées par le serveur, dans l'ordre. */
  private sortie: OperationDatee[] = []
  /** Identifiants des opérations déjà rejouées : une ligne en double ne compte pas deux fois. */
  private vues = new Set<string>()
  /**
   * Identifiants des opérations en route vers le serveur. On n'y fusionne
   * plus rien : la version envoyée est celle que le serveur rendra, et ce qui
   * a été tapé entre-temps doit partir dans une opération à part.
   */
  private enVol = new Set<string>()
  /** Ce qu'on affiche : l'état du serveur, nos opérations en attente par-dessus. */
  private liste: Liste
  private mode: Mode
  private detail: string | undefined
  private nouveaux = 0
  private proposition: Liste | null = null
  private journal: Entree[] = []
  private journalCharge = false
  /** Vrai tant qu'on n'a pas encore lu le serveur une première fois. */
  private premierContact = true
  private serveurVide = false

  private abonnes = new Set<(e: EtatSynchro) => void>()
  /** Les accès au serveur se suivent : jamais deux rattrapages en même temps. */
  private file: Promise<void> = Promise.resolve()
  private minuterie: ReturnType<typeof setTimeout> | null = null
  private arretEcoute: (() => void) | null = null
  private vivant = true

  private readonly appareil: string
  auteur: string

  constructor(serveur: Serveur | null, memoire: Memoire, options: Options = {}) {
    this.serveur = serveur
    this.memoire = memoire
    this.delaiEnvoiMs = options.delaiEnvoiMs ?? 1200
    this.lignesParInstantane = options.lignesParInstantane ?? 40
    this.tailleJournal = options.tailleJournal ?? 200
    this.auteur = memoire.lire(CLE_AUTEUR) ?? ''
    this.appareil = memoire.lire(CLE_APPAREIL) ?? this.nouvelAppareil()

    const origine = listeDOrigine()
    const locale = this.lireLocale()

    if (!serveur) {
      // Comme avant la sauvegarde partagée : la liste de cet appareil.
      this.mode = 'local'
      const base = locale ?? origine
      const { liste, ajoutes } = fusionnerNouveautes(base, origine)
      this.nouveaux = ajoutes
      this.etatServeur = liste
      this.liste = liste
      if (locale && ajoutes) this.ecrireLocale(liste)
      return
    }

    this.mode = 'connexion'
    this.sortie = this.lireSortie()
    const cache = this.lireCache()
    if (cache) {
      const { liste, ajoutes } = fusionnerNouveautes(cache.liste, origine)
      this.nouveaux = ajoutes
      this.etatServeur = liste
      this.dernierId = cache.id
      this.jusquaInstantane = cache.jusqua
      this.liste = rejouer(liste, this.sortie)
    } else {
      // Jamais connecté depuis cet appareil : on montre ce qu'il a, le temps
      // du premier contact — ses gestes attendent dans la file.
      this.etatServeur = origine
      this.liste = rejouer(locale ?? origine, this.sortie)
    }
  }

  // ------------------------------------------------------------- lecture
  etat(): EtatSynchro {
    return {
      mode: this.mode,
      liste: this.liste,
      enAttente: this.sortie.length,
      nouveaux: this.nouveaux,
      proposition: this.proposition,
      journal: this.journal,
      detail: this.detail,
    }
  }

  abonner(cb: (e: EtatSynchro) => void): () => void {
    this.abonnes.add(cb)
    return () => {
      this.abonnes.delete(cb)
    }
  }

  private publier() {
    const e = this.etat()
    for (const cb of this.abonnes) cb(e)
  }

  /** Le serveur est-il de la partie (configuré, en ligne ou non) ? */
  get partage(): boolean {
    return this.mode !== 'local' && this.mode !== 'non-configure'
  }

  // ---------------------------------------------------------- démarrage
  /** Branche l'écoute et prend contact. */
  demarrer(): void {
    if (!this.serveur) return
    this.vivant = true
    this.arretEcoute?.()
    this.arretEcoute = this.serveur.ecouter(() => this.rattraper())
    this.enfiler(() => this.charger())
  }

  arreter(): void {
    this.vivant = false
    this.arretEcoute?.()
    this.arretEcoute = null
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = null
  }

  /**
   * On revient sur l'onglet, le réseau revient : on se remet à jour et on
   * envoie. Si le premier contact n'a jamais abouti — ou si la table
   * manquait : elle a peut-être été créée depuis —, on le retente.
   */
  reveiller(): void {
    if (!this.serveur || this.mode === 'local') return
    if (this.premierContact || this.mode === 'non-configure') {
      this.enfiler(() => this.charger())
      return
    }
    this.enfiler(async () => {
      await this.rattraperInterne()
      await this.envoyerInterne()
    })
  }

  /** Envoie tout de suite ce qui attend — avant que la page ne se ferme. */
  envoyerMaintenant(): void {
    if (!this.serveur || !this.partage) return
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = null
    this.enfiler(() => this.envoyerInterne())
  }

  rattraper(): void {
    if (!this.serveur || !this.partage) return
    if (this.premierContact) {
      this.enfiler(() => this.charger())
      return
    }
    this.enfiler(() => this.rattraperInterne())
  }

  private enfiler(tache: () => Promise<void>) {
    this.file = this.file.then(async () => {
      if (!this.vivant) return
      try {
        await tache()
      } catch (e) {
        this.panne(e)
      }
    })
  }

  private panne(e: unknown) {
    if (e instanceof ServeurNonConfigure) {
      // La table n'existe pas : la liste reste ici, comme avant. Ce qu'on a
      // fait entre-temps n'est pas perdu — ça devient la liste locale.
      this.mode = 'non-configure'
      this.detail = e.message
      this.sortie = []
      this.ecrireSortie()
      this.ecrireLocale(this.liste)
    } else {
      this.mode = 'hors-ligne'
      this.detail = e instanceof Error ? e.message : String(e)
    }
    this.publier()
  }

  private async charger() {
    const serveur = this.serveur!
    const origine = listeDOrigine()
    const instantane = await serveur.dernierInstantane()
    // La table répond : on est bien en mode partagé, quoi qu'on ait cru avant.
    this.mode = 'connexion'
    let base = origine
    let depuis = 0
    if (instantane) {
      const l = valider((instantane.contenu as { liste?: unknown } | null)?.liste)
      if (l) {
        base = l
        depuis = instantane.jusqua ?? 0
        this.jusquaInstantane = depuis
      }
    }
    // Ce qu'on a en cache est plus frais que l'instantané ? On repart de là.
    const cache = this.lireCache()
    if (cache && cache.id >= depuis) {
      base = cache.liste
      depuis = cache.id
      this.jusquaInstantane = Math.max(this.jusquaInstantane, cache.jusqua)
    }
    this.etatServeur = base
    this.dernierId = depuis
    // On repart d'une base : seules les opérations rejouées dessus à partir
    // de maintenant comptent comme vues. Sans cela, un premier contact
    // interrompu au milieu du rattrapage laisserait, au second, des
    // opérations marquées vues mais absentes de la liste.
    this.vues = new Set()
    await this.rattraperInterne()
    this.premierContact = false
    this.serveurVide = this.dernierId === 0

    // La mise à jour de l'application a pu apporter des points.
    const { liste, ajoutes } = fusionnerNouveautes(this.etatServeur, origine)
    if (ajoutes) {
      this.etatServeur = liste
      this.nouveaux = ajoutes
      this.recalculer()
    }

    this.migrerLaListeLocale()
    this.mode = this.sortie.length ? 'envoi' : 'a-jour'
    this.detail = undefined
    this.publier()
    await this.envoyerInterne()
  }

  /**
   * Cet appareil gardait peut-être une liste d'avant la sauvegarde partagée.
   * Si le serveur est vide, elle devient la liste de tous. S'il ne l'est pas
   * et qu'elle dit autre chose, on la propose — jamais on ne l'écrase sans
   * demander : c'est peut-être la seule copie d'un travail perdu ailleurs.
   */
  private migrerLaListeLocale() {
    const locale = this.lireLocale()
    if (!locale) return
    if (!differeDeLOrigine(locale)) {
      this.memoire.effacer(CLE_LOCALE)
      return
    }
    if (this.serveurVide) {
      // Elle passe AVANT ce qu'on a pu faire ici en attendant le serveur :
      // l'écran montrait cette liste, les gestes se sont faits dessus.
      this.sortie.unshift(dater({ k: 'remplacer', liste: locale, motif: 'appareil' }))
      this.recalculer()
      this.memoire.effacer(CLE_LOCALE)
      return
    }
    if (memeContenu(locale, this.liste)) {
      this.memoire.effacer(CLE_LOCALE)
      return
    }
    this.proposition = locale
  }

  /** La liste de cet appareil remplace la partagée (après proposition). */
  accepterProposition(): void {
    if (!this.proposition) return
    const l = this.proposition
    this.proposition = null
    this.memoire.effacer(CLE_LOCALE)
    this.agir({ k: 'remplacer', liste: l, motif: 'appareil' })
  }

  /** On garde la partagée ; la liste de cet appareil est oubliée. */
  refuserProposition(): void {
    this.proposition = null
    this.memoire.effacer(CLE_LOCALE)
    this.publier()
  }

  /** Marque les points nouveaux comme vus. */
  nouveautesVues(): void {
    this.nouveaux = 0
    this.publier()
  }

  // ------------------------------------------------------------- gestes
  /** Un geste de l'utilisateur : appliqué tout de suite, envoyé bientôt. */
  agir(op: Operation): void {
    const datee = dater(op)
    if (!this.partage) {
      const maj = appliquerOperation(this.liste, datee)
      if (maj !== this.liste) {
        this.liste = maj
        this.etatServeur = maj
        this.ecrireLocale(maj)
        this.publier()
      }
      return
    }
    const derniere = this.sortie[this.sortie.length - 1]
    const fusion = derniere && !this.enVol.has(derniere.u) ? fusionnerCorrectifs(derniere, datee) : null
    if (fusion) this.sortie[this.sortie.length - 1] = fusion
    else this.sortie.push(datee)
    this.liste = appliquerOperation(this.liste, datee)
    this.ecrireSortie()
    if (this.mode === 'a-jour') this.mode = 'envoi'
    this.publier()
    this.planifierEnvoi()
  }

  private planifierEnvoi() {
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = setTimeout(() => {
      this.minuterie = null
      this.enfiler(() => this.envoyerInterne())
    }, this.delaiEnvoiMs)
  }

  private async envoyerInterne() {
    if (!this.serveur || !this.partage || this.premierContact) return
    if (this.sortie.length === 0) {
      if (this.mode !== 'a-jour') {
        this.mode = 'a-jour'
        this.detail = undefined
        this.publier()
      }
      return
    }
    this.mode = 'envoi'
    this.publier()
    const lot = [...this.sortie]
    const lignes = lot.map((op) => this.ligne(op))
    for (const op of lot) this.enVol.add(op.u)
    try {
      await this.serveur.ecrire(lignes)
    } catch (e) {
      if (!(e instanceof Doublon)) throw e
      // Une des lignes y était déjà (un envoi interrompu juste après avoir
      // abouti) : on passe les autres une à une.
      for (const l of lignes) {
        try {
          await this.serveur.ecrire([l])
        } catch (e2) {
          if (!(e2 instanceof Doublon)) throw e2
        }
      }
    } finally {
      for (const op of lot) this.enVol.delete(op.u)
    }
    // Le rattrapage relit nos lignes dans l'ordre du serveur et les sort de la file.
    await this.rattraperInterne()
    this.serveur.signaler()
    this.mode = this.sortie.length ? 'envoi' : 'a-jour'
    this.detail = undefined
    this.publier()
    if (this.sortie.length) this.planifierEnvoi()
  }

  private ligne(op: OperationDatee): NouvelleLigne {
    return { genre: 'op', auteur: this.auteur, appareil: this.appareil, contenu: op }
  }

  /** Lit et rejoue tout ce qui est arrivé depuis la dernière ligne connue. */
  private async rattraperInterne() {
    const serveur = this.serveur!
    const LOT = 500
    let recues = 0
    for (;;) {
      const lignes = await serveur.lire(this.dernierId, LOT)
      for (const l of lignes) this.integrer(l)
      recues += lignes.length
      if (lignes.length < LOT) break
    }
    if (recues || this.premierContact) {
      this.recalculer()
      this.ecrireCache()
      if (this.mode === 'hors-ligne') {
        this.mode = this.sortie.length ? 'envoi' : 'a-jour'
        this.detail = undefined
      }
      this.publier()
    }
    await this.deposerInstantaneSiBesoin()
  }

  private integrer(l: Ligne) {
    this.dernierId = Math.max(this.dernierId, l.id)
    if (l.genre === 'instantane') {
      if (typeof l.jusqua === 'number') this.jusquaInstantane = Math.max(this.jusquaInstantane, l.jusqua)
      return
    }
    const op = operationDepuis(l.contenu)
    if (!op || this.vues.has(op.u)) return
    this.vues.add(op.u)
    this.etatServeur = appliquerOperation(this.etatServeur, op)
    const i = this.sortie.findIndex((s) => s.u === op.u)
    if (i >= 0) this.sortie.splice(i, 1)
    this.noter({ id: l.id, quand: l.cree, auteur: l.auteur, op })
  }

  private noter(entree: Entree) {
    if (this.journal.some((e) => e.id === entree.id)) return
    this.journal = [entree, ...this.journal].sort((a, b) => b.id - a.id).slice(0, this.tailleJournal)
  }

  private recalculer() {
    this.liste = rejouer(this.etatServeur, this.sortie)
    this.ecrireSortie()
  }

  private async deposerInstantaneSiBesoin() {
    if (this.dernierId === 0 || this.dernierId - this.jusquaInstantane < this.lignesParInstantane) return
    const jusqua = this.dernierId
    // On le note avant d'écrire : si deux appareils déposent en même temps,
    // c'est sans gravité — mais un seul appareil ne doit pas le faire deux fois.
    this.jusquaInstantane = jusqua
    await this.serveur!.ecrire([
      { genre: 'instantane', auteur: this.auteur, appareil: this.appareil, jusqua, contenu: { liste: this.etatServeur } },
    ])
    this.ecrireCache()
  }

  // ------------------------------------------------------------ journal
  /** Complète le journal avec les dernières opérations du serveur. */
  async chargerJournal(limite = 100): Promise<void> {
    if (!this.serveur || !this.partage || this.journalCharge) return
    const lignes = await this.serveur.dernieresOperations(limite)
    for (const l of lignes) {
      const op = operationDepuis(l.contenu)
      if (op) this.noter({ id: l.id, quand: l.cree, auteur: l.auteur, op })
    }
    this.journalCharge = true
    this.publier()
  }

  /**
   * Revient à la liste telle qu'elle était juste AVANT l'opération donnée —
   * par une nouvelle opération « remplacer », qui s'ajoute au journal comme
   * les autres : on peut aussi revenir dessus.
   */
  async revenirAvant(id: number): Promise<Liste | null> {
    if (!this.serveur || !this.partage) return null
    const liste = await this.etatAvant(id)
    if (!liste) return null
    this.agir({ k: 'remplacer', liste, motif: 'retour' })
    return liste
  }

  /** La liste telle qu'elle était juste avant la ligne `id`. */
  async etatAvant(id: number): Promise<Liste | null> {
    const serveur = this.serveur
    if (!serveur) return null
    const instantane = await serveur.dernierInstantane(id - 1)
    let base = listeDOrigine()
    let depuis = 0
    if (instantane) {
      const l = valider((instantane.contenu as { liste?: unknown } | null)?.liste)
      if (l) {
        base = l
        depuis = instantane.jusqua ?? 0
      }
    }
    const ops: OperationDatee[] = []
    for (;;) {
      const lignes = await serveur.lire(depuis, 500, id)
      for (const l of lignes) {
        depuis = Math.max(depuis, l.id)
        if (l.genre !== 'op') continue
        const op = operationDepuis(l.contenu)
        if (op) ops.push(op)
      }
      if (lignes.length < 500) break
    }
    return fusionnerNouveautes(rejouer(base, ops), listeDOrigine()).liste
  }

  // ------------------------------------------------------------ auteur
  nommer(auteur: string): void {
    this.auteur = auteur.trim()
    this.memoire.ecrire(CLE_AUTEUR, this.auteur)
    this.publier()
  }

  // ------------------------------------------------------------ mémoire
  private nouvelAppareil(): string {
    const id = Math.random().toString(36).slice(2, 10)
    this.memoire.ecrire(CLE_APPAREIL, id)
    return id
  }

  private lireLocale(): Liste | null {
    const brut = this.memoire.lire(CLE_LOCALE)
    if (!brut) return null
    try {
      return valider(JSON.parse(brut))
    } catch {
      return null
    }
  }

  private ecrireLocale(liste: Liste) {
    this.memoire.ecrire(CLE_LOCALE, JSON.stringify(liste))
  }

  private lireCache(): Cache | null {
    const brut = this.memoire.lire(CLE_CACHE)
    if (!brut) return null
    try {
      const c = JSON.parse(brut) as Partial<Cache>
      const liste = valider(c.liste)
      if (!liste || typeof c.id !== 'number') return null
      return { id: c.id, jusqua: typeof c.jusqua === 'number' ? c.jusqua : 0, liste }
    } catch {
      return null
    }
  }

  private ecrireCache() {
    const c: Cache = { id: this.dernierId, jusqua: this.jusquaInstantane, liste: this.etatServeur }
    this.memoire.ecrire(CLE_CACHE, JSON.stringify(c))
  }

  private lireSortie(): OperationDatee[] {
    const brut = this.memoire.lire(CLE_SORTIE)
    if (!brut) return []
    try {
      const tab = JSON.parse(brut)
      if (!Array.isArray(tab)) return []
      return tab.map(operationDepuis).filter((o): o is OperationDatee => o !== null)
    } catch {
      return []
    }
  }

  private ecrireSortie() {
    if (this.sortie.length) this.memoire.ecrire(CLE_SORTIE, JSON.stringify(this.sortie))
    else this.memoire.effacer(CLE_SORTIE)
  }
}
