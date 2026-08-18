import { cardText, signed } from '../../engine/index.ts'
import type { Color, MissionCard } from '../../engine/index.ts'

interface Props {
  card: MissionCard
  /** Points marqués par le joueur pour cette carte, si connus. */
  points?: number
  detail?: string
  /** La carte modifie le barème : afficher son effet, pas un total à ajouter. */
  structural?: boolean
  /** Couleur tirée pour cette carte, si elle en dépend. */
  color?: Color
  /** Version compacte pour le panneau latéral. */
  compact?: boolean
  selected?: boolean
  onClick?: () => void
}

/**
 * Une carte mission, dans l'esprit des cartes de la boîte : pastille de valeur
 * cerclée de vert sur fond jaune, puis le texte de la mission.
 */
export function MissionCardView({
  card,
  points,
  detail,
  structural,
  color,
  compact,
  selected,
  onClick,
}: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`mission-card ${card.extra ? 'extra' : ''} ${card.ciel ? 'ciel' : ''} ${compact ? 'compact' : ''} ${
        selected ? 'selected' : ''
      }`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className="mission-badge">{card.badge}</span>
      <span className="mission-text">{cardText(card, color)}</span>
      {points !== undefined && (
        <span
          className={`mission-score ${
            structural || points > 0 ? 'pos' : points < 0 ? 'neg' : ''
          }`}
        >
          {!structural && (points !== 0 ? signed(points) : '0')}
          {detail && <em>{detail}</em>}
        </span>
      )}
    </Tag>
  )
}
