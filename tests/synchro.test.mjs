import { test } from 'node:test'
import assert from 'node:assert/strict'

const M = await import('../src/dev/modele.ts')
const C = await import('../src/dev/contenu.ts')
const O = await import('../src/dev/operations.ts')
const S = await import('../src/dev/synchro.ts')

/* ------------------------------------------------------------------------- */
/* Outils : un serveur en mémoire, une mémoire en mémoire, une horloge figée  */
/* ------------------------------------------------------------------------- */

/** Un serveur qui fait ce que fait la table : ajouter, lire, prévenir. */
class FauxServeur {
  constructor() {
    this.lignes = []
    this.ecouteurs = new Set()
    this.panne = false
    this.absent = false
    this.ecritures = 0
    this.lectures = 0
  }
  verifier() {
    if (this.absent) throw new S.ServeurNonConfigure('table absente')
    if (this.panne) throw new Error('réseau coupé')
  }
  async lire(depuis, limite, avant) {
    this.verifier()
    this.lectures++
    return this.lignes.filter((l) => l.id > depuis && (avant === undefined || l.id < avant)).slice(0, limite)
  }
  async dernierInstantane(jusquaMax) {
    this.verifier()
    const inst = this.lignes
      .filter((l) => l.genre === 'instantane' && (jusquaMax === undefined || l.jusqua <= jusquaMax))
      .sort((a, b) => b.jusqua - a.jusqua)
    return inst[0] ?? null
  }
  async dernieresOperations(limite) {
    this.verifier()
    return this.lignes.filter((l) => l.genre === 'op').slice(-limite).reverse()
  }
  async ecrire(nouvelles) {
    this.verifier()
    this.ecritures++
    const us = new Set(this.lignes.filter((l) => l.genre === 'op').map((l) => l.contenu.u))
    if (nouvelles.some((n) => n.genre === 'op' && us.has(n.contenu.u))) throw new S.Doublon()
    const creees = nouvelles.map((n) => ({
      id: this.lignes.length + 1 + nouvelles.indexOf(n),
      cree: new Date(2026, 10, 24, 10, 0, this.lignes.length).toISOString(),
      genre: n.genre,
      auteur: n.auteur,
      jusqua: n.jusqua ?? null,
      // comme Postgres : ce qui est stocké est une copie, en JSON
      contenu: JSON.parse(JSON.stringify(n.contenu)),
    }))
    this.lignes.push(...creees)
    return creees
  }
  ecouter(cb) {
    this.ecouteurs.add(cb)
    return () => this.ecouteurs.delete(cb)
  }
  signaler() {
    for (const cb of this.ecouteurs) cb()
  }
}

class FausseMemoire {
  constructor() {
    this.m = new Map()
  }
  lire(c) {
    return this.m.has(c) ? this.m.get(c) : null
  }
  ecrire(c, v) {
    this.m.set(c, v)
  }
  effacer(c) {
    this.m.delete(c)
  }
}

/** Laisse la file d'accès au serveur se vider (quelques tours de boucle). */
async function attendre(n = 20) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

function appareil(serveur, memoire = new FausseMemoire(), options = {}) {
  const s = new S.Synchro(serveur, memoire, { delaiEnvoiMs: 1, ...options })
  s.demarrer()
  return s
}

function premierPoint(liste) {
  return liste.categories[0].sousCategories[0].elements[0]
}

function trouver(liste, id) {
  for (const c of liste.categories) for (const sc of c.sousCategories) for (const e of sc.elements) if (e.id === id) return e
  return null
}

/* ------------------------------------------------------------------------- */
/* Les opérations, seules                                                    */
/* ------------------------------------------------------------------------- */

test('une opération rejouée un autre jour donne exactement le même point', () => {
  const l = C.listeDOrigine()
  const e = premierPoint(l)
  const op = O.dater({ k: 'el-modifier', id: e.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e.titre })
  M.reglerHorloge(() => new Date('2027-03-01T08:00:00Z'))
  try {
    const r = O.appliquerOperation(l, op)
    const e2 = trouver(r, e.id)
    assert.equal(e2.etat, 'valide')
    assert.equal(e2.maj, '2026-11-24', 'la date vient de l’opération, pas de l’horloge')
    assert.equal(r.modifie, op.d, 'la liste porte la date de l’opération')
  } finally {
    M.reglerHorloge(null)
  }
})

