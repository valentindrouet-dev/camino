/**
 * Durée d'une partie : le chrono démarre à la première tuile révélée et
 * s'arrête quand la partie se termine. Le format est le même partout —
 * barre du haut, écran de fin, historique, statistiques.
 */

/** `12:34`, ou `1:02:33` au-delà de l'heure. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const deux = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`
}

/** `12 min 34 s` — pour les phrases, là où le chrono serait trop sec. */
export function spellDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total} s`
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min ${String(total % 60).padStart(2, '0')} s`
}
