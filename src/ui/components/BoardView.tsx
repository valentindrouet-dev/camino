import { useMemo, useState } from 'react'
import {
  BLACK,
  COLOR_HEX,
  computeZones,
  legalCells as computeLegalCells,
  placeTile,
  quadGrid,
  scoreOf,
  tileQuads,
  zoneLabel,
} from '../../engine/index.ts'
import type { Board, Rotation, Ruleset, Zone } from '../../engine/index.ts'

const TILE = 100
const QUAD = TILE / 2
const PAD = 14
/** Décalage des 4 quarts dans l'ordre horaire : HG, HD, BD, BG. */
const QUAD_OFFSETS: [number, number][] = [
  [0, 0],
  [QUAD, 0],
  [QUAD, QUAD],
  [0, QUAD],
]

export interface Ghost {
  tileId: number
  rot: Rotation
}

interface Props {
  board: Board
  ruleset: Ruleset
  showZones?: boolean
  showGrid?: boolean
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
  showZones = true,
  showGrid = true,
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
  const side = PAD * 2 + n * TILE
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

  const quadXY = (qi: number) => {
    const qs = n * 2
    return { x: PAD + (qi % qs) * QUAD, y: PAD + Math.floor(qi / qs) * QUAD }
  }
  const cellXY = (i: number) => ({
    x: PAD + (i % n) * TILE,
    y: PAD + Math.floor(i / n) * TILE,
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
      {/* cadre du plateau */}
      <rect x="0" y="0" width={side} height={side} rx={compact ? 8 : 18} fill="#F7931D" />
      <rect
        x={PAD - 3}
        y={PAD - 3}
        width={n * TILE + 6}
        height={n * TILE + 6}
        rx="5"
        fill="#E7D6B4"
      />

      {/* emplacements vides */}
      {board.cells.map((c, i) =>
        c ? null : (
          <rect
            key={`e${i}`}
            {...cellXY(i)}
            width={TILE}
            height={TILE}
            fill="#FFFCF2"
            stroke="#D9C7A4"
            strokeWidth="1.5"
          />
        ),
      )}

      {/* quarts posés */}
      {grid.cells.map((color, qi) =>
        color === null ? null : (
          <rect
            key={`q${qi}`}
            className="quad"
            {...quadXY(qi)}
            width={QUAD}
            height={QUAD}
            fill={COLOR_HEX[color]}
          />
        ),
      )}

      {/* grille des tuiles : on doit pouvoir compter les tuiles traversées */}
      {showGrid && (
        <g className="tile-grid">
          {Array.from({ length: n + 1 }, (_, k) => (
            <g key={`g${k}`}>
              <line x1={PAD + k * TILE} y1={PAD} x2={PAD + k * TILE} y2={PAD + n * TILE} />
              <line x1={PAD} y1={PAD + k * TILE} x2={PAD + n * TILE} y2={PAD + k * TILE} />
            </g>
          ))}
        </g>
      )}

      {/* dernière tuile posée */}
      {lastPlaced !== null && board.cells[lastPlaced] && (
        <rect
          {...cellXY(lastPlaced)}
          width={TILE}
          height={TILE}
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
            x={cellXY(i).x + 5}
            y={cellXY(i).y + 5}
            width={TILE - 10}
            height={TILE - 10}
            rx="4"
          />
        ))}

      {/* aperçu de la tuile sélectionnée */}
      {preview && (
        <g opacity="0.92">
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
            width={TILE}
            height={TILE}
            fill="none"
            stroke="#fff"
            strokeWidth="3"
          />
          <PreviewBadge x={cellXY(preview.cell).x} y={cellXY(preview.cell).y} delta={preview.delta} />
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
          x={cellXY(hint.cell).x + 3}
          y={cellXY(hint.cell).y + 3}
          width={TILE - 6}
          height={TILE - 6}
          rx="5"
        />
      )}

      {/* zones cliquables / survolables */}
      {board.cells.map((_, i) => (
        <rect
          key={`h${i}`}
          className={`slot-hit ${legalSet.has(i) ? 'legal' : ''}`}
          {...cellXY(i)}
          width={TILE}
          height={TILE}
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

/** Étiquette flottante décrivant la zone survolée. */
function ZoneTooltip({ zone, n, ruleset }: { zone: Zone; n: number; ruleset: Ruleset }) {
  const qs = n * 2
  const first = zone.cells[0]
  const text = zoneLabel(zone, ruleset)
  const w = text.length * 8.2 + 18
  let x = PAD + (first % qs) * QUAD + QUAD / 2 - w / 2
  const y = PAD + Math.floor(first / qs) * QUAD - 16
  x = Math.max(2, Math.min(x, PAD * 2 + n * TILE - w - 2))
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

function PreviewBadge({ x, y, delta }: { x: number; y: number; delta: number }) {
  const txt = delta > 0 ? `+${delta}` : `${delta}`
  const fill = delta > 0 ? '#2F8F3C' : delta < 0 ? '#CF3A33' : '#8A7C6C'
  return (
    <g>
      <rect
        x={x + TILE - 40}
        y={y - 12}
        width="46"
        height="26"
        rx="13"
        fill={fill}
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <text
        x={x + TILE - 17}
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

/** Contour d'une zone : on garde les côtés qui n'ont pas de voisin de la zone. */
function ZoneOutline({ zone, n, highlight }: { zone: Zone; n: number; highlight: boolean }) {
  const qs = n * 2
  const set = new Set(zone.cells)
  const segs: string[] = []
  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    const x = PAD + col * QUAD
    const y = PAD + r * QUAD
    if (r === 0 || !set.has(c - qs)) segs.push(`M${x} ${y}h${QUAD}`)
    if (r === qs - 1 || !set.has(c + qs)) segs.push(`M${x} ${y + QUAD}h${QUAD}`)
    if (col === 0 || !set.has(c - 1)) segs.push(`M${x} ${y}v${QUAD}`)
    if (col === qs - 1 || !set.has(c + 1)) segs.push(`M${x + QUAD} ${y}v${QUAD}`)
  }
  const d = segs.join(' ')
  const top = zone.color === BLACK ? '#FFC168' : '#FFFFFF'
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#2A1E12" strokeWidth={highlight ? 7 : 5} opacity="0.7" />
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

function ZoneBadge({ zone, n, ruleset }: { zone: Zone; n: number; ruleset: Ruleset }) {
  const qs = n * 2
  // On pose la pastille sur le quart le plus « central » de la zone.
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
  const x = PAD + (best % qs) * QUAD + QUAD / 2
  const y = PAD + Math.floor(best / qs) * QUAD + QUAD / 2
  const black = zone.color === BLACK
  const label = black ? `${zone.points}` : `+${zone.points}`
  return (
    <g pointerEvents="none">
      <title>{zoneLabel(zone, ruleset)}</title>
      <circle cx={x} cy={y} r="17" fill="#FFFFFF" stroke="#00000026" strokeWidth="1.5" />
      <text
        className="zone-badge"
        x={x}
        y={y + 5}
        textAnchor="middle"
        fill={black ? '#CF3A33' : '#2F8F3C'}
      >
        {label}
      </text>
    </g>
  )
}

/** Index du quart survolé à partir des coordonnées écran. */
function quadAt(el: SVGRectElement, clientX: number, clientY: number, n: number): number | null {
  const svg = el.ownerSVGElement
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const side = PAD * 2 + n * TILE
  const scale = rect.width / side
  const x = (clientX - rect.left) / scale - PAD
  const y = (clientY - rect.top) / scale - PAD
  const qs = n * 2
  const qc = Math.floor(x / QUAD)
  const qr = Math.floor(y / QUAD)
  if (qc < 0 || qr < 0 || qc >= qs || qr >= qs) return null
  return qr * qs + qc
}
