import { useId, useMemo, useState } from 'react'
import {
  BLACK,
  COLOR_HEX,
  computeZones,
  legalCells as computeLegalCells,
  placeTile,
  quadGrid,
  scoreOf,
  signed,
  tileQuads,
  zoneLabel,
} from '../../engine/index.ts'
import type { Board, Rotation, Ruleset, Zone } from '../../engine/index.ts'

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

export interface Ghost {
  tileId: number
  rot: Rotation
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
  const uid = useId().replace(/:/g, '')

  const n = board.size
  const side = PAD * 2 + n * PITCH + GAP
  const grid = useMemo(() => quadGrid(board), [board])
  const zones = useMemo(
    () => (compact ? [] : computeZones(board, ruleset)),
    [board, ruleset, compact],
  )
  const legalSet = useMemo(
    () => new Set(legal ?? (interactive ? computeLegalCells(board, ruleset.requireAdjacency) : [])),
    [legal, interactive, board, ruleset.requireAdjacency],
  )

  // Aperçu : la tuile fantôme suit la souris et annonce le gain immédiat.
  const preview = useMemo(() => {
    if (!ghost || hover === null || !legalSet.has(hover)) return null
    const after = placeTile(board, hover, ghost.tileId, ghost.rot, 0)
    return {
      cell: hover,
      quads: tileQuads(ghost.tileId, ghost.rot),
      delta: scoreOf(after, ruleset) - scoreOf(board, ruleset),
    }
  }, [ghost, hover, legalSet, board, ruleset])

