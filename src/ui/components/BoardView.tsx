import { useId, useMemo, useState } from 'react'
import {
  BLACK,
  COLOR_HEX,
  WHITE,
  computeZones,
  legalCells as computeLegalCells,
  placeTile,
  quadGrid,
  scoreOf,
  signed,
  starClusters,
  starQuadIndex,
  tileQuads,
  zoneLabel,
} from '../../engine/index.ts'
import type { Board, Rotation, Ruleset, Zone } from '../../engine/index.ts'
import { IridescentDefs, quadFill, Sheen } from './Iridescent.tsx'

/**
 * Reproduction du plateau de la boîte : un contour de couleur propre à chaque
 * joueur, une grille grise et des emplacements blancs séparés par un jeu, comme
 * sur les illustrations des cartes.
 */
const PITCH = 100 // pas d'une case à l'autre
const GAP = 8 // largeur des séparateurs gris
const TILEW = PITCH - GAP
const QUAD = TILEW / 2
const PAD = 16 // épaisseur du contour coloré

const GRID = '#A7A9AC'
const SLOT = '#FFFFFF'
/** Rouge clair des zones noires : contour et pastille. */
const BLACK_ACCENT = '#FF6B6B'
/** Profondeur de la couronne de bordure scorante (variantes). */
const BORDER_W = 26

export interface Ghost {
  tileId: number
  rot: Rotation
  flipped?: boolean
}

interface Props {
  board: Board
  ruleset: Ruleset
  /** Couleur du contour du plateau (couleur du joueur). */
  frameColor?: string
  showZones?: boolean
  interactive?: boolean
  ghost?: Ghost | null
  /** Cases jouables ; calculées si absentes. */
  legal?: number[]
  hint?: { cell: number; rot: Rotation } | null
  lastPlaced?: number | null
  onPlace?: (cell: number) => void
  compact?: boolean
}

