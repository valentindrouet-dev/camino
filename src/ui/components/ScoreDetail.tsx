import { BLACK, COLOR_HEX, COLOR_NAMES, PATH_COLORS } from '../../engine/index.ts'
import type { ScoreBreakdown } from '../../engine/index.ts'

interface Props {
  breakdown: ScoreBreakdown
  /** Masque le détail et ne garde que le total. */
  dense?: boolean
}

export function ScoreDetail({ breakdown, dense = false }: Props) {
  const max = Math.max(
    10,
    ...PATH_COLORS.map((c) => breakdown.byColor[c].points),
  )
  return (
    <div>
      {!dense &&
        PATH_COLORS.map((c) => {
          const s = breakdown.byColor[c]
          const zones = s.scoringZones
          return (
            <div className="score-line" key={c} title={detail(zones.map((z) => z.span))}>
              <span className="swatch" style={{ background: COLOR_HEX[c] }} />
              <span className="bar">
                <i
                  style={{
                    width: `${(s.points / max) * 100}%`,
                    background: COLOR_HEX[c],
                  }}
                />
              </span>
              <span className={`val ${s.points > 0 ? 'pos' : ''}`}>
                {s.points > 0 ? `${s.points} pts` : '—'}
              </span>
            </div>
          )
        })}

      {!dense && (
        <div className="score-line" title={`${breakdown.blackZones} zone(s) noire(s)`}>
          <span className="swatch" style={{ background: COLOR_HEX[BLACK] }} />
          <span className="bar">
            <i
              style={{
                width: `${Math.min(100, (breakdown.blackZones / 8) * 100)}%`,
                background: '#6a6a6a',
              }}
            />
          </span>
          <span className={`val ${breakdown.blackPoints < 0 ? 'neg' : ''}`}>
            {breakdown.blackPoints !== 0 ? `${breakdown.blackPoints} pts` : '—'}
          </span>
        </div>
      )}

      {!dense && breakdown.cardLabel && (
        <div className="score-line" title={breakdown.cardLabel}>
          <span className="swatch" style={{ background: '#8b6ad6' }} />
          <span className="bar">
            <i style={{ width: '100%', background: '#8b6ad6', opacity: 0.4 }} />
          </span>
          <span className={`val ${breakdown.cardPoints > 0 ? 'pos' : ''}`}>
            {breakdown.cardPoints > 0 ? `+${breakdown.cardPoints}` : '—'}
          </span>
        </div>
      )}

      <div className="total-line">
        <span style={{ color: 'var(--ink-dim)', fontSize: 13 }}>Total</span>
        <span className="n">{breakdown.total}</span>
      </div>
    </div>
  )
}

function detail(spans: number[]): string {
  if (!spans.length) return 'aucun chemin qui marque'
  return spans.map((s) => `${s} tuiles`).join(' + ')
}

export function colorLegend() {
  return PATH_COLORS.map((c) => COLOR_NAMES[c]).join(', ')
}
