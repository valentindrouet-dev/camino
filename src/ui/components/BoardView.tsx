import { useMemo, useState } from 'react'
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
            <ZoneOutline key={`z${i}`} zone={z} n={n} highlight={hoverZone === i} />
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
function ZoneOutline({ zone, n, highlight }: { zone: Zone; n: number; highlight: boolean }) {
  const qs = n * 2
  const set = new Set(zone.cells)
  const segs: string[] = []

  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    const { x, y } = quadXY(c, n)
    const gapRight = col % 2 === 1
    const gapBelow = r % 2 === 1

    // haut
    if (r === 0 || !set.has(c - qs)) segs.push(`M${x} ${y}h${QUAD}`)
    // bas
    if (r === qs - 1 || !set.has(c + qs)) segs.push(`M${x} ${y + QUAD}h${QUAD}`)
    else if (gapBelow) {
      segs.push(`M${x} ${y + QUAD}v${GAP}`)
      segs.push(`M${x + QUAD} ${y + QUAD}v${GAP}`)
    }
    // gauche
    if (col === 0 || !set.has(c - 1)) segs.push(`M${x} ${y}v${QUAD}`)
    // droite
    if (col === qs - 1 || !set.has(c + 1)) segs.push(`M${x + QUAD} ${y}v${QUAD}`)
    else if (gapRight) {
      segs.push(`M${x + QUAD} ${y}h${GAP}`)
      segs.push(`M${x + QUAD} ${y + QUAD}h${GAP}`)
    }
  }

  const d = segs.join(' ')
  const top = zone.color === BLACK ? '#FFC168' : '#FFFFFF'
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#2A1E12" strokeWidth={highlight ? 7 : 5} opacity="0.6" />
      <path
        d={d}
        fill="none"
        stroke={top}
        strokeWidth={highlight ? 3.5 : 2.2}
        opacity={highlight ? 1 : 0.9}
      />
    </g>
  )
}

/** Pastille de points : anneau blanc, intérieur transparent, chiffre blanc. */
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
  return (
    <g className="zone-badge" pointerEvents="none">
      <title>{zoneLabel(zone, ruleset)}</title>
      <circle cx={cx} cy={cy} r="15" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="#FFFFFF">
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
