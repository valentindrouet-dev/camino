import { useMemo, useRef, useState } from 'react'
import { DEFAULT_RULESET, scoreBoard } from '../../engine/index.ts'
import type { Board, Rotation } from '../../engine/index.ts'
import { BoardView } from '../components/BoardView.tsx'
import { TileGlyph } from '../components/TileGlyph.tsx'
import {
  COUT_DOUTEUX,
  douteuse,
  geometrie,
  homographie,
  lire,
  projeter,
} from '../../vision/lecture.ts'
import type { CaseLue, Point } from '../../vision/lecture.ts'
import { calerCoins, detecterPlateau, QUALITE_MINIMALE } from '../../vision/detection.ts'

interface Props {
  onBack: () => void
}

interface Photo {
  url: string
  largeur: number
  hauteur: number
  pixels: Uint8ClampedArray
}

/** Au-delà, on réduit la photo : lire 12 mégapixels ne sert à rien. */
const COTE_MAX = 1000

/** Le repère proposé quand la détection n'a rien trouvé : un carré centré. */
function coinsParDefaut(largeur: number, hauteur: number): Point[] {
  const cote = Math.min(largeur, hauteur) * 0.8
  const x = (largeur - cote) / 2
  const y = (hauteur - cote) / 2
  return [
    { x, y },
    { x: x + cote, y },
    { x: x + cote, y: y + cote },
    { x, y: y + cote },
  ]
}

/**
 * Lire un plateau photographié.
 *
 * L'écran fait trois choses : montrer la photo, poser les quatre coins de la
 * grille noire — tout seul si possible, à la main sinon — et rendre ce que la
 * lecture a compris.
 *
 * Le calcul est dans `src/vision/`, et il est faillible. Deux garde-fous, qui
 * ne sont pas décoratifs : le bouton « Caler les coins », qui transforme une
 * pose approximative en repère exact, et la grille de vérification du bas, qui
 * signale les cases dont les couleurs collent mal.
 */