test('chaque sorte d’opération s’applique, et se relit telle qu’envoyée', () => {
  let l = C.listeDOrigine()
  const sc = l.categories[0].sousCategories[0].id
  const cat = l.categories[0].id
  const ops = [
    { k: 'el-ajouter', sc, element: { id: 'u-test1', titre: 'Un point neuf', etat: 'a-faire' } },
    { k: 'el-modifier', id: 'u-test1', patch: { note: 'Oui.', qui: 'Valentin', alerte: true }, titre: 'Un point neuf' },
    { k: 'el-deplacer', id: 'u-test1', delta: -1, titre: 'Un point neuf' },
    { k: 'sc-ajouter', cat, id: 'sc-test', titre: 'Divers' },
    { k: 'el-transferer', id: 'u-test1', vers: 'sc-test', titre: 'Un point neuf' },
    { k: 'sc-renommer', id: 'sc-test', titre: 'Divers et variés' },
    { k: 'sc-deplacer', id: 'sc-test', delta: -1, titre: 'Divers et variés' },
    { k: 'cat-ajouter', id: 'cat-test', titre: 'Communication', intro: 'Ce qu’on dit du jeu.' },
    { k: 'cat-renommer', id: 'cat-test', titre: 'Communication & presse' },
    { k: 'cat-deplacer', id: 'cat-test', delta: -1, titre: 'Communication & presse' },
  ]
  for (const brut of ops) {
    const op = O.dater(brut)
    // aller-retour par le JSON du serveur
    const relue = O.operationDepuis(JSON.parse(JSON.stringify(op)))
    assert.ok(relue, `${brut.k} se relit`)
    assert.deepEqual(relue, op)
    const r = O.appliquerOperation(l, relue)
    assert.notEqual(r, l, `${brut.k} change la liste`)
    l = r
  }
  const e = trouver(l, 'u-test1')
  assert.equal(e.note, 'Oui.')
  assert.equal(e.alerte, true)
  const divers = l.categories.flatMap((c) => c.sousCategories).find((s) => s.id === 'sc-test')
  assert.equal(divers.titre, 'Divers et variés')
  assert.equal(divers.elements[0].id, 'u-test1')
  assert.equal(l.categories[l.categories.length - 2].titre, 'Communication & presse')

  // supprimer, puis rejouer la suppression : la seconde fois ne change rien
  const sup = O.dater({ k: 'el-supprimer', id: 'u-test1', titre: 'Un point neuf' })
  const l2 = O.appliquerOperation(l, sup)
  assert.equal(trouver(l2, 'u-test1'), null)
  assert.equal(O.appliquerOperation(l2, sup), l2)
  const l3 = O.appliquerOperation(l2, O.dater({ k: 'cat-supprimer', id: 'cat-test', titre: '' }))
  assert.ok(!l3.categories.some((c) => c.id === 'cat-test'))
  const l4 = O.appliquerOperation(l3, O.dater({ k: 'sc-supprimer', id: 'sc-test', titre: '' }))
  assert.ok(!l4.categories.some((c) => c.sousCategories.some((s) => s.id === 'sc-test')))
})

test('une ligne mal formée est ignorée, pas appliquée', () => {
  assert.equal(O.operationDepuis(null), null)
  assert.equal(O.operationDepuis({ k: 'el-modifier' }), null)
  assert.equal(O.operationDepuis({ k: 'el-modifier', id: 'x', patch: { etat: 'inconnu' }, u: 'a', d: '2026-01-01T00:00:00Z' }), null)
  assert.equal(O.operationDepuis({ k: 'el-deplacer', id: 'x', delta: 5, u: 'a', d: '2026-01-01T00:00:00Z' }), null)
  assert.equal(O.operationDepuis({ k: 'remplacer', liste: { format: 2 }, u: 'a', d: '2026-01-01T00:00:00Z' }), null)
  assert.equal(O.operationDepuis({ k: 'inventee', u: 'a', d: '2026-01-01T00:00:00Z' }), null)
  const bonne = O.operationDepuis({ k: 'el-modifier', id: 'x', patch: { note: '' }, u: 'a', d: '2026-01-01T00:00:00Z' })
  assert.deepEqual(bonne.patch, { note: undefined }, 'une note vidée voyage comme un effacement')
})

