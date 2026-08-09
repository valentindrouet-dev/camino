/**
 * Marques imprimées sur certaines tuiles (variantes) : la faille grise qui
 * coupe une tuile en deux, et le trèfle qui rapporte ou coûte selon qu'il se
 * trouve ou non dans un chemin qui marque.
 *
 * Ces deux dessins servent aussi bien sur le plateau que dans la pioche : ils
 * ne connaissent qu'une boîte (x, y, taille).
 */

/**
 * Tracé d'une faille : une fêlure en zigzag qui s'élargit au milieu de la
 * tuile, plutôt qu'un simple trait.
 */
export function faultPath(x: number, y: number, size: number, axis: 0 | 1): string {
  const STEPS = 6
  const zig = [0, 0.06, -0.05, 0.05, -0.06, 0.03, 0]
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    // la fêlure est fine aux extrémités, plus large au centre
    const half = (0.02 + 0.055 * Math.sin(Math.PI * t)) * size
    const drift = zig[i] * size
    if (axis === 0) {
      const cx = x + size / 2 + drift
      const py = y + t * size
      left.push(`${(cx - half).toFixed(1)} ${py.toFixed(1)}`)
      right.unshift(`${(cx + half).toFixed(1)} ${py.toFixed(1)}`)
    } else {
      const cy = y + size / 2 + drift
      const px = x + t * size
      left.push(`${px.toFixed(1)} ${(cy - half).toFixed(1)}`)
      right.unshift(`${px.toFixed(1)} ${(cy + half).toFixed(1)}`)
    }
  }
  return `M${left.concat(right).join('L')}Z`
}

/** Faille grise sur une tuile posée. */
export function FaultMark({
  x,
  y,
  size,
  axis,
}: {
  x: number
  y: number
  size: number
  axis: 0 | 1
}) {
  const d = faultPath(x, y, size, axis)
  return (
    <g pointerEvents="none">
      <path d={d} fill="#5F6367" opacity="0.92" />
      <path d={d} fill="none" stroke="#E7EAEC" strokeWidth={size * 0.022} opacity="0.75" />
    </g>
  )
}

/**
 * Trèfle à quatre feuilles, centré dans un quart de tuile. Vert quand il se
 * trouve dans un chemin qui marque (+3), rouge sinon (−3) ; neutre hors partie.
 */
export function CloverMark({
  cx,
  cy,
  size,
  state = 'neutral',
}: {
  cx: number
  cy: number
  /** Diamètre visé du trèfle. */
  size: number
  state?: 'scoring' | 'lost' | 'neutral'
}) {
  const r = size * 0.24
  const d = size * 0.23
  const fill = state === 'scoring' ? '#2F8F3C' : state === 'lost' ? '#CF3A33' : '#3E8E4A'
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={size * 0.52} fill="#FFFFFF" opacity="0.9" />
      {[
        [0, -d],
        [d, 0],
        [0, d],
        [-d, 0],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={cx + dx} cy={cy + dy} r={r} fill={fill} />
      ))}
      <circle cx={cx} cy={cy} r={size * 0.09} fill="#FFFFFF" opacity="0.85" />
    </g>
  )
}

/**
 * Cristal (variante) : une gemme taillée au centre de la tuile. Brillante tant
 * qu'aucune tuile n'est venue se coller après la pose ; brisée sinon.
 */
export function CrystalMark({
  cx,
  cy,
  size,
  intact = true,
}: {
  cx: number
  cy: number
  size: number
  intact?: boolean
}) {
  const w = size / 2
  const h = size * 0.58
  const fill = intact ? '#9FE8FF' : '#C9C4BC'
  const edge = intact ? '#2C7FB8' : '#8A857D'
  // losange taillé : pointe en bas, table plate en haut
  const pts = [
    [cx - w, cy - h * 0.25],
    [cx - w * 0.5, cy - h],
    [cx + w * 0.5, cy - h],
    [cx + w, cy - h * 0.25],
    [cx, cy + h],
  ]
    .map((p) => p.join(','))
    .join(' ')
  return (
    <g pointerEvents="none" opacity={intact ? 1 : 0.82}>
      <polygon points={pts} fill={fill} stroke="#FFFFFF" strokeWidth="2.6" />
      <polygon points={pts} fill="none" stroke={edge} strokeWidth="1.1" />
      {/* facettes */}
      <path
        d={`M ${cx - w} ${cy - h * 0.25} L ${cx + w} ${cy - h * 0.25} M ${cx - w * 0.5} ${cy - h} L ${cx - w * 0.25} ${cy - h * 0.25} L ${cx} ${cy + h} M ${cx + w * 0.5} ${cy - h} L ${cx + w * 0.25} ${cy - h * 0.25}`}
        stroke={edge}
        strokeWidth="0.9"
        fill="none"
        opacity="0.7"
      />
      {intact ? (
        <circle cx={cx - w * 0.35} cy={cy - h * 0.6} r={size * 0.07} fill="#FFFFFF" opacity="0.95" />
      ) : (
        // la cassure : un éclair sombre en travers de la gemme
        <path
          d={`M ${cx - w * 0.55} ${cy - h * 0.7} L ${cx - w * 0.1} ${cy - h * 0.1} L ${cx - w * 0.35} ${cy + h * 0.15} L ${cx + w * 0.2} ${cy + h * 0.75}`}
          stroke="#5A554D"
          strokeWidth="1.6"
          fill="none"
        />
      )}
    </g>
  )
}

/**
 * Teinture (variante) : une goutte de pigment. Posée adjacente à une zone
 * noire, la zone prend cette couleur.
 */
export function DyeMark({
  cx,
  cy,
  size,
  color,
}: {
  cx: number
  cy: number
  size: number
  color: string
}) {
  const r = size / 2
  // goutte : pointe en haut, panse ronde en bas
  const d = `M ${cx} ${cy - r * 1.15}
    C ${cx + r * 0.9} ${cy - r * 0.15} ${cx + r * 0.85} ${cy + r * 0.35} ${cx + r * 0.55} ${cy + r * 0.7}
    A ${r * 0.78} ${r * 0.78} 0 1 1 ${cx - r * 0.55} ${cy + r * 0.7}
    C ${cx - r * 0.85} ${cy + r * 0.35} ${cx - r * 0.9} ${cy - r * 0.15} ${cx} ${cy - r * 1.15} Z`
  return (
    <g pointerEvents="none">
      <path d={d} fill={color} stroke="#FFFFFF" strokeWidth="2.4" />
      <path d={d} fill="none" stroke="#00000033" strokeWidth="1" />
      <circle cx={cx - r * 0.28} cy={cy + r * 0.12} r={r * 0.22} fill="#FFFFFF" opacity="0.75" />
    </g>
  )
}

/** Moulin (variante) : à la pose, les voisines tournent d'un quart vers la gauche. */
export function WindmillMark({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const r = size / 2
  // quatre pales en virgule, sens antihoraire
  const pale = `M 0 0 L ${r} ${-r * 0.28} A ${r * 0.55} ${r * 0.55} 0 0 0 ${r * 0.28} ${-r} Z`
  return (
    <g pointerEvents="none">
      {[0, 90, 180, 270].map((a) => (
        <path
          key={a}
          d={pale}
          transform={`translate(${cx} ${cy}) rotate(${a})`}
          fill="#F4F1EA"
          stroke="#6B655C"
          strokeWidth="1.2"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.2} fill="#6B655C" stroke="#FFFFFF" strokeWidth="1.4" />
    </g>
  )
}
