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

function zoneOutlinePath(zone: Zone, n: number): string {
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

  for (const c of zone.cells) {
    const r = Math.floor(c / qs)
    const col = c % qs
    const { x, y } = quadXY(c, n)
    inside.push({ x, y, w: QUAD, h: QUAD })

    if (r === 0 || !set.has(c - qs)) add(x, y, x + QUAD, y)
    if (r === qs - 1 || !set.has(c + qs)) add(x, y + QUAD, x + QUAD, y + QUAD)
    else if (r % 2 === 1) {
      // couloir vertical entre deux tuiles : ses deux bords ferment le contour
      add(x, y + QUAD, x, y + QUAD + GAP)
      add(x + QUAD, y + QUAD, x + QUAD, y + QUAD + GAP)
      inside.push({ x, y: y + QUAD, w: QUAD, h: GAP })
    }
    if (col === 0 || !set.has(c - 1)) add(x, y, x, y + QUAD)
    if (col === qs - 1 || !set.has(c + 1)) add(x + QUAD, y, x + QUAD, y + QUAD)
    else if (col % 2 === 1) {
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
      const { x, y } = quadXY(a, n)
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

function ZoneOutline({ zone, n, highlight }: { zone: Zone; n: number; highlight: boolean }) {
  const d = useMemo(() => zoneOutlinePath(zone, n), [zone, n])
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
