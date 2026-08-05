import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyMove,
  availableTiles,
  bestMove,
  cardById,
  currentLegalCells,
  currentPlayerId,
  isBot,
  scorePlayer,
  topMoves,
} from '../../engine/index.ts'
import type { GameState, Rotation } from '../../engine/index.ts'
import { BoardView } from '../components/BoardView.tsx'
import { TileGlyph } from '../components/TileGlyph.tsx'
import { ScoreDetail } from '../components/ScoreDetail.tsx'
import { ScoreLines } from '../components/Charts.tsx'

interface Props {
  history: GameState[]
  onHistory: (updater: (h: GameState[]) => GameState[]) => void
  onFinish: () => void
  onQuit: () => void
}

const BOT_DELAY = 420

export function GameScreen({ history, onHistory, onFinish, onQuit }: Props) {
  const state = history[history.length - 1]
  const { options } = state
  const activeId = currentPlayerId(state)
  const active = state.players[activeId]

  const [selected, setSelected] = useState<number | null>(null)
  const [rot, setRot] = useState<Rotation>(0)
  const [spin, setSpin] = useState(0)
  const [pinned, setPinned] = useState<number | null>(null)
  const viewId = pinned ?? activeId
  const viewed = state.players[viewId]

  const pool = state.pool
  const free = useMemo(() => availableTiles(state), [state])
  const legal = useMemo(() => currentLegalCells(state), [state])

  const breakdowns = useMemo(
    () => state.players.map((p) => scorePlayer(p, options)),
    [state.players, options],
  )

  const lastPlaced = useMemo(() => {
    for (let i = state.log.length - 1; i >= 0; i--) {
      if (state.log[i].playerId === viewId) return state.log[i].cell
    }
    return null
  }, [state.log, viewId])

  const hint = useMemo(() => {
    if (!options.showHints || isBot(active) || state.phase !== 'playing') return null
    const best = topMoves(state, 1)[0]
    return best ? { cell: best.cell, rot: best.rot, tileId: best.tileId, score: best.score } : null
  }, [options.showHints, active, state])

  // Sélection : on présélectionne quand il ne reste qu'une tuile (dernier joueur).
  useEffect(() => {
    if (state.phase !== 'playing') return
    setSelected((cur) => {
      if (cur !== null && free.some((t) => t.tileId === cur)) return cur
      return free.length === 1 ? free[0].tileId : null
    })
  }, [free, state.phase])

  useEffect(() => {
    setRot(0)
    setSpin(0)
  }, [activeId, state.round])

  useEffect(() => {
    if (state.phase === 'finished') onFinish()
  }, [state.phase, onFinish])

  const play = useCallback(
    (cell: number) => {
      if (selected === null) return
      onHistory((h) => [...h, applyMove(h[h.length - 1], { tileId: selected, cell, rot })])
      setSelected(null)
    },
    [selected, rot, onHistory],
  )

  // Tour des bots.
  const botTimer = useRef<number | null>(null)
  useEffect(() => {
    if (state.phase !== 'playing' || !isBot(active)) return
    botTimer.current = window.setTimeout(() => {
      const move = bestMove(state, active.kind)
      if (move) onHistory((h) => [...h, applyMove(h[h.length - 1], move)])
    }, BOT_DELAY)
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current)
    }
  }, [state, active, onHistory])

  const rotate = useCallback((dir: 1 | -1) => {
    setRot((r) => ((((r + dir) % 4) + 4) % 4) as Rotation)
    setSpin((s) => s + dir * 90)
  }, [])

  const undo = useCallback(
    () => onHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)),
    [onHistory],
  )

  // Raccourcis clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1)
      else if (e.key === 'Escape') setSelected(null)
      else if (e.key >= '1' && e.key <= '9') {
        const t = pool[Number(e.key) - 1]
        if (t && t.takenBy === null) setSelected(t.tileId)
      } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pool, rotate, undo])

  // Molette au-dessus du plateau = rotation (sans faire défiler la page).
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (selected === null) return
      e.preventDefault()
      rotate(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [selected, rotate])

  const humanTurn = !isBot(active) && state.phase === 'playing'
  const canPlaceHere = humanTurn && viewId === activeId && selected !== null

  return (
    <div className="table">
      {/* ------------------------------------------------ colonne joueurs */}
      <div className="col-left">
        {state.players.map((p, i) => (
          <button
            key={p.id}
            className={`player-card ${viewId === p.id ? 'viewing' : ''} ${
              activeId === p.id && state.phase === 'playing' ? 'active' : ''
            }`}
            onClick={() => setPinned(pinned === p.id ? null : p.id)}
          >
            <div className="head">
              <span className="name">
                <span className="dot" style={{ background: p.color }} />
                {p.name}
                {isBot(p) && <span className="tag">bot</span>}
              </span>
              {options.liveScore && <span className="score-big">{breakdowns[i].total}</span>}
            </div>
            <div className="mini-board">
              <BoardView
                board={p.board}
                ruleset={options.ruleset}
                compact
                showZones={false}
                showGrid
              />
            </div>
            {state.bagHolder === p.id && state.phase === 'playing' && (
              <span className="note">🎒 a le sac ce tour-ci</span>
            )}
          </button>
        ))}
      </div>

      {/* --------------------------------------------------- table de jeu */}
      <div className="stage" ref={stageRef}>
        <div className="turn-banner">
          <span className="dot" style={{ background: active.color }} />
          <span className="who">{active.name}</span>
          <span style={{ color: 'var(--ink-dim)' }}>
            {state.phase === 'finished'
              ? '— partie terminée'
              : isBot(active)
                ? '— réfléchit…'
                : selected === null
                  ? '— choisis une tuile au centre'
                  : '— place ta tuile sur ton plateau'}
          </span>
        </div>

        {/* centre de la table */}
        <div className="pool">
          {pool.map((t, i) => {
            const taken = t.takenBy !== null
            const owner = taken ? state.players[t.takenBy as number] : null
            return (
              <button
                key={t.tileId}
                className={`pool-tile ${selected === t.tileId ? 'selected' : ''} ${
                  taken ? 'taken' : ''
                }`}
                disabled={taken || !humanTurn}
                onClick={() => setSelected(t.tileId)}
                title={taken ? `Prise par ${owner?.name}` : `Choisir cette tuile (${i + 1})`}
              >
                <span className="frame">
                  <TileGlyph
                    tileId={t.tileId}
                    angle={selected === t.tileId ? spin : 0}
                    size={selected === t.tileId ? 78 : 66}
                  />
                </span>
                <small>{taken ? (owner?.name ?? '—') : `touche ${i + 1}`}</small>
              </button>
            )
          })}
          {pool.length === 0 && <span className="note">Plus de tuiles au centre.</span>}
        </div>

        {/* commandes de pose */}
        {humanTurn && (
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <button className="btn icon" onClick={() => rotate(-1)} title="Rotation anti-horaire">
              ↺
            </button>
            <button className="btn icon" onClick={() => rotate(1)} title="Rotation horaire (R)">
              ↻
            </button>
            <span className="note">
              <span className="kbd">R</span> tourner · <span className="kbd">1-9</span> choisir ·
              molette sur le plateau · <span className="kbd">Échap</span> annuler
            </span>
          </div>
        )}

        {hint && (
          <div className="hint-box">
            💡 Meilleur coup trouvé : tuile n°{hint.tileId + 1} en case {hint.cell + 1} (rotation{' '}
            {hint.rot * 90}°) — score {hint.score} pts.
          </div>
        )}

        <div className="board-caption">
          <span className="who">
            <span className="dot" style={{ background: viewed.color }} />
            Plateau de {viewed.name}
            {viewId !== activeId && <span className="tag">lecture seule</span>}
          </span>
          <span className="tag">
            Manche <strong>{Math.min(state.round + 1, state.totalRounds)}</strong> / {state.totalRounds}
          </span>
        </div>

        <div className="board-wrap">
          <BoardView
            board={viewed.board}
            ruleset={options.ruleset}
            showZones={options.showZones}
            interactive={canPlaceHere}
            legal={viewId === activeId ? legal : []}
            ghost={canPlaceHere && selected !== null ? { tileId: selected, rot } : null}
            hint={hint && viewId === activeId ? { cell: hint.cell, rot: hint.rot } : null}
            lastPlaced={lastPlaced}
            onPlace={play}
          />
        </div>

        {pinned !== null && pinned !== activeId && (
          <button className="btn small" onClick={() => setPinned(null)}>
            ↩ Revenir au plateau de {active.name}
          </button>
        )}
      </div>

      {/* ------------------------------------------------ colonne détails */}
      <div className="col-right">
        <div className="panel">
          <h3>Score de {viewed.name}</h3>
          {options.liveScore ? (
            <ScoreDetail breakdown={breakdowns[viewId]} />
          ) : (
            <p className="note">
              Le score en direct est désactivé. Active-le dans la barre du haut pour suivre le
              décompte pendant la partie.
            </p>
          )}
          {options.useCards && viewed.cardId && (
            <div className="card-mission" style={{ marginTop: 10 }}>
              <div className="t">{cardById(viewed.cardId)?.name}</div>
              <div className="note">{cardById(viewed.cardId)?.description}</div>
            </div>
          )}
        </div>

        {options.liveScore && state.scoreHistory[0].length > 1 && (
          <div className="panel">
            <h3>Évolution des scores</h3>
            <ScoreLines
              length={state.totalRounds}
              series={state.players.map((p, i) => ({
                label: p.name,
                color: p.color,
                values: state.scoreHistory[i],
              }))}
            />
          </div>
        )}

        <div className="panel">
          <h3>Journal</h3>
          <div className="log">
            {state.log
              .slice(-40)
              .map((l, i) => (
                <div key={i}>
                  <b>{state.players[l.playerId].name}</b> pose la tuile {l.tileId + 1} (case{' '}
                  {l.cell + 1}){' '}
                  <span className={`delta ${l.delta > 0 ? 'pos' : l.delta < 0 ? 'neg' : ''}`}>
                    {l.delta > 0 ? `+${l.delta}` : l.delta}
                  </span>
                </div>
              ))}
            {state.log.length === 0 && <div className="note">La partie commence…</div>}
          </div>
        </div>

        <div className="row wrap">
          <button className="btn small" onClick={undo} disabled={history.length <= 1}>
            ↶ Annuler
          </button>
          <button className="btn small ghost" onClick={onQuit}>
            Quitter
          </button>
          <span className="note">
            Sac : {state.bag.length} tuile{state.bag.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