  const cellXY = (i: number) => ({
    x: PAD + GAP + (i % n) * PITCH,
    y: PAD + GAP + Math.floor(i / n) * PITCH,
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
      {/* contour coloré du plateau */}
      <rect x="0" y="0" width={side} height={side} rx={compact ? 10 : 20} fill={frameColor} />
      <rect
        x={PAD}
        y={PAD}
        width={side - PAD * 2}
        height={side - PAD * 2}
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
          <rect
            key={`q${qi}`}
            className="quad"
            {...quadXY(qi, n)}
            width={QUAD}
            height={QUAD}
            fill={COLOR_HEX[color]}
          />
        ),
      )}

      {/* dernière tuile posée */}
      {lastPlaced !== null && board.cells[lastPlaced] && (
        <rect
          {...cellXY(lastPlaced)}
          width={TILEW}
          height={TILEW}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          opacity="0.95"
        />
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
                fill={COLOR_HEX[c]}
                opacity="0.88"
              />
            )
          })}
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
              highlight={hoverZone === i}
              clipId={`zc-${uid}-${i}`}
            />
          ) : null,
        )}

      {/* pastilles de points */}
      {!compact &&
        showZones &&
        zones
          .filter((z) => z.points !== 0)
          .map((z, i) => <ZoneBadge key={`b${i}`} zone={z} n={n} ruleset={ruleset} />)}

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
            const q = quadAt(e.currentTarget, e.clientX, e.clientY, n)
            setHoverZone(q === null ? null : zones.findIndex((z) => z.cells.includes(q)))
          }}
          onClick={() => interactive && legalSet.has(i) && onPlace?.(i)}
        />
      ))}

      {/* infobulle de zone */}
      {!compact && hoverZone !== null && zones[hoverZone] && !preview && (
        <ZoneTooltip zone={zones[hoverZone]} n={n} ruleset={ruleset} />
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
function quadXY(qi: number, n: number) {
  const qs = n * 2
  const qr = Math.floor(qi / qs)
  const qc = qi % qs
  return {
    x: PAD + GAP + Math.floor(qc / 2) * PITCH + (qc % 2) * QUAD,
    y: PAD + GAP + Math.floor(qr / 2) * PITCH + (qr % 2) * QUAD,
  }
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
 * Contour d'une zone. On garde les côtés qui n'ont pas de voisin de la même
 * zone ; quand deux quarts de la zone se font face de part et d'autre d'un
 * séparateur gris, on trace les deux bords du couloir pour que le contour
 * reste fermé.
 */
function ZoneOutline({
  zone,
  n,
  highlight,
  clipId,
}: {
  zone: Zone
  n: number
  highlight: boolean
  clipId: string
}) {
  const qs = n * 2
  const set = new Set(zone.cells)
  /*
   * Segments du contour, comptés : une arête ajoutée deux fois est partagée
   * par deux quarts de la zone, donc intérieure — c'est le cas des traits qui
   * traversaient les couloirs entre deux tuiles voisines. On ne garde que les
   * arêtes vues une seule fois.
   */
  const segs = new Map<string, number>()
  const add = (key: string) => segs.set(key, (segs.get(key) ?? 0) + 1)
  const hSeg = (x: number, y: number, len: number) => `M${x} ${y}h${len}`
  const vSeg = (x: number, y: number, len: number) => `M${x} ${y}v${len}`
  /** Rectangles couvrant la zone : ils découpent le trait pour qu'il reste
   *  strictement à l'intérieur, sans jamais baver sur la grille grise. */
  const clip: { x: number; y: number; w: number; h: number }[] = []

  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    const { x, y } = quadXY(c, n)
    const gapRight = col % 2 === 1
    const gapBelow = r % 2 === 1
    clip.push({ x, y, w: QUAD, h: QUAD })

    // haut
    if (r === 0 || !set.has(c - qs)) add(hSeg(x, y, QUAD))
    // bas
    if (r === qs - 1 || !set.has(c + qs)) add(hSeg(x, y + QUAD, QUAD))
    else if (gapBelow) {
      add(vSeg(x, y + QUAD, GAP))
      add(vSeg(x + QUAD, y + QUAD, GAP))
      clip.push({ x, y: y + QUAD, w: QUAD, h: GAP })
    }
    // gauche
    if (col === 0 || !set.has(c - 1)) add(vSeg(x, y, QUAD))
    // droite
    if (col === qs - 1 || !set.has(c + 1)) add(vSeg(x + QUAD, y, QUAD))
    else if (gapRight) {
      add(hSeg(x + QUAD, y, GAP))
      add(hSeg(x + QUAD, y + QUAD, GAP))
      clip.push({ x: x + QUAD, y, w: GAP, h: QUAD })
    }
  }

  /*
   * Croisement de quatre tuiles entièrement occupé par la zone : le petit
   * carré central appartient à l'intérieur. Sans cela, les bords des deux
   * couloirs l'encadrent et dessinent un carré parasite au milieu de la zone.
   */
  for (let r = 1; r < qs - 1; r += 2) {
    for (let col = 1; col < qs - 1; col += 2) {
      const a = r * qs + col
      if (!set.has(a) || !set.has(a + 1) || !set.has(a + qs) || !set.has(a + qs + 1)) continue
      const { x, y } = quadXY(a, n)
      const cx = x + QUAD
      const cy = y + QUAD
      clip.push({ x: cx, y: cy, w: GAP, h: GAP })
      segs.delete(hSeg(cx, cy, GAP))
      segs.delete(hSeg(cx, cy + GAP, GAP))
      segs.delete(vSeg(cx, cy, GAP))
      segs.delete(vSeg(cx + GAP, cy, GAP))
    }
  }

  const d = [...segs.entries()]
    .filter(([, count]) => count === 1)
    .map(([key]) => key)
    .join(' ')
  const color = zone.color === BLACK ? BLACK_ACCENT : '#FFFFFF'
  const w = highlight ? 9 : 6
  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={clipId}>
          {clip.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Trait épais rogné par le découpage : seule la moitié intérieure
            reste visible, ce qui donne un liseré net collé à la zone. */}
        <path d={d} fill="none" stroke="#00000055" strokeWidth={w + 4} />
        <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={highlight ? 1 : 0.95} />
      </g>
    </g>
  )
}

/**
 * Pastille de points : contour et chiffre seuls, intérieur transparent.
 * La largeur suit le texte — « +23 » ne doit pas déborder.
 */
function ZoneBadge({ zone, n, ruleset }: { zone: Zone; n: number; ruleset: Ruleset }) {
  const qs = n * 2
  let bx = 0
  let by = 0
  for (const c of zone.cells) {
    bx += c % qs
    by += Math.floor(c / qs)
  }
  bx /= zone.cells.length
  by /= zone.cells.length
  let best = zone.cells[0]
  let bestD = Infinity
  for (const c of zone.cells) {
    const d = ((c % qs) - bx) ** 2 + (Math.floor(c / qs) - by) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  const { x, y } = quadXY(best, n)
  const cx = x + QUAD / 2
  const cy = y + QUAD / 2
  const label = signed(zone.points)
  const color = zone.color === BLACK ? BLACK_ACCENT : '#FFFFFF'
  const h = 27
  const w = Math.max(h, 13 + label.length * 10)
  return (
    <g className="zone-badge" pointerEvents="none">
      <title>{zoneLabel(zone, ruleset)}</title>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color}>
        {label}
      </text>
    </g>
  )
}

/** Étiquette flottante décrivant la zone survolée. */
function ZoneTooltip({ zone, n, ruleset }: { zone: Zone; n: number; ruleset: Ruleset }) {
  const first = zone.cells[0]
  const text = zoneLabel(zone, ruleset)
  const w = text.length * 8.2 + 18
  const pos = quadXY(first, n)
  const side = PAD * 2 + n * PITCH + GAP
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
function quadAt(el: SVGRectElement, clientX: number, clientY: number, n: number): number | null {
  const svg = el.ownerSVGElement
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const side = PAD * 2 + n * PITCH + GAP
  const scale = rect.width / side
  const x = (clientX - rect.left) / scale - PAD - GAP
  const y = (clientY - rect.top) / scale - PAD - GAP
  const tileC = Math.floor(x / PITCH)
  const tileR = Math.floor(y / PITCH)
  if (tileC < 0 || tileR < 0 || tileC >= n || tileR >= n) return null
  const qc = tileC * 2 + (x - tileC * PITCH > QUAD ? 1 : 0)
  const qr = tileR * 2 + (y - tileR * PITCH > QUAD ? 1 : 0)
  return qr * n * 2 + qc
}
