import { BLACK, COLOR_HEX, COLOR_NAMES, PATH_COLORS, signed } from '../../engine/index.ts'
import type { ScoreBreakdown } from '../../engine/index.ts'

interface Props {
  breakdown: ScoreBreakdown
  /** Masque le détail et ne garde que le total. */
  dense?: boolean
}

export function ScoreDetail({ breakdown, dense = false }: Props) {
  const max = Math.max(
    10,
    ...PATH_COLORS.map((c) => Math.abs(breakdown.byColor[c].points)),
  )
  // Le panneau ne montre que ce qui compte déjà : les couleurs apparaissent au
  // fur et à mesure qu'elles marquent, plutôt qu'une liste de tirets. Une
  // couleur interdite (variante) apparaît de la même façon, en négatif.
  const scoring = PATH_COLORS.filter((c) => breakdown.byColor[c].points !== 0)
  const forbidden = breakdown.forbidden ?? []
  const rien =
    scoring.length === 0 &&
    breakdown.blackZones === 0 &&
    breakdown.starPoints === 0 &&
    breakdown.cloverPoints === 0 &&
    breakdown.secretPoints === 0 &&
    !breakdown.cardLabel
  return (
    <div>
      {!dense && rien && <p className="note" style={{ margin: '2px 0 8px' }}>Aucun point pour l’instant.</p>}

      {!dense &&
        scoring.map((c) => {
          const s = breakdown.byColor[c]
          const zones = s.scoringZones
          const banni = forbidden.includes(c)
          return (
            <div
              className="score-line"
              key={c}
              title={
                banni
                  ? `Couleur interdite — ${zones.length} zone${zones.length > 1 ? 's' : ''}`
                  : detail(zones.map((z) => z.span))
              }
            >
              <span className={`swatch ${banni ? 'banned' : ''}`} style={{ background: COLOR_HEX[c] }} />
              <span className="bar">
                <i
                  style={{
                    width: `${(Math.abs(s.points) / max) * 100}%`,
                    background: COLOR_HEX[c],
                    opacity: banni ? 0.55 : 1,
                  }}
                />
              </span>
              <span className={`val ${s.points < 0 ? 'neg' : 'pos'}`}>
                {s.points} pts
              </span>
            </div>
          )
        })}

      {!dense && breakdown.blackZones > 0 && (
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
          <span
            className={`val ${
              breakdown.blackPoints < 0 ? 'neg' : breakdown.blackPoints > 0 ? 'pos' : ''
            }`}
          >
            {signed(breakdown.blackPoints)} pts
          </span>
        </div>
      )}

      {!dense && breakdown.starPoints !== 0 && (
        <div className="score-line" title="Étoiles magiques reliées">
          <span className="swatch mission" style={{ background: '#FFD23F' }}>
            ★
          </span>
          <span className="bar">
            <i style={{ width: '100%', background: '#FFD23F' }} />
          </span>
          <span className="val pos">+{breakdown.starPoints}</span>
        </div>
      )}

      {!dense && breakdown.cloverPoints !== 0 && (
        <div className="score-line" title="Trèfles : +3 dans un chemin qui marque, −3 sinon">
          <span className="swatch mission" style={{ background: '#3E8E4A' }}>
            ☘
          </span>
          <span className="bar">
            <i style={{ width: '100%', background: '#3E8E4A' }} />
          </span>
          <span className={`val ${breakdown.cloverPoints > 0 ? 'pos' : 'neg'}`}>
            {signed(breakdown.cloverPoints)}
          </span>
        </div>
      )}

      {!dense && breakdown.secretPoints > 0 && (
        <div className="score-line" title="Couleur secrète : meilleur chemin doublé">
          <span className="swatch mission" style={{ background: '#8E6BB5' }}>
            ?
          </span>
          <span className="bar">
            <i style={{ width: '100%', background: '#8E6BB5' }} />
          </span>
          <span className="val pos">+{breakdown.secretPoints}</span>
        </div>
      )}

      {!dense && breakdown.cardLabel && (
        <div className="score-line" title={`Carte mission — ${breakdown.cardLabel}`}>
          <span className="swatch mission" style={{ background: '#F9B515' }}>
            ★
          </span>
          <span className="bar">
            <i
              style={{
                width: breakdown.cardPoints > 0 ? '100%' : '0%',
                background: '#F9B515',
              }}
            />
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