export function BoardView({
  board,
  ruleset,
  frameColor = '#F7931D',
  showZones = true,
  interactive = false,
  ghost = null,
  legal,
  hint = null,
  lastPlaced = null,
  onPlace,
  compact = false,
}: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [hoverZone, setHoverZone] = useState<number | null>(null)
  const irisId = useId()

  const n = board.size
  // Bordures colorées : le cadre du plateau EST la bordure, rien à ajouter.
  // Seules les bordures multicolores réservent une couronne de carrés.
  const bw = board.borders?.kind === 'multi' ? BORDER_W : 0
  const side = PAD * 2 + 2 * bw + n * PITCH + GAP
  const grid = useMemo(() => quadGrid(board), [board])
  const zones = useMemo(
    () => (compact ? [] : computeZones(board, ruleset)),
    [board, ruleset, compact],
  )
  const starGroups = useMemo(
    () => (ruleset.variants?.magicStars ? starClusters(board) : []),
    [board, ruleset.variants?.magicStars],
  )
  /** Quarts dont l'étoile est reliée à au moins une autre : elle devient dorée. */
  const goldQuads = useMemo(() => {
    const s = new Set<number>()
    for (const g of starGroups) if (g.count > 1) for (const c of g.cells) s.add(c)
    return s
  }, [starGroups])

  /**
   * Ancres des pastilles : chacune occupe UNE case (quart), sans jamais
   * recouvrir une étoile ni une autre pastille. Les zones se placent d'abord
   * (elles doivent rester dans leurs propres cases) ; les groupes d'étoiles
   * prennent ensuite une case voisine libre.
   */
  const badgeAnchors = useMemo(() => {
    const qs = n * 2
    const starred = new Set(starGroups.flatMap((g) => g.cells))
    const used = new Set<number>()
    const byCentroid = (cells: number[]) => {
      let mx = 0
      let my = 0
      for (const c of cells) {
        mx += c % qs
        my += Math.floor(c / qs)
      }
      mx /= cells.length
      my /= cells.length
      const d = (c: number) => ((c % qs) - mx) ** 2 + (Math.floor(c / qs) - my) ** 2
      return (list: number[]) => [...list].sort((a, b) => d(a) - d(b))
    }

    /** Voisins orthogonaux puis diagonaux d'un ensemble de cases. */
    const neighboursOf = (cells: number[]) => {
      const inSet = new Set(cells)
      const out = new Set<number>()
      for (const c of cells) {
        const r = Math.floor(c / qs)
        const col = c % qs
        for (const [dr, dc] of [
          [-1, 0], [1, 0], [0, -1], [0, 1],
          [-1, -1], [-1, 1], [1, -1], [1, 1],
        ]) {
          const nr = r + dr
          const nc = col + dc
          if (nr < 0 || nc < 0 || nr >= qs || nc >= qs) continue
          const q = nr * qs + nc
          if (!inSet.has(q)) out.add(q)
        }
      }
      return [...out]
    }

    const zoneAnchors = new Map<number, number>()
    zones.forEach((z, i) => {
      if (z.points === 0) return
      const sort = byCentroid(z.cells)
      const sorted = sort(z.cells)
      // Si toutes les cases de la zone portent une étoile (petite zone très
      // étoilée), la pastille déborde sur une case voisine plutôt que de la
      // recouvrir.
      const a =
        sorted.find((c) => !starred.has(c) && !used.has(c)) ??
        sort(neighboursOf(z.cells)).find((c) => !starred.has(c) && !used.has(c)) ??
        sorted.find((c) => !used.has(c)) ??
        sorted[0]
      used.add(a)
      zoneAnchors.set(i, a)
    })

    const starAnchors = new Map<number, number>()
    starGroups.forEach((g, i) => {
      if (g.count <= 1) return
      const sorted = byCentroid(g.cells)(neighboursOf(g.cells))
      const filled = (c: number) => grid.cells[c] !== null
      const a =
        sorted.find((c) => filled(c) && !starred.has(c) && !used.has(c)) ??
        sorted.find((c) => !starred.has(c) && !used.has(c)) ??
        sorted.find((c) => !starred.has(c)) ??
        sorted[0] ??
        g.cells[0]
      used.add(a)
      starAnchors.set(i, a)
    })
    return { zoneAnchors, starAnchors }
  }, [zones, starGroups, grid, n])
  const legalSet = useMemo(
    () => new Set(legal ?? (interactive ? computeLegalCells(board, ruleset.requireAdjacency) : [])),
    [legal, interactive, board, ruleset.requireAdjacency],
  )

  // Aperçu : la tuile fantôme suit la souris et annonce le gain immédiat.
  const preview = useMemo(() => {
    if (!ghost || hover === null || !legalSet.has(hover)) return null
    const after = placeTile(board, hover, ghost.tileId, ghost.rot, 0, ghost.flipped)
    return {
      cell: hover,
      quads: tileQuads(ghost.tileId, ghost.rot, ghost.flipped),
      delta: scoreOf(after, ruleset) - scoreOf(board, ruleset),
    }
  }, [ghost, hover, legalSet, board, ruleset])

  const cellXY = (i: number) => ({
    x: PAD + bw + GAP + (i % n) * PITCH,
    y: PAD + bw + GAP + Math.floor(i / n) * PITCH,
  })

  return (
    <svg
      className="board-svg"
      viewBox={`0 0 ${side} ${side}`}
      onMouseLeave={() => {
        setHover(null)
        setHoverZone(null)
      }}
    >
      <IridescentDefs id={irisId} />

      {/* fond du plateau : contour coloré — sauf en bordures multicolores,
          où le verso imprimé n'a PAS de cadre de couleur, seulement les carrés */}
      <rect
        x="0"
        y="0"
        width={side}
        height={side}
        rx={compact ? 10 : 20}
        fill={board.borders?.kind === 'multi' ? '#FFFFFF' : frameColor}
        stroke={board.borders?.kind === 'multi' ? '#00000022' : 'none'}
        strokeWidth="1.5"
      />
      {board.borders && <BorderRing spec={board.borders} n={n} rx={compact ? 10 : 20} />}
      <rect
        x={PAD + bw}
        y={PAD + bw}
        width={side - (PAD + bw) * 2}
        height={side - (PAD + bw) * 2}
        rx={compact ? 4 : 8}
        fill={GRID}
      />

      {/* emplacements */}
      {board.cells.map((_, i) => (
        <rect key={`e${i}`} {...cellXY(i)} width={TILEW} height={TILEW} fill={SLOT} />
      ))}

      {/* quarts posés */}
      {grid.cells.map((color, qi) =>
        color === null ? null : (
          <g key={`q${qi}`}>
            <rect
              className="quad"
              {...quadXY(qi, n, bw)}
              width={QUAD}
              height={QUAD}
              fill={quadFill(color, irisId)}
            />
            {color === WHITE && (
              <Sheen {...quadXY(qi, n, bw)} size={QUAD} irisId={irisId} />
            )}
          </g>
        ),
      )}

      {/* trait magique : un fil doré lumineux relie les étoiles adjacentes */}
      {ruleset.variants?.magicStars &&
        starGroups
          .filter((g) => g.count > 1)
          .map((g, i) => {
            const d = magicLinkPath(g.cells, n, bw)
            return (
              <g key={`ml${i}`} pointerEvents="none">
                <path d={d} fill="none" stroke="#FFD23F" strokeWidth="12" strokeLinecap="round" opacity="0.35" />
                <path d={d} fill="none" stroke="#FFD23F" strokeWidth="4.5" strokeLinecap="round" />
                <path d={d} fill="none" stroke="#FFF3C2" strokeWidth="1.6" strokeLinecap="round" />
              </g>
            )
          })}

      {/* étoiles magiques : blanches quand isolées, dorées quand reliées */}
      {ruleset.variants?.magicStars &&
        board.cells.map((placed, i) => {
          if (!placed) return null
          const sq = starQuadIndex(placed.tileId, placed.rot, placed.flipped)
          if (sq === null) return null
          const { x, y } = cellXY(i)
          const [dx, dy] = QUAD_OFFSETS[sq]
          const r = Math.floor(i / n) * 2 + (sq >= 2 ? 1 : 0)
          const c = (i % n) * 2 + (sq === 1 || sq === 2 ? 1 : 0)
          const linked = goldQuads.has(r * n * 2 + c)
          return (
            <text
              key={`s${i}`}
              x={x + dx + QUAD / 2}
              y={y + dy + QUAD / 2 + 7}
              textAnchor="middle"
              fontSize="21"
              pointerEvents="none"
              fill={linked ? '#FFD23F' : '#FFFFFF'}
              stroke={linked ? '#7A5200' : '#00000088'}
              strokeWidth="1"
            >
              ★
            </text>
          )
        })}

      {/* dernière tuile posée : équerres dans les séparateurs, pour ne pas
          être confondue avec le contour blanc d'une zone qui marque */}
      {lastPlaced !== null && board.cells[lastPlaced] && (
        <LastPlacedMarker {...cellXY(lastPlaced)} />
      )}

      {/* cases jouables */}
      {interactive &&
        ghost &&
        [...legalSet].map((i) => (
          <rect
            key={`l${i}`}
            className="legal-hint"
            x={cellXY(i).x + 4}
            y={cellXY(i).y + 4}
            width={TILEW - 8}
            height={TILEW - 8}
            rx="3"
          />
        ))}

      {/* aperçu de la tuile sélectionnée */}
      {preview && (
        <g>
          {preview.quads.map((c, k) => {
            const { x, y } = cellXY(preview.cell)
            const [dx, dy] = QUAD_OFFSETS[k]
            return (
              <rect
                key={k}
                className="quad"
                x={x + dx}
                y={y + dy}
                width={QUAD}
                height={QUAD}
                fill={quadFill(c, irisId)}
                opacity="0.88"
              />
            )
          })}
          {ruleset.variants?.magicStars &&
            ghost &&
            (() => {
              const sq = starQuadIndex(ghost.tileId, ghost.rot, ghost.flipped)
              if (sq === null) return null
              const { x, y } = cellXY(preview.cell)
              const [dx, dy] = QUAD_OFFSETS[sq]
              return (
                <text
                  x={x + dx + QUAD / 2}
                  y={y + dy + QUAD / 2 + 7}
                  textAnchor="middle"
                  fontSize="21"
                  pointerEvents="none"
                  fill="#FFFFFF"
                  stroke="#00000088"
                  strokeWidth="1"
                  opacity="0.88"
                >
                  ★
                </text>
              )
            })()}
          <rect
            {...cellXY(preview.cell)}
            width={TILEW}
            height={TILEW}
            fill="none"
            stroke="#fff"
            strokeWidth="3"
          />
          <PreviewBadge
            x={cellXY(preview.cell).x}
            y={cellXY(preview.cell).y}
            delta={preview.delta}
          />
        </g>
      )}

      {/* contours des zones : celles qui comptent, plus celle qu'on survole */}
      {!compact &&
        zones.map((z, i) =>
          (showZones && z.points !== 0) || hoverZone === i ? (
            <ZoneOutline
              key={`z${i}`}
              zone={z}
              n={n}
              bw={bw}
              spec={board.borders}
              highlight={hoverZone === i}
            />
          ) : null,
        )}

      {/* pastilles de points */}
      {!compact &&
        showZones &&
        zones
          .map((z, i) =>
            z.points !== 0 ? (
              <ZoneBadge
                key={`b${i}`}
                zone={z}
                anchor={badgeAnchors.zoneAnchors.get(i) ?? z.cells[0]}
                n={n}
                bw={bw}
                ruleset={ruleset}
              />
            ) : null,
          )}

      {/* bonus des groupes d'étoiles : dessinés en dernier, toujours lisibles */}
      {!compact &&
        showZones &&
        ruleset.variants?.magicStars &&
        starGroups.map((g, i) =>
          g.count > 1 ? (
            <StarBadge
              key={`sb${i}`}
              cluster={g}
              anchor={badgeAnchors.starAnchors.get(i) ?? g.cells[0]}
              n={n}
              bw={bw}
            />
          ) : null,
        )}

      {/* meilleur coup (aide) */}
      {hint && board.cells[hint.cell] === null && (
        <rect
          className="hint-ring"
          x={cellXY(hint.cell).x + 2}
          y={cellXY(hint.cell).y + 2}
          width={TILEW - 4}
          height={TILEW - 4}
          rx="4"
        />
      )}

      {/* zones cliquables / survolables */}
      {board.cells.map((_, i) => (
        <rect
          key={`h${i}`}
          className={`slot-hit ${legalSet.has(i) ? 'legal' : ''}`}
          {...cellXY(i)}
          width={TILEW}
          height={TILEW}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
          onMouseMove={(e) => {
            if (compact) return
            const q = quadAt(e.currentTarget, e.clientX, e.clientY, n, bw)
            setHoverZone(q === null ? null : zones.findIndex((z) => z.cells.includes(q)))
          }}
          onClick={() => interactive && legalSet.has(i) && onPlace?.(i)}
        />
      ))}

      {/* infobulle de zone */}
      {!compact && hoverZone !== null && zones[hoverZone] && !preview && (
        <ZoneTooltip zone={zones[hoverZone]} n={n} bw={bw} ruleset={ruleset} />
      )}
    </svg>
  )
}