test('taper une note lettre à lettre ne fait qu’une opération', () => {
  const a = O.dater({ k: 'el-modifier', id: 'p', patch: { note: 'O' }, titre: 'P' })
  const b = O.dater({ k: 'el-modifier', id: 'p', patch: { note: 'Ou' }, titre: 'P' })
  const f = O.fusionnerCorrectifs(a, b)
  assert.equal(f.u, a.u, 'garde l’identifiant de la première')
  assert.deepEqual(f.patch, { note: 'Ou' })
  const autre = O.dater({ k: 'el-modifier', id: 'q', patch: { note: 'x' }, titre: 'Q' })
  assert.equal(O.fusionnerCorrectifs(a, autre), null, 'pas entre deux points différents')
  assert.equal(O.fusionnerCorrectifs(a, O.dater({ k: 'el-supprimer', id: 'p', titre: 'P' })), null)
})

test('le journal raconte chaque opération en français', () => {
  const d = (op) => O.decrire(op)
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { etat: 'valide', maj: '2026-11-24' }, titre: 'Durée' }), 'a validé « Durée »')
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { etat: 'ecarte' }, titre: 'Durée' }), 'a écarté « Durée »')
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { alerte: true }, titre: 'Durée' }), 'a signalé « Durée » ⚠')
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { qui: 'Anne' }, titre: 'Durée' }), 'a confié « Durée » à Anne')
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { note: 'ok' }, titre: 'Durée' }), 'a écrit une décision sur « Durée »')
  assert.equal(d({ k: 'el-modifier', id: 'x', patch: { detail: 'x' }, titre: 'Durée' }), 'a modifié « Durée »')
  assert.equal(d({ k: 'el-ajouter', sc: 's', element: { id: 'n', titre: 'Neuf', etat: 'a-faire' } }), 'a ajouté « Neuf »')
  assert.equal(d({ k: 'el-supprimer', id: 'x', titre: 'Durée' }), 'a supprimé « Durée »')
  assert.equal(d({ k: 'cat-supprimer', id: 'x', titre: 'Règles' }), 'a supprimé la catégorie « Règles » et ses points')
  assert.equal(d({ k: 'remplacer', liste: C.listeDOrigine(), motif: 'retour' }), 'a remplacé toute la liste par un état antérieur')
  assert.equal(d({ k: 'remplacer', liste: C.listeDOrigine(), motif: 'appareil' }), 'a remplacé toute la liste par la liste gardée sur un appareil')
})

/* ------------------------------------------------------------------------- */
/* La synchronisation entre appareils                                        */
/* ------------------------------------------------------------------------- */

test('deux appareils voient la même liste : ce que l’un coche, l’autre le reçoit', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur)
  const b = appareil(serveur)
  await attendre()
  assert.equal(a.etat().mode, 'a-jour')
  assert.equal(b.etat().mode, 'a-jour')

  const e = premierPoint(a.etat().liste)
  a.agir({ k: 'el-modifier', id: e.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e.titre })
  assert.equal(trouver(a.etat().liste, e.id).etat, 'valide', 'appliqué tout de suite chez A')
  assert.equal(a.etat().mode, 'envoi')
  assert.equal(a.etat().enAttente, 1)
  await attendre(40)
  assert.equal(a.etat().mode, 'a-jour')
  assert.equal(a.etat().enAttente, 0)
  // le serveur a prévenu B, qui a rattrapé
  assert.equal(trouver(b.etat().liste, e.id).etat, 'valide', 'B voit la coche de A')
  assert.equal(b.etat().journal.length, 1)
  assert.equal(O.decrire(b.etat().journal[0].op), `a validé « ${e.titre} »`)

  // et dans l'autre sens, avec une note tapée lettre à lettre
  b.nommer('Anne')
  for (const n of ['D', 'Dé', 'Déc', 'Décidé']) {
    b.agir({ k: 'el-modifier', id: e.id, patch: { note: n }, titre: e.titre })
  }
  assert.equal(b.etat().enAttente, 1, 'les quatre frappes n’en font qu’une')
  await attendre(40)
  assert.equal(trouver(a.etat().liste, e.id).note, 'Décidé')
  assert.equal(serveur.lignes.length, 2, 'deux lignes au serveur, pas cinq')
  assert.equal(serveur.lignes[1].auteur, 'Anne')
  assert.equal(a.etat().journal[0].auteur, 'Anne')
  a.arreter()
  b.arreter()
})

