/** Petits graphiques SVG maison — aucune dépendance externe. */

interface SparkProps {
  series: { label: string; color: string; values: number[] }[]
  height?: number
  /** Nombre total de points en abscisse (manches). */
  length?: number
}

export function ScoreLines({ series, height = 130, length }: SparkProps) {
  const n = Math.max(2, length ?? Math.max(...series.map((s) => s.values.length), 2))
  const all = series.flatMap((s) => s.values)
  const min = Math.min(0, ...all)
  const max = Math.max(10, ...all)
  const W = 320
  const H = height
  const px = (i: number) => (i / (n - 1)) * (W - 30) + 26
  const py = (v: number) => H - 18 - ((v - min) / (max - min || 1)) * (H - 30)

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <line x1="26" x2={W} y1={py(v)} y2={py(v)} stroke="#ffffff14" strokeWidth="1" />
          <text x="2" y={py(v) + 4} fontSize="9" fill="#6f6459">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.label}>
          <polyline
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.values.map((v, i) => `${px(i)},${py(v)}`).join(' ')}
          />
          {s.values.length > 0 && (
            <circle
              cx={px(s.values.length - 1)}
              cy={py(s.values[s.values.length - 1])}
              r="2.8"
              fill={s.color}
            />
          )}
        </g>
      ))}
    </svg>
  )
}

interface HistoProps {
  buckets: { x: number; n: number }[]
  color?: string
  suffix?: string
}

export function Histogram({ buckets, color = '#F7931D', suffix = '' }: HistoProps) {
  const W = 340
  const H = 140
  const max = Math.max(1, ...buckets.map((b) => b.n))
  const bw = (W - 24) / Math.max(1, buckets.length)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {buckets.map((b, i) => {
        const h = (b.n / max) * (H - 34)
        return (
          <g key={i}>
            <title>{`${b.x}${suffix} : ${b.n}`}</title>
            <rect
              x={20 + i * bw + 1}
              y={H - 20 - h}
              width={Math.max(1, bw - 2)}
              height={h}
              fill={color}
              opacity="0.85"
              rx="2"
            />
            {i % Math.ceil(buckets.length / 8) === 0 && (
              <text
                x={20 + i * bw + bw / 2}
                y={H - 7}
                fontSize="9"
                fill="#6f6459"
                textAnchor="middle"
              >
                {b.x}
              </text>
            )}
          </g>
        )
      })}
      <line x1="18" x2={W - 2} y1={H - 20} y2={H - 20} stroke="#ffffff22" />
    </svg>
  )
}

interface BarsProps {
  items: { label: string; value: number; color?: string }[]
  format?: (v: number) => string
}

export function Bars({ items, format = (v) => v.toFixed(1) }: BarsProps) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)))
  return (
    <div>
      {items.map((it) => (
        <div className="score-line" key={it.label} style={{ gridTemplateColumns: '76px 1fr auto' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{it.label}</span>
          <span className="bar">
            <i
              style={{
                width: `${(Math.abs(it.value) / max) * 100}%`,
                background: it.color ?? 'var(--accent)',
              }}
            />
          </span>
          <span className="val pos">{format(it.value)}</span>
        </div>
      ))}
    </div>
  )
}
