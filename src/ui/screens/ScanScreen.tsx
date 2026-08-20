import { useCallback, useMemo, useRef, useState } from 'react'
import { DEFAULT_RULESET, scoreBoard, tileQuads } from '../../engine/index.ts'
import type { Board, Rotation } from '../../engine/index.ts'
import { BoardView } from '../components/BoardView.tsx'
import { TileGlyph } from '../components/TileGlyph.tsx'
import { COUT_DOUTEUX, douteuse, homographie, lire, projeter } from '../../vision/lecture.ts'
import type { CaseLue, Point } from '../../vision/lecture.ts'
import { plateauExemple } from '../../vision/exemple.ts'
import type { PoseVraie } from '../../vision/exemple.ts'

interface Props {
  onBack: () => void
}

interface Photo {
  url: string
  largeur: number
  hauteur: number
  pixels: Uint8ClampedArray
  /** Quand la photo vient de l'exemple : ce qui a réellement été posé. */
  verite?: PoseVraie[]
}

/** Au-delà, on réduit la photo : lire 12 mégapixels ne sert à rien. */
const COTE_MAX = 1400

/** Coins proposés à l'ouverture d'une photo : un cadre inscrit dans l'image. */
function coinsParDefaut(largeur: number, hauteur: number): Point[] {
  const mx = largeur * 0.12
  const my = hauteur * 0.12
  return [
    { x: mx, y: my },
    { x: largeur - mx, y: my },
    { x: largeur - mx, y: hauteur - my },
    { x: mx, y: hauteur - my },
  ]
}

/**
 * Lire un plateau photographié.
 *
 * L'écran ne fait que trois choses : montrer la photo, laisser poser les quatre
 * coins du damier, et rendre ce que la lecture a compris. Tout le calcul est
 * dans `src/vision/` — et il est faillible : la grille de vérification du bas
 * n'est pas un ornement, c'est la moitié de la fonctionnalité.
 */