test('hors ligne, les gestes attendent dans la mémoire et partent au retour du réseau', async () => {
  const serveur = new FauxServeur()
  const memoire = new FausseMemoire()
  const a = appareil(serveur, memoire)
  await attendre()
  assert.equal(a.etat().mode, 'a-jour')

  serveur.panne = true
  const l = a.etat().liste
  const e1 = premierPoint(l)
  const e2 = l.categories[1].sousCategories[0].elements[0]
  a.agir({ k: 'el-modifier', id: e1.id, patch: { etat: 'en-cours', maj: '2026-11-24' }, titre: e1.titre })
  a.agir({ k: 'el-modifier', id: e2.id, patch: { alerte: true }, titre: e2.titre })
  await attendre(40)
  assert.equal(a.etat().mode, 'hors-ligne')
  assert.equal(a.etat().enAttente, 2)
  assert.equal(trouver(a.etat().liste, e2.id).alerte, true, 'on continue de travailler')
  assert.ok(memoire.lire(S.CLE_SORTIE), 'la file est en mémoire : fermer l’onglet ne perd rien')

  // L'onglet est fermé puis rouvert — toujours hors ligne : la liste est intacte.
  a.arreter()
  const a2 = appareil(serveur, memoire)
  await attendre(40)
  assert.equal(a2.etat().mode, 'hors-ligne')
  assert.equal(trouver(a2.etat().liste, e1.id).etat, 'en-cours')
  assert.equal(a2.etat().enAttente, 2)

  // Le réseau revient.
  serveur.panne = false
  a2.reveiller()
  await attendre(40)
  assert.equal(a2.etat().mode, 'a-jour')
  assert.equal(a2.etat().enAttente, 0)
  assert.equal(serveur.lignes.length, 2)
  assert.equal(memoire.lire(S.CLE_SORTIE), null)

  // Un troisième appareil, neuf, reçoit tout.
  const c = appareil(serveur)
  await attendre()
  assert.equal(trouver(c.etat().liste, e1.id).etat, 'en-cours')
  assert.equal(trouver(c.etat().liste, e2.id).alerte, true)
  a2.arreter()
  c.arreter()
})

test('deux appareils qui modifient en même temps ne se perdent rien', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur)
  const b = appareil(serveur)
  await attendre()
  const l = a.etat().liste
  const e1 = premierPoint(l)
  const e2 = l.categories[2].sousCategories[0].elements[0]
  const sc = l.categories[3].sousCategories[0].id
  a.agir({ k: 'el-modifier', id: e1.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e1.titre })
  b.agir({ k: 'el-modifier', id: e2.id, patch: { etat: 'ecarte', maj: '2026-11-24' }, titre: e2.titre })
  b.agir({ k: 'el-ajouter', sc, element: { id: 'u-b1', titre: 'Point de B', etat: 'a-faire' } })
  a.agir({ k: 'el-ajouter', sc, element: { id: 'u-a1', titre: 'Point de A', etat: 'a-faire' } })
  await attendre(60)
  const la = a.etat().liste
  const lb = b.etat().liste
  assert.deepEqual(M.statistiques(la), M.statistiques(lb))
  assert.equal(JSON.stringify(la.categories), JSON.stringify(lb.categories), 'les deux listes sont identiques')
  assert.equal(trouver(la, e1.id).etat, 'valide')
  assert.equal(trouver(la, e2.id).etat, 'ecarte')
  assert.ok(trouver(la, 'u-a1') && trouver(la, 'u-b1'))
  a.arreter()
  b.arreter()
})

