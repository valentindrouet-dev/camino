import { useState } from 'react'
import {
  BOARD_COLOR_HEX,
  BOARD_COLOR_NAMES,
  BOARD_COLORS,
  CARDS,
  COLOR_HEX,
  COLOR_NAMES,
  createBoard,
  DEFAULT_RULESET,
  PATH_COLORS,
  TILES,
} from '../../engine/index.ts'
import type { Color } from '../../engine/index.ts'
import { BoardView } from './BoardView.tsx'
import { TileGlyph } from './TileGlyph.tsx'
import { MissionCardView } from './MissionCard.tsx'

/** Tout le matériel du jeu en une page : 6 plateaux, 97 tuiles, 12 cartes. */
export function MaterialSection() {
  const [tab, setTab] = useState<'plateaux' | 'tuiles' | 'cartes'>('plateaux')
  const board = createBoard(DEFAULT_RULESET.boardSize)

  const quartCount = {} as Record<Color, number>
  for (const t of TILES) for (const q of t.quads) quartCount[q] = (quartCount[q] ?? 0) + 1

  return (
    <div className="panel" style={{ marginTop: 22 }}>
      <h3>Matériel</h3>
      <div className="tabs">
        <button className={tab === 'plateaux' ? 'on' : ''} onClick={() => setTab('plateaux')}>
          6 plateaux
        </button>
        <button className={tab === 'tuiles' ? 'on' : ''} onClick={() => setTab('tuiles')}>
          97 tuiles
        </button>
        <button className={tab === 'cartes' ? 'on' : ''} onClick={() => setTab('cartes')}>
          12 cartes
        </button>
      </div>

      {tab === 'plateaux' && (
        <>
          <div className="material-boards">
            {BOARD_COLORS.map((c) => (
              <figure key={c}>
                <BoardView
                  board={board}
                  ruleset={DEFAULT_RULESET}
                  frameColor={BOARD_COLOR_HEX[c]}
                  compact
                  showZones={false}
                />
                <figcaption>{BOARD_COLOR_NAMES[c]}</figcaption>
              </figure>
            ))}
          </div>
          <p className="note">
            Un plateau de 4 × 4 emplacements par joueur, identifié par la couleur de son contour.
            Chaque partie dure 16 manches, le temps de le remplir.
          </p>
        </>
      )}

      {tab === 'tuiles' && (
        <>
          <div className="material-tiles">
            {TILES.map((t) => (
              <TileGlyph key={t.id} tileId={t.id} size={40} />
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            {PATH_COLORS.concat(['K' as Color]).map((c) => (
              <span className="tag" key={c}>
                <span
                  className="swatch"
                  style={{ background: COLOR_HEX[c], display: 'inline-block', marginRight: 6 }}
                />
                {COLOR_NAMES[c]} · {quartCount[c]} quarts
              </span>
            ))}
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            97 tuiles, chacune divisée en 4 quarts de couleur : 55 quarts de chaque couleur et 58
            quarts noirs, soit 388 quarts au total.
          </p>
        </>
      )}

      {tab === 'cartes' && (
        <>
          <div className="material-cards">
            {CARDS.map((c) => (
              <MissionCardView key={c.id} card={c} />
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            Une seule carte est tirée pour la table : tout le monde joue la même mission. Elle
            s’ajoute au décompte habituel.
          </p>
        </>
      )}
    </div>
  )
}