/** Décalage des 4 quarts dans l'ordre horaire : HG, HD, BD, BG. */
const QUAD_OFFSETS: [number, number][] = [
  [0, 0],
  [QUAD, 0],
  [QUAD, QUAD],
  [0, QUAD],
]

/** Coin haut-gauche d'un quart, séparateurs gris compris. */
function quadXY(qi: number, n: number, bw = 0) {
  const qs = n * 2
  const qr = Math.floor(qi / qs)
  const qc = qi % qs
  return {
    x: PAD + bw + GAP + Math.floor(qc / 2) * PITCH + (qc % 2) * QUAD,
    y: PAD + bw + GAP + Math.floor(qr / 2) * PITCH + (qr % 2) * QUAD,
  }
}

/**
 * Emprise de la bande de bordure scorante.
 *
 * Multicolore : une couronne de carrés s'ajoute autour du cadre (le plateau
 * est plus large, c'est le verso imprimé). Colorée : le cadre du plateau EST
 * la bande, découpée en carrés — le plateau garde sa taille habituelle.
 */
interface BandGeom {
  /** Épaisseur ajoutée au plateau (0 pour la bordure colorée). */
  bw: number
  /** Profondeur de la bande de carrés. */
  depth: number
  /** Distance du bord du plateau au bord extérieur de la bande. */
  outer: number
  side: number
}

