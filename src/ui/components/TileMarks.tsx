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
