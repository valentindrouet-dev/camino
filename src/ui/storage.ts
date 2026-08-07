import { playerStats } from '../engine/index.ts'
import type {
  Board,
  BoardColor,
  Color,
  GameState,
  PlayerKind,
  Ruleset,
} from '../engine/index.ts'
import { PATH_COLORS } from '../engine/index.ts'

const KEY = 'camino.archive.v1'
const CONFIG_KEY = 'camino.lastconfig.v1'

export interface ArchivedResult {
  name: string
  kind: PlayerKind
  seat: number
  rank: number
  total: number
  colorPoints: number
  blackZones: number
  blackPoints: number
  scoringPaths: number
  longestPath: number
  byColor: Record<string, number>
}

/** Plateau final d'un joueur, pour pouvoir revoir la partie. */
export interface ArchivedBoard {
  name: string
  boardColor: BoardColor
  board: Board
  /** Couleurs interdites du joueur (variante), pour rejouer l'affichage. */
  forbidden?: Color[]
}

export interface ArchivedGame {
  id: string
  date: number
  seed: string
  playerCount: number
  boardSize: number
  ruleset: Ruleset
  /** Carte mission de la table, si la variante était active. */
  cardId?: string
  results: ArchivedResult[]
  /** Absent des parties archivées par les toutes premières versions. */
  boards?: ArchivedBoard[]
  /** Rapport de fin de partie saisi par le joueur. */
  report?: string
  /** Date de dernière modification du rapport. */
  reportDate?: number
}

export function loadArchive(): ArchivedGame[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ArchivedGame[]) : []
  } catch {
    return []
  }
}

export function archiveGame(state: GameState): ArchivedGame {
  const stats = playerStats(state)
  const entry: ArchivedGame = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    date: Date.now(),
    seed: state.options.seed,
    playerCount: state.players.length,
    boardSize: state.options.ruleset.boardSize,
    ruleset: state.options.ruleset,
    cardId: state.options.useCards ? state.cardId : undefined,
    boards: state.players.map((p) => ({
      name: p.name,
      boardColor: p.boardColor,
      board: p.board,
      ...(p.forbiddenColors?.length ? { forbidden: p.forbiddenColors } : {}),
    })),
    results: stats.map((s) => ({
      name: s.player.name,
      kind: s.player.kind,
      seat: s.player.id,
      rank: s.rank,
      total: s.breakdown.total,
      colorPoints: s.breakdown.colorPoints,
      blackZones: s.breakdown.blackZones,
      blackPoints: s.breakdown.blackPoints,
      scoringPaths: s.scoringPaths,
      longestPath: s.longestPath,
      byColor: Object.fromEntries(
        PATH_COLORS.map((c) => [c, s.breakdown.byColor[c as Color].points]),
      ),
    })),
  }
  const all = loadArchive()
  all.push(entry)
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(-400)))
  } catch {
    /* quota dépassé : on ignore, l'archive reste en mémoire */
  }
  return entry
}

export function clearArchive() {
  localStorage.removeItem(KEY)
}

/**
 * Enregistre (ou efface) le rapport d'une partie. Renvoie l'archive à jour.
 */
export function saveGameReport(id: string, report: string): ArchivedGame[] {
  const texte = report.trim()
  const all = loadArchive().map((g) =>
    g.id === id
      ? { ...g, report: texte || undefined, reportDate: texte ? Date.now() : undefined }
      : g,
  )
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* quota : le rapport reste au moins en mémoire */
  }
  return all
}

/** Retrouve une partie archivée par son identifiant. */
export function findArchivedGame(id: string): ArchivedGame | undefined {
  return loadArchive().find((g) => g.id === id)
}

export function deleteArchivedGame(id: string): ArchivedGame[] {
  const kept = loadArchive().filter((g) => g.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(kept))
  } catch {
    /* quota : on garde au moins la version en mémoire */
  }
  return kept
}

export interface ArchiveSummary {
  games: number
  players: number
  scores: number[]
  mean: number
  median: number
  min: number
  max: number
  byColor: Record<string, number>
  avgBlackZones: number
  avgLongest: number
  avgPaths: number
  /** Victoires par siège. */
  winsBySeat: number[]
  byPlayerName: { name: string; games: number; wins: number; mean: number; best: number }[]
}

export function summarize(archive: ArchivedGame[]): ArchiveSummary {
  const scores: number[] = []
  const byColor: Record<string, number> = {}
  for (const c of PATH_COLORS) byColor[c] = 0
  const winsBySeat: number[] = []
  const perName = new Map<string, { games: number; wins: number; sum: number; best: number }>()
  let blackZones = 0
  let longest = 0
  let paths = 0
  let players = 0

  for (const g of archive) {
    for (const r of g.results) {
      players++
      scores.push(r.total)
      for (const c of PATH_COLORS) byColor[c] += r.byColor[c] ?? 0
      blackZones += r.blackZones
      longest += r.longestPath
      paths += r.scoringPaths
      winsBySeat[r.seat] = winsBySeat[r.seat] ?? 0
      if (r.rank === 1) winsBySeat[r.seat]++
      const p = perName.get(r.name) ?? { games: 0, wins: 0, sum: 0, best: -Infinity }
      p.games++
      p.sum += r.total
      p.best = Math.max(p.best, r.total)
      if (r.rank === 1) p.wins++
      perName.set(r.name, p)
    }
  }

  const sorted = scores.slice().sort((a, b) => a - b)
  const div = players || 1
  return {
    games: archive.length,
    players,
    scores,
    mean: scores.reduce((a, b) => a + b, 0) / div,
    median: sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : 0,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    byColor: Object.fromEntries(Object.entries(byColor).map(([k, v]) => [k, v / div])),
    avgBlackZones: blackZones / div,
    avgLongest: longest / div,
    avgPaths: paths / div,
    winsBySeat: winsBySeat.map((n) => n ?? 0),
    byPlayerName: [...perName.entries()]
      .map(([name, p]) => ({
        name,
        games: p.games,
        wins: p.wins,
        mean: p.sum / p.games,
        best: p.best,
      }))
      .sort((a, b) => b.games - a.games),
  }
}

export function exportArchiveCsv(archive: ArchivedGame[]): string {
  const head = [
    'partie',
    'date',
    'graine',
    'joueurs',
    'plateau',
    'nom',
    'profil',
    'siege',
    'rang',
    'total',
    'points_couleurs',
    'zones_noires',
    'chemins',
    'plus_long',
    ...PATH_COLORS,
  ]
  const rows = archive.flatMap((g) =>
    g.results.map((r) =>
      [
        g.id,
        new Date(g.date).toISOString(),
        g.seed,
        g.playerCount,
        `${g.boardSize}x${g.boardSize}`,
        r.name,
        r.kind,
        r.seat + 1,
        r.rank,
        r.total,
        r.colorPoints,
        r.blackZones,
        r.scoringPaths,
        r.longestPath,
        ...PATH_COLORS.map((c) => r.byColor[c] ?? 0),
      ].join(','),
    ),
  )
  return [head.join(','), ...rows].join('\n')
}

export function saveLastConfig(value: unknown) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(value))
  } catch {
    /* ignoré */
  }
}

export function loadLastConfig<T>(): T | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