function bandGeom(spec: Board['borders'] | undefined, n: number): BandGeom {
  const multi = spec?.kind === 'multi'
  const bw = multi ? BORDER_W : 0
  return {
    bw,
    depth: multi ? BORDER_W : PAD,
    outer: multi ? PAD : 0,
    side: PAD * 2 + 2 * bw + n * PITCH + GAP,
  }
}

/**
 * Un carré de bordure est ALIGNÉ sur le quart de tuile qu'il prolonge : même
 * largeur, mêmes jeux entre tuiles.
 */
function borderSquareRect(side4: number, k: number, g: BandGeom) {
  // position « le long du bord », identique à celle du quart k (cf. quadXY)
  const along = PAD + g.bw + GAP + Math.floor(k / 2) * PITCH + (k % 2) * QUAD
  // bord opposé : juste après le dernier quart et le jeu gris
  const far = g.side - g.outer - g.depth
  if (side4 === 0) return { x: along, y: g.outer, w: QUAD, h: g.depth }
  if (side4 === 2) return { x: along, y: far, w: QUAD, h: g.depth }
  if (side4 === 3) return { x: g.outer, y: along, w: g.depth, h: QUAD }
  return { x: far, y: along, w: g.depth, h: QUAD }
}

/** Emprise du bloc entier d'un côté (bordure colorée : un bloc par côté). */
function borderBlockRect(side4: number, n: number, g: BandGeom) {
  const start = PAD + g.bw + GAP
  const len = n * PITCH - GAP
  const far = g.side - g.outer - g.depth
  if (side4 === 0) return { x: start, y: g.outer, w: len, h: g.depth }
  if (side4 === 2) return { x: start, y: far, w: len, h: g.depth }
  if (side4 === 3) return { x: g.outer, y: start, w: g.depth, h: len }
  return { x: far, y: start, w: g.depth, h: len }
}

/**
 * Bande de bordure, avec ses coins blancs. Bordure colorée : un seul bloc par
 * côté, à la couleur du joueur. Multicolore : 2N carrés par côté.
 */
