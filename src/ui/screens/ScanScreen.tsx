import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_RULESET, scoreBoard } from '../../engine/index.ts'
import type { Board, Rotation } from '../../engine/index.ts'
import { BoardView } from '../components/BoardView.tsx'
import { TileGlyph } from '../components/TileGlyph.tsx'
import { COUT_DOUTEUX, douteuse, homographie, lire, projeter } from '../../vision/lecture.ts'
import type { CaseLue, Lecture, Point } from '../../vision/lecture.ts'

interface Props {
  onBack: () => void
}

/** Ce sur quoi on travaille : une image figée, avec ses pixels. */
interface Image {
  url: string
  largeur: number
  hauteur: number
  pixels: Uint8ClampedArray
}

type Mode = 'repos' | 'direct' | 'fige'

/** Au-delà, on réduit l'image : lire 12 mégapixels ne sert à rien. */
const COTE_MAX = 1000
/** Période de lecture en direct. Une lecture coûte quelques millisecondes. */
const PERIODE = 160
/** Lectures identiques et sûres d'affilée avant de figer toute seule. */
const STABLES = 4

/** Le repère proposé : un carré centré, que l'on ajuste ensuite. */
function coinsParDefaut(largeur: number, hauteur: number): Point[] {
  const cote = Math.min(largeur, hauteur) * 0.82
  const x = (largeur - cote) / 2
  const y = (hauteur - cote) / 2
  return [
    { x, y },
    { x: x + cote, y },
    { x: x + cote, y: y + cote },
    { x, y: y + cote },
  ]
}

/** Signature d'une lecture : sert à repérer qu'elle ne bouge plus. */
function signature(cases: CaseLue[]): string {
  return cases.map((c) => (c.vide ? 'v' : `${c.tileId}.${c.rot}`)).join(',')
}

/**
 * Lire un plateau photographié.
 *
 * Deux temps : la caméra lit en continu — on voit le plateau se reconstruire et
 * le score bouger pendant qu'on cadre — puis la lecture se fige, d'elle-même
 * quand elle ne bouge plus, ou à la demande. Sur l'image figée on ajuste les
 * quatre coins et on corrige les cases une à une.
 *
 * Tout le calcul est dans `src/vision/` — et il est faillible : la grille de
 * vérification du bas n'est pas un ornement, c'est la moitié du travail.
 */
