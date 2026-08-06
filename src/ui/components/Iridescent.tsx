import { COLOR_HEX, WHITE } from '../../engine/index.ts'
import type { Color } from '../../engine/index.ts'

/**
 * Les tuiles blanches (variante) sont des jokers : elles appartiennent aux
 * chemins de toutes les couleurs. On les rend donc irisées — une nacre
 * arc-en-ciel avec un reflet — plutôt qu'un blanc plat qu'on confondait avec
 * un emplacement vide du plateau.
 */
export function IridescentDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFC2E0" />
        <stop offset="17%" stopColor="#FFF06A" />
        <stop offset="34%" stopColor="#96EFC0" />
        <stop offset="51%" stopColor="#8FDCFF" />
        <stop offset="68%" stopColor="#C0B4FF" />
        <stop offset="85%" stopColor="#FFB6DA" />
        <stop offset="100%" stopColor="#FFCE9B" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="58%" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/** Remplissage d'un quart : la nacre pour le blanc, la couleur sinon. */
export function quadFill(color: Color, irisId: string): string {
  return color === WHITE ? `url(#${irisId})` : COLOR_HEX[color]
}

/** Reflet posé par-dessus un quart blanc, pour l'effet brillant. */
export function Sheen({
  x,
  y,
  size,
  irisId,
  opacity = 0.34,
}: {
  x: number
  y: number
  size: number
  irisId: string
  opacity?: number
}) {
  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      fill={`url(#${irisId}-sheen)`}
      opacity={opacity}
      pointerEvents="none"
    />
  )
}