function BorderRing({
  spec,
  n,
  rx,
}: {
  spec: NonNullable<Board['borders']>
  n: number
  rx: number
}) {
  const clipId = useId()
  const g = bandGeom(spec, n)
  const qs = n * 2
  const uniform = spec.kind === 'uniform'
  const sep = uniform ? '#FFFFFF' : '#00000026'
  const sepW = uniform ? 1.6 : 1
  const rects: React.ReactNode[] = []
  for (let side4 = 0; side4 < 4; side4++) {
    if (uniform) {
      const { x, y, w, h } = borderBlockRect(side4, n, g)
      rects.push(
        <rect
          key={`b${side4}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={COLOR_HEX[spec.color]}
          stroke={sep}
          strokeWidth={sepW}
        />,
      )
      continue
    }
    for (let k = 0; k < qs; k++) {
      const color = spec.squares[side4 as 0 | 1 | 2 | 3][k]
      const { x, y, w, h } = borderSquareRect(side4, k, g)
      rects.push(
        <rect
          key={`${side4}-${k}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={COLOR_HEX[color]}
          stroke={sep}
          strokeWidth={sepW}
        />,
      )
    }
  }
  // coins blancs, dans le prolongement des carrés des deux côtés adjacents
  const near = g.outer
  const far = g.side - g.outer - g.depth
  return (
    <g clipPath={`url(#${clipId})`}>
      <clipPath id={clipId}>
        <rect x="0" y="0" width={g.side} height={g.side} rx={rx} />
      </clipPath>
      {rects}
      {[
        [near, near],
        [far, near],
        [near, far],
        [far, far],
      ].map(([cx, cy], i) => (
        <rect
          key={`c${i}`}
          x={cx}
          y={cy}
          width={g.depth}
          height={g.depth}
          fill="#FFFFFF"
          stroke={sep}
          strokeWidth={sepW}
        />
      ))}
    </g>
  )
}

/** Repère de la dernière tuile posée : quatre équerres dans la grille grise. */
function LastPlacedMarker({ x, y }: { x: number; y: number }) {
  const m = GAP / 2
  const x0 = x - m
  const y0 = y - m
  const x1 = x + TILEW + m
  const y1 = y + TILEW + m
  const L = 17
  const d = [
    `M${x0} ${y0 + L}V${y0}H${x0 + L}`,
    `M${x1 - L} ${y0}H${x1}V${y0 + L}`,
    `M${x1} ${y1 - L}V${y1}H${x1 - L}`,
    `M${x0 + L} ${y1}H${x0}V${y1 - L}`,
  ].join(' ')
  return (
    <path
      d={d}
      fill="none"
      stroke="#F7931D"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    />
  )
}

function PreviewBadge({ x, y, delta }: { x: number; y: number; delta: number }) {
  const txt = delta > 0 ? `+${delta}` : `${delta}`
  const fill = delta > 0 ? '#2F8F3C' : delta < 0 ? '#CF3A33' : '#8A7C6C'
  return (
    <g>
      <rect
        x={x + TILEW - 40}
        y={y - 12}
        width="46"
        height="26"
        rx="13"
        fill={fill}
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <text
        x={x + TILEW - 17}
        y={y + 6}
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fill="#fff"
      >
        {txt}
      </text>
    </g>
  )
}

/**
 * Géométrie du contour d'une zone.
 *
 * On part des arêtes de la frontière, on les enchaîne en boucles fermées puis
 * on décale chaque boucle vers l'intérieur. Résultat : un trait entièrement
 * contenu dans la zone, d'épaisseur constante partout et dont les angles
 * peuvent être arrondis — ce qu'un simple découpage ne permettait pas.
 */
interface Edge {
  ax: number
  ay: number
  bx: number
  by: number
}

/** Décalage du trait vers l'intérieur de la zone. */
const OUTLINE_INSET = 2.6
/** Rayon des angles du contour. */
const CORNER_RADIUS = 6

/**
 * Polygone aux angles arrondis : chaque sommet devient un petit arc, limité à
 * la moitié du plus court segment voisin pour ne jamais se replier.
 */
function roundedPolygon(points: { x: number; y: number }[], radius: number): string {
  const n = points.length
  if (n < 3) return ''
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y)
  const towards = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    d: number,
  ) => {
    const len = dist(from, to) || 1
    return { x: from.x + ((to.x - from.x) * d) / len, y: from.y + ((to.y - from.y) * d) / len }
  }
  const fmt = (p: { x: number; y: number }) =>
    `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`

  let d = ''
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]
    const r = Math.min(radius, dist(prev, cur) / 2, dist(cur, next) / 2)
    const entry = towards(cur, prev, r)
    const exit = towards(cur, next, r)
    d += i === 0 ? `M${fmt(entry)}` : `L${fmt(entry)}`
    if (r > 0.1) d += `Q${fmt(cur)} ${fmt(exit)}`
  }
  return d + 'Z'
}

