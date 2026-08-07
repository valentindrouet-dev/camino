import { useMemo, useState } from 'react'
import {
  BOARD_COLOR_HEX,
  cardById,
  COLOR_HEX,
  COLOR_NAMES,
  PATH_COLORS,
} from '../../engine/index.ts'
import type { Color } from '../../engine/index.ts'
import { BoardView } from '../components/BoardView.tsx'
import { MissionCardView } from '../components/MissionCard.tsx'
import { GameReport } from '../components/GameReport.tsx'
import {
  deleteArchivedGame,
  exportArchiveCsv,
  loadArchive,
  saveGameReport,
  type ArchivedGame,
} from '../storage.ts'

interface Props {
  onBack: () => void
}

/** Historique des parties jouées sur cette machine, avec les plateaux finaux. */
export function HistoryScreen({ onBack }: Props) {
  const [archive, setArchive] = useState<ArchivedGame[]>(() => loadArchive())
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'parties' | 'rapports'>('parties')

  const games = useMemo(() => archive.slice().reverse(), [archive])
  /** Parties qui portent un rapport, de la plus récente à la plus ancienne. */
  const reports = useMemo(
    () => games.filter((g) => (g.report ?? '').trim().length > 0),
    [games],
  )

  const download = () => {
    const blob = new Blob([exportArchiveCsv(archive)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'camino-parties.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="sheet">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 24 }}>Historique des parties</h2>
        <div className="row wrap">
          {archive.length > 0 && (
            <button className="btn small" onClick={download}>
              Exporter en CSV
            </button>
          )}
          <button className="btn small" onClick={onBack}>
            ← Retour
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === 'parties' ? 'on' : ''} onClick={() => setTab('parties')}>
          Parties ({archive.length})
        </button>
        <button className={tab === 'rapports' ? 'on' : ''} onClick={() => setTab('rapports')}>
          Rapports de partie ({reports.length})
        </button>
      </div>

      {tab === 'rapports' && (
        <div className="stack">
          {!reports.length && (
            <div className="panel">
              <p className="note">
                Aucun rapport pour l’instant. À la fin d’une partie, le champ « Rapport de fin de
                partie » vous permet de noter vos remarques : elles s’affichent ici, avec la partie
                à laquelle elles se rapportent.
              </p>
            </div>
          )}
          {reports.map((g) => (
            <div key={g.id} className="panel report-card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>
                  {new Date(g.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {' · '}
                  {new Date(g.date).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
                <button
                  className="btn small ghost"
                  onClick={() => {
                    setTab('parties')
                    setOpenId(g.id)
                  }}
                >
                  Voir la partie →
                </button>
              </div>
              <div className="note">
                {g.results
                  .slice()
                  .sort((a, b) => a.rank - b.rank)
                  .map((r) => `${r.rank === 1 ? '🏆 ' : ''}${r.name} ${r.total}`)
                  .join(' · ')}
                {' · '}
                {g.playerCount} joueur{g.playerCount > 1 ? 's' : ''} · graine {g.seed}
              </div>
              <p>{g.report}</p>
              <button
                className="btn small ghost"
                style={{ marginTop: 8 }}
                onClick={() => {
                  if (confirm('Effacer ce rapport ?')) setArchive(saveGameReport(g.id, ''))
                }}
              >
                Effacer le rapport
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'parties' && !archive.length && (
        <div className="panel">
          <p className="note">
            Aucune partie enregistrée pour l’instant. Chaque partie terminée sur cette machine est
            archivée automatiquement : vous la retrouverez ici, plateaux compris.
          </p>
        </div>
      )}

      <div className="stack" style={{ display: tab === 'parties' ? undefined : 'none' }}>
        {games.map((g) => {
          const isOpen = openId === g.id
          return (
            <div key={g.id} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <button className="history-row" onClick={() => setOpenId(isOpen ? null : g.id)}>
                <span className="when">
                  {new Date(g.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  <em>
                    {new Date(g.date).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </em>
                </span>
                <span className="who">
                  {g.results
                    .slice()
                    .sort((a, b) => a.rank - b.rank)
                    .map((r) => (
                      <span key={r.seat} className="tag" style={{ marginRight: 4 }}>
                        {r.rank === 1 ? '🏆 ' : ''}
                        {r.name} · <strong>{r.total}</strong>
                      </span>
                    ))}
                </span>
                <span className="meta note">
                  {g.playerCount} joueur{g.playerCount > 1 ? 's' : ''} · {g.boardSize}×{g.boardSize}
                  {g.cardId ? ' · carte mission' : ''} · graine {g.seed}
                </span>
                <span className="note">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="history-detail">
                  {g.cardId && cardById(g.cardId) && (
                    <div style={{ maxWidth: 420, marginBottom: 12 }}>
                      <MissionCardView card={cardById(g.cardId)!} compact />
                    </div>
                  )}
                  <div className="history-boards">
                    {g.results
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((r) => {
                        const board = g.boards?.find((b) => b.name === r.name)
                        return (
                          <figure key={r.seat}>
                            {board ? (
                              <BoardView
                                board={board.board}
                                ruleset={g.ruleset}
                                frameColor={BOARD_COLOR_HEX[board.boardColor] ?? '#F7931D'}
                                showZones
                                forbidden={board.forbidden}
                              />
                            ) : (
                              <p className="note">
                                Plateau non enregistré (partie jouée avec une ancienne version).
                              </p>
                            )}
                            <figcaption>
                              <strong>
                                {r.rank === 1 ? '🏆 ' : `${r.rank}. `}
                                {r.name}
                              </strong>{' '}
                              — {r.total} pts
                              <span className="note" style={{ display: 'block' }}>
                                {PATH_COLORS.filter((c) => (r.byColor[c] ?? 0) > 0)
                                  .map((c) => `${COLOR_NAMES[c as Color]} ${r.byColor[c]}`)
                                  .join(' · ') || 'aucune couleur qui marque'}
                                {r.blackPoints ? ` · noir ${r.blackPoints}` : ''}
                              </span>
                            </figcaption>
                          </figure>
                        )
                      })}
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <span className="row" style={{ gap: 6 }}>
                      {PATH_COLORS.map((c) => (
                        <span
                          key={c}
                          className="swatch"
                          title={COLOR_NAMES[c as Color]}
                          style={{ background: COLOR_HEX[c as Color] }}
                        />
                      ))}
                    </span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <button
                      className="btn small ghost"
                      onClick={() => {
                        if (confirm('Supprimer cette partie de l’historique ?')) {
                          setArchive(deleteArchivedGame(g.id))
                          setOpenId(null)
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                  <GameReport
                    gameId={g.id}
                    onSaved={(all) => setArchive(all)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tab === 'parties' && archive.length > 0 && (
        <p className="note" style={{ marginTop: 14 }}>
          {archive.length} partie{archive.length > 1 ? 's' : ''} enregistrée
          {archive.length > 1 ? 's' : ''} sur cette machine. Les statistiques cumulées (moyennes,
          poids des couleurs…) sont dans le Laboratoire, onglet « Parties jouées ».
        </p>
      )}
    </div>
  )
}
