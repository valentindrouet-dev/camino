import { COLOR_HEX, STARS, tileQuads } from '../../engine/index.ts'
import type { Rotation } from '../../engine/index.ts'

interface Props {
  tileId: number
  /** Rotation logique (0-3). */
  rot?: Rotation
  /** Face miroir (variante Tuiles miroir). */
  flipped?: boolean
  /** Affiche l'étoile magique si la tuile en porte une (variante). */
  showStar?: boolean
  /**
   * Angle affiché en degrés. Permet de faire tourner la tuile « à 360° » :
   * l'angle s'accumule (90, 180, 270, 360, 450...) pour que l'animation
   * continue toujours dans le même sens.
   */
  angle?: number
  size?: number
  className?: string
}

/**
 * Une tuile CAMINO : 4 quarts de couleur, dans l'ordre horaire depuis le
 * haut-gauche.
 */
export function TileGlyph({
  tileId,
  rot = 0,
  flipped = false,
  showStar = false,
  angle,
  size = 64,
  className,
}: Props) {
  const quads = tileQuads(tileId, 0, flipped)
  const deg = angle ?? rot * 90
  const starQuad = showStar ? (STARS.get(tileId) ?? null) : null
  const FLIP = [1, 0, 3, 2]
  const starAt = starQuad === null ? null : flipped ? FLIP[starQuad] : starQuad
  const STAR_XY = [
    [25, 25],
    [75, 25],
    [75, 75],
    [25, 75],
  ]
  return (
    <svg
      className={`tile-svg ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Tuile ${tileId + 1}`}
    >
      <g className="spin" style={{ transform: `rotate(${deg}deg)`, transformOrigin: '50px 50px' }}>
        <rect className="quad" x="0" y="0" width="50" height="50" fill={COLOR_HEX[quads[0]]} />
        <rect className="quad" x="50" y="0" width="50" height="50" fill={COLOR_HEX[quads[1]]} />
        <rect className="quad" x="50" y="50" width="50" height="50" fill={COLOR_HEX[quads[2]]} />
        <rect className="quad" x="0" y="50" width="50" height="50" fill={COLOR_HEX[quads[3]]} />
        {starAt !== null && (
          <text
            x={STAR_XY[starAt][0]}
            y={STAR_XY[starAt][1] + 8}
            textAnchor="middle"
            fontSize="26"
            fill="#FFFFFF"
            stroke="#00000088"
            strokeWidth="1.2"
          >
            ★
          </text>
        )}
      </g>
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#00000055" strokeWidth="1" />
    </svg>
  )
}