export function ScanScreen({ onBack }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [coins, setCoins] = useState<Point[]>([])
  const [taille, setTaille] = useState(DEFAULT_RULESET.boardSize)
  const [cases, setCases] = useState<CaseLue[] | null>(null)
  const [residu, setResidu] = useState(0)
  const [selection, setSelection] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [attente, setAttente] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  /** Décode une image (photo ou exemple) et la prépare pour la lecture. */
  const ouvrir = useCallback((url: string, verite?: PoseVraie[], coinsVrais?: Point[]) => {
    setAttente(true)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * k)
      const h = Math.round(img.height * k)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) {
        setErreur('Ce navigateur ne sait pas lire l’image.')
        setAttente(false)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      setPhoto({ url, largeur: w, hauteur: h, pixels: ctx.getImageData(0, 0, w, h).data, verite })
      setCoins(coinsVrais ? coinsVrais.map((p) => ({ x: p.x * k, y: p.y * k })) : coinsParDefaut(w, h))
      setCases(null)
      setSelection(null)
      setErreur(null)
      setAttente(false)
    }
    img.onerror = () => {
      setErreur('Image illisible.')
      setAttente(false)
    }
    img.src = url
  }, [])

  const choisirFichier = (f: File | undefined) => {
    if (!f) return
    const lecteur = new FileReader()
    lecteur.onload = () => ouvrir(String(lecteur.result))
    lecteur.readAsDataURL(f)
  }

  const fabriquerExemple = () => {
    const ex = plateauExemple({ taille, graine: Math.floor(Math.random() * 1e9) })
    ouvrir(ex.url, ex.verite, ex.coins)
  }

  const relire = () => {
    if (!photo) return
    const l = lire(photo.pixels, photo.largeur, photo.hauteur, coins, taille)
    if (!l) {
      setErreur('Les quatre coins sont alignés : impossible de redresser la photo.')
      return
    }
    setCases(l.cases)
    setResidu(l.residu)
    setSelection(null)
    setErreur(null)
  }

  // ------------------------------------------------------- poignées des coins
  const [tire, setTire] = useState<number | null>(null)
  const versImage = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg || !photo) return null
    const r = svg.getBoundingClientRect()
    return {
      x: ((clientX - r.left) / r.width) * photo.largeur,
      y: ((clientY - r.top) / r.height) * photo.hauteur,
    }
  }

  /** Aperçu de la grille : le meilleur moyen de voir si les coins sont bons. */
  const grille = useMemo(() => {
    if (!photo || coins.length !== 4) return []
    const h = homographie(coins)
    if (!h) return []
    const lignes: string[] = []
    const trace = (fixe: number, horizontal: boolean) => {
      const pts: string[] = []
      for (let k = 0; k <= 12; k++) {
        const t = k / 12
        const p = horizontal ? projeter(h, t, fixe) : projeter(h, fixe, t)
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      }
      lignes.push(pts.join(' '))
    }
    for (let i = 0; i <= taille; i++) {
      trace(i / taille, true)
      trace(i / taille, false)
    }
    return lignes
  }, [photo, coins, taille])

  // ------------------------------------------------------------- reconstruction
  const plateau: Board | null = useMemo(() => {
    if (!cases) return null
    return {
      size: taille,
      cells: cases.map((c, i) =>
        c.vide ? null : { tileId: c.tileId, rot: c.rot, round: i },
      ),
    }
  }, [cases, taille])

  const bilan = useMemo(
    () => (plateau ? scoreBoard(plateau, DEFAULT_RULESET) : null),
    [plateau],
  )

  const aVerifier = cases ? cases.filter(douteuse).length : 0
  /** Contrôle honnête : uniquement possible sur l'exemple, où on sait la vérité. */
  const controle = useMemo(() => {
    if (!cases || !photo?.verite) return null
    const image = (t: { tileId: number; rot: Rotation }) => tileQuads(t.tileId, t.rot).join('')
    const justes = cases.filter(
      (c, i) => !c.vide && image(c) === image(photo.verite![i]),
    ).length
    return { justes, total: cases.length }
  }, [cases, photo])

  const corriger = (i: number, choix: { tileId: number; rot: Rotation } | null) => {
    if (!cases) return
    const out = cases.map((c) => ({ ...c }))
    if (choix) {
      out[i].vide = false
      out[i].tileId = choix.tileId
      out[i].rot = choix.rot
    } else {
      out[i].vide = true
    }
    // Corrigée à la main : la case ne se signale plus.
    out[i].cout = 0
    setCases(out)
  }

  const tourner = (i: number) => {
    if (!cases) return
    corriger(i, { tileId: cases[i].tileId, rot: ((cases[i].rot + 1) % 4) as Rotation })
  }

  // ------------------------------------------------------------------- rendu
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Lire un plateau</h2>
        <button className="btn small" onClick={onBack}>
          ← Retour
        </button>
      </div>

      <div className="panel stack" style={{ marginBottom: 14 }}>
        <p className="note" style={{ margin: 0 }}>
          Photographiez un plateau terminé, posez les quatre coins sur les angles extérieurs
          des tuiles, et l’application reconstruit la partie puis compte les points.
        </p>
        <p className="note" style={{ margin: 0 }}>
          <strong>C’est un essai, pas un outil fini.</strong> La lecture a été mise au point sur
          des photos fabriquées ; elle n’a encore jamais vu de tuiles imprimées. Vérifiez
          toujours les cases signalées avant de croire le score.
        </p>
      </div>

      {erreur && (
        <div className="warn" style={{ marginBottom: 14 }}>
          {erreur}
        </div>
      )}

      {/* ---------------------------------------------------------- la photo */}
      <div className="panel stack" style={{ marginBottom: 14 }}>
        <div className="row wrap">
          <button className="btn primary" onClick={() => fichierRef.current?.click()}>
            📷 Choisir une photo
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => choisirFichier(e.target.files?.[0])}
          />
          <button className="btn" onClick={fabriquerExemple} disabled={attente}>
            🎲 Plateau d’exemple
          </button>
          <label className="field">
            <span>Plateau</span>
            <select
              value={taille}
              onChange={(e) => {
                setTaille(Number(e.target.value))
                setCases(null)
              }}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
          </label>
          {photo && (
            <button className="btn primary" onClick={relire}>
              ↻ Lire le plateau
            </button>
          )}
        </div>

        {!photo && (
          <p className="note" style={{ margin: 0 }}>
            Pas de plateau imprimé sous la main ? « Plateau d’exemple » fabrique une fausse
            photo — perspective, lampe chaude, grain — et affiche le nombre de tuiles
            réellement retrouvées. C’est la seule façon de juger la lecture sur pièces.
          </p>
        )}

        {photo && (
          <div className="scan-photo">
            <img src={photo.url} alt="Plateau photographié" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${photo.largeur} ${photo.hauteur}`}
              onPointerMove={(e) => {
                if (tire === null) return
                const p = versImage(e.clientX, e.clientY)
                if (!p) return
                setCoins((c) => c.map((v, i) => (i === tire ? p : v)))
              }}
              onPointerUp={() => setTire(null)}
              onPointerCancel={() => setTire(null)}
            >
              {grille.map((pts, i) => (
                <polyline key={i} className="scan-grille" points={pts} />
              ))}
              <polygon
                className="scan-cadre"
                points={coins.map((p) => `${p.x},${p.y}`).join(' ')}
              />
              {coins.map((p, i) => (
                <circle
                  key={i}
                  className={`scan-poignee ${tire === i ? 'active' : ''}`}
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(photo.largeur, photo.hauteur) / 42}
                  onPointerDown={(e) => {
                    svgRef.current?.setPointerCapture(e.pointerId)
                    setTire(i)
                  }}
                />
              ))}
            </svg>
          </div>
        )}
        {photo && (
          <p className="note" style={{ margin: 0 }}>
            Faites glisser les quatre pastilles jusqu’aux angles du damier — la grille doit
            tomber pile sur les tuiles. Un décalage jusqu’à un quart de tuile reste sans
            conséquence ; au-delà, la lecture se dégrade.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- le résultat */}
      {cases && plateau && bilan && (
        <>
          <div className="scan-resultat">
            <div className="panel">
              <BoardView board={plateau} ruleset={DEFAULT_RULESET} showZones />
            </div>
            <div className="panel stack">
              <h3 style={{ margin: 0, fontSize: 18 }}>Décompte</h3>
              <div className="scan-total">{bilan.total} pts</div>
              <div className="row wrap">
                <span className="tag">
                  Couleurs <strong>{bilan.colorPoints}</strong>
                </span>
                <span className="tag">
                  Noir <strong>{bilan.blackPoints}</strong> ({bilan.blackZones} zone
                  {bilan.blackZones > 1 ? 's' : ''})
                </span>
              </div>
              <p className="note" style={{ margin: 0 }}>
                Barème de base, sans variante ni carte mission.
              </p>
              <hr className="sep" />
              <div className="row wrap">
                <span className="tag">
                  Qualité de la photo <strong>{residu.toFixed(1)} ΔE</strong>
                </span>
                <span className={`tag ${aVerifier ? 'warnish' : ''}`}>
                  {aVerifier === 0 ? 'Aucune case douteuse' : `${aVerifier} case${aVerifier > 1 ? 's' : ''} à vérifier`}
                </span>
              </div>
              <p className="note" style={{ margin: 0 }}>
                L’écart moyen à la palette dit ce que vaut la photo : en dessous de 8 ΔE la
                lecture est sûre, au-dessus de 15 elle devient hasardeuse. Une case est
                signalée quand ses couleurs collent mal (coût supérieur à {COUT_DOUTEUX}) —
                sur les essais, 11 % des cases signalées contiennent 92 % des erreurs.
              </p>
              {controle && (
                <div className={controle.justes === controle.total ? 'good-box' : 'warn'}>
                  Contrôle sur l’exemple : <strong>{controle.justes}</strong> tuiles retrouvées
                  sur {controle.total}.
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------- la vérification */}
          <div className="panel stack" style={{ marginTop: 14 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Vérification</h3>
            <p className="note" style={{ margin: 0 }}>
              Comparez avec votre plateau et corrigez ce qui ne va pas. Les cases entourées de
              rouge sont celles dont la lecture est la moins sûre.
            </p>
            <div
              className="scan-controle"
              style={{ gridTemplateColumns: `repeat(${taille}, minmax(0, 1fr))` }}
            >
              {cases.map((c, i) => (
                <button
                  key={i}
                  className={`scan-case ${douteuse(c) ? 'doute' : ''} ${selection === i ? 'choisie' : ''}`}
                  onClick={() => setSelection(selection === i ? null : i)}
                  title={`Coût ${c.cout.toFixed(0)} — marge ${c.marge.toFixed(0)}`}
                >
                  {c.vide ? (
                    <span className="scan-vide">vide</span>
                  ) : (
                    <TileGlyph tileId={c.tileId} rot={c.rot} size={56} />
                  )}
                </button>
              ))}
            </div>

            {selection !== null && cases[selection] && (
              <div className="panel stack scan-choix">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    Case ligne {Math.floor(selection / taille) + 1}, colonne{' '}
                    {(selection % taille) + 1}
                  </strong>
                  <div className="row">
                    <button className="btn small" onClick={() => tourner(selection)}>
                      ↻ Tourner
                    </button>
                    <button className="btn small" onClick={() => corriger(selection, null)}>
                      Vider
                    </button>
                    <button className="btn small ghost" onClick={() => setSelection(null)}>
                      Fermer
                    </button>
                  </div>
                </div>
                <p className="note" style={{ margin: 0 }}>
                  Les tuiles qui ressemblent le plus à ce qui a été lu, de la plus proche à la
                  plus lointaine. Le nombre est l’écart de couleur : plus il est bas, mieux
                  elle colle.
                </p>
                <div className="row wrap">
                  {cases[selection].candidats.map((cand) => (
                    <button
                      key={`${cand.tileId}-${cand.rot}`}
                      className={`scan-candidat ${
                        cand.tileId === cases[selection].tileId &&
                        cand.rot === cases[selection].rot
                          ? 'actif'
                          : ''
                      }`}
                      onClick={() => corriger(selection, { tileId: cand.tileId, rot: cand.rot })}
                    >
                      <TileGlyph tileId={cand.tileId} rot={cand.rot} size={48} />
                      <span>{cand.cout.toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