test('la table absente : la liste reste sur l’appareil, et la page le dit', async () => {
  const serveur = new FauxServeur()
  serveur.absent = true
  const memoire = new FausseMemoire()
  const a = appareil(serveur, memoire)
  await attendre()
  assert.equal(a.etat().mode, 'non-configure')
  assert.match(a.etat().detail, /table absente/)
  const e = premierPoint(a.etat().liste)
  a.agir({ k: 'el-modifier', id: e.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e.titre })
  await attendre(20)
  assert.equal(a.etat().enAttente, 0, 'rien n’attend : la liste est locale')
  assert.ok(memoire.lire(S.CLE_LOCALE), 'elle est en mémoire, comme avant')
  assert.equal(serveur.ecritures, 0)

  // La table est créée ; on revient sur l'onglet : la liste de l'appareil devient celle de tous.
  serveur.absent = false
  a.reveiller()
  await attendre(60)
  assert.equal(a.etat().mode, 'a-jour')
  assert.equal(serveur.lignes.length, 1)
  assert.equal(serveur.lignes[0].contenu.k, 'remplacer')
  assert.equal(serveur.lignes[0].contenu.motif, 'appareil')
  assert.equal(memoire.lire(S.CLE_LOCALE), null)
  const b = appareil(serveur)
  await attendre()
  assert.equal(trouver(b.etat().liste, e.id).etat, 'valide')
  a.arreter()
  b.arreter()
})

test('la liste d’un appareil d’avant la sauvegarde partagée est proposée, jamais écrasée', async () => {
  const serveur = new FauxServeur()
  // Le serveur a déjà une liste : quelqu'un a validé un point.
  const a = appareil(serveur)
  await attendre()
  const e1 = premierPoint(a.etat().liste)
  a.agir({ k: 'el-modifier', id: e1.id, patch: { etat: 'valide', maj: '2026-11-20' }, titre: e1.titre })
  await attendre(40)

  // Un appareil gardait une vieille liste locale, différente.
  const memoire = new FausseMemoire()
  const vieille = M.modifierElement(C.listeDOrigine(), e1.id, { etat: 'ecarte', note: 'Décidé en réunion' })
  memoire.ecrire(S.CLE_LOCALE, M.serialiser(vieille))
  const b = appareil(serveur, memoire)
  await attendre()
  assert.equal(b.etat().mode, 'a-jour')
  assert.equal(trouver(b.etat().liste, e1.id).etat, 'valide', 'B affiche la liste partagée')
  assert.ok(b.etat().proposition, 'et propose la sienne')
  assert.equal(trouver(b.etat().proposition, e1.id).note, 'Décidé en réunion')

  b.accepterProposition()
  await attendre(40)
  assert.equal(b.etat().proposition, null)
  assert.equal(memoire.lire(S.CLE_LOCALE), null)
  assert.equal(trouver(a.etat().liste, e1.id).note, 'Décidé en réunion', 'A reçoit la liste de B')
  assert.equal(a.etat().journal[0].op.k, 'remplacer')

  // Une liste locale identique à l'origine n'a rien à proposer.
  const memoire2 = new FausseMemoire()
  memoire2.ecrire(S.CLE_LOCALE, M.serialiser(C.listeDOrigine()))
  const c = appareil(serveur, memoire2)
  await attendre()
  assert.equal(c.etat().proposition, null)
  assert.equal(memoire2.lire(S.CLE_LOCALE), null)
  a.arreter()
  b.arreter()
  c.arreter()
})

