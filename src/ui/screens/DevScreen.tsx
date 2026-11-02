/**
 * Développement : la liste de tout ce qu'il reste à valider avec les auteurs
 * pour finir le jeu — mécaniques, illustrations, matériel, règles.
 *
 * L'écran est une liste qu'on coche, qu'on annote et qu'on réorganise. Il
 * compte l'avancement par catégorie, s'imprime en PDF, s'exporte en fichier et
 * se partage par un lien qui porte la liste entière. Toute la logique est dans
 * `src/dev/` ; ici, seulement ce qui s'affiche et ce qu'on touche.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { listeDOrigine } from '../../dev/contenu.ts'
import {
  ajouterCategorie,
  ajouterElement,
  ajouterSousCategorie,
  analyser,
  basculerAlerte,
  basculerEtat,
  dateLisible,
  deplacerCategorie,
  deplacerElement,
  deplacerSousCategorie,
  depuisLien,
  ETATS,
  fusionnerNouveautes,
  modifierElement,
  NOM_ETAT,
  renommerCategorie,
  renommerSousCategorie,
  serialiser,
  statistiques,
  supprimerCategorie,
  supprimerElement,
  supprimerSousCategorie,
  toutesLesSousCategories,
  transfererElement,
  versLien,
} from '../../dev/modele.ts'
import type { Categorie, Compte, Element, Etat, Liste, SousCategorie } from '../../dev/modele.ts'
import { chargerListe, effacerListe, enregistrerListe } from '../../dev/stockage.ts'

interface Props {
  onBack: () => void
  /** Code trouvé dans l'adresse (`#dev=…`) : une liste à proposer. */
  lienEntrant?: string | null
  /** Appelé une fois le lien traité, pour nettoyer l'adresse. */
  onLienTraite?: () => void
}

type Filtre = 'tous' | Etat | 'alerte'

const NOM_FILTRE: Record<Filtre, string> = { tous: 'Tout', ...NOM_ETAT, alerte: '⚠ Alertes' }

/** Glyphe d'état : le même à l'écran et sur le papier. */
const GLYPHE: Record<Etat, string> = {
  'a-faire': '○',
  'en-cours': '◐',
  valide: '●',
  ecarte: '⊘',
}