function zoneOutlinePath(
  zone: Zone,
  n: number,
  bw: number,
  spec?: Board['borders'],
): string {
  const qs = n * 2
  const set = new Set(zone.cells)
  const inside: { x: number; y: number; w: number; h: number }[] = []
  const edges = new Map<string, number>()
  const key = (ax: number, ay: number, bx: number, by: number) => `${ax},${ay},${bx},${by}`
  /** Une arête vue deux fois est partagée par deux morceaux : elle est interne. */
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = ax < bx || ay < by ? key(ax, ay, bx, by) : key(bx, by, ax, ay)
    edges.set(k, (edges.get(k) ?? 0) + 1)
  }

  // Bordures : les blocs (ou carrés) reliés font partie du chemin, donc de son
  // contour. On annexe chaque morceau ainsi que le couloir gris qui le sépare
  // de son quart ; les arêtes communes de deux morceaux s'annulent d'elles-mêmes.
  if (spec && zone.borderIds?.length) {
    const g = bandGeom(spec, n)
    /** Quart du plateau qui touche le carré k du côté side4. */
    const quadOnSide = (side4: number, k: number) =>
      side4 === 0 ? k : side4 === 2 ? (qs - 1) * qs + k : side4 === 3 ? k * qs : k * qs + qs - 1
    /** Couloir gris entre le carré k et son quart. */
    const bridge = (side4: number, k: number) => {
      const S = borderSquareRect(side4, k, g)
      if (side4 === 0) return { x: S.x, y: S.y + S.h, w: QUAD, h: GAP }
      if (side4 === 2) return { x: S.x, y: S.y - GAP, w: QUAD, h: GAP }
      if (side4 === 3) return { x: S.x + S.w, y: S.y, w: GAP, h: QUAD }
      return { x: S.x - GAP, y: S.y, w: GAP, h: QUAD }
    }
    /** Jeu entre les carrés des tuiles t-1 et t, pour combler un bloc entier. */
    const filler = (side4: number, t: number) => {
      const along = PAD + g.bw + GAP + t * PITCH - GAP
      const far = g.side - g.outer - g.depth
      if (side4 === 0) return { x: along, y: g.outer, w: GAP, h: g.depth }
      if (side4 === 2) return { x: along, y: far, w: GAP, h: g.depth }
      if (side4 === 3) return { x: g.outer, y: along, w: g.depth, h: GAP }
      return { x: far, y: along, w: g.depth, h: GAP }
    }
    /**
     * Petit carré au croisement du couloir gris et du jeu entre tuiles : sans
     * lui, deux ponts voisins enferment un trou et le contour y dessine un rond.
     */
    const joint = (side4: number, t: number) => {
      const along = PAD + g.bw + GAP + t * PITCH - GAP
      const inner = g.outer + g.depth
      const far = g.side - g.outer - g.depth
      if (side4 === 0) return { x: along, y: inner, w: GAP, h: GAP }
      if (side4 === 2) return { x: along, y: far - GAP, w: GAP, h: GAP }
      if (side4 === 3) return { x: inner, y: along, w: GAP, h: GAP }
      return { x: far - GAP, y: along, w: GAP, h: GAP }
    }

    const pieces: { x: number; y: number; w: number; h: number }[] = []
    for (const id of zone.borderIds) {
      const v = -id - 1
      if (spec.kind === 'uniform') {
        // un bloc par côté : il est entièrement annexé dès qu'il est relié
        const side4 = v
        for (let k = 0; k < qs; k++) {
          pieces.push(borderSquareRect(side4, k, g))
          if (set.has(quadOnSide(side4, k))) pieces.push(bridge(side4, k))
        }
        for (let t = 1; t < n; t++) {
          pieces.push(filler(side4, t))
          // les deux quarts de part et d'autre du jeu sont dans la zone :
          // leurs ponts se rejoignent, il n'y a pas de trou entre eux
          if (set.has(quadOnSide(side4, 2 * t - 1)) && set.has(quadOnSide(side4, 2 * t))) {
            pieces.push(joint(side4, t))
          }
        }
      } else {
        const side4 = Math.floor(v / 100)
        const k = v % 100
        if (!set.has(quadOnSide(side4, k))) continue
        pieces.push(borderSquareRect(side4, k, g), bridge(side4, k))
      }
    }
    // Les quatre arêtes de chaque morceau : celles partagées se neutralisent,
    // y compris celle qui touche le quart du chemin.
    for (const r of pieces) {
      inside.push(r)
      add(r.x, r.y, r.x + r.w, r.y)
      add(r.x, r.y + r.h, r.x + r.w, r.y + r.h)
      add(r.x, r.y, r.x, r.y + r.h)
      add(r.x + r.w, r.y, r.x + r.w, r.y + r.h)
    }
  }

  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    const { x, y } = quadXY(c, n, bw)
    inside.push({ x, y, w: QUAD, h: QUAD })

    if (r === 0 || !set.has(c - qs)) add(x, y, x + QUAD, y)
    if (r === qs - 1 || !set.has(c + qs)) {
      add(x, y + QUAD, x + QUAD, y + QUAD)
    } else if (r % 2 === 1) {
      // couloir vertical entre deux tuiles : ses deux bords ferment le contour
      add(x, y + QUAD, x, y + QUAD + GAP)
      add(x + QUAD, y + QUAD, x + QUAD, y + QUAD + GAP)
      inside.push({ x, y: y + QUAD, w: QUAD, h: GAP })
    }
    if (col === 0 || !set.has(c - 1)) add(x, y, x, y + QUAD)
    if (col === qs - 1 || !set.has(c + 1)) {
      add(x + QUAD, y, x + QUAD, y + QUAD)
    } else if (col % 2 === 1) {
      add(x + QUAD, y, x + QUAD + GAP, y)
      add(x + QUAD, y + QUAD, x + QUAD + GAP, y + QUAD)
      inside.push({ x: x + QUAD, y, w: GAP, h: QUAD })
    }
  }

  // Croisement de quatre tuiles entièrement occupé : le carré central est
  // intérieur, sinon les bords des couloirs y dessinent un carré parasite.
  for (let r = 1; r < qs - 1; r += 2) {
    for (let col = 1; col < qs - 1; col += 2) {
      const a = r * qs + col
      if (!set.has(a) || !set.has(a + 1) || !set.has(a + qs) || !set.has(a + qs + 1)) continue
      const { x, y } = quadXY(a, n, bw)
      const cx = x + QUAD
      const cy = y + QUAD
      inside.push({ x: cx, y: cy, w: GAP, h: GAP })
      for (const k of [
        key(cx, cy, cx + GAP, cy),
        key(cx, cy + GAP, cx + GAP, cy + GAP),
        key(cx, cy, cx, cy + GAP),
        key(cx + GAP, cy, cx + GAP, cy + GAP),
      ]) {
        edges.delete(k)
      }
    }
  }

  const isInside = (x: number, y: number) =>
    inside.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)

  // Chaque arête est orientée de sorte que l'intérieur soit à sa droite.
  const directed: Edge[] = []
  for (const [k, count] of edges) {
    if (count !== 1) continue
    const [ax, ay, bx, by] = k.split(',').map(Number)
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const dx = Math.sign(bx - ax)
    const dy = Math.sign(by - ay)
    // normale droite d'une direction (dx, dy) dans un repère à y vers le bas
    const right = { x: -dy, y: dx }
    directed.push(
      isInside(mx + right.x, my + right.y)
        ? { ax, ay, bx, by }
        : { ax: bx, ay: by, bx: ax, by: ay },
    )
  }

  // Enchaînement en boucles : à chaque sommet on tourne d'abord à droite,
  // ce qui garde l'intérieur du même côté même aux points de pincement.
  const starting = new Map<string, Edge[]>()
  for (const e of directed) {
    const k = `${e.ax},${e.ay}`
    const list = starting.get(k)
    if (list) list.push(e)
    else starting.set(k, [e])
  }
  const used = new Set<Edge>()
  const loops: Edge[][] = []
  for (const first of directed) {
    if (used.has(first)) continue
    const loop: Edge[] = []
    let e: Edge | undefined = first
    while (e && !used.has(e)) {
      used.add(e)
      loop.push(e)
      const dx = Math.sign(e.bx - e.ax)
      const dy = Math.sign(e.by - e.ay)
      const candidates: Edge[] = (starting.get(`${e.bx},${e.by}`) ?? []).filter(
        (c: Edge) => !used.has(c),
      )
      const rank = (c: Edge) => {
        const cx = Math.sign(c.bx - c.ax)
        const cy = Math.sign(c.by - c.ay)
        if (cx === -dy && cy === dx) return 0 // à droite
        if (cx === dx && cy === dy) return 1 // tout droit
        if (cx === dy && cy === -dx) return 2 // à gauche
        return 3 // demi-tour
      }
      e = candidates.sort((a: Edge, b: Edge) => rank(a) - rank(b))[0]
    }
    loops.push(loop)
  }

  // Décalage vers l'intérieur, puis reconstruction des sommets.
  const parts: string[] = []
  for (const loop of loops) {
    if (loop.length < 2) continue
    const shifted = loop.map((e) => {
      const dx = Math.sign(e.bx - e.ax)
      const dy = Math.sign(e.by - e.ay)
      const ox = -dy * OUTLINE_INSET
      const oy = dx * OUTLINE_INSET
      return { ax: e.ax + ox, ay: e.ay + oy, bx: e.bx + ox, by: e.by + oy, dx, dy }
    })
    const points: { x: number; y: number }[] = []
    for (let i = 0; i < shifted.length; i++) {
      const cur = shifted[i]
      const next = shifted[(i + 1) % shifted.length]
      // deux segments à angle droit : le sommet est l'intersection de leurs
      // droites ; alignés, on garde simplement le point commun.
      points.push({
        x: cur.dx !== 0 ? (next.dx !== 0 ? cur.bx : next.ax) : cur.ax,
        y: cur.dy !== 0 ? (next.dy !== 0 ? cur.by : next.ay) : cur.ay,
      })
    }
    parts.push(roundedPolygon(points, CORNER_RADIUS))
  }
  return parts.join(' ')
}

