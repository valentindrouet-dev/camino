import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  applyMove,
  availableTiles,
  bestMove,
  currentLegalCells,
  currentPlayerId,
  botWantsRedraw,
  cardResults,
  canFlipTile,
  canRedrawLastTile,
  botWantsFlip,
  flipTile,
  isBot,
  redrawLastTile,
  COLOR_NAMES,
  COLOR_TILE_IDS,
  REVERSED_BASE,
  rulesetForPlayer,
  swapRound,
  scoreAll,
  signed,
  topMoves,
} from '../../engine/index.ts'
import type { GameState, Rotation } from '../../engine/index.ts'
import type { Action } from '../../net/salon.ts'
import { BoardView } from '../components/BoardView.tsx'
import { TileGlyph } from '../components/TileGlyph.tsx'
import { ScoreDetail } from '../components/ScoreDetail.tsx'
import { ScoreLines } from '../components/Charts.tsx'
import { MissionCardView } from '../components/MissionCard.tsx'
import { activeVariantInfos } from '../variantInfo.ts'
import { TileGlyph as ColorTile } from '../components/TileGlyph.tsx'

/** Ce qui change quand la partie se joue en ligne plutôt qu'autour d'une table. */
export interface JeuEnLigne {
  /** Mon siège : le seul joueur dont je commande les gestes. */
  monSiege: number
  salonNom: string
  /** Publier une action : c'est le journal partagé qui fait avancer la partie. */
  jouer: (action: Action) => void
}

interface Props {
  history: GameState[]
  onHistory: (updater: (h: GameState[]) => GameState[]) => void
  onFinish: () => void
  onQuit: () => void
  online?: JeuEnLigne
}

const BOT_DELAY = 520
/** Écran partagé : bornes de la taille d'un plateau, et hauteur de son décor. */
const BOARD_MAX = 500
const BOARD_MIN = 170
/** En-tête du plateau + marges de sa boîte, en pixels. */
const CELL_CHROME = 50
const GRID_GAP = 12
const PAGE_PAD = 20
/** Durée du vol d'une tuile de la pioche vers le plateau d'un bot. */
const FLY_MS = 620

