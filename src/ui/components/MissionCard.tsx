import type { MissionCard } from '../../engine/index.ts'

interface Props {
  card: MissionCard
  /** Points marqués par le joueur pour cette carte, si connus. */
  points?: number
  detail?: string
  /** La carte modifie le barème : afficher son effet, pas un total à ajouter. */
  structural?: boolean
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
  compact,
  selected,
  onClick,
}: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`mission-card ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className="mission-badge">{card.badge}</span>
      <span className="mission-text">{card.text}</span>
      {points !== undefined && (
        <span className={`mission-score ${points > 0 || structural ? 'pos' : ''}`}>
          {!structural && (points > 0 ? `+${points}` : '0')}
          {detail && <em>{detail}</em>}
        </span>
      )}
    </Tag>
  )
}