test('un instantané est déposé de temps en temps, et le nouvel arrivant repart de lui', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur, new FausseMemoire(), { lignesParInstantane: 5 })
  await attendre()
  const l = a.etat().liste
  const points = l.categories[0].sousCategories[0].elements.slice(0, 6)
  for (const p of points) {
    a.agir({ k: 'el-modifier', id: p.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: p.titre })
    await attendre(40)
  }
  const instantanes = serveur.lignes.filter((x) => x.genre === 'instantane')
  assert.ok(instantanes.length >= 1, 'au moins un instantané')
  const dernier = instantanes[instantanes.length - 1]
  assert.ok(dernier.jusqua >= 5)
  assert.equal(trouver(dernier.contenu.liste, points[0].id).etat, 'valide')

  const lecturesAvant = serveur.lectures
  const b = appareil(serveur)
  await attendre()
  assert.equal(serveur.lectures - lecturesAvant, 1, 'une seule lecture : l’instantané puis le reste')
  for (const p of points) assert.equal(trouver(b.etat().liste, p.id).etat, 'valide')
  a.arreter()
  b.arreter()
})

test('le journal se charge, et on revient à l’état d’avant n’importe quelle action', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur, new FausseMemoire(), { lignesParInstantane: 3 })
  a.nommer('Valentin')
  await attendre()
  const l = a.etat().liste
  const [p1, p2, p3] = l.categories[0].sousCategories[0].elements
  a.agir({ k: 'el-modifier', id: p1.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: p1.titre })
  await attendre(40)
  a.agir({ k: 'el-modifier', id: p2.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: p2.titre })
  await attendre(40)
  a.agir({ k: 'el-supprimer', id: p3.id, titre: p3.titre })
  await attendre(40)
  a.agir({ k: 'el-modifier', id: p1.id, patch: { note: 'Après coup' }, titre: p1.titre })
  await attendre(40)
  assert.equal(trouver(a.etat().liste, p3.id), null)

  // Un appareil neuf charge le journal.
  const b = appareil(serveur)
  await attendre()
  await b.chargerJournal()
  const journal = b.etat().journal
  assert.equal(journal.length, 4)
  assert.equal(journal[0].auteur, 'Valentin')
  assert.equal(O.decrire(journal[0].op), `a écrit une décision sur « ${p1.titre} »`)
  const suppression = journal.find((e) => e.op.k === 'el-supprimer')

  // Revenir à l'état d'avant la suppression (il y a un instantané entre deux).
  assert.ok(serveur.lignes.some((x) => x.genre === 'instantane'))
  const restauree = await b.revenirAvant(suppression.id)
  assert.ok(trouver(restauree, p3.id), 'le point supprimé est de retour')
  assert.equal(trouver(restauree, p2.id).etat, 'valide', 'ce qui précédait est gardé')
  assert.equal(trouver(restauree, p1.id).note, undefined, 'ce qui suivait est défait')
  await attendre(40)
  assert.ok(trouver(a.etat().liste, p3.id), 'A reçoit le retour')
  assert.equal(a.etat().journal[0].op.k, 'remplacer')
  assert.equal(a.etat().journal[0].op.motif, 'retour')
  a.arreter()
  b.arreter()
})

test('une opération renvoyée deux fois par le serveur ne compte qu’une fois', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur)
  await attendre()
  const l = a.etat().liste
  const sc = l.categories[0].sousCategories[0]
  const e = sc.elements[1]
  a.agir({ k: 'el-deplacer', id: e.id, delta: -1, titre: e.titre })
  await attendre(40)
  // Le serveur duplique la ligne (ça n'arrive pas, mais si ça arrivait…)
  serveur.lignes.push({ ...serveur.lignes[0], id: 2 })
  const b = appareil(serveur)
  await attendre()
  assert.equal(b.etat().liste.categories[0].sousCategories[0].elements[0].id, e.id, 'monté d’une place, pas de deux')
  a.arreter()
  b.arreter()
})

test('un envoi interrompu après avoir abouti ne crée pas de doublon', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur)
  await attendre()
  const e = premierPoint(a.etat().liste)
  // Le serveur reçoit, mais la réponse se perd : la lecture qui suit échoue.
  const lireOriginal = serveur.lire.bind(serveur)
  let coupures = 1
  serveur.lire = async (...args) => {
    if (coupures-- > 0 && serveur.lignes.length > 0) throw new Error('réseau coupé')
    return lireOriginal(...args)
  }
  a.agir({ k: 'el-modifier', id: e.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e.titre })
  await attendre(40)
  assert.equal(a.etat().mode, 'hors-ligne')
  assert.equal(a.etat().enAttente, 1, 'l’opération reste en file : on ne sait pas si elle est passée')
  a.reveiller()
  await attendre(40)
  assert.equal(a.etat().mode, 'a-jour')
  assert.equal(a.etat().enAttente, 0)
  assert.equal(serveur.lignes.filter((x) => x.genre === 'op').length, 1, 'une seule ligne au serveur')
  a.arreter()
})

