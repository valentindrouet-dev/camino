import { test } from 'node:test'
import assert from 'node:assert/strict'

const M = await import('../src/dev/modele.ts')
const C = await import('../src/dev/contenu.ts')
const E = await import('../src/engine/index.ts')
const { CATALOGUE } = await import('../src/ui/reglages.ts')

/* ------------------------------------------------------------------------- */
/* Le contenu d'origine                                                      */
/* ------------------------------------------------------------------------- */

test('la liste d’origine a les quatre catégories demandées, dans l’ordre', () => {
  const l = C.listeDOrigine()
  assert.deepEqual(
    l.categories.map((c) => c.titre),
    ['Mécaniques', 'Illustrations', 'Matériel', 'Règles'],
  )
  assert.equal(l.format, 1)
  assert.equal(l.modele, C.MODELE)
  assert.equal(M.valider(JSON.parse(M.serialiser(l)))?.titre, l.titre, 'elle se relit')
})

test('aucun identifiant en double, aucun point sans titre', () => {
  const l = C.listeDOrigine()
  const ids = []
  for (const c of l.categories) {
    ids.push(c.id)
    for (const sc of c.sousCategories) {
      ids.push(sc.id)
      assert.ok(sc.elements.length > 0, `« ${sc.titre} » n’est pas vide`)
      for (const e of sc.elements) {
        ids.push(e.id)
        assert.ok(e.titre.trim().length > 3, `titre de ${e.id}`)
        assert.equal(e.etat, 'a-faire', 'tout est à faire au départ')
      }
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques')
})

test('la liste couvre chaque carte, chaque carte retirée et chaque variante du catalogue', () => {
  const l = C.listeDOrigine()
  const ids = new Set(l.categories.flatMap((c) => c.sousCategories.flatMap((s) => s.elements.map((e) => e.id))))
  for (const carte of E.CARDS) {
    assert.ok(ids.has(`mec-carte-${carte.id}`), `mécanique de ${carte.id}`)
    assert.ok(ids.has(`mec-wording-${carte.id}`), `texte de ${carte.id}`)
  }
  for (const carte of E.TOUTES_LES_CARTES.filter((c) => !E.CARDS.includes(c))) {
    assert.ok(ids.has(`mec-carte-ecartee-${carte.id}`), `carte retirée ${carte.id}`)
  }
  for (const g of CATALOGUE) {
    if (g.titre === 'OPTIONS DE PARTIE') continue
    for (const v of g.variantes) assert.ok(ids.has(`mec-var-${v.cle}`), `variante ${v.cle}`)
  }
  // Et elle est substantielle : c'est une liste de fin de développement.
  assert.ok(ids.size >= 180, `${ids.size} points`)
})

test('les chiffres cités sont ceux du moteur', () => {
  const l = C.listeDOrigine()
  const texte = JSON.stringify(l)
  assert.ok(texte.includes('97 tuiles'), 'le nombre de tuiles')
  assert.ok(texte.includes(`${E.CARDS.length} cartes`), 'le nombre de cartes')
  assert.ok(texte.includes('55 par couleur, 58 noirs'), 'la répartition des quarts')
  for (const c of E.CARDS) assert.ok(texte.includes(E.cardText(c).slice(0, 30)), `texte de ${c.id}`)
})

/* ------------------------------------------------------------------------- */
/* Compter                                                                   */
/* ------------------------------------------------------------------------- */

function petite() {
  return {
    format: 1,
    modele: 1,
    titre: 'Test',
    modifie: '2026-01-01T00:00:00.000Z',
    categories: [
      {
        id: 'c1',
        titre: 'Une',
        sousCategories: [
          {
            id: 's1',
            titre: 'A',
            elements: [
              { id: 'e1', titre: 'un', etat: 'valide', maj: '2026-01-02' },
              { id: 'e2', titre: 'deux', etat: 'a-faire' },
              { id: 'e3', titre: 'trois', etat: 'en-cours', qui: 'Valentin', alerte: true },
              { id: 'e4', titre: 'quatre', etat: 'ecarte', maj: '2026-01-03' },
            ],
          },
          { id: 's2', titre: 'B', elements: [{ id: 'e5', titre: 'cinq', etat: 'a-faire', qui: 'Valentin' }] },
        ],
      },
      {
        id: 'c2',
        titre: 'Deux',
        sousCategories: [{ id: 's3', titre: 'C', elements: [{ id: 'e6', titre: 'six', etat: 'valide', maj: '2026-01-05' }] }],
      },
    ],
  }
}

test('l’avancement compte les validés et les écartés comme réglés', () => {
  const s = M.statistiques(petite())
  assert.equal(s.total, 6)
  assert.equal(s.valides, 2)
  assert.equal(s.ecartes, 1)
  assert.equal(s.enCours, 1)
  assert.equal(s.aFaire, 2)
  assert.equal(s.pourcent, 50, '3 réglés sur 6')
  assert.equal(s.alertes, 1, 'une alerte, hors du calcul d’avancement')
  assert.equal(s.categories[0].alertes, 1)
  assert.equal(s.categories[1].alertes, 0)
  assert.equal(s.categories[0].sousCategories[0].alertes, 1)
  const c1 = s.categories[0]
  assert.equal(c1.pourcent, 40, '2 réglés sur 5')
  assert.equal(c1.sousCategories[0].pourcent, 50)
  assert.equal(s.categories[1].pourcent, 100)
  // Par responsable : Valentin a deux points, tous deux ouverts.
  const v = s.parResponsable.find((r) => r.qui === 'Valentin')
  assert.deepEqual(v, { qui: 'Valentin', ouverts: 2, total: 2 })
  // Les derniers réglés, les plus récents d'abord.
  assert.deepEqual(s.recents.map((r) => r.element.id), ['e6', 'e4', 'e1'])
})

/* ------------------------------------------------------------------------- */
/* Modifier                                                                  */
/* ------------------------------------------------------------------------- */

test('basculer un état suit le cycle et date le changement', () => {
  M.reglerHorloge(() => new Date('2026-03-04T10:00:00Z'))
  let l = petite()
  l = M.basculerEtat(l, 'e2')
  let e = l.categories[0].sousCategories[0].elements[1]
  assert.equal(e.etat, 'en-cours')
  assert.equal(e.maj, '2026-03-04')
  l = M.basculerEtat(l, 'e2')
  assert.equal(l.categories[0].sousCategories[0].elements[1].etat, 'valide')
  l = M.basculerEtat(l, 'e2')
  assert.equal(l.categories[0].sousCategories[0].elements[1].etat, 'a-faire')
  assert.equal(l.modifie, '2026-03-04T10:00:00.000Z', 'la liste est datée')
  // Un identifiant inconnu ne change rien — et rend la même liste.
  assert.equal(M.basculerEtat(l, 'inconnu'), l)
  M.reglerHorloge(null)
})

test('modifier un point : la date ne bouge que si l’état change', () => {
  M.reglerHorloge(() => new Date('2026-05-06T10:00:00Z'))
  let l = petite()
  l = M.modifierElement(l, 'e2', { note: 'décidé', qui: 'Claude' })
  let e = l.categories[0].sousCategories[0].elements[1]
  assert.equal(e.note, 'décidé')
  assert.equal(e.qui, 'Claude')
  assert.equal(e.maj, undefined, 'pas de date : l’état n’a pas changé')
  l = M.modifierElement(l, 'e2', { etat: 'ecarte' })
  e = l.categories[0].sousCategories[0].elements[1]
  assert.equal(e.maj, '2026-05-06')
  M.reglerHorloge(null)
})

test('ajouter, déplacer, transférer, supprimer un point', () => {
  let l = petite()
  l = M.ajouterElement(l, 's2', '  nouveau  ', 'avec un détail')
  const s2 = () => l.categories[0].sousCategories[1]
  assert.equal(s2().elements.length, 2)
  assert.equal(s2().elements[1].titre, 'nouveau', 'titre nettoyé')
  assert.equal(s2().elements[1].detail, 'avec un détail')
  const id = s2().elements[1].id
  assert.equal(M.ajouterElement(l, 's2', '   '), l, 'un titre vide n’ajoute rien')

  l = M.deplacerElement(l, id, -1)
  assert.equal(s2().elements[0].id, id, 'monté en tête')
  assert.equal(M.deplacerElement(l, id, -1), l, 'déjà en tête : rien')

  l = M.transfererElement(l, id, 's3')
  assert.equal(s2().elements.length, 1)
  const s3 = l.categories[1].sousCategories[0]
  assert.equal(s3.elements.length, 2)
  assert.equal(s3.elements[1].id, id, 'ajouté à la fin')
  assert.equal(M.transfererElement(l, id, 's3'), l, 'déjà là : rien')

  l = M.supprimerElement(l, id)
  assert.equal(l.categories[1].sousCategories[0].elements.length, 1)
  assert.equal(M.statistiques(l).total, 6)
})

test('sous-catégories et catégories : ajouter, renommer, déplacer, supprimer', () => {
  let l = petite()
  l = M.ajouterSousCategorie(l, 'c1', 'Nouvelle')
  assert.equal(l.categories[0].sousCategories.length, 3)
  const scId = l.categories[0].sousCategories[2].id
  l = M.renommerSousCategorie(l, scId, 'Renommée')
  assert.equal(l.categories[0].sousCategories[2].titre, 'Renommée')
  l = M.deplacerSousCategorie(l, scId, -1)
  assert.equal(l.categories[0].sousCategories[1].id, scId)
  l = M.supprimerSousCategorie(l, scId)
  assert.equal(l.categories[0].sousCategories.length, 2)

  l = M.ajouterCategorie(l, 'Application', 'Ce que fait l’appli')
  assert.equal(l.categories.length, 3)
  const catId = l.categories[2].id
  assert.equal(l.categories[2].intro, 'Ce que fait l’appli')
  l = M.renommerCategorie(l, catId, 'Appli', '')
  assert.equal(l.categories[2].titre, 'Appli')
  assert.equal(l.categories[2].intro, undefined, 'une intro vide est retirée')
  l = M.deplacerCategorie(l, catId, -1)
  assert.equal(l.categories[1].id, catId)
  l = M.supprimerCategorie(l, catId)
  assert.equal(l.categories.length, 2)
  assert.deepEqual(
    M.toutesLesSousCategories(l).map((s) => s.id),
    ['s1', 's2', 's3'],
  )
})

/* ------------------------------------------------------------------------- */
/* Fusion avec un contenu d'origine plus récent                              */
/* ------------------------------------------------------------------------- */

test('une mise à jour ajoute les nouveaux points sans rien toucher au reste', () => {
  const mienne = petite()
  mienne.categories[0].sousCategories[0].elements[1].etat = 'valide'
  const origine = petite()
  origine.modele = 2
  origine.categories[0].sousCategories[0].elements.push({ id: 'e7', titre: 'sept', etat: 'a-faire' })
  origine.categories.push({
    id: 'c3',
    titre: 'Trois',
    sousCategories: [{ id: 's4', titre: 'D', elements: [{ id: 'e8', titre: 'huit', etat: 'a-faire' }] }],
  })
  // Un point que j'ai déplacé ailleurs ne doit pas revenir en double.
  const deplace = mienne.categories[0].sousCategories[0].elements.pop()
  mienne.categories[1].sousCategories[0].elements.push(deplace)

  const { liste, ajoutes } = M.fusionnerNouveautes(mienne, origine)
  assert.equal(ajoutes, 2, 'e7 et e8')
  assert.equal(liste.modele, 2)
  assert.equal(liste.categories[0].sousCategories[0].elements[1].etat, 'valide', 'mon état est gardé')
  assert.equal(liste.categories.length, 3, 'la catégorie nouvelle est créée')
  assert.equal(M.statistiques(liste).total, 8)
  const ids = liste.categories.flatMap((c) => c.sousCategories.flatMap((s) => s.elements.map((e) => e.id)))
  assert.equal(new Set(ids).size, ids.length, 'aucun doublon')
  // Même modèle : rien ne se passe.
  assert.equal(M.fusionnerNouveautes(liste, origine).ajoutes, 0)
})

/* ------------------------------------------------------------------------- */
/* Fichier et lien                                                           */
/* ------------------------------------------------------------------------- */

test('sérialiser puis analyser rend la même liste ; un texte étranger est refusé', () => {
  const l = C.listeDOrigine()
  const relue = M.analyser(M.serialiser(l))
  assert.deepEqual(relue, l)
  assert.equal(M.analyser('pas du json'), null)
  assert.equal(M.analyser('{"format":2}'), null)
  assert.equal(M.analyser(JSON.stringify({ format: 1, titre: 'x', categories: [{ id: 'a', titre: 'A', sousCategories: [{ id: 'a', titre: 'dup', elements: [] }] }] })), null, 'identifiant en double')
  assert.equal(M.analyser(JSON.stringify({ format: 1, titre: 'x', categories: [{ id: 'a', titre: 'A', sousCategories: [{ id: 'b', titre: 'B', elements: [{ id: 'c', titre: 'C', etat: 'bizarre' }] }] }] })), null, 'état inconnu')
})

test('le lien de partage porte l’écart à l’origine : court, et fidèle', async () => {
  const origine = C.listeDOrigine()
  // Une liste cochée et annotée, sans réorganisation.
  let l = C.listeDOrigine()
  l = M.modifierElement(l, 'mec-tuiles-nombre', { etat: 'valide', note: 'Confirmé : 97.', qui: 'Claude' })
  l = M.modifierElement(l, 'ill-theme', { etat: 'en-cours' })
  l = M.modifierElement(l, 'mat-sac-taille', { etat: 'ecarte' })
  const code = await M.versLien(l, origine)
  assert.ok(code.startsWith('p.'), 'un écart compressé')
  assert.ok(code.length < 600, `${code.length} caractères : une messagerie le transmet sans le couper`)
  assert.match(code, /^[A-Za-z0-9._-]+$/, 'rien à encoder dans une adresse')
  const relue = await M.depuisLien(code, origine)
  assert.deepEqual(relue, l, 'la liste revient à l’identique')

  // Avec un point ajouté, une sous-catégorie renommée et un ordre changé :
  // la structure voyage, le lien grandit mais reste raisonnable.
  let r = M.ajouterElement(l, 'mec-contenu', 'Un point de plus', 'avec son détail')
  r = M.renommerSousCategorie(r, 'mec-contenu', 'Composition')
  r = M.deplacerCategorie(r, 'regles', -1)
  r = M.deplacerElement(r, 'mec-tuiles-nombre', 1)
  const code2 = await M.versLien(r, origine)
  assert.ok(code2.length < 4000, `${code2.length} caractères avec la structure`)
  const relue2 = await M.depuisLien(code2, origine)
  assert.deepEqual(relue2, r)
  assert.equal(relue2.categories[2].id, 'regles', 'l’ordre des catégories est respecté')
  assert.equal(relue2.categories[0].sousCategories[0].titre, 'Composition')

  // Le destinataire a une origine plus riche : ses points en plus lui restent.
  const origineRiche = C.listeDOrigine()
  origineRiche.modele = C.MODELE + 1
  origineRiche.categories[0].sousCategories[0].elements.push({ id: 'futur', titre: 'Un point futur', etat: 'a-faire' })
  const chezLui = await M.depuisLien(code, origineRiche)
  assert.ok(chezLui.categories[0].sousCategories[0].elements.some((e) => e.id === 'futur'))
  assert.equal(chezLui.categories[0].sousCategories[0].elements[0].note, 'Confirmé : 97.')

  assert.equal(await M.depuisLien('p.pasvalide', origine), null)
  assert.equal(await M.depuisLien('x.abc', origine), null)
})

test('un fichier entier se relit aussi comme lien (ancien format)', async () => {
  // On fabrique un lien « d. » à la main pour s'assurer qu'il reste lisible.
  const origine = C.listeDOrigine()
  const l = M.modifierElement(C.listeDOrigine(), 'reg-pages', { etat: 'valide' })
  const octets = new TextEncoder().encode(JSON.stringify(l))
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const comp = new Uint8Array(await new Response(flux).arrayBuffer())
  let bin = ''
  for (const b of comp) bin += String.fromCharCode(b)
  const code = 'd.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const relue = await M.depuisLien(code, origine)
  assert.deepEqual(relue, l)
})

/* ------------------------------------------------------------------------- */
/* Alertes : ce qu'on apporte à la réunion avec les auteurs                  */
/* ------------------------------------------------------------------------- */

test('une alerte se pose et se retire sans toucher à l’état ni à sa date', () => {
  M.reglerHorloge(() => new Date('2026-07-08T10:00:00Z'))
  let l = petite()
  l = M.basculerAlerte(l, 'e1')
  let e = l.categories[0].sousCategories[0].elements[0]
  assert.equal(e.alerte, true)
  assert.equal(e.etat, 'valide', 'l’état est intact')
  assert.equal(e.maj, '2026-01-02', 'la date d’état aussi')
  assert.equal(M.statistiques(l).alertes, 2)
  l = M.basculerAlerte(l, 'e1')
  e = l.categories[0].sousCategories[0].elements[0]
  assert.equal('alerte' in e, false, 'retirée, la clé disparaît')
  assert.equal(M.statistiques(l).alertes, 1)
  assert.equal(M.basculerAlerte(l, 'inconnu'), l)
  M.reglerHorloge(null)
})

test('l’alerte voyage dans le lien et dans le fichier', async () => {
  const origine = C.listeDOrigine()
  let l = M.basculerAlerte(C.listeDOrigine(), 'mec-egalite')
  l = M.basculerAlerte(l, 'reg-genre')
  l = M.modifierElement(l, 'reg-genre', { etat: 'valide' })
  const code = await M.versLien(l, origine)
  assert.ok(code.length < 400, `${code.length} caractères`)
  const relue = await M.depuisLien(code, origine)
  assert.deepEqual(relue, l)
  assert.equal(M.statistiques(relue).alertes, 2)
  // Et retirer une alerte posée à l'origine se transmet aussi.
  const origineAlertee = M.basculerAlerte(C.listeDOrigine(), 'mec-egalite')
  const sans = M.basculerAlerte(origineAlertee, 'mec-egalite')
  const code2 = await M.versLien(sans, origineAlertee)
  const relue2 = await M.depuisLien(code2, origineAlertee)
  assert.equal(M.statistiques(relue2).alertes, 0)
  // Le fichier la garde ; une valeur étrangère est ignorée.
  assert.deepEqual(M.analyser(M.serialiser(l)), l)
  const brut = JSON.parse(M.serialiser(l))
  brut.categories[0].sousCategories[0].elements[0].alerte = 'oui'
  assert.equal('alerte' in M.analyser(JSON.stringify(brut)).categories[0].sousCategories[0].elements[0], false)
})