export function ScanScreen({ onBack }: Props) {
  const [mode, setMode] = useState<Mode>('repos')
  const [image, setImage] = useState<Image | null>(null)
  const [coins, setCoins] = useState<Point[]>([])
  const [taille, setTaille] = useState(DEFAULT_RULESET.boardSize)
  const [cases, setCases] = useState<CaseLue[] | null>(null)
  const [residu, setResidu] = useState(0)
  /** Ce que la caméra lit à l'instant, tant que rien n'est figé. */
  const [apercu, setApercu] = useState<Lecture | null>(null)
  const [selection, setSelection] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)
  const toileRef = useRef<HTMLCanvasElement | null>(null)
  const fluxRef = useRef<MediaStream | null>(null)
  const minuterieRef = useRef<number | null>(null)
  const stableRef = useRef({ sig: '', n: 0 })
  // La boucle de lecture est créée une fois : elle lit les réglages courants
  // dans des références, sinon chaque déplacement de coin la relancerait.
  const coinsRef = useRef(coins)
  coinsRef.current = coins
  const tailleRef = useRef(taille)
  tailleRef.current = taille

  const [dimensions, setDimensions] = useState({ largeur: 0, hauteur: 0 })

  // ------------------------------------------------------------------ caméra
  const arreterCamera = useCallback(() => {
    if (minuterieRef.current !== null) {
      clearInterval(minuterieRef.current)
      minuterieRef.current = null
    }
    fluxRef.current?.getTracks().forEach((t) => t.stop())
    fluxRef.current = null
  }, [])

  useEffect(() => arreterCamera, [arreterCamera])

  /** La toile hors écran où chaque image de la vidéo est déposée pour lecture. */
  const toile = () => {
    if (!toileRef.current) toileRef.current = document.createElement('canvas')
    return toileRef.current
  }

  /** Fige ce que la caméra montre à cet instant et passe à l'examen. */
  const figer = useCallback(
    (lecture: Lecture | null) => {
      const c = toileRef.current
      if (!c) return
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data
      arreterCamera()
      setImage({ url: c.toDataURL('image/jpeg', 0.92), largeur: c.width, hauteur: c.height, pixels })
      const l = lecture ?? lire(pixels, c.width, c.height, coinsRef.current, tailleRef.current)
      if (l) {
        setCases(l.cases)
        setResidu(l.residu)
      }
      setApercu(null)
      setSelection(null)
      setMode('fige')
    },
    [arreterCamera],
  )

  /**
   * Accorde la toile de lecture au format de la caméra, et repose le repère.
   * Appelée dès que la vidéo annonce ses dimensions — la boucle de lecture ne
   * peut pas s'en charger, elle a besoin du résultat pour démarrer.
   */
  const accorderToile = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return null
    const c = toile()
    // Déjà accordée à ce format : ne pas reposer le repère sous les doigts.
    if (c.dataset.pour === `${v.videoWidth}x${v.videoHeight}`) return c
    const k = Math.min(1, COTE_MAX / Math.max(v.videoWidth, v.videoHeight))
    c.width = Math.round(v.videoWidth * k)
    c.height = Math.round(v.videoHeight * k)
    c.dataset.pour = `${v.videoWidth}x${v.videoHeight}`
    const depart = coinsParDefaut(c.width, c.height)
    setDimensions({ largeur: c.width, hauteur: c.height })
    setCoins(depart)
    coinsRef.current = depart
    return c
  }, [])

  /** Une lecture, sur l'image que la caméra montre en ce moment. */
  const lireUneImage = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = accorderToile()
    if (!c) return
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const l = lire(
      ctx.getImageData(0, 0, c.width, c.height).data,
      c.width,
      c.height,
      coinsRef.current,
      tailleRef.current,
    )
    if (!l) return
    setApercu(l)
    // Quand la lecture ne bouge plus et que rien n'est douteux, on fige : le
    // joueur n'a pas à décider du bon moment, l'image le sait mieux que lui.
    const sig = signature(l.cases)
    const stable = stableRef.current
    stableRef.current = { sig, n: sig === stable.sig ? stable.n + 1 : 0 }
    if (stableRef.current.n >= STABLES && !l.cases.some(douteuse)) figer(l)
  }, [accorderToile, figer])

  const demarrerCamera = useCallback(async () => {
    setErreur(null)
    setCases(null)
    setApercu(null)
    setSelection(null)
    stableRef.current = { sig: '', n: 0 }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      fluxRef.current = flux
      setMode('direct')
      // La vidéo n'existe qu'une fois le mode passé à « direct ».
      window.setTimeout(() => {
        const v = videoRef.current
        if (!v) return
        v.srcObject = flux
        void v.play().catch(() => undefined)
        minuterieRef.current = window.setInterval(lireUneImage, PERIODE)
      }, 0)
    } catch {
      // Pas de caméra, ou refusée : on retombe sur le choix d'une photo, qui
      // sur téléphone ouvre de toute façon l'appareil photo.
      fichierRef.current?.click()
    }
  }, [lireUneImage])

  // ------------------------------------------------------------- photo figée
  const ouvrirFichier = (f: File | undefined) => {
    if (!f) return
    const lecteur = new FileReader()
    lecteur.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height))
        const w = Math.round(img.width * k)
        const h = Math.round(img.height * k)
        const c = toile()
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          setErreur('Ce navigateur ne sait pas lire l’image.')
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const pixels = ctx.getImageData(0, 0, w, h).data
        const depart = coinsParDefaut(w, h)
        setImage({ url: String(lecteur.result), largeur: w, hauteur: h, pixels })
        setDimensions({ largeur: w, hauteur: h })
        setCoins(depart)
        coinsRef.current = depart
        setCases(null)
        setSelection(null)
        setErreur(null)
        setMode('fige')
      }
      img.onerror = () => setErreur('Image illisible.')
      img.src = String(lecteur.result)
    }
    lecteur.readAsDataURL(f)
  }

  const relire = () => {
    if (!image) return
    const l = lire(image.pixels, image.largeur, image.hauteur, coins, taille)
    if (!l) {
      setErreur('Les quatre coins sont alignés : impossible de redresser l’image.')
      return
    }
    setCases(l.cases)
    setResidu(l.residu)
    setSelection(null)
    setErreur(null)
  }

  // ------------------------------------------------------- poignées des coins
  const [tire, setTire] = useState<number | null>(null)
  const versSource = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current
    if (!svg || !dimensions.largeur) return null
    const r = svg.getBoundingClientRect()
    return {
      x: ((clientX - r.left) / r.width) * dimensions.largeur,
      y: ((clientY - r.top) / r.height) * dimensions.hauteur,
    }
  }

  /** Aperçu de la grille : le meilleur moyen de voir si les coins sont bons. */
  const grille = useMemo(() => {
    if (!dimensions.largeur || coins.length !== 4) return []
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
  }, [dimensions, coins, taille])

  // ------------------------------------------------------------ reconstruction
  const lues = cases ?? apercu?.cases ?? null

  const plateau: Board | null = useMemo(() => {
    if (!lues) return null
    return {
      size: taille,
      cells: lues.map((c, i) => (c.vide ? null : { tileId: c.tileId, rot: c.rot, round: i })),
    }
  }, [lues, taille])

  const bilan = useMemo(() => (plateau ? scoreBoard(plateau, DEFAULT_RULESET) : null), [plateau])

  const aVerifier = lues ? lues.filter(douteuse).length : 0
  const qualite = cases ? residu : (apercu?.residu ?? 0)

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
    arreterCamera()
    setMode('repos')
    setImage(null)
    setCases(null)
    setApercu(null)
    setSelection(null)
    setErreur(null)
  }

  // ------------------------------------------------------------------- rendu
  const cadre = mode === 'direct' || (mode === 'fige' && !!image)

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
          Visez un plateau terminé : la caméra le lit en continu, le plateau se reconstruit
          sous vos yeux et la lecture se fige d’elle-même dès qu’elle ne bouge plus. Cadrez le
          damier dans le carré, à plat et bien éclairé.
        </p>
        <p className="note" style={{ margin: 0 }}>
          <strong>C’est un essai, pas un outil fini.</strong> La lecture a été mise au point sur
          des images fabriquées ; elle n’a encore jamais vu de tuiles imprimées. Vérifiez
          toujours les cases signalées avant de croire le score.
        </p>
      </div>

      {erreur && (
        <div className="warn" style={{ marginBottom: 14 }}>
          {erreur}
        </div>
      )}

      {/* --------------------------------------------------------- la capture */}
      <div className="panel stack" style={{ marginBottom: 14 }}>
        <div className="row wrap">
          {mode === 'repos' && (
            <button className="btn primary" onClick={demarrerCamera}>
              📷 Scanner
            </button>
          )}
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
              onChange={(e) => {
                setTaille(Number(e.target.value))
                setCases(null)
                stableRef.current = { sig: '', n: 0 }
              }}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
          </label>
          {mode === 'direct' && (
            <button className="btn primary" onClick={() => figer(apercu)}>
              ⏸ Figer la lecture
            </button>
          )}
          {mode === 'fige' && (
            <>
              <button className="btn" onClick={relire}>
                ↻ Relire
              </button>
              <button className="btn ghost" onClick={demarrerCamera}>
                ⏵ Reprendre la caméra
              </button>
            </>
          )}
          {mode !== 'repos' && (
            <button className="btn ghost" onClick={recommencer}>
              Recommencer
            </button>
          )}
        </div>

        {mode === 'repos' && (
          <p className="note" style={{ margin: 0 }}>
            Sans caméra — sur ordinateur, ou si l’accès est refusé — le bouton propose de
            choisir une photo déjà prise.
          </p>
        )}

        {cadre && (
          <div className="scan-photo">
            {mode === 'direct' ? (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                onLoadedMetadata={accorderToile}
              />
            ) : (
              <img src={image?.url} alt="Plateau photographié" />
            )}
            {dimensions.largeur > 0 && (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${dimensions.largeur} ${dimensions.hauteur}`}
              onPointerMove={(e) => {
                if (tire === null) return
                const p = versSource(e.clientX, e.clientY)
                if (!p) return
                setCoins((c) => c.map((v, i) => (i === tire ? p : v)))
                stableRef.current = { sig: '', n: 0 }
              }}
              onPointerUp={() => setTire(null)}
              onPointerCancel={() => setTire(null)}
            >
              {grille.map((pts, i) => (
                <polyline key={i} className="scan-grille" points={pts} />
              ))}
              <polygon className="scan-cadre" points={coins.map((p) => `${p.x},${p.y}`).join(' ')} />
              {coins.map((p, i) => (
                <circle
                  key={i}
                  className={`scan-poignee ${tire === i ? 'active' : ''}`}
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(dimensions.largeur, dimensions.hauteur) / 42}
                  onPointerDown={(e) => {
                    svgRef.current?.setPointerCapture(e.pointerId)
                    setTire(i)
                  }}
                />
              ))}
            </svg>
            )}
            {mode === 'direct' && (
              <div className={`scan-direct ${aVerifier ? 'doute' : 'ok'}`}>
                <span className="pastille" />
                {apercu
                  ? `${qualite.toFixed(1)} ΔE · ${aVerifier === 0 ? 'lecture sûre' : `${aVerifier} case${aVerifier > 1 ? 's' : ''} douteuse${aVerifier > 1 ? 's' : ''}`}`
                  : 'recherche du plateau…'}
              </div>
            )}
          </div>
        )}

        {cadre && dimensions.largeur > 0 && (
          <p className="note" style={{ margin: 0 }}>
            Faites glisser les quatre pastilles jusqu’aux angles du damier — la grille doit
            tomber pile sur les tuiles. Un décalage jusqu’à un quart de tuile reste sans
            conséquence ; au-delà, la lecture se dégrade.
          </p>
        )}
      </div>

      {/* --------------------------------------------------------- le résultat */}
      {lues && plateau && bilan && (
        <>
          <div className="scan-resultat">
            <div className="panel">
              <BoardView board={plateau} ruleset={DEFAULT_RULESET} showZones />
            </div>
            <div className="panel stack">
              <h3 style={{ margin: 0, fontSize: 18 }}>
                Décompte {mode === 'direct' && <span className="tag">en direct</span>}
              </h3>
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
                  Qualité de l’image <strong>{qualite.toFixed(1)} ΔE</strong>
                </span>
                <span className={`tag ${aVerifier ? 'warnish' : ''}`}>
                  {aVerifier === 0
                    ? 'Aucune case douteuse'
                    : `${aVerifier} case${aVerifier > 1 ? 's' : ''} à vérifier`}
                </span>
              </div>
              <p className="note" style={{ margin: 0 }}>
                L’écart moyen à la palette dit ce que vaut l’image : en dessous de 8 ΔE la
                lecture est sûre, au-dessus de 15 elle devient hasardeuse. Une case est
                signalée quand ses couleurs collent mal (coût supérieur à {COUT_DOUTEUX}) — sur
                les essais, 11 % des cases signalées contiennent 92 % des erreurs.
              </p>
            </div>
          </div>

          {/* ------------------------------------------------- la vérification */}
          {mode === 'fige' && cases && (
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
          )}
        </>
      )}
    </div>
  )
}