test('ce qu’on tape pendant qu’un envoi est en route n’est pas perdu', async () => {
  const serveur = new FauxServeur()
  const a = appareil(serveur)
  await attendre()
  const e = premierPoint(a.etat().liste)
  // L'écriture au serveur prend du temps : on la retient.
  const ecrireOriginal = serveur.ecrire.bind(serveur)
  let liberer
  serveur.ecrire = (...args) =>
    new Promise((resolve, reject) => {
      liberer = () => ecrireOriginal(...args).then(resolve, reject)
    })
  a.agir({ k: 'el-modifier', id: e.id, patch: { note: 'Déc' }, titre: e.titre })
  await attendre(10)
  assert.ok(liberer, 'l’envoi est parti')
  // On continue de taper pendant qu'il est en route.
  a.agir({ k: 'el-modifier', id: e.id, patch: { note: 'Décidé' }, titre: e.titre })
  assert.equal(a.etat().enAttente, 2, 'la suite part dans une opération à part')
  serveur.ecrire = ecrireOriginal
  liberer()
  await attendre(60)
  assert.equal(trouver(a.etat().liste, e.id).note, 'Décidé', 'l’écran garde ce qui a été tapé')
  assert.equal(a.etat().enAttente, 0)
  const b = appareil(serveur)
  await attendre()
  assert.equal(trouver(b.etat().liste, e.id).note, 'Décidé', 'et le serveur aussi')
  a.arreter()
  b.arreter()
})

test('un premier contact interrompu en plein rattrapage ne perd rien au second', async () => {
  const serveur = new FauxServeur()
  // 600 opérations au serveur : plus d'un lot de lecture.
  const l = C.listeDOrigine()
  const points = l.categories.flatMap((c) => c.sousCategories.flatMap((s) => s.elements))
  for (let i = 0; i < 600; i++) {
    const p = points[i % points.length]
    await serveur.ecrire([{ genre: 'op', auteur: 'X', appareil: 'x', contenu: O.dater({ k: 'el-modifier', id: p.id, patch: { qui: `Q${i}` }, titre: p.titre }) }])
  }
  const lireOriginal = serveur.lire.bind(serveur)
  let lots = 0
  serveur.lire = async (depuis, limite, avant) => {
    if (depuis > 0 && lots++ === 0) throw new Error('réseau coupé') // le second lot échoue
    return lireOriginal(depuis, limite, avant)
  }
  const memoire = new FausseMemoire()
  const a = appareil(serveur, memoire, { lignesParInstantane: 100000 })
  await attendre(40)
  assert.equal(a.etat().mode, 'hors-ligne')
  a.reveiller()
  await attendre(60)
  assert.equal(a.etat().mode, 'a-jour')
  for (let i = 600 - points.length; i < 600; i++) {
    const p = points[i % points.length]
    assert.equal(trouver(a.etat().liste, p.id).qui, `Q${i}`)
  }
  a.arreter()
})

test('sans serveur du tout, la liste vit sur l’appareil comme avant', async () => {
  const memoire = new FausseMemoire()
  const a = new S.Synchro(null, memoire)
  a.demarrer()
  assert.equal(a.etat().mode, 'local')
  const e = premierPoint(a.etat().liste)
  a.agir({ k: 'el-modifier', id: e.id, patch: { etat: 'valide', maj: '2026-11-24' }, titre: e.titre })
  assert.equal(trouver(a.etat().liste, e.id).etat, 'valide')
  const b = new S.Synchro(null, memoire)
  assert.equal(trouver(b.etat().liste, e.id).etat, 'valide', 'relue de la mémoire')
})
