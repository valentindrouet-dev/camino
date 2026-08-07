import { useEffect, useRef, useState } from 'react'
import { findArchivedGame, saveGameReport } from '../storage.ts'

/**
 * Rapport de fin de partie : quelques lignes libres attachées à la partie
 * archivée. On enregistre au fil de la frappe (avec un léger différé) pour
 * qu'un rapport ne se perde jamais faute d'avoir cliqué sur un bouton.
 */
export function GameReport({
  gameId,
  onSaved,
}: {
  gameId: string
  /** Prévient l'écran appelant que l'archive a changé. */
  onSaved?: (all: ReturnType<typeof saveGameReport>) => void
}) {
  const [text, setText] = useState(() => findArchivedGame(gameId)?.report ?? '')
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | null>(null)

  // Changement de partie : on recharge le rapport correspondant.
  useEffect(() => {
    setText(findArchivedGame(gameId)?.report ?? '')
    setSaved(false)
  }, [gameId])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const change = (value: string) => {
    setText(value)
    setSaved(false)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      // L'appel doit précéder la notification : `onSaved?.(save(...))`
      // n'évaluerait pas son argument quand `onSaved` est absent.
      const all = saveGameReport(gameId, value)
      onSaved?.(all)
      setSaved(true)
    }, 500)
  }

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Rapport de fin de partie</h3>
        {saved && text.trim() && <span className="note">enregistré ✓</span>}
      </div>
      <textarea
        className="game-report"
        data-game-id={gameId}
        value={text}
        rows={4}
        placeholder="Notez ici vos remarques sur cette partie."
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          if (timer.current) window.clearTimeout(timer.current)
          const all = saveGameReport(gameId, text)
          onSaved?.(all)
          setSaved(true)
        }}
      />
      <p className="note">
        Le rapport reste attaché à cette partie : vous le retrouverez dans
        l’Historique, onglet « Rapports de partie ».
      </p>
    </div>
  )
}