function ZoneOutline({
  zone,
  n,
  bw,
  spec,
  highlight,
}: {
  zone: Zone
  n: number
  bw: number
  spec?: Board['borders']
  highlight: boolean
}) {
  const d = useMemo(() => zoneOutlinePath(zone, n, bw, spec), [zone, n, bw, spec])
  const color = zone.color === BLACK ? BLACK_ACCENT : '#FFFFFF'
  return (
    <g pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke="#00000040"
        strokeWidth={(highlight ? 4.6 : 3.4) + 2}
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={highlight ? 4.6 : 3.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  )
}

/**
 * Pastille de points : un simple rond, intérieur transparent. La police se
 * réduit au-delà de 9 pour que « +23 » tienne dans le cercle.
 */
function ZoneBadge({
  zone,
  anchor,
  n,
  bw,
  ruleset,
}: {
  zone: Zone
  /** Case (quart) qui porte la pastille — choisie sans collision. */
  anchor: number
  n: number
  bw: number
  ruleset: Ruleset
}) {
  const { x, y } = quadXY(anchor, n, bw)
  const cx = x + QUAD / 2
  const cy = y + QUAD / 2
  const label = signed(zone.points)
  const color = zone.color === BLACK ? BLACK_ACCENT : '#FFFFFF'
  // À deux chiffres le texte doit rentrer dans le rond avec de la marge.
  const size = label.length <= 2 ? 15 : label.length === 3 ? 11 : 9.5
  return (
    <g className="zone-badge" pointerEvents="none">
      <title>{zoneLabel(zone, ruleset)}</title>
      <circle cx={cx} cy={cy} r="15" fill="none" stroke={color} strokeWidth="1.8" />
      <text
        x={cx}
        y={cy + size * 0.35}
        textAnchor="middle"
        fill={color}
        fontSize={size}
      >
        {label}
      </text>
    </g>
  )
}

/**
 * Fil magique d'un groupe d'étoiles : un segment entre les centres de chaque
 * paire de quarts étoilés adjacents.
 */
function magicLinkPath(cells: number[], n: number, bw: number): string {
  const qs = n * 2
  const set = new Set(cells)
  const center = (c: number) => {
    const { x, y } = quadXY(c, n, bw)
    return { x: x + QUAD / 2, y: y + QUAD / 2 }
  }
  const segs: string[] = []
  for (const c of cells) {
    for (const nb of [c + 1, c + qs]) {
      if (!set.has(nb)) continue
      if (nb === c + 1 && nb % qs === 0) continue // passage à la ligne
      const a = center(c)
      const b = center(nb)
      segs.push(`M${a.x} ${a.y}L${b.x} ${b.y}`)
    }
  }
  return segs.join(' ')
}

/** Pastille dorée : points d'un groupe d'étoiles reliées. Toujours lisible. */
function StarBadge({
  cluster,
  anchor,
  n,
  bw,
}: {
  cluster: { cells: number[]; count: number; points: number }
  /** Case (quart) voisine du groupe qui porte la pastille, sans collision. */
  anchor: number
  n: number
  bw: number
}) {
  const { x, y } = quadXY(anchor, n, bw)
  const cx = x + QUAD / 2
  const cy = y + QUAD / 2
  const label = `+${cluster.points}`
  return (
    <g className="zone-badge" pointerEvents="none">
      <title>{`${cluster.count} étoiles reliées — +${cluster.points} pts`}</title>
      <circle cx={cx} cy={cy} r="13" fill="#FFD23F" stroke="#FFFFFF" strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="14.5" fill="none" stroke="#00000022" strokeWidth="1" />
      <text
        x={cx}
        y={cy + 4.5}
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="#5C4500"
      >
        {label}
      </text>
    </g>
  )
}

/** Étiquette flottante décrivant la zone survolée. */
function ZoneTooltip({
  zone,
  n,
  bw,
  ruleset,
}: {
  zone: Zone
  n: number
  bw: number
  ruleset: Ruleset
}) {
  const first = zone.cells[0]
  const text = zoneLabel(zone, ruleset)
  const w = text.length * 8.2 + 18
  const pos = quadXY(first, n, bw)
  const side = PAD * 2 + 2 * bw + n * PITCH + GAP
  const x = Math.max(2, Math.min(pos.x + QUAD / 2 - w / 2, side - w - 2))
  const y = pos.y - 16
  return (
    <g pointerEvents="none">
      <rect x={x} y={y - 14} width={w} height="26" rx="13" fill="#FFFFFF" stroke="#F7931D" />
      <text
        x={x + w / 2}
        y={y + 4}
        textAnchor="middle"
        fontSize="14"
        fill="#33291F"
        fontWeight="600"
      >
        {text}
      </text>
    </g>
  )
}

/** Index du quart survolé à partir des coordonnées écran. */
function quadAt(
  el: SVGRectElement,
  clientX: number,
  clientY: number,
  n: number,
  bw: number,
): number | null {
  const svg = el.ownerSVGElement
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const side = PAD * 2 + 2 * bw + n * PITCH + GAP
  const scale = rect.width / side
  const x = (clientX - rect.left) / scale - PAD - bw - GAP
  const y = (clientY - rect.top) / scale - PAD - bw - GAP
  const tileC = Math.floor(x / PITCH)
  const tileR = Math.floor(y / PITCH)
  if (tileC < 0 || tileR < 0 || tileC >= n || tileR >= n) return null
  const qc = tileC * 2 + (x - tileC * PITCH > QUAD ? 1 : 0)
  const qr = tileR * 2 + (y - tileR * PITCH > QUAD ? 1 : 0)
  return qr * n * 2 + qc
}