export function GameScreen({ history, onHistory, onFinish, onQuit, online }: Props) {
  const state = history[history.length - 1]
  const { options } = state
  const activeId = currentPlayerId(state)
  const active = state.players[activeId]

  const [selected, setSelected] = useState<number | null>(null)
  const [fromPersonal, setFromPersonal] = useState(false)
  const [rot, setRot] = useState<Rotation>(0)
  const [flipped, setFlipped] = useState(false)
  const [spin, setSpin] = useState(0)
  const [pinned, setPinned] = useState<number | null>(null)
  // Rappel des variantes : seul le nom est visible, cliquer déplie la règle.
  const [openVariant, setOpenVariant] = useState<string | null>(null)
  const activeVariants = useMemo(() => activeVariantInfos(state.options), [state.options])

  /*
   * Le plateau central reste celui du joueur humain : pendant que les bots
   * jouent, on ne fait pas défiler leurs plateaux sous ses yeux. Leur pose est
   * montrée autrement — la tuile s'envole de la pioche vers leur plateau dans
   * la colonne de gauche.
   */
  const humanIds = useMemo(
    () => state.players.filter((p) => !isBot(p)).map((p) => p.id),
    [state.players],
  )
  const [humanFocus, setHumanFocus] = useState(() => humanIds[0] ?? 0)
  useEffect(() => {
    if (!isBot(active)) setHumanFocus(active.id)
  }, [active])
  // En ligne, on regarde son propre plateau par défaut — pas celui de celui
  // qui joue : c'est le sien qu'on prépare pendant que les autres réfléchissent.
  const viewId = online
    ? (pinned ?? online.monSiege)
    : (pinned ?? (isBot(active) && humanIds.length ? humanFocus : activeId))
  const viewed = state.players[viewId] ?? state.players[0]
  /** En ligne, je ne commande que mon siège. */
  const monTour = !online || activeId === online.monSiege

  const pool = state.pool
  const free = useMemo(() => availableTiles(state), [state])
  const legal = useMemo(() => currentLegalCells(state), [state])
  const variants = state.options.ruleset.variants
  const personalAvailable =
    variants?.personalTile && active.personalTileId !== undefined && !active.personalUsed
  const redrawPossible = canRedrawLastTile(state)

  const breakdowns = useMemo(() => scoreAll(state), [state])
  // Barème en vigueur : avec la carte « zones noires positives », une zone
  // noire vaut +2 et les pastilles du plateau doivent le montrer. Une carte
  // personnelle ne vaut que pour son joueur : chacun a donc le sien.
  const rulesets = useMemo(
    () => state.players.map((p) => rulesetForPlayer(state, p.id)),
    [state],
  )
  const ruleset = rulesets[viewId]
  const missions = useMemo(() => cardResults(state, viewId), [state, viewId])

  /** Dernière case jouée par chaque joueur (option « Dernière tuile posée »). */
  const lastPlacedBy = useMemo(() => {
    const out = new Map<number, number>()
    if (!options.showLastPlaced) return out
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i]
      if (!out.has(e.playerId)) out.set(e.playerId, e.cell)
    }
    return out
  }, [state.log, options.showLastPlaced])
  const lastPlaced = lastPlacedBy.get(viewId) ?? null

  /**
   * Écran partagé : tous les plateaux au centre, la colonne de gauche s'efface.
   * Au-delà de deux plateaux, la grille se resserre pour que tout tienne.
   */
  const multi =
    Boolean(options.allBoards) && state.players.length > 1 && !variants?.sharedBoard
  const cols = state.players.length <= 2 ? 2 : state.players.length === 4 ? 2 : 3
  const rows = Math.ceil(state.players.length / cols)

  const hint = useMemo(() => {
    if (!options.showHints || isBot(active) || state.phase !== 'playing') return null
    const best = topMoves(state, 1)[0]
    return best ? { cell: best.cell, rot: best.rot, tileId: best.tileId, score: best.score } : null
  }, [options.showHints, active, state])

  /*
   * Taille des plateaux en écran partagé : elle est MESURÉE plutôt que devinée.
   * La hauteur qui reste sous la pioche dépend du nombre de tuiles révélées, de
   * la présence de l'indice, de la fenêtre… On lit donc la position réelle de
   * la grille et on partage ce qui reste entre les rangées.
   */
  const gridRef = useRef<HTMLDivElement>(null)
  const [cellMax, setCellMax] = useState(BOARD_MAX)
  useLayoutEffect(() => {
    if (!multi) return
    const mesurer = () => {
      const el = gridRef.current
      if (!el) return
      const dispo = window.innerHeight - el.getBoundingClientRect().top - PAGE_PAD
      // chaque plateau porte son en-tête et ses marges : CELL_CHROME
      const parRangee = (dispo - (rows - 1) * GRID_GAP) / rows - CELL_CHROME
      setCellMax(Math.max(BOARD_MIN, Math.min(BOARD_MAX, Math.floor(parRangee))))
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [multi, rows, state.pool.length, Boolean(hint), state.players.length])

  // Sélection : on présélectionne quand il ne reste qu'une tuile (dernier joueur).
  useEffect(() => {
    if (state.phase !== 'playing') return
    setSelected((cur) => {
      if (cur !== null && fromPersonal && personalAvailable && cur === active.personalTileId) {
        return cur
      }
      if (cur !== null && !fromPersonal && free.some((t) => t.tileId === cur)) return cur
      setFromPersonal(false)
      return free.length === 1 ? free[0].tileId : null
    })
  }, [free, state.phase, fromPersonal, personalAvailable, active.personalTileId])

  useEffect(() => {
    setRot(0)
    setFlipped(false)
    setSpin(0)
  }, [activeId, state.round])

  useEffect(() => {
    if (state.phase === 'finished') onFinish()
  }, [state.phase, onFinish])

  const play = useCallback(
    (cell: number) => {
      if (selected === null) return
      const move = {
        tileId: selected,
        cell,
        rot,
        ...(flipped ? { flipped: true } : {}),
        ...(fromPersonal ? { personal: true } : {}),
      }
      if (online) online.jouer({ k: 'coup', move })
      else onHistory((h) => [...h, applyMove(h[h.length - 1], move)])
      setSelected(null)
      setFromPersonal(false)
    },
    [selected, rot, flipped, fromPersonal, onHistory, online],
  )

  const redraw = useCallback(() => {
    if (online) online.jouer({ k: 'repioche' })
    else onHistory((h) => [...h, redrawLastTile(h[h.length - 1])])
  }, [onHistory, online])

  // Verso aléatoire : retourner la tuile sélectionnée — sans retour possible.
  const flipPossible =
    selected !== null && !fromPersonal && canFlipTile(state, selected)
  const flipSelected = useCallback(() => {
    if (selected === null) return
    if (online) {
      online.jouer({ k: 'verso', tileId: selected })
      return
    }
    onHistory((h) => {
      const cur = h[h.length - 1]
      if (!canFlipTile(cur, selected)) return h
      return [...h, flipTile(cur, selected)]
    })
  }, [selected, onHistory, online])

  // La tuile retournée doit être prise : on la sélectionne d'office.
  useEffect(() => {
    if (state.mustTakeTileId !== undefined) {
      setSelected(state.mustTakeTileId)
      setFromPersonal(false)
    }
  }, [state.mustTakeTileId])

  const flip = useCallback(() => {
    if (variants?.mirrorTiles) setFlipped((f) => !f)
  }, [variants?.mirrorTiles])

  // Tour des bots.
  const botTimer = useRef<number | null>(null)
  useEffect(() => {
    // En ligne, tous les sièges sont humains : personne ne joue à leur place.
    if (online || state.phase !== 'playing' || !isBot(active)) return
    botTimer.current = window.setTimeout(() => {
      if (canRedrawLastTile(state) && botWantsRedraw(state)) {
        onHistory((h) => [...h, redrawLastTile(h[h.length - 1])])
        return // le nouvel état relance cet effet, le bot jouera au tour suivant
      }
      // Verso aléatoire : le bot tente sa chance quand son meilleur coup perd.
      if (variants?.randomBack && active.kind === 'bot-smart') {
        const tuile = botWantsFlip(state)
        if (tuile !== null) {
          onHistory((h) => {
            const cur = h[h.length - 1]
            return canFlipTile(cur, tuile) ? [...h, flipTile(cur, tuile)] : h
          })
          return
        }
      }
      const move = bestMove(state, active.kind)
      if (move) onHistory((h) => [...h, applyMove(h[h.length - 1], move)])
    }, BOT_DELAY)
    return () => {
      if (botTimer.current) window.clearTimeout(botTimer.current)
    }
  }, [state, active, onHistory, online])

  const rotate = useCallback((dir: 1 | -1) => {
    setRot((r) => ((((r + dir) % 4) + 4) % 4) as Rotation)
    setSpin((s) => s + dir * 90)
  }, [])

  // Annuler réécrit l'histoire : impossible à plusieurs sans l'accord de tous.
  const undo = useCallback(() => {
    if (online) return
    onHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))
  }, [onHistory, online])

  // Raccourcis clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1)
      else if (e.key === 'f' || e.key === 'F') flip()
      else if (e.key === 's' || e.key === 'S') {
        if (redrawPossible && !isBot(active) && state.phase === 'playing') redraw()
      }
      else if (e.key === 'v' || e.key === 'V') {
        if (flipPossible && !isBot(active) && state.phase === 'playing') flipSelected()
      }
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
  }, [pool, rotate, undo, flip, redraw, redrawPossible, flipPossible, flipSelected, active, state.phase])

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

  /* Vol de la tuile prise par un bot, de la pioche vers son plateau. */
  const poolRefs = useRef(new Map<number, HTMLElement>())
  const cardRefs = useRef(new Map<number, HTMLElement>())
  const [fly, setFly] = useState<null | {
    key: number
    tileId: number
    from: DOMRect
    to: DOMRect
  }>(null)
  const lastLogSeen = useRef(state.log.length)

  useEffect(() => {
    const entries = state.log
    if (entries.length <= lastLogSeen.current) {
      lastLogSeen.current = entries.length // annulation : on se resynchronise
      return
    }
    lastLogSeen.current = entries.length
    const last = entries[entries.length - 1]
    if (!isBot(state.players[last.playerId])) return
    const from = poolRefs.current.get(last.tileId)?.getBoundingClientRect()
    const to = cardRefs.current.get(last.playerId)?.getBoundingClientRect()
    if (!from || !to) return
    setFly({ key: entries.length, tileId: last.tileId, from, to })
    const id = window.setTimeout(() => setFly(null), FLY_MS)
    return () => window.clearTimeout(id)
  }, [state.log, state.players])

  // Scoring inversé : le barème affiché est celui qu'on applique vraiment.
  const envers = Boolean(variants?.reverseScoring)
  const signe = envers ? -1 : 1

  /** « Tching ! » : la dernière pose sur le plateau commun, pour l'animation. */
  const flash = useMemo(() => {
    if (!variants?.sharedBoard || !state.log.length) return null
    const last = state.log[state.log.length - 1]
    // une pose qui ne rapporte ni ne coûte rien ne fait pas tching
    if (last.delta === 0) return null
    return { cell: last.cell, delta: last.delta, key: state.log.length }
  }, [variants?.sharedBoard, state.log])

  const humanTurn = !isBot(active) && state.phase === 'playing' && monTour
  const canPlaceHere = humanTurn && viewId === activeId && selected !== null

  return (
    <div className={`table ${multi ? 'multi' : ''}`}>
      {fly && (
        <FlyingTile
          key={fly.key}
          tileId={fly.tileId}
          from={fly.from}
          to={fly.to}
          showStar={Boolean(variants?.magicStars)}
        />
      )}

      {/* ------------------------------------------------ colonne joueurs */}
      {!multi && (
      <div className="col-left">
        {state.players.map((p, i) => (
          <button
            key={p.id}
            className={`player-card ${viewId === p.id ? 'viewing' : ''} ${
              activeId === p.id && state.phase === 'playing' ? 'active' : ''
            }`}
            onClick={() => setPinned(pinned === p.id ? null : p.id)}
            ref={(el) => {
              if (el) cardRefs.current.set(p.id, el)
              else cardRefs.current.delete(p.id)
            }}
          >
            <div className="head">
              <span className="name">
                <span className="dot" style={{ background: p.color }} />
                {p.name}
                {isBot(p) && <span className="tag">bot</span>}
              </span>
              {options.liveScore && <span className="score-big">{breakdowns[i].total}</span>}
            </div>
            {!variants?.sharedBoard && (
              <div className="mini-board">
                <BoardView
                  board={p.board}
                  ruleset={rulesets[i]}
                  frameColor={p.color}
                  compact
                  showZones={false}
                  forbidden={p.forbiddenColors}
                />
              </div>
            )}
            {state.bagHolder === p.id && state.phase === 'playing' && (
              <span className="note">🎒 a le sac ce tour-ci</span>
            )}
          </button>
        ))}
      </div>
      )}

      {/* --------------------------------------------------- table de jeu */}
      <div className="stage" ref={stageRef}>
        <div className={`turn-banner ${online && monTour ? 'mine' : ''}`}>
          <span className="dot" style={{ background: active.color }} />
          <span className="who">
            {online && monTour ? 'À vous de jouer' : active.name}
          </span>
          <span style={{ color: 'var(--ink-dim)' }}>
            {state.phase === 'finished'
              ? '— partie terminée'
              : online && !monTour
                ? '— à son tour de jouer…'
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
                } ${t.flipped ? 'verso' : ''}`}
                disabled={taken || !humanTurn}
                onClick={() => {
                  setSelected(t.tileId)
                  setFromPersonal(false)
                }}
                ref={(el) => {
                  if (el) poolRefs.current.set(t.tileId, el)
                  else poolRefs.current.delete(t.tileId)
                }}
                title={taken ? `Prise par ${owner?.name}` : `Choisir cette tuile (${i + 1})`}
              >
                <span className="frame">
                  <TileGlyph
                    tileId={t.tileId}
                    flipped={selected === t.tileId && !fromPersonal ? flipped : false}
                    showStar={Boolean(variants?.magicStars)}
                    showFault={Boolean(variants?.faultTiles)}
                    showClover={Boolean(variants?.clovers)}
                    showCrystal={Boolean(variants?.crystals)}
                    showDye={Boolean(variants?.dyes)}
                    showWindmill={Boolean(variants?.windmills)}
                    angle={selected === t.tileId && !fromPersonal ? spin : 0}
                    size={selected === t.tileId && !fromPersonal ? 78 : 66}
                  />
                </span>
                <small>
                  {t.flipped ? '↷ verso · ' : ''}
                  {taken ? (owner?.name ?? '—') : `touche ${i + 1}`}
                </small>
              </button>
            )
          })}
          {personalAvailable && (
            <button
              className={`pool-tile personal ${
                selected === active.personalTileId && fromPersonal ? 'selected' : ''
              }`}
              disabled={!humanTurn}
              onClick={() => {
                setSelected(active.personalTileId as number)
                setFromPersonal(true)
              }}
              title="Tuile personnelle : jouable une seule fois, à la place d’une tuile du centre"
            >
              <span className="frame">
                <TileGlyph
                  tileId={active.personalTileId as number}
                  flipped={fromPersonal ? flipped : false}
                  showStar={Boolean(variants?.magicStars)}
                  showFault={Boolean(variants?.faultTiles)}
                  showClover={Boolean(variants?.clovers)}
                  showCrystal={Boolean(variants?.crystals)}
                  showDye={Boolean(variants?.dyes)}
                  showWindmill={Boolean(variants?.windmills)}
                  angle={selected === active.personalTileId && fromPersonal ? spin : 0}
                  size={selected === active.personalTileId && fromPersonal ? 78 : 66}
                />
              </span>
              <small>tuile perso</small>
            </button>
          )}
          {pool.length === 0 && <span className="note">Plus de tuiles au centre.</span>}
        </div>

        {variants?.syncDraw && pool.length > 0 && (
          <p className="note" style={{ textAlign: 'center', margin: '-4px 0 0' }}>
            Partie synchrone : la même tuile pour tout le monde, chacun la pose sur son plateau.
          </p>
        )}

        {redrawPossible && humanTurn && (
          <button className="btn small" onClick={redraw} title="Raccourci : S">
            🎲 Refuser la tuile restante et piocher au hasard (S) — définitif
          </button>
        )}

        {flipPossible && humanTurn && (
          <button className="btn small" onClick={flipSelected} title="Raccourci : V">
            ↷ Retourner cette tuile sur son verso (V) — la nouvelle face sort du sac, sans retour
          </button>
        )}
        {state.mustTakeTileId !== undefined && humanTurn && (
          <p className="note" style={{ textAlign: 'center', margin: '-4px 0 0' }}>
            Tuile retournée : c’est elle qu’il faut poser.
          </p>
        )}

        {/* commandes de pose */}
        {humanTurn && (
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <button className="btn icon" onClick={() => rotate(-1)} title="Rotation anti-horaire">
              ↺
            </button>
            <button className="btn icon" onClick={() => rotate(1)} title="Rotation horaire (R)">
              ↻
            </button>
            {variants?.mirrorTiles && (
              <button
                className={`btn icon ${flipped ? 'primary' : ''}`}
                onClick={flip}
                title="Face miroir (F)"
              >
                ⇋
              </button>
            )}
            <span className="note">
              <span className="kbd">R</span> tourner ·{' '}
              {variants?.mirrorTiles && (
                <>
                  <span className="kbd">F</span> miroir ·{' '}
                </>
              )}
              <span className="kbd">1-9</span> choisir ·{' '}
              {redrawPossible && (
                <>
                  <span className="kbd">S</span> repiocher ·{' '}
                </>
              )}
              {flipPossible && (
                <>
                  <span className="kbd">V</span> verso ·{' '}
                </>
              )}
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

        {multi ? (
          /* écran partagé : tous les plateaux d'un coup, la taille suit le nombre */
          <div
            className="boards-grid"
            data-cols={cols}
            ref={gridRef}
            style={{ ['--cols' as string]: cols, ['--cell' as string]: `${cellMax}px` }}
          >
            {state.players.map((p, i) => {
              const sien = humanTurn && p.id === activeId && selected !== null
              return (
                <figure
                  key={p.id}
                  className={`board-cell ${p.id === activeId && state.phase === 'playing' ? 'active' : ''} ${
                    viewId === p.id ? 'viewing' : ''
                  }`}
                  ref={(el) => {
                    if (el) cardRefs.current.set(p.id, el)
                    else cardRefs.current.delete(p.id)
                  }}
                >
                  <figcaption>
                    <button
                      className="who"
                      onClick={() => setPinned(pinned === p.id ? null : p.id)}
                      title={`Voir le détail du score de ${p.name}`}
                    >
                      <span className="dot" style={{ background: p.color }} />
                      {p.name}
                      {isBot(p) && <span className="tag">bot</span>}
                    </button>
                    {state.bagHolder === p.id && state.phase === 'playing' && (
                      <span className="bag" title="A le sac ce tour-ci">
                        🎒
                      </span>
                    )}
                    {options.liveScore && <span className="score-big">{breakdowns[i].total}</span>}
                  </figcaption>
                  <BoardView
                    board={p.board}
                    ruleset={rulesets[i]}
                    frameColor={p.color}
                    showZones={options.showZones}
                    interactive={sien}
                    legal={p.id === activeId ? legal : []}
                    ghost={sien ? { tileId: selected as number, rot, flipped } : null}
                    hint={hint && p.id === activeId ? { cell: hint.cell, rot: hint.rot } : null}
                    lastPlaced={lastPlacedBy.get(p.id) ?? null}
                    onPlace={play}
                    forbidden={p.forbiddenColors}
                  />
                </figure>
              )
            })}
          </div>
        ) : (
          <>
            <div className="board-caption">
              <span className="who">
                <span className="dot" style={{ background: viewed.color }} />
                {variants?.sharedBoard ? 'Plateau commun' : `Plateau de ${viewed.name}`}
                {viewId !== activeId &&
                  (isBot(active) && pinned === null ? (
                    <span className="tag">{active.name} joue…</span>
                  ) : (
                    <span className="tag">lecture seule</span>
                  ))}
              </span>
              <span className="tag">
                Manche <strong>{Math.min(state.round + 1, state.totalRounds)}</strong> /{' '}
                {state.totalRounds}
              </span>
            </div>

            <div className="board-wrap">
              <BoardView
                board={viewed.board}
                ruleset={ruleset}
                frameColor={variants?.sharedBoard ? '#8D857A' : viewed.color}
                showZones={options.showZones}
                interactive={canPlaceHere}
                legal={viewId === activeId ? legal : []}
                ghost={canPlaceHere && selected !== null ? { tileId: selected, rot, flipped } : null}
                hint={hint && viewId === activeId ? { cell: hint.cell, rot: hint.rot } : null}
                lastPlaced={lastPlaced}
                onPlace={play}
                forbidden={viewed.forbiddenColors}
                flash={flash}
              />
            </div>

            {pinned !== null && pinned !== activeId && (
              <button className="btn small" onClick={() => setPinned(null)}>
                ↩ Revenir au plateau de {active.name}
              </button>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------ colonne détails */}
      <div className="col-right">
        <div className="panel">
          <h3>Score de {viewed.name}</h3>
          {variants?.sharedBoard && (
            <p className="note" style={{ margin: '0 0 8px' }}>
              Plateau commun : chacun encaisse ses points au moment de la pose — le détail
              ci-dessous décrit le plateau entier, le total est ce que {viewed.name} a engrangé.
            </p>
          )}
          {options.liveScore ? (
            <ScoreDetail breakdown={breakdowns[viewId]} />
          ) : (
            <p className="note">
              Le score en direct est désactivé. Active-le dans la barre du haut pour suivre le
              décompte pendant la partie.
            </p>
          )}
        </div>

        {missions.length > 0 && (
          <div className="panel">
            <h3>
              {state.options.personalCards
                ? `Carte mission de ${viewed.name}`
                : missions.length > 1
                  ? 'Cartes missions de la table'
                  : 'Carte mission de la table'}
            </h3>
            <div className="stack" style={{ gap: 8 }}>
              {missions.map((m) => (
                <MissionCardView
                  key={m.card.id}
                  card={m.card}
                  compact
                  points={m.points}
                  detail={m.detail}
                  structural={m.structural}
                  color={m.color}
                />
              ))}
            </div>
          </div>
        )}

        {/* variante Échange de plateaux : les deux cartes, face cachée puis révélées */}
        {variants?.boardSwap && state.players.length > 1 && (
          <div className="panel">
            <h3>Échange de plateaux</h3>
            {state.round < swapRound(state.options.ruleset) ? (
              <>
                <div className="swap-cards">
                  <span className="swap-card back">?</span>
                  <span className="swap-card back">?</span>
                </div>
                <p className="note">
                  Une des deux cartes sera retournée à la manche{' '}
                  {swapRound(state.options.ruleset) + 1}.
                </p>
              </>
            ) : (
              <>
                <div className="swap-cards">
                  <span className={`swap-card ${state.swapCard === 'rotate' ? 'on' : 'off'}`}>
                    {state.swapCard === 'rotate' ? 'Rotation !' : 'Pas de rotation !'}
                  </span>
                </div>
                <p className="note">
                  {state.swapCard === 'rotate'
                    ? 'Les plateaux ont tourné : chacun a reçu celui de son voisin de droite.'
                    : 'Chacun garde son plateau jusqu’à la fin.'}
                </p>
              </>
            )}
          </div>
        )}

        {/* variante Couleur secrète : la tuile reçue par le joueur affiché */}
        {variants?.secretColor && viewed.secretColor && (
          <div className="panel">
            <h3>Couleur secrète de {viewed.name}</h3>
            <div className="row" style={{ gap: 12 }}>
              <ColorTile tileId={COLOR_TILE_IDS[viewed.secretColor]} size={54} />
              <div>
                <strong>{COLOR_NAMES[viewed.secretColor]}</strong>
                <p className="note" style={{ margin: '2px 0 0' }}>
                  Son meilleur chemin de cette couleur sera doublé.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* variante Couleur interdite : les tuiles interdites du joueur affiché */}
        {variants?.forbiddenColor && (viewed.forbiddenColors?.length ?? 0) > 0 && (
          <div className="panel">
            <h3>
              {viewed.forbiddenColors!.length > 1 ? 'Couleurs interdites' : 'Couleur interdite'} de{' '}
              {viewed.name}
            </h3>
            <div className="row" style={{ gap: 12 }}>
              {viewed.forbiddenColors!.map((c) => (
                <ColorTile key={c} tileId={COLOR_TILE_IDS[c]} size={54} />
              ))}
              <div>
                <strong>
                  {viewed.forbiddenColors!.map((c) => COLOR_NAMES[c]).join(', ')}
                </strong>
                <p className="note" style={{ margin: '2px 0 0' }}>
                  {viewed.forbiddenColors!.length > 1 ? 'Ces couleurs comptent' : 'Cette couleur compte'}{' '}
                  comme le noir : {signed(ruleset.blackPenalty)} pts par zone, quelle que soit sa
                  taille.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* rappel des variantes de la partie */}
        {activeVariants.length > 0 && (
          <div className="panel">
            <h3>Variantes</h3>
            <div className="stack" style={{ gap: 4 }}>
              {activeVariants.map((v) => (
                <div key={v.label}>
                  <button
                    className={`variant-chip ${openVariant === v.label ? 'on' : ''}`}
                    onClick={() =>
                      setOpenVariant((o) => (o === v.label ? null : v.label))
                    }
                  >
                    {v.label}
                    <span className="chev">{openVariant === v.label ? '▾' : '▸'}</span>
                  </button>
                  {openVariant === v.label && (
                    <p className="variant-desc">{v.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* barème en vigueur, présenté comme la feuille de score */}
        <div className="panel">
          <h3>Barème</h3>
          <p className="scoresheet-caption">Points des tuiles connectées</p>
          <div className="scoresheet">
            {envers && (
              <div className="scoresheet-row banned pos">
                <span className="k">Départ</span>
                <span className="eq">=</span>
                <strong>{REVERSED_BASE} pts</strong>
              </div>
            )}
            {[3, 4, 5, 6, 7, 8, 9].map((n) => (
              <div className={`scoresheet-row ${envers ? 'neg' : ''}`} key={n}>
                <span className="k">{n === 9 ? '9+' : n}</span>
                <span className="eq">=</span>
                <strong>{signe * (ruleset.pointsBySpan[n] ?? 0)} pts</strong>
              </div>
            ))}
            <div className={`scoresheet-row ${signe * ruleset.blackPenalty < 0 ? 'neg' : 'pos'}`}>
              <span className="k">Noir</span>
              <span className="eq">=</span>
              <strong>{signed(signe * ruleset.blackPenalty)} pts</strong>
            </div>
            {variants?.clovers && (
              <>
                <div className="scoresheet-row clover">
                  <span className="k">☘ chemin</span>
                  <span className="eq">=</span>
                  <strong>{signed(signe * 3)} pts</strong>
                </div>
                <div className="scoresheet-row clover">
                  <span className="k">☘ perdu</span>
                  <span className="eq">=</span>
                  <strong>{signed(signe * -3)} pts</strong>
                </div>
              </>
            )}
            {variants?.magicStars && (
              <>
                <div className="scoresheet-row star">
                  <span className="k">★ seule</span>
                  <span className="eq">=</span>
                  <strong>{signed(signe)} pt</strong>
                </div>
                <div className="scoresheet-row star">
                  <span className="k">
                    {variants.starScoring === 'growing' ? '★ groupe de N' : '★ reliée'}
                  </span>
                  <span className="eq">=</span>
                  <strong>
                    {variants.starScoring === 'growing'
                      ? `${signe < 0 ? '−' : ''}N pts chacune`
                      : `${signed(signe * 2)} pts`}
                  </strong>
                </div>
              </>
            )}
            {variants?.crystals && (
              <div className="scoresheet-row star">
                <span className="k">◆ intacte</span>
                <span className="eq">=</span>
                <strong>{signed(signe * 4)} pts</strong>
              </div>
            )}
            {variants?.forbiddenColor && (
              <div className={`scoresheet-row banned ${envers ? 'pos' : 'neg'}`}>
                <span className="k">Interdite</span>
                <span className="eq">=</span>
                <strong>{signed(signe * ruleset.blackPenalty)} pts par zone</strong>
              </div>
            )}
          </div>
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
          {!online && (
            <button className="btn small" onClick={undo} disabled={history.length <= 1}>
              ↶ Annuler
            </button>
          )}
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

/**
 * La tuile qu'un bot vient de prendre traverse l'écran, de la pioche vers son
 * plateau : on comprend ce qu'il a joué sans quitter son propre plateau.
 */
function FlyingTile({
  tileId,
  from,
  to,
  showStar = false,
}: {
  tileId: number
  from: DOMRect
  to: DOMRect
  showStar?: boolean
}) {
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArrived(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const size = 60
  const start = { x: from.left + from.width / 2 - size / 2, y: from.top + 4 }
  const end = { x: to.left + to.width / 2 - size / 2, y: to.top + to.height / 2 - size / 2 }
  const pos = arrived ? end : start
  return (
    <div
      className="flying-tile"
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) scale(${arrived ? 0.45 : 1}) rotate(${
          arrived ? 180 : 0
        }deg)`,
        opacity: arrived ? 0 : 1,
        width: size,
        height: size,
        transitionDuration: `${FLY_MS}ms`,
      }}
      aria-hidden
    >
      <TileGlyph tileId={tileId} size={size} showStar={showStar} />
    </div>
  )
}
