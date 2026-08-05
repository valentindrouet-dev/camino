import { BUILD, RELEASES, VERSION } from '../../version.ts'

interface Props {
  onBack: () => void
}

/** Historique des versions : une ligne par changement, la plus récente en tête. */
export function VersionsScreen({ onBack }: Props) {
  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Historique des versions</h2>
        <button className="btn small" onClick={onBack}>
          ← Retour
        </button>
      </div>

      <p className="note" style={{ marginBottom: 16 }}>
        Version actuelle <strong>{VERSION}</strong> — compilée le {BUILD}.
      </p>

      <div className="stack">
        {RELEASES.map((r, i) => (
          <div className={`panel release ${i === 0 ? 'current' : ''}`} key={r.version}>
            <div className="release-head">
              <span className="release-version">{r.version}</span>
              <span className="note">{formatDate(r.date)}</span>
              {i === 0 && <span className="tag">version actuelle</span>}
            </div>
            <ul className="release-list">
              {r.changes.map((c, k) => (
                <li key={k}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
