import { useId } from 'react'
import { CLOVERS, COLOR_HEX, CRYSTALS, DYES, FAULTS, STARS, tileQuads, WHITE, WINDMILLS } from '../../engine/index.ts'
import type { Rotation } from '../../engine/index.ts'
import { IridescentDefs, quadFill, Sheen } from './Iridescent.tsx'
import { CloverMark, CrystalMark, DyeMark, FaultMark, WindmillMark } from './TileMarks.tsx'

interface Props {
  tileId: number
  /** Rotation logique (0-3). */
  rot?: Rotation
  /** Face miroir (variante Tuiles miroir). */
  flipped?: boolean
  /** Affiche l'étoile magique si la tuile en porte une (variante). */
  showStar?: boolean
  /** Affiche la faille si la tuile en porte une (variante). */
  showFault?: boolean
  /** Affiche le trèfle si la tuile en porte un (variante). */
  showClover?: boolean
  /** Affiche le cristal si la tuile en porte un (variante). */
  showCrystal?: boolean
  /** Affiche la teinture si la tuile en porte une (variante). */
  showDye?: boolean
  /** Affiche le moulin si la tuile en porte un (variante). */
  showWindmill?: boolean
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
  showFault = false,
  showClover = false,
  showCrystal = false,
  showDye = false,
  showWindmill = false,
  angle,
  size = 64,
  className,
}: Props) {
  const irisId = useId()
  const quads = tileQuads(tileId, 0, flipped)
  const deg = angle ?? rot * 90
  const starQuad = showStar ? (STARS.get(tileId) ?? null) : null
  const FLIP = [1, 0, 3, 2]
  const starAt = starQuad === null ? null : flipped ? FLIP[starQuad] : starQuad
  const cloverQuad = showClover ? (CLOVERS.get(tileId) ?? null) : null
  const cloverAt = cloverQuad === null ? null : flipped ? FLIP[cloverQuad] : cloverQuad
  const crystalQuad = showCrystal ? (CRYSTALS.get(tileId) ?? null) : null
  const crystalAt = crystalQuad === null ? null : flipped ? FLIP[crystalQuad] : crystalQuad
  const dye = showDye ? (DYES.get(tileId) ?? null) : null
  const dyeAtQuad = dye === null ? null : flipped ? FLIP[dye.quad] : dye.quad
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
      <IridescentDefs id={irisId} />
      <g className="spin" style={{ transform: `rotate(${deg}deg)`, transformOrigin: '50px 50px' }}>
        {quads.every((q) => q === WHITE) ? (
          // tuile arc-en-ciel : UN seul grand carré irisé, pas quatre
          <>
            <rect className="quad" x="0" y="0" width="100" height="100" fill={`url(#${irisId})`} />
            <Sheen x={0} y={0} size={100} irisId={irisId} />
          </>
        ) : (
          ([[0, 0], [50, 0], [50, 50], [0, 50]] as [number, number][]).map(([qx, qy], k) => (
            <rect
              key={k}
              className="quad"
              x={qx}
              y={qy}
              width="50"
              height="50"
              fill={quadFill(quads[k], irisId)}
            />
          ))
        )}
        {showFault && FAULTS.get(tileId) !== undefined && (
          <FaultMark x={0} y={0} size={100} axis={FAULTS.get(tileId) as 0 | 1} />
        )}
        {showClover && cloverAt !== null && (
          <CloverMark
            cx={STAR_XY[cloverAt][0]}
            cy={STAR_XY[cloverAt][1]}
            size={30}
          />
        )}
        {crystalAt !== null && (
          <CrystalMark cx={STAR_XY[crystalAt][0]} cy={STAR_XY[crystalAt][1]} size={30} />
        )}
        {showDye && dye !== null && dyeAtQuad !== null && (
          <DyeMark
            cx={STAR_XY[dyeAtQuad][0]}
            cy={STAR_XY[dyeAtQuad][1]}
            size={28}
            color={COLOR_HEX[dye.color]}
          />
        )}
        {showWindmill && WINDMILLS.has(tileId) && <WindmillMark cx={50} cy={50} size={36} />}
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