export function ScanScreen({ onBack }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [coins, setCoins] = useState<Point[]>([])
  const [taille, setTaille] = useState(DEFAULT_RULESET.boardSize)
  const [cases, setCases] = useState<CaseLue[] | null>(null)
  const [residu, setResidu] = useState(0)
  const [selection, setSelection] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  /** Lit la photo avec ce repère et affiche le résultat. */
  const lireAvec = (p: Photo, repere: Point[], n = taille) => {
    const l = lire(p.pixels, p.largeur, p.hauteur, repere, n)
    if (!l) {
      setErreur('Les quatre coins sont alignés : impossible de redresser la photo.')
      return
    }
    setCases(l.cases)
    setResidu(l.residu)
    setSelection(null)
    setErreur(null)
  }

  const ouvrirFichier = (f: File | undefined) => {
    if (!f) return
    setOccupe(true)
    setMessage('Lecture de la photo…')
    const lecteur = new FileReader()
    lecteur.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * k)
        const h = Math.round(img.height * k)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          setErreur('Ce navigateur ne sait pas lire l’image.')
          setOccupe(false)
          setMessage(null)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const p: Photo = {
          url: String(lecteur.result),
          largeur: w,
          hauteur: h,
          pixels: ctx.getImageData(0, 0, w, h).data,
        }
        setPhoto(p)
        setCases(null)
        setSelection(null)
        setErreur(null)
        // La recherche du plateau prend le temps qu'elle prend : on laisse
        // l'écran se peindre avant d'occuper le fil.
        setMessage('Recherche du plateau…')
        window.setTimeout(() => {
          const det = detecterPlateau(p.pixels, p.largeur, p.hauteur, taille)
          if (det && det.qualite <= QUALITE_MINIMALE) {
            setCoins(det.coins)
            lireAvec(p, det.coins)
            setMessage(null)
          } else {
            setCoins(det ? det.coins : coinsParDefaut(w, h))
            setMessage(
              'Le plateau n’a pas été reconnu à coup sûr. Amenez les quatre pastilles sur les coins extérieurs de la grille noire, puis « Caler les coins ».',
            )
          }
          setOccupe(false)
        }, 30)
      }
      img.onerror = () => {
        setErreur('Image illisible.')
        setOccupe(false)
        setMessage(null)
      }
      img.src = String(lecteur.result)
    }
    lecteur.readAsDataURL(f)
  }

  /** Ajuste les coins posés à la main sur la grille, puis relit. */
  const caler = () => {
    if (!photo) return
    setOccupe(true)
    setMessage('Calage…')
    window.setTimeout(() => {
      const r = calerCoins(photo.pixels, photo.largeur, photo.hauteur, coins, taille)
      setCoins(r.coins)
      lireAvec(photo, r.coins)
      setMessage(null)
      setOccupe(false)
    }, 30)
  }

  // ------------------------------------------------------- poignées des coins
  const [tire, setTire] = useState<number | null>(null)
  const versPhoto = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg || !photo) return null
    const r = svg.getBoundingClientRect()
    return {
      x: ((clientX - r.left) / r.width) * photo.largeur,
      y: ((clientY - r.top) / r.height) * photo.hauteur,
    }
  }

  /**
   * Aperçu de la grille : on trace les BARRES du plateau, pas les frontières
   * des tuiles. Bien posé, le tracé se confond avec la grille noire de la
   * photo — c'est le retour visuel le plus parlant qui soit.
   */
  const grille = useMemo(() => {
    if (!photo || coins.length !== 4) return []
    const h = homographie(coins)
    if (!h) return []
    const { barres } = geometrie(taille)
    const lignes: string[] = []
    for (const b of barres) {
      for (const horizontal of [true, false]) {
        const pts: string[] = []
        for (let k = 0; k <= 12; k++) {
          const t = k / 12
          const p = horizontal ? projeter(h, t, b) : projeter(h, b, t)
          pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        }
        lignes.push(pts.join(' '))
      }
    }
    return lignes
  }, [photo, coins, taille])

  // ------------------------------------------------------------ reconstruction
  const plateau: Board | null = useMemo(() => {
    if (!cases) return null
    return {
      size: taille,
      cells: cases.map((c, i) => (c.vide ? null : { tileId: c.tileId, rot: c.rot, round: i })),
    }
  }, [cases, taille])

  const bilan = useMemo(() => (plateau ? scoreBoard(plateau, DEFAULT_RULESET) : null), [plateau])
  const aVerifier = cases ? cases.filter(douteuse).length : 0

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

  const recommencer = () => {
    setPhoto(null)
    setCases(null)
    setSelection(null)
    setErreur(null)
    setMessage(null)
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
          Photographiez un plateau terminé, bien à plat et bien éclairé. L’application cherche
          la grille noire toute seule, reconstruit les tuiles et compte les points. Si le
          cadrage est faux, amenez les quatre pastilles sur les coins extérieurs de la grille
          et appuyez sur <strong>Caler les coins</strong> : elle finit l’ajustement.
        </p>
        <p className="note" style={{ margin: 0 }}>
          <strong>C’est un essai, pas un outil fini.</strong> La lecture a été mise au point sur
          des images fabriquées d’après le plateau imprimé ; elle n’a encore jamais vu de vraies
          tuiles. Vérifiez toujours les cases signalées avant de croire le score.
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
          <button
            className="btn primary"
            onClick={() => fichierRef.current?.click()}
            disabled={occupe}
          >
            📷 Scanner
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => ouvrirFichier(e.target.files?.[0])}
          />
          <label className="field">
            <span>Plateau</span>
            <select
              value={taille}
              disabled={occupe}
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
            <>
              <button className="btn primary" onClick={caler} disabled={occupe}>
                ⌖ Caler les coins
              </button>
              <button className="btn" onClick={() => lireAvec(photo, coins)} disabled={occupe}>
                ↻ Relire
              </button>
              <button className="btn ghost" onClick={recommencer} disabled={occupe}>
                Recommencer
              </button>
            </>
          )}
        </div>

        {message && <div className="scan-message">{message}</div>}

        {!photo && !message && (
          <p className="note" style={{ margin: 0 }}>
            Sur téléphone, « Scanner » ouvre directement l’appareil photo. Sur ordinateur, il
            propose une photo déjà prise.
          </p>
        )}

        {photo && (
          <>
            <div className="scan-photo">
              <img src={photo.url} alt="Plateau photographié" />
              <svg
                ref={svgRef}
                viewBox={`0 0 ${photo.largeur} ${photo.hauteur}`}
                onPointerMove={(e) => {
                  if (tire === null) return
                  const p = versPhoto(e.clientX, e.clientY)
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
            <p className="note" style={{ margin: 0 }}>
              Le tracé blanc doit se confondre avec la grille noire du plateau. Posez les quatre
              pastilles sur ses coins extérieurs — à une demi-tuile près suffit, « Caler les
              coins » fait le reste.
            </p>
          </>
        )}
      </div>

      {/* --------------------------------------------------------- le résultat */}
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
                  {aVerifier === 0
                    ? 'Aucune case douteuse'
                    : `${aVerifier} case${aVerifier > 1 ? 's' : ''} à vérifier`}
                </span>
              </div>
              <p className="note" style={{ margin: 0 }}>
                L’écart moyen à la palette dit ce que vaut la photo : en dessous de 8 ΔE la
                lecture est sûre, au-dessus de 15 elle devient hasardeuse. Une case est signalée
                quand ses couleurs collent mal (coût supérieur à {COUT_DOUTEUX}) — sur les
                essais, 11 % des cases signalées contiennent 92 % des erreurs.
              </p>
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
                  plus lointaine. Le nombre est l’écart de couleur : plus il est bas, mieux elle
                  colle.
                </p>
                <div className="row wrap">
                  {cases[selection].candidats.map((cand) => (
                    <button
                      key={`${cand.tileId}-${cand.rot}`}
                      className={`scan-candidat ${
                        cand.tileId === cases[selection].tileId && cand.rot === cases[selection].rot
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