export function DevScreen({ onBack, lienEntrant, onLienTraite }: Props) {
  const [charge] = useState(chargerListe)
  const [liste, setListe] = useState<Liste>(charge.liste)
  const [nouveaux, setNouveaux] = useState(charge.nouveaux)
  const [vue, setVue] = useState<'liste' | 'stats'>('liste')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [organiser, setOrganiser] = useState(false)
  const [replies, setReplies] = useState<Set<string>>(new Set())
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [propose, setPropose] = useState<Liste | null>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  // Chaque changement est mémorisé : recharger la page rend la liste intacte.
  const appliquer = useCallback((f: (l: Liste) => Liste) => {
    setListe((l) => {
      const maj = f(l)
      if (maj !== l) enregistrerListe(maj)
      return maj
    })
  }, [])

  const stats = useMemo(() => statistiques(liste), [liste])

  // Un message s'efface tout seul.
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(t)
  }, [message])

  // Un lien de partage arrive : on décode et on PROPOSE, on ne remplace pas.
  useEffect(() => {
    if (!lienEntrant) return
    let vivant = true
    void depuisLien(lienEntrant, listeDOrigine()).then((l) => {
      if (!vivant) return
      if (l) setPropose(l)
      else setMessage('Ce lien ne contient pas de liste lisible.')
      onLienTraite?.()
    })
    return () => {
      vivant = false
    }
  }, [lienEntrant, onLienTraite])

  // ------------------------------------------------------------ actions
  const partager = async () => {
    const code = await versLien(liste, listeDOrigine())
    const url = `${location.origin}${location.pathname}#dev=${code}`
    try {
      await navigator.clipboard.writeText(url)
      setMessage(`Lien copié — ${(url.length / 1024).toFixed(1)} Ko. Collez-le à qui doit voir la liste.`)
    } catch {
      // Pas de presse-papiers (navigation privée, permission refusée) : on
      // montre le lien, à copier à la main.
      window.prompt('Copiez ce lien :', url)
    }
  }

  const exporter = () => {
    const blob = new Blob([serialiser(liste)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `camino-developpement-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importer = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    f.text().then((texte) => {
      const l = analyser(texte)
      if (l) setPropose(fusionnerNouveautes(l, listeDOrigine()).liste)
      else setMessage('Ce fichier n’est pas une liste de développement.')
    })
  }

  const accepterProposee = () => {
    if (!propose) return
    appliquer(() => propose)
    setPropose(null)
    setNouveaux(0)
    setMessage('Liste remplacée.')
  }

  const retablir = () => {
    if (!window.confirm('Revenir à la liste d’origine ? Tout ce qui a été coché, écrit, ajouté ou déplacé sera perdu. Exportez d’abord si vous voulez le garder.')) return
    effacerListe()
    appliquer(() => listeDOrigine())
    setMessage('Liste d’origine rétablie.')
  }

  const basculerRepli = (id: string) =>
    setReplies((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const visible = (e: Element) =>
    filtre === 'tous' ? true : filtre === 'alerte' ? Boolean(e.alerte) : e.etat === filtre

  // -------------------------------------------------------------- rendu
  return (
    <div className="sheet dev">
      <div className="row dev-entete" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 24 }}>Développement</h2>
        <button className="btn small impression-cachee" onClick={onBack}>
          ← Retour
        </button>
      </div>
      <p className="note dev-sous-titre">
        Tout ce qu’il reste à valider avec les auteurs pour finir le jeu. Un point se coche
        (à faire → en cours → validé), s’annote, se déplace ; les catégories se réorganisent.
        Mis à jour le {dateLisible(liste.modifie)}.
      </p>

      {/* ------------------------------------------------- avancement global */}
      <div className="panel dev-global">
        <div className="dev-global-chiffre">
          <strong>{stats.pourcent} %</strong>
          <span>réglés</span>
        </div>
        <div className="dev-global-corps">
          <Barre compte={stats} grande />
          <div className="row wrap dev-legende">
            <span className="tag"><i className="pastille-etat valide" /> {stats.valides} validé{stats.valides > 1 ? 's' : ''}</span>
            <span className="tag"><i className="pastille-etat en-cours" /> {stats.enCours} en cours</span>
            <span className="tag"><i className="pastille-etat a-faire" /> {stats.aFaire} à faire</span>
            <span className="tag"><i className="pastille-etat ecarte" /> {stats.ecartes} écarté{stats.ecartes > 1 ? 's' : ''}</span>
            <span className={`tag alerte-tag ${stats.alertes ? 'on' : ''}`} title="Points à soulever avec les auteurs">
              ⚠ {stats.alertes} alerte{stats.alertes > 1 ? 's' : ''}
            </span>
            <span className="note">{stats.total} points en tout</span>
          </div>
        </div>
      </div>

      {nouveaux > 0 && (
        <div className="hint-box impression-cachee" style={{ marginTop: 10 }}>
          La mise à jour de l’application a ajouté {nouveaux} point{nouveaux > 1 ? 's' : ''} à votre
          liste — rien n’a été retiré ni décoché.{' '}
          <button className="btn small" onClick={() => setNouveaux(0)}>
            Compris
          </button>
        </div>
      )}

      {propose && (
        <div className="panel dev-proposition impression-cachee">
          <strong>Une liste vous est proposée.</strong>{' '}
          « {propose.titre} », modifiée le {dateLisible(propose.modifie)},{' '}
          {statistiques(propose).pourcent} % réglés, {statistiques(propose).total} points.
          Elle remplacera la vôtre.
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button className="btn small primary" onClick={accepterProposee}>
              Remplacer ma liste
            </button>
            <button className="btn small" onClick={exporter}>
              Exporter la mienne d’abord
            </button>
            <button className="btn small ghost" onClick={() => setPropose(null)}>
              Ignorer
            </button>
          </div>
        </div>
      )}

      {message && <div className="dev-message impression-cachee">{message}</div>}

      {/* ---------------------------------------------------------- outils */}
      <div className="dev-outils impression-cachee">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
          <button className={vue === 'liste' ? 'on' : ''} onClick={() => setVue('liste')}>
            Liste
          </button>
          <button className={vue === 'stats' ? 'on' : ''} onClick={() => setVue('stats')}>
            Statistiques
          </button>
        </div>
        <div className="row wrap dev-boutons">
          <button className="btn small" onClick={() => void partager()} title="Copie un lien qui contient toute la liste">
            🔗 Partager
          </button>
          <button className="btn small" onClick={() => window.print()} title="Imprimer, ou enregistrer en PDF">
            🖨 Imprimer / PDF
          </button>
          <button className="btn small" onClick={exporter}>
            ⬇ Exporter
          </button>
          <button className="btn small" onClick={() => fichierRef.current?.click()}>
            ⬆ Importer
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={importer}
          />
          <button
            className={`btn small ${organiser ? 'primary' : ''}`}
            onClick={() => setOrganiser((v) => !v)}
            title="Renommer, déplacer, supprimer des catégories et sous-catégories"
          >
            ✎ Organiser
          </button>
          <button className="btn small ghost" onClick={retablir} title="Revenir à la liste d’origine">
            Rétablir l’origine
          </button>
        </div>
      </div>

      {vue === 'stats' && (
        <div className="impression-cachee">
          <Stats liste={liste} />
        </div>
      )}

      <div className={vue === 'stats' ? 'ecran-cachee' : ''}>
          <div className="row wrap impression-cachee" style={{ margin: '12px 0 6px', alignItems: 'center' }}>
            <span className="note" style={{ margin: 0 }}>
              Afficher
            </span>
            <div className="seg">
              {(['tous', 'a-faire', 'en-cours', 'valide', 'ecarte', 'alerte'] as Filtre[]).map((f) => (
                <button key={f} className={filtre === f ? 'on' : ''} onClick={() => setFiltre(f)}>
                  {NOM_FILTRE[f]}
                </button>
              ))}
            </div>
            <span className="spacer" />
            <button
              className="btn small ghost"
              onClick={() =>
                setReplies(
                  replies.size ? new Set() : new Set(liste.categories.map((c) => c.id)),
                )
              }
            >
              {replies.size ? 'Tout déplier' : 'Tout replier'}
            </button>
          </div>

          <div className="stack dev-categories">
            {liste.categories.map((cat, iCat) => (
              <CategorieVue
                key={cat.id}
                cat={cat}
                stats={stats.categories.find((s) => s.id === cat.id)!}
                repliee={replies.has(cat.id)}
                organiser={organiser}
                premiere={iCat === 0}
                derniere={iCat === liste.categories.length - 1}
                ouvert={ouvert}
                setOuvert={setOuvert}
                visible={visible}
                filtreActif={filtre !== 'tous'}
                liste={liste}
                appliquer={appliquer}
                onRepli={() => basculerRepli(cat.id)}
              />
            ))}
          </div>

          {organiser && (
            <AjoutCategorie onAjouter={(titre, intro) => appliquer((l) => ajouterCategorie(l, titre, intro))} />
          )}
      </div>

      {/* La version imprimée porte toujours les statistiques, après la liste. */}
      <div className="impression-seule">
        <Stats liste={liste} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barre d'avancement : validés en vert, écartés en gris, le reste vide.
// ---------------------------------------------------------------------------

function Barre({ compte, grande = false }: { compte: Compte; grande?: boolean }) {
  const v = compte.total ? (100 * compte.valides) / compte.total : 0
  const e = compte.total ? (100 * compte.ecartes) / compte.total : 0
  const c = compte.total ? (100 * compte.enCours) / compte.total : 0
  return (
    <div
      className={`dev-barre ${grande ? 'grande' : ''}`}
      role="progressbar"
      aria-valuenow={compte.pourcent}
      aria-valuemin={0}
      aria-valuemax={100}
      title={`${compte.valides} validés, ${compte.ecartes} écartés, ${compte.enCours} en cours, ${compte.aFaire} à faire`}
    >
      <span className="valide" style={{ width: `${v}%` }} />
      <span className="ecarte" style={{ width: `${e}%` }} />
      <span className="en-cours" style={{ width: `${c}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Une catégorie
// ---------------------------------------------------------------------------

interface CategorieProps {
  cat: Categorie
  stats: Compte & { sousCategories: (Compte & { id: string })[] }
  repliee: boolean
  organiser: boolean
  premiere: boolean
  derniere: boolean
  ouvert: string | null
  setOuvert: (id: string | null) => void
  visible: (e: Element) => boolean
  filtreActif: boolean
  liste: Liste
  appliquer: (f: (l: Liste) => Liste) => void
  onRepli: () => void
}

function CategorieVue(p: CategorieProps) {
  const { cat, stats, repliee, organiser, appliquer } = p
  const [edition, setEdition] = useState(false)
  const [titre, setTitre] = useState(cat.titre)
  const [intro, setIntro] = useState(cat.intro ?? '')

  const valider = () => {
    appliquer((l) => renommerCategorie(l, cat.id, titre, intro))
    setEdition(false)
  }
  const supprimer = () => {
    const n = stats.total
    if (
      n > 0 &&
      !window.confirm(`Supprimer la catégorie « ${cat.titre} » et ses ${n} points ?`)
    )
      return
    appliquer((l) => supprimerCategorie(l, cat.id))
  }

  return (
    <section className={`panel dev-cat ${repliee ? 'repliee' : ''}`} id={`cat-${cat.id}`}>
      <header className="dev-cat-entete">
        <button
          className="dev-repli impression-cachee"
          onClick={p.onRepli}
          aria-expanded={!repliee}
          aria-label={repliee ? 'Déplier' : 'Replier'}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
            <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {edition ? (
          <div className="stack dev-edition" style={{ flex: 1, gap: 6 }}>
            <input className="dev-champ" value={titre} onChange={(e) => setTitre(e.target.value)} aria-label="Titre de la catégorie" />
            <textarea className="dev-champ" value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="Une phrase d’introduction (facultatif)" aria-label="Introduction" />
            <div className="row wrap">
              <button className="btn small primary" onClick={valider}>Enregistrer</button>
              <button className="btn small ghost" onClick={() => setEdition(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <div className="dev-cat-titre">
            <h3>
              {cat.titre}
              {stats.alertes > 0 && (
                <span className="dev-alerte-compte" title="Alertes dans cette catégorie">
                  ⚠ {stats.alertes}
                </span>
              )}
            </h3>
            {cat.intro && <p className="note">{cat.intro}</p>}
          </div>
        )}
        <div className="dev-cat-avancement">
          <strong>{stats.pourcent} %</strong>
          <Barre compte={stats} />
          <span className="note">
            {stats.valides + stats.ecartes}/{stats.total}
          </span>
        </div>
      </header>

      {organiser && !edition && (
        <div className="row wrap dev-organiser impression-cachee">
          <button className="btn small" onClick={() => setEdition(true)}>Renommer</button>
          <button className="btn small" onClick={() => appliquer((l) => deplacerCategorie(l, cat.id, -1))} disabled={p.premiere} aria-label="Monter la catégorie">↑</button>
          <button className="btn small" onClick={() => appliquer((l) => deplacerCategorie(l, cat.id, 1))} disabled={p.derniere} aria-label="Descendre la catégorie">↓</button>
          <button className="btn small ghost" onClick={supprimer}>Supprimer</button>
        </div>
      )}

      <div className="dev-cat-corps">
        {cat.sousCategories.map((sc, i) => (
          <SousCategorieVue
            key={sc.id}
            sc={sc}
            stats={stats.sousCategories.find((s) => s.id === sc.id)!}
            organiser={organiser}
            premiere={i === 0}
            derniere={i === cat.sousCategories.length - 1}
            ouvert={p.ouvert}
            setOuvert={p.setOuvert}
            visible={p.visible}
            filtreActif={p.filtreActif}
            liste={p.liste}
            appliquer={appliquer}
          />
        ))}
        {organiser && (
          <AjoutLigne
            libelle="+ Ajouter une sous-catégorie"
            placeholder="Titre de la sous-catégorie"
            onAjouter={(t) => appliquer((l) => ajouterSousCategorie(l, cat.id, t))}
          />
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Une sous-catégorie
// ---------------------------------------------------------------------------

interface SousCategorieProps {
  sc: SousCategorie
  stats: Compte
  organiser: boolean
  premiere: boolean
  derniere: boolean
  ouvert: string | null
  setOuvert: (id: string | null) => void
  visible: (e: Element) => boolean
  filtreActif: boolean
  liste: Liste
  appliquer: (f: (l: Liste) => Liste) => void
}

function SousCategorieVue(p: SousCategorieProps) {
  const { sc, stats, organiser, appliquer } = p
  const [edition, setEdition] = useState(false)
  const [titre, setTitre] = useState(sc.titre)
  const visibles = sc.elements.filter(p.visible)

  const supprimer = () => {
    if (
      sc.elements.length > 0 &&
      !window.confirm(`Supprimer « ${sc.titre} » et ses ${sc.elements.length} points ?`)
    )
      return
    appliquer((l) => supprimerSousCategorie(l, sc.id))
  }

  // Sous un filtre, une sous-catégorie vide n'a rien à montrer : on l'escamote
  // à l'écran — le papier, lui, montre toujours tout.
  const vide = p.filtreActif && visibles.length === 0

  return (
    <div className={`dev-sc ${vide ? 'vide-filtre' : ''}`}>
      <div className="dev-sc-entete">
        {edition ? (
          <div className="row wrap" style={{ flex: 1 }}>
            <input className="dev-champ" value={titre} onChange={(e) => setTitre(e.target.value)} aria-label="Titre de la sous-catégorie" style={{ flex: 1 }} />
            <button className="btn small primary" onClick={() => { appliquer((l) => renommerSousCategorie(l, sc.id, titre)); setEdition(false) }}>Enregistrer</button>
            <button className="btn small ghost" onClick={() => setEdition(false)}>Annuler</button>
          </div>
        ) : (
          <h4>
            {sc.titre}
            <span className="note dev-sc-compte">
              {stats.valides + stats.ecartes}/{stats.total}
              {stats.enCours ? ` · ${stats.enCours} en cours` : ''}
              {stats.alertes ? <span className="dev-alerte-compte"> ⚠ {stats.alertes}</span> : null}
            </span>
          </h4>
        )}
        {organiser && !edition && (
          <div className="row dev-organiser impression-cachee">
            <button className="btn small" onClick={() => setEdition(true)}>Renommer</button>
            <button className="btn small" onClick={() => appliquer((l) => deplacerSousCategorie(l, sc.id, -1))} disabled={p.premiere} aria-label="Monter">↑</button>
            <button className="btn small" onClick={() => appliquer((l) => deplacerSousCategorie(l, sc.id, 1))} disabled={p.derniere} aria-label="Descendre">↓</button>
            <button className="btn small ghost" onClick={supprimer}>Supprimer</button>
          </div>
        )}
      </div>

      <ol className="dev-elements">
        {sc.elements.map((e, i) => (
          <ElementVue
            key={e.id}
            e={e}
            masque={!p.visible(e)}
            ouvert={p.ouvert === e.id}
            setOuvert={p.setOuvert}
            premier={i === 0}
            dernier={i === sc.elements.length - 1}
            liste={p.liste}
            appliquer={appliquer}
          />
        ))}
      </ol>

      <AjoutLigne
        libelle="+ Ajouter un point"
        placeholder="Ce qu’il y a à valider"
        onAjouter={(t) => appliquer((l) => ajouterElement(l, sc.id, t))}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Un point
// ---------------------------------------------------------------------------

interface ElementProps {
  e: Element
  masque: boolean
  ouvert: boolean
  setOuvert: (id: string | null) => void
  premier: boolean
  dernier: boolean
  liste: Liste
  appliquer: (f: (l: Liste) => Liste) => void
}

function ElementVue({ e, masque, ouvert, setOuvert, premier, dernier, liste, appliquer }: ElementProps) {
  const destinations = useMemo(() => toutesLesSousCategories(liste), [liste])
  const patch = (champ: Partial<Omit<Element, 'id'>>) =>
    appliquer((l) => modifierElement(l, e.id, champ))

  return (
    <li className={`dev-el ${e.etat} ${e.alerte ? 'alerte' : ''} ${masque ? 'masque' : ''} ${ouvert ? 'ouvert' : ''}`}>
      <div className="dev-el-ligne">
        <button
          className={`dev-etat ${e.etat}`}
          onClick={() => appliquer((l) => basculerEtat(l, e.id))}
          title={`${NOM_ETAT[e.etat]} — cliquer pour passer à l’état suivant`}
          aria-label={`État : ${NOM_ETAT[e.etat]}`}
        >
          <span aria-hidden>{GLYPHE[e.etat]}</span>
        </button>
        <button className="dev-el-titre" onClick={() => setOuvert(ouvert ? null : e.id)} aria-expanded={ouvert}>
          <span className="titre">{e.titre}</span>
          {e.detail && <span className="detail">{e.detail}</span>}
          {e.note && (
            <span className="note-decision">
              <b>Décision :</b> {e.note}
            </span>
          )}
          {(e.qui || e.maj) && (
            <span className="meta">
              {e.qui && <span>{e.qui}</span>}
              {e.maj && <span>{NOM_ETAT[e.etat].toLowerCase()} le {dateLisible(e.maj)}</span>}
            </span>
          )}
        </button>
        {/* L'alerte : à droite, hors du cycle d'état. Un point validé peut
            rester à soulever, un point à faire ne l'est pas forcément. */}
        <button
          className={`dev-alerte ${e.alerte ? 'on' : ''}`}
          onClick={() => appliquer((l) => basculerAlerte(l, e.id))}
          aria-pressed={Boolean(e.alerte)}
          aria-label={e.alerte ? 'Retirer l’alerte' : 'Signaler aux auteurs'}
          title={
            e.alerte
              ? 'Alerte : à soulever avec les auteurs — cliquer pour la retirer'
              : 'Signaler : un point à soulever avec les auteurs'
          }
        >
          ⚠
        </button>
      </div>

      {ouvert && (
        <div className="dev-el-panneau impression-cachee">
          <label className="field">
            <span>Titre</span>
            <input type="text" value={e.titre} onChange={(ev) => patch({ titre: ev.target.value })} />
          </label>
          <label className="field">
            <span>Détail — ce qu’il y a à décider</span>
            <textarea className="dev-champ" rows={3} value={e.detail ?? ''} onChange={(ev) => patch({ detail: ev.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Décision, remarques</span>
            <textarea className="dev-champ" rows={3} value={e.note ?? ''} onChange={(ev) => patch({ note: ev.target.value || undefined })} placeholder="Ce qui a été décidé, par qui, pourquoi." />
          </label>
          <div className="row wrap">
            <label className="field" style={{ width: 160 }}>
              <span>État</span>
              <select value={e.etat} onChange={(ev) => patch({ etat: ev.target.value as Etat })}>
                {ETATS.map((x) => (
                  <option key={x} value={x}>
                    {GLYPHE[x]} {NOM_ETAT[x]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ width: 180 }}>
              <span>Qui s’en charge</span>
              <input type="text" value={e.qui ?? ''} onChange={(ev) => patch({ qui: ev.target.value || undefined })} placeholder="Prénom" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>Déplacer vers</span>
              <select
                value=""
                onChange={(ev) => {
                  if (ev.target.value) appliquer((l) => transfererElement(l, e.id, ev.target.value))
                }}
              >
                <option value="">— une autre sous-catégorie —</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.categorie} › {d.titre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row wrap">
            <button className="btn small" onClick={() => appliquer((l) => deplacerElement(l, e.id, -1))} disabled={premier} aria-label="Monter le point">↑ Monter</button>
            <button className="btn small" onClick={() => appliquer((l) => deplacerElement(l, e.id, 1))} disabled={dernier} aria-label="Descendre le point">↓ Descendre</button>
            <span className="spacer" />
            <button
              className="btn small ghost"
              onClick={() => {
                if (window.confirm(`Supprimer « ${e.titre} » ?`)) {
                  appliquer((l) => supprimerElement(l, e.id))
                  setOuvert(null)
                }
              }}
            >
              Supprimer
            </button>
            <button className="btn small" onClick={() => setOuvert(null)}>Fermer</button>
          </div>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Ajouter une ligne : un champ qui s'ouvre au clic, pour ne pas encombrer.
// ---------------------------------------------------------------------------

function AjoutLigne({ libelle, placeholder, onAjouter }: { libelle: string; placeholder: string; onAjouter: (titre: string) => void }) {
  const [actif, setActif] = useState(false)
  const [texte, setTexte] = useState('')
  const valider = () => {
    if (texte.trim()) onAjouter(texte)
    setTexte('')
    setActif(false)
  }
  if (!actif) {
    return (
      <button className="dev-ajout impression-cachee" onClick={() => setActif(true)}>
        {libelle}
      </button>
    )
  }
  return (
    <div className="row wrap dev-ajout-champ impression-cachee">
      <input
        className="dev-champ"
        autoFocus
        value={texte}
        placeholder={placeholder}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') valider()
          if (e.key === 'Escape') { setTexte(''); setActif(false) }
        }}
        style={{ flex: 1, minWidth: 200 }}
      />
      <button className="btn small primary" onClick={valider}>Ajouter</button>
      <button className="btn small ghost" onClick={() => { setTexte(''); setActif(false) }}>Annuler</button>
    </div>
  )
}

function AjoutCategorie({ onAjouter }: { onAjouter: (titre: string, intro: string) => void }) {
  const [titre, setTitre] = useState('')
  const [intro, setIntro] = useState('')
  return (
    <div className="panel stack impression-cachee" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Nouvelle catégorie</h3>
      <div className="row wrap">
        <input className="dev-champ" value={titre} placeholder="Titre" onChange={(e) => setTitre(e.target.value)} style={{ flex: 1, minWidth: 180 }} aria-label="Titre de la nouvelle catégorie" />
        <input className="dev-champ" value={intro} placeholder="Introduction (facultatif)" onChange={(e) => setIntro(e.target.value)} style={{ flex: 2, minWidth: 220 }} aria-label="Introduction" />
        <button
          className="btn small primary"
          disabled={!titre.trim()}
          onClick={() => { onAjouter(titre, intro); setTitre(''); setIntro('') }}
        >
          Ajouter la catégorie
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

function Stats({ liste }: { liste: Liste }) {
  const s = useMemo(() => statistiques(liste), [liste])
  const ouverts = s.aFaire + s.enCours
  return (
    <div className="stack dev-stats" style={{ marginTop: 12 }}>
      <div className="kpi-grid">
        <div className="kpi"><span className="k">Avancement</span><span className="v">{s.pourcent} %</span><span className="s">{s.valides + s.ecartes} réglés sur {s.total}</span></div>
        <div className="kpi"><span className="k">Validés</span><span className="v">{s.valides}</span><span className="s">{s.total ? Math.round((100 * s.valides) / s.total) : 0} % du total</span></div>
        <div className="kpi"><span className="k">En cours</span><span className="v">{s.enCours}</span><span className="s">points entamés</span></div>
        <div className="kpi"><span className="k">À faire</span><span className="v">{s.aFaire}</span><span className="s">{ouverts} point{ouverts > 1 ? 's' : ''} encore ouvert{ouverts > 1 ? 's' : ''}</span></div>
        <div className="kpi"><span className="k">Écartés</span><span className="v">{s.ecartes}</span><span className="s">décidés « non »</span></div>
        <div className="kpi alerte"><span className="k">⚠ Alertes</span><span className="v">{s.alertes}</span><span className="s">à soulever avec les auteurs</span></div>
      </div>

      <div className="panel">
        <h3>Par catégorie</h3>
        <table className="dev-table">
          <thead>
            <tr><th>Catégorie</th><th>Avancement</th><th>Validés</th><th>En cours</th><th>À faire</th><th>Écartés</th><th>Total</th><th>⚠ Alertes</th></tr>
          </thead>
          <tbody>
            {s.categories.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.titre}</strong></td>
                <td className="dev-table-barre"><Barre compte={c} /> <span>{c.pourcent} %</span></td>
                <td>{c.valides}</td><td>{c.enCours}</td><td>{c.aFaire}</td><td>{c.ecartes}</td><td>{c.total}</td>
                <td className={c.alertes ? 'dev-td-alerte' : ''}>{c.alertes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Par sous-catégorie</h3>
        <table className="dev-table">
          <thead>
            <tr><th>Catégorie</th><th>Sous-catégorie</th><th>Avancement</th><th>Réglés</th><th>Ouverts</th><th>⚠</th></tr>
          </thead>
          <tbody>
            {s.categories.flatMap((c) =>
              c.sousCategories.map((sc) => (
                <tr key={sc.id}>
                  <td className="note">{c.titre}</td>
                  <td>{sc.titre}</td>
                  <td className="dev-table-barre"><Barre compte={sc} /> <span>{sc.pourcent} %</span></td>
                  <td>{sc.valides + sc.ecartes}/{sc.total}</td>
                  <td>{sc.aFaire + sc.enCours}</td>
                  <td className={sc.alertes ? 'dev-td-alerte' : ''}>{sc.alertes || ''}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="dev-stats-deux">
        <div className="panel">
          <h3>Par responsable</h3>
          {s.parResponsable.length === 0 ? (
            <p className="note">Personne n’est encore nommé sur un point.</p>
          ) : (
            <table className="dev-table">
              <thead><tr><th>Qui</th><th>Ouverts</th><th>Total</th></tr></thead>
              <tbody>
                {s.parResponsable.map((r) => (
                  <tr key={r.qui}><td>{r.qui}</td><td>{r.ouverts}</td><td>{r.total}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="note" style={{ marginTop: 8 }}>
            Le nom se renseigne en ouvrant un point (« Qui s’en charge »).
          </p>
        </div>
        <div className="panel">
          <h3>Derniers points réglés</h3>
          {s.recents.length === 0 ? (
            <p className="note">Aucun point validé ou écarté pour l’instant.</p>
          ) : (
            <ul className="dev-recents">
              {s.recents.map((r) => (
                <li key={r.element.id}>
                  <span className={`pastille-etat ${r.element.etat}`} /> {r.element.titre}
                  <span className="note"> — {r.categorie} › {r.sousCategorie}, {dateLisible(r.element.maj ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
