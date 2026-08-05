import { COLOR_HEX, TILES } from '../../engine/index.ts'
import type { Rotation } from '../../engine/index.ts'

interface Props {
  tileId: number
  /** Rotation logique (0-3). */
  rot?: Rotation
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
export function TileGlyph({ tileId, rot = 0, angle, size = 64, className }: Props) {
  const quads = TILES[tileId].quads
  const deg = angle ?? rot * 90
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
      </g>
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#00000055" strokeWidth="1" />
    </svg>
  )
}
